// Neon Bay — the game itself: one state object, built from a seed, and one
// fixed step that runs the player, traffic, police and missions in order,
// charges crimes, pays the paint shop, and ends the run when the player is
// busted or wasted. main.js and shots.js both drive the game through here,
// so a screenshot and a played game are the same simulation.
import { PAINT_SHOP, PLAYER_SPAWN, STEP } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './world.js';
import { spawnParked, spawnPeds, spawnTraffic, updateTraffic } from './traffic.js';
import { raiseWanted, updatePolice, updateWanted } from './police.js';
import { updateMission } from './missions.js';
import { updatePlayer } from './player.js';

export const EVENT_THUD = 1;
export const EVENT_BLIP = 2;
export const EVENT_JINGLE = 4;
export const EVENT_CRASH = 8;
export const EVENT_BUSTED = 16;
export const EVENT_FAIL = 32;
export const EVENT_WASTED = 64;

export function createGame(seed, save) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const state = {
    seed, rng, city,
    player: {
      x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, angle: -Math.PI / 2,
      health: 100, car: null, punchTimer: 0, punchAnim: 0, moving: false,
    },
    cars: [], peds: [], policeCars: [], cops: [], particles: [],
    wanted: 0, wantedTimer: 0, timeSinceCrime: 0, policeTimer: 0,
    cash: save?.cash ?? 0, unlocked: save?.unlocked ?? 1,
    mission: null, elapsed: 0, clockMin: 9 * 60,
    camera: { x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y },
    events: 0, pendingCrime: 0, toast: '', toastTimer: 0,
    over: null, saveDirty: false, nearPaint: false, paintDone: false,
  };
  spawnTraffic(state, 16);
  spawnParked(state, 14);
  spawnPeds(state, 26);
  return state;
}

/** Back to the start of a run, keeping the saved cash and unlocked jobs. */
export function resetGame(state) {
  const keep = { cash: state.cash, unlocked: state.unlocked };
  const fresh = createGame(state.seed, keep);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  state.over = null;
}

function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.size += 6 * dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function carHitsPed(state) {
  const car = state.player.car;
  if (!car || Math.abs(car.speed) < 80) return;
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26) {
      ped.down = 3;
      ped.x += Math.cos(car.angle) * 22;
      ped.y += Math.sin(car.angle) * 22;
      state.pendingCrime = (state.pendingCrime || 0) + 1;
      state.events |= EVENT_THUD;
      state.toast = 'You hit a pedestrian — the law is coming';
      state.player.health = Math.max(0, state.player.health - 2);
    }
  }
}

function trafficHitsPlayer(state) {
  const p = state.player;
  if (p.car) return;
  for (const car of state.cars) {
    if (car.parked || Math.abs(car.speed) < 60) continue;
    if (Math.hypot(car.x - p.x, car.y - p.y) < 22) {
      p.health = Math.max(0, p.health - 18);
      p.x += (p.x - car.x) * 0.4;
      p.y += (p.y - car.y) * 0.4;
      state.events |= EVENT_CRASH;
      state.toast = 'Hit by a car!';
      car.speed *= 0.4;
      break;
    }
  }
}

function paintShop(state, input) {
  const p = state.player;
  state.nearPaint = false;
  if (!p.car || state.wanted === 0) return;
  const d = Math.hypot(p.x - PAINT_SHOP.x, p.y - PAINT_SHOP.y);
  if (d > PAINT_SHOP.radius) return;
  state.nearPaint = true;
  if (input.interact && state.cash >= PAINT_SHOP.cost) {
    state.cash -= PAINT_SHOP.cost;
    state.wanted = 0;
    state.policeCars = [];
    state.cops = [];
    state.cars = state.cars.filter((c) => !c.police);
    p.car.color = '#e86a92';
    p.car.damage = Math.max(0, p.car.damage - 30);
    state.paintDone = true;
    state.events |= EVENT_BLIP;
    state.toast = `Spray & Go — $${PAINT_SHOP.cost}. Clean car, clean record.`;
    state.saveDirty = true;
  } else if (input.interact && state.cash < PAINT_SHOP.cost) {
    state.toast = `Spray & Go costs $${PAINT_SHOP.cost} — you are short`;
  }
}

/** One fixed step of the whole game. Returns the event flags for this step. */
export function stepGame(state, input, dt = STEP) {
  state.events = 0;
  state.elapsed += dt;
  state.clockMin = (state.clockMin + dt * 3) % (24 * 60);
  if (state.toastTimer > 0) {
    state.toastTimer -= dt;
    if (state.toastTimer <= 0) state.toast = '';
  } else if (state.toast) {
    state.toastTimer = 3.5;
  }

  updatePlayer(state, input, dt);
  carHitsPed(state);
  trafficHitsPlayer(state);
  updateTraffic(state, dt);
  updateWanted(state, dt);
  updatePolice(state, dt);
  updateMission(state, dt);
  paintShop(state, input);
  updateParticles(state, dt);

  if (state.pendingCrime > 0) {
    raiseWanted(state, state.pendingCrime);
    state.pendingCrime = 0;
  }

  // Slow health recovery when the heat is off.
  if (state.wanted === 0 && state.player.health > 0 && state.player.health < 100) {
    state.player.health = Math.min(100, state.player.health + 1.2 * dt);
  }

  // Camera chases the player, smoothly.
  const cam = state.camera;
  const k = 1 - Math.exp(-5 * dt);
  cam.x += (state.player.x - cam.x) * k;
  cam.y += (state.player.y - cam.y) * k;

  if (state.events & EVENT_BUSTED) state.over = 'busted';
  else if (state.player.health <= 0) { state.over = 'wasted'; state.events |= EVENT_WASTED; }
  return state.events;
}
