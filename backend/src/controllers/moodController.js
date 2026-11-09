// backend/src/controllers/moodController.js
import prisma from "../config/db.js";
import {
  generateCompletion,
  FAST_MODEL,
  PRIMARY_CHAT_MODEL,
} from "../utils/aiClient.js";
import { getCompanionPersona } from "../utils/companions.js";

const getTimeOfDay = (localHour) => {
  const h = Number.isFinite(Number(localHour))
    ? Number(localHour)
    : new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "late night";
};

const getDefaultPreset = (mood) => {
  if (mood === "anxious" || mood === "overwhelmed") return "sigh";
  if (mood === "tired") return "calm_478";
  return "box";
};

const getMoodFallback = (mood, companionName) => {
  const presets = {
    peaceful: {
      empathyMessage: "It's lovely when your mind finally gets a quiet window like this.",
      suggestions: [
        {
          id: "1",
          title: "Lock In This Calm",
          actionType: "micro_journal",
          duration: "1 min",
          reason: "Notice what made today feel steady so you can revisit it later.",
          journalPrompt: "What one small thing helped create this peaceful feeling?",
          quickChips: ["Quiet focus time", "Letting go of rush"],
          placeholder: "Write one line to remember...",
        },
        {
          id: "2",
          title: "2-Minute Savoring Pause",
          actionType: "guided_steps",
          duration: "2 mins",
          reason: "Let your body register safety instead of rushing to the next task.",
          timerSeconds: 60,
          steps: [
            "Drop your shoulders and soften your gaze.",
            "Notice one comforting detail right around you.",
            "Take 3 unhurried breaths without checking your phone.",
          ],
        },
        {
          id: "3",
          title: "Protect This Headspace",
          actionType: "chat",
          duration: "3 mins",
          reason: "Set one light boundary so this calm lasts into the rest of your day.",
          starterPrompt: "I'm feeling peaceful right now—help me protect this energy today.",
        },
      ],
    },
    grateful: {
      empathyMessage: "Holding onto moments of gratitude rewires how heavy days feel later.",
      suggestions: [
        {
          id: "1",
          title: "Gratitude Snapshot",
          actionType: "micro_journal",
          duration: "1 min",
          reason: "Naming a specific detail makes positive feelings stick longer.",
          journalPrompt: "Who or what made today feel a little lighter?",
          quickChips: ["A quiet win today", "Someone who showed up"],
          placeholder: "Capture one specific moment...",
        },
        {
          id: "2",
          title: "Warmth & Posture Check",
          actionType: "guided_steps",
          duration: "1 min",
          reason: "Anchor the feeling physically so it stays with you.",
          timerSeconds: 45,
          steps: [
            "Rest one hand over your chest or stomach.",
            "Recall the exact moment you feel thankful for.",
            "Smile slightly and exhale slowly for 5 seconds.",
          ],
        },
        {
          id: "3",
          title: `Share a Win with ${companionName}`,
          actionType: "chat",
          duration: "2 mins",
          reason: "Celebrate small progress without downplaying it.",
          starterPrompt: "I'm feeling grateful today and want to savor a small win.",
        },
      ],
    },
    tired: {
      empathyMessage: "Running on low battery makes everything look harder than it actually is.",
      suggestions: [
        {
          id: "1",
          title: "20-20-20 Eye & Neck Soften",
          actionType: "guided_steps",
          duration: "1 min",
          reason: "Relieve screen fatigue and upper-shoulder tension fast.",
          timerSeconds: 45,
          steps: [
            "Look away from the screen at something 20 feet away.",
            "Roll both shoulders slowly back 4 times.",
            "Let your jaw unclench and take one loose sigh.",
          ],
        },
        {
          id: "2",
          title: "4-7-8 Deep Wind-Down",
          actionType: "breathe",
          presetId: "calm_478",
          duration: "2 mins",
          reason: "Longer exhales signal your nervous system it can power down.",
        },
        {
          id: "3",
          title: "Drop One Non-Essential",
          actionType: "micro_journal",
          duration: "1 min",
          reason: "Freeing up mental bandwidth restores energy faster than pushing through.",
          journalPrompt: "What's one thing you can postpone to tomorrow guilt-free?",
          quickChips: ["Low-priority chores", "Late-night scrolling"],
          placeholder: "Name one thing to take off your plate...",
        },
      ],
    },
    anxious: {
      empathyMessage: "That buzzing edge is uncomfortable, so let's bring the volume down one notch.",
      suggestions: [
        {
          id: "1",
          title: "Physiological Sigh",
          actionType: "breathe",
          presetId: "sigh",
          duration: "2 mins",
          reason: "Two quick inhales and a long exhale offload CO2 and slow heart rate.",
        },
        {
          id: "2",
          title: "Name the Loudest Worry",
          actionType: "micro_journal",
          duration: "2 mins",
          reason: "Putting a vague worry into plain words shrinks its grip.",
          journalPrompt: "What single thought is looping loudest right now?",
          quickChips: ["Worried about an outcome", "Too many things at once"],
          placeholder: "Write the worry in one honest sentence...",
        },
        {
          id: "3",
          title: "Cold Surface & Jaw Reset",
          actionType: "guided_steps",
          duration: "1 min",
          reason: "Physical temperature shifts interrupt spiraling thoughts.",
          timerSeconds: 45,
          steps: [
            "Touch something cool (a glass, wall, or splash cool water).",
            "Drop your tongue from the roof of your mouth.",
            "Name 3 steady objects in your line of sight.",
          ],
        },
      ],
    },
    overwhelmed: {
      empathyMessage: "You don't have to untangle the whole week tonight—just the next five minutes.",
      suggestions: [
        {
          id: "1",
          title: "Single-Line Brain Dump",
          actionType: "micro_journal",
          duration: "2 mins",
          reason: "Getting clutter out of your head frees up working memory immediately.",
          journalPrompt: "What's the #1 thing crowding your mind right now?",
          quickChips: ["Deadline pressure", "Need a clear first step"],
          placeholder: "Dump it here—just one or two lines...",
        },
        {
          id: "2",
          title: "Physiological Sigh",
          actionType: "breathe",
          presetId: "sigh",
          duration: "2 mins",
          reason: "Rapidly resets an overstimulated nervous system.",
        },
        {
          id: "3",
          title: `Sort It Out with ${companionName}`,
          actionType: "chat",
          duration: "3 mins",
          reason: "Pick one tiny next step together instead of carrying it all.",
          starterPrompt: "I feel overwhelmed—help me shrink everything down to one next step.",
        },
      ],
    },
  };

  return presets[mood] || presets.anxious;
};

const normalizeSuggestions = (rawList, mood, companionName) => {
  const fallback = getMoodFallback(mood, companionName).suggestions;
  if (!Array.isArray(rawList) || rawList.length === 0) return fallback;

  return rawList.slice(0, 3).map((item, idx) => {
    const fb = fallback[idx] || fallback[0];
    const validTypes = ["guided_steps", "micro_journal", "breathe", "chat"];
    const actionType = validTypes.includes(item?.actionType)
      ? item.actionType
      : fb.actionType;

    const base = {
      id: String(item?.id || idx + 1),
      title:
        typeof item?.title === "string" && item.title.trim()
          ? item.title.trim()
          : fb.title,
      actionType,
      duration:
        typeof item?.duration === "string" && item.duration.trim()
          ? item.duration.trim()
          : "1 min",
      reason:
        typeof item?.reason === "string" && item.reason.trim()
          ? item.reason.trim()
          : fb.reason,
    };

    if (actionType === "breathe") {
      const allowedPresets = ["box", "calm_478", "sigh"];
      base.presetId = allowedPresets.includes(item?.presetId)
        ? item.presetId
        : getDefaultPreset(mood);
    } else if (actionType === "chat") {
      base.starterPrompt =
        typeof item?.starterPrompt === "string" && item.starterPrompt.trim()
          ? item.starterPrompt.trim()
          : `I'm feeling ${mood} right now—can we talk through it?`;
    } else if (actionType === "micro_journal") {
      base.journalPrompt =
        typeof item?.journalPrompt === "string" && item.journalPrompt.trim()
          ? item.journalPrompt.trim()
          : "What's sitting on your mind right now?";
      base.quickChips = Array.isArray(item?.quickChips)
        ? item.quickChips.filter((c) => typeof c === "string" && c.trim()).slice(0, 2)
        : ["Just getting this out", "Need a gentle reset"];
      base.placeholder =
        typeof item?.placeholder === "string" && item.placeholder.trim()
          ? item.placeholder.trim()
          : "Write a short thought...";
    } else {
      // guided_steps
      const steps = Array.isArray(item?.steps)
        ? item.steps.filter((s) => typeof s === "string" && s.trim()).slice(0, 4)
        : [];
      base.steps =
        steps.length >= 2
          ? steps
          : [
              "Take one slow breath and drop your shoulders.",
              "Focus on the physical sensation for 30 seconds.",
              "Exhale fully before moving on.",
            ];
      const sec = Number(item?.timerSeconds);
      base.timerSeconds =
        Number.isFinite(sec) && sec >= 15 && sec <= 180 ? Math.round(sec) : 45;
    }

    return base;
  });
};

export const logMood = async (req, res) => {
  try {
    const { mood, note, intensity } = req.body;
    const userId = req.user.userId;

    if (typeof mood !== "string" || !mood.trim()) {
      return res.status(400).json({ error: "Mood selection is required" });
    }

    const newLog = await prisma.moodLog.create({
      data: {
        userId,
        mood: mood.trim().toLowerCase(),
        note: note || null,
        intensity: intensity || 3,
      },
    });

    res.status(201).json(newLog);
  } catch {
    res.status(500).json({ error: "Failed to log mood" });
  }
};

export const updateMoodNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user.userId;

    if (typeof note !== "string" || !note.trim()) {
      return res.status(400).json({ error: "Note cannot be empty" });
    }

    const updated = await prisma.moodLog.updateMany({
      where: { id, userId },
      data: { note: note.trim() },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "Mood log not found" });
    }

    res.json({ id, note: note.trim() });
  } catch {
    res.status(500).json({ error: "Failed to update mood note" });
  }
};

export const getMoodHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const history = await prisma.moodLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    res.json(history);
  } catch {
    res.status(500).json({ error: "Failed to fetch mood history" });
  }
};

export const analyzeMoodAndSuggest = async (req, res) => {
  let savedLogId = req.body?.logId || null;
  let companion = getCompanionPersona();

  try {
    const { mood, note, localHour } = req.body;
    const userId = req.user.userId;

    if (typeof mood !== "string" || !mood.trim()) {
      return res.status(400).json({ error: "Mood is required" });
    }

    const cleanMood = mood.trim().toLowerCase();
    const timeOfDay = getTimeOfDay(localHour);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, wellnessGoal: true, companionAvatar: true },
    });
    companion = getCompanionPersona(user?.companionAvatar);

    const realName =
      user?.name && !["Friend", "Guest Explorer"].includes(user.name.trim())
        ? user.name.trim()
        : null;

    if (savedLogId) {
      const updated = await prisma.moodLog.updateMany({
        where: { id: savedLogId, userId },
        data: { mood: cleanMood, note: note || null },
      });
      if (updated.count === 0) savedLogId = null;
    }

    if (!savedLogId) {
      const created = await prisma.moodLog.create({
        data: {
          userId,
          mood: cleanMood,
          note: note || null,
        },
      });
      savedLogId = created.id;
    }

    const prompt = `
${realName ? `User: ${realName}` : "User"} | Time: ${timeOfDay} | Goal: "${user?.wellnessGoal || "Calm & Stress Relief"}"
Current mood: "${cleanMood}" | Note: "${note || "None"}"

You are ${companion.name}. ${companion.style}
Write 1 warm empathyMessage (1-2 natural sentences; skip clichés like "I hear you", "It sounds like", or "Thank you for checking in").

Create 3 genuinely varied interactive tasks tailored specifically to "${cleanMood}" at ${timeOfDay}.
Choose the 3 best-fitting formats from these 4 actionTypes (never default to the exact same combo or generic "Box Breathing / Talk thoughts" every time):
1. "guided_steps" — physical/sensory micro-practice done in a modal (include "steps": array of 3 crisp steps, and "timerSeconds": 30-90). Great for somatic release, posture, eye rest, joy savoring, or grounding.
2. "micro_journal" — 1-minute reflection dialog right inside the app (include "journalPrompt": 1 focused question, "quickChips": 2 short 2-4 word starter chips, and "placeholder": short hint). Great for brain dumps, gratitude snapshots, reframing, or setting boundaries.
3. "breathe" — ONLY include when breathwork fits the mood ("presetId": "sigh" for anxious/overwhelmed, "calm_478" for tired/night wind-down, "box" for reset/focus). Skip breathing for "peaceful" or "grateful" unless truly fitting.
4. "chat" — conversation continuation with ${companion.name} (include "starterPrompt": natural first-person sentence the user taps to send).

Output ONLY valid JSON:
{
  "empathyMessage": "...",
  "suggestions": [
    {
      "id": "1",
      "title": "<2-5 word specific title>",
      "actionType": "guided_steps | micro_journal | breathe | chat",
      "duration": "<1 min | 2 mins | 3 mins>",
      "reason": "<short benefit>",
      "steps": ["only if guided_steps"],
      "timerSeconds": 45,
      "journalPrompt": "only if micro_journal",
      "quickChips": ["only if micro_journal", "chip 2"],
      "placeholder": "only if micro_journal",
      "presetId": "only if breathe",
      "starterPrompt": "only if chat"
    }
  ]
}
`;

    const rawContent = await generateCompletion({
      messages: [
        { role: "system", content: "You are a warm wellness companion API returning strict JSON." },
        { role: "user", content: prompt },
      ],
      model: FAST_MODEL,
      fallbackModel: PRIMARY_CHAT_MODEL,
      temperature: 0.85,
      maxCompletionTokens: 850,
      reasoningEffort: "low",
      jsonMode: true,
    });

    const cleanJson = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsedData = JSON.parse(cleanJson);
    if (!parsedData?.empathyMessage || !Array.isArray(parsedData?.suggestions)) {
      throw new Error("Malformed suggestion payload");
    }

    res.json({
      logId: savedLogId,
      empathyMessage: parsedData.empathyMessage.trim(),
      suggestions: normalizeSuggestions(
        parsedData.suggestions,
        cleanMood,
        companion.name
      ),
    });
  } catch (error) {
    console.error("Mood Suggestion Error:", error);
    const cleanMood =
      typeof req.body?.mood === "string"
        ? req.body.mood.trim().toLowerCase()
        : "anxious";
    const fb = getMoodFallback(cleanMood, companion.name);
    res.json({
      logId: savedLogId,
      ...fb,
    });
  }
};