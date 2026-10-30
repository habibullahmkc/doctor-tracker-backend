import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { CACHE_KEYS, cache } from "../../utils/cache";
import { getDashboardStats, statsQuerySchema } from "./dashboard.service";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/stats", async (req, res) => {
  const { range } = statsQuerySchema.parse(req.query);
  // Cached for 60s and invalidated by every doctor/patient write.
  const data = await cache.getOrSet(CACHE_KEYS.dashboard(range), 60_000, () => getDashboardStats(range));
  res.json({ success: true, data });
});
