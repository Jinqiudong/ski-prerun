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

// Sky and light for a sun elevation, greyed by cloud.
export function palette(elDeg, kind) {
  const C = (h) => new THREE.Color(h);
  const keys = [
    { el: -12, top: C(0x0b1530), mid: C(0x1a2c55), hor: C(0x2b3d66), sun: C(0x6d7fb8), si: 0.0, amb: 0.25, exp: 0.75 },
    { el: -2, top: C(0x1d2e63), mid: C(0x4a5c9a), hor: C(0xd59a8c), sun: C(0xff9a6a), si: 0.4, amb: 0.35, exp: 0.85 },
    { el: 6, top: C(0x2c5cb0), mid: C(0x7da3df), hor: C(0xffc49a), sun: C(0xffb178), si: 2.4, amb: 0.4, exp: 0.9 },
    { el: 20, top: C(0x1a52b8), mid: C(0x5e97e6), hor: C(0xd6e6f6), sun: C(0xffe6c8), si: 3.3, amb: 0.4, exp: 0.92 },
    { el: 60, top: C(0x1452c4), mid: C(0x4f8ee8), hor: C(0xcfe3f7), sun: C(0xfff6ec), si: 3.6, amb: 0.42, exp: 0.92 },
  ];
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) if (elDeg >= keys[i].el && elDeg <= keys[i + 1].el) { a = keys[i]; b = keys[i + 1]; }
  const t = elDeg <= a.el ? 0 : elDeg >= b.el ? 1 : (elDeg - a.el) / (b.el - a.el);
  const mix = (k) => a[k].clone().lerp(b[k], t), num = (k) => a[k] + (b[k] - a[k]) * t;
  const p = { top: mix("top"), mid: mix("mid"), hor: mix("hor"), sun: mix("sun"), si: num("si"), amb: num("amb"), exp: num("exp") };
  const grey = { clear: 0, cloudy: 0.25, overcast: 0.75, snow: 0.85 }[kind];
  const g = new THREE.Color(0xc4cad3).multiplyScalar(Math.max(0.25, Math.min(1, (elDeg + 6) / 25)));
  for (const k of ["top", "mid", "hor"]) p[k].lerp(g, grey);
  p.si *= 1 - grey * 0.85;
  p.amb += grey * 0.35;
  p.shadow = 1 - grey * 0.8; // how strong mountain shadows are
  p.fog = { clear: [20000, 95000], cloudy: [14000, 70000], overcast: [6000, 32000], snow: [1500, 9000] }[kind];
  p.clouds = { clear: 0.35, cloudy: 1, overcast: 1, snow: 0.6 }[kind];
  return p;
}
