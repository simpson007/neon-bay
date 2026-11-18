// Neon Bay — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between four screens: title, play, paused and game over, and
// saves cash and unlocked jobs to localStorage between visits.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createGame, EVENT_BLIP, EVENT_BUSTED, EVENT_CRASH, EVENT_FAIL, EVENT_JINGLE, EVENT_THUD, EVENT_WASTED, resetGame, stepGame } from './game.js';
import { startMission } from './missions.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { cash: 0, unlocked: 1 };
    const save = JSON.parse(raw);
    return { cash: Number(save.cash) || 0, unlocked: Math.min(5, Math.max(1, Number(save.unlocked) || 1)) };
  } catch {
    return { cash: 0, unlocked: 1 };
  }
}

function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: state.cash, unlocked: state.unlocked }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const state = createGame(seed, readSave());
  const scene = stageShot(name, state);
  const ui = { selected: 1 };
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, ui, state.elapsed);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const state = createGame(seed, readSave());
  let screen = SCREEN_TITLE;
  let selected = 1;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function playEvents(events) {
    if (events & EVENT_THUD) audio.thud();
    if (events & EVENT_BLIP) audio.blip();
    if (events & EVENT_JINGLE) audio.jingle();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_FAIL) audio.fail();
    if (events & EVENT_BUSTED) audio.fail();
    if (events & EVENT_WASTED) audio.fail();
  }

  function startRun(missionId) {
    resetGame(state);
    state.cash = readSave().cash;
    state.unlocked = readSave().unlocked;
    accumulator = 0;
    screen = SCREEN_PLAY;
    if (missionId) startMission(state, missionId);
    audio.ensure();
    announce(missionId ? `Job ${missionId} started.` : 'Free roam. Neon Bay is yours.');
  }

  function endRun() {
    screen = SCREEN_OVER;
    writeSave(state);
    audio.stopAll();
    announce(state.over === 'busted' ? 'Busted. Press R for the title screen.' : 'Wasted. Press R for the title screen.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_PAUSED)) {
      resetGame(state);
      screen = SCREEN_TITLE;
      announce('Neon Bay. Pick a job.');
      return;
    }
    if (screen === SCREEN_TITLE) {
      const snap = input.read();
      if (snap.digit >= 1 && snap.digit <= state.unlocked) selected = snap.digit;
      if (actions & ACTION_CONFIRM) startRun(selected);
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        resetGame(state);
        screen = SCREEN_TITLE;
        announce('Neon Bay. Pick a job.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        stepGame(state, {}, STEP);
        accumulator -= STEP;
      }
      if (state.over) { resetGame(state); }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        const snap = input.read();
        const events = stepGame(state, snap, STEP);
        playEvents(events);
        accumulator -= STEP;
        if (state.over) { endRun(); break; }
        if (state.saveDirty) { writeSave(state); state.saveDirty = false; }
      }
    } else {
      accumulator = 0;
    }
    audio.update(STEP, state);
    renderer.draw(state, screen, { selected }, state.elapsed);
  }

  // Leaving the tab pauses a running game rather than letting the law close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Bay. Press 1 to 5 to pick a job, Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
