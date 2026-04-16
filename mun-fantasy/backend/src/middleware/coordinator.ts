import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "./errorHandler.js";

export function coordinatorForCourt(courtParam: "body" | "query" = "body", courtKey = "court") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.userId;
    if (!userId) return next(new AppError("Unauthorized", 401));

    const source = courtParam === "query" ? req.query : req.body;
    const courtRaw = source[courtKey];
    const court = typeof courtRaw === "string" ? courtRaw : undefined;
    if (!court) return next(new AppError("Court is required", 400));

    const assignment = await prisma.courtAssignment.findFirst({
      where: { userId, court },
    });
    if (!assignment) {
      return next(new AppError("No court assignment for this user", 403, "COURT_FORBIDDEN"));
    }
    (req as Request & { coordinatorCourt: string }).coordinatorCourt = court;
    return next();
  };
}

export async function assertCoordinatorMatchAccess(userId: string, matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new AppError("Match not found", 404);

  const assignment = await prisma.courtAssignment.findFirst({
    where: { userId, court: match.court },
  });
  if (!assignment) {
    throw new AppError("Coordinator cannot access this court's match", 403, "COURT_FORBIDDEN");
  }
  return match;
}
