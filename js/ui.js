"use strict";

/**
 * Превращает минуты в человеко-понятный вид.
 * 0   → "0 мин"
 * 25  → "25 мин"
 * 60  → "1 ч 0 мин"
 * 65  → "1 ч 5 мин"
 */
export function formatMinutes(min) {
  const v = Number.isFinite(min) ? Math.max(0, Math.trunc(min)) : 0;
  const h = Math.floor(v / 60);
  const m = v % 60;
  if (h === 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

/**
 * Рендер карточек дашборда.
 * Ожидаем объект:
 *   { total:number, done:number, left:number, eta?: null | { minutes:number } }
 */
export function renderStats(stats = { total: 0, done: 0, left: 0, eta: null }) {
  const elTotal = document.getElementById("stat-total");
  const elDone  = document.getElementById("stat-done");
  const elLeft  = document.getElementById("stat-left");
  const elEta   = document.getElementById("stat-eta");

  const safeInt = (v) => Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;

  const total = safeInt(stats.total);
  const done  = safeInt(stats.done);
  const left  = safeInt(stats.left);
  const etaMinutes = stats && stats.eta && Number.isFinite(stats.eta.minutes)
    ? Math.max(0, Math.trunc(stats.eta.minutes))
    : null;

  if (elTotal) elTotal.textContent = formatMinutes(total);
  if (elDone)  elDone.textContent  = formatMinutes(done);
  if (elLeft)  elLeft.textContent  = formatMinutes(left);
  if (elEta)   elEta.textContent   = (etaMinutes !== null) ? formatMinutes(etaMinutes) : "—";
}
