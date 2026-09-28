"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const LINKS = [
  { href: "/", label: "Predictions" },
  { href: "/stats", label: "Stats" },
];

export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" || pathname.startsWith("/q/") : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn("rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3", active ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink")}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
