// app/_layout.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Modal, Platform, View, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { AuthProvider, useAuth } from "../context/AuthContext";
import AnimatedSplash from "../components/AnimatedSplash";
import {
  loadReminders,
  syncScheduledNotifications,
} from "../services/notifications";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootContent() {
  const { isDark, colors, themeLoaded } = useTheme();
  const resolvedThemeLoaded = themeLoaded ?? true;

  const { user, loading: authLoading, hasSeenOnboarding, needsSetup } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const [layoutReady, setLayoutReady] = useState(false);
  const [splashWindowReady, setSplashWindowReady] = useState(
    Platform.OS === "web"
  );
  const [minSplashDone, setMinSplashDone] = useState(false);
  const [splashRemoved, setSplashRemoved] = useState(false);
  const [initialRouted, setInitialRouted] = useState(false);

  const initialRoutedRef = useRef(false);
  const pendingNotifRef = useRef(null);
  const handledNotifKeysRef = useRef(new Set());

  const extractNotificationNav = useCallback((response) => {
    const req = response?.notification?.request;
    const data = req?.content?.data || {};
    if (!data?.route) return null;

    const notifStamp = response?.notification?.date || "";
    const dedupeKey = `${req?.identifier || ""}_${notifStamp}_${
      response?.actionIdentifier || "tap"
    }`;
    if (handledNotifKeysRef.current.has(dedupeKey)) return null;
    handledNotifKeysRef.current.add(dedupeKey);

    const params = { _nt: String(Date.now()) };
    if (data.focusSection) params.focusSection = String(data.focusSection);
    if (data.openAction) params.openAction = String(data.openAction);
    if (data.preset) params.preset = String(data.preset);
    if (data.starterPrompt) params.starterPrompt = String(data.starterPrompt);

    return { pathname: String(data.route), params };
  }, []);

  const navigateFromNotification = useCallback(
    (navTarget) => {
      if (!navTarget?.pathname) return;
      try {
        router.navigate(navTarget);
      } catch {
        router.push(navTarget);
      }
    },
    [router]
  );

  // Fallback timer in case Android Modal onShow does not fire on initial mount
  useEffect(() => {
    if (!resolvedThemeLoaded || splashWindowReady) return;
    const t = setTimeout(() => setSplashWindowReady(true), 140);
    return () => clearTimeout(t);
  }, [resolvedThemeLoaded, splashWindowReady]);

  // Hide native OS splash only after theme, root layout, and splash overlay are ready
  useEffect(() => {
    if (resolvedThemeLoaded && layoutReady && splashWindowReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [resolvedThemeLoaded, layoutReady, splashWindowReady]);

  // Start minimum splash duration once AnimatedSplash is visible
  useEffect(() => {
    if (!resolvedThemeLoaded || !splashWindowReady) return;
    const t = setTimeout(() => setMinSplashDone(true), 1750);
    return () => clearTimeout(t);
  }, [resolvedThemeLoaded, splashWindowReady]);

  // Auth, onboarding, and setup route guards
  useEffect(() => {
    if (authLoading || !resolvedThemeLoaded) return;

    const currentTop = segments[0] || "";
    const inPublicAuthFlow =
      currentTop === "onboarding" || currentTop === "login";

    if (!user) {
      if (!inPublicAuthFlow) {
        router.replace(hasSeenOnboarding ? "/login" : "/onboarding");
      }
      if (!initialRoutedRef.current) {
        initialRoutedRef.current = true;
        setInitialRouted(true);
      }
      return;
    }

    if (needsSetup) {
      if (currentTop !== "setup" && currentTop !== "login") {
        router.replace("/setup");
      }
      if (!initialRoutedRef.current) {
        initialRoutedRef.current = true;
        setInitialRouted(true);
      }
      return;
    }

    if (!initialRoutedRef.current) {
      initialRoutedRef.current = true;
      setInitialRouted(true);
      if (currentTop === "onboarding" || currentTop === "setup") {
        router.replace("/(tabs)");
      }
    }
  }, [
    authLoading,
    resolvedThemeLoaded,
    user,
    hasSeenOnboarding,
    needsSetup,
    segments,
    router,
  ]);

  // Listen for notification taps (foreground, background, and killed cold-start)
  useEffect(() => {
    if (Platform.OS === "web") return;

    let mounted = true;

    (async () => {
      try {
        const lastResponse =
          typeof Notifications.getLastNotificationResponse === "function"
            ? Notifications.getLastNotificationResponse()
            : typeof Notifications.getLastNotificationResponseAsync === "function"
            ? await Notifications.getLastNotificationResponseAsync()
            : null;

        if (!mounted || !lastResponse) return;
        const nav = extractNotificationNav(lastResponse);
        if (nav) {
          pendingNotifRef.current = nav;
        }
      } catch {}
    })();

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const nav = extractNotificationNav(response);
        if (!nav) return;

        if (
          resolvedThemeLoaded &&
          !authLoading &&
          user &&
          !needsSetup &&
          initialRoutedRef.current
        ) {
          navigateFromNotification(nav);
        } else {
          pendingNotifRef.current = nav;
        }
      }
    );

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [
    resolvedThemeLoaded,
    authLoading,
    user,
    needsSetup,
    extractNotificationNav,
    navigateFromNotification,
  ]);

  // Flush any cold-start notification tap once user & routes are ready
  useEffect(() => {
    if (
      !resolvedThemeLoaded ||
      authLoading ||
      !user ||
      needsSetup ||
      !initialRouted ||
      !pendingNotifRef.current
    ) {
      return;
    }

    const nav = pendingNotifRef.current;
    pendingNotifRef.current = null;
    const t = setTimeout(() => navigateFromNotification(nav), 180);
    return () => clearTimeout(t);
  }, [
    resolvedThemeLoaded,
    authLoading,
    user,
    needsSetup,
    initialRouted,
    segments,
    navigateFromNotification,
  ]);

  // Keep device notification schedules synced for the logged-in user
  useEffect(() => {
    if (!user?.id || needsSetup || Platform.OS === "web") return;

    loadReminders(user.id)
      .then((list) =>
        syncScheduledNotifications(list, user, {
          requestPermissionIfNeeded: false,
        })
      )
      .catch(() => {});
  }, [user?.id, user?.companionAvatar, needsSetup]);

  const readyToDismiss =
    resolvedThemeLoaded && !authLoading && minSplashDone && initialRouted;
  const showSplash = resolvedThemeLoaded && !splashRemoved;

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.background }}
      onLayout={() => setLayoutReady(true)}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={{ flex: 1, zIndex: 1, elevation: 0 }} collapsable={false}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
          <Stack.Screen
            name="login"
            options={{ animation: "fade_from_bottom", gestureEnabled: false }}
          />
          <Stack.Screen
            name="setup"
            options={{ animation: "slide_from_right", gestureEnabled: false }}
          />
          <Stack.Screen
            name="mood-assessment"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="reminders"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen name="profile" options={{ presentation: "modal" }} />
        </Stack>
      </View>

      {/* Brief solid shield until native Modal window finishes opening */}
      {Platform.OS !== "web" && !splashRemoved && !splashWindowReady && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: colors.background,
              zIndex: 9998,
              elevation: 9998,
            },
          ]}
        />
      )}

      {showSplash &&
        (Platform.OS === "web" ? (
          <AnimatedSplash
            readyToDismiss={readyToDismiss}
            onFinished={() => setSplashRemoved(true)}
          />
        ) : (
          <Modal
            visible={showSplash}
            transparent
            statusBarTranslucent
            navigationBarTranslucent
            hardwareAccelerated
            animationType="none"
            onShow={() => setSplashWindowReady(true)}
            onRequestClose={() => {}}
          >
            <AnimatedSplash
              readyToDismiss={readyToDismiss}
              onFinished={() => setSplashRemoved(true)}
            />
          </Modal>
        ))}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <RootContent />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}