import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Forecast, SeriesPoint } from "../api";
import { fmtShort } from "../api";

type Props = {
  series: SeriesPoint[];
  forecast: Forecast;
  targetYear: number;
  targetValue?: number | null;
  compact?: boolean;
};

const axis = { fill: "#6b7280", fontSize: 11 };
const grid = "rgba(255,255,255,0.04)";
const tip = {
  background: "#16181f",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  fontSize: 12,
};

export function ForecastChart({ series, forecast, targetYear, targetValue, compact }: Props) {
  if (forecast.error || !forecast.forecast_years) {
    return <p className="empty">{forecast.error || "Not enough data to forecast."}</p>;
  }

  const byYear = new Map<number, Record<string, number | null>>();
  for (const s of series) {
    byYear.set(s.year, {
      year: s.year,
      historical: s.emissions,
      median: null,
      lower: null,
      upper: null,
      commitment: null,
    });
  }
  forecast.forecast_years.forEach((y, i) => {
    const row =
      byYear.get(y) ||
      ({
        year: y,
        historical: null,
        median: null,
        lower: null,
        upper: null,
        commitment: null,
      } as Record<string, number | null>);
    row.median = forecast.median?.[i] ?? null;
    row.lower = forecast.lower?.[i] ?? null;
    row.upper = forecast.upper?.[i] ?? null;
    byYear.set(y, row);
  });

  const baseline = forecast.baseline_emissions;
  const baseYear = forecast.baseline_year ?? series[0]?.year;
  if (baseline != null && targetValue != null && baseYear != null) {
    for (const [y, row] of byYear) {
      if (y < baseYear) continue;
      if (y >= targetYear) row.commitment = targetValue;
      else {
        const frac = (y - baseYear) / Math.max(1, targetYear - baseYear);
        row.commitment = Math.round(baseline - (baseline - targetValue) * frac);
      }
    }
  }

  const data = [...byYear.values()].sort(
    (a, b) => (a.year as number) - (b.year as number)
  );

  return (
    <div className={`chart-wrap ${compact ? "" : "tall"}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="year" tick={axis} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => fmtShort(Number(v))}
            tick={axis}
            width={44}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number, name: string) => [`${fmtShort(value)} t`, name]}
            contentStyle={tip}
            labelStyle={{ color: "#a8adb8" }}
          />
          <Line
            type="monotone"
            dataKey="upper"
            stroke="rgba(61,214,140,0.25)"
            strokeWidth={1}
            dot={false}
            name="Upper PI"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="lower"
            stroke="rgba(61,214,140,0.25)"
            strokeWidth={1}
            dot={false}
            name="Lower PI"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="historical"
            stroke="#f4f5f7"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "#f4f5f7" }}
            name="Reported"
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="median"
            stroke="#3dd68c"
            strokeWidth={2}
            dot={false}
            name="Forecast"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="commitment"
            stroke="#5b8def"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            name="Target"
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

type FlowProps = {
  series: SeriesPoint[];
};

export function ScopeFlowChart({ series }: FlowProps) {
  const data = series.map((s) => ({
    year: s.year,
    total: s.emissions,
    s1: s.scope1,
    s2: s.scope2,
    s3: s.scope3,
  }));

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="year" tick={axis} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => fmtShort(Number(v))}
            tick={axis}
            width={44}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number, name: string) => [`${fmtShort(value)} t`, name]}
            contentStyle={tip}
          />
          <Bar dataKey="s1" stackId="a" fill="#3dd68c" radius={[0, 0, 0, 0]} name="Scope 1" />
          <Bar dataKey="s2" stackId="a" fill="#5b8def" name="Scope 2" />
          <Bar dataKey="s3" stackId="a" fill="#f0c14b" radius={[4, 4, 0, 0]} name="Scope 3" />
          <Line type="monotone" dataKey="total" stroke="#f0713d" strokeWidth={2} dot={false} name="Total" />
          <Area type="monotone" dataKey="total" fill="rgba(240,113,61,0.08)" stroke="none" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
