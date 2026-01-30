import ProjectCollaboratorsClient from "@/app/company/[companyId]/hub/projects/[projectId]/collaborators/ProjectCollaboratorsClient";

type PageProps = { params?: any; searchParams?: any };

export default async function ProjectCollaboratorsPage({ params }: PageProps) {
  return <ProjectCollaboratorsClient projectId={params.projectId} />;
}
