"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import { buttonStyles } from "@/components/ui/Button";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import { isCompanyOwner } from "@/lib/company/roles";
import { formatDate } from "@/lib/dashboard/format";

type IncomingInvite = {
  id: string;
  createdAt: string;
  fromCompany: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
  project: {
    id: string;
    name: string;
  };
};

type ActiveCollaboration = {
  addedAt: string;
  project: {
    id: string;
    name: string;
  };
  ownerCompany: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
};

const tabs = ["Incoming", "Active"] as const;
type TabKey = (typeof tabs)[number];

export default function CollaborationsClient() {
  const { company, role } = useCompanyHub();
  const canManage = isCompanyOwner(role);

  const [activeTab, setActiveTab] = useState<TabKey>("Incoming");
  const [incoming, setIncoming] = useState<IncomingInvite[]>([]);
  const [active, setActive] = useState<ActiveCollaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncoming = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch(
        `/api/company/${company.id}/collaborations/incoming`,
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to load invites.");
      }
      const data = (await response.json()) as { items: IncomingInvite[] };
      setIncoming(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invites.");
    } finally {
      setLoading(false);
    }
  }, [company.id]);

  const fetchActive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch(
        `/api/company/${company.id}/collaborations/active`,
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to load collaborations.");
      }
      const data = (await response.json()) as { items: ActiveCollaboration[] };
      setActive(data.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load collaborations.",
      );
    } finally {
      setLoading(false);
    }
  }, [company.id]);

  useEffect(() => {
    if (activeTab === "Incoming") {
      fetchIncoming();
    } else {
      fetchActive();
    }
  }, [activeTab, fetchActive, fetchIncoming]);

  const handleInviteAction = async (
    inviteId: string,
    action: "accept" | "decline",
  ) => {
    try {
      const response = await csrfFetch(
        `/api/company/${company.id}/collab-invites/${inviteId}/${action}`,
        { method: "POST" },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to update invite.");
      }
      await fetchIncoming();
      await fetchActive();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update invite.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Collaborations</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Track incoming invites and active collaborations for {company.name}.
        </p>
      </header>

      <Tabs
        items={[...tabs]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as TabKey)}
      />

      {error ? (
        <Card className="space-y-2 text-sm text-[color:var(--color-muted)]">
          <p>{error}</p>
          <button
            type="button"
            className={buttonStyles({ variant: "outline", size: "sm" })}
            onClick={() =>
              activeTab === "Incoming" ? fetchIncoming() : fetchActive()
            }
          >
            Retry
          </button>
        </Card>
      ) : null}

      {loading ? (
        <Card className="space-y-3">
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
        </Card>
      ) : null}

      {!loading && activeTab === "Incoming" ? (
        incoming.length === 0 ? (
          <Card className="text-sm text-[color:var(--color-muted)]">
            No collaboration invites yet.
          </Card>
        ) : (
          <div className="grid gap-3">
            {incoming.map((invite) => (
              <Card key={invite.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      size="sm"
                      label={invite.fromCompany.name}
                      src={invite.fromCompany.logoUrl ?? undefined}
                    />
                    <div>
                      <p className="text-sm font-semibold">
                        {invite.fromCompany.name}
                      </p>
                      <p className="text-xs text-[color:var(--color-muted)]">
                        Invited you to collaborate on {invite.project.name}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {formatDate(invite.createdAt)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/project/${invite.project.id}`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    View project
                  </Link>
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        className={buttonStyles({
                          variant: "primary",
                          size: "sm",
                        })}
                        onClick={() =>
                          handleInviteAction(invite.id, "accept")
                        }
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className={buttonStyles({
                          variant: "outline",
                          size: "sm",
                        })}
                        onClick={() =>
                          handleInviteAction(invite.id, "decline")
                        }
                      >
                        Decline
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-[color:var(--color-muted)]">
                      Owner/co-owner required to respond.
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {!loading && activeTab === "Active" ? (
        active.length === 0 ? (
          <Card className="text-sm text-[color:var(--color-muted)]">
            No active collaborations yet.
          </Card>
        ) : (
          <div className="grid gap-3">
            {active.map((item) => (
              <Card key={item.project.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">
                      {item.project.name}
                    </p>
                    {item.ownerCompany ? (
                      <p className="text-xs text-[color:var(--color-muted)]">
                        Owner: {item.ownerCompany.name}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-xs text-[color:var(--color-muted)]">
                    Added {formatDate(item.addedAt)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/project/${item.project.id}`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    View project
                  </Link>
                  {item.ownerCompany ? (
                    <Link
                      href={`/company/${item.ownerCompany.id}`}
                      className={buttonStyles({ variant: "outline", size: "sm" })}
                    >
                      View owner
                    </Link>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
