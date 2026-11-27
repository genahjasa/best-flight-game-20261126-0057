// Sky Courier — Island Run: the entry point. One clear job: own the game state, run
// the loop (input → flight → mission → sound → picture), and switch screens when the
// pilot clicks a button or presses a key. The rules live in missions.js, the flying
// in flight.js, the picture in render.js; this file only wires them together.

import { MISSIONS, VIEW, WORLD } from './config.js';
import { chimeAudio, crashAudio, createAudio, thudAudio, toggleMute, unlockAudio, updateAudio } from './audio.js';
import { GEAR_DOWN, GEAR_UP, createPlane, stepFlight } from './flight.js';
import { attachInput, createInput, endFrameInput, isHeld, stickInput, throttleInput, wasPressed } from './input.js';
import { createMission, endMission, say, stepMission } from './missions.js';
import { renderGame } from './render.js';
import { createWorld } from './world.js';
import { poseShot } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const params = new URLSearchParams(window.location.search);
const shotKind = params.get('shot');
const seed = Number(params.get('seed') || WORLD.seed) || WORLD.seed;

const input = createInput();
attachInput(input, canvas);
const audio = createAudio();

const state = {
  world: createWorld(seed),
  plane: null,
  mission: null,
  missionIndex: 0,
  missionDefs: MISSIONS,
  screen: 'title',
  buttons: [],
  bestScore: 0,
};

state.plane = createPlane(state.world);
state.mission = createMission(state.missionIndex, seed);

let lastTime = performance.now();

/** Start a mission from the title or the debrief: fresh plane, fresh mission. */
function startMission(index) {
  state.missionIndex = index;
  state.world = createWorld(seed);
  state.plane = createPlane(state.world);
  state.mission = createMission(index, seed);
  state.screen = 'brief';
  say(state.mission, `${state.mission.def.name} — read the brief, then take off.`);
  announce(`${state.mission.def.name}. ${state.mission.def.blurb}`);
}

function announce(text) {
  if (statusLine) statusLine.textContent = text;
}

/** Map a client-space click onto canvas space and find the button under it. */
function buttonAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * VIEW.width;
  const y = ((clientY - rect.top) / rect.height) * VIEW.height;
  return state.buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
}

function handleButton(button) {
  if (!button) return;
  unlockAudio(audio);
  if (button.id.startsWith('mission-')) {
    const id = button.id.slice('mission-'.length);
    const index = MISSIONS.findIndex((m) => m.id === id);
    if (index >= 0) {
      state.missionIndex = index;
      state.mission = createMission(index, seed);
      state.plane = createPlane(state.world);
    }
    return;
  }
  if (button.id === 'fly') {
    startMission(state.missionIndex);
    return;
  }
  if (button.id === 'takeoff') {
    state.mission.phase = 'fly';
    state.screen = 'fly';
    say(state.mission, 'Cleared for takeoff — full throttle, ease the nose up.');
    announce('Flying. ' + state.mission.def.blurb);
    return;
  }
  if (button.id === 'resume') {
    state.screen = 'fly';
    return;
  }
  if (button.id === 'again') {
    startMission(state.missionIndex);
    return;
  }
  if (button.id === 'change') {
    state.plane = createPlane(state.world);
    state.mission = createMission(state.missionIndex, seed);
    state.screen = 'title';
    return;
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
  lastTime = now;
  const { plane, mission } = state;

  if (input.clicked) {
    handleButton(buttonAt(input.clicked.x, input.clicked.y));
  }
  if (wasPressed(input, 'mute')) {
    const muted = toggleMute(audio);
    say(mission, muted ? 'Sound off.' : 'Sound on.');
  }

  if (state.screen === 'title') {
    if (wasPressed(input, 'confirm')) startMission(state.missionIndex);
  } else if (state.screen === 'brief') {
    if (wasPressed(input, 'confirm')) {
      mission.phase = 'fly';
      state.screen = 'fly';
      say(mission, 'Cleared for takeoff — full throttle, ease the nose up.');
    }
  } else if (state.screen === 'fly') {
    if (wasPressed(input, 'pause')) {
      state.screen = 'paused';
    } else {
      if (wasPressed(input, 'flaps')) {
        plane.flaps = !plane.flaps;
        say(mission, plane.flaps ? 'Flaps out — slower, more lift.' : 'Flaps in.');
      }
      if (wasPressed(input, 'gear')) {
        plane.gear = plane.gear === GEAR_DOWN ? GEAR_UP : GEAR_DOWN;
        say(mission, plane.gear === GEAR_DOWN ? 'Gear down.' : 'Gear up.');
      }
      if (wasPressed(input, 'restart')) {
        startMission(state.missionIndex);
      }
      const ringsBefore = mission.ringsPassed;
      const event = stepFlight(plane, state.world, stickInput(input), throttleInput(input), mission.def.wind, dt);
      stepMission(mission, plane, event, dt);
      if (mission.ringsPassed > ringsBefore) chimeAudio(audio);
      if (event === 'landed' || event === 'landed-soft') thudAudio(audio, false);
      if (event === 'landed-hard') thudAudio(audio, true);
      if (event === 'crashed') crashAudio(audio);
      updateAudio(audio, plane);
      if (mission.phase === 'done') {
        state.screen = 'done';
        state.bestScore = Math.max(state.bestScore, mission.score);
        announce(`Sortie over. ${mission.outcomeText} Score ${mission.score}.`);
      }
    }
  } else if (state.screen === 'paused') {
    if (wasPressed(input, 'pause') || wasPressed(input, 'confirm')) state.screen = 'fly';
  } else if (state.screen === 'done') {
    if (wasPressed(input, 'restart')) startMission(state.missionIndex);
  }

  // Keep the engine quiet on the menus, humming in the air.
  if (state.screen !== 'fly') updateAudio(audio, { ...plane, throttle: 0, speed: 0, onGround: true });

  state.buttons = renderGame(ctx, state, VIEW.width, VIEW.height);
  endFrameInput(input);
  requestAnimationFrame(frame);
}

// Screenshot mode: pose the game with the autopilot, draw one frame, and stop.
// The page is a real render of the game's own code, at ?shot=start|play|approach|complete.
if (shotKind) {
  const kind = ['start', 'play', 'approach', 'complete'].includes(shotKind) ? shotKind : 'play';
  const missionIndex = kind === 'approach' ? 1 : 0;
  state.missionIndex = missionIndex;
  state.world = createWorld(seed);
  state.plane = createPlane(state.world);
  state.mission = createMission(missionIndex, seed);
  state.screen = poseShot(state, kind);
  state.buttons = renderGame(ctx, state, VIEW.width, VIEW.height);
  document.title = `Sky Courier — shot ${kind}`;
  announce(`Screenshot pose: ${kind}.`);
} else {
  requestAnimationFrame(frame);
}
