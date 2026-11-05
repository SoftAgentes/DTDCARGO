// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAQS } from "@/lib/faqs";
import { GLOSSARY_TERMS } from "@/lib/design-tokens";
import { isOfferable } from "@/lib/seo-offer-catalog";
import { SERVICIOS_DETALLE } from "@/lib/servicios-detalle";
import { buildLlmsFull } from "../llms-full";

const texto = buildLlmsFull();
const llms = readFileSync(join(process.cwd(), "public", "llms.txt"), "utf8");

describe("/llms-full.txt (SDD-0604)", () => {
  it("trae todas las preguntas frecuentes y todos los términos", () => {
    expect(FAQS.length).toBeGreaterThan(10);
    expect(GLOSSARY_TERMS.length).toBeGreaterThan(10);
    for (const f of FAQS) expect(texto).toContain(f.respuesta);
    for (const t of GLOSSARY_TERMS) expect(texto).toContain(`### ${t.term} (`);
  });

  it("solo lista servicios que se ofrecen", () => {
    const fuera = SERVICIOS_DETALLE.filter((s) => !isOfferable(s));
    expect(fuera.length).toBeGreaterThan(0);
    for (const s of fuera) expect(texto).not.toContain(`### ${s.titulo}\n`);
    for (const s of SERVICIOS_DETALLE.filter(isOfferable)) {
      expect(texto).toContain(`### ${s.titulo}\n`);
    }
  });

  it("usa la variante del glosario sin promesa de seguimiento", () => {
    const dtdu = GLOSSARY_TERMS.find((t) => t.id === "dtdu");
    expect(dtdu?.enConstruccion).toBeDefined();
    expect(texto).toContain("está en construcción");
    expect(texto).not.toContain(dtdu?.body[0]);
  });

  it("no deja etiquetas del glosario en el texto", () => {
    expect(texto).not.toMatch(/<\/?b>/);
  });

  it("no publica la identidad legal", () => {
    for (const salida of [texto, llms]) {
      expect(salida).not.toMatch(/J-50648869|INVERSIONES DTD/);
    }
  });
});

describe("public/llms.txt (SDD-0604)", () => {
  it("no presenta 2008 como inicio de operaciones", () => {
    expect(llms).not.toMatch(/operando desde 2008|¿Desde cuándo operan\? Desde 2008/);
    expect(llms).toContain("Fundada en 2015");
  });

  it("enlaza la versión ampliada", () => {
    expect(llms).toContain("https://dtdcargo.com/llms-full.txt");
  });
});
