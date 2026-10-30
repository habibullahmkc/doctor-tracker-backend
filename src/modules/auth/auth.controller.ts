import type { CookieOptions, RequestHandler } from "express";
import { isProd } from "../../config/env";
import { AUTH_COOKIE } from "../../middleware/requireAuth";
import { getCurrentAdmin, login } from "./auth.service";

// No `domain`: through the Next.js rewrite the browser stores this cookie
// for the frontend origin, so it is first-party and readable by proxy.ts.
const baseCookie: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  path: "/",
};

export const loginHandler: RequestHandler = async (req, res) => {
  const { token, expiresAt, admin } = await login(req.body);
  res.cookie(AUTH_COOKIE, token, { ...baseCookie, expires: expiresAt });
  res.json({ success: true, data: admin });
};

export const logoutHandler: RequestHandler = (_req, res) => {
  res.clearCookie(AUTH_COOKIE, baseCookie);
  res.json({ success: true, message: "Signed out" });
};

export const meHandler: RequestHandler = async (req, res) => {
  const admin = await getCurrentAdmin(req.admin!.id);
  res.json({ success: true, data: admin });
};
