import Link from "next/link";
import Brand from "@/components/Brand";
import TradePicker from "@/components/TradePicker";

// Branded landing / splash screen. New users pick their trade (carried into
// onboarding); existing users just tap Enter.
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
      <Brand variant="landing" />
      <p className="muted" style={{ marginTop: -6, marginBottom: 18 }}>
        For every trade that comes back — bookings, rounds, jobs, invoices and
        payments, sorted.
      </p>
      <TradePicker />
      <div className="spacer" />
      <Link href="/dashboard" style={{ width: "100%", maxWidth: 300 }}>
        <button type="button">Enter</button>
      </Link>
    </div>
  );
}
