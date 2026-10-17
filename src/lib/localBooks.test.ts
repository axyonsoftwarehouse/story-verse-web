import { activateDataOwner } from "./dataOwner";
import { describe, expect, it } from "vitest";
import type { Ebook } from "../data/types";
import { readLibrary, deleteLocalBook, getLocalRecord, listLocalRecords, loadLocalBookText, putLocalRecord, saveLocalBook } from "./localBooks";

async function setOwner(owner: string): Promise<void> { await activateDataOwner(owner); }

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
    await setOwner("userA");
    await saveLocalBook(makeBook(id, "Livro A"), "texto A");
    await setOwner("userB");
    await saveLocalBook(makeBook(id, "Livro B"), "texto B");

    await setOwner("userA");
    expect((await getLocalRecord(id))?.text).toBe("texto A");
    expect(await loadLocalBookText(id)).toBe("texto A");

    await setOwner("userB");
    expect((await getLocalRecord(id))?.text).toBe("texto B");
  });

  it("não deixa uma conta apagar o livro de outra", async () => {
    const id = -777000002;
    await setOwner("userA");
    await saveLocalBook(makeBook(id, "Só da A"), "A");

    await setOwner("userB");
    await deleteLocalBook(id, { everywhere: false });
    expect(await getLocalRecord(id)).toBeUndefined();

    await setOwner("userA");
    expect(await getLocalRecord(id)).toBeDefined();
  });

  it("lista apenas os livros do dono em uso", async () => {
    const idA = -777000003;
    const idB = -777000004;
    await setOwner("userA");
    await saveLocalBook(makeBook(idA, "A1"), "A1");
    await setOwner("userB");
    await saveLocalBook(makeBook(idB, "B1"), "B1");

    await setOwner("userA");
    const ids = (await listLocalRecords()).map((record) => record.id);
    expect(ids).toContain(idA);
    expect(ids).not.toContain(idB);
  });

  it("grava a lista na conta que iniciou o salvamento, mesmo se a conta trocar no meio", async () => {
    const id = -777000005;
    await setOwner("userA");
    const saving = saveLocalBook(makeBook(id, "Durante a troca"), "A");
    // Troca de conta antes de o IndexedDB terminar.
    await setOwner("userB");
    await saving;

    expect(readLibrary("userA")[String(id)]).toBeDefined();
    expect(readLibrary("userB")[String(id)]).toBeUndefined();
  });

  it("adota na primeira conta os registros legados deixados em 'anon'", async () => {
    const id = -777000006;
    await setOwner("anon");
    await putLocalRecord({ id, book: makeBook(id, "Legado"), text: "legado", importedAt: 1, legacy: true }, "anon");
    await setOwner("userA");

    const records = await listLocalRecords();
    expect(records.some((r) => r.id === id)).toBe(true);
    expect(await getLocalRecord(id, "anon")).toBeUndefined();
  });
});
