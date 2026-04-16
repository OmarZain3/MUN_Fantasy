import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { coordinatorRouter } from "./routes/coordinator.routes.js";

export function createApp() {
  const app = express();
  if (env.trustProxy) {
    app.set("trust proxy", 1);
  }
  app.use(
    cors({
      origin: env.clientOrigins.length === 1 ? env.clientOrigins[0] : env.clientOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/auth", authRouter);
  app.use("/api", userRouter);
  app.use("/admin", adminRouter);
  app.use("/coordinator", coordinatorRouter);

  app.use(errorHandler);
  return app;
}
