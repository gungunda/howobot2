// js/app.js
// Точка входа «Лёшин планировщик».
// Связываем: storage -> date -> compute -> ui + добавляем seed-данные и форму добавления.
'use strict';

/* ============================== Импорты модулей (логика) ============================== */
import { loadState, saveState } from './storage.js';
import { toDateKey, parseDateKey, getToday, getTomorrow } from './date.js';
import { computeTotals, etaFromNow } from './compute.js';
import { renderStats, renderTasks } from './ui.js';

/* ============================== Базовые переменные приложения ============================== */
// Состояние приложения (в LocalStorage лежит объект { selectedDate, days })
let state = null;

// Селекторы навигационных кнопок
const btnToday = document.querySelector('[data-action="today"]');
const btnSchedule = document.querySelector('[data-action="schedule"]');
const btnCalendar = document.querySelector('[data-action="calendar"]');

// Элементы формы «Добавить задание»
const formAdd = document.querySelector('[data-form="add-task"]');
const inputTitle = document.querySelector('[data-input="title"]');
const inputMinutes = document
