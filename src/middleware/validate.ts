import type { RequestHandler } from "express";
import type { ZodType } from "zod";

/**
 * Validates and normalises `req.body` or `req.params`. A ZodError is handled
 * by the central error handler (400 with field errors).
 * Query strings are parsed inside controllers because `req.query` is a
 * read-only getter in Express 5.
 */
export const validate =
  (schema: ZodType, source: "body" | "params" = "body"): RequestHandler =>
  (req, _res, next) => {
    req[source] = schema.parse(req[source]) as never;
    next();
  };
