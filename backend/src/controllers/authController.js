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
});

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

    let user = await prisma.user.findUnique({ where: { email: verifiedEmail } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: verifiedEmail,
          name: verifiedName?.trim() || "Friend",
          avatar: DEFAULT_AVATAR,
          companionAvatar: DEFAULT_COMPANION_AVATAR,
          wellnessGoal: DEFAULT_GOAL,
          isGuest: false,
        },
      });
    }

    const token = generateToken(user.id, false);
    res.json({ user: formatUser(user), token });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ error: "Failed to authenticate with Google" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, avatar, companionAvatar, wellnessGoal } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(avatar ? { avatar } : {}),
        ...(companionAvatar ? { companionAvatar } : {}),
        ...(wellnessGoal ? { wellnessGoal } : {}),
      },
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
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name?.trim() || "Friend",
        avatar: DEFAULT_AVATAR,
        wellnessGoal: DEFAULT_GOAL,
        isGuest: false,
      },
    });

    const token = generateToken(user.id, false);
    res.status(201).json({ user: formatUser(user), token });
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

    const token = generateToken(user.id, user.isGuest);
    res.json({ user: formatUser(user), token });
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
        wellnessGoal: DEFAULT_GOAL,
        isGuest: true,
      },
    });

    const token = generateToken(user.id, true);
    res.status(201).json({ user: formatUser(user), token });
  } catch (error) {
    console.error("Guest Login Error:", error);
    res.status(500).json({ error: "Failed to create guest session" });
  }
};