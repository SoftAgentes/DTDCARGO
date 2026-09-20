// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderSignatureHtml } from "@/lib/studio/mail-signature-render";
import {
  EMAIL_FONT_STACK,
  emailTypographyForSignature,
} from "../email-typography";

describe("SDD-0175 Gate V2 · tipografía de email", () => {
  it("usa Song Ti sólo para firma formal zh-CN y conserva Hei Ti como fallback", () => {
    const contract = emailTypographyForSignature("zh");
    expect(contract).toEqual({
      htmlLang: "zh-CN",
      bodyFont: EMAIL_FONT_STACK.cnDocument,
      formalChinese: true,
    });
    expect(contract.bodyFont.indexOf("Noto Serif SC")).toBeLessThan(
      contract.bodyFont.indexOf("Noto Sans SC"),
    );
  });

  it("mantiene Archivo para firmas en español e inglés", () => {
    expect(emailTypographyForSignature("es").bodyFont).toBe(
      EMAIL_FONT_STACK.brand,
    );
    expect(emailTypographyForSignature("en").bodyFont).toBe(
      EMAIL_FONT_STACK.brand,
    );
  });

  it("renderiza una firma china con lang y fallback aun sin webfont", () => {
    const html = renderSignatureHtml({
      layout: "corporate",
      full_name: "王华",
      role_label: "义乌办公室",
      email: "office@example.com",
      lang: "zh",
    });

    expect(html).toContain('lang="zh-CN"');
    expect(html).toContain(
      "font:700 16px/1.1 'Noto Serif SC', 'Noto Sans SC', sans-serif",
    );
    expect(html).toContain("font:500 12px/1.4 'Noto Serif SC', 'Noto Sans SC', sans-serif");
    expect(html).toContain("DTDCARGO.COM");
  });

  it("no activa la fuente documental para una firma de interfaz española", () => {
    const html = renderSignatureHtml({
      layout: "minimal",
      full_name: "María Pérez",
      email: "maria@example.com",
      lang: "es",
    });

    expect(html).toContain('lang="es"');
    expect(html).not.toContain("Noto Serif SC");
    expect(html).toContain("Archivo");
  });
});
