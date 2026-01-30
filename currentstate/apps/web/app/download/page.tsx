import { getSession } from "@/lib/auth/session";

const launcherUrl = "/downloads/PrismMTRLauncher.exe";

export default async function DownloadPage() {
  const session = await getSession();
  const userInitials = session?.displayName?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <main className="download-page">
      <section className="download-hero">
        <div className="download-hero__content">
          <h1 className="download-hero__title">
            <span className="download-hero__title-small">Download</span>
            <span className="download-hero__title-main">PrismMTR</span>
          </h1>

          <p className="download-hero__subtitle">
            Minecraft Transit Railway launcher.
            <span className="text-highlight">Stability, performance, optimization</span> -
            built for the MTR mod on Fabric 1.20.1.
          </p>

          <div className="download-card glass-card">
            <div className="download-card__header">
              <div className="download-card__icon">
                <picture>
                  <source srcSet="/assets/img/prismmtrlogo.webp" type="image/webp" />
                  <img
                    src="/assets/img/prismmtrlogo-optimized.png"
                    alt="PrismMTR"
                    className="download-card__logo"
                    width="64"
                    height="64"
                  />
                </picture>
              </div>
              <div className="download-card__info">
                <h2 className="download-card__title">PrismMTR Launcher</h2>
                <p className="download-card__meta">Windows 10/11 • 64-bit • Fabric 1.20.1</p>
              </div>
            </div>

            <div className="platform-selector">
              <button className="platform-btn active" data-platform="windows">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                </svg>
                <span>Windows</span>
              </button>
              <button className="platform-btn" data-platform="mac" disabled>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <span>macOS</span>
                <span className="platform-soon">Soon</span>
              </button>
              <button className="platform-btn" data-platform="linux" disabled>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139z" />
                </svg>
                <span>Linux</span>
                <span className="platform-soon">Soon</span>
              </button>
            </div>

            {session ? (
              <div className="download-card__ready" id="downloadReady">
                <div className="user-badge">
                  <div className="user-badge__avatar" id="userAvatar">
                    {userInitials}
                  </div>
                  <div className="user-badge__info">
                    <span className="user-badge__name" id="userName">
                      {session.displayName}
                    </span>
                    <span className="user-badge__status">Access Granted</span>
                  </div>
                </div>
                <a
                  href={launcherUrl}
                  className="btn btn--primary btn--glow btn--lg download-btn"
                  id="downloadBtn"
                  data-download-url={launcherUrl}
                >
                  <svg className="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Launcher
                </a>
              </div>
            ) : (
              <div className="download-card__auth" id="authGate">
                <div className="auth-required">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <div className="auth-required__text">
                    <strong>Authentication Required</strong>
                    <span>Sign in to access downloads</span>
                  </div>
                </div>
                <a
                  href="/api/auth/discord/start?next=/download"
                  className="btn btn--primary btn--lg"
                  data-action="open-login"
                >
                  Sign In to Download
                </a>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
