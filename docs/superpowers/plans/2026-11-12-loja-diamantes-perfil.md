# Loja de diamantes (itens de perfil) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loja dentro do app onde o leitor gasta diamantes em moldura, insígnia, capa e nome colorido, que aparecem para os outros onde o avatar aparece; o admin cria os itens enviando imagens.

**Architecture:** Regras e saldo ficam no Postgres (funções `security definer` + RLS, padrão de `buy_ai_pack`), expostas por RPC (`RpcService`) e, para o admin, por REST. Uma função `public.user_cosmetics(uuid) returns jsonb` é a única fonte do "equipado" de uma pessoa e entra em todas as consultas que devolvem pessoas. No site, um componente de avatar e um de nome passam a receber `cosmetics`; a loja e a seção do admin vivem em `src/features/shop/` e `src/features/admin/`.

**Tech Stack:** API: Java 25, Spring, JdbcClient, Flyway, Postgres, JUnit (testes de integração com `STORYVERSE_TEST_DB_URL`). Site: React 19, Vite, TypeScript, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-loja-diamantes-perfil-design.md` — ler antes de qualquer tarefa; as decisões marcadas lá valem aqui.

## Global Constraints

- Dois repositórios: `story-verse-api` (`C:\Users\werne\WebstormProjects\story-verse-api`) e `story-verse-web` (este). Branch `feat/loja-diamantes-perfil` a partir de `origin/develop` em cada um; PR para `develop`; o da API é mergeado antes.
- Saldo e regras **só no banco**; o site pede e mostra.
- Categorias desta etapa: `frame`, `badge`, `cover`, `name_color`. Níveis: `common`, `rare`, `epic`.
- Estados de item: `draft`, `on_sale`, `off_sale`. Item com posse não pode ser apagado.
- Motivo do extrato para compras da loja: `purchase` (já existe na constraint `diamond_ledger_reason_check`; a V10 é a última que a redefine).
- Preço gravado na posse no momento da compra.
- Imagens: só `image/png`, `image/webp`, `image/jpeg` (JPEG só para capa); nunca SVG enviado. Limite 1 MB por imagem, 3 MB para a moldura animada. Moldura e insígnia quadradas (mín. 128 px, máx. 1024 px); capa 1500×500 (proporção 3:1, aceitar ±2%).
- Moldura `epic` tem duas imagens: `image_url` (parada) e `animated_url` (WebP animado).
- `name_color`: 1 a 3 cores `#rrggbb`; contraste mínimo 4.5:1 de **cada** cor contra `#14110e` e `#0e1612` (fundos dos dois temas em `src/index.css`).
- Copy: a estante da loja chama-se **"Insígnias"**; o bloco existente de conquistas (`profile.badges`, "Conquistas") não muda e não se mistura.
- Faixas de preço sugeridas no formulário do admin: comum 50–150, raro 300–600, épico 800+ (só sugestão, não validação).
- Código novo do site fora de `src/App.tsx`, exceto o mínimo para ligar rota e trocar componentes existentes.
- Fórum está fora de produção: não levar cosméticos ao fórum.
- **Ordem de execução:** 1 → 2 → 3 → 5 → 6 → 9 → 4 → 7 → 8 → 10 → 11. A Task 4 (lote no banco) copia nomes, preços e ids do README que a Task 9 produz.
- **Capa no perfil público (escolha do plano):** hoje a foto de capa enviada só aparece no perfil próprio. O perfil público passa a mostrar a capa escolhida (`shop_cover ?? cover`), sob as mesmas regras de visibilidade do perfil privado.

## Review Focus

- Toque duplo/duas abas na compra: mesmo `ref` não cobra duas vezes; `ref` diferente do mesmo item é recusado sem cobrar (Task 1).
- Moldura que aumenta o espaço do avatar e desalinha listas e o chat no tamanho `sm` (Task 6).
- Nome longo + insígnia: a insígnia nunca quebra linha; o nome trunca antes (Task 6).
- Admin envia arquivo com extensão `.png` que na verdade é SVG/HTML: recusado pelo tipo real (Task 2).
- Perfil privado bloqueado: capa e estante não vazam na resposta da API (não só escondidas no site) (Task 3).

---

## Parte A — API (`story-verse-api`)

### Task 1: Esquema da loja, compra e equipar (migração V54)

**Files:**
- Create: `src/main/resources/db/migration/V54__shop.sql` (conferir o último número em `db/migration` antes; usar o próximo)
- Modify: `src/main/java/com/storyverse/api/rpc/RpcService.java` (novos `case`, mesmo padrão de `ai_pack_catalog`/`buy_ai_pack`, linhas ~77–80)
- Test: `src/test/java/com/storyverse/api/rpc/ShopIntegrationTest.java` (molde: `SpinWheelIntegrationTest`, rodando como `storyverse_api` com `DbSession.setUser`)

**Interfaces:**
- Produces (SQL, todas `security definer`, `grant execute ... to authenticated`, `revoke ... from public, anon`):
  - Tabela `shop_items(id uuid pk default gen_random_uuid(), category text, tier text, name text 1–60, description text ≤200, price int >0, status text default 'draft', image_url text null, animated_url text null, colors text[] null, sort_order int default 0, available_from timestamptz null, available_until timestamptz null, stock int null check (stock is null or stock >= 0), sold int not null default 0, created_at, updated_at)`.
  - Tabela `shop_ownership(user_id uuid, item_id uuid, price_paid int, ref text, created_at, primary key (user_id, item_id), unique (user_id, ref))`.
  - Tabela `shop_equipped(user_id uuid, category text, item_id uuid, primary key (user_id, category))` com FK composta para `shop_ownership(user_id, item_id)`.
  - RLS ligada nas três; `revoke all ... from public, anon, authenticated` (como a V10).
  - `shop_catalog() returns table (id uuid, category text, tier text, name text, description text, price int, image_url text, animated_url text, colors text[], owned boolean, equipped boolean, available_until timestamptz, remaining int)` — só `on_sale` dentro da janela; `remaining = stock - sold` ou null.
  - `buy_shop_item(p_item uuid, p_ref text) returns table (balance int, item_id uuid, duplicate boolean)`.
  - `my_shop_items() returns table (item_id uuid, category text, tier text, name text, image_url text, animated_url text, colors text[], equipped boolean, price_paid int, bought_at timestamptz)` — inclui itens hoje `off_sale`.
  - `equip_shop_item(p_category text, p_item uuid) returns jsonb` — `p_item null` tira o item da categoria; devolve `user_cosmetics(auth.uid())`.
  - `my_diamond_history` recriada (drop + create, mesmo `grant`) com coluna extra `item_name text` (join em `shop_ownership.ref = ledger.ref` e `reason = 'purchase'`).
- RPC names (site usa estes): `shop_catalog`, `buy_shop_item` (args `item`, `ref`), `my_shop_items`, `equip_shop_item` (args `category`, `item`).

- [ ] **Step 1: Write the failing tests** em `ShopIntegrationTest`, cada um criando conta nova e dando saldo com `apply_diamonds(user, n, 'adjustment', uuid)` como `postgres`, e um item `on_sale` inserido direto:
  - `buyDebitsAndOwns`: saldo 200, item preço 120 → `balance == 80`, `duplicate == false`, `my_shop_items` tem o item com `price_paid == 120`.
  - `sameRefIsDuplicateAndChargesOnce`: duas chamadas com o mesmo `ref` → segunda `duplicate == true`, saldo continua 80, 1 linha em `diamond_ledger` com `reason='purchase'`.
  - `secondBuyWithNewRefIsRefused`: mesmo item, `ref` novo → exceção contendo `"já tem este item"`, saldo inalterado.
  - `insufficientBalanceIsRefused`: saldo 50, preço 120 → exceção `"Diamantes insuficientes"`, sem posse.
  - `notOnSaleOrOutsideWindowIsRefused`: `draft`, `off_sale`, `available_until` no passado, `stock = sold` → exceção `"indisponível"`.
  - `pricePaidSurvivesPriceChange`: compra a 120, `update shop_items set price = 300` → `price_paid` continua 120.
  - `equipRequiresOwnership`: `equip_shop_item('frame', itemNãoComprado)` → exceção; depois de comprar → jsonb com `frame` preenchido; `equip_shop_item('frame', null)` → `frame` null.
  - `historyNamesTheItem`: `my_diamond_history(10)` tem linha `reason='purchase'` com `item_name` igual ao nome do item.
  - `concurrentBuysChargeOnce`: duas threads com refs diferentes do mesmo item ao mesmo tempo → uma posse, um débito.
- [ ] **Step 2: Run** `STORYVERSE_TEST_DB_URL=... ./mvnw -q test -Dtest=ShopIntegrationTest` — Expected: FAIL (funções inexistentes).
- [ ] **Step 3: Implement `V54__shop.sql`.** `buy_shop_item` segue `buy_ai_pack` (V10, ~linha 77): valida `auth.uid()` e tamanho do `ref` (8–80); se já há posse com esse `ref` devolve `duplicate=true`; trava o item com `select ... for update`; recusa se já possui; confere status/janela/estoque; `apply_diamonds(uid, -price, 'purchase', p_ref)`; insere posse; `sold = sold + 1`. A trava do item serializa compras concorrentes.
- [ ] **Step 4: Add** os quatro `case` em `RpcService` (`buy_shop_item` → `"select * from public.buy_shop_item(cast(:item as uuid), :ref)"`; `equip_shop_item` → `scalar(...)` devolvendo o jsonb).
- [ ] **Step 5: Run** os testes — Expected: PASS. Rodar também a suíte inteira (`./mvnw -q verify`) — Expected: PASS.
- [ ] **Step 6: Commit** `feat(loja): catálogo, compra e equipar itens de perfil (V54)`.

### Task 2: Admin dos itens e armazenamento das imagens

**Files:**
- Modify: `src/main/java/com/storyverse/api/storage/StorageBucket.java` — novo `SHOP_ITEMS("shop-items", true, 3L * 1024 * 1024, Set.of("image/webp", "image/png", "image/jpeg"))`
- Create: `src/main/java/com/storyverse/api/admin/ShopItemController.java`, `ShopItemService.java`, `ShopItemRepository.java`, `ShopImageCheck.java`
- Test: `src/test/java/com/storyverse/api/admin/ShopItemControllerTest.java`, `ShopImageCheckTest.java`

**Interfaces:**
- Consumes: tabelas da Task 1.
- Produces (REST, só admin, no padrão de `AdminUserController`; cada escrita grava em `AdminAuditService`):
  - `GET /api/v1/admin/shop/items?category=&status=` → lista com `owners` (contagem de posses).
  - `POST /api/v1/admin/shop/items` (JSON dos campos de `shop_items`, sem `sold`) → item criado.
  - `PUT /api/v1/admin/shop/items/{id}` → item atualizado.
  - `DELETE /api/v1/admin/shop/items/{id}` → 204; **409** `"Item já vendido: tire de venda em vez de apagar."` se houver posse.
  - `POST /api/v1/admin/shop/images?kind=frame|frame_animated|badge|cover` (multipart `file`) → `{ "url": "<público>" }`. Escrita no bucket `shop-items` só por aqui (o endpoint genérico de storage recusa esse bucket para não-admin).
  - `ShopImageCheck.check(byte[] bytes, String kind) -> ImageInfo(String mime, int width, int height, boolean animated)` lança `IllegalArgumentException` com mensagem para o admin.

- [ ] **Step 1: Write the failing tests:**
  - `ShopImageCheckTest`: PNG 256×256 → ok; WebP animado com `kind=frame_animated` → `animated == true`; arquivo SVG renomeado `.png` → recusado `"Formato não aceito"`; PNG 300×200 com `kind=badge` → `"precisa ser quadrada"`; JPEG com `kind=frame` → recusado; capa 1500×500 → ok, 1500×800 → `"proporção 3:1"`; 1.2 MB com `kind=badge` → `"até 1 MB"`.
  - `ShopItemControllerTest`: não-admin → 403 em todas as rotas; `name_color` com cor `#333333` → 400 `"contraste"`; `frame` `epic` sem `animated_url` → 400; `on_sale` sem imagem (categoria com imagem) → 400; `DELETE` de item com posse → 409; `PUT` de preço grava auditoria.
- [ ] **Step 2: Run** `./mvnw -q test -Dtest='ShopImageCheckTest,ShopItemControllerTest'` — Expected: FAIL.
- [ ] **Step 3: Implement.** Tipo real pelos bytes iniciais (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF....WEBP`; animado = chunk `ANIM`/flag no `VP8X`); dimensões lidas do cabeçalho; contraste pela fórmula WCAG de luminância relativa contra `#14110e` e `#0e1612`. A validação de item (categoria × campos) fica em `ShopItemService` e também como `check` na tabela quando for simples.
- [ ] **Step 4: Run** — Expected: PASS; `./mvnw -q verify` PASS.
- [ ] **Step 5: Commit** `feat(admin): gerenciar itens da loja e enviar imagens`.

### Task 3: Cosméticos em todas as respostas que mostram pessoas

**Files:**
- Create: `src/main/resources/db/migration/V55__shop_cosmetics.sql`
- Modify: `src/main/java/com/storyverse/api/social/SocialRepository.java` (`PERSON` ~linha 22, `profile` ~49)
- Modify: `src/main/java/com/storyverse/api/groups/GroupRepository.java` (`MESSAGE_ROW` ~56, `FACE` ~254, `myInvites` ~321, `notifications` ~399, `members` ~451)
- Test: `src/test/java/com/storyverse/api/social/ShopCosmeticsIntegrationTest.java`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `public.user_cosmetics(p_user uuid) returns jsonb` (stable, security definer): `{"frame": {"image": url, "animated": url|null, "tier": t} | null, "badge": {"image": url, "name": n} | null, "name_color": ["#..", ...] | null}` — só itens equipados; item `off_sale` equipado continua valendo.
  - `public.user_profile_extras(p_user uuid) returns jsonb`: `{"shop_cover": url|null, "badge_shelf": [{"id","name","image"}...]}`.
  - Colunas novas nas consultas: `cosmetics` (PERSON, FACE, members), `author_cosmetics` (MESSAGE_ROW), `invited_by_cosmetics` (myInvites), `actor_cosmetics` (notifications); `weekly_ranking`/`alltime_ranking` recriadas (drop + create, mesmos grants) com coluna extra `cosmetics jsonb`.
  - `profile(...)` ganha `shop_cover` e `badge_shelf` **apenas** quando `public.social_content_visible(u.id)` for verdadeiro (senão `null` e `[]`), e `cover` (foto de capa enviada, validada na pasta da própria pessoa como `photo`) sob a mesma condição.

- [ ] **Step 1: Write the failing tests:** pessoa A compra e equipa moldura, insígnia, cor e capa.
  - `cosmeticsInFollowersAndSearch`: B lista seguidores/busca e recebe `cosmetics.frame.image` de A.
  - `cosmeticsInGroupMessagesMembersInvitesNotifications`: num grupo com A e B, `author_cosmetics`, `cosmetics` em `members`, `invited_by_cosmetics` e `actor_cosmetics` trazem o equipado de A.
  - `cosmeticsInRanking`: `weekly_ranking` e `alltime_ranking` trazem `cosmetics` de A.
  - `privateProfileHidesCoverAndShelf`: A privado, B não segue → `profile` com `cosmetics` preenchido, `shop_cover == null`, `cover == null`, `badge_shelf == []`; depois de B seguir → preenchidos.
  - `unequippedIsNull`: conta sem itens → `cosmetics` com as três chaves `null`.
- [ ] **Step 2: Run** `./mvnw -q test -Dtest=ShopCosmeticsIntegrationTest` — Expected: FAIL.
- [ ] **Step 3: Implement** a V55 e acrescente `public.user_cosmetics(u.id) as cosmetics` (com o alias de cada consulta) às projeções listadas.
- [ ] **Step 4: Run** — Expected: PASS; `./mvnw -q verify` PASS (os testes existentes de social/grupos/ranking continuam verdes).
- [ ] **Step 5: Commit** `feat(loja): moldura, insígnia e nome colorido em todas as listas de pessoas`.

### Task 4: Primeiro lote no catálogo (V56)

**Files:**
- Create: `src/main/resources/db/migration/V56__shop_first_batch.sql`
- Test: em `ShopIntegrationTest`, `firstBatchIsOnSale`.

**Interfaces:**
- Consumes: os arquivos do lote vêm da Task 9 (site), servidos pelo próprio site em `/shop/<arquivo>.webp`; `image_url` guarda o caminho relativo `/shop/...` (o site resolve contra a origem do app). Itens criados pelo admin usam a URL pública do bucket `shop-items`. `ShopItemService` aceita os dois formatos.
- Produces: 6 molduras (3 `common` anel, 2 `rare` ilustradas, 1 `epic` animada), 6–8 insígnias `common`/`rare`, 3 capas `rare`, 3 `name_color` (1 sólida `common`, 2 gradientes `rare`), todos `on_sale`, com ids fixos (uuid literal) e `on conflict (id) do nothing`. Nomes e preços: decididos na Task 9, copiados para cá.

- [ ] **Step 1: Write the failing test** `firstBatchIsOnSale`: `shop_catalog()` de conta nova tem ≥ 6 `frame` (exatamente 1 `epic` com `animated_url` não nulo), ≥ 6 `badge`, 3 `cover`, 3 `name_color`; todo `name_color` passa no contraste 4.5:1 contra os dois fundos.
- [ ] **Step 2: Run** — FAIL. **Step 3:** escrever a V56. **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(loja): primeiro lote de itens de perfil`.

---

## Parte B — Site (`story-verse-web`, este repositório)

### Task 5: Cliente da loja (`src/lib/shop.ts`)

**Files:**
- Create: `src/lib/shop.ts`, `src/lib/shop.test.ts`
- Modify: `src/lib/diamonds.ts` (`DiamondEntry.item_name?: string | null`; `diamondEntryLabel` para `purchase` → `"Compra: ${item_name}"`, sem nome → `"Compra na loja"`)
- Modify: `src/lib/diamonds.test.ts` (ou criar) para o rótulo.

**Interfaces:**
- Consumes: RPCs da Task 1, via `rpc(session, name, args, { feature: "A loja" })`.
- Produces:
  - `type ShopCategory = "frame" | "badge" | "cover" | "name_color"`; `type ShopTier = "common" | "rare" | "epic"`.
  - `type Cosmetics = { frame: { image: string; animated: string | null; tier: ShopTier } | null; badge: { image: string; name: string } | null; name_color: string[] | null }`.
  - `type ShopItem` (campos de `shop_catalog`), `type OwnedItem` (campos de `my_shop_items`).
  - `fetchShopCatalog(session): Promise<ShopItem[]>`, `fetchMyShopItems(session): Promise<OwnedItem[]>`, `buyShopItem(session, itemId, ref = newRef()): Promise<{ balance: number; item_id: string; duplicate: boolean }>`, `equipShopItem(session, category, itemId | null): Promise<Cosmetics>`.
  - `shopAssetUrl(url: string): string` — caminho `/shop/...` vira absoluto na origem do app; URL https passa igual; qualquer outra coisa → `""`.
  - `nameColorStyle(colors: string[] | null): React.CSSProperties | undefined` — 1 cor → `color`; 2–3 → `background-image: linear-gradient(90deg, ...)` + `background-clip: text` + `color: transparent`.
  - `contrastRatio(a: string, b: string): number` — fórmula WCAG (luminância relativa), cores `#rrggbb`; `contrastRatio("#ffffff", "#000000")` ≈ 21.

- [ ] **Step 1: Write the failing tests:** `shopAssetUrl("/shop/a.webp")` termina em `/shop/a.webp` com a origem; `shopAssetUrl("javascript:alert(1)") === ""`; `nameColorStyle(["#f1cf88"])` → `{ color: "#f1cf88" }`; 3 cores → `backgroundImage` com as três; `buyShopItem` reusa o `ref` passado (mock de `rpc`); `diamondEntryLabel({reason:"purchase", item_name:"Folhas"})` → `"Compra: Folhas"`.
- [ ] **Step 2: Run** `npx vitest run src/lib/shop.test.ts src/lib/diamonds.test.ts` — FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(loja): cliente da loja e extrato com o nome do item`.

### Task 6: Avatar com moldura e nome com insígnia

**Files:**
- Modify: `src/features/groups/GroupParts.tsx` (`PersonFace`, ~linha 13: nova prop opcional `cosmetics?: Cosmetics | null`, `animate?: boolean` default `false`)
- Create: `src/features/shop/PersonName.tsx`, `src/features/shop/cosmetics.css`, `src/features/shop/PersonName.test.tsx`, `src/features/groups/GroupParts.test.tsx` (se não existir)

**Interfaces:**
- Consumes: Task 5 (`Cosmetics`, `shopAssetUrl`, `nameColorStyle`).
- Produces:
  - `PersonFace({ ..., cosmetics, animate })`: desenha a moldura como `<img>` posicionada **sobre** o rosto (absoluta, `inset` negativo proporcional ao tamanho), sem alterar a caixa do avatar; usa `frame.animated` só se `animate && !prefersReducedMotion`; senão `frame.image`.
  - `PersonName({ name, cosmetics, className? })`: `<span>` com nome (truncável, `min-width: 0`, `text-overflow: ellipsis`) + insígnia de tamanho fixo `1em`, `flex: none`, `alt` = nome da insígnia.

- [ ] **Step 1: Write the failing tests:**
  - `PersonFace` com `cosmetics.frame` renderiza `img.face-frame` com `src` da imagem parada; com `animate` e `matchMedia('(prefers-reduced-motion: reduce)')` falso → `src` animado; verdadeiro → parado.
  - A caixa `.group-face-sm` tem a mesma classe/tamanho com e sem moldura (snapshot das classes; a moldura é filha absoluta).
  - `PersonName` com nome de 80 caracteres + insígnia → insígnia presente com `alt` correto e o nome com a classe que trunca; com `name_color` de 2 cores → `style.backgroundImage` contém as duas.
- [ ] **Step 2: Run** `npx vitest run src/features/shop src/features/groups/GroupParts.test.tsx` — FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(loja): avatar com moldura e nome com insígnia`.

### Task 7: Tela da loja e "Meus itens"

**Files:**
- Create: `src/features/shop/ShopPage.tsx`, `src/features/shop/ShopPage.test.tsx`, `src/features/shop/shop.css`
- Modify: `src/App.tsx` — rota/abertura da loja a partir de `DiamondShopPage` (~linha 2875: botão "Loja de itens") e lazy import como os de admin/grupos.

**Interfaces:**
- Consumes: Tasks 5 e 6; saldo via `fetchWallet` (`src/lib/diamonds.ts`).
- Produces: `ShopPage({ session, onBalance?: (n: number) => void })`.

Comportamento (do spec §6.2/6.4): abas Molduras · Insígnias · Capas · Nomes · Meus itens; cada card mostra nome, descrição, nível e preço; prévia aplicada no avatar/nome da própria conta (capa: faixa de perfil de exemplo); sem saldo → botão desligado com `"Faltam N 💎"`; item possuído → `"Seu"` + Equipar/Tirar; após comprar → saldo atualiza com o valor devolvido e aparece `"Equipar agora?"`; em Capas, opção "Usar minha foto de capa" que equivale a `equipShopItem(session, "cover", null)`. Um `ref` por intenção de compra (gerado ao abrir a confirmação, reusado em nova tentativa após erro de rede).

- [ ] **Step 1: Write the failing tests** (mock de `src/lib/shop.ts`):
  - saldo 40, item 50 → botão `Comprar` desabilitado e texto `"Faltam 10 💎"`.
  - comprar → `buyShopItem` chamado uma vez mesmo com dois cliques rápidos; saldo exibido vira o `balance` devolvido; aparece `"Equipar agora?"`.
  - erro de rede na primeira tentativa e sucesso na segunda → as duas chamadas usam o **mesmo** `ref`.
  - item possuído aparece como `"Seu"` e não oferece `Comprar`.
  - em Capas, `"Usar minha foto de capa"` chama `equipShopItem(session, "cover", null)`.
- [ ] **Step 2: Run** `npx vitest run src/features/shop/ShopPage.test.tsx` — FAIL. **Step 3:** implementar. **Step 4:** PASS; `npx tsc -b` e `npx eslint src/features/shop` sem erros.
- [ ] **Step 5: Commit** `feat(loja): tela da loja com prévia, compra e meus itens`.

### Task 8: Cosméticos em todas as telas que mostram pessoas

**Files (Modify):** `src/lib/social.ts`, `src/lib/groups.ts` (tipos com `cosmetics`/`author_cosmetics`/`invited_by_cosmetics`/`actor_cosmetics`, perfil com `shop_cover`, `cover`, `badge_shelf`), `src/lib/ranking.ts` (linha com `cosmetics`), `src/features/social/PeopleParts.tsx`, `src/features/social/PersonProfilePage.tsx`, `src/features/groups/GroupChat.tsx`, `src/features/groups/GroupInfo.tsx`, `src/features/groups/InvitePeople.tsx`, `src/features/groups/ReceivedInvites.tsx`, `src/features/notifications/NotificationBell.tsx`, `src/App.tsx` (ranking ~3237–3400 e perfil próprio ~4566 para a capa).
**Test:** acrescentar casos nos testes existentes dessas telas (`*.test.tsx` ao lado) ou criar.

**Interfaces:**
- Consumes: Tasks 3, 5, 6. O saldo/equipado do próprio leitor depois de equipar vem do retorno de `equipShopItem`.
- Produces: nada novo; troca `PersonFace`/nome por `PersonFace cosmetics=…` + `PersonName` nesses lugares.

Regras: chat comum → mensagens com `author_cosmetics`; **roleplay** → mensagens de personagem e do narrador **sem** cosméticos (usar `characterOf` de `GroupChat.tsx` ~linha 723 para decidir), lista de membros e informações do grupo **com**. Moldura animada só no perfil (`animate` true em `PersonProfilePage` e no perfil próprio). Perfil (público e próprio): capa = `shop_cover ?? cover`; bloco "Insígnias" com `badge_shelf` (não renderiza se vazio), separado de "Conquistas".

- [ ] **Step 1: Write the failing tests:**
  - `PeopleParts`: pessoa com `cosmetics.frame` → `img.face-frame` presente.
  - `GroupChat` modo chat: mensagem com `author_cosmetics.badge` → insígnia ao lado do nome; modo roleplay com `rp_character` → sem `img.face-frame` nem insígnia na mensagem.
  - `PersonProfilePage`: `shop_cover` e `cover` presentes → fundo usa `shop_cover`; só `cover` → usa `cover`; `badge_shelf` com 2 itens → seção "Insígnias" com 2 imagens e seção "Conquistas" intacta; `content_visible=false` → sem capa e sem "Insígnias".
  - Ranking: linha com `cosmetics.name_color` aplica `nameColorStyle`.
  - `NotificationBell`: `actor_cosmetics.frame` → moldura no rosto do ator.
- [ ] **Step 2: Run** `npx vitest run src/features src/App` (os arquivos tocados) — FAIL. **Step 3:** implementar. **Step 4:** PASS; `npx vitest run` inteiro PASS; `npx tsc -b`, `npx eslint src` sem erros.
- [ ] **Step 5: Commit** `feat(loja): moldura, insígnia, nome e capa em todas as telas`.

### Task 9: Primeiro lote de arte

**Files:**
- Create: `design/shop-items/*.svg` (fontes editáveis), `public/shop/*.webp` (exportados), `scripts/export-shop-items.mjs` (gera os WebP a partir dos SVG; animada como WebP animado), `design/shop-items/README.md` (nome, categoria, nível, preço e uuid de cada item — fonte para a V56 da Task 4).

**Interfaces:**
- Produces: arquivos em `/shop/<slug>.webp` (+ `/shop/<slug>-animada.webp` para a épica) e a tabela do README que a Task 4 copia.

Estilo: referência visual em `.superpowers/brainstorm/1579-1794503455/content/molduras.html` e `insignias-temas.html` (fundo escuro, dourado `#e4b86a`, folhas, páginas, estrelas, lua, chave, coruja). Molduras 512×512 com centro transparente para o avatar (raio interno = 37% do lado); insígnias 256×256; capas 1500×500; preços dentro das faixas das Global Constraints.

- [ ] **Step 1: Write the failing test** `src/features/shop/firstBatch.test.ts`: lê `design/shop-items/README.md` e confere que todo arquivo listado existe em `public/shop/`, ≥ 6 molduras com exatamente 1 épica que tem arquivo `-animada`, ≥ 6 insígnias, 3 capas, 3 nomes; cada `name_color` passa contraste 4.5:1 contra `#14110e` e `#0e1612` (usar `contrastRatio` da Task 5).
- [ ] **Step 2: Run** `npx vitest run src/features/shop/firstBatch.test.ts` — FAIL. **Step 3:** desenhar os SVG, exportar, preencher o README. **Step 4:** PASS. Abrir a loja localmente e conferir por screenshot que as molduras encaixam no avatar nos tamanhos `sm`, `md` e `lg`.
- [ ] **Step 5: Commit** `feat(loja): arte do primeiro lote de itens`.

### Task 10: Seção da loja no admin

**Files:**
- Create: `src/features/admin/ShopItemsSection.tsx`, `src/features/admin/ShopItemForm.tsx`, `src/features/admin/ShopItemsSection.test.tsx`, `src/lib/adminShop.ts`
- Modify: `src/features/admin/AdminNav.tsx` (+ teste) e o roteamento do admin, como `CatalogSection`.

**Interfaces:**
- Consumes: REST da Task 2; `PersonFace`/`PersonName` (Task 6) para a prévia; `contrastRatio` (Task 9).
- Produces: `listShopItems`, `createShopItem`, `updateShopItem`, `deleteShopItem`, `uploadShopImage(kind, file): Promise<string>` em `src/lib/adminShop.ts`.

Comportamento: lista filtrável por categoria/estado com contagem de donos; formulário com campos por categoria (§6.5 do spec), upload com mensagem de erro do servidor, seletor de 1–3 cores com aviso de contraste ao vivo (bloqueia salvar abaixo de 4.5:1), prévia no avatar de exemplo em `lg` e `sm` (capa num perfil de exemplo), dica da faixa de preço do nível; botão Apagar só aparece com `owners === 0`, senão "Tirar de venda".

- [ ] **Step 1: Write the failing tests:** cor `#333333` → aviso de contraste e `Salvar` desabilitado; item com `owners: 3` → sem `Apagar`, com `Tirar de venda`; erro 400 do upload → mensagem do servidor visível; prévia mostra `img.face-frame` após upload.
- [ ] **Step 2: Run** `npx vitest run src/features/admin/ShopItemsSection.test.tsx src/features/admin/AdminNav.test.tsx` — FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(admin): seção da loja de itens`.

### Task 11: Verificação no QA

**Files:** nenhum (só ajustes que aparecerem, cada um com teste).

- [ ] **Step 1:** Subir o branch da API no QA (migrações V54–V56 aplicadas) e o do site no QA, como nas entregas anteriores (ver memórias de produção/QA).
- [ ] **Step 2:** Com duas contas de teste: A ganha diamantes (`adjustment` pelo admin se houver, ou roleta), compra uma moldura, uma insígnia, uma capa e um nome; equipa tudo. B confere em: perfil de A, seguidores, busca, ranking, chat comum, membros de um grupo de roleplay (com cosméticos) e mensagens de roleplay (sem), convite e notificação.
- [ ] **Step 3:** Toque duplo em Comprar e duas abas comprando o mesmo item → um débito no extrato, com `"Compra: <nome>"`.
- [ ] **Step 4:** A fica privado → B (não seguidor) vê moldura/insígnia/nome, não vê capa nem "Insígnias".
- [ ] **Step 5:** Admin cria um item novo com imagem enviada, vê a prévia, põe à venda; A compra; admin tenta apagar → bloqueado; tira de venda → A continua usando.
- [ ] **Step 6:** Screenshot do perfil, do chat e da loja no celular (375 px) e no computador, nos dois temas.
- [ ] **Step 7:** Limpar dados de teste; abrir os PRs (API primeiro) com o resultado.
