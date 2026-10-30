import { Types, type QueryFilter } from "mongoose";
import { AppError } from "../../utils/AppError";
import { dateRangeFilter } from "../../utils/dates";
import { buildPaginationMeta, toSkip } from "../../utils/pagination";
import { buildSearchFilter } from "../../utils/searchTokens";
import { assertDoctorExists } from "../doctors/doctor.service";
import { PatientModel, type Patient } from "./patient.model";
import type { PatientCreate, PatientQuery, PatientUpdate } from "./patient.schema";

const SORTS = {
  newest: { admissionDate: -1 },
  oldest: { admissionDate: 1 },
  name: { name: 1 },
} as const;

const DOCTOR_FIELDS = "name specialization hospital";

export async function listPatients(query: PatientQuery) {
  const filter: QueryFilter<Patient> = { ...buildSearchFilter(query.search) };
  if (query.condition) filter.condition = query.condition;
  if (query.status) filter.status = query.status;
  if (query.gender) filter.gender = query.gender;
  if (query.doctor) filter.doctor = new Types.ObjectId(query.doctor);
  const admitted = dateRangeFilter(query.from, query.to);
  if (admitted) filter.admissionDate = admitted;

  const [patients, total] = await Promise.all([
    PatientModel.find(filter)
      .sort(SORTS[query.sort])
      .skip(toSkip(query.page, query.limit))
      .limit(query.limit)
      .populate("doctor", DOCTOR_FIELDS) // one batched $in query, not one per row
      .lean(),
    PatientModel.countDocuments(filter),
  ]);

  return { data: patients, pagination: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getPatient(id: string) {
  const patient = await PatientModel.findById(id).populate("doctor", DOCTOR_FIELDS).lean();
  if (!patient) throw new AppError(404, "Patient not found");
  return patient;
}

export async function createPatient(body: PatientCreate) {
  await assertDoctorExists(body.doctor);
  const patient = await PatientModel.create(body);
  await patient.populate("doctor", DOCTOR_FIELDS);
  return patient.toJSON();
}

export async function updatePatient(id: string, body: PatientUpdate) {
  if (body.doctor) await assertDoctorExists(body.doctor);
  const patient = await PatientModel.findById(id);
  if (!patient) throw new AppError(404, "Patient not found");
  patient.set(body);
  await patient.save(); // re-runs validation and rebuilds searchTokens
  await patient.populate("doctor", DOCTOR_FIELDS);
  return patient.toJSON();
}

export async function deletePatient(id: string) {
  const patient = await PatientModel.findByIdAndDelete(id);
  if (!patient) throw new AppError(404, "Patient not found");
}
