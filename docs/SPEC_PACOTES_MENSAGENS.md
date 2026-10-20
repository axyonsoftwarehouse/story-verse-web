# Spec — Pacotes de mensagens extras (Fase 2)

**Status:** proposta para implementação  
**Data:** 20/10/2026  
**Depende de:** Fase 0 (cota de IA no servidor) e Fase 1 (débito de diamantes/presentes), ambas já implementadas  
**Documento relacionado:** [PLANO_NEGOCIO_FEATURES_IA.md](PLANO_NEGOCIO_FEATURES_IA.md)

---

## 1. Objetivo

Permitir que o leitor compre mensagens extras de IA com diamantes quando a cota gratuita do dia acabar, sem tornar o limite burlável pelo cliente.

O crédito é **do servidor**: o navegador só exibe o saldo e pede a compra/consumo. O banco debita os diamantes e credita as mensagens na mesma transação.

## 2. Fora de escopo

- Compra de diamantes com dinheiro (IAP/loja).
- Assinatura ou plano mensal.
- Tradução, Lore e dicas (Fases 3–5).
- BYOK (chave de IA do usuário).
- Crédito transferível entre contas.
- Expiração de créditos nesta fase.

## 3. Dependências e pré-requisitos

- `AiBudget.reserve` já aplica cota diária por conta, limite por minuto, concorrência e teto global.
- `apply_diamonds` já é idempotente por `(user_id, reason, ref)` e trava a carteira.
- O extrato já aceita motivos novos; a Fase 1 adicionou `gift_sent`.
- **Ordem de migration:** a V10 depende da V9 (já na `main`) e precisa preservar `gift_sent` no `check` de `diamond_ledger_reason_check`.
- O cliente precisa enviar um `requestId` por mensagem para que o consumo de crédito seja idempotente em retries.

## 4. Modelo de dados

### 4.1 Catálogo de pacotes

```sql
create table if not exists public.ai_pack_catalog (
  id text primary key,
  name text not null check (char_length(name) between 1 and 60),
  messages integer not null check (messages > 0),
  price integer not null check (price > 0),
  active boolean not null default true,
  sort_order integer not null default 0
);
```

Seed proposto:

| id | Nome | Mensagens | Diamantes | Preço por mensagem |
| --- | --- | ---: | ---: | ---: |
| `msg20` | Pacote de 20 | 20 | 30 | 1,5 |
| `msg50` | Pacote de 50 | 50 | 60 | 1,2 |
| `msg100` | Pacote de 100 | 100 | 100 | 1,0 |

Os valores são uma decisão de produto; a spec assume esses como padrão inicial. Ajustar depois pelas métricas de gasto/emissão.

### 4.2 Saldo de créditos

```sql
create table if not exists public.ai_credits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
```

### 4.3 Extrato de créditos

```sql
create table if not exists public.ai_credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  reason text not null check (reason in ('pack_purchase', 'message_use', 'adjustment')),
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
```

### 4.4 Motivo no extrato de diamantes

Adicionar `ai_message_pack` ao `check` de `diamond_ledger.reason`, preservando os motivos existentes:

```sql
check (reason in (
  'ranking', 'reading_goal', 'streak_freeze', 'daily_spin',
  'purchase', 'adjustment', 'gift_sent', 'ai_message_pack'
));
```

### 4.5 Métricas

Adicionar `source` em `ai_usage_events` para separar chamadas pagas pela cota gratuita das pagas por crédito:

```sql
alter table public.ai_usage_events
  add column if not exists source text
  check (source is null or source in ('free', 'credit'));
```

`source` fica `null` em eventos de bloqueio (`budget_blocked`), onde não houve chamada ao provedor.

Também é útil registrar `credits_after` no evento, para auditoria de custo/consumo. Não registrar conteúdo.

```sql
alter table public.ai_usage_events
  add column if not exists credits_after integer not null default 0
  check (credits_after >= 0);
```

## 5. RPCs e funções do banco

### 5.1 `ai_pack_catalog()`

Leitura pública para usuários autenticados. Retorna apenas pacotes ativos, ordenados por `sort_order`, `price`.

```sql
returns table (id text, name text, messages integer, price integer)
```

### 5.2 `buy_ai_pack(p_pack text, p_ref text)`

Compra um pacote. Tudo ou nada:

1. Exige `auth.uid()`.
2. Valida `p_ref` (8–80 caracteres).
3. Se `p_ref` já existe para o usuário em `ai_credit_ledger` com motivo `pack_purchase`, devolve o resultado sem cobrar de novo (`duplicate = true`).
4. Busca o pacote ativo.
5. Chama `apply_diamonds(uid, -price, 'ai_message_pack', p_ref)`; se faltar saldo, a exceção desfaz a transação.
6. Cria/atualiza `ai_credits` com `balance = balance + messages`.
7. Insere `ai_credit_ledger` com `amount = +messages`, `reason = 'pack_purchase'`, `ref = p_ref`.
8. Devolve saldo de diamantes, saldo de créditos e quantidade comprada.

Retorno:

```sql
returns table (
  diamond_balance integer,
  credits_balance integer,
  messages integer,
  duplicate boolean
)
```

### 5.3 `consume_ai_credit(p_ref text)`

Uso **interno** do servidor, não exposto na lista branca de RPC do cliente.

1. Exige `auth.uid()`.
2. Se já existe `message_use` com o mesmo `p_ref`, devolve o saldo sem consumir de novo (`duplicate = true`).
3. Trava `ai_credits` (`select ... for update`).
4. Se `balance <= 0`, devolve `consumed = false`.
5. Decrementa 1, grava `ai_credit_ledger` com `amount = -1`, `reason = 'message_use'`, `ref = p_ref`.
6. Devolve `consumed`, `credits_balance` e `duplicate`.

Retorno:

```sql
returns table (consumed boolean, credits_balance integer, duplicate boolean)
```

A função deve ser `security definer` e ter `execute` apenas para `storyverse_api` (não para `authenticated` sozinho), para o cliente não conseguir queimar créditos fora do fluxo de IA.

### 5.4 `my_ai_quota()`

Leitura do estado do dia + créditos:

```sql
returns table (
  daily_limit integer,
  used integer,
  free_remaining integer,
  credits integer,
  day date,
  resets_at timestamptz
)
```

## 6. Contratos da API

### 6.1 `GET /api/v1/ai/quota`

Resposta:

```json
{
  "limit": 50,
  "used": 50,
  "remaining": 0,
  "credits": 20,
  "day": "2026-10-20",
  "resetsAt": "2026-10-21T03:00:00Z"
}
```

### 6.2 `POST /api/v1/ai/reply`

Corpo ganha `requestId` opcional:

```json
{
  "system": "...",
  "messages": [{ "role": "user", "content": "..." }],
  "maxTokens": 250,
  "requestId": "uuid-gerado-pelo-cliente"
}
```

Resposta:

```json
{
  "text": "...",
  "remaining": 0,
  "limit": 50,
  "credits": 19,
  "source": "credit"
}
```

Regras:

- A cota gratuita é tentada primeiro (`source = "free"`).
- Se a cota gratuita acabou, tenta consumir 1 crédito (`source = "credit"`).
- Se não há crédito, responde `429` com código `AI_QUOTA_EXHAUSTED` e `credits: 0`.
- Se o teto global/modo economia estiver ativo, responde `429` com `AI_BUDGET_EXHAUSTED` **sem consumir crédito**.
- `requestId` é obrigatório para consumo de crédito. Sem ele, o servidor gera um UUID — o retry do cliente não será idempotente; documentar que o frontend sempre envia.
- Em falha do provedor depois do consumo, o crédito continua consumido nesta fase (mesma política da cota gratuita). Reembolso automático fica como decisão futura.

### 6.3 RPCs públicas

| RPC | Uso |
| --- | --- |
| `ai_pack_catalog` | Listar pacotes ativos |
| `buy_ai_pack` | Comprar pacote com diamantes |
| `my_ai_quota` | Consultar cota + créditos (alternativa ao endpoint) |

`consume_ai_credit` **não** entra na lista branca do `RpcService`.

## 7. Mudanças no backend

### `AiBudget.java`

- `reserve` passa a receber `(UUID user, String requestId)`.
- Primeiro tenta a cota gratuita como hoje.
- Se a cota gratuita falhar:
  - chama `consume_ai_credit(:ref)` via SQL;
  - se `consumed = false`, lança `AI_QUOTA_EXHAUSTED`;
  - se consumir, segue com `source = "credit"`.
- Ordem interna: tentar a cota gratuita; se ela falhar, verificar o teto global; se houver espaço, consumir 1 crédito. O crédito só é consumido depois que o teto global aceitou a chamada. Se o teto global falhar, a transação da cota gratuita volta e o crédito **não** é consumido.
- `AiQuota` ganha `credits` e o resultado interno ganha `source`.
- A semântica de concorrência e limite por minuto não muda.

### `AiController.java`

- `AiReplyRequest` ganha `requestId`.
- `/quota` devolve `credits`.
- `/reply` devolve `source` e `credits`.
- Métricas passam a registrar `source` e `credits_after`.

### `RpcService.java`

Adicionar à lista branca:

- `ai_pack_catalog`
- `buy_ai_pack`
- `my_ai_quota`

Não adicionar `consume_ai_credit`.

## 8. Mudanças no frontend

### `src/lib/usageLimit.ts`

- Guardar `credits` junto do restante gratuito.
- `messagesLeftToday()` continua sendo o restante **gratuito**.
- Nova função `extraMessages()` para créditos.
- `applyServerQuota(remaining, limit, credits)` atualiza os dois valores.
- `countMessage()` continua como fallback local; a resposta do servidor sobrescreve o estado.

### `src/lib/ai.ts`

- `characterReply` recebe `requestId` e envia no corpo.
- Após `/reply`, atualiza cota gratuita e créditos.
- `refreshAiQuota` lê `credits`.
- Erros `429` com `AI_QUOTA_EXHAUSTED` devem ser exibidos como “acabaram as mensagens”, não como falha de rede.

### `src/lib/aiPacks.ts` (novo)

- Tipos `AiPack` e `BuyPackResult`.
- `fetchAiPacks(session)`.
- `buyAiPack(session, packId, ref)`.
- `newPackRef()` com `crypto.randomUUID()` e fallback.

### Loja (`ShopPage`)

- Seção “Mensagens extras” com saldo de créditos e catálogo.
- Botão de compra mostra o preço em diamantes e fica desabilitado sem saldo.
- Após comprar, atualizar carteira, créditos e extrato.
- Aviso claro de que o crédito não expira e só é usado quando a cota gratuita acaba.

### Chat (`App.tsx`)

- `totalMessagesLeft = freeRemaining + credits`.
- Quando `freeRemaining > 0`: fluxo atual.
- Quando `freeRemaining = 0` e `credits > 0`: permitir enviar; indicar “usando mensagem extra”.
- Quando ambos = 0: mostrar CTA “Comprar mensagens extras” que abre a loja.
- O contador não pode descontar crédito no cliente antes da confirmação do servidor.

## 9. Métricas e observabilidade

- `ai_usage_events.source` (`free` ou `credit`).
- `ai_usage_events.credits_after`.
- Dashboard: créditos comprados, créditos consumidos, taxa de uso após a cota gratuita, custo de IA por mensagem paga.
- Alerta se o consumo por crédito crescer sem receita correspondente (diamantes são virtuais, mas o custo de IA é real).

## 10. Segurança e abuso

- Compra e consumo só no servidor; o cliente não altera saldo.
- `buy_ai_pack` idempotente por `p_ref`; repetir o pedido não cobra de novo.
- `consume_ai_credit` idempotente por `p_ref` e fora da lista branca pública.
- `api_daily_usage`/créditos não podem ser escritos diretamente pelo cliente.
- Limite por minuto e concorrência continuam valendo para chamadas pagas por crédito.
- Modo economia global bloqueia até chamadas com crédito, sem consumir o crédito.
- Não logar conteúdo de conversa; apenas metadados.

## 11. Testes

### Banco/API

- Comprar pacote debita diamantes, credita mensagens e grava os dois lançamentos.
- Comprar sem saldo falha e não cria crédito.
- Repetir o mesmo `p_ref` não cobra nem credita de novo.
- Consumir crédito reduz 1 e grava `message_use`.
- Repetir o mesmo `p_ref` de consumo não reduz de novo.
- Cota gratuita é usada antes do crédito.
- Sem cota e sem crédito: `429 AI_QUOTA_EXHAUSTED`.
- Modo economia: `429 AI_BUDGET_EXHAUSTED` sem consumir crédito.
- Concorrência: dois consumos simultâneos com créditos suficientes não deixam saldo negativo; com 1 crédito, apenas um consome.
- Pacote inativo não pode ser comprado.
- `storyverse_api` consegue executar as funções necessárias; `authenticated` não executa `consume_ai_credit` diretamente.

### Frontend

- `usageLimit` mantém cota gratuita e créditos separados.
- `ai.ts` envia `requestId` e aplica `remaining`/`credits` da resposta.
- Loja lista pacotes, compra e atualiza saldo.
- Chat permite enviar com crédito e bloqueia quando ambos acabam.

## 12. Migrations e ordem de deploy

1. Mergear a Fase 1 (V9) antes da V10, ou escrever a V10 preservando `gift_sent`.
2. V10 cria catálogo, créditos, ledger, funções e `source` nas métricas.
3. Deploy da API aplica a V10 automaticamente.
4. Deploy da web depois da API; a web antiga continua funcionando (não conhece créditos, mas a API ainda respeita a cota gratuita).
5. Rollback: a web pode voltar; a API nova pode ficar no ar porque as tabelas são aditivas. Não remover colunas/funções no rollback.

## 13. Critérios de aceite

- Não é possível burlar o limite de mensagens pelo cliente.
- Compra e consumo são atômicos e idempotentes.
- O saldo de créditos nunca fica negativo.
- A cota gratuita é consumida antes dos créditos.
- O modo economia não consome crédito.
- A UI mostra o valor do servidor, não um contador local como fonte da verdade.
- Custo de IA por mensagem paga é observável nas métricas.

## 14. Decisões abertas

1. **Preço dos pacotes:** confirmar a tabela proposta (20/30, 50/60, 100/100) ou começar mais generoso.
2. **Reembolso em falha do provedor:** manter consumido (recomendado nesta fase) ou devolver o crédito automaticamente.
3. **Modo economia:** bloquear também quem tem crédito (recomendado, para proteger custo) ou deixar crédito passar.
4. **Expiração de créditos:** não expirar nesta fase.
5. **Confirmação de compra:** um toque com aviso de sucesso (recomendado) ou modal de confirmação para pacotes acima de 30 diamantes.
6. **Exibição:** pacotes sempre na loja, com CTA no chat quando a cota acabar (recomendado).

## 15. Plano de implementação sugerido

1. **PR A (API/DB):** V10, funções `ai_pack_catalog`, `buy_ai_pack`, `consume_ai_credit`, `my_ai_quota`, mudanças no `AiBudget`/`AiController`/`RpcService`, métricas e testes de integração.
2. **PR B (web):** `usageLimit`, `ai.ts`, `aiPacks.ts`, seção da loja, estado do chat e testes.
3. Validar em Postgres descartável + preview da web.
4. Mergear API primeiro; depois web; acompanhar deploy e testar com uma conta de teste.
