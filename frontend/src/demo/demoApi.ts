import type {
  Company,
  DashboardData,
  EmissionsRecord,
  Insights,
  Levers,
  SavedScenario,
  ScenarioPreset,
  ScenarioResult,
  User,
} from "../api";
import dashboardFixture from "./dashboard.json";
import emissionsFixture from "./emissions.json";
import insightsFixture from "./insights.json";
import scenarioMetaFixture from "./scenario-meta.json";
import scenarioSampleFixture from "./scenario-sample.json";

const DEMO_FLAG = "vapor_demo_mode";
const DEMO_TOKEN = "demo.vapor.local";
const SAVED_KEY = "vapor_demo_saved_scenarios";
const COMPANY_KEY = "vapor_demo_company";
const EMISSIONS_KEY = "vapor_demo_emissions";

const demoUser: User = {
  id: 1,
  email: "demo@acme.corp",
  full_name: "Alex Morgan",
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function readCompany(): Company {
  const raw = localStorage.getItem(COMPANY_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as Company;
    } catch {
      /* fall through */
    }
  }
  return clone((dashboardFixture as DashboardData).company);
}

function writeCompany(company: Company) {
  localStorage.setItem(COMPANY_KEY, JSON.stringify(company));
}

function readEmissions(): EmissionsRecord[] {
  const raw = localStorage.getItem(EMISSIONS_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as EmissionsRecord[];
    } catch {
      /* fall through */
    }
  }
  return clone(emissionsFixture as EmissionsRecord[]);
}

function writeEmissions(rows: EmissionsRecord[]) {
  localStorage.setItem(EMISSIONS_KEY, JSON.stringify(rows));
}

function readSaved(): SavedScenario[] {
  const raw = localStorage.getItem(SAVED_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedScenario[];
  } catch {
    return [];
  }
}

function writeSaved(rows: SavedScenario[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(rows));
}

export function isDemoToken(token: string | null | undefined): boolean {
  return !!token && token.startsWith("demo.");
}

export function enableDemoMode() {
  localStorage.setItem(DEMO_FLAG, "1");
}

export function isDemoModeEnabled(): boolean {
  if (import.meta.env.VITE_DEMO_MODE === "true") return true;
  return localStorage.getItem(DEMO_FLAG) === "1";
}

export function shouldUseDemoApi(token?: string | null): boolean {
  return isDemoModeEnabled() || isDemoToken(token);
}

export const demoApi = {
  async login(email: string, password: string) {
    if (email.trim().toLowerCase() !== "demo@acme.corp" || password !== "demo1234") {
      throw new Error("Invalid email or password.");
    }
    enableDemoMode();
    return { access_token: DEMO_TOKEN, token_type: "bearer" as const };
  },

  async signup(_payload: Record<string, unknown>) {
    enableDemoMode();
    return { access_token: DEMO_TOKEN, token_type: "bearer" as const };
  },

  async me() {
    return { user: clone(demoUser), company: readCompany() };
  },

  async updateCompany(body: Partial<Company>) {
    const next = { ...readCompany(), ...body, id: 1 };
    writeCompany(next);
    return next;
  },

  async listEmissions() {
    return readEmissions().sort((a, b) => a.year - b.year);
  },

  async upsertEmissions(body: Omit<EmissionsRecord, "id" | "total"> & { total?: number }) {
    const rows = readEmissions();
    const total = body.total ?? body.scope1 + body.scope2 + body.scope3;
    const existing = rows.find((r) => r.year === body.year);
    if (existing) {
      Object.assign(existing, body, { total });
      writeEmissions(rows);
      return clone(existing);
    }
    const row: EmissionsRecord = {
      id: Math.max(0, ...rows.map((r) => r.id)) + 1,
      year: body.year,
      scope1: body.scope1,
      scope2: body.scope2,
      scope3: body.scope3,
      total,
      notes: body.notes || "",
      verified: body.verified,
    };
    rows.push(row);
    writeEmissions(rows);
    return clone(row);
  },

  async deleteEmissions(year: number) {
    writeEmissions(readEmissions().filter((r) => r.year !== year));
    return { ok: true };
  },

  async importCsv(file: File) {
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/).slice(1);
    const rows = readEmissions();
    const imported: EmissionsRecord[] = [];
    for (const line of lines) {
      const [year, s1, s2, s3] = line.split(",").map((x) => x.trim());
      if (!year) continue;
      const body = {
        year: Number(year),
        scope1: Number(s1) || 0,
        scope2: Number(s2) || 0,
        scope3: Number(s3) || 0,
        notes: "CSV import",
        verified: false,
      };
      const total = body.scope1 + body.scope2 + body.scope3;
      const existing = rows.find((r) => r.year === body.year);
      if (existing) {
        Object.assign(existing, body, { total });
        imported.push(clone(existing));
      } else {
        const row: EmissionsRecord = {
          id: Math.max(0, ...rows.map((r) => r.id), ...imported.map((r) => r.id)) + 1,
          ...body,
          total,
        };
        rows.push(row);
        imported.push(clone(row));
      }
    }
    writeEmissions(rows);
    return imported;
  },

  async dashboard(): Promise<DashboardData> {
    const base = clone(dashboardFixture as DashboardData);
    base.company = readCompany();
    const rows = readEmissions().sort((a, b) => a.year - b.year);
    if (rows.length) {
      base.series = rows.map((r) => ({
        year: r.year,
        emissions: r.total,
        scope1: r.scope1,
        scope2: r.scope2,
        scope3: r.scope3,
      }));
    }
    return base;
  },

  async insights(): Promise<Insights> {
    return clone(insightsFixture as Insights);
  },

  async scenarioMeta() {
    return clone(scenarioMetaFixture as { lever_defs: unknown[]; presets: ScenarioPreset[] });
  },

  async runScenario(levers: Levers): Promise<ScenarioResult> {
    const sample = clone(scenarioSampleFixture as ScenarioResult);
    // Scale sample ends roughly with lever intensity so the UI feels responsive
    const intensity =
      (levers.scope1_cut + levers.scope2_cut + levers.scope3_cut) / 300;
    const baselineEnd = sample.baseline_end;
    const bestCut = baselineEnd * 0.45;
    sample.scenario_end = Math.round(baselineEnd - bestCut * Math.min(1.2, intensity + 0.15));
    sample.improvement = Math.round(baselineEnd - sample.scenario_end);
    sample.on_track_scenario = sample.scenario_end <= sample.target;
    sample.scenario = sample.scenario.map((v, i) => {
      const b = sample.baseline[i] ?? v;
      return Math.round(b - (b - v) * (0.5 + intensity));
    });
    return sample;
  },

  async listSavedScenarios() {
    return readSaved();
  },

  async saveScenario(body: {
    name: string;
    notes?: string;
    scope1_cut: number;
    scope2_cut: number;
    scope3_cut: number;
    ramp_years: number;
  }) {
    const result = await demoApi.runScenario(body);
    const rows = readSaved();
    const row: SavedScenario = {
      id: Math.max(0, ...rows.map((r) => r.id)) + 1,
      name: body.name,
      notes: body.notes || "",
      scope1_cut: body.scope1_cut,
      scope2_cut: body.scope2_cut,
      scope3_cut: body.scope3_cut,
      ramp_years: body.ramp_years,
      scenario_end: result.scenario_end,
      improvement: result.improvement,
      on_track: result.on_track_scenario,
    };
    rows.unshift(row);
    writeSaved(rows);
    return row;
  },

  async deleteSavedScenario(id: number) {
    writeSaved(readSaved().filter((r) => r.id !== id));
    return { ok: true };
  },

  async downloadPdf() {
    const company = readCompany();
    const text = [
      "Vapor — demo board summary",
      "",
      `Company: ${company.name}`,
      `Target: ${Math.round(company.reduction_pct * 100)}% by ${company.target_year}`,
      "",
      "This PDF is a lightweight demo export for Netlify preview.",
      "Connect a live API for the full ReportLab board pack.",
      "",
    ].join("\n");
    return new Blob([text], { type: "application/pdf" });
  },
};
