// Neon Bay — the screenshot scenes behind ?shot=start|drive|chase|mission.
// Each one plays the real rules forward from a fresh seeded world, steered by
// a simple autopilot that drives the road grid toward a target, so the frame
// is what real play looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { createGame, stepGame } from './game.js';
import { startMission } from './missions.js';
import { enterCar } from './player.js';
import { followRoute, planRoute } from './traffic.js';
import { raiseWanted } from './police.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

/** Put the player in the nearest parked car, the way the E key would. */
function getInCar(state) {
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.parked) {
      const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
      if (d < bestD) { bestD = d; best = car; }
    }
  }
  if (best) {
    state.player.x = best.x - 30;
    state.player.y = best.y;
    enterCar(state, best);
  }
  return best;
}

/** Drive the player's car through a list of targets for `seconds`, moving on
 * to the next target whenever one is reached, so the car never just sits. */
function driveFor(state, targets, seconds) {
  const car = state.player.car;
  if (!car) return;
  let ti = 0;
  let route = planRoute(car.x, car.y, targets[ti].x, targets[ti].y);
  let replan = 0;
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    replan -= SAMPLE;
    if (route.length === 0) {
      ti = (ti + 1) % targets.length;
      route = planRoute(car.x, car.y, targets[ti].x, targets[ti].y);
    }
    if (replan <= 0) {
      route = planRoute(car.x, car.y, targets[ti].x, targets[ti].y);
      replan = 2;
    }
    const input = followRoute(car, route, state);
    stepGame(state, input, SAMPLE);
    if (state.over) break;
  }
}

/**
 * Set `state` to the named scene and return the screen to draw over it.
 * start: the title over a living city. drive: Rook in a stolen car on the
 * road. chase: a 3-star pursuit with patrol cars closing in. mission: the
 * Courier Run in progress, marker and objective on the HUD.
 */
export function stageShot(name, state) {
  if (name === 'start') {
    for (let i = 0; i < 5 / SAMPLE; i += 1) stepGame(state, {}, SAMPLE);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'drive') {
    getInCar(state);
    // Four seconds: mid-straight at full speed, not mid-turn.
    driveFor(state, [{ x: 2970, y: 570 }, { x: 570, y: 2070 }, { x: 3270, y: 2370 }], 4);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    getInCar(state);
    raiseWanted(state, 3);
    // Five seconds: flat out west with four patrol cars closing in.
    driveFor(state, [{ x: 570, y: 2070 }, { x: 3270, y: 570 }, { x: 2970, y: 2370 }], 5);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    getInCar(state);
    startMission(state, 2);
    // Four seconds: still en route, banner and marker live, timer counting down.
    driveFor(state, [{ x: 3180, y: 2100 }], 4);
    return { screen: SCREEN_PLAY };
  }
  for (let i = 0; i < 5 / SAMPLE; i += 1) stepGame(state, {}, SAMPLE);
  return { screen: SCREEN_TITLE };
}
