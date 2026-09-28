"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui";
import { regenerateInvite } from "@/lib/actions/groups";

const subscribe = () => () => {};

export function InviteBox({ groupId, code, isOwner }: { groupId: string; code: string; isOwner: boolean }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const url = `${origin}/invite/${code}`;
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div>
      <div className="flex gap-2">
        <input readOnly value={url} className="field min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-ink-3">
        <span>Anyone with this link can join (and sign up if they&apos;re new).</span>
        {isOwner && (
          <button
            type="button"
            disabled={pending}
            onClick={() => confirm("Make a new link? The old one will stop working.") && start(async () => void (await regenerateInvite(groupId)))}
            className="inline-flex shrink-0 items-center gap-1 hover:text-ink-2"
          >
            <RefreshCw size={12} /> New link
          </button>
        )}
      </div>
    </div>
  );
}
