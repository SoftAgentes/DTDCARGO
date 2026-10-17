// @vitest-environment node
/**
 * SDD-0512 — `/back` fuera de los buscadores.
 *
 * El 2026-10-14 `https://dtdcargo.com/back/login` respondía 200 con
 * `<meta name="robots" content="index, follow">`: los grupos `(auth)` y `(app)`
 * de `app/back` no declaraban `robots`, la página de login es un client
 * component (no puede exportar `metadata`) y no había layout raíz del back, así
 * que heredaba el `index: true` de `app/layout.tsx`. `/studio`, `/portal` y `/m`
 * no tenían el problema porque lo declaran en su layout raíz.
 *
 * `sitemap-cobertura-contract.test.ts` daba `back` por privada sin mirar si de
 * verdad salía con noindex. Este contrato es esa comprobación.
 *
 * Cómo resuelve Next la metadata: del layout raíz hacia la página, y un campo
 * anidado como `robots` lo REEMPLAZA entero el nivel más profundo que lo
 * declara. Por eso el resolutor sube desde la página (primero el `page`, luego
 * el `layout` de su carpeta y los de cada carpeta padre) y se queda con el
 * primer `robots` que encuentra. Lee el código con el compilador de TypeScript
 * en vez de importar los módulos: los layouts del back importan la sesión de
 * Supabase y `next/headers`, que no tienen sentido fuera de una petición.
 */
import { describe, it, expect, vi } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import ts from "typescript";
import robots from "@/app/robots";

// I/O-bound: recorre `app/back` y lee una decena de archivos. Mismo criterio que
// `sitemap-cobertura-contract.test.ts`: el techo se sube acá, no en la config.
vi.setConfig({ testTimeout: 120_000 });

const RAIZ = process.cwd();
const APP = join(RAIZ, "app");

type Robots = { index: boolean; follow: boolean };
/** `dinamico`: `generateMetadata` o un valor que no se puede leer sin ejecutar. */
type Declarado = Robots | "dinamico" | null;

const rel = (abs: string) => relative(RAIZ, abs).split("\\").join("/");

function sinEnvoltorio(e: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isSatisfiesExpression(e)
  ) {
    e = e.expression;
  }
  return e;
}

function propiedad(
  obj: ts.ObjectLiteralExpression,
  nombre: string,
): ts.Expression | undefined {
  for (const p of obj.properties) {
    if (
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === nombre
    ) {
      return sinEnvoltorio(p.initializer);
    }
  }
  return undefined;
}

/** `true`/`false` literal; `undefined` si falta (Next no emite la directiva). */
function booleano(e: ts.Expression | undefined): boolean | undefined | "dinamico" {
  if (e === undefined) return undefined;
  if (e.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (e.kind === ts.SyntaxKind.FalseKeyword) return false;
  return "dinamico";
}

function leerRobots(valor: ts.Expression): Declarado {
  if (ts.isStringLiteral(valor) || ts.isNoSubstitutionTemplateLiteral(valor)) {
    const directivas = valor.text.split(",").map((d) => d.trim());
    return {
      index: !directivas.includes("noindex"),
      follow: !directivas.includes("nofollow"),
    };
  }
  if (!ts.isObjectLiteralExpression(valor)) return "dinamico";
  const index = booleano(propiedad(valor, "index"));
  const follow = booleano(propiedad(valor, "follow"));
  if (index === "dinamico" || follow === "dinamico") return "dinamico";
  // Sin la directiva, los buscadores indexan y siguen: es el valor por defecto.
  return { index: index ?? true, follow: follow ?? true };
}

/** El `robots` que declara un page/layout; `null` si no declara y hereda. */
function robotsDeclarado(abs: string): Declarado {
  const src = ts.createSourceFile(
    abs,
    readFileSync(abs, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  for (const st of src.statements) {
    const exportado =
      ts.canHaveModifiers(st) &&
      (ts.getModifiers(st) ?? []).some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword,
      );
    if (!exportado) continue;
    if (ts.isFunctionDeclaration(st) && st.name?.text === "generateMetadata") {
      return "dinamico";
    }
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) continue;
      if (d.name.text === "generateMetadata") return "dinamico";
      if (d.name.text !== "metadata" || !d.initializer) continue;
      const obj = sinEnvoltorio(d.initializer);
      if (!ts.isObjectLiteralExpression(obj)) return "dinamico";
      const valor = propiedad(obj, "robots");
      return valor === undefined ? null : leerRobots(valor);
    }
  }
  return null;
}

function layoutDe(dir: string): string | null {
  for (const nombre of ["layout.tsx", "layout.ts"]) {
    const abs = join(dir, nombre);
    if (existsSync(abs)) return abs;
  }
  return null;
}

/** Lo que Next le pone a `<meta name="robots">` para esa página, y quién lo pone. */
function resolver(pagina: string): { robots: Robots | "dinamico"; fuente: string } {
  const cadena = [pagina];
  let dir = dirname(pagina);
  for (;;) {
    const layout = layoutDe(dir);
    if (layout) cadena.push(layout);
    if (dir === APP) break;
    const padre = dirname(dir);
    if (padre === dir) throw new Error(`${rel(pagina)} no está bajo app/`);
    dir = padre;
  }
  for (const archivo of cadena) {
    const r = robotsDeclarado(archivo);
    if (r !== null) return { robots: r, fuente: rel(archivo) };
  }
  return {
    robots: { index: true, follow: true },
    fuente: "(nadie lo declara: los buscadores indexan por defecto)",
  };
}

function paginas(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    // `_carpeta` es privada en el App Router: no es una ruta.
    if (e.name.startsWith("_") || e.name.startsWith(".")) continue;
    const abs = join(dir, e.name);
    if (e.isDirectory()) out.push(...paginas(abs));
    else if (e.name === "page.tsx" || e.name === "page.ts") out.push(abs);
  }
  return out;
}

const NOINDEX: Robots = { index: false, follow: false };

describe("SDD-0512 · /back no se indexa", () => {
  const delBack = paginas(join(APP, "back"));

  it("encuentra las páginas de /back (sanity)", () => {
    expect(delBack.map(rel)).toEqual(
      expect.arrayContaining([
        "app/back/(auth)/login/page.tsx",
        "app/back/(app)/page.tsx",
      ]),
    );
  });

  it("toda página de /back sale con noindex, nofollow", () => {
    const indexables = delBack
      .map((p) => ({ pagina: rel(p), ...resolver(p) }))
      .filter((r) => JSON.stringify(r.robots) !== JSON.stringify(NOINDEX))
      .map((r) => `${r.pagina} → ${JSON.stringify(r.robots)} (lo pone ${r.fuente})`);
    expect(
      indexables,
      `Estas páginas de /back no salen con noindex, nofollow:\n${indexables.join("\n")}\n` +
        "El robots del back vive en app/back/layout.tsx. Si una página declara " +
        "su propio robots, lo reemplaza entero: no lo declares ahí.",
    ).toEqual([]);
  });

  it("el resolutor ve el noindex de Studio, Portal y el operario (control)", () => {
    for (const pagina of [
      "app/studio/(auth)/login/page.tsx",
      "app/portal/(auth)/registro/page.tsx",
      "app/m/page.tsx",
    ]) {
      expect(resolver(join(RAIZ, pagina)).robots, pagina).toEqual(NOINDEX);
    }
  });

  it("y ve que la home sigue indexable por el layout raíz (control)", () => {
    expect(resolver(join(APP, "page.tsx"))).toEqual({
      robots: { index: true, follow: true },
      fuente: "app/layout.tsx",
    });
  });
});

describe("SDD-0512 · robots.txt deja leer el noindex de /back", () => {
  const reglas = robots().rules;
  const prefijos = (Array.isArray(reglas) ? reglas : [reglas]).flatMap(
    (r) => (r.disallow === undefined ? [] : [r.disallow].flat()),
  );
  const bloquea = (ruta: string) => prefijos.some((p) => ruta.startsWith(p));

  it("bloquea lo que dice bloquear (control)", () => {
    expect(bloquea("/interno/marca")).toBe(true);
    expect(bloquea("/marca")).toBe(true);
  });

  it("no bloquea /back: si Google no puede rastrearla, no lee el noindex", () => {
    // `/back/login` se sirvió con `index, follow` hasta este arreglo y puede
    // estar en el índice. Un Disallow le impide a Google volver a leerla y ver
    // el noindex: la URL se queda indexada «URL-only». Mismo criterio que
    // `/track/` en `app/robots.ts`. `/interno/` sí va al Disallow porque nació
    // noindex. Revisitar sólo cuando Search Console confirme que /back salió
    // del índice.
    expect(bloquea("/back")).toBe(false);
    expect(bloquea("/back/login")).toBe(false);
  });
});
