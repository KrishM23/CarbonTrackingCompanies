import { FormEvent, useEffect, useRef, useState } from "react";
import { api, fmtFull, type EmissionsRecord } from "../api";

const emptyForm = {
  year: new Date().getFullYear() - 1,
  scope1: 0,
  scope2: 0,
  scope3: 0,
  notes: "",
};

export function DataPage() {
  const [rows, setRows] = useState<EmissionsRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    api
      .listEmissions()
      .then(setRows)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await api.upsertEmissions({ ...form, verified: false });
      setMsg(`Saved ${form.year}`);
      setForm((f) => ({ ...f, year: f.year + 1 }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const onCsv = async (file: File) => {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const imported = await api.importCsv(file);
      setMsg(`Imported ${imported.length} year(s)`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (year: number) => {
    if (!confirm(`Delete ${year}?`)) return;
    await api.deleteEmissions(year);
    await load();
  };

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">Inventory</div>
        <h2 style={{ fontWeight: 300 }}>Emissions data</h2>
        <p>
          Enter annual Scope 1–3 inventory in t CO₂e, or upload CSV (
          <code>year,scope1,scope2,scope3</code>). Verified series unlock stronger forecasts.
        </p>
      </header>

      <section className="panel">
        <h3>Add or update a year</h3>
        <p className="panel-sub">Totals are computed automatically. Re-submitting a year overwrites it.</p>
        {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
        {msg && <p style={{ color: "var(--accent-2)", marginBottom: 12 }}>{msg}</p>}
        <form className="row-form" onSubmit={onSubmit}>
          <div className="field">
            <label>Year</label>
            <input
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
              required
            />
          </div>
          <div className="field">
            <label>Scope 1</label>
            <input
              type="number"
              min={0}
              step="any"
              value={form.scope1}
              onChange={(e) => setForm({ ...form, scope1: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Scope 2</label>
            <input
              type="number"
              min={0}
              step="any"
              value={form.scope2}
              onChange={(e) => setForm({ ...form, scope2: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Scope 3</label>
            <input
              type="number"
              min={0}
              step="any"
              value={form.scope3}
              onChange={(e) => setForm({ ...form, scope3: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Save
          </button>
        </form>
        <div className="actions">
          <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
            Import CSV
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCsv(f);
              }}
            />
          </label>
          <a className="btn btn-ghost" href="/sample-emissions.csv" download>
            Download sample CSV
          </a>
        </div>
      </section>

      <section className="panel">
        <h3>Inventory</h3>
        {rows.length === 0 ? (
          <p className="empty">No records yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Scope 1</th>
                  <th>Scope 2</th>
                  <th>Scope 3</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.year}</td>
                    <td>{fmtFull(r.scope1).replace(" t CO₂e", "")}</td>
                    <td>{fmtFull(r.scope2).replace(" t CO₂e", "")}</td>
                    <td>{fmtFull(r.scope3).replace(" t CO₂e", "")}</td>
                    <td>{fmtFull(r.total)}</td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => remove(r.year)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
