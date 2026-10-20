# Plano de negócio e implementação — diamantes, IA e comunidade

**Data:** 18/10/2026
**Público:** produto, negócio e engenharia
**Status:** Fase 0 parcialmente implementada em 20/10/2026 (cota no servidor, métricas, cache e modo economia); demais fases seguem como proposta
**Documentos relacionados:** [ARQUITETURA.md](ARQUITETURA.md), [REVISAO_API_PRODUCAO_2026-10-16.md](REVISAO_API_PRODUCAO_2026-10-16.md), [MARCO3_CORTE.md](MARCO3_CORTE.md)

---

## 0. Resumo executivo

As features fazem sentido, mas não têm o mesmo valor nem o mesmo custo. A tese deste plano é:

1. **Diamantes precisam de sumidouros, não de mais fontes.** Hoje o usuário ativo ganha cerca de 33 a 80 diamantes por semana e só consegue gastar até 20 (Salva-ofensiva). A economia já nasce inflacionada.
2. **O melhor sumidouro é status, não token.** Presentes e cosméticos custam zero de IA, não transferem valor entre contas e criam interação social. Mensagens extras são retenção, não receita.
3. **Custo de IA tende a zero com quatro alavancas:** cache compartilhado no servidor, pré-geração na curadoria, free tiers em cadeia e fallback determinístico. O que sobra é coberto por BYOK ou self-host.
4. **Nada de IA deve ser vendido antes da cota no servidor.** A revisão de 16/10 mostrou que `/api/v1/ai/reply` não tem quota por conta e aceita `system` arbitrário. Vender mensagem sem corrigir isso é convidar abuso.
5. **Ordem recomendada:** fundação (quota + cache + métricas) → presentes/cosméticos → pacotes de mensagens → tradução contextual → Modo Lore → dicas → avatar/voz.

**Decisão pedida:** aprovar a Fase 0 e a Fase 1; as demais ficam condicionadas às métricas de custo e à capacidade de curadoria.

---

## 1. Situação atual

### 1.1 O que já existe

| Área | Estado | Referência |
| --- | --- | --- |
| Chat com personagens | Ativo, com 50 mensagens/dia **no navegador** | `src/lib/usageLimit.ts`, `src/lib/ai.ts` |
| IA no servidor | Proxy `/api/v1/ai/reply`; chaves no servidor; cota por conta (50/dia configurável), 6/min, concorrência 4; `/api/v1/ai/quota`; métricas por chamada | `story-verse-api` (`AiBudget`, `AiMetrics`, `V8__ai_foundation.sql`) |
| Provedores | Groq, Gemini e OpenRouter em cadeia de fallback | `src/lib/ai.ts:160` |
| Tradução | Sem IA: tradutor do navegador → Google público → MyMemory | `src/lib/translate.ts` |
| Cache de tradução | Por navegador (`localStorage`), não compartilhado | `src/lib/translate.ts:220` |
| Diamantes | Carteira e extrato no banco, lançamento idempotente | `supabase/diamonds.sql` |
| Fontes de diamantes | Roleta (~2,7/dia), leitura (2/dia), pódio (50/30/20 por semana) | `supabase/diamonds.sql`, `supabase/weekly-ranking.sql` |
| Sumidouros | Salva-ofensiva (10 por dia, máximo 2/semana) e presentes (5 envios/dia; 4 itens de 5 a 50) | `supabase/diamonds.sql`, `story-verse-api` (V9) |
| Comunidade | Envio, aprovação e acervo de livros | `supabase/community-books.sql` |
| Elenco | Sugerido por IA uma vez e cacheado no navegador | `src/lib/cast.ts` |

### 1.2 A economia hoje

Cenário de um usuário engajado:

- Roleta: **2,7 diamantes/dia** (média declarada no próprio SQL) → ~19/semana.
- Meta de leitura: **2/dia** → 14/semana.
- Pódio: 50, 30 ou 20 **uma vez por semana** para os três primeiros.
- Total: **~33/semana** (sem pódio) a **~83/semana** (primeiro lugar).
- Gasto máximo: 2 Salva-ofensivas × 10 = **20/semana**, e só quando o usuário falha dias.

**Conclusão:** sobra saldo em quase todas as contas ativas. Sem sumidouro, o diamante perde significado e a loja vira decoração.

### 1.3 O custo de IA hoje

- O limite de 50/dia é aplicado no servidor; o contador local é só otimização de UI. O valor agora é configurável por `AI_DAILY_MESSAGE_LIMIT`.
- O servidor aceita `system` e histórico arbitrários e até 800 tokens de saída (achado 9 da revisão).
- Com as chaves configuradas, o custo de abuso é do projeto, não do usuário.
- A tradução atual não usa IA generativa, então já é custo zero — e é o padrão que devemos preservar.

---

## 2. Avaliação das features

### 2.1 Quadro-resumo

| Feature | Problema que resolve | Impacto de negócio | Custo marginal | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- |
| Presentes/cosméticos | Diamante sem uso; ranking pouco social | Alto: status, reciprocidade, retorno diário | **Zero** (só banco) | Baixo; farming de contas | **Agora** |
| Pacotes de mensagens extras | Limite de 50/dia; proteção das chaves | Médio: retenção e percepção de valor | Baixo a zero (free tier/cache) | Alto se sem quota no servidor | **Agora** |
| Tradução contextual por IA | Tradução literal sem contexto | Alto: diferencial para clássicos em inglês | Baixo com cache; zero no caminho atual | Custo se traduzir livro inteiro | **Próximo** |
| Modo Lore | Quem quer conversar sem importar livro | Alto: engajamento do público jovem; conteúdo da comunidade | Baixo se cenário/elenco forem pré-gerados | IP de franquias; moderação | **Próximo** |
| Dica do futuro | Interação com o personagem | Médio: microtransação divertida | **Zero após pré-gerar** | Spoiler; curadoria | **Próximo** |
| Avatar por IA | Personalização | Baixo a médio | Alto (imagem + storage) | Moderação e custo | **Depois** |
| Voz premium | Imersão | Médio | Alto (ElevenLabs) | Margem negativa | **Depois/BYOK** |

### 2.2 Presentes e cosméticos — a melhor alavanca

**O que é:** o usuário gasta diamantes em um item (flor, coroa, troféu, moldura) e envia a outro leitor; o presente aparece no perfil e no ranking semanal.

**Por que vale a pena:**

- Custo operacional **zero**: é uma linha no banco.
- Não cria valor transferível: o presente é cosmético, então não vira mercado paralelo nem lavagem de diamantes.
- Gera loop social: quem recebe tende a retribuir; quem envia ganha status.
- Dá sentido ao ranking além de minutos.
- Funciona para o público que "não lê muito", como você observou.

**Regras recomendadas:**

- Presente é **item**, não diamante. Diamante não é transferível.
- Limite diário de envios (ex.: 5) e idade mínima da conta (ex.: 3 dias) para reduzir farming por contas alternativas.
- Catálogo com raridade e rotação semanal; itens sazonais aumentam retorno.
- Ranking mostra no máximo um agregado ("recebeu 12 presentes nesta semana"), não o histórico completo.

**Impacto esperado:** aumento de DAU e de sessões curtas; redução do saldo entesourado. É a feature com melhor relação impacto/custo do plano.

### 2.3 Mensagens extras — retenção, não receita

**O que é:** acabaram as 50 do dia, o usuário compra um pacote com diamantes (ex.: +20 mensagens por 30 diamantes) ou desbloqueia uma mensagem avulsa.

**Por que vale a pena:**

- Resolve a fricção de quem conversa muito, sem liberar a cota de graça.
- Ajuda a proteger as chaves: em vez de aumentar o limite global, você cobra do usuário que consome mais.
- Combina com o free tier: a cota gratuita continua, o excedente é pago em moeda virtual.

**Pré-requisito inegociável:** cota e débito **no servidor**. Hoje `usageLimit.ts` é `localStorage`; qualquer "pacote" baseado nisso é burlável em dois cliques.

**Calibragem:** a oferta diária de IA é a soma das cotas dos provedores. Reserve 60–70% para o uso gratuito e 30–40% para picos e novas features. Se a oferta gratuita cobrir 100 usuários ativos, não anuncie para 1.000.

**Impacto esperado:** mais mensagens por usuário engajado e percepção de progressão. Receita direta é improvável enquanto os diamantes não forem compráveis com dinheiro.

### 2.4 Modo Lore — alto potencial, alta responsabilidade

**O que é:** o usuário cria um cenário (premissa + elenco), a IA gera o elenco uma vez e a conversa ocorre sem livro importado. Cenários aprovados vão para a comunidade.

**Por que vale a pena:**

- Remove a barreira do "não tenho livro para importar".
- É o formato mais natural para o público jovem.
- A curadoria transforma custo em ativo: o cenário é gerado e revisado **uma vez**, e consumido por muitos.
- Reaproveita a infraestrutura de comunidade e de admins que já existe.

**Custos e riscos:**

- O chat continua custando por mensagem; o cenário em si é barato se pré-gerado.
- **IP:** cenários públicos com Naruto, Kakashi e franquias similares são risco jurídico. Recomendação: cenários de franquia ficam **privados**; a comunidade só aceita universos originais ou obras em domínio público. Isso também reduz moderação.
- **Prompt injection:** nunca aceitar `system` arbitrário do cliente para cenário público. O servidor carrega o cenário aprovado pelo ID e monta o prompt com regras fixas.
- **Público jovem:** precisa de denúncia, filtro de conteúdo e política de idade. Moderação de texto é mais barata que moderação de imagem, outro motivo para adiar avatar por IA.

**Impacto esperado:** aumento de tempo de sessão e de criação de conteúdo; novo motivo para voltar. É a feature mais "viral" do conjunto, desde que a curadoria aguente o volume.

### 2.5 Tradução contextual — diferencial barato se bem desenhado

**O que é:** o leitor seleciona um parágrafo e pede tradução com contexto, mantendo nomes, tom e referências. O caminho atual continua gratuito e literal.

**Por que vale a pena:**

- Clássicos em inglês são o principal caso de uso; tradução literal atrapalha a imersão.
- O custo é controlável se for **parágrafo sob demanda + cache compartilhado**.
- Pode ser vendida como conveniência premium sem canibalizar a tradução gratuita.

**O que evitar:**

- Traduzir livro inteiro por LLM. Um único livro pode consumir a cota diária de todos os usuários.
- Cachear tradução de livro privado no acervo compartilhado (privacidade e direito autoral).
- Depender só do endpoint não oficial do Google em produção; ele pode bloquear por IP.

**Alternativas de custo zero/baixo:** LibreTranslate self-hosted no VPS (custo marginal zero, qualidade boa para EN→PT), DeepL Free (cota mensal) e, por último, LLM para o modo "contexto".

**Impacto esperado:** aumento de conclusão de leitura em inglês e de uso da loja. É o melhor "premium" percebido por quem já lê.

### 2.6 Dica do futuro — microtransação com custo zero

**O que é:** o leitor paga alguns diamantes para o personagem dar uma dica da trama, sem spoiler pesado.

**Por que vale a pena:**

- Resposta curta, barata e **pré-gerável** por livro/capítulo.
- Excelente para livros populares: gera uma vez, serve para todos.
- Aumenta interação sem aumentar o custo por usuário.

**Cuidados:** validar spoiler, versionar o prompt e invalidar o cache quando o texto mudar.

### 2.7 Avatar por IA — o pior retorno do conjunto

**Por que adiar:**

- Geração de imagem tem custo por chamada, storage e moderação.
- Free tiers de imagem são instáveis e mudam sem aviso.
- O ganho percebido é menor que o de um bom avatar procedural.

**Alternativa de custo zero:** presets procedurais (DiceBear ou equivalentes), molduras e cosméticos. Se a IA de imagem entrar depois, que seja via BYOK ou pacote pago, com fila e moderação.

### 2.8 Voz premium — margem negativa até haver receita

**Por que adiar:**

- ElevenLabs free é limitado e não comercial; o custo por caractere cresce rápido.
- O navegador já oferece `speechSynthesis` de graça.
- Piper self-hosted no VPS cobre o caso básico com custo marginal zero.

**Recomendação:** voz sintética gratuita agora; voz premium apenas com receita ou chave do usuário (BYOK).

---

## 3. Como o custo tende a zero

### 3.1 As seis alavancas

| Alavanca | O que faz | Ganho | Onde entra |
| --- | --- | --- | --- |
| **Cache compartilhado** | Uma tradução/elenco/dica serve todos | Alto | Servidor/Postgres |
| **Pré-geração na curadoria** | Gera no envio/aprovação, não no consumo | Alto | Fluxo de moderação |
| **Free tiers em cadeia** | Soma cotas de Groq/Gemini/OpenRouter | Alto | Já existe em `ai.ts` |
| **Fallback determinístico** | Mock, tradutor do navegador, TTS local | Alto | Já existe em parte |
| **Self-host** | Modelo pequeno/LibreTranslate/Piper no VPS | Médio | VPS atual |
| **BYOK** | Usuário traz a própria chave | Alto para power users | Configurações |

### 3.2 A escada de custo

| Degrau | Custo marginal | Quando usar |
| --- | --- | --- |
| Cache hit (tradução, elenco, dica) | **Zero** | Sempre que possível |
| Free tier de provedor | **Zero até a cota** | Uso normal |
| Self-host no VPS | **Zero marginal** (custo fixo já pago) | Fallback e volume |
| Modelo "lite" pago | Fração de centavo por mensagem | Picos e premium |
| Modelo grande pago | Centavos por mensagem | Só BYOK ou receita |
| Imagem/voz premium | Centavos por unidade | Só com receita/BYOK |

> Os valores exatos mudam por provedor e data. A regra de negócio é a ordem dos degraus, não o número.

### 3.3 A regra dos três portões

Nenhuma chamada de IA paga entra no ar sem os três:

1. **Cota no servidor** — por usuário, por tipo e global.
2. **Cache** — chave determinística, versão de prompt e invalidação.
3. **Fallback** — se a cota acabar, a feature degrada (cache, self-host, mock), não quebra.

Se uma feature não passa nos três, ela fica atrás de flag e não é vendida.

### 3.4 Divisão da oferta gratuita

```
oferta_diaria = soma_das_cotas_free_dos_provedores
orcamento_gratuito = oferta_diaria × 0,65
reserva = oferta_diaria × 0,35   // picos, retries, novas features
```

Quando o consumo global passar de 80% do orçamento, o servidor entra em **modo economia**: só cache e self-host; chamadas novas recebem 429 com mensagem clara. Isso evita surpresa de fatura e mantém o app utilizável.

### 3.5 O que realmente não tem custo

- Presentes, molduras, troféus e cosméticos.
- Roleta e ranking (já são banco).
- Tradução pelo navegador.
- Dica pré-gerada e elenco pré-gerado.
- Avatar procedural.
- Voz pelo `speechSynthesis`.

---

## 4. O que fazer com custo mínimo

### 4.1 Custo zero de operação (só desenvolvimento)

- Presentes e cosméticos.
- Novos prêmios da roleta (pacote de mensagens, item cosmético).
- Avatar procedural.
- Dica pré-gerada para os livros mais lidos.
- Tradução gratuita atual mantida como padrão.

### 4.2 Custo baixo e controlado

- Pacotes de mensagens usando free tier + cota no servidor.
- Tradução contextual com cache compartilhado e limite de caracteres.
- Modo Lore com cenário/elenco gerados na aprovação.
- Self-host de LibreTranslate e Piper no VPS.

### 4.3 Só depois de receita ou BYOK

- Avatar por IA.
- Voz ElevenLabs.
- Tradução de livros inteiros.
- Modelos grandes para roleplay.

---

## 5. Impacto de negócio e métricas

### 5.1 O que cada feature move

| Métrica | Presentes | Mensagens extras | Lore | Tradução | Dica |
| --- | --- | --- | --- | --- | --- |
| DAU/MAU | Alto | Médio | Alto | Médio | Baixo |
| Tempo de sessão | Médio | Alto | Alto | Alto | Baixo |
| Retenção D7 | Alto | Médio | Alto | Médio | Baixo |
| Diamantes gastos | Alto | Médio | Baixo | Médio | Baixo |
| Custo de IA | Zero | Baixo | Médio | Baixo | Zero |
| Conteúdo gerado | Baixo | Zero | Alto | Zero | Zero |

### 5.2 KPIs de acompanhamento

**Economia**
- Razão gasto/emitido de diamantes (meta: ≥ 0,8).
- % de usuários ativos que gastam por semana.
- Saldo mediano (se cresce sem parar, falta sumidouro).

**IA**
- Custo de IA por usuário ativo/mês.
- Taxa de acerto do cache (meta: ≥ 60% na tradução).
- % de mensagens em fallback ou modo economia (meta: < 5%).
- Chamadas por conta/dia vs. cota disponível.

**Produto**
- Mensagens por usuário engajado/semana.
- Adoção de Lore (% de novos usuários que criam ou entram em um cenário).
- Conclusão de livros em inglês.
- Uso da loja e diversidade de itens comprados.

**Curadoria**
- Tempo médio de aprovação.
- Taxa de rejeição de cenários.
- Denúncias por mil cenários publicados.

### 5.3 Critérios de parada (kill criteria)

Desligar ou restringir uma feature se:

- O custo de IA por usuário ativo passar do teto definido por duas semanas seguidas.
- O modo economia ficar ativo mais de 2 dias por semana.
- Denúncias de conteúdo passarem do limite aceitável.
- A taxa de abuso (contas múltiplas, gifts, prompts) tornar a operação inviável.
- A curadoria acumular fila acima de alguns dias.

---

## 6. Riscos e conformidade

| Risco | Probabilidade | Impacto | Mitigação |
| --- | --- | --- | --- |
| Free tier mudar ou acabar | Alta | Alto | Cadeia de provedores, self-host, BYOK, modo economia |
| Abuso por contas múltiplas | Alta | Alto | Verificação de e-mail, idade da conta, limites por dispositivo, detecção de anomalia |
| Custo de IA descontrolado | Média | Alto | Cota no servidor, orçamento global, alertas, kill switch |
| IP de franquias no Lore | Alta | Alto | Franquia só privada; comunidade só original/domínio público |
| Conteúdo impróprio (público jovem) | Média | Alto | Revisão, denúncia, filtros, idade mínima, política clara |
| Prompt injection via livro/cenário | Média | Médio | Prompt montado no servidor; conteúdo tratado como dado, não instrução |
| Vazamento de chave BYOK | Baixa | Alto | Preferir chave só no navegador; se armazenar, criptografar e nunca logar |
| LGPD / dados de menores | Média | Alto | Consentimento, retenção mínima, não logar conteúdo, política de privacidade |
| Regras de loja (Apple/Google) | Média | Médio | Comprar diamante dentro do app exige IAP; planejar antes de vender |
| Direito autoral de tradução | Baixa | Médio | Compartilhar tradução só de obra em domínio público ou licença livre |

---

## 7. Roadmap recomendado

### Fase 0 — Fundação (obrigatória antes de vender qualquer coisa)

**Entregas**
- [x] Cota de IA no servidor por conta, tipo e dia; limite de concorrência; limites de tamanho.
- [x] Cache compartilhado de tradução e de conteúdo de IA (tabela + helper; uso entra na Fase 3).
- [x] Métricas de tokens (reais quando o provedor informa; senão estimados), latência, status e campo de cache hit (evento por chamada, sem conteúdo).
- [x] Modo economia automático (teto global diário configurável; desligado por padrão).
- [ ] Débito de diamantes no servidor para pacotes e funcionalidades (Fase 2).
- [ ] Feature flags por funcionalidade no servidor (por enquanto, flags de build no frontend).

**Critério de aceite:** nenhuma chamada de IA é possível sem cota; o custo diário é observável; desligar uma feature não derruba o app.

### Fase 1 — Presentes e cosméticos

**Entregas**
- [x] Catálogo, envio, recebimento e exibição no perfil/ranking.
- [x] Limite diário e idade mínima de conta.
- [ ] Itens sazonais e rotação.

**Critério de aceite:** presente não transfere diamantes; farming reduzido por limites; custo de IA permanece zero.

### Fase 2 — Pacotes de mensagens

**Entregas**
- Pacotes comprados com diamantes, com crédito e extrato.
- UI de saldo restante vinda do servidor.
- Mensagem clara ao esgotar (opção de comprar, não erro seco).

**Critério de aceite:** não é possível burlar o limite pelo cliente; o saldo de créditos é idempotente e auditável.

### Fase 3 — Tradução contextual

**Entregas**
- Endpoint de tradução por parágrafo/trecho com teto de caracteres.
- Cache compartilhado para obras públicas e da comunidade.
- Modo gratuito atual preservado; modo IA como opção premium.
- LibreTranslate self-hosted como fallback.

**Critério de aceite:** traduzir o mesmo trecho duas vezes não gera custo na segunda; livro inteiro não pode ser traduzido de uma vez.

### Fase 4 — Modo Lore

**Entregas**
- Criação de cenário com premissa e elenco.
- Geração de elenco uma vez, armazenada.
- Submissão à comunidade e curadoria.
- Chat por `scenarioId` (servidor monta o prompt).
- Regras de IP e moderação.

**Critério de aceite:** cenário público não aceita `system` do cliente; cenário de franquia não pode ser publicado; elenco aprovado não é regerado a cada conversa.

### Fase 5 — Dica do futuro

**Entregas**
- Geração na aprovação/publicação para livros populares.
- Cache por livro/capítulo com versão de prompt.
- Compra com diamantes e exibição sem spoiler.

**Critério de aceite:** dica é servida do cache na maioria dos casos; custo marginal próximo de zero.

### Fase 6 — Avatar e voz

**Entregas**
- Avatar procedural (agora, sem IA).
- Avatar por IA apenas com BYOK ou pacote pago (depois).
- Voz pelo navegador; Piper self-hosted; ElevenLabs só com receita.

---

## 8. Apêndice técnico

### 8.1 Onde cada coisa mora

| Camada | Responsabilidade | Arquivos/repositórios |
| --- | --- | --- |
| Frontend | UI, cache local, fallback | `src/App.tsx`, `src/lib/ai.ts`, `src/lib/translate.ts`, `src/lib/diamonds.ts` |
| Banco (Supabase/Postgres) | Economia, RLS, RPCs, cache compartilhado | `supabase/*.sql`, `database/schema.sql` |
| API própria | Chaves de IA, cota, orquestração, cache | repositório `story-verse-api` (Spring Boot) |
| Curadoria | Aprovação de livros/cenários | `src/lib/community.ts`, `supabase/community-books.sql` |

> A API própria é um repositório separado. As alterações abaixo precisam ser coordenadas com as migrations Flyway dela e com o `database/schema.sql` deste repositório.

### 8.2 Modelo de dados proposto

> Ajustar nomes ao padrão existente. Se a API já mantém `api_daily_usage`, **estender** em vez de criar outra tabela.

**Cota de IA**

```sql
create table if not exists public.ai_daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  kind text not null check (kind in ('chat', 'translate', 'hint', 'cast', 'image', 'voice')),
  used integer not null default 0 check (used >= 0),
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day, kind)
);
```

**Créditos de mensagens extras**

```sql
create table if not exists public.ai_credits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0)
);

create table if not exists public.ai_credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  reason text not null check (reason in ('pack_purchase', 'message_use', 'adjustment')),
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
```

**Presentes (cosméticos, não transferíveis)**

```sql
create table if not exists public.gift_catalog (
  id text primary key,
  name text not null,
  icon text not null,
  price integer not null check (price > 0),
  rarity text not null default 'common' check (rarity in ('common', 'rare', 'epic')),
  active boolean not null default true
);

create table if not exists public.user_gifts (
  id bigint generated always as identity primary key,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  gift_id text not null references public.gift_catalog (id),
  week_start date not null,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
```

**Cenários de Lore**

```sql
create table if not exists public.lore_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  premise text not null check (char_length(premise) between 1 and 1200),
  system_prompt text not null check (char_length(system_prompt) between 1 and 4000),
  cast jsonb not null,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text check (char_length(review_note) <= 500),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
```

Regras:
- `system_prompt` nunca vem do cliente em chat público; o servidor carrega pelo ID.
- Cenário público só é lido se `status = 'approved'`.
- RLS no mesmo padrão de `book_submissions`: dono vê o seu, todos veem aprovados, admin vê tudo.

**Cache de tradução (compartilhado)**

```sql
create table if not exists public.translation_cache (
  book_key text not null,
  chapter integer not null,
  chunk integer not null,
  target_lang text not null default 'pt-BR',
  source_hash text not null,
  content jsonb not null,
  provider text not null,
  created_at timestamptz not null default now(),
  primary key (book_key, chapter, chunk, target_lang)
);
```

Só gravar conteúdo público (Gutenberg ou `book_submissions` aprovado). Livro privado do usuário não entra no cache compartilhado.

**Cache genérico de IA**

```sql
create table if not exists public.ai_cache (
  cache_key text primary key,
  kind text not null,
  content jsonb not null,
  model text,
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
```

Chave = hash(`kind` + identificador + `prompt_version`). Versionar o prompt invalida o cache sem apagar dados.

**Novos motivos no extrato**

Estender o `check` de `diamond_ledger` em `supabase/diamonds.sql:37`:

```
'ai_message_pack', 'gift_sent', 'cosmetic', 'ai_translation', 'ai_hint'
```

`apply_diamonds` já é idempotente por `(user_id, reason, ref)`, então cada compra pode usar o ID do pedido como `ref`.

### 8.3 RPCs novas (security definer)

| RPC | Função | Cuidados |
| --- | --- | --- |
| `buy_ai_pack(p_pack)` | Debita diamantes e credita mensagens | Tudo ou nada; `ref` idempotente |
| `consume_ai_message(p_ref)` | Consome 1 crédito ou 1 cota gratuita | Trava a linha; sem saldo → erro claro |
| `send_gift(p_to, p_gift, p_ref)` | Debita diamantes e grava o presente | Limite diário, idade da conta, não transferível |
| `buy_cosmetic(p_item, p_ref)` | Debita diamantes e ativa cosmético | Idempotente |
| `spend_ai_translation(p_chars, p_ref)` | Cobra tradução premium | Só se o cache falhar |
| `my_ai_quota()` | Devolve uso e restante do dia | Somente `authenticated` |

Todas seguem o padrão de `diamonds.sql`: `security definer`, `search_path = public`, `revoke` de `public/anon`, `grant` só para `authenticated`, e nunca expõem escrita direta nas tabelas.

### 8.4 API (repositório Spring Boot)

**Alterar**

- `POST /api/v1/ai/reply`
  - Exigir autenticação (já exige).
  - Ignorar/remover `system` arbitrário do cliente; montar prompt no servidor a partir de IDs (livro/cenário/personagem).
  - Limitar `maxTokens` (≤ 300), histórico (10), caracteres de entrada e concorrência.
  - Checar cota diária e créditos antes de chamar o provedor.
  - Devolver `remaining` e código estável (`AI_QUOTA_EXHAUSTED`, `AI_BUDGET_EXHAUSTED`).
  - Timeout e cancelamento.

**Criar**

- `POST /api/v1/ai/translate` — `{ bookKey, chapter, chunk, paragraphs[] }`; consulta cache, traduz só o que falta, grava e devolve. Teto de caracteres por pedido (ex.: 2.500) e por dia.
- `POST /api/v1/ai/hint` — `{ bookKey, chapter, progress }`; lê do cache; gera e grava se não existir.
- `POST /api/v1/lore/scenarios` — cria cenário privado.
- `POST /api/v1/lore/scenarios/{id}/submit` — envia para curadoria.
- `POST /api/v1/lore/scenarios/{id}/cast` — gera o elenco **uma vez** e grava.
- `POST /api/v1/ai/reply` com `scenarioId` — servidor carrega cenário aprovado e monta o prompt.
- `GET /api/v1/ai/quota` — uso do dia e restante (para a UI).

**Ordem interna de tentativa**

```
cache → self-host (se configurado) → free tier → modelo pago (só se crédito/BYOK) → erro claro
```

### 8.5 Frontend

| Arquivo | Mudança |
| --- | --- |
| `src/lib/usageLimit.ts` | Deixa de ser fonte da verdade; passa a exibir o restante vindo do servidor. Manter contador local só como otimização. |
| `src/lib/ai.ts` | Novos parâmetros (`scenarioId`, `bookKey`), leitura de `remaining`, tratamento de 402/429 e modo economia. |
| `src/lib/translate.ts` | Manter o caminho gratuito; adicionar `translateWithContext()` usando o endpoint com cache. |
| `src/lib/cast.ts` | Passar a usar o elenco aprovado/armazenado no servidor para livros da comunidade e cenários. |
| `src/lib/diamonds.ts` | Novos rótulos de extrato e chamadas de compra. |
| `src/lib/lore.ts` (novo) | CRUD de cenários, submissão e chat por ID. |
| `src/lib/gifts.ts` (novo) | Catálogo, envio e recebidos. |
| `src/App.tsx` | Loja (pacotes, presentes, cosméticos), seletor de tradução contextual e tela de Lore. |

**Importante:** a UI de "mensagens restantes" precisa mostrar o valor do servidor. O contador local pode continuar para resposta instantânea, mas o servidor corrige na próxima chamada.

### 8.6 Cache e invalidação

- **Tradução:** chave `(book_key, chapter, chunk, target_lang)` + `source_hash`. Se o texto mudar, o hash muda e a entrada antiga é ignorada.
- **Elenco:** chave `cast:{bookKey}` ou `cast:{scenarioId}` + `prompt_version`.
- **Dica:** chave `hint:{bookKey}:{chapter}` + `prompt_version`.
- **Prompt version:** constante no código; subir a versão invalida tudo sem migration.
- **Hit counter:** incrementar de forma assíncrona/batch para não virar gargalo.

### 8.7 Segurança e abuso

- Prompt do sistema sempre montado no servidor para features públicas.
- Conteúdo de livro/cenário tratado como **dado**, nunca como instrução.
- Limite por conta, por IP e global; cadastro com verificação de e-mail.
- Idade mínima e limite diário para presentes.
- Não logar conteúdo de conversa; logar apenas tokens, latência e códigos.
- BYOK: preferir armazenar só no navegador; se persistir no servidor, criptografar e nunca expor em logs/telemetria.
- Moderação de cenários e denúncia de conteúdo.
- Termos de uso e política de privacidade atualizados antes do Lore público.

### 8.8 Observabilidade

- Métricas por feature: chamadas, tokens, cache hit/miss, fallback, custo estimado.
- Alerta diário quando o consumo global passar de 80% do orçamento.
- Dashboard simples: custo/dia, custo/MAU, top consumidores, taxa de erro por provedor.
- Log de auditoria para compras e presentes (quem, o quê, quando, `ref`).

### 8.9 Testes

- Cota: não passa do limite; concorrência não fura; crédito é idempotente.
- Compras: debitar e creditar em transação única; saldo nunca negativo.
- Presentes: não transfere diamantes; limite diário; conta nova bloqueada.
- Cache: segunda chamada não bate no provedor; mudança de texto invalida.
- Lore: cenário público não aceita `system` do cliente; rejeitado não aparece.
- Fallback: provedor fora → modo economia → resposta clara, sem 500 genérico.
- Segurança: tentativa de prompt injection no conteúdo não altera regras do sistema.

### 8.10 Ordem de migration

1. `ai_daily_usage` / extensão da tabela existente + RPCs de cota.
2. `ai_credits` + `ai_credit_ledger` + compra/consumo.
3. `gift_catalog` + `user_gifts` + RPC de envio.
4. `translation_cache` + endpoint.
5. `lore_scenarios` + curadoria.
6. `ai_cache` para dicas/elenco.
7. Ajuste do `check` de `diamond_ledger` e grants.

Cada migration deve ser idempotente e testada em banco isolado antes de produção, seguindo o processo do `MARCO3_CORTE.md`.

---

## 9. Decisões pendentes

1. **Limite gratuito diário:** decidido em 20/10/2026: configurável por `AI_DAILY_MESSAGE_LIMIT`, com padrão 50. Calibrar pelas métricas antes de vender o excedente.
2. **Preço dos pacotes:** quantos diamantes por quantas mensagens? (Recomendação: começar generoso e ajustar pela razão gasto/emitido.)
3. **Presentes:** decidido em 20/10/2026: catálogo inicial de 4 itens (flor 5, coração 10, coroa 25, troféu 50); item exclusivo de ranking fica para depois.
4. **Lore público:** aceitar apenas universos originais? (Recomendação: sim.)
5. **BYOK:** será oferecido já na Fase 2 ou só quando houver demanda?
6. **Avatar:** procedural agora e IA só com receita? (Recomendação: sim.)
7. **Self-host:** reservar RAM/CPU do VPS para LibreTranslate/Piper ou usar provedor free até o limite?
8. **Voz:** `speechSynthesis` é suficiente para o primeiro ano? (Recomendação: sim.)

---

## 10. Recomendação final

Aprovar **Fase 0 e Fase 1** agora: são as de melhor relação impacto/custo e resolvem o problema mais visível (diamante inútil e ranking pouco social). A Fase 2 só entra depois da cota no servidor. Tradução e Lore são os próximos diferenciais, mas exigem cache e curadoria. Avatar por IA e voz premium ficam para quando houver receita ou BYOK.

O princípio que deve guiar todas as decisões: **o app pode oferecer IA sem pagar por ela enquanto for pequeno, desde que o caminho padrão seja cacheado, pré-gerado ou gratuito — e o caminho pago seja opcional, limitado e financiado por quem consome.**
