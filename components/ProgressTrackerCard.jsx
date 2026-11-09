// components/ProgressTrackerCard.jsx
import React, { memo, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Modal,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { MOOD_MAP } from "./MoodCheckInSection";

const getWeekdayLabel = (dateKey) => {
  if (!dateKey) return "";
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1);
};

const formatHistoryDate = (dateInput) => {
  try {
    const dt = new Date(dateInput);
    return dt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const ProgressTrackerCard = memo(function ProgressTrackerCard({
  colors,
  bottomInset = 20,
  moodSummary,
  habitProgress,
  highlightSignal,
  historyVisible,
  historyItems,
  loadingHistory,
  onOpenHistory,
  onCloseHistory,
  onConfirmDeleteLog,
  onPressHabit,
}) {
  const habitBarAnim = useRef(new Animated.Value(0)).current;
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(habitBarAnim, {
      toValue: habitProgress?.ratio || 0,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [habitProgress?.ratio]);

  useEffect(() => {
    if (!highlightSignal) return;
    focusAnim.setValue(0);
    Animated.sequence([
      Animated.timing(focusAnim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: false,
      }),
      Animated.timing(focusAnim, {
        toValue: 0,
        duration: 520,
        useNativeDriver: false,
      }),
    ]).start();
  }, [highlightSignal]);

  const moodStreak = moodSummary?.currentStreak || 0;
  const bestStreak = moodSummary?.longestStreak || 0;
  const totalCheckIns = moodSummary?.totalCheckIns || 0;
  const avgIntensity = moodSummary?.averageIntensity7d;
  const last7Days = Array.isArray(moodSummary?.last7Days)
    ? moodSummary.last7Days
    : [];

  const pillars = [
    {
      id: "checkin",
      label: "Check-in",
      icon: "sunny-outline",
      done: Boolean(habitProgress?.checkin),
      accent: colors.primary,
    },
    {
      id: "activity",
      label: "Reset Task",
      icon: "leaf-outline",
      done: Boolean(habitProgress?.activity),
      accent: "#10B981",
    },
    {
      id: "breathe",
      label: "Breathe",
      icon: "water-outline",
      done: Boolean(habitProgress?.breathe),
      accent: "#38BDF8",
    },
    {
      id: "chat",
      label: "Chat",
      icon: "chatbubble-ellipses-outline",
      done: Boolean(habitProgress?.chat),
      accent: colors.accent,
    },
  ];

  const animatedBorderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <>
      <View style={[styles.sectionHeaderRow, { marginTop: 26 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Your Progress
        </Text>
        <TouchableOpacity onPress={onOpenHistory} style={styles.viewLogBtn}>
          <Text style={[styles.viewLogText, { color: colors.primary }]}>
            Mood History
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.trackerCard,
          {
            backgroundColor: colors.surface,
            borderColor: animatedBorderColor,
          },
        ]}
      >
        {/* Top Stats Row */}
        <View style={styles.statsRow}>
          <View
            style={[styles.statBox, { backgroundColor: colors.surfaceElevated }]}
          >
            <View style={styles.statValRow}>
              <Ionicons name="flame" size={16} color="#F59E0B" />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {moodStreak}d
              </Text>
            </View>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Streak
            </Text>
          </View>

          <View
            style={[styles.statBox, { backgroundColor: colors.surfaceElevated }]}
          >
            <View style={styles.statValRow}>
              <Ionicons
                name="trophy-outline"
                size={15}
                color={colors.primary}
              />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {bestStreak}d
              </Text>
            </View>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Best
            </Text>
          </View>

          <View
            style={[styles.statBox, { backgroundColor: colors.surfaceElevated }]}
          >
            <View style={styles.statValRow}>
              <Ionicons
                name="calendar-outline"
                size={15}
                color={colors.accent}
              />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {totalCheckIns}
              </Text>
            </View>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Check-ins
            </Text>
          </View>
        </View>

        {/* Daily Wellness Rhythm (Clickable 4-Pillar Grid) */}
        <View style={styles.dailyRhythmSection}>
          <View style={styles.dailyRhythmHeader}>
            <Text style={[styles.dailyRhythmTitle, { color: colors.text }]}>
              Today's Wellness Rhythm
            </Text>
            <Text style={[styles.dailyRhythmCount, { color: colors.primary }]}>
              {habitProgress?.completedCount || 0}/{habitProgress?.totalCount || 4}{" "}
              complete
            </Text>
          </View>

          <View
            style={[
              styles.dailyBarTrack,
              { backgroundColor: colors.surfaceElevated },
            ]}
          >
            <Animated.View
              style={[
                styles.dailyBarFill,
                {
                  backgroundColor: colors.primary,
                  width: habitBarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>

          <View style={styles.habitGrid}>
            {pillars.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  onPressHabit(p.id);
                }}
                activeOpacity={0.78}
                accessibilityLabel={`${p.label}, ${p.done ? "completed" : "tap to start"}`}
                style={[
                  styles.habitTile,
                  {
                    backgroundColor: p.done
                      ? p.accent + "1A"
                      : colors.surfaceElevated,
                    borderColor: p.done ? p.accent + "65" : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={p.done ? "checkmark-circle" : p.icon}
                  size={15}
                  color={p.done ? p.accent : colors.textMuted}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.habitTileLabel,
                    { color: p.done ? colors.text : colors.textMuted },
                  ]}
                >
                  {p.label}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={13}
                  color={p.done ? p.accent : colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 7-Day Emotional Pulse Timeline */}
        {last7Days.length > 0 && (
          <View style={[styles.weekSection, { borderTopColor: colors.border }]}>
            <View style={styles.weekHeader}>
              <Text style={[styles.weekTitle, { color: colors.textMuted }]}>
                Last 7 Days
              </Text>
              {avgIntensity !== null && avgIntensity !== undefined && (
                <Text style={[styles.weekMeta, { color: colors.textMuted }]}>
                  Avg intensity {avgIntensity}/5
                </Text>
              )}
            </View>

            <View style={styles.weekDotsRow}>
              {last7Days.map((day, idx) => {
                const meta = day.mood ? MOOD_MAP[day.mood] : null;
                const isToday = idx === last7Days.length - 1;
                return (
                  <View key={day.date} style={styles.weekDayCol}>
                    <View
                      style={[
                        styles.weekDot,
                        {
                          backgroundColor: meta
                            ? meta.accent + "26"
                            : "transparent",
                          borderColor: meta
                            ? meta.accent
                            : isToday
                            ? colors.primary + "60"
                            : colors.border,
                          borderStyle: meta ? "solid" : "dashed",
                        },
                      ]}
                    >
                      {meta ? (
                        <Ionicons
                          name={meta.icon}
                          size={14}
                          color={meta.accent}
                        />
                      ) : (
                        <View
                          style={[
                            styles.emptyInnerDot,
                            { backgroundColor: colors.border },
                          ]}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.weekDayText,
                        {
                          color: isToday ? colors.primary : colors.textMuted,
                          fontWeight: isToday ? "700" : "500",
                        },
                      ]}
                    >
                      {getWeekdayLabel(day.date)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </Animated.View>

      {/* Mood History Modal */}
      <Modal
        visible={historyVisible}
        transparent
        animationType="slide"
        onRequestClose={onCloseHistory}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                paddingBottom: bottomInset,
              },
            ]}
          >
            <View
              style={[styles.modalHeader, { borderBottomColor: colors.border }]}
            >
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Mood History
                </Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                  Your recent check-ins & assessments
                </Text>
              </View>
              <TouchableOpacity
                onPress={onCloseHistory}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <View style={styles.modalEmpty}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : historyItems.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons
                  name="calendar-outline"
                  size={32}
                  color={colors.textMuted}
                />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No mood check-ins recorded yet.
                </Text>
              </View>
            ) : (
              <FlatList
                data={historyItems}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, gap: 10 }}
                renderItem={({ item }) => {
                  const meta = MOOD_MAP[item.mood] || {
                    label: item.mood,
                    icon: "leaf-outline",
                    accent: colors.primary,
                  };
                  return (
                    <View
                      style={[
                        styles.historyRow,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.historyIcon,
                          { backgroundColor: meta.accent + "20" },
                        ]}
                      >
                        <Ionicons
                          name={meta.icon}
                          size={18}
                          color={meta.accent}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.historyTopLine}>
                          <Text
                            style={[styles.historyMood, { color: colors.text }]}
                          >
                            {meta.label}
                          </Text>
                          <Text
                            style={[
                              styles.historyIntensity,
                              { color: meta.accent },
                            ]}
                          >
                            {item.intensity || 3}/5
                          </Text>
                          <Text
                            style={[
                              styles.historyDate,
                              { color: colors.textMuted },
                            ]}
                          >
                            {formatHistoryDate(item.createdAt)}
                          </Text>
                        </View>
                        {!!item.note && (
                          <Text
                            numberOfLines={2}
                            style={[
                              styles.historyNote,
                              { color: colors.textMuted },
                            ]}
                          >
                            {item.note}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => onConfirmDeleteLog(item.id)}
                        style={{ padding: 6 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={17}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
});

export default ProgressTrackerCard;

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", flex: 1 },
  viewLogBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewLogText: { fontSize: 13, fontWeight: "700" },
  trackerCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 16,
    gap: 16,
  },
  statsRow: { flexDirection: "row", gap: 10 },
  statBox: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 3,
  },
  statValRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statValue: { fontSize: 17, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "600" },
  dailyRhythmSection: { gap: 9 },
  dailyRhythmHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dailyRhythmTitle: { fontSize: 13.5, fontWeight: "700" },
  dailyRhythmCount: { fontSize: 12.5, fontWeight: "700" },
  dailyBarTrack: { height: 7, borderRadius: 4, overflow: "hidden" },
  dailyBarFill: { height: "100%", borderRadius: 4 },
  habitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  habitTile: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1,
  },
  habitTileLabel: { flex: 1, fontSize: 12.5, fontWeight: "600" },
  weekSection: { borderTopWidth: 1, paddingTop: 14, gap: 10 },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weekTitle: { fontSize: 12, fontWeight: "700" },
  weekMeta: { fontSize: 11.5, fontWeight: "600" },
  weekDotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weekDayCol: { alignItems: "center", gap: 5 },
  weekDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyInnerDot: { width: 5, height: 5, borderRadius: 2.5 },
  weekDayText: { fontSize: 11 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "75%",
    minHeight: "42%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalSub: { fontSize: 12, marginTop: 2 },
  modalEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 10,
  },
  emptyText: { fontSize: 14 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  historyTopLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  historyMood: { fontSize: 14, fontWeight: "700", textTransform: "capitalize" },
  historyIntensity: { fontSize: 12, fontWeight: "700" },
  historyDate: { fontSize: 11 },
  historyNote: { fontSize: 12.5, lineHeight: 17, marginTop: 3 },
});