import { describe, expect, it } from "vitest";
import type { Ebook } from "../data/types";
import { deleteLocalBook, getLocalRecord, listLocalRecords, loadLocalBookText, saveLocalBook } from "./localBooks";

const OWNER_KEY = "storyverse:data-owner";

function setOwner(owner: string): void {
  localStorage.setItem(OWNER_KEY, owner);
}

function makeBook(gutenbergId: number, title: string): Ebook {
  return {
    id: `local-${gutenbergId}`,
    gutenbergId,
    title,
    author: "Autor de teste",
    textLanguage: "pt",
    source: "local",
  };
}

describe("localBooks — isolamento por conta", () => {
  it("mantém o mesmo livro separado por dono, sem vazamento de texto", async () => {
    const id = -777000001;
    setOwner("userA");
    await saveLocalBook(makeBook(id, "Livro A"), "texto A");
    setOwner("userB");
    await saveLocalBook(makeBook(id, "Livro B"), "texto B");

    setOwner("userA");
    expect((await getLocalRecord(id))?.text).toBe("texto A");
    expect(await loadLocalBookText(id)).toBe("texto A");

    setOwner("userB");
    expect((await getLocalRecord(id))?.text).toBe("texto B");
  });

  it("não deixa uma conta apagar o livro de outra", async () => {
    const id = -777000002;
    setOwner("userA");
    await saveLocalBook(makeBook(id, "Só da A"), "A");

    setOwner("userB");
    await deleteLocalBook(id, { everywhere: false });
    expect(await getLocalRecord(id)).toBeUndefined();

    setOwner("userA");
    expect(await getLocalRecord(id)).toBeDefined();
  });

  it("lista apenas os livros do dono em uso", async () => {
    const idA = -777000003;
    const idB = -777000004;
    setOwner("userA");
    await saveLocalBook(makeBook(idA, "A1"), "A1");
    setOwner("userB");
    await saveLocalBook(makeBook(idB, "B1"), "B1");

    setOwner("userA");
    const ids = (await listLocalRecords()).map((record) => record.id);
    expect(ids).toContain(idA);
    expect(ids).not.toContain(idB);
  });
});
