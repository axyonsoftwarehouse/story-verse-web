import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { SupabaseSession } from "../../lib/auth";
import {
  brlFromCents,
  getBillingSeries,
  getBillingSummary,
  type BillingSeriesPoint,
  type BillingSummary,
} from "../../lib/adminBilling";
import { getHealth, type AdminHealth, type HealthPeriod } from "../../lib/adminHealth";
import {
  getMetricsOverview,
  getMetricsRetention,
  getReadingSeries,
  type MetricsOverview,
  type MetricsReadingPoint,
  type MetricsRetention,
} from "../../lib/adminMetrics";
import { getOverview, type AdminOverview } from "../../lib/adminOverview";
import { getTraffic, type AdminTraffic } from "../../lib/adminTraffic";
import { getTopBooks, type AdminTopBook } from "../../lib/adminTopBooks";
import { fetchRanking, type RankEntry } from "../../lib/ranking";
import { ActiveUsersCard } from "./ActiveUsersCard";
import { TrendBars } from "./TrendBars";
import { dayMonth, number, PERIODS, type PeriodKey } from "./adminDashboardFormat";
import { Delta, PeriodPicker, Spinner } from "./adminDashboardParts";
import { isSuperadmin } from "./adminSections";
import {
  fillDays,
  isoDate,
  latestCompleteD7,
  periodRanges,
  rangeEnding,
  ratio,
  signupsBetween,
} from "./dashboardMath";

type TrendMetric = "activeReaders" | "minutes" | "pages" | "booksFinished" | "signups";

const TRENDS: { key: TrendMetric; label: string; unit: string }[] = [
  { key: "activeReaders", label: "Leitores", unit: "leitores" },
  { key: "minutes", label: "Minutos", unit: "minutos" },
  { key: "pages", label: "Páginas", unit: "páginas" },
  { key: "booksFinished", label: "Terminados", unit: "livros" },
  { key: "signups", label: "Cadastros", unit: "contas" },
];

type BillingMetric = "mrrCents" | "revenueCents";

const BILLING_TRENDS: { key: BillingMetric; label: string; summary: "last" | "total" }[] = [
  { key: "mrrCents", label: "MRR", summary: "last" },
  { key: "revenueCents", label: "Receita", summary: "total" },
];

const TREND_DAYS = 30;
/** A série de leitura vem com 60 dias: os 30 do gráfico e os 30 anteriores, para comparar cadastros. */
const SERIES_DAYS = 60;
const RETENTION_DAYS = 60;

type Pair = { current: MetricsOverview; previous: MetricsOverview };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar a visão geral.";
}

function when(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function bytes(value: number | null): string {
  if (value === null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(size);
  return `${number} ${units[unit]}`;
}

function hours(minutes: number): string {
  const value = minutes / 60;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: value < 10 ? 1 : 0 }).format(
    value,
  );
}

function Kpi({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="dash-card admin-kpi">
      <span className="dash-label">{label}</span>
      <strong>{value}</strong>
      {children}
    </article>
  );
}

function Pending({ endpoint }: { endpoint: string }) {
  return (
    <span className="admin-pending" title={endpoint}>
      aguardando endpoint
    </span>
  );
}

type ActionItem = { key: string; count: number; label: string; to?: string; cta?: string };

function ActionStrip({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null;
  const open = items.filter((item) => item.count > 0).length;
  return (
    <article className={`dash-card admin-actions${open ? " has-open" : ""}`}>
      <div className="dash-card-head">
        <span className="dash-label">Precisa de ação</span>
        <span className="dash-sub">
          {open ? `${open} ${open === 1 ? "item" : "itens"} em aberto` : "Tudo em dia"}
        </span>
      </div>
      <ul className="admin-action-list">
        {items.map((item) => (
          <li key={item.key} className={item.count > 0 ? "is-open" : undefined}>
            <strong className="admin-action-count">
              {item.count > 0 ? (
                number(item.count)
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-label="nenhum">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </strong>
            <span className="admin-action-label">{item.label}</span>
            {item.to && item.count > 0 ? (
              <Link className="admin-action-cta" to={item.to}>
                {item.cta ?? "abrir"}
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </article>
  );
}

/** Novos usuários: hoje pelo calendário de Brasília; 7 e 30 dias pela série, comparando com o período anterior. */
function NewUsers({
  period,
  accounts,
  signups,
  signupsBefore,
}: {
  period: PeriodKey;
  accounts: MetricsOverview["accounts"];
  signups: number | null;
  signupsBefore: number | null;
}) {
  if (period === "today") {
    if (accounts.newToday === undefined) {
      return (
        <Kpi label="Novos usuários" value="—">
          <Pending endpoint="accounts.newToday em /api/v1/admin/metrics/overview" />
        </Kpi>
      );
    }
    const notes = [
      signupsBefore !== null ? `ontem: ${number(signupsBefore)}` : null,
      accounts.new24h !== undefined ? `${number(accounts.new24h)} nas últimas 24 h` : null,
    ].filter(Boolean);
    return (
      <Kpi label="Novos usuários" value={number(accounts.newToday)}>
        <span className="admin-delta">{notes.join(" · ")}</span>
      </Kpi>
    );
  }
  const fallback = period === "7d" ? accounts.new7 : accounts.new30;
  const current = signups ?? fallback;
  return (
    <Kpi label="Novos usuários" value={number(current)}>
      {signupsBefore !== null ? (
        <Delta period={period} current={current} previous={signupsBefore} />
      ) : (
        <span className="admin-delta">{number(accounts.total)} contas no total</span>
      )}
    </Kpi>
  );
}

/** Resumo do Sentry na visão geral: total de erros; o detalhe fica na aba Site. */
function ErrorsSummary({ data, label }: { data: AdminHealth | "error" | undefined; label: string }) {
  if (data === undefined) {
    return (
      <div className="dash-tile">
        <strong>…</strong>
        <span>carregando o Sentry</span>
      </div>
    );
  }
  if (data === "error" || !data.sentry || data.sentry.projects.length === 0) {
    const reason =
      data === "error"
        ? "não foi possível consultar agora."
        : !data.sentry
          ? (data.error ?? "indisponível")
          : "nenhum projeto configurado";
    return (
      <div className="dash-tile">
        <strong>—</strong>
        <span>erros (Sentry) · {reason}</span>
      </div>
    );
  }
  const total = data.sentry.projects.reduce((sum, project) => sum + project.errorsTotal, 0);
  return (
    <div className="dash-tile">
      <strong>{number(total)}</strong>
      <span>
        {total === 1 ? "erro" : "erros"} no Sentry · {label}
      </span>
    </div>
  );
}

/** Resumo do Umami na visão geral: visitantes do período. */
function VisitorsSummary({
  data,
  period,
}: {
  data: AdminTraffic | "error" | undefined;
  period: PeriodKey;
}) {
  if (data === undefined) {
    return (
      <div className="dash-tile">
        <strong>…</strong>
        <span>carregando o Umami</span>
      </div>
    );
  }
  if (data === "error" || !data.traffic) {
    return (
      <div className="dash-tile">
        <strong>—</strong>
        <span>visitantes · Umami indisponível</span>
      </div>
    );
  }
  return (
    <div className="dash-tile">
      <strong>{number(data.traffic.visitors)}</strong>
      <span>
        visitantes ·{" "}
        <Delta
          period={period}
          current={data.traffic.visitors}
          previous={data.traffic.previous.visitors}
        />
      </span>
    </div>
  );
}

/** Livros do acervo mais lidos no período, pela estante (sem minutos: a leitura diária não guarda o livro). */
function TopBooksCard({ data }: { data: AdminTopBook[] | "error" | undefined }) {
  if (data === undefined) return <Spinner label="Carregando livros…" />;
  if (data === "error") {
    return <p className="dash-sub">Não foi possível carregar os livros mais lidos agora.</p>;
  }
  if (data.length === 0)
    return <p className="profile-empty">Nenhum livro do acervo lido no período.</p>;
  return (
    <ol className="admin-ranking">
      {data.map((book, index) => (
        <li key={book.bookKey} className={index < 3 ? `is-top is-place-${index + 1}` : undefined}>
          <span className="admin-ranking-place">{index + 1}º</span>
          <span
            className="admin-ranking-name"
            title={book.author ? `${book.title} · ${book.author}` : book.title}
          >
            {book.title}
            {book.author ? <span className="muted"> · {book.author}</span> : null}
          </span>
          <span className="admin-ranking-minutes">
            {number(book.readers)} {book.readers === 1 ? "leitor" : "leitores"} ·{" "}
            {number(book.finished)} {book.finished === 1 ? "terminou" : "terminaram"}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function OverviewSection({ session, roles }: { session: SupabaseSession; roles: string[] }) {
  const superadmin = isSuperadmin(roles);
  const [today] = useState(() => isoDate(new Date()));
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [trend, setTrend] = useState<TrendMetric>("activeReaders");
  const [pairs, setPairs] = useState<Partial<Record<PeriodKey, Pair>>>({});
  const [pairError, setPairError] = useState("");
  const [series, setSeries] = useState<MetricsReadingPoint[] | null>(null);
  const [retention, setRetention] = useState<MetricsRetention[] | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [ranking, setRanking] = useState<RankEntry[] | null>(null);
  const [billingSeries, setBillingSeries] = useState<BillingSeriesPoint[] | null>(null);
  const [billingMetric, setBillingMetric] = useState<BillingMetric>("mrrCents");
  const [health, setHealth] = useState<Partial<Record<HealthPeriod, AdminHealth | "error">>>({});
  const [traffic, setTraffic] = useState<Partial<Record<PeriodKey, AdminTraffic | "error">>>({});
  const [topBooks, setTopBooks] = useState<Partial<Record<PeriodKey, AdminTopBook[] | "error">>>(
    {},
  );

  useEffect(() => {
    let alive = true;
    setError("");
    getOverview(session)
      .then((result) => {
        if (alive) setOverview(result);
      })
      .catch((err) => {
        if (alive) setError(message(err));
      });
    if (superadmin) {
      // Cada bloco carrega sozinho: se o financeiro ou o ranking falhar, o resto continua.
      const seriesRange = rangeEnding(today, SERIES_DAYS);
      getReadingSeries(session, seriesRange, "day")
        .then((points) => {
          if (alive) setSeries(fillDays(points, seriesRange));
        })
        .catch(() => {
          if (alive) setSeries([]);
        });
      getMetricsRetention(session, rangeEnding(today, RETENTION_DAYS))
        .then((rows) => {
          if (alive) setRetention(rows);
        })
        .catch(() => {
          if (alive) setRetention([]);
        });
      getBillingSummary(session)
        .then((summary) => {
          if (alive) setBilling(summary);
        })
        .catch(() => undefined);
      getBillingSeries(session, rangeEnding(today, TREND_DAYS), "day")
        .then((points) => {
          if (alive) setBillingSeries(points);
        })
        .catch(() => {
          if (alive) setBillingSeries([]);
        });
      fetchRanking(session, 0, 10)
        .then((rows) => {
          if (alive) setRanking(rows);
        })
        .catch(() => {
          if (alive) setRanking([]);
        });
    }
    return () => {
      alive = false;
    };
  }, [session, superadmin, today]);

  const loadedPair = Boolean(pairs[period]);

  useEffect(() => {
    if (!superadmin || loadedPair) return;
    let alive = true;
    setPairError("");
    const days = PERIODS.find((item) => item.key === period)?.days ?? 7;
    const ranges = periodRanges(today, days);
    Promise.all([
      getMetricsOverview(session, ranges.current),
      getMetricsOverview(session, ranges.previous),
    ])
      .then(([current, previous]) => {
        if (alive) setPairs((value) => ({ ...value, [period]: { current, previous } }));
      })
      .catch((err) => {
        if (alive) setPairError(message(err));
      });
    return () => {
      alive = false;
    };
  }, [session, superadmin, today, period, loadedPair]);

  const healthPeriod = PERIODS.find((item) => item.key === period)?.health ?? "7d";
  const loadedHealth = Boolean(health[healthPeriod]);

  useEffect(() => {
    if (!superadmin || loadedHealth) return;
    let alive = true;
    getHealth(session, healthPeriod)
      .then((result) => {
        if (alive) setHealth((value) => ({ ...value, [healthPeriod]: result }));
      })
      .catch(() => {
        if (alive) setHealth((value) => ({ ...value, [healthPeriod]: "error" }));
      });
    return () => {
      alive = false;
    };
  }, [session, superadmin, healthPeriod, loadedHealth]);

  const loadedTraffic = Boolean(traffic[period]);

  useEffect(() => {
    if (!superadmin || loadedTraffic) return;
    let alive = true;
    const days = PERIODS.find((item) => item.key === period)?.days ?? 7;
    getTraffic(session, periodRanges(today, days).current)
      .then((result) => {
        if (alive) setTraffic((value) => ({ ...value, [period]: result }));
      })
      .catch(() => {
        if (alive) setTraffic((value) => ({ ...value, [period]: "error" }));
      });
    return () => {
      alive = false;
    };
  }, [session, superadmin, today, period, loadedTraffic]);

  const loadedTopBooks = Boolean(topBooks[period]);

  useEffect(() => {
    if (!superadmin || loadedTopBooks) return;
    let alive = true;
    const days = PERIODS.find((item) => item.key === period)?.days ?? 7;
    getTopBooks(session, periodRanges(today, days).current)
      .then((result) => {
        if (alive) setTopBooks((value) => ({ ...value, [period]: result }));
      })
      .catch(() => {
        if (alive) setTopBooks((value) => ({ ...value, [period]: "error" }));
      });
    return () => {
      alive = false;
    };
  }, [session, superadmin, today, period, loadedTopBooks]);

  if (error) {
    return (
      <p className="auth-error" role="alert">
        {error}
      </p>
    );
  }

  if (!overview) return <Spinner label="Carregando…" />;

  const actions: ActionItem[] = [];
  if (overview.moderation) {
    actions.push(
      {
        key: "submissions",
        count: overview.moderation.pendingSubmissions,
        label: "envios esperando revisão",
        to: "/admin/acervo/envios",
        cta: "revisar",
      },
    );
  }
  if (billing) {
    actions.push({
      key: "past_due",
      count: billing.past_due,
      label: "assinaturas com pagamento pendente",
      to: "/admin/financeiro",
      cta: "ver financeiro",
    });
  }
  // Sem nenhum backup registrado não é "atraso": o card mostra um aviso neutro em vez do alarme.
  const backupLate = Boolean(overview.backup?.stale && overview.backup.finishedAt);
  if (overview.backup) {
    actions.push({
      key: "backup",
      count: backupLate ? 1 : 0,
      label: backupLate ? "backup atrasado (mais de 26 h)" : "backup em dia",
    });
  }

  const periodInfo = PERIODS.find((item) => item.key === period) ?? PERIODS[1];
  const pair = pairs[period];
  const trendInfo = TRENDS.find((item) => item.key === trend) ?? TRENDS[0];
  const cohort = retention ? latestCompleteD7(retention, today) : null;
  const reading = pair?.current.reading;
  const trendPoints = series ? series.slice(-TREND_DAYS) : null;
  const ranges = periodRanges(today, periodInfo.days);
  const signups = series ? signupsBetween(series, ranges.current) : null;
  const signupsBefore = series ? signupsBetween(series, ranges.previous) : null;
  const healthData = health[healthPeriod];
  const billingInfo =
    BILLING_TRENDS.find((item) => item.key === billingMetric) ?? BILLING_TRENDS[0];
  const conversion =
    billing?.trials_ended !== undefined && billing.trials_converted !== undefined
      ? ratio(billing.trials_converted, billing.trials_ended)
      : undefined;

  return (
    <section className="shelf admin-overview admin-dashboard admin-home">
      <div className="shelf-head">
        <div>
          <h1>Visão geral</h1>
          <p className="muted">Atualizado a cada 5 minutos.</p>
        </div>
        {superadmin ? (
          <PeriodPicker value={period} onChange={setPeriod} />
        ) : null}
      </div>

      <ActionStrip items={actions} />

      {superadmin ? (
        <>
          {pairError ? (
            <p className="auth-error" role="alert">
              {pairError}
            </p>
          ) : null}
          {!pair || !reading ? (
            pairError ? null : (
              <Spinner label="Carregando números do período…" />
            )
          ) : (
            <>
              <div className="admin-kpis">
                <Kpi label="Leitores ativos" value={number(reading.activeReaders)}>
                  <Delta
                    period={period}
                    current={reading.activeReaders}
                    previous={pair.previous.reading.activeReaders}
                  />
                </Kpi>
                <Kpi label="Livros terminados" value={number(reading.booksFinished)}>
                  <Delta
                    period={period}
                    current={reading.booksFinished}
                    previous={pair.previous.reading.booksFinished}
                  />
                </Kpi>
                <Kpi label="Livros iniciados" value={number(reading.booksStarted)}>
                  <Delta
                    period={period}
                    current={reading.booksStarted}
                    previous={pair.previous.reading.booksStarted}
                  />
                </Kpi>
                <Kpi label="Horas lidas" value={hours(reading.minutes)}>
                  <Delta
                    period={period}
                    current={reading.minutes}
                    previous={pair.previous.reading.minutes}
                  />
                </Kpi>
                <NewUsers
                  period={period}
                  accounts={pair.current.accounts}
                  signups={signups}
                  signupsBefore={signupsBefore}
                />
                {/* 1 página = 250 palavras lidas (regra em src/lib/readingPages.ts). */}
                <Kpi
                  label="Páginas lidas"
                  value={reading.pages === undefined ? "—" : number(reading.pages)}
                >
                  {reading.pages === undefined ? (
                    <Pending endpoint="campo pages em /api/v1/admin/metrics/overview" />
                  ) : (
                    <Delta
                      period={period}
                      current={reading.pages}
                      previous={pair.previous.reading.pages ?? 0}
                    />
                  )}
                </Kpi>
              </div>

              <div className="admin-insights">
                <div className="dash-tile">
                  <strong>
                    {reading.booksStarted
                      ? `${ratio(reading.booksFinished, reading.booksStarted)}%`
                      : "—"}
                  </strong>
                  <span>taxa de conclusão</span>
                </div>
                <div className="dash-tile">
                  <strong>
                    {reading.activeReaders
                      ? number(Math.round(reading.minutes / reading.activeReaders))
                      : "—"}
                  </strong>
                  <span>minutos por leitor ativo</span>
                </div>
                <div className="dash-tile">
                  <strong>{cohort ? `${ratio(cohort.d7, cohort.cohortSize)}%` : "—"}</strong>
                  <span>
                    {cohort
                      ? `voltaram a ler em 7 dias · ${number(cohort.cohortSize)} contas`
                      : "retenção em 7 dias: sem dados ainda"}
                  </span>
                </div>
              </div>
            </>
          )}

          <div className="admin-dash-grid">
            <article className="dash-card admin-trend-card">
              <div className="dash-card-head">
                <span className="dash-label">Últimos {TREND_DAYS} dias</span>
                <div
                  className="segmented admin-segmented-small"
                  role="group"
                  aria-label="Métrica da tendência"
                >
                  {TRENDS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={item.key === trend ? "is-on" : undefined}
                      aria-pressed={item.key === trend}
                      onClick={() => setTrend(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              {trendPoints === null ? (
                <Spinner label="Carregando série…" />
              ) : (
                <TrendBars
                  caption={trendInfo.label}
                  unit={trendInfo.unit}
                  points={(trendPoints ?? []).map((point) => ({
                    key: point.bucket,
                    label: dayMonth(point.bucket),
                    value: point[trend] ?? 0,
                  }))}
                />
              )}
            </article>

            <article className="dash-card admin-ranking-card">
              <div className="dash-card-head">
                <span className="dash-label">Ranking da semana</span>
                <span className="dash-sub">minutos lidos</span>
              </div>
              {ranking === null ? (
                <Spinner label="Carregando ranking…" />
              ) : ranking.length === 0 ? (
                <p className="profile-empty">Ninguém pontuou nesta semana ainda.</p>
              ) : (
                <ol className="admin-ranking">
                  {ranking.map((entry) => (
                    <li
                      key={entry.user_id}
                      className={entry.place <= 3 ? `is-top is-place-${entry.place}` : undefined}
                    >
                      <span className="admin-ranking-place">{entry.place}º</span>
                      <span className="admin-ranking-name">{entry.name}</span>
                      <span className="admin-ranking-minutes">{number(entry.minutes)} min</span>
                    </li>
                  ))}
                </ol>
              )}
            </article>

            <article className="dash-card">
              <div className="dash-card-head">
                <span className="dash-label">Assinaturas</span>
                <Link className="link-btn" to="/admin/financeiro" aria-label="Abrir Financeiro">abrir</Link>
              </div>
              {billing ? (
                <div className="admin-mini-tiles">
                  <div className="dash-tile">
                    <strong>{brlFromCents(billing.mrr_cents)}</strong>
                    <span>MRR</span>
                  </div>
                  <div className="dash-tile">
                    <strong>{number(billing.active)}</strong>
                    <span>ativas · {number(billing.trialing)} em teste</span>
                  </div>
                  <div className="dash-tile">
                    <strong>
                      +{number(billing.new_count)} / −{number(billing.canceled_count)}
                    </strong>
                    <span>novas / canceladas em 30 dias</span>
                  </div>
                  <div className="dash-tile">
                    <strong>{number(billing.failed)}</strong>
                    <span>falhas de cobrança</span>
                  </div>
                  {conversion !== undefined ? (
                    <div className="dash-tile">
                      <strong>{conversion === null ? "—" : `${conversion}%`}</strong>
                      <span>
                        testes convertidos · {number(billing.trials_converted ?? 0)} de{" "}
                        {number(billing.trials_ended ?? 0)}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="dash-sub">Financeiro indisponível agora.</p>
              )}
              {billingSeries && billingSeries.length > 0 ? (
                <div className="admin-billing-trend">
                  <div className="dash-card-head">
                    <span className="dash-label">Últimos {TREND_DAYS} dias</span>
                    <div
                      className="segmented admin-segmented-small"
                      role="group"
                      aria-label="Métrica do financeiro"
                    >
                      {BILLING_TRENDS.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          className={item.key === billingMetric ? "is-on" : undefined}
                          aria-pressed={item.key === billingMetric}
                          onClick={() => setBillingMetric(item.key)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TrendBars
                    caption={billingInfo.label}
                    unit=""
                    format={brlFromCents}
                    summary={billingInfo.summary}
                    points={billingSeries.map((point) => ({
                      key: point.bucket,
                      label: dayMonth(point.bucket),
                      value: point[billingMetric],
                      estimated: billingMetric === "mrrCents" && point.estimated,
                    }))}
                  />
                </div>
              ) : null}
            </article>

            <article className={`dash-card${backupLate ? " is-alert" : ""}`}>
              <div className="dash-card-head">
                <span className="dash-label">Site</span>
                <Link className="link-btn" to="/admin/site" aria-label="Abrir Site">abrir</Link>
              </div>
              <div className="admin-mini-tiles">
                {overview.backup ? (
                  <div className="dash-tile">
                    {overview.backup.finishedAt ? (
                      <>
                        <strong>
                          {backupLate
                            ? "Atrasado"
                            : overview.backup.status === "success"
                              ? "Em dia"
                              : (overview.backup.status ?? "—")}
                        </strong>
                        <span title={bytes(overview.backup.sizeBytes)}>
                          backup · {when(overview.backup.finishedAt)}
                        </span>
                      </>
                    ) : (
                      <>
                        <strong>—</strong>
                        <span>backup · sem backup registrado</span>
                      </>
                    )}
                  </div>
                ) : null}
                <ErrorsSummary data={healthData} label={periodInfo.healthLabel} />
                <VisitorsSummary data={traffic[period]} period={period} />
              </div>
            </article>

            <article className="dash-card admin-ranking-card">
              <div className="dash-card-head">
                <span className="dash-label">Livros mais lidos</span>
                <span className="dash-sub">estante · {periodInfo.label}</span>
              </div>
              <TopBooksCard data={topBooks[period]} />
            </article>

            <ActiveUsersCard session={session} today={today} />
          </div>
        </>
      ) : overview.accounts ? (
        <div className="admin-kpis">
          <Kpi label="Contas no total" value={number(overview.accounts.total)} />
          <Kpi label="Novas em 7 dias" value={number(overview.accounts.newLast7Days)} />
        </div>
      ) : null}
    </section>
  );
}
