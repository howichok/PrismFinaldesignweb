export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          discordId: string;
          displayName: string;
          avatarUrl: string | null;
          siteRole: Database["public"]["Enums"]["site_role"];
          rolesVersion: number;
          status: Database["public"]["Enums"]["user_status"];
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          discordId: string;
          displayName: string;
          avatarUrl?: string | null;
          siteRole?: Database["public"]["Enums"]["site_role"];
          rolesVersion?: number;
          status?: Database["public"]["Enums"]["user_status"];
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          discordId?: string;
          displayName?: string;
          avatarUrl?: string | null;
          siteRole?: Database["public"]["Enums"]["site_role"];
          rolesVersion?: number;
          status?: Database["public"]["Enums"]["user_status"];
          createdAt?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      account_connections: {
        Row: {
          id: string;
          provider: Database["public"]["Enums"]["auth_provider"];
          providerUserId: string;
          userId: string;
          accessToken: string | null;
          refreshToken: string | null;
          profileData: Json | null;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          provider: Database["public"]["Enums"]["auth_provider"];
          providerUserId: string;
          userId: string;
          accessToken?: string | null;
          refreshToken?: string | null;
          profileData?: Json | null;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          provider?: Database["public"]["Enums"]["auth_provider"];
          providerUserId?: string;
          userId?: string;
          accessToken?: string | null;
          refreshToken?: string | null;
          profileData?: Json | null;
          createdAt?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          userId: string;
          discordId: string;
          displayName: string;
          avatarUrl: string | null;
          siteRole: Database["public"]["Enums"]["site_role"];
          rolesVersion: number;
          createdAt: string;
          expiresAt: string;
        };
        Insert: {
          id: string;
          userId: string;
          discordId: string;
          displayName: string;
          avatarUrl?: string | null;
          siteRole: Database["public"]["Enums"]["site_role"];
          rolesVersion: number;
          createdAt?: string;
          expiresAt: string;
        };
        Update: {
          id?: string;
          userId?: string;
          discordId?: string;
          displayName?: string;
          avatarUrl?: string | null;
          siteRole?: Database["public"]["Enums"]["site_role"];
          rolesVersion?: number;
          createdAt?: string;
          expiresAt?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          name: string;
          description: string;
          logoUrl: string | null;
          logoAssetId: string | null;
          categories: string[];
          isHidden: boolean;
          visibilityStatus: Database["public"]["Enums"]["content_status"];
          rejectionReason: string | null;
          publishedAt: string | null;
          createdByUserId: string;
          ownerUserId: string;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          logoUrl?: string | null;
          logoAssetId?: string | null;
          categories?: string[];
          isHidden?: boolean;
          visibilityStatus?: Database["public"]["Enums"]["content_status"];
          rejectionReason?: string | null;
          publishedAt?: string | null;
          createdByUserId: string;
          ownerUserId: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          logoUrl?: string | null;
          logoAssetId?: string | null;
          categories?: string[];
          isHidden?: boolean;
          visibilityStatus?: Database["public"]["Enums"]["content_status"];
          rejectionReason?: string | null;
          publishedAt?: string | null;
          createdByUserId?: string;
          ownerUserId?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      company_memberships: {
        Row: {
          id: string;
          companyId: string;
          userId: string;
          companyRole: Database["public"]["Enums"]["company_role"];
          joinedAt: string;
          invitedByUserId: string | null;
        };
        Insert: {
          id?: string;
          companyId: string;
          userId: string;
          companyRole: Database["public"]["Enums"]["company_role"];
          joinedAt?: string;
          invitedByUserId?: string | null;
        };
        Update: {
          id?: string;
          companyId?: string;
          userId?: string;
          companyRole?: Database["public"]["Enums"]["company_role"];
          joinedAt?: string;
          invitedByUserId?: string | null;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          title: string;
          content: string;
          tags: string[];
          ownerType: Database["public"]["Enums"]["owner_type"];
          ownerUserId: string | null;
          ownerCompanyId: string | null;
          createdByUserId: string;
          coverAssetId: string | null;
          isHidden: boolean;
          status: Database["public"]["Enums"]["content_status"];
          rejectionReason: string | null;
          publishedAt: string | null;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          tags?: string[];
          ownerType: Database["public"]["Enums"]["owner_type"];
          ownerUserId?: string | null;
          ownerCompanyId?: string | null;
          createdByUserId: string;
          coverAssetId?: string | null;
          isHidden?: boolean;
          status?: Database["public"]["Enums"]["content_status"];
          rejectionReason?: string | null;
          publishedAt?: string | null;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          tags?: string[];
          ownerType?: Database["public"]["Enums"]["owner_type"];
          ownerUserId?: string | null;
          ownerCompanyId?: string | null;
          createdByUserId?: string;
          coverAssetId?: string | null;
          isHidden?: boolean;
          status?: Database["public"]["Enums"]["content_status"];
          rejectionReason?: string | null;
          publishedAt?: string | null;
          createdAt?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string;
          tags: string[];
          projectStatus: Database["public"]["Enums"]["project_status"];
          ownerType: Database["public"]["Enums"]["owner_type"];
          ownerUserId: string | null;
          ownerCompanyId: string | null;
          createdByUserId: string;
          coverAssetId: string | null;
          isHidden: boolean;
          moderationStatus: Database["public"]["Enums"]["content_status"];
          rejectionReason: string | null;
          publishedAt: string | null;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          tags?: string[];
          projectStatus?: Database["public"]["Enums"]["project_status"];
          ownerType: Database["public"]["Enums"]["owner_type"];
          ownerUserId?: string | null;
          ownerCompanyId?: string | null;
          createdByUserId: string;
          coverAssetId?: string | null;
          isHidden?: boolean;
          moderationStatus?: Database["public"]["Enums"]["content_status"];
          rejectionReason?: string | null;
          publishedAt?: string | null;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          tags?: string[];
          projectStatus?: Database["public"]["Enums"]["project_status"];
          ownerType?: Database["public"]["Enums"]["owner_type"];
          ownerUserId?: string | null;
          ownerCompanyId?: string | null;
          createdByUserId?: string;
          coverAssetId?: string | null;
          isHidden?: boolean;
          moderationStatus?: Database["public"]["Enums"]["content_status"];
          rejectionReason?: string | null;
          publishedAt?: string | null;
          createdAt?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      project_updates: {
        Row: {
          id: string;
          projectId: string;
          title: string;
          summary: string;
          details: string | null;
          updateType: Database["public"]["Enums"]["project_update_type"];
          importance: Database["public"]["Enums"]["update_importance"];
          status: Database["public"]["Enums"]["update_status"];
          createdByUserId: string;
          isHidden: boolean;
          rejectionReason: string | null;
          reviewedByUserId: string | null;
          reviewedAt: string | null;
          createdAt: string;
          publishedAt: string | null;
        };
        Insert: {
          id?: string;
          projectId: string;
          title: string;
          summary: string;
          details?: string | null;
          updateType: Database["public"]["Enums"]["project_update_type"];
          importance: Database["public"]["Enums"]["update_importance"];
          status?: Database["public"]["Enums"]["update_status"];
          createdByUserId: string;
          isHidden?: boolean;
          rejectionReason?: string | null;
          reviewedByUserId?: string | null;
          reviewedAt?: string | null;
          createdAt?: string;
          publishedAt?: string | null;
        };
        Update: {
          id?: string;
          projectId?: string;
          title?: string;
          summary?: string;
          details?: string | null;
          updateType?: Database["public"]["Enums"]["project_update_type"];
          importance?: Database["public"]["Enums"]["update_importance"];
          status?: Database["public"]["Enums"]["update_status"];
          createdByUserId?: string;
          isHidden?: boolean;
          rejectionReason?: string | null;
          reviewedByUserId?: string | null;
          reviewedAt?: string | null;
          createdAt?: string;
          publishedAt?: string | null;
        };
        Relationships: [];
      };
      moderation_requests: {
        Row: {
          id: string;
          targetType: Database["public"]["Enums"]["moderation_target_type"];
          targetId: string;
          submittedByUserId: string;
          status: Database["public"]["Enums"]["moderation_request_status"];
          reviewedByUserId: string | null;
          reason: string | null;
          createdAt: string;
          reviewedAt: string | null;
        };
        Insert: {
          id?: string;
          targetType: Database["public"]["Enums"]["moderation_target_type"];
          targetId: string;
          submittedByUserId: string;
          status?: Database["public"]["Enums"]["moderation_request_status"];
          reviewedByUserId?: string | null;
          reason?: string | null;
          createdAt?: string;
          reviewedAt?: string | null;
        };
        Update: {
          id?: string;
          targetType?: Database["public"]["Enums"]["moderation_target_type"];
          targetId?: string;
          submittedByUserId?: string;
          status?: Database["public"]["Enums"]["moderation_request_status"];
          reviewedByUserId?: string | null;
          reason?: string | null;
          createdAt?: string;
          reviewedAt?: string | null;
        };
        Relationships: [];
      };
      invites: {
        Row: {
          id: string;
          type: Database["public"]["Enums"]["invite_type"];
          status: Database["public"]["Enums"]["invite_status"];
          createdByUserId: string;
          createdAt: string;
          respondedAt: string | null;
          toUserId: string | null;
          companyId: string | null;
          offeredCompanyRole: Database["public"]["Enums"]["company_invite_role"] | null;
          fromCompanyId: string | null;
          toCompanyId: string | null;
          projectId: string | null;
        };
        Insert: {
          id?: string;
          type: Database["public"]["Enums"]["invite_type"];
          status?: Database["public"]["Enums"]["invite_status"];
          createdByUserId: string;
          createdAt?: string;
          respondedAt?: string | null;
          toUserId?: string | null;
          companyId?: string | null;
          offeredCompanyRole?: Database["public"]["Enums"]["company_invite_role"] | null;
          fromCompanyId?: string | null;
          toCompanyId?: string | null;
          projectId?: string | null;
        };
        Update: {
          id?: string;
          type?: Database["public"]["Enums"]["invite_type"];
          status?: Database["public"]["Enums"]["invite_status"];
          createdByUserId?: string;
          createdAt?: string;
          respondedAt?: string | null;
          toUserId?: string | null;
          companyId?: string | null;
          offeredCompanyRole?: Database["public"]["Enums"]["company_invite_role"] | null;
          fromCompanyId?: string | null;
          toCompanyId?: string | null;
          projectId?: string | null;
        };
        Relationships: [];
      };
      project_collaborator_companies: {
        Row: {
          id: string;
          projectId: string;
          companyId: string;
          addedAt: string;
          addedViaInviteId: string | null;
        };
        Insert: {
          id?: string;
          projectId: string;
          companyId: string;
          addedAt?: string;
          addedViaInviteId?: string | null;
        };
        Update: {
          id?: string;
          projectId?: string;
          companyId?: string;
          addedAt?: string;
          addedViaInviteId?: string | null;
        };
        Relationships: [];
      };
      partnerships: {
        Row: {
          id: string;
          companyAId: string;
          companyBId: string;
          status: Database["public"]["Enums"]["partnership_status"];
          createdByUserId: string;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          companyAId: string;
          companyBId: string;
          status?: Database["public"]["Enums"]["partnership_status"];
          createdByUserId: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          companyAId?: string;
          companyBId?: string;
          status?: Database["public"]["Enums"]["partnership_status"];
          createdByUserId?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          createdByUserId: string;
          category: Database["public"]["Enums"]["ticket_category"];
          subject: string;
          status: Database["public"]["Enums"]["ticket_status"];
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: string;
          createdByUserId: string;
          category: Database["public"]["Enums"]["ticket_category"];
          subject: string;
          status?: Database["public"]["Enums"]["ticket_status"];
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: string;
          createdByUserId?: string;
          category?: Database["public"]["Enums"]["ticket_category"];
          subject?: string;
          status?: Database["public"]["Enums"]["ticket_status"];
          createdAt?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      ticket_messages: {
        Row: {
          id: string;
          ticketId: string;
          authorUserId: string;
          message: string;
          createdAt: string;
        };
        Insert: {
          id?: string;
          ticketId: string;
          authorUserId: string;
          message: string;
          createdAt?: string;
        };
        Update: {
          id?: string;
          ticketId?: string;
          authorUserId?: string;
          message?: string;
          createdAt?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          userId: string;
          type: Database["public"]["Enums"]["notification_type"];
          title: string;
          body: string;
          link: string;
          isRead: boolean;
          createdAt: string;
        };
        Insert: {
          id?: string;
          userId: string;
          type: Database["public"]["Enums"]["notification_type"];
          title: string;
          body: string;
          link: string;
          isRead?: boolean;
          createdAt?: string;
        };
        Update: {
          id?: string;
          userId?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          title?: string;
          body?: string;
          link?: string;
          isRead?: boolean;
          createdAt?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actorUserId: string;
          actionType: string;
          targetType: string;
          targetId: string;
          meta: Json | null;
          createdAt: string;
        };
        Insert: {
          id?: string;
          actorUserId: string;
          actionType: string;
          targetType: string;
          targetId: string;
          meta?: Json | null;
          createdAt?: string;
        };
        Update: {
          id?: string;
          actorUserId?: string;
          actionType?: string;
          targetType?: string;
          targetId?: string;
          meta?: Json | null;
          createdAt?: string;
        };
        Relationships: [];
      };
      file_assets: {
        Row: {
          id: string;
          scope: Database["public"]["Enums"]["file_asset_scope"];
          storageBucket: string;
          storagePath: string;
          publicUrl: string;
          mimeType: string;
          sizeBytes: number;
          uploadedByUserId: string;
          createdAt: string;
        };
        Insert: {
          id?: string;
          scope: Database["public"]["Enums"]["file_asset_scope"];
          storageBucket?: string;
          storagePath: string;
          publicUrl: string;
          mimeType: string;
          sizeBytes: number;
          uploadedByUserId: string;
          createdAt?: string;
        };
        Update: {
          id?: string;
          scope?: Database["public"]["Enums"]["file_asset_scope"];
          storageBucket?: string;
          storagePath?: string;
          publicUrl?: string;
          mimeType?: string;
          sizeBytes?: number;
          uploadedByUserId?: string;
          createdAt?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      site_role: "USER" | "MOD" | "ADMIN";
      user_status: "ACTIVE" | "SUSPENDED" | "BANNED";
      auth_provider: "DISCORD" | "GITHUB" | "GOOGLE";
      company_role: "OWNER" | "CO_OWNER" | "TRUSTED" | "MEMBER";
      owner_type: "USER" | "COMPANY";
      content_status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
      project_status: "IN_PROGRESS" | "RELEASED" | "FROZEN";
      project_update_type: "PROGRESS" | "RELEASE" | "FIX" | "ANNOUNCEMENT";
      update_importance: "MAJOR" | "MINOR";
      update_status: "PUBLISHED" | "PENDING" | "REJECTED";
      moderation_target_type: "COMPANY" | "PROJECT" | "POST";
      moderation_request_status: "PENDING" | "APPROVED" | "REJECTED";
      invite_type: "COMPANY_MEMBERSHIP" | "PROJECT_COLLAB" | "PARTNERSHIP";
      invite_status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELED";
      company_invite_role: "MEMBER" | "TRUSTED" | "CO_OWNER";
      partnership_status: "PENDING" | "ACTIVE" | "ENDED";
      ticket_category: "LAUNCHER" | "SERVER" | "WEBSITE" | "REPORT" | "OTHER";
      ticket_status: "OPEN" | "ANSWERED" | "CLOSED";
      notification_type: "MODERATION" | "INVITE" | "TICKET" | "SYSTEM" | "ADMIN";
      file_asset_scope: "COMPANY_LOGO" | "PROJECT_COVER" | "POST_COVER";
    };
    CompositeTypes: Record<string, never>;
  };
};
