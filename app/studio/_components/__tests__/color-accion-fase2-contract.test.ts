/**
 * SDD-0686 · fase 2, grupo 1 (BD-076): el vino en línea del marco del Studio
 * (menú lateral, barra superior, comentarios), de las primitivas de UI y del
 * dashboard.
 *
 * Lo que queda en vino en esos archivos es identidad, o el tono `wine` de Badge,
 * marcado como obsoleto. Cada uso tiene su motivo y su cuenta exacta. La lista
 * solo puede bajar: si un archivo gana un `var(--wine…)`, este contrato falla.
 *
 * Además, ningún archivo del Studio usa `<Badge tone="wine">`. El tono se retiró
 * con la regla 7 de BD-076: `neutral` si informa, `success` si confirma.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const STUDIO = join(RAIZ, "app", "studio");

const VINO = /var\(--(?:grad-)?wine[a-z-]*/g;

/**
 * Carpetas de los grupos 1 (marco, primitivas, dashboard) y 2 (operación diaria).
 * Todo TSX de producción dentro entra a la cuenta.
 */
const GRUPO_1 = [
  "app/studio/_components/ui",
  "app/studio/(app)/_components",
  "app/studio/(app)/dashboard",
  "app/studio/(app)/embarques",
  "app/studio/(app)/tracking",
  "app/studio/(app)/clientes",
  "app/studio/(app)/cn",
  "app/studio/(app)/cobranzas",
  "app/studio/(app)/facturacion",
  "app/studio/(app)/crm",
];

/** Lo único que puede quedar en vino en el grupo 1, con su motivo. */
const PERMITIDO: Record<string, { cuenta: number; motivo: string }> = {
  "app/studio/_components/ui/Avatar.tsx": {
    cuenta: 2,
    motivo: "tono `wine` del avatar (iniciales): decoración de persona, no acción; se decide con el resto de avatares",
  },
  "app/studio/_components/ui/Badge.tsx": {
    cuenta: 1,
    motivo: "tono `wine` obsoleto (BD-076 regla 7); lo usa el móvil hasta la fase 3",
  },
  "app/studio/_components/ui/EmptyState.tsx": {
    cuenta: 1,
    motivo: "eyebrow de identidad, igual que el guión de `.studio-eyebrow`",
  },
  "app/studio/(app)/dashboard/page.tsx": {
    cuenta: 1,
    motivo: "panel de bienvenida con degradado de marca (BD-034): identidad",
  },
};

function tsxDe(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre === "__tests__") continue;
      salida.push(...tsxDe(ruta));
    } else if (/\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) {
      salida.push(ruta);
    }
  }
  return salida;
}

const rel = (ruta: string) => relative(RAIZ, ruta).split(sep).join("/");

function cuentas(fuente: (ruta: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const base of GRUPO_1) {
    for (const ruta of tsxDe(join(RAIZ, base))) {
      const n = (fuente(ruta).match(VINO) ?? []).length;
      if (n > 0) out[rel(ruta)] = n;
    }
  }
  return out;
}

const leer = (ruta: string) => readFileSync(ruta, "utf8");

describe("SDD-0686 fase 2 · grupo 1: el vino que queda es identidad", () => {
  it("mide algo: el grupo 1 tiene al menos 40 archivos de producción", () => {
    const total = GRUPO_1.flatMap((b) => tsxDe(join(RAIZ, b))).length;
    expect(total).toBeGreaterThanOrEqual(40);
  });

  it("cada archivo con vino está en la lista permitida, con su cuenta exacta", () => {
    const esperado = Object.fromEntries(Object.entries(PERMITIDO).map(([f, v]) => [f, v.cuenta]));
    expect(cuentas(leer)).toEqual(esperado);
  });

  it("mutante: devolver el vino al botón de columnas rompe el contrato", () => {
    const objetivo = rel(join(STUDIO, "_components", "ui", "columns", "ColumnConfig.tsx"));
    const mutado = cuentas((ruta) =>
      rel(ruta) === objetivo ? leer(ruta).replace('accentColor: "var(--accion)"', 'accentColor: "var(--wine)"') : leer(ruta),
    );
    expect(mutado[objetivo]).toBe(1);
  });

  it("ningún archivo del Studio usa <Badge tone=\"wine\">", () => {
    const conVino = tsxDe(STUDIO)
      .filter((ruta) => /<Badge\b[^>]*\btone="wine"/.test(leer(ruta)))
      .map(rel);
    expect(conVino).toEqual([]);
  });

  it("mutante: un badge en vino se detecta", () => {
    const texto = '<Badge tone="wine" size="sm">Admin</Badge>';
    expect(/<Badge\b[^>]*\btone="wine"/.test(texto)).toBe(true);
  });

  it("el dashboard no pinta cifras, gráficas ni estados de viaje en vino", () => {
    const dash = tsxDe(join(STUDIO, "(app)", "dashboard")).map(leer).join("\n");
    expect(dash).not.toMatch(/fill="var\(--wine/);
    expect(dash).not.toMatch(/(in_transit|out_for_delivery|last_mile): "var\(--wine/);
    expect(dash).not.toMatch(/tone: "wine"/);
  });
});

/**
 * El color del dashboard también llega por variable: el catálogo
 * (`lib/studio/dashboard/`) da a cada KPI un tono, `TONE_TO_VALUE_COLOR` lo
 * vuelve token y el editor arma `var(--${meta.tone})` para el icono. Si el
 * catálogo vuelve a decir `"wine"`, el valor y el icono se pintan en vino
 * aunque ningún TSX lo escriba. Sam: «cifras y gráficas en tinta» (§10.5).
 */
const LIB_DASHBOARD = join(RAIZ, "lib", "studio", "dashboard");
const fuentesLib = () =>
  readdirSync(LIB_DASHBOARD)
    .filter((n) => /\.ts$/.test(n) && !/\.test\.ts$/.test(n))
    .map((n) => ({ ruta: rel(join(LIB_DASHBOARD, n)), texto: leer(join(LIB_DASHBOARD, n)) }));

/** Lo que pinta en vino desde el catálogo: un tono "wine" o un token de vino. */
const VINO_POR_VARIABLE = /\btone:\s*[^,\n}]*"wine"|\bwine:\s*"var\(--wine|var\(--wine/;

function vinoEnCatalogo(archivos: { ruta: string; texto: string }[]): string[] {
  return archivos.filter((a) => VINO_POR_VARIABLE.test(a.texto)).map((a) => a.ruta);
}

describe("SDD-0686 fase 2 · el catálogo del dashboard no pinta en vino por variable", () => {
  it("mide algo: el catálogo y las consultas de KPI existen y dan tonos", () => {
    const archivos = fuentesLib();
    expect(archivos.map((a) => a.ruta)).toEqual(
      expect.arrayContaining([
        "lib/studio/dashboard/dashboard-catalog.ts",
        "lib/studio/dashboard/dashboard-kpi-queries.ts",
      ]),
    );
    const tonos = archivos.map((a) => (a.texto.match(/\btone:\s*"/g) ?? []).length).reduce((x, y) => x + y, 0);
    expect(tonos).toBeGreaterThanOrEqual(10);
  });

  it("ningún archivo de lib/studio/dashboard da un tono o un token de vino", () => {
    expect(vinoEnCatalogo(fuentesLib())).toEqual([]);
  });

  it("KpiTone no admite \"wine\" y TONE_TO_VALUE_COLOR no tiene clave de vino", () => {
    const catalogo = leer(join(LIB_DASHBOARD, "dashboard-catalog.ts"));
    const tipo = catalogo.match(/export type KpiTone =([^;]+);/)?.[1] ?? "";
    expect(tipo).toMatch(/"neutral"/);
    expect(tipo).not.toMatch(/"wine"/);
    const mapa = catalogo.match(/TONE_TO_VALUE_COLOR[^=]*=\s*\{([\s\S]*?)\};/)?.[1] ?? "";
    expect(mapa).toMatch(/neutral:/);
    expect(mapa).not.toMatch(/\bwine\b/);
  });

  it("mutante: volver a poner el vino en un KPI del catálogo rompe el contrato", () => {
    const archivos = fuentesLib().map((a) =>
      a.ruta.endsWith("dashboard-catalog.ts")
        ? { ...a, texto: a.texto.replace('icon: "box",       tone: "neutral"', 'icon: "box",       tone: "wine"') }
        : a,
    );
    expect(archivos.some((a) => a.texto.includes('tone: "wine"'))).toBe(true);
    expect(vinoEnCatalogo(archivos)).toEqual(["lib/studio/dashboard/dashboard-catalog.ts"]);
  });

  it("mutante: un tono condicional en vino en las consultas también se detecta", () => {
    const archivos = fuentesLib().map((a) =>
      a.ruta.endsWith("dashboard-kpi-queries.ts")
        ? { ...a, texto: a.texto.replace('>= 0 ? "neutral" : "danger"', '>= 0 ? "wine" : "danger"') }
        : a,
    );
    expect(vinoEnCatalogo(archivos)).toEqual(["lib/studio/dashboard/dashboard-kpi-queries.ts"]);
  });
});
