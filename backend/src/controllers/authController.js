// backend/src/controllers/authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";

const DEFAULT_AVATAR =
  "https://api.dicebear.com/9.x/micah/png?seed=Willow";
const DEFAULT_GOAL = "Calm & Stress Relief";
const DEFAULT_COMPANION_AVATAR = "lumi_girl";

const generateToken = (userId, isGuest = false) => {
  return jwt.sign({ userId, isGuest }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const formatUser = (user) => ({
  id: user.id,
  email: user.email || null,
  name: user.name || "Friend",
  avatar: user.avatar || DEFAULT_AVATAR,
  companionAvatar: user.companionAvatar || DEFAULT_COMPANION_AVATAR,
  wellnessGoal: user.wellnessGoal || DEFAULT_GOAL,
  isGuest: Boolean(user.isGuest),
  hasOnboarded: Boolean(user.hasOnboarded),
  aiMemoryEnabled: user.aiMemoryEnabled !== false,
});

// Safely resolves an active guest session if the client passes a Bearer or body guestToken
const resolveGuestUser = async (req) => {
  const rawHeader = req.headers?.authorization;
  const bearerToken = rawHeader?.startsWith("Bearer ")
    ? rawHeader.slice(7).trim()
    : null;
  const token = req.body?.guestToken || bearerToken;

  if (!token || token === "offline_token") return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.userId) return null;

    const candidate = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (
      candidate &&
      candidate.isGuest &&
      !candidate.email &&
      !candidate.passwordHash
    ) {
      return candidate;
    }
  } catch {
    // Ignore expired or invalid guest tokens during login/register
  }

  return null;
};

// Reassigns guest mood logs & chats into an existing account, then cleans up the guest row
const mergeGuestDataIntoUser = async (guestUserId, targetUserId) => {
  if (!guestUserId || !targetUserId || guestUserId === targetUserId) return;

  await prisma.$transaction([
    prisma.moodLog.updateMany({
      where: { userId: guestUserId },
      data: { userId: targetUserId },
    }),
    prisma.chatSession.updateMany({
      where: { userId: guestUserId },
      data: { userId: targetUserId },
    }),
    prisma.user.deleteMany({
      where: { id: guestUserId, isGuest: true },
    }),
  ]);
};

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user: formatUser(user) });
  } catch (error) {
    console.error("GetMe Error:", error);
    res.status(500).json({ error: "Failed to load profile" });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { idToken, accessToken } = req.body;

    let verifiedEmail = null;
    let verifiedName = null;

    // Only treat idToken as a JWT if it has 3 dot-separated segments
    const hasJwtIdToken =
      typeof idToken === "string" && idToken.split(".").length === 3;

    if (hasJwtIdToken) {
      const googleRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
      );
      if (!googleRes.ok) {
        return res.status(401).json({ error: "Invalid Google ID token" });
      }

      const payload = await googleRes.json();
      const isVerified =
        payload.email_verified === true || payload.email_verified === "true";

      if (!payload.email || !isVerified) {
        return res
          .status(401)
          .json({ error: "Google account email is not verified" });
      }

      verifiedEmail = payload.email.trim().toLowerCase();
      verifiedName = payload.name || payload.given_name;
    } else if (typeof accessToken === "string" && accessToken.trim()) {
      const googleRes = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken.trim()}` },
        }
      );
      if (!googleRes.ok) {
        return res.status(401).json({ error: "Invalid Google access token" });
      }

      const payload = await googleRes.json();
      const isVerified =
        payload.email_verified === true || payload.email_verified === "true";

      if (!payload.email || !isVerified) {
        return res
          .status(401)
          .json({ error: "Google account email is not verified" });
      }

      verifiedEmail = payload.email.trim().toLowerCase();
      verifiedName = payload.name || payload.given_name;
    } else {
      return res
        .status(400)
        .json({ error: "A valid Google idToken or accessToken is required" });
    }

    const guestUser = await resolveGuestUser(req);
    let user = await prisma.user.findUnique({ where: { email: verifiedEmail } });
    let isNewUser = false;

    if (user) {
      if (guestUser && guestUser.id !== user.id) {
        await mergeGuestDataIntoUser(guestUser.id, user.id).catch((err) =>
          console.warn("Guest merge on Google login skipped:", err?.message)
        );
      }
      isNewUser = !user.hasOnboarded;
    } else if (guestUser) {
      // Upgrade guest profile in-place so avatar, companion, and logs stay intact
      const preservedName =
        guestUser.name && !["Friend", "Guest Explorer"].includes(guestUser.name.trim())
          ? guestUser.name.trim()
          : verifiedName?.trim() || "Friend";

      user = await prisma.user.update({
        where: { id: guestUser.id },
        data: {
          email: verifiedEmail,
          name: preservedName,
          isGuest: false,
        },
      });
      isNewUser = !user.hasOnboarded;
    } else {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          email: verifiedEmail,
          name: verifiedName?.trim() || "Friend",
          avatar: DEFAULT_AVATAR,
          companionAvatar: DEFAULT_COMPANION_AVATAR,
          wellnessGoal: DEFAULT_GOAL,
          isGuest: false,
          hasOnboarded: false,
          aiMemoryEnabled: true,
        },
      });
    }

    const token = generateToken(user.id, false);
    res.json({ user: formatUser(user), token, isNewUser });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ error: "Failed to authenticate with Google" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      name,
      avatar,
      companionAvatar,
      wellnessGoal,
      hasOnboarded,
      aiMemoryEnabled,
    } = req.body;

    const data = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (typeof avatar === "string" && avatar.trim()) data.avatar = avatar.trim();
    if (typeof companionAvatar === "string" && companionAvatar.trim()) {
      data.companionAvatar = companionAvatar.trim();
    }
    if (typeof wellnessGoal === "string" && wellnessGoal.trim()) {
      data.wellnessGoal = wellnessGoal.trim();
    }
    if (typeof hasOnboarded === "boolean") data.hasOnboarded = hasOnboarded;
    if (typeof aiMemoryEnabled === "boolean") {
      data.aiMemoryEnabled = aiMemoryEnabled;
    }

    if (Object.keys(data).length === 0) {
      const existing = await prisma.user.findUnique({ where: { id: userId } });
      if (!existing) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.json({ user: formatUser(existing) });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
    });

    res.json({ user: formatUser(updatedUser) });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Valid email and password (min 6 chars) are required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const guestUser = await resolveGuestUser(req);

    let user;
    let isNewUser = true;

    if (guestUser) {
      const preservedName =
        name?.trim() ||
        (guestUser.name && !["Friend", "Guest Explorer"].includes(guestUser.name.trim())
          ? guestUser.name.trim()
          : "Friend");

      user = await prisma.user.update({
        where: { id: guestUser.id },
        data: {
          email: normalizedEmail,
          passwordHash,
          name: preservedName,
          isGuest: false,
        },
      });
      isNewUser = !user.hasOnboarded;
    } else {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: name?.trim() || "Friend",
          avatar: DEFAULT_AVATAR,
          companionAvatar: DEFAULT_COMPANION_AVATAR,
          wellnessGoal: DEFAULT_GOAL,
          isGuest: false,
          hasOnboarded: false,
          aiMemoryEnabled: true,
        },
      });
    }

    const token = generateToken(user.id, false);
    res.status(201).json({ user: formatUser(user), token, isNewUser });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: "Failed to register user" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const guestUser = await resolveGuestUser(req);
    if (guestUser && guestUser.id !== user.id) {
      await mergeGuestDataIntoUser(guestUser.id, user.id).catch((err) =>
        console.warn("Guest merge on login skipped:", err?.message)
      );
    }

    const token = generateToken(user.id, user.isGuest);
    res.json({
      user: formatUser(user),
      token,
      isNewUser: !user.hasOnboarded,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

export const guestLogin = async (req, res) => {
  try {
    const user = await prisma.user.create({
      data: {
        name: "Guest Explorer",
        avatar: DEFAULT_AVATAR,
        companionAvatar: DEFAULT_COMPANION_AVATAR,
        wellnessGoal: DEFAULT_GOAL,
        isGuest: true,
        hasOnboarded: false,
        aiMemoryEnabled: true,
      },
    });

    const token = generateToken(user.id, true);
    res.status(201).json({ user: formatUser(user), token, isNewUser: true });
  } catch (error) {
    console.error("Guest Login Error:", error);
    res.status(500).json({ error: "Failed to create guest session" });
  }
};