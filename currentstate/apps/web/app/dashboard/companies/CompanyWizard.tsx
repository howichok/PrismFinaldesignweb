"use client";

import { csrfFetch, getErrorMessage } from "@/lib/security/csrf-client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { buttonStyles } from "@/components/ui/Button";
import { isModOrAdmin } from "@/lib/auth/guards";
import { companyCategories } from "@/content/companyCategories";
import { cn } from "@/lib/cn";

type CompanyWizardProps = {
  siteRole: "USER" | "MOD" | "ADMIN";
};

type Notice = { type: "success" | "error"; message: string } | null;

export default function CompanyWizard({ siteRole }: CompanyWizardProps) {
  const router = useRouter();
  const privileged = isModOrAdmin(siteRole);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);

  const toggleCategory = (value: string) => {
    setCategories((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const canSubmit = name.trim().length > 0 && description.trim().length > 0;

  const handleSubmit = async (intent: "draft" | "submit" | "publish") => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await csrfFetch("/api/dashboard/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          logoUrl,
          categories,
          intent,
        }),
      });

      const data = (await response.json()) as {
        item?: { id: string };
        error?: unknown;
      };

      if (!response.ok || !data.item) {
        throw new Error(getErrorMessage(data, "Unable to create company."));
      }

      setNotice({ type: "success", message: "Company created." });
      router.push(`/dashboard/companies/${data.item.id}/edit`);
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Unable to create company.",
      });
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(
    () => ({
      name: name.trim() || "Untitled company",
      description: description.trim() || "No description yet.",
      categories: categories.length ? categories : ["No categories selected"],
    }),
    [name, description, categories],
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Create company</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Set up your company profile and submit it for review.
        </p>
      </header>

      {notice ? (
        <Card
          className={
            notice.type === "error"
              ? "border-red-200 text-red-700"
              : "border-green-200 text-green-700"
          }
        >
          {notice.message}
        </Card>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
        <span className={step === 1 ? "font-semibold text-[color:var(--color-ink)]" : ""}>
          1. Details
        </span>
        <span>-</span>
        <span className={step === 2 ? "font-semibold text-[color:var(--color-ink)]" : ""}>
          2. Categories
        </span>
        <span>-</span>
        <span className={step === 3 ? "font-semibold text-[color:var(--color-ink)]" : ""}>
          3. Submit
        </span>
      </div>

      {step === 1 ? (
        <Card className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Name
            </label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Company name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Description
            </label>
            <Textarea
              rows={6}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does your company do?"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Logo
            </label>
            <p className="text-sm text-[color:var(--color-muted)]">
              Upload the logo after the company is created.
            </p>
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="space-y-3">
          <p className="text-sm text-[color:var(--color-muted)]">
            Choose up to three categories for now.
          </p>
          <div className="flex flex-wrap gap-2">
            {companyCategories.map((category) => {
              const active = categories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
                    active
                      ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white"
                      : "border-[color:var(--color-line)] text-[color:var(--color-muted)] hover:border-[color:var(--color-brand)]",
                  )}
                  onClick={() => toggleCategory(category)}
                  disabled={!active && categories.length >= 3}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Review</h3>
          <p className="text-sm font-semibold">{summary.name}</p>
          <p className="text-sm text-[color:var(--color-muted)]">
            {summary.description}
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.categories.map((category) => (
              <span
                key={category}
                className="rounded-full border border-[color:var(--color-line)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]"
              >
                {category}
              </span>
            ))}
          </div>
          <p className="text-xs text-[color:var(--color-muted)]">
            Logo upload is available after creation.
          </p>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {step > 1 ? (
          <button
            type="button"
            className={buttonStyles({ variant: "outline", size: "sm" })}
            onClick={() => setStep((prev) => prev - 1)}
            disabled={saving}
          >
            Back
          </button>
        ) : null}

        {step < 3 ? (
          <button
            type="button"
            className={buttonStyles({ variant: "primary", size: "sm" })}
            onClick={() => setStep((prev) => prev + 1)}
            disabled={
              saving || (step === 1 ? !canSubmit : categories.length === 0)
            }
          >
            Next
          </button>
        ) : null}

        {step === 3 ? (
          <>
            <button
              type="button"
              className={buttonStyles({ variant: "outline", size: "sm" })}
              onClick={() => handleSubmit("draft")}
              disabled={!canSubmit || saving}
            >
              Save draft
            </button>
            {!privileged ? (
              <button
                type="button"
                className={buttonStyles({ variant: "primary", size: "sm" })}
                onClick={() => handleSubmit("submit")}
                disabled={!canSubmit || saving}
              >
                Submit for moderation
              </button>
            ) : (
              <button
                type="button"
                className={buttonStyles({ variant: "soft", size: "sm" })}
                onClick={() => handleSubmit("publish")}
                disabled={!canSubmit || saving}
              >
                Publish now
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
