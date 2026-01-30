"use client";

import { csrfFetch, getErrorMessage } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useMemo, useState } from "react";

import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import { buttonStyles } from "@/components/ui/Button";
import { formatDate } from "@/lib/dashboard/format";
import { companyRoleLabels } from "@/lib/company/roles";

type InviteItem = {
  id: string;
  offeredRole: "MEMBER" | "TRUSTED" | "CO_OWNER" | null;
  createdAt: string;
  company: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
  invitedBy: string;
};

const tabs = ["Company Invites", "Collab Invites", "Partnership Invites"] as const;
type TabKey = (typeof tabs)[number];

const inviteRoleLabels: Record<"MEMBER" | "TRUSTED" | "CO_OWNER", string> = {
  MEMBER: companyRoleLabels.MEMBER,
  TRUSTED: companyRoleLabels.TRUSTED,
  CO_OWNER: companyRoleLabels.CO_OWNER,
};

export default function DashboardInvitesClient() {
  const [activeTab, setActiveTab] = useState<TabKey>("Company Invites");
  const [items, setItems] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    if (activeTab !== "Company Invites") return;
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch(
        "/api/invites/mine?type=company_membership&status=pending",
      );
      if (!response.ok) {
        throw new Error("Failed to load invites.");
      }
      const data = (await response.json()) as { items: InviteItem[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invites.");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleAction = async (inviteId: string, action: "accept" | "decline") => {
    setNotice(null);
    setActingId(inviteId);
    try {
      const response = await csrfFetch(`/api/invites/${inviteId}/${action}`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: unknown };
        throw new Error(getErrorMessage(data, "Failed to update invite."));
      }
      setItems((prev) => prev.filter((item) => item.id !== inviteId));
      setNotice(action === "accept" ? "Invite accepted." : "Invite declined.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update invite.",
      );
    } finally {
      setActingId(null);
    }
  };

  const emptyState = useMemo(() => {
    return "No pending invites right now.";
  }, []);

  return (
    <div className="space-y-4">
      <Tabs
        items={[...tabs]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as TabKey)}
      />

      {activeTab !== "Company Invites" ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          This invite type will be available in a later phase.
        </Card>
      ) : null}

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
            onClick={fetchInvites}
          >
            Retry
          </button>
        </Card>
      ) : null}

      {activeTab === "Company Invites" && loading ? (
        <div className="grid gap-3">
          {[0, 1].map((item) => (
            <Card key={item} className="space-y-3">
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
            </Card>
          ))}
        </div>
      ) : null}

      {activeTab === "Company Invites" && !loading && items.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          {emptyState}
        </Card>
      ) : null}

      {activeTab === "Company Invites" && !loading && items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((invite) => (
            <Card key={invite.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    size="sm"
                    label={invite.company?.name ?? "Company"}
                    src={invite.company?.logoUrl ?? undefined}
                  />
                  <div>
                    <p className="text-sm font-semibold">
                      {invite.company?.name ?? "Company invite"}
                    </p>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      Role{" "}
                      {invite.offeredRole
                        ? inviteRoleLabels[invite.offeredRole]
                        : "Member"}{" "}
                      · Invited by {invite.invitedBy} ·{" "}
                      {formatDate(invite.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonStyles({ variant: "primary", size: "sm" })}
                    onClick={() => handleAction(invite.id, "accept")}
                    disabled={actingId === invite.id}
                  >
                    {actingId === invite.id ? "Working..." : "Accept"}
                  </button>
                  <button
                    type="button"
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                    onClick={() => handleAction(invite.id, "decline")}
                    disabled={actingId === invite.id}
                  >
                    Decline
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
