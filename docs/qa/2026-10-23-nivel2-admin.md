# Relatório — Nível 2 (matriz do admin)

- **Data:** 23/10/2026, ~22h20–22h50 (HPBA)
- **Alvo:** https://qa.storyverse.2.29.42.104.sslip.io (`/admin/*`), API `api.qa…`
- **Papéis executados:** `qa-leitor`, `qa-suporte`, `qa-moderador`, `qa-admin` (login pelo cofre)
- **Execução:** navegador automatizado, navegação SPA (`history.pushState` + `popstate`), rede
  interceptada (`fetch` + `XMLHttpRequest`), `window.confirm` registrado por stub
- **Evidências:** `qa-runs/2026-10-23-nivel2/evidencias/` (18 prints)

## Resultado: matriz completa, 6 de 6 cenários passaram

| ID | Cenário | Resultado | Evidência |
|---|---|---|---|
| AD-01 | `qa-leitor` nas 7 URLs | ✅ "Sem permissão", sem requisição administrativa, sem erro | `leitor-01-admin.png` |
| AD-02 | `qa-suporte`: Visão geral + Contas + Fórum; sem papéis/features/auditoria | ✅ seções certas, detalhe só com "Encerrar sessões" (0 checkboxes) | `suporte-01..03` |
| AD-03 | `qa-moderador`: Visão geral + Acervo + Fórum com ações; sem Contas | ✅ acervo com Aprovar/Recusar, recusa executada, `/admin/contas` bloqueada | `moderador-01..05` |
| AD-04 | `qa-admin` concede e retira `moderator` | ✅ concede, retira, estado final igual ao inicial | `admin-09/10` |
| AD-05 | Ação sensível pede confirmação e vai para Auditoria | ✅ mensagens + 3 registros na auditoria | `admin-10-auditoria.png` |
| AD-06 | "Encerrar sessões" derruba as sessões | ✅ 2 → 0, aviso "2 sessões encerradas" | `admin-13-sessoes-encerradas.png` |

## Quem vê o que (medido no QA)

| Papel | Abas no painel | URL proibida | Ações |
|---|---|---|---|
| `qa-leitor` | nenhuma (painel bloqueado) | todas as 7 | — |
| `qa-suporte` | Visão geral, Contas, Fórum | Features, Acervo, Auditoria | busca conta, encerra sessões |
| `qa-moderador` | Visão geral, Acervo, Fórum | Contas, Features, Auditoria | aprova/recusa envio |
| `qa-admin` | as 6 | — | papéis, features, sessões, auditoria |

Nenhuma das 7 URLs proibidas gerou requisição `4xx` nem erro de console: o bloqueio acontece antes de
chamar a API, e a tela mostra "Sem permissão" sem quebrar.

## Seções conferidas com `qa-admin`

| Seção | O que apareceu |
|---|---|
| Visão geral | 2 envios em análise, 0 denúncias, 5 contas, 1 feature (`library`), backup com "—" |
| Contas | busca por e-mail completo ou parte do nome; detalhe com nome, e-mail, UUID, criada, último login, sessões ativas, papéis, features e últimas ações |
| Features | `library` com 1 conta |
| Acervo | envios em análise com Ler / Recusar / Aprovar e "Trocar capa"; checagem na Open Library resolve em ~5 s |
| Fórum | fila vazia ("Nada nesta fila") — o fórum está desligado neste build |
| Auditoria | filtro por tipo, ator, alvo e período; registros com ator, alvo e detalhe |

## Detalhes observados

1. **Sem vazamento no bloqueio:** nas URLs proibidas o app mostra "Sem permissão" **sem chamar**
   nenhum endpoint `/admin/*` — nenhuma resposta 4xx, nenhum erro de console, nenhum dado na tela.
2. **Nav da home muda com o papel:** contas de equipe ganham a entrada "Admin" no topo; leitor não.
3. **AD-05 confirmado nas duas pontas.** Mensagens nativas capturadas:
   - `Tirar o papel Moderador de Suporte de QA?`
   - `Encerrar todas as sessões de Suporte de QA? A pessoa precisará entrar de novo em todos os aparelhos.`
   - `Tirar "Envio de teste B" do acervo? O arquivo também será apagado.` (fluxo de publicados)

   A Auditoria registrou `Papel concedido`, `Papel retirado` e `Conta consultada`, com
   `Admin de QA · alvo 2107494f-…` e `role: moderator`.
4. **Recusa de envio tem validação real:** sem motivo aparece "Escreva o motivo da recusa: quem enviou
   vai ver."; com motivo, o contador caiu de 2 para 1 e o envio saiu da fila.
5. **Acervo usa formulário em dois passos:** "Recusar" abre o campo de motivo e o botão vira "Recusar
   envio" — o primeiro clique não executa nada (é o esperado, não é falha).

## Estado do QA depois da rodada

- `qa-suporte` teve as **2 sessões encerradas** de propósito (teste do AD-06) e voltou a ter só o papel
  Suporte.
- **`Envio de teste B` foi recusado** durante o AD-03, com motivo escrito. Sobrou apenas o
  `Envio de teste A` na fila. Para restaurar: `bash seed-qa.sh` (ou recriar o envio pelo site).
- Nenhum outro dado alterado.

## Observações (não bloqueiam)

- **NB-01 · Baixo · visual** — nos dois cartões de "Sem permissão" o título e a explicação saem
  colados ("Sem permissãoEsta conta não tem acesso…"). O markup é
  `<div><strong>Sem permissão</strong><span>Esta conta…</span></div>` (`AdminRoute.tsx:142-143`) e
  `.profile-card` (`App.css:4481`) não define layout para esse `div`, então `strong` e `span` ficam
  inline. Correção: `display:block` no `span` (ou `display:grid; gap:.2rem` no `div`).
- **NB-02 · Baixo · UX** — a busca de contas só acha por **e-mail completo** ou **parte do nome**.
  Digitar `qa-leitor` (sem o domínio) devolve "Nenhuma conta encontrada", o que parece conta
  inexistente. O placeholder diz a regra, mas vale uma dica curta ou busca parcial no e-mail.
- **NB-03 · Baixo · técnica** — as confirmações usam `window.confirm` nativo (`AccountDetail.tsx:84`,
  `:101`, `:124`). Funciona no navegador, mas não é estilizável, não sai em print e é suprimido em
  PWA no iOS — onde o botão pareceria morto.
- **NB-04 · observação** — Visão geral levou ~5–9 s para sair de "Carregando…" no QA (container com
  0,5 CPU). Sem erro, mas se o painel for usado no dia a dia vale um esqueleto de carregamento.
- **NB-05 · observação** — o cartão de backup na Visão geral mostra "Backup atrasado" com valores
  "—" no QA. Se não há backup configurado no QA, o rótulo vermelho confunde mais do que informa.
- **NB-06 · observação** — o Fórum está desligado neste build: a fila de moderação fica sempre vazia,
  então "resolver uma denúncia" não é testável no QA hoje.

## Não coberto

- Resolver denúncia (não há denúncia nem tópico; fórum desligado).
- Aprovar envio até publicar (não executado para não colocar texto de teste no acervo público do QA).
- `Trocar capa` (upload de arquivo) e `/admin/contas/:id` com UUID inválido.
