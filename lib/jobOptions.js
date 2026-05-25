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

// How a completed job was paid for.
export const PAYMENT_OUTCOMES = [
  { value: "cash", label: "Paid – cash" },
  { value: "bank", label: "Paid – bank transfer" },
  { value: "unpaid", label: "Unpaid (chase later)" },
  { value: "free", label: "Free / no charge" },
];

export function paymentLabel(value) {
  if (value === "paid") return "Paid";
  const match = PAYMENT_OUTCOMES.find((p) => p.value === value);
  return match ? match.label : value || "";
}

// Payment statuses that count as money received.
export const PAID_STATUSES = ["cash", "bank", "paid"];

// Map a customer's visit frequency to a number of days, for suggesting the
// next visit date.
export const FREQUENCY_DAYS = {
  Weekly: 7,
  Fortnightly: 14,
  "Every 4 weeks": 28,
  "Every 8 weeks": 56,
  "Every 12 weeks": 84,
  "One-off": 0,
};

export function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Suggest the next visit date from a job's date + the customer's frequency.
// Returns "" when there's no sensible suggestion (one-off / unknown).
export function suggestNextDate(fromDate, frequency) {
  const days = FREQUENCY_DAYS[frequency];
  if (!days || !fromDate) return "";
  return addDays(fromDate, days);
}
