// js/app.js
// Точка входа «Лёшин планировщик».
// Этап 3.1: мини-роутер (dashboard / schedule / calendar)
// Этап 3.2: модель шаблонов расписания в state + хелперы (без UI логики)

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
   Утилиты состояния дней (дашборд)
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
  for (const el of [viewDashboard, viewSchedule, viewCalendar]) {
    if (!el) continue;
    el.hidden = true;
  }
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
  if (viewName === 'dashboard') renderAll();
}

/* ==============================
   Seed-данные для дашборда (чтобы не было пусто)
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
   Этап 3.2 — Модель шаблонов расписания
   ============================== */

/**
 * Создаёт пустые шаблоны для 7 дней недели.
 * Формат:
 * scheduleTemplates = {
 *   mon: { tasks: [ {title, minutesPlanned} ] },
 *   tue: { tasks: [...] },
 *   ... wed, thu, fri, sat, sun
 * }
 */
function makeEmptyScheduleTemplates() {
  return {
    mon: { tasks: [] },
    tue: { tasks: [] },
    wed: { tasks: [] },
    thu: { tasks: [] },
    fri: { tasks: [] },
    sat: { tasks: [] },
    sun: { tasks: [] },
  };
}

/**
 * Гарантирует, что scheduleTemplates существует и имеет все 7 ключей.
 */
function ensureScheduleTemplates() {
  if (!state.scheduleTemplates || typeof state.scheduleTemplates !== 'object') {
    state.scheduleTemplates = makeEmptyScheduleTemplates();
    return;
  }
  // Добьём отсутствующие ключи, если какие-то пропали
  const defaults = makeEmptyScheduleTemplates();
  for (const k of Object.keys(defaults)) {
    if (!state.scheduleTemplates[k] || !Array.isArray(state.scheduleTemplates[k].tasks)) {
      state.scheduleTemplates[k] = { tasks: [] };
    }
  }
}

/**
 * Возвращает ключ дня недели ('mon'..'sun') для переданной даты.
 * Для junior: getDay() в JS -> 0..6, где 0 = Воскресенье.
 */
function weekdayKeyFromDate(date) {
  const d = new Date(date);
  const js = d.getDay(); // 0..6 (0 = Sunday)
  // Перекодируем в mon..sun
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][js];
}

/**
 * Нормализует одну задачу шаблона (только title + minutesPlanned >= 0).
 */
function normalizeTemplateTask(t) {
  if (!t || typeof t !== 'object') return { title: 'Задание', minutesPlanned: 0 };
  const title = String(t.title ?? '').trim() || 'Задание';
  const mp = Number.isFinite(+t.minutesPlanned) ? Math.max(0, Math.floor(+t.minutesPlanned)) : 0;
  return { title, minutesPlanned: mp };
}

/**
 * Возвращает массив задач-шаблона для weekday ('mon'..'sun').
 */
function getTemplate(weekday) {
  ensureScheduleTemplates();
  const day = state.scheduleTemplates[weekday];
  if (!day) return [];
  const arr = Array.isArray(day.tasks) ? day.tasks : [];
  // Возвращаем копию, нормализованную
  return arr.map(normalizeTemplateTask);
}

/**
 * Сохраняет массив задач-шаблона для weekday ('mon'..'sun').
 * Валидация: только title + minutesPlanned>=0.
 */
function setTemplate(weekday, tasks) {
  ensureScheduleTemplates();
  const safe = Array.isArray(tasks) ? tasks.map(normalizeTemplateTask) : [];
  state.scheduleTemplates[weekday] = { tasks: safe };
  saveState(state);
}

/**
 * (Заготовка на 3.4) Применяет шаблон для weekday к конкретной дате (перезаписывает задачи дня).
 * Сейчас не вызывается из UI — подключим на шаге 3.4.
 */
function applyTemplateToDate(weekday, dateKey) {
  ensureDay(dateKey);
  const tpl = getTemplate(weekday);
  // Превратим "шаблонную" запись в "реальные задачи" дня (с id, isDone = false, minutesDone = 0)
  state.days[dateKey].tasks = tpl.map((t) => ({
    id: makeId('x'),
    title: t.title,
    minutesPlanned: t.minutesPlanned,
    minutesDone: 0,
    isDone: false,
  }));
  saveState(state);
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
    currentView: 'dashboard',
    scheduleTemplates: makeEmptyScheduleTemplates(), // новый раздел (этап 3.2)
  };
  state = loadState(defaults);

  if (!state.selectedDate) {
    const tomorrowKey = toDateKey(getTomorrow());
    state.selectedDate = tomorrowKey;
    saveState(state);
    console.info('[planner] init: selectedDate ->', tomorrowKey);
  }

  // Гарантируем структуру дней и шаблонов
  ensureDay(state.selectedDate);
  ensureScheduleTemplates();

  // Оставляем сид для дашборда (как раньше)
  robustSeedIfNeeded(state.selectedDate);
}

function initNavHandlers() {
  if (btnToday) {
    btnToday.addEventListener('click', () => {
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

  if (!VIEWS.includes(state.currentView)) state.currentView = 'dashboard';
  showOnly(state.currentView);
  if (state.currentView === 'dashboard') renderAll();
}

bootstrap();

/* ==============================
   Экспорт (если кому-то понадобится позже)
   ============================== */
// Ничего не экспортируем из app.js — это точка входа.
// Хелперы для шаблонов оставлены внутренними до шага 3.3/3.4.
