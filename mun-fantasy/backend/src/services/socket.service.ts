import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env.js";

let io: Server | null = null;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, methods: ["GET", "POST"], credentials: true },
  });

  io.use((socket, next) => {
    try {
      const auth = socket.handshake.auth as { token?: unknown };
      const token = typeof auth?.token === "string" ? auth.token : undefined;
      if (!token) {
        next(new Error("Authentication required"));
        return;
      }
      jwt.verify(token, env.jwtSecret);
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_match", (matchId: string) => {
      if (typeof matchId === "string" && matchId.length > 0) {
        socket.join(`match:${matchId}`);
      }
    });
    socket.on("leave_match", (matchId: string) => {
      if (typeof matchId === "string" && matchId.length > 0) {
        socket.leave(`match:${matchId}`);
      }
    });
  });
  return io;
}

export function getIo() {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

export function emitMatchUpdate(matchId: string, payload: unknown) {
  getIo().to(`match:${matchId}`).emit("match_update", payload);
}

export function emitGoalAdded(matchId: string, payload: unknown) {
  getIo().to(`match:${matchId}`).emit("goal_added", payload);
}

export function emitCardAdded(matchId: string, payload: unknown) {
  getIo().to(`match:${matchId}`).emit("card_added", payload);
}
