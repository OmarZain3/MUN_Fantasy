import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth.js";
import { assertCoordinatorMatchAccess } from "../middleware/coordinator.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  addCard,
  addGoal,
  addPenalty,
  updateScore,
} from "../services/match-engine.service.js";
import { prisma } from "../lib/prisma.js";

export const coordinatorRouter = Router();

coordinatorRouter.use(authRequired);

coordinatorRouter.get("/assignment", async (req, res, next) => {
  try {
    const rows = await prisma.courtAssignment.findMany({ where: { userId: req.userId! } });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

coordinatorRouter.get("/match/:matchId/players", async (req, res, next) => {
  try {
    await assertCoordinatorMatchAccess(req.userId!, req.params.matchId);
    const match = await prisma.match.findUniqueOrThrow({ where: { id: req.params.matchId } });
    const players = await prisma.player.findMany({
      where: { team: { in: [match.teamA, match.teamB] } },
      orderBy: [{ team: "asc" }, { isGK: "asc" }, { name: "asc" }],
    });
    res.json({ match, players });
  } catch (e) {
    next(e);
  }
});

coordinatorRouter.get("/match", async (req, res, next) => {
  try {
    const court = z.string().min(1).parse(req.query.court);
    const assignment = await prisma.courtAssignment.findFirst({
      where: { userId: req.userId!, court },
    });
    if (!assignment) {
      return res.status(403).json({ error: "No assignment for this court" });
    }

    const match = await prisma.match.findFirst({
      where: { court, status: { in: ["LIVE", "UPCOMING"] } },
      orderBy: { startTime: "asc" },
      include: { events: { include: { player: true }, orderBy: [{ minute: "asc" }, { id: "asc" }] } },
    });
    res.json(match);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid query", 400) : e);
  }
});

coordinatorRouter.post("/events/goal", async (req, res, next) => {
  try {
    const body = z
      .object({
        matchId: z.string().min(1),
        scorerId: z.string().min(1),
        assistId: z.string().min(1).optional().nullable(),
        minute: z.number().int().min(0).max(200),
        isOwnGoal: z.boolean().optional().default(false),
      })
      .parse(req.body);

    await assertCoordinatorMatchAccess(req.userId!, body.matchId);
    const match = await addGoal({
      matchId: body.matchId,
      scorerId: body.scorerId,
      assistId: body.assistId ?? null,
      minute: body.minute,
      isOwnGoal: body.isOwnGoal,
    });
    res.json(match);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

coordinatorRouter.post("/events/card", async (req, res, next) => {
  try {
    const body = z
      .object({
        matchId: z.string().min(1),
        playerId: z.string().min(1),
        minute: z.number().int().min(0).max(200),
        type: z.enum(["YELLOW", "SECOND_YELLOW", "RED"]),
      })
      .parse(req.body);

    await assertCoordinatorMatchAccess(req.userId!, body.matchId);
    const match = await addCard({
      matchId: body.matchId,
      playerId: body.playerId,
      type: body.type,
      minute: body.minute,
    });
    res.json(match);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

coordinatorRouter.post("/events/penalty", async (req, res, next) => {
  try {
    const body = z
      .object({
        matchId: z.string().min(1),
        playerId: z.string().min(1),
        minute: z.number().int().min(0).max(200),
        type: z.enum(["PENALTY_MISS", "PENALTY_SAVE"]),
      })
      .parse(req.body);

    await assertCoordinatorMatchAccess(req.userId!, body.matchId);
    const match = await addPenalty({
      matchId: body.matchId,
      playerId: body.playerId,
      type: body.type,
      minute: body.minute,
    });
    res.json(match);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

coordinatorRouter.post("/score", async (req, res, next) => {
  try {
    const body = z
      .object({
        matchId: z.string().min(1),
        scoreTeamA: z.number().int().min(0),
        scoreTeamB: z.number().int().min(0),
      })
      .parse(req.body);

    await assertCoordinatorMatchAccess(req.userId!, body.matchId);
    const match = await updateScore(body);
    res.json(match);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});
