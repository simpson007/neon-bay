// Neon Bay — drawing only: the city, the cars, the people, the HUD with its
// minimap, and the title, pause and game-over screens. The camera follows the
// player; the minimap is a second, tiny drawing of the same world.
import { BEACH_X, CAR_TYPES, DISTRICTS, MISSION_DEFS, PAINT_SHOP, ROAD_W, ROAD_XS, ROAD_YS, WATER_X, WORLD_H, WORLD_W } from './config.js';
import { missionMarker, objectiveText } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MAP_W = 196;
const MAP_H = 142;

function clockText(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const fonts = new Map();
  function font(size, bold) {
    const key = `${size}:${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }
  function text(value, x, y, size, color, align = 'left', bold = false) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
  }

  // ---------- the world ----------

  function drawGround(state, view) {
    ctx.fillStyle = '#79a75b';
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    // The bay and the beach, west edge.
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(view.x0, view.y0, Math.max(0, WATER_X - view.x0), view.y1 - view.y0);
    ctx.fillStyle = '#e8d9a0';
    ctx.fillRect(Math.max(view.x0, WATER_X), view.y0, Math.max(0, BEACH_X - Math.max(view.x0, WATER_X)), view.y1 - view.y0);
    // Roads: asphalt with a lighter sidewalk edge and a dashed centre line.
    ctx.fillStyle = '#3a3f46';
    for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2, view.y0, ROAD_W, view.y1 - view.y0);
    for (const ry of ROAD_YS) ctx.fillRect(view.x0, ry - ROAD_W / 2, view.x1 - view.x0, ROAD_W);
    ctx.fillStyle = '#4a5058';
    for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2 - 6, view.y0, 6, view.y1 - view.y0);
    for (const rx of ROAD_XS) ctx.fillRect(rx + ROAD_W / 2, view.y0, 6, view.y1 - view.y0);
    for (const ry of ROAD_YS) ctx.fillRect(view.x0, ry - ROAD_W / 2 - 6, view.x1 - view.x0, 6);
    for (const ry of ROAD_YS) ctx.fillRect(view.x0, ry + ROAD_W / 2, view.x1 - view.x0, 6);
    ctx.fillStyle = '#d8c95a';
    for (const rx of ROAD_XS) {
      for (let y = Math.floor(view.y0 / 44) * 44; y < view.y1; y += 44) ctx.fillRect(rx - 2, y, 4, 20);
    }
    for (const ry of ROAD_YS) {
      for (let x = Math.floor(view.x0 / 44) * 44; x < view.x1; x += 44) ctx.fillRect(x, ry - 2, 20, 4);
    }
    // Parks and trees.
    for (const park of state.city.parks) {
      ctx.fillStyle = '#5d9b4a';
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    for (const tree of state.city.trees) {
      ctx.fillStyle = '#3f7d33';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57a047';
      ctx.beginPath();
      ctx.arc(tree.x - 2, tree.y - 2, tree.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // District names painted on the ground.
    ctx.font = font(34, true);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (const d of DISTRICTS) text(d.name, d.x, d.y, 34, 'rgba(255,255,255,0.16)', 'center', true);
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      ctx.fillStyle = b.trim;
      ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 8, b.y + 8, Math.min(26, b.w - 16), Math.min(18, b.h - 16));
      ctx.fillRect(b.x + b.w - 34, b.y + b.h - 26, 26, 18);
      if (b.kind === 'paint') {
        text('SPRAY & GO', b.x + b.w / 2, b.y + b.h / 2 + 6, 15, '#ffffff', 'center', true);
      }
    }
    for (const c of state.city.containers) {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(c.x, c.y, c.w, 3);
    }
    for (const boat of state.city.boats) {
      ctx.save();
      ctx.translate(boat.x, boat.y);
      ctx.rotate(boat.angle);
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(-14, -5, 28, 10);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-4, -8, 8, 6);
      ctx.restore();
    }
  }

  function drawCar(car, time) {
    const def = CAR_TYPES[car.type];
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-def.length / 2 + 3, -def.width / 2 + 3, def.length, def.width);
    ctx.fillStyle = car.color;
    ctx.fillRect(-def.length / 2, -def.width / 2, def.length, def.width);
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(-def.length / 2 + 8, -def.width / 2 + 4, 10, def.width - 8);
    ctx.fillRect(def.length / 2 - 16, -def.width / 2 + 4, 8, def.width - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(-2, -def.width / 2 + 3, 8, def.width - 6);
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(def.length / 2 - 2, -def.width / 2 + 2, 3, 5);
    ctx.fillRect(def.length / 2 - 2, def.width / 2 - 7, 3, 5);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#111';
      for (let i = 0; i < 5; i += 1) ctx.fillRect(-8 + i * 4, -def.width / 2 + 1, 3, 4);
    }
    if (car.type === 'police') {
      const flash = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2d2d' : '#2d7bff';
      ctx.fillRect(-6, -def.width / 2 - 1, 5, 4);
      ctx.fillStyle = flash ? '#2d7bff' : '#ff2d2d';
      ctx.fillRect(1, -def.width / 2 - 1, 5, 4);
      text('PD', 0, 4, 9, '#ffffff', 'center', true);
    }
    if (car.damage > 40) {
      ctx.fillStyle = 'rgba(40,40,40,0.8)';
      ctx.beginPath();
      ctx.arc(-def.length / 4, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPed(ped) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 6, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (ped.down > 0) {
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, 0.4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 1, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCop(cop) {
    ctx.fillStyle = '#1c2733';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y - 1, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d7bff';
    ctx.fillRect(cop.x - 6, cop.y - 12, 12, 3);
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.car) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 7, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7e5109';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
    ctx.stroke();
    if (p.punchAnim > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, p.angle - 0.7, p.angle + 0.7);
      ctx.stroke();
    }
  }

  function drawMarker(state, time) {
    const marker = missionMarker(state);
    if (!marker) return;
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 14);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    text(marker.label, marker.x, marker.y - 44, 15, '#ffd700', 'center', true);
  }

  function drawOffscreenArrow(state, view) {
    const marker = missionMarker(state);
    if (!marker) return;
    const p = state.player;
    if (marker.x > view.x0 && marker.x < view.x1 && marker.y > view.y0 && marker.y < view.y1) return;
    const cx = (view.x0 + view.x1) / 2;
    const cy = (view.y0 + view.y1) / 2;
    const angle = Math.atan2(marker.y - p.y, marker.x - p.x);
    const ex = cx + Math.cos(angle) * (Math.min(view.x1 - view.x0, view.y1 - view.y0) * 0.36);
    const ey = cy + Math.sin(angle) * (Math.min(view.x1 - view.x0, view.y1 - view.y0) * 0.36);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---------- the HUD ----------

  function drawMinimap(state, cw, ch) {
    const mx = cw - MAP_W - 16;
    const my = 16;
    const sx = MAP_W / WORLD_W;
    const sy = MAP_H / WORLD_H;
    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    ctx.fillRect(mx - 4, my - 4, MAP_W + 8, MAP_H + 8);
    ctx.fillStyle = '#22303c';
    ctx.fillRect(mx, my, MAP_W, MAP_H);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(mx, my, WATER_X * sx, MAP_H);
    ctx.fillStyle = '#e8d9a0';
    ctx.fillRect(mx + WATER_X * sx, my, (BEACH_X - WATER_X) * sx, MAP_H);
    ctx.strokeStyle = '#5a636e';
    ctx.lineWidth = 2;
    for (const rx of ROAD_XS) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + MAP_H);
      ctx.stroke();
    }
    for (const ry of ROAD_YS) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + MAP_W, my + ry * sy);
      ctx.stroke();
    }
    ctx.fillStyle = '#e86a92';
    ctx.fillRect(mx + PAINT_SHOP.x * sx - 3, my + PAINT_SHOP.y * sy - 3, 6, 6);
    const marker = missionMarker(state);
    if (marker) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(mx + marker.x * sx, my + marker.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.policeCars) {
      ctx.fillStyle = '#ff2d2d';
      ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
    }
    for (const car of state.cars) {
      if (car.police) continue;
      ctx.fillStyle = 'rgba(200,200,200,0.8)';
      ctx.fillRect(mx + car.x * sx - 1, my + car.y * sy - 1, 2, 2);
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 4, my - 4, MAP_W + 8, MAP_H + 8);
  }

  function drawHud(state, cw, ch, time) {
    // Wanted stars, cash, health — top left.
    for (let s = 0; s < 5; s += 1) {
      text(s < state.wanted ? '★' : '☆', 22 + s * 30, 44, 30, s < state.wanted ? '#ffd700' : 'rgba(255,255,255,0.45)', 'left', true);
    }
    text(`$${state.cash}`, 22, 78, 26, '#7CFC9A', 'left', true);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(22, 88, 180, 14);
    ctx.fillStyle = state.player.health > 30 ? '#4caf50' : '#e53935';
    ctx.fillRect(22, 88, 180 * Math.max(0, state.player.health / 100), 14);
    text('HEALTH', 206, 100, 12, '#ffffff', 'left', true);
    // Clock under the minimap.
    text(clockText(state.clockMin), cw - 16, MAP_H + 48, 20, '#ffffff', 'right', true);
    // Mission banner — top centre.
    const objective = objectiveText(state);
    ctx.font = font(18, true);
    const w = ctx.measureText(objective).width + 36;
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    ctx.fillRect((cw - w) / 2, 14, w, 34);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1;
    ctx.strokeRect((cw - w) / 2, 14, w, 34);
    text(objective, cw / 2, 38, 18, '#ffd700', 'center', true);
    // Speed and car state — bottom right.
    if (state.player.car) {
      const mph = Math.round(Math.abs(state.player.car.speed) * 0.16);
      text(`${mph} mph`, cw - 24, ch - 24, 30, '#ffffff', 'right', true);
      const dmg = Math.round(state.player.car.damage);
      text(dmg > 55 ? `CAR ${dmg}% — SMOKING` : `CAR ${dmg}%`, cw - 24, ch - 52, 16, dmg > 55 ? '#ff7043' : '#cccccc', 'right', true);
    } else {
      text('WASD move · SHIFT run · SPACE punch · E enter car', 22, ch - 24, 15, 'rgba(255,255,255,0.75)');
    }
    if (state.nearPaint) {
      text(`Press E — Spray & Go: $${PAINT_SHOP.cost} clears your wanted level`, cw / 2, ch - 60, 18, '#ff8fb0', 'center', true);
    }
    // Toast — centre, under the banner.
    if (state.toast) {
      ctx.font = font(17, true);
      const tw = ctx.measureText(state.toast).width + 30;
      ctx.fillStyle = 'rgba(10,14,20,0.8)';
      ctx.fillRect((cw - tw) / 2, 60, tw, 30);
      text(state.toast, cw / 2, 81, 17, '#ffffff', 'center', true);
    }
    drawMinimap(state, cw, ch);
  }

  // ---------- screens ----------

  function drawPanel(cw, ch, title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 30 + 70;
    const x = (cw - width) / 2;
    const y = (ch - height) / 2;
    ctx.fillStyle = 'rgba(8,12,18,0.88)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    text(title, cw / 2, y + 62, 44, accent, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], cw / 2, y + 108 + i * 30, 18, '#dddddd', 'center');
    }
    text(prompt, cw / 2, y + height - 30, 19, '#ffd700', 'center', true);
  }

  function drawTitle(state, cw, ch, ui) {
    const lines = [
      'Rook, a getaway driver new in Neon Bay, owes fixer Delia Voss $1,000.',
      'Steal cars, outrun the law, run her jobs — and buy your freedom.',
      '',
      `Cash $${state.cash}   ·   Jobs unlocked: ${state.unlocked} of 5`,
      '',
    ];
    for (const def of MISSION_DEFS) {
      const locked = def.id > state.unlocked;
      const mark = ui.selected === def.id ? '▶ ' : '   ';
      lines.push(`${mark}${def.id}. ${def.title} — $${def.payout}${locked ? '  (locked)' : ''} — ${def.blurb}`);
    }
    lines.push('', 'WASD move/drive · SHIFT run · SPACE punch/handbrake · E enter car · P pause · M mute');
    drawPanel(cw, ch, 'NEON BAY', lines, 'Press 1–5 to pick a job, Enter to start', '#ff5e8a');
  }

  function drawOver(state, cw, ch) {
    const busted = state.over === 'busted';
    const lines = [
      busted ? 'The Neon Bay PD took you in. Delia is not pleased.' : 'Rook went down in the streets of Neon Bay.',
      `Cash kept: $${state.cash}   ·   Jobs unlocked: ${state.unlocked} of 5`,
      '',
      'Your progress is saved. Take another job when you are ready.',
    ];
    drawPanel(cw, ch, busted ? 'BUSTED' : 'WASTED', lines, 'Press R for the title screen', busted ? '#2d7bff' : '#e53935');
  }

  /** Paint one frame: the world through the camera, then the HUD or a screen. */
  function draw(state, screen, ui, time) {
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.min(cw / 1280, ch / 720);
    const vw = cw / scale;
    const vh = ch / scale;
    const cam = state.camera;
    const view = {
      x0: Math.max(0, Math.min(WORLD_W - vw, cam.x - vw / 2)),
      y0: Math.max(0, Math.min(WORLD_H - vh, cam.y - vh / 2)),
      x1: 0, y1: 0,
    };
    view.x1 = view.x0 + vw;
    view.y1 = view.y0 + vh;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c1016';
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(scale, 0, 0, scale, -view.x0 * scale, -view.y0 * scale);

    drawGround(state, view);
    drawBuildings(state);
    drawMarker(state, time);
    for (const car of state.cars) drawCar(car, time);
    for (const ped of state.peds) drawPed(ped);
    for (const cop of state.cops) drawCop(cop);
    drawPlayer(state);
    for (const p of state.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    drawOffscreenArrow(state, view);

    // HUD and screens live in screen space, not world space.
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const sw = cw / scale;
    const sh = ch / scale;
    if (screen === SCREEN_TITLE) {
      drawTitle(state, sw, sh, ui);
      return;
    }
    drawHud(state, sw, sh, time);
    if (screen === SCREEN_PAUSED) {
      drawPanel(sw, sh, 'PAUSED', ['Neon Bay waits for no one — except now.', ''], 'Press P to keep driving', '#ffd700');
    } else if (screen === SCREEN_OVER) {
      drawOver(state, sw, sh);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
