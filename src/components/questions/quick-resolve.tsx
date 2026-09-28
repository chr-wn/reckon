"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { resolveQuestion } from "@/lib/actions/questions";
import { Button } from "../ui";

/** One-tap Yes / No for overdue binary questions; continuous ones link to the resolve form. */
export function QuickResolve({ id, type }: { id: string; type: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (type !== "binary") {
    return (
      <Link href={`/q/${id}#resolve`} className="text-xs font-medium text-accent-ink hover:underline">
        Enter result →
      </Link>
    );
  }
  const go = (resolution: "yes" | "no") =>
    start(async () => {
      const r = await resolveQuestion(id, { resolution });
      if (!r.ok) setError(r.error);
    });
  return (
    <div className="flex items-center gap-1.5">
      {error && <span className="text-xs text-bad-ink">{error}</span>}
      <Button size="xs" variant="yes" disabled={pending} onClick={() => go("yes")}>
        Yes
      </Button>
      <Button size="xs" variant="no" disabled={pending} onClick={() => go("no")}>
        No
      </Button>
    </div>
  );
}
