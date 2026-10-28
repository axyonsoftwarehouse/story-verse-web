import { useEffect, useState } from "react";
import type { SupabaseSession } from "../../lib/auth";
import {
  getMetricsOverview,
  getReadingSeries,
  type MetricsOverview,
  type MetricsReadingPoint,
  type MetricsRange,
} from "../../lib/adminMetrics";
import { TrendBars } from "./TrendBars";
import { isoDate, rangeEnding } from "./dashboardMath";

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar as métricas.";
}

function rangeFor(days: number): MetricsRange {
  return rangeEnding(isoDate(new Date()), days);
}

function number(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function dayMonth(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function pct(part: number, total: number): string {
  if (!total) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

/** Faixa de cor da célula de retenção, na mesma escala dourada do mapa de constância do perfil. */
function heat(part: number, total: number): string {
  if (!total || !part) return "admin-heat lv-0";
  const share = part / total;
  if (share >= 0.4) return "admin-heat lv-3";
  if (share >= 0.2) return "admin-heat lv-2";
  return "admin-heat lv-1";
}

const SERIES_METRICS = [
  { key: "activeReaders", label: "Leitores ativos", unit: "leitores" },
  { key: "minutes", label: "Minutos", unit: "minutos" },
  { key: "booksStarted", label: "Iniciados", unit: "livros" },
  { key: "booksFinished", label: "Terminados", unit: "livros" },
  { key: "signups", label: "Cadastros", unit: "contas" },
] as const;

type SeriesMetric = (typeof SERIES_METRICS)[number]["key"];

export function MetricsSection({ session }: { session: SupabaseSession }) {
  const [period, setPeriod] = useState(30);
  const [group, setGroup] = useState<"day" | "week">("day");
  const [metric, setMetric] = useState<SeriesMetric>("activeReaders");
  const [overview, setOverview] = useState<MetricsOverview | null>(null);
  const [series, setSeries] = useState<MetricsReadingPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const range = rangeFor(period);
    Promise.all([getMetricsOverview(session, range), getReadingSeries(session, range, group)])
      .then(([summary, points]) => {
        if (!alive) return;
        setOverview(summary);
        setSeries(points);
      })
      .catch((err) => {
        if (alive) setError(message(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session, period, group]);

  return (
    <section className="shelf admin-overview">
      <div className="shelf-head">
        <div>
          <h1>Métricas</h1>
          <p className="muted">Atualizado a cada 5 minutos.</p>
        </div>
        <div className="admin-filters">
          <label>
            Período
            <select value={period} onChange={(event) => setPeriod(Number(event.target.value))}>
              {PERIODS.map((item) => (
                <option key={item.days} value={item.days}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Série
            <select
              value={group}
              onChange={(event) => setGroup(event.target.value as "day" | "week")}
            >
              <option value="day">Por dia</option>
              <option value="week">Por semana</option>
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading || !overview ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando métricas…
        </div>
      ) : (
        <>
          <div className="dash-tiles">
            <article className="dash-card">
              <div className="dash-card-head">
                <span className="dash-label">Contas</span>
              </div>
              <div className="dash-tile">
                <strong>{number(overview.accounts.total)}</strong>
                <span>contas no total</span>
              </div>
              <div className="dash-tile">
                <strong>{number(overview.accounts.new7)}</strong>
                <span>novas em 7 dias</span>
              </div>
              <div className="dash-tile">
                <strong>{number(overview.accounts.new30)}</strong>
                <span>novas em 30 dias</span>
              </div>
              <div className="dash-tile">
                <strong>{number(overview.accounts.confirmed)}</strong>
                <span>e-mail confirmado</span>
              </div>
              <div className="dash-tile">
                <strong>{number(overview.accounts.staff)}</strong>
                <span>contas com papel de staff</span>
              </div>
            </article>

            <article className="dash-card">
              <div className="dash-card-head">
                <span className="dash-label">Leitura no período</span>
              </div>
              <div className="dash-tile">
                <strong>{number(overview.reading.activeReaders)}</strong>
                <span>leitores ativos</span>
              </div>
              <div className="dash-tile">
                <strong>{number(overview.reading.minutes)}</strong>
                <span>minutos lidos</span>
              </div>
              <div className="dash-tile">
                <strong>{number(overview.reading.booksStarted)}</strong>
                <span>livros iniciados</span>
              </div>
              <div className="dash-tile">
                <strong>{number(overview.reading.booksFinished)}</strong>
                <span>livros terminados</span>
              </div>
              <div className="dash-tile">
                <strong>{number(overview.reading.shelfEntries)}</strong>
                <span>entradas na estante</span>
              </div>
            </article>

            <article className="dash-card">
              <div className="dash-card-head">
                <span className="dash-label">Features ligadas</span>
              </div>
              {Object.keys(overview.features).length === 0 ? (
                <p className="dash-sub">Nenhuma feature ligada.</p>
              ) : (
                Object.entries(overview.features).map(([feature, count]) => (
                  <div className="dash-tile" key={feature}>
                    <strong>{number(count)}</strong>
                    <span>{feature}</span>
                  </div>
                ))
              )}
            </article>
          </div>

          <div className="shelf-head">
            <h2>Retenção por coorte</h2>
            <p className="muted">Quem leu nos primeiros dias após o cadastro.</p>
          </div>
          {overview.retention.length === 0 ? (
            <p className="profile-empty">Sem dados de retenção no período.</p>
          ) : (
            <div className="import-table-wrap">
              <table className="import-table">
                <thead>
                  <tr>
                    <th>Coorte</th>
                    <th>Contas</th>
                    <th>D1</th>
                    <th>D7</th>
                    <th>D30</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.retention.map((row) => (
                    <tr key={row.cohortWeek}>
                      <td>{dayMonth(row.cohortWeek)}</td>
                      <td>{number(row.cohortSize)}</td>
                      <td className={heat(row.d1, row.cohortSize)} title={`${row.d1} contas`}>
                        {pct(row.d1, row.cohortSize)}
                      </td>
                      <td className={heat(row.d7, row.cohortSize)} title={`${row.d7} contas`}>
                        {pct(row.d7, row.cohortSize)}
                      </td>
                      <td className={heat(row.d30, row.cohortSize)} title={`${row.d30} contas`}>
                        {pct(row.d30, row.cohortSize)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="shelf-head">
            <h2>Série de leitura</h2>
          </div>
          {series.length === 0 ? (
            <p className="profile-empty">Sem dados de leitura no período.</p>
          ) : (
            <article className="dash-card admin-trend-card">
              <div className="dash-card-head">
                <span className="dash-label">{group === "week" ? "Por semana" : "Por dia"}</span>
                <div
                  className="segmented admin-segmented-small"
                  role="group"
                  aria-label="Métrica da série"
                >
                  {SERIES_METRICS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={item.key === metric ? "is-on" : undefined}
                      aria-pressed={item.key === metric}
                      onClick={() => setMetric(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <TrendBars
                caption={SERIES_METRICS.find((item) => item.key === metric)?.label ?? ""}
                unit={SERIES_METRICS.find((item) => item.key === metric)?.unit ?? ""}
                points={series.map((point) => ({
                  key: point.bucket,
                  label: dayMonth(point.bucket).slice(0, 5),
                  value: point[metric] ?? 0,
                }))}
              />
              <details className="admin-table-details">
                <summary>Ver tabela</summary>
                <div className="import-table-wrap">
                  <table className="import-table">
                    <thead>
                      <tr>
                        <th>Período</th>
                        <th>Leitores ativos</th>
                        <th>Minutos</th>
                        <th>Iniciados</th>
                        <th>Terminados</th>
                        <th>Cadastros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {series.map((point) => (
                        <tr key={point.bucket}>
                          <td>{dayMonth(point.bucket)}</td>
                          <td>{number(point.activeReaders)}</td>
                          <td>{number(point.minutes)}</td>
                          <td>{number(point.booksStarted)}</td>
                          <td>{number(point.booksFinished)}</td>
                          <td>{point.signups === undefined ? "—" : number(point.signups)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </article>
          )}
        </>
      )}
    </section>
  );
}
