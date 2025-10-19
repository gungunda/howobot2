// js/storage.js — простая версия без "legacy"
'use strict';

export const STORAGE_KEY = 'planner.state.v1';

// YYYY-MM-DD локально
export function toDateKey(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const tomorrowKey = toDateKey(new Date(Date.now() + 24 * 3600 * 1000));

const STATE_DEFAULT = {
  days: {
    [tomorrowKey]: [
      { title: 'Математика §12 №1–5', minutes: 25, done: false },
      { title: 'Русский язык: упр. 120', minutes: 15, done: true },
      { title: 'Английский: WB p.23 ex.3–4', minutes: 20, done: false },
    ],
  },
};

function safeParse(json) { try { return JSON.parse(json); } catch { return null; } }

export function loadState() {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (parsed && parsed.days && Object.keys(parsed.days).length > 0) return parsed;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE_DEFAULT)); // сразу сохраняем дефолт
  return STATE_DEFAULT;
}

export function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (err) { console.error('Не удалось сохранить состояние:', err); }
}
