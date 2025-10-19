// js/compute.js
// Метрики и расчёты для «Лёшин планировщик».
// Здесь НЕТ работы с DOM и LocalStorage — только математика над данными задач.
// Это удобно: UI просто вызывает эти функции и получает готовые числа/строки.

'use strict';

/* ==============================
   Вспомогательные утилиты
   ============================== */

/**
 * Безопасно приводит значение к числу минут (неотрицательное целое).
 * Пример: safeMinutes('30') -> 30, safeMinutes(-5) -> 0
 */
function safeMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/**
 * Нормализует одну задачу к предсказуемому виду.
 * minutesDone не может превышать minutesPlanned и быть отрицательным.
 * isDone включается, если minutesDone >= minutesPlanned.
 */
function normalizeTask(task) {
  if (!task || typeof task !== 'object') {
    return {
      id: 'unknown',
      title: 'Untitled',
      minutesPlanned: 0,
      minutesDone: 0,
      isDone: false,
    };
  }

  const planned = safeMinutes(task.minutesPlanned);
  let done = safeMinutes(task.minutesDone);

  if (done > planned) done = planned;

  const isDone =
    typeof task.isDone === 'boolean'
      ? task.isDone || done >= planned // если уже true, сохраняем; иначе проверяем по минутам
      : done >= planned;

  return {
    id: task.id ?? 'unknown',
    title: task.title ?? 'Untitled',
    minutesPlanned: planned,
    minutesDone: done,
    isDone,
  };
}

/**
 * Форматирует время "HH:MM" локально.
 */
function formatHHMM(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Простое человекочитаемое название дня относительно "сегодня".
 * Возвращает 'сегодня' | 'завтра' | 'послезавтра' | 'в <YYYY-MM-DD>'.
 */
function relativeDayLabel(targetDate, now = new Date()) {
  const td = new Date(now);
  td.setHours(0, 0, 0, 0);

  const tt = new Date(targetDate);
  tt.setHours(0, 0, 0, 0);

  const diffDays = Math.round((tt - td) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'сегодня';
  if (diffDays === 1) return 'завтра';
  if (diffDays === 2) return 'послезавтра';

  // Фолбэк: точная дата (год-месяц-день)
  const y = tt.getFullYear();
  const m = String(tt.getMonth() + 1).padStart(2, '0');
  const d = String(tt.getDate()).padStart(2, '0');
  return `в ${y}-${m}-${d}`;
}

/* ==============================
   Публичные функции расчёта
   ============================== */

/**
 * Считает сводные показатели по массиву tasks.
 * @param {Array} tasks - массив объектов задач
 * @returns {{ planned:number, done:number, left:number, percent:number }}
 *
 * Определения:
 * planned  — суммарные запланированные минуты
 * done     — суммарные выполненные минуты (не больше planned в каждой задаче)
 * left     — сколько минут осталось (planned - done, не меньше 0)
 * percent  — округлённый процент выполнения 0..100
 */
export function computeTotals(tasks = []) {
  if (!Array.isArray(tasks)) tasks = [];

  let planned = 0;
  let done = 0;

  for (const t of tasks) {
    const nt = normalizeTask(t);
    planned += nt.minutesPlanned;
    done += nt.minutesDone;
  }

  if (done > planned) done = planned;

  const left = Math.max(planned - done, 0);
  const percent = planned > 0 ? Math.round((done / planned) * 100) : 0;

  return { planned, done, left, percent };
}

/**
 * Простейшая «финиш-оценка» на естественном языке.
 * Идея: прибавляем оставшиеся минуты к текущему времени и сообщаем,
 * когда примерно закончим. Если уже всё готово — отдельное сообщение.
 *
 * @param {Array} tasks
 * @param {Object} [opts]
 * @param {Date}   [opts.now=new Date()] - отправная точка для расчёта
 * @returns {string} текст вроде:
 *   - "всё готово"
 *   - "сегодня к 20:30"
 *   - "завтра к 18:10"
 *   - "в 2025-10-21 к 09:00"
 */
export function etaFromNow(tasks = [], opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();

  const { left } = computeTotals(tasks);

  if (left <= 0) {
    return 'всё готово';
  }

  // Оценка: начнём сейчас, закончим через left минут.
  const finish = new Date(now.getTime() + left * 60 * 1000);

  const dayLabel = relativeDayLabel(finish, now);
  const timeLabel = formatHHMM(finish);

  // Для "сегодня" звучит естественнее без предлога "в"
  if (dayLabel === 'сегодня') {
    return `сегодня к ${timeLabel}`;
  }

  return `${dayLabel} к ${timeLabel}`;
}

/**
 * Подсчёт количества задач по статусу.
 * Удобно для бейджей типа "всего / выполнено / активных".
 * @param {Array} tasks
 * @returns {{ total:number, done:number, active:number }}
 */
export function countByStatus(tasks = []) {
  if (!Array.isArray(tasks)) tasks = [];
  let total = 0;
  let done = 0;

  for (const t of tasks) {
    const nt = normalizeTask(t);
    total += 1;
    if (nt.isDone || nt.minutesDone >= nt.minutesPlanned) done += 1;
  }

  return { total, done, active: Math.max(total - done, 0) };
}

/* ==============================
   Default export (опционально)
   ============================== */

export default {
  computeTotals,
  etaFromNow,
  countByStatus,
};
