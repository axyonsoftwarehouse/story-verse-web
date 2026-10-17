# Revisão da API e da produção — 16/10/2026

Complementa [a revisão do frontend](REVISAO_SEGURANCA_2026-10-16.md). Nenhuma correção foi aplicada nesta etapa.

## Escopo e método

- Código de `C:/Users/werne/WebstormProjects/story-verse-api`, revisão local `cc263dae5ecb0bd2eb763d7a024fa8b9d4f71ca5`.
- VPS `production-01`, site `https://storyverse.2.29.42.104.sslip.io` e API `https://api.storyverse.2.29.42.104.sslip.io`.
- Consulta SSH de contêineres, ambiente filtrado, configuração ativa do Caddy, firewall, listeners e agendamentos. Banco consultado em transações READ ONLY: metadados, privilégios, policies e definições de funções. Nenhuma conta, sessão ou livro foi criado ou alterado em produção; não foram executados testes de carga.
- JAR em execução consultado para identificar versões reais. Não foram exportados hashes de senhas, tokens de usuários, chaves privadas ou conteúdo pessoal.
- Testes existentes executados localmente e reproduções isoladas com dados fictícios. As reproduções não equivalem a ataques executados contra produção.
- Vercel, um eventual Supabase remoto e painel Hetzner não foram auditados. O site da VPS foi o ambiente de publicação identificado e acessível; não se presume que seja o único endereço usado pelos usuários.

P1: prioridade alta antes de ampliar uso/migração. P2: próximo ciclo. A severidade considera o cenário descrito; um risco de configuração não significa que uma invasão tenha ocorrido.

## Configuração efetiva observada

Consultas em 16/10/2026, aproximadamente 08:10–08:20 em America/Fortaleza.

| Item | Evidência observada |
| --- | --- |
| Site VPS | HTTP 200; bundle principal `index-X4RdggJp.js` |
| Destino de autenticação no bundle | `VITE_SUPABASE_URL=http://127.0.0.1:54421`; `VITE_API_URL` vazio |
| IA no bundle | Variáveis Groq/Gemini/OpenRouter vazias; busca por formatos conhecidos de tokens não encontrou chaves privadas |
| API | `/api/v1/health` HTTP 200; `/api/v1/auth/me` sem token HTTP 401 |
| IA no servidor | `/api/v1/ai/status` devolve `live=false`, `providers=0`; três chaves ausentes no ambiente do contêiner |
| Modelos no servidor | `GROQ_MODELS`, `GEMINI_MODEL`, `OPENROUTER_MODELS` definidos como strings vazias |
| Imagem da API | `ghcr.io/axyonsoftwarehouse/story-verse-api:latest`; ID `sha256:c081fcbf8eb82beb7768987291c4a90387438a9513c344248b6394d52e4f6485` |
| Runtime da API | Usuário `10001:10001`; JAR construído com JDK 25, Spring Boot 4.1.1 |
| Bibliotecas relevantes | Spring Framework 7.0.9; Security Crypto 7.1.1; Tomcat 11.0.24; Jackson core/databind 3.1.5; PostgreSQL JDBC 42.7.13; Flyway 12.4.0 |
| Banco | Postgres 16 Alpine; conexão da API como `storyverse`; papel com `rolsuper=true`, `rolbypassrls=true` |
| RLS | Ativo nas tabelas de leitura/comunidade/economia, sem FORCE; sessões e usuários sem RLS |
| Funções internas | `apply_diamonds`, `close_reading_week`, `ranking_for_week` com EXECUTE somente para o dono nos grants consultados |
| Rede | API e banco sem portas publicadas no host; portas TCP externas em escuta: 22, 80 e 443 |
| Firewall | UFW ativo, liberando SSH, 80 e 443 em IPv4/IPv6 |
| Borda | Configuração ativa do Caddy consultada em `127.0.0.1:2019` dentro do contêiner; API encaminhada para `storyverse-api-1:8080` |
| CORS | Origem permitida: apenas o site VPS acima |
| Recursos | API e banco sem limite Docker de memória/CPU; disco raiz de 38 GB compartilhado, com cerca de 19 GB livres no instante da consulta |
| Migrations | Flyway baseline 0 e migração 1 com sucesso |

Deploy da API com sucesso associado ao commit local: [execução 38820346032](https://github.com/axyonsoftwarehouse/story-verse-api/actions/runs/38820346032). Último deploy web consultado: [execução 38820593750](https://github.com/axyonsoftwarehouse/story-verse-web/actions/runs/38820593750), commit `c2c95f73d4caa254240776c3470b7d707420f653`. A imagem não contém rótulo de commit: a correlação com o deploy não substitui uma identificação imutável do código no artefato.

## 1. P1 — Site publicado aponta autenticação para o aparelho do visitante

**Confirmado no bundle efetivamente servido pela VPS.** A URL do Supabase é `http://127.0.0.1:54421`, enquanto `VITE_API_URL` está vazio. O frontend entra no caminho Supabase, mas cada visitante acessa o próprio loopback. Em um aparelho comum sem esse serviço local, login/cadastro e serviços dependentes não funcionam. O health da API pode continuar verde porque o site não está conectado a ela.

Referências: frontend `src/lib/backend.ts:7`, `src/lib/auth.ts:12`, `.github/workflows/deploy-storyverse.yml:38` e `:41`. Evidência operacional: bundle `index-X4RdggJp.js` em `/home/deploy/storyverse/web/current/assets`.

Correção proposta: decidir explicitamente qual backend esta publicação usa e fornecer a URL correta no build. Rejeitar builds de produção com loopback ou combinação de variáveis incompleta e testar login/sincronização no endereço publicado. Apontar para a API própria exige primeiro resolver as lacunas funcionais abaixo e planejar a migração de contas/dados.

## 2. P1 — Upload é recebido integralmente antes de autenticar e limitar tamanho

Referências API: `storage/StorageController.java:39`, `storage/StorageController.java:40`, `storage/StorageService.java:37`. Caminhos relativos a `src/main/java/com/storyverse/api/`.

`@RequestBody byte[]` materializa o corpo antes de entrar no método que autentica. A validação de tamanho está ainda depois, no serviço. A configuração ativa do Caddy não tem limite de corpo para essa rota e não há filtro de autenticação anterior ao binding. Um cliente sem sessão pode provocar alocação de corpos grandes, mesmo que a resposta final seja 401. O teto de 50 MB do bucket não é um teto de leitura HTTP.

Verificado por código e configuração ativa, sem enviar cargas grandes. O `maxPostSize` padrão do Tomcat não é limite geral de corpo binário/JSON, conforme a [documentação oficial](https://tomcat.apache.org/tomcat-11.0-doc/config/http.html).

Correção proposta: rejeitar autenticação antes de ler o corpo, impor limite real na borda e na leitura do stream, inclusive para transferências sem Content-Length, e evitar carregar arquivos inteiros em memória. Definir limites de memória/CPU do contêiner para reduzir impacto no restante da VPS.

## 3. P1 — Login e cadastro públicos sem controle de tentativas

Referências API: `auth/AuthController.java:24`, `auth/AuthController.java:29`, `auth/AuthService.java:33`, `auth/AuthService.java:49`.

Não há rate limiter, bloqueio progressivo ou controle de frequência por IP/conta no código nem na configuração ativa do Caddy. A API está publicamente acessível, mesmo com o frontend desconectado. Isso permite tentativas repetidas de senha, criação automatizada de contas e consumo de CPU com BCrypt. A senha mínima é de seis caracteres e o cadastro já emite sessão sem comprovação do e-mail, ampliando o risco de abuso.

Verificado por leitura, sem força bruta em produção. CORS não protege contra clientes que chamam a API diretamente.

Correção proposta: limites por IP e identificador de conta, atraso progressivo com resposta 429, métricas de abuso e política explícita de criação/validação de contas. Evitar bloqueio permanente que terceiros possam usar contra vítimas.

## 4. P1 — Limite por arquivo não impede esgotar o disco compartilhado

Referências API: `storage/StorageService.java:29`, `storage/StorageService.java:44`, `storage/StorageBucket.java`. Infra: `deploy/storyverse/docker-compose.yml` do frontend.

O serviço limita cada arquivo, mas não o total de bytes, quantidade de objetos ou frequência por conta. Cada sessão pode criar caminhos novos continuamente. O volume media reside no mesmo disco da VPS e não tem quota demonstrada; no instante consultado havia cerca de 19 GB livres. Preencher o disco pode atingir o Postgres e os outros serviços hospedados na máquina.

Verificado por código e montagem efetiva, sem preencher o armazenamento. Cadastro aberto sem limites facilita criar novas identidades para contornar uma eventual proteção só no cliente.

Correção proposta: quota atômica de bytes e objetos por conta, limite de frequência, reserva de capacidade e alertas de disco; separar o armazenamento quando necessário. Os objetos devem entrar nessa contabilidade antes da gravação para que requisições paralelas não excedam a quota.

## 5. P1 — Leitores e administradores não conseguem ler textos de outros autores

Referências API: `storage/StorageController.java:51`, `storage/StorageController.java:52`, `storage/StorageService.java:73`. Frontend: `src/lib/community.ts:466`.

O download de qualquer bucket exige que `path` comece com o UUID do próprio usuário, sem consultar se o livro foi aprovado ou se o leitor é administrador. Assim, um livro de A aparece no catálogo de B, mas o texto retorna 403. O administrador também não consegue ler o arquivo de A para avaliar o envio. A rota pública aceita apenas profile-media.

Reprodução isolada com o serviço real: caminho de A, leitor B, resultado 403. A ausência de exceção para status/admin foi conferida no controller; não foram usadas contas reais.

Correção proposta: implementar a regra específica de community-books — dono, administrador e leitor autorizado de uma submissão aprovada — mantendo user-books estritamente privado. Testar aprovação, leitura por outro usuário e recusa de arquivos pendentes.

## 6. P1 — Autor pode substituir ou apagar o texto depois da aprovação

Referências API: `storage/StorageService.java:44`, `storage/StorageService.java:64`, `storage/StorageController.java:63`.

Upload sempre usa TRUNCATE_EXISTING e DELETE exige apenas a pasta do dono. Nenhuma operação consulta o status de book_submissions. Depois de aprovar um texto, o autor pode substituir o mesmo caminho por outro conteúdo sem nova revisão, ou apagá-lo e quebrar o acervo. A regra do Supabase que impede apagar objetos aprovados não foi transportada para a API.

Reprodução isolada: duas gravações no mesmo caminho retornam o conteúdo da segunda. O serviço não recebe nem verifica aprovação, logo esse comportamento também vale para caminhos vinculados a envios aprovados. O bloqueio de leitura do achado 5 hoje limita o alcance a outros leitores; corrigir somente a leitura expõe o bypass de moderação.

Correção proposta: publicar uma versão imutável ou impedir escrita/exclusão de objetos aprovados; alteração deve gerar nova versão pendente. Coordenar a publicação de metadados e arquivo para evitar condições de corrida.

## 7. P1 — Credencial da aplicação é superusuário do Postgres

Referências: frontend `deploy/storyverse/docker-compose.yml:32`; API `common/DbSession.java`; comentário inicial de `community/CommunityService.java`.

**Confirmado no banco em produção:** `storyverse` tem superuser e bypass RLS. A API usa esse mesmo papel. `DbSession` define app.user_id, mas não reduz o papel; as policies não restringem as consultas da aplicação. Uma falha futura de autorização, injeção ou comprometimento da API teria alcance sobre todo o banco, incluindo contas, sessões e economia.

Não foi encontrada uma injeção SQL explorável nas consultas revisadas; há parâmetros preparados e uma lista branca de RPC. Este achado é de privilégio excessivo e ausência de defesa adicional, não comprovação de acesso público irrestrito ao banco.

Correção proposta: separar credencial de migrations/admin da credencial de runtime, retirar superuser/bypass, conceder somente operações necessárias e decidir quais controles ficam em RLS e quais ficam nos serviços. Testar todos os módulos antes de trocar o papel, pois os serviços atuais presumem bypass.

## 8. P2 — Renovação concorrente aceita o mesmo refresh duas vezes

Referências API: `auth/AuthService.java:63`, `auth/SessionRepository.java:43`, `auth/SessionRepository.java:58`.

A busca pelo hash não trava a linha e rotate atualiza apenas por ID. Duas transações podem ler o mesmo refresh válido e emitir pares diferentes; a última gravação invalida imediatamente os tokens que a outra acabou de devolver. Duas abas renovando juntas podem alternar uma sessão válida por uma já inválida e acabar deslogadas. Uma transação com @Transactional, sozinha, não elimina essa corrida.

Reprodução local do serviço com repositório controlado e duas threads: duas respostas de refresh com sucesso, mas somente um access token devolvido continuou válido. É uma reprodução da intercalação do serviço, não um teste concorrente no Postgres real.

Correção proposta: consumo/rotação atômica condicionado ao hash anterior e estado de revogação, ou lock da linha com revalidação; definir também comportamento de repetição legítima e coordenação entre abas.

## 9. P1 condicional — IA vira proxy de uso irrestrito após configurar chaves

Referências API: `ai/AiController.java:38`, `ai/AiController.java:40`, `ai/AiReplyRequest.java`.

A autenticação é a única barreira. Não há quota diária por conta, limite de frequência/concorrência ou limite de tamanho de cada mensagem. O cliente envia system e histórico arbitrários e pode chamar diretamente até 800 tokens de saída por pedido, fora do limite local de 50 mensagens do frontend. Cadastro aberto facilita abuso de múltiplas contas.

**Situação efetiva:** as chaves estão ausentes e o status informa zero provedores; não há consumo de IA observado. O risco financeiro/consumo de cota se ativa ao configurar um provedor. Não foram realizadas chamadas pagas.

Correção proposta: quota e concorrência no servidor, limites de caracteres/tokens antes da chamada, validação de roles, controle global de custo e cancelamento/timeout compatível com a experiência do cliente. Se o uso deve ser somente literário, montar as instruções no servidor em vez de oferecer prompt arbitrário.

## 10. P2 — Compose anula os modelos padrão da IA

Referências: frontend `deploy/storyverse/docker-compose.yml:38`, `:40`, `:42`; API `ai/AiService.java:51`, `:57`, `:63`, `:195`.

Compose envia variáveis de modelos vazias quando não configuradas. O default de @Value só vale se a variável estiver ausente; string vazia resulta em split sem modelos. Portanto, adicionar somente uma chave, seguindo o comentário de configuração, pode continuar deixando providers=0. As três variáveis vazias foram confirmadas no contêiner atual.

Correção proposta: tratar valor vazio como ausência no serviço ou fornecer defaults no Compose. Adicionar teste de configuração com chave presente e modelos vazios, sem efetuar chamadas externas.

## 11. P2 — Presença pública mantém conexões e estado sem limites

Referências API: `presence/PresenceController.java:25`, `presence/PresenceService.java:23`.

Qualquer cliente pode criar chaves e salas; os emitters têm timeout zero. Não há limite por IP, sala ou total. Cada entrada dispara broadcast para os participantes da sala, além do heartbeat periódico. Muitas conexões persistentes podem esgotar recursos e também falsificar a contagem de leitores. A configuração ativa da borda não adiciona controle específico.

Verificado por leitura; nenhuma abertura em massa de conexões foi executada.

Correção proposta: limites de conexão, tamanho de chave, salas válidas, duração máxima/reconexão controlada e descarte de conexões mortas. Contagens por conta devem usar identidade autenticada quando essa precisão for necessária.

## 12. P2 — Dependências do runtime precisam de atualização de segurança

As versões vieram do JAR em execução, não apenas do pom. Consulta OSV de 19 coordenadas Maven identificadas em pom.properties encontrou sete avisos para Jackson 3.1.5: cinco em databind e dois em core. Essa coleta não cobre todos os JARs, bibliotecas nativas ou imagem do sistema operacional.

Avisos Jackson observados: `GHSA-cxp5-3px4-pw24`, `GHSA-gx83-3vf8-gh7j`, `GHSA-q4xh-88c3-wmh7`, `GHSA-wjgm-6hv5-3cvf`, `GHSA-wv8q-qhhj-9h54`, `GHSA-7hhh-6rmp-j9qf`, `GHSA-p6pp-m3f8-5c89`. As versões corrigidas da linha 3.1 chegam a 3.1.7 para o conjunto consultado. Avisos envolvendo tipos polimórficos, referências de identidade, tipos XML, coerção numérica ou parser DataInput têm condições próprias; não se concluiu que todos sejam alcançáveis pelos DTOs atuais. Exemplo de fonte primária: [aviso de coerção numérica/ReDoS](https://github.com/FasterXML/jackson-core/security/advisories/GHSA-p6pp-m3f8-5c89).

Tomcat 11.0.24 também está atrás das correções 11.0.25/26. O [boletim oficial](https://tomcat.apache.org/security-11.html) lista falhas com condições específicas, como HTTP/2 e WebSocket. A borda observada termina TLS e encaminha a API por HTTP; não se demonstrou exposição das funcionalidades necessárias a cada aviso.

Correção proposta: atualizar o conjunto de dependências gerenciado de forma compatível, repetir testes e realizar varredura completa da imagem/SBOM. Não há evidência nesta revisão de RCE executada ou de que todos os avisos se apliquem funcionalmente ao deploy.

## 13. P2 — Verificação de deploy aceita publicação funcionalmente quebrada

Referências: frontend `deploy/publish.sh`; API `HealthController.java:12`; API `.github/workflows/deploy-api.yml:43`.

O deploy web só exige HTTP 200 da página inicial, e o health da API retorna ok sem consultar o banco ou os serviços essenciais. O bundle apontando para loopback demonstra que o deploy pode passar com autenticação inutilizável. Uma falha de banco posterior à inicialização também não muda a resposta desse health. A imagem usa latest, sem revisão imutável/rótulo de commit, e o fluxo da API não implementa rollback automático.

Correção proposta: preservar liveness simples, acrescentar readiness de dependências e teste funcional da publicação, validar URLs no build e publicar por digest/commit, mantendo versão anterior para rollback. Não é necessário usar uma conta real de usuário nos testes de publicação.

## 14. P2 — Identidade SSH da VPS é confiada dinamicamente no deploy

Referências: frontend `.github/workflows/deploy-storyverse.yml:57`; API `.github/workflows/deploy-api.yml:36`.

Os dois workflows geram known_hosts com ssh-keyscan na própria conexão de deploy, sem comparar uma impressão digital conhecida. Um atacante capaz de interferir no tráfego/DNS nessa etapa pode apresentar uma chave diferente e ser aceito como o servidor. Isso elimina a validação independente da identidade da VPS. Não há evidência de interceptação ocorrida.

Correção proposta: fixar a chave pública/fingerprint obtida por canal confiável e manter StrictHostKeyChecking. Os acessos de auditoria usaram a entrada já conhecida com checagem estrita.

## Pontos adicionais e pendências

- **Backup/restauração não demonstrados:** não havia crontab de deploy/root, timer identificado de backup Storyverse ou referência a pg_dump/restic/borg nos agendamentos consultados. O Compose mostra volumes persistentes, que não substituem backup. Snapshots/backup Hetzner ou rotina externa podem existir e não foram verificados. Antes de migrar dados, confirmar cópias externas do banco e dos arquivos e executar uma restauração isolada. Não se afirma que inexista backup no provedor.
- **Hardening HTTP:** respostas observadas do site não incluem CSP/frame-ancestors, X-Frame-Options, HSTS ou X-Content-Type-Options. A configuração ativa não os adiciona. Planejar os cabeçalhos de acordo com fontes, imagens, proxies e PWA do produto; a ausência sozinha não comprova XSS.
- **Arquivo da submissão:** `community/CommunityService.java:53` também não vincula text_path à pasta do autor nem verifica existência. O problema já descrito no relatório frontend se estende à API, mas o bloqueio atual de leitura impede presumir a mesma exposição pública do caminho Supabase. Corrigir a validação junto da autorização de arquivos.
- **Ranking e diamantes:** a função report_reading instalada na VPS foi consultada e mantém os minutos autodeclarados, teto de 12 h/dia e aceitação de amanhã. A lista branca RpcService expõe essa função a usuários autenticados. Portanto, o achado de manipulação de ranking da primeira revisão também se aplica ao backend próprio instalado; não foram concedidos diamantes de teste em produção.
- **Admin por e-mail:** a API não comprova titularidade do e-mail no cadastro; antes de executar qualquer bootstrap que promova admin por e-mail normalizado, validar explicitamente a identidade e preferir UUID aprovado. Não foi testada criação de contas administrativas.
- **Vercel/Supabase remoto:** não há URL de produção externa confirmada nesta inspeção; não foram verificados SMTP, confirmação de e-mail, redirects, policies ou backups de um eventual projeto Supabase remoto. O bundle VPS usa um endereço local.
- **Cobertura dos testes:** H2 sem Flyway e sem execução das regras PostgreSQL de produção. A suíte verifica principalmente status e rejeição sem token; não cobre integração completa entre duas contas, moderação de arquivos, concorrência de refresh ou quotas.

## Validação e limites

- `mvn -B -Djava.version=21 verify`: build e 11 testes passaram. Foi usado JDK 21 disponível localmente, com override de versão somente na invocação; pom e fontes não foram alterados. Isso não é execução local no JDK 25 de produção.
- A [CI Java com JDK 25](https://github.com/axyonsoftwarehouse/story-verse-api/actions/runs/38820169333) do commit revisado estava concluída com sucesso.
- Reprodução isolada preservada em `C:/Users/werne/.codex/visualizations/2026/10/16/01a1445d-a829-79a2-a032-d90061921043/AuditProbe.java`: duas renovações concorrentes devolvem sucesso, somente um token continua válido; StorageService permite sobrescrever texto e requireOwn recusa leitor de outro UUID.
- Conferência de configuração efetiva e metadados em produção realizada sem mudanças. Não foi executado teste de exaustão, força bruta, upload, alteração de ranking ou exploração de CVEs em produção.
- Sem auditoria integral da imagem do sistema operacional, painel do provedor ou serviços externos não identificados. Não há declaração de ausência de outras vulnerabilidades.

## Quadro conjunto e ordem sugerida das correções

1. **Preparar recuperação:** confirmar backup externo e restauração, registrar artefatos atuais e plano de rollback. Definir qual endereço/backend é a produção que deve continuar atendendo usuários.
2. **Conter os riscos já expostos:** tamanho de requisição antes de autenticação, limites de tentativas, quotas de armazenamento/conexões, credencial de banco com privilégio mínimo e atualizações de segurança.
3. **Corrigir isolamento e credenciais no produto:** tokens na telemetria, falha na troca de dono e operações assíncronas atravessando contas, somando os achados da primeira revisão.
4. **Completar contratos da API:** leitura e moderação de arquivos, rotação concorrente, validações e testes PostgreSQL entre duas contas. Não habilitar consumo de IA antes das quotas e configuração de modelos.
5. **Conectar a publicação correta:** remover loopback do build, testar login/leitura/sincronização/moderação no ambiente publicado e só então realizar eventual corte/migração, com readiness e rollback verificáveis.

O ponto central do quadro geral é que há uma API publicamente acessível com controles incompletos, enquanto o site da VPS ainda aponta para um Supabase local. Simplesmente trocar VITE_API_URL agora não resolve as falhas de autorização, contratos e migração identificadas.
