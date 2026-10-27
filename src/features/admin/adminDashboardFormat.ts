import type { HealthPeriod } from "../../lib/adminHealth";

/** Períodos e formatação comuns da visão geral e da aba Site. */

export type PeriodKey = "today" | "7d" | "30d";

/** `health`: janela do Sentry para o período (o endpoint vai até 14 dias). */
export const PERIODS: {
  key: PeriodKey;
  label: string;
  days: number;
  previous: string;
  health: HealthPeriod;
  healthLabel: string;
}[] = [
  { key: "today", label: "Hoje", days: 1, previous: "ontem", health: "24h", healthLabel: "24 h" },
  {
    key: "7d",
    label: "7 dias",
    days: 7,
    previous: "7 dias anteriores",
    health: "7d",
    healthLabel: "7 dias",
  },
  {
    key: "30d",
    label: "30 dias",
    days: 30,
    previous: "30 dias anteriores",
    health: "14d",
    healthLabel: "14 dias (máximo do Sentry)",
  },
];

export function number(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function percent(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

export function duration(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

export function dayMonth(value: string): string {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}
