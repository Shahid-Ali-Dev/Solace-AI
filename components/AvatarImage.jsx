// components/AvatarImage.jsx
import React, { useState, useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../context/ThemeContext";

const MAX_RETRIES = 3;

export default function AvatarImage({
  uri,
  size = 52,
  fallbackLabel = "?",
  backgroundColor = "transparent",
}) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(Boolean(uri));
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const pulseAnim = useRef(new Animated.Value(0.35)).current;
  const retryTimerRef = useRef(null);

  useEffect(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setLoading(Boolean(uri));
    setFailed(false);
    setRetryCount(0);
  }, [uri]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!loading || failed) {
      pulseAnim.stopAnimation();
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.75,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [loading, failed]);

  const handleError = () => {
    if (retryCount < MAX_RETRIES) {
      const jitter = Math.floor(Math.random() * 400);
      const delay = 500 * Math.pow(2, retryCount) + jitter;
      retryTimerRef.current = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
      }, delay);
    } else {
      setLoading(false);
      setFailed(true);
    }
  };

  const initial = (fallbackLabel || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
      ]}
    >
      {loading && !failed && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: size / 2,
              backgroundColor: colors.surfaceElevated,
              opacity: pulseAnim,
            },
          ]}
        />
      )}

      {(!uri || failed) && (
        <Text
          style={[
            styles.fallbackText,
            { color: colors.textMuted, fontSize: Math.round(size * 0.38) },
          ]}
        >
          {initial}
        </Text>
      )}

      {Boolean(uri) && !failed && (
        <Image
          key={`${uri}_${retryCount}`}
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={180}
          onLoad={() => setLoading(false)}
          onError={handleError}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  fallbackText: {
    fontWeight: "700",
  },
});