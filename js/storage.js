// js/storage.js
'use strict';

const KEY = 'planner.state.v1';

export function loadState(defaults = {}) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(defaults);
    const parsed = JSON.parse(raw);
    return deepMerge(clone(defaults), parsed);
  } catch {
    return clone(defaults);
  }
}

export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state ?? {})); }
  catch (e) { console.error('[storage] save failed:', e); }
}

/* helpers */
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));
function deepMerge(a, b) {
  if (!isObj(a) || !isObj(b)) return clone(b);
  const out = { ...a };
  for (const k of Object.keys(b)) {
    const av = a[k], bv = b[k];
    out[k] = (isObj(av) && isObj(bv)) ? deepMerge(av, bv) : clone(bv);
  }
  return out;
}

export default { loadState, saveState };
