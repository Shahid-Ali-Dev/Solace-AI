// services/api.js
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    const cleaned = envUrl.replace(/\/$/, "");
    // 10.0.2.2 only works inside Android Emulator; never use it on Web
    if (!(Platform.OS === "web" && cleaned.includes("10.0.2.2"))) {
      return cleaned;
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

const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
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
    const res = await fetchWithTimeout(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Failed to create account");
    return data;
  },

  login: async (email, password) => {
    const res = await fetchWithTimeout(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Invalid email or password");
    return data;
  },

  googleLogin: async ({ idToken, accessToken }) => {
    const res = await fetchWithTimeout(`${BASE_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  analyzeMoodAndSuggest: async (
    mood,
    note = "",
    logId = null,
    localHour = new Date().getHours()
  ) => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(
      `${BASE_URL}/mood/suggest`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ mood, note, logId, localHour }),
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

  // Wellness
  getAffirmation: async () => {
    const headers = await getHeaders();
    const res = await fetchWithTimeout(`${BASE_URL}/wellness/affirmation`, { headers });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data.error || "Affirmation fetch failed");
    return data;
  },
};