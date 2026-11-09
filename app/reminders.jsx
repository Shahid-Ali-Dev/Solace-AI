// app/reminders.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { getCompanionById } from "../constants/companions";
import {
  TARGET_OPTIONS,
  formatReminderTime,
  loadReminders,
  saveAndSyncReminders,
  requestNotificationPermissions,
  getNotificationPermissionStatus,
  getScheduledOsCount,
  scheduleTestNotification,
} from "../services/notifications";

const TIME_PRESETS = [
  { label: "8:30 AM", hour12: 8, minute: 30, period: "AM" },
  { label: "1:00 PM", hour12: 1, minute: 0, period: "PM" },
  { label: "6:00 PM", hour12: 6, minute: 0, period: "PM" },
  { label: "9:30 PM", hour12: 9, minute: 30, period: "PM" },
];

const CUSTOM_IDEAS = [
  "Drink water & stretch",
  "Unclench jaw & shoulders",
  "5-min screen break",
];

const TYPE_META = {
  mood_checkin: { icon: "sunny-outline", accent: "#2DD4BF" },
  affirmation: { icon: "sparkles-outline", accent: "#A78BFA" },
  breathe: { icon: "water-outline", accent: "#38BDF8" },
  self_care: { icon: "leaf-outline", accent: "#10B981" },
  custom: { icon: "notifications-outline", accent: "#F59E0B" },
};

const to12Hour = (hour24) => {
  const h = Number(hour24) || 0;
  return {
    hour12: h % 12 === 0 ? 12 : h % 12,
    period: h >= 12 ? "PM" : "AM",
  };
};

const to24Hour = (hour12, period) => {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
};

function TimeSelector({
  hour12,
  minute,
  period,
  onChangeHour,
  onChangeMinute,
  onChangePeriod,
  onSelectPreset,
  colors,
  onPrimaryText,
  triggerHaptic,
}) {
  const stepHour = (delta) => {
    triggerHaptic();
    const next = ((hour12 - 1 + delta + 12) % 12) + 1;
    onChangeHour(next);
  };

  const stepMinute = (delta) => {
    triggerHaptic();
    const next = (minute + delta + 60) % 60;
    onChangeMinute(next);
  };

  return (
    <View style={styles.timeSelectorWrap}>
      {/* Digital Clock Stepper */}
      <View
        style={[
          styles.clockCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {/* Hour Column */}
        <View style={styles.clockCol}>
          <TouchableOpacity
            onPress={() => stepHour(1)}
            accessibilityLabel="Increase hour"
            style={[
              styles.stepArrowBtn,
              { backgroundColor: colors.surfaceElevated },
            ]}
          >
            <Ionicons name="chevron-up" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.clockDigit, { color: colors.text }]}>
            {String(hour12).padStart(2, "0")}
          </Text>
          <TouchableOpacity
            onPress={() => stepHour(-1)}
            accessibilityLabel="Decrease hour"
            style={[
              styles.stepArrowBtn,
              { backgroundColor: colors.surfaceElevated },
            ]}
          >
            <Ionicons name="chevron-down" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.clockUnit, { color: colors.textMuted }]}>
            Hour
          </Text>
        </View>

        <Text style={[styles.clockColon, { color: colors.textMuted }]}>:</Text>

        {/* Minute Column (steps by 5 mins cleanly) */}
        <View style={styles.clockCol}>
          <TouchableOpacity
            onPress={() => stepMinute(5)}
            accessibilityLabel="Add 5 minutes"
            style={[
              styles.stepArrowBtn,
              { backgroundColor: colors.surfaceElevated },
            ]}
          >
            <Ionicons name="chevron-up" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.clockDigit, { color: colors.text }]}>
            {String(minute).padStart(2, "0")}
          </Text>
          <TouchableOpacity
            onPress={() => stepMinute(-5)}
            accessibilityLabel="Subtract 5 minutes"
            style={[
              styles.stepArrowBtn,
              { backgroundColor: colors.surfaceElevated },
            ]}
          >
            <Ionicons name="chevron-down" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.clockUnit, { color: colors.textMuted }]}>
            Min
          </Text>
        </View>

        {/* AM / PM Vertical Segmented Switch */}
        <View
          style={[
            styles.periodCol,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          {["AM", "PM"].map((p) => {
            const active = period === p;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => {
                  triggerHaptic();
                  onChangePeriod(p);
                }}
                style={[
                  styles.periodSegBtn,
                  active && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.periodSegText,
                    { color: active ? onPrimaryText : colors.textMuted },
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Fine-Tune ±1 Min + Quick Presets */}
      <View style={styles.quickPresetsRow}>
        <TouchableOpacity
          onPress={() => stepMinute(-1)}
          style={[
            styles.fineBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.fineBtnText, { color: colors.textMuted }]}>
            -1m
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => stepMinute(1)}
          style={[
            styles.fineBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.fineBtnText, { color: colors.textMuted }]}>
            +1m
          </Text>
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsScroll}
        >
          {TIME_PRESETS.map((preset) => {
            const isMatch =
              hour12 === preset.hour12 &&
              minute === preset.minute &&
              period === preset.period;
            return (
              <TouchableOpacity
                key={preset.label}
                onPress={() => {
                  triggerHaptic();
                  onSelectPreset(preset);
                }}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: isMatch
                      ? colors.primary + "20"
                      : colors.surface,
                    borderColor: isMatch ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    { color: isMatch ? colors.primary : colors.textMuted },
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export default function RemindersScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeCompanion = getCompanionById(user?.companionAvatar);

  const [initialLoading, setInitialLoading] = useState(true);
  const [reminders, setReminders] = useState([]);
  const [permStatus, setPermStatus] = useState("undetermined");
  const [osScheduledCount, setOsScheduledCount] = useState(0);
  const [testStatusMsg, setTestStatusMsg] = useState("");
  const [testSendingId, setTestSendingId] = useState(null);

  // Edit time modal state
  const [editingItem, setEditingItem] = useState(null);
  const [draftHour12, setDraftHour12] = useState(9);
  const [draftMinute, setDraftMinute] = useState(0);
  const [draftPeriod, setDraftPeriod] = useState("AM");

  // Custom reminder modal state
  const [customVisible, setCustomVisible] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customTarget, setCustomTarget] = useState("mood");
  const [customHour12, setCustomHour12] = useState(4);
  const [customMinute, setCustomMinute] = useState(30);
  const [customPeriod, setCustomPeriod] = useState("PM");
  const [customError, setCustomError] = useState("");
  const [savingCustom, setSavingCustom] = useState(false);

  const refreshOsMetrics = useCallback(async () => {
    const [status, count] = await Promise.all([
      getNotificationPermissionStatus(),
      getScheduledOsCount(),
    ]);
    setPermStatus(status);
    setOsScheduledCount(count);
  }, []);

  useEffect(() => {
    let active = true;
    setInitialLoading(true);

    // Defer 1 frame so the route transition finishes smoothly before storage/DB/OS work
    const timer = setTimeout(async () => {
      try {
        const [list] = await Promise.all([
          loadReminders(user?.id),
          refreshOsMetrics(),
        ]);
        if (active) {
          setReminders(Array.isArray(list) ? list : []);
        }
      } catch {
      } finally {
        if (active) setInitialLoading(false);
      }
    }, 60);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [user?.id, refreshOsMetrics]);

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      Haptics.impactAsync(style);
    } catch {}
  };

  const commitReminders = async (nextList, askPerm = true) => {
    setReminders(nextList);
    const res = await saveAndSyncReminders(nextList, user, {
      requestPermissionIfNeeded: askPerm,
    });
    if (Platform.OS !== "web") {
      setPermStatus(res.permissionGranted ? "granted" : "denied");
    }
    const count = await getScheduledOsCount();
    setOsScheduledCount(count);
  };

  const handleToggle = async (id) => {
    triggerHaptic();
    const target = reminders.find((r) => r.id === id);
    const turningOn = !target?.enabled;
    const next = reminders.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    await commitReminders(next, turningOn);
  };

  const handleBack = () => {
    triggerHaptic();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  const openTimeEditor = (item) => {
    triggerHaptic();
    const { hour12, period } = to12Hour(item.hour);
    setEditingItem(item);
    setDraftHour12(hour12);
    setDraftMinute(Number(item.minute) || 0);
    setDraftPeriod(period);
  };

  const saveEditedTime = async () => {
    if (!editingItem) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const hour24 = to24Hour(draftHour12, draftPeriod);
    const next = reminders.map((r) =>
      r.id === editingItem.id
        ? { ...r, hour: hour24, minute: draftMinute, enabled: true }
        : r
    );
    setEditingItem(null);
    await commitReminders(next, true);
  };

  const handleDeleteCustom = async (id) => {
    triggerHaptic();
    const next = reminders.filter((r) => r.id !== id);
    await commitReminders(next, false);
  };

  const openCustomModal = () => {
    triggerHaptic();
    setCustomError("");
    setCustomTitle("");
    setCustomTarget("mood");
    setCustomHour12(4);
    setCustomMinute(30);
    setCustomPeriod("PM");
    setCustomVisible(true);
  };

  const handleAddCustom = async () => {
    if (!customTitle.trim()) {
      setCustomError("Give your reminder a short label.");
      return;
    }
    if (savingCustom) return;

    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setSavingCustom(true);

    try {
      const newItem = {
        id: `custom_${Date.now()}`,
        type: "custom",
        label: customTitle.trim(),
        description: `Opens ${
          TARGET_OPTIONS.find((t) => t.id === customTarget)?.label || "Solace"
        }`,
        enabled: true,
        hour: to24Hour(customHour12, customPeriod),
        minute: customMinute,
        target: customTarget,
        isCustom: true,
      };

      const next = [...reminders, newItem];
      await commitReminders(next, true);
      setCustomVisible(false);
      setCustomTitle("");
      setCustomError("");
    } finally {
      setSavingCustom(false);
    }
  };

  const handleRequestPermissionBanner = async () => {
    triggerHaptic();
    const granted = await requestNotificationPermissions();
    setPermStatus(granted ? "granted" : "denied");
    if (granted) {
      await commitReminders(reminders, false);
    }
  };

  const handleSendTest = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const sample =
      reminders.find((r) => r.enabled && r.type === "breathe") ||
      reminders.find((r) => r.enabled) ||
      reminders[0];
    if (!sample) return;

    setTestSendingId(sample.id);
    const res = await scheduleTestNotification(sample, user, 5);
    setTestSendingId(null);

    if (res.ok) {
      setPermStatus("granted");
      setTestStatusMsg(
        `"${sample.label}" arrives in 5s. Background or close Solace now, then tap it to jump straight there.`
      );
    } else if (res.reason === "web") {
      setTestStatusMsg(
        "Background notifications run on Android/iOS builds. Your schedule is saved and synced."
      );
    } else {
      setPermStatus("denied");
      setTestStatusMsg(
        "Notification permission is blocked in device settings. Allow it to test background nudges."
      );
    }
  };

  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";
  const builtIn = reminders.filter((r) => !r.isCustom);
  const customList = reminders.filter((r) => r.isCustom);
  const activeCount = reminders.filter((r) => r.enabled).length;

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

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>
            Gentle Nudges
          </Text>
          <Text style={[styles.pageSub, { color: colors.textMuted }]}>
            {initialLoading
              ? "Syncing schedule..."
              : Platform.OS === "web"
              ? `${activeCount} configured`
              : `${osScheduledCount} scheduled on device`}
          </Text>
        </View>

        <TouchableOpacity
          onPress={openCustomModal}
          disabled={initialLoading}
          accessibilityLabel="Add custom reminder"
          style={[
            styles.backBtn,
            {
              backgroundColor: colors.primary + "1C",
              borderColor: colors.primary + "45",
              opacity: initialLoading ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {initialLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingTitle, { color: colors.text }]}>
            Loading your nudges
          </Text>
          <Text style={[styles.loadingSub, { color: colors.textMuted }]}>
            Syncing saved reminders and notification status...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 28 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Permission Banner (if not granted on mobile) */}
          {Platform.OS !== "web" && permStatus !== "granted" && (
            <TouchableOpacity
              onPress={handleRequestPermissionBanner}
              activeOpacity={0.85}
              style={[
                styles.permCard,
                {
                  backgroundColor: "rgba(245, 158, 11, 0.14)",
                  borderColor: "rgba(245, 158, 11, 0.4)",
                },
              ]}
            >
              <Ionicons
                name="notifications-off-outline"
                size={22}
                color="#F59E0B"
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.permTitle, { color: colors.text }]}>
                  Allow gentle reminders
                </Text>
                <Text style={[styles.permSub, { color: colors.textMuted }]}>
                  Tap to enable background notifications so nudges arrive even
                  when Solace is closed.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#F59E0B" />
            </TouchableOpacity>
          )}

          {/* Built-in Wellness Nudges */}
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Daily Wellness Routine
          </Text>
          <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
            Tap a time to adjust. Tapping any notification opens that tool
            directly.
          </Text>

          <View style={styles.listCol}>
            {builtIn.map((item) => {
              const meta = TYPE_META[item.type] || TYPE_META.mood_checkin;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.reminderCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: item.enabled
                        ? meta.accent + "55"
                        : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: meta.accent + "20" },
                    ]}
                  >
                    <Ionicons name={meta.icon} size={20} color={meta.accent} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      {item.label}
                    </Text>
                    <Text
                      style={[styles.cardDesc, { color: colors.textMuted }]}
                    >
                      {item.description}
                    </Text>

                    <TouchableOpacity
                      onPress={() => openTimeEditor(item)}
                      style={[
                        styles.timePill,
                        {
                          backgroundColor: colors.surfaceElevated,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name="time-outline"
                        size={13}
                        color={item.enabled ? meta.accent : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.timePillText,
                          {
                            color: item.enabled
                              ? colors.text
                              : colors.textMuted,
                          },
                        ]}
                      >
                        {formatReminderTime(item.hour, item.minute)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Switch
                    value={Boolean(item.enabled)}
                    onValueChange={() => handleToggle(item.id)}
                    trackColor={{
                      false: colors.border,
                      true: meta.accent + "75",
                    }}
                    thumbColor={item.enabled ? meta.accent : colors.textMuted}
                  />
                </View>
              );
            })}
          </View>

          {/* Custom Reminders */}
          <View style={styles.customHeaderRow}>
            <View>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>
                Custom Reminders
              </Text>
              <Text
                style={[
                  styles.sectionSub,
                  { color: colors.textMuted, marginBottom: 0 },
                ]}
              >
                Personal habits or mindful check-in cues
              </Text>
            </View>
            <TouchableOpacity
              onPress={openCustomModal}
              style={[
                styles.addPill,
                {
                  backgroundColor: colors.primary + "1A",
                  borderColor: colors.primary + "40",
                },
              ]}
            >
              <Ionicons name="add" size={15} color={colors.primary} />
              <Text style={[styles.addPillText, { color: colors.primary }]}>
                New
              </Text>
            </TouchableOpacity>
          </View>

          {customList.length === 0 ? (
            <TouchableOpacity
              onPress={openCustomModal}
              activeOpacity={0.8}
              style={[
                styles.emptyCustom,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="add-circle-outline"
                size={22}
                color={colors.primary}
              />
              <Text
                style={[styles.emptyCustomText, { color: colors.textMuted }]}
              >
                Add a custom nudge (e.g., "Hydrate & stretch" or "Screen break")
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.listCol}>
              {customList.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.reminderCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: item.enabled ? "#F59E0B55" : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: "rgba(245, 158, 11, 0.16)" },
                    ]}
                  >
                    <Ionicons
                      name="notifications-outline"
                      size={20}
                      color="#F59E0B"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      {item.label}
                    </Text>
                    <Text
                      style={[styles.cardDesc, { color: colors.textMuted }]}
                    >
                      {item.description}
                    </Text>
                    <View style={styles.customActionsRow}>
                      <TouchableOpacity
                        onPress={() => openTimeEditor(item)}
                        style={[
                          styles.timePill,
                          {
                            backgroundColor: colors.surfaceElevated,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name="time-outline"
                          size={13}
                          color="#F59E0B"
                        />
                        <Text
                          style={[styles.timePillText, { color: colors.text }]}
                        >
                          {formatReminderTime(item.hour, item.minute)}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeleteCustom(item.id)}
                        style={styles.deleteBtn}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={15}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Switch
                    value={Boolean(item.enabled)}
                    onValueChange={() => handleToggle(item.id)}
                    trackColor={{
                      false: colors.border,
                      true: "rgba(245, 158, 11, 0.55)",
                    }}
                    thumbColor={item.enabled ? "#F59E0B" : colors.textMuted}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Background Test Launcher */}
          <View
            style={[
              styles.testCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.testHeader}>
              <Ionicons
                name="paper-plane-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.testTitle, { color: colors.text }]}>
                Preview Background Nudge
              </Text>
            </View>
            <Text style={[styles.testDesc, { color: colors.textMuted }]}>
              Fires a real notification from {activeCompanion.name} in 5 seconds
              so you can test background delivery and tap deep-linking.
            </Text>

            {!!testStatusMsg && (
              <View
                style={[
                  styles.testBanner,
                  {
                    backgroundColor: colors.primary + "16",
                    borderColor: colors.primary + "40",
                  },
                ]}
              >
                <Text style={[styles.testBannerText, { color: colors.text }]}>
                  {testStatusMsg}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSendTest}
              disabled={Boolean(testSendingId)}
              activeOpacity={0.85}
              style={[styles.testBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="notifications" size={16} color={onPrimaryText} />
              <Text style={[styles.testBtnText, { color: onPrimaryText }]}>
                Send Test Nudge in 5s
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Time Picker Modal */}
      <Modal
        visible={Boolean(editingItem)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.pickerCard,
              {
                backgroundColor: colors.modalSurface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingItem?.label}
            </Text>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>
              Choose daily reminder time
            </Text>

            <TimeSelector
              hour12={draftHour12}
              minute={draftMinute}
              period={draftPeriod}
              onChangeHour={setDraftHour12}
              onChangeMinute={setDraftMinute}
              onChangePeriod={setDraftPeriod}
              onSelectPreset={(p) => {
                setDraftHour12(p.hour12);
                setDraftMinute(p.minute);
                setDraftPeriod(p.period);
              }}
              colors={colors}
              onPrimaryText={onPrimaryText}
              triggerHaptic={triggerHaptic}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setEditingItem(null)}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text
                  style={[styles.cancelBtnText, { color: colors.textMuted }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEditedTime}
                style={[
                  styles.saveTimeBtn,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={[styles.saveTimeText, { color: onPrimaryText }]}>
                  Save Time
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Custom Reminder Sheet */}
      <Modal
        visible={customVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[
              styles.customSheet,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[styles.sheetHeader, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                New Custom Reminder
              </Text>
              <TouchableOpacity
                onPress={() => setCustomVisible(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.sheetScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Message Input + Quick Ideas */}
              <View>
                <Text style={[styles.pickerLabel, { color: colors.text }]}>
                  Reminder Message
                </Text>
                <TextInput
                  style={[
                    styles.customInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="e.g., Drink water & relax shoulders"
                  placeholderTextColor={colors.textMuted}
                  underlineColorAndroid="transparent"
                  value={customTitle}
                  onChangeText={(t) => {
                    setCustomTitle(t);
                    setCustomError("");
                  }}
                />
                {!!customError && (
                  <Text style={styles.errorText}>{customError}</Text>
                )}

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.ideasRow}
                >
                  {CUSTOM_IDEAS.map((idea) => (
                    <TouchableOpacity
                      key={idea}
                      onPress={() => {
                        triggerHaptic();
                        setCustomTitle(idea);
                        setCustomError("");
                      }}
                      style={[
                        styles.ideaChip,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.ideaChipText,
                          { color: colors.textMuted },
                        ]}
                      >
                        + {idea}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Tap Destination */}
              <View>
                <Text style={[styles.pickerLabel, { color: colors.text }]}>
                  Open When Tapped
                </Text>
                <View style={styles.targetWrap}>
                  {TARGET_OPTIONS.map((opt) => {
                    const active = customTarget === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        onPress={() => {
                          triggerHaptic();
                          setCustomTarget(opt.id);
                        }}
                        style={[
                          styles.targetChip,
                          {
                            backgroundColor: active
                              ? colors.primary
                              : colors.surface,
                            borderColor: active
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={14}
                          color={active ? onPrimaryText : colors.primary}
                        />
                        <Text
                          style={[
                            styles.targetChipText,
                            { color: active ? onPrimaryText : colors.text },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Time Selector */}
              <View>
                <Text style={[styles.pickerLabel, { color: colors.text }]}>
                  Schedule Time
                </Text>
                <TimeSelector
                  hour12={customHour12}
                  minute={customMinute}
                  period={customPeriod}
                  onChangeHour={setCustomHour12}
                  onChangeMinute={setCustomMinute}
                  onChangePeriod={setCustomPeriod}
                  onSelectPreset={(p) => {
                    setCustomHour12(p.hour12);
                    setCustomMinute(p.minute);
                    setCustomPeriod(p.period);
                  }}
                  colors={colors}
                  onPrimaryText={onPrimaryText}
                  triggerHaptic={triggerHaptic}
                />
              </View>
            </ScrollView>

            {/* Dedicated Full-Height Sticky Save Footer */}
            <View
              style={[
                styles.sheetFooter,
                {
                  borderTopColor: colors.border,
                  backgroundColor: colors.background,
                  paddingBottom: Math.max(insets.bottom, 16),
                },
              ]}
            >
              <TouchableOpacity
                onPress={handleAddCustom}
                disabled={savingCustom}
                activeOpacity={0.85}
                style={[
                  styles.createCustomBtn,
                  { backgroundColor: colors.primary },
                ]}
              >
                {savingCustom ? (
                  <ActivityIndicator color={onPrimaryText} />
                ) : (
                  <Text
                    style={[styles.createCustomText, { color: onPrimaryText }]}
                  >
                    Save Custom Reminder
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  pageSub: { fontSize: 11.5, marginTop: 1 },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  loadingTitle: { fontSize: 17, fontWeight: "700", marginTop: 6 },
  loadingSub: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 18 },
  permCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 18,
  },
  permTitle: { fontSize: 14, fontWeight: "700" },
  permSub: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  sectionHeading: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  sectionSub: { fontSize: 12.5, lineHeight: 18, marginBottom: 14 },
  listCol: { gap: 11 },
  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardDesc: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  timePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  timePillText: { fontSize: 12, fontWeight: "700" },
  customHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 12,
  },
  addPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  addPillText: { fontSize: 12.5, fontWeight: "700" },
  emptyCustom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  emptyCustomText: { flex: 1, fontSize: 13, lineHeight: 18 },
  customActionsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  deleteBtn: { marginTop: 8, padding: 6 },
  testCard: {
    marginTop: 26,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
  },
  testHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  testTitle: { fontSize: 15, fontWeight: "700" },
  testDesc: { fontSize: 12.5, lineHeight: 18 },
  testBanner: {
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  testBannerText: { fontSize: 12.5, lineHeight: 18, fontWeight: "500" },
  testBtn: {
    height: 46,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
  },
  testBtnText: { fontSize: 14, fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  modalSub: {
    fontSize: 12.5,
    textAlign: "center",
    marginTop: 3,
    marginBottom: 16,
  },
  timeSelectorWrap: { gap: 12 },
  clockCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  clockCol: {
    alignItems: "center",
    gap: 5,
    width: 68,
  },
  stepArrowBtn: {
    width: 48,
    height: 32,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  clockDigit: {
    fontSize: 30,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  clockUnit: {
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: -2,
  },
  clockColon: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 16,
  },
  periodCol: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    marginLeft: 4,
  },
  periodSegBtn: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  periodSegText: { fontSize: 13, fontWeight: "800" },
  quickPresetsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fineBtn: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fineBtnText: { fontSize: 11.5, fontWeight: "700" },
  presetsScroll: {
    gap: 6,
    paddingRight: 4,
  },
  presetChip: {
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  presetChipText: { fontSize: 11.5, fontWeight: "700" },
  modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "600" },
  saveTimeBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  saveTimeText: { fontSize: 14, fontWeight: "700" },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
    justifyContent: "flex-end",
  },
  customSheet: {
    maxHeight: "86%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 18,
  },
  pickerLabel: { fontSize: 12.5, fontWeight: "700", marginBottom: 8 },
  customInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14.5,
    ...(Platform.OS === "web" ? { outlineStyle: "none", outlineWidth: 0 } : {}),
  },
  ideasRow: {
    gap: 7,
    marginTop: 9,
  },
  ideaChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 11,
    borderWidth: 1,
  },
  ideaChipText: { fontSize: 11.5, fontWeight: "600" },
  errorText: { color: "#EF4444", fontSize: 12, marginTop: 6 },
  targetWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  targetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
  },
  targetChipText: { fontSize: 12.5, fontWeight: "600" },
  sheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  createCustomBtn: {
    width: "100%",
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  createCustomText: {
    fontSize: 15.5,
    fontWeight: "700",
  },
});