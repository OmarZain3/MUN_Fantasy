import { Router } from "express";
import { z } from "zod";
import { signup, login } from "../services/auth.service.js";
import { AppError } from "../middleware/errorHandler.js";

export const authRouter = Router();

const creds = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

authRouter.post("/signup", async (req, res, next) => {
  try {
    const body = creds.parse(req.body);
    const out = await signup(body.email, body.password);
    res.status(201).json(out);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = creds.parse(req.body);
    const out = await login(body.email, body.password);
    res.json(out);
  } catch (e) {
    next(e instanceof z.ZodError ? new AppError(e.errors[0]?.message ?? "Invalid body", 400) : e);
  }
});
