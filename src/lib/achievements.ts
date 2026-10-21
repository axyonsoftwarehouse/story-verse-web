/**
 * Conquistas do perfil: marcos de leitura, conversa e comunidade. Tudo calculado com os dados
 * que a conta já tem (nada novo no servidor). As que faltam mostram quanto falta.
 */

export type AchievementInput = {
  totalMinutes: number;
  bestStreak: number;
  finishedBooks: number;
  marks: number;
  /** Mensagens que o leitor mandou para personagens, somando todos os livros. */
  messagesSent: number;
  /** Personagens diferentes com quem conversou. */
  charactersTalked: number;
  /** Presentes recebidos de outros leitores (`null`: ainda não carregou ou sem presentes). */
  giftsReceived: number | null;
};

export type Achievement = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  current: number;
  target: number;
  unlocked: boolean;
  /** "faltam 3 dias", em português, para as que ainda não vieram. */
  missing: string;
};

type Rule = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  value: (i: AchievementInput) => number | null;
  target: number;
  unit: [string, string];
};

const RULES: Rule[] = [
  { id: "first-page", emoji: "📖", title: "Primeira página", description: "Leu pela primeira vez no Storyverse", value: (i) => i.totalMinutes, target: 1, unit: ["minuto", "minutos"] },
  { id: "first-chat", emoji: "💬", title: "Puxou conversa", description: "Mandou a primeira mensagem para um personagem", value: (i) => i.messagesSent, target: 1, unit: ["mensagem", "mensagens"] },
  { id: "streak-7", emoji: "🔥", title: "Uma semana acesa", description: "Leu 7 dias seguidos", value: (i) => i.bestStreak, target: 7, unit: ["dia", "dias"] },
  { id: "first-finish", emoji: "🏁", title: "Fim!", description: "Terminou o primeiro livro", value: (i) => i.finishedBooks, target: 1, unit: ["livro", "livros"] },
  { id: "marks-10", emoji: "🖍️", title: "Marca-texto", description: "Guardou 10 trechos marcados", value: (i) => i.marks, target: 10, unit: ["trecho", "trechos"] },
  { id: "cast-5", emoji: "🎭", title: "Elenco completo", description: "Conversou com 5 personagens diferentes", value: (i) => i.charactersTalked, target: 5, unit: ["personagem", "personagens"] },
  { id: "hours-10", emoji: "⏳", title: "Dez horas de história", description: "Somou 10 horas de leitura", value: (i) => i.totalMinutes, target: 600, unit: ["minuto", "minutos"] },
  { id: "gift", emoji: "🎁", title: "Querido pela comunidade", description: "Recebeu um presente de outro leitor", value: (i) => i.giftsReceived, target: 1, unit: ["presente", "presentes"] },
  { id: "chat-100", emoji: "🗣️", title: "Confidente", description: "Trocou 100 mensagens com personagens", value: (i) => i.messagesSent, target: 100, unit: ["mensagem", "mensagens"] },
  { id: "finish-5", emoji: "📚", title: "Estante cheia", description: "Terminou 5 livros", value: (i) => i.finishedBooks, target: 5, unit: ["livro", "livros"] },
  { id: "streak-30", emoji: "🌋", title: "Um mês de fogo", description: "Leu 30 dias seguidos", value: (i) => i.bestStreak, target: 30, unit: ["dia", "dias"] },
];

function missingText(left: number, [one, many]: [string, string]): string {
  // Horas leem melhor que "faltam 540 minutos".
  if (many === "minutos" && left >= 120) {
    const hours = Math.ceil(left / 60);
    return `faltam ${hours} horas`;
  }
  return left === 1 ? `falta 1 ${one}` : `faltam ${left} ${many}`;
}

export function achievements(input: AchievementInput): Achievement[] {
  return RULES.map((r) => {
    const raw = r.value(input) ?? 0;
    const current = Math.max(0, Math.floor(raw));
    const unlocked = current >= r.target;
    return {
      id: r.id,
      emoji: r.emoji,
      title: r.title,
      description: r.description,
      current: Math.min(current, r.target),
      target: r.target,
      unlocked,
      missing: unlocked ? "" : missingText(r.target - current, r.unit),
    };
  });
}

const SEEN_KEY = "storyverse:achievements-seen";

/**
 * Conquistas que acabaram de sair (para o aviso na hora). Na primeira vez guarda as que a pessoa
 * já tem sem avisar nada: quem já usava o app não recebe uma enxurrada de avisos de uma vez.
 */
export function takeNewAchievements(list: Achievement[], storage: Pick<Storage, "getItem" | "setItem">): Achievement[] {
  const unlocked = list.filter((a) => a.unlocked);
  let seen: string[] | null = null;
  try {
    const raw = storage.getItem(SEEN_KEY);
    seen = raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    seen = null;
  }
  const fresh = seen ? unlocked.filter((a) => !seen!.includes(a.id)) : [];
  if (!seen || fresh.length > 0) {
    try {
      storage.setItem(SEEN_KEY, JSON.stringify([...new Set([...(seen ?? []), ...unlocked.map((a) => a.id)])]));
    } catch {
      // Sem armazenamento: o aviso pode repetir na próxima visita.
    }
  }
  return fresh;
}
