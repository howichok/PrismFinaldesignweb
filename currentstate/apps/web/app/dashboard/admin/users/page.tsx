import UsersClient from "@/app/dashboard/admin/users/UsersClient";

export default function AdminUsersPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Manage Users</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Search, review, and manage platform users.
        </p>
      </header>
      <UsersClient />
    </div>
  );
}
