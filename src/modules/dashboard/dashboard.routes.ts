import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { getDashboardStats, statsQuerySchema } from "./dashboard.service";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/stats", async (req, res) => {
  const { range } = statsQuerySchema.parse(req.query);
  res.json({ success: true, data: await getDashboardStats(range) });
});
