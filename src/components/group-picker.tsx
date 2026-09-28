"use client";

import { Lock, Users } from "lucide-react";
import { cn } from "./ui";

export function GroupPicker({
  groups,
  value,
  onChange,
}: {
  groups: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const chip = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors",
      active ? "border-ink bg-ink text-surface" : "border-line-strong text-ink-2 hover:text-ink",
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className={chip(value.length === 0)} onClick={() => onChange([])}>
        <Lock size={14} /> Only me
      </button>
      {groups.map((g) => {
        const active = value.includes(g.id);
        return (
          <button
            key={g.id}
            type="button"
            className={chip(active)}
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((x) => x !== g.id) : [...value, g.id])}
          >
            <Users size={14} /> {g.name}
          </button>
        );
      })}
    </div>
  );
}
