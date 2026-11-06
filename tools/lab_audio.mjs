// The sound lab's recordings (sound.html): trim, fade, normalise to about -20 dBFS and encode each as mono
// AAC 96 kbps with macOS afconvert, then write assets/audio/lab/manifest.json. The list, with each
// source, licence and excerpt, is tools/lab_audio.json.
// usage: node tools/lab_audio.mjs <dir>   (<dir>/raw/<raw>.mp3: the downloaded previews; <dir>/wav is a cache)
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const ROOT = new URL("..", import.meta.url).pathname, DIR = process.argv[2] || ".", OUT = `${ROOT}assets/audio/lab`; mkdirSync(OUT, { recursive: true });
const FS = (id, user) => `https://freesound.org/people/${user}/sounds/${id}/`;
const C = JSON.parse(readFileSync(`${ROOT}tools/lab_audio.json`, "utf8"));
const readWav = (f) => { const b = readFileSync(f); let o = 12; while (o < b.length) { const id = b.toString("ascii", o, o + 4), n = b.readUInt32LE(o + 4); if (id === "data") return Float32Array.from(new Int16Array(b.buffer.slice(b.byteOffset + o + 8, b.byteOffset + o + 8 + n)), (v) => v / 32768); o += 8 + n + (n & 1); } };
const writeWav = (f, x, sr) => { const pcm = Buffer.alloc(x.length * 2); x.forEach((v, i) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2)); const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40); writeFileSync(f, Buffer.concat([h, pcm])); };
const items = [];
let total = 0;
for (const it of C.items) {
  mkdirSync(`${DIR}/wav`, { recursive: true }); const wav = `${DIR}/wav/${it.raw}.wav`;
  if (!existsSync(wav)) execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@44100", "-c", "1", `${DIR}/raw/${it.raw}.mp3`, wav]);
  const sr = 44100, x = readWav(wav), a = Math.floor((it.start || 0) * sr), b = Math.min(x.length, it.dur ? a + Math.floor(it.dur * sr) : x.length);
  let y = x.slice(a, b);
  const fade = Math.floor(sr * (it.loop ? 0.4 : 0.15));
  if (it.loop) { // fold the tail onto the head, so it loops without a seam
    const n = y.length - fade, z = y.slice(0, n);
    for (let i = 0; i < fade; i++) { const u = i / fade; z[i] = y[i] * Math.sqrt(u) + y[n + i] * Math.sqrt(1 - u); }
    y = z;
  } else for (let i = 0; i < fade; i++) { y[i] *= i / fade; y[y.length - 1 - i] *= i / fade; }
  let s = 0, pk = 0; for (const v of y) { s += v * v; pk = Math.max(pk, Math.abs(v)); }
  const rms = Math.sqrt(s / y.length), target = it.group === "music" ? 0.1 : 0.1; // −20 dBFS
  const g = Math.min(target / rms, 0.89 / pk); for (let i = 0; i < y.length; i++) y[i] *= g;
  writeWav(`${DIR}/tmp.wav`, y, sr);
  const file = `${it.id}.m4a`;
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "96000", "-c", "1", `${DIR}/tmp.wav`, `${OUT}/${file}`]);
  const size = statSync(`${OUT}/${file}`).size; total += size;
  console.log(`${file.padEnd(28)} ${(y.length / sr).toFixed(1)}s gain ${(20 * Math.log10(g)).toFixed(1)} dB ${(size / 1024).toFixed(0)} KB`);
  const { raw, start, dur, fsid, user, url, ...keep } = it;
  items.push({ ...keep, file, source: url || FS(fsid, user), excerpt: dur ? `${start || 0}–${(start || 0) + dur} s of the original` : "whole", seconds: +(y.length / sr).toFixed(1) });
}
rmSync(`${DIR}/tmp.wav`);
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ about: C.about, items, missing: C.missing }, null, 2) + "\n");
console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB`);
