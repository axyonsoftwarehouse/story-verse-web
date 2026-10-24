# Relatório — bloco importação, conta e PWA

- **Data:** 23/10/2026, ~23h–23h40 (HPBA)
- **Alvo:** https://qa.storyverse.2.29.42.104.sslip.io — conta `qa-leitor`
- **Arquivos reais testados:** 3 EPUBs + 1 PDF fornecidos pelo Werner
- **Evidências:** `qa-runs/2026-10-23-nivel2b/evidencias/` (18 prints)

## Importação — 4 de 4 arquivos reais importados

| Arquivo | Tipo | Parsing | Resultado |
|---|---|---|---|
| A Estrada - Cormac McCarthy | EPUB 219 KB | rápido | ✅ 13 partes, capa do EPUB, texto de McCarthy íntegro |
| The Web Designer's Idea Book, Vol. 2 | PDF 25,1 MB | **10,8 s** | ✅ 9 partes, capa do PDF, texto extraído ("THE WEB DESIGNER'S IDEA BOOK…") |
| Coelho maldito - Bora Chung | EPUB 1,7 MB | 1,0 s | ✅ 12 partes — ⚠️ **título do cap. 1 mutilado** (ver defeito) |
| A Queda de Hyperion - Dan Simmons | EPUB 1,3 MB | 1,7 s | ✅ 54 partes, capítulos numerados corretos |

O painel informa o número de partes ("13 partes encontradas"), usa a capa embutida e preenche o título
a partir dos metadados. O 25 MB passou sem travar a interface e sem mensagem de limite.

## Defeito encontrado na importação

### QA-02 · Médio · conteúdo — o importador de EPUB come a 1ª letra de capítulos que começam com C/I/V/X/L

**Onde:** sumário e cabeçalho do leitor de qualquer EPUB importado.
**Observado:** o conto "Coelho maldito" aparece como **"Capítulo 1: oelho maldito"** (o TOC do EPUB diz
"Coelho maldito").
**Causa:** `src/lib/importBook.ts:232`, em `chapterSubtitle()`:

```js
.replace(/^[\dIVXLC]+\s*[.:—–-]?\s*/, "")
```

A classe `[\dIVXLC]` existe para tirar numeração romana, mas aceita o separador como **opcional** —
então come qualquer palavra que comece com essas letras. Rodando a mesma regex no repo:

```
"Coelho maldito" -> "oelho maldito"     "Xerife"         -> "erife"
"Iracema"        -> "racema"            "Cidade de Deus" -> "idade de Deus"
"Vidas Secas"    -> "idas Secas"        "IV. A chegada"  -> "A chegada" (caso correto)
```

**Sugestão:** exigir separador (`.`, `)`, `:`, `—`, `-`) depois do número e deixar romano só quando
seguido de pontuação; número arábico solto continua aceito com espaço.

**Print:** `17-coelho-importado.png`. Cartão no Trello: **7gx0Jc7f**.

## Conta e PWA

| ID | Cenário | Resultado |
|---|---|---|
| A-01 | Cadastro: validação do formulário | ✅ campo vazio e e-mail sem `@` barrados |
| A-04 | `/redefinir-senha` com token inválido | ⚠️ mostra o formulário sem avisar (NB-08) |
| P-02 | Recarregar offline | ⚠️ abre do cache e mantém sessão, sem indicador de offline (NB-07) |

## Observações

- **NB-07 · Baixo · UX** — sem indicador de modo offline. Cartão: **PIvHLred**.
- **NB-08 · Baixo · UX** — reset de senha não valida o token antes de pedir a senha. Cartão: **CZbhGHx3**.
- **Observação de leitura** — `A Estrada` vem com o capítulo 1 dividido em 9 partes e o sumário mostra
  "Capítulo 1 (1/9)"…"(9/9)". É a divisão por tamanho do importador, não perda de conteúdo; só fica
  verboso no sumário.

## Limites desta rodada

- **Criar conta de verdade** exige digitar senha — fora da política do agente. Só a validação foi testada.
- **Upload pelo diálogo do sistema** não existe no navegador automatizado. O arquivo foi entregue ao
  input via CDP (`DOM.setFileInputFiles`) apontando para a aba correta (com `switch_tab` para obter a
  sessão); sem isso o comando não fixa o arquivo e parece que o app ignora o upload.

## Estado do QA depois da rodada

`qa-leitor` ficou com **4 livros importados** (A Estrada, The Web Designer's Idea Book Vol. 2, Coelho
maldito, A Queda de Hyperion) + o "Livro de Teste QA" de antes. Para limpar: estante → "Remover" em
cada um, ou `bash reset-qa.sh`.
