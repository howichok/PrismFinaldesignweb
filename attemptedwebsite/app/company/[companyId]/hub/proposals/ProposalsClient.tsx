"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import Card from "@/components/ui/Card";
import UserChip from "@/components/users/UserChip";
import Tabs from "@/components/ui/Tabs";
import { buttonStyles } from "@/components/ui/Button";
import { formatDate } from "@/lib/dashboard/format";
import StatusBadge from "@/components/dashboard/StatusBadge";

type ProposalType = "Posts" | "Projects" | "Updates";
const proposalTypes: ProposalType[] = ["Posts", "Projects", "Updates"];

type ProposalStatus = "Pending" | "Rejected";
const proposalStatuses: ProposalStatus[] = ["Pending", "Rejected"];

type ProposalListItem = {
    id: string;
    title?: string; // For Posts and Updates
    name?: string;  // For Projects
    status: "PENDING" | "REJECTED";
    createdAt: string;
    createdBy: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
    };
    project?: { // For Updates
        name: string;
    }
};

export default function ProposalsClient() {
    const { company, role } = useCompanyHub();
    const [type, setType] = useState<ProposalType>("Posts");
    const [status, setStatus] = useState<ProposalStatus>("Pending");
    const [items, setItems] = useState<ProposalListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProposals = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await csrfFetch(
                `/api/company/${company.id}/proposals?type=${type.toLowerCase()}&status=${status.toUpperCase()}`
            );
            if (!response.ok) {
                throw new Error("Failed to load proposals.");
            }
            const data = await response.json() as { items: ProposalListItem[] };
            setItems(data.items);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setLoading(false);
        }
    }, [company.id, type, status]);

    useEffect(() => {
        fetchProposals();
    }, [fetchProposals]);

    const getTitle = (item: ProposalListItem) => {
        if (type === 'Updates') {
            return `${item.title} (for ${item.project?.name})`;
        }
        return item.title || item.name || 'No title';
    }

    const getViewLink = (item: ProposalListItem) => {
        const typePath = type.toLowerCase();
        return `/company/${company.id}/hub/proposals/${typePath}/${item.id}`;
    }

    const canSubmitUpdate = role === "MEMBER";

    return (
        <div className="space-y-6">
            <Card className="p-2">
                <Tabs
                    items={proposalTypes}
                    value={type}
                    onChange={(value) => setType(value as ProposalType)}
                />
            </Card>

            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Tabs
                        items={proposalStatuses}
                        value={status}
                        onChange={(value) => setStatus(value as ProposalStatus)}
                    />
                    {type === "Updates" && canSubmitUpdate ? (
                        <Link
                            href={`/company/${company.id}/hub/proposals/updates/new`}
                            className={buttonStyles({ variant: "outline", size: "sm" })}
                        >
                            New update proposal
                        </Link>
                    ) : null}
                </div>

                {loading && <p>Loading...</p>}
                {error && <p className="text-red-500">{error}</p>}

                {!loading && !error && (
                    items.length === 0 ? (
                        <Card className="text-sm text-[color:var(--color-muted)]">
                            No {status.toLowerCase()} {type.toLowerCase()} proposals found.
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {items.map((item) => (
                                <Card key={item.id} className="p-4 space-y-3">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <h3 className="text-lg font-semibold">{getTitle(item)}</h3>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
                                                <span>Proposed by</span>
                                                <UserChip
                                                    userId={item.createdBy.id}
                                                    displayName={item.createdBy.displayName}
                                                    avatarUrl={item.createdBy.avatarUrl}
                                                />
                                                <span>on {formatDate(item.createdAt)}</span>
                                            </div>
                                        </div>
                                        <StatusBadge status={item.status} />
                                    </div>
                                    <Link
                                        href={getViewLink(item)}
                                        className={buttonStyles({ variant: "outline", size: "sm" })}
                                    >
                                        View Proposal
                                    </Link>
                                </Card>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
