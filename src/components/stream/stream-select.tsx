"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "../ui";

/** A select that rewrites one URL search param (keeping the others). */
export function StreamSelect({
  name,
  value,
  options,
  params,
  label,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  params: Record<string, string>;
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        if (e.target.value === options[0].value) next.delete(name);
        else next.set(name, e.target.value);
        const qs = next.toString();
        start(() => router.push(qs ? `/?${qs}` : "/", { scroll: false }));
      }}
      className={cn("field w-auto py-1.5 text-sm", pending && "opacity-60")}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
