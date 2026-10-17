// @vitest-environment node
/**
 * SDD-0302 · Toda pantalla que resuelva la sesión server-side tiene que estar
 * en las rutas con sesión del proxy. SDD-0505 · Todo lo que escribe tiene que
 * pasar por el proxy, para que el modo mantenimiento lo pueda cortar.
 *
 * ## Qué protege, y por qué no se ve venir
 *
 * `proxy.ts` hace TRES cosas y sólo una es evidente: redirige `/studio` y
 * `/back` sin sesión (visible), **refresca el access token en cookies**
 * (invisible) y, con `MAINTENANCE_MODE`, **corta toda escritura** (invisible
 * hasta el día del corte).
 *
 * Cuando una ruta con sesión queda fuera de `RUTAS_CON_SESION`, **nada falla al
 * desplegar**. Falla una hora después, cuando el access token vence: la
 * navegación server-side ve la sesión muerta y echa al usuario aunque su
 * refresh token siga vivo. Así estuvieron `/portal` y `/m/erp` (SDD-0301).
 *
 * Cuando una ruta que escribe queda fuera del matcher, tampoco falla nada: el
 * día del corte alguien guarda ahí durante la copia final y ese dato se pierde.
 *
 * ## Por qué el test escanea en vez de llevar una lista
 *
 * Una lista de rutas caduca igual que una lista de código muerto: `/m/emp` lo
 * demuestra. Esto deriva las rutas del código real en cada corrida.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { RUTAS_CON_SESION } from "@/lib/runtime/session-routes";

const RAIZ = process.cwd();

/**
 * Rutas que resuelven identidad SIN sesión de Supabase y por eso NO van a
 * `RUTAS_CON_SESION`. Meterlas sólo agregaría un `getUser()` por request.
 */
const SIN_SESION_SUPABASE = [
  "/m/cn", // operario entra con PIN (app/m/layout.tsx)
  "/m/ve", // idem
];

/** Las entradas de texto del `matcher` de `proxy.ts`, tal como están escritas. */
function matcherDelProxy(): { textos: string[]; fuente: string } {
  const src = readFileSync(path.join(RAIZ, "proxy.ts"), "utf8");
  const bloque = src.match(/matcher:\s*\[([\s\S]*?)\n\s*\],/);
  if (!bloque) throw new Error("No se encontró el `matcher` en proxy.ts");
  const sinObjetos = bloque[1].replace(/\{[\s\S]*?\}\s*\]\s*\}/g, "");
  return { textos: [...sinObjetos.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]), fuente: bloque[1] };
}

/** `"/studio/:path*"` → `"/studio"`. */
const prefijoDe = (patron: string) => patron.replace(/\/:path\*$/, "");
const cubre = (prefijos: readonly string[], ruta: string) =>
  prefijos.some((p) => ruta === p || ruta.startsWith(p + "/"));

/** Archivos con ese nombre bajo `app/`. */
function archivos(dir: string, nombres: string[], out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "node_modules" || e === "__tests__") continue;
      archivos(p, nombres, out);
    } else if (nombres.includes(e)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Ruta URL de un archivo de `app/`: quita `app/`, el archivo, y los segmentos de
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
 * mutación: se le quitó `/portal` y **siguió verde**. El layout del portal no
 * llama a `getUser()` directo — crea el cliente y delega en `getPortalClient()`.
 * La señal correcta es **crear el cliente server-side de Supabase**.
 */
function resuelveSesion(archivo: string): boolean {
  const t = readFileSync(archivo, "utf8");
  if (/auth\s*\.\s*getUser\s*\(/.test(t)) return true;
  return /from\s+["']@\/lib\/db\/server["']/.test(t);
}

/** ¿El route handler exporta un método que escribe? */
function escribe(archivo: string): boolean {
  return /export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b|export\s+const\s+(POST|PUT|PATCH|DELETE)\b/.test(
    readFileSync(archivo, "utf8"),
  );
}

describe("contrato · proxy: sesión y mantenimiento (SDD-0302, SDD-0505)", () => {
  const { textos, fuente } = matcherDelProxy();
  const prefijosMatcher = textos.map(prefijoDe);

  const conSesion = archivos(path.join(RAIZ, "app"), ["page.tsx", "layout.tsx"])
    .filter(resuelveSesion)
    .map(rutaDe);
  const queEscriben = archivos(path.join(RAIZ, "app"), ["route.ts"]).filter(escribe).map(rutaDe);

  it("el matcher usa el patrón `:path*` en sus entradas de texto", () => {
    expect(textos.length).toBeGreaterThan(0);
    for (const m of textos) expect(m).toMatch(/\/:path\*$/);
  });

  it("🔴 toda pantalla con sesión de Supabase está en RUTAS_CON_SESION", () => {
    const descubiertas = conSesion.filter((r) => !cubre(RUTAS_CON_SESION, r) && !cubre(SIN_SESION_SUPABASE, r));
    expect(
      descubiertas,
      `Estas pantallas resuelven la sesión server-side y NO están en ` +
        `RUTAS_CON_SESION (lib/runtime/session-routes.ts). Su access token va a ` +
        `vencer sin refrescarse y el usuario va a ser expulsado ~1 h después de ` +
        `entrar. Agrega su prefijo, o —si entra con PIN— a SIN_SESION_SUPABASE.\n  ` +
        [...new Set(descubiertas)].join("\n  "),
    ).toEqual([]);
  });

  it("toda ruta con sesión pasa por el proxy (si no, el refresco nunca corre)", () => {
    for (const r of RUTAS_CON_SESION) expect(cubre(prefijosMatcher, r), r).toBe(true);
  });

  it("las rutas de PIN NO pagan el refresco de sesión", () => {
    for (const p of SIN_SESION_SUPABASE) expect(cubre(RUTAS_CON_SESION, p), p).toBe(false);
  });

  it("🔴 toda ruta que escribe pasa por el proxy (el mantenimiento la tiene que poder cortar)", () => {
    const fuera = queEscriben.filter((r) => !cubre(prefijosMatcher, r));
    expect(
      fuera,
      `Estos route handlers escriben (POST/PUT/PATCH/DELETE) y NO están en el ` +
        `matcher de proxy.ts: con MAINTENANCE_MODE seguirían aceptando escrituras ` +
        `durante la copia final del corte. Agrega su prefijo al matcher.\n  ` +
        fuera.join("\n  "),
    ).toEqual([]);
    expect(prefijosMatcher).toContain("/api");
  });

  it("las server actions de cualquier página pasan por el proxy (header Next-Action)", () => {
    expect(fuente).toMatch(/source:\s*["']\/:path\*["']\s*,\s*has:\s*\[\s*\{\s*type:\s*["']header["']\s*,\s*key:\s*["']next-action["']/);
  });

  it("el escaneo encuentra rutas de verdad (si no, el contrato no mide nada)", () => {
    // Un test que no encuentra nada pasa siempre. Este es el seguro.
    expect(conSesion.length).toBeGreaterThan(3);
    expect(queEscriben.length).toBeGreaterThan(3);
  });
});
