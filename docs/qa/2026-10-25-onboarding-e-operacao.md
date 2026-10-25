# Relatório — onboarding (e-mail), operação, portal e carga

- **Data:** 25/10/2026, 22h30–23h30 UTC (19h30–20h30 em Brasília)
- **Alvo:** QA `https://qa.storyverse.2.29.42.104.sslip.io` · API `…/api/v1` · VPS (`deploy@2.29.42.104`)
- **Objetivo:** fechar as lacunas que o resumo do professor listou como pendentes (itens 1 a 7)
- **Evidências:** `qa-runs/2026-10-25-onboarding/evidencias/`

## 1. E-mail transacional — aprovado

O QA nunca tinha exercitado o envio de e-mail: `APP_AUTH_REQUIRE_EMAIL_CONFIRMATION` estava **`false`** e o SMTP não apontava para lugar nenhum. Montagem:

- **Mailpit** no QA (container `mailpit`, rede `storyverse-qa_qa-private`): captura tudo, nada sai para a internet.
- `.env` do QA: `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `SMTP_AUTH=false`, `SMTP_STARTTLS=false`, `SMTP_FROM=no-reply@storyverse.local`; e **`APP_AUTH_REQUIRE_EMAIL_CONFIRMATION=true`** (igual a produção).

| Verificação | Resultado |
|---|---|
| `POST /auth/forgot-password` para `qa-leitor@example.com` | **202** |
| Mensagem no Mailpit | **1** — de `no-reply@storyverse.local`, assunto “Redefinir sua senha no Storyverse” |
| Link recebido | `https://qa.storyverse.…/redefinir-senha#token=…` — token no **fragmento**, então não vai para log de servidor |
| `POST /auth/reset-password/validate` com o token do e-mail | **204** (válido) |
| Mesmo endpoint com token inventado | **400** (controle) |
| Abrir o link no navegador | tela **“Crie uma senha nova”** (Senha nova / Repita a senha / Salvar senha) |

**Não executado:** concluir a troca de senha e o clique de confirmação de cadastro — os dois exigem **digitar senha**, o que o agente não faz. O caminho técnico (SMTP → mensagem → token válido → tela certa) está provado.

## 2. Backup e restore — aprovado

| Etapa | Resultado |
|---|---|
| `pg_dump` do banco do QA | **261 KB**, **48 tabelas** |
| Restore num banco novo (`qa_restore`) | concluído sem erro |
| Contagens no original × restaurado | **idênticas** — 6 usuários · 2 tópicos · 4 respostas · 1 assinatura · 9 eventos · 3 livros |
| Histórico de migração | **25** registros restaurados |

O banco de teste foi criado só para a prova (`qa_restore`).

## 3. Stripe: falha de pagamento, reembolso e cancelamento — **bloqueado pelo Stripe**

O Stripe passou a exigir **aprovação humana** (recurso novo da conta) para ações sensíveis, mesmo em modo de teste:

| Ação | Resposta |
|---|---|
| `POST /v1/refunds` (reembolsar a cobrança de R$ 9,90) | *“This action requires human approval”* → `apreq_test_61VdyGwlrmFlbIZ8S16VduEt9B9Pj0SgbqaBwvNJ2Bmq` |
| `POST /v1/payment_methods/pm_card_chargeDeclined/attach` | **“Your card was declined”** — o Stripe recusa até anexar o cartão de teste que recusa |
| `DELETE /v1/subscriptions/…` (cancelar) | mesma exigência de aprovação |

**Consequência:** os cenários de **cartão recusado/3DS, retentativa (dunning), reembolso e disputa** só podem ser executados com um clique no dashboard (ou aprovando o pedido). Não é limitação do Storyverse — é proteção da conta Stripe.

## 4. Portal do Stripe: cancelamento — parcial

- Sessão de portal criada pela API e aberta: mostra **assinatura ativa**, “próxima data de faturamento 25/11”, **Visa ••••4242** e o botão **Cancelar assinatura**.
- O fluxo abre a revisão com o texto correto: *“ela continuará disponível até o final do período de cobrança **25 de novembro de 2026**”*.
- Para chegar limpo nesse teste, o `cancel_at_period_end` foi **desfeito** (`false`) antes — e o webhook trouxe a mudança de volta, confirmando de novo a sincronização.
- **Não concluído:** a confirmação final (o seletor de motivo é um dropdown customizado do portal). O estado resultante é o mesmo que já foi provado pela API: `cancel_at_period_end=true` sincronizado no banco e refletido na tela como “Cancelamento agendado”.

## 5. Carga — aprovado

| Métrica | Resultado |
|---|---|
| 40 requisições a `/catalog/books?limit=20`, concorrência 10 | **40/40 HTTP 200** |
| Tempo por requisição | **0,57 s – 0,77 s** (mediana **0,58 s**) |
| Tempo total da rodada | **11,7 s** |

Nenhum erro sob concorrência. O tempo por requisição é o ponto de atenção: 0,58 s para listar o catálogo é alto para produção — o QA roda com 0,5 CPU, então mede mais o container do que a aplicação.

## 6. Acessibilidade (estrutural) — aprovado no que foi medido

Checagem pela árvore de acessibilidade do navegador (nome acessível dos controles):

| Tela | Interativos | Sem nome acessível |
|---|---|---|
| Home | 48 | **0** |
| Biblioteca | 10 | **0** |

**Não cobre:** contraste, ordem de foco, leitor de tela real — é uma verificação estrutural, não uma auditoria completa.

## 7. Exclusão de conta — continua bloqueada

`DELETE /account` exige a **senha atual** no corpo. Sem digitar senha, não há como executar; e apagar uma conta da matriz de QA quebraria as rodadas seguintes.

## Ajustes feitos no ambiente (não são código)

1. **Mailpit** instalado no QA (container `mailpit`) e ligado à rede interna — útil para todas as rodadas futuras.
2. `.env` do QA ganhou o bloco `SMTP_*` e `APP_AUTH_REQUIRE_EMAIL_CONFIRMATION=true` (backup `.env.antes-do-smtp.*` guardado).
3. **Correção de higiene:** `SMTP_FROM_NAME=Storyverse QA` (com espaço, sem aspas) quebrava o `source` do `.env` — passou para `SMTP_FROM_NAME="Storyverse QA"`.
4. `docker-compose.override.yml` do QA documenta agora o bloco de e-mail.

## O que muda para quem for testar o QA daqui pra frente

- **Cadastro novo passa a exigir confirmação por e-mail.** O e-mail não sai para a internet: abre em `http://127.0.0.1:8025` na VPS (Mailpit), acessível por túnel SSH. Se preferir o QA sem confirmação, basta voltar a flag para `false`.
- As contas da matriz (`qa-leitor`, `qa-moderador`, `qa-admin`, `qa-sem-estante`) já existiam e continuam entrando normalmente.
