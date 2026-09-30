"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, ErrorText } from "@/components/ui";
import { addComment, deleteComment } from "@/lib/actions/questions";

export function CommentBox({ questionId }: { questionId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function post() {
    if (pending || !body.trim()) return;
    start(async () => {
      const r = await addComment(questionId, body);
      if (!r.ok) setError(r.error);
      else {
        setBody("");
        setError(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        rows={1}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            post();
          }
        }}
        placeholder="Add a comment…"
        className="field field-sizing-content min-h-10 resize-y text-sm"
        aria-label="Comment"
        aria-keyshortcuts="Meta+Enter"
      />
      <ErrorText>{error}</ErrorText>
      {body.trim() && (
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-ink-3">
            <kbd className="font-sans">⌘↵</kbd> to post
          </span>
          <Button size="sm" variant="secondary" disabled={pending} onClick={post}>
            Comment
          </Button>
        </div>
      )}
    </div>
  );
}

export function DeleteCommentButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => void (await deleteComment(id)))}
      className="text-ink-3 opacity-0 transition-opacity hover:text-bad-ink group-hover:opacity-100 focus:opacity-100"
      aria-label="Delete comment"
    >
      <Trash2 size={14} />
    </button>
  );
}
