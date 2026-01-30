import NotificationsPageClient from "@/app/dashboard/notifications/NotificationsPageClient";

export default function DashboardNotificationsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Notifications</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Review recent updates and moderation decisions.
        </p>
      </header>

      <NotificationsPageClient />
    </div>
  );
}
