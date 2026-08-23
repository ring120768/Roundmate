// One place that decides what money looks like. Before this, `£${price}`
// rendered 62.5 as "£62.5" — fine in a database, wrong on an invoice.

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

// gbp(62.5) -> "£62.50". Null/blank/garbage gives "" so callers can drop it
// straight into JSX without guarding first.
export function gbp(value) {
  if (value == null || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? GBP.format(n) : "";
}

// Whole days since an ISO timestamp — used for "unpaid for 14 days".
export function daysSince(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86400000);
}

// How an unpaid job should be flagged. Matches the reminder cron's 3/7/14
// day schedule so the screen and the emails tell the same story.
export function overdueTone(days) {
  if (days == null) return null;
  if (days >= 14) return { className: "badge badge-danger", label: `${days} days` };
  if (days >= 7) return { className: "badge badge-warn", label: `${days} days` };
  if (days >= 3) return { className: "badge", label: `${days} days` };
  return null;
}
