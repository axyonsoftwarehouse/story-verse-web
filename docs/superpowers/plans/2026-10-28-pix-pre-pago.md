# Pix pré-pago Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pagar 30 dias de acesso com Pix (Checkout `mode=payment`) ao lado da assinatura no cartão.

**Architecture:** Tabela `billing_prepaid` com períodos pagos; `BillingService.access` libera por período ativo antes de olhar a assinatura. O webhook grava o período em `checkout.session.completed`/`async_payment_succeeded` e manda e-mail; um job de hora em hora manda os avisos de fim. O site ganha o botão do Pix e o estado "Pago com Pix".

**Tech Stack:** Java 25 / Spring Boot 4 / stripe-java 31 / Flyway / Postgres (API); React + Vite + vitest (site).

**Spec:** `docs/superpowers/specs/2026-10-28-pix-pre-pago-design.md`

## Global Constraints

- Valor `STRIPE_PIX_AMOUNT_CENTS` padrão `990`; prazo `STRIPE_PIX_DAYS` padrão `30`; QR expira em `3600` s.
- Sem `STRIPE_PIX_PMC_ID` o Pix fica escondido (`pixAvailable=false`) e `pix-checkout` responde 503.
- Escrita em tabelas de billing só depois de `repository.beginWrite()` (RLS `app.billing_write`).
- Textos em português, mesmo tom das telas atuais.

## Review Focus

- Webhook repetido do mesmo checkout não cria segundo período → teste de idempotência (Task 2).
- Checkout `mode=subscription` continua no caminho atual → teste no webhook (Task 2).
- Cartão `active` sem cancelamento agendado recusa Pix com 409 → teste (Task 1).
- Pix pago no teste grátis começa no `trial_end` → teste (Task 1).
- Falha de e-mail não derruba o webhook nem o job → teste (Task 2/3).

---

### Task 1: Regras e dados (API)

**Files:**
- Create: `src/main/resources/db/migration/V31__billing_prepaid.sql`
- Create: `src/main/java/com/storyverse/api/billing/PrepaidRules.java`
- Modify: `BillingRepository.java`, `BillingService.java`
- Test: `src/test/java/com/storyverse/api/billing/PrepaidRulesTest.java`

**Interfaces:**
- Produces: `PrepaidRules.startAt(Instant now, Instant lastPrepaidEnd, Map<String,Object> subscription): Instant`; `PrepaidRules.blocksPix(Map<String,Object> subscription, Instant now): boolean`; `BillingRepository.activePrepaid(UUID): Optional<Map>` (maior `ends_at` com `starts_at<=now<ends_at`, sem reembolso), `lastPrepaidEnd(UUID): Optional<Instant>`, `insertPrepaid(Map): boolean` (on conflict do nothing), `refundPrepaid(String paymentIntentId): int`, `prepaidEndingSoon(Instant until): List<Map>`, `markReminded(UUID id)`.

- [ ] Testes `PrepaidRulesTest`: começa agora sem histórico; começa no fim do último período futuro; começa no `trial_end` quando `trialing`; começa no `current_period_end` quando `active` com `cancel_at_period_end`; `blocksPix` true para `active`/`past_due` sem cancelamento, false para `canceled`, `trialing` e nulo.
- [ ] Implementar `PrepaidRules` (classe final, métodos estáticos).
- [ ] Migração V31 conforme spec §7 + RLS.
- [ ] `access`: após o grant, `activePrepaid` → `Access(true, "pix", ends_at do último período encadeado)`.
- [ ] `status`: `prepaid` (`accessUntil`, `lastPaidAt`) e `pixAvailable`.
- [ ] `pixCheckout(UUID)`: 503 sem PMC; 409 se `blocksPix`; cliente Stripe reaproveitado; `StripeGateway.pixCheckout(customerId, userId)`.
- [ ] `StripeGateway.pixCheckoutParams(customerId, userId, amountCents, days, pmcId, publicUrl)` estático + teste em `StripeGatewayTest` (mode payment, metadata kind=prepaid/days, PMC, expira 3600, success `/conta/assinatura?ok=1`).
- [ ] `POST /api/v1/billing/pix-checkout` no controller.
- [ ] Commit.

### Task 2: Webhook e e-mail de confirmação (API)

**Files:** Modify `BillingWebhookService.java`, `MailService.java`; Test `BillingWebhookServiceTest.java` (novo, Mockito no repository/gateway/mail).

- [ ] Testes: sessão `mode=payment` paga grava período e envia e-mail; repetição não grava de novo nem envia; `payment_status=unpaid` não grava; `async_payment_succeeded` grava; `charge.refunded` com PaymentIntent conhecido chama `refundPrepaid`; e-mail que falha não lança.
- [ ] Implementar `prepaid(Session)` usando `PrepaidRules.startAt` e `upsertInvoice` (id do PaymentIntent).
- [ ] `MailService.sendPrepaidConfirmation(email, until)` e `sendPrepaidEnding(email, until)`.
- [ ] Commit.

### Task 3: Aviso de fim (API)

**Files:** Create `PrepaidReminderJob.java`; Test `PrepaidReminderJobTest.java`.

- [ ] Teste: períodos que terminam em até 3 dias sem período seguinte e sem `reminded_at` recebem e-mail e são marcados; falha de e-mail não marca e segue para o próximo.
- [ ] `@Scheduled(cron = "0 10 * * * *", zone = "America/Sao_Paulo")`.
- [ ] Rodar a suíte da API no Docker (unit + integração com Postgres); PR para develop.

### Task 4: Site

**Files:** Modify `src/lib/billing.ts`, `src/features/billing/SubscribePage.tsx`, `SubscriptionPage.tsx`, `BillingBlocked.tsx`, `src/features/legal/LegalPage.tsx`; tests nos `*.test.tsx` correspondentes.

- [ ] `startPixCheckout(session)` com `withFreshSession`; tipos `prepaid`, `pixAvailable`; rótulo `pix: "Pago com Pix"`.
- [ ] `SubscribePage`: botão "Pagar 30 dias com Pix — R$ 9,90" quando `pixAvailable`.
- [ ] `SubscriptionPage`: com `reason === "pix"` mostra "Pago com Pix", "Acesso até", botões "Pagar mais 30 dias com Pix" e "Assinar no cartão".
- [ ] `BillingBlocked`: botão do Pix.
- [ ] Termos: frase sobre o Pix pré-pago.
- [ ] vitest, tsc, eslint; PR para develop.

### Task 5: Stripe, QA e produção

- [ ] Com aprovação já dada: criar PMC só com Pix (live; QA se a conta de teste permitir) e incluir os 3 eventos no webhook de produção.
- [ ] Merge na develop, conferir QA (sem Pix na conta de teste: só o botão escondido/visível pela env).
- [ ] Release develop → main (aprovação do usuário), `STRIPE_PIX_PMC_ID` no `.env`, teste real de R$ 9,90 e reembolso.
