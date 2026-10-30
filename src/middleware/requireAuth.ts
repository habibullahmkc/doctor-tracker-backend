import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

export const AUTH_COOKIE = "token";

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token: string | undefined = req.cookies?.[AUTH_COOKIE];
  if (!token) throw new AppError(401, "Authentication required");

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    if (!payload.sub) throw new Error("Missing subject");
    req.admin = { id: payload.sub };
    next();
  } catch {
    throw new AppError(401, "Session expired, please sign in again");
  }
};
