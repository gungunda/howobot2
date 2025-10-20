// js/ui.js
// Рендер статов и задач. Без логики состояния.
'use strict';

/**
 * renderStats(totals, eta)
 * totals: { planned, done, left, percent }
 * eta: string
 * Пишем в [data-stats] ИЛИ в .stats (как в твоём CSS).
 */
export function renderStats(totals, eta) {
  const scope = document.querySelector('[data-view="dashboard"]') || document;

  // пробуем data-узел → иначе .stats
  let root = scope.querySelector('[data-stats]');
  if (!root) root = scope.querySelector('.stats');
  if (!root) return;

  const { planned = 0, done = 0, left = 0, percent = 0 } = totals || {};

  root.innerHTML = `
    <div class="stat">
      <span class="stat-label">Общая нагрузка</span>
      <strong class="stat-value">${planned} мин</strong>
    </div>
    <div class="stat">
      <span class="stat-label">Выполнено</span>
      <strong class="stat-value">${done} мин (${percent}%)</strong>
    </div>
    <div class="stat">
      <span class="stat-label">Осталось</span>
      <strong class="stat-value">${left} мин</strong>
    </div>
    <div class="stat">
      <span class="stat-label">Финиш-оценка</span>
      <strong class="stat-value">${eta}</strong>
    </div>
  `;
}

/**
 * renderTasks(tasks, { onToggle, onBump }, dayLabel)
 * - tasks: { id, title, minutesPlanned, donePercent, isDone, _virtual? }[]
 * - onToggle(id, isDone)
 * - onBump(id, delta) // delta: -10 или +10
 * - dayLabel: строка заголовка
 * Пишем в [data-task-list] ИЛИ [data-tasks] ИЛИ .task-list/.tasks-list.
 */
export function renderTasks(tasks = [], handlers = {}, dayLabel = '') {
  const scope = document.querySelector('[data-view="dashboard"]') || document;

  // заголовок дня (поддерживаем твой data-атрибут и классы)
  const dayTitleEl =
    scope.querySelector('[data-day-label]') ||
    scope.querySelector('.day-label__title') ||
    scope.querySelector('.day-title');
  if (dayTitleEl) dayTitleEl.textContent = String(dayLabel || '');

  // контейнер списка задач — поддерживаем все варианты
  let list =
    scope.querySelector('[data-task-list]') ||
    scope.querySelector('[data-tasks]') ||
    scope.querySelector('.task-list') ||
    scope.querySelector('.tasks-list');

  if (!list) return;

  const items = (tasks || []).map(t => {
    const dp = clampPercent(t.donePercent);
    const checked = (t.isDone || dp >= 100) ? 'checked' : '';
    const badge = t._virtual ? '<span class="badge">из шаблона</span>' : '';
    return `
      <div class="task-item ${checked ? 'done' : ''}" data-id="${esc(t.id)}">
        <input class="task-checkbox" type="checkbox" data-act="toggle" ${checked}/>
        <div class="task-title">${esc(t.title)} ${badge}</div>
        <div class="task-minutes">${t.minutesPlanned} мин · ${dp}%</div>
        <div class="task-controls">
          <button type="button" class="btn" data-act="bump" data-delta="-10">−10%</button>
          <button type="button" class="btn" data-act="bump" data-delta="+10">+10%</button>
        </div>
      </div>
    `;
  });

  if (!items.length) {
    list.innerHTML = '';
    const empty =
      scope.querySelector('[data-empty]') ||
      scope.querySelector('.empty');
    if (empty) {
      empty.style.display = 'block';
      empty.textContent = 'Нет заданий на этот день.';
    }
  } else {
    const empty =
      scope.querySelector('[data-empty]') ||
      scope.querySelector('.empty');
    if (empty) empty.style.display = 'none';
    list.innerHTML = items.join('');
  }

  // чекбоксы (делегирование)
  list.onchange = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (el.getAttribute('data-act') !== 'toggle') return;
    const row = el.closest('.task-item');
    const id = row?.getAttribute('data-id');
    if (!id) return;
    handlers.onToggle?.(id, el.checked);
  };

  // кнопки ±10%
  list.onclick = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    if (el.getAttribute('data-act') !== 'bump') return;
    const row = el.closest('.task-item');
    const id = row?.getAttribute('data-id');
    if (!id) return;
    const delta = Number((el.getAttribute('data-delta') || '0').replace('%',''));
    if (!Number.isFinite(delta)) return;
    handlers.onBump?.(id, delta);
  };
}

/* ===== helpers ===== */
function clampPercent(v) {
  const n = Math.round(Number(v ?? 0));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export default { renderStats, renderTasks };
