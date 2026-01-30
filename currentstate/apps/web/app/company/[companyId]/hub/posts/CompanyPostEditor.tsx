"use client";

import { csrfFetch } from "@/lib/security/csrf-client";
import type { CompanyRole, ContentStatus } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import ImageUploader from "@/components/uploads/ImageUploader";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { buttonStyles } from "@/components/ui/Button";
import { formatDate } from "@/lib/dashboard/format";
import { isCompanyEditor } from "@/lib/company/roles";

type CompanyPostEditorProps = {
  mode: "create" | "edit";
  companyId: string;
  postId?: string;
  role: CompanyRole;
};

type PostPayload = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  status: ContentStatus;
  coverAsset?: { id: string; publicUrl: string } | null;
  updatedAt: string;
  publishedAt: string | null;
};

type Notice = { type: "success" | "error"; message: string } | null;

export default function CompanyPostEditor({
  mode,
  companyId,
  postId,
  role,
}: CompanyPostEditorProps) {
  const router = useRouter();
  const isReviewer = isCompanyEditor(role);
  const isMember = role === "MEMBER";

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<ContentStatus>("DRAFT");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      // Note: This fetches from the regular post endpoint, not proposals.
      // This editor is for published/draft posts owned by reviewers.
      const response = await csrfFetch(
        `/api/company/${companyId}/posts/${postId}`,
      );
      if (!response.ok) {
        throw new Error("Post not found.");
      }
      const data = (await response.json()) as { item: PostPayload };
      setTitle(data.item.title);
      setContent(data.item.content);
      setTags(data.item.tags.join(", "));
      setStatus(data.item.status);
      setUpdatedAt(data.item.updatedAt);
      setCoverUrl(data.item.coverAsset?.publicUrl ?? null);
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load post.",
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, postId]);

  useEffect(() => {
    if (mode === 'edit') {
      fetchPost();
    }
  }, [mode, fetchPost]);

  const handleProposalSubmit = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await csrfFetch(`/api/company/${companyId}/proposals/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, tags }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to submit proposal.");
      setNotice({ type: "success", message: "Proposal submitted for review." });
      // redirect to proposals list
      router.push(`/company/${companyId}/hub/proposals`);
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to save post.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (intent: "draft" | "publish" | "save") => {
    if (!isReviewer) {
      setNotice({ type: "error", message: "Insufficient permissions." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const response = await csrfFetch(
        mode === "create"
          ? `/api/company/${companyId}/posts`
          : `/api/company/${companyId}/posts/${postId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            content,
            tags,
            intent,
          }),
        },
      );

      const data = (await response.json()) as {
        item?: PostPayload;
        error?: string;
      };

      if (!response.ok || !data.item) {
        throw new Error(data.error ?? "Unable to save post.");
      }

      setStatus(data.item.status);
      setUpdatedAt(data.item.updatedAt);
      setNotice({ type: "success", message: "Post saved." });

      if (mode === "create") {
        router.push(`/company/${companyId}/hub/posts/${data.item.id}/edit`);
      }
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to save post.",
      });
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = title.trim().length > 0 && content.trim().length > 0;
  const headerText = mode === "create" ? (isReviewer ? "Create Post" : "Create Post Proposal") : "Edit Post";
  const subHeaderText = isReviewer ? "Publish instantly or save as a draft." : "Your proposal will be reviewed by the company owners.";


  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">{headerText}</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          {subHeaderText}
        </p>
      </header>

      {notice ? (
        <Card
          className={
            notice.type === "error"
              ? "border-red-200 text-red-700"
              : "border-green-200 text-green-700"
          }
        >
          {notice.message}
        </Card>
      ) : null}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <Card className="space-y-4">
          {mode === "edit" && postId ? (
            <ImageUploader
              scope="POST_COVER"
              entityId={postId}
              currentUrl={coverUrl}
              onUploaded={(url) => setCoverUrl(url)}
            />
          ) : (
            <Card className="text-sm text-[color:var(--color-muted)]">
              Upload a cover image after the post is created.
            </Card>
          )}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Title
            </label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Post title"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Tags
            </label>
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="comma separated"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              Content
            </label>
            <Textarea
              rows={8}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write your post content..."
            />
          </div>
          
          {mode === 'edit' && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
              <StatusBadge status={status} />
              {updatedAt ? <span>Last updated {formatDate(updatedAt)}</span> : null}
            </div>
          )}

        </Card>
      )}
      
      <div className="flex flex-wrap gap-2">
        {isReviewer && (
          <>
            {mode === 'create' ? (
              <button
                type="button"
                className={buttonStyles({ variant: "outline", size: "sm" })}
                onClick={() => handleSubmit("draft")}
                disabled={!canSubmit || saving}
              >
                Save draft
              </button>
            ) : (
               <button
                type="button"
                className={buttonStyles({ variant: "outline", size: "sm" })}
                onClick={() => handleSubmit("save")}
                disabled={!canSubmit || saving}
              >
                Save Changes
              </button>
            )}
             <button
              type="button"
              className={buttonStyles({ variant: "primary", size: "sm" })}
              onClick={() => handleSubmit("publish")}
              disabled={!canSubmit || saving}
            >
              Publish
            </button>
          </>
        )}

        {isMember && mode === 'create' && (
           <button
              type="button"
              className={buttonStyles({ variant: "primary", size: "sm" })}
              onClick={handleProposalSubmit}
              disabled={!canSubmit || saving}
            >
              Submit Proposal
            </button>
        )}
      </div>
    </div>
  );
}
