import { prisma } from "../lib/prisma.js";
import { MAX_BENCH_PLAYERS, MAX_SQUAD_PLAYERS, MAX_STARTING_PLAYERS } from "../constants/fantasy.js";
import { AppError } from "../middleware/errorHandler.js";

export async function createFantasyTeam(userId: string, name: string) {
  const existing = await prisma.fantasyTeam.findFirst({ where: { userId } });
  if (existing) {
    throw new AppError("User already has a fantasy team", 409, "TEAM_EXISTS");
  }
  return prisma.fantasyTeam.create({ data: { name, userId } });
}

export async function getFantasyTeamForUser(userId: string) {
  return prisma.fantasyTeam.findFirst({
    where: { userId },
    include: { players: { include: { player: true } } },
  });
}

async function countGoalkeepersInFantasyTeam(fantasyTeamId: string) {
  return prisma.fantasyTeamPlayer.count({
    where: { fantasyTeamId, player: { isGK: true } },
  });
}

export async function addPlayerToFantasyTeam(userId: string, playerId: string, isSub: boolean) {
  const team = await prisma.fantasyTeam.findFirst({ where: { userId } });
  if (!team) throw new AppError("Create a fantasy team first", 400, "NO_TEAM");

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) throw new AppError("Player not found", 404);

  if (player.isGK) {
    const gkCount = await countGoalkeepersInFantasyTeam(team.id);
    if (gkCount >= 1) {
      throw new AppError("Your squad can only include one goalkeeper", 400, "GK_LIMIT");
    }
  }

  const count = await prisma.fantasyTeamPlayer.count({ where: { fantasyTeamId: team.id } });
  if (count >= MAX_SQUAD_PLAYERS) {
    throw new AppError(`Squad is full (${MAX_SQUAD_PLAYERS} players)`, 400, "SQUAD_FULL");
  }

  const starters = await prisma.fantasyTeamPlayer.count({
    where: { fantasyTeamId: team.id, isSub: false },
  });
  if (!isSub && starters >= MAX_STARTING_PLAYERS) {
    throw new AppError(`Starting lineup is full (${MAX_STARTING_PLAYERS} on pitch)`, 400, "XI_FULL");
  }

  if (isSub) {
    const subs = await prisma.fantasyTeamPlayer.count({
      where: { fantasyTeamId: team.id, isSub: true },
    });
    if (subs >= MAX_BENCH_PLAYERS) {
      throw new AppError(`Bench is full (${MAX_BENCH_PLAYERS} players)`, 400, "BENCH_FULL");
    }
  }

  try {
    return await prisma.fantasyTeamPlayer.create({
      data: { fantasyTeamId: team.id, playerId, isSub, isCaptain: false },
      include: { player: true },
    });
  } catch {
    throw new AppError("Player is already in your squad", 409, "DUPLICATE_PLAYER");
  }
}

export async function removePlayerFromFantasyTeam(userId: string, playerId: string) {
  const team = await prisma.fantasyTeam.findFirst({ where: { userId } });
  if (!team) throw new AppError("No fantasy team", 404, "NO_TEAM");

  const ftp = await prisma.fantasyTeamPlayer.findFirst({
    where: { fantasyTeamId: team.id, playerId },
  });
  if (!ftp) throw new AppError("Player not in squad", 404, "NOT_IN_SQUAD");

  await prisma.fantasyTeamPlayer.delete({ where: { id: ftp.id } });
  return { ok: true };
}

export async function setCaptain(userId: string, playerId: string) {
  const team = await prisma.fantasyTeam.findFirst({ where: { userId } });
  if (!team) throw new AppError("No fantasy team", 404, "NO_TEAM");

  const ftp = await prisma.fantasyTeamPlayer.findFirst({
    where: { fantasyTeamId: team.id, playerId },
  });
  if (!ftp) throw new AppError("Player not in squad", 404, "NOT_IN_SQUAD");
  if (ftp.isSub) throw new AppError("Captain must be a starting player", 400, "CAPTAIN_SUB");

  await prisma.$transaction([
    prisma.fantasyTeamPlayer.updateMany({
      where: { fantasyTeamId: team.id },
      data: { isCaptain: false },
    }),
    prisma.fantasyTeamPlayer.update({
      where: { id: ftp.id },
      data: { isCaptain: true },
    }),
  ]);

  return getFantasyTeamForUser(userId);
}

export function computeFantasyTeamPoints(
  players: { isCaptain: boolean; isSub: boolean; player: { totalPoints: number } }[],
) {
  let total = 0;
  for (const row of players) {
    if (row.isSub) continue;
    const mult = row.isCaptain ? 2 : 1;
    total += mult * row.player.totalPoints;
  }
  return total;
}

export async function leaderboard() {
  const teams = await prisma.fantasyTeam.findMany({
    include: { user: { select: { email: true } }, players: { include: { player: true } } },
  });

  const rows = teams
    .map((t) => ({
      fantasyTeamId: t.id,
      name: t.name,
      ownerEmail: t.user.email,
      points: computeFantasyTeamPoints(t.players),
    }))
    .sort((a, b) => b.points - a.points);

  return rows.map((r, idx) => ({ rank: idx + 1, ...r }));
}

export async function validateTeamNotEmpty(userId: string) {
  const team = await getFantasyTeamForUser(userId);
  if (!team || team.players.length === 0) {
    throw new AppError("Your fantasy team is empty", 400, "EMPTY_TEAM");
  }
  return team;
}
