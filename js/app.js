// js/app.js
// Точка входа «Лёшин планировщик».
// Добавлен мини-роутер экранов: dashboard / schedule / calendar (этап 3.1).

'use strict';

/* ==============================
   Импорты модулей (логика)
   ============================== */

import { loadState, saveState } from './storage.js';
import { toDateKey, parseDateKey, getToday, getTomorrow } from './date.js';
import { computeTotals, etaFromNow } from './compute.js';
import { renderStats, renderTasks } from './ui.js';

/* ==============================
   Константы
   ============================== */

const STATE_STORAGE_KEY = 'planner.state.v1';
const VIEWS = ['dashboard', 'schedule', 'calendar'];

/* ==============================
   Ссылки на DOM
   ============================== */

const btnToday = document.querySelector('[data-action="today"]');
const btnSchedule = document.querySelector('[data-action="schedule"]');
const btnCalendar = document.querySelector('[data-action="calendar"]');

const viewDashboard = document.querySelector('[data-view="dashboard"]');
const viewSchedule  = document.querySelector('[data-view="schedule"]');
const viewCalendar  = document.querySelector('[data-view="calendar"]');

/* ==============================
   Состояние приложения
   ============================== */

let state = null;

/* ==============================
   Утилиты состояния дней
   ============================== */

function ensureDay(dateKey) {
  if (!state.days) state.days = {};
  if (!state.days[dateKey]) {
    state.days[dateKey] = { tasks: [] };
  }
}

function getTasksForDate(dateKey) {
  ensureDay(dateKey);
  const day = state.days[dateKey];
  return Array.isArray(day.tasks) ? day.tasks : (day.tasks = []);
}

function setSelectedDate(dateKey) {
  const d = parseDateKey(dateKey);
  const normalizedKey = toDateKey(d);
  state.selectedDate = normalizedKey;
  saveState(state);
  if (state.currentView === 'dashboard') renderAll();
}

/* ==============================
   Роутинг экранов (этап 3.1)
   ============================== */

function showOnly(viewName) {
  // Спрячем все
  for (const el of [viewDashboard, viewSchedule, viewCalendar]) {
    if (!el) continue;
    el.hidden = true;
  }
  // Покажем нужный
  const map = { dashboard: viewDashboard, schedule: viewSchedule, calendar: viewCalendar };
  const el = map[viewName];
  if (el) el.hidden = false;
}

function switchView(viewName) {
  if (!VIEWS.includes(viewName)) {
    console.warn('[planner] switchView: unknown view', viewName);
    return;
  }
  state.currentView = viewName;
  saveState(state);
  showOnly(viewName);

  // При входе на дашборд — перерисовать сводку
  if (viewName === 'dashboard') renderAll();
}

/* ==============================
   Seed-данные (чтобы дашборд не был пустым)
   ============================== */

function makeId(prefix = 't') {
  const rnd = Math.floor(Math.random() * 1e6);
  return `${prefix}_${Date.now().toString(36)}_${rnd.toString(36)}`;
}

function isGloballyEmpty(stateObj) {
  if (!stateObj || !stateObj.days) return true;
  for (const key of Object.keys(stateObj.days)) {
    const tasks = stateObj.days[key]?.tasks;
    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        const planned = Number.isFinite(+t?.minutesPlanned) ? +t.minutesPlanned : 0;
        if (planned > 0) return false;
      }
    }
  }
  return true;
}

function seedForDate(dateKey) {
  state.days[dateKey].tasks = [
    { id: makeId('m'),  title: 'Математика: №1–5',        minutesPlanned: 40, minutesDone: 0, isDone: false },
    { id: makeId('ph'), title: 'Физика: §8 конспект',     minutesPlanned: 25, minutesDone: 0, isDone: false },
    { id: makeId('ru'), title: 'Русский: упр. 134 (1–3)', minutesPlanned: 20, minutesDone: 0, isDone: false },
  ];
}

function robustSeedIfNeeded(dateKey) {
  const tasks = getTasksForDate(dateKey);
  const nothingHere = !Array.isArray(tasks) || tasks.length === 0;
  if (nothingHere || isGloballyEmpty(state)) {
    console.info('[planner] seed: inserting demo tasks for', dateKey);
    seedForDate(dateKey);
    saveState(state);
  }
}

/* ==============================
   Рендер дашборда
   ============================== */

function makeDayLabel(dateKey) {
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

function handleToggleTask(id, isDone) {
  const dateKey = state.selectedDate;
  const tasks = getTasksForDate(dateKey);

  for (const t of tasks) {
    if (t.id === id) {
      t.isDone = !!isDone;
      if (t.isDone) {
        const planned = Number.isFinite(+t.minutesPlanned)
          ? Math.max(0, Math.floor(+t.minutesPlanned))
          : 0;
        t.minutesDone = planned;
      }
      break;
    }
  }
  saveState(state);
  renderAll();
}

function renderAll() {
  const dateKey = state.selectedDate;
  const tasks = getTasksForDate(dateKey);

  const totals = computeTotals(tasks);
  const eta = etaFromNow(tasks);

  renderStats(totals, eta);
  renderTasks(tasks, { onToggle: handleToggleTask }, makeDayLabel(dateKey));
}

/* ==============================
   Инициализация
   ============================== */

function resetIfRequested() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('reset') === '1') {
    console.info('[planner] reset via ?reset=1');
    try { window.localStorage.removeItem(STATE_STORAGE_KEY); }
    catch (e) { console.warn('[planner] reset failed:', e); }
  }
}

function initState() {
  const defaults = {
    selectedDate: null,
    days: {},
    currentView: 'dashboard', // новый флаг экрана (этап 3.1)
  };
  state = loadState(defaults);

  if (!state.selectedDate) {
    const tomorrowKey = toDateKey(getTomorrow());
    state.selectedDate = tomorrowKey;
    saveState(state);
    console.info('[planner] init: selectedDate ->', tomorrowKey);
  }

  ensureDay(state.selectedDate);
  robustSeedIfNeeded(state.selectedDate);
}

function initNavHandlers() {
  if (btnToday) {
    btnToday.addEventListener('click', () => {
      // Переходим на дашборд и показываем «сегодня»
      setSelectedDate(toDateKey(getToday()));
      switchView('dashboard');
    });
  }
  if (btnSchedule) {
    btnSchedule.addEventListener('click', () => {
      switchView('schedule');
    });
  }
  if (btnCalendar) {
    btnCalendar.addEventListener('click', () => {
      switchView('calendar');
    });
  }
}

function bootstrap() {
  resetIfRequested();
  initState();
  initNavHandlers();

  // Показать экран согласно state.currentView
  if (!VIEWS.includes(state.currentView)) state.currentView = 'dashboard';
  showOnly(state.currentView);

  // Если стартуем на дашборде — отрисуем сразу
  if (state.currentView === 'dashboard') renderAll();
}

bootstrap();
