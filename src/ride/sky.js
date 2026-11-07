// The sun and the weather for a resort at a moment: shared by the miniature, the lift and the run, so the
// sky over the mountain is the same everywhere (a sunset in the sandbox is a sunset on the chair).
import * as THREE from "three";

// ---------- Sun and weather ----------
// Solar position (NOAA approximation): elevation and azimuth in radians, azimuth from north, clockwise.
export function solar(date, lat, lon) {
  const rad = Math.PI / 180, d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = (gmst * 15 + lon) * rad - ra;
  const el = Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(lat * rad) - Math.sin(lat * rad) * Math.cos(ha));
  return { el, az: (az + 2 * Math.PI) % (2 * Math.PI) };
}
// Our frame: x east, z south, y up.
export const sunVector = ({ el, az }) => new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));

// WMO weather codes to our four looks.
export function weatherKind(code, cloud) {
  if ([71, 73, 75, 77, 85, 86].includes(code) || (code >= 56 && code <= 67)) return "snow";
  if (code >= 45 && code <= 48) return "overcast";
  if (cloud >= 85 || code === 3) return "overcast";
  if (cloud >= 40 || code === 2) return "cloudy";
  return "clear";
}
export const WEATHER_ZH = { clear: "晴", cloudy: "多云", overcast: "阴", snow: "下雪" };

// Sky and light for a sun elevation, greyed by cloud. Dusk (the sun from about 6° up to 6° under the horizon)
// is golden: a peach horizon, an orange sun that stays fairly strong, and a warm fill (p.fill, the sky's light
// on the shaded snow; p.warm, 0..1, how much dusk it is) instead of the day's blue. Under snow cloud at dusk
// the sky stays a soft warm grey rather than going night-dark.
export function palette(elDeg, kind) {
  const C = (h) => new THREE.Color(h);
  const keys = [
    { el: -12, top: C(0x0b1530), mid: C(0x1a2c55), hor: C(0x2b3d66), sun: C(0x6d7fb8), si: 0.0, amb: 0.25, exp: 0.75 },
    { el: -6, top: C(0x2e3666), mid: C(0x7a6c9c), hor: C(0xd98f80), sun: C(0xff8a5c), si: 0.6, amb: 0.36, exp: 0.9 },
    { el: -2, top: C(0x3d4f88), mid: C(0xa892b6), hor: C(0xf3a57f), sun: C(0xff965a), si: 1.5, amb: 0.42, exp: 0.97 },
    { el: 6, top: C(0x4769ab), mid: C(0xb3b3d2), hor: C(0xffc088), sun: C(0xffa85e), si: 2.9, amb: 0.44, exp: 0.97 },
    { el: 20, top: C(0x1a52b8), mid: C(0x5e97e6), hor: C(0xd6e6f6), sun: C(0xffe6c8), si: 3.3, amb: 0.4, exp: 0.92 },
    { el: 60, top: C(0x1452c4), mid: C(0x4f8ee8), hor: C(0xcfe3f7), sun: C(0xfff6ec), si: 3.6, amb: 0.42, exp: 0.92 },
  ];
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) if (elDeg >= keys[i].el && elDeg <= keys[i + 1].el) { a = keys[i]; b = keys[i + 1]; }
  const t = elDeg <= a.el ? 0 : elDeg >= b.el ? 1 : (elDeg - a.el) / (b.el - a.el);
  const mix = (k) => a[k].clone().lerp(b[k], t), num = (k) => a[k] + (b[k] - a[k]) * t;
  const p = { top: mix("top"), mid: mix("mid"), hor: mix("hor"), sun: mix("sun"), si: num("si"), amb: num("amb"), exp: num("exp") };
  const grey = { clear: 0, cloudy: 0.25, overcast: 0.75, snow: 0.85 }[kind];
  // How much dusk: 1 from 4° under to 6° over the horizon, gone by 8° under and by 16° up.
  const warm = Math.max(0, Math.min(1, (elDeg + 8) / 4, (16 - elDeg) / 10));
  // Cloud's grey: dimmer as the sun goes down (but a dusk cloud deck still glows), warmed by the sunset.
  const g = new THREE.Color(0xc4cad3).multiplyScalar(Math.max(0.25, Math.min(1, (elDeg + 14) / 20))).lerp(new THREE.Color(0xe0b6a4), warm * 0.3);
  for (const k of ["top", "mid", "hor"]) p[k].lerp(g, grey);
  p.si *= 1 - grey * 0.85;
  p.amb += grey * (0.35 + 0.25 * warm);
  p.exp += grey * 0.12 * warm; // a dusk cloud deck: open up a little
  p.warm = warm;
  p.fill = new THREE.Color(0x9fc2ff).lerp(new THREE.Color(0xf6dcc0), warm * (1 - grey * 0.5)); // the sky's light on the snow
  p.shadow = 1 - grey * 0.8; // how strong mountain shadows are
  p.fog = { clear: [20000, 95000], cloudy: [14000, 70000], overcast: [6000, 32000], snow: [1500, 9000] }[kind];
  p.clouds = { clear: 0.35, cloudy: 1, overcast: 1, snow: 0.6 }[kind];
  return p;
}
