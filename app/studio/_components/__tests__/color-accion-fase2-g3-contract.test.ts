/**
 * SDD-0686 · fase 2, grupo 3 (BD-076): el vino de administración, marketing,
 * academia, mailing, inspecciones, usuarios, bitácora y los componentes
 * compartidos del Studio, y los tonos `"wine"` de `lib/studio`.
 *
 * El grupo cierra sin vino de acción en sus carpetas, se escriba como se
 * escriba: token del Studio (`var(--wine…)`), token web (`var(--color-wine…)`),
 * clase Tailwind (`bg-wine`, `hover:border-wine`…), tono de Badge o Avatar por
 * valor (`"wine"`) y hojas `.css`. Lo que queda es identidad: documentos
 * impresos (regla 8), la vista previa de la firma de correo y la tarjeta de la
 * Guía. Cada archivo tiene su motivo y su cuenta exacta; la lista solo baja.
 *
 * Queda fuera de la cuenta, por ser identidad que no se escribe así: las
 * variables `--wine:` que el diploma declara para imprimir
 * (`DiplomasClient.tsx`) y la muestra de paleta de Apariencia
 * (`AppearanceSection.tsx`), que nombran el token como texto.
 *
 * Lo que este contrato no ve (hoy no hay ninguno en el grupo): la variante
 * arbitraria de Tailwind (`[&>svg]:text-wine`), el alias `--studio-wine*` de
 * `studio.css`, un hex de la familia vino escrito a mano (fase 4), un tono
 * armado con plantilla y `var(--wine)` en un `.tsx` de `lib/studio` que no sea
 * tono.
 *
 * En `lib/studio` (`.ts` y `.tsx`) ningún tono vale `"wine"`: las uniones de
 * tipo todavía lo nombran (las limpia la fase 3), pero ninguna función ni mapa
 * lo devuelve.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino, fuentesDe, RAIZ, rel, tonosVino } from "./vino-detector";

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
  ...accionDeNoticiasWeb({
    "_components/CategoryDetector.tsx": 4,
    "_components/KeywordPanel.tsx": 6,
    "_components/ManualPromptModal.tsx": 11,
    "_components/NoticiasWebClient.tsx": 2,
    "_components/PublishModal.tsx": 6,
    "_components/RouteIdeaPanel.tsx": 3,
    "_components/Step0Brief.tsx": 5,
    "_components/Step1Headlines.tsx": 8,
    "_components/Step2Outlines.tsx": 4,
    "_components/Step3Article.tsx": 6,
    "publicadas/[id]/page.tsx": 1,
    "retirar/[id]/page.tsx": 1,
  }),
};

/**
 * noticias-web pinta dentro de un bloque `data-theme="light"` y ningún CSS
 * define ese selector: con el Studio en oscuro, los tokens del Studio toman su
 * valor oscuro sobre el fondo claro (revisión de la #739). Por eso ahí solo van
 * tokens web fijos (`--color-ink`, `--color-grey-*`). La acción (botón
 * principal, hover, foco y enlaces de volver) sigue en `--color-wine` hasta que
 * la fase 3 traiga `--color-accion*`; lo que no es acción ya no está en vino.
 */
function accionDeNoticiasWeb(cuentas: Record<string, number>): Record<string, { cuenta: number; motivo: string }> {
  return Object.fromEntries(
    Object.entries(cuentas).map(([ruta, cuenta]) => [
      `app/studio/(app)/marketing/noticias-web/${ruta}`,
      { cuenta, motivo: "acción en vino dentro del bloque claro: espera `--color-accion*` de la fase 3" },
    ]),
  );
}

const leer = (ruta: string) => readFileSync(ruta, "utf8");

function archivosGrupo3(): string[] {
  const unicos = new Set<string>();
  for (const base of GRUPO_3) {
    for (const ruta of fuentesDe(join(RAIZ, base), /\.(tsx?|css)$/)) {
      if (!rel(ruta).startsWith(DEL_GRUPO_1)) unicos.add(ruta);
    }
  }
  return [...unicos];
}

function cuentas(fuente: (ruta: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ruta of archivosGrupo3()) {
    const n = cuentaVino(fuente(ruta));
    if (n > 0) out[rel(ruta)] = n;
  }
  return out;
}

/** Cuenta del archivo `objetivo` con `de` cambiado por `a`; falla si `de` no está. */
function mutar(objetivo: string, de: string, a: string): number | undefined {
  expect(leer(join(RAIZ, objetivo))).toContain(de);
  return cuentas((ruta) => (rel(ruta) === objetivo ? leer(ruta).replace(de, a) : leer(ruta)))[objetivo];
}

describe("SDD-0686 fase 2 · grupo 3: el vino que queda es identidad", () => {
  it("mide algo: el grupo 3 tiene al menos 150 archivos y al menos un .css", () => {
    const archivos = archivosGrupo3();
    expect(archivos.length).toBeGreaterThanOrEqual(150);
    expect(archivos.filter((r) => r.endsWith(".css")).length).toBeGreaterThanOrEqual(1);
  });

  it("cada archivo con vino está en la lista permitida, con su cuenta exacta", () => {
    const esperado = Object.fromEntries(Object.entries(PERMITIDO).map(([f, v]) => [f, v.cuenta]));
    expect(cuentas(leer)).toEqual(esperado);
  });

  it("mutante: un token del Studio en vino se detecta", () => {
    const objetivo = "app/studio/(app)/admin/_components/WebhookDrawer.tsx";
    expect(mutar(objetivo, 'accentColor: "var(--accion)"', 'accentColor: "var(--wine)"')).toBe(1);
  });

  it("mutante: un token web y una clase Tailwind en vino se detectan", () => {
    const objetivo = "app/studio/(app)/admin/_components/WebhookDrawer.tsx";
    expect(mutar(objetivo, 'accentColor: "var(--accion)"', 'accentColor: "var(--color-wine)"')).toBe(1);
    expect(mutar(objetivo, 'style={{ accentColor: "var(--accion)" }}', 'className="hover:bg-wine-deep" style={{}}')).toBe(1);
  });

  it("mutante: el vino en una hoja .css del grupo se detecta", () => {
    const objetivo = "app/studio/(app)/usuarios/_components/acceso/permisos.css";
    expect(mutar(objetivo, "accent-color: var(--accion);", "accent-color: var(--wine);")).toBe(1);
  });

  it("mutante: un tono de Badge en vino por valor se detecta; una unión o una comparación no", () => {
    const objetivo = "app/studio/(app)/admin/_components/CompanySection.tsx";
    expect(mutar(objetivo, '"VE" ? "neutral" : "info"', '"VE" ? "wine" : "info"')).toBe(1);
    expect(tonosVino('type T = "info" | "wine";\n  | "wine"\nif (t === "wine") {}')).toBe(0);
  });
});

/**
 * Los tonos de `lib/studio` llegan a Badge, Avatar y mapas de color por
 * variable. Un `"wine"` como valor pinta en vino aunque ningún TSX lo escriba.
 */
const LIB_STUDIO = join(RAIZ, "lib", "studio");

function vinoPorValor(archivos: { ruta: string; texto: string }[]): string[] {
  return archivos.filter((a) => tonosVino(a.texto) > 0).map((a) => a.ruta);
}

const fuentesLib = () =>
  fuentesDe(LIB_STUDIO, /\.tsx?$/).map((r) => ({ ruta: rel(r), texto: leer(r) }));

describe("SDD-0686 fase 2 · lib/studio no devuelve el tono \"wine\"", () => {
  it("mide algo: lib/studio tiene al menos 300 archivos, lee los .tsx y las uniones aún nombran \"wine\"", () => {
    const archivos = fuentesLib();
    expect(archivos.length).toBeGreaterThanOrEqual(300);
    expect(archivos.some((a) => a.ruta.endsWith(".tsx"))).toBe(true);
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
    expect(vinoPorValor(archivos)).toEqual(["lib/studio/user-types.ts"]);
  });

  it("mutante: un valor en la misma línea que una unión también se detecta", () => {
    expect(tonosVino('  urgent: "wine" as "wine" | "neutral",')).toBe(1);
  });
});
