import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { stripFormatting } from "../../lib/groups";
import { formatMessage } from "./messageFormat";

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
