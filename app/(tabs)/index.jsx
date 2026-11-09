// app/(tabs)/index.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useRouter,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import CompanionAvatar from "../../components/CompanionAvatar";
import { getCompanionById } from "../../constants/companions";
import DailyReflectionCard from "../../components/DailyReflectionCard";
import DynamicTaskModal from "../../components/DynamicTaskModal";
import MoodCheckInSection, {
  MOODS,
  getLocalFallbackSuggestions,
} from "../../components/MoodCheckInSection";
import ProgressTrackerCard from "../../components/ProgressTrackerCard";
import {
  getLocalDateKey,
  getDailyHabits,
  markDailyHabit,
  getHabitProgress,
  subscribeDailyHabits,
} from "../../utils/dailyHabits";

const LOGO_URL =
  "https://res.cloudinary.com/dru5oqalj/image/upload/v1793887328/1a8b5e2d-5030-440f-9a91-8b76fcf3a917__1_-Photoroom_ukmqzz.png";

const QUICK_SENSORY_RESET = {
  id: "grounding_54321",
  title: "5-4-3-2-1 Sensory Reset",
  actionType: "guided_steps",
  duration: "1 min",
  timerSeconds: 60,
  reason: "Anchor yourself in the present moment by gently engaging your five senses.",
  steps: [
    "Notice 5 things you can see around you.",
    "Feel 4 textures your hands or feet are touching.",
    "Listen for 3 distinct sounds in the room.",
    "Identify 2 subtle scents in the air.",
    "Take 1 slow, steady breath out.",
  ],
};

const DEFAULT_AFFIRMATION = "You do not have to carry everything all at once.";

const getTodayCacheKey = (userId) =>
  `solace_home_checkin_${userId || "guest"}_${getLocalDateKey()}`;

export default function DashboardScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeCompanion = getCompanionById(user?.companionAvatar);
  const { focusSection, openAction, _nt } = useLocalSearchParams();

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [selectedMood, setSelectedMood] = useState(null);
  const [currentMoodLogId, setCurrentMoodLogId] = useState(null);
  const [moodNote, setMoodNote] = useState("");
  const [moodIntensity, setMoodIntensity] = useState(3);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [moodSummary, setMoodSummary] = useState(null);
  const [dailyHabits, setDailyHabits] = useState({});
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [activeQuickAction, setActiveQuickAction] = useState(null);
  const [quickActionVisible, setQuickActionVisible] = useState(false);
  const [completedActions, setCompletedActions] = useState({});

  const [affirmation, setAffirmation] = useState(DEFAULT_AFFIRMATION);
  const [loadingAffirmation, setLoadingAffirmation] = useState(false);

  const [moodHighlightSignal, setMoodHighlightSignal] = useState(0);
  const [progressHighlightSignal, setProgressHighlightSignal] = useState(0);

  const scrollViewRef = useRef(null);
  const sectionYRef = useRef({ mood: 0, progress: 0 });
  const activeUserIdRef = useRef(null);
  const lastCacheRawRef = useRef(null);
  const lastSummaryAtRef = useRef(0);
  const moodRequestIdRef = useRef(0);
  const suggestionsCacheRef = useRef({});

  const saveTodayCache = useCallback(async (userId, payload) => {
    if (!userId) return;
    try {
      const serialized = JSON.stringify(payload);
      lastCacheRawRef.current = serialized;
      await AsyncStorage.setItem(getTodayCacheKey(userId), serialized);
    } catch {}
  }, []);

  const refreshProgressSummary = useCallback(
    async (force = false) => {
      if (!user?.id || user.id === "temp_guest" || !api.getMoodSummary) {
        return null;
      }
      const now = Date.now();
      if (!force && now - lastSummaryAtRef.current < 1500) {
        return null;
      }
      lastSummaryAtRef.current = now;
      try {
        const summary = await api.getMoodSummary();
        if (summary) setMoodSummary(summary);
        return summary;
      } catch {
        return null;
      }
    },
    [user?.id]
  );

  // Live pub/sub listener for habit updates from Breathe/Chat/Assessment
  useEffect(() => {
    return subscribeDailyHabits((changedUserId, nextHabits) => {
      if ((user?.id || "guest") === changedUserId) {
        setDailyHabits(nextHabits);
      }
    });
  }, [user?.id]);

  // Reset and hydrate Home whenever active user changes
  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      activeUserIdRef.current = null;
      lastCacheRawRef.current = null;
      lastSummaryAtRef.current = 0;
      suggestionsCacheRef.current = {};
      setSelectedMood(null);
      setCurrentMoodLogId(null);
      setMoodNote("");
      setMoodIntensity(3);
      setMoodSummary(null);
      setDailyHabits({});
      setAiSuggestions(null);
      setCompletedActions({});
      setActiveQuickAction(null);
      setQuickActionVisible(false);
      setAffirmation(DEFAULT_AFFIRMATION);
      return;
    }

    if (activeUserIdRef.current === user.id) return;
    activeUserIdRef.current = user.id;
    lastCacheRawRef.current = null;
    lastSummaryAtRef.current = 0;

    suggestionsCacheRef.current = {};
    setSelectedMood(null);
    setCurrentMoodLogId(null);
    setMoodNote("");
    setMoodIntensity(3);
    setMoodSummary(null);
    setDailyHabits({});
    setAiSuggestions(null);
    setCompletedActions({});
    setActiveQuickAction(null);
    setQuickActionVisible(false);
    setAffirmation(DEFAULT_AFFIRMATION);

    let cancelled = false;

    (async () => {
      let restoredFromLocal = false;

      try {
        const [cachedRaw, storedHabits] = await Promise.all([
          AsyncStorage.getItem(getTodayCacheKey(user.id)),
          getDailyHabits(user.id),
        ]);

        if (!cancelled) {
          setDailyHabits(storedHabits || {});
        }

        if (!cancelled && cachedRaw) {
          lastCacheRawRef.current = cachedRaw;
          const parsed = JSON.parse(cachedRaw);
          if (parsed?.mood && parsed?.aiSuggestions) {
            const noteVal = parsed.note || "";
            const intensityVal = Number(parsed.intensity) || 3;
            const companionIdVal = parsed.companionId || activeCompanion.id;
            const taggedSuggestions = {
              ...parsed.aiSuggestions,
              _companionId: companionIdVal,
            };

            setSelectedMood(parsed.mood);
            setCurrentMoodLogId(parsed.logId || null);
            setMoodNote(noteVal);
            setMoodIntensity(intensityVal);
            setAiSuggestions(taggedSuggestions);
            setCompletedActions(parsed.completedActions || {});
            restoredFromLocal = true;

            const memKey = `${user.id}::${companionIdVal}::${parsed.mood}::${intensityVal}::${noteVal
              .trim()
              .toLowerCase()}`;
            suggestionsCacheRef.current[memKey] = taggedSuggestions;
          }
        }
      } catch {}

      if (cancelled || user.id === "temp_guest") return;

      try {
        lastSummaryAtRef.current = Date.now();
        const [_, summary] = await Promise.all([
          loadAffirmation(),
          api.getMoodSummary ? api.getMoodSummary().catch(() => null) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        if (summary) {
          setMoodSummary(summary);

          if (!restoredFromLocal && summary.latestToday) {
            const today = summary.latestToday;
            const isKnownMood = today.mood && MOODS.some((m) => m.id === today.mood);
            if (isKnownMood) {
              const snapshot = today.aiSnapshot
                ? { ...today.aiSnapshot, _companionId: activeCompanion.id }
                : {
                    ...getLocalFallbackSuggestions(today.mood, activeCompanion.name),
                    _companionId: activeCompanion.id,
                  };
              setSelectedMood(today.mood);
              setCurrentMoodLogId(today.id || null);
              setMoodNote(today.note || "");
              setMoodIntensity(today.intensity || 3);
              setAiSuggestions(snapshot);
            }
          }
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!focusSection && !openAction) return;

    const timer = setTimeout(() => {
      if (focusSection === "affirmation") {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        loadAffirmation(false);
      } else if (focusSection === "mood" || focusSection === "progress") {
        scrollToSection(focusSection);
      }

      if (openAction === "sensory_reset") {
        setActiveQuickAction(QUICK_SENSORY_RESET);
        setQuickActionVisible(true);
      }

      router.setParams({
        focusSection: undefined,
        openAction: undefined,
        _nt: undefined,
      });
    }, 160);

    return () => clearTimeout(timer);
  }, [focusSection, openAction, _nt]);

  // Re-sync Home whenever returning from /mood-assessment, Breathe, or Chat
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      let active = true;

      (async () => {
        try {
          const [cachedRaw, storedHabits] = await Promise.all([
            AsyncStorage.getItem(getTodayCacheKey(user.id)),
            getDailyHabits(user.id),
          ]);
          if (!active) return;

          setDailyHabits(storedHabits || {});

          if (cachedRaw && cachedRaw !== lastCacheRawRef.current) {
            lastCacheRawRef.current = cachedRaw;
            const parsed = JSON.parse(cachedRaw);
            if (parsed?.mood && parsed?.aiSuggestions) {
              setSelectedMood(parsed.mood);
              setCurrentMoodLogId(parsed.logId || null);
              setMoodNote(parsed.note || "");
              setMoodIntensity(Number(parsed.intensity) || 3);
              setAiSuggestions({
                ...parsed.aiSuggestions,
                _companionId: parsed.companionId || activeCompanion.id,
              });
              setCompletedActions(parsed.completedActions || {});
            }
          }
        } catch {}

        if (active && user.id !== "temp_guest") {
          refreshProgressSummary(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [user?.id, activeCompanion.id, refreshProgressSummary])
  );

  // Refresh suggestions if AI companion changed in Profile
  useEffect(() => {
    if (!selectedMood || !aiSuggestions || loadingSuggestions) return;
    if (aiSuggestions._companionId && aiSuggestions._companionId !== activeCompanion.id) {
      handleMoodSelect(selectedMood, false, true, moodIntensity);
    }
  }, [activeCompanion.id]);

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const loadAffirmation = useCallback(async (withHaptic = false) => {
    if (withHaptic) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    try {
      setLoadingAffirmation(true);
      const data = await api.getAffirmation();
      if (data?.affirmation) setAffirmation(data.affirmation);
    } catch {
      // Fallback affirmation preserved
    } finally {
      setLoadingAffirmation(false);
    }
  }, []);

  const handleMoodSelect = useCallback(
    async (
      mood,
      isNoteUpdate = false,
      forceRefresh = false,
      nextIntensity = moodIntensity,
      explicitNote = null
    ) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      const isSameMoodTap = !isNoteUpdate && !forceRefresh && mood === selectedMood;
      if (isSameMoodTap && aiSuggestions) {
        return;
      }

      const isSwitchingMood = !isNoteUpdate && mood !== selectedMood;
      const baseNote = explicitNote !== null ? explicitNote : moodNote;
      const noteToSend = isSwitchingMood ? "" : baseNote.trim();
      const effectiveIntensity = isSwitchingMood ? 3 : nextIntensity;
      const cacheKey = `${user?.id || "guest"}::${activeCompanion.id}::${mood}::${effectiveIntensity}::${noteToSend.toLowerCase()}`;
      const logIdToPass =
        isNoteUpdate && mood === selectedMood ? currentMoodLogId : null;
      const requestId = ++moodRequestIdRef.current;

      if (explicitNote !== null) {
        setMoodNote(explicitNote);
      }

      if (!isNoteUpdate) {
        setSelectedMood(mood);
        setCurrentMoodLogId(null);
        setCompletedActions({});
        if (isSwitchingMood) {
          setMoodNote("");
          setMoodIntensity(3);
        }
      }

      markDailyHabit(user?.id, "checkin").then((h) => setDailyHabits(h));

      if (!forceRefresh && !isNoteUpdate && suggestionsCacheRef.current[cacheKey]) {
        const cached = suggestionsCacheRef.current[cacheKey];
        setAiSuggestions(cached);
        let resolvedLogId = cached?.logId || null;
        setCurrentMoodLogId(resolvedLogId);

        if (!resolvedLogId && user?.id && user.id !== "temp_guest") {
          try {
            const saved = await api.logMood(mood, effectiveIntensity, noteToSend);
            if (requestId !== moodRequestIdRef.current) return;
            if (saved?.id) {
              resolvedLogId = saved.id;
              cached.logId = saved.id;
              setCurrentMoodLogId(saved.id);
            }
            refreshProgressSummary(true);
          } catch {}
        }

        saveTodayCache(user?.id, {
          mood,
          logId: resolvedLogId,
          note: noteToSend,
          intensity: effectiveIntensity,
          companionId: activeCompanion.id,
          aiSuggestions: cached,
          completedActions: {},
        });
        return;
      }

      setLoadingSuggestions(true);

      try {
        const data = await api.analyzeMoodAndSuggest(
          mood,
          noteToSend,
          logIdToPass,
          new Date().getHours(),
          effectiveIntensity
        );
        if (requestId !== moodRequestIdRef.current) return;

        const taggedData = { ...data, _companionId: activeCompanion.id };
        const resolvedLogId = data?.logId || logIdToPass || null;
        if (resolvedLogId) {
          setCurrentMoodLogId(resolvedLogId);
        }
        suggestionsCacheRef.current[cacheKey] = taggedData;
        setAiSuggestions(taggedData);

        saveTodayCache(user?.id, {
          mood,
          logId: resolvedLogId,
          note: noteToSend,
          intensity: effectiveIntensity,
          companionId: activeCompanion.id,
          aiSuggestions: taggedData,
          completedActions: isNoteUpdate ? completedActions : {},
        });

        refreshProgressSummary(true);
      } catch {
        if (requestId !== moodRequestIdRef.current) return;
        const fallback = {
          ...getLocalFallbackSuggestions(mood, activeCompanion.name),
          _companionId: activeCompanion.id,
        };
        setAiSuggestions(fallback);
        saveTodayCache(user?.id, {
          mood,
          logId: logIdToPass,
          note: noteToSend,
          intensity: effectiveIntensity,
          companionId: activeCompanion.id,
          aiSuggestions: fallback,
          completedActions: isNoteUpdate ? completedActions : {},
        });
      } finally {
        if (requestId === moodRequestIdRef.current) {
          setLoadingSuggestions(false);
        }
      }
    },
    [
      user?.id,
      activeCompanion.id,
      activeCompanion.name,
      selectedMood,
      moodNote,
      moodIntensity,
      currentMoodLogId,
      aiSuggestions,
      completedActions,
      saveTodayCache,
      refreshProgressSummary,
    ]
  );

  const handleIntensitySelect = useCallback(
    (level) => {
      try {
        Haptics.selectionAsync();
      } catch {}
      setMoodIntensity(level);

      if (selectedMood && aiSuggestions) {
        saveTodayCache(user?.id, {
          mood: selectedMood,
          logId: currentMoodLogId,
          note: moodNote.trim(),
          intensity: level,
          companionId: activeCompanion.id,
          aiSuggestions,
          completedActions,
        });
      }

      if (currentMoodLogId && api.updateMoodEntry) {
        api
          .updateMoodEntry(currentMoodLogId, { intensity: level })
          .then(() => refreshProgressSummary(true))
          .catch(() => {});
      }
    },
    [
      user?.id,
      selectedMood,
      currentMoodLogId,
      moodNote,
      activeCompanion.id,
      aiSuggestions,
      completedActions,
      saveTodayCache,
      refreshProgressSummary,
    ]
  );

  const handleSubmitNote = useCallback(
    (trimmedNote) => {
      if (!selectedMood || !trimmedNote) return;
      handleMoodSelect(selectedMood, true, true, moodIntensity, trimmedNote);
    },
    [selectedMood, moodIntensity, handleMoodSelect]
  );

  const handleRefreshSuggestions = useCallback(
    (draftNote) => {
      if (!selectedMood) return;
      handleMoodSelect(selectedMood, false, true, moodIntensity, draftNote);
    },
    [selectedMood, moodIntensity, handleMoodSelect]
  );

  const handleSuggestionAction = useCallback(
    (suggestion) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      if (suggestion.actionType === "breathe") {
        router.push({
          pathname: "/(tabs)/breathe",
          params: suggestion.presetId ? { preset: suggestion.presetId } : {},
        });
      } else if (suggestion.actionType === "chat") {
        router.push({
          pathname: "/(tabs)/chat",
          params: {
            starterPrompt:
              suggestion.starterPrompt ||
              `I'm feeling ${selectedMood || "a bit off"} right now.`,
          },
        });
      } else {
        setActiveQuickAction(suggestion);
        setQuickActionVisible(true);
      }
    },
    [router, selectedMood]
  );

  const persistReflectionNote = async (text) => {
    if (!text) return currentMoodLogId;
    try {
      if (currentMoodLogId) {
        await api.updateMoodNote(currentMoodLogId, text);
        return currentMoodLogId;
      }
      const saved = await api.logMood(
        selectedMood || "reflective",
        moodIntensity,
        text
      );
      if (saved?.id) {
        setCurrentMoodLogId(saved.id);
        return saved.id;
      }
    } catch {}
    return currentMoodLogId;
  };

  const handleCompleteQuickAction = async (task, reflectionText = "") => {
    const target = task || activeQuickAction;
    if (!quickActionVisible || !target) return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    let resolvedLogId = currentMoodLogId;
    if (reflectionText) {
      resolvedLogId = await persistReflectionNote(reflectionText);
    }

    const nextCompleted = {
      ...completedActions,
      [target.id || target.title]: true,
    };
    setCompletedActions(nextCompleted);

    const updatedHabits = await markDailyHabit(user?.id, "activity");
    setDailyHabits(updatedHabits);

    if (selectedMood && aiSuggestions) {
      saveTodayCache(user?.id, {
        mood: selectedMood,
        logId: resolvedLogId,
        note: moodNote.trim(),
        intensity: moodIntensity,
        companionId: activeCompanion.id,
        aiSuggestions,
        completedActions: nextCompleted,
      });
    }

    setQuickActionVisible(false);
  };

  const handleExploreReflectionInChat = async (task, reflectionText = "") => {
    let resolvedLogId = currentMoodLogId;
    if (reflectionText) {
      resolvedLogId = await persistReflectionNote(reflectionText);
    }
    const nextCompleted = {
      ...completedActions,
      [task?.id || task?.title || "journal"]: true,
    };
    setCompletedActions(nextCompleted);
    await markDailyHabit(user?.id, "activity");

    if (selectedMood && aiSuggestions) {
      saveTodayCache(user?.id, {
        mood: selectedMood,
        logId: resolvedLogId,
        note: moodNote.trim(),
        intensity: moodIntensity,
        companionId: activeCompanion.id,
        aiSuggestions,
        completedActions: nextCompleted,
      });
    }

    setQuickActionVisible(false);
    router.push({
      pathname: "/(tabs)/chat",
      params: {
        starterPrompt: reflectionText
          ? reflectionText
          : task?.journalPrompt ||
            `I'm feeling ${selectedMood || "reflective"} right now.`,
      },
    });
  };

  const openMoodHistory = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setHistoryVisible(true);
    setLoadingHistory(true);
    try {
      const items = api.getMoodHistory ? await api.getMoodHistory(30, 30) : [];
      setHistoryItems(Array.isArray(items) ? items : []);
    } catch {
      setHistoryItems([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const handleDeleteLog = async (id) => {
    try {
      if (api.deleteMoodLog) {
        await api.deleteMoodLog(id);
      }
      setHistoryItems((prev) => prev.filter((item) => item.id !== id));
      refreshProgressSummary(true);
    } catch {}
  };

  const confirmDeleteLog = useCallback((id) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Delete this mood check-in?")) {
        handleDeleteLog(id);
      }
      return;
    }

    Alert.alert("Delete check-in", "Remove this mood entry from your history?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => handleDeleteLog(id) },
    ]);
  }, [refreshProgressSummary]);

  const scrollToSection = useCallback((key) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const y = Math.max(0, (sectionYRef.current[key] || 0) - 12);
    scrollViewRef.current?.scrollTo({ y, animated: true });
    if (key === "progress") {
      setProgressHighlightSignal((n) => n + 1);
    } else if (key === "mood") {
      setMoodHighlightSignal((n) => n + 1);
    }
  }, []);

  const handlePressHabit = useCallback(
    (habitId) => {
      if (habitId === "checkin") {
        scrollToSection("mood");
        return;
      }

      if (habitId === "activity") {
        const modalTask = aiSuggestions?.suggestions?.find(
          (s) =>
            (s.actionType === "guided_steps" || s.actionType === "micro_journal") &&
            !completedActions[s.id || s.title]
        );
        setActiveQuickAction(modalTask || QUICK_SENSORY_RESET);
        setQuickActionVisible(true);
        return;
      }

      if (habitId === "breathe") {
        router.push("/(tabs)/breathe");
        return;
      }

      if (habitId === "chat") {
        router.push("/(tabs)/chat");
      }
    },
    [scrollToSection, aiSuggestions, completedActions, router]
  );

  const handleOpenQuiz = useCallback(() => {
    router.push("/mood-assessment");
  }, [router]);

  const habitProgress = useMemo(
    () =>
      getHabitProgress(dailyHabits, {
        checkin: Boolean(selectedMood || moodSummary?.checkedInToday),
        activity: Object.values(completedActions).some(Boolean),
      }),
    [dailyHabits, selectedMood, moodSummary?.checkedInToday, completedActions]
  );

  const moodStreak = moodSummary?.currentStreak || 0;
  const displayName = user?.name || "Friend";
  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";
  const companionTagline = activeCompanion?.tagline
    ?.replace(/[•·\s]+$/, "")
    .trim();

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        ref={scrollViewRef}
        scrollEnabled={scrollEnabled}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 112 + Math.max(insets.bottom, 12) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Serene Top Navbar with Clickable Streak Pill */}
        <View style={styles.topNavbar}>
          <View style={styles.logoBadge}>
            <Image
              source={{ uri: LOGO_URL }}
              style={styles.logoMini}
              resizeMode="contain"
            />
            <Text style={[styles.logoText, { color: colors.text }]}>Solace</Text>
          </View>

          <View style={styles.navActions}>
            <TouchableOpacity
              onPress={() => scrollToSection("progress")}
              activeOpacity={0.8}
              accessibilityLabel={`Current streak ${moodStreak} days. Jump to progress`}
              style={[
                styles.topStreakPill,
                {
                  backgroundColor:
                    moodStreak > 0 ? "rgba(245, 158, 11, 0.14)" : colors.surface,
                  borderColor:
                    moodStreak > 0 ? "rgba(245, 158, 11, 0.4)" : colors.border,
                },
              ]}
            >
              <Ionicons
                name={moodStreak > 0 ? "flame" : "flame-outline"}
                size={15}
                color={moodStreak > 0 ? "#F59E0B" : colors.textMuted}
              />
              <Text
                style={[
                  styles.topStreakText,
                  { color: moodStreak > 0 ? "#F59E0B" : colors.textMuted },
                ]}
              >
                {moodStreak}d
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                router.push("/reminders");
              }}
              accessibilityLabel="Manage reminders"
              style={[
                styles.circleBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="notifications-outline"
                size={19}
                color={colors.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleTheme}
              accessibilityLabel="Toggle theme"
              style={[
                styles.circleBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name={isDark ? "sunny-outline" : "moon-outline"}
                size={19}
                color={colors.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/profile")}
              accessibilityLabel="Open profile"
              style={[
                styles.avatarCircleBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.primary,
                },
              ]}
            >
              {user?.avatar ? (
                <Image
                  source={{ uri: user.avatar }}
                  style={styles.navAvatarImg}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons name="person-outline" size={19} color={colors.text} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Personal Greeting + Goal + Guest Sync */}
        <View style={styles.welcomeSection}>
          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.greetingSub, { color: colors.textMuted }]}>
                {getTimeGreeting()},
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.greetingMain, { color: colors.text }]}
              >
                {displayName}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push("/profile")}
              style={[
                styles.goalChip,
                {
                  backgroundColor: colors.primary + "14",
                  borderColor: colors.primary + "35",
                },
              ]}
            >
              <Ionicons
                name="compass-outline"
                size={14}
                color={colors.primary}
              />
              <Text
                numberOfLines={1}
                style={[styles.goalChipText, { color: colors.primary }]}
              >
                {user?.wellnessGoal || "Calm & Stress Relief"}
              </Text>
            </TouchableOpacity>
          </View>

          {user?.isGuest && (
            <TouchableOpacity
              onPress={() => router.push("/login")}
              activeOpacity={0.8}
              style={[
                styles.guestBanner,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <View
                style={[
                  styles.guestIconWrap,
                  { backgroundColor: colors.accent + "1F" },
                ]}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={15}
                  color={colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.guestTitle, { color: colors.text }]}>
                  Guest session active
                </Text>
                <Text style={[styles.guestSub, { color: colors.textMuted }]}>
                  Back up your moods and chats anytime
                </Text>
              </View>
              <View
                style={[
                  styles.syncPill,
                  { backgroundColor: colors.primary + "1E" },
                ]}
              >
                <Text style={[styles.syncPillText, { color: colors.primary }]}>
                  Sync
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={13}
                  color={colors.primary}
                />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Daily Reflection Hero Card */}
        <DailyReflectionCard
          affirmation={affirmation}
          loadingAffirmation={loadingAffirmation}
          onRefresh={() => loadAffirmation(true)}
          onInteractionChange={(active) => setScrollEnabled(!active)}
          colors={colors}
          isDark={isDark}
        />

        {/* Section 1: Mood Check-In & AI Suggestions */}
        <View
          onLayout={(e) => {
            sectionYRef.current.mood = e.nativeEvent.layout.y;
          }}
        >
          <MoodCheckInSection
            colors={colors}
            isDark={isDark}
            activeCompanion={activeCompanion}
            companionAvatarId={user?.companionAvatar}
            selectedMood={selectedMood}
            moodIntensity={moodIntensity}
            moodNote={moodNote}
            aiSuggestions={aiSuggestions}
            loadingSuggestions={loadingSuggestions}
            completedActions={completedActions}
            highlightSignal={moodHighlightSignal}
            onSelectMood={handleMoodSelect}
            onSelectIntensity={handleIntensitySelect}
            onNoteCommit={setMoodNote}
            onSubmitNote={handleSubmitNote}
            onRefreshSuggestions={handleRefreshSuggestions}
            onPressSuggestion={handleSuggestionAction}
            onOpenQuiz={handleOpenQuiz}
          />
        </View>

        {/* Section 2: Wellness Progress Tracker */}
        <View
          onLayout={(e) => {
            sectionYRef.current.progress = e.nativeEvent.layout.y;
          }}
        >
          <ProgressTrackerCard
            colors={colors}
            bottomInset={Math.max(insets.bottom, 20)}
            moodSummary={moodSummary}
            habitProgress={habitProgress}
            highlightSignal={progressHighlightSignal}
            historyVisible={historyVisible}
            historyItems={historyItems}
            loadingHistory={loadingHistory}
            onOpenHistory={openMoodHistory}
            onCloseHistory={() => setHistoryVisible(false)}
            onConfirmDeleteLog={confirmDeleteLog}
            onPressHabit={handlePressHabit}
          />
        </View>

        {/* Quick Sanctuary Bento Grid */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, marginTop: 26, marginBottom: 12 },
          ]}
        >
          Your Sanctuary
        </Text>

        <View style={styles.bentoRow}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/breathe")}
            activeOpacity={0.8}
            style={[
              styles.bentoCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.bentoIcon,
                { backgroundColor: colors.primary + "1F" },
              ]}
            >
              <Ionicons name="water-outline" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.bentoTitle, { color: colors.text }]}>
              Box Breathing
            </Text>
            <Text style={[styles.bentoSub, { color: colors.textMuted }]}>
              4-4-4-4 calm rhythm
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              setActiveQuickAction(QUICK_SENSORY_RESET);
              setQuickActionVisible(true);
            }}
            activeOpacity={0.8}
            style={[
              styles.bentoCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.bentoIcon,
                { backgroundColor: colors.accent + "1F" },
              ]}
            >
              <Ionicons
                name="hand-left-outline"
                size={21}
                color={colors.accent}
              />
            </View>
            <Text style={[styles.bentoTitle, { color: colors.text }]}>
              Sensory Reset
            </Text>
            <Text style={[styles.bentoSub, { color: colors.textMuted }]}>
              1-min 5-4-3-2-1 guide
            </Text>
          </TouchableOpacity>
        </View>

        {/* Companion Sanctuary Featured Card */}
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/chat")}
          activeOpacity={0.85}
          style={[
            styles.companionCard,
            {
              backgroundColor: colors.surface,
              borderColor: activeCompanion.accent + "45",
            },
          ]}
        >
          <CompanionAvatar avatarId={user?.companionAvatar} size={50} />
          <View style={styles.practiceContent}>
            <Text style={[styles.practiceTitle, { color: colors.text }]}>
              Talk with {activeCompanion.name}
            </Text>
            <Text style={[styles.practiceSubtitle, { color: colors.textMuted }]}>
              {companionTagline
                ? `${companionTagline} • Private check-in`
                : "Private check-in"}
            </Text>
          </View>
          <View
            style={[styles.openChatPill, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.openChatText, { color: onPrimaryText }]}>
              Chat
            </Text>
            <Ionicons name="arrow-forward" size={14} color={onPrimaryText} />
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Interactive Dynamic Task & Reflection Modal */}
      <DynamicTaskModal
        visible={quickActionVisible}
        task={activeQuickAction}
        onClose={() => setQuickActionVisible(false)}
        onComplete={handleCompleteQuickAction}
        onExploreInChat={handleExploreReflectionInChat}
        companionName={activeCompanion.name}
        colors={colors}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 14 },
  topNavbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  logoBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoMini: { width: 32, height: 32 },
  logoText: { fontSize: 21, fontWeight: "800", letterSpacing: 0.3 },
  navActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  topStreakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  topStreakText: { fontSize: 12.5, fontWeight: "800" },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  navAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  welcomeSection: { marginBottom: 20 },
  greetingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  greetingSub: { fontSize: 14, fontWeight: "500" },
  greetingMain: { fontSize: 28, fontWeight: "800", marginTop: 2 },
  goalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: "46%",
  },
  goalChipText: { fontSize: 11, fontWeight: "700" },
  guestBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
  },
  guestIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  guestTitle: { fontSize: 13, fontWeight: "700" },
  guestSub: { fontSize: 11, marginTop: 1 },
  syncPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  syncPillText: { fontSize: 12, fontWeight: "700" },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  bentoRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  bentoCard: {
    flex: 1,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
  bentoIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  bentoTitle: { fontSize: 15, fontWeight: "700" },
  bentoSub: { fontSize: 12, marginTop: 3 },
  companionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    gap: 12,
  },
  practiceContent: { flex: 1 },
  practiceTitle: { fontSize: 16, fontWeight: "700" },
  practiceSubtitle: { fontSize: 12, marginTop: 2 },
  openChatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  openChatText: { fontSize: 13, fontWeight: "700" },
});