import { redirect } from "next/navigation";

import PostEditor from "@/app/dashboard/posts/PostEditor";
import { getSession } from "@/lib/auth/session";

export default async function NewPostPage() {
  const session = await getSession();
  if (!session) {
    redirect("/unauthorized");
  }

  return <PostEditor mode="create" siteRole={session.siteRole} />;
}
