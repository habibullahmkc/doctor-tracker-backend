import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { isProd } from "../config/env";
import { AppError } from "../utils/AppError";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ success: false, message: `Invalid ${err.path}` });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    });
    return;
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? "Field";
    res.status(409).json({ success: false, message: `${field} already exists` });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  // Malformed JSON body from express.json()
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ success: false, message: "Malformed JSON body" });
    return;
  }

  console.error(err);
  res.status(500).json({
    success: false,
    message: isProd ? "Internal server error" : (err?.message ?? "Internal server error"),
  });
};
