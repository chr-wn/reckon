"use client";

import { Check, Pause, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { finishTimer, timerControl } from "@/lib/actions/questions";
import { fmtClock, fmtDuration } from "@/lib/format";
import { Button, Card, cn } from "../ui";

export interface TimerState {
  id: string;
  title: string;
  runningSince: number | null;
  accumulatedMs: number;
  median: number | null;
  low: number | null;
  high: number | null;
}

/** Ticks every second while active. Starts from the server's clock so SSR and hydration render identically. */
function useNow(active: boolean, serverNow: number) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [active]);
  return now;
}

/** Live task timer: elapsed time vs. your own forecast, with pause / done. */
export function TimerCard({
  t,
  serverNow,
  showTitle = true,
  allowReset = false,
}: {
  t: TimerState;
  serverNow: number;
  showTitle?: boolean;
  allowReset?: boolean;
}) {
  const router = useRouter();
  const running = t.runningSince != null;
  const now = useNow(running, serverNow);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const elapsed = t.accumulatedMs + (running ? now - t.runningSince! : 0);
  const minutes = elapsed / 60000;

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong");
      else after?.();
    });

  const pastHigh = t.high != null && minutes > t.high;
  const pastMedian = t.median != null && minutes > t.median;
  const progress = t.high ? Math.min(1, minutes / t.high) : 0;

  return (
    <Card className="p-4 sm:p-5">
      {showTitle && (
        <Link href={`/q/${t.id}`} className="mb-2 block font-medium text-ink hover:underline">
          {t.title}
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-2.5 w-2.5 rounded-full", running ? "pulse-dot bg-bad" : "bg-ink-3")} aria-hidden />
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-ink">{fmtClock(elapsed)}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {running ? (
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => act(() => timerControl(t.id, "pause"))}>
              <Pause size={14} /> Pause
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => act(() => timerControl(t.id, "start"))}>
              <Play size={14} /> {elapsed > 0 ? "Resume" : "Start"}
            </Button>
          )}
          <Button
            size="sm"
            disabled={pending || elapsed <= 0}
            onClick={() => act(() => finishTimer(t.id), () => router.push(`/q/${t.id}?done=1`))}
          >
            <Check size={14} /> Done
          </Button>
          {allowReset && elapsed > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              title="Reset the timer and reopen forecasting"
              onClick={() => confirm("Reset the timer? This reopens forecasting on the task.") && act(() => timerControl(t.id, "reset"))}
            >
              <RotateCcw size={14} />
            </Button>
          )}
        </div>
      </div>
      {t.median != null && (
        <div className="mt-3">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className={cn("absolute inset-y-0 left-0 rounded-full transition-[width]", pastHigh ? "bg-bad" : pastMedian ? "bg-warn" : "bg-accent")}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-3">
            You guessed <span className="font-medium text-ink-2">{fmtDuration(t.median)}</span>
            {t.low != null && t.high != null && (
              <>
                {" "}
                ({fmtDuration(t.low)}–{fmtDuration(t.high)})
              </>
            )}
            {pastHigh ? " · now past your high end" : pastMedian ? " · past your best guess" : ""}
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-bad-ink">{error}</p>}
    </Card>
  );
}
