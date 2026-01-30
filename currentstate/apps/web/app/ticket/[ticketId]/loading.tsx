import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";

export default function TicketThreadLoading() {
  return (
    <main className="py-12 md:py-16">
      <Container className="space-y-6">
        <Card className="space-y-3">
          <div className="h-3 w-1/4 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-6 w-2/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-4 w-1/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
        </Card>
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <Card key={item} className="space-y-3">
              <div className="h-3 w-1/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
              <div className="h-4 w-full animate-pulse rounded-full bg-[color:var(--color-line)]" />
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-[color:var(--color-line)]" />
            </Card>
          ))}
        </div>
      </Container>
    </main>
  );
}
