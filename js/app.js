// js/app.js
// Этап 3.1: мини-роутер (dashboard / schedule / calendar)
// Этап 3.2: модель шаблонов расписания в state
// Этап 3.3: базовый UI редактора расписания
// Этап 3.4: применение шаблона к выбранной дате

'use strict';

/* ==============================
   Импорты модулей
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
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEKDAY_LABEL = {
  mon: 'Понедельник',
  tue: 'Вторник',
  wed: 'Среда',
  thu: 'Четверг',
  fri: 'Пятница',
  sat: 'Суббота',
  sun: 'Воскресенье',
};

/* ==============================
   DOM-ссылки
   ============================== */

const btnToday = document.querySelector('[data-action="today"]');
const btnSchedule = document.querySelector('[data-action="schedule"]');
const btnCalendar = document.querySelector('[data-action="calendar"]');

const viewDashboard = document.querySelector('[data-view="dashboard"]');
const viewSchedule  = document.querySelector('[data-view="schedule"]');
const viewCalendar  = document.querySelector('[data-view="calendar"]');

// Schedule UI
const weekdaySwitch = document.querySelector('.weekday-switch');
const scheduleListEl = document.querySelector('[data-schedule-list]');
const btnAddRow = document.querySelector('[data-schedule-add]');
const btnSaveTpl = document.querySelector('[data-schedule-save]');
const btnApplyTemplate = document.querySelector('[data-apply-template]');

// Calendar UI
const inputPickDate = document.querySelector('[data-pick-date]');
const btnApplyPicked = document.querySelector('[data-apply-picked]');

/* ==============================
   Состояние
   ============================== */

let state = null;
let scheduleCurrentWeekday = 'mon';

/* ==============================
   День/задачи (дашборд)
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
  if (state.currentView === 'dashboard') {
    renderAll();
  }
}

/* ==============================
   Роутер
   ============================== */

function showOnly(viewName) {
  for (const el of [viewDashboard, viewSchedule, viewCalendar]) {
    if (el) el.hidden = true;
  }
  const map = { dashboard: viewDashboard, schedule: viewSchedule, calendar: viewCalendar };
  if (map[viewName]) map[viewName].hidden = false;
}

function switchView(viewName) {
  if (!VIEWS.includes(viewName)) {
    console.warn('[planner] switchView: unknown view', viewName);
    return;
  }
  state.currentView = viewName;
  saveState(state);
  showOnly(viewName);

  if (viewName === 'dashboard') {
    renderAll();
  } else if (viewName === 'schedule') {
    renderScheduleEditor();
  } else if (viewName === 'calendar') {
    renderCalendar();
  }
}

/* ==============================
   Seed для дашборда
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
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
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
   3.2 — Шаблоны расписания в state
   ============================== */

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

function ensureScheduleTemplates() {
  if (!state.scheduleTemplates || typeof state.scheduleTemplates !== 'object') {
    state.scheduleTemplates = makeEmptyScheduleTemplates();
    return;
  }
  const defaults = makeEmptyScheduleTemplates();
  for (const k of Object.keys(defaults)) {
    if (!state.scheduleTemplates[k] || !Array.isArray(state.scheduleTemplates[k].tasks)) {
      state.scheduleTemplates[k] = { tasks: [] };
    }
  }
}

function normalizeTemplateTask(t) {
  if (!t || typeof t !== 'object') {
    return { title: 'Задание', minutesPlanned: 0 };
  }
  const title = String(t.title ?? '').trim() || 'Задание';
  const mp = Number.isFinite(+t.minutesPlanned)
    ? Math.max(0, Math.floor(+t.minutesPlanned))
    : 0;
  return { title, minutesPlanned: mp };
}

function getTemplate(weekday) {
  ensureScheduleTemplates();
  const day = state.scheduleTemplates[weekday];
  const arr = Array.isArray(day?.tasks) ? day.tasks : [];
  return arr.map(normalizeTemplateTask);
}

function setTemplate(weekday, tasks) {
  ensureScheduleTemplates();
  const safe = Array.isArray(tasks) ? tasks.map(normalizeTemplateTask) : [];
  state.scheduleTemplates[weekday] = { tasks: safe };
  saveState(state);
}

/* === вспомогательное: ключ дня недели из Date (sun..sat) -> (mon..sun) === */
function weekdayKeyFromDate(date) {
  const d = new Date(date);
  const js = d.getDay(); // 0..6, где 0 = воскресенье
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][js];
}

/* === применение шаблона к дате (ядро) === */
function applyTemplateToDate(weekday, dateKey) {
  ensureDay(dateKey);
  const tpl = getTemplate(weekday);
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
   3.3 — UI редактора расписания
   ============================== */

function renderScheduleRows(weekday) {
  if (!scheduleListEl) return;
  scheduleListEl.innerHTML = '';

  const tpl = getTemplate(weekday);
  if (tpl.length === 0) {
    tpl.push({ title: '', minutesPlanned: 0 });
  }

  for (let i = 0; i < tpl.length; i++) {
    const row = document.createElement('div');
    row.className = 'schedule-row';
    row.dataset.index = String(i);

    const inputTitle = document.createElement('input');
    inputTitle.type = 'text';
    inputTitle.placeholder = 'Название задания';
    inputTitle.value = tpl[i].title;

    const inputMinutes = document.createElement('input');
    inputMinutes.type = 'number';
    inputMinutes.min = '0';
    inputMinutes.step = '1';
    inputMinutes.placeholder = '0';
    inputMinutes.value = String(tpl[i].minutesPlanned);

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn';
    btnDel.textContent = 'Удалить';
    btnDel.addEventListener('click', () => {
      row.remove();
    });

    actions.appendChild(btnDel);
    row.append(inputTitle, inputMinutes, actions);
    scheduleListEl.appendChild(row);
  }
}

function highlightActiveWeekday() {
  if (!weekdaySwitch) return;
  const buttons = weekdaySwitch.querySelectorAll('button[data-weekday]');
  buttons.forEach((b) => {
    if (b.dataset.weekday === scheduleCurrentWeekday) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
}

function collectTemplateFromDOM() {
  if (!scheduleListEl) return [];
  const rows = Array.from(scheduleListEl.querySelectorAll('.schedule-row'));
  const out = [];
  for (const r of rows) {
    const [inputTitle, inputMinutes] = r.querySelectorAll('input');
    const title = String(inputTitle?.value ?? '').trim();
    const minutes = Math.max(0, Math.floor(Number(inputMinutes?.value ?? 0)));
    if (title || minutes > 0) {
      out.push({ title, minutesPlanned: minutes });
    }
  }
  return out;
}

function renderScheduleEditor() {
  if (!viewSchedule) return;

  ensureScheduleTemplates();
  highlightActiveWeekday();
  renderScheduleRows(scheduleCurrentWeekday);

  if (weekdaySwitch && !weekdaySwitch.dataset.bound) {
    weekdaySwitch.addEventListener('click', (ev) => {
      const target = ev.target;
      if (target && target.matches('button[data-weekday]')) {
        scheduleCurrentWeekday = target.dataset.weekday;
        highlightActiveWeekday();
        renderScheduleRows(scheduleCurrentWeekday);
      }
    });
    weekdaySwitch.dataset.bound = '1';
  }

  if (btnAddRow && !btnAddRow.dataset.bound) {
    btnAddRow.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'schedule-row';

      const inputTitle = document.createElement('input');
      inputTitle.type = 'text';
      inputTitle.placeholder = 'Название задания';

      const inputMinutes = document.createElement('input');
      inputMinutes.type = 'number';
      inputMinutes.min = '0';
      inputMinutes.step = '1';
      inputMinutes.placeholder = '0';

      const actions = document.createElement('div');
      actions.className = 'row-actions';

      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn';
      btnDel.textContent = 'Удалить';
      btnDel.addEventListener('click', () => row.remove());

      actions.appendChild(btnDel);
      row.append(inputTitle, inputMinutes, actions);
      scheduleListEl.appendChild(row);

      inputTitle.focus();
    });
    btnAddRow.dataset.bound = '1';
  }

  if (btnSaveTpl && !btnSaveTpl.dataset.bound) {
    btnSaveTpl.addEventListener('click', () => {
      const tasks = collectTemplateFromDOM();
      setTemplate(scheduleCurrentWeekday, tasks);
      console.info('[planner] schedule: template saved for', scheduleCurrentWeekday, tasks);
    });
    btnSaveTpl.dataset.bound = '1';
  }

  /* === 3.4 — кнопка применения шаблона к выбранной дате === */
  if (btnApplyTemplate && !btnApplyTemplate.dataset.bound) {
    btnApplyTemplate.addEventListener('click', () => {
      const dateKey = state.selectedDate;
      if (!dateKey) return;
      applyTemplateToDate(scheduleCurrentWeekday, dateKey);
      console.info('[planner] schedule: template applied to', dateKey, 'from', scheduleCurrentWeekday);
      switchView('dashboard'); // покажем результат
    });
    btnApplyTemplate.dataset.bound = '1';
  }
}

/* ==============================
   Calendar (упрощённый)
   ============================== */

function renderCalendar() {
  if (!inputPickDate || !btnApplyPicked) return;

  const d = parseDateKey(state.selectedDate ?? toDateKey(getToday()));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  inputPickDate.value = `${yyyy}-${mm}-${dd}`;
}

/* ==============================
   Инициализация
   ============================== */

function resetIfRequested() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('reset') === '1') {
    console.info('[planner] reset via ?reset=1');
    try {
      window.localStorage.removeItem(STATE_STORAGE_KEY);
    } catch (e) {
      console.warn('[planner] reset failed:', e);
    }
  }
}

function initState() {
  const defaults = {
    selectedDate: null,
    days: {},
    currentView: 'dashboard',
    scheduleTemplates: makeEmptyScheduleTemplates(),
  };
  state = loadState(defaults);

  if (!state.selectedDate) {
    const tomorrowKey = toDateKey(getTomorrow());
    state.selectedDate = tomorrowKey;
    saveState(state);
    console.info('[planner] init: selectedDate ->', tomorrowKey);
  }

  ensureDay(state.selectedDate);
  ensureScheduleTemplates();
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

  if (btnApplyPicked && inputPickDate && !btnApplyPicked.dataset.bound) {
    btnApplyPicked.addEventListener('click', () => {
      const v = inputPickDate.value; // 'YYYY-MM-DD'
      if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        setSelectedDate(v);
        switchView('dashboard');
      }
    });
    btnApplyPicked.dataset.bound = '1';
  }
}

function bootstrap() {
  resetIfRequested();
  initState();
  initNavHandlers();

  if (!VIEWS.includes(state.currentView)) {
    state.currentView = 'dashboard';
  }

  showOnly(state.currentView);

  if (state.currentView === 'dashboard') renderAll();
  if (state.currentView === 'schedule') renderScheduleEditor();
  if (state.currentView === 'calendar') renderCalendar();
}

bootstrap();
