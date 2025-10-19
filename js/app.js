// js/app.js
// Этап 3.1–3.7: роутер, шаблоны, редактор расписания, календарь, UX-полировка (без хоткеев)
//
// Стандарты: 2 пробела, строки ≤ 100, одинарные кавычки, малые функции, комментарии «зачем».
// Источники правил: Coding Standards v1.0 и «Структура директорий…» :contentReference[oaicite:4]{index=4} :contentReference[oaicite:5]{index=5}

'use strict';

/* ==============================
   Импорты модулей
   ============================== */

import { loadState, saveState } from './storage.js';
import { toDateKey, parseDateKey, getToday, getTomorrow, addDays } from './date.js';
import { computeTotals, etaFromNow } from './compute.js';
import { renderStats, renderTasks } from './ui.js';

/* ==============================
   Константы и селекторы
   ============================== */

const STATE_STORAGE_KEY = 'planner.state.v1';
const VIEWS = ['dashboard', 'schedule', 'calendar'];
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// Верхнее меню
const btnToday = document.querySelector('[data-action="today"]');
const btnSchedule = document.querySelector('[data-action="schedule"]');
const btnCalendar = document.querySelector('[data-action="calendar"]');

// Экраны
const viewDashboard = document.querySelector('[data-view="dashboard"]');
const viewSchedule = document.querySelector('[data-view="schedule"]');
const viewCalendar = document.querySelector('[data-view="calendar"]');

// Редактор расписания
const weekdaySwitch = document.querySelector('.weekday-switch');
const scheduleListEl = document.querySelector('[data-schedule-list]');
const btnAddRow = document.querySelector('[data-schedule-add]');
const btnSaveTpl = document.querySelector('[data-schedule-save]');
const btnApplyTemplate = document.querySelector('[data-apply-template]');
const elSchedCount = document.querySelector('[data-sched-count]');
const elSchedTotal = document.querySelector('[data-sched-total]');

// Календарь
const calPrevBtn = document.querySelector('[data-cal-prev]');
const calNextBtn = document.querySelector('[data-cal-next]');
const calLabelEl = document.querySelector('[data-cal-label]');
const calGridEl = document.querySelector('[data-cal-grid]');

// Toast
const toastEl = document.querySelector('[data-toast]');

/* ==============================
   Состояние
   ============================== */

let state = null;
let scheduleCurrentWeekday = 'mon';

// Текущая сетка календаря (год/месяц)
let calYear = null;
let calMonth = null;

/* ==============================
   Вспомогательные функции UI
   ============================== */

/** Показывает короткое всплывающее сообщение снизу. */
function showToast(message = '', ms = 1800) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.style.display = 'block';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.style.display = 'none';
  }, ms);
}

/** Подсвечивает активную вкладку в верхнем меню. */
function setActiveNav(viewName) {
  const map = { dashboard: btnToday, schedule: btnSchedule, calendar: btnCalendar };
  [btnToday, btnSchedule, btnCalendar].forEach((el) => {
    if (!el) return;
    el.classList.toggle('primary', el === map[viewName]);
  });
}

/* ==============================
   Данные дня (дашборд)
   ============================== */

/** Гарантирует существование блока дня в состоянии. */
function ensureDay(dateKey) {
  if (!state.days) state.days = {};
  if (!state.days[dateKey]) state.days[dateKey] = { tasks: [] };
}

/** Возвращает массив задач на день. */
function getTasksForDate(dateKey) {
  ensureDay(dateKey);
  const day = state.days[dateKey];
  return Array.isArray(day.tasks) ? day.tasks : (day.tasks = []);
}

/** Меняет выбранную дату (перерисовывает дашборд при необходимости). */
function setSelectedDate(dateKey) {
  const d = parseDateKey(dateKey);
  state.selectedDate = toDateKey(d);
  saveState(state);
  if (state.currentView === 'dashboard') renderAll();
}

/* ==============================
   Роутер
   ============================== */

/** Прячет все экраны и показывает выбранный. */
function showOnly(viewName) {
  [viewDashboard, viewSchedule, viewCalendar].forEach((el) => {
    if (el) el.hidden = true;
  });
  const map = { dashboard: viewDashboard, schedule: viewSchedule, calendar: viewCalendar };
  if (map[viewName]) map[viewName].hidden = false;
}

/** Переключает экран и запускает его рендер. */
function switchView(viewName) {
  if (!VIEWS.includes(viewName)) {
    console.warn('[planner] switchView: unknown view', viewName);
    return;
  }
  state.currentView = viewName;
  saveState(state);
  setActiveNav(viewName);
  showOnly(viewName);

  if (viewName === 'dashboard') renderAll();
  if (viewName === 'schedule') renderScheduleEditor();
  if (viewName === 'calendar') openCalendarForSelectedDate();
}

/* ==============================
   Seed для дашборда (демо-данные при пустоте)
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
    {
      id: makeId('m'),
      title: 'Математика: №1–5',
      minutesPlanned: 40,
      minutesDone: 0,
      isDone: false
    },
    {
      id: makeId('ph'),
      title: 'Физика: §8 конспект',
      minutesPlanned: 25,
      minutesDone: 0,
      isDone: false
    },
    {
      id: makeId('ru'),
      title: 'Русский: упр. 134 (1–3)',
      minutesPlanned: 20,
      minutesDone: 0,
      isDone: false
    }
  ];
}

/** Добавляет демо-данные в пустой день/пустое приложение. */
function robustSeedIfNeeded(dateKey) {
  const tasks = getTasksForDate(dateKey);
  const nothingHere = !Array.isArray(tasks) || tasks.length === 0;
  if (nothingHere || isGloballyEmpty(state)) {
    console.info('[planner] seed: demo tasks for', dateKey);
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

/** Обработчик переключателя «выполнено». */
function handleToggleTask(id, isDone) {
  const tasks = getTasksForDate(state.selectedDate);
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

/** Перерисовывает показатели и список задач. */
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
    sun: { tasks: [] }
  };
}

function ensureScheduleTemplates() {
  if (!state.scheduleTemplates || typeof state.scheduleTemplates !== 'object') {
    state.scheduleTemplates = makeEmptyScheduleTemplates();
    return;
  }
  const defaults = makeEmptyScheduleTemplates();
  for (const k of Object.keys(defaults)) {
    const ok = state.scheduleTemplates[k] && Array.isArray(state.scheduleTemplates[k].tasks);
    if (!ok) state.scheduleTemplates[k] = { tasks: [] };
  }
}

function normalizeTemplateTask(t) {
  if (!t || typeof t !== 'object') return { title: 'Задание', minutesPlanned: 0 };
  const title = String(t.title ?? '').trim() || 'Задание';
  const mp = Number.isFinite(+t.minutesPlanned) ? Math.max(0, Math.floor(+t.minutesPlanned)) : 0;
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
    isDone: false
  }));
  saveState(state);
}

/* ==============================
   3.3–3.7 — Редактор расписания (UI)
   ============================== */

/** Создаёт/находит баннер ошибок внизу экрана «Расписание». */
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

/** Показывает/скрывает сообщения об ошибках. */
function showErrors(messages = []) {
  const banner = ensureErrorBanner();
  if (!banner) return;
  const has = messages.length > 0;
  banner.style.display = has ? 'block' : 'none';
  banner.textContent = has ? messages.join(' · ') : '';
}

/** Подсвечивает поле ввода как невалидное. */
function markInvalid(input, invalid) {
  if (!input) return;
  input.classList.toggle('invalid', !!invalid);
}

/** Очищает ввод минут от нецифровых символов, нормализует в целое ≥ 0. */
function bindMinutesSanitizer(inputNumber) {
  if (!inputNumber || inputNumber.dataset.sanitizerBound) return;

  inputNumber.addEventListener('input', () => {
    inputNumber.value = String(inputNumber.value).replace(/[^\d]/g, '');
  });

  inputNumber.addEventListener('blur', () => {
    const n = Math.max(0, Math.floor(Number(inputNumber.value || 0)));
    inputNumber.value = String(n);
  });

  // UX: Enter в поле «мин» добавляет новую строку
  inputNumber.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && btnAddRow) {
      e.preventDefault();
      btnAddRow.click();
    }
  });

  inputNumber.dataset.sanitizerBound = '1';
}

/** Рисует строки редактирования для выбранного дня недели. */
function renderScheduleRows(weekday) {
  if (!scheduleListEl) return;
  scheduleListEl.innerHTML = '';

  const tpl = getTemplate(weekday);
  if (tpl.length === 0) tpl.push({ title: '', minutesPlanned: 0 });

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

/** Проверяет одну строку и возвращает нормализованные данные/ошибки. */
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

/** Собирает и валидирует все строки редактора. */
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

/** Считает «N строк • M мин» и выводит снизу редактора. */
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

/** Подсветка активной кнопки дня недели. */
function highlightActiveWeekday() {
  if (!weekdaySwitch) return;
  const buttons = weekdaySwitch.querySelectorAll('button[data-weekday]');
  buttons.forEach((b) => {
    b.classList.toggle('active', b.dataset.weekday === scheduleCurrentWeekday);
  });
}

/** Полный рендер и биндинг редактора расписания. */
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
        console.info('[planner] schedule: template saved for', scheduleCurrentWeekday);
      } else {
        console.warn('[planner] schedule: nothing to save (invalid/empty)');
      }
    });
    btnSaveTpl.dataset.bound = '1';
  }

  if (btnApplyTemplate && !btnApplyTemplate.dataset.bound) {
    btnApplyTemplate.addEventListener('click', () => {
      // Валидация перед применением
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
        ok = window.confirm(
          'Переписать задачи выбранной даты по шаблону? Текущее содержимое будет заменено.'
        );
      }
      if (!ok) return;

      setTemplate(scheduleCurrentWeekday, validTasks);
      applyTemplateToDate(scheduleCurrentWeekday, dateKey);

      showToast('Шаблон применён к выбранной дате');
      console.info('[planner] schedule: template applied to', dateKey);
      switchView('dashboard');
    });
    btnApplyTemplate.dataset.bound = '1';
  }

  // Живой пересчёт summary при вводе
  if (!scheduleListEl.dataset.summaryBound) {
    scheduleListEl.addEventListener('input', (e) => {
      if (e.target && e.target.tagName === 'INPUT') updateScheduleSummary();
    });
    scheduleListEl.dataset.summaryBound = '1';
  }
}

/* ==============================
   3.5 — Календарь
   ============================== */

function weekdayMonFirst(date) {
  const js = date.getDay(); // 0..6, 0 = Вс
  return js === 0 ? 7 : js; // 1..7, 1 = Пн
}

/** Перерисовывает сетку календаря для выбранного месяца. */
function renderCalendar() {
  if (!calGridEl || calYear == null || calMonth == null) return;

  const label = new Date(calYear, calMonth, 1).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long'
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
    const key = toDateKey(d);

    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    if (d.getMonth() !== calMonth) cell.classList.add('outside');
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

/** Открывает календарь на месяце выбранной даты. */
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

/** Сброс состояния через параметр ?reset=1. */
function resetIfRequested() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('reset') === '1') {
    console.info('[planner] reset via ?reset=1');
    try {
      localStorage.removeItem(STATE_STORAGE_KEY);
    } catch (e) {
      console.error('[planner] reset failed:', e);
    }
  }
}

/** Создаёт начальное состояние приложения. */
function initState() {
  const defaults = {
    selectedDate: null,
    days: {},
    currentView: 'dashboard',
    scheduleTemplates: makeEmptyScheduleTemplates()
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

/** Навигация верхнего меню. */
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

/** Точка входа. */
function bootstrap() {
  resetIfRequested();
  initState();
  initNavHandlers();

  if (!VIEWS.includes(state.currentView)) state.currentView = 'dashboard';

  setActiveNav(state.currentView);
  showOnly(state.currentView);

  if (state.currentView === 'dashboard') renderAll();
  if (state.currentView === 'schedule') renderScheduleEditor();
  if (state.currentView === 'calendar') openCalendarForSelectedDate();
}

bootstrap();
