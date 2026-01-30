"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Tabs from "@/components/ui/Tabs";
import { buttonStyles } from "@/components/ui/Button";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import { isCompanyOwner } from "@/lib/company/roles";
import { formatDate } from "@/lib/dashboard/format";
import { MAX_PARTNERSHIPS } from "@/lib/company/partnerships";

type PartnerCompany = {
  id: string;
  name: string;
  logoUrl: string | null;
};

type ActivePartner = {
  partnershipId: string;
  company: PartnerCompany;
};

type IncomingInvite = {
  id: string;
  createdAt: string;
  fromCompany: PartnerCompany | null;
};

type OutgoingInvite = {
  id: string;
  createdAt: string;
  toCompany: PartnerCompany | null;
};

type CompanySearchItem = {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
};

const tabs = ["Active", "Incoming", "Outgoing"] as const;
type TabKey = (typeof tabs)[number];

export default function PartnershipsClient() {
  const { company, role } = useCompanyHub();
  const canManage = isCompanyOwner(role);

  const [activeTab, setActiveTab] = useState<TabKey>("Active");
  const [activePartners, setActivePartners] = useState<ActivePartner[]>([]);
  const [incoming, setIncoming] = useState<IncomingInvite[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingInvite[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchActive = useCallback(async () => {
    const response = await csrfFetch(
      `/api/company/${company.id}/partnerships/active`,
    );
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "Failed to load partners.");
    }
    const data = (await response.json()) as { items: ActivePartner[] };
    setActivePartners(data.items);
  }, [company.id]);

  const fetchIncoming = useCallback(async () => {
    const response = await csrfFetch(
      `/api/company/${company.id}/partnerships/incoming`,
    );
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "Failed to load invites.");
    }
    const data = (await response.json()) as { items: IncomingInvite[] };
    setIncoming(data.items);
  }, [company.id]);

  const fetchOutgoing = useCallback(async () => {
    const response = await csrfFetch(
      `/api/company/${company.id}/partnerships/outgoing`,
    );
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "Failed to load invites.");
    }
    const data = (await response.json()) as { items: OutgoingInvite[] };
    setOutgoing(data.items);
  }, [company.id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchActive(), fetchIncoming(), fetchOutgoing()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load partnerships.",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchActive, fetchIncoming, fetchOutgoing]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!canManage) {
      setResults([]);
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const response = await csrfFetch(
          `/api/companies/search?query=${encodeURIComponent(trimmed)}`,
        );
        if (!response.ok) {
          throw new Error("Failed to search companies.");
        }
        const data = (await response.json()) as { items: CompanySearchItem[] };
        setResults(data.items);
      } catch (err) {
        setNotice(
          err instanceof Error ? err.message : "Failed to search companies.",
        );
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [canManage, query]);

  const partnerIds = useMemo(
    () => new Set(activePartners.map((item) => item.company.id)),
    [activePartners],
  );

  const filteredResults = useMemo(() => {
    return results.filter(
      (item) => item.id !== company.id && !partnerIds.has(item.id),
    );
  }, [results, company.id, partnerIds]);

  const handleInvite = async (toCompanyId: string) => {
    setNotice(null);
    try {
      const response = await csrfFetch(
        `/api/company/${company.id}/partnerships/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toCompanyId }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to send invite.");
      }
      setNotice("Invite sent.");
      setQuery("");
      setResults([]);
      await loadAll();
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Unable to send invite.",
      );
    }
  };

  const handleIncomingAction = async (
    inviteId: string,
    action: "accept" | "decline",
  ) => {
    setNotice(null);
    try {
      const response = await csrfFetch(
        `/api/company/${company.id}/partnerships/invite/${inviteId}/${action}`,
        { method: "POST" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to update invite.");
      }
      await loadAll();
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Unable to update invite.",
      );
    }
  };

  const handleCancel = async (inviteId: string) => {
    setNotice(null);
    try {
      const response = await csrfFetch(
        `/api/company/${company.id}/partnerships/invite/${inviteId}/cancel`,
        { method: "POST" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to cancel invite.");
      }
      await loadAll();
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Unable to cancel invite.",
      );
    }
  };

  const handleEnd = async (partnershipId: string) => {
    setNotice(null);
    try {
      const response = await csrfFetch(
        `/api/company/${company.id}/partnerships/${partnershipId}/end`,
        { method: "POST" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to end partnership.");
      }
      await loadAll();
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Unable to end partnership.",
      );
    }
  };

  const limitReached = activePartners.length >= MAX_PARTNERSHIPS;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Partnerships</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Manage partner companies for {company.name}.
        </p>
      </header>

      {notice ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          {notice}
        </Card>
      ) : null}

      {error ? (
        <Card className="space-y-2 text-sm text-[color:var(--color-muted)]">
          <p>{error}</p>
          <button
            type="button"
            className={buttonStyles({ variant: "outline", size: "sm" })}
            onClick={loadAll}
          >
            Retry
          </button>
        </Card>
      ) : null}

      <Card className="text-sm text-[color:var(--color-muted)]">
        {activePartners.length} / {MAX_PARTNERSHIPS} partnerships active.
      </Card>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Invite a partner</h3>
        {canManage ? (
          <div className="space-y-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search companies by name"
              disabled={limitReached}
            />
            {limitReached ? (
              <Card className="text-sm text-[color:var(--color-muted)]">
                Partnership limit reached. End a partnership to invite more.
              </Card>
            ) : null}
            {query.trim().length >= 2 && filteredResults.length === 0 ? (
              <Card className="text-sm text-[color:var(--color-muted)]">
                No companies found.
              </Card>
            ) : null}
            {filteredResults.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredResults.map((item) => (
                  <Card key={item.id} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Avatar
                        size="sm"
                        label={item.name}
                        src={item.logoUrl ?? undefined}
                      />
                      <div>
                        <p className="text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-[color:var(--color-muted)]">
                          {item.description ?? "No description"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={buttonStyles({ variant: "outline", size: "sm" })}
                      onClick={() => handleInvite(item.id)}
                    >
                      Invite to partnership
                    </button>
                  </Card>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <Card className="text-sm text-[color:var(--color-muted)]">
            Only owners and co-owners can manage partnerships.
          </Card>
        )}
      </section>

      <Tabs
        items={[...tabs]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as TabKey)}
      />

      {loading ? (
        <Card className="space-y-3">
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
        </Card>
      ) : null}

      {!loading && activeTab === "Active" ? (
        activePartners.length === 0 ? (
          <Card className="text-sm text-[color:var(--color-muted)]">
            No active partners yet.
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {activePartners.map((partner) => (
              <Card key={partner.partnershipId} className="flex items-center gap-3">
                <Avatar
                  size="sm"
                  label={partner.company.name}
                  src={partner.company.logoUrl ?? undefined}
                />
                <div className="flex-1">
                  <Link
                    href={`/company/${partner.company.id}`}
                    className="text-sm font-semibold"
                  >
                    {partner.company.name}
                  </Link>
                  <p className="text-xs text-[color:var(--color-muted)]">
                    Active partner
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                    onClick={() => handleEnd(partner.partnershipId)}
                  >
                    End
                  </button>
                ) : null}
              </Card>
            ))}
          </div>
        )
      ) : null}

      {!loading && activeTab === "Incoming" ? (
        incoming.length === 0 ? (
          <Card className="text-sm text-[color:var(--color-muted)]">
            No incoming invites.
          </Card>
        ) : (
          <div className="grid gap-3">
            {incoming.map((invite) => (
              <Card key={invite.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar
                      size="sm"
                      label={invite.fromCompany?.name ?? "Company"}
                      src={invite.fromCompany?.logoUrl ?? undefined}
                    />
                    <div>
                      <p className="text-sm font-semibold">
                        {invite.fromCompany?.name ?? "Unknown company"}
                      </p>
                      <p className="text-xs text-[color:var(--color-muted)]">
                        Invited {formatDate(invite.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={buttonStyles({
                        variant: "primary",
                        size: "sm",
                      })}
                      onClick={() => handleIncomingAction(invite.id, "accept")}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className={buttonStyles({
                        variant: "outline",
                        size: "sm",
                      })}
                      onClick={() => handleIncomingAction(invite.id, "decline")}
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-[color:var(--color-muted)]">
                    Owner/co-owner required to respond.
                  </span>
                )}
              </Card>
            ))}
          </div>
        )
      ) : null}

      {!loading && activeTab === "Outgoing" ? (
        outgoing.length === 0 ? (
          <Card className="text-sm text-[color:var(--color-muted)]">
            No outgoing invites.
          </Card>
        ) : (
          <div className="grid gap-3">
            {outgoing.map((invite) => (
              <Card key={invite.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar
                      size="sm"
                      label={invite.toCompany?.name ?? "Company"}
                      src={invite.toCompany?.logoUrl ?? undefined}
                    />
                    <div>
                      <p className="text-sm font-semibold">
                        {invite.toCompany?.name ?? "Unknown company"}
                      </p>
                      <p className="text-xs text-[color:var(--color-muted)]">
                        Invited {formatDate(invite.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                    onClick={() => handleCancel(invite.id)}
                  >
                    Cancel invite
                  </button>
                ) : null}
              </Card>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
