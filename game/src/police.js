// Neon Bay — the wanted level and the law. Crimes raise stars; stars bring
// patrol cars (and foot cops at higher levels) that chase, ram and, on foot,
// arrest. Stay out of sight and the heat cools off; Spray & Go clears it for
// cash. Busted or wasted ends the run.
import { MAX_WANTED, WANTED_DECAY_SECONDS } from './config.js';
import { chance, pick, randRange } from './random.js';
import { collideWorld, nearestIntersection, randomRoadSpot } from './world.js';
import { followRoute, makeCar, planRoute } from './traffic.js';
import { updateCar } from './player.js';

export function raiseWanted(state, stars) {
  if (state.wanted >= MAX_WANTED) return;
  state.wanted = Math.min(MAX_WANTED, state.wanted + stars);
  state.timeSinceCrime = 0;
  state.wantedTimer = 0;
  if (state.wanted >= 1) state.toast = state.wanted >= 3 ? 'WANTED — the whole city is looking for you' : 'Wanted level up';
}

function nearestPoliceDistance(state) {
  let best = Infinity;
  const p = state.player;
  for (const car of state.policeCars) best = Math.min(best, Math.hypot(car.x - p.x, car.y - p.y));
  for (const cop of state.cops) best = Math.min(best, Math.hypot(cop.x - p.x, cop.y - p.y));
  return best;
}

/** Wanted decays one star at a time when no police can see the player. */
export function updateWanted(state, dt) {
  state.timeSinceCrime += dt;
  if (state.wanted === 0) return;
  if (nearestPoliceDistance(state) > 520 && state.timeSinceCrime > 8) {
    state.wantedTimer += dt;
    if (state.wantedTimer >= WANTED_DECAY_SECONDS) {
      state.wanted -= 1;
      state.wantedTimer = 0;
      state.toast = state.wanted === 0 ? 'You lost them. Clean.' : 'Heat is cooling off';
    }
  } else {
    state.wantedTimer = 0;
  }
}

function spawnPoliceCar(state) {
  const { rng, player } = state;
  const spot = randomRoadSpot(rng);
  // Spawn on a road a good distance from the player, never on top of them.
  if (Math.hypot(spot.x - player.x, spot.y - player.y) < 500) return;
  const car = makeCar(rng, 'police', spot.x, spot.y);
  car.police = true;
  car.route = null;
  car.replan = 0;
  car.speed = car.topSpeed * 0.7;
  state.policeCars.push(car);
  state.cars.push(car);
}

function spawnCop(state) {
  const { rng, player } = state;
  const angle = rng() * Math.PI * 2;
  const x = player.x + Math.cos(angle) * randRange(rng, 260, 420);
  const y = player.y + Math.sin(angle) * randRange(rng, 260, 420);
  state.cops.push({ x, y, speed: 165, arrest: 0, color: '#1c2733' });
}

/** Keep the law in proportion to the wanted level, then move it. */
export function updatePolice(state, dt) {
  const { player, rng } = state;
  const wantCars = Math.min(state.wanted, 4);
  const wantCops = state.wanted >= 3 ? state.wanted - 2 : 0;

  if (state.wanted > 0) {
    state.policeTimer -= dt;
    if (state.policeTimer <= 0) {
      state.policeTimer = 1.2;
      if (state.policeCars.length < wantCars) spawnPoliceCar(state);
      if (state.cops.length < wantCops && !player.car) spawnCop(state);
    }
  }

  // Patrol cars drive the road grid toward the player and ram when close.
  for (const car of state.policeCars) {
    car.replan -= dt;
    if (car.replan <= 0 || !car.route || car.route.length === 0) {
      car.route = planRoute(car.x, car.y, player.x, player.y);
      car.replan = 1.0;
    }
    const input = followRoute(car, car.route, state);
    const before = { x: car.x, y: car.y };
    updateCar(state, car, input, dt);
    // Ramming: a patrol car that touches the player's car at speed damages it.
    if (player.car) {
      const d = Math.hypot(car.x - player.car.x, car.y - player.car.y);
      if (d < 46 && Math.abs(car.speed) > 60) {
        player.car.damage += 6 * dt;
        car.damage += 4 * dt;
        if (chance(rng, dt * 2)) state.events |= 8; // crash sound
        const push = Math.atan2(player.car.y - car.y, player.car.x - car.x);
        player.car.x += Math.cos(push) * 30 * dt;
        player.car.y += Math.sin(push) * 30 * dt;
      }
    }
    if (Math.hypot(car.x - before.x, car.y - before.y) < 0.01 && chance(rng, dt * 0.5)) {
      car.route = planRoute(car.x, car.y, player.x, player.y);
    }
  }

  // Foot cops sprint at the player on foot; hold them off or run.
  for (const cop of state.cops) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const d = Math.hypot(dx, dy) || 1;
    cop.x += (dx / d) * cop.speed * dt;
    cop.y += (dy / d) * cop.speed * dt;
    const fixed = collideWorld(state.city, cop.x, cop.y, 10);
    cop.x = fixed.x;
    cop.y = fixed.y;
    if (player.car) {
      cop.arrest = 0;
      continue;
    }
    if (d < 24) {
      cop.arrest += dt;
      if (cop.arrest > 1.6) state.events |= 16; // busted
    } else {
      cop.arrest = Math.max(0, cop.arrest - dt);
    }
  }

  // The heat dies with the wanted level: stand the police down.
  if (state.wanted === 0) {
    if (state.policeCars.length > 0 || state.cops.length > 0) {
      state.policeCars = [];
      state.cops = [];
      state.cars = state.cars.filter((c) => !c.police);
    }
  }
}

/** A police car the player hit hard counts as a crime of its own. */
export function policeRamCheck(state, car) {
  for (const pc of state.policeCars) {
    if (pc === car) continue;
    if (Math.hypot(pc.x - car.x, pc.y - car.y) < 48 && Math.abs(car.speed) > 200) {
      raiseWanted(state, 1);
      return;
    }
  }
}
