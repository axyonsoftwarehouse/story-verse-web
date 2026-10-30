# Spec — Grupos com chat

**Status:** proposta para implementação
**Data:** 30/10/2026
**Substitui:** o "clube do livro no fórum" da [SPEC_BIBLIOTECA_PESSOAL.md](SPEC_BIBLIOTECA_PESSOAL.md) (Fase 2). O fórum continua como está, mas não é a base da parte social nova.

---

## 1. Objetivo

Leitores criam grupos e conversam por mensagens em tempo real. Um grupo pode ser só de conversa ou um clube de leitura de um livro, com meta e progresso de cada membro. É a peça social que falta: hoje a única interação entre leitores é o fórum e os presentes do ranking.

## 2. Decisões de produto (30/10/2026)

| Tema | Decisão |
|---|---|
| Entrada | Grupos **públicos** (aparecem numa lista, qualquer um entra) e **privados** (só por link de convite). Qualquer conta cria. |
| Livro | **Opcional.** Com livro, o grupo ganha meta de leitura e o progresso dos membros. |
| Spoiler | Quem escreve pode **marcar o capítulo**; a mensagem aparece borrada para quem ainda não chegou lá. |
| v1 inclui | Texto, denúncia e moderação, contador de não lidas e reações com emoji. |
| Push | **Não usar Web Push** (exigiria chaves VAPID fora dos repositórios). O aviso de mensagem nova é o selo de não lidas e, com o app aberto em outra tela, uma notificação do navegador. |

## 3. Fora de escopo (v1)

- Imagens, áudio, arquivos e links com prévia.
- Mensagem direta entre duas pessoas (DM). Dá para fazer depois como grupo privado de 2.
- Editar mensagem (apagar a própria pode).
- Chamada de voz/vídeo.
- Web Push com o app fechado (ver seção 2).
- Busca dentro do histórico.

## 4. Modelo de dados (story-verse-api, migration nova)

```sql
create table public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 60),
  description text check (description is null or char_length(description) <= 300),
  visibility text not null check (visibility in ('public', 'private')),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- Livro opcional (gb:/cm:/cat:), com título/capa como snapshot para a lista.
  book_key text check (book_key is null or book_key ~ '^(gb|cm|cat):'),
  book_title text,
  book_cover text,
  -- Meta do clube: até qual capítulo e até quando (opcional).
  goal_chapter integer check (goal_chapter is null or goal_chapter > 0),
  goal_until date,
  invite_code text not null unique,           -- token aleatório; trocar invalida o link antigo
  member_count integer not null default 0,
  last_message_at timestamptz,
  deleted_at timestamptz,                     -- grupo apagado pelo dono ou pela moderação
  created_at timestamptz not null default now()
);

create table public.chat_members (
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  last_read_id bigint not null default 0,     -- contador de não lidas
  muted boolean not null default false,       -- sem aviso deste grupo
  banned_at timestamptz,                      -- removido pelo dono: não volta pelo link
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.chat_messages (
  id bigint generated always as identity primary key,  -- ordem e cursor
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  spoiler_chapter integer check (spoiler_chapter is null or spoiler_chapter > 0),
  reply_to bigint references public.chat_messages (id) on delete set null,
  client_id uuid not null,                    -- idempotência de reenvio
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (author_id, client_id)
);
create index on public.chat_messages (group_id, id desc);

create table public.chat_reactions (
  message_id bigint not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🔥')),
  primary key (message_id, user_id, emoji)
);

create table public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  message_id bigint not null references public.chat_messages (id) on delete cascade,
  reason_code text not null check (reason_code in ('spam', 'abuso', 'assedio', 'spoiler', 'outro')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'actioned', 'dismissed')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, message_id)
);

```

RLS em todas, no padrão do fórum (V7): só membros não banidos leem as mensagens e os membros do grupo; grupos públicos aparecem na lista para qualquer conta; escrever exige ser membro. As mesmas sanções de conta do fórum (V18) bloqueiam enviar mensagem e criar grupo.

O progresso dos membros no clube vem de `library_entries` (`progress_percent`) e de `reading_state` (capítulo atual), só para quem está no grupo. Para o borrão de spoiler, o cliente compara `spoiler_chapter` com o capítulo do próprio leitor.

## 5. API

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/api/v1/groups?scope=mine\|public&q=` | Meus grupos (com não lidas e última mensagem) ou lista pública |
| `POST` | `/api/v1/groups` | Cria grupo; quem cria vira `owner` |
| `GET` | `/api/v1/groups/{id}` | Detalhe, membros e progresso no livro |
| `PATCH` | `/api/v1/groups/{id}` | Dono edita nome, descrição, livro, meta e visibilidade |
| `DELETE` | `/api/v1/groups/{id}` | Dono apaga o grupo |
| `POST` | `/api/v1/groups/{id}/join` | Entrar em grupo público |
| `POST` | `/api/v1/groups/join/{inviteCode}` | Entrar por convite |
| `POST` | `/api/v1/groups/{id}/invite/rotate` | Dono troca o link de convite |
| `POST` | `/api/v1/groups/{id}/leave` | Sair (o dono precisa passar a posse ou apagar) |
| `DELETE` | `/api/v1/groups/{id}/members/{userId}` | Dono/moderador remove membro (`banned_at`) |
| `GET` | `/api/v1/groups/{id}/messages?before=` | Histórico paginado por `id` (50 por página) |
| `POST` | `/api/v1/groups/{id}/messages` | Envia (`body`, `spoilerChapter`, `replyTo`, `clientId`) |
| `DELETE` | `/api/v1/groups/{id}/messages/{msgId}` | Autor, dono ou moderador apaga |
| `PUT`/`DELETE` | `/api/v1/groups/{id}/messages/{msgId}/reactions/{emoji}` | Reagir / tirar reação |
| `POST` | `/api/v1/groups/{id}/read` | Marca como lido até `lastId` |
| `POST` | `/api/v1/groups/messages/{msgId}/report` | Denuncia mensagem |
| `GET` | `/api/v1/groups/stream` | **SSE único por conta** com os eventos de todos os grupos dela |
| `GET`/`POST` | `/api/v1/admin/groups/reports…` | Fila de denúncias no painel, no molde de `ForumAdminController` |

### 5.1 Tempo real

- **Um SSE por conta, não um por grupo.** O `PresenceService` limita a 500 conexões no total; uma conexão por grupo esgotaria isso rápido. O stream manda `message`, `message_deleted`, `reaction` e `member` de todos os grupos da pessoa.
- O envio é `POST` comum. O servidor grava e só depois publica no stream (o banco é a fonte da verdade). Ao reconectar, o cliente pede `messages?after=<último id>` para cobrir o buraco.
- Hoje é uma instância só da API na VPS, então um mapa em memória basta (como no presence). Com mais de uma instância, trocar por `LISTEN/NOTIFY` do Postgres. Fica anotado, não entra na v1.

### 5.2 Avisos sem push

Sem Web Push, os avisos dependem do app aberto:

- selo de não lidas em "Grupos" na navegação e em cada grupo (vem de `last_read_id`);
- com o app aberto em outra tela e permissão do navegador, `Notification` local ao chegar evento do stream (no máximo 1 por grupo a cada 5 minutos, nunca para grupo silenciado nem para o grupo aberto na tela).

### 5.3 Limites e abuso

- 20 mensagens por minuto por conta; 5 grupos criados por dia; no máximo 50 grupos por conta.
- Grupo com até 200 membros na v1.
- Conta com menos de 24 h não cria grupo público (mesma regra de idade mínima dos presentes).
- Mensagem com 3 denúncias pendentes de contas diferentes fica oculta até a moderação revisar.

## 6. Frontend (story-verse-web)

| Arquivo | Função |
|---|---|
| `src/lib/groups.ts` | Cliente da API e do stream SSE (reconexão com `after`) |
| `src/features/groups/GroupsHome.tsx` | Meus grupos (não lidas, última mensagem) + explorar públicos + criar |
| `src/features/groups/GroupChat.tsx` | Conversa: histórico com rolagem infinita, envio otimista, reações, responder, spoiler, denunciar |
| `src/features/groups/GroupInfo.tsx` | Membros, progresso no livro, meta, convite, sair, moderação do dono |
| `src/features/groups/CreateGroupDialog.tsx` | Nome, descrição, público/privado, livro opcional e meta |
| `src/features/admin/GroupReports.tsx` | Aba de denúncias no painel |

- Entrada pela navegação principal ("Grupos"), com selo de não lidas.
- Link de convite: `/g/<inviteCode>`. Sem conta, pede login e volta para o convite.
- Na página do livro: "Grupos lendo este livro" (públicos) e "Criar clube deste livro".
- Liberação por conta pelo feature-gate (`feature_access`, capability `groups`), como foi a estante.

## 7. Entregas

1. **API — base:** migration, grupos, membros, mensagens, histórico, RLS e testes de integração.
2. **API — tempo real e social:** SSE, reações, não lidas, denúncias e fila no admin.
3. **Web — chat:** lista, conversa, criar, convite, spoiler, reações, denúncia, não lidas, avisos com o app aberto, aba no admin.
4. **Clube do livro:** livro e meta no grupo, progresso dos membros, atalhos na página do livro.

Tudo vai numa branch só por repositório (`feat/grupos-e-engajamento`). Liberar primeiro para contas de teste pelo feature-gate.

## 8. Métricas

- Contas com pelo menos 1 grupo; mensagens por dia; grupos com atividade nos últimos 7 dias.
- Retenção D7/D30 de quem está em grupo comparada à de quem não está.
- Convites aceitos (quantas contas novas chegaram por `/g/`).
- Denúncias por 1.000 mensagens.

## 9. Riscos

- **Moderação:** grupo público é conteúdo de usuário em tempo real. Denúncia, ocultação automática e remoção pelo dono entram desde a v1.
- **Menores de idade:** conversa entre desconhecidos. Avaliar idade mínima para grupos públicos.
- **Carga do SSE:** conexões abertas na VPS (0,5 CPU no QA). Medir antes de liberar para todo mundo.
- **LGPD:** mensagens entram na exportação e na exclusão de conta (apagar a conta apaga as mensagens dela).
