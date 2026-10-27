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
| Tendência de 30 dias (leitores / minutos / livros terminados) | série diária |
| Ranking da semana (top 10, respeita quem se escondeu) | RPC `weekly_ranking` (`POST /api/v1/rpc/weekly_ranking`) |
| Assinaturas: MRR, ativas, em teste, novas × canceladas (30 dias) | `GET /api/v1/admin/billing/summary` |

Observação: "Hoje" é o dia do calendário em America/Sao_Paulo (as funções `admin_metrics_*`
trabalham com `date`). "Últimas 24 horas" de verdade exige o item 2.1.

## 2. Endpoints e campos que faltam na API

Todos superadmin, com o mesmo cache curto de 5 minutos do `AdminMetricsService`, mesmo limite de
90 dias e fuso America/Sao_Paulo.

### 2.1 Cadastros por dia (e janela de 24h)
- **Novo campo** em `AdminMetrics.Accounts`: `new24h` (`created_at >= now() - interval '24 hours'`)
  e `newToday`.
- **Novo campo** em `AdminMetricsReadingPoint` (série diária/semanal): `signups` (contas criadas no
  bucket). Alternativa: `GET /api/v1/admin/metrics/signups?from&to&group=day|week` →
  `[{ bucket, signups, confirmed }]`.
- Com isso o dashboard ganha comparação de novos usuários com o período anterior e a barra de
  cadastros na tendência.

### 2.2 Páginas lidas
Hoje **não existe** em lugar nenhum: `reading_days` só guarda `seconds`, e `page_count` existe só no
acervo (`catalog_books`). Proposta:
- Coluna `pages integer not null default 0` em `public.reading_days`, alimentada pelo leitor (o app
  já envia os segundos por dia em `report_reading`; passaria a enviar `{ day: { seconds, pages } }`).
  A contagem de página precisa de regra única no leitor (ex.: página = tela virada no modo paginado,
  ou 250 palavras no modo rolagem) — decisão de produto antes de implementar.
- Campo `pages` em `AdminMetrics.Reading` e em `AdminMetricsReadingPoint`.

### 2.3 Usuários ativos (DAU / WAU / MAU)
"Leitor ativo" só conta quem leu. Para atividade geral:
- Tabela `public.activity_days(user_id, day)` (upsert no primeiro request autenticado do dia, ou no
  `reading_heartbeat`).
- `GET /api/v1/admin/metrics/active?from&to` → `{ dau, wau, mau, series: [{ day, active }] }`.

### 2.4 Assinaturas e receita no tempo
`billing/summary` é só uma foto. Faltam:
- `GET /api/v1/admin/billing/series?from&to&group=day|week` →
  `[{ bucket, mrrCents, active, newCount, canceledCount, revenueCents }]`. `mrrCents` precisa de
  snapshot diário (job que grava `billing_daily_snapshots`) ou reconstrução pelos eventos do Stripe
  já guardados pelo webhook. `revenueCents` = faturas pagas no bucket (`invoice.paid`).
- Conversão grátis → pago: `{ trialsStarted, trialsConverted, paidFromFree }` no período, no próprio
  `billing/summary`.

### 2.5 Livros mais lidos
- `GET /api/v1/admin/metrics/top-books?from&to&limit=10` →
  `[{ bookKey, title, author, readers, minutes, finished }]` agregando `reading_days` /
  `library_entries` (só livros do acervo ou com título conhecido; nada de texto do usuário).

### 2.6 Atividade da comunidade
- `GET /api/v1/admin/metrics/community?from&to&group=day` →
  `[{ bucket, topics, replies, reports }]`.

## 3. Saúde do sistema via Sentry

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

**Web Vitals (LCP, INP, CLS):** só existem se o Sentry receber transações. Hoje
`VITE_SENTRY_TRACES_SAMPLE_RATE` = 0. Ligar com amostra pequena (ex.: `0.05`) e, no endpoint,
`GET /organizations/{org}/events/?dataset=metrics&field=p75(measurements.lcp)&field=p75(measurements.inp)&field=p75(measurements.cls)&statsPeriod=7d&project={id}`.

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
4. API: `admin/health` (Sentry) e amostra de traces para Web Vitals.
5. Produto decide a regra de "página lida" (2.2); depois API + leitor.
6. 2.3, 2.5 e 2.6.
