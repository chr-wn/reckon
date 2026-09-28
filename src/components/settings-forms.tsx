"use client";

import { useActionState } from "react";
import { Button, ErrorText, Label } from "@/components/ui";
import { changePassword, updateProfile, type FormState } from "@/lib/actions/profile";

export function ProfileForm({ displayName, timezone, zones }: { displayName: string; timezone: string; zones: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="displayName">Display name</Label>
        <input id="displayName" name="displayName" defaultValue={displayName} className="field" maxLength={40} required />
      </div>
      <div>
        <Label htmlFor="timezone">Time zone</Label>
        <select id="timezone" name="timezone" defaultValue={timezone} className="field">
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-3">Used to show dates and deadlines. Updated automatically when you log in.</p>
      </div>
      <ErrorText>{state.error}</ErrorText>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          Save
        </Button>
        {state.ok && <span className="text-sm text-good-ink">{state.ok}</span>}
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="current">Current password</Label>
        <input id="current" name="current" type="password" autoComplete="current-password" className="field" required />
      </div>
      <div>
        <Label htmlFor="next">New password</Label>
        <input id="next" name="next" type="password" autoComplete="new-password" minLength={8} className="field" required />
      </div>
      <ErrorText>{state.error}</ErrorText>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          Change password
        </Button>
        {state.ok && <span className="text-sm text-good-ink">{state.ok}</span>}
      </div>
    </form>
  );
}
