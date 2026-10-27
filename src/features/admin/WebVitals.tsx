import { useEffect, useState } from "react";
import type { SupabaseSession } from "../../lib/auth";
import type { MetricsRange } from "../../lib/adminMetrics";
import {
  getVitals,
  vitalRating,
  type AdminVitals,
  type VitalMetric,
  type VitalRating,
} from "../../lib/adminVitals";

const RATING_LABEL: Record<VitalRating, string> = {
  good: "bom",
  "needs-improvement": "melhorar",
  poor: "ruim",
};

const METRICS: { key: VitalMetric; label: string; hint: string }[] = [
  { key: "lcp", label: "LCP", hint: "carregamento do maior elemento" },
  { key: "inp", label: "INP", hint: "resposta a cliques e toques" },
  { key: "cls", label: "CLS", hint: "estabilidade do layout" },
];

function format(metric: VitalMetric, value: number): string {
  if (metric === "cls") return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (metric === "lcp" && value >= 1000) {
    return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
  }
  return `${Math.round(value).toLocaleString("pt-BR")} ms`;
}

/** p75 de LCP, INP e CLS do Umami no período, com as faixas do Google. */
export function WebVitals({ session, range }: { session: SupabaseSession; range: MetricsRange }) {
  const key = `${range.from}|${range.to}`;
  const [loaded, setLoaded] = useState<Record<string, AdminVitals | "error">>({});
  const data = loaded[key];
  const { from, to } = range;

  useEffect(() => {
    if (data) return;
    let alive = true;
    getVitals(session, { from, to })
      .then((result) => {
        if (alive) setLoaded((value) => ({ ...value, [key]: result }));
      })
      .catch(() => {
        if (alive) setLoaded((value) => ({ ...value, [key]: "error" }));
      });
    return () => {
      alive = false;
    };
  }, [session, from, to, key, data]);

  if (data === undefined) {
    return (
      <div className="dash-tile">
        <strong>…</strong>
        <span>carregando os Web Vitals</span>
      </div>
    );
  }
  if (data === "error" || !data.vitals) {
    return (
      <div className="dash-tile">
        <strong>—</strong>
        <span>
          Web Vitals (Umami) ·{" "}
          {data === "error"
            ? "não foi possível consultar o Umami agora."
            : (data.error ?? "indisponível")}
        </span>
      </div>
    );
  }
  const vitals = data.vitals;
  if (vitals.samples === 0) {
    return (
      <div className="dash-tile">
        <strong>—</strong>
        <span>Web Vitals (Umami) · nenhuma medida no período</span>
      </div>
    );
  }
  return (
    <div className="dash-tile admin-vitals">
      <ul>
        {METRICS.map((metric) => {
          const value = vitals[metric.key];
          const rating = value === null ? null : vitalRating(metric.key, value);
          return (
            <li key={metric.key} title={metric.hint}>
              <span className="admin-vitals-name">{metric.label}</span>
              <strong>{value === null ? "—" : format(metric.key, value)}</strong>
              {rating ? (
                <span className={`admin-vital is-${rating}`}>{RATING_LABEL[rating]}</span>
              ) : (
                <span className="admin-vital">sem medida</span>
              )}
            </li>
          );
        })}
      </ul>
      <span>
        Web Vitals (p75, Umami) · {vitals.samples.toLocaleString("pt-BR")}{" "}
        {vitals.samples === 1 ? "medida" : "medidas"}
      </span>
    </div>
  );
}
