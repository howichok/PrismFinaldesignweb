import Link from "next/link";

export default function NotFound() {
  return (
    <main className="section section--hero">
      <div className="page-hero">
        <span className="hero-badge">Error 404</span>
        <h1 className="page-hero__title">
          <span className="page-hero__title-small">Page</span>
          <span className="page-hero__title-main">Not Found</span>
        </h1>
        <p className="page-hero__subtitle">
          The content you are looking for is not available or has been moved.
        </p>
      </div>

      <div className="glass-card glass-card--static" style={{ padding: "32px" }}>
        <div className="form-actions">
          <Link href="/" className="btn btn--outline">
            Go home
          </Link>
          <Link href="/discovery" className="btn btn--ghost">
            Browse Discovery
          </Link>
        </div>
      </div>
    </main>
  );
}
