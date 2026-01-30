export default function AdminPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Admin overview</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Review pending submissions and manage administrative queues.
        </p>
      </header>
      <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-muted)] shadow-[var(--shadow-soft)]">
        Choose a tool from the admin navigation to get started.
      </div>
    </div>
  );
}
