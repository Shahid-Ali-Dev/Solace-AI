// backend/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [storedUser, storedToken] = await Promise.all([
          AsyncStorage.getItem("solace_user"),
          AsyncStorage.getItem("solace_token"),
        ]);

        if (storedUser && storedToken && storedToken !== "offline_token") {
          setUser(JSON.parse(storedUser));
          // Verify token silently in background against backend
          try {
            const fresh = await api.getMe();
            if (fresh?.user) {
              setUser(fresh.user);
              await AsyncStorage.setItem("solace_user", JSON.stringify(fresh.user));
            }
          } catch (err) {
            if (
              err.message?.includes("Invalid") ||
              err.message?.includes("not found") ||
              err.message?.includes("Access token")
            ) {
              await AsyncStorage.multiRemove(["solace_token", "solace_user"]);
              setUser(null);
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
    setUser(userData);
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
    } catch (e) {
      const tempGuest = { id: "temp_guest", name: "Guest Explorer", isGuest: true };
      setUser(tempGuest);
      return { user: tempGuest, offline: true };
    }
  };

  const updateProfile = async (updates) => {
    try {
        const res = await api.updateProfile(updates);
        const updatedUser = { ...user, ...(res?.user || updates) };
        await AsyncStorage.setItem("solace_user", JSON.stringify(updatedUser));
        setUser(updatedUser);
        return updatedUser;
    } catch (error) {
        console.error("Failed to update profile:", error);
        throw error;
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem("solace_token");
    await AsyncStorage.removeItem("solace_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
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