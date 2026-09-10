import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container">
      <h1>Not found</h1>
      <p className="muted">
        That page, job or customer doesn&apos;t exist any more.
      </p>
      <div className="spacer" />
      <Link href="/dashboard" className="btn">
        Back to today
      </Link>
    </div>
  );
}
