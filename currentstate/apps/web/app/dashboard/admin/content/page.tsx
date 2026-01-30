import AdminContentClient from "@/app/dashboard/admin/content/AdminContentClient";

export default function AdminContentPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Content Control</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Search, hide, or force publish content across the platform.
        </p>
      </header>
      <AdminContentClient />
    </div>
  );
}
