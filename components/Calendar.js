"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { statusLabel } from "@/lib/jobOptions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const ukTodayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

export default function Calendar() {
  const supabase = createClient();
  const today = ukTodayISO();

  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1); // 0-indexed
  const [selected, setSelected] = useState(today);
  const [byDate, setByDate] = useState({});
  const [loading, setLoading] = useState(true);

  // Load the visible month's jobs whenever the month changes.
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const first = iso(year, month, 1);
      const lastDayNum = new Date(year, month + 1, 0).getDate();
      const last = iso(year, month, lastDayNum);

      const { data } = await supabase
        .from("jobs")
        .select("id, appointment_date, price, status, customers(first_name, last_name, postcode)")
        .gte("appointment_date", first)
        .lte("appointment_date", last)
        .order("created_at", { ascending: true });

      if (!active) return;
      const grouped = {};
      (data ?? []).forEach((j) => {
        (grouped[j.appointment_date] = grouped[j.appointment_date] || []).push(j);
      });
      setByDate(grouped);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  function prevMonth() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else setMonth(month + 1);
  }

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedJobs = byDate[selected] || [];

  return (
    <div>
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={prevMonth} aria-label="Previous month">
          ‹
        </button>
        <strong>
          {MONTHS[month]} {year}
        </strong>
        <button type="button" className="cal-nav" onClick={nextMonth} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="cal-grid cal-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-wd">
            {w}
          </div>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={`blank-${i}`} />;
          const date = iso(year, month, d);
          const count = (byDate[date] || []).length;
          const classes = [
            "cal-day",
            date === selected ? "cal-sel" : "",
            date === today ? "cal-today" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={date}
              type="button"
              className={classes}
              onClick={() => setSelected(date)}
            >
              <span>{d}</span>
              {count > 0 && <span className="cal-dot">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="spacer" />
      <h2>
        {new Date(selected + "T00:00:00").toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </h2>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : selectedJobs.length === 0 ? (
        <p className="muted">No jobs this day.</p>
      ) : (
        selectedJobs.map((j) => (
          <Link
            key={j.id}
            href={`/jobs/${j.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="card" style={{ marginBottom: 10 }}>
              <div className="row">
                <div>
                  <strong>
                    {j.customers
                      ? `${j.customers.first_name} ${j.customers.last_name}`
                      : "Job"}
                  </strong>
                  <div className="muted">{j.customers?.postcode || ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>{j.price != null ? `£${j.price}` : ""}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {statusLabel(j.status)}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))
      )}

      <Link href={`/jobs/new?date=${selected}`}>
        <button type="button">+ Add job on this day</button>
      </Link>
      {selectedJobs.length >= 2 && (
        <Link href={`/rounds?date=${selected}`}>
          <button type="button" className="btn-green">
            🗺️ Order my route for this day
          </button>
        </Link>
      )}
    </div>
  );
}
