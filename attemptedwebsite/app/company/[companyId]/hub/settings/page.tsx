"use client";

import Card from "@/components/ui/Card";
import ImageUploader from "@/components/uploads/ImageUploader";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import { isCompanyEditor } from "@/lib/company/roles";

export default function CompanySettingsPage() {
  const { company, role } = useCompanyHub();
  const canUpload = isCompanyEditor(role);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Manage settings for {company.name}.
        </p>
      </header>

      {canUpload ? (
        <ImageUploader
          scope="COMPANY_LOGO"
          entityId={company.id}
          currentUrl={company.logoUrl}
        />
      ) : (
        <Card className="text-sm text-[color:var(--color-muted)]">
          Company settings will be available in a later phase.
        </Card>
      )}
    </div>
  );
}
