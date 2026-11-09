// app/login.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const LOGO_URL =
  "https://res.cloudinary.com/dru5oqalj/image/upload/v1793887328/1a8b5e2d-5030-440f-9a91-8b76fcf3a917__1_-Photoroom_ukmqzz.png";

const GOOGLE_ICON_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/120px-Google_%22G%22_logo.svg.png";

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ||
  "";

const getNativeGoogleModule = () => {
  if (Platform.OS === "web") return null;
  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === "expo";
  if (isExpoGo) return null;

  try {
    return require("@react-native-google-signin/google-signin");
  } catch {
    return null;
  }
};

export default function AuthScreen() {
  const { colors, isDark } = useTheme();
  const { login, register, loginAsGuest, loginWithGoogle } = useAuth();
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const googleModule = useMemo(() => getNativeGoogleModule(), []);

  useEffect(() => {
    if (!googleModule?.GoogleSignin || !GOOGLE_WEB_CLIENT_ID) return;
    try {
      googleModule.GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        scopes: ["profile", "email"],
        offlineAccess: false,
      });
    } catch (err) {
      console.warn("GoogleSignin.configure failed:", err?.message || err);
    }
  }, [googleModule]);

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const handleClose = () => {
    triggerHaptic();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  const handleGoogleSignIn = async () => {
    triggerHaptic();
    setError("");

    if (!googleModule?.GoogleSignin) {
      setError(
        Platform.OS === "web"
          ? "Google popup sign-in is available in the mobile APK. Use email sign-in on web."
          : "Google native popup requires the installed APK/dev build. Use email sign-in inside Expo Go."
      );
      return;
    }

    if (!GOOGLE_WEB_CLIENT_ID) {
      setError("Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in your build config.");
      return;
    }

    const { GoogleSignin, statusCodes } = googleModule;
    setGoogleLoading(true);

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Clear cached selection so the account picker popup lets users choose an account cleanly
      try {
        await GoogleSignin.signOut();
      } catch {}

      const result = await GoogleSignin.signIn();

      if (result?.type === "cancelled") {
        setGoogleLoading(false);
        return;
      }

      const payload = result?.data || result;
      const idToken = payload?.idToken || null;
      const googleUser = payload?.user || {};

      if (!idToken && !googleUser?.email) {
        setError("Google did not return an account token. Please try again.");
        setGoogleLoading(false);
        return;
      }

      await loginWithGoogle({
        email: googleUser.email,
        name: googleUser.name,
        idToken,
      });

      router.replace("/(tabs)");
    } catch (err) {
      if (err?.code === statusCodes?.SIGN_IN_CANCELLED) {
        // User dismissed the popup
      } else if (err?.code === statusCodes?.IN_PROGRESS) {
        setError("Google sign-in is already open.");
      } else if (err?.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
        setError("Google Play Services is unavailable or needs an update on this device.");
      } else if (String(err?.code) === "10" || String(err?.message).includes("DEVELOPER_ERROR")) {
        setError(
          "Google OAuth setup mismatch: verify your EAS SHA-1 fingerprint and Web Client ID in Google Cloud Console."
        );
      } else {
        setError(err?.message || "Could not complete Google sign-in.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (isSignUp && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    try {
      setLoading(true);
      triggerHaptic();

      if (isSignUp) {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      router.replace("/(tabs)");
    } catch (err) {
      setError(
        err.message || "Authentication failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    triggerHaptic();
    setLoading(true);
    try {
      await loginAsGuest();
      router.replace("/(tabs)");
    } finally {
      setLoading(false);
    }
  };

  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={handleClose}
            style={[
              styles.closeBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.brandBox}>
            <View
              style={[
                styles.logoWrapper,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Image
                source={{ uri: LOGO_URL }}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.brandTitle, { color: colors.text }]}>
              Solace AI
            </Text>
            <Text style={[styles.brandSubtitle, { color: colors.textMuted }]}>
              {isSignUp
                ? "Begin your journey to daily calm"
                : "Welcome back to your peaceful space"}
            </Text>
          </View>

          {/* Native In-App Google Popup Trigger */}
          <TouchableOpacity
            onPress={handleGoogleSignIn}
            disabled={googleLoading || loading}
            style={[
              styles.googleButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: googleLoading || loading ? 0.7 : 1,
              },
            ]}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <>
                <Image
                  source={{ uri: GOOGLE_ICON_URL }}
                  style={styles.googleIcon}
                  resizeMode="contain"
                />
                <Text style={[styles.googleButtonText, { color: colors.text }]}>
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>
              or with email
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Mode Toggle */}
          <View
            style={[
              styles.toggleContainer,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                setIsSignUp(false);
                setError("");
              }}
              style={[
                styles.toggleTab,
                !isSignUp && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  { color: !isSignUp ? onPrimaryText : colors.textMuted },
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setIsSignUp(true);
                setError("");
              }}
              style={[
                styles.toggleTab,
                isSignUp && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  { color: isSignUp ? onPrimaryText : colors.textMuted },
                ]}
              >
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Box */}
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Form Inputs */}
          <View style={styles.form}>
            {isSignUp && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  Name
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="What should we call you?"
                  placeholderTextColor={colors.textMuted}
                  underlineColorAndroid="transparent"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                Email
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                underlineColorAndroid="transparent"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                Password
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                underlineColorAndroid="transparent"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || googleLoading}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            >
              {loading ? (
                <ActivityIndicator color={onPrimaryText} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: onPrimaryText }]}>
                  {isSignUp ? "Create Account" : "Sign In"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleGuest}
              disabled={loading || googleLoading}
              style={[styles.guestButton, { borderColor: colors.border }]}
            >
              <Ionicons name="leaf-outline" size={18} color={colors.primary} />
              <Text style={[styles.guestButtonText, { color: colors.text }]}>
                Continue as Guest
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 40 },
  closeBtn: {
    alignSelf: "flex-end",
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  brandBox: { alignItems: "center", marginBottom: 22 },
  logoWrapper: {
    width: 76,
    height: 76,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    padding: 10,
  },
  logoImage: { width: "100%", height: "100%" },
  brandTitle: { fontSize: 24, fontWeight: "800", letterSpacing: 0.5 },
  brandSubtitle: { fontSize: 13, marginTop: 4, textAlign: "center" },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  googleIcon: { width: 20, height: 20 },
  googleButtonText: { fontSize: 15, fontWeight: "600" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "500" },
  toggleContainer: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: "center",
  },
  toggleText: { fontSize: 14, fontWeight: "600" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: { color: "#EF4444", fontSize: 13, flex: 1 },
  form: { gap: 14 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: "500" },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    ...(Platform.OS === "web" ? { outlineStyle: "none", outlineWidth: 0 } : {}),
  },
  primaryButton: {
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
  },
  primaryButtonText: { fontSize: 15, fontWeight: "700" },
  guestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
  },
  guestButtonText: { fontSize: 14, fontWeight: "600" },
});