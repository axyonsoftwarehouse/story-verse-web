import { change } from "./dashboardMath";
import { number, PERIODS, type PeriodKey } from "./adminDashboardFormat";

/** Componentes comuns da visão geral e da aba Site. */

export function Spinner({ label }: { label: string }) {
  return (
    <div className="page-status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Variação contra o período anterior; em "Hoje" mostra o valor de ontem (o dia ainda não acabou). */
export function Delta({
  current,
  previous,
  period,
}: {
  current: number;
  previous: number;
  period: PeriodKey;
}) {
  if (period === "today") return <span className="admin-delta">ontem: {number(previous)}</span>;
  const pct = change(current, previous);
  if (pct === null) return <span className="admin-delta">sem base anterior</span>;
  const tone = pct > 0 ? " is-up" : pct < 0 ? " is-down" : " is-flat";
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  const said = pct > 0 ? "subiu" : pct < 0 ? "caiu" : "igual ao período anterior";
  return (
    <span className={`admin-delta is-pill${tone}`} title={`${said}${pct ? ` ${Math.abs(pct)}% em relação ao período anterior` : ""}`}>
      <TrendIcon direction={pct > 0 ? "up" : pct < 0 ? "down" : "flat"} />
      {sign}
      {Math.abs(pct)}%
    </span>
  );
}

/** Seta de tendência (linha que sobe, desce ou segue reta), no lugar de ↑ ↓ de texto. */
function TrendIcon({ direction }: { direction: "up" | "down" | "flat" }) {
  const path =
    direction === "up"
      ? "M3 17l6-6 4 4 8-8M15 7h6v6"
      : direction === "down"
        ? "M3 7l6 6 4-4 8 8M15 17h6v-6"
        : "M4 12h16M15 7l5 5-5 5";
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/** Seletor Hoje / 7 dias / 30 dias do topo das páginas de painel. */
export function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (period: PeriodKey) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label="Período">
      {PERIODS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={item.key === value ? "is-on" : undefined}
          aria-pressed={item.key === value}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
