import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "./errorHandler.js";

export async function adminRequired(req: Request, _res: Response, next: NextFunction) {
  const userId = req.userId;
  if (!userId) return next(new AppError("Unauthorized", 401));

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.isAdmin) {
    return next(new AppError("Forbidden", 403, "FORBIDDEN"));
  }
  return next();
}
