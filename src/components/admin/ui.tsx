
export { PageHeader, Panel, SiteLink, StatTile, StatusBadge } from "./ui-antd";

export const tableCls = {
  wrap: "overflow-x-auto rounded-lg border border-line bg-white",
  table: "w-full text-left text-sm",
  thead: "bg-sand-soft text-xs font-semibold text-ink-muted",
  th: "px-4 py-3 font-semibold",
  td: "border-t border-line px-4 py-3 align-top",
};

/**
 * Single-series bar chart (one hue: cobalt). Rounded data-ends, 2px gaps, recessive grid,
 * a hover tooltip per bar (SVG <title>, keyboard-focusable), and the same data as a table.
 */
export function BarChart({
  data,
  label,
  tooltip,
  tableHeaders,
}: {
  data: { x: string; y: number; short: string }[];
  label: string;
  tooltip: (d: { x: string; y: number }) => string;
  tableHeaders: [string, string];
}) {
  const W = 720;
  const H = 200;
  const pad = { l: 28, r: 8, t: 10, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.y));
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const step = (W - pad.l - pad.r) / data.length;
  const bw = Math.max(2, step - 2);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);
  const ticks = [0, niceMax / 2, niceMax];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={pad.l} x2={W - pad.r} y1={y(tk)} y2={y(tk)} stroke="#e3d6bd" strokeWidth={1} />
            <text x={pad.l - 6} y={y(tk) + 4} textAnchor="end" fontSize="11" fill="#5e554c">{tk}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * step + 1;
          const h = Math.max(0, y(0) - y(d.y));
          const r = Math.min(4, bw / 2, h);
          return (
            <g key={d.x} tabIndex={0} className="outline-none focus-visible:[&>rect.hit]:fill-lapis/10">
              <title>{tooltip(d)}</title>
              <rect className="hit" x={x - 1} y={pad.t} width={step} height={H - pad.t - pad.b} fill="transparent" />
              {d.y > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(d.y) + r} Q${x},${y(d.y)} ${x + r},${y(d.y)} H${x + bw - r} Q${x + bw},${y(d.y)} ${x + bw},${y(d.y) + r} V${y(0)} Z`}
                  fill="#1e5aa8"
                />
              )}
              {(i % 5 === 0 || i === data.length - 1) && (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#5e554c">{d.short}</text>
              )}
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#8a7b69" strokeWidth={1} />
      </svg>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-cobalt underline">{tableHeaders[0]} / {tableHeaders[1]}</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead><tr><th className="py-1">{tableHeaders[0]}</th><th className="py-1 text-right">{tableHeaders[1]}</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.x} className="border-t border-line"><td className="py-1">{d.x}</td><td className="py-1 text-right">{d.y}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Horizontal magnitude bars with the value printed (one hue; identity comes from the text label). */
export function HBars({ rows, color = "#1e5aa8" }: { rows: { label: string; value: number; display?: string }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-sm">
            <span className="font-semibold">{r.label}</span>
            <span className="tabular-nums text-ink-muted">{r.display ?? r.value}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-sand-soft">
            <div className="h-2.5 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color, minWidth: r.value > 0 ? 4 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
