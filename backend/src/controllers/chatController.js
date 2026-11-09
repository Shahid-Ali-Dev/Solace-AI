// backend/src/controllers/chatController.js
import prisma from "../config/db.js";
import { getSolaceSystemPrompt } from "../utils/prompts.js";
import { generateCompletion, PRIMARY_CHAT_MODEL } from "../utils/aiClient.js";
import { getCompanionPersona } from "../utils/companions.js";

const DEFAULT_FOLLOW_UPS = [
  "Walk me through a quick reset",
  "Help me unpack what I feel",
  "My mind is still racing",
  "Give me a fresh perspective",
];

const ASSISTANT_OPENER_RE =
  /^(do you|would you|are you|have you|did you|will you|could you share|can you share|can you tell me|want to try|want me to|shall we|how are you|how does|what's crowding|what is crowding|would a .+ help\??)/i;

const ADDRESSED_TO_USER_RE =
  /\b(your mind|your body|your thoughts|your feelings|your chest|your day|you feel|you're feeling|you want|for you|with you|help you)\b/i;

const isUserPerspectiveChip = (chip) => {
  if (typeof chip !== "string") return false;
  const text = chip.trim();
  if (text.length < 4 || text.length > 65) return false;
  if (ASSISTANT_OPENER_RE.test(text)) return false;
  if (ADDRESSED_TO_USER_RE.test(text)) return false;
  return true;
};

const MAX_ACTIVE_HISTORY_CHARS = 3200;

const formatRelativeTime = (dateInput) => {
  const diffMs = Date.now() - new Date(dateInput).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return "today";
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
};

const clip = (str = "", maxLen = 90) => {
  const clean = str.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen).trim()}...`;
};

const buildCrossWindowMemory = (pastSessions = []) => {
  if (!pastSessions.length) return "No earlier chat windows yet.";

  return pastSessions
    .map((session) => {
      const msgs = [...(session.messages || [])].reverse();
      const userBits = msgs
        .filter((m) => m.sender === "user")
        .slice(-2)
        .map((m) => `"${clip(m.content, 75)}"`)
        .join(" -> ");
      const topic = clip(session.title || "Check-in", 36);
      const when = formatRelativeTime(session.updatedAt);
      return `- [${when}] ${topic}${userBits ? `: user shared ${userBits}` : ""}`;
    })
    .join("\n");
};

const trimHistoryToBudget = (recentDesc = [], maxChars = MAX_ACTIVE_HISTORY_CHARS) => {
  const kept = [];
  let totalChars = 0;

  for (const msg of recentDesc) {
    const clean = (msg.content || "").trim();
    if (!clean) continue;
    const bounded = clean.length > 650 ? `${clean.slice(0, 650)}...` : clean;

    // Guarantee at least the 6 most recent messages (3 turns) before enforcing char cap
    if (kept.length >= 6 && totalChars + bounded.length > maxChars) {
      break;
    }

    kept.push({
      role: msg.sender === "user" ? "user" : "assistant",
      content: bounded,
    });
    totalChars += bounded.length;
  }

  return kept.reverse();
};

const parseJsonPayload = (raw) => {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const reply =
      typeof parsed?.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim()
        : "Take one slow breath with me—what feels heaviest right now?";

    const rawChips = Array.isArray(parsed?.userReplyChips)
      ? parsed.userReplyChips
      : Array.isArray(parsed?.followUpQuestions)
      ? parsed.followUpQuestions
      : [];

    const followUpQuestions = [];
    for (const item of rawChips) {
      if (!isUserPerspectiveChip(item)) continue;
      const cleanChip = item.trim();
      if (!followUpQuestions.includes(cleanChip)) {
        followUpQuestions.push(cleanChip);
      }
      if (followUpQuestions.length === 3) break;
    }

    for (const fallback of DEFAULT_FOLLOW_UPS) {
      if (followUpQuestions.length >= 3) break;
      if (!followUpQuestions.includes(fallback)) {
        followUpQuestions.push(fallback);
      }
    }

    return { reply, followUpQuestions };
  } catch {
    return {
      reply: cleaned || "Take one slow breath with me—what feels heaviest right now?",
      followUpQuestions: DEFAULT_FOLLOW_UPS.slice(0, 3),
    };
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    const userId = req.user.userId;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    const cleanMessage = message.trim();

    let currentSessionId = null;
    if (sessionId) {
      const existingSession = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId },
      });
      if (existingSession) currentSessionId = existingSession.id;
    }

    if (!currentSessionId) {
      const title =
        cleanMessage.length > 34
          ? `${cleanMessage.slice(0, 34)}...`
          : cleanMessage;
      const newSession = await prisma.chatSession.create({
        data: { userId, title },
      });
      currentSessionId = newSession.id;
    }

    const [user, recentMoods, recentMessages, pastSessions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, wellnessGoal: true, companionAvatar: true },
      }),
      prisma.moodLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { mood: true, note: true, createdAt: true },
      }),
      prisma.chatMessage.findMany({
        where: { sessionId: currentSessionId },
        orderBy: { createdAt: "desc" },
        take: 14,
        select: { sender: true, content: true },
      }),
      prisma.chatSession.findMany({
        where: {
          userId,
          id: { not: currentSessionId },
          messages: { some: {} },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 4,
            select: { sender: true, content: true },
          },
        },
      }),
    ]);

    const realName =
      user?.name && !["Friend", "Guest Explorer"].includes(user.name.trim())
        ? user.name.trim()
        : null;

    const moodPattern = recentMoods.length
      ? recentMoods
          .map((m) => {
            const when = formatRelativeTime(m.createdAt);
            const noteText = m.note ? ` ("${clip(m.note, 50)}")` : "";
            return `${m.mood} [${when}]${noteText}`;
          })
          .join("; ")
      : "none logged yet";

    const userContext = [
      realName ? `Name: ${realName}` : "Name: not set yet",
      `Focus goal: ${user?.wellnessGoal || "Calm & Stress Relief"}`,
      `Recent mood trend: ${moodPattern}`,
      `Earlier conversations (last ${pastSessions.length} windows):\n${buildCrossWindowMemory(pastSessions)}`,
    ].join("\n");

    const previousMessages = trimHistoryToBudget(recentMessages);
    const companion = getCompanionPersona(user?.companionAvatar);

    const conversationPayload = [
      {
        role: "system",
        content: `${getSolaceSystemPrompt(companion)}\n\nUser wellness profile:\n${userContext}`,
      },
      ...previousMessages,
      { role: "user", content: cleanMessage },
    ];

    const rawReply = await generateCompletion({
      messages: conversationPayload,
      model: PRIMARY_CHAT_MODEL,
      temperature: 0.78,
      maxCompletionTokens: 650,
      reasoningEffort: "low",
      jsonMode: true,
    });

    const { reply, followUpQuestions } = parseJsonPayload(rawReply);

    await prisma.$transaction([
      prisma.chatMessage.create({
        data: { sessionId: currentSessionId, sender: "user", content: cleanMessage },
      }),
      prisma.chatMessage.create({
        data: {
          sessionId: currentSessionId,
          sender: "assistant",
          content: reply,
          suggestions: JSON.stringify(followUpQuestions),
        },
      }),
      prisma.chatSession.update({
        where: { id: currentSessionId },
        data: { updatedAt: new Date() },
      }),
    ]);

    res.json({
      sessionId: currentSessionId,
      reply,
      suggestions: followUpQuestions,
    });
  } catch (error) {
    console.error("Groq Chat Error:", error);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
};

export const getSessions = async (req, res) => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { userId: req.user.userId },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
};

export const getSessionMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await prisma.chatSession.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!session) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
    });

    const hydrated = messages.map((m) => {
      let suggestions = [];
      if (m.suggestions) {
        try {
          const parsed = JSON.parse(m.suggestions);
          if (Array.isArray(parsed)) suggestions = parsed;
        } catch {}
      }
      return {
        id: m.id,
        sessionId: m.sessionId,
        sender: m.sender,
        content: m.content,
        suggestions,
        createdAt: m.createdAt,
      };
    });

    res.json(hydrated);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

export const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await prisma.chatSession.deleteMany({
      where: { id, userId: req.user.userId },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({ message: "Conversation deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete session" });
  }
};