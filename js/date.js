// js/date.js
// Утилиты работы с датами для «Лёшин планировщик».
// Идея простая: всегда нормализуем дату к ЛОКАЛЬНОЙ полуночи (00:00:00),
// а ключ даты делаем строкой в формате 'YYYY-MM-DD'.
// Так ключи совпадают с тем, что реально видит пользователь в своём часовом поясе.

'use strict';

/* ==============================
   Вспомогательные функции
   ============================== */

/**
 * Приводит дату к ЛОКАЛЬНОЙ полуночи.
 * Принимает: Date | string | number (timestamp) | ничего (тогда возьмём текущую дату).
 * Возвращает: Date (00:00:00.000 локального времени).
 */
function startOfDay(input = new Date()) {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Формирует ключ даты 'YYYY-MM-DD' из Date (локальная дата).
 * Это удобно для ключей в LocalStorage и сравнения дней.
 */
export function toDateKey(date = new Date()) {
  const d = startOfDay(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Обратная операция к toDateKey: превращает 'YYYY-MM-DD' в Date (локальная полуночь).
 * Если строка невалидна — вернём текущий день на локальной полуночи.
 */
export function parseDateKey(key) {
  if (typeof key !== 'string') return startOfDay(new Date());

  // Ожидаем ровно 'YYYY-MM-DD'
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return startOfDay(new Date());

  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1; // в JS месяцы 0..11
  const day = Number(m[3]);

  // Создаём дату на локальной полуночи
  const d = new Date(year, monthIndex, day);
  d.setHours(0, 0, 0, 0);

  // Быстрая проверка: что действительно получили нужные компоненты
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== monthIndex ||
    d.getDate() !== day
  ) {
    // Например, ключ '2025-02-31' даст март — считаем невалидным и вернём сегодня.
    return startOfDay(new Date());
  }

  return d;
}

/**
 * Возвращает сегодняшнюю дату (локальная полуночь).
 */
export function getToday() {
  return startOfDay(new Date());
}

/**
 * Возвращает дату, сдвинутую на n дней относительно переданной.
 * Например, addDays(today, 1) -> завтра на локальной полуночи.
 */
export function addDays(date, n) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + Number(n || 0));
  return d;
}

/**
 * Удобный шорткат: завтра (локальная полуночь).
 */
export function getTomorrow() {
  return addDays(getToday(), 1);
}

/* ==============================
   Default export (на всякий случай)
   ============================== */

export default {
  toDateKey,
  parseDateKey,
  getToday,
  getTomorrow,
  addDays,
};
