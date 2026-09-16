"use client";

import { rupiah } from "@/lib/format";

export interface ChartSeriesPoint {
  label: string;
  omzet: number;
  laba: number;
}

export function FinanceChart({
  data,
  height = 150,
}: {
  data: ChartSeriesPoint[];
  height?: number;
}) {
  const width = 320;
  const padTop = 12;
  const padBottom = 18;
  const padX = 8;
  const innerWidth = width - padX * 2;
  const innerHeight = height - padTop - padBottom;
  const max = Math.max(
    1,
    ...data.map((point) => Math.max(point.omzet, point.laba)),
  );

  const x = (index: number) =>
    data.length <= 1
      ? padX + innerWidth / 2
      : padX + (index / (data.length - 1)) * innerWidth;
  const y = (value: number) =>
    padTop + innerHeight - (value / max) * innerHeight;
  const polyline = (key: "omzet" | "laba") =>
    data.map((point, index) => `${x(index)},${y(point[key])}`).join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Grafik omzet dan laba kotor"
      >
        <line
          x1={padX}
          y1={padTop + innerHeight}
          x2={width - padX}
          y2={padTop + innerHeight}
          stroke="var(--color-line)"
          strokeWidth="1"
        />
        {data.length > 1 && (
          <>
            <polyline
              points={polyline("omzet")}
              fill="none"
              stroke="var(--color-soy-dark)"
              strokeWidth="2"
            />
            <polyline
              points={polyline("laba")}
              fill="none"
              stroke="var(--color-pandan)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </>
        )}
        {data.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle
              cx={x(index)}
              cy={y(point.omzet)}
              r="2.5"
              fill="var(--color-soy-dark)"
            />
            <circle
              cx={x(index)}
              cy={y(point.laba)}
              r="2.5"
              fill="var(--color-pandan)"
            />
          </g>
        ))}
      </svg>

      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-ink-soft">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-[10px] font-bold">
        <span className="text-soy-dark">— Omzet · skala maks {rupiah(max)}</span>
        <span className="text-pandan">-- Laba kotor</span>
      </div>
    </div>
  );
}