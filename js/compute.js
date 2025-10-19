"use strict";

export function computeTotals(tasks = []) {
  const total = tasks.reduce((sum, t) => sum + (t.minutes || 0), 0);
  const done = tasks.filter(t => t.done).reduce((sum, t) => sum + (t.minutes || 0), 0);
  return { total, done, left: total - done };
}
