// backend/src/routes/moodRoutes.js
import { Router } from "express";
import {
  logMood,
  updateMoodNote,
  updateMoodEntry,
  deleteMoodLog,
  getMoodHistory,
  getMoodSummary,
  analyzeMoodAndSuggest,
  assessMoodQuestionnaire,
} from "../controllers/moodController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
router.use(authenticateToken);

router.post("/check-in", logMood);
router.post("/suggest", analyzeMoodAndSuggest);
router.get("/history", getMoodHistory);
router.get("/summary", getMoodSummary);
router.patch("/:id", updateMoodEntry);
router.patch("/:id/note", updateMoodNote);
router.delete("/:id", deleteMoodLog);
router.post("/assess", assessMoodQuestionnaire);

export default router;