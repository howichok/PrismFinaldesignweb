export function formatDate(value: string | Date | null) {
  if (!value) return "Unpublished";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatProjectStatus(status: string) {
  switch (status) {
    case "RELEASED":
      return "Released";
    case "FROZEN":
      return "Frozen";
    default:
      return "In progress";
  }
}
