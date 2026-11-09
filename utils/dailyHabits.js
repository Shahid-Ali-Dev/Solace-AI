// utils/dailyHabits.js
import AsyncStorage from "@react-native-async-storage/async-storage";

const HABIT_PREFIX = "solace_daily_habits_";
const PILLAR_KEYS = ["checkin", "activity", "breathe", "chat"];
const listeners = new Set();

export const getLocalDateKey = (dateInput = new Date()) => {
  const d = new Date(dateInput);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const habitsKey = (userId, dateKey = getLocalDateKey()) =>
  `${HABIT_PREFIX}${userId || "guest"}_${dateKey}`;

const normalizeHabits = (rawObj = {}) => {
  const out = {};
  if (!rawObj || typeof rawObj !== "object") return out;

  for (const key of PILLAR_KEYS) {
    const val = rawObj[key];
    if (val === true) {
      out[key] = { done: true, count: 1, updatedAt: new Date().toISOString() };
    } else if (val && typeof val === "object" && val.done) {
      out[key] = {
        done: true,
        count: Math.max(1, Number(val.count) || 1),
        updatedAt: val.updatedAt || new Date().toISOString(),
      };
    }
  }
  return out;
};

const notifyListeners = (userId, habits) => {
  listeners.forEach((cb) => {
    try {
      cb(userId || "guest", habits);
    } catch {}
  });
};

export const subscribeDailyHabits = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const pruneOldHabits = async (keepDays = 7) => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const habitKeys = allKeys.filter((k) => k.startsWith(HABIT_PREFIX));
    if (habitKeys.length <= keepDays * 2) return;

    const cutoffMs = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    const stale = habitKeys.filter((k) => {
      const datePart = k.slice(-10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return false;
      return new Date(datePart).getTime() < cutoffMs;
    });

    if (stale.length > 0) {
      await AsyncStorage.multiRemove(stale);
    }
  } catch {}
};

export const getDailyHabits = async (userId) => {
  try {
    const raw = await AsyncStorage.getItem(habitsKey(userId));
    return raw ? normalizeHabits(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
};

export const markDailyHabit = async (userId, habitName) => {
  if (!PILLAR_KEYS.includes(habitName)) return {};
  try {
    const current = await getDailyHabits(userId);
    const prev = current[habitName];
    const next = {
      ...current,
      [habitName]: {
        done: true,
        count: (prev?.count || 0) + 1,
        updatedAt: new Date().toISOString(),
      },
    };
    await AsyncStorage.setItem(habitsKey(userId), JSON.stringify(next));
    notifyListeners(userId, next);
    pruneOldHabits().catch(() => {});
    return next;
  } catch {
    return {};
  }
};

export const getHabitProgress = (habits = {}, overrides = {}) => {
  const normalized = normalizeHabits(habits);
  const checkin = Boolean(normalized.checkin?.done || overrides.checkin);
  const activity = Boolean(normalized.activity?.done || overrides.activity);
  const breathe = Boolean(normalized.breathe?.done || overrides.breathe);
  const chat = Boolean(normalized.chat?.done || overrides.chat);

  const completedCount =
    (checkin ? 1 : 0) +
    (activity ? 1 : 0) +
    (breathe ? 1 : 0) +
    (chat ? 1 : 0);

  return {
    checkin,
    activity,
    breathe,
    chat,
    completedCount,
    totalCount: 4,
    ratio: completedCount / 4,
    counts: {
      checkin: normalized.checkin?.count || (checkin ? 1 : 0),
      activity: normalized.activity?.count || (activity ? 1 : 0),
      breathe: normalized.breathe?.count || (breathe ? 1 : 0),
      chat: normalized.chat?.count || (chat ? 1 : 0),
    },
  };
};