import ModerationDetailClient from "@/app/dashboard/admin/moderation/[requestId]/ModerationDetailClient";

type PageProps = { params?: any; searchParams?: any };

export default async function ModerationDetailPage({ params }: PageProps) {
  return <ModerationDetailClient requestId={params.requestId} />;
}
