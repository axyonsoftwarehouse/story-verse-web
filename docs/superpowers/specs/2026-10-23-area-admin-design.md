# Área do admin — Fase 1 — Design

Data: 23/10/2026. Repositórios: `story-magic` (web) e `story-verse-api` (API).

## 1. Por que agora

O PR 49 (estante web, Fase 1) está em QA. A Fase 2 da biblioteca depende do resultado do QA e do uso real,
então este é o momento de cuidar do que fica em volta do produto.

Hoje, quase toda operação de administrador passa por SSH na VPS:

- liberar a estante (`library`) para uma conta: `deploy/grant-feature.sh <uuid>`;
- promover alguém: `deploy/promote-admin.sh <uuid>`;
- ver quem fez o quê: `psql` direto em `admin_audit_log`;
- saber se o backup rodou: `psql` em `backup_runs`.

A moderação está espalhada. A do acervo fica dentro do perfil (`ModerationPage` em `src/App.tsx`), e a do
fórum fica em `/admin` (`ForumModeration`). O `/admin` mostra cartões "Em construção" para Visão geral,
Usuários, Moderação e Auditoria.

Além disso, existem duas fontes de papel. A V6 criou `user_roles` (superadmin, moderator, support), mas
`public.admins` continua sendo lida:

- `is_admin()` = superadmin **ou** linha em `admins`;
- `is_staff()` também olha `admins`;
- `StorageAccess.admin` (API) olha **só** `admins` (relatório de segurança de 21/10, item 2 das
  inconsistências). Um superadmin criado só em `user_roles` não lê os textos pendentes do acervo.

**Sucesso desta fase:** liberar a estante para um beta tester, moderar o acervo e o fórum, e conferir a
auditoria sem abrir um terminal. Toda ação feita no painel fica auditada, e o servidor continua sendo quem
autoriza.

## 2. Objetivos, não objetivos e anti-objetivos

### Objetivos

1. **Uma fonte de papéis:** `user_roles`. `admins` deixa de ser lida.
2. **Painel com seções:** Visão geral, Contas, Moderação (acervo + fórum) e Auditoria, em `/admin/*`.
3. **Contas:** achar uma conta, ver o essencial, ligar/desligar features, dar e tirar os papéis
   `moderator` e `support`, e encerrar as sessões da conta.
4. **Features:** ver quem tem cada feature (acompanhar o lançamento gradual da estante).
5. **Moderação do acervo dentro do `/admin`,** com as mesmas ações de hoje, e sem perder o "ler o envio".
6. **Auditoria:** lista filtrável e paginada de `admin_audit_log`, só leitura.
7. **Toda ação administrativa auditada na mesma transação da ação.**

### Não objetivos (ficam para depois)

- **Sanções (aviso, suspensão, banimento).** A tabela `user_sanctions` existe, mas nada na API aplica uma
  sanção. Só vale fazer a tela junto com a aplicação no login e no fórum, num trabalho próprio.
- Central de notificações (`notifications`).
- Métricas de produto e analytics (leitura, retenção, receita).
- Apagar conta, trocar e-mail ou senha de outra pessoa, "entrar como" o usuário.
- Dar ou tirar `superadmin` pelo painel (continua só por script, veja 4.3).
- Moderar resenhas públicas da estante (é Fase 2 da biblioteca; deve reaproveitar este painel).
- Versão mobile específica. A tela precisa funcionar no celular, mas sem fluxo próprio.

### Anti-objetivos (seria fracasso mesmo funcionando)

- A UI decidir permissão. Esconder botão é só conforto. Todo endpoint confere o papel no servidor, e o RLS
  continua valendo.
- Uma ação administrativa sem linha na auditoria, ou uma linha de auditoria de ação que não aconteceu.
- Um admin conseguir se trancar para fora, ou o sistema ficar sem nenhum superadmin.
- Expor e-mails em listas de forma ampla, ou permitir varrer a base de contas.
- Um botão que parece fazer algo e não faz (por isso as sanções ficam de fora).
- Duas telas de moderação do acervo convivendo.

## 3. Papéis e o que cada um faz

| Ação | superadmin | moderator | support |
|---|:-:|:-:|:-:|
| Entrar no `/admin` e ver a visão geral | ✓ | ✓ | ✓ |
| Moderar acervo (aprovar, recusar, capa, apagar) | ✓ | ✓ | — |
| Moderar fórum (denúncias, tópicos, respostas) | ✓ | ✓ | — |
| Ver as filas do fórum (só leitura, como já é hoje) | ✓ | ✓ | ✓ |
| Buscar e ver contas | ✓ | — | ✓ |
| Encerrar as sessões de uma conta | ✓ | — | ✓ |
| Ligar/desligar features de uma conta; ver quem tem cada feature | ✓ | — | — |
| Dar/tirar `moderator` e `support` | ✓ | — | — |
| Dar/tirar `superadmin` | só script na VPS | — | — |
| Ver auditoria | ✓ | — | — |

Decisões e motivos:

- **Moderador passa a moderar o acervo.** Hoje o acervo é só do admin, e o fórum já aceita moderador. Ter
  dois sentidos para "moderador" confunde. Isso amplia permissão, então vem em função nova (veja 4.1), e não
  mudando `is_admin()`.
- **Suporte vê contas e encerra sessões, mas não mexe em papéis nem em features.** É o perfil de quem ajuda
  um leitor ("não consigo entrar", "meu celular foi roubado").
- **`superadmin` não é dado nem tirado pelo painel.** O estrago de um token de superadmin roubado fica
  limitado: ele não cria outro superadmin. E ninguém se tranca para fora sem querer. O `promote-admin.sh`
  ganha a operação inversa (4.3).
- **As permissões do fórum não mudam nesta fase** (decisão do redator). Hoje o `ForumService` libera a
  leitura das filas para `is_staff()`, o que inclui suporte, e exige superadmin ou moderador para agir. Fica
  assim. Para suporte, a seção do fórum aparece só para leitura, sem os botões de ação.
- Uma conta pode ter mais de um papel; vale a soma.

## 4. Mudanças por parte

### 4.1 Fundação de papéis (API, migration V16)

- `public.can_moderate()` (`security definer`, `stable`): `has_role('superadmin') or has_role('moderator')`.
- `is_admin()` passa a ser só `has_role('superadmin')`. `is_staff()` deixa de olhar `admins`.
- Antes disso, a migration copia de novo `admins` → `user_roles` como superadmin (idempotente). Ninguém perde
  acesso.
- As políticas de `book_submissions` que usam `is_admin()` estão no schema base
  (`story-magic/database/schema.sql:205-219`), não em migrations. A V16 recria essas políticas (`drop policy
  if exists` + `create policy`) trocando `is_admin()` por `can_moderate()`. Na VPS, o acesso ao bucket
  `community-books` é decidido em Java, não por política. `supabase/community-books.sql` é legado e não
  muda.
- `StorageAccess.admin` (API) é dividido em dois:
  - **`community-books` (ler e apagar textos de envios):** passa a usar `can_moderate()`;
  - **apagar capas de outros em `profile-media/*/livros/*`:** continua só superadmin, por `has_role`
    (decisão do redator, para não deixar o moderador apagar arquivos de qualquer usuário). Quando um
    moderador troca a capa de um envio, a capa antiga pode ficar órfã no storage. Aceitável nesta fase.
- `CommunityService.isAdmin` passa a usar `can_moderate()` e muda de nome para `canModerate`.
- `admins` fica congelada: ninguém lê nem escreve, e `promote-admin.sh` para de inserir nela. A remoção
  fica para uma migration futura, depois de uma versão em produção sem uso. O builder confirma com `grep`
  nos dois repositórios que não sobrou leitura.
- O frontend para de chamar `rpc/is_admin` (`checkIsAdmin` em `community.ts`) e usa os papéis de
  `/api/v1/auth/capabilities`, que o `AdminRoute` já usa.

### 4.2 Proteções de papéis (API)

Ao dar ou tirar papel pelo painel:

- só `moderator` e `support` são aceitos. `superadmin` responde 400;
- a conta alvo precisa ter e-mail confirmado para **receber** papel;
- ninguém altera os próprios papéis pelo painel (403);
- cada mudança grava `role.grant` / `role.revoke` com o papel.

### 4.3 Scripts na VPS

- `promote-admin.sh`: grava só em `user_roles` (+ auditoria). Para de usar `admins`.
- Novo `demote-admin.sh <uuid>`: tira `superadmin`. Recusa se for o último superadmin. Audita
  `admin.demote`.
- `grant-feature.sh` continua existindo como plano B, mas o caminho normal passa a ser o painel.

### 4.4 Auditoria na mesma transação

Hoje `FeatureAdminController` chama `features.set(...)` e depois `authz.audit(...)` em transações
separadas. Se a auditoria falhar, a feature fica alterada sem registro. Regra desta fase: **ação e
auditoria na mesma transação**, em toda ação do painel. A moderação do fórum e a revisão do acervo já
fazem isso. Falta corrigir as features, e todo endpoint novo já nasce assim. Se a auditoria falhar, a ação
é desfeita.

Ações hoje sem auditoria que passam a ter: apagar envio do acervo (`book_submission.delete`) e trocar a capa
de um envio (`book_submission.cover`). **Só quando quem age não é o dono do envio.** O dono continua
podendo apagar o próprio envio pendente e trocar a capa sem gerar auditoria, até porque a política de
insert em `admin_audit_log` só aceita `is_staff()`.

Arquivos não voltam com rollback. Ao apagar um envio, apaga a linha e grava a auditoria na transação, e
só **depois do commit** apaga os arquivos no storage (por exemplo, com `TransactionSynchronization.afterCommit`).
Se apagar o arquivo falhar, registra o erro em log e segue, porque arquivo órfão é melhor que linha órfã. O
`dropObject` que o frontend chama depois continua inofensivo.

### 4.5 Contas (API)

Endpoints novos em `/api/v1/admin/users` (superadmin ou support, salvo indicação):

- **Busca** `GET ?q=`: aceita UUID exato, **e-mail exato** (normalizado com `lower`) ou parte do nome
  (mínimo 3 caracteres). No máximo 20 resultados. Na lista, o e-mail vem mascarado (`we***@gmail.com`).
  Sem listagem de todas as contas sem filtro. A busca tem limite de uso por ator (o mesmo `RateLimitGate`
  da API). Não é auditada por padrão (seria ruído), mas abrir o detalhe é (`user.view`).
- **Detalhe** `GET /{id}`: nome, e-mail completo, e-mail confirmado (sim/não), criado em, último login,
  papéis, features e número de sessões ativas, mais as 20 últimas entradas da auditoria com essa conta
  como alvo (essa parte só para superadmin).
- **Encerrar sessões** `POST /{id}/sessions/revoke`: marca `revoked_at` em todas as sessões ativas. Audita
  `user.sessions.revoke` com a quantidade. Pede confirmação na UI.
- **Papéis** `PUT /{id}/roles/{role}` e `DELETE /{id}/roles/{role}`: só superadmin, com as regras de 4.2.
- **Features da conta:** reaproveita `PUT /api/v1/admin/features`, que já existe.

Endpoints novos em `/api/v1/admin/features` (só superadmin):

- `GET /catalog`: as features conhecidas (hoje o `KNOWN` do `FeatureAccessService`, só `library`), com
  quantas contas têm cada uma ligada.
- `GET /{feature}/users`: quem tem a feature ligada (nome, e-mail mascarado, quem concedeu, quando), com
  paginação por cursor.

### 4.6 Visão geral (API)

`GET /api/v1/admin/overview` devolve só o que o papel do ator pode ver:

- moderação (superadmin, moderator): envios pendentes no acervo, denúncias abertas no fórum;
- contas (superadmin, support): total de contas e novas nos últimos 7 dias;
- features (superadmin): contas por feature;
- operação (superadmin): último backup (`backup_runs`: status, quando terminou, tamanho) e alerta se o
  último sucesso tiver mais de 26 horas.

### 4.7 Auditoria (API)

`GET /api/v1/admin/audit` (só superadmin; o RLS já restringe): filtros por ação, ator, tipo e id do alvo,
e período. Mais novo primeiro. Paginação por cursor (`id` decrescente), 50 por página. Junta o nome do ator.
`actor_id` nulo aparece como "script na VPS". É só leitura: nenhum endpoint altera ou apaga a auditoria.

### 4.8 Painel (web)

- **Estrutura:** `/admin` vira um layout com navegação lateral (abas no topo no celular) e sub-rotas
  `/admin`, `/admin/contas`, `/admin/contas/:id`, `/admin/features`, `/admin/moderacao/acervo`,
  `/admin/moderacao/forum` e `/admin/auditoria`. Cada item só aparece para quem tem o papel (tabela da
  seção 3). Rota sem permissão mostra "Sem permissão", sem quebrar.
- **Código:** tudo em `src/features/admin/`, um arquivo por seção, e clientes de API em `src/lib/admin*.ts`,
  seguindo o padrão de `adminForum.ts`. Usa o CSS e os componentes que já existem (`shelf`,
  `profile-card`, `dash-card`, `btn`), sem biblioteca nova de UI.
- **Moderação do acervo:** `ModerationPage` sai de `App.tsx` (hoje com 9 mil linhas) para
  `src/features/admin/`. O cartão "Moderação do acervo" do perfil vira um link para
  `/admin/moderacao/acervo`, e só aparece para quem pode moderar. O botão de **ler o envio** precisa
  continuar funcionando. Hoje ele usa o leitor que vive no estado do `App`. O builder escolhe como fazer
  (por exemplo, navegar para o leitor com o envio carregado), mas não pode ser removido.
- **Ações destrutivas ou sensíveis** (encerrar sessões, tirar papel, desligar feature, apagar envio) pedem
  confirmação com o nome da conta ou do livro na mensagem.
- **Erros:** 403 vira "Sem permissão para esta ação". Outros erros aparecem como mensagem na própria seção,
  sem derrubar o painel.

## 5. Ordem de entrega

1. **API** (`story-verse-api`): V16 + fundação de papéis, auditoria transacional, endpoints de contas,
   features, visão geral e auditoria, com testes. Publicada no QA.
2. **Scripts** (`story-magic/deploy`): `promote-admin.sh` ajustado e `demote-admin.sh`.
3. **Web** (`story-magic`): layout e seções, depois a migração da moderação do acervo.

São dois PRs, um por repositório. O da web só entra depois que a API estiver no QA.

## 6. Testes e QA

- **API:** testes de autorização para cada endpoint e papel (a tabela da seção 3 vira casos de teste),
  inclusive o 403 do `moderator` em contas e do `support` em papéis. Também: as regras de 4.2, a reversão
  quando a auditoria falha, o e-mail mascarado na busca e a migração `admins` → `user_roles` sem perda.
- **Web:** testes das funções puras (por exemplo, a lista de seções visíveis por papel). Fluxos validados no
  QA.
- **QA:** o `seed-qa.sh` ganha contas `qa-moderador@example.com` (moderator) e `qa-suporte@example.com`
  (support), além do `qa-admin` que já existe. O `docs/QA.md` ganha um roteiro do painel por papel.

## 7. Restrições

- A API roda com o papel `storyverse_api`, sujeita a RLS. Nada de `bypassrls`. O `RuntimeRoleGuard`
  continua valendo.
- O frontend fala com a API só por `/api/v1/**`. Nenhum segredo em `VITE_*`.
- Migrations com Flyway (V16 em diante), idempotentes como as anteriores.
- O texto da UI é em português, no mesmo tom do resto do app.

## 8. Deixado para o builder

- Nomes exatos de classes, DTOs e componentes, e a forma da paginação por cursor (seguindo o `ForumCursor`,
  o único helper de cursor da API hoje).
- A branch da API: partir da `main` do `story-verse-api` (o checkout local está em `feat/ambiente-qa`).
- Como manter o "ler o envio" funcionando fora do `App`.
- O desenho visual do layout, dentro do CSS existente.
- Se a busca por nome usa `raw_user_meta_data->>'name'` ou `ranking_profiles.name`. O fórum usa a
  primeira.
