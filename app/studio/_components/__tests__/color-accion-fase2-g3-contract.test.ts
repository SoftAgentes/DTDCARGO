/**
 * SDD-0686 · fase 2, grupo 3 (BD-076): el vino en línea de administración,
 * marketing, academia, mailing, inspecciones, usuarios, bitácora y los
 * componentes compartidos del Studio, y los tonos `"wine"` de `lib/studio`.
 *
 * Lo que queda en vino en esas carpetas es identidad: documentos impresos
 * (regla 8), la vista previa de la firma de correo y la tarjeta de la Guía.
 * Cada archivo tiene su motivo y su cuenta exacta. La lista solo puede bajar.
 *
 * En `lib/studio` ningún tono vale `"wine"`: las uniones de tipo todavía lo
 * nombran (las limpia la fase 3), pero ninguna función ni mapa lo devuelve.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");

const VINO = /var\(--(?:grad-)?wine[a-z-]*/g;

/** Carpetas del grupo 3. `_components/ui` es del grupo 1 y se salta. */
const GRUPO_3 = [
  "app/studio/(app)/admin",
  "app/studio/(app)/marketing",
  "app/studio/(app)/academia",
  "app/studio/(app)/mailing",
  "app/studio/(app)/inspecciones",
  "app/studio/(app)/usuarios",
  "app/studio/(app)/bitacora",
  "app/studio/_components",
];
const DEL_GRUPO_1 = "app/studio/_components/ui/";

/** Lo único que puede quedar en vino en el grupo 3, con su motivo. */
const PERMITIDO: Record<string, { cuenta: number; motivo: string }> = {
  "app/studio/(app)/academia/diplomas/_components/DiplomaPrint.tsx": {
    cuenta: 26,
    motivo: "diploma impreso: documento de marca (BD-076 regla 8); se revisa con los PDF en la fase 4",
  },
  "app/studio/(app)/inspecciones/_components/report-css.ts": {
    cuenta: 2,
    motivo: "informe impreso: wordmark y rótulo del encabezado (regla 8: vino solo en logo y encabezado)",
  },
  "app/studio/(app)/mailing/_components/SignaturesView.tsx": {
    cuenta: 1,
    motivo: "franja de la vista previa de la firma de correo: el correo lleva el encabezado en vino (regla 8)",
  },
  "app/studio/_components/guia/GuiaTarjeta.tsx": {
    cuenta: 6,
    motivo: "superficie, franja y rótulos propios de la Guía con el tinte de marca: identidad, no acción",
  },
};

function fuentesDe(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre === "__tests__") continue;
      salida.push(...fuentesDe(ruta));
    } else if (/\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) {
      salida.push(ruta);
    }
  }
  return salida;
}

const rel = (ruta: string) => relative(RAIZ, ruta).split(sep).join("/");
const leer = (ruta: string) => readFileSync(ruta, "utf8");

function archivosGrupo3(): string[] {
  const unicos = new Set<string>();
  for (const base of GRUPO_3) {
    for (const ruta of fuentesDe(join(RAIZ, base))) {
      if (!rel(ruta).startsWith(DEL_GRUPO_1)) unicos.add(ruta);
    }
  }
  return [...unicos];
}

function cuentas(fuente: (ruta: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ruta of archivosGrupo3()) {
    const n = (fuente(ruta).match(VINO) ?? []).length;
    if (n > 0) out[rel(ruta)] = n;
  }
  return out;
}

describe("SDD-0686 fase 2 · grupo 3: el vino que queda es identidad", () => {
  it("mide algo: el grupo 3 tiene al menos 150 archivos de producción", () => {
    expect(archivosGrupo3().length).toBeGreaterThanOrEqual(150);
  });

  it("cada archivo con vino está en la lista permitida, con su cuenta exacta", () => {
    const esperado = Object.fromEntries(Object.entries(PERMITIDO).map(([f, v]) => [f, v.cuenta]));
    expect(cuentas(leer)).toEqual(esperado);
  });

  it("mutante: devolver el vino a un enlace de «Editar →» rompe el contrato", () => {
    const objetivo = "app/studio/(app)/admin/_components/CalendarSection.tsx";
    const mutado = cuentas((ruta) =>
      rel(ruta) === objetivo
        ? leer(ruta).replace('color: "var(--accion-text)", justifySelf', 'color: "var(--wine-text)", justifySelf')
        : leer(ruta),
    );
    expect(mutado[objetivo]).toBe(1);
  });
});

/**
 * Los tonos de `lib/studio` llegan a Badge, Avatar y mapas de color por
 * variable. Un `"wine"` como valor (no como miembro de una unión de tipo)
 * pinta en vino aunque ningún TSX lo escriba.
 */
const LIB_STUDIO = join(RAIZ, "lib", "studio");

/** Líneas que dan "wine" como valor: no las que lo nombran en una unión `a | "wine"`. */
function vinoPorValor(archivos: { ruta: string; texto: string }[]): string[] {
  const hallazgos: string[] = [];
  for (const a of archivos) {
    a.texto.split("\n").forEach((linea, i) => {
      if (!/["']wine["']/.test(linea)) return;
      if (/\|\s*["']wine["']|["']wine["']\s*\|/.test(linea)) return;
      hallazgos.push(`${a.ruta}:${i + 1}`);
    });
  }
  return hallazgos;
}

const fuentesLib = () =>
  fuentesDe(LIB_STUDIO)
    .filter((r) => /\.ts$/.test(r))
    .map((r) => ({ ruta: rel(r), texto: leer(r) }));

describe("SDD-0686 fase 2 · lib/studio no devuelve el tono \"wine\"", () => {
  it("mide algo: lib/studio tiene al menos 300 archivos y las uniones aún nombran \"wine\"", () => {
    const archivos = fuentesLib();
    expect(archivos.length).toBeGreaterThanOrEqual(300);
    const uniones = archivos.filter((a) => /\|\s*"wine"|"wine"\s*\|/.test(a.texto)).length;
    expect(uniones).toBeGreaterThanOrEqual(10);
  });

  it("ningún archivo de lib/studio da \"wine\" como valor", () => {
    expect(vinoPorValor(fuentesLib())).toEqual([]);
  });

  it("mutante: volver a dar \"wine\" al rol admin rompe el contrato", () => {
    const archivos = fuentesLib().map((a) =>
      a.ruta === "lib/studio/user-types.ts"
        ? { ...a, texto: a.texto.replace('if (r === "admin") return "neutral";', 'if (r === "admin") return "wine";') }
        : a,
    );
    expect(vinoPorValor(archivos)).toHaveLength(1);
    expect(vinoPorValor(archivos)[0]).toMatch(/^lib\/studio\/user-types\.ts:\d+$/);
  });
});
