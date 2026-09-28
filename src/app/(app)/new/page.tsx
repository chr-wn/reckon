import type { Metadata } from "next";
import Link from "next/link";
import { QuestionComposer } from "@/components/composer/question-composer";
import { TypeIcon } from "@/components/questions/bits";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getComposerData } from "@/lib/data/composer";
import { IDEA_CATEGORIES, IDEAS } from "@/lib/ideas";
import type { QType } from "@/lib/scoring/records";

export const metadata: Metadata = { title: "New prediction" };

const TYPES = new Set(["binary", "numeric", "duration", "date"]);

export default async function NewQuestionPage({ searchParams }: PageProps<"/new">) {
  const user = await requireUser();
  const sp = await searchParams;
  const composer = await getComposerData(user.id);
  const title = typeof sp.title === "string" ? sp.title.slice(0, 300) : undefined;
  const type = typeof sp.type === "string" && TYPES.has(sp.type) ? (sp.type as QType) : undefined;
  const groupParam = typeof sp.group === "string" ? sp.group : null;
  const defaultGroupIds = groupParam && composer.groups.some((g) => g.id === groupParam) ? [groupParam] : composer.groups.map((g) => g.id);

  return (
    <div>
      <PageHeader title="New prediction" subtitle="Commit to a number. Future-you will check your work." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <QuestionComposer
          key={`${title ?? ""}|${type ?? ""}`}
          mode="full"
          groups={composer.groups}
          defaultGroupIds={defaultGroupIds}
          tags={composer.tags}
          track={composer.track}
          tz={user.timezone}
          initial={{ title, type }}
        />
        <aside>
          <h2 className="mb-1 font-semibold text-ink">Need ideas?</h2>
          <p className="mb-4 text-sm text-ink-3">
            Good practice questions resolve soon, are unambiguous, and are things you&apos;re genuinely unsure about.
          </p>
          <div className="space-y-5">
            {IDEA_CATEGORIES.map((cat) => (
              <div key={cat}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">{cat}</h3>
                <ul className="space-y-0.5">
                  {IDEAS.filter((i) => i.category === cat).map((i) => (
                    <li key={i.title}>
                      <Link
                        href={`/new?${new URLSearchParams({ title: i.title, type: i.type })}`}
                        className="group flex gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
                        title={i.why}
                        scroll={false}
                      >
                        <TypeIcon type={i.type} className="mt-0.5" size={14} />
                        <span>{i.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
