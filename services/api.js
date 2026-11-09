// services/api.js
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    const cleaned = envUrl.replace(/\/$/, "");
    if (!(Platform.OS === "web" && cleaned.includes("10.0.2.2"))) {
      return cleaned.endsWith("/api") ? cleaned : `${cleaned}/api`;
    }
  }

  if (Platform.OS === "web") {
    return "http://localhost:5000/api";
  }

  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost;

  const host = debuggerHost ? debuggerHost.split(":")[0] : "10.0.2.2";
  return `http://${host}:5000/api`;
};

const BASE_URL = getBaseUrl();
console.log("[Solace API] Using BASE_URL:", BASE_URL);

const parseJsonSafe = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || `HTTP ${res.status}` };
  }
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 40000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const getHeaders = async () => {
  const token = await AsyncStorage.getItem("solace_token");
  return {
    "Content-Type": "application/json",
    ...(token && token !== "offline_token" ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const api = {
  // Auth
  guestLogin: async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/auth/guest`, { method: "POST" });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
    return data;
  },

  getMe: async () => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/auth/me`, { headers });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Session invalid");
    return data;
  },

  register: async (name, email, password) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, email, password }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to create account");
    return data;
  },

  login: async (email, password) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Invalid email or password");
    return data;
  },

  googleLogin: async ({ idToken, accessToken }) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/auth/google`, {
      method: "POST",
      headers,
      body: JSON.stringify({ idToken, accessToken }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Google login failed");
    return data;
  },

  updateProfile: async (profileData) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/auth/profile`, {
      method: "PUT",
      headers,
      body: JSON.stringify(profileData),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to update profile");
    return data;
  },

  // Mood
  logMood: async (mood, intensity = 3, note = "") => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/mood/check-in`, {
      method: "POST",
      headers,
      body: JSON.stringify({ mood, intensity, note }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to log mood");
    return data;
  },

  updateMoodNote: async (logId, note) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/mood/${logId}/note`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ note }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to save note");
    return data;
  },

  updateMoodEntry: async (logId, { note, intensity, mood }) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/mood/${logId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ note, intensity, mood }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to update mood entry");
    return data;
  },

  deleteMoodLog: async (logId) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/mood/${logId}`, {
      method: "DELETE",
      headers,
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to delete mood log");
    return data;
  },

  getMoodHistory: async (days = 30, limit = 50) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(
      `${BASE_URL}/mood/history?days=${days}&limit=${limit}`,
      { headers }
    );
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to load mood history");
    return data;
  },

  getMoodSummary: async (tzOffset = new Date().getTimezoneOffset()) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(
      `${BASE_URL}/mood/summary?tzOffset=${tzOffset}`,
      { headers }
    );
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to load mood summary");
    return data;
  },

  analyzeMoodAndSuggest: async (
    mood,
    note = "",
    logId = null,
    localHour = new Date().getHours(),
    intensity = 3
  ) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(
      `${BASE_URL}/mood/suggest`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ mood, note, logId, localHour, intensity }),
      },
      25000
    );
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to get suggestions");
    return data;
  },

  // Chat
  sendMessage: async (message, sessionId = null) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(
      `${BASE_URL}/chat/message`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ message, sessionId }),
      },
      25000
    );
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Chat response failed");
    return data;
  },

  getSessions: async () => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/chat/sessions`, { headers });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to fetch sessions");
    return data;
  },

  getSessionMessages: async (sessionId) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/chat/sessions/${sessionId}/messages`, {
      headers,
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to fetch messages");
    return data;
  },

  deleteSession: async (sessionId) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/chat/sessions/${sessionId}`, {
      method: "DELETE",
      headers,
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to delete session");
    return data;
  },

  /// Wellness
  getAffirmation: async () => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/wellness/affirmation`, { headers });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Affirmation fetch failed");
    return data;
  },

  getReminders: async () => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/wellness/reminders`, { headers });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to fetch reminders");
    return data;
  },

  saveReminders: async (reminders) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/wellness/reminders`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ reminders }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to save reminders");
    return data;
  },

  getBreathingPresets: async () => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/wellness/breathing-presets`, {
      headers,
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Breathing presets fetch failed");
    return data;
  },

  assessMood: async (answers, note = "", localHour = new Date().getHours()) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(
      `${BASE_URL}/mood/assess`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ answers, note, localHour }),
      },
      25000
    );
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to evaluate mood");
    return data;
  },
};