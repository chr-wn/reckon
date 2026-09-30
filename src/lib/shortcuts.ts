/**
 * Option/Alt + key shortcuts for the composer (web app and Chrome extension).
 * Matched on the physical key (`KeyboardEvent.code`), so macOS's Option
 * characters (¥, ¬, µ…) don't matter and the shortcut works while typing in a
 * field. Letters that are dead keys on a Mac (⌥E, ⌥I, ⌥N, ⌥U, ⌥`) are avoided.
 */
export interface Shortcut {
  /** KeyboardEvent.code, e.g. "KeyY", "Digit1", "Slash" */
  code: string;
  /** shown to people, e.g. "⌥Y" */
  label: string;
  description: string;
  run: () => void;
}

interface KeyLike {
  code: string;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
}

/** Runs the matching shortcut and swallows the keystroke. Returns whether one ran. */
export function runAltShortcut(event: KeyLike, shortcuts: Shortcut[]): boolean {
  if (!event.altKey || event.metaKey || event.ctrlKey) return false;
  const hit = shortcuts.find((s) => s.code === event.code);
  if (!hit) return false;
  event.preventDefault();
  event.stopPropagation();
  hit.run();
  return true;
}
