"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Avatar, Button, ErrorText } from "@/components/ui";
import { addComment, deleteComment } from "@/lib/actions/questions";

export interface CommentItem {
  id: string;
  body: string;
  when: string;
  user: { id: string; displayName: string };
}

export function Comments({ questionId, items, viewerId }: { questionId: string; items: CommentItem[]; viewerId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <ul className="space-y-4">
          {items.map((c) => (
            <li key={c.id} className="group flex gap-3">
              <Avatar name={c.user.displayName} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium text-ink">{c.user.displayName}</span>
                  <span className="text-xs text-ink-3">{c.when}</span>
                  {c.user.id === viewerId && (
                    <button
                      onClick={() => start(async () => void (await deleteComment(c.id)))}
                      className="ml-auto text-ink-3 opacity-0 transition-opacity hover:text-bad-ink group-hover:opacity-100 focus:opacity-100"
                      aria-label="Delete comment"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-ink-2">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment — reasoning, evidence, trash talk…"
          className="field field-sizing-content min-h-16 resize-y text-sm"
          aria-label="Comment"
        />
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || !body.trim()}
            onClick={() =>
              start(async () => {
                const r = await addComment(questionId, body);
                if (!r.ok) setError(r.error);
                else {
                  setBody("");
                  setError(null);
                }
              })
            }
          >
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
