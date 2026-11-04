import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { stripFormatting } from "../../lib/groups";
import { formatDraft, formatMessage } from "./messageFormat";

const html = (text: string) => renderToStaticMarkup(<>{formatMessage(text)}</>);

describe("formatMessage", () => {
  it("negrito, itálico e riscado como no WhatsApp", () => {
    expect(html("isso é *muito* bom")).toBe("isso é <strong>muito</strong> bom");
    expect(html("_calma_, ~spoiler~!")).toBe("<em>calma</em>, <s>spoiler</s>!");
    expect(html("*tudo _junto_*")).toBe("<strong>tudo <em>junto</em></strong>");
  });

  it("não formata no meio de palavras, com espaço encostado ou entre linhas", () => {
    expect(html("2*3*4")).toBe("2*3*4");
    expect(html("arquivo_final_v2")).toBe("arquivo_final_v2");
    expect(html("* solto *")).toBe("* solto *");
    expect(html("*começo\nfim*")).toBe("*começo\nfim*");
  });

  it("texto com HTML continua sendo texto", () => {
    expect(html("*<b>oi</b>*")).toBe("<strong>&lt;b&gt;oi&lt;/b&gt;</strong>");
  });
});

describe("stripFormatting", () => {
  it("tira os marcadores para as prévias", () => {
    expect(stripFormatting("*Ana* disse _oi_ ~e~")).toBe("Ana disse oi e");
    expect(stripFormatting("*tudo _junto_*")).toBe("tudo junto");
    expect(stripFormatting("2*3*4")).toBe("2*3*4");
  });
});

describe("formatDraft", () => {
  const draft = (text: string) => renderToStaticMarkup(<>{formatDraft(text)}</>);

  it("mantém os marcadores e o texto inteiro, só marcando os trechos", () => {
    expect(draft("isso é *muito* bom")).toBe('isso é <span class="fmt-b"><span class="fmt-mark">*</span>muito<span class="fmt-mark">*</span></span> bom');
    expect(draft("~não~")).toBe('<span class="fmt-s"><span class="fmt-mark">~</span>não<span class="fmt-mark">~</span></span>');
  });

  it("itálico inclina palavra por palavra, sem juntar os espaços", () => {
    expect(draft("_quem está_")).toBe(
      '<span class="fmt-i"><span class="fmt-mark">_</span><span class="fmt-i-word">quem</span> <span class="fmt-i-word">está</span><span class="fmt-mark">_</span></span>',
    );
  });

  it("sem marcação é o próprio texto", () => {
    expect(draft("*começo\nfim* 2*3*4")).toBe("*começo\nfim* 2*3*4");
  });
});
