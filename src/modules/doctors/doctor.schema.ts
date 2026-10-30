import { z } from "zod";
import { SPECIALIZATIONS } from "../../constants/enums";
import { dateParam } from "../../utils/dates";
import { paginationSchema } from "../../utils/pagination";
import { phoneSchema } from "../../utils/validators";

export const doctorBodySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  specialization: z.enum(SPECIALIZATIONS, "Select a valid specialization"),
  hospital: z.string().trim().min(2, "Hospital must be at least 2 characters").max(150),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
});

export const doctorUpdateSchema = doctorBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update");

export const doctorQuerySchema = paginationSchema
  .extend({
    search: z.string().trim().max(100).optional(),
    specialization: z.enum(SPECIALIZATIONS).optional(),
    hospital: z.string().trim().max(150).optional(),
    from: dateParam.optional(),
    to: dateParam.optional(),
    sort: z.enum(["newest", "oldest", "name"]).default("newest"),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "'from' must be before 'to'", path: ["to"] });

export type DoctorBody = z.infer<typeof doctorBodySchema>;
export type DoctorUpdate = z.infer<typeof doctorUpdateSchema>;
export type DoctorQuery = z.infer<typeof doctorQuerySchema>;
