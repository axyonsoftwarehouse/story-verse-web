/** Dia sem leitura que manteve a sequência: por escudo (grátis) ou com diamantes. */
export function savedLabel(d: { bought: boolean }): string {
  return d.bought ? "salvo com diamantes" : "salvo por escudo";
}
