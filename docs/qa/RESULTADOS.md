# QA — painel de resultados

Última atualização: 2026-10-24.

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

## Defeitos abertos

| ID | Sev. | Prio. | Área | Defeito | Origem | Status | Correção | Cartão |
|---|---|---|---|---|---|---|---|---|
| **BUG-001** | Baixo | P2 | Estante | Contador “N livros” ignora o filtro aplicado; mostra o total enquanto a lista mostra o filtrado. | QA-02 (nivel1) | em correção | PR [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) | — |
| **BUG-003** | Baixo | P2 | Conta | “Sair da conta” desloga sem confirmação, diferente das ações destrutivas do painel. | QA-04 (nivel1) | em correção | PR [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) | — |
| **BUG-004** | Baixo | P2 | Admin | Nos cartões “Sem permissão”, título e explicação saem colados (`strong` + `span` inline). | NB-01 (nivel2-admin) | em correção | PR [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) | — |
| **BUG-005** | Baixo | P2 | Admin | Busca de contas só acha por e-mail completo ou parte do nome; `qa-leitor` sem domínio parece “conta inexistente”. | NB-02 (nivel2-admin) | em correção | PRs [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) + [#44](https://github.com/axyonsoftwarehouse/story-verse-api/pull/44) | — |
| **BUG-006** | Baixo | P2 | Admin | Confirmações usam `window.confirm` nativo (não estilizável, não sai em print, suprimido em PWA iOS). | NB-03 (nivel2-admin) | em correção | PR [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) | — |
| **BUG-007** | Obs. | P2 | Admin | Visão geral leva ~5–9 s para sair de “Carregando…” no QA (container 0,5 CPU). | NB-04 (nivel2-admin) | aberto (monitorar) | — | — |
| **BUG-008** | Obs. | P2 | Admin | Cartão de backup mostra “Backup atrasado” com “—” quando não há backup configurado no QA. | NB-05 (nivel2-admin) | aberto (observar) | — | — |
| **BUG-009** | Obs. | P2 | Fórum | Fórum desligado neste build; fila de moderação sempre vazia. | NB-06 (nivel2-admin) | aberto (depende da feature) | — | — |
| **BUG-014** | Baixo | P2 | Plataforma | Script `/_vercel/insights/script.js` responde HTML no VPS e gera erro de console em todas as páginas. | QA-B01 (biblioteca) | em correção | PR [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) | — |
| **BUG-015** | Baixo | P2 | Estante | Remover da estante deixa a ficha pública mostrando “Na sua estante” por até 30 s (sync só no app principal). | QA-B05 (biblioteca) | em correção | PR [#77](https://github.com/axyonsoftwarehouse/story-verse-web/pull/77) | — |

## Defeitos corrigidos

| ID | Severidade | Área | Defeito | Correção | Verificação |
|---|---|---|---|---|---|
| **BUG-010** | Médio | Home | Capa do cartão “Pronto para voltar” estourava o quadro de 62 px. | PR [#63](https://github.com/axyonsoftwarehouse/story-verse-web/pull/63) (`ccf6952`) | Re-testado em 24/10/2026 ([biblioteca](2026-10-24-biblioteca.md)) |
| **BUG-011** | Médio | Importação | Título de capítulo EPUB perdia a primeira letra (`Coelho` → `oelho`). | PR [#63](https://github.com/axyonsoftwarehouse/story-verse-web/pull/63) (`ccf6952`) | Re-testado em 24/10/2026 ([biblioteca](2026-10-24-biblioteca.md)) |
| **BUG-012** | Baixo | Plataforma | Sem indicador de modo offline. | PR [#63](https://github.com/axyonsoftwarehouse/story-verse-web/pull/63) (`ccf6952`) | Re-testado em 24/10/2026 ([biblioteca](2026-10-24-biblioteca.md)) |
| **BUG-013** | Baixo | Conta | Link de recuperação pedia a senha nova sem conferir o token. | PR [#63](https://github.com/axyonsoftwarehouse/story-verse-web/pull/63) (`ccf6952`) | Re-testado em 24/10/2026 ([biblioteca](2026-10-24-biblioteca.md)) |

## Fechados sem correção

- **BUG-002** — percentual "um capítulo atrasado": regra confirmada em 24/10/2026. Home, estante e leitor usam
  `(chapterIndex + scrollRatio) / chapterCount`; no fim de um capítulo o percentual já coincide com o início do
  próximo, então não há atraso. Coberto por `src/lib/progress.test.ts`.

## Como um defeito sai daqui

1. O Hermes re-testa no QA e confirma que o caso e o smoke passam.
2. Atualiza o status para `re-testado` no relatório da rodada e move a linha para **Corrigidos**
   (ou remove de **Abertos**, mantendo o histórico no relatório).
3. Se o cartão do Trello existir, ele só vai para DONE com print do re-teste + link do PR.

## Próximos cenários a acrescentar

- **AD-11** coleções e **AD-12** importação em lote (Acervo).
- **BILL-01 a BILL-06** assinatura/Stripe (dependem das chaves de teste no QA).
