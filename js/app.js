// js/app.js
// Контроллер/оркестратор: state, роутинг, бизнес-логика.
// Этап 4: правка/удаление задач. Исправлено: устойчивый inline-редактор через editingTaskId.
// D+1 логика сохранена.
'use strict';

/* ==============================
   Импорты модулей
   ============================== */

import { loadState, saveState } from './storage.js';
import { toDateKey, parseDateKey, getToday, getTomorrow, addDays } from './date.js';
import { computeTotals, etaFromNow } from './compute.js';
import { renderStats, renderTasks, scheduleUI, calendarUI } from './ui.js';

/* ==============================
   Константы и селекторы
   ============================== */

const STATE_STORAGE_KEY = 'planner.state.v1';
const DEVICE_STORAGE_KEY = 'planner.deviceId';
const VIEWS = ['dashboard', 'schedule', 'calendar'];

const btnToday = document.querySelector('[data-action="today"]');
const btnSchedule = document.querySelector('[data-action="schedule"]');
const btnCalendar = document.querySelector('[data-action="calendar"]');

const viewDashboard = document.querySelector('[data-view="dashboard"]');
const viewSchedule  = document.querySelector('[data-view="schedule"]');
const viewCalendar  = document.querySelector('[data-view="calendar"]');

// Toast
const toastEl = document.querySelector('[data-toast]');

/* ==============================
   Состояние
   ============================== */

let state = null;
let scheduleCurrentWeekday = 'mon';
let calYear  = null;
let calMonth = null;
let editingTaskId = null; // <-- текущая редактируемая задача (устойчивый inline)

/* ==============================
   Helpers (UI)
   ============================== */

function showToast(message = '', ms = 1800) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.style.display = 'block';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toastEl.style.display = 'none'), ms);
}

function setActiveNav(viewName) {
  const map = { dashboard: btnToday, schedule: btnSchedule, calendar: btnCalendar };
  [btnToday, btnSchedule, btnCalendar].forEach((el) => {
    if (!el) return;
    el.classList.toggle('primary', el === map[viewName]);
  });
}

/* ==============================
   DeviceId (для meta.deviceId)
   ============================== */

function makeId(prefix = 't') {
  const rnd = Math.floor(Math.random() * 1e6);
  return `${prefix}_${Date.now().toString(36)}_${rnd.toString(36)}`;
}

function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!id) {
      id = makeId('dev');
      localStorage.setItem(DEVICE_STORAGE_KEY, id);
    }
    return id;
  } catch {
    // fallback без localStorage
    return 'dev_fallback';
  }
}

/* ==============================
   Данные дня
   ============================== */

function ensureDay(dateKey) {
  if (!state.days) state.days = {};
  if (!state.days[dateKey]) {
    state.days[dateKey] = { tasks: [], meta: { note: '' } }; // Day.meta (задел под заметку)
  } else if (!state.days[dateKey].meta) {
    state.days[dateKey].meta = { note: '' };
  }
}

function getTasksForDate(dateKey) {
  ensureDay(dateKey);
  const day = state.days[dateKey];
  return Array.isArray(day.tasks) ? day.tasks : (day.tasks = []);
}

function setSelectedDate(dateKey) {
  const d = parseDateKey(dateKey);
  state.selectedDate = toDateKey(d);
  editingTaskId = null; // при смене даты выходим из редактирования
  saveState(state);
  if (state.currentView === 'dashboard') renderAll();
}

/* ==============================
   Роутер
   ============================== */

function showOnly(viewName) {
  [viewDashboard, viewSchedule, viewCalendar].forEach((el) => el && (el.hidden = true));
  const map = { dashboard: viewDashboard, schedule: viewSchedule, calendar: viewCalendar };
  if (map[viewName]) map[viewName].hidden = false;
}

function switchView(viewName) {
  if (!VIEWS.includes(viewName)) {
    console.warn('[planner] switchView: unknown view', viewName);
    return;
  }
  state.currentView = viewName;
  editingTaskId = null; // при смене вью — сбрасываем редактирование
  saveState(state);
  setActiveNav(viewName);
  showOnly(viewName);

  if (viewName === 'dashboard') renderAll();
  if (viewName === 'schedule') renderScheduleEditor();
  if (viewName === 'calendar') openCalendarForSelectedDate();
}

/* ==============================
   Шаблоны расписания
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

function getTemplate(weekdayKey) {
  ensureScheduleTemplates();
  const day = state.scheduleTemplates[weekdayKey];
  const arr = Array.isArray(day?.tasks) ? day.tasks : [];
  return arr.map(normalizeTemplateTask);
}

function setTemplate(weekdayKey, tasks) {
  ensureScheduleTemplates();
  const safe = Array.isArray(tasks) ? tasks.map(normalizeTemplateTask) : [];
  state.scheduleTemplates[weekdayKey] = { tasks: safe };
  saveState(state);
}

/** Применяет шаблон (копией) в конкретную дату — «материализует» задачи (D+1 используется в getEffectiveTasks). */
function applyTemplateToDate(weekdayKey, dateKey) {
  ensureDay(dateKey);
  const tpl = getTemplate(weekdayKey);
  const nowISO = new Date().toISOString();
  const deviceId = getDeviceId();
  state.days[dateKey].tasks = tpl.map((t, idx) => ({
    id: makeId('x'),
    title: t.title,
    minutesPlanned: t.minutesPlanned,
    donePercent: 0,
    isDone: false,
    sortIndex: idx,
    meta: {
      updatedAt: nowISO,
      userAction: 'created',
      deviceId
    }
  }));
  saveState(state);
}

/* ==============================
   Эффективные задачи дня (D+1)
   ============================== */

function getEffectiveTasks(dateKey) {
  const own = getTasksForDate(dateKey);
  if (Array.isArray(own) && own.length > 0) return own;

  // D+1: шаблон следующего календарного дня
  const d = parseDateKey(dateKey);
  const dPlus1 = addDays(d, 1);
  const jsDay = dPlus1.getDay(); // 0..6, 0=Вс
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const weekdayKey = map[jsDay];

  const tpl = getTemplate(weekdayKey);
  return tpl.map((t, idx) => ({
    id: `virt_${weekdayKey}_${idx}`,
    title: t.title,
    minutesPlanned: t.minutesPlanned,
    donePercent: 0,
    isDone: false,
    _virtual: true,
    _weekdayKey: weekdayKey
  }));
}

/* ==============================
   Дашборд
   ============================== */

function makeDayLabel(dateKey) {
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

function handleToggleTask(id, isDone) {
  const dateKey = state.selectedDate;
  let tasks = getTasksForDate(dateKey);
  const nowISO = new Date().toISOString();
  const deviceId = getDeviceId();

  // Материализовано — меняем сразу
  if (tasks.length > 0) {
    for (const t of tasks) {
      if (t.id === id) {
        t.isDone = !!isDone;
        t.donePercent = t.isDone ? 100 : 0;
        if (!t.meta || typeof t.meta !== 'object') t.meta = {};
        t.meta.updatedAt = nowISO;
        t.meta.userAction = 'edited';
        t.meta.deviceId = deviceId;
        break;
      }
    }
    saveState(state);
    renderAll();
    return;
  }

  // Виртуальная — материализуем D+1 и повторяем
  const effective = getEffectiveTasks(dateKey);
  const target = effective.find((t) => t.id === id);
  if (target && target._virtual) {
    applyTemplateToDate(target._weekdayKey, dateKey);
    tasks = getTasksForDate(dateKey);
    const real = tasks.find((t) => t.title === target.title && t.minutesPlanned === target.minutesPlanned);
    if (real) {
      real.isDone = !!isDone;
      real.donePercent = real.isDone ? 100 : 0;
      if (!real.meta || typeof real.meta !== 'object') real.meta = {};
      real.meta.updatedAt = nowISO;
      real.meta.userAction = 'edited';
      real.meta.deviceId = deviceId;
      saveState(state);
    }
    renderAll();
  }
}

function handleBumpPercent(id, delta) {
  const dateKey = state.selectedDate;
  let tasks = getTasksForDate(dateKey);
  const nowISO = new Date().toISOString();
  const deviceId = getDeviceId();

  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

  // Материализовано — правим сразу
  if (tasks.length > 0) {
    const t = tasks.find(x => x.id === id);
    if (t) {
      const next = clamp((t.donePercent ?? 0) + Number(delta || 0));
      t.donePercent = next;
      t.isDone = next >= 100;
      if (!t.meta || typeof t.meta !== 'object') t.meta = {};
      t.meta.updatedAt = nowISO;
      t.meta.userAction = 'edited';
      t.meta.deviceId = deviceId;
      saveState(state);
      renderAll();
      return;
    }
  }

  // Виртуальная — материализуем D+1 и правим
  const effective = getEffectiveTasks(dateKey);
  const target = effective.find((t) => t.id === id);
  if (target && target._virtual) {
    applyTemplateToDate(target._weekdayKey, dateKey);
    tasks = getTasksForDate(dateKey);
    const real = tasks.find((t) => t.title === target.title && t.minutesPlanned === target.minutesPlanned);
    if (real) {
      const next = clamp((real.donePercent ?? 0) + Number(delta || 0));
      real.donePercent = next;
      real.isDone = next >= 100;
      if (!real.meta || typeof real.meta !== 'object') real.meta = {};
      real.meta.updatedAt = nowISO;
      real.meta.userAction = 'edited';
      real.meta.deviceId = deviceId;
      saveState(state);
    }
    renderAll();
  }
}

function renderAll() {
  const dateKey = state.selectedDate;
  const tasksEff = getEffectiveTasks(dateKey);
  const totals = computeTotals(tasksEff);
  const eta = etaFromNow(tasksEff);

  renderStats(totals, eta);
  renderTasks(
    tasksEff,
    {
      onToggle: handleToggleTask,
      onBump: handleBumpPercent,
      onEditStart: handleEditStart,
      onEditSave: handleEditSave,
      onEditCancel: () => { editingTaskId = null; renderAll(); },
      onDelete: handleDeleteTask
    },
    makeDayLabel(dateKey),
    { editingId: editingTaskId } // <-- сообщаем вью, какую карточку рисовать в режиме редактирования
  );
}

/* ==============================
   Этап 4 — Правка/удаление
   ============================== */

/** Начало редактирования: если день виртуальный — материализуем D+1, затем устанавливаем editingTaskId и перерисовываем. */
function handleEditStart(id) {
  const dateKey = state.selectedDate;
  let tasks = getTasksForDate(dateKey);

  if (tasks.length > 0) {
    // уже материализовано — просто зафиксируем, что редактируем этот id
    editingTaskId = id;
    renderAll();
    return;
  }

  // материализуем D+1, найдём реальный id по (title, minutesPlanned)
  const effective = getEffectiveTasks(dateKey);
  const target = effective.find((t) => t.id === id);
  if (target && target._virtual) {
    applyTemplateToDate(target._weekdayKey, dateKey);
    tasks = getTasksForDate(dateKey);
    const real = tasks.find((t) => t.title === target.title && t.minutesPlanned === target.minutesPlanned);
    editingTaskId = real ? real.id : null;
    renderAll();
  }
}

/** Сохранение правок: title, minutesPlanned */
function handleEditSave(id, payload) {
  const { title, minutesPlanned } = payload || {};
  const dateKey = state.selectedDate;
  let tasks = getTasksForDate(dateKey);
  const nowISO = new Date().toISOString();
  const deviceId = getDeviceId();

  if (tasks.length === 0) {
    // если всё ещё виртуально — материализуем D+1
    const eff = getEffectiveTasks(dateKey);
    const t = eff.find((x) => x.id === id);
    if (t && t._virtual) {
      applyTemplateToDate(t._weekdayKey, dateKey);
      tasks = getTasksForDate(dateKey);
      const real = tasks.find((x) => x.title === t.title && x.minutesPlanned === t.minutesPlanned);
      if (real) id = real.id;
    }
  }

  const real = tasks.find((t) => t.id === id);
  if (real) {
    real.title = String(title ?? '').trim();
    real.minutesPlanned = Math.max(0, Math.floor(Number(minutesPlanned ?? 0)));
    if (!real.meta || typeof real.meta !== 'object') real.meta = {};
    real.meta.updatedAt = nowISO;
    real.meta.userAction = 'edited';
    real.meta.deviceId = deviceId;
    saveState(state);
  }
  editingTaskId = null; // закрываем редактор
  renderAll();
}

/** Удаление задачи. Если после удаления список пуст — удаляем весь день из state.days */
function handleDeleteTask(id) {
  const dateKey = state.selectedDate;
  let tasks = getTasksForDate(dateKey);
  const deviceId = getDeviceId();

  if (tasks.length === 0) {
    // материализуем D+1, чтобы появилась коллекция для удаления
    const eff = getEffectiveTasks(dateKey);
    const t = eff.find((x) => x.id === id);
    if (t && t._virtual) {
      applyTemplateToDate(t._weekdayKey, dateKey);
      tasks = getTasksForDate(dateKey);
      const real = tasks.find((x) => x.title === t.title && x.minutesPlanned === t.minutesPlanned);
      if (real) id = real.id;
    }
  }

  const idx = tasks.findIndex((t) => t.id === id);
  if (idx !== -1) {
    // обновим мету перед удалением (для консистентности)
    const nowISO = new Date().toISOString();
    tasks[idx].meta = { ...(tasks[idx].meta || {}), updatedAt: nowISO, userAction: 'deleted', deviceId };

    tasks.splice(idx, 1);
    // если список пуст — удаляем ключ дня полностью
    if (tasks.length === 0) {
      delete state.days[dateKey];
    }
    saveState(state);
  }
  editingTaskId = null; // на всякий
  renderAll();
}

/* ==============================
   Редактор расписания — оркестрация (DOM в ui.scheduleUI)
   ============================== */

function validateRow(row) {
  const [inputTitle, inputMinutes] = row.querySelectorAll('input');
  const title = String(inputTitle?.value ?? '').trim();
  const minutes = Math.max(0, Math.floor(Number(inputMinutes?.value ?? 0)));
  const errs = [];

  if (!title) errs.push('пустое название');
  if (!Number.isFinite(minutes) || minutes < 0) errs.push('минуты некорректны');

  if (inputTitle) inputTitle.classList.toggle('invalid', !title);
  if (inputMinutes) inputMinutes.classList.toggle('invalid', !Number.isFinite(minutes) || minutes < 0);

  return { ok: errs.length === 0, title, minutes, errors: errs };
}

function collectAndValidateTemplate() {
  const scheduleListEl = document.querySelector('[data-schedule-list]');
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

function renderScheduleEditor() {
  if (!viewSchedule) return;

  ensureScheduleTemplates();

  scheduleUI.bindHeader({
    onWeekdayPick: (wd) => {
      scheduleCurrentWeekday = wd;
      const rows = getTemplate(scheduleCurrentWeekday);
      scheduleUI.renderRows(rows);
      scheduleUI.updateSummary();
      scheduleUI.showErrors([]);
    },
    onAddRow: () => {
      scheduleUI.addEmptyRow();
      scheduleUI.updateSummary();
      scheduleUI.showErrors([]);
    },
    onSaveTpl: () => {
      const { validTasks, messages } = collectAndValidateTemplate();
      if (messages.length) {
        scheduleUI.showErrors(messages);
        showToast('Проверь поля — есть ошибки');
      } else {
        scheduleUI.showErrors([]);
      }
      if (validTasks.length > 0) {
        setTemplate(scheduleCurrentWeekday, validTasks);
        showToast('Шаблон сохранён');
        console.info('[planner] schedule: template saved for', scheduleCurrentWeekday);
      }
    },
    onApplyTpl: () => {
      const { validTasks, messages } = collectAndValidateTemplate();
      if (messages.length) {
        scheduleUI.showErrors(messages);
        showToast('Не могу применить — есть ошибки');
        return;
      }
      if (validTasks.length === 0) {
        showToast('Шаблон пустой');
        return;
      }
      const dateKey = state.selectedDate;
      const existing = getTasksForDate(dateKey);
      const hasData = Array.isArray(existing) && existing.length > 0;
      let ok = true;
      if (hasData) {
        ok = window.confirm('Переписать задачи выбранной даты по шаблону? Текущее содержимое будет заменено.');
      }
      if (!ok) return;

      setTemplate(scheduleCurrentWeekday, validTasks);
      applyTemplateToDate(scheduleCurrentWeekday, dateKey);

      showToast('Шаблон применён к выбранной дате');
      console.info('[planner] schedule: template applied to', dateKey);
      switchView('dashboard');
    }
  });

  const rows = getTemplate(scheduleCurrentWeekday);
  scheduleUI.renderRows(rows);
  scheduleUI.updateSummary();
  scheduleUI.showErrors([]);
}

/* ==============================
   Календарь — оркестрация (DOM в ui.calendarUI)
   ============================== */

function renderCalendar() {
  if (calYear == null || calMonth == null) return;

  const label = new Date(calYear, calMonth, 1).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long'
  });
  calendarUI.setLabel(label);

  const selectedKey = state.selectedDate;
  const todayKey = toDateKey(getToday());

  calendarUI.drawGrid(
    { year: calYear, month: calMonth, selectedKey, todayKey },
    {
      onSelectDate: (dateKey) => {
        setSelectedDate(dateKey);
        switchView('dashboard');
      }
    }
  );
}

function openCalendarForSelectedDate() {
  const base = parseDateKey(state.selectedDate ?? toDateKey(getToday()));
  calYear = base.getFullYear();
  calMonth = base.getMonth();
  renderCalendar();

  calendarUI.bindNav({
    onPrev: () => {
      if (calMonth === 0) { calMonth = 11; calYear -= 1; }
      else { calMonth -= 1; }
      renderCalendar();
    },
    onNext: () => {
      if (calMonth === 11) { calMonth = 0; calYear += 1; }
      else { calMonth += 1; }
      renderCalendar();
    }
  });
}

/* ==============================
   Инициализация
   ============================== */

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

  ensureScheduleTemplates();
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

  setActiveNav(state.currentView);
  showOnly(state.currentView);

  if (state.currentView === 'dashboard') renderAll();
  if (state.currentView === 'schedule') renderScheduleEditor();
  if (state.currentView === 'calendar') openCalendarForSelectedDate();
}

bootstrap();
