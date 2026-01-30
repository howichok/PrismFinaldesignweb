import Link from "next/link";

type PageProps = {
  searchParams?: { next?: string };
};

export default function UnauthorizedPage({ searchParams }: PageProps) {
  const nextPath = searchParams?.next ?? "/";
  const signInUrl = `/api/auth/discord/start?next=${encodeURIComponent(
    nextPath,
  )}`;

  return (
    <main className="section section--hero">
      <div className="page-hero">
        <span className="hero-badge hero-badge--warning">Restricted</span>
        <h1 className="page-hero__title">
          <span className="page-hero__title-small">Sign in</span>
          <span className="page-hero__title-main">Required</span>
        </h1>
        <p className="page-hero__subtitle">
          You need an account to access this page.
        </p>
      </div>

      <div className="glass-card glass-card--static" style={{ padding: "32px" }}>
        <div className="form-actions">
          <Link href={signInUrl} className="btn btn--primary">
            Sign in with Discord
          </Link>
          <Link href="/" className="btn btn--outline">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
