"use strict";

export function toDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}