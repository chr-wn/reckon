"use client";

import { BarChart3, BookOpen, Dumbbell, Home, ListChecks, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/questions", label: "Questions", icon: ListChecks },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/drills", label: "Drills", icon: Dumbbell },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/learn", label: "Learn", icon: BookOpen },
];

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`) || (href === "/questions" && pathname.startsWith("/q/"));

export function DesktopNavLinks() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-0.5 md:flex">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            isActive(pathname, l.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {LINKS.filter((l) => l.href !== "/learn").map((l) => {
          const active = isActive(pathname, l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn("flex flex-col items-center gap-0.5 py-2 text-[0.6875rem] font-medium", active ? "text-ink" : "text-ink-3")}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
