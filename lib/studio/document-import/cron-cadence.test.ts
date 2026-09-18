// @vitest-environment node
/**
 * SDD-0473 · La cadencia del cron de importación, atada a lo que depende de ella.
 *
 * El camino feliz lee el documento en el acto (`after()` en http.ts). El cron
 * `/api/cron/document-import-drain` es lo único que vuelve a intentar un archivo
 * que falló por algo pasajero, y lo único que rescata uno cuyo proceso murió.
 * Mientras tanto el visitante mira «En cola» en la pantalla.
 *
 * El 2026-09-17 la cadencia bajó a cada 5 minutos con la bandera apagada (PR
 * #133), porque apagada el cron no hace nada. Al encender vuelve a cada minuto,
 * y este contrato evita que las dos mitades se desalineen otra vez sin que nadie
 * lo decida:
 *
 *  · El escalón de reintento (`RETRY_STEP_MS`) supone un tick por escalón. Con
 *    un tick más lento, 1 y 2 minutos colapsan en «el próximo tick». Un archivo
 *    que falla las tres veces (el intento en el acto y dos del cron) tiene al
 *    visitante hasta ~13 minutos esperando el error final con tick de 5, contra
 *    ~5 con tick de 1, sin contar lo que tarda cada lectura.
 *  · El lease de 3 minutos del claim (migración 0457) tiene que cubrir la vida
 *    entera de quien procesa, o un proceso vivo podría ver su archivo reclamado
 *    por otro. Los dos procesos posibles son el cron y el `after()` de la API.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RETRY_STEP_MS } from "./jobs";

const RAIZ = process.cwd();
const DRAIN = "/api/cron/document-import-drain";
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

/**
 * Cada cuánto dispara un cron de minutos. Sólo entiende las dos formas que tiene
 * sentido usar acá — `* * * * *` y `*\/N * * * *` —; cualquier otra devuelve null
 * y el contrato la rechaza en vez de adivinar su período.
 */
function intervaloMs(schedule: string): number | null {
  const [minuto, ...resto] = schedule.trim().split(/\s+/);
  if (resto.length !== 4 || resto.some((campo) => campo !== "*")) return null;
  if (minuto === "*") return 60_000;
  const paso = /^\*\/(\d+)$/.exec(minuto);
  return paso ? Number(paso[1]) * 60_000 : null;
}

function maxDurationMs(ruta: string): number {
  const m = /export const maxDuration\s*=\s*(\d+)/.exec(leer(ruta));
  if (!m) throw new Error(`${ruta} no declara maxDuration`);
  return Number(m[1]) * 1000;
}

describe("Cadencia del cron de importación documental", () => {
  it("el lector de cadencias distingue las formas que importan", () => {
    expect(intervaloMs("* * * * *")).toBe(60_000);
    expect(intervaloMs("*/5 * * * *")).toBe(300_000);
    expect(intervaloMs("0 11 * * *")).toBeNull();
    expect(intervaloMs("*/5 * * *")).toBeNull();
  });

  it("dispara al menos una vez por escalón de reintento", () => {
    const { crons } = JSON.parse(leer("vercel.json")) as { crons: { path: string; schedule: string }[] };
    const drenajes = crons.filter((c) => c.path === DRAIN);
    expect(drenajes, `vercel.json debe declarar ${DRAIN} exactamente una vez`).toHaveLength(1);
    const intervalo = intervaloMs(drenajes[0].schedule);
    expect(intervalo, `cadencia ilegible para este contrato: "${drenajes[0].schedule}"`).not.toBeNull();
    expect(
      intervalo! <= RETRY_STEP_MS,
      `El cron dispara cada ${intervalo! / 60_000} min y el escalón de reintento es de ` +
        `${RETRY_STEP_MS / 60_000} min: los reintentos dejan de escalonarse y el visitante ` +
        `espera de más. Si la bandera está apagada y se quiere ahorrar ejecuciones, eso se ` +
        `decide acá y en jobs.ts juntos, no sólo en vercel.json.`,
    ).toBe(true);
  });

  it("el lease del claim cubre la vida entera de quien procesa", () => {
    const lease = /lease_until=now\(\)\+interval '(\d+) minutes'/.exec(
      leer("supabase/migrations/0457_document_import_workspaces.sql"),
    );
    expect(lease, "la migración 0457 dejó de fijar el lease como se esperaba").not.toBeNull();
    const leaseMs = Number(lease![1]) * 60_000;
    for (const ruta of ["app/api/cron/document-import-drain/route.ts", "app/api/document-import/route.ts"]) {
      expect(maxDurationMs(ruta), `${ruta} puede vivir más que el lease de ${leaseMs / 60_000} min`).toBeLessThanOrEqual(leaseMs);
    }
  });
});
