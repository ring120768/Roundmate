import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata = {
  title: "RoundMate",
  description: "Your admin assistant for bookings, jobs, invoices and payments.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "RoundMate",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Escape hatch back to the homeowner site.
            The iOS app wraps find.roundmate.co.uk and its footer links here, and
            capacitor.config.ts lets that navigation happen inside the webview.
            iOS has no back button, so without this a homeowner who taps that
            footer link is stranded in the trade app. Keep it on every page. */}
        <a
          href="https://find.roundmate.co.uk"
          style={{
            display: "block",
            padding: "10px 16px",
            fontSize: 14,
            color: "#2563eb",
            textDecoration: "none",
            borderBottom: "1px solid #e5e7eb",
            background: "#f9fafb",
          }}
        >
          <span aria-hidden="true">←</span> Find a tradesperson
        </a>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
