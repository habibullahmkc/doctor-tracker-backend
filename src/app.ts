import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { isDBConnected } from "./config/db";
import { env, isProd } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { router } from "./routes";

export const app = express();

// Render (and the Vercel rewrite in front of it) sit behind a proxy.
// Needed for secure cookies and correct client IPs in rate limiting.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());
app.use(compression());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(morgan(isProd ? "combined" : "dev"));

app.get("/api/health", (_req, res) => {
  const dbUp = isDBConnected();
  res.status(dbUp ? 200 : 503).json({
    success: dbUp,
    status: dbUp ? "ok" : "degraded",
    database: dbUp ? "connected" : "disconnected",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", router);

app.use(notFound);
app.use(errorHandler);
