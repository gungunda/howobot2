// js/ui.js
// Отрисовка интерфейса для «Лёшин планировщик».
// Здесь только работа с DOM: вставляем данные в HTML, обновляем текст, реагируем на клики.

'use strict';

/* ==============================
   Основные селекторы DOM
   ============================== */

// Лучше использовать data-атрибуты, чтобы не зависеть от классов оформления
const statsElements = {
  planned: document.querySelector('[data-stat="planned"]'),
  done: document.querySelector('[data-stat="done"]'),
  left: document.querySelector('[data-stat="left"]'),
  eta: document.querySelector('[data-stat="eta"]'),
};

const taskList = document.querySelector('[data-tasks]');
const emptyMessage = document.querySelector('[data-empty]');
const dayLabel = document.querySelector('[data-day-label]');

// Эти элементы должны быть в index.html, иначе просто не обновятся.
// Если что-то не найдено — предупредим в консоли.
for (const key in statsElements) {
  if (!statsElements[key]) {
    console.warn(`[planner] ui: missing stats element for ${key}`);
  }
}
if (!taskList) console.warn('[planner] ui: missing [data-tasks] container');

/* ==============================
   Вспомогательные функции
   ============================== */

/**
 * Очищает содержимое DOM-элемента.
 */
function clearElement(el) {
  if (el) el.innerHTML = '';
}

/**
 * Создаёт DOM-элемент задачи.
 * @param {object} task - одна задача ({id, title, minutesPlanned, minutesDone, isDone})
 * @returns {HTMLElement} <div class="task-item">...</div>
 */
function createTaskElement(task) {
  const wrapper = document.createElement('div');
  wrapper.className = 'task-item';

  // Чекбокс
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = !!task.isDone;
  checkbox.dataset.id = task.id;
  checkbox.className = 'task-checkbox';

  // Текст задания
  const label = document.createElement('label');
  label.textContent = task.title;
  label.className = 'task-title';

  // Минуты (план)
  const minutes = document.createElement('span');
  minutes.className = 'task-minutes';
  minutes.textContent = `${task.minutesPlanned} мин`;

  // Если задача выполнена — добавим визуальный стиль
  if (task.isDone) wrapper.classList.add('done');

  wrapper.append(checkbox, label, minutes);
  return wrapper;
}

/**
 * Навешивает обработчики кликов на чекбоксы.
 * @param {HTMLElement} container
 * @param {object} handlers - { onToggle(id:boolean) }
 */
function bindTaskHandlers(container, handlers = {}) {
  if (!container || !handlers.onToggle) return;

  container.addEventListener('change', (ev) => {
    const target = ev.target;
    if (target && target.matches('input[type="checkbox"][data-id]')) {
      const id = target.dataset.id;
      const isDone = target.checked;
      handlers.onToggle(id, isDone);
    }
  });
}

/* ==============================
   Основные функции отрисовки
   ============================== */

/**
 * Обновляет сводные показатели (4 блока вверху).
 * @param {object} totals - { planned, done, left, percent }
 * @param {string} etaText - текст финиш-оценки
 */
export function renderStats(totals, etaText = '') {
  if (!totals || typeof totals !== 'object') return;

  if (statsElements.planned)
    statsElements.planned.textContent = `${totals.planned} мин`;

  if (statsElements.done)
    statsElements.done.textContent = `${totals.done} мин (${totals.percent}%)`;

  if (statsElements.left)
    statsElements.left.textContent = `${totals.left} мин`;

  if (statsElements.eta)
    statsElements.eta.textContent = etaText || '';
}

/**
 * Отрисовывает список задач для выбранного дня.
 * @param {Array} tasks
 * @param {object} [handlers] - { onToggle(id:boolean) }
 * @param {string} [labelText] - подпись дня (например, "Завтра" или "Понедельник 20 октября")
 */
export function renderTasks(tasks = [], handlers = {}, labelText = '') {
  if (!taskList) return;

  clearElement(taskList);

  if (Array.isArray(tasks) && tasks.length > 0) {
    for (const t of tasks) {
      const el = createTaskElement(t);
      taskList.appendChild(el);
    }
    if (emptyMessage) emptyMessage.style.display = 'none';
  } else {
    // Если задач нет
    if (emptyMessage) {
      emptyMessage.style.display = 'block';
      emptyMessage.textContent = 'Нет заданий на этот день.';
    }
  }

  if (dayLabel) dayLabel.textContent = labelText || '';

  // Навесим обработчики чекбоксов
  bindTaskHandlers(taskList, handlers);
}

/* ==============================
   Default export
   ============================== */

export default {
  renderStats,
  renderTasks,
};
