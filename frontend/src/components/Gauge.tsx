type Props = {
  value: number; // 0-100
  label: string;
  color?: "green" | "amber" | "orange";
  suffix?: string;
};

const COLORS = {
  green: { stroke: "#3dd68c", track: "rgba(61,214,140,0.12)" },
  amber: { stroke: "#f0c14b", track: "rgba(240,193,75,0.12)" },
  orange: { stroke: "#f0713d", track: "rgba(240,113,61,0.12)" },
};

export function Gauge({ value, label, color = "green", suffix = "%" }: Props) {
  const v = Math.max(0, Math.min(100, value));
  const r = 54;
  const cx = 70;
  const cy = 70;
  // Semicircle from 180° to 0° (left to right over the top)
  const start = Math.PI;
  const end = 0;
  const angle = start + (end - start) * (v / 100);

  const polar = (a: number) => ({
    x: cx + r * Math.cos(a),
    y: cy - r * Math.sin(a),
  });

  const s = polar(start);
  const e = polar(angle);
  const trackEnd = polar(end);
  const large = 0;
  const c = COLORS[color];

  const trackPath = `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${trackEnd.x} ${trackEnd.y}`;
  const valuePath = `M ${s.x} ${s.y} A ${r} ${r} 0 ${v > 50 ? 1 : 0} 1 ${e.x} ${e.y}`;

  return (
    <div className="gauge-wrap">
      <svg width="140" height="88" viewBox="0 0 140 88">
        <path
          d={trackPath}
          fill="none"
          stroke={c.track}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {v > 0.5 && (
          <path
            d={valuePath}
            fill="none"
            stroke={c.stroke}
            strokeWidth="10"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${c.stroke})` }}
          />
        )}
      </svg>
      <div className="gauge-value">
        {v.toFixed(1)}
        <span>{suffix}</span>
      </div>
      <div className="gauge-caption">{label}</div>
    </div>
  );
}
