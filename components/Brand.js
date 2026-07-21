"use client";

import { useState } from "react";
import Link from "next/link";

// Shows the RoundMate logo + name. The logo image lives at /logo.png
// (put your file in the project's `public` folder). If it's missing, we just
// show the wordmark — no broken image.
export default function Brand({ variant = "bar" }) {
  const [imgOk, setImgOk] = useState(true);

  if (variant === "hero" || variant === "landing") {
    const imgClass = variant === "landing" ? "brand-landing-img" : "brand-hero-img";
    return (
      <div className="brand-hero">
        {imgOk && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src="/logo.png"
            alt="RoundMate"
            className={imgClass}
            onError={() => setImgOk(false)}
          />
        )}
        <h1 className="brand-name">RoundMate</h1>
        <p className="muted">Jobs, invoices and payments — sorted.</p>
      </div>
    );
  }

  return (
    <Link href="/dashboard" className="brand-bar">
      {imgOk && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/logo.png"
          alt=""
          className="brand-bar-img"
          onError={() => setImgOk(false)}
        />
      )}
      <span className="brand-bar-name">RoundMate</span>
    </Link>
  );
}
