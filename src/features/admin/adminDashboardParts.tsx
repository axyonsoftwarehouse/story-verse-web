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
  const tone = pct > 0 ? " is-up" : pct < 0 ? " is-down" : "";
  const arrow = pct > 0 ? "↑" : pct < 0 ? "↓" : "→";
  return (
    <span className={`admin-delta${tone}`}>
      {arrow} {Math.abs(pct)}%
    </span>
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
