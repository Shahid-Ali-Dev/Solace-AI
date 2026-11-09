// backend/src/routes/wellnessRoutes.js
import { Router } from "express";
import { getDailyAffirmation, getBreathingPresets, 
    getReminderPreferences, updateReminderPreferences } from "../controllers/wellnessController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
router.use(authenticateToken);
router.get("/affirmation", getDailyAffirmation);
router.get("/breathing-presets", getBreathingPresets);
router.get("/reminders", getReminderPreferences);
router.put("/reminders", updateReminderPreferences);
export default router;