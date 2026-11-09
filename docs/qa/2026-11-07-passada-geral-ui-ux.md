# Relatório — passada geral de UI/UX

- **Data:** 2026-11-07, tarde (HPBA)
- **Alvo:** https://qa.storyverse.2.29.42.104.sslip.io
- **Contas:** `qa-leitor`, `qa-sem-estante`, `qa-admin`, `qa-moderador`, `qa-suporte`
- **Commit publicado:** deploy automático da `develop` (topo em `d528d39`, PR #200)
- **Execução:** navegador embutido do Claude Code (Chromium), desktop (~800 px) e celular (375×812)
- **Evidências:** `qa-runs/2026-11-07-passada-geral/evidencias/` (12 prints)

## Resultado: aprovado com ressalvas

Os fluxos principais funcionam, as permissões por papel estão certas e não há rolagem lateral no
celular. Ficaram 2 defeitos médios (contraste do botão de confirmação destrutiva e mensagem
contraditória na assinatura), 4 baixos e a atualização do BUG-008.

**Bloqueio de ambiente:** `qa-leitor` e `qa-sem-estante` caem no paywall (`402` em toda a API).
`qa-leitor` ainda carrega a assinatura de teste da rodada de 25/10 (hoje “Pagamento pendente”,
acesso até 02/11); `qa-sem-estante` está “Sem assinatura”. Os fluxos de leitor (leitor, chat, perfil,
busca) foram exercitados com contas da equipe, que têm acesso liberado. Para as próximas rodadas,
dar “Acesso grátis” às duas contas no admin ou incluir um `billing_grants` no `seed-qa.sh`.

| ID | Cenário | Resultado | Evidência |
|---|---|---|---|
| UX-01 | Home deslogada: desktop e 375 px, console, rolagem lateral | ✅ sem erros, sem rolagem lateral | `12-mobile-home.jpg` |
| UX-02 | Login: rótulos, `autocomplete`, erro de credencial | ✅ labels associados, `email`/`current-password`, “E-mail ou senha inválidos.” | — |
| UX-03 | Conta sem acesso: tela de bloqueio e `/conta/assinatura` | ⚠️ funciona, mas com BUG-028 e BUG-031 | `01`, `02`, `03` |
| UX-04 | Leitor: retomar posição, barra de ferramentas, nomes acessíveis | ✅ abre onde parou; todos os botões com `aria-label` | — |
| UX-05 | Chat com personagem: resposta, aviso de IA, proteção de spoiler | ✅ Isaura “ainda não conhece Álvaro” no ponto da leitura | `04-chat-isaura-sem-spoiler.jpg` |
| UX-06 | Busca no acervo: resultados e estado vazio | ✅ 18 resultados para “Machado”; vazio oferece importar | — |
| UX-07 | Perfil: metas, sequência, calendário, conquistas | ✅ (cartões de conquista surgem com animação ao rolar) | — |
| UX-08 | Admin (`qa-admin`): todas as abas carregam sem erro de API | ✅ 10 abas; visão geral pedida uma única vez (PR #200 confirmado) | `05`, `09` |
| UX-09 | Permissões: `qa-moderador` | ✅ Visão geral, Sanções, Acervo, Grupos; `/admin/contas` → “Sem permissão” | `10` |
| UX-10 | Permissões: `qa-suporte` | ✅ Visão geral, Contas, Sanções, Grupos; `/admin/metricas` → “Sem permissão”; sem “Revogar” | — |
| UX-11 | Celular: home, leitor, chat, admin | ✅ sem rolagem lateral; barra do leitor em 2 linhas; campo do chat com 16 px (sem zoom no iOS) | `11`, `12` |
| UX-12 | Sair da conta | ⚠️ funciona; BUG-027 no diálogo e BUG-032 na descoberta | `07`, `08` |

## Defeitos

### BUG-027 · Médio · Acessibilidade — botão de confirmação destrutiva quase ilegível

**Onde:** todo `ConfirmDialog` com `danger` (ex.: Ajustes → Sair da conta) e o envio do `SanctionDialog`.
**Passos:** logado, Avatar → Ajustes → “Sair da conta”.
**Esperado:** botão “Sair” legível (contraste ≥ 4,5:1).
**Obtido:** texto rosa `rgb(232,168,168)` sobre o gradiente dourado do `.btn-primary`, contraste em
torno de 1,5:1. `src/components/confirmDialog.css:27` troca só `color`/`border-color` e mantém o
fundo de `.btn-primary` (`className="btn btn-primary is-danger"` em `ConfirmDialog.tsx:92` e
`SanctionDialog.tsx:164`).
**Evidência:** `07-confirmar-sair.jpg`, `08-confirmar-sair-zoom.png`

### BUG-028 · Médio · Assinatura — “Pagamento pendente” diz que o acesso continua quando já está bloqueado

**Onde:** `/conta/assinatura` com `qa-leitor` (status `past_due`, `active=false`).
**Passos:** entrar com `qa-leitor` → “Minha assinatura”.
**Esperado:** uma mensagem só: acesso suspenso e o que fazer (atualizar o cartão no portal).
**Obtido:** chip “Sem acesso”, “Acesso até 02 de nov. de 2026” (já passou) e, ao mesmo tempo, “O acesso
continua por alguns dias; atualize o cartão…”. O aviso de `past_due` aparece sem olhar `active`
(`SubscriptionPage.tsx:166`). A ação principal é “Assinar agora” (novo checkout), e o portal, que
resolveria a cobrança pendente, fica num link pequeno, o que pode gerar uma segunda assinatura.
**Evidência:** `03-assinatura-past-due-contraditoria.jpg`

### BUG-029 · Baixo · Admin — Auditoria mostra a ação crua `billing.series`

**Onde:** `/admin/auditoria`.
**Obtido:** ao lado de “Financeiro consultado” aparece o código `billing.series`, que falta no mapa
`ACTION_LABEL` de `src/features/admin/auditFormat.ts`.
**Evidência:** `09-auditoria-billing-series.jpg`

### BUG-030 · Baixo · Admin — itens zerados de “Precisa de ação” leem como pendência

**Onde:** `/admin` (admin e moderador).
**Obtido:** “✓ envios esperando revisão” sem número. A frase afirma que há envios esperando; o ✓
sozinho não deixa claro que são zero. Sugestão: “nenhum envio esperando revisão”.
**Evidência:** `06-admin-precisa-de-acao-zoom.png`

### BUG-031 · Baixo · Assinatura — tela de bloqueio sem respiro no topo e sem marca

**Onde:** tela cheia de bloqueio (`BillingBlocked`), qualquer conta sem acesso.
**Obtido:** o rótulo “ASSINATURA” fica colado na borda superior (`top: 0`) e a tela não tem logo nem
cabeçalho. Parece uma página quebrada logo depois do login.
**Evidência:** `01-paywall-qa-leitor.jpg`, `02-paywall-qa-sem-estante.jpg`

### BUG-032 · Baixo · Navegação — “Sair da conta” difícil de achar e com comportamento diferente

**Obtido:** o único caminho é Avatar → Ajustes → fim da página; o menu “⋯” não tem “Sair”. Na tela de
bloqueio o “Sair” sai na hora, enquanto em Ajustes pede confirmação.

### BUG-008 (atualização) · Obs. → Baixo · Admin — “sem backup registrado” com ✓ verde

O PR #198 trocou o rótulo para “sem backup registrado”, mas o ícone continua o ✓ verde de “em dia”,
porque `ActionStrip` desenha o ✓ sempre que `count === 0` (`OverviewSection.tsx:139`). O item precisa
de um ícone neutro.
**Evidência:** `06-admin-precisa-de-acao-zoom.png`

## Correções (branch `fix/qa-passada-geral-ui-ux`)

Conferidas no site local (Vite) apontado para a API de QA por proxy, com `qa-leitor` e `qa-admin`.
Falta o re-teste no QA depois do deploy.

| Defeito | O que mudou |
|---|---|
| BUG-027 | `.btn-primary.is-danger` ganha fundo de perigo e texto escuro (contraste ~9:1) em todo o app; saiu a regra que só trocava a cor do texto no diálogo. |
| BUG-028 | Em `past_due` sem acesso: aviso “acesso está suspenso”, “Acesso terminou em” para data passada e “Atualizar cartão” (portal) como ação principal, sem “Assinar agora”. Com acesso, o aviso antigo continua. Sem portal disponível, ainda oferece assinar. |
| BUG-008 / BUG-030 | “Precisa de ação” ganha texto para o zero (“nenhum envio esperando revisão”, “nenhuma assinatura com pagamento pendente”) e estado neutro (“—” cinza) quando não há backup registrado. |
| BUG-029 | `billing.series` → “Gráfico do financeiro consultado”. |
| BUG-031 | Tela de bloqueio com a marca Storyverse no topo; em `past_due`, texto e botão “Atualizar cartão” levam a “Minha assinatura” em vez de um checkout novo; data passada vira “acesso terminou em”. |
| BUG-032 | “Sair da conta” no menu ⋯; a tela de bloqueio passa a pedir a mesma confirmação dos Ajustes. |
| BUG-033 (novo) | A visão geral ficava em “Carregando…” se o token fosse renovado com ela a caminho (no dev, sempre, pelo StrictMode). O efeito do PR #200 retornava cedo na segunda execução e a limpeza já tinha descartado a resposta. Agora a resposta vale enquanto a chave (usuário, papel, dia) for a mesma. |

### Verificação com `qa-admin` (depois das correções)

Passada completa com a conta admin no site local contra a API de QA, desktop e 375 px:

- **Funcionou:** sair pelo menu ⋯ com confirmação e entrar de novo; home com tudo respondendo
  200; leitor (retoma no capítulo III, letra maior/menor, sépia e luz noturna); chat com resposta da
  IA; perfil e Ajustes. As preferências de leitura voltaram ao estado original.
- **Admin:** visão geral completa nos três períodos; Contas (busca e detalhe); Sanções; Recursos
  em teste; Acervo (catálogo, livro, envios, coleções, importações); Grupos; Métricas; Site;
  Financeiro (detalhe); Auditoria. Nenhuma resposta 4xx/5xx da API.
- **Achados novos (todos corrigidos na mesma branch):**

| Defeito | Onde | O que mudou |
|---|---|---|
| BUG-034 · Médio | Detalhe da conta → Últimas ações | Usa os rótulos da Auditoria (“Conta consultada”). Sem `actorName` e com `actorId`, mostra “equipe (bb8f13f0)” em vez de “script na VPS”. |
| BUG-029 (ampliado) | Auditoria | Rótulos para `catalog.audio.*` (criado, enviado, publicado, ocultado, apagado, capítulos). |
| BUG-035 · Baixo | Financeiro | Ao abrir uma assinatura, a tela rola até o detalhe e põe o foco nele. |
| BUG-036 · Baixo | Financeiro | Fatura traduzida: Rascunho, Em aberto, Paga, Incobrável, Anulada. |
| BUG-037 · Baixo | Auditoria e Importações no celular | Lista com `minmax(0, 1fr)` e cabeçalho que quebra linha; campo de arquivo limitado à largura. Sem rolagem lateral. |

- **Observações sem correção:** `qa-leitor` tem **52 sessões ativas** (as sessões se acumulam a
  cada login; vale olhar na API). Métricas → “Features ligadas: 1 library”, enquanto Recursos em
  teste diz que grupos e estante estão ligados para todas as contas (a métrica conta só as
  liberações individuais). Páginas de detalhe têm dois botões “Voltar” (o do painel e o do detalhe).

Testes novos ou ajustados em `SubscriptionPage`, `BillingBlocked`, `OverviewSection`, `auditFormat`,
`AccountDetail` e `BillingSection`. Resultado: suíte com 426 testes passando, `tsc` sem erros, `eslint`
sem erros (só os 4 avisos que já existiam) e `vite build` ok.

## Observações

- **Texto em Contas:** “último login nunca entrou” (`AccountsSection.tsx:51`) soa estranho; melhor
  “nunca entrou”.
- **Histórico do chat do `qa-admin`:** uma pergunta antiga (“Quem é você de verdade, Isaura?”) tem
  como resposta a frase pronta de reengajamento. Não reproduziu: a pergunta nova recebeu resposta da IA.
- **Admin → Site (Sentry, 7 dias):** API de QA com `AsyncRequestTimeoutException` 10× e LCP p75 de
  4,4 s (“ruim”). Vale olhar junto com o BUG-007.
- Os 404 no console vêm da busca dos personagens na Wikipédia (`/page/summary/Isaura_(personagem)`),
  não de falha do app.
- Nenhum dado foi alterado no QA além de uma mensagem no chat da Isaura com `qa-admin`.

## Re-teste no QA (07/11/2026, depois do deploy)

- **Publicado no QA:** story-verse-web#202 (merge `8189eab`) e story-verse-api#118 (merge `454c583`),
  pelos workflows "Deploy QA (VPS)" e "Deploy API QA (VPS)". Bundle novo confirmado (`index-Bq1mpnTw`).
- **Produção ainda não tem as correções:** nenhuma das duas `main` contém os merges. O
  "Deploy API (VPS)" disparado à mão na `develop` sempre publica a `main` (`ref: main`) e por isso
  republicou a versão antiga.

| Defeito | Re-teste | Conta |
|---|---|---|
| BUG-027 | ✅ "Sair" do diálogo com fundo `rgb(232,168,168)` e texto `rgb(43,16,16)` | qa-suporte |
| BUG-032 | ✅ "Sair da conta" no menu ⋯; a tela de bloqueio pede confirmação | qa-suporte, qa-leitor |
| BUG-031 | ✅ marca no topo, "Atualizar cartão", "acesso terminou em 02 de nov." | qa-leitor |
| BUG-028 | ✅ "acesso está suspenso", "Acesso terminou em", "Atualizar cartão" como botão principal, sem "Assinar agora" | qa-leitor |
| BUG-008 / BUG-030 | ✅ "nenhum envio esperando revisão"; backup com estado neutro | qa-admin |
| BUG-033 | ✅ visão geral carrega com uma única chamada a `/admin/overview` | qa-admin |
| BUG-029 | ✅ nenhum código cru nas 50 últimas ações; "Gráfico do financeiro consultado" | qa-admin |
| BUG-034 | ✅ "Conta consultada · equipe (bb8f13f0)" | qa-admin |
| BUG-035 / BUG-036 | ✅ detalhe visível e com foco após "Abrir"; "Fatura: Em aberto" | qa-admin |
| BUG-037 | ✅ Auditoria e Importações com 375/375 px (sem rolagem lateral) | qa-admin |

**Sentry depois do deploy no QA:** nenhum `AsyncRequestTimeoutException` nem "Failed to fetch" (antes
eram 9 e 7 eventos no dia). As issues de ruído do QA foram resolvidas; as de produção ficaram
"resolvida na próxima release" (ou na release seguinte à última vista), para não voltarem como
regressão enquanto a `main` não recebe as correções.

**Pendências achadas no re-teste:**
- O 402 do paywall ("Assinatura necessária.") e os 401 de "Sessão inválida"/"Não autenticado" ainda
  vão ao Sentry como erro (não eram cobertos pela correção). Sugestão: tratar 401/402/403 esperados
  como `expected` no `ApiHttpError`.
- `deploy-api.yml`: um disparo manual na `develop` publica a `main`, mas grava `SENTRY_RELEASE` com o
  SHA da `develop` (`github.sha`). Hoje a produção reporta release `454c583` rodando o código antigo.
  O release deve vir do commit que foi publicado.
