// context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";

const AuthContext = createContext();

const ONBOARDED_KEY = "solace_has_onboarded";
const setupDoneKey = (userId) => `solace_setup_done_${userId}`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [localSetupDone, setLocalSetupDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedUser, storedToken, seenOnboarding] = await Promise.all([
          AsyncStorage.getItem("solace_user"),
          AsyncStorage.getItem("solace_token"),
          AsyncStorage.getItem(ONBOARDED_KEY),
        ]);

        setHasSeenOnboarding(seenOnboarding === "true");

        if (storedUser && storedToken && storedToken !== "offline_token") {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);

          const doneFlag = await AsyncStorage.getItem(setupDoneKey(parsedUser.id));
          setLocalSetupDone(Boolean(parsedUser.hasOnboarded) || doneFlag === "true");

          try {
            const fresh = await api.getMe();
            if (fresh?.user) {
              setUser(fresh.user);
              await AsyncStorage.setItem("solace_user", JSON.stringify(fresh.user));
              if (fresh.user.hasOnboarded) {
                setLocalSetupDone(true);
                await AsyncStorage.setItem(setupDoneKey(fresh.user.id), "true");
              }
            }
          } catch (err) {
            if (
              err.message?.includes("Invalid") ||
              err.message?.includes("not found") ||
              err.message?.includes("Access token")
            ) {
              await AsyncStorage.multiRemove(["solace_token", "solace_user"]);
              setUser(null);
              setLocalSetupDone(false);
            }
          }
        } else {
          await AsyncStorage.multiRemove(["solace_token", "solace_user"]);
        }
      } catch (e) {
        console.warn("Failed to load user session", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveSession = async (userData, token) => {
    await AsyncStorage.setItem("solace_token", token);
    await AsyncStorage.setItem("solace_user", JSON.stringify(userData));
    const doneFlag = await AsyncStorage.getItem(setupDoneKey(userData.id));
    setLocalSetupDone(Boolean(userData.hasOnboarded) || doneFlag === "true");
    setUser(userData);
  };

  const completeOnboarding = async () => {
    setHasSeenOnboarding(true);
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, "true");
    } catch {}
  };

  const login = async (email, password) => {
    const data = await api.login(email, password);
    if (data?.token && data?.user) {
      await saveSession(data.user, data.token);
    }
    return data;
  };

  const loginWithGoogle = async (profile) => {
    const data = await api.googleLogin(profile);
    if (data?.token && data?.user) {
      await saveSession(data.user, data.token);
    }
    return data;
  };

  const register = async (name, email, password) => {
    const data = await api.register(name, email, password);
    if (data?.token && data?.user) {
      await saveSession(data.user, data.token);
    }
    return data;
  };

  const loginAsGuest = async () => {
    try {
      const data = await api.guestLogin();
      if (data?.token && data?.user) {
        await saveSession(data.user, data.token);
      }
      return data;
    } catch {
      const tempGuest = {
        id: "temp_guest",
        name: "Guest Explorer",
        isGuest: true,
        hasOnboarded: false,
      };
      setLocalSetupDone(false);
      setUser(tempGuest);
      return { user: tempGuest, isNewUser: true, offline: true };
    }
  };

  const updateProfile = async (updates) => {
    if (user?.id === "temp_guest") {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      return updatedUser;
    }

    const res = await api.updateProfile(updates);
    const updatedUser = { ...user, ...(res?.user || updates) };
    await AsyncStorage.setItem("solace_user", JSON.stringify(updatedUser));
    setUser(updatedUser);
    return updatedUser;
  };

  const completeSetup = async (updates = {}) => {
    const updatedUser = await updateProfile({
      ...updates,
      hasOnboarded: true,
    });
    setLocalSetupDone(true);
    await completeOnboarding();
    if (updatedUser?.id) {
      try {
        await AsyncStorage.setItem(setupDoneKey(updatedUser.id), "true");
      } catch {}
    }
    return updatedUser;
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(["solace_token", "solace_user"]);
    setLocalSetupDone(false);
    setUser(null);
  };

  const needsSetup = Boolean(user && !user.hasOnboarded && !localSetupDone);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        hasSeenOnboarding,
        needsSetup,
        completeOnboarding,
        completeSetup,
        login,
        register,
        loginAsGuest,
        loginWithGoogle,
        updateProfile,
        logout,
        isAuthenticated: !!user && !user.isGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);