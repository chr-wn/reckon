import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { QuestionList } from "@/components/questions/question-list";
import { QuickResolve } from "@/components/questions/quick-resolve";
import { ButtonLink, cn, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { TYPE_LABELS } from "@/lib/constants";
import { listQuestions, type ListScope, type ListStatus } from "@/lib/data/questions";
import type { Question } from "@/lib/db/schema";
import { requestNow } from "@/lib/request-time";

export const metadata: Metadata = { title: "Questions" };

const STATUSES: { key: ListStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "resolve", label: "To resolve" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];
const SCOPES: { key: ListScope; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "mine", label: "Mine" },
  { key: "friends", label: "Friends'" },
];
const TYPES = Object.keys(TYPE_LABELS) as Question["type"][];

export default async function QuestionsPage({ searchParams }: PageProps<"/questions">) {
  const user = await requireUser();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const status = (STATUSES.find((s) => s.key === str("status"))?.key ?? "open") as ListStatus;
  const scope = (SCOPES.find((s) => s.key === str("scope"))?.key ?? "all") as ListScope;
  const type = TYPES.find((t) => t === str("type"));
  const tag = str("tag")?.toLowerCase();
  const search = str("q")?.trim().slice(0, 100);
  const rows = await listQuestions(user.id, { status, scope, type, tag, search });

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { status, scope, type, tag, q: search, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "status" && v === "open") && !(k === "scope" && v === "all")) next.set(k, v);
    const s = next.toString();
    return s ? `/questions?${s}` : "/questions";
  };
  const pill = (active: boolean) =>
    cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", active ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface-2 hover:text-ink");

  return (
    <div>
      <PageHeader title="Questions" actions={<ButtonLink href="/new">New prediction</ButtonLink>} />
      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-1">
          {STATUSES.map((s) => (
            <Link key={s.key} href={href({ status: s.key })} className={pill(status === s.key)}>
              {s.label}
            </Link>
          ))}
          <span className="mx-2 h-5 w-px bg-line-strong" />
          {SCOPES.map((s) => (
            <Link key={s.key} href={href({ scope: s.key })} className={pill(scope === s.key)}>
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/questions" className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            {status !== "open" && <input type="hidden" name="status" value={status} />}
            {scope !== "all" && <input type="hidden" name="scope" value={scope} />}
            {type && <input type="hidden" name="type" value={type} />}
            {tag && <input type="hidden" name="tag" value={tag} />}
            <input name="q" defaultValue={search} placeholder="Search questions" className="field py-1.5 pl-9 text-sm" />
          </form>
          <div className="flex flex-wrap gap-1">
            {TYPES.map((t) => (
              <Link key={t} href={href({ type: type === t ? undefined : t })} className={cn(pill(type === t), "py-1 text-xs")}>
                {TYPE_LABELS[t]}
              </Link>
            ))}
          </div>
          {tag && (
            <Link href={href({ tag: undefined })} className={cn(pill(true), "py-1 text-xs")}>
              #{tag} ×
            </Link>
          )}
        </div>
      </div>
      {rows.length ? (
        <QuestionList
          rows={rows}
          viewerId={user.id}
          tz={user.timezone}
          now={requestNow()}
          trailing={status === "resolve" ? (q) => (q.authorId === user.id ? <QuickResolve id={q.id} type={q.type} /> : null) : undefined}
        />
      ) : (
        <EmptyState
          title={status === "resolve" ? "Nothing waiting on you" : "No questions here yet"}
          action={status !== "resolve" ? <ButtonLink href="/new">Make a prediction</ButtonLink> : undefined}
        >
          {search || tag || type ? "Try clearing the filters." : null}
        </EmptyState>
      )}
    </div>
  );
}
