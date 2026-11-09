// components/AnimatedSplash.jsx
import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import CompanionAvatar from "./CompanionAvatar";
import { getCompanionById } from "../constants/companions";

const MOTES = [
  { left: "16%", top: "28%", size: 5, delay: 0, duration: 2800 },
  { left: "82%", top: "24%", size: 4, delay: 400, duration: 3100 },
  { left: "24%", top: "68%", size: 6, delay: 700, duration: 2600 },
  { left: "78%", top: "62%", size: 4.5, delay: 250, duration: 2900 },
  { left: "12%", top: "48%", size: 3.5, delay: 900, duration: 3200 },
  { left: "88%", top: "45%", size: 5, delay: 550, duration: 2700 },
];

export default function AnimatedSplash({ readyToDismiss, onFinished }) {
  const theme = useTheme();
  const { user } = useAuth();

  const isDark = theme?.isDark ?? true;
  const themeColors = theme?.colors || {};
  const primary = themeColors.primary || (isDark ? "#2DD4BF" : "#0D9488");
  const accent = themeColors.accent || (isDark ? "#A78BFA" : "#7C3AED");

  const activeCompanion = useMemo(
    () => getCompanionById(user?.companionAvatar),
    [user?.companionAvatar]
  );

  const realFirstName = useMemo(() => {
    const raw = user?.name?.trim();
    if (!raw || ["Friend", "Guest Explorer"].includes(raw)) return null;
    return raw.split(/\s+/)[0];
  }, [user?.name]);

  // Entrance & dismissal animations
  const mascotScale = useRef(new Animated.Value(0.72)).current;
  const mascotOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(14)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subY = useRef(new Animated.Value(10)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerScale = useRef(new Animated.Value(1)).current;

  // Theme crossfade (starts dark by default, adapts smoothly if app is light)
  const darkLayerOpacity = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  // Ambient continuous loops
  const floatAnim = useRef(new Animated.Value(0)).current;
  const orbitSpin = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const auroraDrift = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const moteAnims = useRef(MOTES.map(() => new Animated.Value(0))).current;

  const dismissedRef = useRef(false);

  useEffect(() => {
    Animated.timing(darkLayerOpacity, {
      toValue: isDark ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isDark]);

  useEffect(() => {
    // Staggered hero entrance (completes cleanly within ~700ms)
    Animated.parallel([
      Animated.spring(mascotScale, {
        toValue: 1,
        friction: 7,
        tension: 54,
        useNativeDriver: true,
      }),
      Animated.timing(mascotOpacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(140),
        Animated.parallel([
          Animated.timing(titleY, {
            toValue: 0,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(280),
        Animated.parallel([
          Animated.timing(subY, {
            toValue: 0,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(subOpacity, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    // Gentle levitating breath
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1450,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1450,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Smooth 360 orbital ring
    const orbitLoop = Animated.loop(
      Animated.timing(orbitSpin, {
        toValue: 1,
        duration: 16000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Ambient aurora drift
    const auroraLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(auroraDrift, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(auroraDrift, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Shimmer sweep bar
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1350,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );

    // Concentric breath ripples
    const makePulse = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const p1 = makePulse(ring1, 0);
    const p2 = makePulse(ring2, 1100);

    // Floating firefly motes
    const moteLoops = moteAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(MOTES[i].delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: MOTES[i].duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      )
    );

    floatLoop.start();
    orbitLoop.start();
    auroraLoop.start();
    shimmerLoop.start();
    p1.start();
    p2.start();
    moteLoops.forEach((l) => l.start());

    return () => {
      floatLoop.stop();
      orbitLoop.stop();
      auroraLoop.stop();
      shimmerLoop.stop();
      p1.stop();
      p2.stop();
      moteLoops.forEach((l) => l.stop());
    };
  }, []);

  useEffect(() => {
    if (!readyToDismiss || dismissedRef.current) return;
    dismissedRef.current = true;

    Animated.parallel([
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 420,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(containerScale, {
        toValue: 1.05,
        duration: 420,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinished?.();
    });
  }, [readyToDismiss]);

  const companionAccent = activeCompanion.accent || primary;
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const mutedColor = isDark ? "#94A3B8" : "#475569";
  const cardBg = isDark
    ? "rgba(255, 255, 255, 0.06)"
    : "rgba(255, 255, 255, 0.85)";
  const cardBorder = isDark
    ? "rgba(255, 255, 255, 0.14)"
    : "rgba(15, 23, 42, 0.08)";

  const mascotTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, -6],
  });

  const spinDeg = orbitSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const orbTopTransform = [
    {
      translateX: auroraDrift.interpolate({
        inputRange: [0, 1],
        outputRange: [-12, 18],
      }),
    },
    {
      translateY: auroraDrift.interpolate({
        inputRange: [0, 1],
        outputRange: [-8, 16],
      }),
    },
    {
      scale: auroraDrift.interpolate({
        inputRange: [0, 1],
        outputRange: [0.95, 1.08],
      }),
    },
  ];

  const orbBottomTransform = [
    {
      translateX: auroraDrift.interpolate({
        inputRange: [0, 1],
        outputRange: [14, -16],
      }),
    },
    {
      translateY: auroraDrift.interpolate({
        inputRange: [0, 1],
        outputRange: [10, -14],
      }),
    },
    {
      scale: auroraDrift.interpolate({
        inputRange: [0, 1],
        outputRange: [1.06, 0.94],
      }),
    },
  ];

  const renderRing = (anim, color) => (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid
      style={[
        styles.pulseRing,
        {
          borderColor: color,
          opacity: anim.interpolate({
            inputRange: [0, 0.2, 1],
            outputRange: [0, 0.6, 0],
          }),
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.84, 1.85],
              }),
            },
          ],
        },
      ]}
    />
  );

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          backgroundColor: isDark ? "#0B0F17" : "#F8FAFC",
          opacity: containerOpacity,
          transform: [{ scale: containerScale }],
        },
      ]}
    >
      {/* Adaptive Light Backdrop */}
      <LinearGradient
        colors={["#F8FAFC", "#ECFDF9", "#F3EEFF"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Default Dark Backdrop (crossfades cleanly based on app theme) */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: darkLayerOpacity }]}
      >
        <LinearGradient
          colors={["#0B0F17", "#111B2E", "#0B0F17"]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Drifting Ambient Auroras */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbTop,
          {
            backgroundColor: companionAccent,
            opacity: isDark ? 0.14 : 0.16,
            transform: orbTopTransform,
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbBottom,
          {
            backgroundColor: accent,
            opacity: isDark ? 0.14 : 0.15,
            transform: orbBottomTransform,
          },
        ]}
      />

      {/* Floating Serenity Motes */}
      {MOTES.map((m, idx) => {
        const anim = moteAnims[idx];
        return (
          <Animated.View
            key={idx}
            pointerEvents="none"
            style={[
              styles.mote,
              {
                left: m.left,
                top: m.top,
                width: m.size,
                height: m.size,
                borderRadius: m.size / 2,
                backgroundColor: idx % 2 === 0 ? companionAccent : accent,
                opacity: anim.interpolate({
                  inputRange: [0, 0.35, 0.75, 1],
                  outputRange: [0, 0.75, 0.65, 0],
                }),
                transform: [
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, -26],
                    }),
                  },
                  {
                    scale: anim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.6, 1.2, 0.7],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}

      {/* Centerpiece */}
      <View style={styles.center}>
        <View style={styles.emblemWrap}>
          {renderRing(ring1, companionAccent)}
          {renderRing(ring2, accent)}

          {/* Rotating Orbital Ring */}
          <Animated.View
            pointerEvents="none"
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[
              styles.orbitWrap,
              { transform: [{ rotate: spinDeg }] },
            ]}
          >
            <Svg width={154} height={154} viewBox="0 0 154 154">
              <Circle
                cx="77"
                cy="77"
                r="71"
                stroke={companionAccent}
                strokeWidth="1.2"
                strokeOpacity={isDark ? 0.38 : 0.45}
                strokeDasharray="6 8"
                fill="none"
              />
              <Circle cx="77" cy="6" r="3.2" fill={companionAccent} />
              <Circle cx="77" cy="148" r="2.6" fill={accent} />
            </Svg>
          </Animated.View>

          {/* Animated Mascot Character */}
          <Animated.View
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[
              styles.mascotShell,
              {
                backgroundColor: cardBg,
                borderColor: companionAccent + "65",
                opacity: mascotOpacity,
                transform: [
                  { scale: mascotScale },
                  { translateY: mascotTranslateY },
                ],
              },
            ]}
          >
            <CompanionAvatar
              avatarId={activeCompanion.id}
              size={104}
              animated
            />

            {/* Mini Solace Brand Emblem */}
            <View
              style={[
                styles.miniBrandBadge,
                {
                  backgroundColor: isDark ? "#141D2E" : "#FFFFFF",
                  borderColor: companionAccent + "75",
                },
              ]}
            >
              <Image
                source={require("../assets/icon.png")}
                style={styles.miniLogo}
                resizeMode="contain"
              />
            </View>
          </Animated.View>
        </View>

        <Animated.Text
          style={[
            styles.brand,
            {
              color: textColor,
              opacity: titleOpacity,
              transform: [{ translateY: titleY }],
            },
          ]}
        >
          Solace AI
        </Animated.Text>

        <Animated.View
          style={[
            styles.subWrap,
            {
              opacity: subOpacity,
              transform: [{ translateY: subY }],
            },
          ]}
        >
          <Text style={[styles.tagline, { color: mutedColor }]}>
            {realFirstName
              ? `Welcome back, ${realFirstName}`
              : "Breathe. Reflect. Grow."}
          </Text>

          <View
            style={[
              styles.pill,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
              },
            ]}
          >
            <Ionicons name="sparkles" size={12} color={companionAccent} />
            <Text style={[styles.pillText, { color: companionAccent }]}>
              {realFirstName
                ? `${activeCompanion.name} is ready for you`
                : `Meet ${activeCompanion.name} • Your Wellness Companion`}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Bottom Calm Shimmer Track */}
      <Animated.View
        style={[
          styles.bottomTrackWrap,
          { opacity: subOpacity },
        ]}
      >
        <View
          style={[
            styles.shimmerTrack,
            {
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(15, 23, 42, 0.08)",
            },
          ]}
        >
          <Animated.View
            style={[
              styles.shimmerBar,
              {
                backgroundColor: companionAccent,
                transform: [
                  {
                    translateX: shimmerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-54, 118],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  orbTop: {
    position: "absolute",
    top: -70,
    left: -70,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  orbBottom: {
    position: "absolute",
    bottom: -80,
    right: -70,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  mote: {
    position: "absolute",
  },
  center: {
    alignItems: "center",
    paddingHorizontal: 28,
  },
  emblemWrap: {
    width: 170,
    height: 170,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  pulseRing: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 1.5,
  },
  orbitWrap: {
    position: "absolute",
    width: 154,
    height: 154,
    justifyContent: "center",
    alignItems: "center",
  },
  mascotShell: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  miniBrandBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    padding: 5,
  },
  miniLogo: {
    width: "100%",
    height: "100%",
  },
  brand: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  subWrap: {
    alignItems: "center",
    marginTop: 6,
    gap: 14,
  },
  tagline: {
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
  bottomTrackWrap: {
    position: "absolute",
    bottom: 52,
    alignItems: "center",
  },
  shimmerTrack: {
    width: 118,
    height: 3.5,
    borderRadius: 2,
    overflow: "hidden",
  },
  shimmerBar: {
    width: 52,
    height: "100%",
    borderRadius: 2,
  },
});