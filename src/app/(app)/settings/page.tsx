import type { Metadata } from "next";
import { ProfileForm, PasswordForm } from "@/components/settings-forms";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const zones = Intl.supportedValuesOf("timeZone");
  if (!zones.includes(user.timezone)) zones.unshift(user.timezone);
  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" subtitle={`Signed in as @${user.username}`} />
      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-ink">Profile</h2>
          <ProfileForm displayName={user.displayName} timezone={user.timezone} zones={zones} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-ink">Password</h2>
          <PasswordForm />
        </Card>
      </div>
    </div>
  );
}
