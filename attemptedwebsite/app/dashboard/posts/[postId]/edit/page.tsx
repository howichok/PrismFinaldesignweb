import { redirect } from "next/navigation";

import PostEditor from "@/app/dashboard/posts/PostEditor";
import { getSession } from "@/lib/auth/session";

type PageProps = {
  params: {
    postId: string;
  };
};

export default async function EditPostPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/unauthorized");
  }

  return (
    <PostEditor
      mode="edit"
      postId={params.postId}
      siteRole={session.siteRole}
    />
  );
}
