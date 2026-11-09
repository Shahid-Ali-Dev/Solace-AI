// components/YogaMascot.jsx
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

export default function YogaMascot({
  avatarId = "lumi_girl",
  size = 134,
  scaleAnim,
  isActive = false,
  phaseName = "Inhale",
  sessionComplete = false,
}) {
  const companion = getCompanionById(avatarId);
  const rawId = useId();
  const gradId = `yoga_bg_${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const blinkAnim = useRef(new Animated.Value(1)).current;
  const heartPulse = useRef(new Animated.Value(0)).current;
  const idleFloat = useRef(new Animated.Value(0)).current;

  // Natural blinking when eyes are open (idle / paused / completed)
  useEffect(() => {
    if (isActive && !sessionComplete) {
      blinkAnim.stopAnimation();
      blinkAnim.setValue(1);
      return;
    }

    let cancelled = false;
    let timerId = null;
    let anim = null;

    const scheduleBlink = (delayMs) => {
      timerId = setTimeout(() => {
        if (cancelled) return;
        anim = Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.08,
            duration: 85,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 110,
            useNativeDriver: true,
          }),
        ]);
        anim.start(({ finished }) => {
          if (finished && !cancelled) {
            scheduleBlink(2500 + Math.floor(Math.random() * 1900));
          }
        });
      }, delayMs);
    };

    scheduleBlink(500);

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      if (anim) anim.stop();
    };
  }, [isActive, sessionComplete]);

  // Subtle ambient levitation when paused, plus calm heart-glow pulse
  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(idleFloat, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(idleFloat, {
          toValue: 0,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heartPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(heartPulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    glowLoop.start();
    return () => {
      floatLoop.stop();
      glowLoop.stop();
    };
  }, []);

  const breathLevitateY = scaleAnim
    ? scaleAnim.interpolate({
        inputRange: [0.94, 1.42],
        outputRange: [4, -9],
        extrapolate: "clamp",
      })
    : 0;

  const breathScale = scaleAnim
    ? scaleAnim.interpolate({
        inputRange: [0.94, 1.42],
        outputRange: [0.96, 1.07],
        extrapolate: "clamp",
      })
    : 1;

  const idleShiftY = idleFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [2, -4],
  });

  const closedEyeOpacity = blinkAnim.interpolate({
    inputRange: [0.08, 0.4, 1],
    outputRange: [1, 0, 0],
  });

  const showMeditatingEyes = isActive && !sessionComplete;
  const isExhaling = isActive && phaseName === "Exhale";

  return (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          transform: [
            { translateY: isActive ? breathLevitateY : idleShiftY },
            { scale: isActive ? breathScale : 1 },
          ],
        },
      ]}
    >
      {/* Base Character & Lotus Pose SVG */}
      <Svg width={size} height={size} viewBox="0 0 160 160">
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={companion.bgTop} stopOpacity="0.32" />
            <Stop offset="100%" stopColor={companion.bgBottom} stopOpacity="0.18" />
          </LinearGradient>
        </Defs>

        {/* Soft Halo Backdrop */}
        <Circle cx="80" cy="80" r="76" fill={`url(#${gradId})`} />

        {/* Lotus Cushion Petals Beneath Seated Legs */}
        <Ellipse cx="80" cy="140" rx="46" ry="8" fill={companion.accent} opacity="0.22" />
        <Path
          d="M 42 135 C 45 123, 62 122, 80 129 C 98 122, 115 123, 118 135 C 102 141, 58 141, 42 135 Z"
          fill={companion.accent}
          opacity="0.28"
        />
        <Path
          d="M 55 137 C 62 126, 72 124, 80 128 C 88 124, 98 126, 105 137 Z"
          fill={companion.accent}
          opacity="0.38"
        />

        {/* Back Hair Variants (Head center: x=80, y=52) */}
        {companion.hairStyle === "long_wave" && (
          <Path
            d="M 46 95 C 43 62, 48 22, 80 17 C 112 22, 117 62, 114 95 C 105 90, 96 86, 80 86 C 64 86, 55 90, 46 95 Z"
            fill={companion.hair}
          />
        )}

        {companion.hairStyle === "curtain_bob" && (
          <Path
            d="M 48 78 C 44 56, 48 22, 80 18 C 112 22, 116 56, 112 78 C 104 75, 100 70, 97 68 L 63 68 C 60 70, 56 75, 48 78 Z"
            fill={companion.hair}
          />
        )}

        {companion.hairStyle === "space_buns" && (
          <>
            <Circle cx="56" cy="26" r="11" fill={companion.hair} />
            <Circle cx="104" cy="26" r="11" fill={companion.hair} />
            <Circle cx="54.5" cy="24.5" r="4" fill={companion.hairHighlight} opacity="0.55" />
            <Circle cx="102.5" cy="24.5" r="4" fill={companion.hairHighlight} opacity="0.55" />
            <Path
              d="M 53 60 C 51 38, 57 20, 80 19 C 103 20, 109 38, 107 60 Z"
              fill={companion.hair}
            />
            {companion.accessory === "scrunchies" && (
              <>
                <Path
                  d="M 51 34 Q 58 31 63 36"
                  stroke={companion.accessoryColor}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d="M 109 34 Q 102 31 97 36"
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
            d="M 46 95 C 44 62, 49 22, 80 18 C 111 22, 116 62, 114 95 Z"
            fill={companion.hair}
          />
        )}

        {companion.hairStyle === "curly_puff" && (
          <>
            <Circle cx="80" cy="25" r="16" fill={companion.hair} />
            <Circle cx="56" cy="38" r="13.5" fill={companion.hair} />
            <Circle cx="104" cy="38" r="13.5" fill={companion.hair} />
            <Circle cx="52" cy="56" r="12" fill={companion.hair} />
            <Circle cx="108" cy="56" r="12" fill={companion.hair} />
            <Circle cx="66" cy="27" r="12" fill={companion.hair} />
            <Circle cx="94" cy="27" r="12" fill={companion.hair} />
          </>
        )}

        {companion.hairStyle === "ribbon_ponytail" && (
          <>
            <Path
              d="M 90 24 C 114 24, 122 56, 113 84 C 104 76, 100 60, 97 44 Z"
              fill={companion.hair}
            />
            <Path
              d="M 54 60 C 53 34, 62 19, 80 19 C 98 19, 107 34, 106 60 Z"
              fill={companion.hair}
            />
          </>
        )}

        {/* Crossed Legs (Padmasana / Lotus Pose) */}
        <Path
          d="M 41 126 C 41 112, 62 112, 80 119 C 98 112, 119 112, 119 126 C 119 134, 101 136, 80 134 C 59 136, 41 134, 41 126 Z"
          fill="#1E293B"
        />
        <Path
          d="M 52 123 Q 80 131 108 123"
          stroke={companion.accent}
          strokeWidth="1.5"
          strokeOpacity="0.45"
          fill="none"
        />
        {/* Tucked Ankles / Feet */}
        <Ellipse cx="67" cy="129" rx="7" ry="4" fill={companion.skin} />
        <Ellipse cx="93" cy="129" rx="7" ry="4" fill={companion.skin} />

        {/* Torso & Yoga Top */}
        <Path
          d="M 60 119 C 61 95, 65 80, 80 80 C 95 80, 99 95, 100 119 Z"
          fill={companion.outfit}
        />
        <Path
          d="M 70 80 Q 80 89 90 80"
          stroke={companion.collar}
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Relaxed Arms & Mudra Hands Resting on Knees */}
        <Path
          d="M 65 85 C 53 94, 48 108, 48 119"
          stroke={companion.outfit}
          strokeWidth="8.5"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 95 85 C 107 94, 112 108, 112 119"
          stroke={companion.outfit}
          strokeWidth="8.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Mudra Hands */}
        <Circle cx="47.5" cy="121" r="4.8" fill={companion.skin} />
        <Circle cx="112.5" cy="121" r="4.8" fill={companion.skin} />
        <Circle
          cx="45.5"
          cy="119.5"
          r="1.8"
          stroke={companion.lip}
          strokeWidth="0.9"
          fill="none"
          opacity="0.65"
        />
        <Circle
          cx="114.5"
          cy="119.5"
          r="1.8"
          stroke={companion.lip}
          strokeWidth="0.9"
          fill="none"
          opacity="0.65"
        />

        {/* Neck & Chin Shadow */}
        <Rect x="74" y="67" width="12" height="15" rx="5" fill={companion.skin} />
        <Ellipse cx="80" cy="72" rx="6" ry="3.2" fill="#000000" opacity="0.1" />

        {/* Ears & Earrings */}
        <Circle cx="58.2" cy="54.5" r="4.1" fill={companion.skin} />
        <Circle cx="101.8" cy="54.5" r="4.1" fill={companion.skin} />
        {companion.accessory === "hoops" && (
          <>
            <Circle cx="57.2" cy="60" r="3.2" stroke={companion.accessoryColor} strokeWidth="1.5" fill="none" />
            <Circle cx="102.8" cy="60" r="3.2" stroke={companion.accessoryColor} strokeWidth="1.5" fill="none" />
          </>
        )}
        {companion.accessory === "pearls" && (
          <>
            <Circle cx="57.8" cy="58.5" r="2.3" fill={companion.accessoryColor} />
            <Circle cx="102.2" cy="58.5" r="2.3" fill={companion.accessoryColor} />
          </>
        )}

        {/* Face */}
        <Path
          d="M 59 48 C 59 31, 101 31, 101 48 C 101 63, 91 73, 80 73.5 C 69 73, 59 63, 59 48 Z"
          fill={companion.skin}
        />

        {/* Rosy Blush */}
        <Ellipse cx="65.5" cy="58.8" rx="4.5" ry="2.2" fill={companion.cheek} opacity="0.34" />
        <Ellipse cx="94.5" cy="58.8" rx="4.5" ry="2.2" fill={companion.cheek} opacity="0.34" />

        {/* Eyebrows */}
        <Path
          d="M 64.5 45.2 Q 69 43.2 73.4 45.2"
          stroke={companion.hair}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 86.6 45.2 Q 91 43.2 95.5 45.2"
          stroke={companion.hair}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Nose & Gentle Peaceful Mouth */}
        <Path
          d="M 79.4 56.6 Q 80 58.6 81.2 58"
          stroke="#9F6B52"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
        {isExhaling ? (
          <Ellipse cx="80" cy="64" rx="2.6" ry="2.1" fill={companion.lip} opacity="0.82" />
        ) : (
          <Path
            d="M 74.5 63.5 Q 80 67.4 85.5 63.5"
            stroke={companion.lip}
            strokeWidth="1.9"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* Front Bangs Variants */}
        {(companion.hairStyle === "long_wave" ||
          companion.hairStyle === "headband_waves" ||
          companion.hairStyle === "ribbon_ponytail") && (
          <>
            <Path
              d="M 55 48 C 56 26, 74 20, 87 24 C 77 32, 66 39, 57 47 Z"
              fill={companion.hair}
            />
            <Path
              d="M 77 23 C 96 22, 105 31, 104 49 C 96 40, 87 32, 77 23 Z"
              fill={companion.hair}
            />
          </>
        )}

        {companion.hairStyle === "curtain_bob" && (
          <>
            <Path
              d="M 80 22 C 65 22, 55 32, 56 53 C 60 44, 66 35, 79 29 Z"
              fill={companion.hair}
            />
            <Path
              d="M 80 22 C 95 22, 105 32, 104 53 C 100 44, 94 35, 81 29 Z"
              fill={companion.hair}
            />
          </>
        )}

        {companion.hairStyle === "space_buns" && (
          <>
            <Path
              d="M 55 45 C 58 26, 72 21, 82 24 C 74 31, 65 37, 56 44 Z"
              fill={companion.hair}
            />
            <Path
              d="M 78 23 C 92 21, 103 28, 105 46 C 97 37, 88 30, 78 23 Z"
              fill={companion.hair}
            />
          </>
        )}

        {companion.hairStyle === "curly_puff" && (
          <>
            <Circle cx="66" cy="33" r="6.2" fill={companion.hair} />
            <Circle cx="75" cy="31" r="6" fill={companion.hair} />
            <Circle cx="85" cy="31" r="6" fill={companion.hair} />
            <Circle cx="94" cy="33" r="6.2" fill={companion.hair} />
          </>
        )}

        {/* Hair Accessories */}
        {companion.accessory === "star_clip" && (
          <Path
            d="M 95 30 L 96.4 33 L 99.6 33.4 L 97.2 35.6 L 97.8 38.8 L 95 37.2 L 92.2 38.8 L 92.8 35.6 L 90.4 33.4 L 93.6 33 Z"
            fill={companion.accessoryColor}
          />
        )}
        {companion.accessory === "headband" && (
          <>
            <Path
              d="M 57 37 Q 80 21 103 37"
              stroke={companion.accessoryColor}
              strokeWidth="4.2"
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx="94" cy="29" r="3.4" fill="#FFFFFF" opacity="0.85" />
          </>
        )}
        {companion.accessory === "ribbon" && (
          <>
            <Path d="M 97 26 L 90 21 L 91 29 Z" fill={companion.accessoryColor} />
            <Path d="M 97 26 L 105 22 L 103 30 Z" fill={companion.accessoryColor} />
            <Circle cx="97" cy="26" r="2.2" fill="#FFFFFF" />
          </>
        )}
      </Svg>

      {/* Heart-Center Breath Light */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heartGlow,
          {
            width: size * 0.14,
            height: size * 0.14,
            borderRadius: size * 0.07,
            top: size * 0.56,
            backgroundColor: companion.accent,
            opacity: heartPulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.35, 0.85],
            }),
            transform: [
              {
                scale: heartPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1.35],
                }),
              },
            ],
          },
        ]}
      />

      {/* Meditating Closed Eyes (Active) vs Blinking Open Eyes (Idle / Done) */}
      {showMeditatingEyes ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={size} height={size} viewBox="0 0 160 160">
            <Path
              d="M 64.8 52.5 Q 69 55.5 73.2 52.5"
              stroke="#1E1B3A"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M 86.8 52.5 Q 91 55.5 95.2 52.5"
              stroke="#1E1B3A"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </View>
      ) : (
        <>
          <Animated.View
            pointerEvents="none"
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[StyleSheet.absoluteFill, { transform: [{ scaleY: blinkAnim }] }]}
          >
            <Svg width={size} height={size} viewBox="0 0 160 160">
              <Ellipse cx="69" cy="52" rx="3.7" ry="4.2" fill="#1E1B3A" />
              <Ellipse cx="69" cy="52.6" rx="2.6" ry="3.1" fill={companion.eyeColor} />
              <Circle cx="69" cy="52.4" r="1.5" fill="#1E1B3A" />
              <Circle cx="67.6" cy="50.5" r="1.35" fill="#FFFFFF" />
              <Path
                d="M 63.5 49.6 Q 68.8 46.5 73.2 49.8"
                stroke="#1E1B3A"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />

              <Ellipse cx="91" cy="52" rx="3.7" ry="4.2" fill="#1E1B3A" />
              <Ellipse cx="91" cy="52.6" rx="2.6" ry="3.1" fill={companion.eyeColor} />
              <Circle cx="91" cy="52.4" r="1.5" fill="#1E1B3A" />
              <Circle cx="89.6" cy="50.5" r="1.35" fill="#FFFFFF" />
              <Path
                d="M 86.8 49.8 Q 91.2 46.5 96.5 49.6"
                stroke="#1E1B3A"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[StyleSheet.absoluteFill, { opacity: closedEyeOpacity }]}
          >
            <Svg width={size} height={size} viewBox="0 0 160 160">
              <Path
                d="M 64.8 52.5 Q 69 55.2 73.2 52.5"
                stroke="#1E1B3A"
                strokeWidth="1.7"
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M 86.8 52.5 Q 91 55.2 95.2 52.5"
                stroke="#1E1B3A"
                strokeWidth="1.7"
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </Animated.View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  heartGlow: {
    position: "absolute",
  },
});