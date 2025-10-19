// js/app.js
// Точка входа «Лёшин планировщик».
// Связываем: storage -> date -> compute -> ui + добавляем seed-данные при пустом состоянии.

'use strict';

/* ==============================
   Импорты модулей (логика)
   ============================== */

import { loadState, saveState } from './storage.js';
import { toDateKey, parseDateKey, getToday, getTomorrow } from './date.js';
import { computeTotals, etaFromNow } from './compute.js';
import { renderStats, renderTasks } from './ui.js';

/* ==============================
   Базовые переменные приложения
   ============================== */

// Состояние приложения (в LocalStorage лежит объект { selectedDate, days })
let state = null;

// Селекторы навигационных кнопок (пока стабы обработчиков)
const btnToday = document.querySelector('[data-action="today"]');
const btnSchedule = document.querySelector('[data-action="schedule"]');
const btnCalendar = document.querySelector('[data-action="calendar"]');

/* ==============================
   Вспомогательные функции состояния
   ============================== */

/**
 * Гарантирует, что в state.days есть запись для данной даты.
 */
function ensureDay(dateKey) {
  if (!state.days) state.days = {};
  if (!state.days[dateKey]) {
    state.days[dateKey] = { tasks: [] };
  }
}

/**
 * Получить массив задач для ключа даты (всегда массив).
 */
function getTasksForDate(dateKey) {
  ensureDay(dateKey);
  const day = state.days[dateKey];
  return Array.isArray(day.tasks) ? day.tasks : (day.tasks = []);
}

/**
 * Установить выбранную дату и перерисовать экран.
 */
function setSelectedDate(dateKey) {
  const d = parseDateKey(dateKey); // нормализуем к локальной полуночи
  const normalizedKey = toDateKey(d);

  state.selectedDate = normalizedKey;
  saveState(state);
  renderAll();
}

/* ==============================
   Seed-данные (2.6)
   ============================== */

/**
 * Простой генератор id — достаточно уникален для демо-задач.
 */
function makeId(prefix = 't') {
  const rnd = Math.floor(Math.random() * 1e6);
  return `${prefix}_${Date.now().toString(36)}_${rnd.toString(36)}`;
}

/**
 * Если у выбранной даты нет задач — создаём пару «учебных» заданий.
 * Делаем это только один раз (при первом запуске), чтобы у пользователя
 * сразу был виден рабочий UI.
 */
function seedIfEmpty(dateKey) {
  const tasks = getTasksForDate(dateKey);
  if (tasks.length > 0) return; // уже что-то есть — не трогаем

  state.days[dateKey].tasks = [
    {
      id: makeId('m'),
      title: 'Математика: решить №1–5 из параграфа 12',
      minutesPlanned: 40,
      minutesDone: 0,
      isDone: false,
    },
    {
      id: makeId('ph'),
      title: 'Физика: прочитать §8 и сделать конспект',
      minutesPlanned: 25,
      minutesDone: 0,
      isDone: false,
    },
    {
      id: makeId('ru'),
      title: 'Русский: упражнение 134 (1–3)',
      minutesPlanned: 20,
      minutesDone: 0,
      isDone: false,
    },
  ];

  saveState(state);
}

/* ==============================
   Рендер всего экрана
   ============================== */

/**
 * Возвращает человекочитаемую подпись дня (например, "понедельник, 20 октября").
 */
function makeDayLabel(dateKey) {
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Обработчик переключения чекбоксов задач.
 */
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
        t.minutesDone = planned; // считаем «выполнено на 100%»
      }
      break;
    }
  }

  saveState(state);
  renderAll(); // пересчёт метрик и обновление UI
}

/**
 * Главная функция рендера дашборда.
 */
function renderAll() {
  const dateKey = state.selectedDate;
  const tasks = getTasksForDate(dateKey);

  const totals = computeTotals(tasks);
  const eta = etaFromNow(tasks);

  renderStats(totals, eta);
  renderTasks(tasks, { onToggle: handleToggleTask }, makeDayLabel(dateKey));
}

/* ==============================
   Инициализация приложения
   ============================== */

/**
 * Инициализируем state из LocalStorage.
 * Если state.selectedDate нет — по умолчанию ставим "завтра".
 * После этого — подложим seed-данные, если список задач пуст.
 */
function initState() {
  const defaults = {
    selectedDate: null,
    days: {},
  };

  state = loadState(defaults);

  if (!state.selectedDate) {
    const tomorrowKey = toDateKey(getTomorrow());
    state.selectedDate = tomorrowKey;
    saveState(state);
  }

  // Страхуем структуру
  ensureDay(state.selectedDate);

  // SEED: если задач нет — создадим минимальный пример
  seedIfEmpty(state.selectedDate);
}

/**
 * Навешиваем обработчики на кнопки навигации (пока стабы для расписания/календаря).
 */
function initNavHandlers() {
  if (btnToday) {
    btnToday.addEventListener('click', () => {
      setSelectedDate(toDateKey(getToday()));
    });
  }

  if (btnSchedule) {
    btnSchedule.addEventListener('click', () => {
      // TODO: экран редактирования расписания (этап 3)
      console.info('[planner] schedule: stub click (будет реализовано позже)');
    });
  }

  if (btnCalendar) {
    btnCalendar.addEventListener('click', () => {
      // TODO: календарь выбора даты (этап 3)
      console.info('[planner] calendar: stub click (будет реализовано позже)');
    });
  }
}

/**
 * Точка старта.
 */
function bootstrap() {
  initState();
  initNavHandlers();
  renderAll();
}

// Скрипт подключается после HTML, поэтому DOM уже готов — можно запускать сразу.
bootstrap();
