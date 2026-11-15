import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato del tramo 5e de SDD-0603: los 8 archivos que estaban detenidos por
 * las PRs #515 y #509 (barra superior, ficha de usuario, factura, recibo,
 * expediente legal, rendición, Mis reportes y «Embarques sin facturar»).
 * BD-037:
 *   - lo que avisa es `<Aviso>` (SDD-0628), no una caja hecha a mano;
 *   - lo que abre un registro es un «Abrir <código>» real y la tarjeta sale del
 *     orden de Tab;
 *   - los documentos que se imprimen NO cambian: sus cajas de estado siguen en
 *     línea, dentro del papel, y aquí se cuentan para que no crezcan.
 *
 * Cuenta exacta por archivo, sin comentarios. Las excepciones están explicadas
 * en `docs/specs/0603-claridad-controles/tramo-5e.md`.
 */

const BASE = "app/studio/(app)/";

type Cuenta = {
  /** `<Aviso` en el código. */
  aviso: number;
  /** `role="alert|status|note"` en un elemento crudo (el de `<Aviso>` vive en el componente). */
  rol: number;
  /** `aria-live=` crudo. */
  vivo: number;
  /** Contorno de estado en línea (`solid|dashed var(--danger|warning|success|info)`). */
  contorno: number;
  /** Fondo de estado en línea (`var(--danger-bg|warning-bg|success-bg|info-bg`). */
  fondo: number;
  /** «Abrir <código>»: `aria-label={`Abrir …`}`. */
  abrir: number;
  /** `tabIndex={-1}`: la tarjeta fuera del orden de Tab. */
  fueraDeTab: number;
};

const ESPERADO: Record<string, Cuenta> = {
  // Sin avisos. El único fondo de estado es el realce al pasar el cursor por «Cerrar sesión».
  "_components/StudioTopbar.tsx": { aviso: 0, rol: 0, vivo: 0, contorno: 0, fondo: 1, abrir: 0, fueraDeTab: 0 },
  "usuarios/_components/UserDetailDrawer.tsx": { aviso: 6, rol: 0, vivo: 0, contorno: 0, fondo: 0, abrir: 0, fueraDeTab: 0 },
  // Papel: «Estado: …» va dentro del recibo que se imprime. No se toca.
  "cobranzas/recibo/[code]/page.tsx": { aviso: 0, rol: 0, vivo: 0, contorno: 0, fondo: 1, abrir: 0, fueraDeTab: 0 },
  "facturacion/[code]/page.tsx": { aviso: 1, rol: 0, vivo: 0, contorno: 0, fondo: 0, abrir: 0, fueraDeTab: 0 },
  // Papel: la verificación de integridad va dentro del expediente que se imprime.
  "legal/evidencia/[code]/page.tsx": { aviso: 0, rol: 0, vivo: 0, contorno: 0, fondo: 2, abrir: 0, fueraDeTab: 0 },
  // Los dos fondos son los chips del resumen (pastillas de lectura; no se tocan).
  "mis-bugs/page.tsx": { aviso: 0, rol: 0, vivo: 0, contorno: 0, fondo: 2, abrir: 1, fueraDeTab: 1 },
  // Papel: el aviso de anulación va dentro de la rendición que se imprime.
  "rendiciones/[code]/page.tsx": { aviso: 0, rol: 0, vivo: 0, contorno: 0, fondo: 1, abrir: 0, fueraDeTab: 0 },
  // Excepción: el resumen global es texto en `status`, sin caja.
  "reportes/embarques-sin-facturar/page.tsx": { aviso: 2, rol: 1, vivo: 0, contorno: 0, fondo: 0, abrir: 0, fueraDeTab: 0 },
};

const ARCHIVOS = Object.keys(ESPERADO);

const PATRONES: Record<keyof Cuenta, RegExp> = {
  aviso: /<Aviso\b/g,
  rol: /role="(?:alert|status|note)"/g,
  vivo: /aria-live=/g,
  contorno: /(?:solid|dashed) var\(--(?:danger|warning|success|info)\)/g,
  fondo: /var\(--(?:danger|warning|success|info)-bg/g,
  abrir: /aria-label=\{`Abrir /g,
  fueraDeTab: /tabIndex=\{-1\}/g,
};

const IMPORT_AVISO = /from "@\/app\/studio\/_components\/ui\/Aviso"/;

/** Quita comentarios de bloque (también `{/* … *\/}` de JSX) y de línea completa. */
function sinComentarios(texto: string): string {
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
  ARCHIVOS.map((ruta) => [ruta, readFileSync(join(process.cwd(), BASE, ruta), "utf8").replace(/\r\n/g, "\n")]),
);

const TOTAL_AVISOS = 9;

/** Los documentos que van al papel: su caja de estado vive dentro del contenedor que se imprime. */
const PAPEL: Record<string, string> = {
  "cobranzas/recibo/[code]/page.tsx": 'id="recibo-cobranza"',
  "legal/evidencia/[code]/page.tsx": 'id="legal-expediente"',
  "rendiciones/[code]/page.tsx": 'id="rendicion-doc"',
};

describe("SDD-0603 · tramo 5e · archivos liberados (BD-037)", () => {
  it("mira los 8 archivos de la allowlist", () => {
    expect(fuentes.size).toBe(8);
  });

  it.each(ARCHIVOS)("%s cumple su cuenta exacta", (ruta) => {
    expect(violaciones(ruta, fuentes.get(ruta)!)).toEqual([]);
  });

  it(`el grupo deja exactamente ${TOTAL_AVISOS} <Aviso>`, () => {
    let total = 0;
    for (const texto of fuentes.values()) total += contar(texto).aviso;
    expect(total).toBe(TOTAL_AVISOS);
  });

  it.each(Object.keys(PAPEL))("%s: el papel no lleva <Aviso> y su caja de estado queda dentro del documento", (ruta) => {
    const codigo = sinComentarios(fuentes.get(ruta)!);
    const inicioPapel = codigo.indexOf(PAPEL[ruta]);
    const finPapel = codigo.indexOf("@media print");
    expect(inicioPapel, ruta).toBeGreaterThan(-1);
    expect(finPapel, ruta).toBeGreaterThan(inicioPapel);
    expect(codigo, ruta).not.toMatch(PATRONES.aviso);
    for (const m of codigo.matchAll(PATRONES.fondo)) {
      expect(m.index, ruta).toBeGreaterThan(inicioPapel);
      expect(m.index, ruta).toBeLessThan(finPapel);
    }
    expect(codigo, ruta).toContain("[data-print-hide] { display: none !important; }");
  });

  it("«Abrir» de Mis reportes es un secundario con verbo visible y lleva al mismo reporte que la tarjeta", () => {
    const codigo = sinComentarios(fuentes.get("mis-bugs/page.tsx")!);
    const i = codigo.search(PATRONES.abrir);
    const enlace = codigo.slice(codigo.lastIndexOf("<Link", i), codigo.indexOf("</Link>", i));
    expect(enlace).toMatch(/studio-btn /);
    expect(enlace).toMatch(/studio-btn-ghost/);
    expect(enlace).toMatch(/studio-btn-sm/);
    expect(enlace).toMatch(/aria-label=\{`Abrir reporte \$\{bug\.folio\}`\}/);
    expect(enlace).toMatch(/>\s*Abrir\s*\{Icon\.chevR\(14\)\}/);
    expect(codigo.match(/href=\{`\/studio\/mis-bugs\/\$\{bug\.id\}`\}/g)).toHaveLength(2);
    // La tarjeta es la que sale del Tab, no «Abrir».
    expect(enlace).not.toMatch(/tabIndex/);
  });

  it("los vínculos de volver son secundarios de 32 px o más, no texto suelto", () => {
    for (const [ruta, texto] of [
      ["facturacion/[code]/page.tsx", "Volver al listado"],
      ["reportes/embarques-sin-facturar/page.tsx", "← Reportes"],
    ] as const) {
      const codigo = sinComentarios(fuentes.get(ruta)!);
      const i = codigo.indexOf(texto);
      expect(i, ruta).toBeGreaterThan(-1);
      const enlace = codigo.slice(codigo.lastIndexOf("<Link", i), i);
      expect(enlace, ruta).toMatch(/studio-btn studio-btn-ghost studio-btn-sm/);
    }
  });

  it("la factura no usa vino en un vínculo de lectura", () => {
    const codigo = sinComentarios(fuentes.get("facturacion/[code]/page.tsx")!);
    expect(codigo).toContain('className="studio-link-quiet"');
    expect(codigo).not.toMatch(/color: "var\(--wine-text\)"/);
  });

  it("los ítems del menú de usuario no bajan de 32 px", () => {
    const codigo = sinComentarios(fuentes.get("_components/StudioTopbar.tsx")!);
    // «Cerrar sesión» y `MenuItem`: los dos botones de texto del menú.
    expect(codigo.match(/minHeight: 32,/g)).toHaveLength(2);
  });

  it("el enlace de acceso no se pinta: solo va al portapapeles", () => {
    const codigo = sinComentarios(fuentes.get("usuarios/_components/UserDetailDrawer.tsx")!);
    const usos = [...codigo.matchAll(/accesoState\.accessLink/g)];
    // La condición de render y `writeText(...)`. Ningún `{accesoState.accessLink}` como texto.
    expect(usos).toHaveLength(2);
    expect(codigo).not.toMatch(/\{accesoState\.accessLink\}/);
    expect(codigo).toMatch(/writeText\(accesoState\.accessLink as string\)/);
  });

  describe("mutantes", () => {
    const ruta = "usuarios/_components/UserDetailDrawer.tsx";
    const original = fuentes.get(ruta)!;
    const AVISO_ERROR = '<Aviso tono="error" compacto>\n            {error}\n          </Aviso>';

    it("<Aviso> vuelve a <p role=\"alert\"> → rompe", () => {
      const mutado = original.replace(AVISO_ERROR, '<p role="alert">{error}</p>');
      expect(mutado).not.toBe(original);
      expect(violaciones(ruta, mutado)).toEqual(
        expect.arrayContaining([expect.stringContaining("aviso = 5"), expect.stringContaining("rol = 1")]),
      );
    });

    it("vuelve la caja con fondo y contorno de error → rompe", () => {
      const mutado = original.replace(
        AVISO_ERROR,
        '<div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)" }}>{error}</div>',
      );
      expect(mutado).not.toBe(original);
      expect(violaciones(ruta, mutado)).toEqual(
        expect.arrayContaining([
          expect.stringContaining("aviso = 5"),
          expect.stringContaining("contorno = 1"),
          expect.stringContaining("fondo = 1"),
        ]),
      );
    });

    it("un comentario no cuenta: quitar el Aviso y dejarlo citado en un comentario igual rompe", () => {
      const mutado = original.replace(AVISO_ERROR, '<p>{error}</p> {/* antes: <Aviso tono="error"> role="alert" */}');
      expect(mutado).not.toBe(original);
      expect(violaciones(ruta, mutado)).toEqual([expect.stringContaining("aviso = 5")]);
    });

    it("un comentario no suma: citar los patrones en comentarios no cambia la cuenta", () => {
      const mutado = `// role="alert" <Aviso aria-live= tabIndex={-1}\n/* solid var(--danger) var(--danger-bg) */\n${original}`;
      expect(violaciones(ruta, mutado)).toEqual([]);
    });

    it("se quita el import canónico → rompe", () => {
      const mutado = original.replace(IMPORT_AVISO, 'from "./Aviso"');
      expect(mutado).not.toBe(original);
      expect(violaciones(ruta, mutado).length).toBeGreaterThan(0);
    });

    it("la tarjeta de Mis reportes vuelve a ser parada de Tab → rompe", () => {
      const r = "mis-bugs/page.tsx";
      const o = fuentes.get(r)!;
      const mutado = o.replace("tabIndex={-1}", "tabIndex={0}");
      expect(mutado).not.toBe(o);
      expect(violaciones(r, mutado)).toEqual([expect.stringContaining("fueraDeTab = 0")]);
    });

    it("el aviso de créditos vuelve a `alert` con contorno → rompe", () => {
      const r = "facturacion/[code]/page.tsx";
      const o = fuentes.get(r)!;
      const mutado = o.replace(
        '<div style={{ margin: "0 0 var(--s-5)" }}>',
        '<div role="alert" style={{ margin: "0 0 var(--s-5)", border: "1px solid var(--warning)" }}>',
      );
      expect(mutado).not.toBe(o);
      expect(violaciones(r, mutado)).toEqual(
        expect.arrayContaining([expect.stringContaining("rol = 1"), expect.stringContaining("contorno = 1")]),
      );
    });

    it("un <Aviso> dentro del papel del recibo → rompe", () => {
      const r = "cobranzas/recibo/[code]/page.tsx";
      const o = fuentes.get(r)!;
      const mutado = o.replace("Estado: {doc.estadoCliente}", '<Aviso tono="atencion">Estado: {doc.estadoCliente}</Aviso>');
      expect(mutado).not.toBe(o);
      expect(violaciones(r, mutado).length).toBeGreaterThan(0);
    });
  });
});
