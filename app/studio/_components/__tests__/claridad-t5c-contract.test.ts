import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato del tramo 5c de SDD-0603 (Tracking, Almacén CN, Documentos,
 * Cobranzas y los avisos de Embarques y Dashboard). BD-037:
 *   - lo que abre un registro es un botón real «Abrir <código>» y la fila sale
 *     del orden de Tab;
 *   - lo que avisa es `<Aviso>` (SDD-0628), no una caja hecha a mano;
 *   - lo que cambia al escribir no va en una región viva.
 *
 * Cuenta exacta por archivo, sin comentarios: un comentario que diga `<Aviso`
 * o `role="alert"` no cuenta, y quitar un aviso de verdad rompe aunque el
 * comentario siga ahí. Las excepciones están explicadas en
 * `docs/specs/0603-claridad-controles/tramo-5c.md`.
 */

const BASE = "app/studio/(app)/";

type Cuenta = {
  /** `<Aviso` en el código. */
  aviso: number;
  /** `role="alert|status|note"` en un elemento crudo (el de `<Aviso>` vive en el componente). */
  rol: number;
  /** `aria-live=` crudo. */
  vivo: number;
  /** Contorno de estado en línea (`1px solid|dashed var(--danger|warning|success|info)`). */
  contorno: number;
  /** Botones «Abrir <código>»: `aria-label={`Abrir …`}`. */
  abrir: number;
  /** `tabIndex={-1}`: la fila (o el panel del diálogo) fuera del orden de Tab. */
  fueraDeTab: number;
};

const ESPERADO: Record<string, Cuenta> = {
  // Excepción: el contorno izquierdo agrupa los campos de la recepción huérfana (sección de formulario).
  "cn/_components/NewReceiptDrawer.tsx": { aviso: 1, rol: 0, vivo: 0, contorno: 1, abrir: 0, fueraDeTab: 0 },
  // Excepciones: error de campo (alert), «Cargando…» y la nota de solo elevados (status, texto).
  "cn/_components/RateSnapshotDrawer.tsx": { aviso: 3, rol: 3, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0 },
  "cobranzas/_components/CobranzaDrawer.tsx": { aviso: 1, rol: 0, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0 },
  "cobranzas/_components/CobranzasClient.tsx": { aviso: 1, rol: 0, vivo: 0, contorno: 0, abrir: 1, fueraDeTab: 1 },
  "cobranzas/_components/IdentifyPaymentDrawer.tsx": { aviso: 3, rol: 0, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0 },
  "cobranzas/_components/RecordatoriosDrawer.tsx": { aviso: 1, rol: 0, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0 },
  "cobranzas/_components/UnidentifiedPaymentDrawer.tsx": { aviso: 2, rol: 0, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0 },
  "dashboard/_components/DashboardEditorDrawer.tsx": { aviso: 2, rol: 0, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0 },
  // No aplica para avisos ni filas: las filas no abren nada (ya tienen «Historial»).
  "documentos/_components/DocumentosHubClient.tsx": { aviso: 0, rol: 0, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0 },
  // Excepción: el único canal de anuncio del asistente (AVS-01), texto en status.
  "embarques/_components/AsistenteBorrado.tsx": { aviso: 1, rol: 1, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0 },
  // `tabIndex={-1}` es el panel del diálogo, que recibe el foco al abrir.
  "tracking/[id]/_components/ChangeDestinationModal.tsx": { aviso: 2, rol: 0, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 1 },
  "tracking/[id]/_components/ShipmentPlanPanel.tsx": { aviso: 2, rol: 0, vivo: 0, contorno: 0, abrir: 0, fueraDeTab: 0 },
  // Excepción: «No se pudieron contar los adjuntos.» es texto en status, sin caja.
  "tracking/_components/ActiveShipmentList.tsx": { aviso: 0, rol: 1, vivo: 0, contorno: 0, abrir: 1, fueraDeTab: 1 },
  // Excepción: el contorno punteado agrupa el campo GPS del destino (sección de formulario).
  "tracking/nuevo/_components/CreateShipmentForm.tsx": { aviso: 1, rol: 0, vivo: 0, contorno: 1, abrir: 0, fueraDeTab: 0 },
};

const ARCHIVOS = Object.keys(ESPERADO);

const PATRONES: Record<keyof Cuenta, RegExp> = {
  aviso: /<Aviso\b/g,
  rol: /role="(?:alert|status|note)"/g,
  vivo: /aria-live=/g,
  contorno: /(?:solid|dashed) var\(--(?:danger|warning|success|info)\)/g,
  abrir: /aria-label=\{`Abrir /g,
  fueraDeTab: /tabIndex=\{-1\}/g,
};

const IMPORT_AVISO = /from "@\/app\/studio\/_components\/ui\/Aviso"/;

/** Quita comentarios de bloque (también `{/* … *\/}` de JSX) y de línea completa. */
export function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function contar(texto: string): Cuenta {
  const codigo = sinComentarios(texto);
  const out = {} as Cuenta;
  for (const k of Object.keys(PATRONES) as (keyof Cuenta)[]) {
    out[k] = codigo.match(PATRONES[k])?.length ?? 0;
  }
  return out;
}

/** Diferencias contra lo esperado, más el import canónico si hay `<Aviso>`. */
function violaciones(ruta: string, texto: string): string[] {
  const fallas: string[] = [];
  const real = contar(texto);
  for (const k of Object.keys(PATRONES) as (keyof Cuenta)[]) {
    if (real[k] !== ESPERADO[ruta][k]) fallas.push(`${ruta}: ${k} = ${real[k]}, se esperaba ${ESPERADO[ruta][k]}`);
  }
  if (real.aviso > 0 && !IMPORT_AVISO.test(sinComentarios(texto))) {
    fallas.push(`${ruta}: usa <Aviso> sin importarlo del componente canónico`);
  }
  return fallas;
}

const fuentes = new Map<string, string>(
  ARCHIVOS.map((ruta) => [ruta, readFileSync(join(process.cwd(), BASE, ruta), "utf8")]),
);

const TOTAL_AVISOS = 20;

describe("SDD-0603 · tramo 5c · filas y avisos (BD-037)", () => {
  it("mira los 14 archivos de la allowlist", () => {
    expect(fuentes.size).toBe(14);
  });

  it.each(ARCHIVOS)("%s cumple su cuenta exacta", (ruta) => {
    expect(violaciones(ruta, fuentes.get(ruta)!)).toEqual([]);
  });

  it(`el grupo deja exactamente ${TOTAL_AVISOS} <Aviso>`, () => {
    let total = 0;
    for (const texto of fuentes.values()) total += contar(texto).aviso;
    expect(total).toBe(TOTAL_AVISOS);
  });

  it("«Abrir» de las filas es un secundario de tabla con verbo visible", () => {
    for (const ruta of ["cobranzas/_components/CobranzasClient.tsx", "tracking/_components/ActiveShipmentList.tsx"]) {
      const codigo = sinComentarios(fuentes.get(ruta)!);
      const i = codigo.search(PATRONES.abrir);
      const boton = codigo.slice(codigo.lastIndexOf("<button", i), codigo.indexOf("</button>", i));
      expect(boton, ruta).toMatch(/studio-btn /);
      expect(boton, ruta).toMatch(/studio-btn-sm/);
      expect(boton, ruta).toMatch(/>\s*Abrir\s*\{Icon\.chevR\(14\)\}/);
    }
  });

  describe("mutantes", () => {
    const ruta = "tracking/nuevo/_components/CreateShipmentForm.tsx";
    const original = fuentes.get(ruta)!;

    it("<Aviso> vuelve a <p> → rompe", () => {
      const mutado = original.replace('<Aviso tono="error">{state.error}</Aviso>', '<p role="alert">{state.error}</p>');
      expect(mutado).not.toBe(original);
      expect(violaciones(ruta, mutado).length).toBeGreaterThan(0);
    });

    it("vuelve la caja con contorno de error → rompe", () => {
      const mutado = original.replace(
        '<Aviso tono="error">{state.error}</Aviso>',
        '<div style={{ border: "1px solid var(--danger)" }}>{state.error}</div>',
      );
      expect(mutado).not.toBe(original);
      expect(violaciones(ruta, mutado)).toEqual(
        expect.arrayContaining([expect.stringContaining("aviso = 0"), expect.stringContaining("contorno = 2")]),
      );
    });

    it("un comentario no cuenta: quitar el Aviso y dejarlo citado en un comentario igual rompe", () => {
      const mutado = original.replace(
        '<Aviso tono="error">{state.error}</Aviso>',
        '<p>{state.error}</p> {/* antes: <Aviso tono="error"> role="alert" */}',
      );
      expect(mutado).not.toBe(original);
      expect(violaciones(ruta, mutado)).toEqual([expect.stringContaining("aviso = 0")]);
    });

    it("un comentario no suma: citar role=\"alert\" o <Aviso en comentarios no cambia la cuenta", () => {
      const mutado = `// role="alert" <Aviso aria-live= tabIndex={-1}\n/* solid var(--danger) */\n${original}`;
      expect(violaciones(ruta, mutado)).toEqual([]);
    });

    it("se quita el import canónico → rompe", () => {
      const mutado = original.replace(IMPORT_AVISO, 'from "./Aviso"');
      expect(violaciones(ruta, mutado).length).toBeGreaterThan(0);
    });

    it("la fila de Cobranzas vuelve a ser parada de Tab → rompe", () => {
      const r = "cobranzas/_components/CobranzasClient.tsx";
      const o = fuentes.get(r)!;
      const mutado = o.replace("tabIndex={-1}", "tabIndex={0}");
      expect(mutado).not.toBe(o);
      expect(violaciones(r, mutado)).toEqual([expect.stringContaining("fueraDeTab = 0")]);
    });

    it("la vista previa de tarifa vuelve a ser región viva → rompe", () => {
      const r = "cn/_components/RateSnapshotDrawer.tsx";
      const o = fuentes.get(r)!;
      const mutado = o.replace("<div\n                aria-busy={previewPendiente}", '<div\n                aria-live="polite"\n                aria-busy={previewPendiente}');
      expect(mutado).not.toBe(o);
      expect(violaciones(r, mutado)).toEqual([expect.stringContaining("vivo = 1")]);
    });
  });
});
