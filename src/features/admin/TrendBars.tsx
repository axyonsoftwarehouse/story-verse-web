/**
 * Barras de tendência do admin, no mesmo desenho das barras da semana do painel "Sua leitura":
 * dourado em escala, o último ponto aceso. Sem biblioteca de gráfico (a CSP não aceita CDN e o
 * bundle agradece).
 */

export type TrendPoint = { key: string; label: string; value: number };

function number(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function TrendBars({
  points,
  unit,
  caption,
}: {
  points: TrendPoint[];
  unit: string;
  caption: string;
}) {
  if (points.length === 0) return <p className="profile-empty">Sem dados no período.</p>;
  const peak = Math.max(...points.map((point) => point.value), 0);
  const max = Math.max(peak, 1);
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const last = points.length - 1;
  // Rótulos só no começo, no meio e no fim: 30 datas lado a lado não cabem.
  const labeled = new Set([0, Math.floor(last / 2), last]);

  return (
    <figure className="admin-trend" aria-label={`${caption}: ${number(total)} ${unit} no total`}>
      <div
        className="admin-trend-plot"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
      >
        {points.map((point, index) => (
          <span
            key={point.key}
            className={`admin-trend-bar${index === last ? " is-last" : ""}`}
            title={`${point.label}: ${number(point.value)} ${unit}`}
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
        Pico de {number(peak)} {unit} · {number(total)} no total
      </figcaption>
    </figure>
  );
}
