import type { RequestHandler } from "express";
import { patientQuerySchema } from "../patients/patient.schema";
import { createPatient, listPatients } from "../patients/patient.service";
import { doctorQuerySchema } from "./doctor.schema";
import {
  assertDoctorExists,
  createDoctor,
  deleteDoctor,
  getDoctor,
  getDoctorFilterOptions,
  listDoctorOptions,
  listDoctors,
  updateDoctor,
} from "./doctor.service";

type IdParams = { id: string };

export const list: RequestHandler = async (req, res) => {
  const result = await listDoctors(doctorQuerySchema.parse(req.query));
  res.json({ success: true, ...result });
};

export const filters: RequestHandler = async (_req, res) => {
  res.json({ success: true, data: await getDoctorFilterOptions() });
};

export const options: RequestHandler = async (_req, res) => {
  res.json({ success: true, data: await listDoctorOptions() });
};

export const getOne: RequestHandler<IdParams> = async (req, res) => {
  res.json({ success: true, data: await getDoctor(req.params.id) });
};

export const create: RequestHandler = async (req, res) => {
  res.status(201).json({ success: true, data: await createDoctor(req.body) });
};

export const update: RequestHandler<IdParams> = async (req, res) => {
  res.json({ success: true, data: await updateDoctor(req.params.id, req.body) });
};

export const remove: RequestHandler<IdParams> = async (req, res) => {
  const { deletedPatients } = await deleteDoctor(req.params.id);
  res.json({ success: true, message: "Doctor deleted", data: { deletedPatients } });
};

export const listPatientsOfDoctor: RequestHandler<IdParams> = async (req, res) => {
  await assertDoctorExists(req.params.id);
  const query = patientQuerySchema.parse(req.query);
  const result = await listPatients({ ...query, doctor: req.params.id });
  res.json({ success: true, ...result });
};

export const addPatientToDoctor: RequestHandler<IdParams> = async (req, res) => {
  const patient = await createPatient({ ...req.body, doctor: req.params.id });
  res.status(201).json({ success: true, data: patient });
};
