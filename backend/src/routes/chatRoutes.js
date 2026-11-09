// backend/src/routes/chatRoutes.js
import { Router } from "express";
import { sendMessage, getSessions, getSessionMessages, deleteSession } from "../controllers/chatController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
router.use(authenticateToken);
router.post("/message", sendMessage);
router.get("/sessions", getSessions);
router.get("/sessions/:id/messages", getSessionMessages);
router.delete("/sessions/:id", deleteSession);

export default router;