# Arquitetura do Storyverse

## Escopo deste repositório

Este repositório contém só o frontend web (React, TypeScript e Vite; `npm run dev` / `npm run build`). A API Java/Spring Boot é um projeto separado, com repositório, build e deploy próprios. Não traga fontes do backend para cá nem compartilhe classes compiladas ou dependências.

## Limite com o backend

- Quando integrado, o frontend deve acessar o backend exclusivamente pela API HTTP versionada em `/api/v1/**`.
- O backend não importa, lê ou executa arquivos do frontend; o único contrato compartilhado é JSON/HTTP, documentado junto à API.
- O backend é dono das regras de negócio do servidor e dos adaptadores de provedores que forem migrados para ele.
- O frontend continua dono da apresentação e das capacidades locais do navegador, como leitura de arquivos importados, IndexedDB, progresso local, voz e instalação PWA.
- Autenticacao e identidade usam a API propria (Spring Boot + Postgres) na VPS. Nao ha Supabase no caminho de producao.
- Dados locais do leitor não devem ser enviados ao backend sem uma funcionalidade que exija isso e uma decisão explícita de persistência e privacidade.
- Credenciais privadas de provedores só podem existir no ambiente do servidor; nunca devem usar variáveis `VITE_*`, ser incluídas no bundle ou enviadas ao navegador. Qualquer valor `VITE_*` é entregue ao navegador e não é segredo.

## Estado da integracao

Producao VPS-only: o frontend usa `VITE_API_URL` para contas, sincronizacao, comunidade, ranking, presenca e IA. O Supabase nao faz parte do build de producao. Chaves de IA, SMTP e banco ficam somente no servidor.

## Desenvolvimento e validação

1. Na raiz, `npm run dev`, `npm run lint`, `npm test` e `npm run build` (a CI roda os três últimos).
2. Integração local: quando o frontend passar a consumir a API, configure `APP_CORS_ALLOWED_ORIGINS` no backend para a origem exata do frontend; não use curingas com credenciais.
