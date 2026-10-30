import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { AdminModel } from "../admins/admin.model";
import type { LoginInput } from "./auth.schema";

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("timing-safe-placeholder", 10);

export async function login({ email, password }: LoginInput) {
  const admin = await AdminModel.findOne({ email }).select("+password");
  const valid = await bcrypt.compare(password, admin?.password ?? DUMMY_HASH);
  if (!admin || !valid) throw new AppError(401, "Invalid email or password");

  const token = jwt.sign({ sub: admin.id }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
  const { exp } = jwt.decode(token) as jwt.JwtPayload;

  return {
    token,
    expiresAt: new Date((exp ?? 0) * 1000),
    admin: { id: admin.id as string, name: admin.name, email: admin.email },
  };
}

export async function getCurrentAdmin(id: string) {
  const admin = await AdminModel.findById(id).lean();
  if (!admin) throw new AppError(401, "Account no longer exists");
  return { id: String(admin._id), name: admin.name, email: admin.email };
}
