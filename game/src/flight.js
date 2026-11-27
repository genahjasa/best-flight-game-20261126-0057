// The flight model of Sky Courier: throttle, pitch, roll, lift, stall, fuel, gear and
// flaps, and the ground — one clear job, no rendering and no mission rules here.
// Angles are radians; speeds are m/s; altitudes are metres above sea level.

import { PLANE } from './config.js';
import { runwayAt, terrainHeight } from './world.js';

export const GEAR_UP = 'up';
export const GEAR_DOWN = 'down';

/** A fresh plane parked on North Field, engine off, ready for the briefing. */
export function createPlane(world) {
  const field = world.airfields[0];
  return {
    x: field.x,
    z: field.z,
    y: terrainHeight(field.x, field.z) + 1.6,
    heading: field.heading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    gear: GEAR_DOWN,
    flaps: false,
    onGround: true,
    verticalSpeed: 0,
    windGust: 0,
    // The plane's own clock: gusts read this, never the wall clock, so a seeded
    // replay always flies the same sky.
    time: 0,
  };
}

/** How fast the engine wants to go at this throttle, flaps and gear. */
export function targetSpeed(plane) {
  let target = PLANE.minSpeed + plane.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
  if (plane.gear === GEAR_DOWN) target -= PLANE.gearDrag;
  if (plane.flaps) target -= PLANE.flapDrag;
  return Math.max(0, target);
}

/** True while the wing is flying: above stall speed, or fast enough with flaps out. */
export function isFlying(plane) {
  const stall = plane.flaps ? PLANE.stallSpeed * 0.82 : PLANE.stallSpeed;
  return plane.speed > stall;
}

/**
 * Step the plane one frame. `stick` is { pitch, roll } in [-1, 1], `throttleDelta`
 * is -1, 0 or +1, `wind` is the mission's crosswind strength. Returns an event
 * string when something notable happened this step, else null.
 */
export function stepFlight(plane, world, stick, throttleDelta, wind, dt) {
  const wasOnGround = plane.onGround;
  plane.time += dt;
  plane.throttle = Math.max(0, Math.min(1, plane.throttle + throttleDelta * dt * 0.6));
  const liftFactor = plane.flaps ? PLANE.flapLift : 1;

  // Gusts: a slow sine wobble that pushes the nose sideways in a storm.
  plane.windGust = wind * Math.sin(plane.time / 1.4) * 0.35;

  // Pitch and roll answer at once, but sluggishly near the stall.
  const authority = isFlying(plane) ? 1 : 0.35;
  plane.pitch += stick.pitch * PLANE.pitchRate * authority * dt;
  plane.pitch = Math.max(-PLANE.maxPitch, Math.min(PLANE.maxPitch, plane.pitch));
  plane.roll += stick.roll * PLANE.rollRate * authority * dt;
  plane.roll = Math.max(-PLANE.maxRoll, Math.min(PLANE.maxRoll, plane.roll));
  // The stick centres itself: let go and the wings level, the nose eases to level.
  if (stick.roll === 0) plane.roll *= Math.max(0, 1 - 1.6 * dt);
  if (stick.pitch === 0) plane.pitch *= Math.max(0, 1 - 0.9 * dt);

  // A banked wing turns the nose: a coordinated turn, tighter when slow. The 1.6
  // factor is the arcade in the flight model — real turn radii would make the
  // rings nearly unhittable at cruise speed.
  const turnRate = (1.6 * 9.81 * Math.tan(plane.roll)) / Math.max(plane.speed, 22);
  plane.heading += turnRate * dt + plane.windGust * dt * 0.12;

  // Speed chases the throttle, fighting drag; the ground holds the plane still.
  const target = targetSpeed(plane);
  if (plane.onGround) {
    plane.speed = Math.max(0, plane.speed + (target - plane.speed) * 0.35 * dt);
  } else {
    plane.speed += (target - plane.speed) * PLANE.drag * dt;
    plane.speed -= Math.sin(plane.pitch) * 9.81 * dt * 0.35;
  }
  plane.speed = Math.max(0, plane.speed);

  // Lift: climb along the pitch when flying, sink when slow or stalled.
  const climb = plane.speed * Math.sin(plane.pitch) * liftFactor;
  const stallSink = isFlying(plane) ? 0 : (PLANE.stallSpeed - plane.speed) * 0.45;
  const prevY = plane.y;
  plane.y += (climb - stallSink) * dt;
  plane.verticalSpeed = (plane.y - prevY) / dt;

  // Move along the heading, over the ground.
  const cp = Math.cos(plane.pitch);
  plane.x += Math.sin(plane.heading) * cp * plane.speed * dt;
  plane.z += Math.cos(plane.heading) * cp * plane.speed * dt;

  // Fuel burns with the throttle; empty tanks mean a glider, not a crash.
  plane.fuel = Math.max(0, plane.fuel - (PLANE.fuelIdle + plane.throttle * PLANE.fuelFull) * dt);

  // The ground: land, bounce, or crash.
  const ground = terrainHeight(plane.x, plane.z);
  const strip = runwayAt(world, plane.x, plane.z);
  const clearance = plane.y - ground;
  if (clearance <= 1.6) {
    plane.y = ground + 1.6;
    if (!wasOnGround) {
      const sink = -plane.verticalSpeed;
      if (strip && sink <= PLANE.softSink && Math.abs(plane.roll) < 0.35 && plane.speed < 55) {
        plane.onGround = true;
        plane.pitch = 0;
        plane.roll = 0;
        plane.speed *= 0.55;
        return sink <= 2.5 ? 'landed-soft' : 'landed';
      }
      if (strip && sink <= PLANE.hardSink) {
        plane.onGround = true;
        plane.damage += 35;
        plane.speed *= 0.4;
        return 'landed-hard';
      }
      plane.damage = 100;
      return 'crashed';
    }
    plane.onGround = true;
    if (plane.speed < PLANE.takeoffSpeed) {
      plane.pitch = 0;
      plane.roll *= 0.9;
    }
    // Rolling down a strip (or a field) scrubs speed; taking off needs the speed.
    plane.speed = Math.max(0, plane.speed - 3 * dt);
    if (plane.speed >= PLANE.takeoffSpeed && plane.pitch > 0.06) {
      plane.onGround = false;
      return 'takeoff';
    }
    return null;
  }
  plane.onGround = false;
  return null;
}

/** Heading as a compass bearing in degrees, 0 = north, 90 = east. */
export function compassDegrees(plane) {
  return ((plane.heading * 180) / Math.PI % 360 + 360) % 360;
}

/** Height above the ground right now, in metres. */
export function heightAboveGround(plane) {
  return Math.max(0, plane.y - terrainHeight(plane.x, plane.z));
}
