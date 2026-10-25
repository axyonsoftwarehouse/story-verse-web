# Storyverse — resumo da rodada de QA e notas para o release

**Para:** professor (revisão dos cartões e release)
**Data:** 25/10/2026 · **Ambiente testado:** `https://qa.storyverse.2.29.42.104.sslip.io`
**Quadro:** Trello “Desenvolvimento - Axyon Software” → coluna **READY TO DONE** (21 cartões com comentário e print)

---

## 1. Onde estamos

| | Produção (`main`) | `develop` (testado no QA) |
|---|---|---|
| Site | `db7e7a3` | **+133 commits** |
| API | `fd26c3c` (migração **V15**) | **+79 commits** (migração **V21**) |

Nesta rodada foram **27 PRs**: 10 na API (`#50`–`#59`) e 17 no site (`#87`–`#103`), todos com CI verde.

## 2. O que foi testado no QA

| Área | Cenários | Resultado |
|---|---|---|
| Acervo / catálogo | AD-07 a AD-12 (cadastro, publicar, coleções e ordem curada, importação em lote) | **Aprovado** após 2 correções |
| Fórum | F-01, F-02 (tópico, resposta, denúncia) + spoiler no tópico e **na resposta**, aceitar resposta, papéis | **Aprovado** após 2 correções |
| Assinatura (Stripe) | BILL-01 a BILL-06: plano, checkout, trial, paywall, webhook, estado, financeiro, **portal** e **cobrança real de R$ 9,90** | **Aprovado** após 5 correções |
| PWA | P-01 (manifest, ícones, service worker, instalabilidade) | Requisitos **ok**; instalar é passo humano |
| Sobras do plano | E-03, P-03, I-02, I-03, A-03 (gate da estante, mobile 390 px, PDF, EPUB corrompido, duas abas) | **Aprovado** |
| Conta | A-05 exportação de dados | **Aprovado**; exclusão **não executada** (pede a senha atual e apagaria conta da matriz) |

## 3. Defeitos

**24 registrados · 22 corrigidos · 2 em observação** (BUG-007 visão geral lenta no QA com 0,5 CPU; BUG-008 cartão de backup sem backup configurado).

Os de maior impacto, todos com PR e re-teste:

| # | Sev. | O que era | PR |
|---|---|---|---|
| BUG-016 | Alto | “Importar agora” respondia 500 — RLS sem transação no lote | API #50 |
| BUG-017 | Médio | Ordem definida na coleção era ignorada na biblioteca | API #51 |
| BUG-019 | Alto | `/admin/financeiro` dava 500 (auditoria dentro de transação `readOnly`) | API #52 |
| BUG-021 | Alto | Paywall devolvia 401/402 **sem CORS** → tela dizia “sem conexão” | API #54 |
| BUG-022 | Alto | **Toda** entrega de webhook dava 500 (`:error` nulo sem tipo) | API #55 |
| BUG-023 | Médio | Evento de webhook gravado mas nunca marcado como processado | API #56 |
| BUG-024 | Alto | Quem **tinha** plano levava 402 (checagem fora de transação → RLS cego) | API #57 |
| BUG-025 | Alto | Paywall liberava acesso quando **faltava data** na assinatura (fail-open) | API #59 |

Além desses: 4 defeitos baixos do lote anterior (capa do cartão, e-mail parcial, `window.confirm`, título/texto colados), BUG-018 (aviso de resposta em moderação), BUG-009 (fórum ligado no QA) e a confirmação no “Publicar” do acervo.

## 4. Travas de qualidade

- **API:** 219 testes na suíte + integração com PostgreSQL no CI (RLS, webhook, financeiro) — verde em todos os PRs.
- **Site:** 256 testes, `tsc` limpo, build ok.
- Todo cartão em READY TO DONE tem **comentário escrito + print**; nada foi para DONE — a decisão é sua.

## 5. Para o release (o que muda no servidor)

**Migrações:** produção está na **V15**; entram nove, **todas aditivas** (conferido arquivo por arquivo: nenhum `drop table`, `drop column`, `truncate` ou `delete`):

```
V16 admin_roles · V17 catalog · V17_1 library_catalog_source ·
V17_2 billing · V17_3 billing_amount · V18 admin_phase2_accounts ·
V19 admin_phase2_metrics · V20 catalog_imports_select · V21 forum_reply_spoiler
```

**Ordem sugerida:** API primeiro (aplica as migrações e passa a expor `/api/v1/catalog`, `/forum`, `/billing`), depois o site. O site antigo continua funcionando com a API nova; o contrário não (o site novo chama rotas que a API de produção ainda não tem).

**Flags — deixar desligadas no primeiro deploy:**

| Onde | Variável | Por quê |
|---|---|---|
| API | `BILLING_ENABLED` (ausente = `false`) | sem as chaves do Stripe o checkout responde 503; com a flag ligada o paywall passa a exigir assinatura |
| Build do site | `VITE_BILLING_ENABLED` | sem a flag a página de assinatura não aparece |
| Build do site | `VITE_FORUM_ENABLED` | o fórum é funcionalidade nova; anunciar/ligar é decisão sua |

**Smoke test pós-deploy (5 minutos):**

1. `GET /api/v1/health/ready` → 200;
2. home e `/biblioteca` carregam e listam o catálogo;
3. login, abrir um livro, virar página (leitura + progresso);
4. `/admin` abre para staff (contas, acervo, métricas, auditoria);
5. se ligar o fórum: criar tópico e responder;
6. se ligar o billing: `/assinar` mostra o plano e o checkout abre o Stripe.

**Rollback:** as migrações são aditivas, então voltar a imagem anterior (tag antiga no GHCR) funciona **sem** desfazer o schema. Só não conte com rollback automático de dados.

## 6. Pendências conhecidas (não bloqueiam o release)

- **Não exercitado:** cartão recusado/3DS, reembolso e disputa (`charge.refunded`/`charge.dispute.created`), cancelamento pelo portal, exclusão de conta (A-05) e a instalação do PWA (passo humano).
- **Segurança:** a chave restrita de teste do Stripe apareceu por extenso num log do agente — precisa ser **rotacionada** antes de virar produção (é `rk_test_`, não afeta dinheiro real).
- **Observação:** os eventos sintéticos usados como prova ficam em `billing_events` com prefixo `evt_qa_*`.

## 7. Onde ver tudo

- `docs/qa/RESULTADOS.md` — painel único: rodadas, defeitos e próximos cenários.
- `docs/qa/2026-10-25-*.md` — relatórios por rodada (acervo, catálogo, fórum, billing, spoiler).
- `docs/ops/stripe-qa.md` — como configurar o Stripe de teste (passo a passo).
- Trello → **READY TO DONE** — 21 cartões, cada um com o comentário de justificativa e o print.
