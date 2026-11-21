/**
 * SDD-0686 · fase 2, grupo 8 y cierre de la fase (BD-076).
 *
 * El grupo 8 abarca conversaciones, menciones, rendiciones, servicios,
 * ajustes, el panel de Chatwoot `(panel)` y los restos de cobranzas,
 * embarques y los comentarios compartidos. Cierra sin vino.
 *
 * El cierre de la fase recorre todo `app/studio` con el mismo detector y
 * admite solo el vino de la lista, cada uno con su motivo: identidad de
 * documentos y superficies de marca, y las primitivas del grupo 1 que esperan
 * decisión. Quedan fuera:
 * - `tokens.css` y `studio.css`, que definen los tokens (fases 1 y 3);
 * - noticias-web, cuyo vino de acción en el bloque claro cuenta el contrato del
 *   grupo 3 y espera `--color-accion*` de la fase 3.
 * Un vino nuevo en cualquier otra pantalla del Studio rompe este contrato.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino, fuentesDe, RAIZ, rel } from "./vino-detector";

const GRUPO_8 = [
  "app/studio/(app)/conversaciones",
  "app/studio/(app)/menciones",
  "app/studio/(app)/rendiciones",
  "app/studio/(app)/servicios",
  "app/studio/(app)/ajustes",
  "app/studio/(app)/cobranzas",
  "app/studio/(app)/embarques",
  "app/studio/(app)/_components/comments",
  "app/studio/(panel)",
];

const FUERA = [/^app\/studio\/(tokens|studio)\.css$/, /^app\/studio\/\(app\)\/marketing\/noticias-web\//];

/** Lo único que puede quedar en vino en el Studio al cerrar la fase 2. */
const PERMITIDO: Record<string, { cuenta: number; motivo: string }> = {
  "app/studio/(app)/academia/diplomas/_components/DiplomaPrint.tsx": {
    cuenta: 26,
    motivo: "diploma impreso: documento de marca (regla 8); se revisa con los PDF en la fase 4",
  },
  "app/studio/(app)/dashboard/page.tsx": {
    cuenta: 1,
    motivo: "panel de bienvenida con el isotipo (BD-034): superficie de marca",
  },
  "app/studio/(app)/fiscal/_components/FiscalClient.tsx": {
    cuenta: 1,
    motivo: "encabezado impreso del libro fiscal (regla 8)",
  },
  "app/studio/(app)/fiscal/_components/WithholdingsView.tsx": {
    cuenta: 1,
    motivo: "encabezado impreso del comprobante de retención (regla 8)",
  },
  "app/studio/(app)/reportes/_components/BuilderView.tsx": {
    cuenta: 1,
    motivo: "encabezado impreso del constructor de reportes (regla 8)",
  },
  "app/studio/(app)/inspecciones/_components/report-css.ts": {
    cuenta: 2,
    motivo: "informe impreso: wordmark y rótulo del encabezado (regla 8)",
  },
  "app/studio/(app)/mailing/_components/SignaturesView.tsx": {
    cuenta: 1,
    motivo: "franja de la vista previa de la firma de correo (regla 8)",
  },
  "app/studio/_components/guia/GuiaTarjeta.tsx": {
    cuenta: 6,
    motivo: "superficie, franja y rótulos de la Guía con el tinte de marca",
  },
  "app/studio/_components/ui/EmptyState.tsx": {
    cuenta: 1,
    motivo: "eyebrow del estado vacío: identidad (spec, grupo 1)",
  },
  "app/studio/_components/ui/Avatar.tsx": {
    cuenta: 3,
    motivo: "tono `wine` de Avatar (iniciales de persona) y su valor por defecto: por decidir (spec §10)",
  },
  "app/studio/_components/ui/Badge.tsx": {
    cuenta: 1,
    motivo: "tono `wine` de Badge, retirado (regla 7): ninguna pantalla lo usa; se borra con la primitiva",
  },
};

const leer = (ruta: string) => readFileSync(ruta, "utf8");

function cuentasEn(bases: string[], fuente: (ruta: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ruta of bases.flatMap((b) => fuentesDe(join(RAIZ, b), /\.(tsx?|css)$/))) {
    const r = rel(ruta);
    if (FUERA.some((f) => f.test(r))) continue;
    const n = cuentaVino(fuente(ruta));
    if (n > 0) out[r] = n;
  }
  return out;
}

function mutar(objetivo: string, de: string, a: string): number | undefined {
  expect(leer(join(RAIZ, objetivo))).toContain(de);
  return cuentasEn(GRUPO_8, (ruta) => (rel(ruta) === objetivo ? leer(ruta).replace(de, a) : leer(ruta)))[objetivo];
}

describe("SDD-0686 fase 2 · grupo 8: conversaciones, menciones y el panel sin vino", () => {
  it("mide algo: el grupo 8 tiene al menos 40 archivos de producción", () => {
    const n = GRUPO_8.flatMap((b) => fuentesDe(join(RAIZ, b), /\.(tsx?|css)$/)).length;
    expect(n).toBeGreaterThanOrEqual(40);
  });

  it("ningún archivo del grupo 8 tiene vino", () => {
    expect(cuentasEn(GRUPO_8, leer)).toEqual({});
  });

  it("mutante: el mensaje saliente otra vez en vino se detecta", () => {
    const objetivo = "app/studio/(app)/conversaciones/_components/ConversationThread.tsx";
    expect(mutar(objetivo, 'background: out ? "var(--ink)"', 'background: out ? "var(--wine)"')).toBe(1);
  });

  it("mutante: el Shipping Mark del panel de Chatwoot otra vez en vino se detecta", () => {
    const objetivo = "app/studio/(panel)/ficha-chat/_components/FichaDtdView.tsx";
    expect(mutar(objetivo, 'font: "900 22px/1.15 var(--f-display)", color: "var(--ink)"', 'font: "900 22px/1.15 var(--f-display)", color: "var(--wine-text)"')).toBe(1);
  });

  it("mutante: un avatar de comentario otra vez en tono vino se detecta", () => {
    const objetivo = "app/studio/(app)/_components/comments/MentionDropdown.tsx";
    expect(mutar(objetivo, 'size={24} color="neutral"', 'size={24} color="wine"')).toBe(1);
  });

  it("la mención no leída se anuncia, no solo se pinta", () => {
    const fuente = leer(join(RAIZ, "app/studio/(app)/menciones/_components/MentionsInboxClient.tsx"));
    expect(fuente).toMatch(/unread && <span className="studio-sr-only">No leída\. <\/span>/);
  });

  it("los impresos de rendición y recibo ya no declaran --wine", () => {
    for (const f of ["rendiciones/[code]/page.tsx", "cobranzas/recibo/[code]/page.tsx"]) {
      expect(leer(join(RAIZ, `app/studio/(app)/${f}`))).not.toMatch(/--wine\s*:/);
    }
  });

  it("los encabezados impresos que usan --wine-text lo anclan al valor claro", () => {
    for (const f of ["fiscal/_components/FiscalClient.tsx", "fiscal/_components/WithholdingsView.tsx", "reportes/_components/BuilderView.tsx"]) {
      const fuente = leer(join(RAIZ, `app/studio/(app)/${f}`));
      expect(fuente).toContain("color: var(--wine-text);");
      expect(fuente).toMatch(/--wine-text:\s*#7F0F1A;/);
    }
  });
});

describe("SDD-0686 · cierre de la fase 2: todo app/studio", () => {
  it("cada archivo del Studio con vino está en la lista, con su cuenta exacta", () => {
    const esperado = Object.fromEntries(Object.entries(PERMITIDO).map(([f, v]) => [f, v.cuenta]));
    expect(cuentasEn(["app/studio"], leer)).toEqual(esperado);
  });

  it("mutante: un vino nuevo fuera de los grupos se detecta", () => {
    const objetivo = "app/studio/(app)/clientes/_components/PortalAccessCard.tsx";
    const fuente = leer(join(RAIZ, objetivo));
    const cuentas = cuentasEn(["app/studio"], (ruta) => (rel(ruta) === objetivo ? `${fuente}\nconst x = "var(--wine)";` : leer(ruta)));
    expect(cuentas[objetivo]).toBe(1);
  });
});
