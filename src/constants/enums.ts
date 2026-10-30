export const SPECIALIZATIONS = [
  "Cardiology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Dermatology",
  "Gynecology",
  "Oncology",
  "Psychiatry",
  "General Medicine",
  "ENT",
] as const;

export const CONDITIONS = [
  "Hypertension",
  "Diabetes",
  "Asthma",
  "Heart Disease",
  "Migraine",
  "Arthritis",
  "Fracture",
  "Skin Allergy",
  "Depression",
  "Fever",
] as const;

export const PATIENT_STATUSES = ["Admitted", "Under Treatment", "Recovered", "Discharged"] as const;

export const GENDERS = ["Male", "Female", "Other"] as const;

export type Specialization = (typeof SPECIALIZATIONS)[number];
export type Condition = (typeof CONDITIONS)[number];
export type PatientStatus = (typeof PATIENT_STATUSES)[number];
export type Gender = (typeof GENDERS)[number];
