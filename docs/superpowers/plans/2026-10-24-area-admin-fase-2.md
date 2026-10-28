# Área do admin — Fase 2 — Web

**Goal:** entregar as fases 2A (contas), 2B (sanções), 2C (métricas) e 2D (exportação de auditoria) no `/admin`, deixando financeiro/assinatura para a fase de pagamentos.

**Architecture:** mantém o layout da Fase 1 (`AdminRoute` com sub-rotas, seções em `src/features/admin/`, clientes em `src/lib/admin*.ts`). Sem biblioteca nova de UI. Confirmações usam `useConfirm`/`ConfirmDialog`. A visibilidade das seções sai de `visibleSections`; a autorização real continua na API.

**Tech Stack:** React 19, TypeScript, Vite, react-router-dom 7, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-23-area-admin-fase-2.md` (sem a seção 9/financeiro).
**Plano da API:** `story-verse-api/docs/superpowers/plans/2026-10-24-area-admin-fase-2-api.md`.

## Global Constraints

- Financeiro/assinatura fora: não adicionar `subscriptionStatus`, filtro/coluna de assinatura, `/admin/financeiro` nem links de cobrança. A seção financeira atual não é alterada.
- Papéis: contas (superadmin/support), sanções (staff vê; superadmin aplica/revoga), métricas (superadmin), auditoria (superadmin). O `AdminRoute` só controla a interface; a API autoriza.
- E-mail completo só no detalhe da conta; listas e sanções sempre mascarados.
- Novas seções no `AdminNav`: “Sanções” (staff) e “Métricas” (superadmin), nesta ordem, antes de Financeiro/Auditoria? Manter a ordem existente e inserir Sanções depois de Contas e Métricas antes de Auditoria.
- Sem CSS novo fora de `src/features/admin/admin.css` e `src/components/confirmDialog.css`.
- Texto em português, tom do app; layout funciona a 375 px.
- Um commit por task; antes de cada commit: `npm run lint && npm test`.
- Branch: `feat/admin-fase-2` (web) e `feat/admin-fase-2` (API).

## Decisões deste plano (lacunas da spec)

1. **Lista de contas:** bloco “Contas recentes” (20) + formulário de filtros (papel, feature, busca) com “Carregar mais” por cursor. Sem assinatura. A busca usa o comportamento do BUG-005 (parte do e-mail ou do nome).
2. **Sanções na conta:** cartão “Sanções” no detalhe, com histórico e botão “Aplicar sanção” (superadmin). Modal próprio (não `window.confirm`), com tipo, motivo, duração e confirmação pelo nome.
3. **Página `/admin/sancoes`:** lista de sanções ativas/revogadas/todas, filtro por tipo e busca por conta; staff vê, superadmin revoga.
4. **Login com sanção:** `ACCOUNT_SANCTIONED` mostra motivo/prazo no próprio modal de login; `warning` deixa entrar e mostra um banner dispensável na home. A tela de assinatura continua acessível quando não for banimento.
5. **Métricas:** cards e tabelas simples com `dash-card`/`import-table`; período 7/30/90 dias; nota da fonte em cada bloco; “sem dados” quando não houver.
6. **CSV:** botão “Exportar CSV” em `/admin/auditoria` respeitando os filtros; download via Blob como em `ImportsSection`.

## Review Focus

- **Support:** vê Contas e Sanções, não vê Métricas; não aplica/revoga sanção.
- **Moderator:** vê Sanções (histórico), não vê Contas/Métricas; não aplica sanção.
- **Superadmin:** vê tudo, aplica/revoga sanção e exporta auditoria.
- **Sanção em si mesmo/staff:** a API recusa; a UI não deve oferecer o botão para contas com papel de staff nem para a própria conta.
- **Login bloqueado:** mensagem clara com motivo e prazo; não some ao trocar de aba; `warning` não bloqueia.
- **Cursor/estado:** “Carregar mais” não duplica linhas; trocar filtro reseta a lista; erro aparece na seção.
- **Privacidade:** nenhuma lista mostra e-mail completo; sanções mostram e-mail mascarado.
- **CSV:** abre no Excel pt-BR; erro de período/limite aparece na seção.

---

## Task 1: 2A — clientes e lista de contas

**Files**
- Modify: `src/lib/adminUsers.ts`
- Rewrite: `src/features/admin/AccountsSection.tsx`
- Create: `src/features/admin/AccountsSection.test.tsx`
- Modify: `src/features/admin/admin.css` (só se faltar estilo)
- Modify: `src/features/admin/adminSections.test.ts` (só se a seção mudar)

**Interfaces**
- `AdminUserSummary`: `{ id, name, emailMasked, emailConfirmed, createdAt, lastSignInAt, roles }`.
- `AdminUserPage`: `{ items: AdminUserSummary[]; nextCursor: string | null }`.
- `recentUsers(session, limit = 20): Promise<AdminUserSummary[]>` → `GET /api/v1/admin/users/recent?limit=`.
- `listUsers(session, { q, role, feature, cursor, limit }): Promise<AdminUserPage>` → `GET /api/v1/admin/users/list?...`.
- `searchUsers` continua existindo para compatibilidade, mas a tela usa `listUsers`.

**Steps**
- [ ] Teste vermelho: renderiza recentes; busca `qa-leitor` chama `listUsers` com `q`; filtro de papel/feature; “Carregar mais” anexa a próxima página e não duplica; estado vazio/erro.
- [ ] Implementar `recentUsers`/`listUsers` em `adminUsers.ts` com `URLSearchParams`.
- [ ] Reescrever `AccountsSection`:
  - Carregar recentes no mount (com `alive`).
  - Formulário `admin-search` + `admin-filters` (papel, feature) e “Limpar”.
  - Lista `admin-user-list` com nome, e-mail mascarado, papéis, e-mail confirmado, data de criação e último login.
  - “Carregar mais” com cursor; reset ao mudar filtro/busca.
- [ ] Rodar `npm test`/`npm run lint`.
- [ ] Commit: `feat(admin): contas recentes, filtros e paginacao`

**Verify:** support vê a lista e busca; moderator não vê a seção; busca antiga por parte do e-mail funciona.

---

## Task 2: 2B — cliente e modal de sanções

**Files**
- Create: `src/lib/adminSanctions.ts`
- Modify: `src/features/admin/AccountDetail.tsx`
- Create: `src/features/admin/SanctionDialog.tsx` (ou dentro de `AccountDetail`)
- Modify: `src/features/admin/AccountDetail.test.tsx`
- Modify: `src/features/admin/admin.css`

**Interfaces**
- `AdminSanction`: `{ id, kind, reason, expiresAt, createdAt, createdBy, createdByName, revokedAt, revokedBy, revokedByName }`.
- `SanctionsPage`: `{ items: (AdminSanction & { userId, userName, emailMasked })[]; nextCursor }`.
- `listAccountSanctions(session, userId)`, `applySanction(session, userId, { kind, reason, expiresAt })`, `revokeSanction(session, sanctionId, reason?)`, `listSanctions(session, { status, kind, cursor })`.
- `AccountDetail` recebe `sanctions` no detalhe (contrato novo) e mostra:
  - Histórico: tipo, motivo, criado em/por, expira em, revogado em/por.
  - “Aplicar sanção” só para superadmin e alvo sem papel de staff e diferente de si.
  - “Revogar” só para superadmin em sanção ativa, com confirmação.

**Steps**
- [ ] Testes vermelhos: support não vê “Aplicar sanção”; superadmin vê; modal valida motivo e duração; cancelar não chama API; aplicar atualiza a lista; revogar pede confirmação.
- [ ] Implementar `adminSanctions.ts` (PUT/POST/GET, `apiRequest`).
- [ ] Implementar o cartão e o modal (`.about-backdrop` + `.auth-card`, campos com labels, `.status-chip` para o tipo).
- [ ] Rodar `npm test`/`npm run lint`.
- [ ] Commit: `feat(admin): sancoes no detalhe da conta`

---

## Task 3: 2B — página de sanções, rotas e navegação

**Files**
- Create: `src/features/admin/SanctionsSection.tsx`
- Create: `src/features/admin/SanctionsSection.test.tsx`
- Modify: `src/features/admin/adminSections.ts`
- Modify: `src/features/admin/adminSections.test.ts`
- Modify: `src/features/admin/AdminRoute.tsx`
- Modify: `src/features/admin/AdminNav.tsx` (se necessário)
- Modify: `src/features/admin/admin.css`

**Interfaces**
- `AdminSectionId` ganha `"sanctions"` e `"metrics"`.
- `SECTIONS`: Sanções (staff) depois de Contas; Métricas (superadmin) antes de Auditoria.
- Rotas: `/admin/sancoes` → `<SanctionsSection>`; `/admin/metricas` → `<MetricsSection>` (na Task 5).
- `SanctionsSection`:
  - Abas/ filtro `status=active|revoked|all`, `kind`, busca por conta.
  - Lista com conta (nome/e-mail mascarado), tipo, motivo, prazo, autor; “Revogar” (superadmin) com `useConfirm`.
  - Cursor “Carregar mais”.

**Steps**
- [ ] Atualizar `adminSections.test.ts` (arrays exatos por papel).
- [ ] Teste vermelho da seção: staff vê; support não vê “Revogar”; superadmin revoga com confirmação; filtros resetam o cursor.
- [ ] Implementar seção, rota e navegação.
- [ ] Rodar `npm test`/`npm run lint`.
- [ ] Commit: `feat(admin): pagina de sancoes`

---

## Task 4: 2B — login bloqueado e aviso

**Files**
- Modify: `src/lib/auth.ts` (tipo do payload de erro/aviso)
- Modify: `src/App.tsx` (AuthModal e banner global)
- Modify: `src/App.css` ou `src/features/admin/admin.css` (banner)
- Create: `src/features/auth/sanctionNotice.ts` (helpers de texto)
- Create: `src/features/auth/sanctionNotice.test.ts`

**Interfaces**
- `SupabaseSession` ganha `warning?: SanctionNotice` (`{ kind: "warning"; reason; expiresAt }`).
- `apiToSession` copia `activeWarning` do login para a sessão.
- `ApiHttpError` com `code === "ACCOUNT_SANCTIONED"` no `AuthModal.submit`:
  - `kind === "ban"` → “Conta banida” + motivo + “Fale com o suporte”.
  - `kind === "suspension"` → “Conta suspensa até <data>” + motivo + link para `/conta/assinatura` quando não for ban.
  - Nunca mostrar detalhes técnicos.
- `AuthModal` renderiza um bloco `.auth-error`/`.auth-notice` estruturado.
- Banner de warning: depois de autenticar, se `session.warning`, mostrar `.auth-global-notice` dispensável na home; guardar “dispensado” em `localStorage` por usuário/sanção.

**Steps**
- [ ] Teste de helper: formata banimento/suspensão/expiração; não vaza PII.
- [ ] Teste do modal (mock de `signInWithPassword` lançando `ApiHttpError` com body) mostra o texto certo.
- [ ] Implementar o tratamento e o banner.
- [ ] Rodar `npm test`/`npm run lint`.
- [ ] Commit: `feat(admin): login bloqueado e aviso de sanção`

**Verify:** `qa-suspenso` vê “Conta suspensa até …” com motivo; `qa-leitor` com warning entra e vê o banner.

---

## Task 5: 2B — seed de QA

**Files**
- Modify: `deploy/storyverse-qa/seed-qa.sh`
- Modify: `deploy/storyverse-qa/test-guards.sh` (se precisar)
- Modify: `docs/QA.md`

**Interfaces**
- `seed-qa.sh` cria `qa-suspenso@example.com` (“Leitor suspenso”) com suspensão ativa de 30 dias:
  - `kind='suspension'`, `reason='Conta de teste do QA'`, `expires_at=now()+30 days`, `created_by` = id de `qa-admin@example.com` (se existir).
  - Idempotente: não duplica sanção ativa; se já existir uma ativa, mantém.
- `docs/QA.md` explica que a conta serve para conferir o login bloqueado e que não deve ser reativada sem reset.

**Steps**
- [ ] Ajustar o seed e rodar `bash deploy/storyverse-qa/test-guards.sh`.
- [ ] Rodar o seed no QA local/VPS e conferir `qa-suspenso` bloqueando.
- [ ] Commit: `feat(qa): conta suspensa no seed`

**Verify:** segunda execução do seed não cria outra sanção; reset-qa.sh recria a conta suspensa.

---

## Task 6: 2C — página de métricas

**Files**
- Create: `src/lib/adminMetrics.ts`
- Create: `src/features/admin/MetricsSection.tsx`
- Create: `src/features/admin/MetricsSection.test.tsx`
- Modify: `src/features/admin/AdminRoute.tsx` (rota `/admin/metricas`)
- Modify: `src/features/admin/admin.css` (tabelas/cards se necessário)

**Interfaces**
- `overviewMetrics(session, { from, to })`, `readingMetrics(session, { from, to, group })`, `retentionMetrics(session, { from, to })`.
- `MetricsSection`:
  - Filtro de período 7/30/90 dias (datas calculadas; envia `from`/`to`).
  - Cards: contas (total, novas 7, novas 30, confirmadas, staff), leitura (leitores ativos, minutos, iniciados, terminados, entradas).
  - Tabela de features (feature, contas com acesso).
  - Tabela de retenção (coorte, tamanho, D1, D7, D30) e série de leitura por dia/semana.
  - “Sem dados” quando a lista vier vazia; erro na seção.

**Steps**
- [ ] Teste vermelho: renderiza cards com fixture; troca de período refaz a chamada; estado vazio; erro.
- [ ] Implementar `adminMetrics.ts` e a seção; sem biblioteca de gráficos (tabela simples).
- [ ] Rodar `npm test`/`npm run lint`.
- [ ] Commit: `feat(admin): metricas de produto`

**Verify:** só superadmin vê a rota; moderator/support recebem “Sem permissão”; números conferem com o QA.

---

## Task 7: 2D — exportar auditoria em CSV

**Files**
- Modify: `src/lib/adminAudit.ts`
- Modify: `src/features/admin/AuditSection.tsx`
- Create/modify: `src/features/admin/AuditSection.test.tsx`
- Modify: `src/features/admin/admin.css` (se necessário)

**Interfaces**
- `exportAudit(session, filters): Promise<Blob>` → `GET /api/v1/admin/audit/export?...` com `apiFetch`; erro lê `{error,message}`.
- `AuditSection` ganha botão “Exportar CSV” ao lado de “Filtrar/Limpar”, desabilitado durante o download e quando o período não estiver preenchido.
- Download via `Blob` + `<a download>` como em `ImportsSection`; nome `auditoria-AAAA-MM-DD.csv`.
- Erros de validação (intervalo > 31 dias/limite) aparecem em `auth-error`.

**Steps**
- [ ] Teste vermelho: botão chama `exportAudit` com os filtros atuais; erro aparece; sucesso dispara o download.
- [ ] Implementar `exportAudit` com `apiFetch` e o componente.
- [ ] Rodar `npm test`/`npm run lint`.
- [ ] Commit: `feat(admin): exporta auditoria em csv`

**Verify:** CSV abre no Excel; filtros de ação/data são respeitados; `audit.export` aparece na lista.

---

## Task 8: fechamento e QA

- [ ] Atualizar `docs/QA.md` com o roteiro: Contas recentes/filtros, Sanções (aplicar/revogar aviso e suspensão), login de `qa-suspenso`, Métricas e exportação.
- [ ] Atualizar o painel `docs/qa/RESULTADOS.md` se a rodada encontrar defeitos.
- [ ] Rodar `npm run lint`, `npm test`, `npm run build` (com `VITE_API_URL`).
- [ ] Abrir PRs e validar no QA antes do merge.

## Ordem de deploy

1. 2A: Tasks 1 (web) + Task 2 (API) no mesmo ciclo.
2. 2B: Tasks 2-5 (web) + Tasks 3-4 (API), incluindo o seed.
3. 2C: Task 6 (web) + Task 5 (API).
4. 2D: Task 7 (web) + Task 6 (API).

Cada ciclo sobe para `develop`, é testado no QA e só então segue para o próximo. Financeiro fica fora até a fase de pagamentos.
