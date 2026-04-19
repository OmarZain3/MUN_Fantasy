import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth.js";
import { adminRequired } from "../middleware/admin.js";
import { AppError } from "../middleware/errorHandler.js";
import { prisma } from "../lib/prisma.js";
import {
  addCard,
  addGoal,
  addPenalty,
  applyCleanSheetBonuses,
  updateScore,
} from "../services/match-engine.service.js";
import { resetAllRoundPoints } from "../services/points.service.js";
import { emitMatchUpdate } from "../services/socket.service.js";
import { getLeagueSettings, setTransferMarketOpen } from "../services/league-settings.service.js";

export const adminRouter = Router();

adminRouter.use(authRequired, adminRequired);

adminRouter.get("/teams", async (_req, res, next) => {
  try {
    const rows = await prisma.player.findMany({
      distinct: ["team"],
      select: { team: true },
      orderBy: { team: "asc" },
    });
    res.json(rows.map((r) => r.team));
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/settings", async (_req, res, next) => {
  try {
    const s = await getLeagueSettings();
    res.json({ transferMarketOpen: s.transferMarketOpen });
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/settings", async (req, res, next) => {
  try {
    const body = z.object({ transferMarketOpen: z.boolean() }).parse(req.body);
    const s = await setTransferMarketOpen(body.transferMarketOpen);
    res.json({ transferMarketOpen: s.transferMarketOpen });
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

adminRouter.post("/matches", async (req, res, next) => {
  try {
    const body = z
      .object({
        teamA: z.string().min(1),
        teamB: z.string().min(1),
        court: z.string().min(1),
        startTime: z.string().datetime(),
      })
      .parse(req.body);

    if (body.teamA === body.teamB) {
      throw new AppError("Team A and Team B must be different", 400, "SAME_TEAM");
    }

    const knownTeams = await prisma.player.findMany({
      distinct: ["team"],
      select: { team: true },
    });
    const allowed = new Set(knownTeams.map((r) => r.team));
    if (!allowed.has(body.teamA) || !allowed.has(body.teamB)) {
      throw new AppError(
        "Each side must be a team that exists in the player pool (run the database seed that loads JSON teams)",
        400,
        "UNKNOWN_TEAM",
      );
    }

    const match = await prisma.match.create({
      data: {
        teamA: body.teamA,
        teamB: body.teamB,
        court: body.court,
        startTime: new Date(body.startTime),
      },
    });
    res.status(201).json(match);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

adminRouter.get("/matches", async (_req, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { startTime: "desc" },
      include: { events: { include: { player: true }, orderBy: [{ minute: "asc" }, { id: "asc" }] } },
    });
    res.json(matches);
  } catch (e) {
    next(e);
  }
});

const offlineMutationOpts = { requireLive: false, emitSocket: false } as const;

adminRouter.get("/matches/:id/roster", async (req, res, next) => {
  try {
    const id = req.params.id;
    const match = await prisma.match.findUnique({ where: { id } });
    if (!match) throw new AppError("Match not found", 404);
    const players = await prisma.player.findMany({
      where: { team: { in: [match.teamA, match.teamB] } },
      orderBy: [{ name: "asc" }, { team: "asc" }, { isGK: "asc" }],
    });
    res.json({ match, players });
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/matches/:id/score", async (req, res, next) => {
  try {
    const id = req.params.id;
    const body = z
      .object({
        scoreTeamA: z.number().int().min(0),
        scoreTeamB: z.number().int().min(0),
      })
      .parse(req.body);
    const full = await updateScore(
      { matchId: id, scoreTeamA: body.scoreTeamA, scoreTeamB: body.scoreTeamB },
      offlineMutationOpts,
    );
    res.json(full);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

adminRouter.post("/matches/:id/events/goal", async (req, res, next) => {
  try {
    const id = req.params.id;
    const body = z
      .object({
        scorerId: z.string().min(1),
        assistId: z.string().min(1).optional().nullable(),
        minute: z.number().int().min(0).max(200),
        isOwnGoal: z.boolean().optional().default(false),
      })
      .parse(req.body);
    const full = await addGoal(
      {
        matchId: id,
        scorerId: body.scorerId,
        assistId: body.assistId ?? null,
        minute: body.minute,
        isOwnGoal: body.isOwnGoal,
      },
      offlineMutationOpts,
    );
    res.json(full);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

adminRouter.post("/matches/:id/events/card", async (req, res, next) => {
  try {
    const id = req.params.id;
    const body = z
      .object({
        playerId: z.string().min(1),
        minute: z.number().int().min(0).max(200),
        type: z.enum(["YELLOW", "SECOND_YELLOW", "RED"]),
      })
      .parse(req.body);
    const full = await addCard(
      { matchId: id, playerId: body.playerId, type: body.type, minute: body.minute },
      offlineMutationOpts,
    );
    res.json(full);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

adminRouter.post("/matches/:id/events/penalty", async (req, res, next) => {
  try {
    const id = req.params.id;
    const body = z
      .object({
        playerId: z.string().min(1),
        minute: z.number().int().min(0).max(200),
        type: z.enum(["PENALTY_MISS", "PENALTY_SAVE"]),
      })
      .parse(req.body);
    const full = await addPenalty(
      { matchId: id, playerId: body.playerId, type: body.type, minute: body.minute },
      offlineMutationOpts,
    );
    res.json(full);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

adminRouter.post("/matches/:id/status", async (req, res, next) => {
  try {
    const body = z
      .object({
        status: z.enum(["UPCOMING", "LIVE", "FINISHED"]),
        /** Lets you close a match that was fully entered while still UPCOMING (no LIVE phase). */
        finishFromUpcoming: z.boolean().optional(),
      })
      .parse(req.body);
    const id = req.params.id;

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.match.findUnique({ where: { id } });
      if (!current) throw new AppError("Match not found", 404);

      if (body.status === "LIVE" && current.status !== "UPCOMING") {
        throw new AppError("Only UPCOMING matches can go LIVE", 400, "INVALID_STATUS_FLOW");
      }
      if (body.status === "FINISHED") {
        const allowSkipLive = body.finishFromUpcoming === true && current.status === "UPCOMING";
        if (current.status !== "LIVE" && !allowSkipLive) {
          throw new AppError(
            "Only LIVE matches can be FINISHED unless you set finishFromUpcoming: true on an UPCOMING match",
            400,
            "INVALID_STATUS_FLOW",
          );
        }
      }

      return tx.match.update({ where: { id }, data: { status: body.status } });
    });

    if (body.status === "FINISHED") {
      await applyCleanSheetBonuses(updated.id);
    }

    const full = await prisma.match.findUnique({
      where: { id: updated.id },
      include: { events: { include: { player: true }, orderBy: [{ minute: "asc" }, { id: "asc" }] } },
    });
    if (full) emitMatchUpdate(full.id, { match: full });
    res.json(full);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

adminRouter.post("/courts/assign", async (req, res, next) => {
  try {
    const body = z.object({ userId: z.string().min(1), court: z.string().min(1) }).parse(req.body);
    const row = await prisma.courtAssignment.upsert({
      where: { userId_court: { userId: body.userId, court: body.court } },
      create: { userId: body.userId, court: body.court },
      update: {},
    });
    res.status(201).json(row);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

adminRouter.delete("/courts/assign", async (req, res, next) => {
  try {
    const body = z.object({ userId: z.string().min(1), court: z.string().min(1) }).parse(req.body);
    await prisma.courtAssignment.deleteMany({ where: { userId: body.userId, court: body.court } });
    res.json({ ok: true });
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

type SeedPlayer = {
  name: string;
  team: string;
  isGK?: boolean;
  imageUrl?: string | null;
};

adminRouter.post("/players/bulk", async (req, res, next) => {
  try {
    const body = z.object({ players: z.array(z.any()) }).parse(req.body);
    const players = body.players as SeedPlayer[];
    if (!Array.isArray(players) || players.length === 0) {
      throw new AppError("players[] is required", 400);
    }

    const created = await prisma.$transaction(
      players.map((p) =>
        prisma.player.create({
          data: {
            name: String(p.name),
            team: String(p.team),
            isGK: Boolean(p.isGK),
            imageUrl: p.imageUrl ? String(p.imageUrl) : null,
          },
        }),
      ),
    );

    res.status(201).json({ count: created.length });
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

adminRouter.get("/users", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, isAdmin: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/round/reset-points", async (_req, res, next) => {
  try {
    await resetAllRoundPoints();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
