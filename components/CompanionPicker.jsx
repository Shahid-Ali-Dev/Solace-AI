// components/CompanionPicker.jsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { COMPANION_AVATARS, getCompanionById } from "../constants/companions";
import CompanionAvatar from "./CompanionAvatar";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

export default function CompanionPicker({
  layout = "horizontal",
  hideHeader = false,
}) {
  const { colors } = useTheme();
  const { user, updateProfile } = useAuth();
  const [savingId, setSavingId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [pressedId, setPressedId] = useState(null);

  const selectedId = getCompanionById(user?.companionAvatar).id;
  const isGrid = layout === "grid";

  const handleSelect = async (id) => {
    if (id === selectedId || savingId) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSavingId(id);
    try {
      await updateProfile({ companionAvatar: id });
    } catch (err) {
      console.warn("Failed to save companion avatar:", err?.message);
    } finally {
      setSavingId(null);
    }
  };

  const renderCard = (item) => {
    const isSelected = selectedId === item.id;
    const isSaving = savingId === item.id;
    const isHovered = hoveredId === item.id;
    const isPressed = pressedId === item.id;
    const shouldAnimate = isSelected || isSaving || isHovered || isPressed;

    return (
      <Pressable
        key={item.id}
        onPress={() => handleSelect(item.id)}
        onPressIn={() => setPressedId(item.id)}
        onPressOut={() => setPressedId((prev) => (prev === item.id ? null : prev))}
        onHoverIn={() => setHoveredId(item.id)}
        onHoverOut={() => setHoveredId((prev) => (prev === item.id ? null : prev))}
        style={({ pressed }) => [
          styles.card,
          isGrid ? styles.cardGrid : styles.cardHorizontal,
          {
            backgroundColor: isSelected
              ? colors.primary + "14"
              : isHovered
              ? colors.surfaceElevated
              : colors.surface,
            borderColor: isSelected
              ? colors.primary
              : isHovered
              ? colors.primary + "70"
              : colors.border,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        {item.isDefault && (
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.primary + "22" },
            ]}
          >
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              Default
            </Text>
          </View>
        )}

        <CompanionAvatar
          avatarId={item.id}
          size={isGrid ? 62 : 58}
          isThinking={false}
          animated={shouldAnimate}
        />

        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
          {item.name}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.tagline, { color: colors.textMuted }]}
        >
          {item.tagline}
        </Text>

        {isSaving ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{ marginTop: 6 }}
          />
        ) : isSelected ? (
          <Ionicons
            name="checkmark-circle"
            size={18}
            color={colors.primary}
            style={{ marginTop: 6 }}
          />
        ) : (
          <View style={{ height: 24 }} />
        )}
      </Pressable>
    );
  };

  return (
    <View style={isGrid ? styles.gridContainer : styles.container}>
      {!hideHeader && (
        <>
          <Text style={[styles.label, { color: colors.text }]}>
            AI Companion Character
          </Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Choose your AI companion (updates name & style across Solace)
          </Text>
        </>
      )}

      {isGrid ? (
        <View style={styles.grid}>{COMPANION_AVATARS.map(renderCard)}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {COMPANION_AVATARS.map(renderCard)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24, marginBottom: 4 },
  gridContainer: { paddingVertical: 4 },
  label: { fontSize: 15, fontWeight: "700" },
  hint: { fontSize: 12, marginTop: 2, marginBottom: 12 },
  row: { gap: 12, paddingVertical: 4 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  card: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
  },
  cardHorizontal: { width: 128 },
  cardGrid: { width: "48%" },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },
  name: { fontSize: 14, fontWeight: "700", marginTop: 10 },
  tagline: { fontSize: 11, marginTop: 2, textAlign: "center" },
});