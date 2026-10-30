import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { validate } from "../../middleware/validate";
import { idParamSchema } from "../../utils/validators";
import * as controller from "./patient.controller";
import { patientCreateSchema, patientUpdateSchema } from "./patient.schema";

export const patientRouter = Router();

patientRouter.use(requireAuth);

patientRouter.get("/", controller.list);
patientRouter.post("/", validate(patientCreateSchema), controller.create);

const withId = validate(idParamSchema, "params");
patientRouter.get("/:id", withId, controller.getOne);
patientRouter.patch("/:id", withId, validate(patientUpdateSchema), controller.update);
patientRouter.delete("/:id", withId, controller.remove);
