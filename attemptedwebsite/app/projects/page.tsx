export default function ProjectsPage() {
  return (
    <main className="projects-page">
      <section className="projects-hero">
        <span className="hero-badge">Community</span>
        <h1 className="projects-hero__title">Projects</h1>
        <p className="projects-hero__subtitle">
          Discover and share MTR buildings, stations, lines, and infrastructure
        </p>
      </section>

      <section className="projects-controls">
        <div className="projects-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input type="text" id="projectSearch" placeholder="Search projects..." />
        </div>

        <div className="projects-filters">
          <select id="filterCategory" defaultValue="">
            <option value="">All Categories</option>
            <option value="building">Buildings</option>
            <option value="station">Stations</option>
            <option value="line_section">Line Sections</option>
            <option value="line">Lines</option>
          </select>

          <select id="filterRole" defaultValue="">
            <option value="">All Projects</option>
            <option value="mine">My Projects</option>
            <option value="owner">As Owner</option>
            <option value="coowner">As Co-owner</option>
            <option value="member">As Member</option>
          </select>
        </div>

        <button className="btn btn--primary" id="createProjectBtn" style={{ display: "none" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Project
        </button>
      </section>

      <section className="projects-grid" id="projectsGrid">
        <div className="projects-loading" id="projectsLoading">
          <div className="spinner"></div>
          <p>Loading projects...</p>
        </div>

        <div className="projects-empty" id="projectsEmpty" style={{ display: "none" }}>
          <div className="projects-empty__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3>No projects yet</h3>
          <p>Be the first to share a project with the community!</p>
        </div>
      </section>

      <div className="modal" id="projectModal">
        <div className="modal__backdrop" data-action="close-project-modal" aria-hidden="true"></div>
        <div className="modal__container">
          <button className="modal__close" data-action="close-project-modal" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="project-modal">
            <div className="project-modal__header">
              <div className="project-modal__image-upload" id="imageUploadArea">
                <input type="file" id="projectImage" accept="image/*" hidden />
                <div className="project-modal__image-placeholder" id="imagePlaceholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span>Add cover image</span>
                </div>
                <img
                  className="project-modal__image-preview"
                  id="imagePreview"
                  style={{ display: "none" }}
                  alt="Project cover preview"
                />
              </div>
            </div>

            <form className="project-modal__form" id="projectFormEl">
              <input type="hidden" id="projectId" value="" />

              <div className="form-group">
                <label className="form-label" htmlFor="projectName">
                  Project Name
                </label>
                <input
                  type="text"
                  className="form-input form-input--lg"
                  id="projectName"
                  placeholder="My Awesome Modpack"
                  required
                  maxLength={50}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="projectDescription">
                  Description
                </label>
                <textarea
                  className="form-textarea"
                  id="projectDescription"
                  placeholder="What makes your project special?"
                  required
                  minLength={20}
                  maxLength={500}
                  rows={3}
                ></textarea>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="projectCategory">
                    Category
                  </label>
                  <select className="form-select" id="projectCategory" required defaultValue="">
                    <option value="">Select category...</option>
                    <option value="building">Building</option>
                    <option value="station">Station</option>
                    <option value="line_section">Line Section</option>
                    <option value="line">Line / Extension</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="projectStatus">
                    Status
                  </label>
                  <select className="form-select" id="projectStatus" defaultValue="active">
                    <option value="active">Active</option>
                    <option value="planning">Planning</option>
                    <option value="completed">Completed</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>

              <div className="form-section-title">Team</div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    Co-owners{" "}
                    <span className="form-hint" style={{ display: "inline", margin: 0 }}>
                      (optional)
                    </span>
                  </label>
                  <div className="team-list" id="coownersList">
                    <div className="team-list__empty" id="coownersEmpty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span>No co-owners added</span>
                    </div>
                  </div>
                  <div className="add-member">
                    <div className="add-member__row">
                      <input type="text" className="form-input" id="coownerInput" placeholder="Enter username..." />
                      <button type="button" className="btn btn--outline" id="addCoownerBtn">
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Members{" "}
                    <span className="form-hint" style={{ display: "inline", margin: 0 }}>
                      (optional)
                    </span>
                  </label>
                  <div className="team-list" id="membersList">
                    <div className="team-list__empty" id="membersEmpty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span>No members added</span>
                    </div>
                  </div>
                  <div className="add-member">
                    <div className="add-member__row">
                      <input type="text" className="form-input" id="memberInput" placeholder="Enter username..." />
                      <button type="button" className="btn btn--outline" id="addMemberBtn">
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn--ghost" data-action="close-project-modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" id="submitProjectBtn">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal" id="viewProjectModal">
        <div className="modal__backdrop" data-action="close-view-modal" aria-hidden="true"></div>
        <div className="modal__container modal__container--lg">
          <button className="modal__close" data-action="close-view-modal" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="project-view" id="projectView"></div>
        </div>
      </div>
    </main>
  );
}
