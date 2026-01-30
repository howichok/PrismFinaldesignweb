export type DiscoveryTab = "all" | "posts" | "projects" | "companies";

export type BaseDiscoveryItem = {
  id: string;
  updatedAt: string;
};

export type PostItem = BaseDiscoveryItem & {
  type: "post";
  title: string;
  excerpt: string;
  ownerDisplay: string;
  publishedAt: string | null;
};

export type ProjectItem = BaseDiscoveryItem & {
  type: "project";
  name: string;
  excerpt: string;
  ownerDisplay: string;
  projectStatus: "IN_PROGRESS" | "RELEASED" | "FROZEN";
  publishedAt: string | null;
};

export type CompanyItem = BaseDiscoveryItem & {
  type: "company";
  name: string;
  excerpt: string;
  logoUrl: string | null;
  categories: string[];
};

export type DiscoveryItem = PostItem | ProjectItem | CompanyItem;

export type DiscoveryResponse<T extends DiscoveryItem> = {
  items: T[];
  nextCursor: string | null;
  fetchedAt: string;
};
