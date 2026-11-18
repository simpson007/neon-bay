// Neon Bay — the numbers every system agrees on: world size, roads, car tuning,
// wanted rules, mission payouts and save key. Change a value here and the whole
// game (play, police, missions, screenshots) moves with it.
export const STEP = 1 / 60;
export const WORLD_W = 3600;
export const WORLD_H = 2600;
export const ROAD_W = 56;
export const ROAD_XS = [270, 570, 870, 1170, 1470, 1770, 2070, 2370, 2670, 2970, 3270];
export const ROAD_YS = [270, 570, 870, 1170, 1470, 1770, 2070, 2370];
export const WATER_X = 70; // west of this is the bay
export const BEACH_X = 175; // west of this is sand
export const SAVE_KEY = 'neonbay-save-v1';

export const PLAYER_SPAWN = { x: 1770, y: 1470 };
export const PAINT_SHOP = { x: 1960, y: 1205, cost: 75, radius: 110 };
export const DOCKS_PICKUP = { x: 600, y: 2505 };
export const SAFEHOUSE = { x: 3180, y: 2250 };

export const WALK_SPEED = 150;
export const RUN_SPEED = 240;
export const PUNCH_RANGE = 34;
export const PUNCH_COOLDOWN = 0.45;
export const ENTER_RANGE = 58;
export const MAX_WANTED = 5;
export const WANTED_DECAY_SECONDS = 9;

export const CAR_TYPES = {
  sedan: { name: 'Sedan', length: 46, width: 22, topSpeed: 330, accel: 300, grip: 2.6, colors: ['#c0392b', '#2e6da4', '#7f8c8d', '#d4d4d4', '#34495e'] },
  taxi: { name: 'Taxi', length: 46, width: 22, topSpeed: 320, accel: 290, grip: 2.6, colors: ['#f1c40f'] },
  truck: { name: 'Pickup', length: 54, width: 24, topSpeed: 280, accel: 240, grip: 2.2, colors: ['#5d6d7e', '#7e5109', '#1e8449'] },
  sports: { name: 'Sports', length: 48, width: 22, topSpeed: 430, accel: 380, grip: 3.1, colors: ['#e74c3c', '#8e44ad', '#16a085', '#f39c12'] },
  police: { name: 'Patrol', length: 48, width: 22, topSpeed: 400, accel: 360, grip: 3.0, colors: ['#1c2733'] },
};

export const DISTRICTS = [
  { name: 'BAYFRONT', x: 1620, y: 150 },
  { name: 'OLD TOWN', x: 2970, y: 700 },
  { name: 'DOWNTOWN', x: 1620, y: 870 },
  { name: 'HILLSIDE', x: 2970, y: 1770 },
  { name: 'MARINA', x: 450, y: 1950 },
  { name: 'DOCKS', x: 720, y: 2450 },
];

export const MISSION_DEFS = [
  { id: 1, title: 'First Wheels', payout: 200, blurb: 'Steal a car and get it repainted at Spray & Go.' },
  { id: 2, title: 'Courier Run', payout: 300, blurb: 'Timed delivery across town to Hillside.' },
  { id: 3, title: 'Hot Pursuit', payout: 400, blurb: 'Shake a 3-star wanted level and stay free.' },
  { id: 4, title: 'Dockside Pickup', payout: 500, blurb: 'Collect the package at the Docks, deliver it Downtown.' },
  { id: 5, title: 'The Bayfront Job', payout: 1000, blurb: 'Three stops, one escape. Clear the debt.' },
];
