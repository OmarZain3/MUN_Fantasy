import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

const SETTINGS_ID = "default";

export async function getLeagueSettings() {
  return prisma.leagueSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, transferMarketOpen: true },
    update: {},
  });
}

export async function setTransferMarketOpen(open: boolean) {
  return prisma.leagueSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, transferMarketOpen: open },
    update: { transferMarketOpen: open },
  });
}

export async function assertTransferMarketOpen() {
  const s = await getLeagueSettings();
  if (!s.transferMarketOpen) {
    throw new AppError("Transfer market is closed. Roster changes are disabled.", 403, "TRANSFER_CLOSED");
  }
}
