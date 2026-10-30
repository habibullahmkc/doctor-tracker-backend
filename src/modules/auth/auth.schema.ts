import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
