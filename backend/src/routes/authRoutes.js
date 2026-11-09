// backend/src/routes/authRoutes.js
import { Router } from "express";
import {
  register,
  login,
  guestLogin,
  googleLogin,
  updateProfile,
  getMe,
} from "../controllers/authController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.post("/guest", guestLogin);
router.post("/google", googleLogin);
router.get("/me", authenticateToken, getMe);
router.put("/profile", authenticateToken, updateProfile);

export default router;