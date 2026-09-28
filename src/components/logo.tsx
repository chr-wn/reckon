import { APP_NAME } from "@/lib/constants";

/** Wordmark: a tiny calibration plot (dots hugging the diagonal) + the name. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="15" fill="var(--ink)" />
        <path d="M14 50 L50 14" stroke="var(--ink-3)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="22" cy="44" r="5.5" fill="var(--accent)" />
        <circle cx="33" cy="29" r="5.5" fill="var(--accent)" />
        <circle cx="45" cy="21" r="5.5" fill="var(--accent)" />
      </svg>
      {!compact && <span className="font-serif text-[1.6rem] leading-none tracking-[-0.01em]">{APP_NAME}</span>}
    </span>
  );
}
