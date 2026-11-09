// app/login.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import GoogleLogo from "../components/GoogleLogo";
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
  const {
    user,
    needsSetup,
    login,
    register,
    loginAsGuest,
    loginWithGoogle,
  } = useAuth();
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const enterAnim = useRef(new Animated.Value(0)).current;

  const googleModule = useMemo(() => getNativeGoogleModule(), []);

  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

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

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      Haptics.impactAsync(style);
    } catch {}
  };

  const routeAfterAuth = (authResult, forceSetup = false) => {
    const goToSetup =
      forceSetup ||
      Boolean(authResult?.isNewUser) ||
      Boolean(authResult?.user && authResult.user.hasOnboarded === false);

    if (goToSetup) {
      router.replace("/setup");
    } else {
      router.replace("/(tabs)");
    }
  };

  const handleClose = () => {
    triggerHaptic();
    if (user && !needsSetup) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
      return;
    }
    if (user && needsSetup) {
      router.replace("/setup");
      return;
    }
    router.replace("/onboarding");
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

      // Clear cached selection so the account picker lets users choose an account cleanly
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

      const res = await loginWithGoogle({
        email: googleUser.email,
        name: googleUser.name,
        idToken,
      });

      routeAfterAuth(res);
    } catch (err) {
      if (err?.code === statusCodes?.SIGN_IN_CANCELLED) {
        // User dismissed the popup
      } else if (err?.code === statusCodes?.IN_PROGRESS) {
        setError("Google sign-in is already open.");
      } else if (err?.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
        setError(
          "Google Play Services is unavailable or needs an update on this device."
        );
      } else if (
        String(err?.code) === "10" ||
        String(err?.message).includes("DEVELOPER_ERROR")
      ) {
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
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (isSignUp && !cleanName) {
      setError("Please enter your name.");
      return;
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    if (isSignUp && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

      const res = isSignUp
        ? await register(cleanName, cleanEmail, password)
        : await login(cleanEmail, password);

      routeAfterAuth(res, isSignUp);
    } catch (err) {
      setError(
        err?.message || "Authentication failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    triggerHaptic();

    // Preserve existing guest data if they opened /login from Home/Profile Sync
    if (user?.isGuest) {
      router.replace(needsSetup ? "/setup" : "/(tabs)");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await loginAsGuest();
      routeAfterAuth(res, true);
    } finally {
      setLoading(false);
    }
  };

  const onPrimaryText = isDark ? "#0B0F17" : "#FFFFFF";
  const isBusy = loading || googleLoading;

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
          <Animated.View
            style={{
              opacity: enterAnim,
              transform: [
                {
                  translateY: enterAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            }}
          >
            <TouchableOpacity
              onPress={handleClose}
              accessibilityLabel={user ? "Close login" : "Back to onboarding"}
              style={[
                styles.closeBtn,
                {
                  alignSelf: user ? "flex-end" : "flex-start",
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name={user ? "close" : "arrow-back"}
                size={20}
                color={colors.text}
              />
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
                  ? "Create your account and personalize your companion"
                  : "Welcome back to your peaceful space"}
              </Text>
            </View>

            {/* Native In-App Google Popup Trigger */}
            <TouchableOpacity
              onPress={handleGoogleSignIn}
              disabled={isBusy}
              activeOpacity={0.85}
              style={[
                styles.googleButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: isBusy ? 0.7 : 1,
                },
              ]}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <>
                  <GoogleLogo size={20} />
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
                  triggerHaptic();
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
                  triggerHaptic();
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
                  <View
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: colors.surface,
                        borderColor:
                          focusedField === "name" ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={17}
                      color={
                        focusedField === "name" ? colors.primary : colors.textMuted
                      }
                    />
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="What should we call you?"
                      placeholderTextColor={colors.textMuted}
                      underlineColorAndroid="transparent"
                      value={name}
                      onChangeText={(t) => {
                        setName(t);
                        if (error) setError("");
                      }}
                      onFocus={() => setFocusedField("name")}
                      onBlur={() => setFocusedField(null)}
                      returnKeyType="next"
                      onSubmitEditing={() => emailInputRef.current?.focus()}
                    />
                  </View>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  Email
                </Text>
                <View
                  style={[
                    styles.inputBox,
                    {
                      backgroundColor: colors.surface,
                      borderColor:
                        focusedField === "email" ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={17}
                    color={
                      focusedField === "email" ? colors.primary : colors.textMuted
                    }
                  />
                  <TextInput
                    ref={emailInputRef}
                    style={[styles.input, { color: colors.text }]}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textMuted}
                    underlineColorAndroid="transparent"
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (error) setError("");
                    }}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  Password
                </Text>
                <View
                  style={[
                    styles.inputBox,
                    {
                      backgroundColor: colors.surface,
                      borderColor:
                        focusedField === "password"
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={17}
                    color={
                      focusedField === "password"
                        ? colors.primary
                        : colors.textMuted
                    }
                  />
                  <TextInput
                    ref={passwordInputRef}
                    style={[styles.input, { color: colors.text }]}
                    placeholder={isSignUp ? "Min 6 characters" : "••••••••"}
                    placeholderTextColor={colors.textMuted}
                    underlineColorAndroid="transparent"
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (error) setError("");
                    }}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic();
                      setShowPassword((v) => !v);
                    }}
                    accessibilityLabel={
                      showPassword ? "Hide password" : "Show password"
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isBusy}
                activeOpacity={0.88}
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary, opacity: isBusy ? 0.75 : 1 },
                ]}
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
                disabled={isBusy}
                activeOpacity={0.85}
                style={[styles.guestButton, { borderColor: colors.border }]}
              >
                <Ionicons name="leaf-outline" size={18} color={colors.primary} />
                <Text style={[styles.guestButtonText, { color: colors.text }]}>
                  {user?.isGuest ? "Back to Guest Session" : "Continue as Guest"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 40 },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: "100%",
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