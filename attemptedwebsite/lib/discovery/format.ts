export function formatDate(value: string | null) {
  if (!value) return "Unpublished";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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
