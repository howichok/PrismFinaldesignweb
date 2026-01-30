"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useCompanyHub } from "@/components/company/CompanyHubShell";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { buttonStyles } from "@/components/ui/Button";
type ProjectUpdateTypeValue = "PROGRESS" | "RELEASE" | "FIX" | "ANNOUNCEMENT";
type UpdateImportanceValue = "MAJOR" | "MINOR";

const updateTypeOptions: ProjectUpdateTypeValue[] = [
  "PROGRESS",
  "RELEASE",
  "FIX",
  "ANNOUNCEMENT",
];

const importanceOptions: UpdateImportanceValue[] = ["MINOR", "MAJOR"];

type UpdateProposal = {
    id: string;
    title: string;
    summary: string;
    details: string | null;
    updateType: ProjectUpdateTypeValue;
    importance: UpdateImportanceValue;
};

type PageProps = { params?: any; searchParams?: any };

// A simple select component
function Select({
    name,
    value,
    onChange,
    children,
}: {
    name: string;
    value: string;
    onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
    children: ReactNode;
}) {
    return (
        <select name={name} value={value} onChange={onChange} className="w-full p-2 border rounded-md bg-transparent border-gray-300 dark:border-gray-600">
            {children}
        </select>
    );
}

export default function EditUpdateProposalPage({ params }: PageProps) {
    const router = useRouter();
    const { company } = useCompanyHub();
    const [formData, setFormData] = useState<Omit<UpdateProposal, 'id'>>({
        title: "",
        summary: "",
        details: "",
        updateType: "PROGRESS",
        importance: "MINOR",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchProposal = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await csrfFetch(`/api/company/${company.id}/proposals/updates/${params.updateId}`);
            if (!response.ok) throw new Error("Failed to load proposal. You may not have permission to edit it.");
            const data = await response.json() as { item: UpdateProposal, canEdit: boolean };
            if(!data.canEdit) {
                 throw new Error("You do not have permission to edit this proposal.");
            }
            setFormData({
                title: data.item.title,
                summary: data.item.summary,
                details: data.item.details ?? "",
                updateType: data.item.updateType,
                importance: data.item.importance,
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }, [company.id, params.updateId]);

    useEffect(() => {
        fetchProposal();
    }, [fetchProposal]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    }

    const handleSubmit = async () => {
        setSaving(true);
        setError(null);
        try {
            const response = await csrfFetch(`/api/company/${company.id}/proposals/updates/${params.updateId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if(!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to save changes.");
            }
            router.push(`/company/${company.id}/hub/proposals/updates/${params.updateId}`);
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
                <h2 className="text-2xl font-semibold">Edit Update Proposal</h2>
            </header>
            <Card className="p-6 space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase">Title</label>
                    <Input name="title" value={formData.title} onChange={handleChange} />
                </div>
                 <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase">Update Type</label>
                        <Select name="updateType" value={formData.updateType} onChange={handleChange}>
                            {updateTypeOptions.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase">Importance</label>
                         <Select name="importance" value={formData.importance} onChange={handleChange}>
                            {importanceOptions.map((level) => (
                              <option key={level} value={level}>
                                {level}
                              </option>
                            ))}
                        </Select>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase">Summary</label>
                    <Textarea name="summary" value={formData.summary} onChange={handleChange} rows={4} />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase">Details (Optional)</label>
                    <Textarea name="details" value={formData.details ?? ""} onChange={handleChange} rows={8} />
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
