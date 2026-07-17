export type Company = {
  id: number;
  name: string;
  industry: string;
  baseline_year: number;
  target_year: number;
  reduction_pct: number;
  employee_count?: number;
  annual_revenue_m?: number;
  framework?: string;
  hq_country?: string;
};

export type User = {
  id: number;
  email: string;
  full_name: string;
};

export type EmissionsRecord = {
  id: number;
  year: number;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  notes: string;
  verified: boolean;
};

export type SeriesPoint = {
  year: number;
  emissions: number;
  scope1: number;
  scope2: number;
  scope3: number;
};

export type Metrics = {
  latest: SeriesPoint;
  baseline_emissions: number;
  target_emissions: number;
  pct_from_baseline: number;
  pct_of_goal: number;
  pace_target: number;
  gap_to_pace: number;
  on_track: boolean;
  scope: { scope1: number; scope2: number; scope3: number };
};

export type Forecast = {
  error?: string;
  last_year?: number;
  models?: { name: string; r2: number; rmse: number; loocv_rmse: number | null }[];
  best_model?: string;
  ensemble?: boolean;
  primary_model?: string;
  forecast_years?: number[];
  median?: number[];
  lower?: number[];
  upper?: number[];
  projections?: { mid: number; end: number };
  target?: number;
  gap?: number;
  on_track?: boolean;
  proj_reduction_pct?: number;
  goal_reduction_pct?: number;
  attainment_prob?: number;
  baseline_emissions?: number;
  baseline_year?: number;
  target_year?: number;
  reduction_pct?: number;
};

export type DashboardData = {
  company: Company;
  series: SeriesPoint[];
  metrics: Metrics | null;
  forecast: Forecast;
  insights?: Insights;
};

export type Insights = {
  headlines: string[];
  quality: {
    score: number;
    grade: string;
    checks: { id: string; ok: boolean; label: string }[];
    tips: string[];
  };
  intensity: {
    per_employee: number | null;
    per_revenue_m: number | null;
    peer_label: string;
    peer_t_per_m: number;
    vs_peer_pct: number | null;
    better_than_peer: boolean;
  };
  roadmap: {
    company: string;
    actions: RoadmapAction[];
    summary: string;
    near_term_impact_t: number;
    closes_most_of_gap: boolean;
  };
  compliance: {
    items: { id: string; label: string; status: string; framework: string }[];
    ready_count: number;
    total: number;
    pct: number;
  };
  yoy: {
    from_year: number;
    to_year: number;
    delta_t: number;
    delta_pct: number;
    improved: boolean;
  } | null;
};

export type RoadmapAction = {
  id: string;
  scope: number;
  title: string;
  phase: string;
  years: string;
  priority: string;
  impact_t: number;
  impact_pct: number;
  cost_band: string;
  owner: string;
  detail: string;
};

export type SavedScenario = {
  id: number;
  name: string;
  notes: string;
  scope1_cut: number;
  scope2_cut: number;
  scope3_cut: number;
  ramp_years: number;
  scenario_end: number;
  improvement: number;
  on_track: boolean;
};

export type Levers = {
  scope1_cut: number;
  scope2_cut: number;
  scope3_cut: number;
  ramp_years: number;
};

export type ScenarioResult = {
  years: number[];
  baseline: number[];
  scenario: number[];
  scenario_low: number[];
  scenario_high: number[];
  commitment: (number | null)[];
  baseline_end: number;
  scenario_end: number;
  target: number;
  target_year: number;
  improvement: number;
  on_track_baseline: boolean;
  on_track_scenario: boolean;
  coupling: {
    load_shift_gross: number;
    load_shift_residual: number;
    synergy: number;
  };
  full_savings: number;
  lever_defs?: LeverDef[];
  presets?: ScenarioPreset[];
};

export type LeverDef = {
  id: keyof Levers;
  scope: number | null;
  label: string;
  sub: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
};

export type ScenarioPreset = {
  id: string;
  label: string;
  desc: string;
  levers: Levers;
};

const TOKEN_KEY = "carbontrack_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function friendlyField(loc: unknown): string {
  if (!Array.isArray(loc) || loc.length < 2) return "Input";
  const key = String(loc[loc.length - 1]);
  const labels: Record<string, string> = {
    email: "Email",
    password: "Password",
    company_name: "Company name",
    full_name: "Name",
    industry: "Industry",
    baseline_year: "Baseline year",
    target_year: "Target year",
    reduction_pct: "Reduction target",
  };
  return labels[key] || key.replace(/_/g, " ");
}

function formatApiError(status: number, statusText: string, body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const msg = (item as { msg?: string }).msg || "Invalid value";
            const field = friendlyField((item as { loc?: unknown }).loc);
            const clean = msg.replace(/^Value error,\s*/i, "").replace(/^String should /i, "Must ");
            return `${field}: ${clean}`;
          }
          return "Invalid input";
        })
        .join(". ");
    }
  }

  if (status === 401) return "Invalid email or password.";
  if (status === 409 || status === 400) return "Unable to complete this request.";
  if (status === 422) return "Please check your inputs and try again.";
  if (status === 501 || status === 502 || status === 503) {
    return "The API server is unavailable. Make sure the backend is running on port 8002.";
  }
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return statusText || "Request failed";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(path, { ...options, headers });
  } catch {
    throw new Error(
      "Cannot reach the CarbonTrack API. Confirm the backend is running (port 8002) and refresh."
    );
  }

  if (res.status === 401) {
    clearToken();
    if (!path.includes("/auth/login") && !path.includes("/auth/signup")) {
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    let body: unknown = null;
    const ctype = res.headers.get("content-type") || "";
    try {
      if (ctype.includes("application/json")) {
        body = await res.json();
      } else {
        const text = await res.text();
        if (text.includes("Unsupported method")) {
          throw new Error(
            "The API proxy is misconfigured. Restart the frontend after ensuring the backend is on port 8002."
          );
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("API proxy")) throw err;
    }
    throw new Error(formatApiError(res.status, res.statusText, body));
  }

  if (res.headers.get("content-type")?.includes("application/pdf")) {
    return res.blob() as Promise<T>;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  signup: (body: Record<string, unknown>) =>
    request<{ access_token: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (email: string, password: string) =>
    request<{ access_token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: User; company: Company }>("/api/auth/me"),
  updateCompany: (body: Partial<Company>) =>
    request<Company>("/api/company", { method: "PATCH", body: JSON.stringify(body) }),
  listEmissions: () => request<EmissionsRecord[]>("/api/emissions"),
  upsertEmissions: (body: Omit<EmissionsRecord, "id" | "total"> & { total?: number }) =>
    request<EmissionsRecord>("/api/emissions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteEmissions: (year: number) =>
    request<{ ok: boolean }>(`/api/emissions/${year}`, { method: "DELETE" }),
  importCsv: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<EmissionsRecord[]>("/api/emissions/csv", { method: "POST", body: fd });
  },
  dashboard: () => request<DashboardData>("/api/dashboard"),
  runScenario: (levers: Levers) =>
    request<ScenarioResult>("/api/scenarios/run", {
      method: "POST",
      body: JSON.stringify(levers),
    }),
  scenarioMeta: () =>
    request<{ lever_defs: LeverDef[]; presets: ScenarioPreset[] }>("/api/scenarios/meta"),
  insights: () => request<Insights>("/api/insights"),
  listSavedScenarios: () => request<SavedScenario[]>("/api/scenarios/saved"),
  saveScenario: (body: {
    name: string;
    notes?: string;
    scope1_cut: number;
    scope2_cut: number;
    scope3_cut: number;
    ramp_years: number;
  }) =>
    request<SavedScenario>("/api/scenarios/saved", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteSavedScenario: (id: number) =>
    request<{ ok: boolean }>(`/api/scenarios/saved/${id}`, { method: "DELETE" }),
  downloadPdf: async () => {
    const blob = await request<Blob>("/api/reports/pdf");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "carbontrack-report.pdf";
    a.click();
    URL.revokeObjectURL(url);
  },
};

export function fmtShort(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return `${Math.round(n)}`;
}

export function fmtFull(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n).toLocaleString()} t CO₂e`;
}
