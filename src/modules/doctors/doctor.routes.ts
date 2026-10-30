import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { validate } from "../../middleware/validate";
import { idParamSchema } from "../../utils/validators";
import { patientCreateForDoctorSchema } from "../patients/patient.schema";
import * as controller from "./doctor.controller";
import { doctorBodySchema, doctorUpdateSchema } from "./doctor.schema";

export const doctorRouter = Router();

doctorRouter.use(requireAuth);

doctorRouter.get("/", controller.list);
doctorRouter.post("/", validate(doctorBodySchema), controller.create);
// Static paths must be registered before "/:id".
doctorRouter.get("/filters", controller.filters);
doctorRouter.get("/options", controller.options);

const withId = validate(idParamSchema, "params");
doctorRouter.get("/:id", withId, controller.getOne);
doctorRouter.patch("/:id", withId, validate(doctorUpdateSchema), controller.update);
doctorRouter.delete("/:id", withId, controller.remove);
doctorRouter.get("/:id/patients", withId, controller.listPatientsOfDoctor);
doctorRouter.post("/:id/patients", withId, validate(patientCreateForDoctorSchema), controller.addPatientToDoctor);
