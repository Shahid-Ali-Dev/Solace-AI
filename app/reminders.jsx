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

const QUICK_HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const QUICK_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

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

export default function RemindersScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeCompanion = getCompanionById(user?.companionAvatar);

  const [reminders, setReminders] = useState([]);
  const [permStatus, setPermStatus] = useState("undetermined");
  const [osScheduledCount, setOsScheduledCount] = useState(0);
  const [testStatusMsg, setTestStatusMsg] = useState("");
  const [testSendingId, setTestSendingId] = useState(null);

  // Time picker state
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
    (async () => {
      const list = await loadReminders(user?.id);
      if (!active) return;
      setReminders(list);
      await refreshOsMetrics();
    })();
    return () => {
      active = false;
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

  const handleAddCustom = async () => {
    if (!customTitle.trim()) {
      setCustomError("Give your reminder a short label.");
      return;
    }
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

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
    setCustomVisible(false);
    setCustomTitle("");
    setCustomError("");
    await commitReminders(next, true);
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
          onPress={() => {
            triggerHaptic();
            router.back();
          }}
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
            {Platform.OS === "web"
              ? `${activeCount} configured`
              : `${osScheduledCount} scheduled on device`}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            triggerHaptic();
            setCustomError("");
            setCustomVisible(true);
          }}
          accessibilityLabel="Add custom reminder"
          style={[
            styles.backBtn,
            { backgroundColor: colors.primary + "1C", borderColor: colors.primary + "45" },
          ]}
        >
          <Ionicons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

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
            <Ionicons name="notifications-off-outline" size={22} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.permTitle, { color: colors.text }]}>
                Allow gentle reminders
              </Text>
              <Text style={[styles.permSub, { color: colors.textMuted }]}>
                Tap to enable background notifications so nudges arrive even when Solace is closed.
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
          Tap a time to adjust. Tapping any notification opens that tool directly.
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
                    borderColor: item.enabled ? meta.accent + "55" : colors.border,
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
                  <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
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
                        { color: item.enabled ? colors.text : colors.textMuted },
                      ]}
                    >
                      {formatReminderTime(item.hour, item.minute)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Switch
                  value={Boolean(item.enabled)}
                  onValueChange={() => handleToggle(item.id)}
                  trackColor={{ false: colors.border, true: meta.accent + "75" }}
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
            <Text style={[styles.sectionSub, { color: colors.textMuted, marginBottom: 0 }]}>
              Personal habits or mindful check-in cues
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              triggerHaptic();
              setCustomError("");
              setCustomVisible(true);
            }}
            style={[
              styles.addPill,
              { backgroundColor: colors.primary + "1A", borderColor: colors.primary + "40" },
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
            onPress={() => {
              triggerHaptic();
              setCustomVisible(true);
            }}
            activeOpacity={0.8}
            style={[
              styles.emptyCustom,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            <Text style={[styles.emptyCustomText, { color: colors.textMuted }]}>
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
                  <Ionicons name="notifications-outline" size={20} color="#F59E0B" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
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
                      <Ionicons name="time-outline" size={13} color="#F59E0B" />
                      <Text style={[styles.timePillText, { color: colors.text }]}>
                        {formatReminderTime(item.hour, item.minute)}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteCustom(item.id)}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <Switch
                  value={Boolean(item.enabled)}
                  onValueChange={() => handleToggle(item.id)}
                  trackColor={{ false: colors.border, true: "rgba(245, 158, 11, 0.55)" }}
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
            <Ionicons name="paper-plane-outline" size={18} color={colors.primary} />
            <Text style={[styles.testTitle, { color: colors.text }]}>
              Preview Background Nudge
            </Text>
          </View>
          <Text style={[styles.testDesc, { color: colors.textMuted }]}>
            Fires a real notification from {activeCompanion.name} in 5 seconds so you can test background delivery and tap deep-linking.
          </Text>

          {!!testStatusMsg && (
            <View
              style={[
                styles.testBanner,
                { backgroundColor: colors.primary + "16", borderColor: colors.primary + "40" },
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
              { backgroundColor: colors.modalSurface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingItem?.label}
            </Text>
            <Text style={[styles.modalTimePreview, { color: colors.primary }]}>
              {draftHour12}:{String(draftMinute).padStart(2, "0")} {draftPeriod}
            </Text>

            <Text style={[styles.pickerLabel, { color: colors.textMuted }]}>
              Hour
            </Text>
            <View style={styles.chipWrap}>
              {QUICK_HOURS.map((h) => {
                const active = draftHour12 === h;
                return (
                  <TouchableOpacity
                    key={h}
                    onPress={() => {
                      triggerHaptic();
                      setDraftHour12(h);
                    }}
                    style={[
                      styles.numChip,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.numChipText,
                        { color: active ? onPrimaryText : colors.text },
                      ]}
                    >
                      {h}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.minuteHeaderRow}>
              <Text style={[styles.pickerLabel, { color: colors.textMuted, marginBottom: 0 }]}>
                Minute
              </Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic();
                    setDraftMinute((m) => (m + 59) % 60);
                  }}
                  style={[styles.stepBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.stepBtnText, { color: colors.text }]}>-1m</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic();
                    setDraftMinute((m) => (m + 1) % 60);
                  }}
                  style={[styles.stepBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.stepBtnText, { color: colors.text }]}>+1m</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.chipWrap}>
              {QUICK_MINUTES.map((m) => {
                const active = draftMinute === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => {
                      triggerHaptic();
                      setDraftMinute(m);
                    }}
                    style={[
                      styles.numChip,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.numChipText,
                        { color: active ? onPrimaryText : colors.text },
                      ]}
                    >
                      {String(m).padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.periodRow}>
              {["AM", "PM"].map((p) => {
                const active = draftPeriod === p;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => {
                      triggerHaptic();
                      setDraftPeriod(p);
                    }}
                    style={[
                      styles.periodBtn,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodText,
                        { color: active ? onPrimaryText : colors.text },
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setEditingItem(null)}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEditedTime}
                style={[styles.saveTimeBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.saveTimeText, { color: onPrimaryText }]}>
                  Save Time
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Custom Reminder Modal */}
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
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                New Custom Reminder
              </Text>
              <TouchableOpacity onPress={() => setCustomVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 16 }}
              keyboardShouldPersistTaps="handled"
            >
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
                  value={customTitle}
                  onChangeText={(t) => {
                    setCustomTitle(t);
                    setCustomError("");
                  }}
                />
                {!!customError && (
                  <Text style={styles.errorText}>{customError}</Text>
                )}
              </View>

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
                            borderColor: active ? colors.primary : colors.border,
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

              <View>
                <Text style={[styles.pickerLabel, { color: colors.text }]}>
                  Time ({customHour12}:{String(customMinute).padStart(2, "0")} {customPeriod})
                </Text>
                <View style={styles.chipWrap}>
                  {QUICK_HOURS.map((h) => {
                    const active = customHour12 === h;
                    return (
                      <TouchableOpacity
                        key={h}
                        onPress={() => setCustomHour12(h)}
                        style={[
                          styles.numChip,
                          {
                            backgroundColor: active ? colors.primary : colors.surface,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.numChipText,
                            { color: active ? onPrimaryText : colors.text },
                          ]}
                        >
                          {h}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={[styles.chipWrap, { marginTop: 10 }]}>
                  {[0, 15, 30, 45].map((m) => {
                    const active = customMinute === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        onPress={() => setCustomMinute(m)}
                        style={[
                          styles.numChip,
                          {
                            backgroundColor: active ? colors.primary : colors.surface,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.numChipText,
                            { color: active ? onPrimaryText : colors.text },
                          ]}
                        >
                          :{String(m).padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {["AM", "PM"].map((p) => {
                    const active = customPeriod === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setCustomPeriod(p)}
                        style={[
                          styles.numChip,
                          {
                            backgroundColor: active ? colors.accent : colors.surface,
                            borderColor: active ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.numChipText,
                            { color: active ? "#FFFFFF" : colors.text },
                          ]}
                        >
                          {p}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleAddCustom}
                style={[styles.saveTimeBtn, { backgroundColor: colors.primary, height: 50 }]}
              >
                <Text style={[styles.saveTimeText, { color: onPrimaryText }]}>
                  Save Custom Reminder
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
  modalTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  modalTimePreview: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  pickerLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8 },
  minuteHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 8,
  },
  stepperRow: { flexDirection: "row", gap: 6 },
  stepBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  stepBtnText: { fontSize: 11.5, fontWeight: "700" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  numChip: {
    width: 44,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  numChipText: { fontSize: 13, fontWeight: "700" },
  periodRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  periodBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  periodText: { fontSize: 14, fontWeight: "700" },
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
    maxHeight: "82%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  customInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14.5,
    ...(Platform.OS === "web" ? { outlineStyle: "none", outlineWidth: 0 } : {}),
  },
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
});