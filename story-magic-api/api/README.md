# Story Magic API

API Spring Boot do Story Magic. Ela é um módulo separado e não requer mudanças no frontend.

## Organização

- `catalog/api`: endpoints REST e formato de resposta do catálogo.
- `catalog/application`: regras de busca do catálogo.
- `catalog/domain`: modelo de livro independente do formato HTTP.
- `catalog/infrastructure`: fonte atual dos livros em memória, substituível por banco de dados futuramente.
- `integrations/gutenberg`: adaptador HTTP para obter textos públicos do Project Gutenberg, com timeout e espelho de contingência.
- `integrations/openlibrary`: cliente HTTP para busca de metadados públicos e capas da Open Library.
- `common/api`: conversão de erros de negócio e de integração para respostas HTTP padronizadas.
- `system/api`: endpoints operacionais, como verificação de saúde.
- `config`: configuração HTTP, incluindo CORS para o frontend local.
- `ApiApplication.java`: inicialização do Spring Boot.

## Executar no IntelliJ IDEA

Importe `api\pom.xml` como projeto Maven e aguarde o IntelliJ carregar as dependências. Se a API já estiver aberta como projeto, use **Reload All Maven Projects**. Configure o Project SDK para Java 25 ou superior. A classe principal correta é:

```text
com.story_magic.api.ApiApplication
```

Abra `src\main\java\com\story_magic\api\ApiApplication.java` e clique no triângulo verde ao lado de `main` → **Run 'ApiApplication.main()'**. O POM direciona as classes compiladas para `%USERPROFILE%\.story-magic-build\api`, evitando falhas de carregamento causadas por caracteres especiais no caminho da pasta. Para validar os testes pelo IntelliJ, clique com o botão direito em `ApiApplicationTests.java` → **Run**.

## Verificar

Com o servidor iniciado, abra:

```text
http://localhost:8080/api/v1/health
```

A resposta inclui `status: "ok"` e um timestamp. A porta padrão `8080` pode ser alterada com a variável `PORT`.

## Catálogo de livros

- `GET /api/v1/books`: lista o catálogo.
- `GET /api/v1/books?q=iracema`: busca sem diferenciar maiúsculas/minúsculas por título, autor, gênero ou sinopse.
- `GET /api/v1/books/gb-67740`: consulta um livro pelo identificador; retorna `404` se não existir.
- `GET /api/v1/books/gb-67740/content`: obtém o texto público integral do livro no Project Gutenberg. Responde como `text/plain; charset=UTF-8`, remove as marcações de licença do Gutenberg e tenta o espelho oficial se o site principal falhar.
- `GET /api/v1/external-books?q=crepusculo`: pesquisa metadados/capas na Open Library para livros fora do catálogo local. Retorna até seis sugestões; prioriza edição em português e mantém as regras de ano, número de edições e relevância que antes estavam no frontend.

A resposta é uma lista JSON com `id`, `gutenbergId`, `title`, `author`, `genre`, `blurb`, `coverUrl`, `textLanguage` e `shelf`. Os identificadores e campos principais seguem o formato de `Ebook` usado pelo frontend. O catálogo desta primeira etapa fica em memória, então os dados de demonstração voltam ao padrão quando a API reinicia.

O CORS permite por padrão `http://localhost:5173` e `http://127.0.0.1:5173`. Configure `CORS_ALLOWED_ORIGINS` com uma lista separada por vírgulas ao usar outros endereços.

Erros seguem o formato `application/problem+json`, com título, detalhe, status HTTP e timestamp. Falhas em provedores externos retornam `502`; timeout retorna `504`; consultas inválidas retornam `400`. O endpoint de texto aceita somente IDs presentes no catálogo da API.

Esta versão fornece uma base REST somente de leitura: ainda não há persistência, endpoints de conta/login, nem conexão do frontend com a API. O login continua sob responsabilidade do Supabase; não se deve enviar chaves privadas de provedores externos ao aplicativo.

## Testes
Também é possível executar a meta Maven `test` pela janela **Maven** do IntelliJ.
