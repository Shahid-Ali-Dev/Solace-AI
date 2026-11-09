// components/CompanionAvatar.jsx
import React, { useEffect, useRef, useId } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";
import Svg, {
  Circle,
  Ellipse,
  Path,
  Rect,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { getCompanionById } from "../constants/companions";

function FemaleCharacterSvg({ companion, size, blinkAnim, sparkleAnim }) {
  const rawId = useId();
  const gradId = `bg_${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const closedEyeOpacity = blinkAnim.interpolate({
    inputRange: [0.08, 0.4, 1],
    outputRange: [1, 0, 0],
  });

  const sparkleScale = sparkleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1.15],
  });

  const sparkleOpacity = sparkleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });

  return (
    <View
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
      }}
    >
      {/* Character Base */}
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={companion.bgTop} />
            <Stop offset="100%" stopColor={companion.bgBottom} />
          </LinearGradient>
        </Defs>

        {/* Soft Pastel Gradient Backdrop */}
        <Circle cx="50" cy="50" r="50" fill={`url(#${gradId})`} />

        {/* Back Hair Variants */}
        {companion.hairStyle === "long_wave" && (
          <>
            <Path
              d="M 14 99 C 11 65, 16 20, 50 15 C 84 20, 89 65, 86 99 Z"
              fill={companion.hair}
            />
            <Path
              d="M 20 88 C 16 70, 19 42, 27 30"
              stroke={companion.hairHighlight}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          </>
        )}

        {companion.hairStyle === "curtain_bob" && (
          <Path
            d="M 18 76 C 14 54, 18 20, 50 16 C 82 20, 86 54, 82 76 C 74 73, 70 68, 67 66 L 33 66 C 30 68, 26 73, 18 76 Z"
            fill={companion.hair}
          />
        )}

        {companion.hairStyle === "space_buns" && (
          <>
            <Circle cx="26" cy="24" r="11" fill={companion.hair} />
            <Circle cx="74" cy="24" r="11" fill={companion.hair} />
            <Circle cx="24.5" cy="22.5" r="4" fill={companion.hairHighlight} opacity="0.55" />
            <Circle cx="72.5" cy="22.5" r="4" fill={companion.hairHighlight} opacity="0.55" />
            <Path
              d="M 23 58 C 21 36, 27 18, 50 17 C 73 18, 79 36, 77 58 Z"
              fill={companion.hair}
            />
            {companion.accessory === "scrunchies" && (
              <>
                <Path
                  d="M 21 32 Q 28 29 33 34"
                  stroke={companion.accessoryColor}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d="M 79 32 Q 72 29 67 34"
                  stroke={companion.accessoryColor}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            )}
          </>
        )}

        {companion.hairStyle === "headband_waves" && (
          <Path
            d="M 14 99 C 12 64, 17 20, 50 16 C 83 20, 88 64, 86 99 Z"
            fill={companion.hair}
          />
        )}

        {companion.hairStyle === "curly_puff" && (
          <>
            <Circle cx="50" cy="23" r="16" fill={companion.hair} />
            <Circle cx="26" cy="36" r="13.5" fill={companion.hair} />
            <Circle cx="74" cy="36" r="13.5" fill={companion.hair} />
            <Circle cx="22" cy="54" r="12" fill={companion.hair} />
            <Circle cx="78" cy="54" r="12" fill={companion.hair} />
            <Circle cx="25" cy="70" r="10.5" fill={companion.hair} />
            <Circle cx="75" cy="70" r="10.5" fill={companion.hair} />
            <Circle cx="36" cy="25" r="12" fill={companion.hair} />
            <Circle cx="64" cy="25" r="12" fill={companion.hair} />
            <Circle cx="50" cy="18" r="5" fill={companion.hairHighlight} opacity="0.45" />
          </>
        )}

        {companion.hairStyle === "ribbon_ponytail" && (
          <>
            <Path
              d="M 60 22 C 84 22, 92 54, 83 84 C 74 76, 70 58, 67 42 Z"
              fill={companion.hair}
            />
            <Path
              d="M 24 58 C 23 32, 32 17, 50 17 C 68 17, 77 32, 76 58 Z"
              fill={companion.hair}
            />
          </>
        )}

        {/* Shoulders & Cozy Top */}
        <Path
          d="M 18 100 C 21 80, 35 76, 50 76 C 65 76, 79 80, 82 100 Z"
          fill={companion.outfit}
        />
        <Path
          d="M 38 76 Q 50 85 62 76"
          stroke={companion.collar}
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Neck & Chin Shadow */}
        <Rect x="44" y="65" width="12" height="14" rx="5" fill={companion.skin} />
        <Ellipse cx="50" cy="70" rx="6" ry="3.2" fill="#000000" opacity="0.1" />

        {/* Ears */}
        <Circle cx="28.2" cy="52.5" r="4.1" fill={companion.skin} />
        <Circle cx="71.8" cy="52.5" r="4.1" fill={companion.skin} />

        {/* Earrings */}
        {companion.accessory === "hoops" && (
          <>
            <Circle
              cx="27.2"
              cy="58"
              r="3.2"
              stroke={companion.accessoryColor}
              strokeWidth="1.5"
              fill="none"
            />
            <Circle
              cx="72.8"
              cy="58"
              r="3.2"
              stroke={companion.accessoryColor}
              strokeWidth="1.5"
              fill="none"
            />
          </>
        )}
        {companion.accessory === "pearls" && (
          <>
            <Circle cx="27.8" cy="56.5" r="2.3" fill={companion.accessoryColor} />
            <Circle cx="72.2" cy="56.5" r="2.3" fill={companion.accessoryColor} />
          </>
        )}

        {/* Face */}
        <Path
          d="M 29 46 C 29 29, 71 29, 71 46 C 71 61, 61 71, 50 71.5 C 39 71, 29 61, 29 46 Z"
          fill={companion.skin}
        />

        {/* Rosy Blush */}
        <Ellipse cx="35.5" cy="56.8" rx="4.5" ry="2.2" fill={companion.cheek} opacity="0.34" />
        <Ellipse cx="64.5" cy="56.8" rx="4.5" ry="2.2" fill={companion.cheek} opacity="0.34" />

        {/* Eyebrows */}
        <Path
          d="M 34.5 43.2 Q 39 41.2 43.4 43.2"
          stroke={companion.hair}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 56.6 43.2 Q 61 41.2 65.5 43.2"
          stroke={companion.hair}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Nose & Warm Feminine Smile */}
        <Path
          d="M 49.4 54.6 Q 50 56.6 51.2 56"
          stroke="#9F6B52"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 44.5 61.5 Q 50 65.6 55.5 61.5"
          stroke={companion.lip}
          strokeWidth="1.9"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 47.6 64.2 Q 50 65.3 52.4 64.2"
          stroke={companion.lip}
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.6"
          fill="none"
        />

        {/* Front Bangs Variants */}
        {(companion.hairStyle === "long_wave" ||
          companion.hairStyle === "headband_waves" ||
          companion.hairStyle === "ribbon_ponytail") && (
          <>
            <Path
              d="M 25 46 C 26 24, 44 18, 57 22 C 47 30, 36 37, 27 45 Z"
              fill={companion.hair}
            />
            <Path
              d="M 47 21 C 66 20, 75 29, 74 47 C 66 38, 57 30, 47 21 Z"
              fill={companion.hair}
            />
          </>
        )}

        {companion.hairStyle === "curtain_bob" && (
          <>
            <Path
              d="M 50 20 C 35 20, 25 30, 26 51 C 30 42, 36 33, 49 27 Z"
              fill={companion.hair}
            />
            <Path
              d="M 50 20 C 65 20, 75 30, 74 51 C 70 42, 64 33, 51 27 Z"
              fill={companion.hair}
            />
          </>
        )}

        {companion.hairStyle === "space_buns" && (
          <>
            <Path
              d="M 25 43 C 28 24, 42 19, 52 22 C 44 29, 35 35, 26 42 Z"
              fill={companion.hair}
            />
            <Path
              d="M 48 21 C 62 19, 73 26, 75 44 C 67 35, 58 28, 48 21 Z"
              fill={companion.hair}
            />
            <Path
              d="M 27 44 Q 24 58 27 67"
              stroke={companion.hair}
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M 73 44 Q 76 58 73 67"
              stroke={companion.hair}
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
            />
          </>
        )}

        {companion.hairStyle === "curly_puff" && (
          <>
            <Circle cx="36" cy="31" r="6.2" fill={companion.hair} />
            <Circle cx="45" cy="29" r="6" fill={companion.hair} />
            <Circle cx="55" cy="29" r="6" fill={companion.hair} />
            <Circle cx="64" cy="31" r="6.2" fill={companion.hair} />
            <Path
              d="M 28 43 Q 25 53 28 60"
              stroke={companion.hair}
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M 72 43 Q 75 53 72 60"
              stroke={companion.hair}
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            />
          </>
        )}

        {/* Hair Accessories */}
        {companion.accessory === "star_clip" && (
          <Path
            d="M 65 28 L 66.4 31 L 69.6 31.4 L 67.2 33.6 L 67.8 36.8 L 65 35.2 L 62.2 36.8 L 62.8 33.6 L 60.4 31.4 L 63.6 31 Z"
            fill={companion.accessoryColor}
          />
        )}

        {companion.accessory === "headband" && (
          <>
            <Path
              d="M 27 35 Q 50 19 73 35"
              stroke={companion.accessoryColor}
              strokeWidth="4.2"
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx="64" cy="27" r="3.4" fill="#FFFFFF" opacity="0.85" />
          </>
        )}

        {companion.accessory === "ribbon" && (
          <>
            <Path d="M 67 24 L 60 19 L 61 27 Z" fill={companion.accessoryColor} />
            <Path d="M 67 24 L 75 20 L 73 28 Z" fill={companion.accessoryColor} />
            <Circle cx="67" cy="24" r="2.2" fill="#FFFFFF" />
          </>
        )}
      </Svg>

      {/* Open Animated Eyes Layer (Centered at y=50 for clean scaleY blink) */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scaleY: blinkAnim }] },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* Left Eye */}
          <Ellipse cx="39" cy="50" rx="3.7" ry="4.2" fill="#1E1B3A" />
          <Ellipse cx="39" cy="50.6" rx="2.6" ry="3.1" fill={companion.eyeColor} />
          <Circle cx="39" cy="50.4" r="1.5" fill="#1E1B3A" />
          <Circle cx="37.6" cy="48.5" r="1.35" fill="#FFFFFF" />
          <Circle cx="40.3" cy="51.7" r="0.65" fill="#FFFFFF" opacity="0.85" />
          <Path
            d="M 33.5 47.6 Q 38.8 44.5 43.2 47.8"
            stroke="#1E1B3A"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 34.4 47.4 L 32.8 45.9"
            stroke="#1E1B3A"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Right Eye */}
          <Ellipse cx="61" cy="50" rx="3.7" ry="4.2" fill="#1E1B3A" />
          <Ellipse cx="61" cy="50.6" rx="2.6" ry="3.1" fill={companion.eyeColor} />
          <Circle cx="61" cy="50.4" r="1.5" fill="#1E1B3A" />
          <Circle cx="59.6" cy="48.5" r="1.35" fill="#FFFFFF" />
          <Circle cx="62.3" cy="51.7" r="0.65" fill="#FFFFFF" opacity="0.85" />
          <Path
            d="M 56.8 47.8 Q 61.2 44.5 66.5 47.6"
            stroke="#1E1B3A"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 65.6 47.4 L 67.2 45.9"
            stroke="#1E1B3A"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      {/* Closed Eyelashes Layer (Fades in gently during blink) */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: closedEyeOpacity }]}
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path
            d="M 34.8 50.5 Q 39 53.2 43.2 50.5"
            stroke="#1E1B3A"
            strokeWidth="1.7"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 56.8 50.5 Q 61 53.2 65.2 50.5"
            stroke="#1E1B3A"
            strokeWidth="1.7"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Ambient Sparkles Layer */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: sparkleOpacity,
            transform: [{ scale: sparkleScale }],
          },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path
            d="M 18 22 L 19.2 25 L 22.2 26.2 L 19.2 27.4 L 18 30.4 L 16.8 27.4 L 13.8 26.2 L 16.8 25 Z"
            fill="#FFFFFF"
            opacity="0.9"
          />
          <Circle cx="83" cy="25" r="1.6" fill="#FFFFFF" opacity="0.85" />
          <Circle cx="15" cy="76" r="1.4" fill="#FFFFFF" opacity="0.7" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export default function CompanionAvatar({
  avatarId = "lumi_girl",
  size = 44,
  isThinking = false,
  animated = true,
}) {
  const companion = getCompanionById(avatarId);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated || !isThinking) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => {
      pulseLoop.stop();
      pulseAnim.setValue(0);
    };
  }, [animated, isThinking]);

  useEffect(() => {
    if (!animated) {
      sparkleAnim.stopAnimation();
      sparkleAnim.setValue(0);
      return;
    }

    const duration = isThinking ? 800 : 2200;
    const sparkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    sparkleLoop.start();
    return () => {
      sparkleLoop.stop();
      sparkleAnim.setValue(0);
    };
  }, [animated, isThinking]);

  useEffect(() => {
    if (!animated) {
      blinkAnim.stopAnimation();
      blinkAnim.setValue(1);
      return;
    }

    let cancelled = false;
    let timerId = null;
    let currentAnim = null;

    const scheduleBlink = (delayMs) => {
      timerId = setTimeout(() => {
        if (cancelled) return;

        const doDoubleBlink = Math.random() < 0.3;
        const steps = [
          Animated.timing(blinkAnim, { toValue: 0.08, duration: 85, useNativeDriver: true }),
          Animated.timing(blinkAnim, { toValue: 1, duration: 110, useNativeDriver: true }),
        ];

        if (doDoubleBlink) {
          steps.push(
            Animated.delay(130),
            Animated.timing(blinkAnim, { toValue: 0.08, duration: 80, useNativeDriver: true }),
            Animated.timing(blinkAnim, { toValue: 1, duration: 100, useNativeDriver: true })
          );
        }

        currentAnim = Animated.sequence(steps);
        currentAnim.start(({ finished }) => {
          if (finished && !cancelled) {
            const nextDelay = 2400 + Math.floor(Math.random() * 2000);
            scheduleBlink(nextDelay);
          }
        });
      }, delayMs);
    };

    // Trigger a natural blink shortly after becoming active (hover / select / mount)
    scheduleBlink(350);

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      if (currentAnim) currentAnim.stop();
      blinkAnim.stopAnimation();
      blinkAnim.setValue(1);
    };
  }, [animated]);

  const outerHaloScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.04, 1.2],
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.halo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: companion.accent + "28",
            transform: [{ scale: outerHaloScale }],
          },
        ]}
      />

      <FemaleCharacterSvg
        companion={companion}
        size={size}
        blinkAnim={blinkAnim}
        sparkleAnim={sparkleAnim}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { justifyContent: "center", alignItems: "center" },
  halo: { position: "absolute" },
});