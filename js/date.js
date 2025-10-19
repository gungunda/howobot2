"use strict";
/**
 * Стандартизированный модуль дат.
 * Именованные экспорты:
 *   - toDateKey(date) -> "YYYY-MM-DD" (локальная дата)
 *   - getToday()
 *   - getTomorrow()
 *   - addDays(date, n)
 * Мы приводим все даты к локальной полуночи (00:00:00) и собираем ключ "YYYY-MM-DD" вручную.
 * Это нужно, чтобы ключи дат всегда совпадали с тем, что видит пользователь в своём часовом поясе.
 * Если бы мы брали дату из toISOString() (UTC), она могла бы "съезжать" на ±1 день
 * при сохранении или сравнении в разных часовых поясах.
 * Обнуление времени гарантирует, что все задачи одного дня хранятся под одним и тем же ключом.
 */

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateKey(date = new Date()) {
  const d = startOfDay(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getToday() {
  return startOfDay(new Date());
}

export function addDays(date, n) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function getTomorrow() {
  return addDays(getToday(), 1);
}

// На будущее:
// export function parseDateKey(key) { ... }
// export function getWeekStart(date, weekStartsOn = 1) { ... }
// export function getWeekEnd(date, weekStartsOn = 1) { ... }

// Доп. совместимость (если где-то ожидали default-объект)
export default {
  toDateKey,
  getToday,
  getTomorrow,
  addDays,
};
