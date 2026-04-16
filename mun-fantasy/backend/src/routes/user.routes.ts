import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  addPlayerToFantasyTeam,
  createFantasyTeam,
  getFantasyTeamForUser,
  leaderboard,
  removePlayerFromFantasyTeam,
  setCaptain,
  computeFantasyTeamPoints,
} from "../services/fantasy.service.js";
import { assertTransferMarketOpen, getLeagueSettings } from "../services/league-settings.service.js";
import { prisma } from "../lib/prisma.js";

export const userRouter = Router();

userRouter.use(authRequired);

userRouter.get("/settings", async (_req, res, next) => {
  try {
    const s = await getLeagueSettings();
    res.json({ transferMarketOpen: s.transferMarketOpen });
  } catch (e) {
    next(e);
  }
});

userRouter.post("/fantasy/team", async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().min(2).max(64) }).parse(req.body);
    const team = await createFantasyTeam(req.userId!, body.name);
    res.status(201).json(team);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

userRouter.get("/fantasy/team", async (req, res, next) => {
  try {
    const team = await getFantasyTeamForUser(req.userId!);
    if (!team) return res.status(404).json({ error: "No fantasy team yet" });
    const points = computeFantasyTeamPoints(team.players);
    res.json({ ...team, computedPoints: points });
  } catch (e) {
    next(e);
  }
});

userRouter.post("/fantasy/players", async (req, res, next) => {
  try {
    await assertTransferMarketOpen();
    const body = z
      .object({
        playerId: z.string().min(1),
        isSub: z.boolean().optional().default(false),
      })
      .parse(req.body);
    const row = await addPlayerToFantasyTeam(req.userId!, body.playerId, body.isSub);
    res.status(201).json(row);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

userRouter.delete("/fantasy/players/:playerId", async (req, res, next) => {
  try {
    await assertTransferMarketOpen();
    await removePlayerFromFantasyTeam(req.userId!, req.params.playerId);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

userRouter.post("/fantasy/captain", async (req, res, next) => {
  try {
    const body = z.object({ playerId: z.string().min(1) }).parse(req.body);
    const team = await setCaptain(req.userId!, body.playerId);
    res.json(team);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

userRouter.patch("/fantasy/players/:playerId/sub", async (req, res, next) => {
  try {
    await assertTransferMarketOpen();
    const body = z.object({ isSub: z.boolean() }).parse(req.body);
    const ft = await prisma.fantasyTeam.findFirst({ where: { userId: req.userId! } });
    if (!ft) throw new AppError("No fantasy team", 404);
    const ftp = await prisma.fantasyTeamPlayer.findFirst({
      where: { fantasyTeamId: ft.id, playerId: req.params.playerId },
    });
    if (!ftp) throw new AppError("Player not in squad", 404);

    if (!body.isSub) {
      const starters = await prisma.fantasyTeamPlayer.count({
        where: { fantasyTeamId: ft.id, isSub: false, NOT: { id: ftp.id } },
      });
      if (starters >= 5) {
        throw new AppError("Starting lineup is full (5 on pitch); bench a player first", 400, "XI_FULL");
      }

      const rowPlayer = await prisma.player.findUnique({ where: { id: ftp.playerId } });
      if (rowPlayer?.isGK) {
        const otherGkInXi = await prisma.fantasyTeamPlayer.count({
          where: {
            fantasyTeamId: ft.id,
            isSub: false,
            NOT: { id: ftp.id },
            player: { isGK: true },
          },
        });
        if (otherGkInXi >= 1) {
          throw new AppError("Only one goalkeeper can be in the starting XI", 400, "GK_LIMIT");
        }
      }
    }

    if (body.isSub && !ftp.isSub) {
      const subsOthers = await prisma.fantasyTeamPlayer.count({
        where: { fantasyTeamId: ft.id, isSub: true, NOT: { id: ftp.id } },
      });
      if (subsOthers >= 2) {
        throw new AppError("Bench is full (2 players)", 400, "BENCH_FULL");
      }
    }

    if (body.isSub && ftp.isCaptain) {
      await prisma.fantasyTeamPlayer.update({ where: { id: ftp.id }, data: { isCaptain: false } });
    }

    const updated = await prisma.fantasyTeamPlayer.update({
      where: { id: ftp.id },
      data: { isSub: body.isSub },
      include: { player: true },
    });
    res.json(updated);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

userRouter.get("/players", async (_req, res, next) => {
  try {
    const players = await prisma.player.findMany({ orderBy: [{ name: "asc" }, { team: "asc" }] });
    res.json(players);
  } catch (e) {
    next(e);
  }
});

userRouter.get("/leaderboard", async (_req, res, next) => {
  try {
    const board = await leaderboard();
    res.json(board);
  } catch (e) {
    next(e);
  }
});

userRouter.get("/matches/live", async (_req, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      where: { status: "LIVE" },
      include: { events: { include: { player: true }, orderBy: [{ minute: "asc" }, { id: "asc" }] } },
      orderBy: { startTime: "asc" },
    });
    res.json(matches);
  } catch (e) {
    next(e);
  }
});

userRouter.get("/matches/:id", async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { events: { include: { player: true }, orderBy: [{ minute: "asc" }, { id: "asc" }] } },
    });
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json(match);
  } catch (e) {
    next(e);
  }
});
