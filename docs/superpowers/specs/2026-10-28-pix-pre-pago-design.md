# Pix pré-pago (30 dias por pagamento)

Data: 28/10/2026. Complementa `2026-10-23-assinatura-mensal-stripe.md`.

## 1. Por quê

O usuário pediu para aceitar Pix além do cartão. Testado no Stripe live em 28/10/2026:

- **Pix Automático** (débito recorrente) não existe para contas Stripe do Brasil.
- **Pix em fatura** (`send_invoice`) é recusado pela conta: "The payment method type `pix` is not available for this account".
- **Pix em pagamento único** funciona: um Checkout `mode=payment` abriu com `card` e `pix`.

Então o Pix entra como **pré-pago**: a pessoa paga R$ 9,90 e ganha 30 dias de acesso. O cartão continua sendo a assinatura automática.

O que o usuário disse que conta como sucesso: **o site poder ser usado** depois de pagar e **a pessoa receber a confirmação do pagamento**.

## 2. Objetivos

- Pagar 30 dias de acesso com Pix pelo Checkout do Stripe, sem sair do fluxo atual de assinatura.
- Liberar o acesso assim que o Stripe confirmar o pagamento (webhook), sem ação manual.
- Mandar confirmação por e-mail com a data até quando o acesso vale.
- Avisar antes de os 30 dias acabarem, já que não há renovação automática.
- Pagar de novo antes do fim **soma** 30 dias a partir do fim atual, sem perder dias.

## 3. Fora do escopo

- Pix Automático e Pix em fatura (indisponíveis para a conta).
- Planos de outros prazos (90 dias, anual). O código aceita um prazo configurável, mas só 30 dias aparece.
- Boleto.
- Tela própria de QR code: o Checkout do Stripe mostra o QR e a chave copia-e-cola.

## 4. Anti-objetivos (seria falha mesmo funcionando)

- Pessoa paga o Pix e continua bloqueada, ou precisa falar com o suporte.
- Pessoa com cartão ativo paga Pix sem querer e paga em dobro.
- Pix pago durante o teste grátis "come" os dias de teste.
- Dados do Pix/banco passando pelo Storyverse.

## 5. Como funciona para a pessoa

1. Na tela `/assinar` aparecem duas opções:
   - **Começar teste grátis** (cartão, como hoje; 7 dias sem cartão no começo).
   - **Pagar 30 dias com Pix — R$ 9,90**.
2. Ao escolher Pix, abre o Checkout do Stripe só com Pix. Ela lê o QR no app do banco e paga.
3. O Stripe confirma em segundos; a página volta para `/conta/assinatura?checkout=ok`, que já se atualiza sozinha (1,5 s / 4 s / 8 s).
4. Ela recebe um e-mail "Pagamento recebido — acesso até DD/MM/AAAA". O parceiro de Pix do Stripe (Ebanx) também manda o recibo dele por padrão.
5. 3 dias antes do fim, e no dia do fim, recebe um e-mail "Seu acesso termina em …" com o link para pagar de novo.
6. Em `/conta/assinatura`: situação "Pago com Pix", "Acesso até …", botões **Pagar mais 30 dias com Pix**, **Assinar no cartão** e **Ir para o início**.

## 6. Regras de acesso (API)

Ordem em `BillingService.access`, do primeiro que libera:

1. Cobrança desligada → libera (`disabled`).
2. Equipe → libera (`staff`).
3. Acesso grátis manual ativo → libera (`grant`).
4. **Novo:** período Pix ativo (`starts_at <= now < ends_at`, não reembolsado) → libera (`pix`, `accessUntil = ends_at` do último período).
5. Assinatura no cartão → regra atual (`evaluate`).

Início de um período novo (`starts_at`), o maior entre:

- agora;
- o fim do último período Pix não reembolsado;
- o `trial_end` da assinatura, se ela estiver `trialing` (o Pix começa depois do teste).

`ends_at = starts_at + 30 dias`.

Comprar Pix é **recusado (409)** quando a assinatura no cartão está `active` ou `past_due` e não está marcada para cancelar: "Sua assinatura no cartão já está ativa." Com `cancel_at_period_end`, o Pix começa no `current_period_end`.

Reembolso de um pagamento Pix (`charge.refunded` do PaymentIntent) marca o período como reembolsado e ele deixa de contar. Os períodos seguintes não são recalculados (caso raro; o suporte ajusta com acesso grátis).

## 7. Dados

Migração `V31__billing_prepaid.sql`:

```sql
create table public.billing_prepaid (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text unique,
  amount_cents integer not null,
  currency text not null default 'brl',
  days integer not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  refunded_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz not null default now()
);
create index billing_prepaid_user_idx on public.billing_prepaid (user_id, ends_at desc);
```

RLS igual às outras tabelas de billing: leitura pelo dono ou equipe; escrita só com `app.billing_write = 'on'`.

O pagamento também entra em `billing_invoices` (`stripe_invoice_id` = id do PaymentIntent, `stripe_subscription_id` nulo), para aparecer na receita do financeiro. O MRR continua contando só assinaturas.

## 8. API

- `POST /api/v1/billing/pix-checkout` → `{ url }`. Cria (ou reaproveita) o cliente Stripe e abre um Checkout:
  - `mode=payment`, `customer`, `client_reference_id = userId`, `metadata[kind]=prepaid`, `metadata[days]=30`;
  - item com `price_data` em BRL, `unit_amount = STRIPE_PIX_AMOUNT_CENTS` (990), produto "Storyverse — 30 dias";
  - `payment_method_configuration = STRIPE_PIX_PMC_ID` (configuração só com Pix; ver §10);
  - `payment_method_options[pix][expires_after_seconds] = 3600`;
  - `success_url = /conta/assinatura?checkout=ok`, `cancel_url = /assinar`.
- `GET /api/v1/billing/status` ganha `prepaid: { accessUntil, lastPaidAt } | null` e `pixAvailable: boolean`.
- Webhook:
  - `checkout.session.completed` com `mode=payment` e `payment_status=paid` → grava o período (idempotente pela `stripe_checkout_session_id`) e manda o e-mail de confirmação.
  - `checkout.session.async_payment_succeeded` → mesmo tratamento (caso o Pix confirme depois).
  - `checkout.session.async_payment_failed` → só registra.
  - `charge.refunded` → se o PaymentIntent for de um período Pix, marca `refunded_at`.
  - A sessão de assinatura continua no caminho atual (`mode=subscription`).
- Job agendado (junto do `BillingSnapshotJob`, de hora em hora): manda o aviso para períodos que terminam em até 3 dias e ainda não foram avisados (`reminded_at`), e o aviso do dia do fim, se não houver período seguinte.
- E-mails pelo `MailService` atual (SMTP já configurado): confirmação e aviso de fim.

Variáveis novas: `STRIPE_PIX_PMC_ID`, `STRIPE_PIX_AMOUNT_CENTS` (padrão 990), `STRIPE_PIX_DAYS` (padrão 30). Sem `STRIPE_PIX_PMC_ID`, o Pix fica escondido (`pixAvailable=false`): é o interruptor para ligar e desligar.

## 9. Site

- `src/lib/billing.ts`: `startPixCheckout(session)` (com `withFreshSession`), tipos novos em `SubscriptionStatus`.
- `SubscribePage`: botão secundário "Pagar 30 dias com Pix — R$ 9,90" quando `pixAvailable`; texto curto explicando que o Pix não renova sozinho.
- `SubscriptionPage`: estado "Pago com Pix" com a data; "Pagar mais 30 dias com Pix"; "Assinar no cartão".
- `BillingBlocked` (tela de bloqueio): também oferece o Pix.
- Rótulo novo em `STATUS_LABELS`: `pix: "Pago com Pix"`.
- Termos e política de cancelamento: uma frase sobre o Pix pré-pago (não renova; reembolso em 7 dias pela regra atual).

## 10. Stripe (configuração, com aprovação do usuário)

- Criar uma *payment method configuration* "Storyverse Pix avulso" só com Pix ligado (live e na conta de teste do QA). O id vai para `STRIPE_PIX_PMC_ID`.
- Adicionar ao webhook de produção: `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`.
- A conta de teste do QA hoje tem Pix indisponível. Sem Pix lá, o QA testa a lógica pelo webhook assinado (eventos montados nos testes) e o Pix real é testado uma vez em produção com R$ 9,90, reembolsados depois.

## 11. Testes

- API: regra de início do período (agora / depois do último / depois do teste / depois do fim do cartão cancelado), recusa com cartão ativo, idempotência do webhook, reembolso, job de aviso, acesso `pix` no filtro.
- Site: botões por estado, chamada do checkout Pix, estado "Pago com Pix".
- Produção: um pagamento real por Pix, conferir webhook, acesso e e-mail; reembolsar.

## 12. Escolhas feitas por mim (o usuário pediu "o mais sensato")

- Teste grátis continua só no fluxo do cartão (não exige cartão no começo). Pix não dá dias extras.
- Pix pago durante o teste começa quando o teste acaba.
- Checkout do Stripe com só Pix (configuração própria), em vez de tela própria de QR.
- QR expira em 1 hora.
- Aviso de fim 3 dias antes e no dia.
- Reembolso de Pix tira aquele período do acesso; no cartão a regra atual (reembolso não mexe no acesso) continua.
- Admin: o período Pix aparece no status da conta pelo `accessUntil`; uma lista própria de pagamentos Pix no financeiro fica para depois.
