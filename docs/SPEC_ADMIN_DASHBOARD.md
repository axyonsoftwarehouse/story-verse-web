# Dashboard do admin — o que já existe e o que falta no backend

Data: 2026-10-26. Frontend: `src/features/admin/OverviewSection.tsx` (dashboard) e
`src/features/admin/MetricsSection.tsx`. Backend: `story-verse-api`.

Regra geral: **o frontend nunca inventa número**. Bloco sem dado na API aparece como
"aguardando endpoint" com o nome do endpoint abaixo. Nenhum token (Sentry, Umami) vai para o
frontend: variável `VITE_*` é pública no bundle. A API busca os dados no servidor e o painel só
chama `/api/v1/admin/**`.

## 1. O que o dashboard já mostra com dados reais

| Bloco | Fonte |
|---|---|
| Precisa de ação: envios pendentes, denúncias abertas, backup atrasado | `GET /api/v1/admin/overview` |
| Precisa de ação: assinaturas inadimplentes / falha de cobrança | `GET /api/v1/admin/billing/summary` |
| Hoje: leitores ativos, minutos, livros iniciados/terminados (+ comparação com ontem) | `GET /api/v1/admin/metrics/reading?group=day` (últimos 60 dias, somados no cliente) |
| 7 e 30 dias: leitores ativos (+ período anterior) | `GET /api/v1/admin/metrics/overview?from&to` (duas chamadas: período e anterior) |
| 7 e 30 dias: minutos, livros iniciados/terminados (+ período anterior) | série diária acima |
| Novos usuários em 7 e 30 dias | `metrics/overview` → `accounts.new7` / `accounts.new30` |
| Taxa de conclusão (terminados ÷ iniciados), minutos por leitor | derivados dos números acima |
| Retenção D7 da coorte mais recente completa | `metrics/overview` → `retention[]` |
| Tendência de 30 dias (leitores / minutos / páginas / livros terminados) | série diária |
| Páginas lidas (+ período anterior), 1 página = 250 palavras | `metrics/overview` → `reading.pages` (item 2.2) |
| Ranking da semana (top 10, respeita quem se escondeu) | RPC `weekly_ranking` (`POST /api/v1/rpc/weekly_ranking`) |
| Assinaturas: MRR, ativas, em teste, novas × canceladas (30 dias) | `GET /api/v1/admin/billing/summary` |

Observação: "Hoje" é o dia do calendário em America/Sao_Paulo (as funções `admin_metrics_*`
trabalham com `date`). "Últimas 24 horas" de verdade exige o item 2.1.

## 2. Endpoints e campos que faltam na API

> **Situação em 2026-10-27:** 2.1, 2.4 e 3 já existem na API (axyonsoftwarehouse/story-verse-api#62
> e #63, publicados no QA) e o dashboard já usa esses dados. O contrato exato está na descrição do
> #62. O Umami (4) está no ar na VPS, a API lê o tráfego (story-verse-api#64) e o site carrega o
> tracker por `/u/script.js` (nome padrão do Umami; `TRACKER_SCRIPT_NAME` não foi definido) com a
> coleta em `/u/api/send`. As telas `/admin/*` não contam como tráfego. Também estão na API e no
> dashboard: 2.2 páginas lidas (story-verse-api#69, V26), 2.3 usuários ativos (#70, V27), 2.5 livros
> mais lidos (#67, V28), 2.6 comunidade (#66, V29) e os Web Vitals pelo Umami (#68). Nada pendente.

Todos superadmin, com o mesmo cache curto de 5 minutos do `AdminMetricsService`, mesmo limite de
90 dias e fuso America/Sao_Paulo.

### 2.1 Cadastros por dia (e janela de 24h) — feito
- **Novo campo** em `AdminMetrics.Accounts`: `new24h` (`created_at >= now() - interval '24 hours'`)
  e `newToday`.
- **Novo campo** em `AdminMetricsReadingPoint` (série diária/semanal): `signups` (contas criadas no
  bucket). Alternativa: `GET /api/v1/admin/metrics/signups?from&to&group=day|week` →
  `[{ bucket, signups, confirmed }]`.
- Com isso o dashboard ganha comparação de novos usuários com o período anterior e a barra de
  cadastros na tendência.

### 2.2 Páginas lidas — feito (story-verse-api#69, migração V26)
**Regra: 1 página = 250 palavras lidas.** Vale para qualquer modo de leitura e não muda com o
tamanho da tela ou da fonte. No leitor (`src/lib/readingPages.ts`):
- o app olha o que está na tela quando a rolagem fica parada por 1 s e a cada 15 s de leitura
  ativa (aba visível, interação nos últimos 2 min). Passar correndo pelo texto não conta;
- conta o parágrafo que está pelo menos pela metade na tela, ou que ocupa metade da tela.
  Ilustrações não contam;
- cada parágrafo (livro + capítulo + número do parágrafo) conta uma vez por dia. Voltar ou reler no
  mesmo dia não soma;
- palavra = sequência de letras ou números separada por espaço;
- páginas do dia = palavras do dia ÷ 250, arredondado para baixo. A conta fica no aparelho, por
  conta de usuário.

O app envia `{ "2026-10-27": { "seconds": 900, "pages": 12 } }` em `report_reading`, e o formato
antigo (`{ dia: segundos }`) continua aceito. No banco (`public.reading_days.pages`):
- `check (pages between 0 and 1000)`. Valor fora disso ou não inteiro é erro, e o app nunca manda
  mais que 1000;
- no máximo 1 página a cada 6 segundos de leitura contados pelo servidor (`reading_heartbeat`):
  dia sem tempo contado não ganha página;
- só valem os últimos 8 dias, e vale o maior valor enviado no dia. Dois aparelhos no mesmo dia não
  somam: fica o maior.

Na API, o campo `pages` está em `AdminMetrics.Reading` (`metrics/overview`) e em
`AdminMetricsReadingPoint` (`metrics/reading`, por dia e por semana). No dashboard, o KPI
"Páginas lidas" compara com o período anterior, e a tendência de 30 dias tem a opção "Páginas".

### 2.3 Usuários ativos (DAU / WAU / MAU) — feito
"Leitor ativo" só conta quem leu. Para atividade geral:
- Tabela `public.activity_days(user_id, day)` (migração V27, RLS com policy do runtime). A API grava
  no primeiro request autenticado (Bearer de acesso) do dia em America/Sao_Paulo: um conjunto em
  memória por dia evita gravar a cada request, e o upsert roda numa fila de uma thread, fora do
  request. O refresh de token não conta. Os dados começam no deploy da V27: antes disso a série vem
  zerada.
- `GET /api/v1/admin/metrics/active?from&to` → `{ dau, wau, mau, series: [{ day, active }] }`.
  DAU = pessoas no dia `to`; WAU = nos 7 dias até `to`; MAU = nos 30 dias até `to` (janelas que não
  dependem de `from`). `series` traz todos os dias do período, com 0 nos dias sem atividade.
- No dashboard, o card "Usuários ativos" pede sempre os 30 dias até hoje (não segue o seletor de
  período, porque as três janelas já são fixas).

### 2.4 Assinaturas e receita no tempo — feito (sem `paidFromFree`: o grátis não passa pelo Stripe)
`billing/summary` é só uma foto. Faltam:
- `GET /api/v1/admin/billing/series?from&to&group=day|week` →
  `[{ bucket, mrrCents, active, newCount, canceledCount, revenueCents }]`. `mrrCents` precisa de
  snapshot diário (job que grava `billing_daily_snapshots`) ou reconstrução pelos eventos do Stripe
  já guardados pelo webhook. `revenueCents` = faturas pagas no bucket (`invoice.paid`).
- Conversão grátis → pago: `{ trialsStarted, trialsConverted, paidFromFree }` no período, no próprio
  `billing/summary`.

### 2.5 Livros mais lidos — feito (sem minutos por livro)
- `GET /api/v1/admin/metrics/top-books?from&to&limit=10` (limite de 1 a 20) →
  `[{ bookKey, title, author, readers, finished }]`, ordenado por `readers` e depois `finished`.
- Sai só de `public.library_entries` (função `admin_metrics_top_books`, migração V28 da API).
  `reading_days` não guarda o livro, então **não há `minutes` por livro**, e não vamos criar
  tabela para isso.
- `readers`: contas com o livro em `reading` ou `finished` e atividade no período — começou
  (`started_on`) ou terminou (`finished_on`) no período, ou, se ainda está lendo, a entrada mudou
  (`updated_at`, que o progresso atualiza) no período. `updated_at` não conta para `finished`:
  editar a nota de um livro lido há meses não é leitura.
- `finished`: contas com `finished_on` no período.
- Só livros do acervo (`gb:`, `cm:` e `cat:`). Nunca `local:`, nem resenha ou notas. Título e
  autor vêm de `catalog_books` quando o livro está lá; senão, do snapshot mais comum na estante.

### 2.6 Atividade da comunidade — feito
- `GET /api/v1/admin/metrics/community?from&to&group=day|week` →
  `[{ bucket, topics, replies, reports }]` (axyonsoftwarehouse/story-verse-api#66, migração V29).
- Conta `forum_topics`, `forum_replies` e `forum_reports` pelo `created_at` no calendário de São
  Paulo; a semana começa na segunda. Os buckets vazios já vêm com zero da API.
- O que a moderação escondeu ou apagou depois **continua contando como criado**: a métrica mede o
  que a comunidade escreveu e denunciou. Denúncias contam em qualquer status. O fórum só faz exclusão
  lógica; uma linha some apenas quando a conta do autor é apagada.
- Painel: card "Comunidade" na visão geral, com os totais do período comparados ao período anterior
  e as barras dos últimos 30 dias. O card só aparece quando o fórum está visível
  (`FORUM_VISIBLE` em `src/lib/features.ts`), portanto fica escondido em produção.

## 3. Saúde do sistema via Sentry — feito (Web Vitals pelo Umami — feito)

O app (`@sentry/react`, `src/lib/telemetry.ts`) e a API Java já enviam ao Sentry. O painel lê os
números por um endpoint da API que chama a API REST do Sentry no servidor.

**Variáveis no `.env` da API (VPS)** — nunca no frontend:
- `SENTRY_API_URL` (padrão `https://sentry.io`; conta na região US/DE usa `https://us.sentry.io` /
  `https://de.sentry.io`)
- `SENTRY_API_TOKEN` — token de organização ("Internal Integration") só com `org:read`,
  `project:read`, `event:read`
- `SENTRY_ORG` e `SENTRY_PROJECTS` (ex.: `storyverse-web,storyverse-api`)

**Endpoint novo:** `GET /api/v1/admin/health?period=24h|7d|14d` (superadmin, cache 5 min, timeout
curto; se o Sentry cair, devolve `{ sentry: null, error: "..." }` sem derrubar o painel):

```json
{
  "sentry": {
    "projects": [
      {
        "slug": "storyverse-web",
        "errorsSeries": [{ "day": "2026-10-25", "accepted": 12, "filtered": 0 }],
        "errorsTotal": 40,
        "crashFreeSessions": 0.993,
        "sessionsSeries": [{ "day": "2026-10-25", "sessions": 820 }],
        "topIssues": [
          { "id": "123", "title": "TypeError: ...", "count": 31, "users": 9,
            "lastSeen": "2026-10-26T10:00:00Z", "permalink": "https://..." }
        ]
      }
    ]
  },
  "backup": { "status": "success", "finishedAt": "...", "stale": false }
}
```

**Chamadas ao Sentry** (API REST `/api/0/`):
- Erros por dia: `GET /organizations/{org}/stats_v2/?field=sum(quantity)&category=error&groupBy=outcome&groupBy=project&statsPeriod=14d&interval=1d`
- Sessões e crash-free: `GET /organizations/{org}/sessions/?field=sum(session)&field=crash_free_rate(session)&statsPeriod=14d&interval=1d&project={id}`
- Top problemas: `GET /organizations/{org}/issues/?project={id}&query=is:unresolved&statsPeriod=24h&sort=freq&limit=5`
  — devolver só título, contagem, usuários, `lastSeen` e `permalink` (sem stack, sem dados de
  usuário).

**Web Vitals (LCP, INP, CLS) — pelo Umami, não pelo Sentry** (decisão de produto: não ligar
transações no Sentry só para isso; `VITE_SENTRY_TRACES_SAMPLE_RATE` continua 0).
- **Tracker:** `installAnalytics` (`src/lib/analytics.ts`) liga `data-performance="true"`. O
  tracker do Umami 3.4.1 passa a mandar, ao esconder/sair da página (ou após 10 s), um envio do
  tipo `"performance"` com `lcp`, `inp`, `cls`, `fcp` e `ttfb` (ms; CLS sem unidade). O
  `umamiBeforeSend` descarta `/admin` também nesses envios.
- **Umami:** grava em colunas de `website_event` (`event_type = 5`) e expõe
  `GET /api/websites/{websiteId}/performance/stats?startAt&endAt` →
  `{ lcp: {p50, p75, p95}, inp: {…}, cls: {…}, fcp: {…}, ttfb: {…}, count }`. Métrica sem medida
  vem como `0` (o Umami faz `Number(x || 0)`). Também há `/performance/chart` (série) e
  `/performance/metrics?type=path&metric=lcp` (por página), ainda não usados.
- **Endpoint novo:** `GET /api/v1/admin/vitals?from&to` (superadmin, até 90 dias em datas de São
  Paulo, cache 5 min; falha → 200 com `vitals: null` e `error`), com o mesmo `UmamiApiClient` do
  tráfego:

```json
{ "from": "2026-10-21", "to": "2026-10-27",
  "vitals": { "lcp": 2712.3, "inp": 184, "cls": 0.06, "samples": 148 }, "error": null }
```

  `lcp`/`inp` = `null` quando o Umami devolve `0` (LCP/INP reais nunca são 0 ms; INP fica sem
  medida em visita sem interação). CLS `0` é medida válida. Sem envios no período (`samples: 0`),
  as três vêm `null` e o painel diz "nenhuma medida no período".
- **Painel:** card "Saúde do sistema", p75 de cada métrica com a faixa do Google — LCP bom até
  2,5 s, ruim acima de 4 s; INP 200 ms / 500 ms; CLS 0,1 / 0,25 (o limite conta como bom).

## 4. Tráfego via Umami (auto-hospedado na VPS)

Umami: open source, sem cookies (não precisa de banner LGPD), Docker + Postgres. Entrega o que o
Vercel Analytics mostra: visitantes, pageviews, visitas, rejeição, tempo, páginas, origens,
dispositivo, navegador, SO e país.

### 4.1 Infra (VPS)
- Container `umami` (imagem `ghcr.io/umami-software/umami:postgresql-latest`, fixar a versão) com
  banco próprio (`umami`) no Postgres existente ou em container separado. Variáveis: `DATABASE_URL`,
  `APP_SECRET`, `TRACKER_SCRIPT_NAME=s.js`, `COLLECT_API_ENDPOINT=/api/c` (nomes neutros, menos
  bloqueio por adblock).
- Painel do Umami em subdomínio próprio só para a equipe (ex.: `umami.storyverse...`), com senha
  forte; trocar o usuário padrão `admin/umami` no primeiro acesso.
- No site (Caddyfile, QA e produção), servir o tracker **pela mesma origem**, para a CSP continuar
  `script-src 'self'` e `connect-src 'self'`:

  ```caddy
  handle_path /u/* {
      reverse_proxy umami:3000
  }
  ```

  Assim `/u/s.js` e `/u/api/c` passam pelo próprio domínio. Nenhuma mudança na CSP.

### 4.2 Frontend (PR separado, depois do Umami no ar)
- `src/lib/analytics.ts`: se `VITE_UMAMI_WEBSITE_ID` existir, cria
  `<script defer src="/u/s.js" data-website-id="..." data-host-url="/u" data-do-not-track="true">`.
  O tracker já acompanha a navegação do React Router (history API).
- Não mandar e-mail, id de usuário nem query string: `data-exclude-search="true"`.
- Rotas de leitura com id de livro: avaliar `data-exclude-hash` e normalizar caminhos antes de
  enviar se o id for sensível.

### 4.3 API (story-verse-api)
Variáveis: `UMAMI_API_URL` (rede interna, ex.: `http://umami:3000`), `UMAMI_USERNAME`,
`UMAMI_PASSWORD` (usuário só de visualização) e `UMAMI_WEBSITE_ID`. A API faz login em
`POST /api/auth/login`, guarda o token e chama:
- `GET /api/websites/{id}/stats?startAt&endAt` → pageviews, visitors, visits, bounces, totaltime
- `GET /api/websites/{id}/pageviews?startAt&endAt&unit=day&timezone=America/Sao_Paulo` → séries
- `GET /api/websites/{id}/metrics?type=path|referrer|device|browser|os|country&startAt&endAt&limit=10`
  (versões antigas usam `type=url` no lugar de `path`)
- `GET /api/websites/{id}/active` → visitantes agora

**Endpoint novo:** `GET /api/v1/admin/traffic?from&to` (superadmin, cache 5 min):

```json
{
  "visitors": 1200, "pageviews": 5400, "visits": 1600, "bounceRate": 0.41,
  "avgVisitSeconds": 210, "activeNow": 7,
  "series": [{ "day": "2026-10-25", "visitors": 180, "pageviews": 700 }],
  "topPages": [{ "value": "/biblioteca", "count": 900 }],
  "referrers": [{ "value": "google.com", "count": 300 }],
  "devices": [{ "value": "mobile", "count": 800 }],
  "countries": [{ "value": "BR", "count": 1100 }]
}
```

Se o Umami estiver fora do ar ou sem configuração, devolve `{ "traffic": null }` com 200 e o
painel mostra "Tráfego indisponível".

## 5. Ordem sugerida
1. Este PR (frontend): dashboard com os dados atuais e os blocos "aguardando endpoint".
2. API: 2.1 (cadastros) e 2.4 (série de assinaturas) — maior valor de negócio, sem decisão pendente.
3. VPS: Umami + proxy `/u/*`; depois API `admin/traffic` e o tracker no frontend.
4. API: `admin/health` (Sentry) e Web Vitals pelo Umami (`admin/vitals`).
5. Produto decide a regra de "página lida" (2.2); depois API + leitor.
6. 2.3, 2.5 e 2.6 (2.6 feito).
