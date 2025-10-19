"use strict";
// Шаг 3: чтение/запись состояния в LocalStorage + сквозной расчёт и рендер статистики.
// Состояние: { tasks: Array<{ minutes:number, done:boolean, ... }>, lastOpened: "YYYY-MM-DD" }

import { loadJSON, saveJSON } from "./storage.js";
import { toDateKey, getToday } from "./date.js";
import { computeTotals } from "./compute.js";
import { renderStats } from "./ui.js";

const STATE_KEY = "planner.state.v1";

/**
 * Простейшая валидация формы состояния (защита от «битых» записей).
 */
function ensureStateShape(state) {
  const fallback = { tasks: [], lastOpened: toDateKey(getToday()) };
  if (!state || typeof state !== "object") return fallback;
  if (!Array.isArray(state.tasks)) state.tasks = [];
  if (!state.lastOpened) state.lastOpened = toDateKey(getToday());
  return state;
}

/**
 * Нормализация результата computeTotals на случай отличий в именах полей.
 * Поддерживаем два варианта:
 *  - { total, done, left, eta }
 *  - { planned, done, remaining, eta }
 */
function normalizeStats(raw) {
  const total = (raw && (raw.total ?? raw.planned)) ?? 0;
  const done  = (raw && raw.done)  ?? 0;
  const left  = (raw && (raw.left ?? raw.remaining)) ?? Math.max(0, total - done);
  const eta   = (raw && raw.eta) ?? null;
  return { total, done, left, eta };
}

function init() {
  console.log("[planner] init()");

  // 1) Читаем состояние (или создаём дефолтное)
  const defaults = { tasks: [], lastOpened: toDateKey(getToday()) };
  const state = ensureStateShape(loadJSON(STATE_KEY, defaults));

  // 2) Считаем показатели
  let rawStats;
  try {
    rawStats = computeTotals ? computeTotals(state.tasks) : null;
  } catch (e) {
    console.warn("[planner] computeTotals failed, fallback to zeros:", e);
    rawStats = null;
  }
  const stats = normalizeStats(rawStats || { total: 0, done: 0, left: 0, eta: null });

  // 3) Рендерим показатели
  renderStats(stats);

  // 4) Сохраняем обратно (фиксируем корректную форму состояния)
  saveJSON(STATE_KEY, state);

  // Отладочные хелперы (удобно играться в консоли):
  //   window.__LP_STATE__.tasks.push({ minutes: 40, done: true })
  //   window.__LP_RECALC__()
  window.__LP_STATE__ = state;
  window.__LP_RECALC__ = () => {
    const s = normalizeStats((computeTotals && computeTotals(state.tasks)) || {});
    renderStats(s);
    return s;
  };

  console.log("[planner] state:", state);
}

init();
