"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { faqItems } from "@/content/faq";
import { cn } from "@/lib/cn";
import Card from "@/components/ui/Card";
import { buttonStyles } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Tabs from "@/components/ui/Tabs";

type HelpContentProps = {
  authed: boolean;
};

const tabs = ["Q/A", "Ticket"];

export default function HelpContent({ authed }: HelpContentProps) {
  const [activeTab, setActiveTab] = useState<string>(tabs[0]);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(
    faqItems[0]?.id ?? null,
  );

  const filteredFaq = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return faqItems;
    return faqItems.filter((item) => {
      return (
        item.question.toLowerCase().includes(normalized) ||
        item.answer.toLowerCase().includes(normalized)
      );
    });
  }, [query]);

  return (
    <div className="space-y-6">
      <Tabs
        items={tabs}
        value={activeTab}
        onChange={(value) => setActiveTab(value)}
      />

      {activeTab === "Q/A" ? (
        <div className="space-y-4">
          <Input
            placeholder="Search questions..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {filteredFaq.length === 0 ? (
            <Card className="text-sm text-[color:var(--color-muted)]">
              No results. Try a different keyword.
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredFaq.map((item) => {
                const isOpen = openId === item.id;
                return (
                  <Card key={item.id} className="space-y-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 text-left"
                      aria-expanded={isOpen}
                      onClick={() => setOpenId(isOpen ? null : item.id)}
                    >
                      <span className="text-base font-semibold">
                        {item.question}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]",
                          isOpen && "text-[color:var(--color-brand-strong)]",
                        )}
                      >
                        {isOpen ? "Open" : "Closed"}
                      </span>
                    </button>
                    {isOpen ? (
                      <p className="text-sm text-[color:var(--color-muted)]">
                        {item.answer}
                      </p>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Need a ticket?</h2>
            <p className="text-sm text-[color:var(--color-muted)]">
              Submit a support ticket to reach the PrismMTR team. You can track
              replies and status updates directly from your dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {authed ? (
              <Link
                href="/help/ticket"
                className={buttonStyles({ variant: "primary" })}
              >
                Create ticket
              </Link>
            ) : (
              <Link
                href="/api/auth/discord/start?next=/help/ticket"
                className={buttonStyles({ variant: "primary" })}
              >
                Sign in to create a ticket
              </Link>
            )}
            <Link
              href="/help/ticket"
              className={buttonStyles({ variant: "outline" })}
            >
              Go to ticket page
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
