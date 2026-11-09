// context/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { Platform, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "../constants/colors";

const ThemeContext = createContext();

const getInitialTheme = (systemScheme) => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem("solace_theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
  }
  return systemScheme === "light" ? "light" : "dark";
};

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState(() =>
    getInitialTheme(systemScheme)
  );
  const [themeLoaded, setThemeLoaded] = useState(Platform.OS === "web");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const savedTheme = await AsyncStorage.getItem("solace_theme");
        if (!active) return;

        if (savedTheme === "light" || savedTheme === "dark") {
          setThemeMode(savedTheme);
        } else if (systemScheme === "light" || systemScheme === "dark") {
          setThemeMode(systemScheme);
        }
      } catch {
      } finally {
        if (active) setThemeLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [systemScheme]);

  const toggleTheme = async () => {
    const nextTheme = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextTheme);
    try {
      await AsyncStorage.setItem("solace_theme", nextTheme);
    } catch {}
  };

  const colors = Colors[themeMode] || Colors.dark;
  const isDark = themeMode === "dark";

  return (
    <ThemeContext.Provider
      value={{ themeMode, themeLoaded, isDark, colors, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);