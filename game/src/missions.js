// Neon Bay — the story: five jobs for fixer Delia Voss, each a small state
// machine with an objective line, a map marker and a payout. A mission starts
// from the title screen (or the next one unlocks when the last pays out) and
// fails cleanly on its timer so the player can retry it.
import { DOCKS_PICKUP, MISSION_DEFS, PAINT_SHOP, SAFEHOUSE } from './config.js';
import { raiseWanted } from './police.js';

export function missionById(id) {
  return MISSION_DEFS.find((m) => m.id === id) ?? null;
}

export function startMission(state, id) {
  const def = missionById(id);
  if (!def) return false;
  state.mission = { id, stage: 0, timer: 0, limit: 0, target: null, done: false, failed: false };
  const m = state.mission;
  if (id === 1) {
    m.target = { x: PAINT_SHOP.x, y: PAINT_SHOP.y, label: 'Spray & Go' };
    m.objective = 'Steal a car — walk up to one and press E';
  } else if (id === 2) {
    m.target = { x: 3180, y: 2100, label: 'Hillside drop' };
    m.limit = 100;
    m.objective = 'Deliver the package to Hillside — fast';
  } else if (id === 3) {
    m.limit = 90;
    raiseWanted(state, 3);
    m.objective = 'You are 3 stars hot. Lose the heat — stay unseen';
  } else if (id === 4) {
    m.target = { x: DOCKS_PICKUP.x, y: DOCKS_PICKUP.y, label: 'Docks pickup' };
    m.objective = 'Pick up the package at the Docks';
  } else if (id === 5) {
    m.stops = [
      { x: 3150, y: 450, label: 'Old Town vault' },
      { x: 1650, y: 750, label: 'Downtown vault' },
      { x: 750, y: 2250, label: 'Docks vault' },
    ];
    m.target = m.stops[0];
    m.limit = 200;
    m.objective = 'Hit the vaults: Old Town first';
  }
  state.toast = `New job: ${def.title} — $${def.payout}`;
  return true;
}

function completeMission(state) {
  const def = missionById(state.mission.id);
  state.cash += def.payout;
  state.mission.done = true;
  state.unlocked = Math.max(state.unlocked, Math.min(5, def.id + 1));
  state.events |= 4; // mission-complete jingle
  state.toast = `Job done — $${def.payout} paid. ${def.id === 5 ? 'Debt cleared. Neon Bay is yours.' : ''}`;
  state.mission = null;
  state.saveDirty = true;
}

function failMission(state, why) {
  state.mission.failed = true;
  state.toast = `Job failed: ${why}. Press Enter to retry it.`;
  state.events |= 32;
  state.mission = null;
}

function near(state, target, radius) {
  const p = state.player;
  return Math.hypot(p.x - target.x, p.y - target.y) < radius;
}

/** Advance the active mission one step; returns nothing, sets state.events. */
export function updateMission(state, dt) {
  const m = state.mission;
  if (!m) return;
  if (m.limit > 0) {
    m.timer += dt;
    if (m.timer >= m.limit) {
      failMission(state, 'out of time');
      return;
    }
  }
  if (m.id === 1) {
    if (m.stage === 0 && state.player.car) {
      m.stage = 1;
      m.objective = 'Drive to Spray & Go — the pink shop Downtown';
      state.toast = 'Nice wheels. Now get it repainted.';
    } else if (m.stage === 1 && near(state, m.target, 120)) {
      completeMission(state);
    }
  } else if (m.id === 2) {
    if (near(state, m.target, 90)) completeMission(state);
  } else if (m.id === 3) {
    if (state.wanted === 0) completeMission(state);
  } else if (m.id === 4) {
    if (m.stage === 0 && near(state, m.target, 80)) {
      m.stage = 1;
      m.target = { x: 1770, y: 570, label: 'Downtown drop' };
      m.objective = 'Package in hand. Deliver it Downtown — the law is watching';
      raiseWanted(state, 2);
      state.toast = 'Package collected. Move.';
    } else if (m.stage === 1 && near(state, m.target, 90)) {
      completeMission(state);
    }
  } else if (m.id === 5) {
    if (near(state, m.target, 90)) {
      const next = m.stops.indexOf(m.target) + 1;
      if (next < m.stops.length) {
        m.target = m.stops[next];
        m.objective = `Vault ${next + 1} of 3: ${m.target.label}`;
        state.toast = 'One down. Next vault.';
      } else {
        m.stage = 1;
        m.target = { x: SAFEHOUSE.x, y: SAFEHOUSE.y, label: 'Safehouse' };
        m.objective = 'All three vaults hit. Lose the heat and reach the safehouse';
        raiseWanted(state, 2);
      }
    } else if (m.stage === 1 && near(state, m.target, 100) && state.wanted === 0) {
      completeMission(state);
    }
  }
}

/** The objective line the HUD banner shows, or the free-roam hint. */
export function objectiveText(state) {
  if (state.mission) {
    const m = state.mission;
    const def = missionById(m.id);
    const clock = m.limit > 0 ? `  —  ${Math.max(0, Math.ceil(m.limit - m.timer))}s` : '';
    return `${def.title}: ${m.objective}${clock}`;
  }
  return 'Free roam — press 1–5 on the title screen to take a job';
}

/** The world position the minimap and the direction arrow point at, if any. */
export function missionMarker(state) {
  return state.mission ? state.mission.target : null;
}
