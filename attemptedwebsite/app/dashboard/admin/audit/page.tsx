import AdminAuditClient from "@/app/dashboard/admin/audit/AdminAuditClient";

export default function AdminAuditPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Audit Log</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Review administrative and moderation actions across the platform.
        </p>
      </header>
      <AdminAuditClient />
    </div>
  );
}
