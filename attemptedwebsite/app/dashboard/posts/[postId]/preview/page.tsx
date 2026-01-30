import Link from "next/link";

import Card from "@/components/ui/Card";
import { buttonStyles } from "@/components/ui/Button";

type PageProps = {
  params: {
    postId: string;
  };
};

export default async function PostPreviewPage({ params }: PageProps) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Post preview</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Preview for post {params.postId}.
        </p>
      </header>
      <Card className="space-y-3 text-sm text-[color:var(--color-muted)]">
        <p>This preview will be available after Phase 7.</p>
        <Link
          href={`/dashboard/posts/${params.postId}/edit`}
          className={buttonStyles({ variant: "outline", size: "sm" })}
        >
          Back to edit
        </Link>
      </Card>
    </div>
  );
}
