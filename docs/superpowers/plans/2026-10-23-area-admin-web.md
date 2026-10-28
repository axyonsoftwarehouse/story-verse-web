# Área do admin — Web e scripts, Fase 1 — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o `/admin` num painel com Visão geral, Contas, Features, Moderação (acervo + fórum) e Auditoria, levar a moderação do acervo para lá e ajustar os scripts da VPS.

**Architecture:** O `AdminRoute` vira um layout com sub-rotas (`react-router-dom` 7), e cada seção fica num arquivo próprio em `src/features/admin/`. Os clientes HTTP ficam em `src/lib/admin*.ts`, no molde de `src/lib/adminForum.ts` (`apiRequest` + `session.access_token`). A visibilidade das seções sai de uma função pura sobre os papéis de `/api/v1/auth/capabilities`. Ela só controla a interface; quem autoriza é a API.

**Tech Stack:** React 19, TypeScript, Vite, react-router-dom 7, Vitest + Testing Library. Bash nos scripts da VPS.

**Spec:** `docs/superpowers/specs/2026-10-23-area-admin-design.md`. Plano da API (contratos JSON): `story-verse-api/docs/superpowers/plans/2026-10-23-area-admin-api.md`.

## Global Constraints

- Este plano só começa depois que a API (`story-verse-api`, branch `feat/area-admin`) estiver publicada no QA. Os formatos JSON são os das Interfaces daquele plano.
- Sub-rotas: `/admin`, `/admin/contas`, `/admin/contas/:id`, `/admin/features`, `/admin/moderacao/acervo`, `/admin/moderacao/forum`, `/admin/auditoria`.
- Papéis por seção (seção 3 da spec):
  - Visão geral: qualquer staff;
  - Contas: `superadmin` ou `support`;
  - Features e Auditoria: `superadmin`;
  - Acervo: `superadmin` ou `moderator`;
  - Fórum: qualquer staff, mas com ações só para `superadmin` ou `moderator`.
- Sem biblioteca nova de UI. Use as classes que já existem (`shelf`, `shelf-head`, `profile-card`, `dash-tiles`, `dash-card`, `btn`, `btn-primary`, `page-status`, `spinner`). CSS novo só em `src/features/admin/admin.css`.
- Confirmação de ação sensível: `window.confirm` com o nome da conta ou do livro na frase, como já é feito em `App.tsx`.
- 403 → `Sem permissão para esta ação.` Outros erros → a mensagem da API na própria seção (padrão de `ForumModeration`).
- E-mail completo aparece só no detalhe da conta.
- Texto em português, no tom do app. A tela tem que funcionar a 375 px de largura.
- Branch `feat/area-admin` (já existe, com a spec). Um commit por task. Antes de cada commit: `npm run lint && npm test`.

## Decisões deste plano (lacunas da spec)

1. **"Ler o envio" vira uma prévia do texto dentro do painel.** O botão "Ler" abre um painel com os primeiros 30.000 caracteres (`fetchCommunityText`), em `white-space: pre-wrap`, com a contagem total. Isso evita acoplar o `/admin` ao leitor, que vive no estado do `App`. Para julgar um envio, a prévia basta.
2. **Com a API ativa, `deleteSubmission` para de chamar `dropObject`.** A API já apaga texto e capa depois do commit, e para um moderador o `dropObject` da capa responderia 403 com o envio já apagado.
3. **O cartão de admin do perfil** passa a usar os papéis das capabilities (`superadmin` ou `moderator`) e vira um `<Link to="/admin/moderacao/acervo">`. Somem `checkIsAdmin`, o estado `isAdmin`, o `moderationOpen` e o `ModerationPage` do `App.tsx`.
4. **Conflito com o PR 49:** ele também mexe em `App.tsx`. Quem fizer o merge por último resolve, mantendo as mudanças dos dois lados. Nada neste plano depende da estante.

## Review Focus

- **Conta só com `support`:** vê Visão geral, Contas e Fórum (sem botões de ação), e não vê Features, Acervo nem Auditoria, nem digitando a URL (mostra "Sem permissão") → teste na Task 2 e no roteiro de QA.
- **Busca que não acha nada ou que a API recusa** (`ab`): mostra a mensagem da API ou "Nenhuma conta encontrada", sem lista velha na tela → teste na Task 4.
- **Encerrar sessões ou tirar papel e cancelar o `confirm`:** nenhuma chamada à API → teste na Task 4.
- **Moderador apagando envio aprovado:** a lista atualiza e nenhum erro aparece, mesmo sem `dropObject` → teste na Task 6.
- **Auditoria com `actorId` nulo e metadados com objeto aninhado:** mostra "script na VPS" e renderiza sem quebrar → teste na Task 7.

---

### Task 1: Scripts da VPS e contas de QA

**Files:**
- Modify: `deploy/promote-admin.sh`
- Create: `deploy/demote-admin.sh`
- Modify: `deploy/storyverse-qa/seed-qa.sh`
- Modify: `docs/QA.md`

- [ ] **Step 1: `promote-admin.sh`.** Remova o `insert into public.admins` e a checagem `to_regclass('public.user_roles')` (a V6 já está em todo banco). Grave só `user_roles` + auditoria `admin.promote`.
- [ ] **Step 2: `demote-admin.sh <uuid>`,** no mesmo molde (mesma validação de UUID e o mesmo `psql_db`):
  - recusa com `Esta é a última conta superadmin; promova outra antes.` se `select count(*) from public.user_roles where role='superadmin'` for 1 e a conta for essa;
  - apaga a linha `superadmin` e audita `admin.demote` com `{"via":"demote-admin.sh"}`;
  - imprime `Conta <uuid> deixou de ser superadmin.`
- [ ] **Step 3: `seed-qa.sh`.** Crie `qa-moderador@example.com` ("Moderador de QA", papel `moderator`) e `qa-suporte@example.com` ("Suporte de QA", papel `support`), no mesmo padrão do `qa-admin`.
- [ ] **Step 4: `docs/QA.md`.**
  - Acrescente as duas contas na tabela.
  - Acrescente a seção "Roteiro do painel admin": entrar com cada uma das quatro contas (`qa-leitor`, `qa-suporte`, `qa-moderador`, `qa-admin`) e conferir as seções visíveis, uma ação permitida e uma URL proibida, seguindo a tabela da seção 3 da spec.
- [ ] **Step 5: Verify:** `bash -n deploy/promote-admin.sh deploy/demote-admin.sh deploy/storyverse-qa/seed-qa.sh` sem saída.
- [ ] **Step 6: Commit** — `feat(admin): scripts de papel só em user_roles, demote-admin e contas de QA por papel`

---

### Task 2: Papéis → seções, e clientes da API

**Files:**
- Create: `src/features/admin/adminSections.ts`
- Create: `src/features/admin/adminSections.test.ts`
- Create: `src/lib/adminUsers.ts`, `src/lib/adminFeatures.ts`, `src/lib/adminOverview.ts`, `src/lib/adminAudit.ts`

**Interfaces:**
- Produces:
  - `type AdminSectionId = "overview" | "accounts" | "features" | "submissions" | "forum" | "audit"`;
  - `type AdminSection = { id: AdminSectionId; path: string; label: string }`, com os rótulos "Visão geral", "Contas", "Features", "Acervo", "Fórum" e "Auditoria";
  - `visibleSections(roles: string[]): AdminSection[]`, na ordem acima;
  - `canModerate(roles: string[]): boolean`, `canSeeAccounts(roles: string[]): boolean`, `isSuperadmin(roles: string[]): boolean`, `isStaff(roles: string[]): boolean`;
  - em `adminUsers.ts`, os tipos `AdminUserSummary` e `AdminUserDetail` (camelCase, iguais aos records da API) e:
    - `searchUsers(session, q): Promise<AdminUserSummary[]>`;
    - `getUser(session, id): Promise<AdminUserDetail>`;
    - `revokeSessions(session, id): Promise<{ revoked: number }>`;
    - `setRole(session, id, role: "moderator" | "support", on: boolean): Promise<{ roles: string[] }>`;
  - em `adminFeatures.ts`:
    - `getCatalog(session): Promise<{ feature: string; enabledCount: number }[]>`;
    - `listFeatureUsers(session, feature, cursor?): Promise<{ items: FeatureUser[]; nextCursor: string | null }>`;
    - `setFeature(session, userId, feature, enabled): Promise<void>` (o `PUT /api/v1/admin/features` que já existe);
  - em `adminOverview.ts`: tipo `AdminOverview` e `getOverview(session)`;
  - em `adminAudit.ts`: os tipos `AuditEntry` e `AuditFilters`, e `listAudit(session, filters, before?): Promise<{ items: AuditEntry[]; nextBefore: number | null }>`, montando a query só com os filtros preenchidos.

- [ ] **Step 1: Write `adminSections.test.ts`:**

```ts
expect(visibleSections([]).map((s) => s.id)).toEqual([]);
expect(visibleSections(["support"]).map((s) => s.id)).toEqual(["overview", "accounts", "forum"]);
expect(visibleSections(["moderator"]).map((s) => s.id)).toEqual(["overview", "submissions", "forum"]);
expect(visibleSections(["superadmin"]).map((s) => s.id)).toEqual(["overview", "accounts", "features", "submissions", "forum", "audit"]);
expect(visibleSections(["support", "moderator"]).map((s) => s.id)).toEqual(["overview", "accounts", "submissions", "forum"]);
expect(visibleSections(["leitor"]).map((s) => s.id)).toEqual([]);
expect(canModerate(["support"])).toBe(false);
```

- [ ] **Step 2: Run** `npx vitest run src/features/admin/adminSections.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `adminSections.ts` e os quatro clientes. Os clientes usam `encodeURIComponent` em todo id e valor de query.
- [ ] **Step 4: Run** de novo. Expected: PASS. Também `npm run lint`.
- [ ] **Step 5: Commit** — `feat(admin): seções por papel e clientes da API do admin`

---

### Task 3: Layout com sub-rotas, Visão geral e Fórum

**Files:**
- Modify: `src/features/admin/AdminRoute.tsx` (vira layout + `<Routes>` internas; some o bloco "Próximos módulos")
- Create: `src/features/admin/AdminNav.tsx`, `src/features/admin/OverviewSection.tsx`, `src/features/admin/admin.css`
- Modify: `src/features/admin/ForumModeration.tsx` (a prop `canModerate` já existe; sem ela, esconda os botões de ação)
- Test: `src/features/admin/AdminNav.test.tsx`

**Interfaces:**
- Consumes: `visibleSections` e `getOverview` (Task 2).
- Produces:
  - `AdminRoute` continua sendo o export usado em `main.tsx` (`/admin/*`) e passa `session` e `roles` às seções;
  - `RequireSection({ id, roles, children })` mostra "Sem permissão" quando a seção não está em `visibleSections(roles)`.

- [ ] **Step 1: Write `AdminNav.test.tsx`** (Testing Library + `MemoryRouter`): com `roles=["moderator"]`, há links para "Visão geral", "Acervo" e "Fórum", e não há link "Contas". O link da rota atual tem `aria-current="page"`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Navegação:** lateral a partir de 768 px, e abas roláveis no topo abaixo disso.
  - **Visão geral:** um `dash-card` por bloco não nulo da API.
    - Moderação: "N envios esperando" com link para Acervo, e "N denúncias abertas" com link para Fórum.
    - Contas: total e novas em 7 dias.
    - Features: contas por feature.
    - Backup: status, data e tamanho legível. Com `stale`, o cartão ganha a classe `is-alert` e o texto "Backup atrasado".
  - Rota desconhecida dentro de `/admin` volta para `/admin`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): layout com seções, visão geral e fórum por papel`

---

### Task 4: Contas

**Files:**
- Create: `src/features/admin/AccountsSection.tsx`, `src/features/admin/AccountDetail.tsx`
- Test: `src/features/admin/AccountDetail.test.tsx`

**Interfaces:**
- Consumes: `searchUsers`, `getUser`, `revokeSessions`, `setRole` e `setFeature` (Task 2); `isSuperadmin` (Task 2).

- [ ] **Step 1: Write `AccountDetail.test.tsx`** (cliente mockado com `vi.mock("../../lib/adminUsers")`):
  - com `window.confirm` devolvendo `false`, clicar em "Encerrar sessões" não chama `revokeSessions`;
  - com `true`, chama uma vez e mostra "N sessões encerradas";
  - com `roles=["support"]`, não aparecem os controles de papel nem de feature;
  - o bloco de auditoria só aparece quando `recentAudit` não é nulo.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Busca:** um campo com o texto de ajuda "UUID, e-mail completo ou parte do nome", e a busca roda ao enviar o formulário. Cada envio limpa a lista anterior. Lista vazia mostra "Nenhuma conta encontrada." e erro mostra a mensagem da API. Cada resultado mostra nome, e-mail mascarado, papéis e "e-mail não confirmado" quando for o caso, e leva a `/admin/contas/:id`.
  - **Detalhe:**
    - nome, e-mail completo, UUID com botão "Copiar", criado em, último login, sessões ativas e papéis;
    - para superadmin: interruptores de `moderator` e `support` (o `superadmin` aparece como selo, sem controle) e a lista de features do catálogo, cada uma com um interruptor;
    - "Encerrar sessões" com `confirm("Encerrar todas as sessões de <nome>? A pessoa precisará entrar de novo em todos os aparelhos.")`;
    - tirar um papel também pede confirmação;
    - as últimas ações da auditoria aparecem em lista simples.
  - A própria conta não mostra os controles de papel nem o "Encerrar sessões", porque a API recusaria.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): busca e detalhe de contas`

---

### Task 5: Features

**Files:**
- Create: `src/features/admin/FeaturesSection.tsx`

**Interfaces:**
- Consumes: `getCatalog`, `listFeatureUsers` e `setFeature` (Task 2).

- [ ] **Step 1: Implement.**
  - Um cartão por feature com a contagem.
  - Abrir a feature lista quem tem: nome com link para o detalhe da conta, e-mail mascarado, quem concedeu e quando.
  - "Carregar mais" quando houver `nextCursor`.
  - Cada linha tem "Desligar", com `confirm("Desligar <feature> para <nome>?")`, e some da lista depois de desligar.
  - Para ligar uma feature para alguém, o caminho é o detalhe da conta (diga isso num texto curto no topo).
- [ ] **Step 2: Verify:** `npm run lint && npm test` verdes. Confira no QA com `qa-admin`.
- [ ] **Step 3: Commit** — `feat(admin): features e quem tem cada uma`

---

### Task 6: Moderação do acervo no `/admin`

**Files:**
- Create: `src/features/admin/SubmissionsModeration.tsx` (conteúdo de `ModerationPage`, hoje em `src/App.tsx:3439-3676`)
- Create: `src/features/admin/SubmissionPreview.tsx`
- Modify: `src/App.tsx`
  - remover `ModerationPage`, `moderationOpen`, `isAdmin`, o efeito com `checkIsAdmin` (~5939), o `useBackClose` da moderação e o render em ~7397;
  - trocar o cartão do perfil (~4705-4720) por um `Link`;
  - remover as props `isAdmin` e `onOpenModeration` do perfil.
- Modify: `src/lib/community.ts` (remover `checkIsAdmin`; em `deleteSubmission`, com `apiEnabled`, não chamar mais `dropObject`)
- Test: `src/lib/community.test.ts` (novo)

**Interfaces:**
- Consumes: `canModerate` (Task 2) e `fetchAccountCapabilities` (que já existe), para o perfil decidir se mostra o link.
- Produces: `SubmissionsModeration({ session })` e `SubmissionPreview({ session, submission, onClose })`.

- [ ] **Step 1: Write `community.test.ts`:** com `apiEnabled` verdadeiro e `apiRequest` mockado, `deleteSubmission(session, s)` faz exatamente uma chamada (o `DELETE` do envio) e nenhuma ao storage.
- [ ] **Step 2: Run.** Expected: FAIL (hoje são três chamadas).
- [ ] **Step 3: Implement** a mudança em `community.ts`.
- [ ] **Step 4: Move `ModerationPage`** para `SubmissionsModeration`, mantendo as abas, as ações e o texto que já existem. Remova `onClose` (agora é rota) e troque `onRead` pela prévia, conforme a Decisão 1.
- [ ] **Step 5: Ajuste o `App.tsx`,** conforme a Decisão 3. Na `main`, o `App` não busca capabilities, então troque o efeito do `checkIsAdmin` por um com `fetchAccountCapabilities`, que guarda `canModerate(roles)`. Se o PR 49 já tiver entrado e o `App` já guardar as capabilities, reaproveite esse estado.
- [ ] **Step 6: Run** `npm run lint && npm test && npm run build`. Expected: verdes, e `grep -n "checkIsAdmin\|ModerationPage" src` sem resultado.
- [ ] **Step 7: Commit** — `feat(admin): moderação do acervo no painel, com prévia do texto`

---

### Task 7: Auditoria

**Files:**
- Create: `src/features/admin/AuditSection.tsx`
- Create: `src/features/admin/auditFormat.ts`, `src/features/admin/auditFormat.test.ts`

**Interfaces:**
- Consumes: `listAudit` (Task 2).
- Produces:
  - `actionLabel(action: string): string`;
  - `actorLabel(entry: AuditEntry): string`;
  - `metadataLines(metadata: unknown): string[]`.

- [ ] **Step 1: Write `auditFormat.test.ts`:**

```ts
expect(actionLabel("feature.set")).toBe("Feature alterada");
expect(actionLabel("acao.nova")).toBe("acao.nova");
expect(actorLabel({ actorId: null, actorName: null } as AuditEntry)).toBe("script na VPS");
expect(metadataLines({ feature: "library", enabled: true })).toEqual(["feature: library", "enabled: sim"]);
expect(metadataLines({ a: { b: 1 } })).toEqual(['a: {"b":1}']);
expect(metadataLines(null)).toEqual([]);
```

  Rótulos de `actionLabel`:

  | Ação | Rótulo |
  |---|---|
  | `feature.set` | Feature alterada |
  | `role.grant` | Papel concedido |
  | `role.revoke` | Papel retirado |
  | `user.view` | Conta consultada |
  | `user.sessions.revoke` | Sessões encerradas |
  | `admin.promote` | Promovido a superadmin |
  | `admin.demote` | Deixou de ser superadmin |
  | `book_submission.review` | Envio revisado |
  | `book_submission.delete` | Envio apagado |
  | `book_submission.cover` | Capa trocada |
  | `forum.report.resolve` | Denúncia resolvida |
  | `forum.topic.moderate` | Tópico moderado |
  | `forum.reply.moderate` | Resposta moderada |

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `auditFormat.ts` e a seção.
  - **Filtros:**
    - ação: select com os prefixos `feature.`, `role.`, `user.`, `admin.`, `book_submission.` e `forum.`, mais "Todas";
    - id do ator e id do alvo: texto;
    - de e até: datas.
  - **Lista:** mais nova primeiro, com data e hora em `America/Sao_Paulo`, ator (com link para a conta quando houver), ação, alvo (link para a conta quando `targetType="user"`) e os metadados em linhas.
  - "Carregar mais" quando houver `nextBefore`. Mudar um filtro recarrega a lista do zero.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): consulta da auditoria`

---

### Task 8: Verificação final e QA

- [ ] **Step 1:** `npm run lint && npm test && npm run build` verdes.
- [ ] **Step 2:** Publique no QA pelo workflow de QA e rode o seed atualizado (Task 1).
- [ ] **Step 3:** Siga o roteiro "Roteiro do painel admin" do `docs/QA.md` com as quatro contas, em largura de desktop e de celular (375 px). Anote o que falhou e corrija antes do PR.
- [ ] **Step 4:** Push e PR para `main`, citando a spec e o PR da API.
