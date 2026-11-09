// Snowboard (and ski) physics on the real slope, the track the board or the skis leave in the snow, and the
// spray it kicks up. (The rider, the model, and its poses are in src/rider/boarder.js and skier.js.)
import * as THREE from "three";
import { DEG, wrap, fallLine, dropAlong, gravityAlong, slipAngle, brakeOf, edgeGrip, pivotFor, brakeDecel, edgeTrails, scrubOf, SKI, skiMode, skiSide, skiPivot, ploughOf, ploughDecel } from "./edge-core.js?v=2";

export { governor, skiGovernor } from "./edge-core.js?v=2";

const damp = (cur, target, rate, dt) => cur + (target - cur) * Math.min(1, dt * rate);

// Slope physics for one rider. Units: meters, seconds, radians. heading 0 = +z.
// The board (yaw) and the way it moves (heading) are apart: the edge carves the board round and the travel
// follows it (tightly on a high edge, sliding on a low one); swinging the board across the travel brakes.
// Gravity drives the board along its own length: pointing down the fall line it runs, across it nothing.
export class Rider {
  constructor(terrain) {
    this.terrain = terrain;
    this.x = 0; this.z = 0; this.y = 0;
    this.heading = 0; this.speed = 0; this.steer = 0; this.lean = 0;
    this.cyaw = 0; this.pivot = 0; this.yaw = 0; this.slip = 0; this.brake = 0; this.caught = 0; this.t = 0;
    this.n = new THREE.Vector3(0, 1, 0);
  }

  place(x, z, heading, speed = 2) {
    Object.assign(this, { x, z, heading, speed, steer: 0, lean: 0, cyaw: heading, yaw: heading, pivot: 0, slip: 0, brake: 0, caught: 0, mode: "glide", side: 0, plough: 0, hockey: 0 });
    this.y = this.terrain.heightAt(x, z);
  }

  // input: steer -1..1 (right positive): how far onto the edge (the edge angle, up to 50°) and so how hard
  // into a turn. pace -1..1: back (-) swings the board across the way you move onto the heel edge to brake
  // (edge-core.js pivotFor, brakeOf), forward (+) runs it flat and tucked. brake: pace -1. push: skate or
  // walk on the flat. offPiste adds deep-snow drag.
  // guided: the route does the steering, so don't swing round to the fall line when stopped.
  // soft 0..1: deep powder underfoot (slower, and the board floats into and out of turns); rough: extra
  // friction (moguls). heel ±1: the way the heel side turns the board's nose (the rider's stance, as the
  // model draws a skid). catchable: the steer is the rider's own, so setting the wrong edge in a slide
  // catches it (a wobble and lost speed, no fall).
  // ski: two skis instead of the board (edge-core.js skiMode): the brake is a plough, a skidded turn or a hockey
  // stop, the same to either side (heel is not used), no caught edge; skating on the flat is quicker.
  step(dt, { steer, pace = 0, brake, push, offPiste, guided, soft = 0, rough = 0, heel = 1, catchable = false, ski = false }) {
    const t = this.terrain, n = t.normalAt(this.x, this.z, this.n);
    const fl = fallLine(n); this.fall = fl.yaw; this.slope = fl.slope;
    if (brake) pace = -1;
    this.t += dt;
    this.steer = damp(this.steer, steer, 5 - 2.6 * soft, dt);
    this.pace = damp(this.pace ?? 0, pace, 4, dt);
    const bk = Math.max(0, -this.pace), tuck = Math.max(0, this.pace);
    const edge = Math.abs(this.steer) * 50 * DEG;
    const grip = edgeGrip(Math.max(edge, bk > 0.05 ? 35 * DEG : 0)); // braking, the heel edge is set hard: it bites, not smears
    const drop = dropAlong(n, this.heading); // along the travel: negative = uphill
    // The turn: the edge asks for a sideways pull of up to g·tan 50°. The rider has to incline into it to
    // balance (tan lean = pull / g), so a fast turn is a wide one and a slow one a pivot.
    const pull = Math.abs(this.steer) * 9.8 * Math.tan(50 * DEG) * (1 - 0.4 * bk);
    const rate = Math.min(1.6, pull / Math.max(this.speed, 2.5));
    this.cyaw -= Math.sign(this.steer) * rate * dt;
    if (this.speed < 0.5 && drop < 0.05 && !push && !guided) {
      // Stopped across or facing up the hill: turn back toward the fall line instead of standing still.
      const diff = wrap(fl.yaw - this.cyaw);
      this.cyaw += Math.sign(diff) * Math.min(Math.abs(diff), dt * 1.2);
    }
    // The travel follows the carved board: at once on a high edge, sliding round late on a flat base.
    this.heading = this.speed < 0.3 ? this.cyaw : this.heading + wrap(this.cyaw - this.heading) * Math.min(1, (3 + 9 * grip) * dt);
    this.cyaw = this.heading + wrap(this.cyaw - this.heading);
    // Braking: the board swings across the travel on the heel edge (it trails: the uphill edge). Skis: a plough
    // turns neither, a skid or a hockey stop swings both into the turn.
    if (ski) {
      this.mode = skiMode(bk, this.speed, this.steer, this.mode);
      if (Math.abs(this.steer) > 0.15) this.side = -Math.sign(this.steer);
      const side = skiSide(this.steer, this.side, wrap(this.heading - fl.yaw));
      this.pivot = damp(this.pivot, skiPivot(this.mode, bk, side), this.mode === "hockey" ? 9 : 6, dt);
      this.plough = damp(this.plough || 0, this.mode === "plough" ? ploughOf(bk) : 0, 6, dt);
      this.hockey = damp(this.hockey || 0, this.mode === "hockey" ? 1 : 0, 8, dt);
    } else this.pivot = damp(this.pivot, heel * pivotFor(bk), 6, dt);
    this.yaw = this.cyaw + this.pivot;
    const slipS = wrap(this.yaw - this.heading), slip = slipAngle(this.yaw, this.heading);
    const side = bk > 0.05 && !(catchable && Math.abs(this.steer) > 0.6) ? heel : -Math.sign(this.steer) || heel;
    const trails = edgeTrails(slipS, side);
    if (!ski && !trails && slip > 45 * DEG && this.speed * Math.sin(slip) > 3 && this.caught <= 0) {
      // Caught the downhill edge: a lurch, most of the speed gone, the board kicked back under you.
      this.caught = 1; this.speed *= 0.55; this.pivot *= 0.3;
    }
    this.caught = Math.max(0, this.caught - dt * 1.5);
    this.brake = trails || ski ? brakeOf(slip) : 0;
    // Gravity along the board's running length (nose or tail, whichever leads), carried into the travel.
    const run = Math.abs(slipS) > Math.PI / 2 ? this.yaw + Math.PI : this.yaw;
    const aG = gravityAlong(dropAlong(n, run)) * Math.cos(slip);
    const mu = 0.045 + scrubOf(slip, grip) + (offPiste ? 0.1 - 0.05 * soft : 0) + 0.035 * soft + rough; // the board floats in powder: less drag than off-piste crud
    let a = aG - mu * 9.8 * n.y - 0.0032 * (1 - 0.4 * tuck) * this.speed * this.speed - this.speed * rate * Math.abs(this.steer) * 0.02 - brakeDecel(this.brake, aG) - (ski ? ploughDecel(this.plough, aG) : 0);
    // Skating or one-foot pushing only works on the flat: it cannot beat gravity up a slope.
    // Only where gravity won't do it (a flat, at a crawl): going downhill you ride, both feet strapped in.
    // Skis skate and pole along quicker than a board pushes with one foot out.
    this.pushing = push && this.speed < (ski ? SKI.PUSH_V : 3.4) && drop > -0.03 && drop < 0.04;
    if (this.pushing) a += ski ? SKI.PUSH_A : 1.2;
    this.speed = Math.max(0, Math.min(30, this.speed + a * dt));
    // Up a short rise you don't slide: you skate up a gentle one (about 8 km/h) and walk a steep one.
    const climb = drop > -0.08 ? 2.2 : 1.2;
    this.walking = push && drop <= -0.03 && this.speed < climb;
    if (this.walking) this.speed = climb;
    const horiz = this.speed / Math.sqrt(1 + drop * drop);
    this.x += Math.sin(this.heading) * horiz * dt;
    this.z += Math.cos(this.heading) * horiz * dt;
    this.x = Math.min(Math.max(this.x, t.x0 + 30), t.x1 - 30);
    this.z = Math.min(Math.max(this.z, t.z0 + 30), t.z1 - 30);
    this.y = t.heightAt(this.x, this.z);
    // Inclination that balances the turn's pull: tan(lean) = speed · turn rate / g; a caught edge rocks it.
    this.lean = damp(this.lean, Math.atan((this.speed * rate) / 9.8) * Math.sign(this.steer), 6 - 3 * soft, dt) + Math.sin(this.t * 31) * 0.25 * this.caught * dt * 30;
    // For the pose (boarder.js swings the board 1.2 rad × skid toward the heel side) and the spray.
    this.slip = slipS; this.edge = edge * (-Math.sign(this.steer) || 0); this.grip = grip;
    this.skid = Math.min(1, (ski || slipS * heel > 0 ? slip : 0.35 * slip) / 1.2);
    this.ski = ski;
    this.tuck = tuck;
    this.braking = this.brake > 0.35;
    this.dt = dt;
    return this;
  }
}

// The board's track in the snow behind the rider: one wide strip. { ski }: two narrow ones, a ski's width
// each, side by side (SKI_TRACK), spreading apart in a plough (the tails pushed out).
export const SKI_TRACK = { gap: 0.12, width: 0.05, plough: 0.14 };
export class Tracks {
  constructor(scene, terrain, { ski = false } = {}) {
    this.terrain = terrain;
    this.max = 600;
    this.points = [];
    this.strips = (ski ? [[-SKI_TRACK.gap, SKI_TRACK.width], [SKI_TRACK.gap, SKI_TRACK.width]] : [[0, 0.16]]).map(([offset, width]) => {
      const pos = new Float32Array(this.max * 2 * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const idx = [];
      for (let i = 0; i < this.max - 1; i++) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      geo.setIndex(idx);
      geo.setDrawRange(0, 0);
      // DoubleSide: the strip's triangles are wound facing down (they were culled, so no track showed at all)
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xb9c0dc, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
      mesh.frustumCulled = false;
      scene.add(mesh);
      return { offset, width, pos, geo, mesh };
    });
  }

  clear() { this.points = []; for (const s of this.strips) s.geo.setDrawRange(0, 0); }

  dispose(scene) { for (const s of this.strips) { scene.remove(s.mesh); s.geo.dispose(); } }

  // r.surf: the snow's surface over the terrain where the board is (moguls, powder), if any.
  add(r) {
    const last = this.points[this.points.length - 1];
    if (last && Math.hypot(last.x - r.x, last.z - r.z) < 0.6) return;
    if (this.points.length === this.max) this.points.shift();
    this.points.push({ x: r.x, z: r.z, h: r.heading, dy: r.surf || 0, spread: 1 + ((r.plough || 0) * SKI_TRACK.plough) / SKI_TRACK.gap });
    const n = this.points.length;
    for (const s of this.strips) {
      for (let i = 0; i < n; i++) {
        const p = this.points[i], cx = Math.cos(p.h), sx = -Math.sin(p.h);
        for (const [k, w] of [[0, -s.width], [1, s.width]]) {
          const o = s.offset * (p.spread || 1) + w, x = p.x + cx * o, z = p.z + sx * o;
          s.pos.set([x, this.terrain.heightAt(x, z) + p.dy + 0.04, z], (i * 2 + k) * 3);
        }
      }
      s.geo.attributes.position.needsUpdate = true;
      s.geo.setDrawRange(0, Math.max(0, n - 1) * 6);
    }
  }
}

// Snow spray kicked up when carving hard or braking; with { size, opacity }, the bigger, softer plumes
// thrown out of powder.
export class Spray {
  constructor(scene, { n = 900, size = 0.2, opacity = 0.9, color = 0xffffff } = {}) {
    this.n = n;
    this.life = new Float32Array(this.n);
    this.vel = new Float32Array(this.n * 3);
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 3).fill(-1e5);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    const dot = document.createElement("canvas");
    dot.width = dot.height = 32;
    // A soft dot drawn as an alpha map (white to black): no dark fringe around each puff on white snow.
    const g = dot.getContext("2d"), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "#fff"); grad.addColorStop(1, "#000");
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, alphaMap: new THREE.CanvasTexture(dot), transparent: true, opacity, depthWrite: false }));
    this.points.frustumCulled = false;
    this.next = 0;
    scene.add(this.points);
  }

  // Snow leaves the edge toward the outside of the turn; in a skid it sprays ahead of the board, the way
  // you are sliding. Then it falls under gravity and air drag. plume 0..1: out of powder, thrown higher and
  // hanging longer.
  emit(r, rate, dt, plume = 0) {
    const count = Math.min(80, Math.floor(rate * dt + Math.random()));
    const skid = r.skid || 0, fx = Math.sin(r.heading), fz = Math.cos(r.heading);
    for (let c = 0; c < count; c++) {
      const i = this.next = (this.next + 1) % this.n;
      const side = Math.sign(r.steer || 1);
      const sx = Math.cos(r.heading) * side, sz = -Math.sin(r.heading) * side;
      // Skis: off the edges of the two skis (either one, a ski's gap to each side), not the board's middle.
      const k = r.ski ? (Math.random() < 0.5 ? -1 : 1) * (0.12 + (r.plough || 0) * 0.14) : 0, ox = Math.cos(r.heading) * k, oz = -Math.sin(r.heading) * k, sp = r.ski ? 0.35 : 0.8;
      const out = (1.5 + Math.random() * 3) * (1 + plume * 0.4), fwd = r.speed * (0.3 + skid * 0.5) * (0.6 + Math.random() * 0.6);
      this.pos.set([r.x + ox + (Math.random() - 0.5) * sp, r.y + 0.08 + plume * 0.2, r.z + oz + (Math.random() - 0.5) * sp], i * 3); // powder: from its surface
      this.vel.set([sx * out * (1 - skid * 0.6) + fx * fwd + (Math.random() - 0.5) * 2, (1 + Math.random() * (2 + skid * 2.5)) * (1 + plume * 1.5), sz * out * (1 - skid * 0.6) + fz * fwd + (Math.random() - 0.5) * 2], i * 3);
      this.life[i] = (0.5 + Math.random() * (0.5 + skid * 0.5)) * (1 + plume * 1.1);
    }
  }

  update(dt) {
    const drag = Math.exp(-dt * 1.6);
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -1e5; continue; }
      this.vel[i * 3] *= drag; this.vel[i * 3 + 2] *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag - 9.8 * dt;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
