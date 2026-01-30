import AdminTicketsClient from "@/app/dashboard/admin/tickets/AdminTicketsClient";

export default function AdminTicketsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Ticket Inbox</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Review support tickets and respond to community requests.
        </p>
      </header>

      <AdminTicketsClient />
    </div>
  );
}
