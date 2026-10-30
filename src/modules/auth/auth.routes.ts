import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { requireAuth } from "../../middleware/requireAuth";
import { validate } from "../../middleware/validate";
import { loginHandler, logoutHandler, meHandler } from "./auth.controller";
import { loginSchema } from "./auth.schema";

// Brute-force protection: 10 attempts / 15 min per IP + email.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "")}:${String(req.body?.email ?? "").toLowerCase()}`,
  message: { success: false, message: "Too many sign-in attempts. Please try again in 15 minutes." },
});

export const authRouter = Router();

authRouter.post("/login", loginLimiter, validate(loginSchema), loginHandler);
authRouter.post("/logout", logoutHandler);
authRouter.get("/me", requireAuth, meHandler);
