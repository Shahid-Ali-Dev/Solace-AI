// app/setup.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedRemindersFromRhythm } from "../services/notifications"
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import UserAvatarPicker from "../components/UserAvatarPicker";
import AvatarImage from "../components/AvatarImage";
import CompanionPicker from "../components/CompanionPicker";
import CompanionAvatar from "../components/CompanionAvatar";
import { getCompanionById } from "../constants/companions";
import {
  USER_AVATARS,
  WELLNESS_GOALS,
  stripBgParam,
  extractBgParam,
  buildAvatarUrl,
  getTintSwatch,
} from "../constants/userAvatars";
import { ONBOARDING_COMPANION_KEY } from "./onboarding";

const RHYTHMS = [
  { id: "morning", label: "Morning Calm", time: "8:30 AM", icon: "sunny-outline" },
  { id: "midday", label: "Midday Reset", time: "2:00 PM", icon: "leaf-outline" },
  { id: "evening", label: "Evening Unwind", time: "9:00 PM", icon: "moon-outline" },
];

export default function SetupScreen() {
  const { colors, isDark } = useTheme();
  const { user, completeSetup, updateProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const initialName =
    user?.name && !["Friend", "Guest Explorer"].includes(user.name.trim())
      ? user.name.trim()
      : "";
  const initialAvatar = user?.avatar || USER_AVATARS[0].url;

  const [step, setStep] = useState(0); // 0: Identity, 1: Companion, 2: Goals & Privacy
  const [name, setName] = useState(initialName);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [selectedBaseUrl, setSelectedBaseUrl] = useState(stripBgParam(initialAvatar));
  const [selectedBg, setSelectedBg] = useState(extractBgParam(initialAvatar));
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(
    user?.wellnessGoal || WELLNESS_GOALS[0]
  );
  const [preferredRhythm, setPreferredRhythm] = useState("evening");
  const [aiMemoryEnabled, setAiMemoryEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeCompanion = getCompanionById(user?.companionAvatar);

  // Animations
  const stepAnim = useRef(new Animated.Value(0)).current;
  const previewBounce = useRef(new Animated.Value(1)).current;
  const companionGlow = useRef(new Animated.Value(0)).current;

  const activeAvatarUri = useMemo(
    () => buildAvatarUrl(selectedBaseUrl, selectedBg),
    [selectedBaseUrl, selectedBg]
  );

  useEffect(() => {
    stepAnim.setValue(0);
    Animated.timing(stepAnim, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step]);

  useEffect(() => {
    (async () => {
      try {
        const pickedId = await AsyncStorage.getItem(ONBOARDING_COMPANION_KEY);
        if (pickedId && pickedId !== user?.companionAvatar) {
          await updateProfile({ companionAvatar: pickedId });
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    previewBounce.setValue(0.88);
    Animated.spring(previewBounce, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [selectedBaseUrl, selectedBg, activeCompanion.id]);

  useEffect(() => {
    if (step !== 1) {
      companionGlow.stopAnimation();
      companionGlow.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(companionGlow, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(companionGlow, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [step]);

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      Haptics.impactAsync(style);
    } catch {}
  };

  const handleNext = async () => {
    setError("");
    if (step === 0) {
      if (!name.trim()) {
        setError("Enter a first name or nickname so your companion knows what to call you.");
        return;
      }
      triggerHaptic();
      setStep(1);
      return;
    }

    if (step === 1) {
      triggerHaptic();
      setStep(2);
      return;
    }

    // Finalize setup
    setSaving(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    try {
      await seedRemindersFromRhythm(
        { id: user?.id, name: name.trim(), companionAvatar: activeCompanion.id },
        preferredRhythm,
        true
      ).catch(() => {});

      await completeSetup({
        name: name.trim() || "Friend",
        avatar: activeAvatarUri,
        companionAvatar: activeCompanion.id,
        wellnessGoal: selectedGoal,
        aiMemoryEnabled,
      });

      await AsyncStorage.removeItem(ONBOARDING_COMPANION_KEY).catch(() => {});

      router.replace("/(tabs)");
    } catch (err) {
      setError(err?.message || "Could not save setup. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    triggerHaptic();
    setError("");
    if (step > 0) {
      setStep((s) => s - 1);
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  const handleQuickFinish = async () => {
    triggerHaptic();
    setSaving(true);
    try {
      await completeSetup({
        name: name.trim() || "Friend",
        avatar: activeAvatarUri,
        companionAvatar: activeCompanion.id,
        wellnessGoal: selectedGoal,
        aiMemoryEnabled,
      });
      router.replace("/(tabs)");
    } catch {
      router.replace("/(tabs)");
    } finally {
      setSaving(false);
    }
  };

  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";
  const progressPercent = `${((step + 1) / 3) * 100}%`;

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Top Progress Header */}
      <View style={styles.topHeader}>
        {step > 0 ? (
          <TouchableOpacity
            onPress={handleBack}
            style={[
              styles.iconBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}

        <View style={styles.progressWrap}>
          <Text style={[styles.stepLabel, { color: colors.textMuted }]}>
            Step {step + 1} of 3
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceElevated }]}>
            <View
              style={[
                styles.progressFill,
                { width: progressPercent, backgroundColor: colors.primary },
              ]}
            />
          </View>
        </View>

        <TouchableOpacity onPress={handleQuickFinish} disabled={saving}>
          <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={{
              opacity: stepAnim,
              transform: [
                {
                  translateY: stepAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            }}
          >
            {/* STEP 1: Name + Character Avatar + Background Tint */}
            {step === 0 && (
              <View>
                <Text style={[styles.heading, { color: colors.text }]}>
                  Make Solace feel yours
                </Text>
                <Text style={[styles.subheading, { color: colors.textMuted }]}>
                  Pick your nickname, character look, and signature aura color.
                </Text>

                {/* Live Animated Spotlight */}
                <View style={styles.spotlightBox}>
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic();
                      setAvatarModalVisible(true);
                    }}
                    activeOpacity={0.85}
                    accessibilityLabel="Browse all 20 characters"
                  >
                    <Animated.View
                      style={[
                        styles.spotlightWrap,
                        { transform: [{ scale: previewBounce }] },
                      ]}
                    >
                      <View
                        style={[
                          styles.spotlightRing,
                          {
                            borderColor: colors.primary,
                            backgroundColor: selectedBg
                              ? getTintSwatch(selectedBg)
                              : colors.surfaceElevated,
                          },
                        ]}
                      >
                        <AvatarImage
                          uri={selectedBaseUrl}
                          size={88}
                          fallbackLabel={name || "Friend"}
                        />
                      </View>
                      <View
                        style={[
                          styles.editAvatarBadge,
                          {
                            backgroundColor: colors.primary,
                            borderColor: colors.background,
                          },
                        ]}
                      >
                        <Ionicons name="pencil" size={13} color={onPrimaryText} />
                      </View>
                    </Animated.View>
                  </TouchableOpacity>
                  <Text style={[styles.liveName, { color: colors.text }]}>
                    {name.trim() || "Your Name"}
                  </Text>
                </View>

                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  What should we call you?
                </Text>
                <View
                  style={[
                    styles.inputBox,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isNameFocused ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={isNameFocused ? colors.primary : colors.textMuted}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { color: colors.text },
                      Platform.OS === "web" && styles.webReset,
                    ]}
                    placeholder="First name or nickname"
                    placeholderTextColor={colors.textMuted}
                    value={name}
                    onFocus={() => setIsNameFocused(true)}
                    onBlur={() => setIsNameFocused(false)}
                    onChangeText={(txt) => {
                      setName(txt);
                      setError("");
                    }}
                    returnKeyType="done"
                  />
                </View>

                <UserAvatarPicker
                  selectedBaseUrl={selectedBaseUrl}
                  selectedBg={selectedBg}
                  onSelectAvatar={(url) => setSelectedBaseUrl(url)}
                  onSelectTint={(hex) => setSelectedBg(hex)}
                  gridVisible={avatarModalVisible}
                  onOpenGrid={() => setAvatarModalVisible(true)}
                  onCloseGrid={() => setAvatarModalVisible(false)}
                />
              </View>
            )}

            {/* STEP 2: Interactive AI Companion Selection */}
            {step === 1 && (
              <View>
                <Text style={[styles.heading, { color: colors.text }]}>
                  Choose your AI companion
                </Text>
                <Text style={[styles.subheading, { color: colors.textMuted }]}>
                  Each companion brings a slightly different tone. You can switch anytime.
                </Text>

                {/* Live Animated Companion Stage */}
                <View
                  style={[
                    styles.companionStage,
                    {
                      backgroundColor: colors.surface,
                      borderColor: activeCompanion.accent + "55",
                    },
                  ]}
                >
                  <View style={styles.companionAvatarSlot}>
                    <Animated.View
                      pointerEvents="none"
                      renderToHardwareTextureAndroid
                      shouldRasterizeIOS
                      style={[
                        styles.companionAura,
                        {
                          backgroundColor: activeCompanion.accent + "28",
                          opacity: companionGlow.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.45, 0.9],
                          }),
                          transform: [
                            {
                              scale: companionGlow.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.96, 1.1],
                              }),
                            },
                          ],
                        },
                      ]}
                    />

                    <Animated.View
                      renderToHardwareTextureAndroid
                      shouldRasterizeIOS
                      style={{ transform: [{ scale: previewBounce }] }}
                    >
                      <CompanionAvatar avatarId={activeCompanion.id} size={86} />
                    </Animated.View>
                  </View>

                  <Text style={[styles.companionName, { color: colors.text }]}>
                    {activeCompanion.name}
                  </Text>
                  <Text
                    style={[
                      styles.companionTagline,
                      { color: activeCompanion.accent },
                    ]}
                  >
                    {activeCompanion.tagline?.replace(/[•·\s]+$/, "")}
                  </Text>
                  <View
                    style={[
                      styles.greetingBubble,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.greetingText, { color: colors.text }]}>
                      "Hey {name.trim() || "there"}, I'm {activeCompanion.name}. Ready to take things at your pace?"
                    </Text>
                  </View>
                </View>

                <CompanionPicker layout="grid" hideHeader />
              </View>
            )}

            {/* STEP 3: Wellness Goal, Check-in Rhythm & AI Memory Consent */}
            {step === 2 && (
              <View>
                <Text style={[styles.heading, { color: colors.text }]}>
                  Tailor your daily sanctuary
                </Text>
                <Text style={[styles.subheading, { color: colors.textMuted }]}>
                  Solace adapts check-ins, affirmations, and companion tips to your focus.
                </Text>

                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  Primary wellness focus
                </Text>
                <View style={styles.goalsWrap}>
                  {WELLNESS_GOALS.map((goal) => {
                    const active = selectedGoal === goal;
                    return (
                      <TouchableOpacity
                        key={goal}
                        onPress={() => {
                          triggerHaptic();
                          setSelectedGoal(goal);
                        }}
                        style={[
                          styles.goalChip,
                          {
                            backgroundColor: active ? colors.primary : colors.surface,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.goalChipText,
                            { color: active ? onPrimaryText : colors.text },
                          ]}
                        >
                          {goal}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text
                  style={[styles.fieldLabel, { color: colors.text, marginTop: 22 }]}
                >
                  Preferred check-in rhythm
                </Text>
                <View style={styles.rhythmCol}>
                  {RHYTHMS.map((r) => {
                    const active = preferredRhythm === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        onPress={() => {
                          triggerHaptic();
                          setPreferredRhythm(r.id);
                        }}
                        style={[
                          styles.rhythmCard,
                          {
                            backgroundColor: active
                              ? colors.primary + "16"
                              : colors.surface,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.rhythmIcon,
                            {
                              backgroundColor: active
                                ? colors.primary
                                : colors.surfaceElevated,
                            },
                          ]}
                        >
                          <Ionicons
                            name={r.icon}
                            size={18}
                            color={active ? onPrimaryText : colors.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.rhythmTitle, { color: colors.text }]}>
                            {r.label}
                          </Text>
                          <Text
                            style={[styles.rhythmSub, { color: colors.textMuted }]}
                          >
                            Suggested reminder • {r.time}
                          </Text>
                        </View>
                        {active && (
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

                {/* Consent & Control Card */}
                <View
                  style={[
                    styles.consentCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.consentTitle, { color: colors.text }]}>
                      Personalized AI memory
                    </Text>
                    <Text
                      style={[styles.consentDesc, { color: colors.textMuted }]}
                    >
                      Allow {activeCompanion.name} to learn from your mood trends and past chats. You control this anytime in Profile.
                    </Text>
                  </View>
                  <Switch
                    value={aiMemoryEnabled}
                    onValueChange={(v) => {
                      triggerHaptic();
                      setAiMemoryEnabled(v);
                    }}
                    trackColor={{ false: colors.border, true: colors.primary + "80" }}
                    thumbColor={aiMemoryEnabled ? colors.primary : colors.textMuted}
                  />
                </View>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Bottom Sticky CTA */}
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
            onPress={handleNext}
            disabled={saving}
            activeOpacity={0.88}
            style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
          >
            {saving ? (
              <ActivityIndicator color={onPrimaryText} />
            ) : (
              <>
                <Text style={[styles.ctaText, { color: onPrimaryText }]}>
                  {step === 2 ? "Enter My Sanctuary" : "Continue"}
                </Text>
                <Ionicons
                  name={step === 2 ? "sparkles" : "arrow-forward"}
                  size={18}
                  color={onPrimaryText}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 14,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  progressWrap: { flex: 1, gap: 6 },
  stepLabel: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  skipText: { fontSize: 13, fontWeight: "600", width: 38, textAlign: "right" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  heading: { fontSize: 26, fontWeight: "800", lineHeight: 32 },
  subheading: { fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 20 },
  spotlightBox: { alignItems: "center", marginBottom: 20, gap: 10 },
  spotlightRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  spotlightWrap: {
    position: "relative",
  },
  editAvatarBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    justifyContent: "center",
    alignItems: "center",
  },
  liveName: { fontSize: 19, fontWeight: "800" },
  fieldLabel: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  input: { flex: 1, fontSize: 15, height: "100%" },
  webReset: { outlineStyle: "none", outlineWidth: 0 },
  companionStage: {
    alignItems: "center",
    padding: 18,
    borderRadius: 24,
    borderWidth: 1.5,
    marginBottom: 18,
    overflow: "hidden",
  },
  companionAvatarSlot: {
    width: 112,
    height: 112,
    justifyContent: "center",
    alignItems: "center",
  },
  companionAura: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  companionName: { fontSize: 20, fontWeight: "800", marginTop: 6 },
  companionTagline: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  greetingBubble: {
    width: "100%",
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
  },
  greetingText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  goalsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  goalChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  goalChipText: { fontSize: 13, fontWeight: "600" },
  rhythmCol: { gap: 10 },
  rhythmCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 18,
    borderWidth: 1,
  },
  rhythmIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  rhythmTitle: { fontSize: 14, fontWeight: "700" },
  rhythmSub: { fontSize: 12, marginTop: 2 },
  consentCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 20,
  },
  consentTitle: { fontSize: 14, fontWeight: "700" },
  consentDesc: { fontSize: 12, lineHeight: 17, marginTop: 3 },
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
  ctaBtn: {
    height: 52,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { fontSize: 15, fontWeight: "700" },
});