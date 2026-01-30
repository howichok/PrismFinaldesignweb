"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { buttonStyles } from "@/components/ui/Button";

type ProjectProposal = {
    id: string;
    name: string;
    description: string;
    tags: string[];
};

type PageProps = { params?: any; searchParams?: any };

export default function EditProjectProposalPage({ params }: PageProps) {
    const router = useRouter();
    const { company } = useCompanyHub();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchProposal = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await csrfFetch(`/api/company/${company.id}/proposals/projects/${params.projectId}`);
            if (!response.ok) throw new Error("Failed to load proposal. You may not have permission to edit it.");
            const data = await response.json() as { item: ProjectProposal, canEdit: boolean };
            if(!data.canEdit) {
                 throw new Error("You do not have permission to edit this proposal.");
            }
            setName(data.item.name);
            setDescription(data.item.description);
            setTags(data.item.tags.join(", "));
        } catch (e) {
            setError(e instanceof Error ? e.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }, [company.id, params.projectId]);

    useEffect(() => {
        fetchProposal();
    }, [fetchProposal]);

    const handleSubmit = async () => {
        setSaving(true);
        setError(null);
        try {
            const response = await csrfFetch(`/api/company/${company.id}/proposals/projects/${params.projectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, tags }),
            });
            if(!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to save changes.");
            }
            router.push(`/company/${company.id}/hub/proposals/projects/${params.projectId}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : "An error occurred during save.");
        } finally {
            setSaving(false);
        }
    };
    
    if (loading) return <div>Loading editor...</div>;
    if (error) return <div className="text-red-500 p-4 bg-red-100 border border-red-300 rounded-md">{error}</div>;

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-semibold">Edit Project Proposal</h2>
            </header>
            <Card className="p-6 space-y-4">
                 <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase">Name</label>
                    <Input value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase">Tags</label>
                    <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="comma, separated, tags"/>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase">Description</label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={10} />
                </div>
            </Card>
            <div className="flex gap-2">
                <button onClick={handleSubmit} disabled={saving} className={buttonStyles({variant: 'primary'})}>
                    {saving ? "Saving..." : "Save Changes"}
                </button>
                <button onClick={() => router.back()} className={buttonStyles({variant: 'outline'})}>
                    Cancel
                </button>
            </div>
        </div>
    );
}
