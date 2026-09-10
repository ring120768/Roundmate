"use client";

import Link from "next/link";

// Without this, an unhandled error is a blank white screen — the worst
// possible outcome halfway through a round. Next passes us a reset() that
// re-renders the failed segment, which fixes most transient network blips.
export default function Error({ error, reset }) {
  return (
    <div className="container">
      <h1>That didn&apos;t load</h1>
      <p className="muted">
        Something went wrong our end. Your work is safe — nothing was lost.
      </p>
      <div className="spacer" />
      <div className="card">
        <p style={{ marginTop: 0 }} className="muted">
          {error?.message || "Unknown error"}
        </p>
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/dashboard" className="btn secondary">
          Back to today
        </Link>
      </div>
    </div>
  );
}
