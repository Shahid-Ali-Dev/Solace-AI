// services/notifications.js
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCompanionById } from "../constants/companions";
import { api } from "./api";

const CHANNEL_ID = "solace-reminders";
const remindersStorageKey = (userId) => `solace_reminders_${userId || "guest"}`;

export const TARGET_OPTIONS = [
  { id: "mood", label: "Mood Check-in", icon: "sunny-outline" },
  { id: "breathe", label: "Breathing Reset", icon: "water-outline" },
  { id: "chat", label: "Talk with Companion", icon: "chatbubble-ellipses-outline" },
  { id: "quiz", label: "Guided Mood Quiz", icon: "help-buoy-outline" },
];

export const DEFAULT_REMINDERS = [
  {
    id: "mood_checkin",
    type: "mood_checkin",
    label: "Daily Mood Check-in",
    description: "Take 15 seconds to name what you're carrying today",
    enabled: true,
    hour: 20,
    minute: 30,
    target: "mood",
    isCustom: false,
  },
  {
    id: "affirmation",
    type: "affirmation",
    label: "Daily Affirmation",
    description: "A quiet reflection before the day's noise picks up",
    enabled: true,
    hour: 8,
    minute: 30,
    target: "affirmation",
    isCustom: false,
  },
  {
    id: "breathe",
    type: "breathe",
    label: "Breathing Break",
    description: "2-minute Physiological Sigh to reset your nervous system",
    enabled: false,
    hour: 15,
    minute: 0,
    target: "breathe",
    presetId: "sigh",
    isCustom: false,
  },
  {
    id: "self_care",
    type: "self_care",
    label: "Evening Self-Care",
    description: "1-minute 5-4-3-2-1 sensory reset to wind down",
    enabled: false,
    hour: 21,
    minute: 30,
    target: "self_care",
    isCustom: false,
  },
];

// Foreground display handler
if (Platform.OS !== "web") {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {}
}

export const formatReminderTime = (hour = 9, minute = 0) => {
  const h = Number(hour) || 0;
  const m = Number(minute) || 0;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};

const getFirstName = (user) => {
  const raw = user?.name?.trim();
  if (!raw || ["Friend", "Guest Explorer"].includes(raw)) return null;
  return raw.split(/\s+/)[0];
};

const buildNudgeContent = (item, user) => {
  const companion = getCompanionById(user?.companionAvatar);
  const firstName = getFirstName(user);
  const namePrefix = firstName ? `${firstName}, ` : "";

  if (item.type === "mood_checkin") {
    const copies = [
      {
        title: `${companion.name} • Quick check-in`,
        body: `${namePrefix}pause for 15 seconds and notice how you feel right now.`,
      },
      {
        title: "Check in with yourself",
        body: `How's your headspace holding up today? Log a mood and let ${companion.name} help lighten it.`,
      },
    ];
    return copies[Math.floor(Math.random() * copies.length)];
  }

  if (item.type === "affirmation") {
    return {
      title: `Today's note from ${companion.name}`,
      body: `${namePrefix}open your daily reflection before the rush starts.`,
    };
  }

  if (item.type === "breathe") {
    return {
      title: "Unclench your shoulders",
      body: "2 minutes of guided breathing can drop stress faster than pushing through.",
    };
  }

  if (item.type === "self_care") {
    return {
      title: "Gentle wind-down pause",
      body: `${namePrefix}step away from the screen for a 1-minute 5-4-3-2-1 sensory reset.`,
    };
  }

  // Custom reminder
  return {
    title: item.label || `Nudge from ${companion.name}`,
    body:
      item.description ||
      `${namePrefix}here's your gentle reminder to take a mindful minute.`,
  };
};

export const getTargetPayload = (item) => {
  const target = item?.target || item?.type || "mood";

  if (target === "breathe") {
    return {
      route: "/(tabs)/breathe",
      preset: item?.presetId || "sigh",
      reminderId: item?.id || "breathe",
    };
  }

  if (target === "chat") {
    return {
      route: "/(tabs)/chat",
      starterPrompt: item?.label
        ? `My reminder "${item.label}" just went off—let's do a quick check-in.`
        : "I got my gentle reminder—can we check in for a minute?",
      reminderId: item?.id || "chat",
    };
  }

  if (target === "quiz") {
    return {
      route: "/mood-assessment",
      reminderId: item?.id || "quiz",
    };
  }

  if (target === "affirmation") {
    return {
      route: "/(tabs)",
      focusSection: "affirmation",
      reminderId: item?.id || "affirmation",
    };
  }

  if (target === "self_care") {
    return {
      route: "/(tabs)",
      openAction: "sensory_reset",
      reminderId: item?.id || "self_care",
    };
  }

  return {
    route: "/(tabs)",
    focusSection: "mood",
    reminderId: item?.id || "mood_checkin",
  };
};

export const ensureNotificationChannel = async () => {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Solace Wellness Nudges",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: "#2DD4BF",
      sound: "default",
    });
  } catch {}
};

export const getNotificationPermissionStatus = async () => {
  if (Platform.OS === "web") return "unsupported";
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status; // "granted" | "denied" | "undetermined"
  } catch {
    return "undetermined";
  }
};

export const requestNotificationPermissions = async () => {
  if (Platform.OS === "web") return false;
  try {
    await ensureNotificationChannel();
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === "granted") return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === "granted";
  } catch {
    return false;
  }
};

export const loadReminders = async (userId) => {
  try {
    const raw = await AsyncStorage.getItem(remindersStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }

    if (userId && userId !== "temp_guest" && api.getReminders) {
      const remote = await api.getReminders().catch(() => null);
      if (Array.isArray(remote?.reminders) && remote.reminders.length > 0) {
        await AsyncStorage.setItem(
          remindersStorageKey(userId),
          JSON.stringify(remote.reminders)
        );
        return remote.reminders;
      }
    }
  } catch {}

  return DEFAULT_REMINDERS.map((r) => ({ ...r }));
};

export const syncScheduledNotifications = async (
  reminders,
  user = null,
  { requestPermissionIfNeeded = false } = {}
) => {
  if (Platform.OS === "web") {
    return { permissionGranted: false, scheduledCount: 0 };
  }

  try {
    const anyEnabled = reminders.some((r) => r.enabled);
    const hasPermission = requestPermissionIfNeeded && anyEnabled
      ? await requestNotificationPermissions()
      : (await getNotificationPermissionStatus()) === "granted";

    // Clear existing recurring nudges while keeping any pending 5s test nudge intact
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((req) => !req?.content?.data?.isTest)
        .map((req) =>
          Notifications.cancelScheduledNotificationAsync(req.identifier).catch(() => {})
        )
    );

    if (!hasPermission || !anyEnabled) {
      return { permissionGranted: hasPermission, scheduledCount: 0 };
    }

    await ensureNotificationChannel();
    const dailyType = Notifications.SchedulableTriggerInputTypes?.DAILY || "daily";

    let scheduledCount = 0;
    for (const item of reminders) {
      if (!item.enabled) continue;

      const copy = buildNudgeContent(item, user);
      const data = getTargetPayload(item);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: copy.title,
          body: copy.body,
          sound: "default",
          data,
        },
        trigger: {
          type: dailyType,
          hour: Number(item.hour) || 0,
          minute: Number(item.minute) || 0,
          ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
        },
      });
      scheduledCount += 1;
    }

    return { permissionGranted: true, scheduledCount };
  } catch (err) {
    console.warn("syncScheduledNotifications error:", err?.message || err);
    return { permissionGranted: false, scheduledCount: 0 };
  }
};

export const saveAndSyncReminders = async (
  reminders,
  user = null,
  options = { requestPermissionIfNeeded: true }
) => {
  const userId = user?.id || "guest";
  try {
    await AsyncStorage.setItem(
      remindersStorageKey(userId),
      JSON.stringify(reminders)
    );
  } catch {}

  if (userId !== "guest" && userId !== "temp_guest" && api.saveReminders) {
    api.saveReminders(reminders).catch(() => {});
  }

  return syncScheduledNotifications(reminders, user, options);
};

export const seedRemindersFromRhythm = async (
  user,
  rhythm = "evening",
  enableDaily = true
) => {
  const checkInTimes = {
    morning: { hour: 8, minute: 30 },
    midday: { hour: 14, minute: 0 },
    evening: { hour: 21, minute: 0 },
  };
  const chosen = checkInTimes[rhythm] || checkInTimes.evening;

  const initial = DEFAULT_REMINDERS.map((item) => {
    if (item.id === "mood_checkin") {
      return { ...item, hour: chosen.hour, minute: chosen.minute, enabled: enableDaily };
    }
    if (item.id === "affirmation") {
      return { ...item, enabled: enableDaily };
    }
    return { ...item };
  });

  return saveAndSyncReminders(initial, user, {
    requestPermissionIfNeeded: enableDaily,
  });
};

export const getScheduledOsCount = async () => {
  if (Platform.OS === "web") return 0;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.filter((req) => !req?.content?.data?.isTest).length;
  } catch {
    return 0;
  }
};

export const scheduleTestNotification = async (item, user, delaySeconds = 5) => {
  if (Platform.OS === "web") {
    return { ok: false, reason: "web" };
  }

  const granted = await requestNotificationPermissions();
  if (!granted) {
    return { ok: false, reason: "denied" };
  }

  await ensureNotificationChannel();
  const intervalType =
    Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL || "timeInterval";
  const copy = buildNudgeContent(item, user);
  const payload = getTargetPayload(item);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body,
      sound: "default",
      data: { ...payload, isTest: "true" },
    },
    trigger: {
      type: intervalType,
      seconds: delaySeconds,
      repeats: false,
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
  });

  return { ok: true };
};