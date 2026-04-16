import type { MatchEventType, Player } from "@prisma/client";
import { pointsForEvent } from "../constants/points-rules.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

export function pointsDeltaForEvent(type: MatchEventType, player: Pick<Player, "isGK">): number {
  try {
    return pointsForEvent(type, player.isGK);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid points rule";
    throw new AppError(msg, 400);
  }
}

export async function applyPointsToPlayer(playerId: string, delta: number) {
  if (delta === 0) return;
  await prisma.player.update({
    where: { id: playerId },
    data: {
      totalPoints: { increment: delta },
      roundPoints: { increment: delta },
    },
  });
}

export async function resetAllRoundPoints() {
  await prisma.player.updateMany({ data: { roundPoints: 0 } });
}
