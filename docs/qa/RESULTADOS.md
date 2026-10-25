# QA — painel de resultados

Última atualização: 2026-10-25.

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
| 2026-10-25 | Assinatura (BILL) e PWA | [`billing`](2026-10-25-billing.md) | Parcial: 01/04/06 e P-01 ok; 02/03/05 bloqueados | 1 alto corrigido (financeiro 500) |

## Defeitos abertos

| ID | Sev. | Prio. | Área | Defeito | Origem | Status | Correção | Cartão |
|---|---|---|---|---|---|---|---|---|
| **BUG-007** | Obs. | P2 | Admin | Visão geral leva ~5–9 s para sair de “Carregando…” no QA (container 0,5 CPU). | NB-04 (nivel2-admin) | aberto (monitorar) | — | — |
| **BUG-008** | Obs. | P2 | Admin | Cartão de backup mostra “Backup atrasado” com “—” quando não há backup configurado no QA. | NB-05 (nivel2-admin) | aberto (observar) | — | — |

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

- **BILL-02/03/05** — checkout, trial/paywall e webhook do Stripe: **bloqueado** até o QA receber `BILLING_ENABLED=true`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` (API) e `VITE_BILLING_ENABLED=true` (build). Detalhes em [`billing`](2026-10-25-billing.md).
- **A-05 (excluir conta)** — o painel pede a senha atual; precisa de conta descartável e da senha digitada pelo dono.

