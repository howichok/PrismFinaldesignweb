"use client";

import { csrfFetch, getErrorMessage } from "@/lib/security/csrf-client";
import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button, { buttonStyles } from "@/components/ui/Button";

const categories = [
  { value: "LAUNCHER", label: "Launcher" },
  { value: "SERVER", label: "Server" },
  { value: "WEBSITE", label: "Website" },
  { value: "REPORT", label: "Report" },
  { value: "OTHER", label: "Other" },
];

const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 2000;

export default function HelpTicketClient() {
  const router = useRouter();
  const [category, setCategory] = useState(categories[0]?.value ?? "OTHER");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedSubject) {
      setError("Subject is required.");
      return;
    }

    if (!trimmedMessage) {
      setError("Message is required.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await csrfFetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject: trimmedSubject,
          message: trimmedMessage,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: unknown };
        throw new Error(getErrorMessage(data, "Failed to submit ticket."));
      }

      const data = (await response.json()) as { id: string };
      router.push(`/ticket/${data.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit ticket.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="space-y-6">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Category
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-11 w-full rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 text-sm text-[color:var(--color-ink)] shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
          >
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Subject
          </label>
          <Input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Summarize the issue in one line"
            maxLength={MAX_SUBJECT_LENGTH}
          />
          <p className="text-xs text-[color:var(--color-muted)]">
            {subject.length}/{MAX_SUBJECT_LENGTH}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Message
          </label>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe what happened, steps to reproduce, and any logs."
            maxLength={MAX_MESSAGE_LENGTH}
            rows={8}
          />
          <p className="text-xs text-[color:var(--color-muted)]">
            {message.length}/{MAX_MESSAGE_LENGTH}
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/70 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit ticket"}
          </Button>
          <span className="text-xs text-[color:var(--color-muted)]">
            Need to attach logs? You can add them in the thread after submit.
          </span>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
        <span>Looking for general help?</span>
        <Link
          href="/help"
          className={buttonStyles({ variant: "ghost", size: "sm" })}
        >
          Browse the FAQ
        </Link>
      </div>
    </Card>
  );
}
