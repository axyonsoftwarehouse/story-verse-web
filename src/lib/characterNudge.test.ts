import { beforeEach, describe, expect, it } from "vitest";
import { CHARACTER_LINES } from "../data/characterLines";
import { featuredBooks } from "../data/ebooks";
import type { Ebook } from "../data/types";
import { dismissNudge, farewellFor, homeNudge, voiceFor } from "./characterNudge";
import type { ReadingProgress } from "./progress";
import { isAmbientMessage } from "./readingAmbient";
import { rememberCharacter } from "./reminders";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 30, 12);
const holmesBook = featuredBooks.find((b) => b.id === "gb-1661")!;
const plainBook: Ebook = { id: "gb-999", gutenbergId: 999, title: "Livro Sem Elenco", author: "Autor", textLanguage: "pt" };

function progress(book: Ebook, daysAgo: number): ReadingProgress {
  return { book, chapterIndex: 2, chapterLabel: "Capítulo 3", chapterCount: 10, scrollRatio: 0.4, updatedAt: NOW - daysAgo * DAY };
}

beforeEach(() => localStorage.clear());

describe("falas dos personagens", () => {
  it("toda fala é de um personagem que existe no livro", () => {
    const known = new Set(featuredBooks.flatMap((b) => (b.characters ?? []).map((c) => `${b.id}:${c.id}`)));
    for (const key of Object.keys(CHARACTER_LINES)) expect(known, key).toContain(key);
  });

  it("todo personagem escrito à mão tem recado e despedida", () => {
    for (const b of featuredBooks)
      for (const c of b.characters ?? []) expect(CHARACTER_LINES[`${b.id}:${c.id}`], `${b.id}:${c.id}`).toBeTruthy();
  });

  it("o recado conta como mensagem automática (não acumula na conversa)", () => {
    expect(isAmbientMessage(CHARACTER_LINES["gb-1661:watson"].nudge)).toBe(true);
  });
});

describe("voiceFor", () => {
  it("prefere quem o leitor conversou por último", () => {
    rememberCharacter(holmesBook.id, "Dr. John Watson");
    expect(voiceFor(holmesBook)).toMatchObject({ id: "watson", name: "Watson" });
  });

  it("sem conversa, fala o primeiro do elenco", () => {
    expect(voiceFor(holmesBook)?.id).toBe("holmes");
  });

  it("livro sem elenco e sem conversa não tem quem fale", () => {
    expect(voiceFor(plainBook)).toBeUndefined();
    rememberCharacter(plainBook.id, "Capitu");
    expect(voiceFor(plainBook)?.name).toBe("Capitu");
  });
});

describe("homeNudge", () => {
  it("só aparece depois de 2 dias sem abrir o livro", () => {
    expect(homeNudge([progress(holmesBook, 1)], NOW)).toBeNull();
    const nudge = homeNudge([progress(holmesBook, 3)], NOW);
    expect(nudge?.character.id).toBe("holmes");
    expect(nudge?.text).toBe(CHARACTER_LINES["gb-1661:holmes"].nudge);
  });

  it("fechar esconde até o leitor abrir o livro de novo", () => {
    const p = progress(holmesBook, 3);
    dismissNudge(p);
    expect(homeNudge([p], NOW)).toBeNull();
    expect(homeNudge([{ ...p, updatedAt: p.updatedAt - DAY }], NOW)).not.toBeNull();
  });

  it("personagem sem fala escrita usa a saudade genérica com o capítulo", () => {
    rememberCharacter(plainBook.id, "Capitu");
    expect(homeNudge([progress(plainBook, 4)], NOW)?.text).toContain("Capítulo 3");
  });
});

describe("farewellFor", () => {
  it("usa a despedida escrita do personagem", () => {
    expect(farewellFor(holmesBook)?.text).toBe(CHARACTER_LINES["gb-1661:holmes"].farewell);
  });

  it("sem fala escrita, agradece citando o livro", () => {
    rememberCharacter(plainBook.id, "Capitu");
    expect(farewellFor(plainBook)?.text).toContain("Livro Sem Elenco");
  });
});
