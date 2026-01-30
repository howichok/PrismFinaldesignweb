"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import { buttonStyles } from "@/components/ui/Button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { formatDate } from "@/lib/dashboard/format";

type CreatedCompany = {
  id: string;
  name: string;
  logoUrl: string | null;
  visibilityStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  updatedAt: string;
  publishedAt: string | null;
};

type MemberCompany = {
  id: string;
  name: string;
  logoUrl: string | null;
  visibilityStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  companyRole: "OWNER" | "CO_OWNER" | "TRUSTED" | "MEMBER";
};

type CompanyResponse = {
  created: CreatedCompany[];
  memberships: MemberCompany[];
};

function formatRole(role: MemberCompany["companyRole"]) {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "CO_OWNER":
      return "Co-owner";
    case "TRUSTED":
      return "Trusted";
    default:
      return "Member";
  }
}

export default function CompaniesClient() {
  const [data, setData] = useState<CompanyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch("/api/dashboard/companies");
      if (!response.ok) {
        throw new Error("Failed to load companies.");
      }
      const payload = (await response.json()) as CompanyResponse;
      setData(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load companies.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="space-y-3">
          <div className="h-4 w-1/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-[color:var(--color-line)]" />
        </Card>
        <Card className="space-y-3">
          <div className="h-4 w-1/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-[color:var(--color-line)]" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="space-y-2 text-sm text-[color:var(--color-muted)]">
        <p>{error}</p>
        <button
          type="button"
          className={buttonStyles({ variant: "outline", size: "sm" })}
          onClick={fetchCompanies}
        >
          Retry
        </button>
      </Card>
    );
  }

  const createdCompanies = data?.created ?? [];
  const memberCompanies = data?.memberships ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Companies I created</h3>
          <p className="text-sm text-[color:var(--color-muted)]">
            Manage companies you submitted for review.
          </p>
        </div>
        {createdCompanies.length === 0 ? (
          <Card className="text-sm text-[color:var(--color-muted)]">
            You have not created any companies yet.
          </Card>
        ) : (
          <div className="grid gap-3">
            {createdCompanies.map((company) => (
              <Card key={company.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-lg font-semibold">{company.name}</h4>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      Updated {formatDate(company.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={company.visibilityStatus} />
                </div>
                {company.visibilityStatus === "REJECTED" &&
                company.rejectionReason ? (
                  <p className="text-sm text-red-600">
                    {company.rejectionReason}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {company.visibilityStatus !== "APPROVED" ? (
                    <Link
                      href={`/dashboard/companies/${company.id}/edit`}
                      className={buttonStyles({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Edit
                    </Link>
                  ) : null}
                  {company.visibilityStatus === "APPROVED" ? (
                    <Link
                      href={`/company/${company.id}`}
                      className={buttonStyles({ variant: "ghost", size: "sm" })}
                    >
                      View
                    </Link>
                  ) : null}
                  <Link
                    href={`/company/${company.id}/hub`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    Open hub
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Companies I'm a member of</h3>
          <p className="text-sm text-[color:var(--color-muted)]">
            Jump into company hubs you collaborate with.
          </p>
        </div>
        {memberCompanies.length === 0 ? (
          <Card className="text-sm text-[color:var(--color-muted)]">
            No memberships yet.
          </Card>
        ) : (
          <div className="grid gap-3">
            {memberCompanies.map((company) => (
              <Card key={company.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-lg font-semibold">{company.name}</h4>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      {formatRole(company.companyRole)}
                    </p>
                  </div>
                  <StatusBadge status={company.visibilityStatus} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {company.visibilityStatus === "APPROVED" ? (
                    <Link
                      href={`/company/${company.id}`}
                      className={buttonStyles({ variant: "ghost", size: "sm" })}
                    >
                      View
                    </Link>
                  ) : null}
                  <Link
                    href={`/company/${company.id}/hub`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    Open hub
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
