// js/app.js
'use strict';

import { loadState, saveState, toDateKey } from './storage.js';
import { computeTotals } from './compute.js';
import { renderStats, renderTasks } from './ui.js';

// === 1. Загружаем текущее состояние из LocalStorage ===
let state = loadState();

// === 2. Определяем даты "сегодня" и "завтра" ===
const today = new Date();
const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);

const todayKey = toDateKey(today);
const tomorrowKey = toDateKey(tomorrow);

// === 3. Если нет данных для завтрашнего дня — создаём дефолт ===
if (!state.days[tomorrowKey]) {
  state.days[tomorrowKey] = [
    { title: 'Математика §12 №1–5', minutes: 25, done: false },
    { title: 'Русский язык: упр. 120', minutes: 15, done: true },
    { title: 'Английский: WB p.23 ex.3–4', minutes: 20, done: false },
  ];
  saveState(state);
}

// === 4. Берём список задач именно для завтрашнего дня ===
const tasks = state.days[tomorrowKey] || [];

// === 5. Отрисовываем карточки и статистику ===
renderTasks(tasks);
renderStats(computeTotals(tasks));

// === 6. (необязательно) Помощник для консоли ===
window.__LP__ = {
  addDemo(minutes = 10) {
    const key = tomorrowKey;
    state.days[key] = state.days[key] || [];
    state.days[key].push({ title: 'Demo task', minutes, done: false });
    saveState(state);
    renderTasks(state.days[key]);
    renderStats(computeTotals(state.days[key]));
  }
};
