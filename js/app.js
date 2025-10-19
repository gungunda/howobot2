"use strict";

import { loadJSON, saveJSON } from "./storage.js";
import { toDateKey, getTomorrow } from "./date.js";
import { computeTotals } from "./compute.js";
import { renderStats } from "./ui.js";

function init() {
  console.log("[planner] init()");
  renderStats(); // временно просто тест
}

init();