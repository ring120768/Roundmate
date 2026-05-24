"use client";

import { useRouter } from "next/navigation";

// A little date input that reloads the Fill-my-round page for the chosen day.
export default function DayPicker({ date }) {
  const router = useRouter();
  return (
    <div>
      <label htmlFor="day">Day</label>
      <input
        id="day"
        type="date"
        defaultValue={date}
        onChange={(e) => {
          if (e.target.value) router.push(`/rounds?date=${e.target.value}`);
        }}
      />
    </div>
  );
}
