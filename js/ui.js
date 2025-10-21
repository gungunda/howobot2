// js/ui.js
// Презентационный слой: DOM для дашборда, календаря и редактора расписания.
// Этап 4: inline-редактор и удаление. Исправлено: устойчивый режим редактирования через options.editingId.
'use strict';

/* ==============================
   Дашборд: статы и задачи
   ============================== */

export function renderStats(totals, eta) {
  const dashboard = document.querySelector('[data-view="dashboard"]');
  if (!dashboard) {
    console.warn('[ui] dashboard view not found: [data-view="dashboard"]');
    return;
  }

  let root = dashboard.querySelector('[data-stats]') || dashboard.querySelector('.stats');
  if (!root) {
    console.warn('[ui] stats container not found (need [data-stats] or .stats)');
    return;
  }

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
 * renderTasks
 * tasks: { id, title, minutesPlanned, donePercent, isDone, _virtual? }[]
 * handlers: { onToggle, onBump, onEditStart, onEditSave, onEditCancel, onDelete }
 * options: { editingId?: string }
 */
export function renderTasks(tasks = [], handlers = {}, dayLabel = '', options = {}) {
  const dashboard = document.querySelector('[data-view="dashboard"]');
  if (!dashboard) {
    console.warn('[ui] dashboard view not found: [data-view="dashboard"]');
    return;
  }

  const dayTitleEl =
    dashboard.querySelector('[data-day-label]') ||
    dashboard.querySelector('.day-label__title') ||
    dashboard.querySelector('.day-title');
  if (dayTitleEl) dayTitleEl.textContent = String(dayLabel || '');

  let list =
    dashboard.querySelector('[data-task-list]') ||
    dashboard.querySelector('[data-tasks]') ||
    dashboard.querySelector('.task-list') ||
    dashboard.querySelector('.tasks-list');

  if (!list) {
    console.warn('[ui] task list container not found (need [data-task-list] or [data-tasks] or .task-list/.tasks-list)');
    return;
  }

  const editingId = options?.editingId ?? null;

  const items = (tasks || []).map(t => taskItemHTML(t, editingId));
  const empty =
    dashboard.querySelector('[data-empty]') ||
    dashboard.querySelector('.empty');

  if (!items.length) {
    list.innerHTML = '';
    if (empty) {
      empty.style.display = 'block';
      empty.textContent = 'Нет заданий на этот день.';
    }
  } else {
    if (empty) empty.style.display = 'none';
    list.innerHTML = items.join('');
  }

  // Делегирование событий:
  list.onchange = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    const act = el.getAttribute('data-act');
    const row = el.closest('.task-item');
    const id = row?.getAttribute('data-id');
    if (!id) return;

    if (act === 'toggle') {
      handlers.onToggle?.(id, el.checked);
    }
  };

  list.onclick = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    const act = el.getAttribute('data-act');
    if (!act) return;
    const row = el.closest('.task-item');
    const id = row?.getAttribute('data-id');
    if (!id) return;

    if (act === 'bump') {
      const delta = Number((el.getAttribute('data-delta') || '0').replace('%',''));
      if (!Number.isFinite(delta)) return;
      handlers.onBump?.(id, delta);
      return;
    }

    if (act === 'edit') {
      handlers.onEditStart?.(id);
      return;
    }

    if (act === 'delete') {
      handlers.onDelete?.(id);
      return;
    }

    if (act === 'save-edit') {
      const { title, minutes } = grabInlineValues(row);
      if (title.trim() === '' || !Number.isFinite(minutes) || minutes < 0) {
        const titleInput = row.querySelector('[data-edit-title]');
        const minInput = row.querySelector('[data-edit-minutes]');
        if (titleInput) titleInput.classList.toggle('invalid', title.trim() === '');
        if (minInput) minInput.classList.toggle('invalid', !(Number.isFinite(minutes) && minutes >= 0));
        return;
      }
      handlers.onEditSave?.(id, { title, minutesPlanned: minutes });
      return;
    }

    if (act === 'cancel-edit') {
      handlers.onEditCancel?.(id);
      return;
    }
  };
}

/* ===== helpers: карточка, inline-форма ===== */

function taskItemHTML(t, editingId) {
  const isEditing = editingId && t.id === editingId;
  if (isEditing) {
    const safeTitle = escAttr(t.title ?? '');
    const safeMinutes = String(Math.max(0, Math.floor(Number(t.minutesPlanned ?? 0))));
    return `
      <div class="task-item editing" data-id="${esc(t.id)}">
        <div class="task-edit">
          <label>
            <span>Название</span>
            <input type="text" data-edit-title value="${safeTitle}" />
          </label>
          <label>
            <span>Минуты</span>
            <input type="number" min="0" step="1" data-edit-minutes value="${safeMinutes}" />
          </label>
          <div class="task-controls">
            <button type="button" class="btn primary" data-act="save-edit">Сохранить</button>
            <button type="button" class="btn" data-act="cancel-edit">Отменить</button>
          </div>
        </div>
      </div>
    `;
  }

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
        <button type="button" class="btn" data-act="edit">✏️</button>
        <button type="button" class="btn danger" data-act="delete">🗑️</button>
      </div>
    </div>
  `;
}

function grabInlineValues(rowEl) {
  const title = String(rowEl.querySelector('[data-edit-title]')?.value ?? '');
  const minutes = Math.max(0, Math.floor(Number(rowEl.querySelector('[data-edit-minutes]')?.value ?? 0)));
  return { title, minutes };
}

/* ==============================
   Редактор расписания (DOM)
   ============================== */

const weekdaySwitch = document.querySelector('.weekday-switch');
const scheduleListEl = document.querySelector('[data-schedule-list]');
const btnAddRow = document.querySelector('[data-schedule-add]');
const btnSaveTpl = document.querySelector('[data-schedule-save]');
const btnApplyTemplate = document.querySelector('[data-apply-template]');
const scheduleView = document.querySelector('[data-view="schedule"]');

function ensureErrorBanner() {
  if (!scheduleView) return null;
  let banner = scheduleView.querySelector('[data-schedule-errors]');
  if (!banner) {
    banner = document.createElement('div');
    banner.dataset.scheduleErrors = '';
    banner.className = 'schedule-errors muted small';
    banner.style.display = 'none';
    scheduleView.appendChild(banner);
  }
  return banner;
}

function showScheduleErrors(messages = []) {
  const banner = ensureErrorBanner();
  if (!banner) return;
  const has = messages.length > 0;
  banner.style.display = has ? 'block' : 'none';
  banner.textContent = has ? messages.join(' · ') : '';
}

function bindMinutesSanitizer(inputNumber) {
  if (!inputNumber || inputNumber.dataset.sanitizerBound) return;
  inputNumber.addEventListener('input', () => {
    inputNumber.value = String(inputNumber.value).replace(/[^\d]/g, '');
  });
  inputNumber.addEventListener('blur', () => {
    const n = Math.max(0, Math.floor(Number(inputNumber.value || 0)));
    inputNumber.value = String(n);
  });
  inputNumber.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && btnAddRow) {
      e.preventDefault();
      btnAddRow.click();
    }
  });
  inputNumber.dataset.sanitizerBound = '1';
}

function renderScheduleRows(rows = []) {
  if (!scheduleListEl) return;
  scheduleListEl.innerHTML = '';

  const tpl = Array.isArray(rows) && rows.length ? rows.slice() : [{ title: '', minutesPlanned: 0 }];

  for (let i = 0; i < tpl.length; i++) {
    const row = document.createElement('div');
    row.className = 'schedule-row';
    row.dataset.index = String(i);

    const inputTitle = document.createElement('input');
    inputTitle.type = 'text';
    inputTitle.placeholder = 'Название задания';
    inputTitle.value = tpl[i].title ?? '';

    const inputMinutes = document.createElement('input');
    inputMinutes.type = 'number';
    inputMinutes.min = '0';
    inputMinutes.step = '1';
    inputMinutes.placeholder = '0';
    inputMinutes.value = String(tpl[i].minutesPlanned ?? 0);
    bindMinutesSanitizer(inputMinutes);

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn';
    btnDel.textContent = 'Удалить';
    btnDel.addEventListener('click', () => {
      row.remove();
      updateScheduleSummary();
    });

    actions.appendChild(btnDel);
    row.append(inputTitle, inputMinutes, actions);
    scheduleListEl.appendChild(row);
  }

  updateScheduleSummary();

  if (!scheduleListEl.dataset.summaryBound) {
    scheduleListEl.addEventListener('input', (e) => {
      if (e.target && e.target.tagName === 'INPUT') updateScheduleSummary();
    });
    scheduleListEl.dataset.summaryBound = '1';
  }
}

function addEmptyRow() {
  if (!scheduleListEl) return;
  const row = document.createElement('div');
  row.className = 'schedule-row';

  const inputTitle = document.createElement('input');
  inputTitle.type = 'text';
  inputTitle.placeholder = 'Название задания';

  const inputMinutes = document.createElement('input');
  inputMinutes.type = 'number';
  inputMinutes.min = '0';
  inputMinutes.step = '1';
  inputMinutes.placeholder = '0';
  bindMinutesSanitizer(inputMinutes);

  const actions = document.createElement('div');
  actions.className = 'row-actions';

  const btnDel = document.createElement('button');
  btnDel.type = 'button';
  btnDel.className = 'btn';
  btnDel.textContent = 'Удалить';
  btnDel.addEventListener('click', () => {
    row.remove();
    updateScheduleSummary();
  });

  actions.appendChild(btnDel);
  row.append(inputTitle, inputMinutes, actions);
  scheduleListEl.appendChild(row);

  inputTitle.focus();
  showScheduleErrors([]);
  updateScheduleSummary();
}

function updateScheduleSummary() {
  if (!scheduleListEl) return;
  let count = 0;
  let total = 0;

  const rows = Array.from(scheduleListEl.querySelectorAll('.schedule-row') || []);
  for (const r of rows) {
    const [inputTitle, inputMinutes] = r.querySelectorAll('input');
    const title = String(inputTitle?.value ?? '').trim();
    const minutes = Math.max(0, Math.floor(Number(inputMinutes?.value ?? 0)));
    if (title || minutes > 0) {
      count += 1;
      total += minutes;
    }
  }

  const elSchedCount = document.querySelector('[data-sched-count]');
  const elSchedTotal = document.querySelector('[data-sched-total]');
  if (elSchedCount) elSchedCount.textContent = `${count} строк`;
  if (elSchedTotal) elSchedTotal.textContent = `${total} мин`;
}

function bindScheduleHeader(handlers = {}) {
  if (weekdaySwitch && !weekdaySwitch.dataset.bound) {
    weekdaySwitch.addEventListener('click', (ev) => {
      const target = ev.target;
      if (target && target.matches('button[data-weekday]')) {
        const wd = target.dataset.weekday;
        weekdaySwitch.querySelectorAll('button[data-weekday]').forEach((b) => {
          b.classList.toggle('active', b === target);
        });
        handlers.onWeekdayPick?.(wd);
      }
    });
    weekdaySwitch.dataset.bound = '1';
  }

  if (btnAddRow && !btnAddRow.dataset.bound) {
    btnAddRow.addEventListener('click', () => {
      handlers.onAddRow?.();
    });
    btnAddRow.dataset.bound = '1';
  }

  if (btnSaveTpl && !btnSaveTpl.dataset.bound) {
    btnSaveTpl.addEventListener('click', () => handlers.onSaveTpl?.());
    btnSaveTpl.dataset.bound = '1';
  }

  if (btnApplyTemplate && !btnApplyTemplate.dataset.bound) {
    btnApplyTemplate.addEventListener('click', () => handlers.onApplyTpl?.());
    btnApplyTemplate.dataset.bound = '1';
  }
}

export const scheduleUI = {
  bindHeader: bindScheduleHeader,
  renderRows: renderScheduleRows,
  updateSummary: updateScheduleSummary,
  showErrors: showScheduleErrors,
  addEmptyRow
};

/* ==============================
   Календарь (DOM)
   ============================== */

const calPrevBtn  = document.querySelector('[data-cal-prev]');
const calNextBtn  = document.querySelector('[data-cal-next]');
const calLabelEl  = document.querySelector('[data-cal-label]');
const calGridEl   = document.querySelector('[data-cal-grid]');

function setCalendarLabel(text) {
  if (calLabelEl) calLabelEl.textContent = String(text ?? '');
}

function weekdayMonFirst(date) {
  const js = date.getDay(); // 0..6, 0=Вс
  return js === 0 ? 7 : js; // 1..7, 1=Пн
}

function drawCalendarGrid(model = {}, handlers = {}) {
  const { year, month, selectedKey, todayKey } = model;
  if (!calGridEl || year == null || month == null) return;

  const firstDay = new Date(year, month, 1);
  const firstWeekday = weekdayMonFirst(firstDay);
  const leading = firstWeekday - 1;
  const totalCells = 42;
  const startDate = new Date(year, month, 1 - leading);

  calGridEl.innerHTML = '';

  for (let i = 0; i < totalCells; i++) {
    const d = addDaysLocal(startDate, i);
    const key = toDateKeyLocal(d);

    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    if (d.getMonth() !== month) cell.classList.add('outside');
    if (key === todayKey) cell.classList.add('today');
    if (key === selectedKey) cell.classList.add('selected');

    cell.textContent = String(d.getDate());
    cell.addEventListener('click', () => handlers.onSelectDate?.(key));

    calGridEl.appendChild(cell);
  }
}

function bindCalendarNav(handlers = {}) {
  if (calPrevBtn && !calPrevBtn.dataset.bound) {
    calPrevBtn.addEventListener('click', () => handlers.onPrev?.());
    calPrevBtn.dataset.bound = '1';
  }
  if (calNextBtn && !calNextBtn.dataset.bound) {
    calNextBtn.addEventListener('click', () => handlers.onNext?.());
    calNextBtn.dataset.bound = '1';
  }
}

export const calendarUI = {
  setLabel: setCalendarLabel,
  drawGrid: drawCalendarGrid,
  bindNav: bindCalendarNav
};

/* ==============================
   Helpers (локальные для ui)
   ============================== */

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
function escAttr(s) {
  return esc(s).replace(/"/g, '&quot;');
}

// Локальные аналоги date/toDateKey (чтобы не плодить импортов)
function addDaysLocal(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}
function toDateKeyLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default { renderStats, renderTasks, scheduleUI, calendarUI };
