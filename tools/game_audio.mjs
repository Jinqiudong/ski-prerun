// The real recordings the ride plays (the owner's picks in the sound lab): trim, fade, normalise and encode
// them as mono AAC 96 kbps (macOS afconvert) into assets/audio/game/, and write its manifest.json. For the
// snowboard run it also marks the stretches that sound like carving ("turn") and like slowing in a slide
// ("slow"), by loudness and brightness every half second, so the ride can play the right ones.
// usage: node tools/game_audio.mjs <dir>   (<dir>/raw/fs<id>.mp3: the Freesound previews; <dir>/wav: a cache)
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname, DIR = process.argv[2] || ".", OUT = `${ROOT}assets/audio/game`, SR = 44100;
const ITEMS = [
  { id: "board-run", fsid: 667729, user: "Nox_Sound", title: "Snowboard run: turns and slowing", start: 30, dur: 70, use: "a real layer under the board's sound, turns and slows" },
  { id: "passby", fsid: 592379, user: "cribbler", title: "A skier passing by", use: "other riders passing close by" },
  { id: "station", fsid: 819799, user: "SoundsLikeYukon", title: "Chairlift base station", start: 0, dur: 25, loop: true, use: "the stations, at the bottom and on arrival at the top" },
  { id: "slope", fsid: 720302, user: "xkeril", title: "Beside a ski slope: quiet day, skiers now and then", start: 0, dur: 30, loop: true, use: "the mountain's bed at the top and under the ride down" },
];
const readWav = (f) => { const b = readFileSync(f); let o = 12; while (o < b.length) { const id = b.toString("ascii", o, o + 4), n = b.readUInt32LE(o + 4); if (id === "data") return Float32Array.from(new Int16Array(b.buffer.slice(b.byteOffset + o + 8, b.byteOffset + o + 8 + n)), (v) => v / 32768); o += 8 + n + (n & 1); } };
const writeWav = (f, x) => { const pcm = Buffer.alloc(x.length * 2); x.forEach((v, i) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2)); const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40); writeFileSync(f, Buffer.concat([h, pcm])); };

// Half-second windows: loud and dark = slowing (the board sideways, snow pushed); bright = carving;
// quiet = nothing (standing, handling). Neighbours of a kind join into stretches of 1.5 s or more.
function segments(y) {
  const W = SR / 2, kinds = [];
  for (let s = 0; s + W <= y.length; s += W) {
    let e = 0, d = 0; for (let i = s + 1; i < s + W; i++) { e += y[i] * y[i]; d += (y[i] - y[i - 1]) ** 2; }
    const db = 10 * Math.log10(e / W + 1e-12), bright = (SR / (2 * Math.PI)) * Math.sqrt(d / (e + 1e-12));
    kinds.push(db < -31 ? null : bright < 1300 && db > -27 ? "slow" : bright >= 1300 ? "turn" : null);
  }
  const out = [];
  for (let i = 0; i < kinds.length;) {
    let j = i; while (j < kinds.length && kinds[j] === kinds[i]) j++;
    if (kinds[i] && j - i >= 3) out.push({ kind: kinds[i], from: i / 2, to: j / 2 });
    i = j;
  }
  return out;
}

mkdirSync(OUT, { recursive: true }); mkdirSync(`${DIR}/wav`, { recursive: true });
const items = []; let total = 0;
for (const it of ITEMS) {
  const wav = `${DIR}/wav/fs${it.fsid}.wav`;
  if (!existsSync(wav)) execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@44100", "-c", "1", `${DIR}/raw/fs${it.fsid}.mp3`, wav]);
  const x = readWav(wav), a = Math.floor((it.start || 0) * SR), b = it.dur ? Math.min(x.length, a + Math.floor(it.dur * SR)) : x.length;
  let y = x.slice(a, b);
  const fade = Math.floor(SR * (it.loop ? 0.4 : 0.1));
  if (it.loop) { const n = y.length - fade, z = y.slice(0, n); for (let i = 0; i < fade; i++) { const u = i / fade; z[i] = y[i] * Math.sqrt(u) + y[n + i] * Math.sqrt(1 - u); } y = z; }
  else for (let i = 0; i < fade; i++) { y[i] *= i / fade; y[y.length - 1 - i] *= i / fade; }
  let s = 0, pk = 0; for (const v of y) { s += v * v; pk = Math.max(pk, Math.abs(v)); }
  const g = Math.min(0.1 / Math.sqrt(s / y.length), 0.89 / pk); for (let i = 0; i < y.length; i++) y[i] *= g;
  const segs = it.id === "board-run" ? segments(y) : undefined;
  writeWav(`${DIR}/tmp.wav`, y);
  const file = `${it.id}.m4a`;
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "96000", "-c", "1", `${DIR}/tmp.wav`, `${OUT}/${file}`]);
  total += statSync(`${OUT}/${file}`).size;
  items.push({ id: it.id, file, title: it.title, author: it.user, licence: "CC0-1.0", source: `https://freesound.org/people/${it.user}/sounds/${it.fsid}/`, excerpt: it.dur ? `${it.start}–${it.start + it.dur} s` : "whole", loop: !!it.loop, use: it.use, ...(segs ? { segments: segs } : {}) });
  console.log(`${file.padEnd(16)} ${(y.length / SR).toFixed(1)} s${segs ? ` · ${segs.filter((q) => q.kind === "turn").length} turn, ${segs.filter((q) => q.kind === "slow").length} slow stretches` : ""}`);
}
rmSync(`${DIR}/tmp.wav`);
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ about: "Real recordings the ride plays, picked by the owner in the sound lab (sound.html). All CC0 from Freesound (made from the site's preview of each CC0 original) by tools/game_audio.mjs: trimmed, faded, normalised to about -20 dBFS, mono AAC 96 kbps. board-run's segments: stretches (seconds into the file) that sound like carving (turn) or slowing (slow).", items }, null, 2) + "\n");
console.log(`total ${(total / 1024).toFixed(0)} KB`);
