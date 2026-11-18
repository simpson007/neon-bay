// Neon Bay — traffic and pedestrians. Cars drive the road grid on the right-hand
// lane and pick a new direction at each intersection; pedestrians stroll the
// sidewalks and scatter when a fast car comes at them. The road router here
// (planRoute / followRoute) is also what police cars and the screenshot
// autopilot steer by, so all of them drive like the city taught them.
import { CAR_TYPES, ROAD_W, ROAD_XS, ROAD_YS, WORLD_H, WORLD_W } from './config.js';
import { chance, pick, randInt, randRange } from './random.js';
import { collideWorld, nearestIntersection, nearestRoadX, nearestRoadY, onRoad, randomRoadSpot } from './world.js';

// Directions: 0 east, 1 south, 2 west, 3 north. A car on a vertical road heads
// north or south; on a horizontal road, east or west.
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const LANE = 15; // right-hand lane offset from the road centre line

function lanePoint(car) {
  if (car.dir === 0) return { x: car.x, y: car.roadY + LANE };
  if (car.dir === 2) return { x: car.x, y: car.roadY - LANE };
  if (car.dir === 1) return { x: car.roadX + LANE, y: car.y };
  return { x: car.roadX - LANE, y: car.y };
}

function atIntersection(car) {
  const ix = nearestIntersection(car.x, car.y);
  return Math.abs(car.x - ix.x) < 10 && Math.abs(car.y - ix.y) < 10;
}

function chooseTurn(rng, car, target) {
  // Options: straight on, left, right — never a U-turn. With a target, favour
  // the turn that closes the distance; without one, pick at random.
  const options = [car.dir, (car.dir + 1) % 4, (car.dir + 3) % 4];
  if (!target) return pick(rng, options);
  let best = options[0];
  let bestScore = -Infinity;
  for (const dir of options) {
    const nx = car.x + DX[dir] * 300;
    const ny = car.y + DY[dir] * 300;
    const score = -(Math.abs(nx - target.x) + Math.abs(ny - target.y)) + rng() * 120;
    if (score > bestScore) { bestScore = score; best = dir; }
  }
  return best;
}

/** Step one road-following car: cruise its lane, turn at intersections. */
export function stepRoadCar(car, dt, rng, target) {
  const point = lanePoint(car);
  car.x = point.x;
  car.y = point.y;
  car.speed = Math.min(car.topSpeed, car.speed + car.accel * 0.4 * dt);
  car.x += DX[car.dir] * car.speed * dt;
  car.y += DY[car.dir] * car.speed * dt;
  const wantAngle = Math.atan2(DY[car.dir], DX[car.dir]);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += diff * Math.min(1, dt * 6);
  if (atIntersection(car)) {
    const dir = chooseTurn(rng, car, target);
    car.dir = dir;
    const ix = nearestIntersection(car.x, car.y);
    if (dir === 0 || dir === 2) car.roadY = ix.y;
    else car.roadX = ix.x;
  }
  if (car.x < 120 || car.x > WORLD_W - 60 || car.y < 120 || car.y > WORLD_H - 60) {
    // Drove off the grid's edge: turn around at the next intersection.
    car.dir = (car.dir + 2) % 4;
  }
}

/**
 * A greedy Manhattan route over the road grid, as a list of waypoints from the
 * nearest intersection to the target's nearest intersection, then the target.
 */
export function planRoute(fromX, fromY, toX, toY) {
  const start = nearestIntersection(fromX, fromY);
  const end = nearestIntersection(toX, toY);
  const points = [{ x: start.x, y: start.y }];
  let cx = start.x;
  let cy = start.y;
  let guard = 0;
  while ((cx !== end.x || cy !== end.y) && guard < 40) {
    guard += 1;
    const dx = end.x - cx;
    const dy = end.y - cy;
    if (dx !== 0 && (dy === 0 || Math.abs(dx) >= Math.abs(dy))) cx += Math.sign(dx) * 300;
    else if (dy !== 0) cy += Math.sign(dy) * 300;
    points.push({ x: cx, y: cy });
  }
  points.push({ x: toX, y: toY });
  return points;
}

/**
 * Steer a free-driving car (player physics) along a route: returns the same
 * input shape the keyboard produces, so the autopilot and the player share
 * the driving model.
 */
export function followRoute(car, route, state) {
  if (!route || route.length === 0) return { up: false, down: false, left: false, right: false, hand: false };
  while (route.length > 1) {
    const wp = route[0];
    const dx = wp.x - car.x;
    const dy = wp.y - car.y;
    const dist = Math.hypot(dx, dy);
    // Move on when the waypoint is reached, or when it has slipped behind
    // the car (a near waypoint can otherwise be orbited forever).
    const ahead = (dx * Math.cos(car.angle) + dy * Math.sin(car.angle)) / (dist || 1);
    if (dist < 40 || (ahead < 0 && dist < 150)) route.shift();
    else break;
  }
  const wp = route[0];
  // Steer around a slow car stopped in the way: aim one lane over (30 px,
  // still on the asphalt — the blocks start 54 px from the centre line).
  // A car close ahead that is moving is followed, not rammed: ease off.
  let wx = wp.x;
  let wy = wp.y;
  let blocked = false;
  if (state) {
    for (const other of state.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 95 && d > 1) {
        const ahead = (dx * Math.cos(car.angle) + dy * Math.sin(car.angle)) / d;
        if (ahead > 0.6) {
          if (Math.abs(other.speed) < 60) {
            // Swerve one lane over, but only if that stays on asphalt.
            const ox = other.x - Math.sin(car.angle) * 30;
            const oy = other.y + Math.cos(car.angle) * 30;
            if (onRoad(ox, oy)) { wx = ox; wy = oy; }
          } else if (d < 60) {
            blocked = true;
          }
          break;
        }
      }
    }
  }
  // If the car has left the asphalt (a bad swerve, a shove), aim at the
  // nearest road first — the waypoint can wait.
  if (!onRoad(car.x, car.y)) {
    const rx = nearestRoadX(car.x);
    const ry = nearestRoadY(car.y);
    if (Math.abs(car.x - rx) < Math.abs(car.y - ry)) { wx = rx; wy = car.y; }
    else { wx = car.x; wy = ry; }
  }
  const want = Math.atan2(wy - car.y, wx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const speed = Math.abs(car.speed);
  // Accelerate only when reasonably lined up: flooring it mid-turn is what
  // drives a car off the road into the blocks. A stopped car turns in place
  // (the steering bites even at speed zero), then drives forward.
  return {
    up: Math.abs(diff) < 0.55 && !blocked,
    down: false, // never reverse: turn in place, then drive forward
    left: diff < -0.08,
    right: diff > 0.08,
    hand: Math.abs(diff) > 1.4 && speed > 120,
  };
}

export function makeCar(rng, type, x, y) {
  const def = CAR_TYPES[type];
  return {
    type,
    x, y,
    angle: pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
    dir: randInt(rng, 0, 3),
    roadX: nearestIntersection(x, y).x,
    roadY: nearestIntersection(x, y).y,
    speed: 0,
    topSpeed: def.topSpeed * randRange(rng, 0.75, 0.95),
    accel: def.accel,
    color: pick(rng, def.colors),
    damage: 0,
    parked: false,
    driver: true,
    smoke: 0,
  };
}

export function spawnTraffic(state, count) {
  const { rng } = state;
  for (let i = 0; i < count; i += 1) {
    const spot = randomRoadSpot(rng);
    const car = makeCar(rng, pick(rng, ['sedan', 'sedan', 'taxi', 'truck', 'sports']), spot.x, spot.y);
    car.dir = chance(rng, 0.5) ? 0 : 1;
    // Snap onto a real road line for the direction it drives.
    if (car.dir === 0) { car.roadY = nearestRoadY(spot.y); car.y = car.roadY; }
    else { car.roadX = nearestRoadX(spot.x); car.x = car.roadX; }
    car.speed = car.topSpeed * randRange(rng, 0.5, 0.8);
    state.cars.push(car);
  }
}

export function spawnParked(state, count) {
  const { rng, city } = state;
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < 300) {
    guard += 1;
    const spot = randomRoadSpot(rng);
    const vertical = chance(rng, 0.5);
    const x = vertical ? spot.x + 40 : spot.x;
    const y = vertical ? spot.y : spot.y + 40;
    if (x < 200 || x > WORLD_W - 100 || y < 200 || y > WORLD_H - 100) continue;
    if (state.cars.some((c) => Math.hypot(c.x - x, c.y - y) < 90)) continue;
    const car = makeCar(rng, pick(rng, ['sedan', 'sedan', 'taxi', 'truck', 'sports']), x, y);
    car.angle = vertical ? Math.PI / 2 : 0;
    car.parked = true;
    car.driver = false;
    car.speed = 0;
    state.cars.push(car);
    placed += 1;
  }
}

function makePed(rng) {
  const spot = randomRoadSpot(rng);
  const vertical = chance(rng, 0.5);
  return {
    x: vertical ? spot.x + randRange(rng, -44, 44) : spot.x,
    y: vertical ? spot.y : spot.y + randRange(rng, -44, 44),
    dir: randInt(rng, 0, 3),
    speed: randRange(rng, 28, 55),
    color: pick(rng, ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1']),
    down: 0,
    flee: 0,
    roadX: nearestIntersection(spot.x, spot.y).x,
    roadY: nearestIntersection(spot.x, spot.y).y,
  };
}

export function spawnPeds(state, count) {
  for (let i = 0; i < count; i += 1) state.peds.push(makePed(state.rng));
}

/** One step for every traffic car and pedestrian. */
export function updateTraffic(state, dt) {
  const { rng, city } = state;
  for (const car of state.cars) {
    if (car.parked || car === state.player.car || car.police) continue;
    // Keep a little distance from the car ahead on the same lane.
    let ahead = null;
    for (const other of state.cars) {
      if (other === car || other.parked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      if (Math.hypot(dx, dy) < 70 && dx * DX[car.dir] + dy * DY[car.dir] > 0) { ahead = other; break; }
    }
    if (ahead) car.speed = Math.max(0, Math.min(car.speed, ahead.speed * 0.9));
    stepRoadCar(car, dt, rng, null);
    const fixed = collideWorld(city, car.x, car.y, 20);
    car.x = fixed.x;
    car.y = fixed.y;
  }
  for (const ped of state.peds) {
    if (ped.down > 0) { ped.down -= dt; continue; }
    // Scatter from a fast car bearing down.
    let threat = null;
    for (const car of state.cars) {
      if (car.parked || Math.abs(car.speed) < 120) continue;
      if (Math.hypot(car.x - ped.x, car.y - ped.y) < 90) { threat = car; break; }
    }
    if (threat) {
      ped.flee = 1.2;
      const away = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      ped.x += Math.cos(away) * 130 * dt;
      ped.y += Math.sin(away) * 130 * dt;
    } else {
      if (ped.flee > 0) ped.flee -= dt;
      ped.x += DX[ped.dir] * ped.speed * dt;
      ped.y += DY[ped.dir] * ped.speed * dt;
      const ix = nearestIntersection(ped.x, ped.y);
      if (Math.abs(ped.x - ix.x) < 12 && Math.abs(ped.y - ix.y) < 12 && chance(rng, dt * 1.5)) {
        ped.dir = pick(rng, [0, 1, 2, 3]);
        if (ped.dir === 0 || ped.dir === 2) ped.roadY = ix.y;
        else ped.roadX = ix.x;
      }
      if (ped.x < 140 || ped.x > WORLD_W - 60 || ped.y < 120 || ped.y > WORLD_H - 60) ped.dir = (ped.dir + 2) % 4;
    }
    const fixed = collideWorld(city, ped.x, ped.y, 8);
    ped.x = fixed.x;
    ped.y = fixed.y;
    if (!onRoad(ped.x, ped.y) && chance(rng, dt * 0.2)) {
      // Drifted off the sidewalk: walk back to the nearest road.
      const ix = nearestIntersection(ped.x, ped.y);
      ped.x += (ix.x - ped.x) * dt * 2;
      ped.y += (ix.y - ped.y) * dt * 2;
    }
  }
}
