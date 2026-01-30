import ProjectCollaboratorsClient from "@/app/company/[companyId]/hub/projects/[projectId]/collaborators/ProjectCollaboratorsClient";

type PageProps = {
  params: {
    projectId: string;
  };
};

export default async function ProjectCollaboratorsPage({ params }: PageProps) {
  return <ProjectCollaboratorsClient projectId={params.projectId} />;
}
