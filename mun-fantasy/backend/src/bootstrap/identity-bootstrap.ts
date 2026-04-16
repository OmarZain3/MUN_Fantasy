import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { ensureCourtRepresentatives } from "../services/court-representatives.service.js";

const COURTS = ["Court A", "Court B", "Court C", "Court D"] as const;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable in production: ${name}`);
  return v;
}

/**
 * Ensures admin + court coordinators (and optional demo player) exist.
 * Production: set ADMIN_EMAIL, ADMIN_PASSWORD, COURT_A_COORD_EMAIL…D, COORDINATOR_PASSWORD.
 * Development: if those are omitted, uses local demo accounts (see README).
 */
export async function bootstrapIdentityAccounts(): Promise<void> {
  const prod = isProduction();

  if (prod) {
    const adminEmail = requireEnv("ADMIN_EMAIL").toLowerCase();
    const adminPassword = requireEnv("ADMIN_PASSWORD");
    const adminHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      create: { email: adminEmail, password: adminHash, isAdmin: true },
      update: { password: adminHash, isAdmin: true },
    });

    const emails = [
      requireEnv("COURT_A_COORD_EMAIL").toLowerCase(),
      requireEnv("COURT_B_COORD_EMAIL").toLowerCase(),
      requireEnv("COURT_C_COORD_EMAIL").toLowerCase(),
      requireEnv("COURT_D_COORD_EMAIL").toLowerCase(),
    ];
    const coordPassword = requireEnv("COORDINATOR_PASSWORD");
    const coordHash = await bcrypt.hash(coordPassword, 12);

    for (let i = 0; i < COURTS.length; i++) {
      const email = emails[i]!;
      const court = COURTS[i]!;
      const user = await prisma.user.upsert({
        where: { email },
        create: { email, password: coordHash, isAdmin: false },
        update: { password: coordHash, isAdmin: false },
      });
      await prisma.courtAssignment.upsert({
        where: { userId_court: { userId: user.id, court } },
        create: { userId: user.id, court },
        update: {},
      });
    }
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const adminHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      create: { email: adminEmail, password: adminHash, isAdmin: true },
      update: { password: adminHash, isAdmin: true },
    });
  } else {
    const adminHash = await bcrypt.hash("Admin12345!", 12);
    await prisma.user.upsert({
      where: { email: "admin@munfantasy.local" },
      create: { email: "admin@munfantasy.local", password: adminHash, isAdmin: true },
      update: { password: adminHash, isAdmin: true },
    });
  }

  const eA = process.env.COURT_A_COORD_EMAIL?.trim().toLowerCase();
  const eB = process.env.COURT_B_COORD_EMAIL?.trim().toLowerCase();
  const eC = process.env.COURT_C_COORD_EMAIL?.trim().toLowerCase();
  const eD = process.env.COURT_D_COORD_EMAIL?.trim().toLowerCase();
  const coordPw = process.env.COORDINATOR_PASSWORD;
  if (eA && eB && eC && eD && coordPw) {
    const coordHash = await bcrypt.hash(coordPw, 12);
    const emails = [eA, eB, eC, eD];
    for (let i = 0; i < COURTS.length; i++) {
      const email = emails[i]!;
      const court = COURTS[i]!;
      const user = await prisma.user.upsert({
        where: { email },
        create: { email, password: coordHash, isAdmin: false },
        update: { password: coordHash, isAdmin: false },
      });
      await prisma.courtAssignment.upsert({
        where: { userId_court: { userId: user.id, court } },
        create: { userId: user.id, court },
        update: {},
      });
    }
  } else {
    await ensureCourtRepresentatives(prisma, { clearAllAssignmentsFirst: false });
  }

  const demoHash = await bcrypt.hash("Player12345!", 12);
  await prisma.user.upsert({
    where: { email: "player@munfantasy.local" },
    create: { email: "player@munfantasy.local", password: demoHash, isAdmin: false },
    update: { password: demoHash },
  });
}
