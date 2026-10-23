# Estante (biblioteca pessoal) — Web, Fase 1 — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a quem tem a capability `library` uma estante pessoal no app: entrada automática ao abrir/terminar, nota, resenha, abandono, tela "Minha estante" e sincronização local-first com a API `/api/v1/me/library`.

**Architecture:** Três módulos novos em `src/lib`: `library.ts` (tipos, chave do livro e cliente HTTP), `libraryStore.ts` (cópia local por conta, com campos pendentes por entrada) e `librarySync.ts` (empurra pendências, puxa mudanças por `updatedSince`, resolve 409 com as regras de `libraryMerge.ts`). As telas ficam em `src/features/library/` e entram no `App.tsx` só por props, no mesmo estilo de `RankingPage`. Tudo fica desligado para quem não tem a capability (lida com `useAccountFeatures`).

**Tech Stack:** React 19, TypeScript 5.6, Vite 8, Vitest 5 + jsdom + @testing-library/react.

**Spec:** `docs/SPEC_BIBLIOTECA_PESSOAL.md` (seções 5.1, 6, 9, 10, 12, 18). API pronta: story-verse-api `README.md` (seção "Estante") e `docs/superpowers/plans/2026-10-22-estante-api-fase-1.md` (decisões 1–10).

## Global Constraints

- Nenhuma chamada a `/api/v1/me/library` e nenhuma UI da estante sem `hasFeature(capabilities, "library")`.
- Chave do livro: `gb:<n>` (`Ebook.id` `gb-<n>`), `cm:<uuid>` (`cm-<uuid>`), `local:<gutenbergId>` (importado, `source === "local"`, id negativo).
- Status: `want_to_read`, `reading`, `finished`, `abandoned`. Nota 0,5–5, passo 0,5. Resenha até 4.000 caracteres; nota do abandono até 500. Motivos: `slow` ("Ritmo lento"), `not_for_me` ("Não era para mim"), `difficult` ("Difícil"), `other` ("Outro").
- "Hoje" e datas `yyyy-MM-dd` no fuso `America/Sao_Paulo`.
- Chaves locais (por conta, via `userStorage`/`storageForOwner`): `storyverse:shelf-entries`, `storyverse:shelf-sync`, `storyverse:shelf-migrated`, `storyverse:shelf-finish-prompted`. Prefixo `shelf` (não `library`: `storyverse:library` e `LibraryEntry` já são de `localBooks.ts`).
- Não alterar `reading-progress`, `finished-books`, `highlights` (a estante só lê delas).
- Status automático não abre nada ao abrir o livro; o modal de conclusão aparece uma vez por livro e pode ser dispensado ("Agora não").
- Sem diamantes novos. Nunca enviar dados de outros livros ao chat.
- Acessibilidade: estrelas com `aria-label` ("Nota 4,5 de 5"), foco visível, teclado (setas mudam meia estrela).

## Decisões deste plano (lacunas da spec e do código)

1. **Não existe "página do livro"** (abrir um livro vai direto ao leitor). O hub da spec 6.3 vira o painel `BookStatusControl`, aberto pelo botão "Na estante" do leitor e pelos cards da tela "Minha estante".
2. **A estante fica fora do `cloudSync`**: as chaves `storyverse:shelf-*` entram em `USER_KEYS` (para serem por conta) e são excluídas do snapshot do `reading_state`. Quem sincroniza é só o `librarySync`.
3. **Pendências por campo, não fila de operações.** Cada entrada local guarda `pending` (campos alterados e quando) e `pendingDelete`. Criar = `PUT`; mudar = `PATCH` só com os campos pendentes; remover = `DELETE`. Concluir e abandonar também viram `PATCH` (a API normaliza do mesmo jeito), então o cliente não usa `/finish` nem `/abandon`.
4. **Erros HTTP com corpo**: `apiRequest` passa a lançar `ApiHttpError` (subclasse de `Error`, mesma mensagem de antes) com `status`, `code` e `body`. Quem já trata `Error` não muda; o sync lê `body.current` no 409.
5. **Status automático é marcado como `auto`.** Abrir ou ler gera `status: reading` com `auto: true`; o merge nunca troca `finished`/`abandoned` do servidor por um `reading` automático (spec 6.4 e 9.3).
6. **Sobreposição no sync** (decisão da revisão da API): o marco de `updatedSince` é o maior `updatedAt` da primeira página menos 5 segundos, em ISO (`toISOString()`); entradas repetidas são ignoradas pela `version`.
7. **Teste manual só depois do deploy**: o CORS da API aceita só o site da VPS, então o dev local não fala com a API de produção. A verificação de cada task é a suíte (`npm test`, `tsc`, `lint`); o fluxo real é conferido no site depois do deploy, com `library` concedida à conta do Werner.
8. **Conquistas da estante só aparecem com a capability**, para não mudar a contagem "todas as conquistas" de quem não tem a estante.

## Review Focus

- **Sem internet:** abrir, dar nota e abandonar offline ficam salvos e sobem depois; falha de rede nunca apaga pendência → teste na Task 4.
- **Dois aparelhos:** livro `finished` no servidor e um `reading` automático (só abriu o livro no outro aparelho) → continua `finished` → teste na Task 3.
- **Troca de conta no mesmo navegador:** a estante de A não aparece nem é enviada como de B → teste na Task 2.
- **Conta sem `library`:** nenhuma requisição a `/me/library`, nada na tela → testes nas Tasks 2 e 8.
- **Importado removido do aparelho:** a entrada continua, com "possui arquivo" falso e aviso "arquivo removido" → teste na Task 7.

## Como rodar

```bash
npx vitest run src/lib/library.test.ts
npm test
npx tsc --noEmit -p tsconfig.json
npm run lint
```

Branch: `feat/estante-web` a partir da `main`. Um commit por task.

---

### Task 1: Chave do livro, tipos e cliente da API

**Files:**
- Modify: `src/lib/backend.ts` (classe `ApiHttpError`)
- Create: `src/lib/library.ts`
- Test: `src/lib/library.test.ts`

**Interfaces:**
- Produces em `backend.ts`: `export class ApiHttpError extends Error { readonly status: number; readonly code?: string; readonly body: Record<string, unknown> }`, lançada por `apiRequest` nos `!response.ok` que hoje lançam `Error` (exceto 401/429/5xx, que mantêm `AuthSessionError`/`AuthNetworkError`).
- Produces em `library.ts`:
  - `type ShelfStatus = "want_to_read" | "reading" | "finished" | "abandoned"`; `type DnfReason = "slow" | "not_for_me" | "difficult" | "other"`.
  - `type ShelfEntry` com os campos da API (`bookKey, source, status, rating, review, startedOn, finishedOn, dnfReason, dnfNote, progressPercent, progressLabel, title, author, coverUrl, series, seriesIndex, genre, language, updatedAt, version, deletedAt`), números como `number | null`, datas como `string | null`.
  - `bookKeyOf(book: Ebook): string | null` e `shelfSourceOf(book: Ebook): "gutenberg" | "community" | "local"`.
  - `todayInBrazil(now?: Date): string` (`yyyy-MM-dd`, `America/Sao_Paulo`).
  - Cliente: `fetchShelfPage(session, params: { updatedSince?: string; cursor?: string; limit?: number }): Promise<{ items: ShelfEntry[]; nextCursor: string | null }>`, `putShelfEntry(session, bookKey, body): Promise<ShelfEntry>`, `patchShelfEntry(session, bookKey, body): Promise<ShelfEntry>`, `deleteShelfEntry(session, bookKey): Promise<void>`, `fetchShelfStats(session, year?: number): Promise<ShelfStats>`.
  - `class ShelfConflictError extends Error { readonly current: ShelfEntry | null }`, lançada pelo `put`/`patch` quando `ApiHttpError.status === 409`.

- [ ] **Step 1: Escrever os testes**

```ts
it("chave do livro para as três origens", () => {
  expect(bookKeyOf({ id: "gb-1342", gutenbergId: 1342, source: "gutenberg" } as Ebook)).toBe("gb:1342");
  expect(bookKeyOf({ id: "cm-0f8fad5b-d9cb-469f-a165-70867728950e", source: "community" } as Ebook)).toBe("cm:0f8fad5b-d9cb-469f-a165-70867728950e");
  expect(bookKeyOf({ id: "x", gutenbergId: -1729630000000123, source: "local" } as Ebook)).toBe("local:-1729630000000123");
  expect(bookKeyOf({ id: "estranho", gutenbergId: 0 } as Ebook)).toBeNull();
});
it("hoje é a data de São Paulo", () => {
  expect(todayInBrazil(new Date("2026-10-23T02:30:00Z"))).toBe("2026-10-22");
});
it("409 vira ShelfConflictError com a entrada atual", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(
    { error: "A entrada mudou em outro aparelho.", code: "CONFLICT", current: { bookKey: "gb:1", version: 3 } }), { status: 409 })));
  const err = await patchShelfEntry(session, "gb:1", { progressPercent: 10, baseUpdatedAt: "x" }).catch((e) => e);
  expect(err).toBeInstanceOf(ShelfConflictError);
  expect(err.current.version).toBe(3);
});
it("outros 4xx seguem como Error com a mensagem do servidor", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Nota inválida." }), { status: 422 })));
  const err = await patchShelfEntry(session, "gb:1", { rating: 4.3, baseUpdatedAt: "x" }).catch((e) => e);
  expect(err).toBeInstanceOf(ApiHttpError); expect(err.message).toBe("Nota inválida."); expect(err.status).toBe(422);
});
```

Mesma preparação de `accountFeatures.test.ts` (`vi.stubEnv("VITE_API_URL", …)`, `vi.resetModules()`, import dinâmico).

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/library.test.ts` → módulo `./library` não existe.
- [ ] **Step 3: Implementar.** `bookKeyOf`: `source === "local"` → `local:${gutenbergId}`; `id` com prefixo `gb-`/`cm-` → troca o primeiro `-` por `:`; senão `null`. `todayInBrazil` com `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })`. `bookKey` vai na URL com `encodeURIComponent`.
- [ ] **Step 4: Rodar e ver passar**; rodar também `npm test` (o `ApiHttpError` não pode quebrar os testes existentes).
- [ ] **Step 5: Commit** — `feat(library): chave do livro, tipos e cliente da API da estante`

---

### Task 2: Estante local por conta

**Files:**
- Create: `src/lib/libraryStore.ts`
- Modify: `src/lib/dataOwner.ts` (`USER_KEYS`), `src/lib/cloudSync.ts` (excluir `storyverse:shelf-` do snapshot)
- Test: `src/lib/libraryStore.test.ts`

**Interfaces:**
- Consumes: `ShelfEntry`, `ShelfStatus`, `DnfReason`, `bookKeyOf`, `shelfSourceOf`, `todayInBrazil` (Task 1).
- Produces:
  - `type LocalShelfEntry = ShelfEntry & { pending: Partial<ShelfEntry> & { auto?: boolean }; pendingAt: number | null; pendingDelete: boolean; local: boolean }` — `local: true` = ainda não existe no servidor (`updatedAt` nulo).
  - `setShelfEnabled(enabled: boolean): void` e `shelfEnabled(): boolean` — com `false`, todas as ações abaixo viram no-op.
  - Leitura: `shelfEntries(owner?: string | null): LocalShelfEntry[]` (sem `pendingDelete`), `shelfEntry(bookKey, owner?): LocalShelfEntry | null`, `subscribeShelf(fn: () => void): () => void`.
  - Ações (marcam pendências e avisam os inscritos): `recordOpened(book: Ebook)` (cria `reading`, `startedOn` hoje, `auto: true`; não mexe em entrada existente), `recordProgress(book, percent: number, label: string)`, `recordFinished(book)` (`finished`, `finishedOn` hoje, se ainda não estava `finished`), `setRating(bookKey, rating: number | null)`, `setReview(bookKey, review: string | null)`, `abandonBook(bookKey, reason: DnfReason, note: string | null)`, `setStatus(bookKey, status: ShelfStatus)` (ação explícita: `auto: false`), `setDates(bookKey, startedOn: string | null, finishedOn: string | null)` (catalogação retroativa, spec 5.1), `removeFromShelf(bookKey)`, `addToShelf(book, status: "want_to_read")`.
  - Para o sync (Task 4): `takeShelfPending(owner)`, `applyServerEntry(entry: ShelfEntry, owner, sentPendingAt: number | null)`, `forgetShelfEntry(bookKey, owner)`.

- [ ] **Step 1: Escrever os testes**

```ts
it("desligada não grava nada", () => {
  setShelfEnabled(false); recordOpened(dom); expect(shelfEntries()).toEqual([]);
});
it("abrir cria 'lendo' automático uma vez e não rebaixa terminado", () => {
  setShelfEnabled(true); recordOpened(dom);
  expect(shelfEntry("gb:55752")).toMatchObject({ status: "reading", startedOn: todayInBrazil(), local: true, pending: { auto: true } });
  recordFinished(dom); recordOpened(dom);
  expect(shelfEntry("gb:55752")?.status).toBe("finished");
});
it("abandonar exige motivo e retomar é explícito", () => {
  setShelfEnabled(true); recordOpened(dom); abandonBook("gb:55752", "slow", null);
  expect(shelfEntry("gb:55752")).toMatchObject({ status: "abandoned", dnfReason: "slow" });
  setStatus("gb:55752", "reading");
  expect(shelfEntry("gb:55752")).toMatchObject({ status: "reading", dnfReason: null, pending: { auto: false } });
});
it("cada conta tem a sua estante", () => {
  setShelfEnabled(true); setActiveOwner("conta-a"); recordOpened(dom);
  setActiveOwner("conta-b"); expect(shelfEntries()).toEqual([]);
  setActiveOwner("conta-a"); expect(shelfEntries()).toHaveLength(1);
});
it("a estante não entra no snapshot do reading_state", () => {
  setShelfEnabled(true); recordOpened(dom);
  expect(Object.keys(localSnapshot()).some((k) => k.startsWith("storyverse:shelf-"))).toBe(false);
});
```

`dom` é um `Ebook` de teste (`gb-55752`, "Dom Casmurro"). `setActiveOwner` e `localSnapshot` são as funções que `dataOwner.ts` e `cloudSync.ts` já exportam para os testes (usar as existentes; se o nome for outro, usar o real e registrar).

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Grava em `storyverse:shelf-entries` (`Record<bookKey, LocalShelfEntry>`) pelo `storageForOwner(owner)`. `recordProgress` só atualiza `progressPercent`/`progressLabel` (arredondado, 0–100) e não muda status. `removeFromShelf` de entrada `local: true` apaga na hora; de entrada do servidor marca `pendingDelete`. Metadados (`title`, `author`, `coverUrl`, `genre`, `language`, `source`) vêm do `Ebook`.
- [ ] **Step 4: Rodar e ver passar**; `npm test` inteiro (o teste de `cloudSync` continua verde).
- [ ] **Step 5: Commit** — `feat(library): estante local por conta com pendências`

---

### Task 3: Regras de merge

**Files:**
- Create: `src/lib/libraryMerge.ts`
- Test: `src/lib/libraryMerge.test.ts`

**Interfaces:**
- Consumes: `LocalShelfEntry`, `ShelfEntry` (Tasks 1–2).
- Produces: `mergeShelfEntry(local: LocalShelfEntry, server: ShelfEntry): { entry: ShelfEntry; pending: LocalShelfEntry["pending"] }` — a entrada a mostrar e o que ainda falta enviar; `serverTime(updatedAt: string): number` (aceita o texto do Postgres `2026-10-22 21:16:12.123456+00` e ISO).
- Regras (spec 9.3): `status` — pendente vence, exceto `reading` automático contra `finished`/`abandoned` do servidor; `rating`, `review`, `dnfReason`, `dnfNote` — vence o mais recente (`pendingAt` × `serverTime(server.updatedAt)`); `progressPercent` — o maior; `startedOn` — a menor data não nula; `finishedOn` — a maior não nula.

- [ ] **Step 1: Escrever os testes**

```ts
it("abrir o livro em outro aparelho não desfaz 'terminado'", () => {
  const r = mergeShelfEntry(local({ status: "reading" }, { status: "reading", auto: true }), server({ status: "finished", finishedOn: "2026-10-01" }));
  expect(r.entry.status).toBe("finished"); expect(r.pending.status).toBeUndefined();
});
it("ação explícita mais nova vence", () => {
  const r = mergeShelfEntry(local({}, { status: "reading", auto: false }, Date.parse("2026-10-22T20:00:00Z")),
    server({ status: "abandoned", dnfReason: "slow", updatedAt: "2026-10-22 19:00:00.000000+00" }));
  expect(r.pending.status).toBe("reading");
});
it("nota: vence a mais recente", () => {
  const older = mergeShelfEntry(local({}, { rating: 3 }, Date.parse("2026-10-22T18:00:00Z")), server({ rating: 5, updatedAt: "2026-10-22 19:00:00+00" }));
  expect(older.entry.rating).toBe(5); expect(older.pending.rating).toBeUndefined();
});
it("progresso maior e datas coerentes", () => {
  const r = mergeShelfEntry(local({}, { progressPercent: 40, startedOn: "2026-10-05" }), server({ progressPercent: 60, startedOn: "2026-10-10" }));
  expect(r.entry.progressPercent).toBe(60); expect(r.pending.progressPercent).toBeUndefined();
  expect(r.pending.startedOn).toBe("2026-10-05");
});
it("lê o horário do Postgres", () => {
  expect(serverTime("2026-10-22 21:16:12.123456+00")).toBe(Date.parse("2026-10-22T21:16:12.123Z"));
});
```

`local(fields, pending, pendingAt?)` e `server(fields)` são fábricas do teste.

- [ ] **Step 2: Rodar e ver falhar.** - [ ] **Step 3: Implementar (função pura).** - [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `feat(library): regras de merge entre aparelhos`

---

### Task 4: Sincronização

**Files:**
- Create: `src/lib/librarySync.ts`
- Test: `src/lib/librarySync.test.ts`

**Interfaces:**
- Consumes: cliente e `ShelfConflictError` (Task 1); `takeShelfPending`, `applyServerEntry`, `forgetShelfEntry` (Task 2); `mergeShelfEntry`, `serverTime` (Task 3).
- Produces: `syncShelf(session: SupabaseSession): Promise<boolean>` (`true` se terminou sem erro de rede) e `startShelfSync(session): () => void` (mesmos gatilhos do `startAutoSync`: a cada 30 s com a aba visível, ao voltar para a aba, ao voltar a internet). O dono é capturado no início (`currentDataOwner()`) e usado em todas as escritas da rodada.
- Ordem de uma rodada: empurrar (para cada pendência: `local` → `PUT` com `baseUpdatedAt: null`; senão `PATCH` só com os campos pendentes + `baseUpdatedAt`; `pendingDelete` → `DELETE`, 404 conta como feito). No 409: `mergeShelfEntry(local, current)`; se sobrou pendência, um novo `PATCH` com a nova base; se `current.deletedAt` for mais novo que `pendingAt`, `forgetShelfEntry`. Depois puxar: `fetchShelfPage({ updatedSince })` até `nextCursor` nulo; entradas com `deletedAt` somem localmente; as outras passam por `applyServerEntry` (merge se houver pendência). Marco em `storyverse:shelf-sync` = maior `updatedAt` da primeira página − 5 s, em ISO (decisão 6). Primeira rodada sem marco = lista completa.

- [ ] **Step 1: Escrever os testes**

```ts
it("sem internet a pendência fica", async () => {
  recordOpened(dom); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  expect(await syncShelf(session)).toBe(false);
  expect(shelfEntry("gb:55752")?.local).toBe(true);
});
it("cria com PUT e passa a seguir o servidor", async () => {
  recordOpened(dom); const api = fakeApi(); await syncShelf(session);
  expect(api.calls[0]).toMatchObject({ method: "PUT", path: "/api/v1/me/library/gb%3A55752", body: { baseUpdatedAt: null, status: "reading" } });
  expect(shelfEntry("gb:55752")).toMatchObject({ local: false, version: 1, pending: {} });
});
it("409 faz merge e tenta de novo uma vez", async () => {
  const api = fakeApi({ "gb:55752": serverEntry({ status: "finished", version: 2 }) }); seedSynced(dom, { version: 1 });
  setRating("gb:55752", 4.5); await syncShelf(session);
  expect(api.calls.filter((c) => c.method === "PATCH")).toHaveLength(2);
  expect(shelfEntry("gb:55752")).toMatchObject({ status: "finished", rating: 4.5, pending: {} });
});
it("remoção em outro aparelho some daqui", async () => {
  seedSynced(dom); fakeApi({ "gb:55752": serverEntry({ deletedAt: "2026-10-22 22:00:00+00" }) });
  await syncShelf(session); expect(shelfEntry("gb:55752")).toBeNull();
});
it("marco do sync tem sobreposição de 5 s", async () => {
  fakeApi({ "gb:1": serverEntry({ updatedAt: "2026-10-22 21:00:10.000000+00" }) }); await syncShelf(session);
  expect(readSyncMark()).toBe("2026-10-22T21:00:05.000Z");
});
```

`fakeApi(state)` é um `fetch` falso que responde como a API (PUT/PATCH/DELETE/GET com `updatedSince`, 409 quando a base não bate) e registra as chamadas; `seedSynced` grava uma entrada já sincronizada.

- [ ] **Step 2: Rodar e ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `feat(library): sincronização local-first com a API`

---

### Task 5: Migração dos dados locais (uma vez)

**Files:**
- Create: `src/lib/libraryMigration.ts`
- Test: `src/lib/libraryMigration.test.ts`

**Interfaces:**
- Consumes: `finishedBooks()` (`finished.ts`), `recentProgress()`/`progressPct()` (`progress.ts`), ações da Task 2.
- Produces: `migrateLocalShelf(owner?: string | null): number` — cria entradas `finished` (`finishedOn` = `todayInBrazil(new Date(finishedAt))`, `auto: false`) para os terminados e `reading` (`progressPercent`, `progressLabel` = `chapterLabel`, `startedOn` nulo) para os começados que não terminaram; não sobrescreve entrada existente; grava `storyverse:shelf-migrated = "1"`; com a marca, devolve 0 sem fazer nada. Destaques não são enviados (spec 12.1). Chaves antigas intactas.

- [ ] **Step 1: Escrever os testes**

```ts
it("terminados e começados viram estante, uma vez só", () => {
  markBookFinished(dom); saveProgress({ book: memorias, chapterIndex: 3, chapterLabel: "Capítulo IV", chapterCount: 10, scrollRatio: 0.5 });
  expect(migrateLocalShelf()).toBe(2);
  expect(shelfEntry("gb:55752")).toMatchObject({ status: "finished", finishedOn: todayInBrazil() });
  expect(shelfEntry("gb:54829")).toMatchObject({ status: "reading", progressPercent: 35, progressLabel: "Capítulo IV" });
  expect(migrateLocalShelf()).toBe(0);
  expect(finishedBooks()).toHaveLength(1);
});
```

- [ ] **Step 2: Rodar e ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `feat(library): migração única dos terminados e do progresso`

---

### Task 6: Componentes de avaliação e status

**Files:**
- Create: `src/features/library/RatingStars.tsx`, `FinishBookDialog.tsx`, `AbandonBookDialog.tsx`, `BookStatusControl.tsx`, `library.css`
- Test: `src/features/library/library-components.test.tsx`

**Interfaces:**
- Consumes: ações da Task 2; `LocalShelfEntry`.
- Produces:
  - `RatingStars({ value: number | null, onChange: (v: number | null) => void, readOnly?: boolean })` — 5 estrelas, meia estrela por clique na metade; `role="slider"`, `aria-valuemin=0.5`, `aria-valuemax=5`, `aria-label` "Nota 4,5 de 5" / "Sem nota"; setas ←/→ mudam 0,5; Delete limpa.
  - `FinishBookDialog({ book: Ebook, onClose: () => void })` — título "Você terminou. Que nota dá?", estrelas, resenha (contador até 4.000), botões "Salvar" e "Agora não"; salvar chama `setRating`/`setReview`.
  - `AbandonBookDialog({ bookKey: string, onClose })` — motivos da Global Constraints (rádio, obrigatório), nota até 500, "Abandonar".
  - `BookStatusControl({ book: Ebook, onClose })` — status atual, progresso, nota (`RatingStars` só com `finishedOn`), resenha, datas de início e conclusão editáveis (`setDates`; conclusão antes do início mostra "A data de início é depois da conclusão." e não salva), ações "Marcar como terminado", "Abandonar", "Retomar", "Quero ler", "Remover da estante".
  - `shouldPromptFinish(bookKey): boolean` e `markFinishPrompted(bookKey)` em `libraryStore.ts` (chave `storyverse:shelf-finish-prompted`).

- [ ] **Step 1: Escrever os testes**

```tsx
it("estrelas: teclado muda meia estrela e o rótulo acompanha", async () => {
  const onChange = vi.fn(); render(<RatingStars value={4} onChange={onChange} />);
  const slider = screen.getByRole("slider", { name: "Nota 4 de 5" });
  await userEvent.type(slider, "{ArrowRight}"); expect(onChange).toHaveBeenCalledWith(4.5);
});
it("conclusão: 'Agora não' fecha sem gravar e não volta a aparecer", async () => {
  setShelfEnabled(true); recordFinished(dom); const onClose = vi.fn();
  render(<FinishBookDialog book={dom} onClose={onClose} />);
  await userEvent.click(screen.getByRole("button", { name: "Agora não" }));
  expect(onClose).toHaveBeenCalled(); expect(shelfEntry("gb:55752")?.rating).toBeNull();
  expect(shouldPromptFinish("gb:55752")).toBe(false);
});
it("abandono não envia sem motivo", async () => {
  setShelfEnabled(true); recordOpened(dom); render(<AbandonBookDialog bookKey="gb:55752" onClose={() => {}} />);
  expect(screen.getByRole("button", { name: "Abandonar" })).toBeDisabled();
  await userEvent.click(screen.getByRole("radio", { name: "Ritmo lento" }));
  await userEvent.click(screen.getByRole("button", { name: "Abandonar" }));
  expect(shelfEntry("gb:55752")).toMatchObject({ status: "abandoned", dnfReason: "slow" });
});
```

Se `@testing-library/user-event` não estiver instalado, usar `fireEvent` (não adicionar dependência).

- [ ] **Step 2: Rodar e ver falhar.** - [ ] **Step 3: Implementar** no estilo visual dos modais existentes (`AboutDialog`, `EditProfileModal`), com as cores das variáveis CSS do tema. - [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `feat(library): estrelas, conclusão, abandono e painel do livro`

---

### Task 7: Tela "Minha estante"

**Files:**
- Create: `src/features/library/LibraryPage.tsx`, `src/features/library/shelfFilters.ts`
- Test: `src/features/library/shelfFilters.test.ts`, `src/features/library/LibraryPage.test.tsx`

**Interfaces:**
- Consumes: `shelfEntries`, `subscribeShelf` (Task 2); `BookStatusControl`, `RatingStars` (Task 6).
- Produces:
  - `type ShelfFilter = { status?: ShelfStatus; author?: string; series?: string; genre?: string; minRating?: number; year?: number; hasFile?: boolean }`; `type ShelfSort = "recent" | "title" | "author" | "rating" | "finished"`.
  - `filterShelf(entries: LocalShelfEntry[], f: ShelfFilter, sort: ShelfSort, available: (bookKey: string) => boolean): LocalShelfEntry[]` — "Da comunidade" não é gênero; `year` usa `finishedOn`; `hasFile` usa `available`.
  - `LibraryPage({ onClose, onOpenBook: (book: Ebook) => void, available: (bookKey: string) => boolean, bookFor: (entry: LocalShelfEntry) => Ebook })` — lista com capa, título, autor, status, nota e progresso; filtros e ordenação; toque no card abre `BookStatusControl`; "Abrir" abre o livro; entrada indisponível mostra "arquivo removido" e não abre.

- [ ] **Step 1: Escrever os testes**

```ts
it("filtra por gênero sem contar 'Da comunidade' e por ano de conclusão", () => {
  const list = [e({ bookKey: "gb:1", genre: "Romance", finishedOn: "2026-03-10" }), e({ bookKey: "cm:x", genre: "Da comunidade", finishedOn: "2025-01-01" })];
  expect(filterShelf(list, { genre: "Da comunidade" }, "recent", () => true)).toEqual([]);
  expect(filterShelf(list, { year: 2026 }, "recent", () => true).map((x) => x.bookKey)).toEqual(["gb:1"]);
});
it("importado sem arquivo continua na estante e sai do filtro 'possui arquivo'", () => {
  const list = [e({ bookKey: "local:-1", source: "local" })];
  expect(filterShelf(list, {}, "recent", () => false)).toHaveLength(1);
  expect(filterShelf(list, { hasFile: true }, "recent", () => false)).toEqual([]);
});
```

```tsx
it("mostra 'arquivo removido' e não abre o livro", async () => {
  setShelfEnabled(true); seedEntry(e({ bookKey: "local:-1", source: "local", title: "Meu PDF" }));
  const onOpenBook = vi.fn();
  render(<LibraryPage onClose={() => {}} onOpenBook={onOpenBook} available={() => false} bookFor={toEbook} />);
  expect(screen.getByText("arquivo removido")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Abrir Meu PDF" })).toBeNull();
});
```

- [ ] **Step 2: Rodar e ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `feat(library): tela Minha estante com filtros`

---

### Task 8: Ligar no app (capability, leitor, perfil, sync)

**Files:**
- Modify: `src/App.tsx` (componente principal, leitor e `ProfilePage`)
- Test: `src/lib/libraryWiring.test.ts` (função `connectShelf`) e a suíte inteira

**Interfaces:**
- Consumes: `useAccountFeatures`, `hasFeature`; `setShelfEnabled`, `recordOpened`, `recordProgress`, `recordFinished`, `shouldPromptFinish`, `markFinishPrompted` (Tasks 2, 6); `migrateLocalShelf` (Task 5); `startShelfSync` (Task 4); componentes (Tasks 6–7).
- Produces: `connectShelf(session: SupabaseSession | null, enabled: boolean): () => void` em `src/lib/libraryWiring.ts` — liga/desliga a estante: `setShelfEnabled(enabled)`; com sessão e `enabled`, roda `migrateLocalShelf()` e `startShelfSync(session)`; devolve a função que para o sync.
- No `App.tsx`:
  - `const { capabilities } = useAccountFeatures(authSession)`; `shelfOn = hasFeature(capabilities, "library")`; `useEffect(() => connectShelf(authSession, shelfOn), [authSession, shelfOn])`.
  - `startBook`: `recordOpened(b)` (no-op sem a estante).
  - Importar um livro (onde o `App.tsx` recebe o livro salvo de `importBook.ts`): `addToShelf(book, "want_to_read")` (spec 9.4).
  - Efeito de `saveProgress` (perto de `App.tsx:6725`): também `recordProgress(book, progressPct(...), currentChapter.label)`.
  - Fim do livro (perto de `App.tsx:6751`): `recordFinished(book)`; ao fechar a comemoração, se `shelfOn && shouldPromptFinish(key)`, abre `FinishBookDialog` e chama `markFinishPrompted`.
  - Leitor: botão "Na estante" (só com `shelfOn`) que abre `BookStatusControl`.
  - `ProfilePage`: card "Minha estante" (só com `shelfOn`) com totais; abre `LibraryPage` por um estado `libraryOpen`, no mesmo padrão de `rankingOpen` (`useBackClose`).

- [ ] **Step 1: Escrever os testes**

```ts
it("sem a capability não migra, não sincroniza e não chama a API", () => {
  const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
  const stop = connectShelf(session, false); recordOpened(dom);
  expect(shelfEntries()).toEqual([]); expect(fetchSpy).not.toHaveBeenCalled(); stop();
});
it("com a capability migra e liga o sync", () => {
  markBookFinished(dom); const stop = connectShelf(session, true);
  expect(shelfEntry("gb:55752")?.status).toBe("finished"); stop();
});
```

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** `connectShelf` e as mudanças no `App.tsx`.
- [ ] **Step 4: Verificar** — `npm test`, `npx tsc --noEmit -p tsconfig.json`, `npm run lint` (0 erros) e `npm run build`.
- [ ] **Step 5: Commit** — `feat(library): estante ligada ao leitor, ao perfil e ao sync`

---

### Task 9: Conquistas, chat e documentação

**Files:**
- Modify: `src/lib/achievements.ts`, `src/lib/ai.ts`, `src/App.tsx` (passar os dados), `docs/ARQUITETURA.md`, `README.md`
- Test: `src/lib/achievements.test.ts`, `src/lib/ai.test.ts` (criar se não existir)

**Interfaces:**
- Consumes: `shelfEntries` (Task 2).
- Produces:
  - `AchievementInput` ganha `shelf: { ratings: number; reviews: number; genresFinished: number; finishedThisYear: number } | null`; com `null` as regras novas não entram na lista (decisão 8). Regras (spec 10.1): `first-rating` "Primeira nota" (1 nota), `ratings-5` "Crítico iniciante" (5), `first-review` "Resenha de estreia" (1 resenha com 200+ caracteres), `reviews-3` "Voz da estante" (3 resenhas), `genres-3` "Leitor eclético" (3 gêneros terminados, sem "Da comunidade"), `year-10` "Dez no ano" (10 terminados no ano). `series-1` fica para a Fase 2.
  - `shelfAchievementInput(entries: LocalShelfEntry[], year: number)` em `libraryStore.ts`.
  - `characterReply` ganha `shelf?: { status: ShelfStatus; rating: number | null }`; com ele, o prompt de sistema recebe uma linha antes do trecho: `Para este livro o leitor marcou: <terminado|lendo|abandonado|quer ler>` + `, nota <n> de 5` se houver. Só do livro atual.

- [ ] **Step 1: Escrever os testes**

```ts
it("conquistas da estante só aparecem com a estante", () => {
  expect(achievements({ ...base, shelf: null }).some((a) => a.id === "first-rating")).toBe(false);
  const all = new Map(achievements({ ...base, shelf: { ratings: 1, reviews: 0, genresFinished: 3, finishedThisYear: 2 } }).map((a) => [a.id, a]));
  expect(all.get("first-rating")?.unlocked).toBe(true); expect(all.get("genres-3")?.unlocked).toBe(true);
  expect(all.get("year-10")?.missing).toBe("faltam 8 livros");
});
it("o chat recebe status e nota do livro atual", async () => {
  const sent = captureAiRequest();
  await characterReply({ ...params, shelf: { status: "finished", rating: 4.5 } });
  expect(sent().system).toContain("Para este livro o leitor marcou: terminado, nota 4,5 de 5");
});
```

`captureAiRequest` intercepta o `fetch` de `/api/v1/ai/reply` (ver como `ai.ts` chama a API) e devolve o corpo enviado.

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar**; no `App.tsx`, passar `shelf` só quando `shelfOn` e o livro do chat tiver entrada.
- [ ] **Step 4: Verificar** — `npm test`, `tsc`, `lint`, `npm run build`. Atualizar `docs/ARQUITETURA.md` (módulos da estante e fluxo do sync) e `README.md` (como liberar: `deploy/grant-feature.sh <uuid> library true`).
- [ ] **Step 5: Commit** — `feat(library): conquistas da estante, contexto no chat e documentação`

---

## Depois do merge e do deploy

1. Conceder `library` à conta do Werner (`deploy/grant-feature.sh`, com o ok dele) e conferir no site: abrir um livro → "Na estante" mostra "Lendo"; terminar → modal de nota; "Minha estante" no perfil; segundo aparelho/aba recebe as mudanças em até 30 s.
2. Fora deste plano (Fase 2 da spec): coleções, notas livres, resenhas públicas, séries, exportação e retrospectiva anual.
