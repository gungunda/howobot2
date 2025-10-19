// js/app.js
// Точка входа «Лёшин планировщик».
// Здесь мы связываем: хранилище (storage) -> даты (date) -> вычисления (compute) -> UI (ui).
// Важно: этот модуль работает как ES-модуль; в index.html должен быть <script type="module" src="js/app.js"></script>

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

// Небольшие селекторы для навигационных кнопок (стабы обработчиков)
const btnToday = document.querySelector('[data-action="today"]');
const btnSchedule = document.querySelector('[data-action="schedule"]');
const btnCalendar = document.querySelector('[data-action="calendar"]');

/* ==============================
   Вспомогательные функции состояния
   ============================== */

/**
 * Гарантирует, что в state.days есть запись для данной даты.
 * Зачем: чтобы код дальше не падал на undefined.
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
  // Мини-проверка корректности ключа
  const d = parseDateKey(dateKey); // нормализуем к локальной полуночи
  const normalizedKey = toDateKey(d);

  state.selectedDate = normalizedKey;
  saveState(state);
  renderAll();
}

/* ==============================
   Рендер всего экрана
   ============================== */

/**
 * Возвращает человекочитаемую подпись дня (напр., "Понедельник, 20 октября").
 */
function makeDayLabel(dateKey) {
  const d = parseDateKey(dateKey);
  // Для начинающих: toLocaleDateString удобен для локализации.
  // Попросим день недели, число и месяц (год опустим для краткости).
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Обработчик переключения чекбоксов задач.
 * @param {string} id - id задачи
 * @param {boolean} isDone - новое значение чекбокса
 *
 * Логика простая:
 * - ставим task.isDone = isDone
 * - если включили, minutesDone = minutesPlanned (считаем как полностью сделано)
 * - если выключили, minutesDone не трогаем (или можно обнулить — на твой вкус)
 */
function handleToggleTask(id, isDone) {
  const dateKey = state.selectedDate;
  const tasks = getTasksForDate(dateKey);

  for (const t of tasks) {
    if (t.id === id) {
      t.isDone = !!isDone;
      if (t.isDone) {
        const planned = Number.isFinite(+t.minutesPlanned) ? Math.max(0, Math.floor(+t.minutesPlanned)) : 0;
        t.minutesDone = planned;
      }
      break;
    }
  }

  saveState(state);
  renderAll(); // пересчёт метрик и обновление UI
}

/**
 * Главная функция рендера дашборда.
 * 1) Берём задачи выбранного дня
 * 2) Считаем totals + eta
 * 3) Обновляем верхние показатели и список задач
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
 */
function initState() {
  // Значения по умолчанию на случай пустого хранилища
  const defaults = {
    selectedDate: null,
    days: {},
  };

  state = loadState(defaults);

  // Если дата не выбрана — возьмём завтра (по конвенции этапа 2)
  if (!state.selectedDate) {
    const tomorrowKey = toDateKey(getTomorrow());
    state.selectedDate = tomorrowKey;
    saveState(state);
  }

  // Подстрахуемся, что структура на выбранную дату существует
  ensureDay(state.selectedDate);
}

/**
 * Навешиваем обработчики на кнопки навигации.
 * Сейчас это лёгкие стабы — полноценная логика появится на следующих этапах.
 */
function initNavHandlers() {
  if (btnToday) {
    btnToday.addEventListener('click', () => {
      setSelectedDate(toDateKey(getToday()));
    });
  }

  if (btnSchedule) {
    btnSchedule.addEventListener('click', () => {
      // TODO: откроем экран редактирования расписания (этап 3)
      console.info('[planner] schedule: stub click (будет реализовано позже)');
    });
  }

  if (btnCalendar) {
    btnCalendar.addEventListener('click', () => {
      // TODO: откроем календарь выбора даты (этап 3)
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

// Запускаем приложение, когда DOM готов.
// Для простоты вызовем сразу: модуль грузится после HTML, поэтому DOM уже есть.
// Если подключение скрипта в <head>, тогда стоит повеситься на DOMContentLoaded.
bootstrap();
