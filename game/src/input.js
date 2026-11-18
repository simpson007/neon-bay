// Neon Bay — keyboard input. Held keys give a movement shape every frame;
// one-shot presses (confirm, pause, mute, restart, interact, punch, mission
// digits) are queued and taken once by the loop, so a press between two
// frames is never lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);
const INTERACT = new Set(['KeyE']);
const PUNCH = new Set(['Space']);
const DIGITS = new Set(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, run: false };
  let actions = 0;
  let interact = false;
  let punch = false;
  let spaceHeld = false;
  let digit = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (RUN.has(event.code)) held.run = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (RESTART.has(event.code)) { if (!event.repeat) actions |= ACTION_RESTART; }
    else if (INTERACT.has(event.code)) { if (!event.repeat) interact = true; }
    else if (PUNCH.has(event.code)) { if (!event.repeat) punch = true; spaceHeld = true; }
    else if (DIGITS.has(event.code)) { if (!event.repeat) digit = Number(event.code.slice(5)); }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (RUN.has(event.code)) held.run = false;
    else if (PUNCH.has(event.code)) spaceHeld = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything.
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.run = false;
    spaceHeld = false;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The held movement keys, plus the one-shot presses since the last read. */
    read() {
      const snapshot = {
        up: held.up, down: held.down, left: held.left, right: held.right,
        run: held.run, hand: spaceHeld, // Space is the handbrake while driving
        interact, punch, digit,
      };
      interact = false;
      punch = false;
      digit = 0;
      return snapshot;
    },
    /** The one-shot screen actions since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
