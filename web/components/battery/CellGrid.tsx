"use client";

import { useMemo } from "react";
import { getCellColor } from "@/lib/battery-utils";

interface CellGridProps {
  cellTemps: number[];
  columns?: number;
  onCellClick?: (index: number, temp: number) => void;
}

export function CellGrid({ cellTemps, columns = 8, onCellClick }: CellGridProps) {
  const cells = useMemo(
    () =>
      cellTemps.map((temp, i) => {
        const { bg, text } = getCellColor(temp);
        return { i, temp, bg, text };
      }),
    [cellTemps]
  );

  return (
    <div>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: "3px",
        }}
        role="grid"
        aria-label="Mappa temperatura celle"
      >
        {cells.map(({ i, temp, bg, text }) => (
          <button
            key={i}
            type="button"
            className="flex items-center justify-center font-medium transition-opacity hover:opacity-75 cursor-pointer"
            style={{
              height: "28px",
              borderRadius: "3px",
              fontSize: "9px",
              background: bg,
              color: text,
            }}
            title={`Cella ${i + 1}: ${temp.toFixed(1)}°C`}
            onClick={() => onCellClick?.(i, temp)}
          >
            {Math.round(temp)}°
          </button>
        ))}
      </div>
      <div
        className="flex items-center"
        style={{
          gap: "12px",
          marginTop: "8px",
          fontSize: "10px",
          color: "var(--color-text-tertiary)",
        }}
      >
        <span>Fredda</span>
        <div
          style={{
            flex: 1,
            height: "4px",
            borderRadius: "2px",
            background: "linear-gradient(to right, var(--blue-100), var(--teal-400), var(--amber-200), var(--red-400))",
          }}
        />
        <span>Calda</span>
      </div>
    </div>
  );
}
