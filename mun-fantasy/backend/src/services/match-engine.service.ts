import type { Match, MatchEventType, Player } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { CLEAN_SHEET_BONUS_PER_GK, gkConcededPenaltyTotalPoints } from "../constants/points-rules.js";
import { applyPointsToPlayer, pointsDeltaForEvent } from "./points.service.js";
import { emitCardAdded, emitGoalAdded, emitMatchUpdate } from "./socket.service.js";

function assertTeamInMatch(player: Pick<Player, "team">, match: Pick<Match, "teamA" | "teamB">) {
  if (player.team !== match.teamA && player.team !== match.teamB) {
    throw new AppError("Player team is not part of this match", 400, "INVALID_TEAM");
  }
}

function goalsConcededBy(team: string, match: Pick<Match, "teamA" | "teamB" | "scoreTeamA" | "scoreTeamB">) {
  if (team === match.teamA) return match.scoreTeamB;
  if (team === match.teamB) return match.scoreTeamA;
  throw new AppError("Invalid team reference", 500);
}

async function applyGkConcededPenaltyDelta(_matchId: string, team: string, oldConceded: number, newConceded: number) {
  const oldPen = gkConcededPenaltyTotalPoints(oldConceded);
  const newPen = gkConcededPenaltyTotalPoints(newConceded);
  const delta = newPen - oldPen;
  if (delta === 0) return;

  const gks = await prisma.player.findMany({
    where: { isGK: true, team },
  });
  for (const gk of gks) {
    await applyPointsToPlayer(gk.id, delta);
  }
}

async function refreshMatch(matchId: string) {
  return prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      events: { include: { player: true }, orderBy: [{ minute: "asc" }, { id: "asc" }] },
    },
  });
}

export async function assertMatchLive(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new AppError("Match not found", 404);
  if (match.status !== "LIVE") {
    throw new AppError("Match must be LIVE to perform this action", 400, "MATCH_NOT_LIVE");
  }
  return match;
}

export async function addGoal(input: {
  matchId: string;
  scorerId: string;
  assistId?: string | null;
  minute: number;
  isOwnGoal: boolean;
}) {
  const match = await assertMatchLive(input.matchId);
  const scorer = await prisma.player.findUnique({ where: { id: input.scorerId } });
  if (!scorer) throw new AppError("Scorer not found", 404);
  assertTeamInMatch(scorer, match);

  const concedingTeam = input.isOwnGoal
    ? scorer.team
    : scorer.team === match.teamA
      ? match.teamB
      : match.teamA;
  const oldConcededForGkPenalty = goalsConcededBy(concedingTeam, match);

  if (!input.isOwnGoal) {
    if (input.assistId && input.assistId === input.scorerId) {
      throw new AppError("Assist cannot be the same player as scorer", 400, "INVALID_ASSIST");
    }
    if (input.assistId) {
      const assister = await prisma.player.findUnique({ where: { id: input.assistId } });
      if (!assister) throw new AppError("Assist player not found", 404);
      assertTeamInMatch(assister, match);
      if (assister.team !== scorer.team) {
        throw new AppError("Assist must be from the same team as the scorer", 400, "INVALID_ASSIST");
      }
    }
  } else if (input.assistId) {
    throw new AppError("Own goals cannot have an assist", 400, "INVALID_ASSIST");
  }

  await prisma.$transaction(async (tx) => {
    let scoreTeamA = match.scoreTeamA;
    let scoreTeamB = match.scoreTeamB;

    if (input.isOwnGoal) {
      await tx.matchEvent.create({
        data: {
          matchId: match.id,
          playerId: scorer.id,
          type: "OWN_GOAL",
          minute: input.minute,
        },
      });
      const delta = pointsDeltaForEvent("OWN_GOAL", scorer);
      await tx.player.update({
        where: { id: scorer.id },
        data: { totalPoints: { increment: delta }, roundPoints: { increment: delta } },
      });
      if (scorer.team === match.teamA) scoreTeamB += 1;
      else scoreTeamA += 1;
    } else {
      await tx.matchEvent.create({
        data: { matchId: match.id, playerId: scorer.id, type: "GOAL", minute: input.minute },
      });
      const gDelta = pointsDeltaForEvent("GOAL", scorer);
      await tx.player.update({
        where: { id: scorer.id },
        data: { totalPoints: { increment: gDelta }, roundPoints: { increment: gDelta } },
      });
      if (input.assistId) {
        const assister = await tx.player.findUniqueOrThrow({ where: { id: input.assistId } });
        await tx.matchEvent.create({
          data: { matchId: match.id, playerId: assister.id, type: "ASSIST", minute: input.minute },
        });
        const aDelta = pointsDeltaForEvent("ASSIST", assister);
        await tx.player.update({
          where: { id: assister.id },
          data: { totalPoints: { increment: aDelta }, roundPoints: { increment: aDelta } },
        });
      }
      if (scorer.team === match.teamA) scoreTeamA += 1;
      else scoreTeamB += 1;
    }

    await tx.match.update({
      where: { id: match.id },
      data: { scoreTeamA, scoreTeamB },
    });
  });

  const newMatch = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
  const newConcededForGkPenalty = goalsConcededBy(concedingTeam, newMatch);
  await applyGkConcededPenaltyDelta(match.id, concedingTeam, oldConcededForGkPenalty, newConcededForGkPenalty);

  const full = await refreshMatch(match.id);

  emitGoalAdded(match.id, { match: full });
  emitMatchUpdate(match.id, { match: full });
  return full;
}

export async function addCard(input: { matchId: string; playerId: string; type: MatchEventType; minute: number }) {
  const match = await assertMatchLive(input.matchId);
  const allowed: MatchEventType[] = ["YELLOW", "SECOND_YELLOW", "RED"];
  if (!allowed.includes(input.type)) {
    throw new AppError("Invalid card type", 400);
  }

  const player = await prisma.player.findUnique({ where: { id: input.playerId } });
  if (!player) throw new AppError("Player not found", 404);
  assertTeamInMatch(player, match);

  if (input.type === "YELLOW") {
    const priorYellows = await prisma.matchEvent.count({
      where: { matchId: match.id, playerId: player.id, type: "YELLOW" },
    });
    if (priorYellows >= 1) {
      throw new AppError("Use SECOND_YELLOW after a yellow has already been recorded", 400, "YELLOW_SEQUENCE");
    }
  }
  if (input.type === "SECOND_YELLOW") {
    const priorYellows = await prisma.matchEvent.count({
      where: { matchId: match.id, playerId: player.id, type: "YELLOW" },
    });
    if (priorYellows < 1) {
      throw new AppError("SECOND_YELLOW requires an existing yellow in this match", 400, "YELLOW_SEQUENCE");
    }
  }

  const delta = pointsDeltaForEvent(input.type, player);

  await prisma.$transaction([
    prisma.matchEvent.create({
      data: { matchId: match.id, playerId: player.id, type: input.type, minute: input.minute },
    }),
    prisma.player.update({
      where: { id: player.id },
      data: { totalPoints: { increment: delta }, roundPoints: { increment: delta } },
    }),
  ]);

  const full = await refreshMatch(match.id);
  emitCardAdded(match.id, { match: full, card: { playerId: player.id, type: input.type, minute: input.minute } });
  emitMatchUpdate(match.id, { match: full });
  return full;
}

export async function addPenalty(input: {
  matchId: string;
  playerId: string;
  type: "PENALTY_MISS" | "PENALTY_SAVE";
  minute: number;
}) {
  const match = await assertMatchLive(input.matchId);
  const player = await prisma.player.findUnique({ where: { id: input.playerId } });
  if (!player) throw new AppError("Player not found", 404);
  assertTeamInMatch(player, match);
  if (input.type === "PENALTY_SAVE" && !player.isGK) {
    throw new AppError("Penalty saves can only be recorded for goalkeepers", 400);
  }

  const delta = pointsDeltaForEvent(input.type, player);

  await prisma.$transaction([
    prisma.matchEvent.create({
      data: { matchId: match.id, playerId: player.id, type: input.type, minute: input.minute },
    }),
    prisma.player.update({
      where: { id: player.id },
      data: { totalPoints: { increment: delta }, roundPoints: { increment: delta } },
    }),
  ]);

  const full = await refreshMatch(match.id);
  emitMatchUpdate(match.id, { match: full });
  return full;
}

export async function updateScore(input: { matchId: string; scoreTeamA: number; scoreTeamB: number }) {
  const match = await assertMatchLive(input.matchId);
  if (input.scoreTeamA < 0 || input.scoreTeamB < 0) {
    throw new AppError("Scores cannot be negative", 400);
  }

  const oldAConceded = goalsConcededBy(match.teamA, match);
  const oldBConceded = goalsConcededBy(match.teamB, match);
  const newAConceded = input.scoreTeamB;
  const newBConceded = input.scoreTeamA;

  await prisma.match.update({
    where: { id: match.id },
    data: { scoreTeamA: input.scoreTeamA, scoreTeamB: input.scoreTeamB },
  });

  await applyGkConcededPenaltyDelta(match.id, match.teamA, oldAConceded, newAConceded);
  await applyGkConcededPenaltyDelta(match.id, match.teamB, oldBConceded, newBConceded);

  const full = await refreshMatch(match.id);
  emitMatchUpdate(match.id, { match: full });
  return full;
}

export async function applyCleanSheetBonuses(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new AppError("Match not found", 404);
  if (match.status !== "FINISHED") return match;
  if (match.cleanSheetsAppliedAt) return prisma.match.findUniqueOrThrow({ where: { id: matchId }, include: { events: { include: { player: true }, orderBy: [{ minute: "asc" }, { id: "asc" }] } } });

  const concededByA = match.scoreTeamB;
  const concededByB = match.scoreTeamA;

  await prisma.$transaction(async (tx) => {
    if (concededByA === 0) {
      const gks = await tx.player.findMany({ where: { isGK: true, team: match.teamA } });
      for (const gk of gks) {
        await tx.player.update({
          where: { id: gk.id },
          data: { totalPoints: { increment: CLEAN_SHEET_BONUS_PER_GK }, roundPoints: { increment: CLEAN_SHEET_BONUS_PER_GK } },
        });
      }
    }
    if (concededByB === 0) {
      const gks = await tx.player.findMany({ where: { isGK: true, team: match.teamB } });
      for (const gk of gks) {
        await tx.player.update({
          where: { id: gk.id },
          data: { totalPoints: { increment: CLEAN_SHEET_BONUS_PER_GK }, roundPoints: { increment: CLEAN_SHEET_BONUS_PER_GK } },
        });
      }
    }
    await tx.match.update({
      where: { id: matchId },
      data: { cleanSheetsAppliedAt: new Date() },
    });
  });

  const full = await refreshMatch(matchId);
  emitMatchUpdate(matchId, { match: full });
  return full;
}
