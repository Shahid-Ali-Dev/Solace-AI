// backend/src/controllers/wellnessController.js
import prisma from "../config/db.js";
import { getAffirmationPrompt } from "../utils/prompts.js";
import { generateCompletion, FAST_MODEL, PRIMARY_CHAT_MODEL } from "../utils/aiClient.js";

export const getDailyAffirmation = async (req, res) => {
  try {
    const userId = req.user.userId;

    const latestMood = await prisma.moodLog.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const affirmation = await generateCompletion({
      messages: [
        { role: "system", content: "You are a mindful assistant that writes concise daily affirmations under 20 words." },
        { role: "user", content: getAffirmationPrompt(latestMood?.mood) },
      ],
      model: FAST_MODEL,
      fallbackModel: PRIMARY_CHAT_MODEL,
      temperature: 0.8,
      maxCompletionTokens: 400,
      reasoningEffort: "low",
    });

    res.json({ affirmation, moodContext: latestMood?.mood || "balanced" });
  } catch (error) {
    res.json({
      affirmation: "Peace begins the moment you give yourself permission to pause.",
      moodContext: "general",
    });
  }
};

export const getBreathingPresets = (req, res) => {
  res.json([
    {
      id: "box",
      name: "Box Breathing",
      tagline: "Reset focus & regulate heart rate",
      inhale: 4,
      hold: 4,
      exhale: 4,
      rest: 4,
    },
    {
      id: "calm_478",
      name: "4-7-8 Relax",
      tagline: "Ease deep anxiety and wind down",
      inhale: 4,
      hold: 7,
      exhale: 8,
      rest: 0,
    },
    {
      id: "sigh",
      name: "Physiological Sigh",
      tagline: "Two quick inhales, long release",
      inhale: 3,
      hold: 1,
      exhale: 6,
      rest: 1,
    },
  ]);
};

export const getReminderPreferences = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { reminderPrefs: true },
    });
    let reminders = null;
    if (user?.reminderPrefs) {
      try {
        reminders = JSON.parse(user.reminderPrefs);
      } catch {}
    }
    res.json({ reminders });
  } catch (err) {
    console.error("getReminderPreferences error:", err);
    res.status(500).json({ error: "Failed to load reminder preferences" });
  }
};

export const updateReminderPreferences = async (req, res) => {
  try {
    const { reminders } = req.body;
    if (!Array.isArray(reminders)) {
      return res.status(400).json({ error: "Reminders array is required" });
    }
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { reminderPrefs: JSON.stringify(reminders.slice(0, 20)) },
    });
    res.json({ reminders });
  } catch (err) {
    console.error("updateReminderPreferences error:", err);
    res.status(500).json({ error: "Failed to save reminder preferences" });
  }
};