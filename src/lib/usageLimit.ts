import { userStorage } from "./dataOwner";

/**
 * Limite diário de mensagens para os personagens. O valor oficial vem do servidor
 * (`/api/v1/ai/quota`); o contador local continua como reserva para resposta instantânea e
 * para o modo sem API.
 */
export const DEFAULT_DAILY_MESSAGE_LIMIT = 50;
const KEY = "storyverse:usage";

type Usage = {
  day: string;
  count: number;
  serverRemaining?: number;
  serverLimit?: number;
};

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function read(): Usage {
  try {
    const u = JSON.parse(userStorage.getItem(KEY) ?? "null") as Usage | null;
    if (u && u.day === today() && typeof u.count === "number") return u;
  } catch {
    // Sem armazenamento: começa do zero.
  }
  return { day: today(), count: 0 };
}

function write(u: Usage) {
  try {
    userStorage.setItem(KEY, JSON.stringify(u));
  } catch {
    // Sem armazenamento: o limite só não é aplicado no aparelho.
  }
}

export function dailyMessageLimit(): number {
  return Math.max(1, read().serverLimit ?? DEFAULT_DAILY_MESSAGE_LIMIT);
}

export function messagesLeftToday(): number {
  const u = read();
  if (typeof u.serverRemaining === "number") {
    return Math.max(0, Math.floor(u.serverRemaining));
  }
  return Math.max(0, dailyMessageLimit() - u.count);
}

/** Atualiza o restante com o valor devolvido pelo servidor (fonte da verdade). */
export function applyServerQuota(remaining: number, limit?: number): void {
  if (!Number.isFinite(remaining)) return;
  const u = read();
  u.serverRemaining = Math.max(0, Math.floor(remaining));
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    u.serverLimit = Math.floor(limit);
  }
  write(u);
}

/** Conta uma resposta recebida da IA (falhas não contam). */
export function countMessage(): number {
  const u = read();
  u.count += 1;
  write(u);
  return messagesLeftToday();
}
