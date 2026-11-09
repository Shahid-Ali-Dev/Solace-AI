// constants/userAvatars.js
export const USER_AVATAR_FILTERS = [
  { id: "all", label: "All" },
  { id: "modern", label: "Modern" },
  { id: "sketch", label: "Sketch" },
  { id: "playful", label: "Playful" },
  { id: "spirits", label: "Spirits" },
];

export const USER_BACKDROP_TINTS = [
  { id: "clear", label: "Clear", hex: "", swatch: "transparent" },
  { id: "sage", label: "Sage", hex: "99f6e4", swatch: "#99F6E4" },
  { id: "lavender", label: "Lavender", hex: "ddd6fe", swatch: "#DDD6FE" },
  { id: "amber", label: "Amber", hex: "fde68a", swatch: "#FDE68A" },
  { id: "rose", label: "Rose", hex: "fecdd3", swatch: "#FECDD3" },
  { id: "sky", label: "Sky", hex: "bae6fd", swatch: "#BAE6FD" },
];

// 20 unique user characters (distinct styles & names from the AI companions)
export const USER_AVATARS = [
  // Modern Portraits (micah & personas)
  { id: "m1", label: "Willow", category: "modern", url: "https://api.dicebear.com/9.x/micah/png?seed=Willow" },
  { id: "m2", label: "Orion", category: "modern", url: "https://api.dicebear.com/9.x/micah/png?seed=Orion" },
  { id: "m3", label: "Juniper", category: "modern", url: "https://api.dicebear.com/9.x/micah/png?seed=Juniper" },
  { id: "m4", label: "Kai", category: "modern", url: "https://api.dicebear.com/9.x/micah/png?seed=Kai" },
  { id: "m5", label: "Rowan", category: "modern", url: "https://api.dicebear.com/9.x/personas/png?seed=Rowan" },
  { id: "m6", label: "Iris", category: "modern", url: "https://api.dicebear.com/9.x/personas/png?seed=Iris" },
  { id: "m7", label: "Theo", category: "modern", url: "https://api.dicebear.com/9.x/personas/png?seed=Theo" },
  { id: "m8", label: "Sage", category: "modern", url: "https://api.dicebear.com/9.x/personas/png?seed=Sage" },

  // Ink & Sketch (notionists & open-peeps)
  { id: "s1", label: "River", category: "sketch", url: "https://api.dicebear.com/9.x/notionists/png?seed=River" },
  { id: "s2", label: "Wren", category: "sketch", url: "https://api.dicebear.com/9.x/notionists/png?seed=Wren" },
  { id: "s3", label: "Clover", category: "sketch", url: "https://api.dicebear.com/9.x/open-peeps/png?seed=Clover" },
  { id: "s4", label: "Sol", category: "sketch", url: "https://api.dicebear.com/9.x/open-peeps/png?seed=Sol" },

  // Cozy Playful (big-smile)
  { id: "p1", label: "Sunny", category: "playful", url: "https://api.dicebear.com/9.x/big-smile/png?seed=Sunny" },
  { id: "p2", label: "Milo", category: "playful", url: "https://api.dicebear.com/9.x/big-smile/png?seed=Milo" },
  { id: "p3", label: "Pip", category: "playful", url: "https://api.dicebear.com/9.x/big-smile/png?seed=Pip" },
  { id: "p4", label: "Bramble", category: "playful", url: "https://api.dicebear.com/9.x/big-smile/png?seed=Bramble" },

  // Adventure & Spirits (adventurer & bottts-neutral)
  { id: "sp1", label: "Zephyr", category: "spirits", url: "https://api.dicebear.com/9.x/adventurer/png?seed=Zephyr" },
  { id: "sp2", label: "Lyra", category: "spirits", url: "https://api.dicebear.com/9.x/adventurer/png?seed=Lyra" },
  { id: "sp3", label: "Pixel", category: "spirits", url: "https://api.dicebear.com/9.x/bottts-neutral/png?seed=Pixel" },
  { id: "sp4", label: "Nimbus", category: "spirits", url: "https://api.dicebear.com/9.x/bottts-neutral/png?seed=Nimbus" },
];

export const WELLNESS_GOALS = [
  "Calm & Stress Relief",
  "Overcoming Anxiety",
  "Restful Sleep",
  "Deep Focus",
  "Self-Compassion",
  "Daily Gratitude",
];

export const stripBgParam = (url = "") => {
  if (!url) return "";
  const [base, query = ""] = url.split("?");
  if (!query) return base;
  const kept = query
    .split("&")
    .filter((part) => part && !part.toLowerCase().startsWith("backgroundcolor="));
  return kept.length > 0 ? `${base}?${kept.join("&")}` : base;
};

export const extractBgParam = (url = "") => {
  if (!url || !url.includes("?")) return "";
  const query = url.split("?")[1] || "";
  const found = query
    .split("&")
    .find((part) => part.toLowerCase().startsWith("backgroundcolor="));
  return found ? decodeURIComponent(found.split("=")[1] || "").toLowerCase() : "";
};

export const getTintSwatch = (hex = "") => {
  const found = USER_BACKDROP_TINTS.find(
    (t) => t.hex === hex.toLowerCase()
  );
  return found?.swatch || "transparent";
};

export const buildAvatarUrl = (baseUrl, bgHex) => {
  if (!baseUrl) return "";
  const cleanBase = stripBgParam(baseUrl);
  if (!bgHex) return cleanBase;
  const separator = cleanBase.includes("?") ? "&" : "?";
  return `${cleanBase}${separator}backgroundColor=${bgHex.toLowerCase()}`;
};