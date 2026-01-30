'use client';

/**
 * ProjectCollaborators Component
 *
 * Displays and manages companies collaborating on a project
 */

import React, { useState, useEffect } from 'react';
import {
  Collaborations,
  ProjectCollaborator,
  CollaborationRole,
} from '@/lib/collaborations';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ProjectCollaboratorsProps {
  projectId: string;
  /** Whether current user can manage collaborators */
  canManage?: boolean;
  /** Callback when collaborators change */
  onChange?: () => void;
  /** Display mode */
  mode?: 'display' | 'manage';
  /** Custom class name */
  className?: string;
}

const ROLE_LABELS: Record<CollaborationRole, string> = {
  owner: 'Owner',
  lead: 'Lead',
  collaborator: 'Collaborator',
  contributor: 'Contributor',
  sponsor: 'Sponsor',
};

const ROLE_COLORS: Record<CollaborationRole, string> = {
  owner: '#6366f1',
  lead: '#22c55e',
  collaborator: '#3b82f6',
  contributor: '#64748b',
  sponsor: '#f59e0b',
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ProjectCollaborators({
  projectId,
  canManage = false,
  onChange,
  mode = 'display',
  className = '',
}: ProjectCollaboratorsProps) {
  const [collaborators, setCollaborators] = useState<ProjectCollaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCollaborators();
  }, [projectId]);

  async function loadCollaborators() {
    try {
      setLoading(true);
      setError(null);
      const data = await Collaborations.getProjectCollaborators(projectId);
      setCollaborators(data);
    } catch (err) {
      setError('Failed to load collaborators');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(companyId: string) {
    if (!confirm('Remove this company from the project?')) return;

    try {
      await Collaborations.removeCollaborator(projectId, companyId);
      await loadCollaborators();
      onChange?.();
    } catch (err) {
      alert('Failed to remove collaborator');
    }
  }

  if (loading) {
    return (
      <div className={`project-collaborators ${className}`}>
        <div className="project-collaborators__loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`project-collaborators ${className}`}>
        <div className="project-collaborators__error">{error}</div>
      </div>
    );
  }

  // Display mode - compact list
  if (mode === 'display') {
    return (
      <div className={`project-collaborators project-collaborators--display ${className}`}>
        <div className="project-collaborators__avatars">
          {collaborators.map((collab, index) => (
            <div
              key={collab.companyId}
              className="project-collaborators__avatar"
              style={{
                zIndex: collaborators.length - index,
                '--role-color': ROLE_COLORS[collab.role],
              } as React.CSSProperties}
              title={`${collab.company.name} (${ROLE_LABELS[collab.role]})`}
            >
              {collab.company.logoUrl ? (
                <img src={collab.company.logoUrl} alt={collab.company.name} />
              ) : (
                <span>{collab.company.name.charAt(0)}</span>
              )}
              {collab.role === 'owner' && (
                <span className="project-collaborators__crown">👑</span>
              )}
            </div>
          ))}
        </div>
        {collaborators.length > 1 && (
          <span className="project-collaborators__count">
            {collaborators.length} companies
          </span>
        )}
      </div>
    );
  }

  // Manage mode - full list with actions
  return (
    <div className={`project-collaborators project-collaborators--manage ${className}`}>
      <div className="project-collaborators__header">
        <h3 className="project-collaborators__title">Collaborating Companies</h3>
        <span className="project-collaborators__count">
          {collaborators.length} total
        </span>
      </div>

      <div className="project-collaborators__list">
        {collaborators.map((collab) => (
          <div key={collab.companyId} className="project-collaborators__item">
            <div className="project-collaborators__company">
              <div className="project-collaborators__logo">
                {collab.company.logoUrl ? (
                  <img src={collab.company.logoUrl} alt={collab.company.name} />
                ) : (
                  <span>{collab.company.name.charAt(0)}</span>
                )}
              </div>
              <div className="project-collaborators__info">
                <span className="project-collaborators__name">
                  {collab.company.name}
                </span>
                <span
                  className="project-collaborators__role"
                  style={{ color: ROLE_COLORS[collab.role] }}
                >
                  {ROLE_LABELS[collab.role]}
                </span>
              </div>
            </div>

            {collab.contribution && (
              <p className="project-collaborators__contribution">
                {collab.contribution}
              </p>
            )}

            <div className="project-collaborators__permissions">
              {collab.canEdit && <span className="permission-badge">Can Edit</span>}
              {collab.canPublish && <span className="permission-badge">Can Publish</span>}
            </div>

            {canManage && collab.role !== 'owner' && (
              <div className="project-collaborators__actions">
                <button
                  className="btn-icon btn-icon--danger"
                  onClick={() => handleRemove(collab.companyId)}
                  title="Remove"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <button className="project-collaborators__add">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14m-7-7h14" />
          </svg>
          Invite Company
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPACT BADGE (for cards)
// ═══════════════════════════════════════════════════════════════════════════

export function CollaboratorsBadge({
  collaborators,
  maxDisplay = 3,
}: {
  collaborators: ProjectCollaborator[];
  maxDisplay?: number;
}) {
  const displayed = collaborators.slice(0, maxDisplay);
  const remaining = collaborators.length - maxDisplay;

  return (
    <div className="collaborators-badge">
      {displayed.map((collab, index) => (
        <div
          key={collab.companyId}
          className="collaborators-badge__item"
          style={{ zIndex: maxDisplay - index }}
          title={collab.company.name}
        >
          {collab.company.logoUrl ? (
            <img src={collab.company.logoUrl} alt="" />
          ) : (
            <span>{collab.company.name.charAt(0)}</span>
          )}
        </div>
      ))}
      {remaining > 0 && (
        <div className="collaborators-badge__more">
          +{remaining}
        </div>
      )}
    </div>
  );
}

export default ProjectCollaborators;
