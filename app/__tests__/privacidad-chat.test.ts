/**
 * SDD-0585 · paso 2.6 · `/privacidad` dice lo que el sistema guarda de los
 * mensajes por WhatsApp y chat, con los plazos que decidió Sam (2026-10-30):
 *  - lead sin servicio: anonimizado a los 12 meses sin actividad (SDD-0587, D6);
 *  - BSUID: borrado al año sin actividad (SDD-0586, H-2, `interval '365 days'`);
 *  - registro de respuestas automáticas: 30 días (SDD-0586, H-3, `interval '30 days'`).
 * Si alguien cambia un plazo en la base, esta prueba obliga a mirar el texto, y
 * al revés. Lee el archivo: es contenido estático.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const texto = readFileSync(path.join(process.cwd(), "app/privacidad/page.tsx"), "utf8").replace(/\s+/g, " ");

describe("/privacidad · mensajes por WhatsApp y chat (SDD-0585, 2.6)", () => {
  it("dice qué se recoge del chat, incluido el BSUID", () => {
    expect(texto).toContain("Mensajes por WhatsApp y chat");
    expect(texto).toContain("código anónimo de tu cuenta (BSUID)");
    expect(texto).toContain("los últimos 10 dígitos de tu teléfono");
  });

  it("nombra a Meta y aclara que el sistema de atención es propio", () => {
    expect(texto).toContain("Meta (WhatsApp)");
    expect(texto).toContain("alojado en nuestro servidor");
  });

  it("los tres plazos coinciden con los de la base", () => {
    expect(texto).toMatch(/12 meses sin actividad/);
    expect(texto).toMatch(/BSUID\)<\/strong> se borra al <strong>año sin actividad/);
    expect(texto).toMatch(/respuestas automáticas, a los <strong>30 días/);
  });

  it("«Registro de cliente» dice que guardamos la campaña (SDD-0587, 6.4)", () => {
    expect(texto).toMatch(
      /"Registro de cliente", "[^"]*También guardamos la campaña por la que llegaste, si el enlace la trae\.[^"]*"/,
    );
  });

  it("la fecha de la política se movió con el cambio", () => {
    expect(texto).toContain('const UPDATED = "4 de noviembre de 2026";');
  });
});
