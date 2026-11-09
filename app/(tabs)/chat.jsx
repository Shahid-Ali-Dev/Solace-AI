// app/(tabs)/chat.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Modal,
  Alert,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import CompanionAvatar from "../../components/CompanionAvatar";
import CompanionPicker from "../../components/CompanionPicker";
import { getCompanionById } from "../../constants/companions";
import { markDailyHabit } from "../../utils/dailyHabits";

const INITIAL_PROMPTS = [
  "I'm feeling overwhelmed today",
  "Help me pause and reset",
  "Can't turn off my racing thoughts",
  "Give me a 1-minute grounding tip",
];

const NEW_CHAT_SENTINEL = "__NEW__";

const getActiveSessionKey = (userId) => `solace_active_session_${userId || "guest"}`;

const getIntroMessage = (userName, companionName = "Lumi") => {
  const hasRealName =
    userName && !["Friend", "Guest Explorer"].includes(userName.trim());
  const greeting = hasRealName ? `Hey ${userName.trim()}, ` : "Hey there, ";
  return {
    id: "intro",
    sender: "assistant",
    content: `${greeting}it's ${companionName}. No rush here—what's been sitting on your mind today?`,
    suggestions: [],
  };
};

function CompanionTypingBubble({ colors, companionId, companionName = "Lumi" }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    const createDotLoop = (animValue, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(360 - delay),
        ])
      );

    const l1 = createDotLoop(dot1, 0);
    const l2 = createDotLoop(dot2, 150);
    const l3 = createDotLoop(dot3, 300);

    l1.start();
    l2.start();
    l3.start();

    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, []);

  const renderDot = (anim) => (
    <Animated.View
      style={[
        styles.typingDot,
        {
          backgroundColor: colors.primary,
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -4],
              }),
            },
          ],
        },
      ]}
    />
  );

  return (
    <Animated.View style={[styles.typingRow, { opacity: fadeIn }]}>
      <CompanionAvatar avatarId={companionId} size={28} isThinking />
      <View
        style={[
          styles.typingBubble,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.typingLabel, { color: colors.textMuted }]}>
          {companionName} is reflecting
        </Text>
        <View style={styles.dotsGroup}>
          {renderDot(dot1)}
          {renderDot(dot2)}
          {renderDot(dot3)}
        </View>
      </View>
    </Animated.View>
  );
}

function AnimatedBubble({ item, isUser, colors, onPrimaryText }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.messageBubble,
        isUser
          ? [styles.userBubble, { backgroundColor: colors.primary }]
          : [
              styles.assistantBubble,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ],
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text
        style={[
          styles.messageText,
          { color: isUser ? onPrimaryText : colors.text },
        ]}
      >
        {item.content}
      </Text>
    </Animated.View>
  );
}

export default function ChatScreen() {
  const { colors, isDark } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { starterPrompt } = useLocalSearchParams();
  const activeCompanion = getCompanionById(user?.companionAvatar);

  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState(() => [
    getIntroMessage(user?.name, activeCompanion.name),
  ]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [companionModalVisible, setCompanionModalVisible] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);

  const flatListRef = useRef(null);
  const restoredForUserRef = useRef(null);
  const lastHandledStarterRef = useRef("");

  const stackSuggestionsVertically = Platform.OS !== "web" || width < 768;

  const persistActiveSession = async (nextSessionId, targetUserId = user?.id) => {
    if (!targetUserId) return;
    try {
      await AsyncStorage.setItem(
        getActiveSessionKey(targetUserId),
        nextSessionId || NEW_CHAT_SENTINEL
      );
    } catch {}
  };

  // Clear on sign-out and restore last active conversation once per user
  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      restoredForUserRef.current = null;
      lastHandledStarterRef.current = "";
      setSessionId(null);
      setSessions([]);
      setInput("");
      setMessages([getIntroMessage()]);
      return;
    }

    if (restoredForUserRef.current === user.id) return;
    restoredForUserRef.current = user.id;

    setSessionId(null);
    setSessions([]);
    setInput("");
    setMessages([getIntroMessage(user?.name, activeCompanion.name)]);

    if (typeof starterPrompt === "string" && starterPrompt.trim()) {
      setLoadingSession(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadingSession(true);
      try {
        const savedId = await AsyncStorage.getItem(getActiveSessionKey(user.id));

        if (savedId === NEW_CHAT_SENTINEL) {
          if (!cancelled) {
            setSessionId(null);
            setMessages([getIntroMessage(user?.name, activeCompanion.name)]);
          }
          return;
        }

        let targetSessionId = savedId;

        if (!targetSessionId) {
          const allSessions = await api.getSessions();
          if (Array.isArray(allSessions) && allSessions.length > 0) {
            targetSessionId = allSessions[0].id;
          }
        }

        if (targetSessionId) {
          const history = await api.getSessionMessages(targetSessionId);
          if (!cancelled && Array.isArray(history) && history.length > 0) {
            setSessionId(targetSessionId);
            setMessages(history);
            await persistActiveSession(targetSessionId, user.id);
            return;
          }
        }

        if (!cancelled) {
          setSessionId(null);
          setMessages([getIntroMessage(user?.name, activeCompanion.name)]);
        }
      } catch {
        if (!cancelled) {
          setSessionId(null);
          setMessages([getIntroMessage(user?.name, activeCompanion.name)]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSession(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  // Keep intro greeting synced when user name or companion changes
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "intro") {
        return [getIntroMessage(user?.name, activeCompanion.name)];
      }
      return prev;
    });
  }, [user?.name, activeCompanion.name]);

  // Consume Home / Notification starterPrompt cleanly once
  useEffect(() => {
    const cleanPrompt =
      typeof starterPrompt === "string" ? starterPrompt.trim() : "";
    if (!cleanPrompt) {
      lastHandledStarterRef.current = "";
      return;
    }
    if (cleanPrompt === lastHandledStarterRef.current) return;
    lastHandledStarterRef.current = cleanPrompt;

    setLoadingSession(false);
    setSessionId(null);
    setMessages([getIntroMessage(user?.name, activeCompanion.name)]);
    setInput(cleanPrompt);
    persistActiveSession(NEW_CHAT_SENTINEL);
    router.setParams({ starterPrompt: "" });
  }, [starterPrompt]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Scroll to bottom when new messages arrive or typing state changes
  useEffect(() => {
    if (messages.length > 1 || loading) {
      const t = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 90);
      return () => clearTimeout(t);
    }
  }, [messages.length, loading]);

  const handleSend = async (textToSend) => {
    const isFromChip = typeof textToSend === "string";
    const text = (isFromChip ? textToSend : input).trim();
    if (!text || loading) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const userMsg = {
      id: `user_${Date.now()}`,
      sender: "user",
      content: text,
      suggestions: [],
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!isFromChip) setInput("");
    setLoading(true);

    try {
      const res = await api.sendMessage(text, sessionId);
      if (res?.sessionId) {
        setSessionId(res.sessionId);
        persistActiveSession(res.sessionId);
      }
      if (res?.reply) {
        try {
          Haptics.selectionAsync();
        } catch {}
        markDailyHabit(user?.id, "chat");
        setMessages((prev) => [
          ...prev,
          {
            id: `ai_${Date.now()}`,
            sender: "assistant",
            content: res.reply,
            suggestions: Array.isArray(res.suggestions) ? res.suggestions : [],
          },
        ]);
      }
    } catch (err) {
      console.warn("[Chat] sendMessage failed:", err?.message || err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "assistant",
          content:
            "I am having trouble connecting right now, but remember to take a deep, steady breath. I am still here.",
          suggestions: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const openCompanionPicker = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setCompanionModalVisible(true);
  };

  const openHistory = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setHistoryVisible(true);
    setLoadingHistory(true);
    try {
      const data = await api.getSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("[Chat] getSessions failed:", err?.message || err);
      setSessions([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSelectSession = async (session) => {
    setHistoryVisible(false);
    setLoadingSession(true);
    try {
      const data = await api.getSessionMessages(session.id);
      setSessionId(session.id);
      persistActiveSession(session.id);
      if (Array.isArray(data) && data.length > 0) {
        setMessages(data);
      } else {
        setMessages([getIntroMessage(user?.name, activeCompanion.name)]);
      }
    } catch (err) {
      console.warn("[Chat] getSessionMessages failed:", err?.message || err);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleNewChat = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSessionId(null);
    setMessages([getIntroMessage(user?.name, activeCompanion.name)]);
    setInput("");
    setHistoryVisible(false);
    persistActiveSession(NEW_CHAT_SENTINEL);
  };

  const handleDeleteSession = async (id) => {
    try {
      await api.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (sessionId === id) {
        setSessionId(null);
        setMessages([getIntroMessage(user?.name, activeCompanion.name)]);
        persistActiveSession(NEW_CHAT_SENTINEL);
      }
    } catch (err) {
      console.warn("[Chat] deleteSession failed:", err?.message || err);
    }
  };

  const confirmDeleteSession = (id) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Delete this conversation?")) {
        handleDeleteSession(id);
      }
      return;
    }

    Alert.alert("Delete conversation", "This chat will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => handleDeleteSession(id) },
    ]);
  };

  const lastMessage = messages[messages.length - 1];
  const dynamicSuggestions =
    lastMessage?.sender === "assistant" &&
    Array.isArray(lastMessage?.suggestions) &&
    lastMessage.suggestions.length > 0
      ? lastMessage.suggestions
      : null;

  const isBlankIntro = messages.length === 1 && messages[0].id === "intro";
  const activeChips = dynamicSuggestions || (isBlankIntro ? INITIAL_PROMPTS : []);

  // Matches _layout.jsx (8 top + 58 content + bottomInset) plus 16px breathing margin
  const bottomInset = Math.max(insets.bottom, Platform.OS === "ios" ? 20 : 12);
  const tabBarClearance = 66 + bottomInset + 16;

  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        {/* Header with Customizable Animated Avatar */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={openCompanionPicker}
            activeOpacity={0.8}
            accessibilityLabel="Customize AI companion character"
            style={styles.headerLeftBtn}
          >
            <View style={styles.mascotContainer}>
              <CompanionAvatar avatarId={user?.companionAvatar} size={44} isThinking={loading} />
              <View
                style={[
                  styles.liveDot,
                  { backgroundColor: "#10B981", borderColor: colors.background },
                ]}
              />
            </View>

            <View style={styles.headerInfo}>
              <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.text }]}>
                {activeCompanion.name}
              </Text>
              <Text numberOfLines={1} style={[styles.headerStatus, { color: colors.primary }]}>
                {loading
                  ? "Reflecting gently..."
                  : `${activeCompanion.tagline ? `${activeCompanion.tagline} • ` : ""}Tap to switch`}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={openHistory}
              accessibilityLabel="Chat history"
              style={[
                styles.headerIconBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="time-outline" size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNewChat}
              accessibilityLabel="New conversation"
              style={[
                styles.headerIconBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="add" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Message Feed */}
        {loadingSession ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textMuted }]}>
              Restoring your conversation...
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            style={styles.messageList}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={
              loading ? (
                <CompanionTypingBubble
                  colors={colors}
                  companionId={user?.companionAvatar}
                  companionName={activeCompanion.name}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <AnimatedBubble
                item={item}
                isUser={item.sender === "user"}
                colors={colors}
                onPrimaryText={onPrimaryText}
              />
            )}
          />
        )}

        {/* Saved Dynamic AI Follow-Up Questions */}
        {!loading && !loadingSession && activeChips.length > 0 && !isKeyboardVisible && (
          <View style={styles.chipsWrapper}>
            {stackSuggestionsVertically ? (
              <View style={styles.chipsVerticalContainer}>
                {activeChips.map((chip, idx) => (
                  <TouchableOpacity
                    key={`${idx}_${chip.slice(0, 12)}`}
                    onPress={() => handleSend(chip)}
                    activeOpacity={0.75}
                    style={[
                      styles.chipVertical,
                      {
                        backgroundColor: colors.surface,
                        borderColor: dynamicSuggestions ? colors.primary + "55" : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.chipVerticalLeft}>
                      <Ionicons
                        name={dynamicSuggestions ? "sparkles" : "chatbubble-outline"}
                        size={14}
                        color={dynamicSuggestions ? colors.primary : colors.textMuted}
                      />
                      <Text style={[styles.chipVerticalText, { color: colors.text }]}>
                        {chip}
                      </Text>
                    </View>
                    <Ionicons
                      name="arrow-forward"
                      size={15}
                      color={dynamicSuggestions ? colors.primary : colors.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipsScrollContent}
              >
                {activeChips.map((chip, idx) => (
                  <TouchableOpacity
                    key={`${idx}_${chip.slice(0, 12)}`}
                    onPress={() => handleSend(chip)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: colors.surface,
                        borderColor: dynamicSuggestions ? colors.primary + "55" : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={dynamicSuggestions ? "sparkles" : "chatbubble-outline"}
                      size={12}
                      color={dynamicSuggestions ? colors.primary : colors.textMuted}
                    />
                    <Text style={[styles.chipText, { color: colors.text }]}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Chat Input */}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.surface,
              borderColor: isInputFocused ? colors.primary + "80" : colors.border,
              marginBottom: isKeyboardVisible ? 12 : tabBarClearance,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Share what's in your heart..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            underlineColorAndroid="transparent"
            multiline
          />
          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  input.trim() && !loading ? colors.primary : colors.surfaceElevated,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Ionicons
                name="arrow-up"
                size={20}
                color={input.trim() ? onPrimaryText : colors.textMuted}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* In-Chat Companion Character Modal */}
      <Modal
        visible={companionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCompanionModalVisible(false)}
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
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Choose Your Companion
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                  Updates name, avatar, and AI persona across Solace
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCompanionModalVisible(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
            >
              <CompanionPicker layout="grid" hideHeader />
              <TouchableOpacity
                onPress={() => setCompanionModalVisible(false)}
                style={[styles.doneBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.doneBtnText, { color: onPrimaryText }]}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Chat History Modal */}
      <Modal
        visible={historyVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryVisible(false)}
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
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Past Conversations</Text>
              <TouchableOpacity onPress={() => setHistoryVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <View style={styles.modalEmpty}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : sessions.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No saved conversations yet.
                </Text>
              </View>
            ) : (
              <FlatList
                data={sessions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, gap: 10 }}
                renderItem={({ item }) => {
                  const isActive = item.id === sessionId;
                  const preview = item.messages?.[0]?.content || "Open conversation";
                  return (
                    <View
                      style={[
                        styles.sessionRow,
                        {
                          backgroundColor: colors.surface,
                          borderColor: isActive ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.sessionMain}
                        onPress={() => handleSelectSession(item)}
                      >
                        <Text numberOfLines={1} style={[styles.sessionTitle, { color: colors.text }]}>
                          {item.title || "Daily Check-in"}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.sessionPreview, { color: colors.textMuted }]}
                        >
                          {preview}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => confirmDeleteSession(item.id)}
                        style={styles.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerLeftBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mascotContainer: { position: "relative" },
  liveDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  headerStatus: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centerLoader: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  loaderText: { fontSize: 14 },
  messageList: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  messageBubble: {
    maxWidth: "82%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: 1 },
  messageText: { fontSize: 15, lineHeight: 22 },
  typingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 12,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  typingLabel: { fontSize: 13, fontWeight: "500" },
  dotsGroup: { flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 2 },
  typingDot: { width: 6, height: 6, borderRadius: 3 },
  chipsWrapper: { marginBottom: 10 },
  chipsVerticalContainer: {
    paddingHorizontal: 16,
    gap: 7,
  },
  chipVertical: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  chipVerticalLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chipVerticalText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  chipsScrollContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "500" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 15,
    paddingTop: 10,
    paddingBottom: 10,
    ...(Platform.OS === "web"
      ? { outlineStyle: "none", outlineWidth: 0 }
      : {}),
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "75%",
    minHeight: "40%",
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
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  modalEmpty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 10 },
  emptyText: { fontSize: 14 },
  doneBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  doneBtnText: { fontSize: 15, fontWeight: "700" },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 12,
  },
  sessionMain: { flex: 1, marginRight: 8 },
  sessionTitle: { fontSize: 15, fontWeight: "600" },
  sessionPreview: { fontSize: 13, marginTop: 2 },
  deleteBtn: { padding: 8 },
});