"use client";

import { inputClass } from "@/components/ui";
import { wibDateString } from "@/lib/format";
import type { PeriodPreset } from "@/lib/finance";

export interface PeriodValue {
  preset: PeriodPreset;
  day?: string;
}

const OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hari Ini" },
  { value: "yesterday", label: "Kemarin" },
  { value: "week", label: "7 Hari" },
  { value: "month", label: "Bulan Ini" },
  { value: "day", label: "Tanggal" },
];

export function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-5 gap-1">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              onChange({
                preset: option.value,
                day: value.day ?? wibDateString(),
              })
            }
            className={`rounded-control border-2 py-1.5 text-[11px] font-bold ${
              value.preset === option.value
                ? "border-ink bg-soy"
                : "border-line bg-surface text-ink-soft"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {value.preset === "day" && (
        <input
          type="date"
          value={value.day ?? ""}
          onChange={(event) =>
            onChange({ preset: "day", day: event.target.value })
          }
          className={inputClass}
        />
      )}
    </div>
  );
}