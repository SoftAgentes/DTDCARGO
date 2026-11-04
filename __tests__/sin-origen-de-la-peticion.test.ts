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
 * esta regla mira el código: para armar un destino se usa `publicOrigin`
 * (`lib/runtime/public-origin.ts`). Leer `searchParams` o `pathname` de la
 * petición sigue bien: eso no depende del host.
 *
 * Lee con el compilador para que un comentario que cuente la historia no lo ponga
 * en rojo. La lista de excepciones está vacía; agregar una exige una SDD.
 */

const RAIZ = join(__dirname, "..");
const CARPETAS = ["app", "lib"];
const EXCEPCIONES: readonly string[] = [];
const CODIGO = /\.tsx?$/;
const ES_PRUEBA = /(^|\/)(__tests__|__mocks__)\/|\.(test|spec)\.[cm]?[jt]sx?$/;

/** Lo que trae el host de la petición. Se puede leer el resto de sus propiedades. */
const PROPIEDADES_DE_HOST = new Set(["origin", "host", "hostname", "href", "protocol", "port"]);
const PETICION = /^(req|request)\.(url|nextUrl)$/;

type Regla = "base-de-la-peticion" | "host-de-la-peticion";
type Hallazgo = { regla: Regla; linea: number };

/** `Request.url`, `Request.nextUrl`, o `new URL(request.url)`. */
function esPeticion(n: ts.Node | undefined, src: ts.SourceFile): boolean {
  if (!n) return false;
  if (ts.isNewExpression(n) && n.expression.getText(src) === "URL") {
    return n.arguments?.length === 1 && esPeticion(n.arguments[0], src);
  }
  return PETICION.test(n.getText(src));
}

/** Lo que el detector encuentra en un fuente. Pura: la usan el barrido y sus casos. */
function hallazgosEn(nombre: string, fuente: string): Hallazgo[] {
  const kind = nombre.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const src = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, kind);
  const out: Hallazgo[] = [];
  const marcar = (regla: Regla, n: ts.Node) =>
    out.push({ regla, linea: src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1 });

  // Variables que guardan la petición: `const url = new URL(req.url);`.
  const alias = new Set<string>();
  const juntarAlias = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && esPeticion(n.initializer, src)) alias.add(n.name.text);
    ts.forEachChild(n, juntarAlias);
  };
  juntarAlias(src);
  const esFuente = (n: ts.Node) => esPeticion(n, src) || (ts.isIdentifier(n) && alias.has(n.text));

  const visitar = (n: ts.Node): void => {
    // new URL("/destino", req.url)
    if (ts.isNewExpression(n) && n.expression.getText(src) === "URL" && n.arguments?.length === 2) {
      if (esFuente(n.arguments[1])) marcar("base-de-la-peticion", n);
    }
    // req.nextUrl.origin, new URL(req.url).host, url.origin
    if (ts.isPropertyAccessExpression(n) && PROPIEDADES_DE_HOST.has(n.name.text) && esFuente(n.expression)) {
      marcar("host-de-la-peticion", n);
    }
    // const { origin } = new URL(request.url)
    if (ts.isVariableDeclaration(n) && ts.isObjectBindingPattern(n.name) && n.initializer && esFuente(n.initializer)) {
      const leidas = n.name.elements.map((e) => (e.propertyName ?? e.name).getText(src));
      if (leidas.some((p) => PROPIEDADES_DE_HOST.has(p))) marcar("host-de-la-peticion", n);
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
  for (const abs of rutas) {
    const r = rel(abs);
    if (EXCEPCIONES.includes(r)) continue;
    const fuente = readFileSync(abs, "utf8");
    if (!/\b(req|request)\b/.test(fuente)) continue;
    for (const h of hallazgosEn(r, fuente)) ofensores.push(`${r}:${h.linea} ${h.regla}`);
  }
  return { rutas: rutas.map(rel), ofensores };
}

describe("SDD-0602 · nadie saca el dominio de la petición", () => {
  const { rutas, ofensores } = barrer();

  it("app/ y lib/ arman sus destinos con publicOrigin", () => {
    expect(
      ofensores,
      "En el contenedor, request.url es https://0.0.0.0:3000. Usa publicOrigin (lib/runtime/public-origin.ts):\n" +
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

  it("la lista de excepciones está vacía", () => {
    expect(EXCEPCIONES).toEqual([]);
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
    ["por una variable", "const url = new URL(req.url); redirect(url.origin + '/x');", "host-de-la-peticion"],
    ["de base por una variable", "const url = new URL(req.url); new URL('/x', url);", "base-de-la-peticion"],
    ["renombrado", "const { origin: o } = request.nextUrl;", "host-de-la-peticion"],
  ])("encuentra %s", (_nombre, fuente, regla) => {
    expect(hallazgosEn("x.ts", fuente).map((h) => h.regla)).toContain(regla);
  });

  it.each([
    ["el helper", "export const f = (requestUrl: string) => new URL(requestUrl).origin;"],
    ["leer parámetros", "const { searchParams } = new URL(req.url); const q = req.nextUrl.searchParams.get('q');"],
    ["leer la ruta", "const { pathname } = request.nextUrl;"],
    ["un parámetro por una variable", "const url = new URL(req.url); url.searchParams.get('dry');"],
    ["clonar en proxy.ts, que Next deja relativo", "const url = request.nextUrl.clone(); url.pathname = '/x';"],
    ["el destino con publicOrigin", "new URL(dest, publicOrigin(req.url));"],
    ["una cabecera Origin", "const o = req.headers.get('origin');"],
    ["el origen de otra cosa", "const o = route.origin; const s = shipment.origin;"],
    ["un comentario que cuenta la historia", "// new URL(dest, req.url) y req.nextUrl.origin\n/* const { origin } = new URL(request.url) */"],
  ])("no confunde %s", (_nombre, fuente) => {
    expect(hallazgosEn("x.ts", fuente)).toEqual([]);
  });
});
