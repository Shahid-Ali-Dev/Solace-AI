// backend/src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import prisma from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import moodRoutes from "./routes/moodRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import wellnessRoutes from "./routes/wellnessRoutes.js";

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is missing in backend/.env");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Log every incoming request + status code
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`
    );
  });
  next();
});

// Live Health Check (verifies SQLite dev.db + env keys)
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.user.count();
    res.json({
      status: "ok",
      database: "connected (sqlite)",
      users: userCount,
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
      jwtConfigured: Boolean(process.env.JWT_SECRET),
    });
  } catch (err) {
    console.error("Health Check DB Error:", err);
    res.status(500).json({ status: "error", database: err.message });
  }
});

app.get("/", (req, res) => {
  res.json({ message: "Solace AI Backend is live and healthy." });
});

app.use("/api/auth", authRoutes);
app.use("/api/mood", moodRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/wellness", wellnessRoutes);

app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Solace AI backend running on http://0.0.0.0:${PORT}`);
});