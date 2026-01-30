"use client";

import { useEffect } from "react";

import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import { buttonStyles } from "@/components/ui/Button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="py-12 md:py-16">
          <Container className="space-y-6">
            <header className="space-y-2">
              <h1 className="text-3xl font-semibold">Something went wrong</h1>
              <p className="text-sm text-[color:var(--color-muted)]">
                Please try again or return to the homepage.
              </p>
            </header>
            <Card className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--color-muted)]">
              <button
                type="button"
                className={buttonStyles({ size: "sm" })}
                onClick={() => reset()}
              >
                Try again
              </button>
              <a
                href="/"
                className={buttonStyles({ variant: "outline", size: "sm" })}
              >
                Home
              </a>
            </Card>
          </Container>
        </main>
      </body>
    </html>
  );
}
