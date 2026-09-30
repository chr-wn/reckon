import type { ComposerInitial } from "@/components/composer/composer-form";
import { readOpenEvent, predictionForEvent } from "./calendar-event";
import { launchUrl, type ComposerMessage } from "./messages";

/**
 * The in-page composer: a full-viewport, transparent iframe of the extension's
 * composer page (so the page's CSS can't touch it), plus a small toast after
 * posting. Runs in the content-script world of whatever page you're on.
 */

const FRAME_ID = "reckon-composer-frame";

interface OverlayState {
  frame: HTMLIFrameElement;
  previousFocus: Element | null;
  onMessage: (e: MessageEvent) => void;
}

const state: { current: OverlayState | null; shielded?: boolean } = ((
  window as unknown as { __reckonOverlay?: { current: OverlayState | null; shielded?: boolean } }
).__reckonOverlay ??= { current: null });

/**
 * Modal dialogs (Google Calendar's event bubble) trap focus and would pull it straight back out of the
 * composer, so hide focus moving to or from our frame from the page. Capture listeners run in the order
 * they were added: call this at document_start on pages whose own scripts listen on window.
 */
export function shieldFocus() {
  if (state.shielded) return;
  state.shielded = true;
  const onFocusChange = (e: FocusEvent) => {
    const frame = state.current?.frame;
    if (frame && (e.target === frame || e.relatedTarget === frame)) e.stopImmediatePropagation();
  };
  for (const type of ["focusin", "focusout", "focus", "blur"]) window.addEventListener(type, onFocusChange as EventListener, true);
}

export const isComposerOpen = () => state.current != null;

export function closeComposer() {
  const open = state.current;
  if (!open) return;
  state.current = null;
  window.removeEventListener("message", open.onMessage);
  open.frame.remove();
  if (open.previousFocus instanceof HTMLElement) open.previousFocus.focus();
}

export function openComposer(prefill?: ComposerInitial) {
  closeComposer();
  const frame = document.createElement("iframe");
  frame.id = FRAME_ID;
  frame.src = launchUrl({ mode: "overlay", prefill });
  frame.allow = "clipboard-write";
  frame.setAttribute("aria-label", "Reckon: new prediction");
  // `color-scheme: light dark` matches the composer page's own scheme, which keeps the iframe transparent
  frame.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;border:0;margin:0;padding:0;z-index:2147483647;background:transparent;color-scheme:light dark;";
  const onMessage = (e: MessageEvent) => {
    if (e.source !== frame.contentWindow) return;
    const message = e.data as ComposerMessage;
    if (message?.reckon === "close") closeComposer();
    if (message?.reckon === "posted") {
      closeComposer();
      showToast(message);
    }
  };
  window.addEventListener("message", onMessage);
  shieldFocus();
  state.current = { frame, previousFocus: document.activeElement, onMessage };
  document.documentElement.appendChild(frame);
  // focus now and again once loaded: whichever comes after the page settles wins
  frame.focus();
  frame.addEventListener("load", () => frame.focus(), { once: true });
}

/** Same shortcut or button again closes it. */
export function toggleComposer(prefill?: ComposerInitial) {
  if (isComposerOpen()) closeComposer();
  else openComposer(prefill);
}

const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** What to start the composer with: the open Calendar event, else the selected text. */
export function prefillFromPage(): ComposerInitial | undefined {
  if (location.hostname === "calendar.google.com") {
    const event = readOpenEvent(document);
    if (event) return predictionForEvent(event, browserTz());
  }
  const selection = clean(window.getSelection()?.toString());
  if (selection && selection.length <= 300) return { title: selection, focus: "title" };
  return undefined;
}

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

function showToast(message: Extract<ComposerMessage, { reckon: "posted" }>) {
  document.getElementById("reckon-toast")?.remove();
  const host = document.createElement("div");
  host.id = "reckon-toast";
  host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  const box = document.createElement("div");
  box.setAttribute("role", "status");
  box.style.cssText =
    "font:500 13px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;color:#f4f3ee;background:#1a1a19;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px 14px;box-shadow:0 8px 24px -8px rgba(0,0,0,.5);display:flex;gap:10px;align-items:center;max-width:380px;";
  const text = document.createElement("span");
  text.textContent = `✓ Posted to Reckon${message.copied ? " · link copied" : ""}`;
  const link = document.createElement("a");
  link.href = message.url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Open";
  link.style.cssText = "color:#86b6ef;text-decoration:none;font-weight:600;";
  box.append(text, link);
  root.append(box);
  document.documentElement.appendChild(host);
  setTimeout(() => host.remove(), 5000);
}
