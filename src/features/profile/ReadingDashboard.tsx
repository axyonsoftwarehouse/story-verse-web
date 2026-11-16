import { userStorage } from "../../lib/dataOwner";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { formatMinutes } from "../../lib/formatMinutes";
import { prefersReducedMotion } from "../../lib/motion";
import {
  readingDays,
  SHIELD_RULES,
  type ReadingDay,
  type ReadingSummary,
  type ReadingTotals,
} from "../../lib/readingStats";
import { savedLabel } from "../../lib/streakLabels";
import { CountUp } from "../../components/CountUp";

/** Nível do dia pela meta: 0 sem leitura, 1 pouco, 2 perto da meta, 3 meta cumprida. */
function dayLevel(minutes: number, goal: number): 0 | 1 | 2 | 3 {
  if (minutes <= 0) return 0;
  if (minutes >= goal) return 3;
  return minutes >= goal / 2 ? 2 : 1;
}

const LEVEL_LABELS = ["Sem leitura", "Pouco", "Perto da meta", "Meta cumprida"] as const;

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function dayTitle(d: ReadingDay, goal?: number): string {
  const date = d.date.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
  if (d.state === "frozen") return `${date}: ${savedLabel(d)}`;
  const met = goal !== undefined && d.minutes >= goal;
  return `${date}: ${d.minutes} min${met ? " · meta cumprida ✓" : ""}`;
}

/**
 * Chama animada da sequência: camadas (vermelho → laranja → amarelo → miolo claro) tremulando em
 * ritmos diferentes, brilho pulsando e faíscas subindo. Apagada (cinza e parada) sem leitura hoje.
 */
function StreakFlame({ lit }: { lit: boolean }) {
  return (
    <span className={`streak-flame-anim ${lit ? "is-lit" : ""}`} aria-hidden="true">
      <span className="flame-glow" />
      <svg viewBox="0 0 64 84">
        <defs>
          <linearGradient id="flame-outer" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#d9481c" />
            <stop offset="1" stopColor="#f07a2a" />
          </linearGradient>
          <linearGradient id="flame-mid" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#f4902c" />
            <stop offset="1" stopColor="#ffc24a" />
          </linearGradient>
          <linearGradient id="flame-core" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ffe08a" />
            <stop offset="1" stopColor="#fff7dc" />
          </linearGradient>
        </defs>
        <path
          className="flame-layer flame-outer"
          fill="url(#flame-outer)"
          d="M32 3c5 13 19 21 19 42 0 19-9 34-19 34S13 64 13 45c0-10 5-17 9-24 1 6 4 10 8 11-2-10-1-19 2-29z"
        />
        <path
          className="flame-layer flame-mid"
          fill="url(#flame-mid)"
          d="M33 24c4 9 12 15 12 29 0 13-6 23-13 23s-13-10-13-23c0-7 3-12 6-16 1 4 3 7 6 7-1-7 0-14 2-20z"
        />
        <path
          className="flame-layer flame-core"
          fill="url(#flame-core)"
          d="M32 46c3 5 7 9 7 17 0 7-3 12-7 12s-7-5-7-12c0-5 3-9 7-17z"
        />
      </svg>
      <span className="flame-spark s1" />
      <span className="flame-spark s2" />
      <span className="flame-spark s3" />
    </span>
  );
}

/** Anel da meta de hoje (medidor: trilho e preenchimento do mesmo tom). */
function GoalRing({ minutes, goal }: { minutes: number; goal: number }) {
  const pct = Math.min(1, goal > 0 ? minutes / goal : 0);
  const r = 52;
  const len = 2 * Math.PI * r;
  const [drawn, setDrawn] = useState(prefersReducedMotion() ? pct : 0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setDrawn(pct));
    return () => cancelAnimationFrame(t);
  }, [pct]);
  const done = minutes >= goal;
  return (
    <div className={`goal-ring ${done ? "is-done" : ""}`} role="img" aria-label={`Meta de hoje: ${minutes} de ${goal} minutos`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="goal-ring-track" cx="60" cy="60" r={r} />
        <circle
          className="goal-ring-fill"
          cx="60"
          cy="60"
          r={r}
          strokeDasharray={len}
          strokeDashoffset={len * (1 - drawn)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="goal-ring-center">
        <strong>
          <CountUp value={minutes} />
        </strong>
        <span>de {goal} min</span>
      </div>
    </div>
  );
}

/**
 * Dia escolhido num gráfico: ao passar o mouse ou tocar, o detalhe aparece no topo do cartão
 * (sem caixinha flutuando por cima das barras). Tocar de novo no mesmo dia solta.
 */
function useDayPick() {
  const [picked, setPicked] = useState<string | null>(null);
  const lastPointer = useRef("mouse");
  const bind = (key: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      lastPointer.current = e.pointerType;
    },
    // Mouse: passar por cima já mostra; clicar só confirma.
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && setPicked(key),
    // Toque: um toque mostra, outro toque no mesmo dia solta.
    onClick: () => (lastPointer.current === "mouse" ? setPicked(key) : setPicked((k) => (k === key ? null : key))),
    // Teclado (Tab): o foco mostra o dia. Foco vindo do toque não conta (senão o toque desfazia).
    onFocus: (e: React.FocusEvent) => e.currentTarget.matches(":focus-visible") && setPicked(key),
  });
  return { picked, bind, clear: () => setPicked(null) };
}

function DayDetail({ day, goal }: { day: ReadingDay; goal: number }) {
  const date = day.date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  return (
    <span className="day-detail" role="status">
      <strong>{date}</strong>
      {day.state === "frozen" ? ` · ${savedLabel(day)} ${day.bought ? "💎" : "🛡️"}` : ` · ${day.minutes} min`}
      {day.state !== "frozen" && day.minutes >= goal ? <span className="day-detail-met"> · meta ✓</span> : null}
    </span>
  );
}

/** Barras dos últimos 7 dias; hoje em destaque e linha tracejada da meta. */
function WeekBars({ days, goal, total }: { days: ReadingDay[]; goal: number; total: string }) {
  const { picked, bind, clear } = useDayPick();
  const pickedDay = days.find((d) => d.key === picked);
  const top = Math.max(...days.map((d) => d.minutes));
  // Folga acima da meta e da maior barra (o número dela fica por cima, dentro do gráfico).
  const max = Math.max(goal * 1.25, top * 1.18, 1);
  const pct = (m: number) => `${(m / max) * 100}%`;
  return (
    <>
      <div className="dash-card-head">
        <span className="dash-label">Últimos 7 dias</span>
        {pickedDay ? <DayDetail day={pickedDay} goal={goal} /> : <span className="dash-sub">{total} no total</span>}
      </div>
      <div className="week-bars-wrap">
        <div className="week-plot" onPointerLeave={(e) => e.pointerType === "mouse" && clear()}>
          <div className="week-goal-line" style={{ bottom: pct(goal) }} aria-hidden="true" />
          {days.map((d, i) => {
            const today = i === days.length - 1;
            const label = today || (d.minutes === top && top > 0);
            return (
              <button
                type="button"
                key={d.key}
                className={`week-bar ${today ? "is-today" : ""} ${d.state === "frozen" ? "is-frozen" : ""} ${picked === d.key ? "is-picked" : ""}`}
                aria-label={dayTitle(d, goal)}
                aria-pressed={picked === d.key}
                {...bind(d.key)}
              >
                <span
                  className={`week-bar-fill ${d.minutes >= goal ? "is-met" : ""}`}
                  style={{ height: d.minutes > 0 ? `max(4px, ${pct(d.minutes)})` : 0, animationDelay: `${i * 60}ms` }}
                >
                  {label && d.minutes > 0 ? <span className="week-bar-value">{d.minutes}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="week-days" aria-hidden="true">
          {days.map((d, i) => (
            <span key={d.key} className={i === days.length - 1 ? "is-today" : picked === d.key ? "is-picked" : ""}>
              {i === days.length - 1 ? "hoje" : WEEKDAY_SHORT[d.date.getDay()]}
            </span>
          ))}
        </div>
        {/* Legenda fora do gráfico: o texto na linha passava por cima das barras. */}
        <div className="week-legend">
          <span className="week-legend-line" aria-hidden="true" />
          meta de {goal} min por dia
        </div>
      </div>
    </>
  );
}

/** Calendário de constância: semanas em colunas, meses em cima e dias da semana ao lado. */
const HEAT_GAP = 4;

const HEAT_LABEL_W = 30;

const HEAT_WEEKDAYS = ["", "seg", "", "qua", "", "sex", ""];

/** Períodos do mapa: por padrão os últimos 3 meses (um ano inteiro fica vazio para quem começou agora). */
const HEAT_PERIODS = [
  { id: "1m", label: "1 mês", weeks: 5 },
  { id: "3m", label: "3 meses", weeks: 13 },
  { id: "1a", label: "1 ano", weeks: 53 },
] as const;

type HeatPeriod = (typeof HEAT_PERIODS)[number]["id"];

const HEAT_PERIOD_KEY = "storyverse:heat-period";

function savedHeatPeriod(): HeatPeriod {
  try {
    const v = userStorage.getItem(HEAT_PERIOD_KEY);
    return HEAT_PERIODS.some((p) => p.id === v) ? (v as HeatPeriod) : "3m";
  } catch {
    return "3m";
  }
}

/** Texto do tooltip de um dia: data por extenso e o que foi lido. */
function heatTooltip(d: ReadingDay, goal: number): { date: string; detail: string } {
  const date = d.date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const detail =
    d.state === "frozen"
      ? d.bought
        ? "Sequência salva com diamantes 💎"
        : "Sequência salva por escudo 🛡️"
      : d.minutes <= 0
        ? "Sem leitura"
        : `${formatMinutes(d.minutes)} lidos • ${d.minutes >= goal ? "Meta atingida" : `meta de ${goal} min`}`;
  return { date: date.charAt(0).toUpperCase() + date.slice(1), detail };
}

function ReadingHeatmap({ days: allDays, goal, streak }: { days: ReadingDay[]; goal: number; streak: number }) {
  const { picked, bind, clear } = useDayPick();
  const [period, setPeriod] = useState<HeatPeriod>(savedHeatPeriod);
  const weeks = HEAT_PERIODS.find((p) => p.id === period)!.weeks;

  // Quadrados do tamanho que couber (entre 10 e 28 px); o ano inteiro rola de lado no celular.
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(14);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const free = el.clientWidth - HEAT_LABEL_W - HEAT_GAP * (weeks - 1);
      setCell(Math.max(10, Math.min(28, Math.floor(free / weeks))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks]);
  // Começa mostrando o mais recente (hoje fica à direita).
  useEffect(() => {
    const sc = scrollRef.current;
    if (sc) sc.scrollLeft = sc.scrollWidth;
  }, [weeks, cell]);

  // Colunas = semanas começando no domingo; a última termina hoje.
  const today = allDays[allDays.length - 1];
  const days = allDays.slice(-((weeks - 1) * 7 + today.date.getDay() + 1));
  const readCount = days.filter((d) => d.minutes > 0).length;
  const metCount = days.filter((d) => d.minutes >= goal).length;
  const hasSaved = days.some((d) => d.state === "frozen");
  const step = cell + HEAT_GAP;

  // Nome do mês em cima da primeira semana em que ele aparece.
  const months: { col: number; label: string }[] = [];
  for (let col = 0; col * 7 < days.length; col++) {
    const first = days[col * 7].date;
    const prev = col > 0 ? days[(col - 1) * 7].date : null;
    if (!prev || prev.getMonth() !== first.getMonth()) {
      // Mês que começou no meio da primeira coluna: o nome vai na seguinte (não fica cortado).
      if (col === 0 && first.getDate() > 7) continue;
      months.push({ col, label: first.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") });
    }
  }

  // Tooltip flutuante em cima do dia escolhido (embaixo, se não couber em cima).
  const [tip, setTip] = useState<{ left: number; top: number; below: boolean; edge: "" | "is-left" | "is-right" } | null>(null);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const btn = picked ? wrap?.querySelector<HTMLElement>(`[data-day="${picked}"]`) : null;
    if (!wrap || !btn) return setTip(null);
    const w = wrap.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const below = b.top - w.top < 56;
    const left = b.left - w.left + b.width / 2;
    // Perto das bordas o tooltip se alinha pelo lado do dia (não sai do card).
    const edge = left < 110 ? "is-left" : left > w.width - 110 ? "is-right" : "";
    setTip({ left, top: below ? b.bottom - w.top + 8 : b.top - w.top - 8, below, edge });
  }, [picked, cell, weeks]);
  const pickedDay = days.find((d) => d.key === picked);
  const tipText = pickedDay ? heatTooltip(pickedDay, goal) : null;

  return (
    <>
      <div className="dash-card-head heat-head">
        <span className="dash-label">Constância</span>
        <div className="segmented heat-periods" role="tablist" aria-label="Período">
          {HEAT_PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={period === p.id}
              className={period === p.id ? "is-on" : ""}
              onClick={() => {
                clear();
                setPeriod(p.id);
                try {
                  userStorage.setItem(HEAT_PERIOD_KEY, p.id);
                } catch {
                  // Sem armazenamento: vale só nesta visita.
                }
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <dl className="heat-stats">
        <div>
          <dt>
            <span aria-hidden="true">🔥</span> Ofensiva<span className="heat-stat-more"> atual</span>
          </dt>
          <dd>
            {streak} {streak === 1 ? "dia" : "dias"}
          </dd>
        </div>
        <div>
          <dt>
            <span aria-hidden="true">📚</span> Dias lidos
          </dt>
          <dd>{readCount}</dd>
        </div>
        <div>
          <dt>
            <span aria-hidden="true">🎯</span> Metas<span className="heat-stat-more"> cumpridas</span>
          </dt>
          <dd>{metCount}</dd>
        </div>
      </dl>

      <div
        className="heatmap-wrap"
        ref={wrapRef}
        style={{ "--cell": `${cell}px` } as React.CSSProperties}
        onPointerLeave={(e) => e.pointerType === "mouse" && clear()}
      >
        <div className="heat-scroll" ref={scrollRef} onScroll={clear}>
          <div className="heat-grid">
            <div className="heat-months" aria-hidden="true" style={{ marginLeft: HEAT_LABEL_W }}>
              {months.map((m) => (
                <span key={m.col} style={{ left: m.col * step }}>
                  {m.label}
                </span>
              ))}
            </div>
            <div className="heat-body">
              <div className="heat-weekdays" aria-hidden="true">
                {HEAT_WEEKDAYS.map((w, i) => (
                  <span key={i}>{w}</span>
                ))}
              </div>
              <div className="heatmap">
                {days.map((d, i) => (
                  <button
                    type="button"
                    key={d.key}
                    data-day={d.key}
                    className={`heat-cell lv-${d.state === "frozen" ? "frozen" : dayLevel(d.minutes, goal)} ${
                      d.key === today.key ? "is-today" : ""
                    } ${picked === d.key ? "is-picked" : ""}`}
                    style={{ animationDelay: `${Math.floor(i / 7) * 18}ms` }}
                    aria-label={dayTitle(d, goal)}
                    aria-pressed={picked === d.key}
                    tabIndex={-1}
                    {...bind(d.key)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        {tip && tipText ? (
          <div
            className={`heat-tooltip ${tip.below ? "is-below" : ""} ${tip.edge}`}
            style={{ left: tip.left, top: tip.top }}
            role="status"
          >
            <strong>{tipText.date}</strong>
            <span>{tipText.detail}</span>
          </div>
        ) : null}
      </div>

      <div className="heatmap-foot" aria-hidden="true">
        <span className="heat-legend">
          Sem leitura
          {([0, 1, 2, 3] as const).map((lv) => (
            <i key={lv} className={`heat-cell lv-${lv}`} title={LEVEL_LABELS[lv]} />
          ))}
          Meta cumprida
        </span>
        {hasSaved ? (
          <span className="heat-legend">
            <i className="heat-cell lv-frozen" /> Sequência salva
          </span>
        ) : null}
      </div>
      {/* Mesmo dado em tabela, para leitores de tela. */}
      <table className="sr-only">
        <caption>Minutos lidos por dia</caption>
        <tbody>
          {days
            .filter((d) => d.minutes > 0 || d.state === "frozen")
            .map((d) => (
              <tr key={d.key}>
                <th>{d.date.toLocaleDateString("pt-BR")}</th>
                <td>{d.state === "frozen" ? savedLabel(d) : `${d.minutes} min`}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </>
  );
}

/** Painel "Sua leitura" do perfil: meta de hoje, sequência, semana, constância e totais. */
export function ReadingDashboard({
  summary,
  totals,
  finishedCount,
  markCount,
}: {
  summary: ReadingSummary;
  totals: ReadingTotals;
  finishedCount: number;
  markCount: number;
}) {
  const week = useMemo(() => readingDays(7), []);
  const history = useMemo(() => readingDays(53 * 7), []);
  const tiles = [
    { label: "Tempo lendo", value: totals.totalMinutes, format: formatMinutes },
    { label: "Nesta semana", value: totals.weekMinutes, format: formatMinutes },
    { label: "Livros terminados", value: finishedCount },
    { label: "Trechos marcados", value: markCount },
  ];
  return (
    <section className="dashboard" aria-label="Sua leitura">
      <div className="dash-card dash-goal">
        <span className="dash-label">Meta de hoje</span>
        <GoalRing minutes={summary.todayMinutes} goal={summary.goalMinutes} />
        {summary.todayMinutes >= summary.goalMinutes ? (
          <span className="goal-caption is-done">
            <span className="goal-ring-check">{Icon.check}</span>
            Meta cumprida!
          </span>
        ) : (
          <span className="goal-caption">
            faltam {summary.goalMinutes - summary.todayMinutes} min
          </span>
        )}
      </div>

      <div className={`dash-card dash-streak ${summary.readToday ? "is-lit" : ""}`}>
        <StreakFlame lit={summary.readToday} />
        <div className="dash-streak-info">
          <span className="dash-label">Sequência</span>
          <strong className="dash-hero">
            <CountUp value={summary.streak} />
            <small>{summary.streak === 1 ? "dia" : "dias"}</small>
          </strong>
          <span className="dash-sub">
            {summary.readToday
              ? "Você já leu hoje. O fogo está aceso!"
              : summary.streak > 0
                ? "Leia hoje para não apagar o fogo."
                : "Leia um pouco hoje para acender o fogo."}
          </span>
          <span className="dash-record">🏆 Recorde: {totals.bestStreak} {totals.bestStreak === 1 ? "dia" : "dias"}</span>
          {(() => {
            const { daysPerShield, maxShields } = SHIELD_RULES;
            if (summary.shields >= maxShields) {
              return <span className="dash-shield">🛡️ {summary.shields} escudos protegendo a sequência</span>;
            }
            const into = summary.streak % daysPerShield;
            return (
              <div className="dash-shield-progress" title="A cada 7 dias seguidos você ganha um escudo, que salva a sequência se um dia passar sem leitura.">
                <span>
                  🛡️ {summary.shields > 0 ? `${summary.shields} ${summary.shields === 1 ? "escudo" : "escudos"} · ` : ""}
                  faltam {daysPerShield - into} {daysPerShield - into === 1 ? "dia" : "dias"} para o próximo
                </span>
                <span className="dash-shield-bar">
                  <span style={{ width: `${(into / daysPerShield) * 100}%` }} />
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="dash-card dash-week">
        <WeekBars days={week} goal={summary.goalMinutes} total={formatMinutes(totals.weekMinutes)} />
      </div>

      <div className="dash-card dash-heat">
        <ReadingHeatmap days={history} goal={summary.goalMinutes} streak={summary.streak} />
      </div>

      <div className="dash-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="dash-card dash-tile">
            <strong>
              <CountUp value={t.value} format={t.format} />
            </strong>
            <span>{t.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
