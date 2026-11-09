// backend/context/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "../constants/colors";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState("dark"); // Default dark for wellness

  useEffect(() => {
    (async () => {
      const savedTheme = await AsyncStorage.getItem("solace_theme");
      if (savedTheme) {
        setThemeMode(savedTheme);
      } else if (systemScheme) {
        setThemeMode(systemScheme);
      }
    })();
  }, [systemScheme]);

  const toggleTheme = async () => {
    const nextTheme = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextTheme);
    await AsyncStorage.setItem("solace_theme", nextTheme);
  };

  const colors = Colors[themeMode];
  const isDark = themeMode === "dark";

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);