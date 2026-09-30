import { predictionForEvent, readOpenEvent } from "./calendar-event";
import { isComposerOpen, openComposer } from "./overlay-core";

/**
 * Google Calendar: adds a "Predict" row to the event-details bubble, and `f`
 * (for forecast) while the bubble is open. Either opens the composer with
 * "Will I finish <event> within <length>?" filled in and the cursor in the
 * probability box.
 */

const ROW_ID = "reckon-calendar-row";
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function predictOpenEvent(): boolean {
  const event = readOpenEvent(document);
  if (!event) return false;
  openComposer(predictionForEvent(event, tz()));
  return true;
}

function logoSvg() {
  // the Reckon mark (src/app/icon.svg)
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    '<rect width="64" height="64" rx="14" fill="#16150f"/><path d="M14 50 L50 14" stroke="#77756f" stroke-width="3" stroke-linecap="round"/><circle cx="22" cy="44" r="5" fill="#3987e5"/><circle cx="33" cy="29" r="5" fill="#3987e5"/><circle cx="45" cy="21" r="5" fill="#3987e5"/>';
  return svg;
}

function ensureRow() {
  const dialog = document.querySelector<HTMLElement>("#xDetDlg");
  if (!dialog || dialog.querySelector(`#${ROW_ID}`)) return;
  const event = readOpenEvent(document);
  if (!event) return;
  const row = document.createElement("button");
  row.id = ROW_ID;
  row.type = "button";
  row.title = "Make a Reckon prediction about this event (F)";
  row.setAttribute("aria-keyshortcuts", "F");
  row.style.cssText =
    "all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;width:calc(100% - 32px);margin:8px 16px 12px;padding:8px 12px;border-radius:10px;cursor:pointer;font:500 14px/1.35 'Google Sans',Roboto,system-ui,sans-serif;color:inherit;border:1px solid color-mix(in srgb, currentColor 22%, transparent);";
  row.addEventListener("mouseenter", () => (row.style.background = "color-mix(in srgb, currentColor 7%, transparent)"));
  row.addEventListener("mouseleave", () => (row.style.background = "transparent"));
  const label = document.createElement("span");
  label.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  label.textContent = predictionForEvent(event, tz()).title ?? "Predict with Reckon";
  const key = document.createElement("kbd");
  key.textContent = "F";
  key.style.cssText =
    "font:600 11px/1 ui-monospace,monospace;padding:3px 6px;border-radius:5px;border:1px solid color-mix(in srgb, currentColor 30%, transparent);opacity:.8;";
  row.append(logoSvg(), label, key);
  row.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    predictOpenEvent();
  });
  dialog.appendChild(row);
}

let scheduled = false;
new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    ensureRow();
  });
}).observe(document.body, { childList: true, subtree: true });
ensureRow();

window.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "f" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.isComposing || isComposerOpen()) return;
    if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
    if (predictOpenEvent()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true,
);
