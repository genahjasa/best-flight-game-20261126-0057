// Keyboard and mouse input for Sky Courier. One clear job: turn raw DOM events into a
// single per-frame input state the flight model and the menus read, and remember which
// on-screen buttons were clicked, so no other file touches an event listener.

export const KEYS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  throttleUp: ['ShiftLeft', 'ShiftRight', 'KeyE'],
  throttleDown: ['ControlLeft', 'ControlRight', 'KeyQ'],
  flaps: ['KeyF'],
  gear: ['KeyG'],
  pause: ['KeyP', 'Escape'],
  restart: ['KeyR'],
  mute: ['KeyM'],
  confirm: ['Enter', 'Space'],
};

/** Fresh input state: held keys, edge-triggered presses, and the pointer. */
export function createInput() {
  return {
    held: new Set(),
    pressed: new Set(),
    pointer: { x: 0, y: 0, down: false, dragging: false, movedX: 0, movedY: 0 },
    clicked: null,
    wheel: 0,
  };
}

/** Wire the listeners onto `element` (the canvas) and the window. */
export function attachInput(input, element) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.held.add(event.code);
    input.pressed.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    input.held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.held.clear();
  });
  element.addEventListener('pointerdown', (event) => {
    input.pointer.down = true;
    input.pointer.dragging = true;
    input.pointer.x = event.clientX;
    input.pointer.y = event.clientY;
    input.pointer.movedX = 0;
    input.pointer.movedY = 0;
  });
  window.addEventListener('pointermove', (event) => {
    if (input.pointer.dragging) {
      input.pointer.movedX += event.movementX || 0;
      input.pointer.movedY += event.movementY || 0;
    }
    input.pointer.x = event.clientX;
    input.pointer.y = event.clientY;
  });
  window.addEventListener('pointerup', (event) => {
    if (input.pointer.down && !input.pointer.dragging) {
      input.clicked = { x: event.clientX, y: event.clientY };
    } else if (input.pointer.down) {
      input.clicked = { x: event.clientX, y: event.clientY };
    }
    input.pointer.down = false;
    input.pointer.dragging = false;
  });
  element.addEventListener('wheel', (event) => {
    input.wheel += event.deltaY;
    event.preventDefault();
  }, { passive: false });
  element.addEventListener('contextmenu', (event) => event.preventDefault());
}

/** True while any of the named keys is held down this frame. */
export function isHeld(input, action) {
  return KEYS[action].some((code) => input.held.has(code));
}

/** True only on the frame the key went down (edge-triggered). */
export function wasPressed(input, action) {
  return KEYS[action].some((code) => input.pressed.has(code));
}

/** Pitch input in [-1, 1]: nose up is positive. Roll input in [-1, 1]: right is positive. */
export function stickInput(input) {
  const pitch = (isHeld(input, 'up') ? 1 : 0) - (isHeld(input, 'down') ? 1 : 0);
  let roll = (isHeld(input, 'right') ? 1 : 0) - (isHeld(input, 'left') ? 1 : 0);
  // A horizontal mouse drag banks the plane too, for players who steer with the pointer.
  if (input.pointer.dragging) {
    roll += Math.max(-1, Math.min(1, input.pointer.movedX / 60));
  }
  return { pitch, roll: Math.max(-1, Math.min(1, roll)) };
}

/** Throttle input: +1 to spool up, -1 to spool down, 0 to hold. */
export function throttleInput(input) {
  let delta = 0;
  if (isHeld(input, 'throttleUp')) delta += 1;
  if (isHeld(input, 'throttleDown')) delta -= 1;
  if (input.wheel !== 0) {
    delta += input.wheel < 0 ? 1 : -1;
    input.wheel = 0;
  }
  return delta;
}

/** Clear the per-frame edges: call once at the end of every frame. */
export function endFrameInput(input) {
  input.pressed.clear();
  input.clicked = null;
  input.pointer.movedX = 0;
  input.pointer.movedY = 0;
}
