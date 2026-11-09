// components/DynamicTaskModal.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const formatClock = (totalSec = 0) => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

export default function DynamicTaskModal({
  visible,
  task,
  onClose,
  onComplete,
  onExploreInChat,
  companionName = "Lumi",
  colors,
  isDark,
}) {
  const [checkedSteps, setCheckedSteps] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [reflectionText, setReflectionText] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);

  const isJournal = task?.actionType === "micro_journal";
  const steps = Array.isArray(task?.steps) ? task.steps : [];
  const totalSeconds =
    Number(task?.timerSeconds) > 0 ? Number(task?.timerSeconds) : null;
  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";

  // Reset modal internal state cleanly when opened for a task
  useEffect(() => {
    if (visible && task) {
      setCheckedSteps({});
      setTimerRunning(false);
      setSecondsLeft(totalSeconds);
      setReflectionText("");
      setIsInputFocused(false);
    }
  }, [visible, task, totalSeconds]);

  useEffect(() => {
    if (!visible || !timerRunning) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [visible, timerRunning]);

  useEffect(() => {
    if (visible && timerRunning && secondsLeft === 0) {
      setTimerRunning(false);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
  }, [visible, timerRunning, secondsLeft]);

  const toggleStep = (idx) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setCheckedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleTimer = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (secondsLeft === 0 && totalSeconds) {
      setSecondsLeft(totalSeconds);
      setTimerRunning(true);
    } else {
      setTimerRunning((prev) => !prev);
    }
  };

  const handleChipTap = (chip) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setReflectionText((prev) =>
      prev.trim() ? `${prev.trim()} — ${chip}` : `${chip}: `
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.modalCard,
            {
              backgroundColor:
                colors.modalSurface || (isDark ? "#141B29" : "#FFFFFF"),
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <View
            style={[
              styles.modalIcon,
              {
                backgroundColor:
                  (isJournal ? colors.accent : colors.primary) + "20",
              },
            ]}
          >
            <Ionicons
              name={isJournal ? "create-outline" : "leaf-outline"}
              size={26}
              color={isJournal ? colors.accent : colors.primary}
            />
          </View>

          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {task?.title}
          </Text>
          <Text style={[styles.modalDuration, { color: colors.primary }]}>
            {task?.duration} • {isJournal ? "Quick Reflection" : "Guided Practice"}
          </Text>
          <Text style={[styles.modalReason, { color: colors.textMuted }]}>
            {task?.reason}
          </Text>

          {isJournal ? (
            <View style={styles.bodySection}>
              <Text style={[styles.journalPromptText, { color: colors.text }]}>
                {task?.journalPrompt || "What's sitting on your mind right now?"}
              </Text>

              {Array.isArray(task?.quickChips) && task.quickChips.length > 0 && (
                <View style={styles.quickChipsRow}>
                  {task.quickChips.map((chip, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => handleChipTap(chip)}
                      style={[
                        styles.quickChip,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickChipText,
                          { color: colors.textMuted },
                        ]}
                      >
                        + {chip}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View
                style={[
                  styles.journalInputBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isInputFocused
                      ? colors.primary + "80"
                      : colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[styles.journalInput, { color: colors.text }]}
                  placeholder={
                    task?.placeholder || "Write 1 or 2 honest lines..."
                  }
                  placeholderTextColor={colors.textMuted}
                  value={reflectionText}
                  onChangeText={setReflectionText}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  underlineColorAndroid="transparent"
                  multiline
                />
              </View>

              <TouchableOpacity
                onPress={() => onComplete(task, reflectionText.trim())}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modalBtnText, { color: onPrimaryText }]}>
                  {reflectionText.trim() ? "Save Reflection" : "Mark Complete"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  onExploreInChat?.(task, reflectionText.trim())
                }
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={16}
                  color={colors.primary}
                />
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                  Explore this with {companionName}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.bodySection}>
              {totalSeconds !== null && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={toggleTimer}
                  style={[
                    styles.timerBar,
                    {
                      backgroundColor: timerRunning
                        ? colors.primary + "22"
                        : colors.surface,
                      borderColor: timerRunning
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                >
                  <View style={styles.timerLeft}>
                    <Ionicons
                      name={
                        secondsLeft === 0
                          ? "checkmark-circle"
                          : timerRunning
                          ? "pause-circle"
                          : "play-circle"
                      }
                      size={22}
                      color={colors.primary}
                    />
                    <Text style={[styles.timerLabel, { color: colors.text }]}>
                      {secondsLeft === 0
                        ? "Timer finished — nice pause"
                        : timerRunning
                        ? "Breathe gently..."
                        : "Start guided timer"}
                    </Text>
                  </View>
                  <Text style={[styles.timerClock, { color: colors.primary }]}>
                    {formatClock(secondsLeft ?? totalSeconds)}
                  </Text>
                </TouchableOpacity>
              )}

              {steps.length > 0 && (
                <View
                  style={[
                    styles.stepsBox,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {steps.map((step, i) => {
                    const done = Boolean(checkedSteps[i]);
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => toggleStep(i)}
                        activeOpacity={0.75}
                        style={styles.stepRow}
                      >
                        <View
                          style={[
                            styles.stepNum,
                            {
                              backgroundColor: done
                                ? colors.primary
                                : colors.primary + "22",
                            },
                          ]}
                        >
                          {done ? (
                            <Ionicons
                              name="checkmark"
                              size={13}
                              color={onPrimaryText}
                            />
                          ) : (
                            <Text
                              style={[
                                styles.stepNumText,
                                { color: colors.primary },
                              ]}
                            >
                              {i + 1}
                            </Text>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.stepText,
                            {
                              color: colors.text,
                              textDecorationLine: done ? "line-through" : "none",
                              opacity: done ? 0.55 : 1,
                            },
                          ]}
                        >
                          {step}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                onPress={() => onComplete(task, "")}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modalBtnText, { color: onPrimaryText }]}>
                  Mark Complete
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 14,
  },
  modalCloseBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
  },
  modalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 4,
  },
  modalTitle: { fontSize: 19, fontWeight: "700", textAlign: "center" },
  modalDuration: { fontSize: 12, fontWeight: "700", marginTop: 4, marginBottom: 8 },
  modalReason: { fontSize: 13, lineHeight: 19, textAlign: "center", marginBottom: 16 },
  bodySection: { width: "100%" },
  journalPromptText: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    marginBottom: 10,
  },
  quickChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  quickChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickChipText: { fontSize: 12, fontWeight: "500" },
  journalInputBox: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 84,
    marginBottom: 16,
  },
  journalInput: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 62,
    textAlignVertical: "top",
    ...(Platform.OS === "web" ? { outlineStyle: "none", outlineWidth: 0 } : {}),
  },
  timerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  timerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  timerLabel: { fontSize: 13, fontWeight: "600" },
  timerClock: { fontSize: 15, fontWeight: "800" },
  stepsBox: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 11,
    marginBottom: 18,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumText: { fontSize: 11, fontWeight: "700" },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19 },
  modalBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 20,
    width: "100%",
    alignItems: "center",
  },
  modalBtnText: { fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: "600" },
});