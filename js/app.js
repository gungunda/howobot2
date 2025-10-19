"use strict";
// Этап 1 — Шаг 5: stateless-инициализация + базовая навигация (без памяти).
// При каждом запуске ВСЕГДА показываем дашборд (Сегодня).

import { toDateKey, getToday } from "./date.js";
import { computeTotals } from "./compute.js";
import { renderStats, bindNav, openDashboard } from "./ui.js";

// Состояние текущей вкладки (живет, пока открыта страница)
const DEFAULT_STATE = {
  tasks: [],
  lastOpened: toDateKey(getToday()),
};

function clone(obj) {
  return (typeof structuredClone === "function")
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));
}

function normalizeStats(raw) {
  const total = (raw && (raw.total ?? raw.planned)) ?? 0;
  const done  = (raw && raw.done) ?? 0;
  const left  = (raw && (raw.left ?? raw.remaining)) ?? Math.max(0, total - done);
  const eta   = (raw && raw.eta) ?? null;
  return { total, done, left, eta };
}

function init() {
  console.log("[planner] init() — stateless + nav");

  // 1) Чистое состояние
  const state = clone(DEFAULT_STATE);

  // 2) Счёт показателей и первичный рендер дашборда
  let stats = { total: 0, done: 0, left: 0, eta: null };
  try {
    const raw = computeTotals ? computeTotals(state.tasks) : null;
    stats = normalizeStats(raw || stats);
  } catch (e) {
    console.warn("[planner] computeTotals failed; using zeros:", e);
  }
  renderStats(stats);

  // 3) Навигация: подписаться на кнопки и открыть Дашборд (правило продукта)
  bindNav({
    onToday: () => openDashboard(),
    onSchedule: () => { /* позже подцепим реальный UI расписания */ },
    onCalendar: () => { /* позже подцепим календарь */ },
  });
  openDashboard(); // ВСЕГДА стартуем с дашборда

  // 4) Отладочные хелперы
  window.__LP_STATE__ = state;
  window.__LP_RECALC__ = () => {
    try {
      const raw = computeTotals ? computeTotals(state.tasks) : null;
      const s = normalizeStats(raw || {});
      renderStats(s);
      // если сейчас открыт дашборд — значения обновятся на карточках
      return s;
    } catch (e) {
      console.warn("[planner] recalc failed:", e);
      const s = { total: 0, done: 0, left: 0, eta: null };
      renderStats(s);
      return s;
    }
  };

  // На всякий случай подчистим возможные старые ключи LocalStorage
  try { localStorage.removeItem("planner.state.v1"); } catch {}
}

init();
