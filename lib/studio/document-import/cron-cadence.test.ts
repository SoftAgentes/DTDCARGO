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
 *  · La retención vive en otro cron, `document-import-cleanup`, que corre con
 *    cualquier bandera. El drenaje es inerte apagado (no abre la base), así que
 *    si la limpieza dejara de existir o se espaciara, lo vencido a las 24 h se
 *    quedaría sin borrar. Cada hora: 24 conexiones al día apagado, no 1.440.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RETRY_STEP_MS } from "./jobs";

const RAIZ = process.cwd();
const DRAIN = "/api/cron/document-import-drain";
const CLEANUP = "/api/cron/document-import-cleanup";
/** Holgura máxima entre el vencimiento (24 h) y el borrado físico. */
const RETENCION_HOLGURA_MS = 60 * 60_000;
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

/**
 * Cada cuánto dispara un cron. Sólo entiende las formas que tiene sentido usar
 * acá — `* * * * *`, `*\/N * * * *` y `M * * * *` (una vez por hora) —; cualquier
 * otra devuelve null y el contrato la rechaza en vez de adivinar su período.
 */
function intervaloMs(schedule: string): number | null {
  const [minuto, ...resto] = schedule.trim().split(/\s+/);
  if (resto.length !== 4 || resto.some((campo) => campo !== "*")) return null;
  if (minuto === "*") return 60_000;
  if (/^([0-9]|[1-5][0-9])$/.test(minuto)) return 60 * 60_000;
  const paso = /^\*\/(\d+)$/.exec(minuto);
  return paso ? Number(paso[1]) * 60_000 : null;
}
const cronDe = (path: string) =>
  (JSON.parse(leer("vercel.json")) as { crons: { path: string; schedule: string }[] }).crons.filter((c) => c.path === path);

function maxDurationMs(ruta: string): number {
  const m = /export const maxDuration\s*=\s*(\d+)/.exec(leer(ruta));
  if (!m) throw new Error(`${ruta} no declara maxDuration`);
  return Number(m[1]) * 1000;
}

describe("Cadencia del cron de importación documental", () => {
  it("el lector de cadencias distingue las formas que importan", () => {
    expect(intervaloMs("* * * * *")).toBe(60_000);
    expect(intervaloMs("*/5 * * * *")).toBe(300_000);
    expect(intervaloMs("17 * * * *")).toBe(3_600_000);
    expect(intervaloMs("60 * * * *")).toBeNull();
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

  it("la retención tiene su propio cron, al menos una vez por hora, que no lee la bandera", () => {
    const limpiezas = cronDe(CLEANUP);
    expect(limpiezas, `vercel.json debe declarar ${CLEANUP} exactamente una vez`).toHaveLength(1);
    const intervalo = intervaloMs(limpiezas[0].schedule);
    expect(intervalo, `cadencia ilegible para este contrato: "${limpiezas[0].schedule}"`).not.toBeNull();
    expect(
      intervalo! <= RETENCION_HOLGURA_MS,
      `La limpieza corre cada ${intervalo! / 60_000} min: lo vencido a las 24 h puede tardar eso en borrarse. ` +
        `El drenaje no la reemplaza, porque con la bandera apagada no abre la base.`,
    ).toBe(true);
    // Si la leyera, apagar la lectura apagaría también el borrado.
    expect(leer("app/api/cron/document-import-cleanup/route.ts")).not.toMatch(/process\.env\.DOCUMENT_IMPORT_ENABLED/);
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
