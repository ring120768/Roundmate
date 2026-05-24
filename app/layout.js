import "./globals.css";

export const metadata = {
  title: "Pugsie PA",
  description: "Your admin assistant for jobs, invoices and payments.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Pugsie PA",
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
      <body>{children}</body>
    </html>
  );
}
