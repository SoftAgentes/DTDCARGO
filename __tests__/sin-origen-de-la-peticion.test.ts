// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

/**
 * ⏱️ I/O-BOUND: este contrato RECORRE EL ÁRBOL DE ARCHIVOS del repo (como
 * `sin-git-desde-la-app.test.ts`). El techo se sube ACÁ, no en `vitest.config.ts`.
 */
vi.setConfig({ testTimeout: 120_000 });

/**
 * SDD-0602 · el código del servidor no saca el dominio de la petición.
 *
 * En el contenedor, `request.url` trae `https://0.0.0.0:3000`. Nada lo delata:
 * las pruebas corren con una URL bien formada, `smoke-web` no mira esas rutas y
 * el 307 sale igual. El dominio real solo se ve siguiendo la redirección. Por eso
 * esta regla mira el código: una redirección propia sale con `localRedirect`
 * (`lib/http/local-redirect.ts`), que deja el `Location` relativo. Leer
 * `searchParams` o `pathname` de la petición sigue bien: no dependen del host.
 *
 * Reglas, sobre el código que se publica (sin pruebas). `proxy.ts` queda fuera a
 * propósito: ahí Next deja relativo el `Location` (medido en la imagen real).
 *
 *  1. `base-de-la-peticion`: `new URL("/destino", req.url)`.
 *  2. `host-de-la-peticion`: `req.nextUrl.origin`, `new URL(req.url).host`,
 *     `const { origin } = new URL(request.url)`, también por una variable.
 *  3. `redirect-armado`: `NextResponse.redirect(new URL(a, b))`, con plantilla o
 *     con la petición. Un destino externo con su `https://` sí puede ir directo.
 *  4. `redirect-clonado`: `NextResponse.redirect` de un `req.nextUrl.clone()`,
 *     que en un route handler sale con `0.0.0.0`.
 *
 * Lee con el compilador para que un comentario que cuente la historia no lo ponga
 * en rojo. Una excepción nueva exige una SDD que diga por qué ese camino no arma
 * un destino.
 */

const RAIZ = join(__dirname, "..");
const CARPETAS = ["app", "lib"];
const CODIGO = /\.tsx?$/;
const ES_PRUEBA = /(^|\/)(__tests__|__mocks__)\/|\.(test|spec)\.[cm]?[jt]sx?$/;

/** Lo que trae el host de la petición. El resto de sus propiedades se puede leer. */
const PROPIEDADES_DE_HOST = new Set(["origin", "host", "hostname", "href", "protocol", "port"]);
const PETICION = /^(req|request)\.(url|nextUrl)$/;
const CLON_DE_LA_PETICION = /^(req|request)\.nextUrl\.clone\(\)$/;

type Regla = "base-de-la-peticion" | "host-de-la-peticion" | "redirect-armado" | "redirect-clonado";
type Hallazgo = { regla: Regla; linea: number };

const EXCEPCIONES: Readonly<Record<string, readonly Regla[]>> = {
  // Compara el Origin que manda el navegador, no arma un destino, y descarta
  // antes la dirección donde escucha el servidor.
  "lib/studio/document-import/http.ts": ["host-de-la-peticion"],
  // Corre dentro de `proxy.ts`, donde Next deja relativo el `Location`.
  "lib/runtime/maintenance.ts": ["redirect-clonado"],
};

/** `req.url`, `req.nextUrl` o `new URL(req.url)`. */
function esPeticion(n: ts.Node | undefined, src: ts.SourceFile): boolean {
  if (!n) return false;
  if (ts.isNewExpression(n) && n.expression.getText(src) === "URL") {
    return n.arguments?.length === 1 && esPeticion(n.arguments[0], src);
  }
  return PETICION.test(n.getText(src));
}

function esRedirect(n: ts.CallExpression, src: ts.SourceFile): boolean {
  return /^(NextResponse|Response)\.redirect$/.test(n.expression.getText(src));
}

/** Un destino con `https://` al frente es externo y a propósito; el resto, armado. */
function esCadenaArmada(n: ts.Expression): boolean {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return !/^https?:\/\//.test(n.text);
  return ts.isTemplateExpression(n) && !/^https?:\/\//.test(n.head.text);
}

/** Lo que el detector encuentra en un fuente. Pura: la usan el barrido y sus casos. */
function hallazgosEn(nombre: string, fuente: string): Hallazgo[] {
  const kind = nombre.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const src = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, kind);
  const out: Hallazgo[] = [];
  const marcar = (regla: Regla, n: ts.Node) =>
    out.push({ regla, linea: src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1 });

  // Variables que guardan la petición (`const url = new URL(req.url)`) o su clon.
  const alias = new Set<string>();
  const clones = new Set<string>();
  const juntarAlias = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      if (esPeticion(n.initializer, src)) alias.add(n.name.text);
      if (CLON_DE_LA_PETICION.test(n.initializer.getText(src))) clones.add(n.name.text);
    }
    ts.forEachChild(n, juntarAlias);
  };
  juntarAlias(src);
  const esFuente = (n: ts.Node) => esPeticion(n, src) || (ts.isIdentifier(n) && alias.has(n.text));

  const visitar = (n: ts.Node): void => {
    if (ts.isNewExpression(n) && n.expression.getText(src) === "URL" && n.arguments?.length === 2) {
      if (esFuente(n.arguments[1])) marcar("base-de-la-peticion", n);
    }
    if (ts.isPropertyAccessExpression(n) && PROPIEDADES_DE_HOST.has(n.name.text) && esFuente(n.expression)) {
      marcar("host-de-la-peticion", n);
    }
    if (ts.isVariableDeclaration(n) && ts.isObjectBindingPattern(n.name) && n.initializer && esFuente(n.initializer)) {
      const leidas = n.name.elements.map((e) => (e.propertyName ?? e.name).getText(src));
      if (leidas.some((p) => PROPIEDADES_DE_HOST.has(p))) marcar("host-de-la-peticion", n);
    }
    if (ts.isCallExpression(n) && esRedirect(n, src) && n.arguments[0]) {
      const destino = n.arguments[0];
      const conBase = ts.isNewExpression(destino) && destino.arguments?.length === 2;
      if (conBase || esCadenaArmada(destino) || esFuente(destino)) marcar("redirect-armado", n);
      if (ts.isIdentifier(destino) ? clones.has(destino.text) : CLON_DE_LA_PETICION.test(destino.getText(src))) {
        marcar("redirect-clonado", n);
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(src);
  return out;
}

const rel = (abs: string) => relative(RAIZ, abs).split("\\").join("/");

function archivos(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) archivos(p, acc);
    else if (CODIGO.test(e.name) && !ES_PRUEBA.test(rel(p))) acc.push(p);
  }
  return acc;
}

function barrer() {
  const rutas = CARPETAS.flatMap((c) => archivos(join(RAIZ, c)));
  const ofensores: string[] = [];
  const excepcionesUsadas = new Set<string>();
  for (const abs of rutas) {
    const r = rel(abs);
    const fuente = readFileSync(abs, "utf8");
    if (!/\b(req|request)\b|\.redirect\(/.test(fuente)) continue;
    for (const h of hallazgosEn(r, fuente)) {
      if (EXCEPCIONES[r]?.includes(h.regla)) excepcionesUsadas.add(`${r} ${h.regla}`);
      else ofensores.push(`${r}:${h.linea} ${h.regla}`);
    }
  }
  return { rutas: rutas.map(rel), ofensores, excepcionesUsadas };
}

describe("SDD-0602 · nadie saca el dominio de la petición", () => {
  const { rutas, ofensores, excepcionesUsadas } = barrer();

  it("app/ y lib/ redirigen con localRedirect, sin el host de la petición", () => {
    expect(
      ofensores,
      "En el contenedor, request.url es https://0.0.0.0:3000. Usa localRedirect (lib/http/local-redirect.ts):\n" +
        ofensores.join("\n"),
    ).toEqual([]);
  });

  it("el barrido mira las rutas que tuvieron el defecto (no es verde por vacío)", () => {
    expect(rutas.length).toBeGreaterThan(500);
    expect(rutas).toContain("app/portal/(auth)/callback/route.ts");
    expect(rutas).toContain("app/ir/bitacora/tarea/[id]/route.ts");
    expect(rutas).toContain("app/p/[token]/packlist/route.ts");
    expect(rutas).toContain("lib/studio/mail/unsubscribe-request.ts");
    expect(rutas).toContain("lib/studio/document-import/http.ts");
    expect(rutas.some((r) => ES_PRUEBA.test(r))).toBe(false);
  });

  it("las excepciones son estas dos y siguen haciendo falta", () => {
    const esperadas = ["lib/runtime/maintenance.ts redirect-clonado", "lib/studio/document-import/http.ts host-de-la-peticion"];
    const declaradas = Object.entries(EXCEPCIONES).flatMap(([ruta, reglas]) => reglas.map((regla) => `${ruta} ${regla}`));
    expect(declaradas.sort()).toEqual(esperadas);
    expect([...excepcionesUsadas].sort()).toEqual(esperadas);
  });
});

describe("SDD-0602 · el detector", () => {
  it.each<[string, string, Regla]>([
    ["el callback", "const { searchParams, origin } = new URL(request.url);", "host-de-la-peticion"],
    ["la baja", "NextResponse.redirect(new URL(`/email/baja?estado=${state}`, req.url), 303);", "base-de-la-peticion"],
    ["el enlace de Bitácora", "return NextResponse.redirect(new URL(dest, req.url));", "base-de-la-peticion"],
    ["el packing list", "const tplUrl = new URL(TEMPLATE_PATH, req.nextUrl.origin);", "host-de-la-peticion"],
    ["la lista de orígenes", "allowed.add(req.nextUrl.origin);", "host-de-la-peticion"],
    ["con nextUrl de base", "new URL(dest, request.nextUrl);", "base-de-la-peticion"],
    ["directo", "const h = new URL(req.url).host;", "host-de-la-peticion"],
    ["por una variable", "const url = new URL(req.url); send(url.origin + '/x');", "host-de-la-peticion"],
    ["de base por una variable", "const url = new URL(req.url); new URL('/x', url);", "base-de-la-peticion"],
    ["renombrado", "const { origin: o } = request.nextUrl;", "host-de-la-peticion"],
    ["redirect con otra base", "NextResponse.redirect(new URL('/x', base));", "redirect-armado"],
    ["redirect con plantilla", "NextResponse.redirect(`${origin}/portal`);", "redirect-armado"],
    ["redirect a una ruta", "NextResponse.redirect('/portal');", "redirect-armado"],
    ["redirect a la petición", "NextResponse.redirect(req.url);", "redirect-armado"],
    ["Response.redirect", "Response.redirect(`${origin}/portal`, 303);", "redirect-armado"],
    ["clon por una variable", "const url = request.nextUrl.clone(); url.pathname = '/x'; return NextResponse.redirect(url);", "redirect-clonado"],
    ["clon directo", "return NextResponse.redirect(req.nextUrl.clone());", "redirect-clonado"],
  ])("encuentra %s", (_nombre, fuente, regla) => {
    expect(hallazgosEn("x.ts", fuente).map((h) => h.regla)).toContain(regla);
  });

  it.each([
    ["una función con otro nombre de variable", "export const f = (requestUrl: string) => new URL(requestUrl).origin;"],
    ["leer parámetros", "const { searchParams } = new URL(req.url); const q = req.nextUrl.searchParams.get('q');"],
    ["leer la ruta", "const { pathname } = request.nextUrl;"],
    ["un parámetro por una variable", "const url = new URL(req.url); url.searchParams.get('dry');"],
    ["el camino relativo", "return localRedirect(`/email/baja?estado=${state}`, 303);"],
    ["una URL firmada", "return NextResponse.redirect(signed.data.signedUrl, 303);"],
    ["un destino externo", "return NextResponse.redirect(`https://wa.me/${numero}`);"],
    ["un clon que no redirige", "const url = request.nextUrl.clone(); url.pathname = '/x';"],
    ["una cabecera Origin", "const o = req.headers.get('origin');"],
    ["el origen de otra cosa", "const o = route.origin; const s = shipment.origin;"],
    ["un comentario que cuenta la historia", "// new URL(dest, req.url) y req.nextUrl.origin\n/* const { origin } = new URL(request.url) */"],
  ])("no confunde %s", (_nombre, fuente) => {
    expect(hallazgosEn("x.ts", fuente)).toEqual([]);
  });
});
