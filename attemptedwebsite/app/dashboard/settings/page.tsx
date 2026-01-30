import { redirect } from "next/navigation";

import Card from "@/components/ui/Card";
import UserChip from "@/components/users/UserChip";
import { getSession } from "@/lib/auth/session";

export default async function DashboardSettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/unauthorized");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Profile details and account preferences.
        </p>
      </header>

      <Card className="flex flex-wrap items-center gap-4">
        <UserChip
          userId={session.userId}
          displayName={session.displayName}
          avatarUrl={session.avatarUrl}
          viewerId={session.userId}
          size="md"
        />
        <p className="text-sm text-[color:var(--color-muted)]">
          Role: {session.siteRole}
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2">
          <h3 className="text-lg font-semibold">Notification preferences</h3>
          <p className="text-sm text-[color:var(--color-muted)]">
            Notification controls will be available in Phase 8.
          </p>
        </Card>
        <Card className="space-y-2">
          <h3 className="text-lg font-semibold">Privacy</h3>
          <p className="text-sm text-[color:var(--color-muted)]">
            Privacy options will be configurable in a later phase.
          </p>
        </Card>
      </div>
    </div>
  );
}
