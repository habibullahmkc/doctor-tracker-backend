import { z } from "zod";
import { CONDITIONS, GENDERS, PATIENT_STATUSES } from "../../constants/enums";
import { DAY_MS, dateParam } from "../../utils/dates";
import { paginationSchema } from "../../utils/pagination";
import { objectId, phoneSchema } from "../../utils/validators";

// Base fields carry no defaults so that `.partial()` (PATCH) never injects values.
const patientFields = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  age: z.coerce.number().int("Age must be a whole number").min(0).max(120),
  gender: z.enum(GENDERS, "Select a valid gender"),
  phone: phoneSchema,
  email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"))]),
  condition: z.enum(CONDITIONS, "Select a valid condition"),
  status: z.enum(PATIENT_STATUSES, "Select a valid status"),
  admissionDate: z.coerce
    .date("Enter a valid admission date")
    .refine((date) => date.getTime() <= Date.now() + DAY_MS, "Admission date cannot be in the future"),
  notes: z.string().trim().max(500),
  doctor: objectId("doctor"),
});

const optionalOnCreate = {
  email: patientFields.shape.email.optional(),
  status: patientFields.shape.status.default("Admitted"),
  admissionDate: patientFields.shape.admissionDate.optional(),
  notes: patientFields.shape.notes.optional(),
};

export const patientCreateSchema = patientFields.extend(optionalOnCreate);

/** POST /doctors/:id/patients — doctor comes from the URL. */
export const patientCreateForDoctorSchema = patientCreateSchema.omit({ doctor: true });

export const patientUpdateSchema = patientFields
  .partial()
  .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update");

export const patientQuerySchema = paginationSchema
  .extend({
    search: z.string().trim().max(100).optional(),
    condition: z.enum(CONDITIONS).optional(),
    status: z.enum(PATIENT_STATUSES).optional(),
    gender: z.enum(GENDERS).optional(),
    doctor: objectId("doctor").optional(),
    from: dateParam.optional(),
    to: dateParam.optional(),
    sort: z.enum(["newest", "oldest", "name"]).default("newest"),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "'from' must be before 'to'", path: ["to"] });

export type PatientCreate = z.infer<typeof patientCreateSchema>;
export type PatientUpdate = z.infer<typeof patientUpdateSchema>;
export type PatientQuery = z.infer<typeof patientQuerySchema>;
