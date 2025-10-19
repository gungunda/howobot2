// js/storage.js
// Работа с LocalStorage для «Лёшин планировщик»
// Идея проста: у нас есть небольшой «жёсткий диск» в браузере (LocalStorage).
// Мы кладём и читаем туда JSON-объекты безопасно и предсказуемо.

'use strict';

/* ==============================
   Константы и общий неймспейс
   ============================== */

// Префикс для всех ключей проекта, чтобы не конфликтовать с другими сайтами/скриптами.
export const STORAGE_PREFIX = 'planner.';

// Версия схемы данных. Если в будущем структура поменяется — увеличим число.
export const SCHEMA_VERSION = 1;

// Ключ состояния по версии схемы.
// Пример: 'planner.state.v1'
const STATE_KEY = getKey(`state.v${SCHEMA_VERSION}`);


/* ==============================
   Низкоуровневые утилиты
   ============================== */

/**
 * Собирает «неймспейсный» ключ: planner.<name>
 * Пример: getKey('state.v1') -> 'planner.state.v1'
 */
export function getKey(name) {
  return `${STORAGE_PREFIX}${name}`;
}

/**
 * Безопасно читает JSON из LocalStorage.
 * @param {string} key - ключ в LocalStorage
 * @param {any} fallback - что вернуть, если ключа нет или данные битые
 * @returns {any}
 *
 * Пояснение: если данные отсутствуют или сломаны, мы не падаем — выдаём fallback.
 */
export function loadJSON(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;

    const parsed = JSON.parse(raw);

    // Мини-проверка: JSON.parse может вернуть всё что угодно.
    // Если ожидается объект, а там число/строка/массив — вернём fallback.
    // Здесь проверим только «объектность», остальное валидируем выше по стеку.
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }

    console.warn('[planner] loadJSON: data is not an object for key:', key);
    return fallback;
  } catch (err) {
    console.warn('[planner] loadJSON: failed to parse JSON for key:', key, err);
    return fallback;
  }
}

/**
 * Безопасно пишет JSON в LocalStorage.
 * @param {string} key
 * @param {any} data - будет сериализован через JSON.stringify
 *
 * Пояснение: запись может упасть (например, переполнена квота).
 * В этом случае мы просто предупредим в консоли.
 */
export function saveJSON(key, data) {
  try {
    const raw = JSON.stringify(data);
    window.localStorage.setItem(key, raw);
  } catch (err) {
    console.warn('[planner] saveJSON: failed to save JSON for key:', key, err);
  }
}


/* ==============================
   Высокоуровневые хелперы состояния
   ============================== */

/**
 * Поверхностное слияние объектов: справа перекрывает слева.
 * Для junior: это простой способ «задать значения по умолчанию».
 */
function mergeShallow(baseObj, overrideObj) {
  // Создаём новый объект, чтобы не трогать исходники по ссылке
  const out = {};
  if (baseObj && typeof baseObj === 'object') {
    for (const k in baseObj) out[k] = baseObj[k];
  }
  if (overrideObj && typeof overrideObj === 'object') {
    for (const k in overrideObj) out[k] = overrideObj[k];
  }
  return out;
}

/**
 * Загружает состояние приложения из LocalStorage.
 * Гарантирует поле __schema с текущей версией.
 *
 * @param {object} defaults - значения по умолчанию, если в хранилище пусто
 * @returns {object} состояние
 *
 * Пример использования:
 * const state = loadState({ days: {}, selectedDate: null });
 */
export function loadState(defaults = {}) {
  const stored = loadJSON(STATE_KEY, null);
  // Если ничего нет — возьмём defaults.
  // Если что-то есть — поверхностно сольём: stored важнее defaults.
  const merged = stored
    ? mergeShallow(defaults, stored)
    : mergeShallow(defaults, {});

  // Всегда храним метку версии схемы — пригодится для будущих миграций.
  merged.__schema = SCHEMA_VERSION;
  return merged;
}

/**
 * Сохраняет состояние приложения в LocalStorage.
 * @param {object} state - объект состояния
 *
 * Пример использования:
 * saveState(state);
 */
export function saveState(state) {
  // На всякий случай убедимся, что пишем объект
  if (typeof state !== 'object' || state === null) {
    console.warn('[planner] saveState: expected object, got:', state);
    return;
  }
  // Дублируем версию схемы при сохранении
  const toSave = { ...state, __schema: SCHEMA_VERSION };
  saveJSON(STATE_KEY, toSave);
}


/* ==============================
   Подсказки по структуре (для чтения кода)
   ============================== */

// Рекомендованный «скелет» состояния (для понимания; не жёсткое требование):
// state = {
//   __schema: 1,               // версия схемы (автоматически проставляется)
//   selectedDate: 'YYYY-MM-DD',// какая дата выбрана сейчас в UI
//   days: {                    // словарь по дате
//     '2025-10-20': {
//       tasks: [
//         { id: 'm123', title: 'Математика: №1–5', minutesPlanned: 40, minutesDone: 0, isDone: false },
//         { id: 'ph001', title: 'Физика: §12 читать', minutesPlanned: 20, minutesDone: 0, isDone: false },
//       ]
//     },
//     // ...
//   }
// }
//
// Почему так удобно:
// - ключ даты — простая строка 'YYYY-MM-DD', легко искать и сравнивать;
// - tasks — массив однотипных объектов; UI просто «рисует список»;
// - minutesPlanned / minutesDone позволяют считать «Выполнено» и «Осталось».
// Позже (на следующих подшагах) мы дополним поля по необходимости.
