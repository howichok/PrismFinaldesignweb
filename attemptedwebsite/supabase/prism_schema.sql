create extension if not exists pgcrypto;

create type site_role as enum ('USER', 'MOD', 'ADMIN');
create type user_status as enum ('ACTIVE', 'SUSPENDED', 'BANNED');
create type auth_provider as enum ('DISCORD', 'GITHUB', 'GOOGLE');
create type company_role as enum ('OWNER', 'CO_OWNER', 'TRUSTED', 'MEMBER');
create type owner_type as enum ('USER', 'COMPANY');
create type content_status as enum ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
create type project_status as enum ('IN_PROGRESS', 'RELEASED', 'FROZEN');
create type project_update_type as enum ('PROGRESS', 'RELEASE', 'FIX', 'ANNOUNCEMENT');
create type update_importance as enum ('MAJOR', 'MINOR');
create type update_status as enum ('PUBLISHED', 'PENDING', 'REJECTED');
create type moderation_target_type as enum ('COMPANY', 'PROJECT', 'POST');
create type moderation_request_status as enum ('PENDING', 'APPROVED', 'REJECTED');
create type invite_type as enum ('COMPANY_MEMBERSHIP', 'PROJECT_COLLAB', 'PARTNERSHIP');
create type invite_status as enum ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED');
create type company_invite_role as enum ('MEMBER', 'TRUSTED', 'CO_OWNER');
create type partnership_status as enum ('PENDING', 'ACTIVE', 'ENDED');
create type ticket_category as enum ('LAUNCHER', 'SERVER', 'WEBSITE', 'REPORT', 'OTHER');
create type ticket_status as enum ('OPEN', 'ANSWERED', 'CLOSED');
create type notification_type as enum ('MODERATION', 'INVITE', 'TICKET', 'SYSTEM', 'ADMIN');
create type file_asset_scope as enum ('COMPANY_LOGO', 'PROJECT_COVER', 'POST_COVER');

create or replace function set_updated_at()
returns trigger as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$ language plpgsql;

create table if not exists users (
  "id" uuid primary key default gen_random_uuid(),
  "discordId" text unique not null,
  "displayName" text not null,
  "avatarUrl" text,
  "siteRole" site_role not null default 'USER',
  "rolesVersion" integer not null default 1,
  "status" user_status not null default 'ACTIVE',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create trigger users_set_updated_at
before update on users
for each row execute procedure set_updated_at();

create table if not exists account_connections (
  "id" uuid primary key default gen_random_uuid(),
  "provider" auth_provider not null,
  "providerUserId" text not null,
  "userId" uuid not null references users("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "profileData" jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("provider", "providerUserId")
);

create trigger account_connections_set_updated_at
before update on account_connections
for each row execute procedure set_updated_at();

create table if not exists sessions (
  "id" uuid primary key,
  "userId" uuid not null references users("id") on delete cascade,
  "discordId" text not null,
  "displayName" text not null,
  "avatarUrl" text,
  "siteRole" site_role not null,
  "rolesVersion" integer not null,
  "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null
);

create index if not exists sessions_user_idx on sessions("userId");
create index if not exists sessions_expires_idx on sessions("expiresAt");

create table if not exists companies (
  "id" uuid primary key default gen_random_uuid(),
  "name" text unique not null,
  "description" text not null,
  "logoUrl" text,
  "logoAssetId" uuid,
  "categories" text[] not null default '{}',
  "isHidden" boolean not null default false,
  "visibilityStatus" content_status not null default 'PENDING',
  "rejectionReason" text,
  "publishedAt" timestamptz,
  "createdByUserId" uuid not null references users("id"),
  "ownerUserId" uuid not null references users("id"),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create trigger companies_set_updated_at
before update on companies
for each row execute procedure set_updated_at();

create table if not exists company_memberships (
  "id" uuid primary key default gen_random_uuid(),
  "companyId" uuid not null references companies("id") on delete cascade,
  "userId" uuid not null references users("id") on delete cascade,
  "companyRole" company_role not null,
  "joinedAt" timestamptz not null default now(),
  "invitedByUserId" uuid references users("id"),
  unique ("companyId", "userId")
);

create table if not exists posts (
  "id" uuid primary key default gen_random_uuid(),
  "title" text not null,
  "content" text not null,
  "tags" text[] not null default '{}',
  "ownerType" owner_type not null,
  "ownerUserId" uuid references users("id"),
  "ownerCompanyId" uuid references companies("id"),
  "createdByUserId" uuid not null references users("id"),
  "coverAssetId" uuid,
  "isHidden" boolean not null default false,
  "status" content_status not null default 'DRAFT',
  "rejectionReason" text,
  "publishedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create trigger posts_set_updated_at
before update on posts
for each row execute procedure set_updated_at();

create table if not exists projects (
  "id" uuid primary key default gen_random_uuid(),
  "name" text not null,
  "description" text not null,
  "tags" text[] not null default '{}',
  "projectStatus" project_status not null default 'IN_PROGRESS',
  "ownerType" owner_type not null,
  "ownerUserId" uuid references users("id"),
  "ownerCompanyId" uuid references companies("id"),
  "createdByUserId" uuid not null references users("id"),
  "coverAssetId" uuid,
  "isHidden" boolean not null default false,
  "moderationStatus" content_status not null default 'DRAFT',
  "rejectionReason" text,
  "publishedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create trigger projects_set_updated_at
before update on projects
for each row execute procedure set_updated_at();

create table if not exists project_updates (
  "id" uuid primary key default gen_random_uuid(),
  "projectId" uuid not null references projects("id") on delete cascade,
  "title" text not null,
  "summary" text not null,
  "details" text,
  "updateType" project_update_type not null,
  "importance" update_importance not null,
  "status" update_status not null default 'PUBLISHED',
  "createdByUserId" uuid not null references users("id"),
  "isHidden" boolean not null default false,
  "rejectionReason" text,
  "reviewedByUserId" uuid references users("id"),
  "reviewedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "publishedAt" timestamptz
);

create table if not exists moderation_requests (
  "id" uuid primary key default gen_random_uuid(),
  "targetType" moderation_target_type not null,
  "targetId" uuid not null,
  "submittedByUserId" uuid not null references users("id"),
  "status" moderation_request_status not null default 'PENDING',
  "reviewedByUserId" uuid references users("id"),
  "reason" text,
  "createdAt" timestamptz not null default now(),
  "reviewedAt" timestamptz
);

create table if not exists invites (
  "id" uuid primary key default gen_random_uuid(),
  "type" invite_type not null,
  "status" invite_status not null default 'PENDING',
  "createdByUserId" uuid not null references users("id"),
  "createdAt" timestamptz not null default now(),
  "respondedAt" timestamptz,
  "toUserId" uuid references users("id"),
  "companyId" uuid references companies("id"),
  "offeredCompanyRole" company_invite_role,
  "fromCompanyId" uuid references companies("id"),
  "toCompanyId" uuid references companies("id"),
  "projectId" uuid references projects("id")
);

create table if not exists project_collaborator_companies (
  "id" uuid primary key default gen_random_uuid(),
  "projectId" uuid not null references projects("id") on delete cascade,
  "companyId" uuid not null references companies("id") on delete cascade,
  "addedAt" timestamptz not null default now(),
  "addedViaInviteId" uuid references invites("id"),
  unique ("projectId", "companyId")
);

create table if not exists partnerships (
  "id" uuid primary key default gen_random_uuid(),
  "companyAId" uuid not null references companies("id") on delete cascade,
  "companyBId" uuid not null references companies("id") on delete cascade,
  "status" partnership_status not null default 'PENDING',
  "createdByUserId" uuid not null references users("id"),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("companyAId", "companyBId")
);

create trigger partnerships_set_updated_at
before update on partnerships
for each row execute procedure set_updated_at();

create table if not exists tickets (
  "id" uuid primary key default gen_random_uuid(),
  "createdByUserId" uuid not null references users("id"),
  "category" ticket_category not null,
  "subject" text not null,
  "status" ticket_status not null default 'OPEN',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create trigger tickets_set_updated_at
before update on tickets
for each row execute procedure set_updated_at();

create table if not exists ticket_messages (
  "id" uuid primary key default gen_random_uuid(),
  "ticketId" uuid not null references tickets("id") on delete cascade,
  "authorUserId" uuid not null references users("id"),
  "message" text not null,
  "createdAt" timestamptz not null default now()
);

create table if not exists notifications (
  "id" uuid primary key default gen_random_uuid(),
  "userId" uuid not null references users("id") on delete cascade,
  "type" notification_type not null,
  "title" text not null,
  "body" text not null,
  "link" text not null,
  "isRead" boolean not null default false,
  "createdAt" timestamptz not null default now()
);

create table if not exists audit_logs (
  "id" uuid primary key default gen_random_uuid(),
  "actorUserId" uuid not null references users("id"),
  "actionType" text not null,
  "targetType" text not null,
  "targetId" text not null,
  "meta" jsonb,
  "createdAt" timestamptz not null default now()
);

create table if not exists file_assets (
  "id" uuid primary key default gen_random_uuid(),
  "scope" file_asset_scope not null,
  "storageBucket" text not null default 'assets',
  "storagePath" text unique not null,
  "publicUrl" text not null,
  "mimeType" text not null,
  "sizeBytes" integer not null,
  "uploadedByUserId" uuid not null references users("id"),
  "createdAt" timestamptz not null default now()
);
