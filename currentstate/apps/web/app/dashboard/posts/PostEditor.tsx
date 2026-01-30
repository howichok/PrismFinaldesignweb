"use client";

import { csrfFetch, getErrorMessage } from "@/lib/security/csrf-client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import ImageUploader from "@/components/uploads/ImageUploader";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { buttonStyles } from "@/components/ui/Button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { isModOrAdmin } from "@/lib/auth/guards";
import { formatDate } from "@/lib/dashboard/format";

type ContentStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

type PostEditorProps = {
  mode: "create" | "edit";
  postId?: string;
  siteRole: "USER" | "MOD" | "ADMIN";
};

type PostPayload = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  status: ContentStatus;
  coverAsset?: { id: string; publicUrl: string } | null;
  rejectionReason: string | null;
  updatedAt: string;
};

type Notice = { type: "success" | "error"; message: string } | null;

export default function PostEditor({ mode, postId, siteRole }: PostEditorProps) {
  const router = useRouter();
  const privileged = isModOrAdmin(siteRole);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<ContentStatus>("DRAFT");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const response = await csrfFetch(`/api/dashboard/posts/${postId}`);
      if (!response.ok) {
        throw new Error("Post not found.");
      }
      const data = (await response.json()) as { item: PostPayload };
      setTitle(data.item.title);
      setContent(data.item.content);
      setTags(data.item.tags.join(", "));
      setStatus(data.item.status);
      setRejectionReason(data.item.rejectionReason);
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
  }, [postId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleSubmit = async (intent: "draft" | "submit" | "publish" | "save") => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await csrfFetch(
        mode === "create"
          ? "/api/dashboard/posts"
          : `/api/dashboard/posts/${postId}`,
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
        error?: unknown;
      };

      if (!response.ok || !data.item) {
        throw new Error(getErrorMessage(data, "Unable to save post."));
      }

      setStatus(data.item.status);
      setRejectionReason(data.item.rejectionReason ?? null);
      setUpdatedAt(data.item.updatedAt);
      setNotice({ type: "success", message: "Post saved." });

      if (mode === "create") {
        router.push(`/dashboard/posts/${data.item.id}/edit`);
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
  const showSubmit =
    !privileged && (mode === "create" || status === "DRAFT" || status === "REJECTED");
  const showPublish = privileged;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">
          {mode === "create" ? "Create post" : "Edit post"}
        </h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Drafts stay private until approved.
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
        <Card className="space-y-3">
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-[color:var(--color-line)]" />
          <div className="h-10 w-full animate-pulse rounded-2xl bg-[color:var(--color-line)]" />
          <div className="h-36 w-full animate-pulse rounded-2xl bg-[color:var(--color-line)]" />
        </Card>
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

          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
            <StatusBadge status={status} />
            {updatedAt ? <span>Last updated {formatDate(updatedAt)}</span> : null}
          </div>

          {status === "REJECTED" && rejectionReason ? (
            <p className="text-sm text-red-600">{rejectionReason}</p>
          ) : null}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {mode === "create" ? (
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
            Save
          </button>
        )}

        {showSubmit ? (
          <button
            type="button"
            className={buttonStyles({ variant: "primary", size: "sm" })}
            onClick={() => handleSubmit("submit")}
            disabled={!canSubmit || saving}
          >
            {status === "REJECTED" ? "Resubmit" : "Submit for moderation"}
          </button>
        ) : null}

        {showPublish ? (
          <button
            type="button"
            className={buttonStyles({ variant: "soft", size: "sm" })}
            onClick={() => handleSubmit("publish")}
            disabled={!canSubmit || saving}
          >
            Publish now
          </button>
        ) : null}
      </div>
    </div>
  );
}
