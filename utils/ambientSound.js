// utils/ambientSound.js
import { Platform } from "react-native";

export const SOUND_OPTIONS = [
  { id: "zen_pad", label: "Zen Pad", icon: "musical-notes-outline" },
  { id: "soft_rain", label: "Soft Rain", icon: "rainy-outline" },
  { id: "deep_432", label: "432 Hz", icon: "radio-outline" },
  { id: "off", label: "Silent", icon: "volume-mute-outline" },
];

const SAMPLE_RATE = 16000;
const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const bytesToBase64 = (bytes) => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    out += BASE64_CHARS[b0 >> 2];
    out += BASE64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? BASE64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? BASE64_CHARS[b2 & 63] : "=";
  }
  return out;
};

const encodePcm16WavUri = (samples) => {
  const numSamples = samples.length;
  const dataBytes = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeAscii = (offset, str) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < numSamples; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  return `data:audio/wav;base64,${bytesToBase64(new Uint8Array(buffer))}`;
};

const WAV_URI_CACHE = {};

const getWavDataUri = (key) => {
  if (WAV_URI_CACHE[key]) return WAV_URI_CACHE[key];

  if (key === "chime_rise" || key === "chime_fall") {
    const n = Math.floor(SAMPLE_RATE * 1.15);
    const samples = new Float32Array(n);
    const f1 = key === "chime_rise" ? 396 : 264;
    const f2 = key === "chime_rise" ? 594 : 396;
    const attackSamples = Math.floor(SAMPLE_RATE * 0.04);

    for (let i = 0; i < n; i += 1) {
      const t = i / SAMPLE_RATE;
      const attack =
        i < attackSamples
          ? 0.5 * (1 - Math.cos((Math.PI * i) / attackSamples))
          : 1;
      const decay = Math.exp(-t * 3.8);
      const tone =
        0.72 * Math.sin(2 * Math.PI * f1 * t) +
        0.28 * Math.sin(2 * Math.PI * f2 * t);
      samples[i] = tone * attack * decay * 0.24;
    }

    WAV_URI_CACHE[key] = encodePcm16WavUri(samples);
    return WAV_URI_CACHE[key];
  }

  // Exact 2.5s loop so integer harmonic frequencies align seamlessly
  const n = Math.floor(SAMPLE_RATE * 2.5);
  const samples = new Float32Array(n);

  if (key === "soft_rain") {
    const raw = new Float32Array(n);
    let seed = 133791;
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let lp1 = 0;
    let lp2 = 0;

    for (let i = 0; i < n; i += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = (seed / 4294967296) * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      const pink = (b0 + b1 + b2 + white * 0.06) * 0.4;
      lp1 = lp1 * 0.84 + pink * 0.16;
      lp2 = lp2 * 0.72 + lp1 * 0.28;
      const wave = 0.85 + 0.15 * Math.sin((2 * Math.PI * i) / n);
      raw[i] = lp2 * wave * 1.45;
    }

    // Circular crossfade at loop seam to eliminate clicks
    const fadeLen = Math.floor(n * 0.12);
    for (let i = 0; i < n; i += 1) {
      if (i < fadeLen) {
        const mix = i / fadeLen;
        samples[i] = raw[i] * mix + raw[n - fadeLen + i] * (1 - mix);
      } else {
        samples[i] = raw[i];
      }
    }
  } else {
    // Harmonic frequencies chosen so freq * 2.5 is an exact integer (zero click)
    const chord =
      key === "deep_432"
        ? [
            { f: 108, w: 0.44 },
            { f: 162, w: 0.26 },
            { f: 216, w: 0.2 },
            { f: 324, w: 0.1 },
          ]
        : [
            { f: 132, w: 0.4 },
            { f: 198, w: 0.26 },
            { f: 264, w: 0.22 },
            { f: 330, w: 0.12 },
          ];

    for (let i = 0; i < n; i += 1) {
      const t = i / SAMPLE_RATE;
      const swell = 0.84 + 0.16 * Math.sin((2 * Math.PI * i) / n);
      let sum = 0;
      for (const h of chord) {
        sum += Math.sin(2 * Math.PI * h.f * t) * h.w;
      }
      samples[i] = sum * swell * 0.34;
    }
  }

  WAV_URI_CACHE[key] = encodePcm16WavUri(samples);
  return WAV_URI_CACHE[key];
};

// Lazy native module resolver (prevents crash before `npx expo install expo-audio`)
let expoAudioMod = null;
let audioModeConfigured = false;
const getExpoAudio = () => {
  if (Platform.OS === "web") return null;
  if (expoAudioMod !== null) return expoAudioMod;
  try {
    expoAudioMod = require("expo-audio");
  } catch {
    expoAudioMod = false;
  }
  return expoAudioMod || null;
};

// Native state
let nativeLoopPlayer = null;
let nativeLoopMode = null;
let nativeChimePlayers = {};

// Web Audio state
let webCtx = null;
let webMasterGain = null;
let webActiveNodes = [];
let webMode = null;

const getWebCtx = () => {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!webCtx) webCtx = new Ctx();
  if (webCtx.state === "suspended") {
    webCtx.resume().catch(() => {});
  }
  return webCtx;
};

const stopWebAmbient = () => {
  if (webMasterGain && webCtx) {
    try {
      const now = webCtx.currentTime;
      webMasterGain.gain.cancelScheduledValues(now);
      webMasterGain.gain.setTargetAtTime(0.0001, now, 0.08);
    } catch {}
  }
  const toStop = webActiveNodes;
  webActiveNodes = [];
  webMode = null;
  setTimeout(() => {
    toStop.forEach((n) => {
      try {
        n.stop?.();
        n.disconnect?.();
      } catch {}
    });
  }, 180);
};

const startWebAmbient = (mode, volume = 0.4) => {
  const ctx = getWebCtx();
  if (!ctx) return false;

  if (webMode === mode && webMasterGain) {
    try {
      webMasterGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.25);
    } catch {}
    return true;
  }

  stopWebAmbient();

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.001, ctx.currentTime);
  master.gain.setTargetAtTime(volume, ctx.currentTime, 0.35);
  master.connect(ctx.destination);

  const nodes = [master];

  if (mode === "soft_rain") {
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const out = noiseBuf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      out[i] = (b0 + b1 + b2 + white * 0.05) * 0.28;
    }

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 680;

    src.connect(filter);
    filter.connect(master);
    src.start();
    nodes.push(src, filter);
  } else {
    const freqs =
      mode === "deep_432" ? [108, 162, 216, 324] : [130.81, 196, 261.63, 329.63];
    const weights = [0.22, 0.14, 0.11, 0.06];

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.value = weights[idx] || 0.08;
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      nodes.push(osc, gain);
    });
  }

  webMasterGain = master;
  webActiveNodes = nodes;
  webMode = mode;
  return true;
};

export const startAmbientSound = async (mode, volume = 0.42) => {
  if (!mode || mode === "off") {
    await stopAmbientSound();
    return false;
  }

  if (Platform.OS === "web") {
    return startWebAmbient(mode, volume);
  }

  const ExpoAudio = getExpoAudio();
  if (!ExpoAudio?.createAudioPlayer) return false;

  try {
    if (!audioModeConfigured && ExpoAudio.setAudioModeAsync) {
      audioModeConfigured = true;
      await ExpoAudio.setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    }

    if (nativeLoopPlayer && nativeLoopMode === mode) {
      nativeLoopPlayer.volume = Math.min(1, Math.max(0, volume));
      nativeLoopPlayer.play();
      return true;
    }

    if (nativeLoopPlayer) {
      try {
        nativeLoopPlayer.pause();
        nativeLoopPlayer.remove?.();
      } catch {}
      nativeLoopPlayer = null;
    }

    const uri = getWavDataUri(mode);
    const player = ExpoAudio.createAudioPlayer({ uri });
    player.loop = true;
    player.volume = Math.min(1, Math.max(0, volume));
    player.play();

    nativeLoopPlayer = player;
    nativeLoopMode = mode;
    return true;
  } catch (err) {
    console.warn("Ambient sound start skipped:", err?.message || err);
    return false;
  }
};

export const setAmbientVolume = (volume = 0.4) => {
  const clamped = Math.min(1, Math.max(0, volume));

  if (Platform.OS === "web") {
    if (webMasterGain && webCtx) {
      try {
        webMasterGain.gain.setTargetAtTime(clamped, webCtx.currentTime, 0.45);
      } catch {}
    }
    return;
  }

  if (nativeLoopPlayer) {
    try {
      nativeLoopPlayer.volume = clamped;
    } catch {}
  }
};

export const stopAmbientSound = async () => {
  if (Platform.OS === "web") {
    stopWebAmbient();
    return;
  }

  if (nativeLoopPlayer) {
    try {
      nativeLoopPlayer.pause();
      nativeLoopPlayer.remove?.();
    } catch {}
    nativeLoopPlayer = null;
    nativeLoopMode = null;
  }
};

export const playBreathCueChime = async (phaseName) => {
  if (!phaseName) return;
  const isRising = phaseName === "Inhale" || phaseName === "Top Off";
  const isReleasing = phaseName === "Exhale";
  if (!isRising && !isReleasing) return;

  if (Platform.OS === "web") {
    const ctx = getWebCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = isRising ? 396 : 264;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.09, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.1);
    } catch {}
    return;
  }

  const ExpoAudio = getExpoAudio();
  if (!ExpoAudio?.createAudioPlayer) return;

  const key = isRising ? "chime_rise" : "chime_fall";
  try {
    let player = nativeChimePlayers[key];
    if (!player) {
      player = ExpoAudio.createAudioPlayer({ uri: getWavDataUri(key) });
      player.loop = false;
      player.volume = 0.42;
      nativeChimePlayers[key] = player;
    }
    await Promise.resolve(player.seekTo?.(0)).catch(() => {});
    player.play();
  } catch {}
};

export const releaseAllAudio = async () => {
  await stopAmbientSound();
  Object.values(nativeChimePlayers).forEach((p) => {
    try {
      p?.pause?.();
      p?.remove?.();
    } catch {}
  });
  nativeChimePlayers = {};
};