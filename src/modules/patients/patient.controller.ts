import type { RequestHandler } from "express";
import { patientQuerySchema } from "./patient.schema";
import { createPatient, deletePatient, getPatient, listPatients, updatePatient } from "./patient.service";

type IdParams = { id: string };

export const list: RequestHandler = async (req, res) => {
  const result = await listPatients(patientQuerySchema.parse(req.query));
  res.json({ success: true, ...result });
};

export const getOne: RequestHandler<IdParams> = async (req, res) => {
  res.json({ success: true, data: await getPatient(req.params.id) });
};

export const create: RequestHandler = async (req, res) => {
  res.status(201).json({ success: true, data: await createPatient(req.body) });
};

export const update: RequestHandler<IdParams> = async (req, res) => {
  res.json({ success: true, data: await updatePatient(req.params.id, req.body) });
};

export const remove: RequestHandler<IdParams> = async (req, res) => {
  await deletePatient(req.params.id);
  res.json({ success: true, message: "Patient deleted" });
};
