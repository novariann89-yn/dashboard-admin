"use client";

import { inputClass } from "@/components/ui";
import { wibDateString } from "@/lib/format";
import type { PeriodPreset, PeriodValue } from "@/lib/finance";

export type { PeriodValue };

const OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hari Ini" },
  { value: "yesterday", label: "Kemarin" },
  { value: "week", label: "7 Hari" },
  { value: "month", label: "Bulan Ini" },
  { value: "day", label: "Tanggal" },
  { value: "range", label: "Kustom" },
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
      <div className="grid grid-cols-3 gap-1">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              onChange({
                preset: option.value,
                day: value.day ?? wibDateString(),
                from: value.from ?? wibDateString(),
                to: value.to ?? wibDateString(),
              })
            }
            className={`rounded-control border-2 py-1.5 text-[11px] font-bold ${
              value.preset === option.value
                ? "border-ink bg-primary text-white"
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
            onChange({ ...value, preset: "day", day: event.target.value })
          }
          className={inputClass}
        />
      )}

      {value.preset === "range" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
              Dari
            </span>
            <input
              type="date"
              value={value.from ?? ""}
              onChange={(event) =>
                onChange({ ...value, preset: "range", from: event.target.value })
              }
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
              Sampai
            </span>
            <input
              type="date"
              value={value.to ?? ""}
              onChange={(event) =>
                onChange({ ...value, preset: "range", to: event.target.value })
              }
              className={inputClass}
            />
          </label>
        </div>
      )}
    </div>
  );
}
