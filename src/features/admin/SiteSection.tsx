import { useEffect, useState } from "react";
import type { SupabaseSession } from "../../lib/auth";
import { getHealth, type AdminHealth, type HealthPeriod } from "../../lib/adminHealth";
import { getTraffic, type AdminTraffic, type TrafficItem } from "../../lib/adminTraffic";
import { TrendBars } from "./TrendBars";
import { WebVitals } from "./WebVitals";
import {
  dayMonth,
  duration,
  number,
  percent,
  PERIODS,
  type PeriodKey,
} from "./adminDashboardFormat";
import { Delta, PeriodPicker, Spinner } from "./adminDashboardParts";
import { isoDate, periodRanges } from "./dashboardMath";

/** Lista curta (páginas, origens) no mesmo desenho dos problemas do Sentry. */
function TrafficList({
  title,
  items,
  empty,
}: {
  title: string;
  items: TrafficItem[];
  empty: string;
}) {
  return (
    <div className="dash-tile">
      <span className="dash-label">{title}</span>
      {items.length === 0 ? (
        <span>sem dados no período</span>
      ) : (
        <ul className="admin-issues">
          {items.slice(0, 5).map((item) => (
            <li key={item.value || empty}>
              <span title={item.value || empty}>{item.value || empty}</span>
              <span className="muted">{number(item.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Visitantes, páginas e origens do Umami no período escolhido. */
function TrafficCard({
  data,
  period,
}: {
  data: AdminTraffic | "error" | undefined;
  period: PeriodKey;
}) {
  if (data === undefined) return <Spinner label="Carregando tráfego…" />;
  if (data === "error" || !data.traffic) {
    return (
      <p className="dash-sub">
        Tráfego indisponível ·{" "}
        {data === "error"
          ? "não foi possível consultar o Umami agora."
          : (data.error ?? "sem dados")}
      </p>
    );
  }
  const traffic = data.traffic;
  return (
    <>
      <div className="admin-mini-tiles">
        <div className="dash-tile">
          <strong>{number(traffic.visitors)}</strong>
          <span>
            visitantes ·{" "}
            <Delta
              period={period}
              current={traffic.visitors}
              previous={traffic.previous.visitors}
            />
          </span>
        </div>
        <div className="dash-tile">
          <strong>{number(traffic.pageviews)}</strong>
          <span>
            páginas vistas ·{" "}
            <Delta
              period={period}
              current={traffic.pageviews}
              previous={traffic.previous.pageviews}
            />
          </span>
        </div>
        <div className="dash-tile">
          <strong>{number(traffic.visits)}</strong>
          <span>
            visitas · {percent(traffic.bounceRate)} de rejeição ·{" "}
            {duration(traffic.avgVisitSeconds)} em média
          </span>
        </div>
        <div className="dash-tile">
          <strong>{number(traffic.activeNow)}</strong>
          <span>no site agora</span>
        </div>
        <TrafficList title="Páginas mais vistas" items={traffic.topPages} empty="/" />
        <TrafficList title="Origens" items={traffic.referrers} empty="acesso direto" />
      </div>
      {traffic.series.length > 1 ? (
        <TrendBars
          caption="Páginas vistas"
          unit="páginas"
          points={traffic.series.map((point) => ({
            key: point.day,
            label: dayMonth(point.day),
            value: point.pageviews,
          }))}
        />
      ) : null}
    </>
  );
}

/** Erros, sessões sem crash e problemas mais frequentes de cada projeto do Sentry. */
function SentryHealth({ data }: { data: AdminHealth | "error" | undefined }) {
  if (data === undefined) {
    return (
      <div className="dash-tile">
        <strong>…</strong>
        <span>carregando o Sentry</span>
      </div>
    );
  }
  if (data === "error" || !data.sentry) {
    return (
      <div className="dash-tile">
        <strong>—</strong>
        <span>
          erros (Sentry) ·{" "}
          {data === "error"
            ? "não foi possível consultar a saúde agora."
            : (data.error ?? "indisponível")}
        </span>
      </div>
    );
  }
  if (data.sentry.projects.length === 0) {
    return (
      <div className="dash-tile">
        <strong>—</strong>
        <span>erros (Sentry) · nenhum projeto configurado</span>
      </div>
    );
  }
  return (
    <>
      {data.sentry.projects.map((project) => (
        <div className="dash-tile admin-health-project" key={project.slug}>
          <strong>
            {number(project.errorsTotal)} {project.errorsTotal === 1 ? "erro" : "erros"}
          </strong>
          <span>
            {project.slug}
            {project.crashFreeSessions !== null
              ? ` · ${percent(project.crashFreeSessions)} das sessões sem crash`
              : " · sem sessões registradas"}
          </span>
          {project.topIssues.length > 0 ? (
            <ul className="admin-issues">
              {project.topIssues.slice(0, 3).map((issue) => (
                <li key={issue.id}>
                  {issue.permalink ? (
                    <a
                      href={issue.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={issue.title}
                    >
                      {issue.title}
                    </a>
                  ) : (
                    <span title={issue.title}>{issue.title}</span>
                  )}
                  <span className="muted">{number(issue.count)}×</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </>
  );
}

/** Saúde técnica e tráfego do site: Sentry, Web Vitals e Umami, fora da visão geral do produto. */
export function SiteSection({ session }: { session: SupabaseSession }) {
  const [today] = useState(() => isoDate(new Date()));
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [health, setHealth] = useState<Partial<Record<HealthPeriod, AdminHealth | "error">>>({});
  const [traffic, setTraffic] = useState<Partial<Record<PeriodKey, AdminTraffic | "error">>>({});

  const periodInfo = PERIODS.find((item) => item.key === period) ?? PERIODS[1];
  const healthPeriod = periodInfo.health;
  const loadedHealth = Boolean(health[healthPeriod]);
  const loadedTraffic = Boolean(traffic[period]);

  useEffect(() => {
    if (loadedHealth) return;
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
  }, [session, healthPeriod, loadedHealth]);

  useEffect(() => {
    if (loadedTraffic) return;
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
  }, [session, today, period, loadedTraffic]);

  const ranges = periodRanges(today, periodInfo.days);

  return (
    <section className="shelf admin-overview admin-dashboard">
      <div className="shelf-head">
        <div>
          <h1>Site</h1>
          <p className="muted">Erros, desempenho e tráfego.</p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <div className="admin-dash-grid">
        <article className="dash-card">
          <div className="dash-card-head">
            <span className="dash-label">Erros e desempenho</span>
            <span className="dash-sub">Sentry · {periodInfo.healthLabel}</span>
          </div>
          <div className="admin-mini-tiles">
            <SentryHealth data={health[healthPeriod]} />
            <WebVitals session={session} range={ranges.current} />
          </div>
        </article>

        <article className="dash-card admin-traffic-card">
          <div className="dash-card-head">
            <span className="dash-label">Tráfego do site</span>
            <span className="dash-sub">Umami · {periodInfo.label}</span>
          </div>
          <TrafficCard data={traffic[period]} period={period} />
        </article>
      </div>
    </section>
  );
}
