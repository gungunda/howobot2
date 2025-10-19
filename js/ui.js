"use strict";

/**
 * Формат минут в человеко-понятный вид.
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
 * Ожидаем stats: { total, done, left, eta?: null | { minutes } }
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

/* =========================
   БАЗОВАЯ НАВИГАЦИЯ (Шаг 5)
   ========================= */

/**
 * Служебные хелперы
 */
function $id(id) { return document.getElementById(id); }
function setHidden(el, hidden) {
  if (!el) return;
  if (hidden) el.setAttribute("hidden", ""); else el.removeAttribute("hidden");
}

/**
 * Подсветка активной вкладки (кнопки)
 */
function setActiveTab(view) {
  const btnToday    = $id("btn-today");
  const btnSchedule = $id("btn-schedule");
  const btnCalendar = $id("btn-calendar");

  const map = {
    dashboard: btnToday,
    schedule: btnSchedule,
    calendar: btnCalendar,
  };

  for (const btn of [btnToday, btnSchedule, btnCalendar]) {
    if (!btn) continue;
    btn.removeAttribute("aria-current");
    btn.classList.remove("is-active");
  }
  const active = map[view];
  if (active) {
    active.setAttribute("aria-current", "page");
    active.classList.add("is-active");
  }
}

/**
 * Показ/скрытие секций-контейнеров
 */
function showView(view) {
  const vDash = $id("view-dashboard");
  const vSch  = $id("view-schedule");
  const vCal  = $id("view-calendar");

  setHidden(vDash, view !== "dashboard");
  setHidden(vSch,  view !== "schedule");
  setHidden(vCal,  view !== "calendar");
}

/**
 * Публичные функции для открытия разделов
 */
export function openDashboard() {
  setActiveTab("dashboard");
  showView("dashboard");
  // Здесь уже отрисованы карточки renderStats(...)
}
export function openSchedule() {
  setActiveTab("schedule");
  showView("schedule");
  // Плейсхолдер: позже добавим таблицу/редактор расписания
  const host = $id("view-schedule");
  if (host && !host.dataset.init) {
    host.dataset.init = "1";
    host.textContent = "Раздел «Расписание» в разработке…";
  }
}
export function openCalendar() {
  setActiveTab("calendar");
  showView("calendar");
  // Плейсхолдер: позже будет календарь
  const host = $id("view-calendar");
  if (host && !host.dataset.init) {
    host.dataset.init = "1";
    host.textContent = "Раздел «Календарь» в разработке…";
  }
}

/**
 * Привязка обработчиков к кнопкам навигации
 * Вход: callbacks = { onToday, onSchedule, onCalendar }
 */
export function bindNav(callbacks = {}) {
  const btnToday    = $id("btn-today");
  const btnSchedule = $id("btn-schedule");
  const btnCalendar = $id("btn-calendar");

  if (btnToday) {
    btnToday.addEventListener("click", (e) => {
      e.preventDefault();
      openDashboard();
      if (typeof callbacks.onToday === "function") callbacks.onToday();
    });
  }
  if (btnSchedule) {
    btnSchedule.addEventListener("click", (e) => {
      e.preventDefault();
      openSchedule();
      if (typeof callbacks.onSchedule === "function") callbacks.onSchedule();
    });
  }
  if (btnCalendar) {
    btnCalendar.addEventListener("click", (e) => {
      e.preventDefault();
      openCalendar();
      if (typeof callbacks.onCalendar === "function") callbacks.onCalendar();
    });
  }
}
