// app/profile.jsx
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter, useNavigation } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import CompanionPicker from "../components/CompanionPicker";
import UserAvatarPicker from "../components/UserAvatarPicker";
import AvatarImage from "../components/AvatarImage";
import {
  USER_AVATARS,
  WELLNESS_GOALS,
  stripBgParam,
  extractBgParam,
  buildAvatarUrl,
  getTintSwatch,
} from "../constants/userAvatars";

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const { user, updateProfile, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  const initialAvatar = user?.avatar || USER_AVATARS[0].url;
  
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [name, setName] = useState(user?.name || "Friend");
  const [selectedBaseUrl, setSelectedBaseUrl] = useState(stripBgParam(initialAvatar));
  const [selectedBg, setSelectedBg] = useState(extractBgParam(initialAvatar));
  const [selectedGoal, setSelectedGoal] = useState(
    user?.wellnessGoal || WELLNESS_GOALS[0]
  );

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [unsavedModalVisible, setUnsavedModalVisible] = useState(false);

  const bypassGuardRef = useRef(false);
  const pendingNavActionRef = useRef(null);
  const hasUnsavedRef = useRef(false);

  useEffect(() => {
    bypassGuardRef.current = false;
    const nextAvatar = user?.avatar || USER_AVATARS[0].url;
    setName(user?.name || "Friend");
    setSelectedBaseUrl(stripBgParam(nextAvatar));
    setSelectedBg(extractBgParam(nextAvatar));
    setSelectedGoal(user?.wellnessGoal || WELLNESS_GOALS[0]);
  }, [user?.id]);

  const activeAvatarUri = useMemo(
    () => buildAvatarUrl(selectedBaseUrl, selectedBg),
    [selectedBaseUrl, selectedBg]
  );

  const baselineName = (user?.name || "Friend").trim();
  const baselineAvatar = useMemo(
    () => buildAvatarUrl(stripBgParam(initialAvatar), extractBgParam(initialAvatar)),
    [initialAvatar]
  );
  const baselineGoal = user?.wellnessGoal || WELLNESS_GOALS[0];

  const hasUnsavedChanges =
    name.trim() !== baselineName ||
    activeAvatarUri !== baselineAvatar ||
    selectedGoal !== baselineGoal;

  hasUnsavedRef.current = hasUnsavedChanges;

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (bypassGuardRef.current || !hasUnsavedRef.current) {
        return;
      }

      e.preventDefault();
      pendingNavActionRef.current = e.data.action;
      setUnsavedModalVisible(true);
    });

    return unsubscribe;
  }, [navigation]);

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      Haptics.impactAsync(style);
    } catch {}
  };

  const performLeave = () => {
    bypassGuardRef.current = true;
    setUnsavedModalVisible(false);

    if (pendingNavActionRef.current) {
      const action = pendingNavActionRef.current;
      pendingNavActionRef.current = null;
      navigation.dispatch(action);
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  const handleBack = () => {
    triggerHaptic();
    if (hasUnsavedRef.current && !saving) {
      pendingNavActionRef.current = null;
      setUnsavedModalVisible(true);
      return;
    }
    performLeave();
  };

  const handleAvatarSelect = (baseUrl) => {
    setSelectedBaseUrl(baseUrl);
    setSavedSuccess(false);
    setSaveError("");
  };

  const handleTintSelect = (hex) => {
    setSelectedBg(hex);
    setSavedSuccess(false);
    setSaveError("");
  };

  const handleGoalSelect = (goal) => {
    triggerHaptic();
    setSelectedGoal(goal);
    setSavedSuccess(false);
    setSaveError("");
  };

  const persistChanges = async () => {
    if (!name.trim()) {
      setSaveError("Please enter a display name.");
      return false;
    }

    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    setSavedSuccess(false);
    setSaveError("");

    try {
      await updateProfile({
        name: name.trim(),
        avatar: activeAvatarUri,
        wellnessGoal: selectedGoal,
      });
      return true;
    } catch (err) {
      setSaveError(err?.message || "Failed to save changes. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const ok = await persistChanges();
    if (ok) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  const handleSaveAndLeave = async () => {
    const ok = await persistChanges();
    if (ok) {
      performLeave();
    } else {
      setUnsavedModalVisible(false);
    }
  };

  const handleDiscardAndLeave = () => {
    triggerHaptic();
    performLeave();
  };

  const handleKeepEditing = () => {
    triggerHaptic();
    pendingNavActionRef.current = null;
    setUnsavedModalVisible(false);
  };

  const handleSignOut = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    bypassGuardRef.current = true;
    await logout();
    router.replace("/login");
  };

  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleBack}
          accessibilityLabel="Go back"
          style={[
            styles.backBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.pageTitle, { color: colors.text }]}>
          Customize Profile
        </Text>

        <View style={styles.topBarRight}>
          {hasUnsavedChanges && (
            <View
              style={[styles.unsavedDot, { backgroundColor: colors.primary }]}
            />
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Account Status & Login / Logout Banner */}
          <View
            style={[
              styles.topAccountCard,
              {
                backgroundColor: colors.surface,
                borderColor: isAuthenticated
                  ? colors.border
                  : colors.primary + "45",
              },
            ]}
          >
            <View style={styles.topAccountRow}>
              <View
                style={[
                  styles.accountIconCircle,
                  {
                    backgroundColor: isAuthenticated
                      ? "rgba(16, 185, 129, 0.14)"
                      : colors.primary + "1C",
                  },
                ]}
              >
                <Ionicons
                  name={
                    isAuthenticated
                      ? "shield-checkmark-outline"
                      : "cloud-upload-outline"
                  }
                  size={20}
                  color={isAuthenticated ? "#10B981" : colors.primary}
                />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.accountBadgeRow}>
                  <Text style={[styles.accountTitle, { color: colors.text }]}>
                    {isAuthenticated ? "Synced Account" : "Guest Mode"}
                  </Text>
                  <View
                    style={[
                      styles.statusTag,
                      {
                        backgroundColor: isAuthenticated
                          ? "rgba(16, 185, 129, 0.16)"
                          : colors.accent + "22",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusTagText,
                        { color: isAuthenticated ? "#10B981" : colors.accent },
                      ]}
                    >
                      {isAuthenticated ? "Saved" : "Local Only"}
                    </Text>
                  </View>
                </View>

                <Text
                  numberOfLines={2}
                  style={[styles.accountDesc, { color: colors.textMuted }]}
                >
                  {isAuthenticated
                    ? user?.email || "Signed in and synced"
                    : "Log in or sign up to keep your moods and chats backed up, or exit guest mode."}
                </Text>
              </View>

              {isAuthenticated && (
                <TouchableOpacity
                  onPress={handleSignOut}
                  style={[
                    styles.exitBtn,
                    {
                      backgroundColor: "rgba(239, 68, 68, 0.12)",
                      borderColor: "rgba(239, 68, 68, 0.28)",
                    },
                  ]}
                >
                  <Ionicons name="log-out-outline" size={16} color="#EF4444" />
                  <Text style={styles.exitBtnText}>Log Out</Text>
                </TouchableOpacity>
              )}
            </View>

            {!isAuthenticated && (
              <View style={styles.guestActionRow}>
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic();
                    router.push("/login");
                  }}
                  style={[
                    styles.primaryAuthBtn,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Ionicons
                    name="log-in-outline"
                    size={16}
                    color={onPrimaryText}
                  />
                  <Text style={[styles.primaryAuthText, { color: onPrimaryText }]}>
                    Log In / Sign Up
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSignOut}
                  style={[
                    styles.exitBtn,
                    {
                      backgroundColor: "rgba(239, 68, 68, 0.12)",
                      borderColor: "rgba(239, 68, 68, 0.28)",
                    },
                  ]}
                >
                  <Ionicons name="log-out-outline" size={16} color="#EF4444" />
                  <Text style={styles.exitBtnText}>Exit Guest</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Spotlight Preview */}
          <View style={styles.avatarSpotlight}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic();
                setAvatarModalVisible(true);
              }}
              activeOpacity={0.85}
              accessibilityLabel="Browse all 20 characters"
              style={styles.spotlightWrap}
            >
              <View
                style={[
                  styles.glowRing,
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
                  size={78}
                  fallbackLabel={name}
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
                <Ionicons name="pencil" size={12} color={onPrimaryText} />
              </View>
            </TouchableOpacity>

            <Text style={[styles.previewName, { color: colors.text }]}>
              {name || "Friend"}
            </Text>
            <Text style={[styles.previewGoal, { color: colors.primary }]}>
              {selectedGoal}
            </Text>
          </View>

          {/* 1. Display Name */}
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Display Name
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
                Platform.OS === "web" && styles.webInputReset,
              ]}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              underlineColorAndroid="transparent"
              value={name}
              onFocus={() => setIsNameFocused(true)}
              onBlur={() => setIsNameFocused(false)}
              onChangeText={(txt) => {
                setName(txt);
                setSavedSuccess(false);
                setSaveError("");
              }}
            />
          </View>

          {/* 2. Primary Wellness Intention (Grouped with identity, above visual pickers) */}
          <Text
            style={[styles.sectionHeading, { color: colors.text, marginTop: 22 }]}
          >
            Primary Wellness Intention
          </Text>
          <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
            Helps personalize daily reflections and companion guidance
          </Text>
          <View style={styles.goalsWrap}>
            {WELLNESS_GOALS.map((goal, idx) => {
              const isSelected = selectedGoal === goal;
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleGoalSelect(goal)}
                  style={[
                    styles.goalChip,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.goalChipText,
                      { color: isSelected ? onPrimaryText : colors.text },
                    ]}
                  >
                    {goal}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3. Compact Horizontal User Character Picker (+ "All 20" Grid Modal) */}
          <UserAvatarPicker
            selectedBaseUrl={selectedBaseUrl}
            selectedBg={selectedBg}
            onSelectAvatar={handleAvatarSelect}
            onSelectTint={handleTintSelect}
            gridVisible={avatarModalVisible}
            onOpenGrid={() => setAvatarModalVisible(true)}
            onCloseGrid={() => setAvatarModalVisible(false)}
          />

          {/* 4. Matching Horizontal AI Companion Selector */}
          <CompanionPicker layout="horizontal" />
        </ScrollView>

        {/* Sticky Bottom Save Footer */}
        <View
          style={[
            styles.stickyFooter,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 14),
            },
          ]}
        >
          {!!saveError && <Text style={styles.errorText}>{saveError}</Text>}

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[
              styles.saveBtn,
              {
                backgroundColor: hasUnsavedChanges
                  ? colors.primary
                  : colors.surfaceElevated,
                borderColor: hasUnsavedChanges ? colors.primary : colors.border,
                borderWidth: hasUnsavedChanges ? 0 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator
                color={hasUnsavedChanges ? onPrimaryText : colors.primary}
              />
            ) : savedSuccess ? (
              <View style={styles.btnRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.saveBtnText, { color: colors.primary }]}>
                  Saved Successfully
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.saveBtnText,
                  {
                    color: hasUnsavedChanges ? onPrimaryText : colors.textMuted,
                  },
                ]}
              >
                {hasUnsavedChanges ? "Save Profile" : "Profile Up to Date"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Unsaved Changes Confirmation Dialog */}
      <Modal
        visible={unsavedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleKeepEditing}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Ionicons
                name="save-outline"
                size={26}
                color={colors.primary}
              />
            </View>

            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Save changes before leaving?
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              You have unsaved updates to your profile. Save them now or discard before heading back.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={handleSaveAndLeave}
                disabled={saving}
                style={[
                  styles.modalPrimaryBtn,
                  { backgroundColor: colors.primary },
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={onPrimaryText} />
                ) : (
                  <Text
                    style={[styles.modalPrimaryText, { color: onPrimaryText }]}
                  >
                    Save & Leave
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDiscardAndLeave}
                disabled={saving}
                style={[
                  styles.modalDiscardBtn,
                  {
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    borderColor: "rgba(239, 68, 68, 0.25)",
                  },
                ]}
              >
                <Text style={styles.modalDiscardText}>Discard Changes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleKeepEditing}
                disabled={saving}
                style={styles.modalCancelBtn}
              >
                <Text
                  style={[styles.modalCancelText, { color: colors.textMuted }]}
                >
                  Keep Editing
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  pageTitle: { fontSize: 17, fontWeight: "700" },
  topBarRight: {
    width: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  unsavedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  topAccountCard: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  topAccountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  accountIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  accountBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accountTitle: { fontSize: 14, fontWeight: "700" },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusTagText: { fontSize: 10, fontWeight: "700" },
  accountDesc: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  guestActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  primaryAuthBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 38,
    borderRadius: 12,
  },
  primaryAuthText: { fontSize: 13, fontWeight: "700" },
  exitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  exitBtnText: { color: "#EF4444", fontSize: 13, fontWeight: "600" },
  avatarSpotlight: { alignItems: "center", marginBottom: 20 },
  spotlightWrap: {
    position: "relative",
    marginBottom: 10,
  },
  glowRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  editAvatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  previewName: { fontSize: 22, fontWeight: "800" },
  previewGoal: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  sectionHeading: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  sectionSub: { fontSize: 12, marginTop: -4, marginBottom: 10 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  webInputReset: {
    outlineStyle: "none",
    outlineWidth: 0,
  },
  goalsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  goalChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  goalChipText: { fontSize: 13, fontWeight: "600" },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  saveBtn: {
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  saveBtnText: { fontSize: 16, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  modalIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
  },
  modalDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  modalActions: {
    width: "100%",
    gap: 10,
  },
  modalPrimaryBtn: {
    height: 46,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimaryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalDiscardBtn: {
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalDiscardText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },
  modalCancelBtn: {
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
});