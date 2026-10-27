import { useEffect, useState } from "react";
import type { SupabaseSession } from "../../lib/auth";
import { getActiveUsers, type AdminActive } from "../../lib/adminActive";
import { TrendBars } from "./TrendBars";
import { rangeEnding } from "./dashboardMath";

/** DAU/WAU/MAU sempre terminam hoje, então o card não segue o seletor de período. */
const SERIES_DAYS = 30;

function number(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function dayMonth(value: string): string {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

/** Pessoas com request autenticado: hoje, nos últimos 7 e nos últimos 30 dias, e a série diária. */
export function ActiveUsersCard({ session, today }: { session: SupabaseSession; today: string }) {
  const [data, setData] = useState<AdminActive | "error" | null>(null);

  useEffect(() => {
    let alive = true;
    getActiveUsers(session, rangeEnding(today, SERIES_DAYS))
      .then((result) => {
        if (alive) setData(result);
      })
      .catch(() => {
        if (alive) setData("error");
      });
    return () => {
      alive = false;
    };
  }, [session, today]);

  return (
    <article className="dash-card">
      <div className="dash-card-head">
        <span className="dash-label">Usuários ativos</span>
        <span className="dash-sub">request autenticado no dia · {SERIES_DAYS} dias</span>
      </div>
      {data === null ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando usuários ativos…
        </div>
      ) : data === "error" ? (
        <p className="dash-sub">
          Usuários ativos indisponíveis · não foi possível consultar a API agora.
        </p>
      ) : (
        <>
          <div className="admin-mini-tiles">
            <div className="dash-tile">
              <strong>{number(data.dau)}</strong>
              <span>hoje (DAU)</span>
            </div>
            <div className="dash-tile">
              <strong>{number(data.wau)}</strong>
              <span>últimos 7 dias (WAU)</span>
            </div>
            <div className="dash-tile">
              <strong>{number(data.mau)}</strong>
              <span>últimos 30 dias (MAU)</span>
            </div>
          </div>
          <TrendBars
            caption="Pessoas ativas por dia"
            unit="pessoas"
            summary="last"
            points={data.series.map((point) => ({
              key: point.day,
              label: dayMonth(point.day),
              value: point.active,
            }))}
          />
        </>
      )}
    </article>
  );
}
