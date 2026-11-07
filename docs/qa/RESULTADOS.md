# QA — painel de resultados

Última atualização: 2026-11-07.

> **Como usar:** o Hermes acrescenta uma linha em **Rodadas** e uma linha por defeito novo em
> **Defeitos abertos**. Nós mudamos o status para `em correção`/`corrigido` e preenchemos `Correção`.
> O detalhe de cada caso fica no relatório da rodada. Regras em [`README.md`](README.md).

## Rodadas

| Data | Bloco | Relatório | Resultado | Achados |
|---|---|---|---|---|
| 2026-10-23 | Nível 1 — smoke | [`nivel1`](2026-10-23-nivel1.md) | Aprovado com ressalvas | 1 médio, 3 baixos |
| 2026-10-23 | Nível 2 — matriz do admin | [`nivel2-admin`](2026-10-23-nivel2-admin.md) | Aprovado | 6/6 cenários; 6 observações |
| 2026-10-23 | Importação, conta e PWA | [`importacao-pwa`](2026-10-23-importacao-pwa.md) | Aprovado com ressalvas | 1 médio, 2 baixos |
| 2026-10-24 | Biblioteca pública | [`biblioteca`](2026-10-24-biblioteca.md) | Aprovado com ressalvas | 6/6 cenários; 2 baixos; 4 re-testes ok |
| 2026-10-24 | Re-teste do lote de correções | [`lote-correcoes`](2026-10-24-lote-correcoes.md) | Aprovado | 7 corrigidos; BUG-002 fechado sem correção |

| 2026-10-25 | Fase 2 do admin (2A–2D) | [`admin-fase-2`](2026-10-25-admin-fase-2.md) | Aprovado | 14/14 cenários; sem defeitos |
| 2026-10-25 | Acervo: coleções (AD-11) e importação em lote (AD-12) | [`acervo`](2026-10-25-acervo.md) | Aprovado no re-teste | 1 alto e 1 médio, corrigidos e re-testados |
| 2026-10-25 | Catálogo do Acervo (AD-07 a AD-10) | [`catalogo`](2026-10-25-catalogo.md) | Aprovado | 4/4 cenários; sem defeitos; 3 observações |
| 2026-10-25 | Fórum (F-01/F-02), spoiler e aceitar resposta, e sobras do plano | [`forum-e-resto`](2026-10-25-forum-e-resto.md) | Aprovado | 10 cenários; 1 baixo corrigido no dia |
| 2026-10-25 | Assinatura (BILL) e PWA, recusa, reembolso, disputa e cancelamento | [`billing`](2026-10-25-billing.md) | Aprovado: 01–06, P-01, **cobrança real** de R$ 9,90, dunning completo e os três caminhos que exigem aprovação humana | 6 corrigidos (financeiro 500, CORS, 3 no webhook/RLS, cancelamento imediato) |
| 2026-10-25 | Fórum: spoiler na resposta e aceite da equipe | [`forum-spoiler`](2026-10-25-forum-spoiler.md) | Aprovado | 2 melhorias entregues + 1 aviso na tela |
| 2026-10-25 | Onboarding (e-mail), backup/restore, portal, carga e a11y | [`onboarding-e-operacao`](2026-10-25-onboarding-e-operacao.md) | Aprovado no que foi possível; Stripe exige aprovação humana para recusa/reembolso/cancelamento | Mailpit no QA + 1 correção de `.env` |
| 2026-11-07 | Passada geral de UI/UX (desktop e celular, 5 papéis) | [`passada-geral-ui-ux`](2026-11-07-passada-geral-ui-ux.md) | Aprovado com ressalvas | 2 médios, 4 baixos, BUG-008 atualizado (+ BUG-033 a 037 achados na correção e na verificação do admin); leitores bloqueados pelo paywall no QA |

## Defeitos abertos

| ID | Sev. | Prio. | Área | Defeito | Origem | Status | Correção | Cartão |
|---|---|---|---|---|---|---|---|---|
| **BUG-007** | Obs. | P2 | Admin | Visão geral leva ~5–9 s para sair de “Carregando…” no QA (container 0,5 CPU). | NB-04 (nivel2-admin) | aberto (monitorar) | — | — |
| **BUG-008** | Baixo | P2 | Admin | Sem backup no QA: rótulo corrigido para “sem backup registrado” (#198), mas o ícone continua o ✓ verde de “em dia”. | NB-05 (nivel2-admin); passada-geral-ui-ux | em correção | branch `fix/qa-passada-geral-ui-ux` | — |
| **BUG-027** | Médio | P1 | Acessibilidade | Botão de confirmação destrutiva (`btn-primary is-danger`) com texto rosa sobre dourado, contraste ~1,5:1. | passada-geral-ui-ux | em correção | branch `fix/qa-passada-geral-ui-ux` | — |
| **BUG-028** | Médio | P1 | Assinatura | `/conta/assinatura` em `past_due` sem acesso diz “o acesso continua por alguns dias” e oferece “Assinar agora” em vez do portal. | passada-geral-ui-ux | em correção | branch `fix/qa-passada-geral-ui-ux` | — |
| **BUG-029** | Baixo | P2 | Admin | Auditoria mostra ações cruas sem rótulo: `billing.series` e `catalog.audio.*` (audiolivros). | passada-geral-ui-ux | em correção | branch `fix/qa-passada-geral-ui-ux` | — |
| **BUG-030** | Baixo | P2 | Admin | “✓ envios esperando revisão” com zero envios lê como pendência. | passada-geral-ui-ux | em correção | branch `fix/qa-passada-geral-ui-ux` | — |
| **BUG-031** | Baixo | P2 | Assinatura | Tela de bloqueio com o rótulo colado no topo e sem logo/cabeçalho. | passada-geral-ui-ux | em correção | branch `fix/qa-passada-geral-ui-ux` | — |
| **BUG-032** | Baixo | P2 | Navegação | “Sair da conta” só em Avatar → Ajustes → fim da página; na tela de bloqueio sai sem confirmar. | passada-geral-ui-ux | em correção | branch `fix/qa-passada-geral-ui-ux` | — |
| **BUG-033** | Médio | P1 | Admin | Visão geral presa em “Carregando…” quando o token é renovado com ela ainda carregando (e sempre no dev, pelo StrictMode); regressão do #200. | correções da passada-geral-ui-ux | em correção | branch `fix/qa-passada-geral-ui-ux` | — |
| **BUG-034** | Médio | P1 | Admin | Detalhe da conta: “Últimas ações” mostra o código cru (`user.view`) e atribui ações da equipe a “script na VPS” (a API manda só `actorId`). | verificação do admin (passada-geral-ui-ux) | em correção | branch `fix/qa-passada-geral-ui-ux` | — |
| **BUG-035** | Baixo | P2 | Admin | Financeiro: o detalhe da assinatura abre embaixo da lista, fora da tela, sem rolar até ele. | verificação do admin (passada-geral-ui-ux) | em correção | branch `fix/qa-passada-geral-ui-ux` | — |
| **BUG-036** | Baixo | P2 | Admin | Financeiro: “Fatura” mostra o status cru do Stripe (`open`, `paid`). | verificação do admin (passada-geral-ui-ux) | em correção | branch `fix/qa-passada-geral-ui-ux` | — |
| **BUG-037** | Baixo | P2 | Admin | Celular: Auditoria e Acervo → Importações rolam para o lado (cartões e campo de arquivo mais largos que a tela). | verificação do admin (passada-geral-ui-ux) | em correção | branch `fix/qa-passada-geral-ui-ux` | — |

## Defeitos corrigidos

| ID | Severidade | Área | Defeito | Correção | Verificação |
|---|---|---|---|---|---|
| **BUG-010** | Médio | Home | Capa do cartão “Pronto para voltar” estourava o quadro de 62 px. | PR [#63](https://github.com/axyonsoftwarehouse/story-verse-web/pull/63) (`ccf6952`) | Re-testado em 24/10/2026 ([biblioteca](2026-10-24-biblioteca.md)) |
| **BUG-011** | Médio | Importação | Título de capítulo EPUB perdia a primeira letra (`Coelho` → `oelho`). | PR [#63](https://github.com/axyonsoftwarehouse/story-verse-web/pull/63) (`ccf6952`) | Re-testado em 24/10/2026 ([biblioteca](2026-10-24-biblioteca.md)) |
| **BUG-012** | Baixo | Plataforma | Sem indicador de modo offline. | PR [#63](https://github.com/axyonsoftwarehouse/story-verse-web/pull/63) (`ccf6952`) | Re-testado em 24/10/2026 ([biblioteca](2026-10-24-biblioteca.md)) |
| **BUG-013** | Baixo | Conta | Link de recuperação pedia a senha nova sem conferir o token. | PR [#63](https://github.com/axyonsoftwarehouse/story-verse-web/pull/63) (`ccf6952`) | Re-testado em 24/10/2026 ([biblioteca](2026-10-24-biblioteca.md)) |
| **BUG-001** | Baixo | Estante | Contador “N livros” ignorava o filtro aplicado. | PR [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) | Re-testado em 24/10/2026 ([lote](2026-10-24-lote-correcoes.md)) |
| **BUG-003** | Baixo | Conta | “Sair da conta” deslogava sem confirmação. | PR [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) | Re-testado em 24/10/2026 ([lote](2026-10-24-lote-correcoes.md)) |
| **BUG-004** | Baixo | Admin | Título e explicação colados nos cartões “Sem permissão”. | PR [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) | Re-testado em 24/10/2026 ([lote](2026-10-24-lote-correcoes.md)) |
| **BUG-005** | Baixo | Admin | Busca de contas só achava por e-mail completo. | PRs [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) + [#44](https://github.com/axyonsoftwarehouse/story-verse-api/pull/44) | Re-testado em 24/10/2026 ([lote](2026-10-24-lote-correcoes.md)) |
| **BUG-006** | Baixo | Admin | Confirmações usavam `window.confirm` nativo. | PR [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) | Re-testado em 24/10/2026 ([lote](2026-10-24-lote-correcoes.md)) |
| **BUG-014** | Baixo | Plataforma | Analytics da Vercel gerava erro de console no VPS. | PR [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) | Re-testado em 24/10/2026 ([lote](2026-10-24-lote-correcoes.md)) |
| **BUG-015** | Baixo | Estante | Remoção da estante não refletia na ficha pública até o sync periódico. | PR [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) | Re-testado em 24/10/2026 ([lote](2026-10-24-lote-correcoes.md)) |
| **BUG-016** | **Alto** | Acervo | "Importar agora" respondia 500 (RLS em `catalog_imports`) e nada era importado; histórico sempre vazio. | API PR [#50](https://github.com/axyonsoftwarehouse/story-verse-api/pull/50) + `V20__catalog_imports_select.sql` | Re-testado em 25/10/2026 ([acervo](2026-10-25-acervo.md)) |
| **BUG-017** | Médio | Acervo | Ordem definida na coleção não aparecia na biblioteca. | API PR [#51](https://github.com/axyonsoftwarehouse/story-verse-api/pull/51) | Re-testado em 25/10/2026 ([acervo](2026-10-25-acervo.md)) |
| **BUG-009** | Obs. | Fórum | Fórum desligado no build de QA; fila de moderação sempre vazia. | PR [#90](https://github.com/axyonsoftwarehouse/story-verse-web/pull/90) (build de QA com `VITE_FORUM_ENABLED=true`) | Verificado em 25/10/2026 ([forum-e-resto](2026-10-25-forum-e-resto.md)) |
| **BUG-018** | Baixo | Fórum | Resposta em moderação anunciava "Resposta publicada." e o tópico seguia com 0 respostas. | PR [#91](https://github.com/axyonsoftwarehouse/story-verse-web/pull/91) | Re-testado em 25/10/2026 ([forum-e-resto](2026-10-25-forum-e-resto.md)) |
| **BUG-019** | **Alto** | Financeiro | `/admin/financeiro` respondia 500 ("Erro interno.") — auditoria em transação `readOnly`. | API PR [#52](https://github.com/axyonsoftwarehouse/story-verse-api/pull/52) | Re-testado em 25/10/2026 ([billing](2026-10-25-billing.md)) |
| **BUG-020** | Baixo | Fórum | "Aceitar resposta" só aparecia para o autor, mas a API permite a equipe; e o aceite não guardava quem nem quando. | API PR [#53](https://github.com/axyonsoftwarehouse/story-verse-api/pull/53) · site PR [#95](https://github.com/axyonsoftwarehouse/story-verse-web/pull/95) | Re-testado em 25/10/2026 ([forum-spoiler](2026-10-25-forum-spoiler.md)) |
| **BUG-021** | **Alto** | Assinatura | Paywall devolvia 401/402 sem CORS: o app mostrava "sem conexão" no lugar de "assinatura necessária". | API PR [#54](https://github.com/axyonsoftwarehouse/story-verse-api/pull/54) | Re-testado em 25/10/2026 ([billing](2026-10-25-billing.md)) |
| **BUG-022** | **Alto** | Assinatura | **Toda** entrega de webhook dava 500: `:error` nulo sem tipo no Postgres. | API PR [#55](https://github.com/axyonsoftwarehouse/story-verse-api/pull/55) | Re-testado em 25/10/2026 ([billing](2026-10-25-billing.md)) |
| **BUG-023** | Médio | Assinatura | Evento de webhook gravado mas nunca marcado como processado (transações separadas). | API PR [#56](https://github.com/axyonsoftwarehouse/story-verse-api/pull/56) | Re-testado em 25/10/2026 ([billing](2026-10-25-billing.md)) |
| **BUG-024** | **Alto** | Assinatura | Quem tinha plano levava 402: `requireAccess` sem transação → RLS não enxergava a assinatura. | API PR [#57](https://github.com/axyonsoftwarehouse/story-verse-api/pull/57) | Re-testado em 25/10/2026 ([billing](2026-10-25-billing.md)) |
| **BUG-025** | **Alto** | Assinatura | Paywall liberava acesso quando faltava data na assinatura (fail-open); data ilegível virava `null` e também liberava. | API PR [#59](https://github.com/axyonsoftwarehouse/story-verse-api/pull/59) | Re-testado em 25/10/2026 ([billing](2026-10-25-billing.md)) |
| **BUG-026** | **Alto** | Assinatura | Cancelamento **imediato** continuava liberando acesso até o fim do período pago (um mês de graça, com o pagamento já reembolsado): `evaluate` olhava só `current_period_end`. | API PR [#60](https://github.com/axyonsoftwarehouse/story-verse-api/pull/60) (V22 `ended_at`) | Re-testado em 25/10/2026 ([billing](2026-10-25-billing.md)) |

## Fechados sem correção

- **BUG-002** — percentual "um capítulo atrasado": regra confirmada em 24/10/2026. Home, estante e leitor usam
  `(chapterIndex + scrollRatio) / chapterCount`; no fim de um capítulo o percentual já coincide com o início do
  próximo, então não há atraso. Coberto por `src/lib/progress.test.ts`.

## Como um defeito sai daqui

1. O Hermes re-testa no QA e confirma que o caso e o smoke passam.
2. Atualiza o status para `re-testado` no relatório da rodada e move a linha para **Corrigidos**
   (ou remove de **Abertos**, mantendo o histórico no relatório).
3. Se o cartão do Trello existir, ele só vai para DONE com print do re-teste + link do PR.

## Próximos cenários a executar

- **Assinatura (falhas)**: **recusa na renovação está coberta** (cartão `4000 0000 0000 0341` → `past_due`, `invoice.payment_failed`, carência e recuperação — ver [`billing`](2026-10-25-billing.md)).
- **Ainda bloqueado por aprovação humana no Stripe**: reembolso, disputa e cancelamento pela API.
- **E-mail**: caminho provado (SMTP → Mailpit → token válido). Concluir troca de senha e confirmação de cadastro exige digitar senha (dono).
- **A-05 exclusão de conta**: exige a senha atual e conta descartável.
- **A-05 (excluir conta)** — o painel pede a senha atual; precisa de conta descartável e da senha digitada pelo dono.
