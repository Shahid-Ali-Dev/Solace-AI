// app/(tabs)/breathe.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { getCompanionById } from "../../constants/companions";
import { getLocalDateKey, markDailyHabit } from "../../utils/dailyHabits";
import YogaMascot from "../../components/YogaMascot";
import {
  SOUND_OPTIONS,
  startAmbientSound,
  setAmbientVolume,
  stopAmbientSound,
  playBreathCueChime,
} from "../../utils/ambientSound";

const BREATHING_PRESETS = [
  {
    id: "sigh",
    name: "Quick Relief",
    badge: "Fast Reset",
    subtitle: "Offload tension fast with a double inhale and long sigh",
    rhythmHint: "Double inhale • Long sigh out",
    icon: "flash-outline",
    phases: [
      { name: "Inhale", cue: "Breathe in through your nose", duration: 2500, scale: 1.24 },
      { name: "Top Off", cue: "Sip in a little more air", duration: 1200, scale: 1.42 },
      { name: "Exhale", cue: "Let a long sigh out slowly", duration: 6000, scale: 0.94 },
      { name: "Rest", cue: "Pause softly before the next breath", duration: 1000, scale: 0.94 },
    ],
  },
  {
    id: "box",
    name: "Steady Focus",
    badge: "Balanced",
    subtitle: "Even-paced breathing to quiet noise and regain clarity",
    rhythmHint: "Equal 4s rhythm • Gentle holds",
    icon: "compass-outline",
    phases: [
      { name: "Inhale", cue: "Draw air in smoothly", duration: 4000, scale: 1.4 },
      { name: "Hold", cue: "Relax your jaw and shoulders", duration: 4000, scale: 1.4 },
      { name: "Exhale", cue: "Release air slowly and evenly", duration: 4000, scale: 0.94 },
      { name: "Rest", cue: "Stay still with empty lungs", duration: 4000, scale: 0.94 },
    ],
  },
  {
    id: "calm_478",
    name: "Deep Unwind",
    badge: "Sleep & Calm",
    subtitle: "Extended exhale signals your body it is safe to slow down",
    rhythmHint: "Slow inhale • Extra-long release",
    icon: "moon-outline",
    phases: [
      { name: "Inhale", cue: "Breathe in gently through nose", duration: 4000, scale: 1.4 },
      { name: "Hold", cue: "Hold lightly without straining", duration: 7000, scale: 1.4 },
      { name: "Exhale", cue: "Breathe out twice as slowly", duration: 8000, scale: 0.94 },
    ],
  },
  {
    id: "wave",
    name: "Easy Flow",
    badge: "No Holds",
    subtitle: "Continuous wave breathing with zero breath-holding",
    rhythmHint: "Smooth inhale • Smooth exhale",
    icon: "water-outline",
    phases: [
      { name: "Inhale", cue: "Rise effortlessly with the wave", duration: 5000, scale: 1.42 },
      { name: "Exhale", cue: "Sink softly into the exhale", duration: 5000, scale: 0.94 },
    ],
  },
];

const DURATION_OPTIONS = [
  { label: "1 min", seconds: 60 },
  { label: "2 min", seconds: 120 },
  { label: "3 min", seconds: 180 },
  { label: "Free flow", seconds: 0 },
];

const formatClock = (totalSec = 0) => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

const getMindfulStorageKey = (userId) =>
  `solace_breathe_sec_${userId || "guest"}_${getLocalDateKey()}`;

export default function BreatheScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const router = useRouter();
  const { preset } = useLocalSearchParams();

  const activeCompanion = getCompanionById(user?.companionAvatar);

  const [isFocused, setIsFocused] = useState(true);
  const [selectedPresetId, setSelectedPresetId] = useState("sigh");
  const [selectedDurationSec, setSelectedDurationSec] = useState(120);
  const [selectedSound, setSelectedSound] = useState("zen_pad");
  const [hapticGuidance, setHapticGuidance] = useState(true);

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [sessionElapsedSec, setSessionElapsedSec] = useState(0);
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(3);
  const [todayMindfulSec, setTodayMindfulSec] = useState(0);
  const [moodLoggedPostSession, setMoodLoggedPostSession] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1.0)).current;
  const ambientRotate = useRef(new Animated.Value(0)).current;
  const phaseEndsAtRef = useRef(Date.now());
  const habitMarkedRef = useRef(false);
  const lastSavedSecRef = useRef(0);
  const previewTimerRef = useRef(null);

  const activePreset =
    BREATHING_PRESETS.find((p) => p.id === selectedPresetId) ||
    BREATHING_PRESETS[0];
  const currentPhase =
    activePreset.phases[phaseIndex] || activePreset.phases[0];

  // Load today's mindful seconds
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(getMindfulStorageKey(user?.id))
      .then((val) => {
        if (!cancelled && val) {
          setTodayMindfulSec(Number(val) || 0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Continuous slow rotation for organic aura layers
  useEffect(() => {
    if (!isFocused) {
      ambientRotate.stopAnimation();
      return;
    }
    const rotLoop = Animated.loop(
      Animated.timing(ambientRotate, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotLoop.start();
    return () => rotLoop.stop();
  }, [isFocused]);

  // Pause & silence audio cleanly when leaving tab
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
        setIsActive(false);
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
        stopAmbientSound().catch(() => {});
      };
    }, [])
  );

  // Stop sound on unmount
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      stopAmbientSound().catch(() => {});
    };
  }, []);

  // Apply preset sent from Home AI suggestions, Assessment, or Notifications
  useEffect(() => {
    if (
      typeof preset === "string" &&
      BREATHING_PRESETS.some((p) => p.id === preset)
    ) {
      setIsActive(false);
      setSessionComplete(false);
      setMoodLoggedPostSession(false);
      setPhaseIndex(0);
      setCyclesCompleted(0);
      setSessionElapsedSec(0);
      lastSavedSecRef.current = 0;
      habitMarkedRef.current = false;
      setSelectedPresetId(preset);
      router.setParams({ preset: undefined });
    }
  }, [preset]);

  // Sync ambient music playback with active state & selected soundscape
  useEffect(() => {
    if (isActive && isFocused && !sessionComplete && selectedSound !== "off") {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      startAmbientSound(selectedSound, 0.44).catch(() => {});
    } else if (!previewTimerRef.current) {
      stopAmbientSound().catch(() => {});
    }
  }, [isActive, isFocused, sessionComplete, selectedSound]);

  const triggerPhaseHaptic = (phaseName) => {
    if (!hapticGuidance) return;
    try {
      Haptics.impactAsync(
        phaseName === "Exhale" || phaseName === "Rest"
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium
      );
    } catch {}
  };

  // Phase animation, audio volume swell, chimes & progression loop
  useEffect(() => {
    let timer;
    scaleAnim.stopAnimation();

    if (isActive && isFocused && !sessionComplete) {
      const current = activePreset.phases[phaseIndex] || activePreset.phases[0];
      const phaseDurationSec = Math.max(1, Math.ceil(current.duration / 1000));
      phaseEndsAtRef.current = Date.now() + current.duration;
      setPhaseSecondsLeft(phaseDurationSec);

      triggerPhaseHaptic(current.name);

      if (selectedSound !== "off") {
        const targetVol =
          current.name === "Inhale" || current.name === "Top Off"
            ? 0.56
            : current.name === "Hold"
            ? 0.42
            : 0.28;
        setAmbientVolume(targetVol);
        playBreathCueChime(current.name).catch(() => {});
      }

      Animated.timing(scaleAnim, {
        toValue: current.scale,
        duration: current.duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }).start();

      timer = setTimeout(() => {
        const nextIdx = (phaseIndex + 1) % activePreset.phases.length;
        if (nextIdx === 0) {
          setCyclesCompleted((prev) => prev + 1);
          if (!habitMarkedRef.current) {
            habitMarkedRef.current = true;
            markDailyHabit(user?.id, "breathe").catch(() => {});
          }
        }
        setPhaseIndex(nextIdx);
      }, current.duration);
    } else {
      Animated.timing(scaleAnim, {
        toValue: 1.0,
        duration: 450,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
      setPhaseIndex(0);
      setPhaseSecondsLeft(
        Math.max(1, Math.ceil(activePreset.phases[0].duration / 1000))
      );
    }

    return () => {
      if (timer) clearTimeout(timer);
      scaleAnim.stopAnimation();
    };
  }, [isActive, phaseIndex, isFocused, activePreset, sessionComplete, selectedSound]);

  // Countdown + session clock
  useEffect(() => {
    if (!isActive || !isFocused || sessionComplete) return;

    const phaseTicker = setInterval(() => {
      const remaining = Math.ceil((phaseEndsAtRef.current - Date.now()) / 1000);
      setPhaseSecondsLeft(Math.max(1, remaining));
    }, 200);

    const sessionTicker = setInterval(() => {
      setSessionElapsedSec((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(phaseTicker);
      clearInterval(sessionTicker);
    };
  }, [isActive, isFocused, sessionComplete]);

  // Persist delta mindful seconds
  useEffect(() => {
    const delta = sessionElapsedSec - lastSavedSecRef.current;
    if (delta >= 5 || (!isActive && delta > 0)) {
      lastSavedSecRef.current = sessionElapsedSec;
      setTodayMindfulSec((prev) => {
        const next = prev + delta;
        AsyncStorage.setItem(getMindfulStorageKey(user?.id), String(next)).catch(
          () => {}
        );
        return next;
      });
    }
  }, [sessionElapsedSec, isActive, user?.id]);

  // Complete timed sessions smoothly
  useEffect(() => {
    if (
      isActive &&
      selectedDurationSec > 0 &&
      sessionElapsedSec >= selectedDurationSec
    ) {
      finishSessionNow();
    }
  }, [isActive, sessionElapsedSec, selectedDurationSec]);

  const finishSessionNow = () => {
    setIsActive(false);
    setSessionComplete(true);
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    stopAmbientSound().catch(() => {});
    if (!habitMarkedRef.current) {
      habitMarkedRef.current = true;
      markDailyHabit(user?.id, "breathe").catch(() => {});
    }
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const resetSessionState = () => {
    setIsActive(false);
    setSessionComplete(false);
    setMoodLoggedPostSession(false);
    setPhaseIndex(0);
    setCyclesCompleted(0);
    setSessionElapsedSec(0);
    lastSavedSecRef.current = 0;
    habitMarkedRef.current = false;
  };

  const handleSelectPreset = (id) => {
    if (id === selectedPresetId) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    resetSessionState();
    setSelectedPresetId(id);
  };

  const handleSelectDuration = (sec) => {
    if (sec === selectedDurationSec) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    resetSessionState();
    setSelectedDurationSec(sec);
  };

  const handleSelectSound = (soundId) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setSelectedSound(soundId);

    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    if (soundId === "off") {
      stopAmbientSound().catch(() => {});
      return;
    }

    // Play a short 2.5s preview if paused so the user can hear the track immediately
    if (!isActive) {
      startAmbientSound(soundId, 0.42).catch(() => {});
      previewTimerRef.current = setTimeout(() => {
        previewTimerRef.current = null;
        stopAmbientSound().catch(() => {});
      }, 2600);
    }
  };

  const handleTogglePlay = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    if (sessionComplete) {
      resetSessionState();
      setIsActive(true);
      return;
    }

    setIsActive((prev) => !prev);
  };

  const handleLogCalmerMood = async () => {
    if (moodLoggedPostSession) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setMoodLoggedPostSession(true);
    try {
      await api.logMood(
        "peaceful",
        2,
        `Completed ${activePreset.name} breathing (${cyclesCompleted || 1} cycles)`
      );
      await markDailyHabit(user?.id, "checkin");
    } catch {}
  };

  const handleChatFollowUp = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    router.push({
      pathname: "/(tabs)/chat",
      params: {
        starterPrompt: `I just finished ${activePreset.name} breathing (${cyclesCompleted || 1} cycles) and want to check in.`,
      },
    });
  };

  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";
  const bottomInset = Math.max(insets.bottom, Platform.OS === "ios" ? 20 : 12);
  const bottomClearance = 66 + bottomInset + 14;

  const isCompactScreen = height < 740;
  const mascotSize = isCompactScreen ? 116 : 136;
  const petalSize = mascotSize + 24;
  const outerRingSize = mascotSize + 52;

  const outerAuraScale = scaleAnim.interpolate({
    inputRange: [0.94, 1.42],
    outputRange: [0.92, 1.38],
    extrapolate: "clamp",
  });

  const spinCw = ambientRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const spinCcw = ambientRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  const remainingSessionSec =
    selectedDurationSec > 0
      ? Math.max(0, selectedDurationSec - sessionElapsedSec)
      : sessionElapsedSec;

  const mindfulMinutesToday = Math.floor(todayMindfulSec / 60);

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.text }]}>
            Breathe
          </Text>
          <Text style={[styles.screenSub, { color: colors.textMuted }]}>
            {mindfulMinutesToday > 0
              ? `${mindfulMinutesToday} min mindful today`
              : `Guided with ${activeCompanion.name}`}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            try {
              Haptics.selectionAsync();
            } catch {}
            setHapticGuidance((prev) => !prev);
          }}
          accessibilityLabel="Toggle eyes-closed haptic pacing"
          style={[
            styles.hapticPill,
            {
              backgroundColor: hapticGuidance
                ? colors.primary + "1C"
                : colors.surface,
              borderColor: hapticGuidance
                ? colors.primary + "55"
                : colors.border,
            },
          ]}
        >
          <Ionicons
            name={hapticGuidance ? "pulse" : "pulse-outline"}
            size={15}
            color={hapticGuidance ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.hapticPillText,
              { color: hapticGuidance ? colors.primary : colors.textMuted },
            ]}
          >
            {hapticGuidance ? "Haptics On" : "Haptics Off"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Technique + Duration + Soundscape Controls */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetScroll}
        >
          {BREATHING_PRESETS.map((p) => {
            const selected = p.id === activePreset.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => handleSelectPreset(p.id)}
                activeOpacity={0.82}
                style={[
                  styles.presetCard,
                  {
                    backgroundColor: selected
                      ? colors.primary + "1A"
                      : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <View style={styles.presetTopRow}>
                  <Ionicons
                    name={p.icon}
                    size={16}
                    color={selected ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.presetBadge,
                      { color: selected ? colors.primary : colors.textMuted },
                    ]}
                  >
                    {p.badge}
                  </Text>
                </View>
                <Text style={[styles.presetName, { color: colors.text }]}>
                  {p.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.presetHint, { color: colors.textMuted }]}
                >
                  {p.rhythmHint}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Duration Pills */}
        <View style={styles.durationRow}>
          {DURATION_OPTIONS.map((opt) => {
            const selected = opt.seconds === selectedDurationSec;
            return (
              <TouchableOpacity
                key={opt.label}
                onPress={() => handleSelectDuration(opt.seconds)}
                style={[
                  styles.durationChip,
                  {
                    backgroundColor: selected
                      ? colors.primary + "1F"
                      : "transparent",
                    borderColor: selected
                      ? colors.primary + "66"
                      : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.durationText,
                    { color: selected ? colors.primary : colors.textMuted },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Soothing Soundscape Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.soundRow}
        >
          {SOUND_OPTIONS.map((s) => {
            const selected = selectedSound === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => handleSelectSound(s.id)}
                activeOpacity={0.8}
                style={[
                  styles.soundChip,
                  {
                    backgroundColor: selected
                      ? colors.accent + "22"
                      : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={s.icon}
                  size={13}
                  color={selected ? colors.accent : colors.textMuted}
                />
                <Text
                  style={[
                    styles.soundChipText,
                    { color: selected ? colors.text : colors.textMuted },
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Breathing Stage with Yoga Mascot OR Calm Post-Session Summary */}
      {sessionComplete ? (
        <View style={styles.completeStage}>
          <View
            style={[
              styles.completeCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={{ marginBottom: 8 }}>
              <YogaMascot
                avatarId={user?.companionAvatar}
                size={96}
                sessionComplete
              />
            </View>

            <Text style={[styles.completeTitle, { color: colors.text }]}>
              Nice pause
            </Text>
            <Text style={[styles.completeMeta, { color: colors.textMuted }]}>
              {cyclesCompleted} {cyclesCompleted === 1 ? "cycle" : "cycles"} of{" "}
              {activePreset.name} • {formatClock(sessionElapsedSec)}
            </Text>

            <View
              style={[
                styles.savedPill,
                { backgroundColor: colors.primary + "1A" },
              ]}
            >
              <Ionicons
                name="sparkles"
                size={13}
                color={colors.primary}
              />
              <Text style={[styles.savedPillText, { color: colors.primary }]}>
                Added to today's wellness rhythm
              </Text>
            </View>

            <View style={styles.postActionsCol}>
              <TouchableOpacity
                onPress={handleLogCalmerMood}
                disabled={moodLoggedPostSession}
                style={[
                  styles.postBtn,
                  {
                    backgroundColor: moodLoggedPostSession
                      ? "rgba(16, 185, 129, 0.16)"
                      : colors.surfaceElevated,
                    borderColor: moodLoggedPostSession
                      ? "#10B981"
                      : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={moodLoggedPostSession ? "checkmark" : "sunny-outline"}
                  size={17}
                  color={moodLoggedPostSession ? "#10B981" : colors.primary}
                />
                <Text
                  style={[
                    styles.postBtnText,
                    { color: moodLoggedPostSession ? "#10B981" : colors.text },
                  ]}
                >
                  {moodLoggedPostSession
                    ? "Logged calmer mood"
                    : "Log that I feel calmer"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleChatFollowUp}
                style={[
                  styles.postBtn,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={17}
                  color={colors.accent}
                />
                <Text style={[styles.postBtnText, { color: colors.text }]}>
                  Check in with {activeCompanion.name}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.centerStage}>
          {/* Animated Aura + Lotus Mascot Stage */}
          <View style={styles.mascotStage}>
            <Animated.View
              pointerEvents="none"
              renderToHardwareTextureAndroid
              style={[
                styles.glowRing,
                {
                  width: outerRingSize,
                  height: outerRingSize,
                  borderRadius: outerRingSize / 2,
                  backgroundColor: colors.accent + "12",
                  borderColor: colors.accent + "2E",
                  transform: [{ scale: outerAuraScale }, { rotate: spinCw }],
                },
              ]}
            />

            <Animated.View
              pointerEvents="none"
              renderToHardwareTextureAndroid
              style={[
                styles.petalRing,
                {
                  width: petalSize,
                  height: petalSize,
                  borderRadius: petalSize * 0.36,
                  backgroundColor: colors.primary + "1A",
                  borderColor: colors.primary + "40",
                  transform: [{ scale: scaleAnim }, { rotate: spinCcw }],
                },
              ]}
            />

            <TouchableOpacity
              onPress={handleTogglePlay}
              activeOpacity={0.9}
              accessibilityLabel={
                isActive ? "Pause breathing" : "Tap companion to begin breathing"
              }
              style={styles.mascotTouch}
            >
              <YogaMascot
                avatarId={user?.companionAvatar}
                size={mascotSize}
                scaleAnim={scaleAnim}
                isActive={isActive}
                phaseName={currentPhase.name}
              />
            </TouchableOpacity>
          </View>

          {/* Phase Pill + Live Cue + Rhythm Badges (Non-overlapping flex layout) */}
          <View style={styles.cueSection}>
            <LinearGradient
              colors={
                isActive
                  ? [colors.primary, isDark ? "#38BDF8" : "#0F766E"]
                  : [colors.surfaceElevated, colors.surfaceElevated]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.phaseBadgePill,
                !isActive && { borderWidth: 1, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.phasePillText,
                  { color: isActive ? onPrimaryText : colors.text },
                ]}
              >
                {isActive
                  ? `${currentPhase.name}  •  ${phaseSecondsLeft}s`
                  : sessionElapsedSec > 0
                  ? "Paused — Tap to resume"
                  : `Breathe with ${activeCompanion.name}`}
              </Text>
            </LinearGradient>

            <Text style={[styles.cueText, { color: colors.text }]}>
              {isActive ? currentPhase.cue : activePreset.subtitle}
            </Text>

            <View style={styles.sequenceRow}>
              {activePreset.phases.map((p, idx) => {
                const active = isActive && idx === phaseIndex;
                return (
                  <View
                    key={`${p.name}_${idx}`}
                    style={[
                      styles.seqBadge,
                      {
                        backgroundColor: active
                          ? colors.primary + "22"
                          : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.seqText,
                        { color: active ? colors.primary : colors.textMuted },
                      ]}
                    >
                      {p.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* Bottom Controls */}
      <View style={[styles.footer, { paddingBottom: bottomClearance }]}>
        {!sessionComplete && (
          <Text style={[styles.statsText, { color: colors.textMuted }]}>
            {selectedDurationSec > 0
              ? `${formatClock(remainingSessionSec)} left`
              : `${formatClock(sessionElapsedSec)} elapsed`}
            {"  •  "}
            {cyclesCompleted} {cyclesCompleted === 1 ? "cycle" : "cycles"}
          </Text>
        )}

        <View style={styles.controlsRow}>
          {sessionElapsedSec > 0 && !isActive && !sessionComplete && (
            <TouchableOpacity
              onPress={() => {
                try {
                  Haptics.selectionAsync();
                } catch {}
                resetSessionState();
              }}
              accessibilityLabel="Reset breathing session"
              style={[
                styles.secondaryRoundBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="refresh" size={19} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleTogglePlay}
            activeOpacity={0.85}
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons
              name={
                sessionComplete
                  ? "refresh"
                  : isActive
                  ? "pause"
                  : "play"
              }
              size={19}
              color={onPrimaryText}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.actionBtnText, { color: onPrimaryText }]}>
              {sessionComplete
                ? "Practice Again"
                : isActive
                ? "Pause"
                : sessionElapsedSec > 0
                ? "Resume"
                : "Begin Practice"}
            </Text>
          </TouchableOpacity>

          {sessionElapsedSec >= 10 && !sessionComplete && (
            <TouchableOpacity
              onPress={finishSessionNow}
              style={[
                styles.finishBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.finishBtnText, { color: colors.text }]}>
                Finish
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  screenTitle: { fontSize: 24, fontWeight: "800" },
  screenSub: { fontSize: 12.5, marginTop: 2 },
  hapticPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  hapticPillText: { fontSize: 12, fontWeight: "700" },
  presetScroll: {
    paddingHorizontal: 20,
    gap: 10,
    paddingTop: 4,
  },
  presetCard: {
    width: 156,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 3,
  },
  presetTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 2,
  },
  presetBadge: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4 },
  presetName: { fontSize: 14.5, fontWeight: "700" },
  presetHint: { fontSize: 11 },
  durationRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 20,
  },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  durationText: { fontSize: 11.5, fontWeight: "700" },
  soundRow: {
    paddingHorizontal: 20,
    gap: 7,
    marginTop: 8,
    justifyContent: "center",
    flexGrow: 1,
  },
  soundChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 13,
    borderWidth: 1,
  },
  soundChipText: { fontSize: 11.5, fontWeight: "600" },
  centerStage: {
    flex: 1,
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  mascotStage: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    minHeight: 165,
  },
  glowRing: {
    position: "absolute",
    borderWidth: 1,
  },
  petalRing: {
    position: "absolute",
    borderWidth: 1,
  },
  mascotTouch: {
    justifyContent: "center",
    alignItems: "center",
  },
  cueSection: {
    alignItems: "center",
    gap: 9,
    width: "100%",
  },
  phaseBadgePill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
  },
  phasePillText: {
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  cueText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 19,
  },
  sequenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  seqBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  seqText: { fontSize: 11, fontWeight: "600" },
  completeStage: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  completeCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  completeTitle: { fontSize: 22, fontWeight: "800" },
  completeMeta: { fontSize: 13.5, marginTop: 4, textAlign: "center" },
  savedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  savedPillText: { fontSize: 12, fontWeight: "700" },
  postActionsCol: { width: "100%", gap: 10 },
  postBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
  },
  postBtnText: { fontSize: 14, fontWeight: "600" },
  footer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  statsText: { fontSize: 12.5, fontWeight: "600", marginBottom: 10 },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  secondaryRoundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 28,
  },
  actionBtnText: { fontSize: 15.5, fontWeight: "700" },
  finishBtn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  finishBtnText: { fontSize: 13.5, fontWeight: "700" },
});