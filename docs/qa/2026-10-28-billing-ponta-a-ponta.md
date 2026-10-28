# Relatório — assinatura de ponta a ponta no QA (BILL-02, 03 e 05)

- **Data:** 28/10/2026, 15h05–15h20 UTC
- **Alvo:** API `https://api.qa.storyverse.2.29.42.104.sslip.io` e Stripe em modo de teste
- **Configuração:** QA com `BILLING_ENABLED=true` e chaves de teste do Stripe
- **Contas:** `qa-assinante` e `qa-sem-assinatura` (criadas hoje e confirmadas por SQL, porque o cadastro
  respondeu 202 e o QA não envia e-mail), mais `qa-leitor` e `qa-admin`
- **Como:** chamadas à API feitas na VPS (a senha de QA é lida do `.env` e nunca aparece no log), checkout aberto no navegador
  e test clock do Stripe para avançar o tempo

## Resultado

| Cenário | Resultado | Observação |
|---|---|---|
| **BILL-03** — sem assinatura recebe 402 | **Aprovado** | `reading-state` e `forum/spaces` → `402 SUBSCRIPTION_REQUIRED`; `capabilities` e `billing/status` continuam 200 |
| Staff tem acesso sem pagar | **Aprovado** | `qa-admin`: `reason=staff`, `active=true` |
| **BILL-02** — checkout abre o Stripe | **Aprovado** | Página "7 dias grátis, depois R$ 9,90/mês", total de hoje R$ 0,00, **sem pedir cartão**; o "Iniciar teste" volta para `/conta/assinatura?ok=1` |
| Trial libera o acesso | **Aprovado** | `qa-assinante` passa a `trialing` até 04/11; `reading-state` → 200 |
| Portal do cliente | **Aprovado** | `POST /billing/portal` → 200 com o link `billing.stripe.com` |
| **BILL-05** — webhook sem assinatura ou com assinatura errada | **Aprovado** | 400 "Assinatura do webhook inválida." |
| **BILL-05** — evento repetido | **Aprovado** | `customer.subscription.created` reenviado 2 vezes com assinatura válida → 200, sem linha duplicada (`attempts=1`) |
| Eventos do checkout | **Aprovado** | `checkout.session.completed`, `customer.subscription.created` e `invoice.paid` processados, nenhum com erro |
| **Fim do trial sem cartão** | **Reprovado → corrigido e aprovado** | ver BILL-QA-01 |
| Cobrança com cartão, falha e recuperação | **Não testado** | precisa digitar um cartão de teste no checkout do Stripe (passo manual) |

## BILL-QA-01 · Alta — o trial sem cartão vira 33 dias a mais de acesso grátis

A assinatura é criada com `trial_settings.end_behavior.missing_payment_method = create_invoice`, que é o
padrão do Stripe. Simulado com um test clock (assinatura de 7 dias sem cartão, relógio avançado 8 dias):

- O Stripe muda a assinatura para **`past_due`** com uma fatura `open` e um novo período até 04/12.
- A API aplica a regra de `past_due` e devolve `active=true` com `accessUntil = 2026-12-07`, que é o fim do período mais 3 dias de carência.
- `reading-state` → **200**. Quem nunca cadastrou cartão continua lendo por mais um mês.

A spec (§4.2) diz o contrário: "no trial sem cartão, o acesso termina em `trial_end`; a carência de 3
dias **não** se aplica a quem nunca cadastrou cartão". Além disso, o Smart Retries do Stripe vai continuar tentando cobrar
uma fatura que não tem cartão.

**Correção sugerida (API):**

1. No checkout, enviar `subscription_data.trial_settings.end_behavior.missing_payment_method=cancel`.
   No fim do trial sem cartão, o Stripe manda `customer.subscription.deleted` e o acesso termina.
2. Por precaução, na regra de acesso: se o status é `past_due` e `current_period_start` é igual ao `trial_end` sem
   nenhuma fatura paga com valor, não dar carência.
3. Teste com test clock: trial sem cartão → sem acesso logo depois do `trial_end`.

### Correção e reteste (28/10, 15h55 UTC) — **Aprovado**

Corrigido no PR [story-verse-api#77](https://github.com/axyonsoftwarehouse/story-verse-api/pull/77), que já entrou na `develop` e
está no QA com a imagem `qa-60d9f2c`. O teste novo falha com o código anterior e passa com a correção; o CI também passou.

- **Checkout novo** (`qa-trial-cancel`, cliente ligado ao test clock `qa-trial-cancel`, trial iniciado pelo
  checkout do site): a assinatura nasce com `missing_payment_method: cancel`. Com o relógio avançado 8 dias,
  o Stripe muda para **`canceled`** (`ended_at` = fim do trial), o webhook `customer.subscription.deleted` é
  processado sem erro e a API devolve `accessUntil` = `trial_end`. Não há período novo nem carência.
- **Assinatura antiga já em `past_due`** (`qa-sem-assinatura`): a regra nova limita o acesso ao `trial_end`
  (04/11), e não mais a 07/12.
- Nos dois casos, a API ainda mostra `active=true` porque 04/11 ainda não chegou no relógio real; o test clock
  adianta o tempo só no Stripe. O corte depois do `trial_end` é coberto pelo teste `pastDueLogoDepoisDoTrialNaoTemCarencia`.

## BILL-QA-02 · Baixa — método HTTP errado responde 500

`GET /api/v1/account` (só existe `DELETE`) responde **500 "Erro interno."**, com
`HttpRequestMethodNotSupportedException` no log. O certo seria 405, e o 500 polui o Sentry. A causa provável é o
handler global de exceções, que não trata essa exceção.

## Dados deixados no QA

- `qa-assinante`: assinatura de teste em trial até 04/11.
- `qa-trial-cancel`: conta criada para o reteste, com cliente no test clock `qa-trial-cancel` e assinatura `canceled`.
- `qa-sem-assinatura`: cliente de teste ligado a um **test clock** (`qa-fim-trial`), com assinatura `past_due`.
  Para voltar a ser uma conta "sem assinatura", apague o test clock no painel do Stripe (modo de teste), o que leva
  junto o cliente e a assinatura, e remova as linhas dela em `billing_customers`/`billing_subscriptions`.

## Antes de ligar a cobrança em produção

- Levar a correção da BILL-QA-01 (já na `develop`) para a `main`, que é o que publica a produção.
- Testar à mão um cartão aprovado (`4242…`) e um recusado (`4000 0000 0000 0341`) pelo portal, para ver
  `invoice.payment_failed` → `past_due` com carência → recuperação.
