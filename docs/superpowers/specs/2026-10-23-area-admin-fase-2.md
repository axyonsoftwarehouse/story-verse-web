# Área do admin — Fase 2 — Operação e contas

Data: 23/10/2026. Repositórios: `story-magic` (web) e `story-verse-api` (API).

## 1. Por que agora

A Fase 1 entrou em produção/QA com Visão geral, Contas (busca e detalhe), Features, Moderação (acervo e fórum) e Auditoria. O feedback de uso mostrou três lacunas:

- é difícil achar uma conta sem já saber o e-mail, o UUID ou parte do nome;
- não existe forma de aplicar aviso, suspensão ou banimento sem mexer no banco;
- não há números de produto (contas, leitura, retenção, conversão) para acompanhar o lançamento.

A spec da Fase 1 deixou isso explicitamente para depois (seção 2, “não objetivos”). Esta fase fecha essas lacunas sem aumentar a superfície de risco: continua sem “entrar como” o usuário, sem apagar conta e sem dar/tirar `superadmin` pelo painel.

A assinatura mensal é uma frente separada: `2026-10-23-assinatura-mensal-stripe.md`. Esta spec só inclui o que o admin precisa ver dela.

## 2. Objetivos

1. **Contas:** listar as contas recentes e filtrar por papel, feature e situação da assinatura, com e-mail mascarado e paginação por cursor. A busca continua existindo.
2. **Sanções:** aplicar e revogar `warning`, `suspension` e `ban`, com motivo, prazo, registro na auditoria e bloqueio no login/API.
3. **Métricas:** uma visão de produto com contas, leitura, retenção e uso das features, sem expor dados pessoais.
4. **Auditoria:** exportar CSV com os filtros atuais, mantendo a auditoria somente leitura.
5. **Financeiro:** mostrar a situação da assinatura no detalhe da conta e uma seção `/admin/financeiro` somente leitura, conforme a spec de assinatura.

## 3. Não objetivos

- Apagar conta, trocar e-mail/senha ou “entrar como” outra pessoa.
- Dar ou tirar `superadmin` pelo painel; continua só por script na VPS.
- Central de notificações completa (a notificação da sanção pode ser gravada, mas a tela fica para a Fase 3).
- Moderação de resenhas públicas da estante (Fase 2 da biblioteca).
- Reembolsos, cancelamento e disputas do Stripe pelo painel; o MVP financeiro é somente leitura e aponta para o Stripe.
- Exportar a base de contas/e-mails. A lista é limitada e mascarada de propósito.
- Dashboard analítico complexo (funil, coortes avançadas, BI). Começamos com consultas diretas e cache curto.

## 4. Papéis

| Ação | superadmin | moderator | support |
|---|:-:|:-:|:-:|
| Ver a lista de contas recentes | ✓ | — | ✓ |
| Ver o detalhe da conta | ✓ | — | ✓ |
| Ver sanções no detalhe | ✓ | ✓ | ✓ |
| Aplicar/revogar sanção | ✓ | — | — |
| Ver a lista de sanções ativas | ✓ | ✓ | ✓ |
| Ver métricas de produto | ✓ | — | — |
| Exportar auditoria | ✓ | — | — |
| Ver financeiro (somente leitura) | ✓ | — | — |

Decisões:

- **Aplicar sanção é só do superadmin.** É uma ação de conta, com impacto no acesso; suporte pode ver o histórico para atender, mas não aplica.
- **Moderador pode ver sanções** para entender por que um conteúdo/usuário sumiu, mas não altera.
- **Financeiro é só do superadmin.** Um papel `finance` pode ser criado depois; nesta fase não ampliamos a lista de papéis.
- **Ninguém aplica sanção em si mesmo nem em outro superadmin.** Para tirar um superadmin, continua o script `demote-admin.sh`.

## 5. Contas

### 5.1 API

Novos endpoints em `/api/v1/admin/users`:

- `GET /recent?limit=20` — as contas mais recentes (máximo 50). Retorna `id`, `name`, `emailMasked`, `emailConfirmed`, `createdAt`, `lastSignInAt`, `roles`, `subscriptionStatus` (da spec de assinatura), sem e-mail completo.
- `GET ?q=&role=&feature=&subscription=&cursor=&limit=20` — busca/lista:
  - `q`: UUID, e-mail exato ou nome com pelo menos 3 caracteres (regra atual);
  - `role` e `feature`: filtros exatos;
  - `subscription`: `active`, `trialing`, `past_due`, `canceled`, `unpaid`, `none`;
  - cursor opaco por `created_at`/`id`, página máxima de 50.
- O detalhe atual (`GET /{id}`) ganha `sanctions` (histórico resumido) e `subscription` (status, plano, renovação, cancelamento agendado).

Regras de privacidade:

- A lista sempre mascara o e-mail (`we***@gmail.com`); o e-mail completo só aparece no detalhe, que é auditado (`user.view`).
- A busca/listagem continua com limite de uso por ator e não é auditada (evitar ruído). O detalhe continua auditado.
- A lista é ordenada por criação decrescente e limitada; não existe endpoint para “varrer tudo”.

### 5.2 Web

Em `/admin/contas`:

- Bloco “Contas recentes” (20) com nome, e-mail mascarado, papéis, assinatura e data de criação.
- Filtros: papel, feature, assinatura; campo de busca com o texto “UUID, e-mail completo ou parte do nome”.
- “Carregar mais” com cursor; estado vazio e erro na própria seção.
- Cada linha leva ao detalhe.
- O detalhe passa a mostrar: sanções (histórico e ação de aplicar/revogar, para superadmin) e assinatura (status, plano, renovação, link para `/admin/financeiro`).

## 6. Sanções

### 6.1 Modelo

Usar a tabela existente `public.user_sanctions` (V6):

| Campo | Uso |
|---|---|
| `kind` | `warning`, `suspension`, `ban` |
| `reason` | texto obrigatório |
| `expires_at` | obrigatório em `suspension`; nulo em `ban`; opcional em `warning` |
| `created_by` | superadmin que aplicou |
| `revoked_at` / `revoked_by` | revogação |
| `created_at` | quando começou |

Regras:

- `warning`: registra e retorna no login/detalhe; **não bloqueia**.
- `suspension`: bloqueia login/API até `expires_at`; expirada deixa de valer sem job.
- `ban`: bloqueia até ser revogado; `expires_at` nulo.
- Motivo é obrigatório; duração de suspensão é obrigatória.
- Aplicar `suspension`/`ban` revoga as sessões ativas da conta na mesma transação (`revokeActiveSessions`).
- Revogar preenche `revoked_at`/`revoked_by`; a conta volta a entrar (se não houver outra sanção ativa).
- Não é possível aplicar em si mesmo nem em superadmin; a API responde 403.
- Toda aplicação/revogação grava `sanction.create` / `sanction.revoke` na auditoria, com `{kind, expiresAt, reason}`.

### 6.2 Aplicação

Criar `SanctionService`:

- `activeSanction(userId)` devolve a sanção bloqueante ativa mais recente (`kind in ('suspension','ban')`, `revoked_at is null`, `expires_at is null or expires_at > now()`).
- `AuthService.login` e `AuthService.authenticate` consultam essa sanção:
  - login de conta suspensa/banida → 403 `ACCOUNT_SANCTIONED` com `{kind, reason, expiresAt}`;
  - requisições autenticadas com sanção bloqueante → 403 `ACCOUNT_SANCTIONED`.
- `warning` não bloqueia; aparece no login (mensagem curta) e no detalhe da conta.
- Para não consultar em toda requisição sem necessidade, usar cache curto (ex.: 30 s) por usuário; ao aplicar/revogar, invalidar. A fonte da verdade continua o banco.
- Funcionários (`superadmin`, `moderator`, `support`) não são alvo de sanção pelo painel; a remoção de papel continua por script.

### 6.3 API

- `POST /api/v1/admin/users/{id}/sanctions` — `{kind, reason, expiresAt?}`; só superadmin.
- `POST /api/v1/admin/sanctions/{id}/revoke` — revoga; só superadmin.
- `GET /api/v1/admin/users/{id}/sanctions` — histórico (staff).
- `GET /api/v1/admin/sanctions?status=active|revoked|all&kind=&cursor=` — lista para o painel (staff).
- O login (`POST /auth/login`) e o refresh (`POST /auth/refresh`) devolvem a sanção ativa quando bloqueiam.

### 6.4 Web

- No detalhe da conta: cartão “Sanções” com histórico (tipo, motivo, prazo, autor, revogação) e botão “Aplicar sanção” (superadmin).
- Modal de sanção: tipo, motivo (obrigatório), duração (1 dia, 7 dias, 30 dias, personalizada; banimento sem prazo), confirmação com o nome da conta.
- Revogar pede confirmação e motivo opcional; a lista atualiza.
- Rota `/admin/sancoes` para sanções ativas, com filtros por tipo e busca por conta; staff vê, superadmin revoga.
- Login bloqueado mostra “Conta suspensa até …” / “Conta banida” com o motivo e um contato de suporte; o painel de assinatura continua acessível para regularizar pagamento, se a sanção não for banimento.

## 7. Métricas

### 7.1 Definições iniciais

- **Contas:** total, novas em 7/30 dias, e-mail confirmado, contas com papel.
- **Leitura:** leitores ativos no dia (DAU), livros abertos e terminados, entradas na estante, minutos lidos (quando a fonte existir).
- **Retenção:** D1/D7/D30 por coorte de cadastro, usando último login/sessões; se a fonte não for confiável, começar com “ativos por semana”.
- **Features:** contas com cada feature ligada (catálogo atual).
- **Conversão:** assinaturas ativas/trial/past_due, MRR e churn vêm da spec de assinatura; aqui só o link.

Nada de PII: números agregados e, no máximo, filtros por papel/feature.

### 7.2 API

- `GET /api/v1/admin/metrics/overview?from=&to=` — cards de contas, leitura, features e assinatura (quando disponível).
- `GET /api/v1/admin/metrics/reading?from=&to=&group=day|week` — série para gráfico/tabela.
- `GET /api/v1/admin/metrics/retention?from=&to=` — coortes simples.
- Cache em memória de 5 minutos por intervalo; começar com consultas SQL diretas e índices. Materialized view só se a consulta ficar cara.
- Só superadmin.

### 7.3 Web

- `/admin/metricas` com cards e tabelas simples (sem biblioteca nova de gráficos; usar `dash-card`/tabelas existentes).
- Filtro de período (7/30/90 dias) e nota da fonte de cada número.
- Estado vazio explica que a métrica ainda não tem dados.

## 8. Auditoria

- Botão “Exportar CSV” em `/admin/auditoria`, respeitando os filtros atuais.
- Limite: 31 dias e 50.000 linhas por exportação; streaming; colunas `id, createdAt, actor, action, targetType, targetId, metadata`.
- A exportação é registrada como `audit.export` (ator, filtros e quantidade), para sabermos quem baixou o quê.
- Continua somente leitura; nenhum endpoint altera/apaga auditoria.
- Retenção inicial: 12 meses; a limpeza, se necessária, é operacional e documentada.

## 9. Financeiro (ligação)

O detalhe da conta mostra o status da assinatura e o painel ganha `/admin/financeiro` (somente leitura). O contrato completo, webhooks, checkout, portal e política de acesso estão em `2026-10-23-assinatura-mensal-stripe.md`.

## 10. Banco e migração

Migração `V17__admin_phase2.sql`:

- índices para a lista: `auth.users (created_at desc, id)`, `auth.users (last_sign_in_at)`;
- índice para sanções ativas: `user_sanctions (user_id, created_at desc) where revoked_at is null` (se ainda não existir um adequado);
- índice para filtros de feature: `feature_access (feature, enabled)`;
- view `admin_account_list` (security invoker) juntando conta, papéis agregados e status de assinatura, sem expor e-mail completo;
- nenhuma tabela nova para sanções (a V6 já tem `user_sanctions`).
- A migração de assinatura fica na spec própria (V18).

## 11. Web: rotas e navegação

Novas seções no `AdminNav`, por papel:

- `/admin/contas` e `/admin/contas/:id` (superadmin, support);
- `/admin/sancoes` (superadmin, moderator, support);
- `/admin/metricas` (superadmin);
- `/admin/financeiro` (superadmin).

Atualizar `visibleSections`/`adminSections.test.ts` e o roteiro de QA. O layout, os cartões e as confirmações seguem o da Fase 1.

## 12. Testes e QA

API:

- matriz de permissões para os endpoints novos;
- lista recente mascarada, paginação e filtros;
- sanção: aviso não bloqueia; suspensão bloqueia login/API; expiração; banimento; revogação; sessões revogadas; auto-sanção e superadmin bloqueados; auditoria;
- métricas: números coerentes com dados de teste e sem PII;
- exportação: limite, colunas, auditoria do export.

Web:

- lista recente, filtros, “carregar mais” e detalhe;
- modal de sanção, confirmações e revogação;
- métricas e exportação;
- visibility por papel (support vê contas; moderator não; métricas/financeiro só superadmin).

QA:

- `qa-admin`, `qa-moderador`, `qa-suporte`, `qa-leitor` e uma conta de teste suspensa (`qa-suspenso@example.com`, criada pelo seed com suspensão ativa);
- roteiro em `docs/QA.md`: lista recente, aplicar/revogar aviso e suspensão, conferir login bloqueado e auditoria.

## 13. Ordem de entrega

1. **2A — Contas:** lista recente, filtros, paginação e status da assinatura no detalhe.
2. **2B — Sanções:** modelo/serviço, aplicação no login/API, endpoints, UI e auditoria.
3. **2C — Métricas:** consultas, endpoints e tela.
4. **2D — Auditoria:** exportação CSV e retenção.
5. **2E — Financeiro:** somente leitura (depende da spec de assinatura).

Cada etapa é um PR (API e web) e passa pelo QA antes do `develop` → `main`.

## 14. Decisões abertas

- Suporte pode aplicar `warning` (sem bloqueio) ou só superadmin? A proposta é só superadmin.
- Podemos suspender um superadmin? A proposta é não; só script.
- Quais métricas entram no primeiro corte e qual a fonte de “minutos lidos”.
- Retenção de auditoria (12 meses) e de métricas agregadas.
- Criar papel `finance` ou manter só superadmin no financeiro.
- Notificação da sanção no app: banner no login agora, central completa na Fase 3.
