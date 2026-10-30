import { CHARACTER_LINES } from "../data/characterLines";

const MISS_YOU = [
  (ch: string) => `Você sumiu… fiquei pensando no que aconteceu em “${ch}”. Vamos continuar de onde paramos?`,
  (ch: string) => `Que bom que você voltou! Paramos em “${ch}” — ainda tem muita coisa pela frente.`,
  (ch: string) => `Estava te esperando. A história ficou parada em “${ch}”… e eu também.`,
  (ch: string) => `Achei que tinha me esquecido! Voltamos para “${ch}”?`,
];

/**
 * Personagem com saudade, quando o leitor volta ao livro depois de alguns dias (frases prontas:
 * não gastam IA). `days` escolhe a frase, para variar entre as voltas.
 */
export function missYouMessage(chapterLabel: string, days: number): string {
  return MISS_YOU[days % MISS_YOU.length](chapterLabel);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CHAPTER = "\u0000";

/** As frases de saudade, com qualquer capítulo no lugar do nome. */
const MISS_YOU_PATTERNS = MISS_YOU.map(
  (line) => new RegExp(`^${escapeRegExp(line(CHAPTER)).replace(CHAPTER, ".*")}$`),
);

/**
 * Mensagens que o personagem mandava sozinho até 20/10/2026, a cada capítulo e no meio dele.
 * Não são mais geradas, mas continuavam no histórico guardado e enchiam a conversa.
 */
const RETIRED_PATTERNS = [
  /^Começamos “.*”\. Leia com calma, estou aqui se quiser conversar\.$/,
  /^Você já passou da metade deste capítulo\. Alguma coisa te chamou a atenção até aqui\?$/,
];

/** Recados de saudade escritos à mão para cada personagem (ver characterNudge.ts). */
const NUDGE_LINES = new Set(Object.values(CHARACTER_LINES).map((l) => l.nudge));

/** Mensagem automática do personagem (não é resposta a nada que o leitor disse). */
export function isAmbientMessage(text: string): boolean {
  return NUDGE_LINES.has(text) || [...MISS_YOU_PATTERNS, ...RETIRED_PATTERNS].some((re) => re.test(text));
}

/**
 * Limpa a conversa guardada: tira as mensagens automáticas antigas (capítulo/meio do capítulo) e,
 * de várias saudades seguidas sem o leitor responder, deixa só a última.
 */
export function tidyAmbientMessages<T extends { role: string; text: string }>(msgs: T[]): T[] {
  const kept = msgs.filter((m) => !(m.role === "assistant" && RETIRED_PATTERNS.some((re) => re.test(m.text))));
  return kept.filter(
    (m, i) => !(m.role === "assistant" && isAmbientMessage(m.text) && kept[i + 1]?.role === "assistant" && isAmbientMessage(kept[i + 1].text)),
  );
}
