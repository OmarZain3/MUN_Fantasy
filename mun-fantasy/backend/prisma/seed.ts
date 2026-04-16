import { readFile, readdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedPlayer = {
  name: string;
  team: string;
  isGK?: boolean;
  imageUrl?: string | null;
};

async function main() {
  await prisma.leagueSettings.upsert({
    where: { id: "default" },
    create: { id: "default", transferMarketOpen: true },
    update: {},
  });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const seedRoot = path.resolve(__dirname, "../seed/teams");

  await prisma.matchEvent.deleteMany();
  await prisma.match.deleteMany();
  await prisma.fantasyTeamPlayer.deleteMany();
  await prisma.fantasyTeam.deleteMany();
  await prisma.player.deleteMany();

  const dirs = await readdir(seedRoot, { withFileTypes: true });
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const filePath = path.join(seedRoot, d.name, "players.json");
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as SeedPlayer[];
    for (const p of parsed) {
      await prisma.player.create({
        data: {
          name: p.name,
          team: p.team,
          isGK: Boolean(p.isGK),
          imageUrl: p.imageUrl ?? null,
        },
      });
    }
  }

  const start = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.match.create({
    data: {
      teamA: "MUN",
      teamB: "AISEC",
      court: "Court A",
      startTime: start,
      status: "UPCOMING",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      console.error(
        "\nThe database is missing tables (migrations not applied yet).\n" +
          "From mun-fantasy/backend run:\n" +
          "  npx prisma migrate deploy\n" +
          "Then seed again:\n" +
          "  npm run db:seed\n" +
          "(From monorepo root: npm run prisma:deploy && npm run db:seed)\n",
      );
    }
    await prisma.$disconnect();
    process.exit(1);
  });
