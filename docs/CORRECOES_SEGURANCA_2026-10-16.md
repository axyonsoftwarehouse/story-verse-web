# Correções de segurança — 16/10/2026

Implementação nos repositórios web e API. Não aplicada à VPS nesta etapa. Os relatórios de revisão anteriores permanecem como registro do estado auditado, não como descrição do código corrigido.

## Alterações

- Sessões: refresh de uso único sob lock PostgreSQL; hashes antigos mantidos por prazo limitado para o logout localizar a sessão mesmo após rotação. O navegador serializa renovações entre abas e não restaura uma sessão encerrada por uma resposta atrasada.
- Contas no aparelho: dados pessoais em namespaces por conta, dono ativo por aba, migração do formato antigo preservando a origem e tela bloqueada se a ativação falhar. Sincronização e respostas do chat descartam operações de uma conta/leitura anterior.
- Arquivos: autenticação antes da leitura do corpo, limites de entrada, quota por conta sob lock entre instâncias, reserva mínima de espaço e substituição atômica de arquivos. Textos submetidos à comunidade ficam imutáveis; aprovação e mutações de arquivo coordenam locks. Leitura distingue dono, administrador e obra aprovada. Exclusão de submissões usa lock de linha antes de autorizar.
- Economia: totais declarados pelo cliente deixam de adicionar minutos no servidor. O leitor envia heartbeats e o banco credita somente intervalos recentes de tempo real, serializados por conta; não aceita crédito retroativo, para amanhã ou multiplicado por várias abas. Fechamento semanal e crédito usam o mesmo lock.
- Abuso: limites de frequência, conexões SSE finitas e limitadas, orçamento diário persistente de IA, limite de concorrência, validação de mensagens e modelos padrão quando a configuração está vazia.
- Banco: migrations separadas da credencial de runtime; papel `storyverse_api` sem superuser/bypass/DDL, acesso por RLS para leitura/comunidade e sem escrita direta em carteiras. Funções internas de economia continuam fora da lista de RPC.
- Diagnósticos: remoção de query/fragmento de URLs e redação de credenciais, inclusive eventos antigos restaurados.
- Importação e dependências: EPUB descomprimido em fluxo com teto por entrada, total e quantidade de arquivos, contando a saída real; Vite/Vitest/plugin React/PDF.js e versões gerenciadas Jackson/Tomcat atualizadas. PDF sem avaliação dinâmica de código.
- Publicação: build rejeita loopback/configuração ausente e chaves privadas de IA; workflow VPS aponta para a API própria. Host SSH deve ser fixado em `VPS_KNOWN_HOSTS`; imagem da API publicada por SHA. Readiness consulta o banco. Compose limita CPU/memória; Caddy limita upload e adiciona cabeçalhos básicos.

## Efeitos de negócio e limites

- Leitura offline continua disponível e contabilizada no aparelho, mas não é convertida retroativamente em minutos de ranking ou diamantes. O servidor não tem como comprovar esse tempo. Heartbeat limita o crédito ao tempo transcorrido; não comprova atenção humana e não substitui detecção de bots.
- Registros antigos de minutos e diamantes não são apagados ou estornados automaticamente. Eventuais dados manipulados antes da correção exigem uma decisão de saneamento separada, para não remover histórico legítimo.
- Os limites por IP/conta de autenticação são locais à instância, com memória limitada. O orçamento diário de IA e a quota de arquivos são coordenados no banco. Ao escalar horizontalmente, o rate limiting de borda deve ser centralizado.
- Os arquivos e seus backups continuam sendo dados sensíveis. Não foi configurado destino externo de backup, pois não há um destino/credencial validado disponível.
- Não foi implementado um serviço de e-mail novo. Cadastro continua sem confirmação; promoção administrativa deve usar UUID cuja titularidade foi verificada, nunca somente e-mail informado pelo usuário.

## Validação

Os testes de integração usam um Postgres 16 descartável local e dados fictícios; nunca a base de produção. Cobrem rotação concorrente, logout com token rotacionado, exclusão concorrente à aprovação, leitura entre contas, imutabilidade, uploads concorrentes, RLS do papel de runtime e relógio de leitura. A CI passa a iniciar seu próprio Postgres e executar a mesma suíte.

Frontend: testes de migração/isolamento de contas, quota, credenciais em diagnóstico, refresh atrasado e limites de ZIP (incluindo tamanho forjado no cabeçalho). Build validado com `VITE_API_URL=https://api.storyverse.2.29.42.104.sslip.io`; um build com as antigas variáveis de loopback deve falhar deliberadamente.

Execução local da API usa JDK 21 com override de invocação; a configuração de CI/produção permanece JDK 25. Conferir os resultados finais no chat desta alteração.

## Aplicação em produção

Esta é uma migração coordenada entre dois repositórios e credenciais de banco. Não publicar apenas o frontend: isso conectaria usuários à API antes de suas regras e arquivos estarem atualizados.

1. Confirmar qual ambiente contém as contas e dados que devem ser preservados. O site VPS auditado apontava para Supabase local; isso não demonstra que os dados de outro endereço já estejam no Postgres VPS.
2. Em uma janela de manutenção, registrar IDs das imagens e copiar Compose, Caddyfile e `.env` para um diretório protegido fora do repositório. Encerrar a API graciosamente e executar `bash deploy/backup.sh`. Copiar banco e media para armazenamento externo e testar restauração em banco/volume isolados antes do corte. Não restaurar diretamente sobre produção para testar.
3. Aplicar migrations V2–V4 pela credencial administrativa. O schema base não deve ser reaplicado por cima das migrations: ele é bootstrap para instalações novas. `database/reading-clock.sql` e `supabase/security-hardening.sql` são para os caminhos correspondentes, não ambos no mesmo ambiente.
4. Definir uma senha forte para `storyverse_api` via `\password storyverse_api` no psql, sem colocá-la em comando/histórico. Configurar `API_DB_PASSWORD` no `.env` protegido. A API passa a usar essa credencial; `SPRING_FLYWAY_*` usa a credencial administrativa exclusivamente para migrations.
5. Definir `API_IMAGE` com o SHA/digest da release corrigida, instalar o Compose revisado e conferir `docker compose config --quiet`, sem imprimir o ambiente resolvido. Configurar `VPS_KNOWN_HOSTS` nos dois repositórios com a chave SSH verificada por canal confiável.
6. Subir primeiro a API. Conferir `/api/v1/health/ready`, autenticação, leitura/sincronização de duas contas e fluxo de submissão/aprovação. O bootstrap de migrations deve concluir antes desses checks.
7. Publicar o frontend corrigido e ativar o Caddy revisado depois de validar sua configuração. A VPS passa a usar a API própria. Chaves de IA ficam somente no servidor; habilitá-las depois de conferir o orçamento persistente e os limites.
8. Registrar o artefato anterior como rollback e agendar backups com cópia externa/alerta de falha. Um rollback para a API anterior também exige restaurar a configuração anterior de credenciais: a versão antiga não estabelece o contexto RLS em todos os serviços. Não assumir compatibilidade do binário antigo com o novo papel de runtime.

Os workflows exigem `VPS_KNOWN_HOSTS` e a infraestrutura preparada; falham se esses pré-requisitos não estiverem prontos. A aplicação das migrations e a troca das credenciais em produção permanecem uma etapa de implantação, sem alterar dados reais durante o desenvolvimento.
