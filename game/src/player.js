// Neon Bay — the player, on foot and behind the wheel. On foot: walk, run,
// punch. In a car: arcade driving — accelerate, brake, steer, handbrake — with
// building and car collisions, damage and smoke. Crimes the player commits
// here are queued on state.pendingCrime for game.js to charge as wanted stars,
// so this file never imports the police.
import { CAR_TYPES, ENTER_RANGE, PUNCH_COOLDOWN, PUNCH_RANGE, RUN_SPEED, WALK_SPEED } from './config.js';
import { collideWorld } from './world.js';

function nearestCar(state, range) {
  const p = state.player;
  let best = null;
  let bestD = range;
  for (const car of state.cars) {
    if (car.police) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(state, car) {
  const p = state.player;
  p.car = car;
  car.parked = false;
  car.driver = true;
  if (!car.stolen) {
    car.stolen = true;
    state.pendingCrime = (state.pendingCrime || 0) + 1;
    state.toast = car.type === 'police' ? 'You stole a patrol car?!' : 'Car stolen — the owner called it in';
  }
  state.events |= 2; // door / pickup blip
}

export function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  p.car = null;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  const fixed = collideWorld(state.city, p.x, p.y, 10);
  p.x = fixed.x;
  p.y = fixed.y;
  p.angle = car.angle;
}

/**
 * Arcade car physics: speed along the car's heading, steering that bites
 * harder the faster the car goes, a handbrake that breaks the back loose.
 * Collisions with buildings and other cars cost speed and add damage.
 */
export function updateCar(state, car, input, dt) {
  const def = CAR_TYPES[car.type];
  const maxSpeed = def.topSpeed;
  if (input.up) car.speed += def.accel * dt;
  if (input.down) car.speed -= (car.speed > 0 ? def.accel * 1.4 : def.accel * 0.6) * dt;
  if (!input.up && !input.down) car.speed -= car.speed * 0.9 * dt;
  if (input.hand) car.speed -= car.speed * 2.4 * dt;
  if (car.speed > maxSpeed) car.speed = maxSpeed;
  if (car.speed < -130) car.speed = -130;
  if (Math.abs(car.speed) < 4 && !input.up && !input.down) car.speed = 0;

  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 220);
  const turnRate = def.grip * (0.35 + 0.65 * speedFactor) * (input.hand ? 1.7 : 1);
  car.angle += steer * turnRate * Math.sign(car.speed || 1) * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = collideWorld(state.city, nx, ny, 19);
  if (fixed.hit && Math.abs(car.speed) > 90) {
    car.damage += Math.abs(car.speed) * 0.02;
    state.events |= 8; // crash sound
    if (car === state.player.car) state.player.health -= Math.abs(car.speed) * 0.012;
  }
  if (fixed.hit) car.speed *= 0.45;
  car.x = fixed.x;
  car.y = fixed.y;

  // Car-to-car bumps: shove apart, trade a little damage.
  for (const other of state.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01 && d < 42) {
      const push = (42 - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      car.x -= ux * push;
      car.y -= uy * push;
      other.x += ux * push;
      other.y += uy * push;
      const impact = Math.abs(car.speed - other.speed);
      if (impact > 120) {
        car.damage += impact * 0.01;
        other.damage += impact * 0.01;
        if (car === state.player.car || other === state.player.car) state.events |= 8;
      }
      car.speed *= 0.92;
    }
  }

  // A wrecked car smokes and dies; the driver has to get out.
  if (car.damage > 55 && state.rng() < dt * 6) {
    state.particles.push({ x: car.x + (state.rng() - 0.5) * 20, y: car.y + (state.rng() - 0.5) * 20, vx: 0, vy: -26, life: 0.9, max: 0.9, size: 9, color: '#555' });
  }
  if (car.damage >= 100) {
    car.speed = 0;
    car.dead = true;
    if (car === state.player.car) state.toast = 'Wrecked — get out and find new wheels';
  }
}

/** One step for the player: walk, run, punch, get in and out of cars. */
export function updatePlayer(state, input, dt) {
  const p = state.player;
  if (p.punchTimer > 0) p.punchTimer -= dt;

  if (p.car) {
    updateCar(state, p.car, input, dt);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    if (input.interact) exitCar(state);
    return;
  }

  const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const moving = mx !== 0 || my !== 0;
  if (moving) {
    const speed = input.run ? RUN_SPEED : WALK_SPEED;
    const len = Math.hypot(mx, my);
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    const fixed = collideWorld(state.city, nx, ny, 10);
    p.x = fixed.x;
    p.y = fixed.y;
    p.angle = Math.atan2(my, mx);
    p.moving = true;
  } else {
    p.moving = false;
  }

  if (input.punch && p.punchTimer <= 0) {
    p.punchTimer = PUNCH_COOLDOWN;
    p.punchAnim = 0.25;
    state.events |= 1; // punch thud
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (d < PUNCH_RANGE) {
        ped.down = 2.5;
        ped.x += Math.cos(p.angle) * 14;
        ped.y += Math.sin(p.angle) * 14;
        state.pendingCrime = (state.pendingCrime || 0) + 1;
        state.toast = 'You decked a pedestrian — someone saw that';
      }
    }
    for (const cop of state.cops) {
      if (Math.hypot(cop.x - p.x, cop.y - p.y) < PUNCH_RANGE) {
        cop.x += Math.cos(p.angle) * 40;
        cop.y += Math.sin(p.angle) * 40;
        state.pendingCrime = (state.pendingCrime || 0) + 1;
      }
    }
  }
  if (p.punchAnim > 0) p.punchAnim -= dt;

  if (input.interact) {
    const car = nearestCar(state, ENTER_RANGE);
    if (car) enterCar(state, car);
  }
}
