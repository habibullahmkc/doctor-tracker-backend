/**
 * Resets the database with a demo admin, 25 doctors and 450 patients.
 *   npm run seed            (refuses to run when NODE_ENV=production unless --force)
 */
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { connectDB, disconnectDB } from "../config/db";
import { env } from "../config/env";
import type { Condition, PatientStatus, Specialization } from "../constants/enums";
import { AdminModel } from "../modules/admins/admin.model";
import { DoctorModel } from "../modules/doctors/doctor.model";
import { PatientModel } from "../modules/patients/patient.model";
import { DAY_MS } from "../utils/dates";
import { toTokens } from "../utils/searchTokens";

const DOCTOR_COUNT = 25;
const PATIENT_COUNT = 450;
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? "admin@doctortracker.com").toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123";

// Deterministic PRNG so every seed produces the same dataset.
let state = 20261030;
const random = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
const between = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;

const MALE_NAMES = ["Rahim", "Karim", "Tanvir", "Fahim", "Arif", "Sakib", "Nayeem", "Imran", "Rakib", "Shahed", "Mahmud", "Hasan", "Sabbir", "Rifat", "Jubayer", "Asif", "Ashraful", "Mehedi", "Zahid", "Rashed"];
const FEMALE_NAMES = ["Fatema", "Nusrat", "Sadia", "Tahmina", "Farhana", "Sharmin", "Ayesha", "Mim", "Tasnim", "Rumana", "Jannat", "Nadia", "Sumaiya", "Afroza", "Lamia", "Shirin", "Maliha", "Rehana", "Anika", "Sabina"];
const SURNAMES = ["Ahmed", "Hossain", "Rahman", "Islam", "Chowdhury", "Khan", "Sarker", "Uddin", "Alam", "Akter", "Begum", "Karim", "Haque", "Siddique", "Talukder", "Mia", "Bhuiyan", "Sultana", "Kabir", "Mollah"];
const HOSPITALS = [
  "Square Hospital",
  "Evercare Hospital Dhaka",
  "United Hospital",
  "Labaid Specialized Hospital",
  "Dhaka Medical College Hospital",
  "BSMMU Hospital",
  "Ibn Sina Hospital",
  "Popular Medical College Hospital",
  "Chittagong Medical College Hospital",
];

const DOCTOR_PROFILES: Array<[string, Specialization]> = [
  ["Sarah Ahmed", "Cardiology"], ["Kamal Hossain", "Cardiology"], ["Nasrin Sultana", "Cardiology"],
  ["Farhan Kabir", "Neurology"], ["Tahmina Akter", "Neurology"],
  ["Mizanur Rahman", "Orthopedics"], ["Shafiqul Islam", "Orthopedics"],
  ["Ruma Chowdhury", "Pediatrics"], ["Habibur Rahman", "Pediatrics"], ["Jannatul Ferdous", "Pediatrics"],
  ["Anisul Haque", "Dermatology"], ["Sabrina Karim", "Dermatology"],
  ["Shamima Nasrin", "Gynecology"], ["Rokeya Begum", "Gynecology"],
  ["Abdul Mannan", "Oncology"], ["Lutfun Nahar", "Oncology"],
  ["Rezaul Karim", "Psychiatry"], ["Nadia Islam", "Psychiatry"],
  ["Mahbub Alam", "General Medicine"], ["Fatema Tuz Zohra", "General Medicine"], ["Ashikur Rahman", "General Medicine"], ["Monirul Islam", "General Medicine"],
  ["Sharmin Haque", "ENT"], ["Tanvir Siddique", "ENT"],
  ["Imtiaz Uddin", "Cardiology"],
];

const CONDITIONS_BY_SPECIALIZATION: Record<Specialization, Condition[]> = {
  Cardiology: ["Heart Disease", "Hypertension", "Hypertension", "Diabetes"],
  Neurology: ["Migraine", "Migraine", "Depression", "Hypertension"],
  Orthopedics: ["Fracture", "Fracture", "Arthritis", "Arthritis"],
  Pediatrics: ["Fever", "Fever", "Asthma", "Skin Allergy"],
  Dermatology: ["Skin Allergy", "Skin Allergy", "Skin Allergy", "Fever"],
  Gynecology: ["Diabetes", "Hypertension", "Fever", "Depression"],
  Oncology: ["Heart Disease", "Diabetes", "Depression", "Fever"],
  Psychiatry: ["Depression", "Depression", "Migraine", "Hypertension"],
  "General Medicine": ["Fever", "Diabetes", "Hypertension", "Asthma"],
  ENT: ["Asthma", "Fever", "Skin Allergy", "Migraine"],
};

const AGE_RANGE: Partial<Record<Specialization, [number, number]>> = {
  Pediatrics: [1, 15],
  Gynecology: [18, 55],
  Cardiology: [35, 85],
  Oncology: [30, 80],
};

const phone = () => `+8801${pick(["3", "5", "6", "7", "8", "9"])}${String(between(10_000_000, 99_999_999))}`;

/** Recent admissions are more likely → visible upward trend on the dashboard. */
function admissionDate(notBefore: Date, now: Date) {
  const span = now.getTime() - notBefore.getTime();
  const skew = Math.pow(random(), 0.6); // biased towards 1 (recent)
  return new Date(notBefore.getTime() + skew * span);
}

function statusFor(admittedAt: Date, now: Date): PatientStatus {
  const days = (now.getTime() - admittedAt.getTime()) / DAY_MS;
  if (days < 7) return pick(["Admitted", "Admitted", "Under Treatment"] as const);
  if (days < 30) return pick(["Admitted", "Under Treatment", "Under Treatment", "Recovered"] as const);
  if (days < 90) return pick(["Under Treatment", "Recovered", "Recovered", "Discharged"] as const);
  return pick(["Recovered", "Discharged", "Discharged"] as const);
}

async function main() {
  if (env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    console.error("Refusing to seed with NODE_ENV=production (pass --force to override).");
    process.exit(1);
  }

  await connectDB();
  const now = new Date();

  console.log("Clearing collections…");
  await Promise.all([AdminModel.deleteMany({}), DoctorModel.deleteMany({}), PatientModel.deleteMany({})]);

  console.log(`Creating admin ${ADMIN_EMAIL}…`);
  await AdminModel.create({ name: "Admin User", email: ADMIN_EMAIL, password: await bcrypt.hash(ADMIN_PASSWORD, 10) });

  // Doctors joined over the last 13 months (oldest first).
  const doctors = DOCTOR_PROFILES.slice(0, DOCTOR_COUNT).map(([name, specialization], index) => {
    const createdAt = new Date(now.getTime() - (395 - index * 14 - between(0, 6)) * DAY_MS);
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@${pick(["gmail.com", "yahoo.com", "outlook.com"])}`;
    const hospital = pick(HOSPITALS);
    return {
      _id: new Types.ObjectId(),
      name: `Dr. ${name}`,
      specialization,
      hospital,
      phone: phone(),
      email,
      searchTokens: toTokens(`Dr. ${name}`, hospital, specialization, email),
      createdAt,
      updatedAt: createdAt,
      // Uneven workload makes the "patients per doctor" chart meaningful.
      weight: 0.4 + random() * 1.8,
    };
  });

  const totalWeight = doctors.reduce((sum, d) => sum + d.weight, 0);
  const pickDoctor = () => {
    let roll = random() * totalWeight;
    for (const doctor of doctors) {
      roll -= doctor.weight;
      if (roll <= 0) return doctor;
    }
    return doctors[doctors.length - 1];
  };

  const patients = Array.from({ length: PATIENT_COUNT }, () => {
    const doctor = pickDoctor();
    const gender = doctor.specialization === "Gynecology" ? "Female" : random() < 0.5 ? "Male" : "Female";
    const first = pick(gender === "Male" ? MALE_NAMES : FEMALE_NAMES);
    const name = `${first} ${pick(SURNAMES)}`;
    const [minAge, maxAge] = AGE_RANGE[doctor.specialization] ?? [16, 80];
    const admittedAt = admissionDate(doctor.createdAt, now);
    const patientPhone = phone();
    const email = random() < 0.55 ? `${first.toLowerCase()}${between(10, 999)}@gmail.com` : "";
    return {
      name,
      age: between(minAge, maxAge),
      gender,
      phone: patientPhone,
      email,
      condition: pick(CONDITIONS_BY_SPECIALIZATION[doctor.specialization]),
      status: statusFor(admittedAt, now),
      admissionDate: admittedAt,
      notes: "",
      doctor: doctor._id,
      searchTokens: toTokens(name, patientPhone, email),
      createdAt: admittedAt,
      updatedAt: admittedAt,
    };
  });

  // Raw driver inserts keep the historical createdAt values (Mongoose timestamps would overwrite them).
  console.log(`Inserting ${doctors.length} doctors and ${patients.length} patients…`);
  await DoctorModel.collection.insertMany(doctors.map(({ weight: _weight, ...doctor }) => doctor));
  await PatientModel.collection.insertMany(patients);

  console.log("Syncing indexes…");
  await Promise.all([AdminModel.syncIndexes(), DoctorModel.syncIndexes(), PatientModel.syncIndexes()]);

  console.log("\nSeed complete ✔");
  console.log(`  Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  await disconnectDB();
}

main().catch(async (error) => {
  console.error("Seed failed:", error);
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});
