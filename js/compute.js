// js/compute.js
'use strict';

// Нормализация одной задачи под расчёт
function norm(t) {
  const mp = Math.max(0, Math.floor(Number(t?.minutesPlanned ?? 0)));
  let dp = Math.round(Number(t?.donePercent ?? 0));
  if (!Number.isFinite(dp)) dp = 0;
  dp = Math.max(0, Math.min(100, dp));
  const isDone = !!(t?.isDone || dp >= 100);
  return { minutesPlanned: mp, donePercent: dp, isDone };
}

/**
 * computeTotals(tasks) -> { planned, done, left, percent }
 * planned — сумма плановых минут
 * done    — сумма выполненных минут (из процентов)
 * left    — оставшиеся минуты
 * percent — общий % выполнения (округлённый)
 */
export function computeTotals(tasks = []) {
  let planned = 0;
  let done = 0;
  for (const raw of (Array.isArray(tasks) ? tasks : [])) {
    const t = norm(raw);
    planned += t.minutesPlanned;
    done += Math.round(t.minutesPlanned * t.donePercent / 100);
  }
  if (done > planned) done = planned;
  const left = Math.max(0, planned - done);
  const percent = planned > 0 ? Math.round((done / planned) * 100) : 0;
  return { planned, done, left, percent };
}

/**
 * etaFromNow(tasks) -> строка
 * ("всё готово" | "сегодня к HH:MM" | "завтра к HH:MM" | "ДД.ММ.ГГГГ к HH:MM")
 * Поведение прежнее.
 */
export function etaFromNow(tasks = [], now = new Date()) {
  const { left } = computeTotals(tasks);
  if (left <= 0) return 'всё готово';
  const finish = new Date(now.getTime() + left * 60 * 1000);
  const day = relDay(finish, now);
  const time = hhmm(finish);
  return day === 'сегодня' ? `сегодня к ${time}` : `${day} к ${time}`;
}

function hhmm(d) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function relDay(target, now) {
  const a = new Date(now); a.setHours(0,0,0,0);
  const b = new Date(target); b.setHours(0,0,0,0);
  const diff = Math.round((b - a) / 86400000);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === 2) return 'послезавтра';
  return b.toLocaleDateString('ru-RU', { year:'numeric', month:'2-digit', day:'2-digit' });
}

export default { computeTotals, etaFromNow };
