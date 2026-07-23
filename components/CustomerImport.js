"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { geocodePostcodes, normalisePostcode } from "@/lib/geocode";

// The columns we understand. The CSV's headers are matched to these
// (case-insensitive, spaces -> underscores), so "First Name" maps to first_name.
const COLUMNS = [
  "first_name",
  "last_name",
  "address_line_1",
  "town_city",
  "postcode",
  "phone",
  "email",
  "default_price",
  "visit_frequency",
  "access_notes",
];

const normaliseHeader = (h) => (h || "").trim().toLowerCase().replace(/\s+/g, "_");

// An empty customer row — every import source fills in what it can.
const blankRow = () => ({
  first_name: null,
  last_name: null,
  address_line_1: null,
  town_city: null,
  postcode: null,
  phone: null,
  email: null,
  default_price: null,
  visit_frequency: null,
  access_notes: null,
});

// --- vCard (.vcf) parsing -------------------------------------------------
// Both iPhones and Androids can share/export contacts as a .vcf file, so this
// is the universal "get my contacts in" path. We hand-roll a small parser for
// the fields we care about rather than pulling in a library.
function parseVcf(text) {
  // Unfold continuation lines (a line starting with a space/tab continues the
  // previous line, per the vCard spec).
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const unescape = (v) => v.replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, ", ");

  const cards = unfolded.split(/BEGIN:VCARD/i).slice(1);
  return cards
    .map((card) => {
      // Grab a property's value, ignoring any ;TYPE=... parameters and the
      // "item1." prefixes iPhones put on grouped properties.
      const get = (prop) => {
        const m = card.match(
          new RegExp("^(?:[A-Za-z0-9-]+\\.)?" + prop + "(?:;[^:\\r\\n]*)?:(.+)$", "im")
        );
        return m ? m[1].trim() : "";
      };

      const row = blankRow();

      // N is "Last;First;Middle;Prefix;Suffix"; FN is the display name.
      const n = get("N");
      const fn = get("FN");
      if (n) {
        const parts = n.split(";");
        row.last_name = unescape((parts[0] || "").trim()) || null;
        row.first_name = unescape((parts[1] || "").trim()) || null;
      }
      if (!row.first_name && !row.last_name && fn) {
        const bits = unescape(fn).trim().split(/\s+/);
        row.first_name = bits[0] || null;
        row.last_name = bits.slice(1).join(" ") || null;
      }

      // ADR is "PO box;extended;street;town;region;postcode;country".
      const adr = get("ADR");
      if (adr) {
        const a = adr.split(";");
        row.address_line_1 = unescape((a[2] || "").trim()) || null;
        row.town_city = unescape((a[3] || "").trim()) || null;
        row.postcode = unescape((a[5] || "").trim()) || null;
      }

      row.phone = get("TEL") || null;
      row.email = get("EMAIL") || null;
      return row;
    })
    .filter((r) => r.first_name || r.last_name || r.phone);
}

export default function CustomerImport() {
  const router = useRouter();
  const supabase = createClient();

  const [rows, setRows] = useState([]);
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(0);
  const [finished, setFinished] = useState(false);
  // Contact Picker is Android Chrome only, so feature-detect after mount.
  const [contactsSupported, setContactsSupported] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "contacts" in navigator) {
      setContactsSupported(true);
    }
  }, []);

  function resetFeedback() {
    setError("");
    setStatus("");
    setRows([]);
    setDone(0);
    setFinished(false);
  }

  // --- Source 1: pick straight from the phone's contacts (Android) --------
  async function pickContacts() {
    resetFeedback();
    try {
      const picked = await navigator.contacts.select(
        ["name", "tel", "email", "address"],
        { multiple: true }
      );
      const mapped = picked
        .map((c) => {
          const row = blankRow();
          const nameStr = (c.name && c.name[0]) || "";
          const bits = nameStr.trim().split(/\s+/).filter(Boolean);
          row.first_name = bits[0] || null;
          row.last_name = bits.slice(1).join(" ") || null;
          const addr = c.address && c.address[0];
          if (addr) {
            row.address_line_1 = (addr.addressLine || []).join(", ") || null;
            row.town_city = addr.city || null;
            row.postcode = addr.postalCode || null;
          }
          row.phone = (c.tel && c.tel[0]) || null;
          row.email = (c.email && c.email[0]) || null;
          return row;
        })
        .filter((r) => r.first_name || r.last_name || r.phone);

      if (mapped.length === 0) return; // user cancelled or picked nothing
      setRows(mapped);
      setSource("your phone contacts");
    } catch (e) {
      // Some browsers throw if the picker is unsupported or blocked.
      setError("Couldn't open your contacts on this device — try a CSV or .vcf file instead.");
    }
  }

  // --- Sources 2 + 3: a file, either CSV or vCard --------------------------
  function handleFile(e) {
    resetFeedback();

    const file = e.target.files?.[0];
    if (!file) return;
    setSource(file.name);

    const isVcf =
      /\.vcf$/i.test(file.name) || (file.type || "").includes("vcard");

    if (isVcf) {
      file
        .text()
        .then((text) => {
          const parsed = parseVcf(text);
          if (parsed.length === 0) {
            setError("No contacts found in that file.");
            return;
          }
          setRows(parsed);
        })
        .catch(() => setError("Couldn't read that file."));
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normaliseHeader,
      complete: (results) => {
        const parsed = results.data
          .map((r) => {
            const row = {};
            COLUMNS.forEach((col) => {
              let v = r[col];
              if (typeof v === "string") v = v.trim();
              row[col] = v === "" || v === undefined ? null : v;
            });
            // Clean the price into a real number.
            if (row.default_price != null) {
              const n = Number(String(row.default_price).replace(/[^0-9.]/g, ""));
              row.default_price = isNaN(n) ? null : n;
            }
            return row;
          })
          // Drop completely blank lines.
          .filter((row) => row.first_name || row.last_name || row.postcode);

        if (parsed.length === 0) {
          setError(
            "No usable rows found. Check your column headings match the template."
          );
          return;
        }
        setRows(parsed);
      },
      error: (err) => setError(err.message),
    });
  }

  async function handleImport() {
    setImporting(true);
    setError("");
    setStatus("");

    // Geocode all postcodes in bulk (free, best-effort) for route ordering.
    const coordsByPostcode = await geocodePostcodes(
      rows.map((r) => r.postcode)
    );
    const rowsWithCoords = rows.map((r) => {
      const c = coordsByPostcode.get(normalisePostcode(r.postcode));
      return c ? { ...r, latitude: c.latitude, longitude: c.longitude } : r;
    });

    const chunkSize = 200;
    let inserted = 0;
    for (let i = 0; i < rowsWithCoords.length; i += chunkSize) {
      const chunk = rowsWithCoords.slice(i, i + chunkSize);
      // business_id is auto-filled by the database default.
      const { error } = await supabase.from("customers").insert(chunk);
      if (error) {
        setImporting(false);
        setError(`Stopped after ${inserted}. ${error.message}`);
        return;
      }
      inserted += chunk.length;
      setDone(inserted);
    }

    setImporting(false);
    setStatus(`Imported ${inserted} customer${inserted === 1 ? "" : "s"}.`);
    setFinished(true);
  }

  function downloadTemplate() {
    const example = [
      "Jane",
      "Smith",
      "12 High Street",
      "Chelmsford",
      "CM1 1AA",
      "07700900123",
      "jane@example.com",
      "15",
      "Every 4 weeks",
      "Side gate, beware of dog",
    ].map((c) => (/[",]/.test(c) ? `"${c}"` : c));

    const csv = COLUMNS.join(",") + "\n" + example.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roundmate-customers-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card">
      {contactsSupported && (
        <>
          <p className="muted">Add customers straight from your phone:</p>
          <button type="button" onClick={pickContacts}>
            Pick from phone contacts
          </button>
          <div className="spacer" />
        </>
      )}

      <p className="muted">
        Or upload a file — a CSV spreadsheet, or contacts shared from your
        phone as a .vcf file. On iPhone: Contacts → select → Share Contact →
        Save to Files, then upload it here.
      </p>

      <label htmlFor="csv">Choose CSV or contacts (.vcf) file</label>
      <input
        id="csv"
        type="file"
        accept=".csv,.vcf,text/csv,text/vcard"
        onChange={handleFile}
      />

      <button type="button" className="secondary" onClick={downloadTemplate}>
        Download template CSV
      </button>

      {rows.length > 0 && !finished && (
        <>
          <div className="spacer" />
          <p>
            <strong>{rows.length}</strong> customer
            {rows.length === 1 ? "" : "s"} ready from {source}:
          </p>
          {rows.slice(0, 5).map((r, i) => (
            <div key={i} className="muted">
              • {r.first_name} {r.last_name} {r.postcode ? `(${r.postcode})` : ""}
            </div>
          ))}
          {rows.length > 5 && (
            <div className="muted">…and {rows.length - 5} more</div>
          )}

          <button type="button" onClick={handleImport} disabled={importing}>
            {importing
              ? `Importing… ${done}/${rows.length}`
              : `Import ${rows.length} customer${rows.length === 1 ? "" : "s"}`}
          </button>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {status && (
        <p className="note" style={{ color: "var(--ok)" }}>
          {status}
        </p>
      )}

      {finished ? (
        <button
          type="button"
          onClick={() => {
            router.push("/customers");
            router.refresh();
          }}
        >
          View customers
        </button>
      ) : (
        <Link href="/customers" className="linklike">
          ← Back to customers
        </Link>
      )}
    </div>
  );
}
