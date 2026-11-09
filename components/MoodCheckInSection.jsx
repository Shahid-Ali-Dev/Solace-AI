// components/MoodCheckInSection.jsx
import React, { memo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import CompanionAvatar from "./CompanionAvatar";

export const MOODS = [
  { id: "peaceful", label: "Peaceful", icon: "sunny-outline", accent: "#2DD4BF" },
  { id: "anxious", label: "Anxious", icon: "pulse-outline", accent: "#F59E0B" },
  { id: "tired", label: "Tired", icon: "moon-outline", accent: "#818CF8" },
  { id: "overwhelmed", label: "Overwhelmed", icon: "cloud-outline", accent: "#A78BFA" },
  { id: "grateful", label: "Grateful", icon: "heart-outline", accent: "#FB7185" },
];

export const MOOD_MAP = MOODS.reduce((acc, m) => {
  acc[m.id] = m;
  return acc;
}, {});

export const getLocalFallbackSuggestions = (mood, companionName = "Lumi") => {
  const presets = {
    peaceful: {
      empathyMessage:
        "It's lovely when your mind finally gets a quiet window like this.",
      suggestions: [
        {
          id: "1",
          title: "Lock In This Calm",
          actionType: "micro_journal",
          duration: "1 min",
          reason: "Notice what made today feel steady so you can revisit it later.",
          journalPrompt: "What one small thing helped create this peaceful feeling?",
          quickChips: ["Quiet focus time", "Letting go of rush"],
          placeholder: "Write one line to remember...",
        },
        {
          id: "2",
          title: "2-Minute Savoring Pause",
          actionType: "guided_steps",
          duration: "2 mins",
          reason: "Let your body register safety instead of rushing to the next task.",
          timerSeconds: 60,
          steps: [
            "Drop your shoulders and soften your gaze.",
            "Notice one comforting detail right around you.",
            "Take 3 unhurried breaths without checking your phone.",
          ],
        },
        {
          id: "3",
          title: "Protect This Headspace",
          actionType: "chat",
          duration: "3 mins",
          reason: "Set one light boundary so this calm lasts into the rest of your day.",
          starterPrompt:
            "I'm feeling peaceful right now—help me protect this energy today.",
        },
      ],
    },
    grateful: {
      empathyMessage:
        "Holding onto moments of gratitude softens how heavy days feel later.",
      suggestions: [
        {
          id: "1",
          title: "Gratitude Snapshot",
          actionType: "micro_journal",
          duration: "1 min",
          reason: "Naming a specific detail makes positive feelings stick longer.",
          journalPrompt: "Who or what made today feel a little lighter?",
          quickChips: ["A quiet win today", "Someone who showed up"],
          placeholder: "Capture one specific moment...",
        },
        {
          id: "2",
          title: "Warmth & Posture Check",
          actionType: "guided_steps",
          duration: "1 min",
          reason: "Anchor the feeling physically so it stays with you.",
          timerSeconds: 45,
          steps: [
            "Rest one hand gently over your chest or stomach.",
            "Recall the exact moment you feel thankful for.",
            "Smile slightly and exhale slowly for 5 seconds.",
          ],
        },
        {
          id: "3",
          title: `Share a Win with ${companionName}`,
          actionType: "chat",
          duration: "2 mins",
          reason: "Celebrate small progress without downplaying it.",
          starterPrompt: "I'm feeling grateful today and want to savor a small win.",
        },
      ],
    },
    tired: {
      empathyMessage:
        "Running on low battery makes everything look harder than it actually is.",
      suggestions: [
        {
          id: "1",
          title: "20-20-20 Eye & Neck Soften",
          actionType: "guided_steps",
          duration: "1 min",
          reason: "Relieve screen fatigue and upper-shoulder tension fast.",
          timerSeconds: 45,
          steps: [
            "Look away from the screen at something 20 feet away.",
            "Roll both shoulders slowly back 4 times.",
            "Let your jaw unclench and take one loose sigh.",
          ],
        },
        {
          id: "2",
          title: "4-7-8 Deep Wind-Down",
          actionType: "breathe",
          presetId: "calm_478",
          duration: "2 mins",
          reason: "Longer exhales signal your nervous system it can power down.",
        },
        {
          id: "3",
          title: "Drop One Non-Essential",
          actionType: "micro_journal",
          duration: "1 min",
          reason: "Freeing mental bandwidth restores energy faster than pushing through.",
          journalPrompt: "What's one thing you can postpone to tomorrow guilt-free?",
          quickChips: ["Low-priority chores", "Late-night scrolling"],
          placeholder: "Name one thing to take off your plate...",
        },
      ],
    },
    anxious: {
      empathyMessage:
        "That buzzing edge is uncomfortable, so let's bring the volume down one notch.",
      suggestions: [
        {
          id: "1",
          title: "Physiological Sigh",
          actionType: "breathe",
          presetId: "sigh",
          duration: "2 mins",
          reason: "Two quick inhales and a long exhale offload CO2 and slow heart rate.",
        },
        {
          id: "2",
          title: "Name the Loudest Worry",
          actionType: "micro_journal",
          duration: "2 mins",
          reason: "Putting a vague worry into plain words shrinks its grip.",
          journalPrompt: "What single thought is looping loudest right now?",
          quickChips: ["Worried about an outcome", "Too many things at once"],
          placeholder: "Write the worry in one honest sentence...",
        },
        {
          id: "3",
          title: "Cold Surface & Jaw Reset",
          actionType: "guided_steps",
          duration: "1 min",
          reason: "Physical temperature shifts interrupt spiraling thoughts.",
          timerSeconds: 45,
          steps: [
            "Touch something cool (a glass, wall, or splash cool water).",
            "Drop your tongue from the roof of your mouth.",
            "Name 3 steady objects in your line of sight.",
          ],
        },
      ],
    },
    overwhelmed: {
      empathyMessage:
        "You don't have to untangle everything right now—just the next five minutes.",
      suggestions: [
        {
          id: "1",
          title: "Single-Line Brain Dump",
          actionType: "micro_journal",
          duration: "2 mins",
          reason: "Getting clutter out of your head frees up working memory immediately.",
          journalPrompt: "What's the #1 thing crowding your mind right now?",
          quickChips: ["Deadline pressure", "Need a clear first step"],
          placeholder: "Dump it here—just one or two lines...",
        },
        {
          id: "2",
          title: "Physiological Sigh",
          actionType: "breathe",
          presetId: "sigh",
          duration: "2 mins",
          reason: "Rapidly resets an overstimulated nervous system.",
        },
        {
          id: "3",
          title: `Sort It Out with ${companionName}`,
          actionType: "chat",
          duration: "3 mins",
          reason: "Pick one tiny next step together instead of carrying it all.",
          starterPrompt:
            "I feel overwhelmed—help me shrink everything down to one next step.",
        },
      ],
    },
  };

  return presets[mood] || presets.anxious;
};

const MoodCheckInSection = memo(function MoodCheckInSection({
  colors,
  isDark,
  activeCompanion,
  companionAvatarId,
  selectedMood,
  moodIntensity,
  moodNote,
  aiSuggestions,
  loadingSuggestions,
  completedActions,
  highlightSignal,
  onSelectMood,
  onSelectIntensity,
  onNoteCommit,
  onSubmitNote,
  onRefreshSuggestions,
  onPressSuggestion,
  onOpenQuiz,
}) {
  const [noteDraft, setNoteDraft] = useState(moodNote || "");
  const [isNoteFocused, setIsNoteFocused] = useState(false);

  const suggestionsAnim = useRef(new Animated.Value(0)).current;
  const focusPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setNoteDraft(moodNote || "");
  }, [moodNote]);

  useEffect(() => {
    if (!aiSuggestions) return;
    suggestionsAnim.setValue(0);
    Animated.timing(suggestionsAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [aiSuggestions]);

  useEffect(() => {
    if (!highlightSignal) return;
    focusPulse.setValue(0);
    Animated.sequence([
      Animated.timing(focusPulse, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(focusPulse, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [highlightSignal]);

  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";
  const activeMoodMeta = MOOD_MAP[selectedMood];

  const completedCount = aiSuggestions?.suggestions
    ? aiSuggestions.suggestions.filter(
        (s) => completedActions[s.id || s.title]
      ).length
    : 0;

  const handleNoteSend = () => {
    const trimmed = noteDraft.trim();
    if (!trimmed || loadingSuggestions) return;
    onSubmitNote(trimmed);
  };

  return (
    <Animated.View
      style={{
        transform: [
          {
            scale: focusPulse.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.015],
            }),
          },
        ],
      }}
    >
      {/* Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          How are you feeling right now?
        </Text>
        {activeMoodMeta && (
          <Text style={[styles.sectionMeta, { color: activeMoodMeta.accent }]}>
            {activeMoodMeta.label}
          </Text>
        )}
      </View>

      {/* Mood Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.moodRow}
      >
        {MOODS.map((m) => {
          const isSelected = selectedMood === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              onPress={() => onSelectMood(m.id)}
              activeOpacity={0.8}
              style={[
                styles.moodCard,
                {
                  backgroundColor: isSelected ? m.accent + "20" : colors.surface,
                  borderColor: isSelected ? m.accent : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.moodIconCircle,
                  { backgroundColor: isSelected ? m.accent : m.accent + "1A" },
                ]}
              >
                <Ionicons
                  name={m.icon}
                  size={20}
                  color={isSelected ? (isDark ? "#0B0F17" : "#FFFFFF") : m.accent}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.moodLabel,
                  {
                    color: isSelected ? colors.text : colors.textMuted,
                    fontWeight: isSelected ? "700" : "600",
                  },
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Guided Assessment Launcher */}
      <TouchableOpacity
        onPress={() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
          onOpenQuiz();
        }}
        activeOpacity={0.82}
        style={[
          styles.quizCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.accent + "45",
          },
        ]}
      >
        <View
          style={[
            styles.quizIconWrap,
            { backgroundColor: colors.accent + "1E" },
          ]}
        >
          <Ionicons name="help-buoy-outline" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.quizTitle, { color: colors.text }]}>
            Not sure what you're feeling?
          </Text>
          <Text style={[styles.quizSub, { color: colors.textMuted }]}>
            Answer 4 quick questions for a tailored AI reset
          </Text>
        </View>
        <View
          style={[styles.quizBadge, { backgroundColor: colors.accent + "1C" }]}
        >
          <Text style={[styles.quizBadgeText, { color: colors.accent }]}>
            30s
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.accent} />
        </View>
      </TouchableOpacity>

      {/* Intensity & Context Note */}
      {selectedMood && (
        <>
          <View style={styles.intensityRow}>
            <Text style={[styles.intensityLabel, { color: colors.textMuted }]}>
              Intensity
            </Text>
            <View style={styles.intensityPills}>
              {[1, 2, 3, 4, 5].map((lvl) => {
                const active = moodIntensity === lvl;
                return (
                  <TouchableOpacity
                    key={lvl}
                    onPress={() => onSelectIntensity(lvl)}
                    activeOpacity={0.8}
                    style={[
                      styles.intensityPill,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.intensityPillText,
                        { color: active ? onPrimaryText : colors.textMuted },
                      ]}
                    >
                      {lvl}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View
            style={[
              styles.noteContainer,
              {
                backgroundColor: colors.surface,
                borderColor: isNoteFocused
                  ? colors.primary + "80"
                  : colors.border,
              },
            ]}
          >
            <TextInput
              style={[styles.noteInput, { color: colors.text }]}
              placeholder={`What's making you feel ${selectedMood}?`}
              placeholderTextColor={colors.textMuted}
              value={noteDraft}
              onChangeText={setNoteDraft}
              onFocus={() => setIsNoteFocused(true)}
              onBlur={() => {
                setIsNoteFocused(false);
                onNoteCommit?.(noteDraft);
              }}
              underlineColorAndroid="transparent"
              returnKeyType="send"
              onSubmitEditing={handleNoteSend}
            />
            {loadingSuggestions ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginLeft: 8 }}
              />
            ) : (
              <TouchableOpacity
                onPress={handleNoteSend}
                disabled={!noteDraft.trim()}
                style={[
                  styles.sendNoteBtn,
                  {
                    backgroundColor: noteDraft.trim()
                      ? colors.primary
                      : colors.surfaceElevated,
                  },
                ]}
              >
                <Ionicons
                  name="arrow-up"
                  size={16}
                  color={noteDraft.trim() ? onPrimaryText : colors.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* Personalized Companion Suggestions */}
      {aiSuggestions && (
        <Animated.View
          style={[
            styles.aiPanel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: suggestionsAnim,
              transform: [
                {
                  translateY: suggestionsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={{ opacity: loadingSuggestions ? 0.6 : 1 }}>
            <View style={styles.aiPanelHeader}>
              <CompanionAvatar
                avatarId={companionAvatarId}
                size={36}
                isThinking={loadingSuggestions}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.aiPanelTitle, { color: colors.text }]}>
                  {activeCompanion.name} suggests
                </Text>
                <Text style={[styles.aiPanelSub, { color: colors.textMuted }]}>
                  {loadingSuggestions
                    ? `Updating for ${selectedMood}...`
                    : aiSuggestions?.assessment?.nuanceLabel ||
                      "Tailored to how you feel"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => onRefreshSuggestions(noteDraft.trim())}
                disabled={loadingSuggestions}
                accessibilityLabel="Refresh suggestions"
                style={[
                  styles.refreshSmallBtn,
                  { backgroundColor: colors.surfaceElevated },
                ]}
              >
                {loadingSuggestions ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name="refresh-outline"
                    size={15}
                    color={colors.textMuted}
                  />
                )}
              </TouchableOpacity>

              <View
                style={[
                  styles.progressPill,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Text style={[styles.progressPillText, { color: colors.primary }]}>
                  {completedCount}/{aiSuggestions.suggestions.length}
                </Text>
              </View>
            </View>

            <Text style={[styles.empathyMessage, { color: colors.text }]}>
              {aiSuggestions.empathyMessage}
            </Text>

            <View style={styles.suggestionList}>
              {aiSuggestions.suggestions.map((item, idx) => {
                const actionKey = item.id || item.title;
                const isDone = Boolean(completedActions[actionKey]);
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
                    onPress={() => onPressSuggestion(item)}
                    activeOpacity={0.8}
                    style={[
                      styles.suggestionItem,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: isDone ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.suggestionLeft}>
                      <View
                        style={[
                          styles.actionIconBox,
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
                          size={18}
                          color={isDone ? onPrimaryText : itemColor}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.suggestionTitle,
                            {
                              color: colors.text,
                              textDecorationLine: isDone
                                ? "line-through"
                                : "none",
                              opacity: isDone ? 0.65 : 1,
                            },
                          ]}
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={[
                            styles.suggestionReason,
                            { color: colors.textMuted },
                          ]}
                        >
                          {item.reason}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.suggestionRight}>
                      <Text style={[styles.durationBadge, { color: itemColor }]}>
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
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
});

export default MoodCheckInSection;

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", flex: 1 },
  sectionMeta: { fontSize: 13, fontWeight: "700" },
  moodRow: { flexDirection: "row", gap: 10, paddingVertical: 2 },
  moodCard: {
    width: 92,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 8,
  },
  moodIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  moodLabel: { fontSize: 12 },
  quizCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 12,
  },
  quizIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  quizTitle: { fontSize: 13.5, fontWeight: "700" },
  quizSub: { fontSize: 11.5, marginTop: 1 },
  quizBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 11,
  },
  quizBadgeText: { fontSize: 11.5, fontWeight: "700" },
  intensityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 2,
  },
  intensityLabel: { fontSize: 12, fontWeight: "600" },
  intensityPills: { flexDirection: "row", gap: 6 },
  intensityPill: {
    width: 30,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  intensityPillText: { fontSize: 12, fontWeight: "700" },
  noteContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 10,
  },
  noteInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
    ...(Platform.OS === "web" ? { outlineStyle: "none", outlineWidth: 0 } : {}),
  },
  sendNoteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  aiPanel: {
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 16,
  },
  aiPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  aiPanelTitle: { fontSize: 15, fontWeight: "700" },
  aiPanelSub: { fontSize: 12, marginTop: 1 },
  refreshSmallBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  progressPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressPillText: { fontSize: 12, fontWeight: "700" },
  empathyMessage: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    marginBottom: 14,
  },
  suggestionList: { gap: 10 },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  suggestionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  suggestionTitle: { fontSize: 14, fontWeight: "600" },
  suggestionReason: { fontSize: 12, marginTop: 2 },
  suggestionRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  durationBadge: { fontSize: 12, fontWeight: "700" },
});