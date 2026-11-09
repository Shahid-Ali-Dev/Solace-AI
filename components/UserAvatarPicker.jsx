// components/UserAvatarPicker.jsx
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../context/ThemeContext";
import AvatarImage from "./AvatarImage";
import {
  USER_AVATAR_FILTERS,
  USER_BACKDROP_TINTS,
  USER_AVATARS,
  getTintSwatch,
} from "../constants/userAvatars";

export default function UserAvatarPicker({
  selectedBaseUrl,
  selectedBg,
  onSelectAvatar,
  onSelectTint,
  gridVisible = false,
  onOpenGrid,
  onCloseGrid,
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState("all");

  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";
  const activeSwatch = getTintSwatch(selectedBg);

  const filteredAvatars = useMemo(() => {
    if (activeFilter === "all") return USER_AVATARS;
    return USER_AVATARS.filter((item) => item.category === activeFilter);
  }, [activeFilter]);

  const triggerLight = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const renderFilterBar = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      {USER_AVATAR_FILTERS.map((filter) => {
        const isActive = activeFilter === filter.id;
        return (
          <TouchableOpacity
            key={filter.id}
            onPress={() => {
              triggerLight();
              setActiveFilter(filter.id);
            }}
            style={[
              styles.filterChip,
              {
                backgroundColor: isActive ? colors.primary : colors.surface,
                borderColor: isActive ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: isActive ? onPrimaryText : colors.textMuted },
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderTintBar = () => (
    <View style={styles.tintRow}>
      <Text style={[styles.tintLabel, { color: colors.textMuted }]}>
        Backdrop:
      </Text>
      <View style={styles.tintSwatches}>
        {USER_BACKDROP_TINTS.map((tint) => {
          const isSelected = selectedBg === tint.hex;
          return (
            <TouchableOpacity
              key={tint.id}
              onPress={() => {
                triggerLight();
                onSelectTint(tint.hex);
              }}
              accessibilityLabel={`${tint.label} avatar backdrop`}
              style={[
                styles.tintDot,
                {
                  backgroundColor: tint.hex ? tint.swatch : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderWidth: isSelected ? 2.5 : 1,
                },
              ]}
            >
              {!tint.hex && (
                <Ionicons
                  name="ban-outline"
                  size={12}
                  color={colors.textMuted}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderCard = (item, isGridCard = false) => {
    const isSelected = selectedBaseUrl === item.url;

    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => {
          triggerLight();
          onSelectAvatar(item.url);
        }}
        activeOpacity={0.8}
        style={[
          styles.avatarCard,
          isGridCard ? styles.avatarCardGrid : styles.avatarCardStrip,
          {
            backgroundColor: isSelected
              ? colors.primary + "22"
              : colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
      >
        <AvatarImage
          uri={item.url}
          size={52}
          fallbackLabel={item.label}
          backgroundColor={activeSwatch}
        />
        <Text
          numberOfLines={1}
          style={[
            styles.gridAvatarLabel,
            { color: isSelected ? colors.primary : colors.textMuted },
          ]}
        >
          {item.label}
        </Text>

        {isSelected && (
          <View
            style={[styles.checkBadge, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="checkmark" size={10} color={onPrimaryText} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.heading, { color: colors.text }]}>
            Your Profile Character
          </Text>
          <Text style={[styles.subtext, { color: colors.textMuted }]}>
            Swipe or browse all {USER_AVATARS.length} styles
          </Text>
        </View>

        {onOpenGrid && (
          <TouchableOpacity
            onPress={() => {
              triggerLight();
              onOpenGrid();
            }}
            style={[
              styles.seeAllBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="grid-outline" size={13} color={colors.primary} />
            <Text style={[styles.seeAllText, { color: colors.primary }]}>
              All {USER_AVATARS.length}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {renderFilterBar()}
      {renderTintBar()}

      {/* Windowed Horizontal Strip */}
      <FlatList
        horizontal
        data={filteredAvatars}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderCard(item, false)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripRow}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={5}
      />

      {/* Full 20-Character Browse Modal */}
      <Modal
        visible={gridVisible}
        transparent
        animationType="slide"
        onRequestClose={onCloseGrid}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            <View
              style={[styles.modalHeader, { borderBottomColor: colors.border }]}
            >
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Choose Your Character
                </Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                  {filteredAvatars.length} styles available
                </Text>
              </View>
              <TouchableOpacity onPress={onCloseGrid} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredAvatars}
              numColumns={4}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => renderCard(item, true)}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.modalBody}
              showsVerticalScrollIndicator={false}
              initialNumToRender={8}
              maxToRenderPerBatch={4}
              windowSize={5}
              ListHeaderComponent={
                <View style={{ marginBottom: 4 }}>
                  {renderFilterBar()}
                  {renderTintBar()}
                </View>
              }
              ListFooterComponent={
                <TouchableOpacity
                  onPress={onCloseGrid}
                  style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.doneBtnText, { color: onPrimaryText }]}>
                    Done
                  </Text>
                </TouchableOpacity>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 22, marginBottom: 4 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  heading: { fontSize: 15, fontWeight: "700" },
  subtext: { fontSize: 12, marginTop: 1 },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  seeAllText: { fontSize: 12, fontWeight: "700" },
  filterRow: { gap: 8, paddingBottom: 10 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: "600" },
  tintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  tintLabel: { fontSize: 12, fontWeight: "600" },
  tintSwatches: { flexDirection: "row", alignItems: "center", gap: 8 },
  tintDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  stripRow: { gap: 10, paddingVertical: 2 },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: 10,
  },
  avatarCard: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  avatarCardStrip: { width: 84 },
  avatarCardGrid: { width: "23.2%" },
  gridAvatarLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 5,
  },
  checkBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalSub: { fontSize: 12, marginTop: 2 },
  modalBody: { padding: 16 },
  doneBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  doneBtnText: { fontSize: 15, fontWeight: "700" },
});