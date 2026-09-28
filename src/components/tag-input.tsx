"use client";

import { X } from "lucide-react";
import { useState } from "react";

const clean = (t: string) =>
  t
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 32);

export function TagInput({
  value,
  onChange,
  suggestions = [],
  id,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  id?: string;
}) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const t = clean(raw);
    if (t && !value.includes(t) && value.length < 8) onChange([...value, t]);
    setText("");
  };
  const unused = suggestions.filter((s) => !value.includes(s)).slice(0, 6);
  return (
    <div>
      <div className="field flex min-h-[2.6rem] flex-wrap items-center gap-1.5 py-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-surface-2 py-0.5 pl-2 pr-1 text-sm text-ink-2">
            #{t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="rounded p-0.5 hover:bg-surface-3" aria-label={`Remove ${t}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,\s]$/.test(v)) add(v);
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && add(text)}
          placeholder={value.length ? "" : "homework, gym, work…"}
          className="min-w-24 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-ink-3"
        />
      </div>
      {unused.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {unused.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-md px-1.5 py-0.5 text-xs text-ink-3 hover:bg-surface-2 hover:text-ink-2">
              +#{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
