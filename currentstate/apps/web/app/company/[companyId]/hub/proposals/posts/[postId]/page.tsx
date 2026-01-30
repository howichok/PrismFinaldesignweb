"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import { isCompanyReviewer } from "@/lib/company/roles";
import Card from "@/components/ui/Card";
import { buttonStyles } from "@/components/ui/Button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { formatDate } from "@/lib/dashboard/format";
import Textarea from "@/components/ui/Textarea";
import UserChip from "@/components/users/UserChip";

type PostProposal = {
    id: string;
    title: string;
    content: string;
    tags: string[];
    status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
    rejectionReason: string | null;
    createdAt: string;
    publishedAt: string | null;
    createdBy: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
    };
};

type PageProps = { params?: any; searchParams?: any };

export default function PostProposalPage({ params }: PageProps) {
    const router = useRouter();
    const { company, role } = useCompanyHub();
    const [post, setPost] = useState<PostProposal | null>(null);
    const [canEdit, setCanEdit] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRejecting, setRejecting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");

    const isReviewer = isCompanyReviewer(role);

    const fetchProposal = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await csrfFetch(`/api/company/${company.id}/proposals/posts/${params.postId}`);
            if (!response.ok) throw new Error("Failed to load proposal");
            const data = await response.json();
            setPost(data.item);
            setCanEdit(data.canEdit);
        } catch (e) {
            setError(e instanceof Error ? e.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }, [company.id, params.postId]);

    useEffect(() => {
        fetchProposal();
    }, [fetchProposal]);

    const handleApprove = async () => {
        const response = await csrfFetch(`/api/company/${company.id}/proposals/posts/${params.postId}/approve`, { method: 'POST' });
        if (response.ok) {
            router.refresh();
        } else {
            alert("Failed to approve");
        }
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            alert("Rejection reason cannot be empty.");
            return;
        }
        const response = await csrfFetch(`/api/company/${company.id}/proposals/posts/${params.postId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: rejectionReason }),
        });

        if (response.ok) {
            setRejecting(false);
            setRejectionReason("");
            router.refresh();
        } else {
            alert("Failed to reject");
        }
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div className="text-red-500">{error}</div>;
    if (!post) return <div>Proposal not found.</div>;

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <h2 className="text-2xl font-semibold">Post Proposal</h2>
                <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--color-muted)]">
                    <span>Reviewing proposal by</span>
                    <UserChip
                        userId={post.createdBy.id}
                        displayName={post.createdBy.displayName}
                        avatarUrl={post.createdBy.avatarUrl}
                    />
                </div>
            </header>

            <Card className="p-6 space-y-4">
                <h1 className="text-3xl font-bold">{post.title}</h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
                    <StatusBadge status={post.status} />
                    <span>Created {formatDate(post.createdAt)}</span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p>{post.content}</p>
                </div>
                {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                        {post.tags.map(tag => (
                            <span key={tag} className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full">{tag}</span>
                        ))}
                    </div>
                )}
            </Card>

            {post.status === 'REJECTED' && post.rejectionReason && (
                <Card className="border-red-200 text-red-700 p-4">
                    <h3 className="font-semibold">Rejection Reason</h3>
                    <p>{post.rejectionReason}</p>
                </Card>
            )}

            {isReviewer && post.status === 'PENDING' && (
                <Card className="p-4 space-y-4">
                    <h3 className="font-semibold">Reviewer Actions</h3>
                    {!isRejecting ? (
                        <div className="flex gap-2">
                            <button onClick={handleApprove} className={buttonStyles({ variant: "primary" })}>Approve</button>
                            <button onClick={() => setRejecting(true)} className={buttonStyles({ variant: "outline", className: "border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50" })}>Reject</button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Textarea
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                placeholder="Provide a reason for rejection..."
                                rows={3}
                            />
                            <div className="flex gap-2">
                                <button onClick={handleReject} className={buttonStyles({ variant: "outline", className: "border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50" })}>Confirm Rejection</button>
                                <button onClick={() => setRejecting(false)} className={buttonStyles({ variant: "outline" })}>Cancel</button>
                            </div>
                        </div>
                    )}
                </Card>
            )}
            {canEdit && post.status === 'PENDING' && (
                <div className="flex gap-2">
                    <Link href={`/company/${company.id}/hub/proposals/posts/${post.id}/edit`} className={buttonStyles({ variant: "outline" })}>
                        Edit Proposal
                    </Link>
                </div>
            )}
        </div>
    );
}
