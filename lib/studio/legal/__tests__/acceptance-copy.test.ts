// @vitest-environment node
/**
 * Tests del copy del modal de aceptación (SDD-0067 · decisión #2).
 *
 * `docs/legal/COPY_LEGAL_UI.md §1` es el copy LITERAL para el set v3
 * (`acuerdo-servicios`, lo publica SDD-A). Acá se asierta:
 *   1. Con el set v3 vigente → el modal produce EXACTAMENTE el copy literal de
 *      §1 (sin tocar código el día que SDD-A publique).
 *   2. Con el set pre-v3 (tyc v2.1 + operador v1.4, los vigentes hoy) → el
 *      FALLBACK: checkbox 1 lista los docs reales por nombre+versión; checkbox 2
 *      se muestra SIEMPRE pero SIN el sufijo "(cláusula 1.4)".
 *   3. El aviso de re-aceptación (§1 último bloque) literal para el acuerdo v3
 *      y genérico para otros docs.
 */

import { describe, it, expect } from "vitest";
import {
  ACUERDO_SERVICIOS_KEY,
  REACCEPTANCE_LINK_LABEL,
  buildAcceptanceCopy,
  buildReacceptanceNotice,
} from "../acceptance-copy";

const V3_DOCS = [
  {
    key: ACUERDO_SERVICIOS_KEY,
    name: "Acuerdo de Servicios y Políticas Generales",
    version: "v3.0",
  },
];

const PRE_V3_DOCS = [
  { key: "tyc", name: "Términos y Condiciones", version: "v2.1" },
  { key: "operador", name: "Condiciones del Operador", version: "v1.4" },
];

describe("buildAcceptanceCopy · set v3 (copy LITERAL de COPY_LEGAL_UI.md §1)", () => {
  const copy = buildAcceptanceCopy(V3_DOCS);

  it("título literal", () => {
    expect(copy.title).toBe("Acuerdo de Servicios DTD Cargo");
  });

  it("cuerpo literal (con la versión interpolada)", () => {
    expect(copy.body).toBe(
      "Antes de confirmar tu cotización, necesitamos tu aceptación del Acuerdo de Servicios y Políticas Generales (v3.0), que incluye la política de reembolso, la lista de mercancía prohibida y el checklist de pre-alerta.",
    );
  });

  it("link al documento completo literal", () => {
    expect(copy.readLinkLabel).toBe("Leer el Acuerdo completo →");
  });

  it("checkbox 1 literal (con Anexos A, B y C)", () => {
    expect(copy.checkbox1).toBe(
      "He leído y acepto el Acuerdo de Servicios y Políticas Generales de DTD Cargo (v3.0), incluyendo sus Anexos A, B y C.",
    );
  });

  it("checkbox 2 literal CON el sufijo (cláusula 1.4)", () => {
    expect(copy.checkbox2).toBe(
      "Declaro que actúo como comerciante, empresa o emprendedor con fines de lucro (cláusula 1.4).",
    );
  });

  it("botones + texto probatorio literales", () => {
    expect(copy.submitLabel).toBe("Aceptar y confirmar cotización");
    expect(copy.backLabel).toBe("Volver");
    expect(copy.legalFooter).toBe(
      "Tu aceptación queda registrada con fecha, hora, dirección IP y huella de integridad (hash), conforme a la Ley sobre Mensajes de Datos y Firmas Electrónicas.",
    );
  });
});

describe("buildAcceptanceCopy · fallback pre-v3 (vigentes hoy: tyc + operador)", () => {
  const copy = buildAcceptanceCopy(PRE_V3_DOCS);

  it("título del fallback (no menciona un Acuerdo que no existe)", () => {
    expect(copy.title).toBe("Términos y Condiciones DTD Cargo");
  });

  it("cuerpo lista los documentos vigentes REALES por nombre + versión", () => {
    expect(copy.body).toBe(
      "Antes de confirmar tu cotización, necesitamos tu aceptación de los documentos vigentes: Términos y Condiciones (v2.1) y Condiciones del Operador (v1.4).",
    );
  });

  it("checkbox 1 con los docs reales (mismo template)", () => {
    expect(copy.checkbox1).toBe(
      "He leído y acepto los documentos Términos y Condiciones (v2.1) y Condiciones del Operador (v1.4) de DTD Cargo.",
    );
  });

  it("checkbox 2 se muestra SIEMPRE pero SIN '(cláusula 1.4)' (el acuerdo v3 no está vigente)", () => {
    expect(copy.checkbox2).toBe(
      "Declaro que actúo como comerciante, empresa o emprendedor con fines de lucro.",
    );
    expect(copy.checkbox2).not.toContain("cláusula 1.4");
  });

  it("botones + footer idénticos al literal (no dependen del set)", () => {
    expect(copy.submitLabel).toBe("Aceptar y confirmar cotización");
    expect(copy.backLabel).toBe("Volver");
    expect(copy.legalFooter).toContain("Ley sobre Mensajes de Datos");
  });

  it("normaliza versiones con o sin prefijo v ('2.1' ≡ 'v2.1')", () => {
    const noPrefix = buildAcceptanceCopy([
      { key: "tyc", name: "Términos y Condiciones", version: "2.1" },
    ]);
    expect(noPrefix.checkbox1).toContain("(v2.1)");
  });
});

describe("buildReacceptanceNotice (§1 último bloque)", () => {
  it("acuerdo v3 como único cambio → copy LITERAL de re-aceptación", () => {
    const notice = buildReacceptanceNotice([
      {
        key: ACUERDO_SERVICIOS_KEY,
        name: "Acuerdo de Servicios y Políticas Generales",
        version: "v3.1",
        effective_date: "2026-07-01",
      },
    ]);
    expect(notice).toBe(
      "Actualizamos nuestro Acuerdo de Servicios a la versión 3.1 (vigente desde 1 de julio de 2026). Para confirmar esta cotización, por favor revísalo y acéptalo nuevamente.",
    );
  });

  it("otros docs → aviso genérico con nombre + versión + vigencia", () => {
    const notice = buildReacceptanceNotice([
      {
        key: "tyc",
        name: "Términos y Condiciones",
        version: "v2.2",
        effective_date: "2026-08-15",
      },
    ]);
    expect(notice).toContain("Términos y Condiciones a la versión 2.2");
    expect(notice).toContain("vigente desde 15 de agosto de 2026");
    expect(notice).toContain("revísalo y acéptalo nuevamente");
  });

  it("varios docs cambiados → plural", () => {
    const notice = buildReacceptanceNotice([
      {
        key: "tyc",
        name: "Términos y Condiciones",
        version: "v2.2",
        effective_date: "2026-08-15",
      },
      {
        key: "operador",
        name: "Condiciones del Operador",
        version: "v1.5",
        effective_date: "2026-08-15",
      },
    ]);
    expect(notice).toContain("revísalos y acéptalos");
  });

  it("sin cambios → string vacío (no se muestra aviso)", () => {
    expect(buildReacceptanceNotice([])).toBe("");
  });

  it("label del link literal", () => {
    expect(REACCEPTANCE_LINK_LABEL).toBe("Ver qué cambió →");
  });
});
