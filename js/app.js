"use strict";
// Этап 1 — Шаг 4: stateless-инициализация.
// Ничего не сохраняем между сессиями. На каждый запуск — чистое состояние и дашборд.

import { toDateKey, getToday } from "./date.js";
import { computeTotals } from "./compute.js";
import { renderStats } from "./ui.js";

// Стартовое состояние текущей вкладки (живёт только пока открыта страница)
const DEFAULT_STATE = {
  tasks: [],                         // [{ minutes:number, done:boolean, ... }]
  lastOpened: toDateKey(getToday()), // техническая метка на сегодня (локально)
};

function clone(obj) {
  return (typeof structuredClone === "function")
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));
}

function normalizeStats(raw) {
  // Поддержка вариантов { total, done, left, eta } / { planned, done, remaining, eta }
  const total = (raw && (raw.total ?? raw.planned)) ?? 0;
  const done  = (raw && raw.done) ?? 0;
  const left  = (raw && (raw.left ?? raw.remaining)) ?? Math.max(0, total - done);
  const eta   = (raw && raw.eta) ?? null;
  return { total, done, left, eta };
}

function init() {
  console.log("[planner] init() — stateless");

  // 1) Чистое состояние на каждую загрузку
  const state = clone(DEFAULT_STATE);

  // 2) Счёт показателей
  let stats = { total: 0, done: 0, left: 0, eta: null };
  try {
    const raw = computeTotals ? computeTotals(state.tasks) : null;
    stats = normalizeStats(raw || stats);
  } catch (e) {
    console.warn("[planner] computeTotals failed; using zeros:", e);
  }

  // 3) Рендерим дашборд (карточки показателей)
  renderStats(stats);

  // 4) Отладочные хелперы (живут только в этой вкладке — не сохраняются)
  // Пример:
  //   window.__LP_STATE__.tasks.push({ minutes: 40, done: true });
  //   window.__LP_STATE__.tasks.push({ minutes: 25, done: false });
  //   window.__LP_RECALC__(); // карточки обновятся
  window.__LP_STATE__ = state;
  window.__LP_RECALC__ = () => {
    try {
      const raw = computeTotals ? computeTotals(state.tasks) : null;
      const s = normalizeStats(raw || {});
      renderStats(s);
      return s;
    } catch (e) {
      console.warn("[planner] recalc failed:", e);
      const s = { total: 0, done: 0, left: 0, eta: null };
      renderStats(s);
      return s;
    }
  };

  // Если раньше что-то писали в LocalStorage — подчистим старый ключ (необязательно).
  try { localStorage.removeItem("planner.state.v1"); } catch {}
}

init();
