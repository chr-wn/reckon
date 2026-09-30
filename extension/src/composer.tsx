import { Check, ExternalLink, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ComposerForm } from "@/components/composer/composer-form";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui";
import type { ActionResult } from "@/lib/actions/questions";
import { PLACEHOLDERS } from "@/lib/ideas";
import type { TrackRecord } from "@/lib/scoring/records";
import type { CreateQuestionInput } from "@/lib/validation";
import { RECKON_URL } from "./config";
import { readLaunch, type ApiResponse, type BackgroundRequest, type ComposerMessage } from "./messages";

interface Me {
  user: { username: string; displayName: string; avatarUrl: string | null; timezone: string };
  track: TrackRecord;
}

/** Until /api/me answers (a moment), nudges render as for someone with no history. */
const NO_HISTORY: TrackRecord = { binary: null, continuous: {}, binaryByTag: {}, continuousByTag: {} };

const launch = readLaunch(location.hash);
const placeholder = PLACEHOLDERS[Math.floor(Date.now() / 36e5) % PLACEHOLDERS.length];

const request = <T,>(message: BackgroundRequest) => chrome.runtime.sendMessage<BackgroundRequest, ApiResponse<T>>(message);
const openTab = (url: string) => void chrome.runtime.sendMessage<BackgroundRequest>({ type: "reckon:open-tab", url });

function tell(message: ComposerMessage) {
  window.parent.postMessage(message, "*");
}

function close() {
  if (launch.mode === "overlay") tell({ reckon: "close" });
  else window.close();
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [posted, setPosted] = useState<{ title: string; url: string; copied: boolean } | null>(null);

  useEffect(() => {
    void request<Me & { error?: string }>({ type: "reckon:api", method: "GET", path: "/api/me" }).then(({ status, data }) => {
      if (status === 200) setMe(data);
      else if (status === 401) setSignedOut(true);
      else setProblem(data.error ?? `Reckon answered ${status}.`);
    });
  }, []);

  // Esc closes even when focus has left the form
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submit(input: CreateQuestionInput): Promise<ActionResult<{ id: string }>> {
    const { status, data } = await request<{ id: string; error?: string }>({ type: "reckon:api", method: "POST", path: "/api/questions", body: input });
    if (status === 200) return { ok: true, data: { id: data.id } };
    if (status === 401) {
      setSignedOut(true);
      return { ok: false, error: "You're signed out of Reckon. Sign in (⌥S), then post again; your draft stays here." };
    }
    return { ok: false, error: data.error ?? `Reckon answered ${status}.` };
  }

  async function onCreated({ id, title }: { id: string; title: string }) {
    const url = `${RECKON_URL}/q/${id}`;
    const copied = await copy(url);
    if (launch.mode === "overlay") return tell({ reckon: "posted", title, url, copied });
    setPosted({ title, url, copied });
    setFormKey((k) => k + 1);
  }

  const signIn = () => openTab(`${RECKON_URL}/login`);

  return (
    <div
      className={launch.mode === "overlay" ? "fixed inset-0 overflow-y-auto bg-black/35 px-4 pb-10 pt-[10vh]" : "min-h-screen px-4 py-5"}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onKeyDown={(e) => {
        if (e.altKey && e.code === "KeyS" && signedOut) {
          e.preventDefault();
          signIn();
        }
      }}
    >
      <div className="mx-auto w-full max-w-[600px] space-y-2.5">
        <div className="flex items-center gap-3 px-1 text-sm">
          <span className={launch.mode === "overlay" ? "rounded-lg bg-surface/90 px-2 py-1" : undefined}>
            <Logo />
          </span>
          <div className="ml-auto flex items-center gap-2">
            {me && (
              <span className="inline-flex items-center gap-2 rounded-full bg-surface/90 py-0.5 pl-0.5 pr-2.5 text-ink-2">
                <Avatar name={me.user.displayName} src={me.user.avatarUrl} size={22} />
                {me.user.displayName}
              </span>
            )}
            <button
              type="button"
              onClick={() => openTab(RECKON_URL)}
              className="inline-flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-1 text-ink-2 hover:text-ink"
            >
              Open Reckon <ExternalLink size={13} />
            </button>
          </div>
        </div>

        {signedOut && (
          <div className="flex items-center gap-3 rounded-xl border border-warn/40 bg-surface px-4 py-2.5 text-sm text-ink">
            <LogIn size={16} className="shrink-0 text-ink-3" />
            <span className="flex-1">You&apos;re not signed in to Reckon in this browser.</span>
            <button type="button" onClick={signIn} className="font-medium text-accent-ink underline underline-offset-2">
              Sign in <kbd className="font-sans text-xs text-ink-3">⌥S</kbd>
            </button>
          </div>
        )}
        {problem && <div className="rounded-xl bg-bad-soft px-4 py-2.5 text-sm text-bad-ink">{problem}</div>}
        {posted && (
          <div className="flex items-center gap-3 rounded-xl border border-good/30 bg-good-soft px-4 py-2.5 text-sm text-good-ink">
            <Check size={16} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Posted: <span className="font-medium">{posted.title}</span>
              {posted.copied && " · link copied"}
            </span>
            <a href={posted.url} target="_blank" rel="noopener" className="shrink-0 font-medium underline underline-offset-2">
              View
            </a>
          </div>
        )}

        <ComposerForm
          key={formKey}
          className="shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)]"
          track={me?.track ?? NO_HISTORY}
          tz={me?.user.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
          placeholder={placeholder}
          initial={formKey === 0 ? { focus: "title", ...launch.prefill } : { focus: "title" }}
          submit={submit}
          onCreated={(created) => void onCreated(created)}
          onEscape={close}
        />
      </div>
    </div>
  );
}

if (launch.mode === "overlay") {
  document.documentElement.classList.add("overlay");
  window.focus();
}
createRoot(document.getElementById("root")!).render(<App />);
