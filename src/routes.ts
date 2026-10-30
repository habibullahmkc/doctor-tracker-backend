import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { doctorRouter } from "./modules/doctors/doctor.routes";
import { patientRouter } from "./modules/patients/patient.routes";

export const router = Router();

router.use("/auth", authRouter);
router.use("/doctors", doctorRouter);
router.use("/patients", patientRouter);
router.use("/dashboard", dashboardRouter);
