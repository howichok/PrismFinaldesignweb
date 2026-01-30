"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { buttonStyles } from "@/components/ui/Button";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import { isCompanyOwner } from "@/lib/company/roles";
import { formatDate } from "@/lib/dashboard/format";

type CollaboratorCompany = {
  id: string;
  name: string;
  logoUrl: string | null;
};

type PendingInvite = {
  id: string;
  createdAt: string;
  toCompany: CollaboratorCompany | null;
  createdBy: string;
};

type CompanySearchItem = {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
};

type ActivePartner = {
  partnershipId: string;
  company: CollaboratorCompany;
};

type ProjectInfo = {
  id: string;
  name: string;
};

const MAX_COLLABORATORS = 10;

type ProjectCollaboratorsClientProps = {
  projectId: string;
};

export default function ProjectCollaboratorsClient({
  projectId,
}: ProjectCollaboratorsClientProps) {
  const { company, role } = useCompanyHub();
  const canInvite = isCompanyOwner(role);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorCompany[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySearchItem[]>([]);
  const [partners, setPartners] = useState<ActivePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPartnerPrompt, setShowPartnerPrompt] = useState(true);
  const partnerRef = useRef<HTMLDivElement | null>(null);

  const fetchProject = useCallback(async () => {
    const response = await csrfFetch(
      `/api/company/${company.id}/projects/${projectId}`,
    );
    if (!response.ok) {
      throw new Error("Project not found.");
    }
    const data = (await response.json()) as { item: ProjectInfo };
    setProject(data.item);
  }, [company.id, projectId]);

  const fetchCollaborators = useCallback(async () => {
    const response = await csrfFetch(`/api/projects/${projectId}/collaborators`);
    if (!response.ok) {
      throw new Error("Failed to load collaborators.");
    }
    const data = (await response.json()) as { items: CollaboratorCompany[] };
    setCollaborators(data.items);
  }, [projectId]);

  const fetchPendingInvites = useCallback(async () => {
    const response = await csrfFetch(
      `/api/company/${company.id}/projects/${projectId}/collab-invites?status=pending`,
    );
    if (!response.ok) {
      throw new Error("Failed to load pending invites.");
    }
    const data = (await response.json()) as { items: PendingInvite[] };
    setPendingInvites(data.items);
  }, [company.id, projectId]);

  const fetchPartners = useCallback(async () => {
    const response = await csrfFetch(
      `/api/company/${company.id}/partnerships/active`,
    );
    if (!response.ok) {
      throw new Error("Failed to load partners.");
    }
    const data = (await response.json()) as { items: ActivePartner[] };
    setPartners(data.items);
  }, [company.id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchProject(),
        fetchCollaborators(),
        fetchPendingInvites(),
        fetchPartners(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load collaborators.",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchProject, fetchCollaborators, fetchPendingInvites, fetchPartners]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!canInvite) {
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
  }, [canInvite, query]);

  const collaboratorIds = useMemo(
    () => new Set(collaborators.map((item) => item.id)),
    [collaborators],
  );

  const pendingInviteCompanyIds = useMemo(
    () =>
      new Set(
        pendingInvites
          .map((invite) => invite.toCompany?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    [pendingInvites],
  );

  const filteredResults = useMemo(() => {
    return results.filter(
      (item) => item.id !== company.id && !collaboratorIds.has(item.id),
    );
  }, [results, company.id, collaboratorIds]);

  const partnerCompanies = useMemo(
    () =>
      partners
        .map((partner) => partner.company)
        .filter(
          (partner) =>
            partner.id !== company.id && !collaboratorIds.has(partner.id),
        ),
    [partners, company.id, collaboratorIds],
  );

  const handleInvite = async (toCompanyId: string) => {
    setNotice(null);
    try {
      const response = await csrfFetch(
        `/api/company/${company.id}/projects/${projectId}/collab-invites`,
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
      await fetchPendingInvites();
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Unable to send invite.",
      );
    }
  };

  const handleCancel = async (inviteId: string) => {
    setNotice(null);
    try {
      const response = await csrfFetch(
        `/api/company/${company.id}/collab-invites/${inviteId}/cancel`,
        { method: "POST" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to cancel invite.");
      }
      setNotice("Invite canceled.");
      await fetchPendingInvites();
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Unable to cancel invite.",
      );
    }
  };

  const collaboratorCount = collaborators.length;
  const limitReached = collaboratorCount >= MAX_COLLABORATORS;
  const showPartnerBanner =
    canInvite &&
    showPartnerPrompt &&
    partnerCompanies.length > 0 &&
    collaboratorCount === 0;

  if (loading) {
    return (
      <Card className="space-y-3">
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
      </Card>
    );
  }

  if (error) {
    return (
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
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Project collaborators</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Invite companies to collaborate on {project?.name ?? "this project"}.
        </p>
      </header>

      {notice ? (
        <Card className="text-sm text-[color:var(--color-muted)]">
          {notice}
        </Card>
      ) : null}

      <Card className="text-sm text-[color:var(--color-muted)]">
        {collaboratorCount} / {MAX_COLLABORATORS} collaborators linked.
      </Card>

      {showPartnerBanner ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Partner suggestion</p>
            <p className="text-xs text-[color:var(--color-muted)]">
              You have active partners. Add one as a collaborator?
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonStyles({ variant: "outline", size: "sm" })}
              onClick={() => {
                partnerRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Choose partner
            </button>
            <button
              type="button"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
              onClick={() => setShowPartnerPrompt(false)}
            >
              Dismiss
            </button>
          </div>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Current collaborators</h3>
        {collaborators.length === 0 ? (
          <Card className="text-sm text-[color:var(--color-muted)]">
            No collaborator companies yet.
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {collaborators.map((collaborator) => (
              <Link
                key={collaborator.id}
                href={`/company/${collaborator.id}`}
              >
                <Card className="flex items-center gap-3 transition-colors hover:border-[color:var(--color-brand)]">
                  <Avatar
                    size="sm"
                    label={collaborator.name}
                    src={collaborator.logoUrl ?? undefined}
                  />
                  <div>
                    <p className="text-sm font-semibold">{collaborator.name}</p>
                    <p className="text-xs text-[color:var(--color-muted)]">
                      Collaborator company
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" ref={partnerRef}>
        <h3 className="text-lg font-semibold">Partner quick picker</h3>
        {partnerCompanies.length === 0 ? (
          <Card className="text-sm text-[color:var(--color-muted)]">
            No active partners yet.
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {partnerCompanies.map((partner) => {
              const isPending = pendingInviteCompanyIds.has(partner.id);
              return (
                <Card key={partner.id} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar
                      size="sm"
                      label={partner.name}
                      src={partner.logoUrl ?? undefined}
                    />
                    <div>
                      <p className="text-sm font-semibold">{partner.name}</p>
                      <p className="text-xs text-[color:var(--color-muted)]">
                        Active partner
                      </p>
                    </div>
                  </div>
                  {canInvite ? (
                    <button
                      type="button"
                      className={buttonStyles({
                        variant: "outline",
                        size: "sm",
                      })}
                      onClick={() => handleInvite(partner.id)}
                      disabled={isPending || limitReached}
                    >
                      {isPending ? "Invite pending" : "Invite to project"}
                    </button>
                  ) : (
                    <span className="text-xs text-[color:var(--color-muted)]">
                      Owner/co-owner required to invite.
                    </span>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Pending invites</h3>
        {pendingInvites.length === 0 ? (
          <Card className="text-sm text-[color:var(--color-muted)]">
            No pending invites.
          </Card>
        ) : (
          <div className="grid gap-3">
            {pendingInvites.map((invite) => (
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
                        Invited by {invite.createdBy}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {formatDate(invite.createdAt)}
                  </span>
                </div>
                {canInvite ? (
                  <button
                    type="button"
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                    onClick={() => handleCancel(invite.id)}
                  >
                    Cancel invite
                  </button>
                ) : (
                  <span className="text-xs text-[color:var(--color-muted)]">
                    Owner/co-owner required to manage invites.
                  </span>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Add collaborator company</h3>
        {canInvite ? (
          <div className="space-y-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search companies by name"
              disabled={limitReached}
            />
            {limitReached ? (
              <Card className="text-sm text-[color:var(--color-muted)]">
                Collaboration limit reached. Remove a collaborator to add a new
                one.
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
                      Invite
                    </button>
                  </Card>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <Card className="text-sm text-[color:var(--color-muted)]">
            Only owners and co-owners can invite collaborators.
          </Card>
        )}
      </section>
    </div>
  );
}
