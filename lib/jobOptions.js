// Shared options + helpers for jobs. Plain module so both server and client
// components can import it.

export const SERVICE_TYPES = [
  "Window cleaning",
  "Gutter cleaning",
  "Conservatory roof",
  "Fascias & soffits",
  "Other",
];

export const JOB_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_access", label: "No access" },
];

export function statusLabel(value) {
  const match = JOB_STATUSES.find((s) => s.value === value);
  return match ? match.label : value || "Scheduled";
}
