// The screenshot scenes behind ?shot=start|play|approach|complete. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a real flight looks like and the same seed always
// gives the same frame. No screenshot is staged by hand: the game really flew there.
//
// The autopilot flies like a careful pilot: it lines up on a ring from an approach
// point 350 m out, slows down for the hoop, and comes down the runway on a shallow
// glideslope with the gear down and the flaps out.

import { AIRFIELDS } from './config.js';
import { heightAboveGround, stepFlight } from './flight.js';
import { currentRing, stepMission } from './missions.js';
import { terrainHeight } from './world.js';

const STEP = 1 / 60;
const LIMIT_SECONDS = 600;

/** Angle from `from` to `to`, wrapped to [-PI, PI]. */
function angleTo(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Steer the plane toward a point in the sky: bank into the heading error, pitch for
 * the altitude, and hold the cruise throttle. Returns { stick, throttleDelta }.
 */
function steerTo(plane, target) {
  const dx = target.x - plane.x;
  const dz = target.z - plane.z;
  const wantedHeading = Math.atan2(dx, dz);
  const headingError = angleTo(plane.heading, wantedHeading);
  // The stick is a rate command, so drive it with a proportional controller on
  // the bank and pitch angles themselves, or the plane rolls to its stops.
  const wantedRoll = Math.max(-0.55, Math.min(0.55, headingError * 1.1));
  const rollStick = Math.max(-1, Math.min(1, (wantedRoll - plane.roll) * 2.5));
  const altError = target.y - plane.y;
  const wantedPitch = Math.max(-0.25, Math.min(0.28, altError * 0.005 + 0.02));
  const pitchStick = Math.max(-1, Math.min(1, (wantedPitch - plane.pitch) * 2.5));
  const throttleDelta = plane.throttle < target.throttle ? 1 : plane.throttle > target.throttle + 0.05 ? -1 : 0;
  return { stick: { pitch: pitchStick, roll: rollStick }, throttleDelta };
}

/** Run the simulation forward until `stop(state, seconds)` is true, or the limit. */
function simulate(state, stop) {
  const { plane, mission } = state;
  for (let step = 0; step < LIMIT_SECONDS / STEP; step += 1) {
    const seconds = step * STEP;
    const target = pickTarget(state);
    const control = steerTo(plane, target);
    if (plane.onGround) {
      control.stick.pitch = plane.speed > 26 ? 0.22 : 0;
      control.throttleDelta = 1;
    }
    if (target.final) {
      plane.gear = 'down';
      plane.flaps = true;
    }
    const event = stepFlight(plane, state.world, control.stick, control.throttleDelta, mission.def.wind, STEP);
    stepMission(mission, plane, event, STEP);
    if (mission.phase === 'done') return seconds;
    if (stop(state, seconds)) return seconds;
  }
  return LIMIT_SECONDS;
}

/** Where the autopilot is flying to right now: a ring, or the runway. */
function pickTarget(state) {
  const { plane, mission } = state;
  const ring = currentRing(mission);
  if (ring) {
    const dist = Math.hypot(plane.x - ring.x, plane.y - ring.y, plane.z - ring.z);
    // Far out, aim at an approach point before the ring so the final run is straight.
    if (dist > 380) {
      const prev = mission.nextRing > 0
        ? mission.rings[mission.nextRing - 1]
        : { x: AIRFIELDS[0].x, y: 120, z: AIRFIELDS[0].z };
      const dx = ring.x - prev.x;
      const dz = ring.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      return {
        x: ring.x - (dx / len) * 350,
        y: ring.y,
        z: ring.z - (dz / len) * 350,
        throttle: 0.6,
        final: false,
      };
    }
    return { x: ring.x, y: ring.y, z: ring.z, throttle: 0.38, final: false };
  }
  const dest = mission.def.id === 'hop' ? AIRFIELDS[1] : nearestField(plane);
  const sh = Math.sin(dest.heading);
  const ch = Math.cos(dest.heading);
  const dist = Math.hypot(plane.x - dest.x, plane.z - dest.z);
  // A shallow glideslope to the threshold, measured from the strip's own
  // elevation: about 3 degrees down, gear and flaps out.
  const stripBase = terrainHeight(dest.x, dest.z);
  const along = (plane.x - dest.x) * sh + (plane.z - dest.z) * ch;
  const height = stripBase + Math.max(3, Math.min(90, Math.abs(along + dest.length / 2) * 0.06));
  return {
    x: dest.x - sh * (dest.length / 2 - 60),
    y: height,
    z: dest.z - ch * (dest.length / 2 - 60),
    throttle: dist < 500 ? 0.3 : 0.45,
    final: true,
  };
}

function nearestField(plane) {
  let best = AIRFIELDS[0];
  let bestDist = Infinity;
  for (const field of AIRFIELDS) {
    const d = Math.hypot(plane.x - field.x, plane.z - field.z);
    if (d < bestDist) {
      bestDist = d;
      best = field;
    }
  }
  return best;
}

/**
 * Pose `state` for a screenshot kind. The state must already hold a fresh world,
 * plane and mission; this mutates the plane and mission by really flying them.
 * Returns the screen the shot should render ('title' | 'fly' | 'done').
 */
export function poseShot(state, kind) {
  const { plane, mission } = state;
  if (kind === 'start') {
    return 'title';
  }
  if (kind === 'play') {
    mission.phase = 'fly';
    simulate(state, (s) => {
      // Freeze with the next ring close and roughly ahead, the wings nearly level
      // and the nose near level, so the ring fills the frame over the islands.
      const ring = currentRing(s.mission);
      if (!ring) return false;
      const dist = Math.hypot(s.plane.x - ring.x, s.plane.y - ring.y, s.plane.z - ring.z);
      if (dist > 500 || dist < 240) return false;
      const wanted = Math.atan2(ring.x - s.plane.x, ring.z - s.plane.z);
      return Math.abs(angleTo(s.plane.heading, wanted)) < 0.2
        && Math.abs(s.plane.roll) < 0.2
        && Math.abs(s.plane.pitch) < 0.15;
    });
    return 'fly';
  }
  if (kind === 'approach') {
    mission.phase = 'fly';
    simulate(state, (s) => {
      const dest = AIRFIELDS[1];
      const dist = Math.hypot(s.plane.x - dest.x, s.plane.z - dest.z);
      return s.mission.nextRing >= s.mission.rings.length && dist < 420 && heightAboveGround(s.plane) < 60 && !s.plane.onGround;
    });
    return 'fly';
  }
  // complete: fly the whole course, then land, and show the debrief.
  mission.phase = 'fly';
  simulate(state, (s) => s.mission.phase === 'done');
  return 'done';
}
