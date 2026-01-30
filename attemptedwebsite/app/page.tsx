import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <main className="hero" id="mainContent">
        <h1 className="hero__title">
          <span className="hero__title-line">Minecraft Transit Railway</span>
          <span className="hero__title-accent">PrismMTR</span>
        </h1>
        <p className="hero__subtitle">
          The optimized launcher for Minecraft Transit Railway.
          <br />
          <span className="hero__highlight">Stability.</span>{" "}
          <span className="hero__highlight">Performance.</span>{" "}
          <span className="hero__highlight">Optimization.</span>
        </p>
        <div className="hero__actions">
          <Link
            href="/download"
            className="btn btn--primary btn--glow"
            id="downloadCtaBtn"
          >
            <svg
              className="btn__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download Launcher
          </Link>
          <Link href="/help" className="btn btn--ghost">
            <svg
              className="btn__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
            </svg>
            Get Help
          </Link>
        </div>
        <div className="hero__stats">
          <div className="stat">
            <span className="stat__value">1.20.1</span>
            <span className="stat__label">Fabric Version</span>
          </div>
          <div className="stat">
            <span className="stat__value">MTR</span>
            <span className="stat__label"> Prism Server</span>
          </div>
          <div className="stat">
            <span className="stat__value">30+</span>
            <span className="stat__label">FPS Boost</span>
          </div>
        </div>
      </main>

      <section className="home-posts" id="homePostsSection">
        <div className="home-posts__container">
          <div className="home-posts__header">
            <h2 className="home-posts__title">Latest Posts</h2>
            <Link href="/posts" className="home-posts__view-all">
              View All Posts
            </Link>
          </div>
          <div className="home-posts__list" id="homePostsList">
            <div className="home-posts__loading">
              <div className="spinner"></div>
              <p>Loading posts...</p>
            </div>
          </div>
          <div
            className="home-posts__empty"
            id="homePostsEmpty"
            style={{ display: "none" }}
          >
            <div className="home-posts__empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3>No posts yet</h3>
            <p>Be the first to share something with the community!</p>
          </div>
        </div>
      </section>
    </>
  );
}
