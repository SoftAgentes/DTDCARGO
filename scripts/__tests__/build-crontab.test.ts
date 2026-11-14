// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CRONTAB_PATH,
  CRON_ROUTES_DIR,
  CURL_PREFIX,
  EXTRA_CRONS,
  buildCrontab,
  generateCrontab,
  readVercelCrons,
  validateCronEntries,
  // @ts-expect-error El generador es ESM ejecutable (.mjs); Vitest valida su API runtime.
} from "../build-crontab.mjs";

/**
 * SDD-0505 · el crontab del servidor se genera desde `vercel.json`.
 *
 * La propiedad que se protege: NO puede existir un horario en el servidor distinto
 * del que Vercel agenda, ni una ruta agendada que no tenga handler. Si alguien
 * cambia `vercel.json` y no regenera, el primer `it` se pone rojo con un diff
 * legible, no con un cron silencioso que corre a la hora equivocada.
 */

type CronEntry = { path: string; schedule: string };

const root = process.cwd();
const committed = readFileSync(join(root, CRONTAB_PATH), "utf8");
const vercelCrons = readVercelCrons(root) as CronEntry[];

/** Líneas ejecutables del crontab (sin comentarios ni vacías). */
function jobLines(crontab: string): string[] {
  return crontab
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("#"));
}

const JOB_RE =
  /^(\S+ \S+ \S+ \S+ \S+) curl -fsS --max-time 290 -H "Authorization: Bearer \$\{CRON_SECRET\}" http:\/\/web:3000(\/api\/cron\/[a-z0-9-]+)$/;

describe("SDD-0505 · crontab generado desde vercel.json", () => {
  it("el archivo comprometido coincide byte a byte con lo generado y sin errores", () => {
    const { content, errors } = generateCrontab(root);
    expect(errors).toEqual([]);
    expect(committed).toBe(content);
    // LF puro: `.gitattributes` fija `eol=lf` y el generador escribe LF.
    expect(committed).not.toContain("\r");
    expect(committed.endsWith("\n")).toBe(true);
  });

  it("cada ruta agendada tiene su handler en app/api/cron/<slug>/route.ts", () => {
    const jobs = jobLines(committed);
    expect(jobs.length).toBeGreaterThan(0);
    for (const line of jobs) {
      const match = line.match(JOB_RE);
      expect(match, `línea fuera de contrato: ${line}`).not.toBeNull();
      const slug = match![2].replace("/api/cron/", "");
      const route = join(root, CRON_ROUTES_DIR, slug, "route.ts");
      expect(existsSync(route), `falta ${CRON_ROUTES_DIR}/${slug}/route.ts`).toBe(true);
    }
  });

  // SDD-0585 sumó /api/cron/chatwoot-reintentos (19 → 20): el reintento propio de
  // los eventos de Chatwoot, cada 5 minutos (Chatwoot 4.19.1 no reintenta webhooks).
  it("cubre los 22 crons de vercel.json con su mismo horario, más searates-refresh semanal y BCV único cada hora al minuto 5", () => {
    expect(vercelCrons).toHaveLength(22);
    const jobs = jobLines(committed);
    expect(jobs).toHaveLength(vercelCrons.length + EXTRA_CRONS.length);

    // Mismo orden y mismo horario que la fuente: el diff del crontab se lee como el de vercel.json.
    vercelCrons.forEach((cron, i) => {
      expect(jobs[i]).toBe(`${cron.schedule} ${CURL_PREFIX}${cron.path}`);
    });

    // Los extras conservan su orden y sus horarios aprobados.
    expect(EXTRA_CRONS).toEqual([
      expect.objectContaining({ path: "/api/cron/searates-refresh", schedule: "0 6 * * 1" }),
      expect.objectContaining({ path: "/api/cron/bcv-rates", schedule: "5 * * * *" }),
    ]);
    expect(jobs[vercelCrons.length]).toBe(`0 6 * * 1 ${CURL_PREFIX}/api/cron/searates-refresh`);
    expect(jobs.at(-1)).toBe(`5 * * * * ${CURL_PREFIX}/api/cron/bcv-rates`);
    expect(jobs.filter((line) => line.endsWith("/api/cron/bcv-rates"))).toHaveLength(1);
    // Y no está en vercel.json: si algún día se agenda allí, el extra sobra (duplicado).
    expect(vercelCrons.some((c) => c.path === "/api/cron/searates-refresh")).toBe(false);
    expect(vercelCrons.some((c) => c.path === "/api/cron/bcv-rates")).toBe(false);
  });

  it("es determinista: la misma fuente produce los mismos bytes", () => {
    expect(buildCrontab(vercelCrons)).toBe(buildCrontab(vercelCrons));
    expect(buildCrontab(structuredClone(vercelCrons))).toBe(committed);
  });

  it("un cambio de horario en vercel.json sin regenerar deja el archivo desalineado", () => {
    const mutated = structuredClone(vercelCrons);
    mutated[0].schedule = "5 * * * *";
    expect(buildCrontab(mutated)).not.toBe(committed);

    const reordered = [...vercelCrons].reverse();
    expect(buildCrontab(reordered)).not.toBe(committed);
  });

  it("el secreto no se expande en el archivo: viaja por el entorno del contenedor", () => {
    expect(committed).toContain('Bearer ${CRON_SECRET}"');
    expect(committed).not.toMatch(/Bearer [A-Za-z0-9+/=_-]{16,}/);
  });
});

describe("SDD-0505 · validación de entradas", () => {
  it("acepta las entradas reales del repo", () => {
    expect(validateCronEntries([...vercelCrons, ...EXTRA_CRONS], root)).toEqual([]);
  });

  it("rechaza una ruta sin handler", () => {
    const errors = validateCronEntries([{ path: "/api/cron/no-existe", schedule: "* * * * *" }], root);
    expect(errors.join("\n")).toContain("ruta sin handler");
  });

  it("rechaza una ruta fuera de /api/cron", () => {
    const errors = validateCronEntries([{ path: "/api/health", schedule: "* * * * *" }], root);
    expect(errors.join("\n")).toContain("ruta inválida");
  });

  it("rechaza un horario que no tenga cinco campos cron", () => {
    const errors = validateCronEntries([{ path: "/api/cron/mail-health", schedule: "*/30 * * *" }], root);
    expect(errors.join("\n")).toContain("horario inválido");
  });

  it("rechaza rutas duplicadas entre vercel.json y los extras", () => {
    const dup = { path: "/api/cron/mail-health", schedule: "*/30 * * * *" };
    const errors = validateCronEntries([dup, dup], root);
    expect(errors.join("\n")).toContain("ruta duplicada");
  });
});
