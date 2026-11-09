// app/(tabs)/index.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import CompanionAvatar from "../../components/CompanionAvatar";
import { getCompanionById } from "../../constants/companions";
import DailyReflectionCard from "../../components/DailyReflectionCard";
import DynamicTaskModal from "../../components/DynamicTaskModal";

const LOGO_URL =
  "https://res.cloudinary.com/dru5oqalj/image/upload/v1793887328/1a8b5e2d-5030-440f-9a91-8b76fcf3a917__1_-Photoroom_ukmqzz.png";

const MOODS = [
  { id: "peaceful", label: "Peaceful", icon: "sunny-outline", accent: "#2DD4BF" },
  { id: "anxious", label: "Anxious", icon: "pulse-outline", accent: "#F59E0B" },
  { id: "tired", label: "Tired", icon: "moon-outline", accent: "#818CF8" },
  { id: "overwhelmed", label: "Overwhelmed", icon: "cloud-outline", accent: "#A78BFA" },
  { id: "grateful", label: "Grateful", icon: "heart-outline", accent: "#FB7185" },
];

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

const getLocalFallbackSuggestions = (mood, companionName = "Lumi") => {
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

export default function DashboardScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, loading: authLoading, loginAsGuest } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeCompanion = getCompanionById(user?.companionAvatar);

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [selectedMood, setSelectedMood] = useState(null);
  const [currentMoodLogId, setCurrentMoodLogId] = useState(null);
  const [moodNote, setMoodNote] = useState("");
  const [isNoteFocused, setIsNoteFocused] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [activeQuickAction, setActiveQuickAction] = useState(null);
  const [quickActionVisible, setQuickActionVisible] = useState(false);
  const [completedActions, setCompletedActions] = useState({});

  const [affirmation, setAffirmation] = useState(
    "You do not have to carry everything all at once."
  );
  const [loadingAffirmation, setLoadingAffirmation] = useState(false);

  const initializedRef = useRef(false);
  const suggestionsCacheRef = useRef({});
  const suggestionsAnim = useRef(new Animated.Value(0)).current;

  const openQuickAction = (action) => {
    setActiveQuickAction(action);
    setQuickActionVisible(true);
  };

  const closeQuickAction = () => {
    setQuickActionVisible(false);
  };

  useEffect(() => {
    if (authLoading || initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      if (!user) {
        await loginAsGuest();
      }
      await loadAffirmation();
    })();
  }, [authLoading, user]);

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

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const loadAffirmation = async (withHaptic = false) => {
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
  };

  const handleMoodSelect = async (
    mood,
    isNoteUpdate = false,
    forceRefresh = false
  ) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const isSwitchingMood = !isNoteUpdate && mood !== selectedMood;
    const noteToSend = isSwitchingMood ? "" : moodNote.trim();
    const cacheKey = `${user?.id || "guest"}::${activeCompanion.id}::${mood}::${noteToSend.toLowerCase()}`;
    const logIdToPass =
      isNoteUpdate && mood === selectedMood ? currentMoodLogId : null;

    if (!isNoteUpdate) {
      setSelectedMood(mood);
      setCurrentMoodLogId(null);
      setCompletedActions({});
      if (isSwitchingMood) {
        setMoodNote("");
      }
    }

    // Serve cached mood suggestions on repeat taps unless user updates note or taps Refresh
    if (!forceRefresh && !isNoteUpdate && suggestionsCacheRef.current[cacheKey]) {
      const cached = suggestionsCacheRef.current[cacheKey];
      setAiSuggestions(cached);
      if (cached?.logId) setCurrentMoodLogId(cached.logId);

      api
        .logMood(mood, 3, noteToSend)
        .then((saved) => {
          if (saved?.id) setCurrentMoodLogId(saved.id);
        })
        .catch(() => {});
      return;
    }

    setLoadingSuggestions(true);

    try {
      const data = await api.analyzeMoodAndSuggest(
        mood,
        noteToSend,
        logIdToPass,
        new Date().getHours()
      );
      if (data?.logId) {
        setCurrentMoodLogId(data.logId);
      }
      suggestionsCacheRef.current[cacheKey] = data;
      setAiSuggestions(data);
    } catch {
      setAiSuggestions(getLocalFallbackSuggestions(mood, activeCompanion.name));
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSuggestionAction = (suggestion) => {
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
      openQuickAction(suggestion);
    }
  };

  const persistReflectionNote = async (text) => {
    if (!text) return;
    try {
      if (currentMoodLogId) {
        await api.updateMoodNote(currentMoodLogId, text);
      } else {
        const saved = await api.logMood(selectedMood || "reflective", 3, text);
        if (saved?.id) setCurrentMoodLogId(saved.id);
      }
    } catch {}
  };

  const handleCompleteQuickAction = async (task, reflectionText = "") => {
    const target = task || activeQuickAction;
    if (!quickActionVisible || !target) return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    if (reflectionText) {
      await persistReflectionNote(reflectionText);
    }

    setCompletedActions((prev) => ({
      ...prev,
      [target.id || target.title]: true,
    }));
    closeQuickAction();
  };

  const handleExploreReflectionInChat = async (task, reflectionText = "") => {
    if (reflectionText) {
      await persistReflectionNote(reflectionText);
      setCompletedActions((prev) => ({
        ...prev,
        [task?.id || task?.title || "journal"]: true,
      }));
    }
    closeQuickAction();
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

  const displayName = user?.name || "Friend";
  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";
  const activeMoodMeta = MOODS.find((m) => m.id === selectedMood);

  const completedCount = aiSuggestions?.suggestions
    ? aiSuggestions.suggestions.filter(
        (s) => completedActions[s.id || s.title]
      ).length
    : 0;

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        scrollEnabled={scrollEnabled}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 112 + Math.max(insets.bottom, 12) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Serene Top Navbar */}
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

        {/* Mood Check-In Card */}
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
                onPress={() => handleMoodSelect(m.id)}
                activeOpacity={0.8}
                style={[
                  styles.moodCard,
                  {
                    backgroundColor: isSelected
                      ? m.accent + "20"
                      : colors.surface,
                    borderColor: isSelected ? m.accent : colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.moodIconCircle,
                    {
                      backgroundColor: isSelected ? m.accent : m.accent + "1A",
                    },
                  ]}
                >
                  <Ionicons
                    name={m.icon}
                    size={20}
                    color={
                      isSelected ? (isDark ? "#0B0F17" : "#FFFFFF") : m.accent
                    }
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

        {/* Optional Context Note */}
        {selectedMood && (
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
              value={moodNote}
              onChangeText={setMoodNote}
              onFocus={() => setIsNoteFocused(true)}
              onBlur={() => setIsNoteFocused(false)}
              underlineColorAndroid="transparent"
              returnKeyType="send"
              onSubmitEditing={() => {
                if (moodNote.trim() && !loadingSuggestions) {
                  handleMoodSelect(selectedMood, true, true);
                }
              }}
            />
            {loadingSuggestions ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginLeft: 8 }}
              />
            ) : (
              <TouchableOpacity
                onPress={() => handleMoodSelect(selectedMood, true, true)}
                disabled={!moodNote.trim()}
                style={[
                  styles.sendNoteBtn,
                  {
                    backgroundColor: moodNote.trim()
                      ? colors.primary
                      : colors.surfaceElevated,
                  },
                ]}
              >
                <Ionicons
                  name="arrow-up"
                  size={16}
                  color={moodNote.trim() ? onPrimaryText : colors.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>
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
            <View style={styles.aiPanelHeader}>
              <CompanionAvatar
                avatarId={user?.companionAvatar}
                size={36}
                isThinking={loadingSuggestions}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.aiPanelTitle, { color: colors.text }]}>
                  {activeCompanion.name} suggests
                </Text>
                <Text style={[styles.aiPanelSub, { color: colors.textMuted }]}>
                  Tailored to how you feel
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  selectedMood && handleMoodSelect(selectedMood, false, true)
                }
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
                <Text
                  style={[styles.progressPillText, { color: colors.primary }]}
                >
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
                    onPress={() => handleSuggestionAction(item)}
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
          </Animated.View>
        )}

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
              openQuickAction(QUICK_SENSORY_RESET);
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
              {activeCompanion.tagline} • Private check-in
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
        onClose={closeQuickAction}
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
  navActions: { flexDirection: "row", gap: 10, alignItems: "center" },
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
  navAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
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
  noteContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 12,
  },
  noteInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
    ...(Platform.OS === "web"
      ? { outlineStyle: "none", outlineWidth: 0 }
      : {}),
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