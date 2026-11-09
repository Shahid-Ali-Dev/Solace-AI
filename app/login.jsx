// app/login.jsx
import React, { useState, useEffect, useRef } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

WebBrowser.maybeCompleteAuthSession();

const LOGO_URL =
  "https://res.cloudinary.com/dru5oqalj/image/upload/v1793887328/1a8b5e2d-5030-440f-9a91-8b76fcf3a917__1_-Photoroom_ukmqzz.png";

const GOOGLE_ICON_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/120px-Google_%22G%22_logo.svg.png";

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

  const handledResponseRef = useRef(null);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || webClientId;

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId,
    androidClientId,
    iosClientId,
    scopes: ["profile", "email"],
  });

  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  useEffect(() => {
    if (!response || handledResponseRef.current === response) return;
    handledResponseRef.current = response;

    if (response.type === "success") {
      const idToken =
        response.authentication?.idToken || response.params?.id_token || null;
      const accessToken =
        response.authentication?.accessToken ||
        response.params?.access_token ||
        null;

      if (idToken || accessToken) {
        completeGoogleLogin({ idToken, accessToken });
      } else {
        setError("Google did not return an authentication token.");
        setGoogleLoading(false);
      }
    } else if (response.type === "cancel" || response.type === "dismiss") {
      setGoogleLoading(false);
    } else if (response.type === "error") {
      setError(
        response.error?.message ||
          "Google authentication was cancelled or encountered an error."
      );
      setGoogleLoading(false);
    } else {
      setGoogleLoading(false);
    }
  }, [response]);

  const completeGoogleLogin = async ({ idToken, accessToken }) => {
    try {
      setGoogleLoading(true);
      await loginWithGoogle({ idToken, accessToken });
      router.replace("/(tabs)");
    } catch (err) {
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const handleGoogleSignIn = async () => {
    triggerHaptic();
    setError("");

    if (!request) {
      setError(
        "Google Sign-In is not configured for this build yet. Check your Client IDs or continue with email."
      );
      return;
    }

    setGoogleLoading(true);
    try {
      const res = await promptAsync();
      if (res?.type !== "success") {
        setGoogleLoading(false);
      }
    } catch {
      setGoogleLoading(false);
      setError("Could not open Google authentication.");
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
    await loginAsGuest();
    setLoading(false);
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
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

        {/* Continue with Google */}
        <TouchableOpacity
          onPress={handleGoogleSignIn}
          disabled={googleLoading || !request}
          style={[
            styles.googleButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: googleLoading || !request ? 0.7 : 1,
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
          <View
            style={[styles.dividerLine, { backgroundColor: colors.border }]}
          />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>
            or with email
          </Text>
          <View
            style={[styles.dividerLine, { backgroundColor: colors.border }]}
          />
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
                {
                  color: !isSignUp
                    ? isDark
                      ? "#0B0F17"
                      : "#FFFFFF"
                    : colors.textMuted,
                },
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
                {
                  color: isSignUp
                    ? isDark
                      ? "#0B0F17"
                      : "#FFFFFF"
                    : colors.textMuted,
                },
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
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            {loading ? (
              <ActivityIndicator color={isDark ? "#0B0F17" : "#FFFFFF"} />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: isDark ? "#0B0F17" : "#FFFFFF" },
                ]}
              >
                {isSignUp ? "Create Account" : "Sign In"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleGuest}
            style={[styles.guestButton, { borderColor: colors.border }]}
          >
            <Ionicons
              name="sparkles-outline"
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.guestButtonText, { color: colors.text }]}>
              Continue as Guest
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 50, paddingBottom: 40 },
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