import { useEffect, useState } from "react";
import { apiEnabled, apiRequest } from "./backend";

/**
 * Quantas pessoas leram cada livro (`GET /api/v1/catalog/readers`). O servidor só devolve o total
 * por livro, nunca quem leu. Os cards de uma tela pedem juntos: os pedidos feitos no mesmo
 * instante viram uma chamada só (até 60 livros), e o resultado fica guardado por 5 minutos.
 */

const MAX_KEYS = 60;
const TTL_MS = 5 * 60_000;
/** Só livros que existem para todo mundo; importados (`local:`) não têm contador. */
const SHARED_KEY = /^(gb:\d{1,12}|cm:[0-9a-fA-F-]{36}|cat:[0-9a-fA-F-]{36})$/;

const cache = new Map<string, { count: number; at: number }>();
let queue = new Map<string, ((count: number) => void)[]>();
let scheduled = false;

async function flush() {
  scheduled = false;
  const batch = queue;
  queue = new Map();
  const keys = [...batch.keys()];
  for (let i = 0; i < keys.length; i += MAX_KEYS) {
    const chunk = keys.slice(i, i + MAX_KEYS);
    let counts: Record<string, number> = {};
    try {
      counts = await apiRequest<Record<string, number>>(
        `/api/v1/catalog/readers?keys=${encodeURIComponent(chunk.join(","))}`,
      );
    } catch {
      // Contador é enfeite: servidor antigo (sem a rota) ou sem rede, o card só fica sem o número.
    }
    const at = Date.now();
    for (const key of chunk) {
      const count = Number(counts[key]) || 0;
      cache.set(key, { count, at });
      for (const resolve of batch.get(key) ?? []) resolve(count);
    }
  }
}

/** Total de leitores do livro; 0 quando ninguém leu, o livro é pessoal ou a API não responde. */
export function fetchReaderCount(bookKey: string | null | undefined): Promise<number> {
  if (!apiEnabled || !bookKey || !SHARED_KEY.test(bookKey)) return Promise.resolve(0);
  const hit = cache.get(bookKey);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.count);
  return new Promise((resolve) => {
    queue.set(bookKey, [...(queue.get(bookKey) ?? []), resolve]);
    if (!scheduled) {
      scheduled = true;
      setTimeout(() => void flush(), 30);
    }
  });
}

export function useReaderCount(bookKey: string | null | undefined): number {
  const [count, setCount] = useState(() => {
    const hit = bookKey ? cache.get(bookKey) : undefined;
    return hit ? hit.count : 0;
  });
  useEffect(() => {
    let alive = true;
    void fetchReaderCount(bookKey).then((value) => {
      if (alive) setCount(value);
    });
    return () => {
      alive = false;
    };
  }, [bookKey]);
  return count;
}

const COMPACT = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** 1 → "1 pessoa leu"; 12 → "12 pessoas leram"; 1.240 → "1,2 mil pessoas leram". */
export function readersLabel(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n === 1) return "1 pessoa leu";
  return `${n < 1000 ? String(n) : COMPACT.format(n).replace(/\s/g, " ")} pessoas leram`;
}

/** Só para os testes: zera o que ficou guardado entre um caso e outro. */
export function resetReaderCounts(): void {
  cache.clear();
  queue = new Map();
  scheduled = false;
}
