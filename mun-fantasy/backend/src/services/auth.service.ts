import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { signToken } from "../middleware/auth.js";

export async function signup(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new AppError("Email already registered", 409, "EMAIL_TAKEN");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), password: passwordHash },
  });

  const token = signToken({ sub: user.id, email: user.email });
  const isCoordinator =
    (await prisma.courtAssignment.count({ where: { userId: user.id } })) > 0;
  return {
    token,
    user: { id: user.id, email: user.email, isAdmin: user.isAdmin, isCoordinator },
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");

  const token = signToken({ sub: user.id, email: user.email });
  const isCoordinator =
    (await prisma.courtAssignment.count({ where: { userId: user.id } })) > 0;
  return {
    token,
    user: { id: user.id, email: user.email, isAdmin: user.isAdmin, isCoordinator },
  };
}
