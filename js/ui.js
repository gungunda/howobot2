"use strict";

/**
 * Рендер карточек показателей.
 * Ожидает объект stats вида: { total:number, done:number, left:number, eta?:string|null }
 * Если stats не передали — покажем нули и прочерк.
 */
export function renderStats(stats = { total: 0, done: 0, left: 0, eta: null }) {
  const elTotal = document.getElementById("stat-total");
  const elDone  = document.getElementById("stat-done");
  const elLeft  = document.getElementById("stat-left");
  const elEta   = document.getElementById("stat-eta");

  // Простейшая «санитация» чисел: целое, не меньше нуля
  const safeInt = (v) => Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;

  if (elTotal) elTotal.textContent = String(safeInt(stats.total));
  if (elDone)  elDone.textContent  = String(safeInt(stats.done));
  if (elLeft)  elLeft.textContent  = String(safeInt(stats.left));
  if (elEta)   elEta.textContent   = stats.eta ? String(stats.eta) : "—";
}
