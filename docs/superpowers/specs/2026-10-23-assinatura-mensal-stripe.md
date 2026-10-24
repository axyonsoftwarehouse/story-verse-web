# Assinatura mensal com Stripe — Design

Data: 23/10/2026. Repositórios: `story-magic` (web) e `story-verse-api` (API).

## 1. Contexto e decisão de produto

O produto passa a ter **assinatura mensal**: a mensalidade é a chave de acesso. A cobrança será pelo **Stripe**, no cartão. A landing, o login, a criação de conta, as telas de assinatura, o suporte e o cancelamento continuam acessíveis sem assinatura; o restante do app autenticado exige uma assinatura ativa.

Decisões fechadas em 23/10/2026:

- **Plano único** “Storyverse” mensal em BRL; anual pode vir depois. O valor **provisório** é **R$ 9,90/mês** (a confirmar com o professor); o valor final será definido no Stripe.
- **Teste grátis de 7 dias, sem cartão no início.** No fim do trial, a pessoa precisa cadastrar um cartão para continuar; sem cartão, o acesso termina.
- **Paywall total:** tudo depois do login exige assinatura, exceto conta, assinatura, suporte, logout e telas públicas.
- **Contas existentes:** 30 dias de transição a partir do lançamento, sem bloqueio imediato; um preço de fundador pode ser avaliado depois.
- **Cartão apenas no MVP.** Pix recorrente (Pix Automático) fica fora desta fase; Mercado Pago só se virar requisito.
- **Equipe** (`superadmin`, `moderator`, `support`) tem acesso liberado para testar e atender.
- O bloqueio é sempre validado no servidor; a UI só esconde/encaminha.

O preço provisório é **R$ 9,90/mês**; o valor final ainda será confirmado. O código usa o `price_id` do Stripe, então a troca de preço não exige deploy.

## 2. Objetivos

1. Cobrar uma assinatura mensal recorrente pelo Stripe, com checkout e portal do cliente.
2. Manter o acesso em dia: `trialing`, `active` e `past_due` dentro da carência têm acesso; o resto não.
3. Refletir o estado da assinatura no servidor (fonte da verdade), nas capabilities e no app.
4. Dar ao admin uma visão financeira somente leitura: assinantes, status, receita, falhas e reembolsos.
5. Ser idempotente e auditável: webhook, checkout e liberação de acesso não podem duplicar nem perder eventos.

## 3. Não objetivos

- Checkout embutido no app, cartão salvo no nosso banco ou dado de cartão passando pelo nosso servidor.
- Reembolso, cancelamento e disputa pelo painel no MVP; isso é feito no Stripe, com link direto.
- Nota fiscal própria, contabilidade ou conciliação bancária automatizada.
- Planos múltiplos, upgrades/downgrades com pró-rata, cupons complexos e preços por região.
- Cobrança por uso (tokens de IA) ou por diamantes; a assinatura é mensal e fixa.
- App mobile com compra dentro da loja (Apple/Google) nesta fase.

## 4. Planos e política de acesso

### 4.1 Plano

- Um produto “Storyverse” com um preço mensal recorrente em BRL (`price_id` no Stripe); preço provisório de **R$ 9,90/mês**, a confirmar.
- O valor não fica no código; a API lê o `price_id` da configuração e mostra o preço vindo do Stripe (ou de um cache de configuração).
- O checkout usa `client_reference_id`/metadata com o `user_id`; o webhook liga o cliente Stripe à conta.
- Trial de 7 dias sem cartão; cupons/promo codes do Stripe, se habilitados.

### 4.2 Estados e acesso

| Status | Acesso | Observação |
|---|---|---|
| `trialing` | sim | até `trial_end`; sem cartão, o acesso termina no `trial_end` |
| `active` | sim | até `current_period_end` |
| `past_due` | sim com carência | até `current_period_end + 3 dias`; depois bloqueia |
| `canceled` | até `current_period_end` | cancelamento agendado; no fim, bloqueia |
| `unpaid` | não | cobrança esgotou |
| `incomplete` / `incomplete_expired` | não | checkout não concluído |
| `paused` | não | pausa manual |
| sem assinatura | não | exceto staff e grants |
| `grant` (comp) | sim | até `expires_at` ou indefinido |

- A carência de `past_due` (3 dias) vale para cobranças que falharam com cartão; o Stripe Smart Retries continua tentando. Se o pagamento entrar, volta a `active`.
- No trial sem cartão, o acesso termina em `trial_end`; a carência de 3 dias **não** se aplica a quem nunca cadastrou cartão.
- `canceled` com `cancel_at_period_end=true` continua `active` no Stripe até o fim; o status `canceled` só vem depois do fim.
- Staff tem acesso sem cobrança. Contas de teste/comp recebem `billing_grants` (motivo, validade, autor).
- Contas existentes no lançamento recebem `billing_grants` com `reason='transition'` e `expires_at = lançamento + 30 dias`.
- Expirar/revogar grant ou sanção reavalia o acesso na próxima requisição.

## 5. Modelo de dados (migração V18)

Tabelas novas em `public` (a V17 é a da Fase 2 do admin):

### 5.1 `billing_customers`

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `stripe_customer_id text not null unique`
- `created_at timestamptz not null default now()`

### 5.2 `billing_subscriptions`

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `stripe_subscription_id text not null unique`
- `stripe_price_id text not null`
- `status text not null` (`trialing`, `active`, `past_due`, `canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused`)
- `current_period_start timestamptz`
- `current_period_end timestamptz`
- `cancel_at_period_end boolean not null default false`
- `trial_end timestamptz`
- `canceled_at timestamptz`
- `latest_invoice_status text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Índices: `(user_id, updated_at desc)`, `(status, current_period_end)`, `(stripe_price_id)`. A conta pode ter histórico; a assinatura “vigente” é a mais recente não terminal (ou a `active`/`trialing`/`past_due`).

### 5.3 `billing_events`

- `stripe_event_id text primary key`
- `type text not null`
- `processed_at timestamptz`
- `error text`
- `attempts integer not null default 0`
- `created_at timestamptz not null default now()`

Garante idempotência; o evento é inserido antes de processar e marcado como processado na mesma transação.

### 5.4 `billing_grants`

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `reason text not null`
- `expires_at timestamptz`
- `created_by uuid references auth.users(id) on delete set null`
- `created_at timestamptz not null default now()`
- `revoked_at timestamptz`
- `revoked_by uuid references auth.users(id) on delete set null`

Usado para staff, fundadores, suporte e testes; nunca é uma cobrança.

### 5.5 RLS

- `billing_customers`/`billing_subscriptions`: usuário lê só o próprio; staff lê todos; escrita só pelo backend/webhook (service role).
- `billing_grants`: usuário lê os próprios (para saber por que tem acesso); staff gerencia; escrita por superadmin.
- `billing_events`: só service role/staff; nunca exposta ao cliente.
- O runtime continua `storyverse_api` (sem `bypassrls`); o webhook usa a conexão de serviço já existente no backend.

## 6. Stripe

### 6.1 Configuração

- Conta Stripe do produto, modo test no QA e live na produção; chaves separadas.
- Produto/preço criados no Stripe; `STRIPE_PRICE_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_PUBLIC_URL` no `.env` da API (nunca no frontend).
- Checkout hospedado (Stripe Checkout), `mode=subscription`, `locale=pt-BR`, `payment_method_collection=if_required`, `subscription_data.trial_period_days=7`, `success_url=/conta/assinatura?ok=1`, `cancel_url=/assinar?cancelado=1`, `allow_promotion_codes` conforme decisão.
- Trial sem cartão: o Checkout não pede cartão no início. No fim do trial, o app leva para `/conta/assinatura`/Portal para cadastrar o cartão; sem cartão, o acesso termina no `trial_end`.
- Portal do cliente (Customer Portal) para cartão, faturas e cancelamento; `return_url=/conta/assinatura`.

### 6.2 Webhooks

Endpoint `POST /api/v1/billing/webhook` (público, sem sessão, mas com assinatura Stripe):

- Ler o corpo cru; validar `Stripe-Signature` com o `STRIPE_WEBHOOK_SECRET`; rejeitar sem assinatura.
- Inserir `stripe_event_id` em `billing_events` (idempotência). Se já processado, responder 200 sem repetir.
- Processar na mesma transação; em erro, responder 500 para o Stripe retentar e registrar o erro.
- Em cada evento de assinatura, buscar o estado atual da assinatura no Stripe (não confiar na ordem dos eventos) e fazer upsert.

Eventos mínimos:

- `checkout.session.completed` — liga `stripe_customer_id`/`user_id` e sincroniza a assinatura.
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
- `invoice.paid`, `invoice.payment_failed`.
- `charge.refunded`, `charge.dispute.created` — registram para o financeiro; não alteram acesso sozinhos.
- `customer.subscription.trial_will_end` — opcional para comunicação.

### 6.3 Pagamentos

- **Cartão apenas** no MVP de assinatura.
- **Pix recorrente (Pix Automático) fica fora desta fase.** Pix avulso/Mercado Pago só entram se virarem requisito depois; não prometer Pix recorrente sem uma decisão e validação próprias.
- **Boleto** não é adequado para mensalidade; fora do MVP.
- **Impostos:** avaliar Stripe Tax; se não, documentar que o preço é o final.
- **Faturas/recibos:** pelo Stripe/Customer Portal.

## 7. API

### 7.1 Endpoints do cliente

- `GET /api/v1/billing/plans` (público) — plano(s), preço, moeda, intervalo, trial; sem segredo.
- `POST /api/v1/billing/checkout` (sessão) — cria/retoma `stripe_customer_id`, cria Checkout Session e devolve `{ url }`; idempotência por conta e janela curta; rate limit.
- `POST /api/v1/billing/portal` (sessão) — devolve `{ url }` do Customer Portal; 409 se não houver cliente Stripe.
- `GET /api/v1/billing/status` (sessão) — `{ status, active, accessUntil, plan, cancelAtPeriodEnd, trialEnd, portalAvailable }`.
- `POST /api/v1/billing/webhook` — descrito acima.

### 7.2 Acesso no servidor

- `BillingService.access(userId)` devolve `{ active, reason, accessUntil }` considerando assinatura, grant, staff e carência.
- `BillingService.requireAccess(userId)` responde 402/403 `SUBSCRIPTION_REQUIRED` (definir o status; proposta: **402 Payment Required**) nas rotas protegidas.
- Rotas isentas: `auth/*`, `account/export`, `account` (exclusão), `billing/*`, `health`, `ai/status`, listagem pública do acervo e storage público. O resto do produto exige acesso.
- Implementar como um filtro/interceptor com uma lista de rotas isentas; a regra fica num lugar só.
- `GET /auth/capabilities` passa a devolver também `subscription: { status, active, accessUntil, plan, cancelAtPeriodEnd }` para o app montar a UI sem uma chamada extra. `GET /billing/status` continua para atualização explícita.
- Staff: `BillingService.access` retorna ativo para `superadmin`/`moderator`/`support` (ou o seed cria grant); não cobrar.
- Sessões: ao bloquear por inadimplência, não é necessário revogar a sessão; o filtro barra as rotas. A tela de assinatura continua acessível para regularizar.

### 7.3 Admin financeiro (somente leitura)

Só superadmin (papel `finance` no futuro):

- `GET /api/v1/admin/billing/summary?from=&to=` — MRR, assinaturas ativas/trial/past_due/canceladas, novas/canceladas no período, receita recebida, reembolsos, falhas.
- `GET /api/v1/admin/billing/subscriptions?status=&q=&cursor=` — lista com e-mail mascarado, status, plano, período, `cancel_at_period_end`.
- `GET /api/v1/admin/billing/subscriptions/{id}` — detalhe com IDs do Stripe, faturas recentes (quando disponível) e links para o dashboard.
- Nenhuma ação de cobrança/cancelamento/reembolso no MVP; links para o Stripe.
- Auditoria: consultas de detalhe podem gerar `billing.view` (proposta) para rastrear acesso a dados financeiros.

## 8. Web

### 8.1 Antes de assinar

- `/assinar` (pública; se não houver sessão, pede login/cadastro e volta): cartão do plano, preço, **7 dias grátis sem cartão**, o que está incluído, política de cancelamento; botão “Começar teste” chama `/billing/checkout`.
- No fim do trial sem cartão, `/conta/assinatura` mostra “Adicione um cartão para continuar” e leva ao Portal/checkout.
- `?cancelado=1` mostra “Você pode assinar quando quiser”.
- O cadastro/login continua funcionando; depois de autenticar, o gate decide.

### 8.2 Paywall e gate

- Um `SubscriptionGate` no App (ou no layout autenticado) consulta `useSubscription` (capabilities + `/billing/status`).
- Sem acesso: redireciona para `/assinar`, exceto conta, assinatura, suporte, logout e telas públicas.
- Com acesso: o app segue normal. Um aviso discreto aparece em `past_due`/`cancel_at_period_end` (“Pagamento pendente”, “Acesso até …”).
- Offline: usa a última resposta em cache com prazo curto; o servidor continua sendo a verdade. Não liberar acesso offline indefinidamente.

### 8.3 Conta

- `/conta/assinatura`: status, plano, próxima cobrança, trial, cancelamento agendado, botão “Gerenciar assinatura” (Portal) e “Assinar” se não houver.
- Durante o trial sem cartão, mostra “7 dias grátis; adicione um cartão antes do fim para continuar” e um botão para cadastrar.
- `?ok=1` mostra confirmação e atualiza o status; o webhook pode levar alguns segundos, então a tela faz polling curto (ex.: 3 tentativas).
- Suporte: link para contato e para o histórico de cobranças no Portal.

### 8.4 Admin

- `/admin/financeiro` com cards e lista de assinaturas; link para `/admin/contas/:id`.
- No detalhe da conta, chip de assinatura e link para o financeiro.
- Nav “Financeiro” só para superadmin.

## 9. Segurança, privacidade e LGPD

- Nenhum dado de cartão no nosso banco; PCI fica no Stripe.
- Preço e plano sempre no servidor; o cliente não envia valor.
- Webhook com assinatura, idempotência e retry; sem confiar em ordem de eventos.
- Segredos do Stripe só na API; nunca em `VITE_*`.
- RLS nas tabelas de billing; runtime sem `bypassrls`.
- Dados financeiros são pessoais: acesso só de superadmin, e-mail mascarado nas listas, detalhe auditado; retenção conforme a política de privacidade.
- Exclusão de conta: cancelar a assinatura no Stripe e anonimizar/limpar os vínculos de billing conforme a LGPD; a fatura fiscal pode precisar ser retida pelo prazo legal.
- Termos de assinatura, política de reembolso e cancelamento precisam existir antes do lançamento.

## 10. QA e testes

- **Stripe test mode** no QA, com produto/preço/chaves separados; nunca cobrar de verdade.
- **Test clock** para simular trial, renovação, falha, retry, cancelamento e fim do período.
- **Webhook forwarding** local/QA; testar assinatura inválida, evento repetido, evento fora de ordem e falha de processamento.
- Cartões de teste (sucesso, recusa, 3DS); sem Pix nesta fase.
- Cenários de acesso: trial sem cartão ativo, trial expirado sem cartão, trial com cartão, ativo, past_due dentro/fora da carência, canceled no fim, unpaid, grant, staff, sem assinatura.
- Checkout: sucesso, cancelamento, retorno, sessão repetida, usuário já assinante.
- Portal: cartão, fatura, cancelamento.
- Admin financeiro: permissões, e-mail mascarado, números coerentes, links e estados vazios.
- QA seed: `qa-assinante@example.com` (grant ou assinatura de teste) e `qa-sem-assinatura@example.com`; nunca usar dados reais.

## 11. Rollout

1. Criar produto/preço no Stripe test; configurar QA; migração V18; webhook.
2. Implementar API de status/checkout/portal/webhook e o gate no servidor.
3. Web `/assinar`, `/conta/assinatura` e paywall; gate desligado por flag no início.
4. Admin financeiro somente leitura.
5. Beta interno com contas de teste; depois um grupo pequeno; monitorar conversão, falhas de webhook e erros.
6. Lançamento: ativar o gate e conceder 30 dias de transição (`billing_grants`) às contas existentes, com comunicação.
7. Kill switch: desligar checkout/novas assinaturas sem derrubar quem já tem acesso; grants manuais para suporte.

Feature flag sugerida: `BILLING_ENABLED` (build/env no web) + `billing` no banco/capabilities; o gate só entra quando a flag estiver ligada.

## 12. Ordem de entrega

1. **Stripe test:** produto, preço, trial, portal, webhook secret.
2. **Banco (V18) + API:** customers, subscriptions, events, grants, status, webhook, gate.
3. **Web:** `/assinar`, `/conta/assinatura`, gate e avisos.
4. **Admin:** financeiro somente leitura e chip na conta.
5. **QA/beta:** test clock, cenários de acesso, runbook de suporte.
6. **Lançamento:** transição de contas existentes e comunicação.

## 13. Decisões

Fechadas em 23/10/2026:

- **Trial de 7 dias sem cartão.**
- **Paywall total**, com isenções de conta/assinatura/suporte/logout e telas públicas.
- **Contas existentes:** 30 dias de transição, sem bloqueio imediato.
- **Cartão apenas** no MVP; Pix recorrente/Mercado Pago fora desta fase.

Abertas:

- **Valor final** (provisório R$ 9,90/mês) e eventual preço anual.
- Impostos (Stripe Tax) e se o preço é com imposto incluso.
- Política de reembolso e cancelamento; quem aprova.
- Carência de `past_due` (3 dias) e comunicação.
- Papel `finance` ou só superadmin no financeiro.
- Auditoria de consultas financeiras (`billing.view`) e exportação.
- Tratamento de exclusão de conta com assinatura ativa e retenção fiscal.
- App mobile e compras fora do Stripe (Apple/Google) no futuro.
