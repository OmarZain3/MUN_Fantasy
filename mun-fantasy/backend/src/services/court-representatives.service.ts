import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

const COURTS = ["Court A", "Court B", "Court C", "Court D"] as const;

const COURT_EMAILS = [
  "court-a@munfantasy.local",
  "court-b@munfantasy.local",
  "court-c@munfantasy.local",
  "court-d@munfantasy.local",
] as const;

/** Password for all seeded court rep accounts (document in README). */
export const COURT_REP_PASSWORD = "CourtRep123!";

export type CourtRepSummary = { email: string; court: string };

/**
 * Upserts the four court coordinator users and their court assignments.
 * Does not remove other users' assignments unless `clearAllAssignmentsFirst` is true (used by full DB seed).
 */
export async function ensureCourtRepresentatives(
  prisma: PrismaClient,
  opts?: { clearAllAssignmentsFirst?: boolean },
): Promise<{ representatives: CourtRepSummary[] }> {
  if (opts?.clearAllAssignmentsFirst) {
    await prisma.courtAssignment.deleteMany({});
  }

  const courtRepPassword = await bcrypt.hash(COURT_REP_PASSWORD, 12);
  const representatives: CourtRepSummary[] = [];

  for (let i = 0; i < COURTS.length; i++) {
    const email = COURT_EMAILS[i]!;
    const court = COURTS[i]!;
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, password: courtRepPassword, isAdmin: false },
      update: { password: courtRepPassword },
    });
    await prisma.courtAssignment.upsert({
      where: { userId_court: { userId: user.id, court } },
      create: { userId: user.id, court },
      update: {},
    });
    representatives.push({ email, court });
  }

  return { representatives };
}
