import { howLongForEvent, openDetailsDialog, predictionForEvent, readOpenEvent, type CalendarEvent } from "./calendar-event";
import { isComposerOpen, openComposer, shieldFocus } from "./overlay-core";
import type { ComposerInitial } from "@/components/composer/composer-form";

/**
 * Google Calendar: adds two Reckon rows to the event/task details bubble, with keys while it's open:
 *   F  "Will I finish <event> within <length>?"  (yes/no, cursor in the probability)
 *   L  "How long will <event> take?"             (best guess = the block's length, cursor on it)
 *
 * Runs at document_start: Calendar's own window-level key handlers swallow
 * keystrokes (and its bubble traps focus), so ours have to be added first.
 */

const ROWS_ID = "reckon-calendar-rows";
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

interface Kind {
  id: string;
  key: string;
  hint: string;
  prefill: (event: CalendarEvent) => ComposerInitial;
}
const KINDS: Kind[] = [
  { id: "reckon-calendar-row", key: "f", hint: "Will I finish it in this time? (F)", prefill: (event) => predictionForEvent(event, tz()) },
  { id: "reckon-calendar-howlong-row", key: "l", hint: "How long will it take? (L)", prefill: howLongForEvent },
];

function predictOpenEvent(kind: Kind): boolean {
  const event = readOpenEvent(document);
  if (!event) return false;
  openComposer(kind.prefill(event));
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

function makeRow(kind: Kind, event: CalendarEvent) {
  const row = document.createElement("button");
  row.id = kind.id;
  row.type = "button";
  row.title = `Make a Reckon prediction: ${kind.hint}`;
  row.setAttribute("aria-keyshortcuts", kind.key.toUpperCase());
  row.style.cssText =
    "all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;padding:8px 12px;border-radius:10px;cursor:pointer;font:500 14px/1.35 'Google Sans',Roboto,system-ui,sans-serif;color:inherit;border:1px solid color-mix(in srgb, currentColor 22%, transparent);";
  row.addEventListener("mouseenter", () => (row.style.background = "color-mix(in srgb, currentColor 7%, transparent)"));
  row.addEventListener("mouseleave", () => (row.style.background = "transparent"));
  const label = document.createElement("span");
  label.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  label.textContent = kind.prefill(event).title ?? "Predict with Reckon";
  const key = document.createElement("kbd");
  key.textContent = kind.key.toUpperCase();
  key.style.cssText =
    "font:600 11px/1 ui-monospace,monospace;padding:3px 6px;border-radius:5px;border:1px solid color-mix(in srgb, currentColor 30%, transparent);opacity:.8;";
  row.append(logoSvg(), label, key);
  return row;
}

function ensureRow() {
  const dialog = openDetailsDialog(document);
  if (!dialog || dialog.querySelector(`#${ROWS_ID}`)) return;
  const event = readOpenEvent(document);
  if (!event) return;
  const rows = document.createElement("div");
  rows.id = ROWS_ID;
  rows.style.cssText = "display:flex;flex-direction:column;gap:6px;width:calc(100% - 32px);margin:8px 16px 12px;box-sizing:border-box;";
  rows.append(...KINDS.map((kind) => makeRow(kind, event)));
  // Right under the title + time block: the first ancestor of the title holding more than the title.
  // (The bubble itself is a flex row, so appending to it would add a side column.)
  let block = dialog.querySelector("#rAECCd");
  while (block?.parentElement && block.parentElement !== dialog && clean(block.textContent) === event.title) block = block.parentElement;
  if (block) block.after(rows);
  else dialog.appendChild(rows);
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

shieldFocus();

// clicks on the row are caught here too, before Calendar's handlers can eat them
window.addEventListener(
  "click",
  (e) => {
    const kind = e.target instanceof Element ? KINDS.find((k) => e.target instanceof Element && e.target.closest(`#${k.id}`)) : undefined;
    if (!kind) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    predictOpenEvent(kind);
  },
  true,
);

function watchForBubbles() {
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureRow();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
  ensureRow();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchForBubbles);
else watchForBubbles();

window.addEventListener(
  "keydown",
  (e) => {
    const kind = KINDS.find((k) => k.key === e.key);
    if (!kind || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.isComposing || isComposerOpen()) return;
    if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
    if (predictOpenEvent(kind)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true,
);
