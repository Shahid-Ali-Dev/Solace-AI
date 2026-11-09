// backend/src/routes/wellnessRoutes.js
import { Router } from "express";
import { getDailyAffirmation, getBreathingPresets } from "../controllers/wellnessController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
router.use(authenticateToken);
router.get("/affirmation", getDailyAffirmation);
router.get("/breathing-presets", getBreathingPresets);

export default router;