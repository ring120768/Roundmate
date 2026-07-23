// The trades RoundMate supports, each with its own service menu.
// One app, many trades: the business picks a trade at onboarding and the
// app adjusts its service lists and copy. Service menus come from the
// cross-pollination research (RESEARCH-cross-pollination.md) — each trade's
// bread-and-butter first, then its documented add-ons.
// Plain module so both server and client components can import it.

export const TRADES = [
  {
    key: "window_cleaning",
    image: "/trade-window-cleaning.jpg",
    label: "Window cleaning",
    services: [
      "Window cleaning",
      "Gutter clearing",
      "Gutter, fascia & soffit wash",
      "Conservatory roof",
      "Solar panel cleaning",
      "Pressure washing",
      "Christmas lights",
      "Other",
    ],
  },
  {
    key: "gardening",
    image: "/trade-gardening.jpg",
    label: "Gardening & lawns",
    services: [
      "Grass cutting",
      "Hedge trimming",
      "Leaf clearance",
      "Garden clearance",
      "Gutter clearing",
      "Pressure washing",
      "Fence painting",
      "Turfing",
      "Other",
    ],
  },
  {
    key: "domestic_cleaning",
    image: "/trade-home-cleaning.jpg",
    label: "Home cleaning",
    services: [
      "Regular clean",
      "Deep clean",
      "End-of-tenancy clean",
      "Oven clean",
      "Carpet cleaning",
      "Holiday-let changeover",
      "Ironing",
      "Other",
    ],
  },
  {
    key: "oven_cleaning",
    image: "/trade-oven-cleaning.jpg",
    label: "Oven cleaning",
    services: [
      "Single oven",
      "Double oven",
      "Range cooker",
      "Aga / Rayburn",
      "Hob",
      "Extractor",
      "Microwave",
      "BBQ clean",
      "Other",
    ],
  },
  {
    key: "valeting",
    image: "/trade-valeting.jpg",
    label: "Car valeting",
    services: [
      "Exterior wash",
      "Mini valet",
      "Full valet",
      "Interior valet",
      "Machine polish",
      "Engine bay",
      "Caravan / motorhome",
      "Other",
    ],
  },
  {
    key: "ironing_laundry",
    image: "/trade-ironing.jpg",
    label: "Ironing & laundry",
    services: ["Ironing", "Wash & iron", "Collection & delivery", "Other"],
  },
  {
    key: "pest_control",
    image: "/trade-pest-control.jpg",
    label: "Pest control",
    services: [
      "General pest visit",
      "Regular contract visit",
      "Rodent treatment",
      "Wasp / hornet nest",
      "Insect treatment",
      "Bed bug treatment",
      "Bird proofing",
      "Other",
    ],
  },
  {
    key: "locksmith",
    image: "/trade-locksmith.jpg",
    label: "Locksmith",
    services: [
      "Lock change",
      "Lock repair",
      "Lockout / gain entry",
      "uPVC door mechanism",
      "Key cutting",
      "Security survey",
      "Landlord changeover",
      "Other",
    ],
  },
  {
    key: "handyman",
    image: "/trade-handyman.jpg",
    label: "Handyman",
    services: [
      "General repairs",
      "Painting & decorating",
      "Flat-pack assembly",
      "Fence & gate repair",
      "Gutter clearing",
      "Pressure washing",
      "Christmas lights",
      "Other",
    ],
  },
];

export const DEFAULT_TRADE = "window_cleaning";

export function tradeLabel(key) {
  const t = TRADES.find((t) => t.key === key);
  return t ? t.label : "";
}

// The service menu for a trade, falling back to window cleaning so existing
// businesses (created before trades existed) keep working unchanged.
export function servicesForTrade(key) {
  const t = TRADES.find((t) => t.key === key) || TRADES[0];
  return t.services;
}

// The trade's pug image, for trade-aware branding (app bar etc.).
export function tradeImage(key) {
  const t = TRADES.find((t) => t.key === key);
  return t ? t.image : "/logo.png";
}
