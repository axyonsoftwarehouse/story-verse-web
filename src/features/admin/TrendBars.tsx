/**
 * Barras de tendência do admin, no mesmo desenho das barras da semana do painel "Sua leitura":
 * dourado em escala, o último ponto aceso. Sem biblioteca de gráfico (a CSP não aceita CDN e o
 * bundle agradece).
 */

/** `estimated`: valor reconstruído (ex.: MRR sem snapshot do dia), desenhado tracejado. */
export type TrendPoint = { key: string; label: string; value: number; estimated?: boolean };

function number(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function TrendBars({
  points,
  unit,
  caption,
  format = number,
  summary = "total",
}: {
  points: TrendPoint[];
  unit: string;
  caption: string;
  /** Formata os valores (ex.: centavos em reais); a unidade some quando o formato já diz tudo. */
  format?: (value: number) => string;
  /** "total" soma o período (minutos, livros); "last" mostra o último valor (MRR, assinaturas). */
  summary?: "total" | "last";
}) {
  if (points.length === 0) return <p className="profile-empty">Sem dados no período.</p>;
  const peak = Math.max(...points.map((point) => point.value), 0);
  const max = Math.max(peak, 1);
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const last = points.length - 1;
  const estimated = points.some((point) => point.estimated);
  const shown = (value: number) => (unit ? `${format(value)} ${unit}` : format(value));
  const closing =
    summary === "last" ? `atual: ${shown(points[last].value)}` : `${format(total)} no total`;
  // Rótulos só no começo, no meio e no fim: 30 datas lado a lado não cabem.
  const labeled = new Set([0, Math.floor(last / 2), last]);

  return (
    <figure className="admin-trend" aria-label={`${caption}: ${closing}`}>
      <div
        className="admin-trend-plot"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
      >
        {points.map((point, index) => (
          <span
            key={point.key}
            className={`admin-trend-bar${index === last ? " is-last" : ""}${point.estimated ? " is-estimated" : ""}`}
            title={`${point.label}: ${shown(point.value)}${point.estimated ? " (estimado)" : ""}`}
          >
            <span
              className="admin-trend-fill"
              style={{ height: `${point.value ? Math.max((point.value / max) * 100, 3) : 0}%` }}
            />
          </span>
        ))}
      </div>
      <div className="admin-trend-axis" aria-hidden="true">
        {points.map((point, index) => (
          <span key={point.key}>{labeled.has(index) ? point.label : ""}</span>
        ))}
      </div>
      <figcaption className="dash-sub">
        Pico de {shown(peak)} · {closing}
        {estimated ? " · barras tracejadas são estimadas" : ""}
      </figcaption>
    </figure>
  );
}
