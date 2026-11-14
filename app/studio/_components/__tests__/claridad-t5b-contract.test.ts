import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato del tramo 5b de SDD-0603 (Contabilidad). BD-037:
 *   - lo que abre un registro es un control real «Abrir <código>» y la fila
 *     sale del orden de Tab;
 *   - lo que avisa es `<Aviso>` (SDD-0628), no una caja hecha a mano;
 *   - la selección va en tinta; el vino queda para la acción principal;
 *   - ningún dato sensible (la superclave) queda dentro de una región viva.
 *
 * Cuenta exacta por archivo, sin comentarios: un comentario que diga `<Aviso`
 * o `role="alert"` no cuenta, y quitar un aviso de verdad rompe aunque el
 * comentario siga ahí. Las excepciones están explicadas en
 * `docs/specs/0603-claridad-controles/tramo-5b.md`.
 */

const BASE = "app/studio/(app)/contabilidad/_components/";

type Cuenta = {
  /** `<Aviso` en el código. */
  aviso: number;
  /** `role="alert|status|note"` en un elemento crudo (el de `<Aviso>` vive en el componente). */
  rol: number;
  /** `aria-live=` crudo. */
  vivo: number;
  /** Caja de estado hecha a mano: fondo `--danger|warning|success|info-bg` en línea. */
  caja: number;
  /** Contorno de estado en línea (`1px solid|dashed var(--danger|warning|success|info)`). */
  contorno: number;
  /** Controles «Abrir <código>»: `aria-label={`Abrir …`}`. */
  abrir: number;
  /** `tabIndex={-1}`: la fila (o el panel del cajón) fuera del orden de Tab. */
  fueraDeTab: number;
  /**
   * Selección en vino: `var(--wine-tint)` o `? "var(--wine)"` (fondo o contorno
   * que cambia con la selección). Las casillas con `accentColor` vino quedan
   * fuera de este tramo (ver tramo-5b.md, fuera de alcance).
   */
  vino: number;
};

// `tabIndex={-1}` de los cajones y del diálogo es su panel, que recibe el foco al abrir.
const CAJON = { aviso: 1, rol: 0, vivo: 0, caja: 0, contorno: 0, abrir: 0, fueraDeTab: 1, vino: 0 };

const ESPERADO: Record<string, Cuenta> = {
  "AccountDrawer.tsx": CAJON,
  // Filas: no aplica, la fila del activo no abre nada.
  "ActivosFijosTab.tsx": { aviso: 1, rol: 0, vivo: 0, caja: 0, contorno: 0, abrir: 0, fueraDeTab: 0, vino: 0 },
  "AjustesDelCierre.tsx": { aviso: 1, rol: 0, vivo: 0, caja: 0, contorno: 0, abrir: 0, fueraDeTab: 0, vino: 0 },
  "AssetDrawer.tsx": CAJON,
  // El aviso del cierre es franja propia; la superclave va fuera, sin región viva.
  "CamposExcepcionCierre.tsx": { aviso: 1, rol: 0, vivo: 0, caja: 0, contorno: 0, abrir: 0, fueraDeTab: 0, vino: 0 },
  "ClosingDateDrawer.tsx": CAJON,
  "ConciliacionTab.tsx": { aviso: 1, rol: 0, vivo: 0, caja: 0, contorno: 0, abrir: 1, fueraDeTab: 1, vino: 0 },
  // No aplica: botones de cabecera y `studio-tabs` (tramo 2).
  "ContabilidadClient.tsx": { aviso: 0, rol: 0, vivo: 0, caja: 0, contorno: 0, abrir: 0, fueraDeTab: 0, vino: 0 },
  "EntryDrawer.tsx": CAJON,
  "ExcepcionCierreDialog.tsx": CAJON,
  // Excepciones, ya texto con icono y sin caja: el aviso del diario (status, al
  // cargar), la nota de protección de la fila (note) y el error de exportar (alert).
  "LibroDiarioTab.tsx": { aviso: 1, rol: 3, vivo: 0, caja: 0, contorno: 0, abrir: 0, fueraDeTab: 0, vino: 0 },
  "LineMatchDrawer.tsx": CAJON,
  // Excepción: el error del filtro ya es texto con icono, ligado a sus campos (alert).
  "ReportesTab.tsx": { aviso: 0, rol: 1, vivo: 0, caja: 0, contorno: 0, abrir: 0, fueraDeTab: 0, vino: 0 },
  "StatementDrawer.tsx": CAJON,
};

const ARCHIVOS = Object.keys(ESPERADO);

const PATRONES: Record<keyof Cuenta, RegExp> = {
  aviso: /<Aviso\b/g,
  rol: /role="(?:alert|status|note)"/g,
  vivo: /aria-live=/g,
  caja: /background: "var\(--(?:danger|warning|success|info)-bg\)"/g,
  contorno: /(?:solid|dashed) var\(--(?:danger|warning|success|info)\)/g,
  abrir: /aria-label=\{`Abrir /g,
  fueraDeTab: /tabIndex=\{-1\}/g,
  vino: /var\(--wine-tint\)|\? "var\(--wine\)"/g,
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

const TOTAL_AVISOS = 12;

describe("SDD-0603 · tramo 5b · filas y avisos de Contabilidad (BD-037)", () => {
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

  it("«Abrir» del extracto es un secundario de tabla con verbo visible, y el abierto va en tinta", () => {
    const codigo = sinComentarios(fuentes.get("ConciliacionTab.tsx")!);
    const i = codigo.search(PATRONES.abrir);
    const control = codigo.slice(codigo.lastIndexOf("<a", i), codigo.indexOf("</a>", i));
    expect(control).toMatch(/studio-btn \$\{active \? "studio-btn-dark" : "studio-btn-ghost"\} studio-btn-sm/);
    expect(control).toMatch(/aria-current=\{active \? "true" : undefined\}/);
    expect(control).toMatch(/>\s*Abrir\s*\{Icon\.chevR\(14\)\}/);
  });

  it("la superclave queda fuera del <Aviso> del cierre", () => {
    const codigo = sinComentarios(fuentes.get("CamposExcepcionCierre.tsx")!);
    const aviso = codigo.slice(codigo.indexOf("<Aviso"), codigo.indexOf("</Aviso>"));
    expect(aviso).toContain("textoAvisoCierre(aviso)");
    expect(aviso).not.toMatch(/superclave|<input|<textarea/);
  });

  describe("mutantes", () => {
    const ruta = "AccountDrawer.tsx";
    const original = fuentes.get(ruta)!;
    const AVISO = '<Aviso tono="error" compacto>{state.error}</Aviso>';

    it("<Aviso> vuelve a <p> → rompe", () => {
      const mutado = original.replace(AVISO, '<p role="alert">{state.error}</p>');
      expect(mutado).not.toBe(original);
      expect(violaciones(ruta, mutado)).toEqual(
        expect.arrayContaining([expect.stringContaining("aviso = 0"), expect.stringContaining("rol = 1")]),
      );
    });

    it("vuelve la caja roja hecha a mano → rompe", () => {
      const mutado = original.replace(
        AVISO,
        '<p style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)" }}>{state.error}</p>',
      );
      expect(mutado).not.toBe(original);
      expect(violaciones(ruta, mutado)).toEqual(
        expect.arrayContaining([
          expect.stringContaining("aviso = 0"),
          expect.stringContaining("caja = 1"),
          expect.stringContaining("contorno = 1"),
        ]),
      );
    });

    it("un comentario no cuenta: quitar el Aviso y dejarlo citado en un comentario igual rompe", () => {
      const mutado = original.replace(AVISO, '<p>{state.error}</p> {/* antes: <Aviso tono="error"> role="alert" */}');
      expect(mutado).not.toBe(original);
      expect(violaciones(ruta, mutado)).toEqual([expect.stringContaining("aviso = 0")]);
    });

    it("un comentario no suma: citar role=\"alert\", <Aviso o el vino en comentarios no cambia la cuenta", () => {
      const mutado = `// role="alert" <Aviso aria-live= tabIndex={-1} var(--wine-tint)\n/* solid var(--danger) background: "var(--danger-bg)" */\n${original}`;
      expect(violaciones(ruta, mutado)).toEqual([]);
    });

    it("se quita el import canónico → rompe", () => {
      const mutado = original.replace(IMPORT_AVISO, 'from "./Aviso"');
      expect(mutado).not.toBe(original);
      expect(violaciones(ruta, mutado).length).toBeGreaterThan(0);
    });

    it("la fila del extracto vuelve a ser parada de Tab → rompe", () => {
      const r = "ConciliacionTab.tsx";
      const o = fuentes.get(r)!;
      const mutado = o.replace("tabIndex={-1}", "tabIndex={0}");
      expect(mutado).not.toBe(o);
      expect(violaciones(r, mutado)).toEqual([expect.stringContaining("fueraDeTab = 0")]);
    });

    it("el extracto abierto vuelve al vino → rompe", () => {
      const r = "ConciliacionTab.tsx";
      const o = fuentes.get(r)!;
      const mutado = o.replace('background: "var(--bg-surface)",\n                border: `1px solid ${active ? "var(--ctl-border)"', 'background: active ? "var(--wine-tint)" : "var(--bg-surface)",\n                border: `1px solid ${active ? "var(--ctl-border)"');
      expect(mutado).not.toBe(o);
      expect(violaciones(r, mutado)).toEqual([expect.stringContaining("vino = 1")]);
    });

    it("el aviso del cierre vuelve a caja ámbar → rompe", () => {
      const r = "CamposExcepcionCierre.tsx";
      const o = fuentes.get(r)!;
      const mutado = o.replace(
        '<Aviso tono="atencion" compacto id={avisoId}>',
        '<div id={avisoId} style={{ background: "var(--warning-bg)", border: "1px solid var(--warning)" }}>',
      ).replace("</Aviso>", "</div>");
      expect(mutado).not.toBe(o);
      expect(violaciones(r, mutado)).toEqual(
        expect.arrayContaining([expect.stringContaining("aviso = 0"), expect.stringContaining("caja = 1")]),
      );
    });

    it("el diálogo de excepción pierde su <Aviso> de error → rompe", () => {
      const r = "ExcepcionCierreDialog.tsx";
      const o = fuentes.get(r)!;
      const mutado = o.replace('<Aviso tono="error" compacto id={errorId}>{error}</Aviso>', '<p id={errorId}>{error}</p>');
      expect(mutado).not.toBe(o);
      expect(violaciones(r, mutado)).toEqual([expect.stringContaining("aviso = 0")]);
    });
  });
});
