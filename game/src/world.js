// Neon Bay — the city itself: a seeded grid of streets, sidewalks, buildings,
// parks, the beach and the docks, plus the collision and road questions every
// moving thing asks (am I on a road? am I inside a building? push me out).
// Nothing here draws or steps the game; it is the map the rest of the game reads.
import { BEACH_X, DISTRICTS, PAINT_SHOP, ROAD_W, ROAD_XS, ROAD_YS, WATER_X, WORLD_H, WORLD_W } from './config.js';
import { chance, pick, randInt, randRange } from './random.js';

const ROOF_COLORS = ['#c96f4a', '#7d8aa0', '#d9b380', '#a5554a', '#5f8f7b', '#8a7f8d', '#b08d57', '#6b7f9e', '#9c6b4f', '#7a9e7e'];
const ROOF_TRIMS = ['#8a4f34', '#5d6a7d', '#a5824f', '#7c3f36', '#466b5b', '#665e68', '#84683e', '#4f5f76', '#744e3a', '#58755e'];

export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const containers = [];

  // One block per gap between roads. The bottom strip is the Docks (warehouses
  // and containers); a few blocks are parks; the rest hold one to four buildings.
  for (let i = 0; i < ROAD_XS.length - 1; i += 1) {
    for (let j = 0; j < ROAD_YS.length - 1; j += 1) {
      const x0 = ROAD_XS[i] + ROAD_W / 2 + 26;
      const x1 = ROAD_XS[i + 1] - ROAD_W / 2 - 26;
      const y0 = ROAD_YS[j] + ROAD_W / 2 + 26;
      const y1 = ROAD_YS[j + 1] - ROAD_W / 2 - 26;
      const w = x1 - x0;
      const h = y1 - y0;
      if (j === ROAD_YS.length - 1 && i < 3) {
        buildings.push({ x: x0, y: y0, w, h: h * 0.42, color: '#8d949c', trim: '#6e757d', kind: 'warehouse' });
        buildings.push({ x: x0, y: y0 + h * 0.55, w: w * 0.6, h: h * 0.4, color: '#7a828a', trim: '#5d646c', kind: 'warehouse' });
        for (let c = 0; c < 4; c += 1) {
          containers.push({ x: x0 + 8 + c * 52, y: y1 - 26, w: 44, h: 18, color: pick(rng, ['#c0392b', '#2e6da4', '#e67e22', '#16a085']) });
        }
        continue;
      }
      if (chance(rng, 0.13)) {
        parks.push({ x: x0, y: y0, w, h });
        const count = randInt(rng, 5, 9);
        for (let t = 0; t < count; t += 1) trees.push({ x: randRange(rng, x0 + 14, x1 - 14), y: randRange(rng, y0 + 14, y1 - 14), r: randRange(rng, 9, 15) });
        continue;
      }
      const cols = chance(rng, 0.55) ? 2 : 1;
      const rows = chance(rng, 0.45) ? 2 : 1;
      const cw = w / cols;
      const ch = h / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (chance(rng, 0.12)) continue; // an empty lot, for variety
          const bw = cw * randRange(rng, 0.62, 0.85);
          const bh = ch * randRange(rng, 0.62, 0.85);
          const bx = x0 + c * cw + (cw - bw) / 2;
          const by = y0 + r * ch + (ch - bh) / 2;
          const color = pick(rng, ROOF_COLORS);
          buildings.push({ x: bx, y: by, w: bw, h: bh, color, trim: ROOF_TRIMS[ROOF_COLORS.indexOf(color)], kind: 'roof' });
        }
      }
    }
  }

  // Spray & Go, the paint shop: a pink building just south of the Downtown road.
  buildings.push({ x: 1900, y: 1235, w: 150, h: 130, color: '#e86a92', trim: '#c94f78', kind: 'paint' });
  // The marina's boats sit on the water, west of the beach.
  const boats = [];
  for (let b = 0; b < 6; b += 1) boats.push({ x: randRange(rng, 18, 58), y: 1860 + b * 78 + randRange(rng, -14, 14), angle: randRange(rng, -0.3, 0.3) });

  return { buildings, trees, parks, containers, boats, districts: DISTRICTS, paintShop: PAINT_SHOP };
}

/** True when the point is on asphalt (within half a road width of a road line). */
export function onRoad(x, y) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

export function nearestRoadX(x) {
  let best = ROAD_XS[0];
  for (const rx of ROAD_XS) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}

export function nearestRoadY(y) {
  let best = ROAD_YS[0];
  for (const ry of ROAD_YS) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

/** The intersection nearest the point. */
export function nearestIntersection(x, y) {
  return { x: nearestRoadX(x), y: nearestRoadY(y) };
}

function collideRect(px, py, r, rect) {
  const cx = Math.max(rect.x, Math.min(px, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(py, rect.y + rect.h));
  const dx = px - cx;
  const dy = py - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: px + (dx / d) * (r - d), y: py + (dy / d) * (r - d), hit: true };
  }
  // Centre inside the rect: push out along the shallowest side.
  const left = px - rect.x;
  const right = rect.x + rect.w - px;
  const top = py - rect.y;
  const bottom = rect.y + rect.h - py;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: rect.x - r, y: py, hit: true };
  if (m === right) return { x: rect.x + rect.w + r, y: py, hit: true };
  if (m === top) return { x: px, y: rect.y - r, hit: true };
  return { x: px, y: rect.y + rect.h + r, hit: true };
}

/**
 * Push a circle (x, y, radius) out of buildings, the water and the world edge.
 * Returns the corrected position and whether anything was hit.
 */
export function collideWorld(city, x, y, r) {
  let hit = false;
  if (x < WATER_X + r) { x = WATER_X + r; hit = true; }
  if (x > WORLD_W - r) { x = WORLD_W - r; hit = true; }
  if (y < r) { y = r; hit = true; }
  if (y > WORLD_H - r) { y = WORLD_H - r; hit = true; }
  for (const b of city.buildings) {
    if (x + r < b.x || x - r > b.x + b.w || y + r < b.y || y - r > b.y + b.h) continue;
    const fixed = collideRect(x, y, r, b);
    if (fixed) { x = fixed.x; y = fixed.y; hit = true; }
  }
  return { x, y, hit };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

/** A free spot on a road, for spawning cars and police. */
export function randomRoadSpot(rng) {
  if (chance(rng, 0.5)) return { x: pick(rng, ROAD_XS), y: randRange(rng, 200, WORLD_H - 200) };
  return { x: randRange(rng, 200, WORLD_W - 200), y: pick(rng, ROAD_YS) };
}
