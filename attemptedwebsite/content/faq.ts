export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const faqItems: FaqItem[] = [
  {
    id: "launcher-install",
    question: "How do I install the PrismMTR launcher?",
    answer:
      "Download the launcher from the Download page and follow the guided setup. The launcher will install required mods automatically.",
  },
  {
    id: "server-updates",
    question: "Where can I find server updates and changelogs?",
    answer:
      "Major updates will appear on the Home page and inside project updates once the Phase 5 content pages launch.",
  },
  {
    id: "project-submission",
    question: "How do I submit a project or mod pack?",
    answer:
      "Project submission will open in Phase 4. For now, use the Discovery page to explore what is already approved.",
  },
  {
    id: "company-roles",
    question: "Can my company manage multiple projects?",
    answer:
      "Yes. Company hubs will support multiple projects and collaborators once the management tools are enabled.",
  },
  {
    id: "tickets",
    question: "When will tickets and moderation go live?",
    answer:
      "Ticketing and moderation workflows arrive in upcoming phases. The Help section will evolve into the full support center.",
  },
];
