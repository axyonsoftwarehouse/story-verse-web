# Plano de testes do QA

Como o Storyverse é testado no ambiente de QA antes de chegar na `main`. Complementa
[`QA.md`](QA.md) (como o ambiente funciona) e o fluxo `develop → QA → main`.

- **Alvo:** https://qa.storyverse.2.29.42.104.sslip.io (API: `api.qa…`)
- **Quem executa:** Hermes (navegador automatizado) + você nas decisões de aceite
- **O que publicado é testado:** o que estiver no QA na hora — normalmente a `develop`

## 1. Objetivo

Responder, para cada mudança que chega no QA, três perguntas:

1. O fluxo principal funciona de ponta a ponta (não só a tela abriu)?
2. Quem **não** deveria ter acesso continua sem acesso?
3. Apareceu erro silencioso (console, 4xx/5xx, tela travada) que o usuário não veria explicado?

O resultado é um relatório com evidências e uma decisão: **pode ir para a `main`** ou **volta com
defeitos listados**.

## 2. Escopo

| # | Área | Superfície |
|---|---|---|
| 1 | Leitura | landing, busca no acervo (Gutenberg + OpenLibrary), abrir livro, leitor (capítulos, tipografia, progresso, heartbeat) |
| 2 | Chat com personagens | personagens do livro, conversa, memória do que já foi lido, sem spoiler, cota de IA |
| 3 | Conta | cadastro, login, logout, sessão (F5, segunda aba), `/redefinir-senha`, `/confirmar-email`, exportar/excluir dados |
| 4 | Estante / biblioteca (feature `library`) | filtros, ordenação, status (lendo/terminado/abandonado), avaliação, terminar/abandonar |
| 5 | Gamificação | sequência (streak), meta diária, escudos, rodada de diamantes, ranking semanal, frase do dia |
| 6 | Importação | EPUB, PDF, TXT, arquivo inválido, arquivo grande, livro importado aparecendo na estante |
| 7 | Comunidade / fórum | `/comunidade`, `/comunidade/t/:id`, denúncia, envio para o acervo |
| 8 | Admin | 6 seções × 4 papéis (matriz do `QA.md`), catálogo (criar/publicar/ocultar), ações destrutivas com confirmação, URL proibida |
| 9 | Plataforma | PWA instalável, recarregar offline, viewport de celular, teclado/foco |

## 3. Fora de escopo (e por quê)

| Item | Motivo | Onde fica coberto |
|---|---|---|
| E-mail real (confirmação, esqueci a senha) | QA não tem SMTP | testes unitários + uma checagem manual antes de release |
| Cobrança / assinatura | QA não tem gateway | ambiente de develop com Stripe em modo teste, quando existir |
| Cota e custo de IA de produção | QA usa chave Gemini própria | conferir só que o teto do QA corta como esperado |
| Carga e performance sob volume | VPS de 512 MB dividida com produção e Foodie | medir apenas tempo de carga frio do site e da home |
| Safari / iOS real | automação roda em Chromium | checklist manual de 5 min em aparelho, quando a mudança for de front |

## 4. Dados e contas

Contas de teste por papel (senha no cofre do navegador / `QA_TEST_PASSWORD`):

`qa-leitor`, `qa-sem-estante`, `qa-admin`, `qa-moderador`, `qa-suporte`.

Regras de dados:

- **Nunca** usar dado real. Tudo que é criado no QA é descartável.
- Testes que **apagam ou mexem em muita coisa** (reset, exclusão de conta, troca de papéis, feature
  ligada/desligada) vão para o **fim** da rodada, depois de `seed-qa.sh` conferir as contas.
- Ação de papel (conceder/remover `moderator`/`support`) sempre volta ao estado original antes de
  encerrar.
- **Cota de IA:** 20 mensagens por conta/dia e 100/dia no QA. O chat é testado com **1–2 mensagens
  por cenário**, não com conversa longa; quando a cota estourar, o comportamento esperado é aviso
  claro — e isso também é um caso de teste.

## 5. Níveis de teste

### Nível 0 — antes de abrir o navegador (2 min)

```bash
npm run lint && npm run test && npm run build     # 42 arquivos de teste
curl -s https://api.qa.storyverse.2.29.42.104.sslip.io/api/v1/health   # {"status":"ok"}
```

Se o técnico falhar, o teste funcional nem começa: o defeito é de build, não de tela.

### Nível 1 — smoke (15 min, toda publicação)

Caminho feliz de cada área P0, uma conta só (`qa-leitor`): login → busca → abrir livro → leitor →
chat (1 mensagem) → estante → ranking → logout. Serve para dizer "o QA está de pé", não para
aprovar release.

### Nível 2 — funcional por fluxo (rodada de release)

Todos os cenários P0/P1 da seção 6, com as contas certas, incluindo negativos e matriz de papéis.

### Nível 3 — exploração dirigida

Depois dos roteiros: tentar quebrar o que acabou de ser mexido (duplo clique, voltar no meio do
fluxo, aba duplicada, texto enorme, arquivo errado, rede lenta/offline).

## 6. Cenários por prioridade

**P0** = quebra o produto · **P1** = atrapalha mas tem contorno · **P2** = polimento.

| ID | Cenário | Conta | Prio |
|---|---|---|---|
| L-01 | Landing carrega, faixa "Ambiente de QA" visível, sem erro de console | anônimo | P0 |
| L-02 | Busca por autor ("Verne") traz resultados do acervo e fallback fora do acervo | qa-leitor | P0 |
| L-03 | Abrir livro, navegar capítulos, próximo/anterior, tipografia A−/A+ | qa-leitor | P0 |
| L-04 | Progresso salvo: sair, voltar, "Continuar lendo" retoma no ponto | qa-leitor | P0 |
| L-05 | Busca sem resultado / termo com acento / termo absurdo | qa-leitor | P1 |
| C-01 | Chat abre com personagens do livro (não genérico) | qa-leitor | P0 |
| C-02 | Uma mensagem recebe resposta no personagem, em português | qa-leitor | P0 |
| C-03 | Personagem não entrega o que está à frente do ponto de leitura | qa-leitor | P1 |
| C-04 | Erro de IA (forçar 503/429) mostra aviso — não fica "digitando" para sempre | qa-leitor | P1 |
| A-01 | Cadastro novo entra direto (sem e-mail) e já lê | conta nova | P0 |
| A-02 | Login, logout e login de novo | qa-leitor | P0 |
| A-03 | F5 mantém a sessão; segunda aba não derruba a primeira | qa-leitor | P0 |
| A-04 | `/redefinir-senha` com token inválido mostra erro claro | anônimo | P1 |
| A-05 | Exportar dados baixa o arquivo; excluir conta pede confirmação | conta nova | P1 |
| E-01 | Estante lista o que está lendo, filtros e ordenação funcionam | qa-leitor | P0 |
| E-02 | Terminar livro / abandonar move o cartão e pede avaliação | qa-leitor | P1 |
| E-03 | Sem a feature `library`, nada da estante aparece para `qa-sem-estante` | qa-sem-estante | P0 |
| G-01 | Sequência do dia, meta diária e escudos refletem o que foi lido | qa-leitor | P1 |
| G-02 | Rodada de diamantes: uma vez por dia, valor creditado | qa-leitor | P1 |
| G-03 | Ranking semanal mostra a conta na posição coerente | qa-leitor | P2 |
| I-01 | Importar EPUB pequeno e abrir no leitor | conta nova | P0 |
| I-02 | PDF e TXT importam | conta nova | P1 |
| I-03 | Arquivo corrompido/grande demais mostra erro sem travar a tela | conta nova | P1 |
| F-01 | `/comunidade` abre com o fórum ligado; tópico abre e responde | qa-leitor | P1 |
| F-02 | Denúncia de tópico chega na moderação | qa-leitor | P1 |
| AD-01 | `qa-leitor` em `/admin` vê "Sem permissão" (sem quebrar) | qa-leitor | P0 |
| AD-02 | `qa-suporte`: só Visão geral, Contas, Fórum — e Fórum sem botões de ação | qa-suporte | P0 |
| AD-03 | `qa-moderador`: Visão geral, Acervo, Fórum com ações; `/admin/contas` proibida | qa-moderador | P0 |
| AD-04 | `qa-admin`: todas as seções; conceder e remover `support` de uma conta volta ao estado | qa-admin | P0 |
| AD-05 | Ação sensível pede confirmação e registra em Auditoria | qa-admin | P1 |
| AD-06 | Encerrar sessões de uma conta derruba o login dela de fato | qa-admin | P1 |
| AD-07 | Catálogo: criar livro (TXT/EPUB), salvar rascunho, abrir a prévia e publicar | qa-moderador | P0 |
| AD-08 | Catálogo: ocultar/arquivar livro e conferir que ele sai da biblioteca | qa-moderador | P1 |
| AD-09 | Catálogo: só `qa-admin` vê "Apagar"; apagar remove o livro e o arquivo | qa-admin | P1 |
| AD-10 | Catálogo: livro repetido avisa e só cria com "Criar mesmo assim" | qa-moderador | P1 |
| P-01 | Instalar como app (PWA) e abrir instalado | qa-leitor | P2 |
| P-02 | Recarregar offline mostra aviso, não tela branca | qa-leitor | P1 |
| P-03 | Viewport de celular (390×844) sem rolagem horizontal em home, leitor e admin | qa-leitor | P1 |

## 7. Matriz de papéis do admin

Executada a cada mudança em `/admin/*`. Para cada papel: **ver** as seções da tabela do
[`QA.md`](QA.md), **agir** onde é permitido, e **receber "Sem permissão"** (sem tela branca nem erro
no console) nas URLs proibidas:

`/admin` · `/admin/contas` · `/admin/contas/:id` · `/admin/features` · `/admin/acervo` ·
`/admin/acervo/envios` · `/admin/moderacao/forum` · `/admin/auditoria`

O endereço antigo `/admin/moderacao/acervo` redireciona para `/admin/acervo/envios`; ele também
precisa bloquear quem não pode ver o acervo.

Também: a URL proibida **não pode** vazar dado pela API — conferir que a chamada por trás dela
responde 403/401, não 200 com conteúdo.

## 8. Como os testes são executados

1. **Navegador automatizado** (Chromium) com interceptação de `fetch` e `XMLHttpRequest`: toda tela
   testada registra requisições, status e erros de console.
2. **Print de cada defeito**, salvo antes de qualquer outra navegação (o arquivo temporário é
   sobrescrito).
3. **Login sempre pelo cofre de senhas** — senha nunca é digitada por mim nem aparece no chat.
4. **Uma conta por vez**, limpando o estado entre papéis, para não misturar permissões.
5. **Nada é "achismo":** defeito só entra no relatório com URL, passos, esperado × obtido, print e
   (quando houver) status HTTP/erro de console.

## 9. Relatório e severidade

Arquivo `docs/qa/AAAA-MM-DD-relatorio.md` (ou `qa-output/`, se não for versionar), com resumo,
tabela de defeitos e evidências inline (`MEDIA:` nos prints).

| Severidade | Critério |
|---|---|
| **Crítico** | perda de dado, vazamento entre contas, fluxo de compra/leitura impossível, admin acessível a quem não deve |
| **Alto** | funcionalidade principal quebrada, erro silencioso que trava a tela, ação que não persiste |
| **Médio** | erro visível mas com contorno, inconsistência de estado, mensagem enganosa |
| **Baixo** | texto, alinhamento, caso raro, melhoria de UX |

Cada defeito ganha um cartão no Trello `Desenvolvimento - Axyon Software` com print e passos (o
cartão só vai para DONE com comentário de justificativa + print + link do PR, como no seu fluxo).

## 10. Critério de saída (gate para `main`)

Uma rodada é **aprovada** quando:

- [ ] Nível 0 verde (lint, testes, build, health da API)
- [ ] Todos os P0 executados e passando
- [ ] Cadastro de livro no admin de ponta a ponta (AD-07) aprovado
- [ ] Nenhum defeito **Crítico** nem **Alto** aberto
- [ ] Matriz de papéis do admin sem falha de permissão
- [ ] Zero erro de console nas telas testadas (ou todos explicados/aceitos)
- [ ] Nenhuma requisição 5xx inesperada no período

Defeito Médio/Baixo não bloqueia release, mas entra na lista de dívida com prazo.

## 11. Rotina sugerida

| Quando | O quê | Tempo |
|---|---|---|
| Push na `develop` | Nível 1 (smoke) | ~15 min |
| Antes de PR `develop → main` | Níveis 1 + 2 completos | ~1 sessão de 20 min por bloco |
| Depois de corrigir defeito | Re-teste do caso + 1 smoke | ~10 min |
| Área nova (ex.: admin, Stripe) | Nível 3 exploratório no que é novo | ~20 min |

Para caber no seu ritmo, a rodada é dividida em blocos de 15–20 min com placar cumulativo de
cenários concluídos (não zera entre sessões).

## 12. Riscos do próprio plano

- **Cota de IA** acaba no meio da rodada → chat fica para o começo, com poucas mensagens.
- **Estado sujo** de testes anteriores (papéis alterados, features desligadas) → `seed-qa.sh` antes
  de cada rodada; `reset-qa.sh` se o banco estiver inconsistente.
- **QA fora do ar** (deploy em andamento) → checar health antes; se cair no meio, a rodada é
  retomada do último bloco.
- **Automação ≠ usuário real**: componentes React às vezes respondem a clique por coordenada e não
  a clique por JS. Quando um botão "não faz nada", testar os dois antes de abrir defeito.
