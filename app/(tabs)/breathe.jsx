// app/(tabs)/breathe.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";

const BREATHING_PRESETS = [
  {
    id: "box",
    name: "Box Breathing",
    shortLabel: "Box 4-4-4-4",
    subtitle: "Steady your nervous system & sharpen focus",
    phases: [
      { name: "Inhale", duration: 4000, scale: 1.45 },
      { name: "Hold", duration: 4000, scale: 1.45 },
      { name: "Exhale", duration: 4000, scale: 1.0 },
      { name: "Rest", duration: 4000, scale: 1.0 },
    ],
  },
  {
    id: "calm_478",
    name: "4-7-8 Relax",
    shortLabel: "4-7-8",
    subtitle: "Longer exhale to ease anxiety & wind down",
    phases: [
      { name: "Inhale", duration: 4000, scale: 1.45 },
      { name: "Hold", duration: 7000, scale: 1.45 },
      { name: "Exhale", duration: 8000, scale: 1.0 },
    ],
  },
  {
    id: "sigh",
    name: "Physiological Sigh",
    shortLabel: "Sigh",
    subtitle: "Two quick inhales & a long release for fast calm",
    phases: [
      { name: "Inhale", duration: 2500, scale: 1.3 },
      { name: "Top Off", duration: 1200, scale: 1.48 },
      { name: "Exhale", duration: 6000, scale: 1.0 },
      { name: "Rest", duration: 1000, scale: 1.0 },
    ],
  },
];

const DURATION_OPTIONS = [
  { label: "1m", seconds: 60 },
  { label: "2m", seconds: 120 },
  { label: "3m", seconds: 180 },
  { label: "Open", seconds: 0 },
];

const formatClock = (totalSec = 0) => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

export default function BreatheScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preset } = useLocalSearchParams();

  const [isFocused, setIsFocused] = useState(true);
  const [selectedPresetId, setSelectedPresetId] = useState("box");
  const [selectedDurationSec, setSelectedDurationSec] = useState(120);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [sessionElapsedSec, setSessionElapsedSec] = useState(0);
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(4);

  const scaleAnim = useRef(new Animated.Value(1.0)).current;
  const phaseEndsAtRef = useRef(Date.now());

  const activePreset =
    BREATHING_PRESETS.find((p) => p.id === selectedPresetId) ||
    BREATHING_PRESETS[0];
  const currentPhase =
    activePreset.phases[phaseIndex] || activePreset.phases[0];

  // Stop active practice & haptics cleanly when navigating away from tab
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
        setIsActive(false);
      };
    }, [])
  );

  // Apply preset sent via Home AI suggestions (then clear param so manual switching works)
  useEffect(() => {
    if (
      typeof preset === "string" &&
      BREATHING_PRESETS.some((p) => p.id === preset)
    ) {
      setIsActive(false);
      setSessionComplete(false);
      setPhaseIndex(0);
      setCyclesCompleted(0);
      setSessionElapsedSec(0);
      setSelectedPresetId(preset);
      router.setParams({ preset: undefined });
    }
  }, [preset]);

  // Phase animation + haptic + step progression
  useEffect(() => {
    let timer;
    scaleAnim.stopAnimation();

    if (isActive && isFocused && !sessionComplete) {
      const current = activePreset.phases[phaseIndex] || activePreset.phases[0];
      const phaseDurationSec = Math.max(1, Math.ceil(current.duration / 1000));
      phaseEndsAtRef.current = Date.now() + current.duration;
      setPhaseSecondsLeft(phaseDurationSec);

      try {
        Haptics.impactAsync(
          current.name === "Exhale" || current.name === "Rest"
            ? Haptics.ImpactFeedbackStyle.Light
            : Haptics.ImpactFeedbackStyle.Medium
        );
      } catch {}

      Animated.timing(scaleAnim, {
        toValue: current.scale,
        duration: current.duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();

      timer = setTimeout(() => {
        const nextIdx = (phaseIndex + 1) % activePreset.phases.length;
        if (nextIdx === 0) {
          setCyclesCompleted((prev) => prev + 1);
        }
        setPhaseIndex(nextIdx);
      }, current.duration);
    } else {
      Animated.timing(scaleAnim, {
        toValue: 1.0,
        duration: 500,
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
  }, [isActive, phaseIndex, isFocused, activePreset, sessionComplete]);

  // Smooth phase countdown + elapsed session clock
  useEffect(() => {
    if (!isActive || !isFocused || sessionComplete) return;

    const phaseTicker = setInterval(() => {
      const remaining = Math.ceil((phaseEndsAtRef.current - Date.now()) / 1000);
      setPhaseSecondsLeft(Math.max(1, remaining));
    }, 250);

    const sessionTicker = setInterval(() => {
      setSessionElapsedSec((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(phaseTicker);
      clearInterval(sessionTicker);
    };
  }, [isActive, isFocused, sessionComplete]);

  // Complete timed sessions smoothly
  useEffect(() => {
    if (
      isActive &&
      selectedDurationSec > 0 &&
      sessionElapsedSec >= selectedDurationSec
    ) {
      setIsActive(false);
      setSessionComplete(true);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
  }, [isActive, sessionElapsedSec, selectedDurationSec]);

  const handleSelectPreset = (id) => {
    if (id === selectedPresetId) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    setIsActive(false);
    setSessionComplete(false);
    setPhaseIndex(0);
    setCyclesCompleted(0);
    setSessionElapsedSec(0);
    setSelectedPresetId(id);
  };

  const handleSelectDuration = (sec) => {
    if (sec === selectedDurationSec) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    setIsActive(false);
    setSessionComplete(false);
    setPhaseIndex(0);
    setCyclesCompleted(0);
    setSessionElapsedSec(0);
    setSelectedDurationSec(sec);
  };

  const handleTogglePlay = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (sessionComplete) {
      setSessionComplete(false);
      setCyclesCompleted(0);
      setSessionElapsedSec(0);
      setPhaseIndex(0);
      setIsActive(true);
      return;
    }

    setIsActive((prev) => !prev);
  };

  const handleReset = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setIsActive(false);
    setSessionComplete(false);
    setPhaseIndex(0);
    setCyclesCompleted(0);
    setSessionElapsedSec(0);
  };

  const outerAuraScale = scaleAnim.interpolate({
    inputRange: [1, 1.48],
    outputRange: [1, 1.58],
  });

  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";
  const bottomInset = Math.max(insets.bottom, Platform.OS === "ios" ? 20 : 12);
  const bottomClearance = 66 + bottomInset + 20;

  const remainingSessionSec =
    selectedDurationSec > 0
      ? Math.max(0, selectedDurationSec - sessionElapsedSec)
      : sessionElapsedSec;

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header & Controls */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {activePreset.name}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {activePreset.subtitle}
        </Text>

        {/* Preset Switcher */}
        <View style={styles.presetRow}>
          {BREATHING_PRESETS.map((p) => {
            const selected = p.id === activePreset.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => handleSelectPreset(p.id)}
                activeOpacity={0.8}
                style={[
                  styles.presetPill,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    { color: selected ? onPrimaryText : colors.textMuted },
                  ]}
                >
                  {p.shortLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Duration Selector */}
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
                    borderColor: selected ? colors.primary + "66" : colors.border,
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
      </View>

      {/* Breathing Orb Stage */}
      <View style={styles.centerStage}>
        <Animated.View
          style={[
            styles.glowRing,
            {
              backgroundColor: colors.primary + "18",
              transform: [{ scale: outerAuraScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.breathingOrb,
            {
              backgroundColor: sessionComplete ? "#10B981" : colors.primary,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        />

        <View pointerEvents="none" style={styles.orbLabelWrap}>
          {sessionComplete ? (
            <>
              <Ionicons name="checkmark-circle" size={30} color={onPrimaryText} />
              <Text style={[styles.phaseText, { color: onPrimaryText, marginTop: 4 }]}>
                Complete
              </Text>
            </>
          ) : isActive ? (
            <>
              <Text style={[styles.phaseText, { color: onPrimaryText }]}>
                {currentPhase.name}
              </Text>
              <Text style={[styles.countdownText, { color: onPrimaryText }]}>
                {phaseSecondsLeft}s
              </Text>
            </>
          ) : (
            <Text style={[styles.phaseText, { color: onPrimaryText }]}>
              {sessionElapsedSec > 0 ? "Paused" : "Ready"}
            </Text>
          )}
        </View>
      </View>

      {/* Bottom Sequence Strip & Play Controls */}
      <View style={[styles.footer, { paddingBottom: bottomClearance }]}>
        {/* Phase Sequence Indicator */}
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

        {/* Session Clock + Cycles */}
        <Text style={[styles.statsText, { color: colors.textMuted }]}>
          {selectedDurationSec > 0
            ? `${formatClock(remainingSessionSec)} remaining`
            : `${formatClock(sessionElapsedSec)} elapsed`}
          {"  •  "}
          {cyclesCompleted} {cyclesCompleted === 1 ? "cycle" : "cycles"}
        </Text>

        {/* Primary Action + Optional Reset */}
        <View style={styles.controlsRow}>
          {sessionElapsedSec > 0 && !isActive && !sessionComplete && (
            <TouchableOpacity
              onPress={handleReset}
              accessibilityLabel="Reset breathing session"
              style={[
                styles.resetBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="refresh" size={20} color={colors.textMuted} />
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
              size={20}
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
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "space-between" },
  header: { alignItems: "center", paddingTop: 16, paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 4, textAlign: "center" },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  presetPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  presetText: { fontSize: 13, fontWeight: "600" },
  durationRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  durationText: { fontSize: 12, fontWeight: "700" },
  centerStage: { flex: 1, justifyContent: "center", alignItems: "center" },
  glowRing: { position: "absolute", width: 200, height: 200, borderRadius: 100 },
  breathingOrb: { position: "absolute", width: 132, height: 132, borderRadius: 66 },
  orbLabelWrap: { alignItems: "center", justifyContent: "center", zIndex: 2 },
  phaseText: { fontSize: 20, fontWeight: "700" },
  countdownText: { fontSize: 14, fontWeight: "600", opacity: 0.85, marginTop: 2 },
  footer: { alignItems: "center", paddingHorizontal: 20 },
  sequenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginBottom: 10,
  },
  seqBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  seqText: { fontSize: 11, fontWeight: "600" },
  statsText: { fontSize: 12, fontWeight: "500", marginBottom: 14 },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  resetBtn: {
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
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 30,
  },
  actionBtnText: { fontSize: 16, fontWeight: "700" },
});