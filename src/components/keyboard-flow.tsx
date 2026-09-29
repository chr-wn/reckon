"use client";

import { useRef, type ReactNode } from "react";

/**
 * Keyboard-first forms:
 *   Enter        → focus the next field marked `data-flow` (or the `data-flow-end` button)
 *   Shift+Enter  → left alone (newline in textareas)
 *   ⌘/Ctrl+Enter → submit, from any field
 * `data-flow-from` marks controls (like sliders) that advance on Enter but aren't stops themselves.
 */
export function KeyboardFlow({ onSubmit, children, className }: { onSubmit: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={className}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          onSubmit();
          return;
        }
        if (e.shiftKey || e.altKey) return;
        const target = e.target as HTMLElement;
        if (!target.hasAttribute("data-flow") && !target.hasAttribute("data-flow-from")) return;
        e.preventDefault();
        const all = [...ref.current!.querySelectorAll<HTMLElement>("[data-flow], [data-flow-from], [data-flow-end]")];
        const next = all
          .slice(all.indexOf(target) + 1)
          .find((el) => !el.hasAttribute("data-flow-from") && !el.matches(":disabled") && el.getClientRects().length > 0);
        next?.focus();
      }}
    >
      {children}
    </div>
  );
}
