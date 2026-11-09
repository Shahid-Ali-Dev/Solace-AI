// app/onboarding.jsx
import React, { memo, useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  useWindowDimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import CompanionAvatar from "../components/CompanionAvatar";
import { COMPANION_AVATARS, getCompanionById } from "../constants/companions";

export const ONBOARDING_COMPANION_KEY = "solace_onboarding_companion";

const MOOD_PREVIEWS = [
  {
    id: "anxious",
    label: "Anxious",
    icon: "pulse-outline",
    color: "#F59E0B",
    badge: "Physiological Sigh • 2m",
    reply: "Let's bring the volume down one notch with two quick inhales and a slow exhale.",
  },
  {
    id: "peaceful",
    label: "Peaceful",
    icon: "sunny-outline",
    color: "#2DD4BF",
    badge: "Savoring Pause • 1m",
    reply: "Lovely when your mind gets a quiet window. Capture one thing that helped today.",
  },
  {
    id: "tired",
    label: "Tired",
    icon: "moon-outline",
    color: "#818CF8",
    badge: "4-7-8 Wind-Down • 2m",
    reply: "Running on low battery makes everything look heavier. Drop one non-essential tonight.",
  },
  {
    id: "grateful",
    label: "Grateful",
    icon: "heart-outline",
    color: "#FB7185",
    badge: "Gratitude Note • 1m",
    reply: "Naming one specific detail helps positive moments stay with you longer.",
  },
];

const COMPANION_QUOTES = {
  lumi_girl: "No rush today. Want to take one slow breath together?",
  maya_girl: "Let's untangle what's on your mind, one calm step at a time.",
  zoya_girl: "Small shifts count too—let's check in on how you're feeling!",
  aria_girl: "Whatever kind of day it's been, I'm right here to listen.",
  sana_girl: "Let's turn down the noise and find your steady center.",
  nia_girl: "Clear thoughts start with a quiet pause. Ready when you are?",
};

const SLIDES = [
  {
    key: "emotions",
    eyebrow: "DAILY CHECK-INS",
    title: "Understand what\nyou're feeling",
    body: "Log your mood in seconds, add context when you want, and get calm 1-minute resets tailored to your moment.",
    accent: "#2DD4BF",
  },
  {
    key: "companion",
    eyebrow: "EMPATHETIC AI",
    title: "A companion that\nactually remembers",
    body: "Choose an AI personality that fits your vibe—one that remembers past check-ins and gives thoughtful guidance, never clichés.",
    accent: "#A78BFA",
  },
  {
    key: "habits",
    eyebrow: "CALM ROUTINES",
    title: "Build gentle habits\nthat stick",
    body: "Guided breathing, streaks, and mindful reminders designed to feel welcoming—not like another to-do list.",
    accent: "#38BDF8",
  },
];

const EmotionsHero = memo(function EmotionsHero({ colors }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const cardAnim = useRef(new Animated.Value(1)).current;
  const activeMood = MOOD_PREVIEWS[selectedIdx];

  const handleMoodTap = (idx) => {
    if (idx === selectedIdx) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    setSelectedIdx(idx);
    cardAnim.setValue(0);
    Animated.spring(cardAnim, {
      toValue: 1,
      friction: 8,
      tension: 85,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.heroStage}>
      <View
        style={[
          styles.glassCard,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.cardTopRow}>
          <Ionicons name="sparkles-outline" size={16} color={activeMood.color} />
          <Text style={[styles.cardMiniTitle, { color: colors.text }]}>
            Tap a mood to preview
          </Text>
        </View>

        <View style={styles.moodStrip}>
          {MOOD_PREVIEWS.map((m, idx) => {
            const isSelected = idx === selectedIdx;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => handleMoodTap(idx)}
                activeOpacity={0.8}
                style={[
                  styles.miniMood,
                  {
                    backgroundColor: isSelected ? m.color + "22" : colors.surface,
                    borderColor: isSelected ? m.color : colors.border,
                  },
                ]}
              >
                <Ionicons name={m.icon} size={18} color={m.color} />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.miniMoodLabel,
                    {
                      color: isSelected ? colors.text : colors.textMuted,
                      fontWeight: isSelected ? "700" : "500",
                    },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Animated.View
          style={[
            styles.previewReplyCard,
            {
              backgroundColor: colors.surface,
              borderColor: activeMood.color + "50",
              opacity: cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 1],
              }),
              transform: [
                {
                  scale: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.previewBadgeRow}>
            <View
              style={[
                styles.badgePill,
                { backgroundColor: activeMood.color + "22" },
              ]}
            >
              <Text style={[styles.badgeText, { color: activeMood.color }]}>
                {activeMood.badge}
              </Text>
            </View>
          </View>
          <Text style={[styles.previewReplyText, { color: colors.text }]}>
            {activeMood.reply}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
});

const CompanionHero = memo(function CompanionHero({ colors, isActiveSlide }) {
  const [selectedId, setSelectedId] = useState(COMPANION_AVATARS[0].id);
  const switchAnim = useRef(new Animated.Value(1)).current;
  const activeCompanion = getCompanionById(selectedId);

  const selectCompanion = (nextId) => {
    if (nextId === selectedId) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    setSelectedId(nextId);
    AsyncStorage.setItem(ONBOARDING_COMPANION_KEY, nextId).catch(() => {});

    switchAnim.setValue(0);
    Animated.spring(switchAnim, {
      toValue: 1,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  };

  const cycleNext = () => {
    const curIdx = COMPANION_AVATARS.findIndex((c) => c.id === activeCompanion.id);
    const next = COMPANION_AVATARS[(curIdx + 1) % COMPANION_AVATARS.length];
    selectCompanion(next.id);
  };

  return (
    <View style={styles.heroStage}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={cycleNext}
        style={styles.companionTopTap}
      >
        <Animated.View
          renderToHardwareTextureAndroid
          style={[
            styles.companionRing,
            {
              borderColor: activeCompanion.accent + "85",
              backgroundColor: activeCompanion.accent + "18",
              transform: [
                {
                  scale: switchAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.88, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <CompanionAvatar
            avatarId={activeCompanion.id}
            size={88}
            animated={isActiveSlide}
          />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.quoteBubble,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: activeCompanion.accent + "55",
            opacity: switchAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 1],
            }),
            transform: [
              {
                translateY: switchAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [6, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.quoteHeader}>
          <View style={styles.quoteNameRow}>
            <Text style={[styles.quoteName, { color: activeCompanion.accent }]}>
              {activeCompanion.name}
            </Text>
            <Text style={[styles.quoteTagline, { color: colors.textMuted }]}>
              • {activeCompanion.tagline}
            </Text>
          </View>
          <Text style={[styles.tapHint, { color: colors.textMuted }]}>
            Tap face or pick below
          </Text>
        </View>
        <Text style={[styles.quoteText, { color: colors.text }]}>
          "{COMPANION_QUOTES[activeCompanion.id] || COMPANION_QUOTES.lumi_girl}"
        </Text>
      </Animated.View>

      {/* Real Companion Thumbnail Switcher */}
      <View style={styles.companionThumbRow}>
        {COMPANION_AVATARS.map((item) => {
          const isSelected = item.id === activeCompanion.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => selectCompanion(item.id)}
              activeOpacity={0.85}
              accessibilityLabel={`Preview ${item.name}`}
              style={[
                styles.thumbBtn,
                {
                  borderColor: isSelected ? item.accent : colors.border,
                  backgroundColor: isSelected ? item.accent + "22" : colors.surface,
                  transform: [{ scale: isSelected ? 1.08 : 1 }],
                },
              ]}
            >
              <CompanionAvatar avatarId={item.id} size={34} animated={false} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const HabitsHero = memo(function HabitsHero({ colors, accent, isActiveSlide }) {
  const breathAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isActiveSlide) {
      breathAnim.stopAnimation();
      breathAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 2,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [isActiveSlide]);

  const outerScale = breathAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.9, 1.18, 0.9],
  });

  const outerOpacity = breathAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.45, 0.95, 0.45],
  });

  const innerScale = breathAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.95, 1.07, 0.95],
  });

  const inhaleOpacity = breathAnim.interpolate({
    inputRange: [0, 0.12, 0.88, 1, 2],
    outputRange: [0.2, 1, 1, 0, 0],
  });

  const exhaleOpacity = breathAnim.interpolate({
    inputRange: [0, 1, 1.12, 1.88, 2],
    outputRange: [0, 0, 1, 1, 0.2],
  });

  return (
    <View style={styles.heroStage}>
      <View style={styles.breatheStage}>
        <Animated.View
          renderToHardwareTextureAndroid
          style={[
            styles.breatheOuter,
            {
              borderColor: accent + "60",
              backgroundColor: accent + "16",
              opacity: outerOpacity,
              transform: [{ scale: outerScale }],
            },
          ]}
        />

        <Animated.View
          renderToHardwareTextureAndroid
          style={[
            styles.breatheInner,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: accent + "90",
              transform: [{ scale: innerScale }],
            },
          ]}
        >
          <Ionicons name="water-outline" size={30} color={accent} />
          <View style={styles.phaseSlot}>
            <Animated.Text
              style={[styles.breatheText, { color: colors.text, opacity: inhaleOpacity }]}
            >
              Inhale • 4s
            </Animated.Text>
            <Animated.Text
              style={[
                styles.breatheText,
                styles.phaseOverlay,
                { color: colors.text, opacity: exhaleOpacity },
              ]}
            >
              Exhale • 4s
            </Animated.Text>
          </View>
        </Animated.View>
      </View>

      <View style={styles.floatingStatsRow}>
        <View
          style={[
            styles.statPill,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <Ionicons name="flame" size={14} color="#F59E0B" />
          <Text style={[styles.statPillText, { color: colors.text }]}>
            Daily Streaks
          </Text>
        </View>
        <View
          style={[
            styles.statPill,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <Ionicons name="notifications-outline" size={14} color={accent} />
          <Text style={[styles.statPillText, { color: colors.text }]}>
            Gentle Reminders
          </Text>
        </View>
      </View>
    </View>
  );
});

export default function OnboardingScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { completeOnboarding } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(null);

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const goToSlide = useCallback(
    (idx) => {
      const clamped = Math.max(0, Math.min(SLIDES.length - 1, idx));
      activeIndexRef.current = clamped;
      setActiveIndex(clamped);
      scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    },
    [width]
  );

  const handleScroll = useCallback(
    (e) => {
      if (!width) return;
      const offsetX = e.nativeEvent.contentOffset.x;
      const nextIdx = Math.max(
        0,
        Math.min(SLIDES.length - 1, Math.round(offsetX / width))
      );
      if (nextIdx !== activeIndexRef.current) {
        activeIndexRef.current = nextIdx;
        setActiveIndex(nextIdx);
      }
    },
    [width]
  );

  const finishOnboarding = async () => {
    triggerHaptic();
    await completeOnboarding();
    router.replace("/login");
  };

  const handleNext = () => {
    triggerHaptic();
    if (activeIndex < SLIDES.length - 1) {
      goToSlide(activeIndex + 1);
    } else {
      finishOnboarding();
    }
  };

  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";
  const safeWidth = Math.max(width, 1);

  const indicatorTranslateX = scrollX.interpolate({
    inputRange: [0, safeWidth, safeWidth * 2],
    outputRange: [0, 34, 68],
    extrapolate: "clamp",
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Smooth Scroll-Driven Aurora Glows (Native Driver, Zero Re-render Flash) */}
      {SLIDES.map((s, idx) => {
        const inputRange = [
          (idx - 1) * safeWidth,
          idx * safeWidth,
          (idx + 1) * safeWidth,
        ];
        const glowOpacity = scrollX.interpolate({
          inputRange,
          outputRange: [0, isDark ? 0.16 : 0.12, 0],
          extrapolate: "clamp",
        });
        return (
          <Animated.View
            key={s.key}
            pointerEvents="none"
            style={[
              styles.auroraBlob,
              { backgroundColor: s.accent, opacity: glowOpacity },
            ]}
          />
        );
      })}

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            triggerHaptic();
            toggleTheme();
          }}
          accessibilityLabel="Toggle theme"
          style={[
            styles.iconCircle,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={18}
            color={colors.primary}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={finishOnboarding} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable Slides */}
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true, listener: handleScroll }
        )}
      >
        {SLIDES.map((slide, idx) => {
          const inputRange = [
            (idx - 1) * safeWidth,
            idx * safeWidth,
            (idx + 1) * safeWidth,
          ];
          const heroScale = scrollX.interpolate({
            inputRange,
            outputRange: [0.92, 1, 0.92],
            extrapolate: "clamp",
          });
          const textTranslate = scrollX.interpolate({
            inputRange,
            outputRange: [28, 0, -28],
            extrapolate: "clamp",
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          });

          return (
            <View key={slide.key} style={[styles.slide, { width }]}>
              <Animated.View
                renderToHardwareTextureAndroid
                style={[
                  styles.heroWrap,
                  { opacity, transform: [{ scale: heroScale }] },
                ]}
              >
                {slide.key === "emotions" && <EmotionsHero colors={colors} />}
                {slide.key === "companion" && (
                  <CompanionHero
                    colors={colors}
                    isActiveSlide={activeIndex === 1}
                  />
                )}
                {slide.key === "habits" && (
                  <HabitsHero
                    colors={colors}
                    accent={slide.accent}
                    isActiveSlide={activeIndex === 2}
                  />
                )}
              </Animated.View>

              <Animated.View
                style={[
                  styles.copyWrap,
                  { opacity, transform: [{ translateX: textTranslate }] },
                ]}
              >
                <Text style={[styles.eyebrow, { color: slide.accent }]}>
                  {slide.eyebrow}
                </Text>
                <Text style={[styles.title, { color: colors.text }]}>
                  {slide.title}
                </Text>
                <Text style={[styles.body, { color: colors.textMuted }]}>
                  {slide.body}
                </Text>
              </Animated.View>
            </View>
          );
        })}
      </Animated.ScrollView>

      {/* Bottom Controls */}
      <View style={styles.footer}>
        {/* Smooth Sliding Pill Pagination */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((s, idx) => (
            <TouchableOpacity
              key={s.key}
              onPress={() => {
                triggerHaptic();
                goToSlide(idx);
              }}
              style={styles.dotHitbox}
              accessibilityLabel={`Go to slide ${idx + 1}`}
            >
              <View style={[styles.dotBase, { backgroundColor: colors.border }]} />
            </TouchableOpacity>
          ))}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeDotPill,
              {
                backgroundColor: colors.primary,
                transform: [{ translateX: indicatorTranslateX }],
              },
            ]}
          />
        </View>

        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.88}
          style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.ctaText, { color: onPrimaryText }]}>
            {activeIndex === SLIDES.length - 1 ? "Get Started" : "Continue"}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={onPrimaryText} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  auroraBlob: {
    position: "absolute",
    top: -110,
    alignSelf: "center",
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  skipBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  skipText: { fontSize: 14, fontWeight: "600" },
  slide: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    paddingBottom: 14,
  },
  heroWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  heroStage: {
    width: "100%",
    maxWidth: 370,
    minHeight: 280,
    justifyContent: "center",
    alignItems: "center",
  },
  glassCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  cardMiniTitle: { fontSize: 14, fontWeight: "700" },
  moodStrip: { flexDirection: "row", gap: 7 },
  miniMood: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: 15,
    borderWidth: 1,
    gap: 5,
  },
  miniMoodLabel: { fontSize: 11 },
  previewReplyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    gap: 7,
  },
  previewBadgeRow: { flexDirection: "row" },
  badgePill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  previewReplyText: { fontSize: 13, lineHeight: 19, fontWeight: "500" },
  companionTopTap: {
    marginBottom: 14,
  },
  companionRing: {
    padding: 8,
    borderRadius: 58,
    borderWidth: 2,
  },
  quoteBubble: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 15,
    gap: 6,
  },
  quoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  quoteNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  quoteName: { fontSize: 14, fontWeight: "800" },
  quoteTagline: { fontSize: 12, fontWeight: "500" },
  tapHint: { fontSize: 10, fontWeight: "500" },
  quoteText: { fontSize: 13.5, lineHeight: 19.5, fontWeight: "500" },
  companionThumbRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 14,
  },
  thumbBtn: {
    padding: 3,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  breatheStage: {
    width: 210,
    height: 210,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  breatheOuter: {
    position: "absolute",
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 1.5,
  },
  breatheInner: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
  },
  phaseSlot: {
    height: 18,
    width: 90,
    justifyContent: "center",
    alignItems: "center",
  },
  breatheText: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  phaseOverlay: { position: "absolute" },
  floatingStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  statPillText: { fontSize: 12, fontWeight: "600" },
  copyWrap: {
    paddingBottom: 6,
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 29,
    fontWeight: "800",
    lineHeight: 35,
  },
  body: {
    fontSize: 14.5,
    lineHeight: 21.5,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 16 : 22,
    gap: 16,
  },
  dotsContainer: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    position: "relative",
    width: 96,
    height: 24,
  },
  dotHitbox: {
    width: 28,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  dotBase: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDotPill: {
    position: "absolute",
    top: 8,
    left: 2,
    width: 24,
    height: 8,
    borderRadius: 4,
  },
  ctaBtn: {
    height: 54,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { fontSize: 16, fontWeight: "700" },
});