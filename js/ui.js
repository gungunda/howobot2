"use strict";

export function renderStats() {
  const elTotal = document.getElementById("stat-total");
  const elDone = document.getElementById("stat-done");
  const elLeft = document.getElementById("stat-left");
  const elEta = document.getElementById("stat-eta");

  elTotal.textContent = "0";
  elDone.textContent = "0";
  elLeft.textContent = "0";
  elEta.textContent = "—";
}