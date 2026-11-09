// app/(tabs)/_layout.jsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const bottomInset = Math.max(insets.bottom, Platform.OS === "ios" ? 20 : 12);
  const contentHeight = 58;
  const topPadding = 8;
  const tabHeight = topPadding + contentHeight + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: Platform.OS !== "web",
        tabBarAllowFontScaling: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor:
            Platform.OS === "ios"
              ? isDark
                ? "rgba(11, 15, 23, 0.85)"
                : "rgba(255, 255, 255, 0.85)"
              : isDark
              ? "#0F1521"
              : "#FFFFFF",
          elevation: 0,
          height: tabHeight,
          paddingTop: topPadding,
          paddingBottom: bottomInset,
        },
        tabBarItemStyle: {
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 2,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          lineHeight: 16,
          includeFontPadding: false,
          paddingBottom: 2,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Ionicons name="leaf-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Solace AI",
          tabBarIcon: ({ color }) => (
            <Ionicons name="sparkles-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="breathe"
        options={{
          title: "Breathe",
          tabBarIcon: ({ color }) => (
            <Ionicons name="radio-button-on-outline" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}