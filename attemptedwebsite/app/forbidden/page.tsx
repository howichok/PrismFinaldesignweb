import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="section section--hero">
      <div className="page-hero">
        <span className="hero-badge hero-badge--danger">Access</span>
        <h1 className="page-hero__title">
          <span className="page-hero__title-small">Access</span>
          <span className="page-hero__title-main">Denied</span>
        </h1>
        <p className="page-hero__subtitle">
          You do not have permission to view this page.
        </p>
      </div>

      <div className="glass-card glass-card--static" style={{ padding: "32px" }}>
        <div className="form-actions">
          <Link href="/dashboard" className="btn btn--primary">
            Back to dashboard
          </Link>
          <Link href="/" className="btn btn--outline">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
