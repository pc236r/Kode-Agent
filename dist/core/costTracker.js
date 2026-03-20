import chalk from "chalk";
import { formatDuration } from "@utils/terminal/format";
const STATE = {
  totalCost: 0,
  totalAPIDuration: 0,
  startTime: Date.now(),
};
export function addToTotalCost(cost, duration) {
  STATE.totalCost += cost;
  STATE.totalAPIDuration += duration;
}
export function getTotalCost() {
  return STATE.totalCost;
}
export function getTotalDuration() {
  return Date.now() - STATE.startTime;
}
export function getTotalAPIDuration() {
  return STATE.totalAPIDuration;
}
function formatCost(cost) {
  return `$${cost > 0.5 ? round(cost, 100).toFixed(2) : cost.toFixed(4)}`;
}
export function formatTotalCost() {
  return chalk.grey(`Total cost: ${formatCost(STATE.totalCost)}
Total duration (API): ${formatDuration(STATE.totalAPIDuration)}
Total duration (wall): ${formatDuration(getTotalDuration())}`);
}
function round(number, precision) {
  return Math.round(number * precision) / precision;
}
export function resetStateForTests() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("resetStateForTests can only be called in tests");
  }
  STATE.startTime = Date.now();
  STATE.totalCost = 0;
  STATE.totalAPIDuration = 0;
}
//# sourceMappingURL=costTracker.js.map
