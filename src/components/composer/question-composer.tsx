"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createQuestion } from "@/lib/actions/questions";
import { PLACEHOLDERS } from "@/lib/ideas";
import type { TrackRecord } from "@/lib/scoring/records";
import { ComposerForm } from "./composer-form";

export interface ComposerProps {
  track: TrackRecord;
  tz: string;
  /** chosen on the server so SSR and hydration agree */
  placeholderIndex?: number;
}

export function QuestionComposer({ track, tz, placeholderIndex = 0 }: ComposerProps) {
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const [saved, setSaved] = useState<{ id: string; title: string } | null>(null);
  return (
    <div className="space-y-3">
      {saved && (
        <div className="flex items-center gap-3 rounded-xl border border-good/30 bg-good-soft px-4 py-2.5 text-sm text-good-ink">
          <Check size={16} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            Posted: <span className="font-medium">{saved.title}</span>
          </span>
          <Link href={`/q/${saved.id}`} className="shrink-0 font-medium underline underline-offset-2">
            View
          </Link>
          <button onClick={() => setSaved(null)} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}
      <ComposerForm
        key={formKey}
        track={track}
        tz={tz}
        placeholder={PLACEHOLDERS[placeholderIndex % PLACEHOLDERS.length]}
        captureStrayTyping
        // After posting, land back in an empty box ready for the next one.
        initial={formKey > 0 ? { focus: "title" } : undefined}
        submit={createQuestion}
        onCreated={({ id, title, input }) => {
          if (input.type === "duration" && input.startTimer) return router.push(`/q/${id}`);
          setSaved({ id, title });
          setFormKey((k) => k + 1);
        }}
      />
    </div>
  );
}
