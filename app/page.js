import Link from "next/link";
import Brand from "@/components/Brand";

// Branded landing / splash screen. Tap Enter to go into the app.
// (The dashboard handles auth: it sends you to login or onboarding as needed.)
export default function LandingPage() {
  return (
    <div
      className="container"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <Brand variant="hero" />
      <Link href="/dashboard" style={{ width: "100%", maxWidth: 300 }}>
        <button type="button">Enter</button>
      </Link>
    </div>
  );
}
