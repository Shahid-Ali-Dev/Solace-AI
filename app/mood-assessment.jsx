// app/mood-assessment.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  Easing,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import CompanionAvatar from "../components/CompanionAvatar";
import DynamicTaskModal from "../components/DynamicTaskModal";
import { getCompanionById } from "../constants/companions";
import { getLocalDateKey, markDailyHabit } from "../utils/dailyHabits";

const MOOD_META = {
  peaceful: { label: "Peaceful", icon: "sunny-outline", accent: "#2DD4BF" },
  anxious: { label: "Anxious", icon: "pulse-outline", accent: "#F59E0B" },
  tired: { label: "Tired", icon: "moon-outline", accent: "#818CF8" },
  overwhelmed: { label: "Overwhelmed", icon: "cloud-outline", accent: "#A78BFA" },
  grateful: { label: "Grateful", icon: "heart-outline", accent: "#FB7185" },
};

const QUESTIONS = [
  {
    key: "bodyState",
    eyebrow: "BODY CHECK",
    prompt: "How does your body feel right now?",
    subtitle: "Notice your shoulders, chest, jaw, and energy.",
    options: [
      { id: "tense_restless", label: "Tight or restless", desc: "Tight jaw, fidgety, hard to sit still", icon: "pulse-outline" },
      { id: "heavy_drained", label: "Heavy or drained", desc: "Low energy, slow limbs, sleepy eyes", icon: "battery-dead-outline" },
      { id: "wired_on_edge", label: "Wired & on edge", desc: "Fast heartbeat, alert, slightly braced", icon: "flash-outline" },
      { id: "calm_steady", label: "Relaxed & steady", desc: "Breathing feels easy, shoulders dropped", icon: "leaf-outline" },
      { id: "warm_open", label: "Warm & light", desc: "Soft chest, subtle smile, uplifted", icon: "heart-outline" },
    ],
  },
  {
    key: "thoughtPace",
    eyebrow: "MIND PACE",
    prompt: "What are your thoughts doing?",
    subtitle: "Pick the pattern closest to the last hour.",
    options: [
      { id: "racing_looping", label: "Racing or looping", desc: "Replaying conversations or 'what ifs'", icon: "sync-outline" },
      { id: "scattered_too_much", label: "Juggling too much", desc: "Ten open tabs in my head at once", icon: "layers-outline" },
      { id: "foggy_blank", label: "Foggy or blank", desc: "Hard to focus, mentally checked out", icon: "cloud-outline" },
      { id: "clear_present", label: "Clear & present", desc: "Quiet mind, taking things as they come", icon: "compass-outline" },
      { id: "appreciative_reflective", label: "Reflective & thankful", desc: "Thinking about good moments or people", icon: "sparkles-outline" },
    ],
  },
  {
    key: "energyLevel",
    eyebrow: "BATTERY & NOISE",
    prompt: "How's your mental battery holding up?",
    subtitle: "Be honest—no right or wrong answer here.",
    options: [
      { id: "empty_battery", label: "Running on empty", desc: "Even small tasks feel like a climb", icon: "moon-outline" },
      { id: "overstimulated", label: "Overstimulated", desc: "Too much noise, screens, or pressure", icon: "volume-high-outline" },
      { id: "getting_by", label: "Just getting by", desc: "Managing, though a bit worn thin", icon: "walk-outline" },
      { id: "balanced", label: "Balanced & okay", desc: "Steady reserve for what's next", icon: "sunny-outline" },
      { id: "uplifted", label: "Energized & open", desc: "Good momentum right now", icon: "flame-outline" },
    ],
  },
  {
    key: "primaryTrigger",
    eyebrow: "ROOT CONTEXT",
    prompt: "What's taking up the most space today?",
    subtitle: "Choose one area, and add a quick note below if you'd like.",
    allowNote: true,
    options: [
      { id: "work_pressure", label: "Deadlines or workload", desc: "Tasks, study, or falling behind", icon: "briefcase-outline" },
      { id: "people_expectations", label: "People or expectations", desc: "Social stress, family, or boundaries", icon: "people-outline" },
      { id: "sleep_fatigue", label: "Lack of rest or burnout", desc: "Poor sleep or too little downtime", icon: "bed-outline" },
      { id: "vague_fog", label: "Not sure—just an off feeling", desc: "Hard to pinpoint a single reason", icon: "help-circle-outline" },
      { id: "good_moment", label: "Something positive", desc: "A win, relief, or quiet peace", icon: "ribbon-outline" },
    ],
  },
];

export default function MoodAssessmentScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeCompanion = getCompanionById(user?.companionAvatar);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [note, setNote] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const [activeTask, setActiveTask] = useState(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [completedTasks, setCompletedTasks] = useState({});

  const stepAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    stepAnim.setValue(0);
    Animated.timing(stepAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.timing(progressAnim, {
      toValue: result ? 1 : (step + 1) / QUESTIONS.length,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [step, result]);

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      Haptics.impactAsync(style);
    } catch {}
  };

  const currentQuestion = QUESTIONS[step];
  const currentAnswer = answers[currentQuestion?.key];

  const handleSelectOption = (optionId) => {
    triggerHaptic();
    setError("");
    const updated = { ...answers, [currentQuestion.key]: optionId };
    setAnswers(updated);

    if (step < QUESTIONS.length - 1) {
      setTimeout(() => {
        setStep((s) => Math.min(QUESTIONS.length - 1, s + 1));
      }, 170);
    }
  };

  const syncToHomeCache = async (evalData, nextCompleted = completedTasks) => {
    if (!user?.id || !evalData) return;
    try {
      const todayKey = `solace_home_checkin_${user.id}_${getLocalDateKey()}`;
      await AsyncStorage.setItem(
        todayKey,
        JSON.stringify({
          mood: evalData.mood,
          logId: evalData.logId || null,
          note: note.trim() || `Guided check-in: ${evalData.nuanceLabel}`,
          intensity: evalData.intensity || 3,
          companionId: activeCompanion.id,
          aiSuggestions: {
            empathyMessage: evalData.empathyMessage,
            suggestions: evalData.suggestions,
            assessment: {
              nuanceLabel: evalData.nuanceLabel,
              summaryInsight: evalData.summaryInsight,
            },
          },
          completedActions: nextCompleted,
        })
      );
      await markDailyHabit(user.id, "checkin");
    } catch {}
  };

  const handleEvaluate = async () => {
    if (!currentAnswer) {
      setError("Pick the option that fits closest first.");
      return;
    }

    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setError("");
    setEvaluating(true);

    try {
      const data = await api.assessMood(
        answers,
        note.trim(),
        new Date().getHours()
      );
      setResult(data);
      setCompletedTasks({});
      await syncToHomeCache(data, {});
    } catch (err) {
      setError(err?.message || "Could not evaluate right now. Please try again.");
    } finally {
      setEvaluating(false);
    }
  };

  const handleActionPress = (item) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    if (item.actionType === "breathe") {
      markDailyHabit(user?.id, "breathe");
      router.push({
        pathname: "/(tabs)/breathe",
        params: item.presetId ? { preset: item.presetId } : {},
      });
      return;
    }

    if (item.actionType === "chat") {
      router.push({
        pathname: "/(tabs)/chat",
        params: {
          starterPrompt:
            item.starterPrompt ||
            `I took the guided mood check-in and came up as ${result?.mood || "reflective"} (${result?.nuanceLabel || ""}).`,
        },
      });
      return;
    }

    setActiveTask(item);
    setTaskModalVisible(true);
  };

  const handleCompleteTask = async (task, reflectionText = "") => {
    const target = task || activeTask;
    if (!target) return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    if (reflectionText && result?.logId) {
      api.updateMoodNote(result.logId, reflectionText).catch(() => {});
    }

    const nextCompleted = {
      ...completedTasks,
      [target.id || target.title]: true,
    };
    setCompletedTasks(nextCompleted);
    await markDailyHabit(user?.id, "activity");
    await syncToHomeCache(result, nextCompleted);
    setTaskModalVisible(false);
  };

  const handleExploreInChat = async (task, reflectionText = "") => {
    if (reflectionText && result?.logId) {
      api.updateMoodNote(result.logId, reflectionText).catch(() => {});
    }
    const nextCompleted = {
      ...completedTasks,
      [task?.id || task?.title || "journal"]: true,
    };
    setCompletedTasks(nextCompleted);
    await markDailyHabit(user?.id, "activity");
    await syncToHomeCache(result, nextCompleted);
    setTaskModalVisible(false);
    router.push({
      pathname: "/(tabs)/chat",
      params: {
        starterPrompt:
          reflectionText ||
          task?.journalPrompt ||
          `I'm feeling ${result?.mood || "reflective"} right now.`,
      },
    });
  };

  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";
  const detectedMeta = MOOD_META[result?.mood] || MOOD_META.anxious;

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            triggerHaptic();
            if (!result && step > 0) {
              setStep((s) => s - 1);
            } else if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
          style={[
            styles.circleBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name={result ? "close" : "arrow-back"}
            size={19}
            color={colors.text}
          />
        </TouchableOpacity>

        <View style={styles.progressWrap}>
          <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
            {result
              ? "Your Mood Evaluation"
              : evaluating
              ? "Evaluating..."
              : `Question ${step + 1} of ${QUESTIONS.length}`}
          </Text>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: colors.surfaceElevated },
            ]}
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: result ? detectedMeta.accent : colors.primary,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
        </View>

        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {evaluating ? (
          <View style={styles.evaluatingBox}>
            <CompanionAvatar
              avatarId={user?.companionAvatar}
              size={84}
              isThinking
            />
            <Text style={[styles.evalTitle, { color: colors.text }]}>
              {activeCompanion.name} is reading your signals...
            </Text>
            <Text style={[styles.evalSub, { color: colors.textMuted }]}>
              Connecting your body state, thought pace, and energy to build your
              personalized reset.
            </Text>
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ marginTop: 14 }}
            />
          </View>
        ) : result ? (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 12) + 28 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Detected Mood Hero Card */}
            <Animated.View
              style={[
                styles.resultHero,
                {
                  backgroundColor: colors.surface,
                  borderColor: detectedMeta.accent + "55",
                  opacity: stepAnim,
                  transform: [
                    {
                      translateY: stepAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.resultTopRow}>
                <View
                  style={[
                    styles.resultMoodIcon,
                    { backgroundColor: detectedMeta.accent + "22" },
                  ]}
                >
                  <Ionicons
                    name={detectedMeta.icon}
                    size={26}
                    color={detectedMeta.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.resultEyebrow, { color: detectedMeta.accent }]}
                  >
                    DETECTED STATE • {result.intensity}/5 INTENSITY
                  </Text>
                  <Text style={[styles.resultMoodTitle, { color: colors.text }]}>
                    {detectedMeta.label} — {result.nuanceLabel}
                  </Text>
                </View>
              </View>

              <Text style={[styles.resultInsight, { color: colors.textMuted }]}>
                {result.summaryInsight}
              </Text>

              <View
                style={[
                  styles.companionNoteBox,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <CompanionAvatar avatarId={user?.companionAvatar} size={36} />
                <Text style={[styles.companionReply, { color: colors.text }]}>
                  {result.empathyMessage}
                </Text>
              </View>
            </Animated.View>

            {/* Direct AI Recommendations */}
            <Text style={[styles.recsHeading, { color: colors.text }]}>
              Recommended for right now
            </Text>

            <View style={styles.recsList}>
              {(result.suggestions || []).map((item, idx) => {
                const isDone = Boolean(completedTasks[item.id || item.title]);
                const itemColor =
                  item.actionType === "breathe"
                    ? colors.primary
                    : item.actionType === "chat"
                    ? colors.accent
                    : item.actionType === "micro_journal"
                    ? "#38BDF8"
                    : "#10B981";

                return (
                  <TouchableOpacity
                    key={item.id || idx}
                    onPress={() => handleActionPress(item)}
                    activeOpacity={0.82}
                    style={[
                      styles.recCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: isDone ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.recIconBox,
                        {
                          backgroundColor: isDone
                            ? colors.primary
                            : itemColor + "20",
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          isDone
                            ? "checkmark"
                            : item.actionType === "breathe"
                            ? "water-outline"
                            : item.actionType === "chat"
                            ? "chatbubble-ellipses-outline"
                            : item.actionType === "micro_journal"
                            ? "create-outline"
                            : "leaf-outline"
                        }
                        size={20}
                        color={isDone ? onPrimaryText : itemColor}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.recTitle,
                          {
                            color: colors.text,
                            textDecorationLine: isDone ? "line-through" : "none",
                          },
                        ]}
                      >
                        {item.title}
                      </Text>
                      <Text style={[styles.recReason, { color: colors.textMuted }]}>
                        {item.reason}
                      </Text>
                    </View>
                    <View style={styles.recRight}>
                      <Text style={[styles.recDuration, { color: itemColor }]}>
                        {isDone ? "Done" : item.duration}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.textMuted}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.resultActionsRow}>
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic();
                  setResult(null);
                  setStep(0);
                }}
                style={[styles.retakeBtn, { borderColor: colors.border }]}
              >
                <Ionicons
                  name="refresh-outline"
                  size={16}
                  color={colors.textMuted}
                />
                <Text style={[styles.retakeText, { color: colors.textMuted }]}>
                  Retake
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  triggerHaptic();
                  router.replace("/(tabs)");
                }}
                style={[
                  styles.doneHomeBtn,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={[styles.doneHomeText, { color: onPrimaryText }]}>
                  Save & Return Home
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Animated.View
                style={{
                  opacity: stepAnim,
                  transform: [
                    {
                      translateY: stepAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                }}
              >
                <Text style={[styles.qEyebrow, { color: colors.primary }]}>
                  {currentQuestion.eyebrow}
                </Text>
                <Text style={[styles.qTitle, { color: colors.text }]}>
                  {currentQuestion.prompt}
                </Text>
                <Text style={[styles.qSub, { color: colors.textMuted }]}>
                  {currentQuestion.subtitle}
                </Text>

                <View style={styles.optionsList}>
                  {currentQuestion.options.map((opt) => {
                    const selected = currentAnswer === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        onPress={() => handleSelectOption(opt.id)}
                        activeOpacity={0.82}
                        style={[
                          styles.optionCard,
                          {
                            backgroundColor: selected
                              ? colors.primary + "16"
                              : colors.surface,
                            borderColor: selected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.optionIcon,
                            {
                              backgroundColor: selected
                                ? colors.primary
                                : colors.surfaceElevated,
                            },
                          ]}
                        >
                          <Ionicons
                            name={opt.icon}
                            size={19}
                            color={selected ? onPrimaryText : colors.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.optionLabel, { color: colors.text }]}>
                            {opt.label}
                          </Text>
                          <Text
                            style={[styles.optionDesc, { color: colors.textMuted }]}
                          >
                            {opt.desc}
                          </Text>
                        </View>
                        {selected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={colors.primary}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {currentQuestion.allowNote && (
                  <View
                    style={[
                      styles.noteBox,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.noteInput, { color: colors.text }]}
                      placeholder="Optional: anything else on your mind?"
                      placeholderTextColor={colors.textMuted}
                      underlineColorAndroid="transparent"
                      multiline
                      value={note}
                      onChangeText={setNote}
                    />
                  </View>
                )}
              </Animated.View>
            </ScrollView>

            {/* Bottom Navigation */}
            <View
              style={[
                styles.footer,
                {
                  backgroundColor: colors.background,
                  borderTopColor: colors.border,
                  paddingBottom: Math.max(insets.bottom, 16),
                },
              ]}
            >
              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                onPress={() => {
                  if (step < QUESTIONS.length - 1) {
                    if (!currentAnswer) {
                      setError("Pick an option to continue.");
                      return;
                    }
                    triggerHaptic();
                    setStep((s) => s + 1);
                  } else {
                    handleEvaluate();
                  }
                }}
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor: currentAnswer
                      ? colors.primary
                      : colors.surfaceElevated,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.primaryBtnText,
                    { color: currentAnswer ? onPrimaryText : colors.textMuted },
                  ]}
                >
                  {step === QUESTIONS.length - 1
                    ? `Evaluate with ${activeCompanion.name}`
                    : "Next Question"}
                </Text>
                <Ionicons
                  name={
                    step === QUESTIONS.length - 1 ? "sparkles" : "arrow-forward"
                  }
                  size={18}
                  color={currentAnswer ? onPrimaryText : colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      <DynamicTaskModal
        visible={taskModalVisible}
        task={activeTask}
        onClose={() => setTaskModalVisible(false)}
        onComplete={handleCompleteTask}
        onExploreInChat={handleExploreInChat}
        companionName={activeCompanion.name}
        colors={colors}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 14,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  progressWrap: { flex: 1, gap: 6 },
  progressLabel: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  progressTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  qEyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.1 },
  qTitle: { fontSize: 25, fontWeight: "800", lineHeight: 31, marginTop: 6 },
  qSub: { fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 18 },
  optionsList: { gap: 10 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  optionLabel: { fontSize: 15, fontWeight: "700" },
  optionDesc: { fontSize: 12, marginTop: 2 },
  noteBox: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 74,
  },
  noteInput: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 54,
    textAlignVertical: "top",
    ...(Platform.OS === "web" ? { outlineStyle: "none", outlineWidth: 0 } : {}),
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { fontSize: 15, fontWeight: "700" },
  evaluatingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  evalTitle: { fontSize: 19, fontWeight: "800", textAlign: "center", marginTop: 18 },
  evalSub: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8 },
  resultHero: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 18,
    gap: 14,
    marginBottom: 22,
  },
  resultTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  resultMoodIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  resultEyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 0.7 },
  resultMoodTitle: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  resultInsight: { fontSize: 14, lineHeight: 21 },
  companionNoteBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  companionReply: { flex: 1, fontSize: 13.5, lineHeight: 19.5, fontWeight: "500" },
  recsHeading: { fontSize: 17, fontWeight: "800", marginBottom: 12 },
  recsList: { gap: 10, marginBottom: 22 },
  recCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  recIconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  recTitle: { fontSize: 14.5, fontWeight: "700" },
  recReason: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  recRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  recDuration: { fontSize: 12, fontWeight: "700" },
  resultActionsRow: { flexDirection: "row", gap: 10 },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  retakeText: { fontSize: 14, fontWeight: "600" },
  doneHomeBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  doneHomeText: { fontSize: 15, fontWeight: "700" },
});