import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";

export default function ProjectLoading() {
  return (
    <main className="py-12 md:py-16">
      <Container className="space-y-8">
        <div className="h-6 w-36 animate-pulse rounded-full bg-[color:var(--color-line)]" />
        <div className="space-y-4">
          <div className="h-10 w-3/4 animate-pulse rounded-2xl bg-[color:var(--color-line)]" />
          <div className="flex flex-wrap gap-3">
            <div className="h-4 w-44 animate-pulse rounded-full bg-[color:var(--color-line)]" />
            <div className="h-4 w-36 animate-pulse rounded-full bg-[color:var(--color-line)]" />
            <div className="h-4 w-32 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-20 animate-pulse rounded-full bg-[color:var(--color-line)]" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-[color:var(--color-line)]" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-9 w-28 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-9 w-28 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-9 w-40 animate-pulse rounded-full bg-[color:var(--color-line)]" />
        </div>
        <Card className="space-y-3">
          <div className="h-4 w-3/4 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-4 w-full animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-4 w-11/12 animate-pulse rounded-full bg-[color:var(--color-line)]" />
        </Card>
      </Container>
    </main>
  );
}
