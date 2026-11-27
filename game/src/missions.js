// Missions for Sky Courier: which ring is next, what counts as a pass, when a sortie
// is won or lost, and what it is worth. One clear job: the rules of each flight, so
// the flight model never decides a score and the renderer never decides a win.

import { AIRFIELDS, MISSIONS, RING, SCORING } from './config.js';
import { buildRingCourse } from './world.js';

export const PHASE_BRIEF = 'brief';
export const PHASE_FLY = 'fly';
export const PHASE_DONE = 'done';

/** Start a mission: its rings, its clock, and a clean score sheet. */
export function createMission(index, seed) {
  const def = MISSIONS[index % MISSIONS.length];
  return {
    index: index % MISSIONS.length,
    def,
    rings: buildRingCourse(seed, def.rings),
    nextRing: 0,
    score: 0,
    ringsPassed: 0,
    nearMisses: 0,
    timeLeft: def.timeLimit,
    elapsed: 0,
    phase: PHASE_BRIEF,
    outcome: null,
    outcomeText: '',
    delivered: false,
    messages: [],
    fuelWarned: false,
  };
}

/** Push a short message onto the mission's feed (newest first, capped). */
export function say(mission, text) {
  mission.messages.unshift(text);
  if (mission.messages.length > 4) mission.messages.length = 4;
}

/** The ring the pilot is flying for now, or null when the course is done. */
export function currentRing(mission) {
  return mission.nextRing < mission.rings.length ? mission.rings[mission.nextRing] : null;
}

/**
 * Step the mission one frame while flying. `event` is the flight model's report
 * (takeoff, landed, crashed...). Returns nothing; the mission's fields move.
 */
export function stepMission(mission, plane, event, dt) {
  if (mission.phase !== PHASE_FLY) return;
  mission.elapsed += dt;
  if (mission.def.timeLimit > 0) {
    mission.timeLeft = Math.max(0, mission.def.timeLimit - mission.elapsed);
    if (mission.timeLeft <= 0) {
      endMission(mission, 'time', 'Out of time — the mail goes back to the depot.');
      return;
    }
  }
  // Empty tanks do not end the sortie on their own: she glides, and the pilot
  // still has a landing (or a crash) in them. The sortie ends on the ground.
  if (plane.fuel <= 0 && !mission.fuelWarned) {
    mission.fuelWarned = true;
    say(mission, 'Tanks dry — she glides now. Pick a field.');
  }

  const ring = currentRing(mission);
  if (ring) {
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.y;
    const dz = plane.z - ring.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < ring.radius) {
      ring.passed = true;
      mission.nextRing += 1;
      mission.ringsPassed += 1;
      mission.score += RING.passScore;
      say(mission, `Ring ${mission.ringsPassed} of ${mission.rings.length} — +${RING.passScore}`);
      if (mission.nextRing >= mission.rings.length) {
        onCourseComplete(mission, plane);
      }
    } else if (!ring.nearCounted) {
      // A near miss counts only when the pilot flies by and leaves the ring
      // behind: threading the hoop itself is the full 100, not 100 plus 25.
      if (dist < ring.radius * 2.2) ring.close = true;
      else if (ring.close && dist > ring.radius * 2.2 + 30) {
        ring.close = false;
        ring.nearCounted = true;
        mission.nearMisses += 1;
        mission.score += RING.nearScore;
        say(mission, `Near miss on the ring — +${RING.nearScore}`);
      }
    }
  }

  if (event === 'takeoff') say(mission, 'Airborne — gear up when you are ready.');
  if (event === 'landed' || event === 'landed-soft') {
    const bonus = event === 'landed-soft' ? SCORING.smoothLanding : SCORING.roughLanding;
    mission.score += bonus;
    say(mission, `Down safe — +${bonus} for the landing.`);
    if (mission.def.id === 'hop' && mission.nextRing >= mission.rings.length) {
      const dest = AIRFIELDS[1];
      const dx = plane.x - dest.x;
      const dz = plane.z - dest.z;
      if (Math.sqrt(dx * dx + dz * dz) < 900) {
        mission.delivered = true;
        mission.score += SCORING.delivery;
        endMission(mission, 'delivered', `Mail delivered to ${dest.name} — +${SCORING.delivery}.`);
      } else {
        say(mission, 'Wrong field — the mail goes to South Strip.');
      }
    } else if (mission.def.id !== 'hop' && mission.nextRing >= mission.rings.length) {
      endMission(mission, 'landed', 'Course complete — down safe on the grass.');
    }
  }
  if (event === 'landed-hard') {
    mission.score += SCORING.roughLanding;
    say(mission, 'Hard landing — the undercarriage will remember that.');
  }
  if (event === 'crashed') {
    endMission(mission, 'crashed', 'She went down. The courier walks home this time.');
  }
  if (plane.damage >= 100 && mission.phase === PHASE_FLY) {
    endMission(mission, 'crashed', 'Too much damage — the sortie is over.');
  }
}

/** The course is flown: what the mission still asks of the pilot. */
function onCourseComplete(mission, plane) {
  if (mission.def.id === 'hop') {
    say(mission, `Rings done — now land on ${AIRFIELDS[1].name}.`);
    return;
  }
  if (mission.def.timeLimit > 0) {
    const bonus = Math.round(mission.timeLeft) * SCORING.timeBonusPerSecond;
    mission.score += bonus;
    say(mission, `Course complete — time bonus +${bonus}.`);
  }
  endMission(mission, 'complete', 'Course complete — a clean run, courier.');
}

/** Close the mission with an outcome and its line for the debrief. */
export function endMission(mission, outcome, text) {
  mission.phase = PHASE_DONE;
  mission.outcome = outcome;
  mission.outcomeText = text;
  say(mission, text);
}

/** One-line objective for the HUD: what the pilot should do next. */
export function objectiveLine(mission) {
  if (mission.phase === PHASE_DONE) return mission.outcomeText;
  const ring = currentRing(mission);
  if (ring) {
    if (mission.def.id === 'hop' && mission.nextRing >= mission.rings.length) {
      return `Land on ${AIRFIELDS[1].name} to deliver the mail.`;
    }
    return `Fly through ring ${mission.nextRing + 1} of ${mission.rings.length}.`;
  }
  return 'Bring her down on the strip.';
}
