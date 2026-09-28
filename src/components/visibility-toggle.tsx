"use client";

import { Globe, Lock } from "lucide-react";
import { cn } from "./ui";

export type Visibility = "public" | "private";

export function VisibilityToggle({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  const opt = (v: Visibility, label: string, Icon: typeof Globe, hint: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={value === v}
      title={hint}
      onClick={() => onChange(v)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
        value === v ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2",
      )}
    >
      <Icon size={14} /> {label}
    </button>
  );
  return (
    <div className="inline-flex rounded-lg bg-surface-2 p-0.5" role="radiogroup" aria-label="Who can see this">
      {opt("public", "Public", Globe, "Everyone signed in can see and forecast")}
      {opt("private", "Only me", Lock, "Only you can see this")}
    </div>
  );
}
