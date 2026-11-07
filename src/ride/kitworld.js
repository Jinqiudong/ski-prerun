// The facility kit placed in the ride's world: the lift you ride (towers, terminals, carriers, the rider's
// own chair and its bubble), the lifts around it at a lower detail, buildings, run and junction signs,
// a few props. Everything instanced is pooled (facilities.js Pool): full models near the camera, a plain
// stand-in further out, nothing beyond. GLBs load lazily, only those this resort and this ride need.
import * as THREE from "three";
import { kit, kits, modelsFor, liftSpec, TERMINAL, terminalPlace, deckLevel, localToWorld, towerParts, latticeParts, farCarrier, splitRim, Pool, paintMat, tintMat, cabinLettering, nameBoard, liftSignMat, runFaceAtlas, junctionFaceMat, clearance, nearestRunPoint, seatOf, ROPE_H, SURFACE_H, CHARCOAL } from "./facilities.js?v=4";

const GRAPHITE = "#2c3138";
// Packed snow banked under a deck or building where the ground falls away: a mound whose sides slope out.
const BANK = new THREE.MeshStandardMaterial({ color: 0xf2f5fa, roughness: 0.9 });
const Y = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
const compose = (x, y, z, yaw, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, yaw), new THREE.Vector3(sx, sy, sz));
const isCabin = (name) => /^gondola|cabriolet/.test(name || "");
// A cabin's colour by its place on the line: the lift's cabin colour, or groups of three (Sky Cab's pulse).
const cabinColorAt = (spec, i) => (spec.cabinGroups ? spec.cabinGroups[Math.floor(i / 3) % spec.cabinGroups.length] : spec.cabinColor || GRAPHITE);
// A carrier's parts for a pool: a cabin's baked body tinted per instance, its lettering if it has one.
function carrierParts(k, { text = null, skipGlass = false } = {}) {
  const cab = isCabin(k.name);
  const near = Object.values(k.parts).filter((p) => p.kind !== "lit" && p.kind !== "lamp" && !(skipGlass && p.kind === "glass"))
    .map((p) => ({ geometry: p.geometry, material: p.material, paint: p.kind === "paint", tint: cab && p.kind === "bake", order: p.kind === "glass" ? 2 : 0 }));
  if (text && cab) near.push(cabinLettering(k, text));
  return near;
}

// A kit model as a group of meshes sharing the kit's geometry (one per building or terminal).
function instance(k, { paint = CHARCOAL, band = null, board = null, shadow = true } = {}) {
  const g = new THREE.Group();
  for (const p of Object.values(k.parts)) {
    let mat = p.material;
    if (p.kind === "paint") mat = /band|stripe/.test(p.material.name) ? (band ? paintMat(band) : p.material) : paintMat(paint);
    if (p.kind === "flat" && board && /name_board/.test(p.material.name)) mat = board(p);
    const m = new THREE.Mesh(p.geometry, mat);
    m.castShadow = shadow && p.kind !== "glass" && p.kind !== "lamp"; m.receiveShadow = true;
    if (p.kind === "glass") m.renderOrder = 2;
    m.userData.kind = p.kind;
    g.add(m);
  }
  return g;
}
// A snow bank under a footprint (local box), from just under the floor down `drop` metres, sides at ~35°.
function plinth(box, drop) {
  const g = new THREE.BoxGeometry(box[1] - box[0], drop, box[3] - box[2], 1, 1, 1).translate((box[0] + box[1]) / 2, -drop / 2 + 0.05, (box[2] + box[3]) / 2);
  const p = g.attributes.position, cx = (box[0] + box[1]) / 2, cz = (box[2] + box[3]) / 2, spread = drop * 1.4;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) { p.setX(i, p.getX(i) + Math.sign(p.getX(i) - cx) * spread); p.setZ(i, p.getZ(i) + Math.sign(p.getZ(i) - cz) * spread); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, BANK);
  m.receiveShadow = true;
  return m;
}

export class Facilities {
  constructor({ T, R, world, renderer, research, resort, known, index }) {
    Object.assign(this, { T, R, world, renderer, research, resort, known, index });
    this.group = new THREE.Group(); world.add(this.group);
    this.cam = new THREE.Vector3(1e9, 0, 0); this.lastRefresh = new THREE.Vector3(1e9, 0, 0);
    this.pools = []; this.carrierPools = new Map(); this.others = []; this.visibles = []; this.t = 0;
    this.clear = clearance(R);
  }

  // ---- The lift you ride: load its models first (the ride waits for these) ----
  async loadLift(spec) {
    const [carrier, base, shaft, head, bottom, top] = await kits([spec.carrier, "tower_base", "tower_shaft", "tower_head", spec.bottom, spec.top]);
    this.liftKits = { carrier, base, shaft, head, bottom, top };
    return this.liftKits;
  }
  towerPool() {
    if (!this._towers) {
      const { base, shaft, head } = this.liftKits, tp = towerParts([base, shaft, head]);
      this._towers = new Pool(this.group, tp.parts, tp.far, 96, { nearR: 320, farR: 2600 });
      this.pools.push(this._towers);
    }
    return this._towers;
  }

  rideLift({ line, spec, lift, rider, alt, seat, myPos }) {
    const K = this.liftKits, color = spec.color, g = spec.gauge;
    this.spec = spec;
    // Towers: footing, shaft and head, at each tower the line computes, the head at the line's gauge.
    const yaw = Math.atan2(line.dir.x, line.dir.z);
    this.myTowers = [];
    const mine = line.towers.slice(1, -1).filter((t) => !t.station);
    if (spec.tower) this.latticePool(spec.tower).then((pool) => { for (const t of mine) pool.add(compose(t.p.x, t.p.y, t.p.z, yaw, 1, (t.h || spec.towerRope) / spec.towerRope, 1), spec.towerColor); this.lastRefresh.set(1e9, 0, 0); });
    else for (const t of mine) this.towerPool().add(compose(t.p.x, t.p.y, t.p.z, yaw, g / 2.8), spec.towerColor, spec.towerBaseColor);
    for (const t of mine) this.myTowers.push(t.p);
    // Terminals at both ends, on plinths where the ground falls away, the lift's name on the board.
    const term = (info) => {
      const k = info.top ? K.top : K.bottom, T0 = TERMINAL[info.name];
      const grp = instance(k, { paint: spec.terminalColor, band: spec.bandColor, board: (p) => nameBoard(p, lift.name, `${info.top ? "顶站" : "底站"} · 海拔 ${alt(info.place.origin).toLocaleString("en-US")} 米`, this.renderer, info.place.mirror < 0) });
      if (info.place.origin.y - info.low > 0.3) grp.add(plinth(T0.box, info.place.origin.y - info.low + 1.5));
      grp.position.copy(info.place.origin); grp.rotation.y = info.place.yaw; grp.scale.x = info.place.mirror;
      grp.userData.stand = new THREE.Vector3(...(T0.stand || [8, 0.5, 0]));
      this.group.add(grp);
      return grp;
    };
    const bottomTerm = term(line.terms[0]), topTerm = term(line.terms[1]);
    // Carriers: the line's (both ropes, one pool) and the rider's own.
    const C = K.carrier, split = spec.bubble ? splitRim(C) : { bake: C.parts.bake.geometry, rim: null };
    let glassMat = C.parts.glass?.material;
    if (glassMat && spec.bubbleColor) { glassMat = glassMat.clone(); glassMat.color.set(spec.bubbleColor); glassMat.opacity = 0.45; }
    const near = [{ geometry: split.bake, material: C.parts.bake.material, tint: spec.cabin }, { geometry: C.parts.paint?.geometry, paint: true }, { geometry: C.parts.snow?.geometry, material: C.parts.snow?.material }, { geometry: C.parts.flat?.geometry, material: C.parts.flat?.material }];
    if (C.parts.glass && !spec.bubble) near.push({ geometry: C.parts.glass.geometry, material: glassMat, order: 2 });
    if (spec.cabin && spec.cabinText) near.push(cabinLettering(C, spec.cabinText));
    this.chairs = new Pool(this.group, near, [{ geometry: farCarrier(spec.carrier), paint: true }], 8, { nearR: 170, farR: 2400 });
    this.chairColor = spec.cabin ? cabinColorAt(spec, 0) : color;
    // A chondola (American Eagle): a cabin every fifth carrier on the line you ride too.
    if (spec.chondola && spec.cabinCarrier) kit(spec.cabinCarrier).then((k) => {
      this.cabins = new Pool(this.group, carrierParts(k), [{ geometry: farCarrier("gondola"), paint: true }], 8, { nearR: 170, farR: 2400 });
      for (const m of this.cabins.meshes) if (m.material.transparent) m.castShadow = false;
      this.cabinColor = spec.cabinColor || GRAPHITE;
    }).catch(() => {});
    if (spec.bubble) {
      this.bubbles = new Pool(this.group, [{ geometry: C.parts.glass.geometry, material: glassMat, order: 2 }, { geometry: split.rim, material: C.parts.bake.material }], null, 8, { nearR: 170, farR: 170 });
      this.bubbles.meshes[0].castShadow = false;
    }
    this.chairItems = [];
    const myChair = new THREE.Group();
    for (const p of [...near.slice(0, 4), ...(spec.cabin && spec.cabinText ? near.slice(-1) : [])]) if (p.geometry) myChair.add(new THREE.Mesh(p.geometry, p.paint ? paintMat(this.chairColor) : p.tint ? tintMat(p.material, this.chairColor) : p.material));
    const myBubble = new THREE.Group();
    if (spec.bubble) { const gl = new THREE.Mesh(C.parts.glass.geometry, glassMat); gl.renderOrder = 2; myBubble.add(gl); if (split.rim) myBubble.add(new THREE.Mesh(split.rim, C.parts.bake.material)); }
    else if (C.parts.glass) { // a cabin's glass, clearer for looking out through it
      const clear = C.parts.glass.material.clone(); clear.opacity = 0.12; clear.color.set(0x9fb4c8);
      const gl = new THREE.Mesh(C.parts.glass.geometry, clear); gl.renderOrder = 2; myBubble.add(gl);
    }
    myBubble.matrixAutoUpdate = false;
    myChair.add(myBubble);
    myChair.traverse((o) => { if (o.isMesh) { o.castShadow = o.renderOrder !== 2; o.receiveShadow = true; } });
    rider.position.set(myPos.x, seat.top - 0.595, seat.z);
    myChair.add(rider);
    this.world.add(myChair);
    // A "prepare to unload" sign beside the up line before the top, facing the chairs.
    kit("sign_lift").then((k) => {
      const s = line.total - (TERMINAL[spec.top].unload || 9) - 26, p = new THREE.Vector3();
      const i = Math.max(0, Math.min(line.ground.length - 1, Math.round((s / line.total) * (line.ground.length - 1))));
      p.copy(line.ground[i]).addScaledVector(line.side, g + 4.5);
      const top = alt(line.terms[1].place.origin);
      const grp = new THREE.Group();
      for (const part of Object.values(k.parts)) { const m = new THREE.Mesh(part.geometry, part.kind === "paint" ? liftSignMat(lift.name, top, this.renderer) : part.material); m.castShadow = true; grp.add(m); }
      grp.scale.setScalar(1.25);
      grp.position.set(p.x, this.T.heightAt(p.x, p.z) - 0.1, p.z); grp.rotation.y = yaw + Math.PI;
      this.group.add(grp);
    }).catch(() => {});
    // Pads round the towers that stand beside a run.
    kit("pole_pad").then((k) => {
      const pool = this.propPool("pole_pad", k);
      if (!spec.tower) for (const p of this.myTowers) if (this.clear(p.x, p.z, 0) < 8) pool.add(compose(p.x, p.y + 0.73, p.z, yaw));
      this.lastRefresh.set(1e9, 0, 0);
    }).catch(() => {});
    return { myChair, myBubble, topTerm, bottomTerm };
  }

  // The line's carriers: n on each rope, spaced from ours; the up ones some with bubbles raised.
  placeChairs(line, d, step, n, along, bOpen, bShut, cabin) {
    const p = _v, q = new THREE.Vector3(), items = this.chairItems, spec = this.spec;
    while (items.length < 2 * n) items.push({ m: new THREE.Matrix4(), color: new THREE.Color(this.chairColor) });
    if (spec.cabinGroups) for (let i = 0; i < 2 * n; i++) items[i].color.set(cabinColorAt(spec, i < n ? i + 1 : n + i));
    const bub = this.bubbles ? (this.bubItems ||= []) : null;
    for (let i = 0; i < n; i++) {
      for (const up of [true, false]) {
        const s = up ? (d + (i + 1) * step) % line.total : (line.total - d + i * step + step / 2) % line.total, path = up ? line.up : line.down;
        along(path, s, p); along(path, s + 4, q);
        const it = items[up ? i : n + i];
        it.m.compose(p, _q.setFromAxisAngle(Y, Math.atan2(q.x - p.x, q.z - p.z)), _s.set(1, 1, 1));
        if (bub) {
          const k = up ? i : n + i; bub[k] ||= { m: new THREE.Matrix4(), color: new THREE.Color() };
          bub[k].m.copy(it.m).multiply(up && (i * 7) % 5 < 3 && !cabin ? bOpen : bShut);
        }
      }
    }
    items.length = bub ? (bub.length = 2 * n) : 2 * n;
    let list = items;
    if (this.cabins) { // every fifth carrier (counted from ours) a cabin
      const cab = (this.cabItems ||= []); list = (this.chairOnly ||= []); list.length = cab.length = 0;
      items.forEach((it, k) => { if ((k % n) % 5 === 4) { it.color.set(this.cabinColor); cab.push(it); } else list.push(it); });
      if (cab.length > this.cabins.cap) this.cabins.grow(cab.length);
      this.cabins.refresh(this.cam, cab);
    }
    if (list.length > this.chairs.cap) this.chairs.grow(list.length);
    if (bub && bub.length > this.bubbles.cap) this.bubbles.grow(bub.length);
    this.chairs.refresh(this.cam, list);
    if (bub) this.bubbles.refresh(this.cam, bub);
  }

  propPool(name, k, opts = {}) {
    const key = "prop:" + name;
    if (!this[key]) {
      const parts = Object.values(k.parts).filter((p) => p.kind !== "lit" && p.kind !== "lamp").map((p) => ({ geometry: p.geometry, material: p.material, paint: p.kind === "paint" }));
      this[key] = new Pool(this.group, parts, null, 16, { nearR: opts.nearR || 300, farR: opts.nearR || 300, shadow: opts.shadow ?? true });
      this.pools.push(this[key]);
    }
    return this[key];
  }

  // ---- Lifts around, seen while riding and skiing: towers, a few carriers, terminals, at lower detail ----
  addOtherLift(l) {
    if (l.pts.length < 2 || l.kind === "magic_carpet") return;
    const spec = liftSpec({ ...l, seats: Math.min(8, Math.max(2, l.seats || 4)) }, this.research, this.known?.[l.name], this.index);
    const T = this.T, pts = l.pts.map(([x, z]) => new THREE.Vector3(x, T.heightAt(x, z), z));
    const dir = pts[pts.length - 1].clone().sub(pts[0]).setY(0).normalize(), side = new THREE.Vector3(dir.z, 0, -dir.x);
    const surface = spec.surface;
    const o = { l, spec, pts, dir, side, surface, group: new THREE.Group(), carriers: [] };
    this.others.push(o);
    this.group.add(o.group);
    // Towers every 85 m along the ground line, clear of the stations.
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    const total = cum[cum.length - 1], at = (s) => { let i = 1; while (i < pts.length - 1 && cum[i] < s) i++; const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); return pts[i - 1].clone().lerp(pts[i], Math.min(1, Math.max(0, t))); };
    const H = surface ? SURFACE_H : spec.towerRope || ROPE_H, nT = Math.max(1, Math.round(total / 85)), towers = [];
    for (let k = 0; k <= nT; k++) { const s = (total * k) / nT; if (s < 28 || s > total - 28) continue; const p = at(s); p.y = T.heightAt(p.x, p.z); towers.push({ s, p }); }
    o.total = total;
    // The rope: from the bottom bullwheel over the towers to the top one.
    const g = surface ? 1.4 : spec.gauge, endH = (s) => (s < 1 ? TERMINAL[spec.bottom].ropeH : TERMINAL[spec.top].ropeH);
    const knots = [{ s: 0, y: pts[0].y + (surface ? 1.2 : endH(0)) }, ...towers.map((t) => ({ s: t.s, y: t.p.y + H })), { s: total, y: pts[pts.length - 1].y + (surface ? 1.2 : endH(total)) }];
    const ropeAt = (s, off, out = new THREE.Vector3()) => {
      let k = 1; while (k < knots.length - 1 && knots[k].s < s) k++;
      const a = knots[k - 1], b = knots[k], t = Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s || 1)));
      const p = at(s); out.set(p.x, a.y + (b.y - a.y) * t - (b.s - a.s) * 0.012 * 4 * t * (1 - t), p.z);
      return out.addScaledVector(side, off);
    };
    o.up = []; o.down = [];
    for (let s = 0; s <= total; s += 4) { o.up.push(ropeAt(s, g)); if (!surface) o.down.push(ropeAt(total - s, -g)); }
    const ropes = [];
    for (const path of [o.up, o.down]) for (let i = 1; i < path.length; i++) ropes.push(path[i - 1], path[i]);
    o.group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ropes), new THREE.LineBasicMaterial({ color: 0x2a2e35 })));
    o.box = [Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.z)), Math.max(...pts.map((p) => p.z))];
    // Its name over the bottom station, always facing you.
    o.group.add(nameTag(l.name, pts[0]));
    const yaw = Math.atan2(dir.x, dir.z);
    const need = surface ? ["tower_base", "tower_shaft", "tower_head_surface"] : [spec.bottom, spec.top];
    if (spec.carrier) need.push(spec.carrier);
    kits(need).then(() => {
      if (surface) {
        if (!this._surface) {
          Promise.all(["tower_base", "tower_shaft", "tower_head_surface"].map(kit)).then((ks) => { const tp = towerParts(ks, SURFACE_H, true); this._surface = new Pool(this.group, tp.parts, tp.far, 32, { nearR: 260, farR: 1800 }); this.pools.push(this._surface); this._surfaceQ.forEach((f) => f()); this._surfaceQ = []; });
          this._surfaceQ ||= [];
        }
        const put = () => { for (const t of towers) this._surface.add(compose(t.p.x, t.p.y, t.p.z, yaw), spec.towerColor); this.lastRefresh.set(1e9, 0, 0); };
        if (this._surface) put(); else (this._surfaceQ ||= []).push(put);
      } else {
        if (spec.tower) this.latticePool(spec.tower).then((pool) => { for (const t of towers) pool.add(compose(t.p.x, t.p.y, t.p.z, yaw), spec.towerColor); this.lastRefresh.set(1e9, 0, 0); });
        else { const pool = this.towerPool(); for (const t of towers) pool.add(compose(t.p.x, t.p.y, t.p.z, yaw, g / 2.8), spec.towerColor, spec.towerBaseColor); }
        // Terminals, seen within a budget of distance.
        for (const [name, top] of [[spec.bottom, false], [spec.top, true]]) {
          kit(name).then((k) => {
            const pl = terminalPlace(name, top, top ? pts[pts.length - 1] : pts[0], dir), lv = deckLevel(T, name, pl);
            pl.origin.y = lv.hi;
            const grp = instance(k, { paint: spec.terminalColor, band: spec.bandColor, board: (p) => nameBoard(p, l.name, null, this.renderer, pl.mirror < 0) });
            if (lv.hi - lv.lo > 0.3) grp.add(plinth(TERMINAL[name].box, lv.hi - lv.lo + 1.5));
            grp.position.copy(pl.origin); grp.rotation.y = pl.yaw; grp.scale.x = pl.mirror;
            o.group.add(grp);
            this.visibles.push({ obj: grp, p: pl.origin, far: 1100, detail: 420 });
          });
        }
      }
      if (spec.carrier) {
        const C = this.carrierPool(spec.carrier, spec.cabinText);
        o.pool = C; o.gap = spec.cabin ? 55 : surface ? 25 : 33; o.speed = spec.detachable ? 5 : surface ? 3 : 2.3;
        o.color = new THREE.Color(spec.cabin ? cabinColorAt(spec, 0) : spec.color);
        if (spec.cabinGroups) o.colors = spec.cabinGroups.map((c) => new THREE.Color(c));
        if (spec.chondola) { o.pool2 = this.carrierPool(spec.cabinCarrier || "gondola"); o.color2 = new THREE.Color(spec.cabinColor || GRAPHITE); } // a cabin every fifth carrier
      }
      this.lastRefresh.set(1e9, 0, 0);
    }).catch(() => {});
  }
  // One pool per carrier model (and lettering: Silver Queen's cabins say ASPEN, Elk Camp's SNOWMASS).
  carrierPool(name, text = null) {
    const key = text ? `${name}|${text.text}` : name;
    if (!this.carrierPools.has(key)) {
      const pool = { items: [], n: 0, pool: null };
      this.carrierPools.set(key, pool);
      kit(name).then((k) => {
        pool.pool = new Pool(this.group, carrierParts(k, { text }), [{ geometry: farCarrier(name), paint: true }], 32, { nearR: 220, farR: 1300 });
        for (const m of pool.pool.meshes) if (m.material.transparent) m.castShadow = false;
      });
    }
    return this.carrierPools.get(key);
  }
  // Lattice towers (tower_lattice), one pool for the resort.
  latticePool(name) {
    return (this._lattice ||= kit(name).then((k) => {
      const lp = latticeParts(k, this.index?.byName?.get(name)?.top || 40);
      const pool = new Pool(this.group, lp.parts, lp.far, 16, { nearR: 420, farR: 2600 });
      this.pools.push(pool);
      return pool;
    }));
  }
  stepOthers(dt) {
    this.t += Math.max(0, dt || 0);
    const c = this.cam, R = 1400;
    for (const cp of this.carrierPools.values()) cp.n = 0;
    for (const o of this.others) {
      if (!o.pool?.pool || c.x < o.box[0] - R || c.x > o.box[1] + R || c.z < o.box[2] - R || c.z > o.box[3] + R) continue;
      const n = Math.floor(o.total / o.gap);
      for (const [path, back] of [[o.up, false], [o.down, true]]) {
        if (path.length < 2) continue;
        for (let i = 0; i < n; i++) {
          const s = (((this.t * o.speed + i * o.gap + (back ? o.gap / 2 : 0)) % o.total) / 4), k = Math.min(path.length - 2, Math.floor(s)), f = s - k;
          const a = path[k], b = path[k + 1];
          if (!a || !b) continue;
          const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, z = a.z + (b.z - a.z) * f;
          if ((x - c.x) ** 2 + (z - c.z) ** 2 > 1300 * 1300) continue;
          const cabin = o.pool2?.pool && i % 5 === 4, cp = cabin ? o.pool2 : o.pool;
          const it = cp.items[cp.n] ||= { m: new THREE.Matrix4(), color: o.color };
          cp.n++; it.color = cabin ? o.color2 : o.colors ? o.colors[Math.floor(i / 3) % o.colors.length] : o.color;
          it.m.compose(_v.set(x, y, z), _q.setFromAxisAngle(Y, Math.atan2(b.x - a.x, b.z - a.z)), _s.set(1, 1, 1));
        }
      }
    }
    for (const cp of this.carrierPools.values()) {
      if (!cp.pool) continue;
      if (cp.n > cp.pool.cap) cp.pool.grow(cp.n);
      cp.pool.refresh(c, cp.items, cp.n);
    }
  }

  // ---- Buildings, signs, props: after the ride has started ----
  async dressResort() {
    const { T, R } = this, villages = R.places.filter((p) => p.kind === "village");
    const toXZ = (b) => b.x != null ? [b.x, b.z] : b.lat != null ? [(b.lon - R.origin.lon) * 111320 * Math.cos((R.origin.lat * Math.PI) / 180), -(b.lat - R.origin.lat) * 110574] : null;
    // The research's named buildings at their real places: a model of the building's own name when the kit
    // has one (models/facilities/glb/buildings.json), else the kit model it maps to. Gondola stations
    // are drawn with their lifts.
    const own = this.index?.has || new Set();
    const slug = (n) => n.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    // A landmark model that names this building ("for" in signature.json), else one named like it.
    const landmark = (n) => modelsFor(this.index, n).find((e) => e.family === "signature" && !TERMINAL[e.name])?.name || (own.has(slug(n)) ? slug(n) : null);
    const isStation = (n) => modelsFor(this.index, n).some((e) => TERMINAL[e.name]); // drawn as its lift's terminal
    const KIND = { restaurant: "restaurant", base_lodge: "base_lodge", village_block: "base_lodge", warming_hut: "warming_hut", patrol: "firstaid", ticket: "ticket_office" };
    const list = this.research?.buildings?.length
      ? this.research.buildings.filter((b) => b.model !== "gondola_station" && b.kind !== "gondola_station" && !isStation(b.name)).map((b) => ({
        name: b.name, exact: true, heading: b.footprint_m?.heading_deg, foot: b.footprint_m, at: toXZ(b),
        model: landmark(b.name) || (own.has(b.model) ? b.model : KIND[b.kind] || "restaurant"),
      })).filter((b) => b.at)
      : [...villages.map((v) => ({ name: v.name, model: "base_lodge", at: [v.x, v.z] })),
        ...R.places.filter((p) => p.kind === "food" && villages.every((v) => Math.hypot(v.x - p.x, v.z - p.z) > 260)).map((p) => ({ name: p.name, model: "restaurant", at: [p.x, p.z] }))];
    this.placed = [];
    const jobs = list.map(async (b) => {
      const k = await kit(b.model);
      // The real footprint (OSM): the model scaled to it, one scale for all three axes so doors and windows
      // stay a plausible size (0.6 to 1.8), its long side along the footprint's.
      const mx = k.box.max.x - k.box.min.x, mz = k.box.max.z - k.box.min.z;
      const sc = b.foot?.length > 0 && b.foot?.width > 0 ? Math.min(1.8, Math.max(0.6, Math.sqrt((Math.max(b.foot.length, b.foot.width) / Math.max(mx, mz)) * (Math.min(b.foot.length, b.foot.width) / Math.min(mx, mz))))) : 1;
      const box = new THREE.Box3(k.box.min.clone().multiplyScalar(sc), k.box.max.clone().multiplyScalar(sc));
      const site = this.siteFor(b.at[0], b.at[1], box, { ...b, longZ: mz > mx });
      if (!site) return;
      const grp = instance(k);
      const { x, z, yaw, y, lo } = site;
      if (y - lo > 0.3) grp.add(plinth([k.box.min.x + 0.3, k.box.max.x - 0.3, k.box.min.z + 0.3, k.box.max.z - 0.3], (y - lo + 1) / sc));
      grp.position.set(x, y, z); grp.rotation.y = yaw; grp.scale.setScalar(sc);
      grp.userData.name = b.name; grp.userData.foot = b.foot ? { ...b.foot, at: b.at, scale: sc } : null;
      this.group.add(grp);
      this.visibles.push({ obj: grp, p: grp.position, far: 1700, detail: 700 });
      if (b.model === "restaurant") this.outside(grp, k.box);
    });
    // Run signs at the top of every named run.
    jobs.push(this.runSigns());
    jobs.push(this.snowGuns(villages));
    jobs.push(this.carpets());
    kit("sign_junction").then((k) => (cache.junction = k)).catch(() => {}); // ready for the way down
    await Promise.allSettled(jobs);
    this.lastRefresh.set(1e9, 0, 0);
  }
  // A clear spot near (x, z) for a footprint: off every run and lift line and other building; the
  // flattest of the nearest; facing the nearest run, else downhill.
  siteFor(x0, z0, box, b = {}) {
    const T = this.T, rad = Math.max(Math.hypot(box.min.x, box.min.z), Math.hypot(box.max.x, box.max.z)) * (b.exact ? 0.6 : 0.85);
    let best = null;
    for (const r of [0, 18, 32, 48, 66, 86, 110, 140]) {
      for (let a = 0; a < (r ? 16 : 1); a++) {
        const x = x0 + Math.cos((a / 16) * Math.PI * 2) * r, z = z0 + Math.sin((a / 16) * Math.PI * 2) * r;
        if (this.clear(x, z, rad) < 0 || this.placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.rad + rad)) continue;
        let hi = -Infinity, lo = Infinity, sum = 0;
        for (const [dx, dz] of [[0, 0], [rad * 0.7, 0], [-rad * 0.7, 0], [0, rad * 0.7], [0, -rad * 0.7]]) { const h = T.heightAt(x + dx, z + dz); hi = Math.max(hi, h); lo = Math.min(lo, h); sum += h; }
        const score = b.exact ? r : r + (hi - lo) * 6; // a real building stays where it is unless it would sit on a run
        if (!best || score < best.score) best = { x, z, score, y: sum / 5, lo };
      }
      if (best && best.score < r + 40) break;
    }
    if (!best) return null;
    const t = nearestRunPoint(this.R, best.x, best.z), n = T.normalAt(best.x, best.z);
    const toward = t ? Math.atan2(t[0] - best.x, t[1] - best.z) : Math.atan2(n.x, n.z);
    if (b.heading != null) { // the real footprint's long side, the front (of the two ways) toward the run
      const a = Math.PI / 2 - (b.heading * Math.PI) / 180, d = (u) => Math.abs(Math.atan2(Math.sin(u - toward), Math.cos(u - toward)));
      best.yaw = [a, a + Math.PI, a + Math.PI / 2, a - Math.PI / 2].slice(b.longZ ? 2 : 0, b.longZ ? 4 : 2).sort((p, q) => d(p) - d(q))[0];
    } else best.yaw = toward;
    this.placed.push({ x: best.x, z: best.z, rad });
    return best;
  }
  // Picnic tables and a board rack on the snow in front of a restaurant.
  async outside(grp, box) {
    const [table, rack] = await kits(["picnic_table", "board_rack"]);
    const tp = this.propPool("picnic_table", table), rp = this.propPool("board_rack", rack);
    grp.updateMatrixWorld(true);
    const zf = box.max.z + 3;
    for (const [x, z, pool, turn] of [[-7, zf, tp, 0.2], [-2.5, zf + 1.5, tp, -0.15], [2.5, zf + 0.5, tp, 0.1], [7.5, zf - 0.5, rp, Math.PI]]) {
      const w = grp.localToWorld(new THREE.Vector3(x, 0, z));
      if (this.clear(w.x, w.z, 1) < -10) continue;
      pool.add(compose(w.x, this.T.heightAt(w.x, w.z), w.z, grp.rotation.y + turn));
    }
  }
  // A sign at the top of each named run, beside where you'd drop in, facing up the hill.
  async runSigns() {
    const k = await kit("sign_run"), R = this.R, T = this.T;
    const named = R.runs.filter((r) => r.name && !r.area && r.pts.length > 2);
    const tops = named.filter((r) => !named.some((o) => o !== r && o.name === r.name && Math.hypot(o.pts[o.pts.length - 1][0] - r.pts[0][0], o.pts[o.pts.length - 1][1] - r.pts[0][1]) < 40));
    const spots = [];
    for (const r of tops) {
      const [x, z] = r.pts[0], b = r.pts[Math.min(3, r.pts.length - 1)], dx = b[0] - x, dz = b[1] - z, L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L, nz = dx / L;
      let at = null;
      for (const off of [17, -17, 22, -22]) { const sx = x + nx * off + (dx / L) * 6, sz = z + nz * off + (dz / L) * 6; if (this.clear(sx, sz, 0.8) > -15.5 && !spots.some((s) => Math.hypot(s.x - sx, s.z - sz) < 6)) { at = [sx, sz]; break; } }
      if (!at) at = [x + nx * 17, z + nz * 17];
      spots.push({ x: at[0], z: at[1], yaw: Math.atan2(-dx, -dz), run: r });
    }
    if (!spots.length) return;
    this.runSignSpots = spots; // where each run's sign stands (the mogul runs' carry a mushroom)
    const atlas = runFaceAtlas(spots.map((s) => s.run), this.renderer);
    const pool = this.propPool("sign_run", { parts: Object.fromEntries(Object.entries(k.parts).filter(([kk]) => kk !== "paint")) }, { nearR: 420 });
    // The faces: one instanced quad, each instance offset into the atlas.
    const face = k.parts.paint.geometry, mat = new THREE.MeshStandardMaterial({ map: atlas.tex, roughness: 0.6 });
    const off = new Float32Array(spots.length * 2);
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = "attribute vec2 uvOff;\nuniform vec2 uvScale;\n" + sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = uv * uvScale + uvOff;");
      sh.uniforms.uvScale = { value: new THREE.Vector2(...atlas.uvOf(0, 1, 1)) };
    };
    const faces = new Pool(this.group, [{ geometry: face.clone(), material: mat }], null, spots.length, { nearR: 420, farR: 420 });
    faces.meshes[0].geometry.setAttribute("uvOff", new THREE.InstancedBufferAttribute(off, 2));
    faces.meshes[0].castShadow = false;
    faces.uvOff = (n, it) => { off[n * 2] = it.uv[0]; off[n * 2 + 1] = it.uv[1]; };
    this.pools.push(faces);
    spots.forEach((s, i) => {
      const m = compose(s.x, T.heightAt(s.x, s.z) - 0.1, s.z, s.yaw, 1.25, 1.25, 1.25);
      pool.add(m); faces.add(m); faces.items[faces.items.length - 1].uv = atlas.uvOf(i, 0, 0);
    });
  }
  // Magic carpets: the kit's 20 m section (magic_carpet) tiled along each carpet's line, each section
  // stretched a little to fit a whole number into the line and pitched to lie on the ground.
  async carpets() {
    const { R, T } = this, X = new THREE.Vector3(1, 0, 0);
    const list = R.lifts.filter((l) => l.pts.length >= 2 && (l.kind === "magic_carpet" || this.research?.lifts.get(String(l.id))?.type === "magic_carpet"));
    if (!list.length) return;
    const k = await kit("magic_carpet");
    const pool = new Pool(this.group, Object.values(k.parts).map((p) => ({ geometry: p.geometry, material: p.material, order: p.kind === "glass" ? 2 : 0 })), null, 32, { nearR: 380, farR: 380 });
    for (const m of pool.meshes) if (m.material.transparent) m.castShadow = false;
    this.pools.push(pool);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), qp = new THREE.Quaternion();
    for (const l of list) {
      let pts = l.pts;
      if (T.heightAt(...pts[0]) > T.heightAt(...pts[pts.length - 1])) pts = [...pts].reverse(); // up the slope
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const total = cum[cum.length - 1], f = total / 20, n = Math.max(1, Math.abs(Math.log(f / Math.floor(f || 1))) < Math.abs(Math.log(Math.ceil(f) / f)) ? Math.floor(f) : Math.ceil(f)), len = total / n; // the section count that stretches least
      const at = (s, out) => { let i = 1; while (i < pts.length - 1 && cum[i] < s) i++; const t = Math.min(1, Math.max(0, (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1))); const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, z = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t; return out.set(x, T.heightAt(x, z), z); };
      for (let i = 0; i < n; i++) {
        at(i * len, a); at((i + 1) * len, b);
        const h = Math.hypot(b.x - a.x, b.z - a.z), L = Math.hypot(h, b.y - a.y);
        _q.setFromAxisAngle(Y, Math.atan2(b.x - a.x, b.z - a.z)).multiply(qp.setFromAxisAngle(X, -Math.atan2(b.y - a.y, h)));
        pool.add(new THREE.Matrix4().compose(_v.copy(a).setY(a.y - 0.08), _q, _s.set(1, 1, L / 20)));
      }
    }
    this.carpetN = pool.items.length;
  }
  // A snow gun or two beside the main runs near each base.
  async snowGuns(villages) {
    const k = await kit("snow_gun"), pool = this.propPool("snow_gun", k);
    for (const v of villages) {
      const runs = this.R.runs.filter((r) => !r.area && r.name).map((r) => {
        let best = null; for (let i = 1; i < r.pts.length - 1; i++) { const d = Math.hypot(r.pts[i][0] - v.x, r.pts[i][1] - v.z); if (d > 70 && d < 260 && (!best || d < best.d)) best = { d, i }; }
        return best && { r, ...best };
      }).filter(Boolean).sort((a, b) => a.d - b.d);
      for (const { r, i } of runs.slice(0, 2)) {
        const [x, z] = r.pts[i], [bx, bz] = r.pts[i + 1], L = Math.hypot(bx - x, bz - z) || 1, nx = -(bz - z) / L, nz = (bx - x) / L;
        for (const s of [1, -1]) {
          const gx = x + nx * 17 * s, gz = z + nz * 17 * s;
          if (this.clear(gx, gz, 1) < -15.5) continue;
          pool.add(compose(gx, this.T.heightAt(gx, gz), gz, Math.atan2(-nx * s, -nz * s))); break;
        }
      }
    }
  }
  // A junction post: three arrow boards, the ways painted on them. Falls back to `fallback` until loaded.
  junctionSign(x, z, yaw, options, fallback) {
    const k = cache.junction;
    if (!k) { kit("sign_junction").then((kk) => (cache.junction = kk)).catch(() => {}); return fallback(); }
    const g = new THREE.Group(), face = junctionFaceMat(options, this.renderer);
    for (const p of Object.values(k.parts)) { const m = new THREE.Mesh(p.geometry, p.kind === "paint" ? face : p.material); m.castShadow = p.kind !== "paint"; g.add(m); }
    g.scale.setScalar(1.6); g.userData.junction = true;
    g.position.set(x, this.T.heightAt(x, z) - 0.15, z); g.rotation.y = yaw;
    return g;
  }

  // ---- Each frame ----
  update(cam, dt) {
    this.cam.copy(cam);
    if (this.others.length) this.stepOthers(dt);
    if (cam.distanceToSquared(this.lastRefresh) < 15 * 15) return;
    this.lastRefresh.copy(cam);
    for (const p of this.pools) p.refresh(cam);
    for (const v of this.visibles) {
      const d = v.p.distanceTo(cam);
      v.obj.visible = d < v.far;
      for (const m of v.obj.children) if (m.userData.kind === "snow" || m.userData.kind === "lamp" || m.userData.kind === "flat") m.visible = d < v.detail || m.userData.kind !== "snow";
    }
  }
  stats() {
    const n = (ps) => ps.reduce((a, p) => a + (p.near || 0), 0), f = (ps) => ps.reduce((a, p) => a + (p.far || 0), 0);
    const all = [...this.pools, this.chairs, this.bubbles, this.cabins, ...[...this.carrierPools.values()].map((c) => c.pool)].filter(Boolean);
    return { near: n(all), far: f(all), others: this.others.length, buildings: this.placed?.length || 0, visible: this.visibles.filter((v) => v.obj.visible).length };
  }
}
const cache = {};

function nameTag(name, p) {
  const c = document.createElement("canvas"), cx = c.getContext("2d"), label = name;
  cx.font = "700 44px -apple-system, PingFang SC, sans-serif";
  c.width = Math.ceil(cx.measureText(label).width) + 48; c.height = 72;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(242,182,50,.95)"; g.beginPath(); g.roundRect(0, 0, c.width, 72, 36); g.fill();
  g.font = "700 44px -apple-system, PingFang SC, sans-serif"; g.fillStyle = "#1d1606"; g.textBaseline = "middle"; g.fillText(label, 24, 38);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false }));
  tag.scale.set((c.width / 72) * 7, 7, 1);
  tag.position.set(p.x, p.y + 18, p.z);
  tag.renderOrder = 5;
  return tag;
}
