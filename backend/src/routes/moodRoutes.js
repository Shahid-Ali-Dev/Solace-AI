// backend/src/routes/moodRoutes.js
import { Router } from "express";
import {
  logMood,
  updateMoodNote,
  getMoodHistory,
  analyzeMoodAndSuggest,
} from "../controllers/moodController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
router.use(authenticateToken);

router.post("/check-in", logMood);
router.patch("/:id/note", updateMoodNote);
router.post("/suggest", analyzeMoodAndSuggest);
router.get("/history", getMoodHistory);

export default router;