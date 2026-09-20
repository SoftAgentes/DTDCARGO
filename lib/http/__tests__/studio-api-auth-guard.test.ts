// @vitest-environment node
/**
 * Anti-drift: toda ruta de `/api/studio/*` verifica la sesión.
 *
 * Cuatro rutas decían en su docblock "Auth: sesión Supabase válida
 * obligatoria" y no verificaban nada — se apoyaban sólo en RLS. RLS no
 * filtraba datos (un anónimo veía cero filas), pero:
 *
 *   - `update … .eq("id", …)` bloqueado por RLS afecta 0 filas SIN devolver
 *     error → el DELETE de un envío respondía `{ok: true}` a un llamador sin
 *     sesión. Una API que miente sobre lo que hizo.
 *   - Cero defensa en profundidad: si una policy regresa, no queda nada.
 *
 * El proxy (`proxy.ts`) NO cubre esto: refresca la sesión de Supabase en
 * `/studio/*`, no autoriza, y su matcher ni siquiera incluye `/api/studio`.
 */
import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ⏱️ I/O-BOUND: este contrato RECORRE EL ÁRBOL DE ARCHIVOS del repo.
 *
 * Aislado corre en ~1 s. Pero la suite tiene NUEVE contratos que hacen lo mismo
 * y vitest los reparte en paralelo sobre 427 archivos de test: compitiendo por
 * el mismo disco, la lectura se va a 26-53 s y expira contra el `testTimeout`
 * global de 20 s. Falla un conjunto DISTINTO cada corrida — la firma de la
 * contención, no de una regresión (una regresión falla el mismo test las dos
 * veces, y con una aserción, no con un reloj).
 *
 * El timeout se sube ACÁ y no en `vitest.config.ts` a propósito: subirlo global
 * relajaría los otros ~4.960 tests, donde 20 s ya es señal de que algo va mal.
 */
vi.setConfig({ testTimeout: 120_000 });


const API_STUDIO = join(process.cwd(), "app", "api", "studio");

/**
 * Señales aceptadas de verificación de identidad del llamador.
 *
 * Son LLAMADAS, con su paréntesis. Buscar el nombre suelto haría pasar a un
 * archivo que sólo *importa* el guard sin usarlo — lo descubrí mutando la
 * ruta de KPIs: le saqué la llamada, dejé el import, y el test siguió verde.
 * Un contrato que se conforma con el import no verifica nada.
 */
const GUARDS = [
  "requireStudioSession(",
  "auth.getUser()",
  "getUserTenantId(",
  "requireModuleView(",
  "requirePlatformAdmin(",
  // Rutas máquina-a-máquina: se autentican por secreto, no por sesión.
  "CRON_SECRET",
  "DTD_API_KEY",
  "createHmac(",
];

/**
 * Rutas que autorizan en la BASE, no en el handler. Es un patrón más fuerte
 * —la RPC es la autoridad y no hay forma de saltearla— pero no calza con las
 * señales de arriba, así que se nombra una por una con su motivo.
 */
const AUTORIZA_LA_BASE = new Map<string, string>([
  [
    "audit/export/route.ts",
    "GET delega en la RPC `audit_authorize_export_download`, que decide y " +
      "devuelve la ruta del archivo sólo si el caller puede; si no, la " +
      "respuesta es 403. Firmar la URL viene DESPUÉS de esa autorización.",
  ],
]);

/**
 * Quita comentarios antes de buscar.
 *
 * Sin esto el contrato se satisface con la PROSA: justo estas cuatro rutas
 * traían en su docblock "Auth: sesión Supabase válida obligatoria" sin
 * verificar nada, y un docblock que citara la llamada literal —como hace el
 * layout de `seniat`— daría verde sobre código sin guard. Mismo tropiezo que
 * en `feature-flags-catalog.test.ts`: un contrato que lee comentarios verifica
 * intenciones, no comportamiento.
 */
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Cuerpo de cada handler exportado, sin imports ni helpers de módulo. */
function handlers(src: string): { metodo: string; cuerpo: string }[] {
  const out: { metodo: string; cuerpo: string }[] = [];
  const re = /export async function (GET|POST|PUT|PATCH|DELETE)\b/g;
  const marcas = [...src.matchAll(re)];
  for (let i = 0; i < marcas.length; i++) {
    const desde = marcas[i].index!;
    const hasta = i + 1 < marcas.length ? marcas[i + 1].index! : src.length;
    out.push({ metodo: marcas[i][1], cuerpo: src.slice(desde, hasta) });
  }
  return out;
}

function rutas(dir: string, base = ""): { rel: string; abs: string }[] {
  const out: { rel: string; abs: string }[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...rutas(abs, rel));
    else if (e.name === "route.ts") out.push({ rel, abs });
  }
  return out;
}

describe("Toda ruta de /api/studio verifica la sesión", () => {
  const todas = rutas(API_STUDIO);

  it("hay rutas que auditar (sanity)", () => {
    expect(todas.length).toBeGreaterThan(5);
  });

  for (const r of todas) {
    it(`/api/studio/${r.rel} tiene guard en cada método`, () => {
      const src = sinComentarios(readFileSync(r.abs, "utf8"));
      const hs = handlers(src);
      if (hs.length === 0) return; // sin handlers exportados: nada que proteger

      // Un helper compartido del módulo (fuera de los handlers) también vale:
      // varias rutas centralizan el chequeo en una función propia.
      const preambulo = src.slice(0, hs[0] ? src.indexOf(hs[0].cuerpo) : src.length);
      const enHelper = GUARDS.some((g) => preambulo.includes(g));

      const delegaEnLaBase = AUTORIZA_LA_BASE.has(r.rel.replace(/\\/g, "/"));

      const sinGuard = hs
        .filter(
          (h) =>
            !enHelper &&
            !delegaEnLaBase &&
            !GUARDS.some((g) => h.cuerpo.includes(g)),
        )
        .map((h) => h.metodo);

      if (sinGuard.length > 0) {
        throw new Error(
          `/api/studio/${r.rel}: ${sinGuard.join(", ")} no verifica quién llama. ` +
            `RLS sola no alcanza: un UPDATE que RLS bloquea afecta 0 filas y NO ` +
            `devuelve error, así que la ruta responde éxito a un anónimo. ` +
            `Usá requireStudioSession() de @/lib/http/studio-session.`,
        );
      }
    });
  }
});

describe("El guard corta antes de tocar la base", () => {
  // Un guard declarado después de la primera consulta no protege nada.
  const todas = rutas(API_STUDIO);

  for (const r of todas) {
    const src = readFileSync(r.abs, "utf8");
    if (!sinComentarios(src).includes("requireStudioSession(")) continue;

    it(`/api/studio/${r.rel} llama al guard antes de consultar`, () => {
      // Por handler: la posición del guard vs. la del primer `.from(`/`rpc(`.
      const cuerpos = sinComentarios(src).split(/export async function (?=GET|POST|PUT|PATCH|DELETE)/);
      for (const cuerpo of cuerpos) {
        const guard = cuerpo.indexOf("requireStudioSession(");
        if (guard < 0) continue;
        const consulta = cuerpo.search(/\.from\(|\.rpc\(/);
        if (consulta >= 0 && consulta < guard) {
          throw new Error(
            `En /api/studio/${r.rel} hay una consulta a la base ANTES del guard. ` +
              `Movelo al principio del handler.`,
          );
        }
      }
    });
  }
});
