// js/ui.js
// Рендер статов и задач. Без логики состояния и без "улучшайзинга".
'use strict';

/**
 * renderStats(totals, eta)
 * totals: { planned, done, left, percent }
 * eta: string
 * Пишем в [data-stats] ИЛИ в .stats (как у тебя в разметке).
 */
export function renderStats(totals, eta) {
  const scope = document.querySelector('[data-view="dashboard"]') || document;

  // 1) пробуем data-узел
  let root = scope.querySelector('[data-stats]');
  // 2) иначе — класс .stats (существующий у тебя)
  if (!root) root = scope.querySelector('.stats');

  if (!root) return;

  const { planned = 0, done = 0, left = 0, percent = 0 } = totals || {};

  // Рисуем стандартную сетку .stats/.stat (совместима с твоим CSS)
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
 * renderTasks(tasks, { onToggle }, dayLabel)
 * - tasks: { id, title, minutesPlanned, donePercent, isDone, _virtual? }[]
 * - onToggle(id, isDone)
 * - dayLabel: строка заголовка
 * Пишем в [data-task-list] ИЛИ [data-tasks] ИЛИ .task-list/.tasks-list.
 */
export function renderTasks(tasks = [], handlers = {}, dayLabel = '') {
  const scope = document.querySelector('[data-view="dashboard"]') || document;

  // заголовок дня (у тебя есть [data-day-label])
  const dayTitleEl =
    scope.querySelector('[data-day-label]') ||
    scope.querySelector('.day-label__title') ||
    scope.querySelector('.day-title');
  if (dayTitleEl) dayTitleEl.textContent = String(dayLabel || '');

  // контейнер списка задач — поддерживаем все варианты
  let list =
    scope.querySelector('[data-task-list]') || // мой старый вариант
    scope.querySelector('[data-tasks]') ||     // твой текущий вариант
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
    // прячем "пусто", если есть
    const empty =
      scope.querySelector('[data-empty]') ||
      scope.querySelector('.empty');
    if (empty) empty.style.display = 'none';

    list.innerHTML = items.join('');
  }

  // делегируем чекбоксы — один обработчик на контейнер
  list.onchange = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (el.getAttribute('data-act') !== 'toggle') return;
    const row = el.closest('.task-item');
    const id = row?.getAttribute('data-id');
    if (!id) return;
    handlers.onToggle?.(id, el.checked);
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
