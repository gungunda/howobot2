"use strict";

/**
 * Считает показатели по задачам.
 * Ожидается массив элементов формата:
 *   { minutes: number, done: boolean, ... }
 *
 * Возвращает «сырые» числа (без форматирования текста):
 *   {
 *     total: number,   // суммарные минуты всех задач
 *     done:  number,   // суммарные минуты выполненных задач
 *     left:  number,   // Math.max(0, total - done)
 *     eta:   null | { minutes: number } // простая эвристика: осталось минут
 *   }
 */
export function computeTotals(tasks = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { total: 0, done: 0, left: 0, eta: null };
  }

  let total = 0;
  let done = 0;

  for (const t of tasks) {
    const mRaw = t && typeof t.minutes !== "undefined" ? Number(t.minutes) : 0;
    const m = Number.isFinite(mRaw) ? Math.max(0, Math.trunc(mRaw)) : 0;
    total += m;
    if (t && t.done === true) done += m;
  }

  const left = Math.max(0, total - done);
  const eta = left > 0 ? { minutes: left } : null;

  return { total, done, left, eta };
}
