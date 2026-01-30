export default function PostsPage() {
  return (
    <main className="posts-page">
      <section className="posts-hero">
        <span className="hero-badge">Community</span>
        <h1 className="posts-hero__title">Posts</h1>
        <p className="posts-hero__subtitle">
          News, updates, and announcements from the community
        </p>
      </section>

      <section className="posts-controls">
        <div className="posts-filters">
          <select id="filterCategory" defaultValue="">
            <option value="">All Categories</option>
            <option value="news">News</option>
            <option value="update">Update</option>
            <option value="announcement">Announcement</option>
            <option value="guide">Guide</option>
            <option value="showcase">Showcase</option>
          </select>
        </div>
        <div className="posts-view-toggle">
          <button className="view-toggle-btn" data-view="list" title="List View">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <button className="view-toggle-btn active" data-view="grid" title="Grid View">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
        </div>
      </section>

      <section className="posts-list posts-list--grid" id="postsList">
        <div className="posts-loading" id="postsLoading">
          <div className="spinner"></div>
          <p>Loading posts...</p>
        </div>

        <div className="posts-empty" id="postsEmpty" style={{ display: "none" }}>
          <div className="posts-empty__icon">
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
      </section>
    </main>
  );
}
