import DashboardInvitesClient from "@/app/dashboard/invites/DashboardInvitesClient";

export default function DashboardInvitesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Invites</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Review company invitations and respond when ready.
        </p>
      </header>

      <DashboardInvitesClient />
    </div>
  );
}
