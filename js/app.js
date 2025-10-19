"use strict";
// Шаг 3 (обновлённый): статless-инициализация без LocalStorage.
// Каждый запуск начинаем с дашборда и чистого состояния (по дефолту).

// Обрати внимание: storage.js больше не импортируем.
import { toDateKey, getToday } from "./date.js";
import { computeTotals } from "./compute.js";
import { renderStats } from "./ui.js";

// ❗ Мы ПРИНЦИПИАЛЬНО НЕ сохраняем state между сессиями.
// Это статless-подход: все данные — только в оперативной памяти на время вкладки.
const DEFAULT_STATE = {
  tasks: [],                      // список задач текущей сессии
  lastOpened: toDateKey(getToday()) // просто техническая метка «сегодня»
};

function init() {
  console.log("[planner] init() — stateless mode");

  // 1) Создаём чистое состояние на каждую загрузку страницы
  const state = structuredClone
    ? structuredClone(DEFAULT_STATE)
    : JSON.parse(JSON.stringify(DEFAULT_STATE));

  // 2) Считаем показатели (если computeTotals ещё заглушка — защитимся)
  let stats = { total: 0, done: 0, left: 0, eta: null };
  try {
    const raw = computeTotals ? computeTotals(state.tasks) : null;
    // Нормализация на случай разных имён полей в computeTotals
    const total = (raw && (raw.total ?? raw.planned)) ?? 0;
    const done  = (raw && raw.done) ?? 0;
    const left  = (raw && (raw.left ?? raw.remaining)) ?? Math.max(0, total - done);
    const eta   = (raw && raw.eta) ?? null;
    stats = { total, done, left, eta };
  } catch (e) {
    console.warn("[planner] computeTotals failed, using zeros:", e);
  }

  // 3) Рендерим дашборд (карточки показателей)
  renderStats(stats);

  // 4) Отладочные хелперы (только в текущей вкладке, НЕ сохраняются)
  // Пример:
  //   window.__LP_STATE__.tasks.push({ minutes: 30, done: false });
  //   window.__LP_RECALC__();
  window.__LP_STATE__ = state;
  window.__LP_RECALC__ = () => {
    const raw = computeTotals ? computeTotals(state.tasks) : null;
    const total = (raw && (raw.total ?? raw.planned)) ?? 0;
    const done  = (raw && raw.done) ?? 0;
    const left  = (raw && (raw.left ?? raw.remaining)) ?? Math.max(0, total - done);
    const eta   = (raw && raw.eta) ?? null;
    const s = { total, done, left, eta };
    renderStats(s);
    return s;
  };
}

init();

// (Необязательно) Если раньше кое-что сохраняли — подчистим старый ключ,
// чтобы не путал при ручных проверках в DevTools.
// Можно удалить строку позже, это просто разовая «миграция».
try { localStorage.removeItem("planner.state.v1"); } catch {}
