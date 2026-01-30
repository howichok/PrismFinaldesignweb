/**
 * Project Collaborations Module
 *
 * Handles many-to-many relationships between projects and companies
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type CollaborationRole =
  | 'owner'        // Primary company
  | 'lead'         // Co-owner
  | 'collaborator' // Regular collaborator
  | 'contributor'  // Minor contributor
  | 'sponsor';     // Financial/resource sponsor

export type CollaborationStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'declined'
  | 'removed';

export interface ProjectCompany {
  id: string;
  projectId: string;
  companyId: string;
  role: CollaborationRole;
  contribution?: string;
  creditOrder: number;
  status: CollaborationStatus;
  canEdit: boolean;
  canPublish: boolean;
  canInvite: boolean;
  invitedBy?: string;
  invitedAt?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCollaborator extends ProjectCompany {
  company: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  };
}

export interface CompanyProject {
  projectId: string;
  projectName: string;
  projectSlug: string;
  projectImage?: string;
  projectStatus: string;
  companyRole: CollaborationRole;
  collaborationStatus: CollaborationStatus;
}

export interface AddCollaboratorInput {
  projectId: string;
  companyId: string;
  role?: CollaborationRole;
  contribution?: string;
  canEdit?: boolean;
  canPublish?: boolean;
  invitedBy?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

// ═══════════════════════════════════════════════════════════════════════════
// COLLABORATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all collaborating companies for a project
 */
export async function getProjectCollaborators(
  projectId: string
): Promise<ProjectCollaborator[]> {
  const { data, error } = await getSupabase()
    .from('project_companies')
    .select(`
      *,
      company:companies (
        id,
        name,
        slug,
        logo_url
      )
    `)
    .eq('project_id', projectId)
    .eq('status', 'active')
    .order('credit_order', { ascending: true });

  if (error) throw error;

  return (data || []).map(mapToProjectCollaborator);
}

/**
 * Get owner company of a project
 */
export async function getProjectOwner(projectId: string): Promise<ProjectCollaborator | null> {
  const { data, error } = await getSupabase()
    .from('project_companies')
    .select(`
      *,
      company:companies (
        id,
        name,
        slug,
        logo_url
      )
    `)
    .eq('project_id', projectId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return mapToProjectCollaborator(data);
}

/**
 * Get all projects for a company (including collaborations)
 */
export async function getCompanyProjects(
  companyId: string,
  includeInactive = false
): Promise<CompanyProject[]> {
  let query = getSupabase()
    .from('project_companies')
    .select(`
      role,
      status,
      project:projects (
        id,
        name,
        slug,
        image_url,
        status
      )
    `)
    .eq('company_id', companyId);

  if (!includeInactive) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((row: any) => ({
    projectId: row.project.id,
    projectName: row.project.name,
    projectSlug: row.project.slug,
    projectImage: row.project.image_url,
    projectStatus: row.project.status,
    companyRole: row.role,
    collaborationStatus: row.status,
  }));
}

/**
 * Add a company as collaborator to a project
 */
export async function addCollaborator(
  input: AddCollaboratorInput
): Promise<ProjectCompany> {
  const { data, error } = await getSupabase()
    .from('project_companies')
    .insert({
      project_id: input.projectId,
      company_id: input.companyId,
      role: input.role || 'collaborator',
      contribution: input.contribution,
      status: 'pending',
      can_edit: input.canEdit || false,
      can_publish: input.canPublish || false,
      can_invite: false,
      invited_by: input.invitedBy,
      invited_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return mapToProjectCompany(data);
}

/**
 * Accept a collaboration invitation
 */
export async function acceptCollaboration(
  projectId: string,
  companyId: string
): Promise<ProjectCompany> {
  const { data, error } = await getSupabase()
    .from('project_companies')
    .update({
      status: 'active',
      accepted_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) throw error;

  return mapToProjectCompany(data);
}

/**
 * Decline a collaboration invitation
 */
export async function declineCollaboration(
  projectId: string,
  companyId: string
): Promise<void> {
  const { error } = await getSupabase()
    .from('project_companies')
    .update({ status: 'declined' })
    .eq('project_id', projectId)
    .eq('company_id', companyId)
    .eq('status', 'pending');

  if (error) throw error;
}

/**
 * Remove a collaborator from a project
 */
export async function removeCollaborator(
  projectId: string,
  companyId: string
): Promise<void> {
  const { error } = await getSupabase()
    .from('project_companies')
    .update({ status: 'removed' })
    .eq('project_id', projectId)
    .eq('company_id', companyId);

  if (error) throw error;
}

/**
 * Update collaborator permissions
 */
export async function updateCollaboratorPermissions(
  projectId: string,
  companyId: string,
  permissions: {
    canEdit?: boolean;
    canPublish?: boolean;
    canInvite?: boolean;
    role?: CollaborationRole;
    contribution?: string;
    creditOrder?: number;
  }
): Promise<ProjectCompany> {
  const updateData: any = {};

  if (permissions.canEdit !== undefined) updateData.can_edit = permissions.canEdit;
  if (permissions.canPublish !== undefined) updateData.can_publish = permissions.canPublish;
  if (permissions.canInvite !== undefined) updateData.can_invite = permissions.canInvite;
  if (permissions.role !== undefined) updateData.role = permissions.role;
  if (permissions.contribution !== undefined) updateData.contribution = permissions.contribution;
  if (permissions.creditOrder !== undefined) updateData.credit_order = permissions.creditOrder;

  const { data, error } = await getSupabase()
    .from('project_companies')
    .update(updateData)
    .eq('project_id', projectId)
    .eq('company_id', companyId)
    .select()
    .single();

  if (error) throw error;

  return mapToProjectCompany(data);
}

/**
 * Check if a company can edit a project
 */
export async function canCompanyEditProject(
  companyId: string,
  projectId: string
): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('project_companies')
    .select('role, can_edit')
    .eq('project_id', projectId)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .single();

  if (error) return false;

  return data.role === 'owner' || data.can_edit === true;
}

/**
 * Get pending collaboration invitations for a company
 */
export async function getPendingInvitations(
  companyId: string
): Promise<ProjectCollaborator[]> {
  const { data, error } = await getSupabase()
    .from('project_companies')
    .select(`
      *,
      project:projects (
        id,
        name,
        slug,
        image_url
      ),
      inviter:users!invited_by (
        id,
        nickname
      )
    `)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('invited_at', { ascending: false });

  if (error) throw error;

  return data || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// MAPPERS
// ═══════════════════════════════════════════════════════════════════════════

function mapToProjectCompany(row: any): ProjectCompany {
  return {
    id: row.id,
    projectId: row.project_id,
    companyId: row.company_id,
    role: row.role,
    contribution: row.contribution,
    creditOrder: row.credit_order,
    status: row.status,
    canEdit: row.can_edit,
    canPublish: row.can_publish,
    canInvite: row.can_invite,
    invitedBy: row.invited_by,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapToProjectCollaborator(row: any): ProjectCollaborator {
  return {
    ...mapToProjectCompany(row),
    company: {
      id: row.company.id,
      name: row.company.name,
      slug: row.company.slug,
      logoUrl: row.company.logo_url,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const Collaborations = {
  getProjectCollaborators,
  getProjectOwner,
  getCompanyProjects,
  addCollaborator,
  acceptCollaboration,
  declineCollaboration,
  removeCollaborator,
  updateCollaboratorPermissions,
  canCompanyEditProject,
  getPendingInvitations,
};

export default Collaborations;
