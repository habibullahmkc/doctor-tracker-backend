import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { errorHandler } from "../../src/middleware/errorHandler";
import { AppError } from "../../src/utils/AppError";

function run(error: unknown) {
  const captured: { status?: number; body?: Record<string, unknown> } = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;
  errorHandler(error, {} as Request, res, (() => undefined) as NextFunction);
  return captured;
}

describe("errorHandler", () => {
  it("maps Zod errors to 400 with field errors", () => {
    const result = z.object({ email: z.email() }).safeParse({ email: "x" });
    const { status, body } = run(result.error);
    assert.equal(status, 400);
    assert.deepEqual(
      ((body?.errors ?? []) as { field: string }[]).map((e) => e.field),
      ["email"],
    );
  });

  it("maps invalid ObjectIds (CastError) to 400", () => {
    const error = new mongoose.Error.CastError("ObjectId", "abc", "_id");
    assert.equal(run(error).status, 400);
  });

  it("maps duplicate keys to 409 naming the field", () => {
    const { status, body } = run({ code: 11000, keyValue: { email: "a@b.com" } });
    assert.equal(status, 409);
    assert.equal(body?.message, "email already exists");
  });

  it("passes AppError status and message through", () => {
    const { status, body } = run(new AppError(404, "Doctor not found"));
    assert.equal(status, 404);
    assert.equal(body?.message, "Doctor not found");
  });

  it("maps malformed JSON to 400", () => {
    assert.equal(run({ type: "entity.parse.failed" }).status, 400);
  });

  it("hides unexpected errors behind a 500", () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      const { status, body } = run(new Error("db exploded"));
      assert.equal(status, 500);
      assert.equal(body?.success, false);
    } finally {
      console.error = original;
    }
  });
});
