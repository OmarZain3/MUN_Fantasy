import type { MatchEventType } from "@prisma/client";

/** Single source of truth for fantasy-relevant player points from match events. */
export const POINTS_BY_EVENT: Record<
  "GOAL" | "OWN_GOAL" | "ASSIST" | "YELLOW" | "SECOND_YELLOW" | "RED" | "PENALTY_MISS" | "PENALTY_SAVE",
  { outfield: number; goalkeeper: number }
> = {
  GOAL: { outfield: 5, goalkeeper: 8 },
  OWN_GOAL: { outfield: -2, goalkeeper: -2 },
  ASSIST: { outfield: 3, goalkeeper: 3 },
  YELLOW: { outfield: -1, goalkeeper: -1 },
  SECOND_YELLOW: { outfield: -2, goalkeeper: -2 },
  RED: { outfield: -3, goalkeeper: -3 },
  PENALTY_MISS: { outfield: -2, goalkeeper: -2 },
  PENALTY_SAVE: { outfield: 0, goalkeeper: 5 },
};

export function pointsForEvent(type: MatchEventType, isGk: boolean): number {
  switch (type) {
    case "GOAL":
      return isGk ? POINTS_BY_EVENT.GOAL.goalkeeper : POINTS_BY_EVENT.GOAL.outfield;
    case "OWN_GOAL":
      return POINTS_BY_EVENT.OWN_GOAL.outfield;
    case "ASSIST":
      return POINTS_BY_EVENT.ASSIST.outfield;
    case "YELLOW":
      return POINTS_BY_EVENT.YELLOW.outfield;
    case "SECOND_YELLOW":
      return POINTS_BY_EVENT.SECOND_YELLOW.outfield;
    case "RED":
      return POINTS_BY_EVENT.RED.outfield;
    case "PENALTY_MISS":
      return POINTS_BY_EVENT.PENALTY_MISS.outfield;
    case "PENALTY_SAVE":
      if (!isGk) throw new Error("PENALTY_SAVE is only valid for goalkeepers");
      return POINTS_BY_EVENT.PENALTY_SAVE.goalkeeper;
    default:
      return 0;
  }
}

/** Clean sheet bonus per goalkeeper when the team concedes zero goals in a finished match. */
export const CLEAN_SHEET_BONUS_PER_GK = 4;

/** For every 2 goals conceded by a team, each GK on that team loses 1 point (floor division). */
export function gkConcededPenaltyTotalPoints(concededGoals: number): number {
  return -Math.floor(Math.max(0, concededGoals) / 2);
}
