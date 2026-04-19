import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedPlayer = {
  name: string;
  team: string;
  isGK?: boolean;
  imageUrl?: string | null;
};

async function main() {
  const slug = process.argv[2]?.trim();
  if (!slug) {
    console.error("Usage: npm run db:seed:team -- <folder-under-seed/teams>");
    console.error("Example: npm run db:seed:team -- cura");
    process.exit(1);
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const filePath = path.resolve(__dirname, "../seed/teams", slug, "players.json");
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as SeedPlayer[];

  let created = 0;
  let skipped = 0;
  for (const p of parsed) {
    const team = String(p.team);
    const name = String(p.name);
    const existing = await prisma.player.findFirst({
      where: { name, team },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma.player.create({
      data: {
        name,
        team,
        isGK: Boolean(p.isGK),
        imageUrl: p.imageUrl ? String(p.imageUrl) : null,
      },
    });
    created += 1;
  }

  console.log(`"${slug}": created ${created} player(s), skipped ${skipped} already present (same name + team).`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
