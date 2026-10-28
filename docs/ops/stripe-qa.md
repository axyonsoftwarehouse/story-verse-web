# Stripe no QA — passo a passo para criar a conta e ligar a assinatura

Guia para criar a conta da Storyverse no Stripe e deixar `BILL-02`, `BILL-03` e `BILL-05` testáveis no
ambiente de QA. Nenhuma chave entra no repositório: os segredos ficam em `/home/deploy/storyverse-qa/.env`
na VPS (arquivo já com `chmod 600`).

## 1. Criar a conta (modo de teste)

1. Abra https://dashboard.stripe.com/register e crie a conta com o e-mail do projeto.
2. Confirme o e-mail.
3. No topo do dashboard, deixe o interruptor **Test mode** ligado. Todo o trabalho abaixo é em modo de teste:
   nada é cobrado de verdade e os cartões são de mentira.
4. País **Brasil**, moeda **BRL**. Os dados fiscais completos só são exigidos para ativar o modo real.

## 2. Criar o produto e o preço

Dashboard → **Product catalog** → **+ Add product**:

| Campo | Valor |
|---|---|
| Name | `Storyverse — leitura ilimitada` (é o nome que aparece no checkout e no extrato do cliente) |
| Pricing model | **Recurring** |
| Preço | **R$ 9,90 BRL**, cobrado **mensalmente** |

Guarde o **Price ID** gerado (`price_…`). Ele vai para `STRIPE_PRICE_ID`.

> O teste grátis de 7 dias já é feito pelo nosso código (`BILLING_TRIAL_DAYS=7`), então **não** configure
> trial no preço do Stripe — senão os dois prazos se somam.

> Produto e preço de **test mode** não existem em modo real: ao ativar produção, crie de novo e troque o
> `STRIPE_PRICE_ID`.

## 3. Copiar a chave secreta

**Developers** → **API keys** → **Secret key** (`sk_test_…`).

- Use a **secret**, não a publishable: o checkout é redirecionamento feito pelo servidor.
- Se a chave estiver oculta, clique em *Reveal test key*.

## 4. Cadastrar no ambiente de QA

Na VPS, em `/home/deploy/storyverse-qa/.env` (só nomes abaixo; os valores são colados por você):

```env
BILLING_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...   # vem do passo 5
```

E no `/home/deploy/storyverse-qa/docker-compose.override.yml`, dentro de `services.qa-api.environment`:

```yaml
      BILLING_ENABLED: ${BILLING_ENABLED:-false}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:-}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:-}
      STRIPE_PRICE_ID: ${STRIPE_PRICE_ID:-}
```

Depois: `cd /home/deploy/storyverse-qa && docker compose up -d qa-api`.

No site, o botão de assinatura só aparece com `VITE_BILLING_ENABLED=true` no build — uma linha no
`.github/workflows/deploy-qa.yml` (mesmo padrão do `VITE_FORUM_ENABLED`).

## 5. Webhook (é o que confirma o pagamento)

**Developers** → **Webhooks** → **Add endpoint**

| Campo | Valor |
|---|---|
| Endpoint URL | `https://api.qa.storyverse.2.29.42.104.sslip.io/api/v1/billing/webhook` |
| Events | `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` |

Copie o **Signing secret** (`whsec_…`) para `STRIPE_WEBHOOK_SECRET` e reinicie a API.

Para conferir sem esperar um pagamento: abra o endpoint no dashboard → **Send test event** →
`customer.subscription.updated`. A API valida a assinatura HMAC do Stripe e responde **200**.

## 6. Cartões de teste

| Situação | Número |
|---|---|
| Pagamento aprovado | `4242 4242 4242 4242` |
| Recusado (`card_declined`) | `4000 0000 0000 9995` |
| Exige autenticação 3DS | `4000 0025 0000 3155` |
| Saldo insuficiente | `4000 0000 0000 9995` |

Validade: qualquer data futura. CVC: qualquer 3 dígitos. Nome: qualquer.

## 7. Modo real (produção)

A conta de produção é uma conta **Storyverse** separada dentro do mesmo login do Stripe, com o titular
pessoa física (CPF) compartilhado com o outro negócio. Site, descrição no extrato e chaves são só dela.

1. Produto e preço em modo real: copiados da área de testes (R$ 9,90/mês, sem trial no Stripe). O
   `price_…` de produção é diferente do de teste.
2. Chave: **Criar chave secreta → Criar a própria integração → Acesso total (exceto operações
   sensíveis)**. O Stripe gera `rk_live_…` (chave restrita), e isso é esperado: ela bloqueia repasses,
   transferências, Issuing e Connect, que o Storyverse não usa.
3. Webhook de produção: mesmos eventos do passo 5, com a URL
   `https://api.storyverse.2.29.42.104.sslip.io/api/v1/billing/webhook`.
4. `/home/deploy/storyverse/.env` (produção, não QA): `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`,
   `STRIPE_WEBHOOK_SECRET` e `BILLING_ENABLED=false`. O `deploy/storyverse/docker-compose.yml` repassa
   as quatro para o serviço `api`; o compose da VPS é uma cópia manual e precisa das mesmas linhas.

**Ligar a cobrança** (quando quiser abrir a assinatura):

1. No `.env` de produção, `BILLING_ENABLED=true`, e depois `docker compose up -d api` em
   `/home/deploy/storyverse`.
2. No GitHub, **Settings → Secrets and variables → Actions → Variables**, crie
   `VITE_BILLING_ENABLED` = `true` e rode o workflow **Deploy Storyverse (VPS)** para o site mostrar o
   botão de assinar.
3. Faça uma assinatura real com o seu cartão e confira no dashboard que o webhook respondeu **200**.
   Cancele e reembolse depois.

Para desligar, faça o caminho inverso: apague a variável (ou ponha `false`), rode o deploy e volte
`BILLING_ENABLED=false`.

## O que NÃO fazer

- Não commitar `sk_test_`/`whsec_` no repositório, nem colar no chat do agente.
- Não usar chaves de produção no QA (e nem o contrário).
- Não habilitar `BILLING_ENABLED=true` no QA antes de configurar o preço: sem `STRIPE_PRICE_ID` a API
  responde **503** "Assinatura ainda não está disponível."

## Depois disso, o que eu rodo

`BILL-02` (checkout abre e volta), `BILL-03` (trial libera, paywall depois do trial, 402) e `BILL-05`
(webhook repetido é idempotente, `invoice.paid` reativa, `invoice.payment_failed` marca inadimplente) —
com print de cada passo e registro no Trello.
