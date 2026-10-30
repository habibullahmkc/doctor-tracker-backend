import { isValidObjectId } from "mongoose";
import { z } from "zod";

export const objectId = (label = "id") => z.string().refine((value) => isValidObjectId(value), `Invalid ${label}`);

export const idParamSchema = z.object({ id: objectId() });

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,19}$/, "Enter a valid phone number");
