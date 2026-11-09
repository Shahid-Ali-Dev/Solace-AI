// components/DailyReflectionCard.jsx
import React, { useRef, useEffect, useState, useId } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
} from "react-native-svg";
import * as Haptics from "expo-haptics";

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

export default function DailyReflectionCard({
  affirmation,
  loadingAffirmation,
  onRefresh,
  onInteractionChange,
  colors,
  isDark,
}) {
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const cardGradId = `affirm_bg_${safeId}`;
  const glowGradId = `affirm_glow_${safeId}`;

  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const layoutRef = useRef({ width: 320, height: 150 });
  const holdTimerRef = useRef(null);
  const isInteractingRef = useRef(false);
  const responderActiveRef = useRef(false);
  const anchorRef = useRef({ localX: 0, localY: 0, pageX: 0, pageY: 0 });

  const touchX = useRef(new Animated.Value(160)).current;
  const touchY = useRef(new Animated.Value(75)).current;
  const normX = useRef(new Animated.Value(0)).current;
  const normY = useRef(new Animated.Value(0)).current;
  const auraVisibility = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (isInteractingRef.current) {
        onInteractionChange?.(false);
      }
    };
  }, []);

  const updatePointerAtLocal = (rawX, rawY) => {
    const { width, height } = layoutRef.current;
    if (!width || !height) return;

    const x = clamp(rawX, 0, width);
    const y = clamp(rawY, 0, height);

    touchX.setValue(x);
    touchY.setValue(y);
    normX.setValue((x / width) * 2 - 1);
    normY.setValue((y / height) * 2 - 1);
  };

  const beginInteraction = (x, y, withHaptic = true) => {
    isInteractingRef.current = true;
    onInteractionChange?.(true);
    updatePointerAtLocal(x, y);

    if (withHaptic) {
      try {
        Haptics.selectionAsync();
      } catch {}
    }

    Animated.spring(auraVisibility, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const endInteraction = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (!isInteractingRef.current) return;

    isInteractingRef.current = false;
    responderActiveRef.current = false;
    onInteractionChange?.(false);

    Animated.parallel([
      Animated.timing(auraVisibility, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(normX, {
        toValue: 0,
        friction: 7,
        tension: 45,
        useNativeDriver: true,
      }),
      Animated.spring(normY, {
        toValue: 0,
        friction: 7,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => isInteractingRef.current,
      onMoveShouldSetPanResponderCapture: () => isInteractingRef.current,
      onPanResponderTerminationRequest: () => !isInteractingRef.current,
      onPanResponderGrant: () => {
        responderActiveRef.current = true;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!isInteractingRef.current) return;
        const { pageX, pageY } = evt.nativeEvent;

        if (typeof pageX === "number" && anchorRef.current.pageX) {
          const nextX = anchorRef.current.localX + (pageX - anchorRef.current.pageX);
          const nextY = anchorRef.current.localY + (pageY - anchorRef.current.pageY);
          updatePointerAtLocal(nextX, nextY);
        } else {
          updatePointerAtLocal(
            anchorRef.current.localX + gestureState.dx,
            anchorRef.current.localY + gestureState.dy
          );
        }
      },
      onPanResponderRelease: () => endInteraction(),
      onPanResponderTerminate: () => endInteraction(),
    })
  ).current;

  const handleTouchStart = (evt) => {
    const { locationX, locationY, pageX, pageY } = evt.nativeEvent;
    const startX =
      typeof locationX === "number" ? locationX : layoutRef.current.width / 2;
    const startY =
      typeof locationY === "number" ? locationY : layoutRef.current.height / 2;

    anchorRef.current = {
      localX: startX,
      localY: startY,
      pageX: typeof pageX === "number" ? pageX : 0,
      pageY: typeof pageY === "number" ? pageY : 0,
    };

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      beginInteraction(startX, startY, true);
    }, 140);
  };

  const handleTouchMove = (evt) => {
    if (responderActiveRef.current) return;

    const { pageX, pageY, locationX, locationY } = evt.nativeEvent;

    if (isInteractingRef.current) {
      if (typeof pageX === "number" && anchorRef.current.pageX) {
        updatePointerAtLocal(
          anchorRef.current.localX + (pageX - anchorRef.current.pageX),
          anchorRef.current.localY + (pageY - anchorRef.current.pageY)
        );
      } else if (typeof locationX === "number") {
        updatePointerAtLocal(locationX, locationY);
      }
      return;
    }

    if (holdTimerRef.current && typeof pageX === "number" && anchorRef.current.pageX) {
      const dist = Math.hypot(
        pageX - anchorRef.current.pageX,
        pageY - anchorRef.current.pageY
      );
      if (dist > 8) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }
  };

  const webHoverProps =
    Platform.OS === "web"
      ? {
          onMouseEnter: (e) => {
            const rect = e.currentTarget?.getBoundingClientRect?.();
            if (rect) {
              beginInteraction(e.clientX - rect.left, e.clientY - rect.top, false);
            }
          },
          onMouseMove: (e) => {
            const rect = e.currentTarget?.getBoundingClientRect?.();
            if (rect) {
              updatePointerAtLocal(e.clientX - rect.left, e.clientY - rect.top);
            }
          },
          onMouseLeave: () => endInteraction(),
        }
      : {};

  const tealOrbX = normX.interpolate({ inputRange: [-1, 1], outputRange: [14, -14] });
  const tealOrbY = normY.interpolate({ inputRange: [-1, 1], outputRange: [10, -10] });
  const lavenderOrbX = normX.interpolate({ inputRange: [-1, 1], outputRange: [-14, 14] });
  const lavenderOrbY = normY.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] });

  const cardScale = auraVisibility.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.985],
  });
  const glowScale = auraVisibility.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1.05],
  });
  const activeBorderOpacity = auraVisibility.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.75],
  });
  const hintOpacity = auraVisibility.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0],
  });

  const baseBg = isDark ? "#132A2E" : "#E6FFFA";
  const endBg = isDark ? "#1C1B33" : "#F3E8FF";
  const w = cardSize.width;
  const h = cardSize.height;

  return (
    <Animated.View
      style={[
        styles.cardShell,
        {
          backgroundColor: baseBg,
          borderColor: colors.primary + "35",
          transform: [{ scale: cardScale }],
        },
      ]}
    >
      <View
        style={styles.touchArea}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          layoutRef.current = { width, height };
          const nextW = Math.ceil(width);
          const nextH = Math.ceil(height);
          setCardSize((prev) =>
            prev.width === nextW && prev.height === nextH
              ? prev
              : { width: nextW, height: nextH }
          );
        }}
        {...panResponder.panHandlers}
        {...webHoverProps}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={endInteraction}
        onTouchCancel={endInteraction}
      >
        {/* Full-Height Dynamic Gradient + Bottom-Pinned Wave */}
        {w > 0 && h > 0 && (
          <>
            <Svg
              pointerEvents="none"
              width={w}
              height={h}
              viewBox={`0 0 ${w} ${h}`}
              style={styles.bgSvg}
            >
              <Defs>
                <LinearGradient id={cardGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={baseBg} stopOpacity="1" />
                  <Stop offset="100%" stopColor={endBg} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={w} height={h} fill={`url(#${cardGradId})`} />
            </Svg>

            <Svg
              pointerEvents="none"
              width={w}
              height={52}
              viewBox={`0 0 ${w} 52`}
              style={styles.waveSvg}
            >
              <Path
                d={`M 0 30 Q ${w * 0.26} 6 ${w * 0.52} 26 T ${w} 14 L ${w} 52 L 0 52 Z`}
                fill={colors.accent}
                opacity={isDark ? "0.1" : "0.11"}
              />
            </Svg>
          </>
        )}

        {/* Parallax Ambient Orbs */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ambientOrbTeal,
            {
              backgroundColor: colors.primary,
              opacity: isDark ? 0.14 : 0.16,
              transform: [{ translateX: tealOrbX }, { translateY: tealOrbY }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ambientOrbLavender,
            {
              backgroundColor: colors.accent,
              opacity: isDark ? 0.12 : 0.14,
              transform: [{ translateX: lavenderOrbX }, { translateY: lavenderOrbY }],
            },
          ]}
        />

        {/* Finger-Following Radial Bioluminescent Glow */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.touchGlowWrap,
            {
              opacity: auraVisibility,
              transform: [
                { translateX: touchX },
                { translateY: touchY },
                { scale: glowScale },
              ],
            },
          ]}
        >
          <Svg width={200} height={200} viewBox="0 0 200 200">
            <Defs>
              <RadialGradient id={glowGradId} cx="50%" cy="50%" r="50%">
                <Stop
                  offset="0%"
                  stopColor={colors.primary}
                  stopOpacity={isDark ? "0.48" : "0.4"}
                />
                <Stop
                  offset="45%"
                  stopColor={colors.accent}
                  stopOpacity={isDark ? "0.22" : "0.18"}
                />
                <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="100" cy="100" r="100" fill={`url(#${glowGradId})`} />
          </Svg>
        </Animated.View>

        {/* Subtle Luminous Border Highlight While Active */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.activeBorderOverlay,
            {
              borderColor: colors.primary,
              opacity: activeBorderOpacity,
            },
          ]}
        />

        {/* Foreground Text */}
        <View pointerEvents="none" style={styles.content}>
          <View style={styles.topRow}>
            <View
              style={[
                styles.affirmationBadge,
                { backgroundColor: colors.primary + "22" },
              ]}
            >
              <Ionicons name="leaf-outline" size={14} color={colors.primary} />
              <Text style={[styles.cardTag, { color: colors.primary }]}>
                DAILY REFLECTION
              </Text>
            </View>
          </View>

          <Text style={[styles.affirmationText, { color: colors.text }]}>
            “{loadingAffirmation ? "Tuning into your rhythm..." : affirmation}”
          </Text>

          <Animated.Text
            style={[
              styles.hintText,
              { color: colors.textMuted, opacity: hintOpacity },
            ]}
          >
            {/* {Platform.OS === "web" ? "Hover or drag to ripple" : "Hold & glide to ripple"} */}
          </Animated.Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onRefresh}
        disabled={loadingAffirmation}
        accessibilityLabel="New affirmation"
        style={[
          styles.refreshBtn,
          {
            backgroundColor: isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(15,23,42,0.06)",
          },
        ]}
      >
        {loadingAffirmation ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 24,
    overflow: "hidden",
    position: "relative",
  },
  touchArea: {
    width: "100%",
    minHeight: 148,
    position: "relative",
    overflow: "hidden",
  },
  bgSvg: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  waveSvg: {
    position: "absolute",
    bottom: 0,
    left: 0,
  },
  ambientOrbTeal: {
    position: "absolute",
    top: -45,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  ambientOrbLavender: {
    position: "absolute",
    bottom: -55,
    left: -35,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  touchGlowWrap: {
    position: "absolute",
    left: -100,
    top: -100,
    width: 200,
    height: 200,
  },
  activeBorderOverlay: {
    borderRadius: 24,
    borderWidth: 1.5,
  },
  content: {
    padding: 20,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingRight: 40,
  },
  affirmationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  cardTag: { fontSize: 11, fontWeight: "800", letterSpacing: 0.9 },
  affirmationText: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "600",
    fontStyle: "italic",
  },
  hintText: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 10,
    textAlign: "right",
  },
  refreshBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
});