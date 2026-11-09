// backend/src/controllers/moodController.js
import prisma from "../config/db.js";
import {
  generateCompletion,
  FAST_MODEL,
  PRIMARY_CHAT_MODEL,
} from "../utils/aiClient.js";
import { getCompanionPersona } from "../utils/companions.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_MOODS = ["peaceful", "anxious", "tired", "overwhelmed", "grateful"];

const clampIntensity = (val) => {
  const num = Number(val);
  if (!Number.isFinite(num)) return 3;
  return Math.min(5, Math.max(1, Math.round(num)));
};

const sanitizeTzOffset = (val) => {
  const num = Number(val);
  // JS getTimezoneOffset() returns minutes behind UTC (IST = -330)
  if (!Number.isFinite(num) || num < -840 || num > 840) return 0;
  return Math.round(num);
};

const toLocalDayKey = (dateInput, tzOffsetMinutes = 0) => {
  const ms = new Date(dateInput).getTime() - tzOffsetMinutes * 60 * 1000;
  const shifted = new Date(ms);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const dayKeyToEpoch = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const epochToDayKey = (epoch) => {
  const dt = new Date(epoch);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const computeStreaks = (logs = [], tzOffsetMinutes = 0) => {
  if (!logs.length) return { currentStreak: 0, longestStreak: 0 };

  const uniqueKeysDesc = [...new Set(logs.map((l) => toLocalDayKey(l.createdAt, tzOffsetMinutes)))];
  const daySet = new Set(uniqueKeysDesc);

  const todayKey = toLocalDayKey(new Date(), tzOffsetMinutes);
  const yesterdayKey = epochToDayKey(dayKeyToEpoch(todayKey) - DAY_MS);

  // Current streak stays alive until end of today if user checked in yesterday
  let currentStreak = 0;
  let cursorEpoch = daySet.has(todayKey)
    ? dayKeyToEpoch(todayKey)
    : daySet.has(yesterdayKey)
    ? dayKeyToEpoch(yesterdayKey)
    : null;

  while (cursorEpoch !== null && daySet.has(epochToDayKey(cursorEpoch))) {
    currentStreak += 1;
    cursorEpoch -= DAY_MS;
  }

  // Longest historical streak
  const sortedEpochsAsc = uniqueKeysDesc.map(dayKeyToEpoch).sort((a, b) => a - b);
  let longestStreak = 0;
  let run = 0;
  for (let i = 0; i < sortedEpochsAsc.length; i += 1) {
    if (i === 0 || sortedEpochsAsc[i] - sortedEpochsAsc[i - 1] === DAY_MS) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
  }

  return { currentStreak, longestStreak };
};

const parseSnapshot = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.empathyMessage && Array.isArray(parsed?.suggestions)) {
      return parsed;
    }
  } catch {}
  return null;
};

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
        note: typeof note === "string" && note.trim() ? note.trim() : null,
        intensity: clampIntensity(intensity),
      },
    });

    res.status(201).json(newLog);
  } catch (err) {
    console.error("logMood error:", err);
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

export const updateMoodEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, intensity, mood } = req.body;
    const userId = req.user.userId;

    const existing = await prisma.moodLog.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Mood log not found" });
    }

    const data = {};
    if (typeof note === "string") data.note = note.trim() || null;
    if (intensity !== undefined) data.intensity = clampIntensity(intensity);
    if (typeof mood === "string" && mood.trim()) data.mood = mood.trim().toLowerCase();

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const updated = await prisma.moodLog.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (err) {
    console.error("updateMoodEntry error:", err);
    res.status(500).json({ error: "Failed to update mood entry" });
  }
};

export const deleteMoodLog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const deleted = await prisma.moodLog.deleteMany({
      where: { id, userId },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: "Mood log not found" });
    }

    res.json({ message: "Mood log deleted", id });
  } catch {
    res.status(500).json({ error: "Failed to delete mood log" });
  }
};

export const getMoodHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const since = new Date(Date.now() - days * DAY_MS);

    const history = await prisma.moodLog.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json(history);
  } catch (err) {
    console.error("getMoodHistory error:", err);
    res.status(500).json({ error: "Failed to fetch mood history" });
  }
};

export const getMoodSummary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tzOffset = sanitizeTzOffset(req.query.tzOffset);
    const since90Days = new Date(Date.now() - 90 * DAY_MS);

    const logs = await prisma.moodLog.findMany({
      where: {
        userId,
        createdAt: { gte: since90Days },
      },
      orderBy: { createdAt: "desc" },
    });

    const todayKey = toLocalDayKey(new Date(), tzOffset);
    const todayLogs = logs.filter(
      (l) => toLocalDayKey(l.createdAt, tzOffset) === todayKey
    );
    const latestTodayRaw = todayLogs[0] || null;
    const latestToday = latestTodayRaw
      ? {
          id: latestTodayRaw.id,
          mood: latestTodayRaw.mood,
          note: latestTodayRaw.note,
          intensity: latestTodayRaw.intensity,
          createdAt: latestTodayRaw.createdAt,
          aiSnapshot: parseSnapshot(latestTodayRaw.aiSnapshot),
        }
      : null;

    const { currentStreak, longestStreak } = computeStreaks(logs, tzOffset);

    // Build last 7 local days timeline (oldest -> newest)
    const todayEpoch = dayKeyToEpoch(todayKey);
    const byDay = new Map();
    for (const log of logs) {
      const k = toLocalDayKey(log.createdAt, tzOffset);
      if (!byDay.has(k)) byDay.set(k, log); // keeps latest entry per day
    }

    
    const last7Days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const k = epochToDayKey(todayEpoch - offset * DAY_MS);
      const entry = byDay.get(k) || null;
      last7Days.push({
        date: k,
        mood: entry?.mood || null,
        intensity: entry?.intensity || null,
      });
    }

    const last7Cutoff = Date.now() - 7 * DAY_MS;
    const moodCounts7d = {};
    let intensitySum = 0;
    let count7d = 0;

    for (const log of logs) {
      if (new Date(log.createdAt).getTime() >= last7Cutoff) {
        moodCounts7d[log.mood] = (moodCounts7d[log.mood] || 0) + 1;
        intensitySum += log.intensity || 3;
        count7d += 1;
      }
    }

    res.json({
      currentStreak,
      longestStreak,
      totalCheckIns: logs.length,
      checkedInToday: Boolean(latestToday),
      todayLogsCount: todayLogs.length,
      latestToday,
      averageIntensity7d: count7d ? Number((intensitySum / count7d).toFixed(1)) : null,
      moodCounts7d,
      last7Days,
    });
  } catch (err) {
    console.error("getMoodSummary error:", err);
    res.status(500).json({ error: "Failed to fetch mood summary" });
  }
};

export const analyzeMoodAndSuggest = async (req, res) => {
  let savedLogId = req.body?.logId || null;
  let companion = getCompanionPersona();

  try {
    const { mood, note, intensity, localHour } = req.body;
    const userId = req.user.userId;

    if (typeof mood !== "string" || !mood.trim()) {
      return res.status(400).json({ error: "Mood is required" });
    }

    const cleanMood = mood.trim().toLowerCase();
    const cleanNote = typeof note === "string" && note.trim() ? note.trim() : null;
    const cleanIntensity = clampIntensity(intensity);
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
        data: { mood: cleanMood, note: cleanNote, intensity: cleanIntensity },
      });
      if (updated.count === 0) savedLogId = null;
    }

    if (!savedLogId) {
      const created = await prisma.moodLog.create({
        data: {
          userId,
          mood: cleanMood,
          note: cleanNote,
          intensity: cleanIntensity,
        },
      });
      savedLogId = created.id;
    }

    const prompt = `
${realName ? `User: ${realName}` : "User"} | Time: ${timeOfDay} | Goal: "${user?.wellnessGoal || "Calm & Stress Relief"}"
Mood: "${cleanMood}" (${cleanIntensity}/5 intensity) | Note: "${cleanNote || "None"}"

You are ${companion.name}. ${companion.style}
Write 1 straightforward, grounded empathyMessage (1-2 short sentences, plain everyday language).
- Acknowledge their mood${cleanNote ? " and specific note" : ""} directly, then point to what will help right now.
- NEVER use clichés: "I hear you", "I sense", "heaviness you're carrying", "moment of calm", "hold space", "It sounds like", or "Thank you for checking in".

Create 3 genuinely practical, varied micro-tasks tailored to "${cleanMood}" (${cleanIntensity}/5) during ${timeOfDay}.
Choose from these 4 actionTypes:
1. "guided_steps" — physical/sensory reset inside a modal ("steps": 3 short actionable steps, "timerSeconds": 30-90).
2. "micro_journal" — 1-minute reflection inside the app ("journalPrompt": 1 specific question, "quickChips": 2 short 2-4 word starter chips, "placeholder": short hint).
3. "breathe" — include when breathwork fits ("presetId": "sigh" for anxious/overwhelmed, "calm_478" for tired/night wind-down, "box" for focus/reset).
4. "chat" — conversation continuation with ${companion.name} ("starterPrompt": natural first-person sentence the user taps to send).

Output ONLY valid JSON:
{
  "empathyMessage": "...",
  "suggestions": [
    {
      "id": "1",
      "title": "<2-5 word specific title>",
      "actionType": "guided_steps | micro_journal | breathe | chat",
      "duration": "<1 min | 2 mins | 3 mins>",
      "reason": "<1 crisp sentence on why this helps>",
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
        { role: "system", content: "You are a straightforward, empathetic wellness companion API returning strict JSON." },
        { role: "user", content: prompt },
      ],
      model: FAST_MODEL,
      fallbackModel: PRIMARY_CHAT_MODEL,
      temperature: 0.65,
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

    const payload = {
      empathyMessage: parsedData.empathyMessage.trim(),
      suggestions: normalizeSuggestions(
        parsedData.suggestions,
        cleanMood,
        companion.name
      ),
    };

    if (savedLogId) {
      await prisma.moodLog
        .updateMany({
          where: { id: savedLogId, userId },
          data: { aiSnapshot: JSON.stringify(payload) },
        })
        .catch(() => {});
    }

    res.json({
      logId: savedLogId,
      intensity: cleanIntensity,
      ...payload,
    });
  } catch (error) {
    console.error("Mood Suggestion Error:", error);
    const cleanMood =
      typeof req.body?.mood === "string"
        ? req.body.mood.trim().toLowerCase()
        : "anxious";
    const fb = getMoodFallback(cleanMood, companion.name);

    if (savedLogId) {
      await prisma.moodLog
        .updateMany({
          where: { id: savedLogId },
          data: { aiSnapshot: JSON.stringify(fb) },
        })
        .catch(() => {});
    }

    res.json({
      logId: savedLogId,
      intensity: clampIntensity(req.body?.intensity),
      ...fb,
    });
  }
};

const ANSWER_LABELS = {
  // Body state
  tense_restless: "Body feels tight and restless",
  heavy_drained: "Body feels heavy and physically drained",
  wired_on_edge: "Body feels wired and on edge",
  calm_steady: "Body feels relaxed and steady",
  warm_open: "Body feels light and open",
  // Mind pace
  racing_looping: "Thoughts are racing or looping on 'what ifs'",
  scattered_too_much: "Mind feels scattered across too many tasks",
  foggy_blank: "Mind feels foggy and unfocused",
  clear_present: "Mind feels clear and present",
  appreciative_reflective: "Mind is focused on positive moments",
  // Energy level
  empty_battery: "Mental battery is nearly empty",
  overstimulated: "Feels overstimulated by noise and pressure",
  getting_by: "Energy is moderate but wearing thin",
  balanced: "Energy feels balanced",
  uplifted: "Energy feels upbeat and open",
  // Primary trigger
  work_pressure: "Deadlines or workload",
  people_expectations: "Social stress or people's expectations",
  sleep_fatigue: "Lack of rest or burnout",
  vague_fog: "No clear single trigger—just feels off",
  good_moment: "Something positive happened today",
};

const inferMoodFromAnswers = (answers = {}) => {
  const scores = {
    peaceful: 0,
    anxious: 0,
    tired: 0,
    overwhelmed: 0,
    grateful: 0,
  };

  const map = {
    tense_restless: { anxious: 3, overwhelmed: 1 },
    heavy_drained: { tired: 3, overwhelmed: 1 },
    wired_on_edge: { anxious: 2, overwhelmed: 2 },
    calm_steady: { peaceful: 3, grateful: 1 },
    warm_open: { grateful: 3, peaceful: 1 },
    racing_looping: { anxious: 3, overwhelmed: 2 },
    scattered_too_much: { overwhelmed: 3, anxious: 1 },
    foggy_blank: { tired: 3 },
    clear_present: { peaceful: 3 },
    appreciative_reflective: { grateful: 3, peaceful: 1 },
    empty_battery: { tired: 3, overwhelmed: 1 },
    overstimulated: { overwhelmed: 3, anxious: 2 },
    getting_by: { tired: 1, anxious: 1, peaceful: 1 },
    balanced: { peaceful: 3 },
    uplifted: { grateful: 3 },
    work_pressure: { overwhelmed: 2, anxious: 2 },
    people_expectations: { anxious: 2, tired: 1 },
    sleep_fatigue: { tired: 3 },
    vague_fog: { tired: 1, anxious: 1, overwhelmed: 1 },
    good_moment: { grateful: 3, peaceful: 2 },
  };

  for (const val of Object.values(answers)) {
    const weights = map[val];
    if (!weights) continue;
    for (const [m, pts] of Object.entries(weights)) {
      scores[m] = (scores[m] || 0) + pts;
    }
  }

  let bestMood = "anxious";
  let bestScore = -1;
  for (const m of VALID_MOODS) {
    if (scores[m] > bestScore) {
      bestScore = scores[m];
      bestMood = m;
    }
  }

  const intensityMap = {
    peaceful: 2,
    grateful: 2,
    tired: 3,
    anxious: 4,
    overwhelmed: 4,
  };

  const triggerNuance = {
    work_pressure: "Work overload",
    people_expectations: "Social strain",
    sleep_fatigue: "Low-rest fatigue",
    vague_fog: "Mental fog",
    good_moment: "Positive lift",
  };

  const insights = {
    peaceful:
      "Your baseline is steady right now, which makes this a good time to lock in calm before the next rush.",
    grateful:
      "Something positive cut through the day's noise—taking 60 seconds to note it helps that lift last.",
    tired:
      "Trying to push through on a low tank makes everything feel twice as hard—focus on recovery over output.",
    anxious:
      "Your nervous system is stuck in alert mode, so calming your breathing will work faster than overthinking.",
    overwhelmed:
      "Pressure on low energy keeps your brain juggling everything at once—shrinking it to one step relieves the load.",
  };

  return {
    mood: bestMood,
    intensity: intensityMap[bestMood] || 3,
    nuanceLabel: triggerNuance[answers.primaryTrigger] || "Needs a quick reset",
    summaryInsight: insights[bestMood],
  };
};

export const assessMoodQuestionnaire = async (req, res) => {
  let companion = getCompanionPersona();

  try {
    const { answers, note, localHour } = req.body;
    const userId = req.user.userId;

    if (!answers || typeof answers !== "object" || Object.keys(answers).length === 0) {
      return res.status(400).json({ error: "Questionnaire answers are required" });
    }

    const timeOfDay = getTimeOfDay(localHour);
    const cleanNote = typeof note === "string" && note.trim() ? note.trim() : null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, wellnessGoal: true, companionAvatar: true },
    });
    companion = getCompanionPersona(user?.companionAvatar);

    const realName =
      user?.name && !["Friend", "Guest Explorer"].includes(user.name.trim())
        ? user.name.trim()
        : null;

    const baseline = inferMoodFromAnswers(answers);

    const readableAnswers = [
      answers.bodyState && `- Body: ${ANSWER_LABELS[answers.bodyState] || answers.bodyState}`,
      answers.thoughtPace && `- Mind: ${ANSWER_LABELS[answers.thoughtPace] || answers.thoughtPace}`,
      answers.energyLevel && `- Energy: ${ANSWER_LABELS[answers.energyLevel] || answers.energyLevel}`,
      answers.primaryTrigger && `- Main driver: ${ANSWER_LABELS[answers.primaryTrigger] || answers.primaryTrigger}`,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `
${realName ? `User: ${realName}` : "User"} | Time: ${timeOfDay} | Goal: "${user?.wellnessGoal || "Calm & Stress Relief"}"
Quick check-in signals:
${readableAnswers}
Extra note: "${cleanNote || "None"}"

You are ${companion.name}. ${companion.style}
Classify the single closest primary mood from ONLY: "peaceful", "anxious", "tired", "overwhelmed", "grateful".

Keep every field direct, concrete, and non-repetitive:
1. "nuanceLabel": 2-3 word plain description of the CAUSE or ANGLE (e.g., "Work overload", "Low-battery buzz", "Quiet burnout"). NEVER repeat synonyms of the mood like "Stressed, exhausted".
2. "summaryInsight": 1 crisp sentence explaining what is happening and what helps most. NEVER just repeat their quiz choices back to them (e.g., do NOT write "Your muscles are tight and thoughts are racing").
3. "empathyMessage": 1-2 straightforward sentences as ${companion.name}. Talk like a grounded friend: acknowledge the main driver directly and point to the first action below. BANNED phrases: "I sense", "heaviness you're carrying", "moment of calm", "I hear you", "hold space", "you're not alone", "it's okay to".
4. "suggestions": 3 specific, varied actions directly tailored to their main driver and energy level (choose from "breathe", "micro_journal", "guided_steps", "chat"). Make titles, prompts, and starterPrompt directly reference their actual situation (e.g., work deadlines, lack of sleep, etc.).

Output ONLY valid JSON:
{
  "mood": "peaceful | anxious | tired | overwhelmed | grateful",
  "intensity": 3,
  "nuanceLabel": "...",
  "summaryInsight": "...",
  "empathyMessage": "...",
  "suggestions": [
    {
      "id": "1",
      "title": "<2-5 word specific title>",
      "actionType": "guided_steps | micro_journal | breathe | chat",
      "duration": "<1 min | 2 mins | 3 mins>",
      "reason": "<1 crisp sentence on why this helps right now>",
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

    let evaluated = null;
    try {
      const raw = await generateCompletion({
        messages: [
          {
            role: "system",
            content:
              "You are a clear, direct wellness companion API returning strict JSON with zero fluff or clichés.",
          },
          { role: "user", content: prompt },
        ],
        model: PRIMARY_CHAT_MODEL,
        fallbackModel: FAST_MODEL,
        temperature: 0.55,
        maxCompletionTokens: 900,
        reasoningEffort: "low",
        jsonMode: true,
      });

      const cleanJson = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      const parsed = JSON.parse(cleanJson);
      const moodCandidate = String(parsed?.mood || "").trim().toLowerCase();
      const mood = VALID_MOODS.includes(moodCandidate) ? moodCandidate : baseline.mood;

      evaluated = {
        mood,
        intensity: clampIntensity(parsed?.intensity ?? baseline.intensity),
        nuanceLabel:
          typeof parsed?.nuanceLabel === "string" && parsed.nuanceLabel.trim()
            ? parsed.nuanceLabel.trim()
            : baseline.nuanceLabel,
        summaryInsight:
          typeof parsed?.summaryInsight === "string" && parsed.summaryInsight.trim()
            ? parsed.summaryInsight.trim()
            : baseline.summaryInsight,
        empathyMessage:
          typeof parsed?.empathyMessage === "string" && parsed.empathyMessage.trim()
            ? parsed.empathyMessage.trim()
            : getMoodFallback(mood, companion.name).empathyMessage,
        suggestions: normalizeSuggestions(parsed?.suggestions, mood, companion.name),
      };
    } catch {
      const fb = getMoodFallback(baseline.mood, companion.name);
      evaluated = {
        ...baseline,
        empathyMessage: fb.empathyMessage,
        suggestions: fb.suggestions,
      };
    }

    const snapshot = {
      empathyMessage: evaluated.empathyMessage,
      suggestions: evaluated.suggestions,
      assessment: {
        nuanceLabel: evaluated.nuanceLabel,
        summaryInsight: evaluated.summaryInsight,
        answers,
      },
    };

    const createdLog = await prisma.moodLog.create({
      data: {
        userId,
        mood: evaluated.mood,
        intensity: evaluated.intensity,
        note: cleanNote || `Guided check-in: ${evaluated.nuanceLabel}`,
        aiSnapshot: JSON.stringify(snapshot),
      },
    });

    res.status(201).json({
      logId: createdLog.id,
      mood: evaluated.mood,
      intensity: evaluated.intensity,
      nuanceLabel: evaluated.nuanceLabel,
      summaryInsight: evaluated.summaryInsight,
      empathyMessage: evaluated.empathyMessage,
      suggestions: evaluated.suggestions,
    });
  } catch (error) {
    console.error("assessMoodQuestionnaire error:", error);
    res.status(500).json({ error: "Failed to evaluate mood assessment" });
  }
};