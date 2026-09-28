import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import type { SessionUser } from "@/lib/auth/session";
import { Avatar } from "./ui";

/** JS-free dropdown built on <details>. */
export function UserMenu({ user }: { user: SessionUser }) {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center rounded-full p-0.5 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <Avatar name={user.displayName} src={user.avatarUrl} size={32} />
        <span className="sr-only">Account menu</span>
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-card">
        <div className="px-2.5 pb-2 pt-1.5">
          <div className="truncate text-sm font-medium text-ink">{user.displayName}</div>
          <div className="truncate text-xs text-ink-3">@{user.username}</div>
        </div>
        <div className="my-1 h-px bg-line" />
        <form action={logout}>
          <button type="submit" className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
            <LogOut size={16} /> Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
