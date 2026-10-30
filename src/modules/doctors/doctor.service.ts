import mongoose, { type QueryFilter, Types } from "mongoose";
import { SPECIALIZATIONS } from "../../constants/enums";
import { AppError } from "../../utils/AppError";
import { CACHE_KEYS, cache, invalidateAnalytics } from "../../utils/cache";
import { dateRangeFilter } from "../../utils/dates";
import { buildPaginationMeta, toSkip } from "../../utils/pagination";
import { countMatching } from "../../utils/query";
import { buildSearchFilter } from "../../utils/searchTokens";
import { PatientModel } from "../patients/patient.model";
import { type Doctor, DoctorModel } from "./doctor.model";
import type { DoctorBody, DoctorQuery, DoctorUpdate } from "./doctor.schema";

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
} as const;

/** Patient counts for a set of doctors in ONE indexed query (avoids N+1). */
async function countPatientsByDoctor(doctorIds: Types.ObjectId[]) {
  if (!doctorIds.length) return new Map<string, number>();
  const rows = await PatientModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { doctor: { $in: doctorIds } } },
    { $group: { _id: "$doctor", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export async function listDoctors(query: DoctorQuery) {
  const filter: QueryFilter<Doctor> = { ...buildSearchFilter(query.search) };
  if (query.specialization) filter.specialization = query.specialization;
  if (query.hospital) filter.hospital = query.hospital;
  const joined = dateRangeFilter(query.from, query.to);
  if (joined) filter.createdAt = joined;

  const [doctors, total] = await Promise.all([
    DoctorModel.find(filter).sort(SORTS[query.sort]).skip(toSkip(query.page, query.limit)).limit(query.limit).lean(),
    countMatching(DoctorModel, filter),
  ]);

  const counts = await countPatientsByDoctor(doctors.map((doctor) => doctor._id));

  return {
    data: doctors.map((doctor) => ({ ...doctor, patientCount: counts.get(String(doctor._id)) ?? 0 })),
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getDoctor(id: string) {
  const doctorId = new Types.ObjectId(id);
  const [doctor, statusRows] = await Promise.all([
    DoctorModel.findById(doctorId).lean(),
    PatientModel.aggregate<{ _id: string; count: number }>([
      { $match: { doctor: doctorId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  if (!doctor) throw new AppError(404, "Doctor not found");

  const patientsByStatus = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
  const patientCount = statusRows.reduce((sum, row) => sum + row.count, 0);
  return { ...doctor, patientCount, patientsByStatus };
}

export async function createDoctor(body: DoctorBody) {
  const doctor = await DoctorModel.create(body);
  invalidateAnalytics();
  return doctor.toJSON();
}

export async function updateDoctor(id: string, body: DoctorUpdate) {
  const doctor = await DoctorModel.findById(id);
  if (!doctor) throw new AppError(404, "Doctor not found");
  doctor.set(body);
  await doctor.save(); // re-runs validation and rebuilds searchTokens
  invalidateAnalytics();
  return doctor.toJSON();
}

/** Deletes the doctor and all of their patients atomically. */
export async function deleteDoctor(id: string) {
  const session = await mongoose.startSession();
  try {
    let deletedPatients = 0;
    await session.withTransaction(async () => {
      const doctor = await DoctorModel.findByIdAndDelete(id, { session });
      if (!doctor) throw new AppError(404, "Doctor not found");
      const result = await PatientModel.deleteMany({ doctor: doctor._id }, { session });
      deletedPatients = result.deletedCount;
    });
    invalidateAnalytics();
    return { deletedPatients };
  } finally {
    await session.endSession();
  }
}

/** Values for the filter dropdowns. */
export function getDoctorFilterOptions() {
  return cache.getOrSet(CACHE_KEYS.doctorFilters, 5 * 60_000, async () => {
    const hospitals = (await DoctorModel.distinct("hospital")) as string[];
    return { specializations: SPECIALIZATIONS, hospitals: hospitals.sort((a, b) => a.localeCompare(b)) };
  });
}

/** Lightweight list for "select a doctor" inputs. */
export const listDoctorOptions = () =>
  DoctorModel.find({}, { name: 1, specialization: 1, hospital: 1 }).sort({ name: 1 }).lean();

export async function assertDoctorExists(id: string | Types.ObjectId) {
  const exists = await DoctorModel.exists({ _id: id });
  if (!exists) throw new AppError(404, "Doctor not found");
}
