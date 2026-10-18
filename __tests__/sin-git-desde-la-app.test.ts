// @vitest-environment node
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

/**
 * ⏱️ I/O-BOUND: este contrato RECORRE EL ÁRBOL DE ARCHIVOS del repo.
 *
 * Aislado corre en pocos segundos, pero compite por el disco con los otros
 * contratos que recorren el árbol (ver `json-ld-escape-contract.test.ts`). El
 * techo se sube ACÁ y no en `vitest.config.ts`, para no relajar el resto.
 */
vi.setConfig({ testTimeout: 120_000 });

/**
 * SDD-0551 · la app no ejecuta git.
 *
 * El Studio local tenía un botón «Push» (`DeployWebBot.tsx` →
 * `deployActions.ts` → `lib/studio/deploy/git-runner.ts`) que hacía
 * `git add -A`, `commit` y `push`, también directo a `main`. Desde la SDD-0541,
 * lo que llega a `main` se publica en producción en ~5 minutos, así que ese
 * botón publicaba sin PR ni revisión. Sam pidió retirarlo el 2026-10-17.
 *
 * Este contrato impide que vuelva por cualquier camino. Lee con el compilador
 * de TypeScript, no con expresiones sobre el texto, para que un comentario que
 * explique la historia («hacía `git push`») no lo ponga en rojo, y un literal
 * dentro del código sí. Reglas, sobre el código que se publica (sin pruebas):
 *
 *  1. `importa-procesos`: nadie importa `child_process` ni una librería que
 *     lance procesos o hable git (`execa`, `simple-git`, …). Es la regla de
 *     fondo: sin lanzar procesos no hay `git` que valga.
 *  2. `lanza-git`: nadie llama a `exec`/`execFile`/`spawn`/`fork` (o sus
 *     variantes `Sync`/`Async`) con `git` como programa.
 *  3. `comando-git`: ningún literal dice `git push` ni `git add -A` (o
 *     `--all`, o `.`).
 *  4. `argumentos-git`: ningún arreglo arranca con `"add", "-A"` (o `--all`,
 *     o `.`) ni con `"push", "origin"` / `"push", "-…"`, que es como el bot
 *     le pasaba los argumentos a `execFile`.
 *
 * La lista de excepciones está vacía. Agregar una exige una SDD que diga por
 * qué ese camino no publica sin PR.
 */

const RAIZ = join(__dirname, "..");
const CARPETAS = ["app", "lib", "components"];
/** Archivos sueltos de la raíz que corren dentro de la app. */
const SUELTOS = ["proxy.ts"];
/** Rutas relativas (con `/`) eximidas. Vacía a propósito: ver la cabecera. */
const EXCEPCIONES: readonly string[] = [];

const CODIGO = /\.(tsx?|jsx?|mjs|cjs)$/;
/** Las pruebas no se publican: pueden leer el repo con `git grep`, por ejemplo. */
const ES_PRUEBA = /(^|\/)(__tests__|__mocks__)\/|\.(test|spec)\.[cm]?[jt]sx?$/;

const MODULOS_DE_PROCESOS = new Set([
  "child_process",
  "node:child_process",
  "execa",
  "zx",
  "shelljs",
  "cross-spawn",
  "simple-git",
  "isomorphic-git",
  "nodegit",
]);
const LLAMADA_DE_PROCESO = /^(exec|execFile|spawn|fork)(Sync|Async)?$/;
const COMANDO_GIT = /^\s*git\s+(push(\s|$)|add\s+(-A|--all|\.)(\s|$))/;
const AGREGA_TODO = new Set(["-A", "--all", "."]);

type Regla = "importa-procesos" | "lanza-git" | "comando-git" | "argumentos-git";
type Hallazgo = { regla: Regla; linea: number };

const rel = (abs: string) => relative(RAIZ, abs).split("\\").join("/");

function textoLiteral(n: ts.Node | undefined): string | null {
  if (!n) return null;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  return null;
}

function nombreLlamado(e: ts.Expression): string | null {
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

/** Lo que el detector encuentra en un fuente. Pura: la usan el barrido y sus casos. */
function hallazgosEn(nombre: string, fuente: string): Hallazgo[] {
  const kind = /\.[jt]sx$/.test(nombre)
    ? ts.ScriptKind.TSX
    : /\.[cm]?js$/.test(nombre)
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const src = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, kind);
  const out: Hallazgo[] = [];
  const marcar = (regla: Regla, n: ts.Node) =>
    out.push({ regla, linea: src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1 });

  const visitar = (n: ts.Node): void => {
    // 1 · import/export … from "x", import x = require("x")
    if (
      (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) &&
      MODULOS_DE_PROCESOS.has(textoLiteral(n.moduleSpecifier) ?? "")
    ) {
      marcar("importa-procesos", n);
    }
    if (
      ts.isImportEqualsDeclaration(n) &&
      ts.isExternalModuleReference(n.moduleReference) &&
      MODULOS_DE_PROCESOS.has(textoLiteral(n.moduleReference.expression) ?? "")
    ) {
      marcar("importa-procesos", n);
    }
    if (ts.isCallExpression(n)) {
      const primero = textoLiteral(n.arguments[0]);
      // 1 · require("x") e import("x")
      const esCarga =
        n.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(n.expression) && n.expression.text === "require");
      if (esCarga && MODULOS_DE_PROCESOS.has(primero ?? "")) marcar("importa-procesos", n);
      // 2 · execFile("git", …), spawnSync("git", …), exec("git push …")
      const llamado = nombreLlamado(n.expression);
      if (
        llamado &&
        LLAMADA_DE_PROCESO.test(llamado) &&
        primero !== null &&
        /^\s*git(\s|$)/.test(primero)
      ) {
        marcar("lanza-git", n);
      }
    }
    // 3 · "git push …", "git add -A"
    const texto = textoLiteral(n) ?? (ts.isTemplateHead(n) ? n.text : null);
    if (texto !== null && COMANDO_GIT.test(texto)) marcar("comando-git", n);
    // 4 · ["add", "-A"], ["push", "origin", …], ["push", "-u", …]
    if (ts.isArrayLiteralExpression(n)) {
      const [a, b] = [textoLiteral(n.elements[0]), textoLiteral(n.elements[1])];
      if (
        (a === "add" && b !== null && AGREGA_TODO.has(b)) ||
        (a === "push" && b !== null && (b === "origin" || b.startsWith("-")))
      ) {
        marcar("argumentos-git", n);
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(src);
  return out;
}

/**
 * Prefiltro: un archivo que no menciona ni `git`, ni `push`/`add` entre
 * comillas, ni un módulo de procesos no puede dar un hallazgo, así que no hace
 * falta pasarlo por el compilador. Deja pasar de más («digital» contiene
 * «git»), nunca de menos: lo prueba «el prefiltro no se come ningún caso».
 */
function puedeEjecutarGit(fuente: string): boolean {
  return (
    /git|["'`](push|add)["'`]/.test(fuente) ||
    [...MODULOS_DE_PROCESOS].some((m) => fuente.includes(m))
  );
}

function archivos(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) archivos(p, acc);
    else if (CODIGO.test(e.name) && !ES_PRUEBA.test(rel(p))) acc.push(p);
  }
  return acc;
}

async function leerTodos(rutas: string[], tope = 32): Promise<string[]> {
  const textos = new Array<string>(rutas.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: tope }, async () => {
      while (siguiente < rutas.length) {
        const i = siguiente++;
        textos[i] = await readFile(rutas[i], "utf8");
      }
    }),
  );
  return textos;
}

let cache: Promise<{ rutas: string[]; ofensores: string[] }> | null = null;
function barrer() {
  cache ??= (async () => {
    const rutas = [
      ...CARPETAS.flatMap((c) => archivos(join(RAIZ, c))),
      ...SUELTOS.map((s) => join(RAIZ, s)),
    ];
    const fuentes = await leerTodos(rutas);
    const ofensores: string[] = [];
    rutas.forEach((abs, i) => {
      const r = rel(abs);
      if (EXCEPCIONES.includes(r) || !puedeEjecutarGit(fuentes[i])) return;
      for (const h of hallazgosEn(r, fuentes[i])) ofensores.push(`${r}:${h.linea} ${h.regla}`);
    });
    return { rutas: rutas.map(rel), ofensores };
  })();
  return cache;
}

describe("SDD-0551 · ningún camino de la app ejecuta git", () => {
  it("app/, lib/, components/ y proxy.ts no lanzan procesos ni ejecutan git add -A o git push", async () => {
    const { ofensores } = await barrer();
    expect(
      ofensores,
      "Publicar entra por una PR revisada (AGENTS.md). Si de verdad hace falta, va con una SDD y una excepción con su razón:\n" +
        ofensores.join("\n"),
    ).toEqual([]);
  });

  it("el barrido mira de verdad el Studio (no es verde por vacío)", async () => {
    const { rutas } = await barrer();
    expect(rutas.length).toBeGreaterThan(500);
    // Rutas con paréntesis y el server component que tenía el botón.
    expect(rutas).toContain("app/studio/(app)/debug/_components/EstadoTab.tsx");
    expect(rutas).toContain("app/studio/(app)/_actions/comments.ts");
    expect(rutas).toContain("lib/runtime/app-env.ts");
    expect(rutas).toContain("proxy.ts");
    // Las pruebas quedan fuera; el código vecino, no.
    expect(rutas.some((r) => ES_PRUEBA.test(r))).toBe(false);
  });

  it("la lista de excepciones está vacía", () => {
    expect(EXCEPCIONES).toEqual([]);
  });
});

describe("SDD-0551 · el detector", () => {
  /** Lo que tenía el bot retirado, tal cual (`git-runner.ts` en `d5ef42ea`). */
  const BOT = [
    'import { execFile } from "node:child_process";',
    'import { promisify } from "node:util";',
    "const execFileAsync = promisify(execFile);",
    "async function git(cwd: string, args: string[]) {",
    '  return execFileAsync("git", args, { cwd });',
    "}",
    'export const gitAddAll = (cwd: string) => git(cwd, ["add", "-A"]);',
    'export const gitPushSetUpstream = (cwd: string, b: string) => git(cwd, ["push", "-u", "origin", b]);',
    'export const gitPush = (cwd: string, b: string) => git(cwd, ["push", "origin", b]);',
  ].join("\n");

  it("encuentra cada pieza del bot retirado", () => {
    expect(hallazgosEn("lib/studio/deploy/git-runner.ts", BOT)).toEqual([
      { regla: "importa-procesos", linea: 1 },
      { regla: "lanza-git", linea: 5 },
      { regla: "argumentos-git", linea: 7 },
      { regla: "argumentos-git", linea: 8 },
      { regla: "argumentos-git", linea: 9 },
    ]);
  });

  it.each<[string, string, Regla]>([
    ["require", 'const cp = require("child_process");', "importa-procesos"],
    ["import dinámico", 'const cp = await import("node:child_process");', "importa-procesos"],
    ["import = require", 'import cp = require("child_process");', "importa-procesos"],
    ["reexportado", 'export { spawn } from "node:child_process";', "importa-procesos"],
    ["librería de git", 'import simpleGit from "simple-git";', "importa-procesos"],
    ["librería de procesos", 'import { $ } from "execa";', "importa-procesos"],
    ["spawnSync", 'spawnSync("git", ["status"]);', "lanza-git"],
    ["propiedad", 'cp.execFile("git", args);', "lanza-git"],
    ["comando en una cadena", 'const c = "git push origin main";', "comando-git"],
    ["comando en plantilla", "const c = `git push origin ${rama}`;", "comando-git"],
    ["add --all", 'const c = "git add --all";', "comando-git"],
    ["add .", "const c = 'git add .';", "comando-git"],
    ["argumentos add .", 'run(["add", "."]);', "argumentos-git"],
    ["argumentos push --force", 'run(["push", "--force"]);', "argumentos-git"],
  ])("%s", (_nombre, fuente, regla) => {
    expect(hallazgosEn("x.ts", fuente).map((h) => h.regla)).toContain(regla);
  });

  it.each([
    ["un comentario que cuenta la historia", "// el bot hacía `git add -A` y `git push origin main`\n/* execFile(\"git\") */"],
    ["el canal push de las notificaciones", 'const r = { channel: "push" }; const c = ["email", "push", "both"];'],
    ["un arreglo que empieza con push sin remoto", 'const canales = ["push", "email"];'],
    ["un enlace a GitHub", 'const u = "https://github.com/x/y";'],
    ["git sin push ni add", 'const c = "git status";'],
    ["add sin -A", 'run(["add", "archivo.ts"]);'],
    ["otro programa", 'execFile("node", ["-v"]);'],
  ])("no confunde %s", (_nombre, fuente) => {
    expect(hallazgosEn("x.tsx", fuente)).toEqual([]);
  });

  it("el prefiltro no se come ningún caso", () => {
    for (const fuente of [
      BOT,
      'const cp = require("child_process");',
      'import { $ } from "execa";',
      'import { $ } from "zx";',
      'import sh from "shelljs";',
      'import spawn from "cross-spawn";',
      'run(["add", "."]);',
      "run(['push', '--force']);",
      "run([`push`, `-u`]);",
    ]) {
      expect(puedeEjecutarGit(fuente)).toBe(true);
      expect(hallazgosEn("x.ts", fuente).length).toBeGreaterThan(0);
    }
    expect(puedeEjecutarGit('const total = suma(["a", "b"]);')).toBe(false);
  });
});
