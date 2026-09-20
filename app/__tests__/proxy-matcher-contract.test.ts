// @vitest-environment node
/**
 * SDD-0302 · Toda pantalla que resuelva la sesión server-side tiene que estar
 * en el matcher del proxy.
 *
 * ## Qué protege, y por qué no se ve venir
 *
 * `proxy.ts` hace DOS cosas y sólo una es evidente: redirige `/studio` y
 * `/back` sin sesión (visible), y **refresca el access token en cookies**
 * (invisible). El refresco le hace falta a toda ruta que resuelva la sesión
 * server-side, tenga o no redirección.
 *
 * Cuando una ruta queda fuera del matcher, **nada falla al desplegar**. Falla
 * una hora después, cuando el access token vence: la navegación server-side ve
 * la sesión muerta y echa al usuario aunque su refresh token siga vivo. Se
 * reporta como «me saca solo» y no lo reproduce nadie, porque hay que esperar.
 *
 * Así estuvieron `/portal` y `/m/erp` desde que se crearon: el arreglo se
 * escribió el 2026-08-02 y quedó en una rama archivada que nunca se mergeó
 * (ver SDD-0301). Cuando se retomó, `/m/emp` —construido después— tenía el
 * mismo problema y no estaba en aquella lista.
 *
 * ## Por qué el test escanea en vez de llevar una lista
 *
 * Una lista de rutas caduca igual que una lista de código muerto: `/m/emp` lo
 * demuestra. Esto deriva las rutas del código real en cada corrida.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const RAIZ = process.cwd();

/**
 * Rutas que resuelven identidad SIN sesión de Supabase y por eso NO van al
 * matcher. Meterlas sólo agregaría un `getUser()` por request.
 */
const SIN_SESION_SUPABASE = [
  "/m/cn", // operario entra con PIN (app/m/layout.tsx)
  "/m/ve", // idem
];

/** Lee el array `matcher` de `proxy.ts` tal como está escrito. */
function matcherDelProxy(): string[] {
  const src = readFileSync(path.join(RAIZ, "proxy.ts"), "utf8");
  const bloque = src.match(/matcher:\s*\[([\s\S]*?)\]/);
  if (!bloque) throw new Error("No se encontró el `matcher` en proxy.ts");
  return [...bloque[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

/** `"/studio/:path*"` → `"/studio"`. */
const prefijoDe = (patron: string) => patron.replace(/\/:path\*$/, "");

/** Todos los `page.tsx` / `layout.tsx` bajo `app/`. */
function pantallas(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "node_modules" || e === "__tests__") continue;
      pantallas(p, out);
    } else if (e === "page.tsx" || e === "layout.tsx") {
      out.push(p);
    }
  }
  return out;
}

/**
 * Ruta URL de una pantalla: quita `app/`, el archivo, y los segmentos de
 * agrupación `(app)` que Next no publica.
 */
function rutaDe(archivo: string): string {
  const rel = path.relative(path.join(RAIZ, "app"), archivo).split(path.sep);
  rel.pop();
  const segs = rel.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return "/" + segs.join("/");
}

/**
 * ¿La pantalla resuelve la sesión de Supabase server-side?
 *
 * 🔴 Buscar sólo `auth.getUser()` NO alcanza, y este test lo aprendió por
 * mutación: se le quitó `/portal` al matcher y **siguió verde**. El layout del
 * portal no llama a `getUser()` directo — crea el cliente y delega en
 * `getPortalClient()`. El contrato no protegía el caso que lo motivó.
 *
 * La señal correcta es **crear el cliente server-side de Supabase**: ese cliente
 * lleva la sesión del usuario y la RLS depende de ella, así que la ruta necesita
 * el refresco resuelva la identidad donde la resuelva.
 */
function resuelveSesion(archivo: string): boolean {
  const t = readFileSync(archivo, "utf8");
  if (/auth\s*\.\s*getUser\s*\(/.test(t)) return true;
  return /from\s+["']@\/lib\/db\/server["']/.test(t);
}

describe("contrato · matcher del proxy (SDD-0302)", () => {
  const matcher = matcherDelProxy();
  const prefijos = matcher.map(prefijoDe);

  const conSesion = pantallas(path.join(RAIZ, "app"))
    .filter(resuelveSesion)
    .map(rutaDe);

  it("el matcher no está vacío y usa el patrón `:path*`", () => {
    expect(matcher.length).toBeGreaterThan(0);
    for (const m of matcher) expect(m).toMatch(/\/:path\*$/);
  });

  it("🔴 toda pantalla con `auth.getUser()` está cubierta por el matcher", () => {
    const descubiertas = conSesion.filter(
      (r) =>
        !prefijos.some((p) => r === p || r.startsWith(p + "/")) &&
        !SIN_SESION_SUPABASE.some((p) => r === p || r.startsWith(p + "/")),
    );

    expect(
      descubiertas,
      `Estas pantallas resuelven la sesión server-side y NO están en el matcher ` +
        `de proxy.ts. Su access token va a vencer sin refrescarse y el usuario ` +
        `va a ser expulsado ~1 h después de entrar, sin que nada falle al ` +
        `desplegar. Agrega su prefijo al matcher, o —si entra con PIN y no con ` +
        `sesión de Supabase— a SIN_SESION_SUPABASE en este test.\n  ` +
        [...new Set(descubiertas)].join("\n  "),
    ).toEqual([]);
  });

  it("las rutas de PIN siguen FUERA del matcher", () => {
    // Si alguna entrara, cada request del operario pagaría un getUser() que no
    // necesita. La exclusión es deliberada, no un olvido.
    for (const p of SIN_SESION_SUPABASE) {
      expect(prefijos).not.toContain(p);
    }
  });

  it("el escaneo encuentra pantallas de verdad (si no, el contrato no mide nada)", () => {
    // Un test que no encuentra nada pasa siempre. Este es el seguro.
    expect(conSesion.length).toBeGreaterThan(3);
  });
});
