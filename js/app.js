// js/app.js
// Этап 3.1: мини-роутер (dashboard / schedule / calendar)
// Этап 3.2: шаблоны расписания
// Этап 3.3: UI редактора расписания
// Этап 3.4: применение шаблона к дате
// Этап 3.5: календарь — сетка месяца
// Этап 3.6: валидации в редакторе расписания
// Этап 3.7: UX-полировка (toast, confirm overwrite, счётчик строк/минут, активные кнопки)

'use strict';

/* ==============================
   Импорты модулей
   ============================== */

import { loadState, saveState } from './storage.js';
import { toDateKey, parseDateKey, getToday, getTomorrow, addDays } from './date.js';
import { computeTotals, etaFromNow } from './compute.js';
import { renderStats, renderTasks } from './ui.js';

/* ==============================
   Константы
   ============================== */

const STATE_STORAGE_KEY = 'planner.state.v1';
const VIEWS = ['dashboard', 'schedule', 'calendar'];
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

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
const elSchedCount = document.querySelector('[data-sched-count]');
const elSchedTotal = document.querySelector('[data-sched-total]');

// Calendar UI
const calPrevBtn  = document.querySelector('[data-cal-prev]');
const calNextBtn  = document.querySelector('[data-cal-next]');
const calLabelEl  = document.querySelector('[data-cal-label]');
const calGridEl   = document.querySelector('[data-cal-grid]');

// Toast
const toastEl = document.querySelector('[data-toast]');

/* ==============================
   Состояние
   ============================== */

let state = null;
let scheduleCurrentWeekday = 'mon';

let calYear  = null;
let calMonth = null;

/* ==============================
   Утилиты UX
   ============================== */

function showToast(message = '', ms = 1800) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.style.display = 'block';
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => {
    toastEl.style.display = 'none';
  }, ms);
}

function setActiveNav(viewName) {
  const map = {
    dashboard: btnToday,
    schedule: btnSchedule,
    calendar: btnCalendar,
  };
  for (const el of [btnToday, btnSchedule, btnCalendar]) {
    if (!el) continue;
    if (el === map[viewName]) el.classList.add('primary');
    else el.classList.remove('primary');
  }
}

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
  setActiveNav(viewName);
  showOnly(viewName);

  if (viewName === 'dashboard') {
    renderAll();
  } else if (viewName === 'schedule') {
    renderScheduleEditor();
  } else if (viewName === 'calendar') {
    openCalendarForSelectedDate();
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
   3.2 — Шаблоны расписания (state)
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
   3.3–3.7 — UI редактора расписания
   ============================== */

function ensureErrorBanner() {
  if (!viewSchedule) return null;
  let banner = viewSchedule.querySelector('[data-schedule-errors]');
  if (!banner) {
    banner = document.createElement('div');
    banner.dataset.scheduleErrors = '';
    banner.className = 'schedule-errors muted small';
    banner.style.display = 'none';
    viewSchedule.appendChild(banner);
  }
  return banner;
}

function showErrors(messages = []) {
  const banner = ensureErrorBanner();
  if (!banner) return;
  if (!messages.length) {
    banner.style.display = 'none';
    banner.textContent = '';
    return;
  }
  banner.style.display = 'block';
  banner.textContent = messages.join(' · ');
}

function markInvalid(input, invalid) {
  if (!input) return;
  if (invalid) input.classList.add('invalid');
  else input.classList.remove('invalid');
}

function bindMinutesSanitizer(inputNumber) {
  if (!inputNumber || inputNumber.dataset.sanitizerBound) return;
  inputNumber.addEventListener('input', () => {
    const digits = String(inputNumber.value).replace(/[^\d]/g, '');
    inputNumber.value = digits;
  });
  inputNumber.addEventListener('blur', () => {
    const n = Math.max(0, Math.floor(Number(inputNumber.value || 0)));
    inputNumber.value = String(n);
  });
  inputNumber.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && btnAddRow) {
      e.preventDefault();
      btnAddRow.click();
    }
  });
  inputNumber.dataset.sanitizerBound = '1';
}

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

    bindMinutesSanitizer(inputMinutes);

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn';
    btnDel.textContent = 'Удалить';
    btnDel.addEventListener('click', () => {
      row.remove();
      updateScheduleSummary();
    });

    actions.appendChild(btnDel);
    row.append(inputTitle, inputMinutes, actions);
    scheduleListEl.appendChild(row);
  }

  showErrors([]);
  updateScheduleSummary();
}

function validateRow(row) {
  const [inputTitle, inputMinutes] = row.querySelectorAll('input');
  const title = String(inputTitle?.value ?? '').trim();
  const minutes = Math.max(0, Math.floor(Number(inputMinutes?.value ?? 0)));
  const errs = [];

  if (!title) errs.push('пустое название');
  if (!Number.isFinite(minutes) || minutes < 0) errs.push('минуты некорректны');

  markInvalid(inputTitle, !title);
  markInvalid(inputMinutes, !Number.isFinite(minutes) || minutes < 0);

  return { ok: errs.length === 0, title, minutes, errors: errs };
}

function collectAndValidateTemplate() {
  const rows = Array.from(scheduleListEl?.querySelectorAll('.schedule-row') || []);
  const validTasks = [];
  const messages = [];

  if (!rows.length) {
    messages.push('нет строк для сохранения');
    return { validTasks, messages };
  }

  rows.forEach((row, idx) => {
    const res = validateRow(row);
    if (res.ok) {
      validTasks.push({ title: res.title, minutesPlanned: res.minutes });
    } else {
      messages.push(`строка ${idx + 1}: ${res.errors.join(', ')}`);
    }
  });

  if (validTasks.length === 0) {
    messages.push('все строки пустые — укажите название или минуты');
  }

  return { validTasks, messages };
}

/* — счётчик строк и сумма минут (UX 3.7) — */
function updateScheduleSummary() {
  const rows = Array.from(scheduleListEl?.querySelectorAll('.schedule-row') || []);
  let count = 0;
  let total = 0;
  for (const r of rows) {
    const [inputTitle, inputMinutes] = r.querySelectorAll('input');
    const title = String(inputTitle?.value ?? '').trim();
    const minutes = Math.max(0, Math.floor(Number(inputMinutes?.value ?? 0)));
    if (title || minutes > 0) {
      count += 1;
      total += minutes;
    }
  }
  if (elSchedCount) elSchedCount.textContent = `${count} строк`;
  if (elSchedTotal) elSchedTotal.textContent = `${total} мин`;
}

function highlightActiveWeekday() {
  if (!weekdaySwitch) return;
  const buttons = weekdaySwitch.querySelectorAll('button[data-weekday]');
  buttons.forEach((b) => {
    if (b.dataset.weekday === scheduleCurrentWeekday) b.classList.add('active');
    else b.classList.remove('active');
  });
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

      bindMinutesSanitizer(inputMinutes);

      const actions = document.createElement('div');
      actions.className = 'row-actions';

      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn';
      btnDel.textContent = 'Удалить';
      btnDel.addEventListener('click', () => {
        row.remove();
        updateScheduleSummary();
      });

      actions.appendChild(btnDel);
      row.append(inputTitle, inputMinutes, actions);
      scheduleListEl.appendChild(row);

      inputTitle.focus();
      showErrors([]);
      updateScheduleSummary();
    });
    btnAddRow.dataset.bound = '1';
  }

  if (btnSaveTpl && !btnSaveTpl.dataset.bound) {
    btnSaveTpl.addEventListener('click', () => {
      const { validTasks, messages } = collectAndValidateTemplate();
      if (messages.length) {
        showErrors(messages);
        showToast('Проверь поля — есть ошибки');
      } else {
        showErrors([]);
      }

      if (validTasks.length > 0) {
        setTemplate(scheduleCurrentWeekday, validTasks);
        showToast('Шаблон сохранён');
        console.info('[planner] schedule: template saved for', scheduleCurrentWeekday, validTasks);
      } else {
        console.warn('[planner] schedule: nothing to save (invalid/empty)');
      }
    });
    btnSaveTpl.dataset.bound = '1';
  }

  if (btnApplyTemplate && !btnApplyTemplate.dataset.bound) {
    btnApplyTemplate.addEventListener('click', () => {
      const { validTasks, messages } = collectAndValidateTemplate();
      if (messages.length) {
        showErrors(messages);
        showToast('Не могу применить — есть ошибки');
        return;
      }
      if (validTasks.length === 0) {
        showToast('Шаблон пустой');
        return;
      }

      // Подтверждение, если в выбранной дате уже есть задачи
      const dateKey = state.selectedDate;
      const existing = getTasksForDate(dateKey);
      const hasData = Array.isArray(existing) && existing.length > 0;
      let ok = true;
      if (hasData) {
        ok = window.confirm('Переписать задачи выбранной даты по шаблону? Текущее содержимое будет заменено.');
      }
      if (!ok) return;

      // Сохраним шаблон и применим
      setTemplate(scheduleCurrentWeekday, validTasks);
      applyTemplateToDate(scheduleCurrentWeekday, dateKey);

      showToast('Шаблон применён к выбранной дате');
      console.info('[planner] schedule: template applied to', dateKey, 'from', scheduleCurrentWeekday);
      switchView('dashboard');
    });
    btnApplyTemplate.dataset.bound = '1';
  }

  // live-пересчёт summary при вводе
  if (!scheduleListEl.dataset.summaryBound) {
    scheduleListEl.addEventListener('input', (e) => {
      if (e.target && e.target.tagName === 'INPUT') {
        updateScheduleSummary();
      }
    });
    scheduleListEl.dataset.summaryBound = '1';
  }
}

/* ==============================
   3.5 — Календарь: сетка месяца
   ============================== */

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function weekdayMonFirst(date) {
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

function renderCalendar() {
  if (!calGridEl || calYear == null || calMonth == null) return;

  const label = new Date(calYear, calMonth, 1).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });
  if (calLabelEl) calLabelEl.textContent = label;

  const selectedKey = state.selectedDate;
  const todayKey = toDateKey(getToday());

  const firstDay = new Date(calYear, calMonth, 1);
  const firstWeekday = weekdayMonFirst(firstDay);
  const leading = firstWeekday - 1;
  const totalCells = 42;

  const startDate = new Date(calYear, calMonth, 1 - leading);

  calGridEl.innerHTML = '';

  for (let i = 0; i < totalCells; i++) {
    const d = addDays(startDate, i);
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';

    const inCurrentMonth = d.getMonth() === calMonth;
    if (!inCurrentMonth) cell.classList.add('outside');

    const key = toDateKey(d);
    if (key === todayKey) cell.classList.add('today');
    if (key === selectedKey) cell.classList.add('selected');

    cell.textContent = String(d.getDate());
    cell.addEventListener('click', () => {
      setSelectedDate(key);
      switchView('dashboard');
    });

    calGridEl.appendChild(cell);
  }
}

function openCalendarForSelectedDate() {
  const base = parseDateKey(state.selectedDate ?? toDateKey(getToday()));
  calYear = base.getFullYear();
  calMonth = base.getMonth();
  renderCalendar();

  if (calPrevBtn && !calPrevBtn.dataset.bound) {
    calPrevBtn.addEventListener('click', () => {
      if (calMonth === 0) {
        calMonth = 11;
        calYear -= 1;
      } else {
        calMonth -= 1;
      }
      renderCalendar();
    });
    calPrevBtn.dataset.bound = '1';
  }

  if (calNextBtn && !calNextBtn.dataset.bound) {
    calNextBtn.addEventListener('click', () => {
      if (calMonth === 11) {
        calMonth = 0;
        calYear += 1;
      } else {
        calMonth += 1;
      }
      renderCalendar();
    });
    calNextBtn.dataset.bound = '1';
  }
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
}

function bootstrap() {
  resetIfRequested();
  initState();
  initNavHandlers();

  if (!VIEWS.includes(state.currentView)) {
    state.currentView = 'dashboard';
  }

  setActiveNav(state.currentView);
  showOnly(state.currentView);

  if (state.currentView === 'dashboard') renderAll();
  if (state.currentView === 'schedule') renderScheduleEditor();
  if (state.currentView === 'calendar') openCalendarForSelectedDate();
}

bootstrap();
