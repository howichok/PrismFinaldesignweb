import ModerationListClient from "@/app/dashboard/admin/moderation/ModerationListClient";

export default function ModerationPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Moderation</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Review pending submissions from the PrismMTR community.
        </p>
      </header>

      <ModerationListClient />
    </div>
  );
}
