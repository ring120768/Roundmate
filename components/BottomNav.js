"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The five places you actually go, always a thumb away. Before this, getting
// from Money to Customers meant backing out to the dashboard first.
//
// Hidden on the landing splash, login and onboarding — you're not "in" the
// app yet on those screens.
const HIDDEN_ON = ["/", "/login", "/onboarding"];

const TABS = [
  { href: "/dashboard", label: "Today", icon: IconToday },
  { href: "/jobs", label: "Jobs", icon: IconJobs },
  { href: "/money", label: "Money", icon: IconMoney },
  { href: "/customers", label: "Customers", icon: IconCustomers },
  { href: "/settings", label: "More", icon: IconMore },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "active" : undefined}
            aria-current={active ? "page" : undefined}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// Simple stroke icons — inline SVG so they're sharp on every screen, cost no
// extra request, and take the tab's colour when it's active.
function svgProps() {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };
}

function IconToday() {
  return (
    <svg {...svgProps()}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

function IconJobs() {
  return (
    <svg {...svgProps()}>
      <path d="M4 6.5 5.7 8.2 8.5 5.4" />
      <path d="M4 12.5l1.7 1.7 2.8-2.8" />
      <path d="M4 18.5l1.7 1.7 2.8-2.8" />
      <path d="M12 7h8M12 13h8M12 19h8" />
    </svg>
  );
}

function IconMoney() {
  return (
    <svg {...svgProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 8.2A3 3 0 0 0 9.6 10c0 2.2.4 3.3-.6 4.6h6" />
      <path d="M9 16.4h6.2" />
    </svg>
  );
}

function IconCustomers() {
  return (
    <svg {...svgProps()}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 5.9" />
      <path d="M17.5 14.9c1.8.6 3 2.3 3 4.6" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg {...svgProps()}>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </svg>
  );
}
