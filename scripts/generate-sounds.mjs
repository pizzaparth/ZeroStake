/**
 * Synthesises the app's sound effects as small 16-bit mono WAV files, so the
 * app ships original, license-free audio that works fully offline.
 *
 *   npm run sounds   → writes assets/sounds/*.wav
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 44100;
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "sounds");
mkdirSync(out, { recursive: true });

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** A sine/square/triangle tone with an attack–decay envelope. */
function tone({ freq, dur, wave = "sine", gain = 0.5, attack = 0.004, slide = 0 }) {
  const n = Math.floor(dur * RATE);
  let phase = 0;
  return Array.from({ length: n }, (_, i) => {
    const t = i / RATE;
    const f = freq + slide * (t / dur);
    phase += (2 * Math.PI * f) / RATE;
    const env = Math.min(1, t / attack) * Math.exp((-5 * t) / dur);
    const s =
      wave === "square" ? Math.sign(Math.sin(phase)) * 0.6 : wave === "triangle" ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
    return s * env * gain;
  });
}

// Deterministic noise (no Math.random: output is reproducible build to build).
function noise(dur, gain = 0.4) {
  let x = 0x12345678;
  const n = Math.floor(dur * RATE);
  return Array.from({ length: n }, (_, i) => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) / 0xffffffff - 0.5) * 2 * gain * Math.exp((-6 * i) / n);
  });
}

const seq = (...parts) => parts.flat();
const mix = (a, b) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0));
const silence = (dur) => new Array(Math.floor(dur * RATE)).fill(0);

const sounds = {
  tap: tone({ freq: 1400, dur: 0.035, wave: "triangle", gain: 0.35 }),
  bet: tone({ freq: 520, dur: 0.09, wave: "triangle", gain: 0.4, slide: 180 }),
  tick: tone({ freq: 2200, dur: 0.02, wave: "square", gain: 0.12 }),
  reveal: seq(tone({ freq: 880, dur: 0.07, gain: 0.35 }), tone({ freq: 1320, dur: 0.12, gain: 0.3 })),
  win: seq(
    tone({ freq: 523.25, dur: 0.09, wave: "triangle" }),
    tone({ freq: 659.25, dur: 0.09, wave: "triangle" }),
    tone({ freq: 783.99, dur: 0.09, wave: "triangle" }),
    tone({ freq: 1046.5, dur: 0.28, wave: "triangle" }),
  ),
  bigwin: seq(
    ...[523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].map((f) => tone({ freq: f, dur: 0.08, wave: "triangle" })),
    mix(tone({ freq: 2093, dur: 0.5, gain: 0.3 }), tone({ freq: 1046.5, dur: 0.5, wave: "triangle", gain: 0.35 })),
  ),
  lose: seq(tone({ freq: 330, dur: 0.12, wave: "triangle", gain: 0.4 }), tone({ freq: 220, dur: 0.25, wave: "triangle", gain: 0.4, slide: -60 })),
  bust: mix(noise(0.35, 0.35), tone({ freq: 110, dur: 0.35, wave: "square", gain: 0.25, slide: -50 })),
  cashout: seq(tone({ freq: 1567.98, dur: 0.06, gain: 0.3 }), silence(0.01), tone({ freq: 2093, dur: 0.22, gain: 0.3 })),
  card: mix(noise(0.05, 0.25), tone({ freq: 3000, dur: 0.03, gain: 0.05 })),
};

for (const [name, samples] of Object.entries(sounds)) {
  writeFileSync(join(out, `${name}.wav`), wav(samples));
  console.log(`assets/sounds/${name}.wav  ${(samples.length / RATE).toFixed(2)}s`);
}
