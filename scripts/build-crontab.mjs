#!/usr/bin/env node
/**
 * build-crontab.mjs — genera `infra/dtd-cargo/cron/crontab` desde `vercel.json` (SDD-0505).
 *
 * Cero dependencias. Uso:
 *   node scripts/build-crontab.mjs           → valida + escribe infra/dtd-cargo/cron/crontab
 *   node scripts/build-crontab.mjs --check   → solo compara (no escribe) · exit 1 si hay drift
 *
 * POR QUÉ EXISTE: en Vercel los crons los agenda la plataforma leyendo `vercel.json`.
 * En el servidor propio los agenda un contenedor `cron` (BusyBox crond + curl) que
 * llama a cada ruta de `app/api/cron/*` con el mismo `Authorization: Bearer CRON_SECRET`
 * que ya exigen los handlers. Si el crontab se escribiera a mano, el día que alguien
 * cambie un horario en `vercel.json` el servidor seguiría con el viejo sin que nadie
 * lo note. Por eso el archivo se GENERA y la prueba `scripts/__tests__/build-crontab.test.ts`
 * falla cuando `vercel.json` cambia sin regenerarlo.
 *
 * CONTRATO DE CADA LÍNEA (fijado por la spec 0505):
 *   <horario de vercel.json> curl -fsS --max-time 290 -H "Authorization: Bearer ${CRON_SECRET}" http://web:3000<path>
 *
 *   · `--max-time 290` queda por debajo del `maxDuration = 300` de las rutas más largas.
 *   · `${CRON_SECRET}` NO se expande aquí: queda literal y lo resuelve el contenedor
 *     `cron` desde su entorno (`environment:` del compose). En `infra/dtd-cargo/cron/`
 *     lo renderiza el entrypoint con `envsubst '${CRON_SECRET}'` antes de arrancar
 *     crond; en la plantilla lo expande `sh -c` al correr cada línea (BusyBox crond
 *     hereda el entorno). En ningún caso el secreto toca Git.
 *   · `web:3000` es el nombre del servicio Next en la red interna del compose.
 *
 * EXTRAS: `searates-refresh` existe en `app/api/cron/` pero no está en `vercel.json`
 * (nunca se agendó en Vercel). En el servidor va semanal, lunes 06:00 UTC, antes de
 * que abra la jornada en Caracas (02:00 VET) y dentro del presupuesto de 100 consultas
 * mensuales de SeaRates (20 rutas × ≤5 lunes).
 * `bcv-rates` va una vez por hora, en el minuto 5: 24 invocaciones nominales al
 * día. La agenda no habilita su flag ni garantiza una cuota global de requests.
 *
 * DETERMINISTA: misma `vercel.json` ⇒ mismos bytes. Se conserva el orden de
 * `vercel.json` (no se reordena) para que un diff del crontab se lea igual que el
 * diff de su fuente. Siempre LF, como fija `.gitattributes`.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const VERCEL_JSON = "vercel.json";
export const CRONTAB_PATH = "infra/dtd-cargo/cron/crontab";
export const CRON_ROUTES_DIR = "app/api/cron";

/** Prefijo fijo del comando; el path de la ruta se concatena al final. */
export const CURL_PREFIX =
  'curl -fsS --max-time 290 -H "Authorization: Bearer ${CRON_SECRET}" http://web:3000';

/**
 * Crons que viven solo en el servidor (no están en `vercel.json`).
 * Cada entrada lleva su motivo: un extra sin motivo es un horario que nadie sabe
 * por qué existe.
 */
export const EXTRA_CRONS = [
  {
    path: "/api/cron/searates-refresh",
    schedule: "0 6 * * 1",
    reason:
      "semanal, lunes 06:00 UTC · no está en vercel.json · 20 rutas/corrida caben en el plan gratis de SeaRates (100/mes)",
  },
  {
    path: "/api/cron/bcv-rates",
    schedule: "5 * * * *",
    reason:
      "cada hora, minuto 5 UTC · 24 invocaciones nominales/día · requiere flag y scope explícitos; no activa la carga",
  },
];

const CRON_PATH_RE = /^\/api\/cron\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
// Cinco campos separados por un espacio; cada campo admite lo que BusyBox crond
// entiende: números, `*`, rangos `-`, listas `,` y pasos `/`.
const CRON_FIELD_RE = /^[0-9*][0-9*,\-/]*$/;

/** Lee los crons de `vercel.json` tal cual, sin reordenar. */
export function readVercelCrons(root = process.cwd()) {
  const raw = readFileSync(join(root, VERCEL_JSON), "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.crons)) {
    throw new Error(`${VERCEL_JSON} no tiene un arreglo \`crons\``);
  }
  return parsed.crons.map(({ path, schedule }) => ({ path, schedule }));
}

/**
 * Valida las entradas (de vercel.json + extras) contra el repo.
 * Devuelve la lista de errores; vacía si todo está bien.
 */
export function validateCronEntries(entries, root = process.cwd()) {
  const errors = [];
  const seen = new Set();
  for (const entry of entries) {
    const { path, schedule } = entry ?? {};
    if (typeof path !== "string" || !CRON_PATH_RE.test(path)) {
      errors.push(`ruta inválida: ${JSON.stringify(path)} (se espera /api/cron/<slug>)`);
      continue;
    }
    if (seen.has(path)) {
      errors.push(`ruta duplicada: ${path}`);
    }
    seen.add(path);
    const slug = path.match(CRON_PATH_RE)[1];
    if (!existsSync(join(root, CRON_ROUTES_DIR, slug, "route.ts"))) {
      errors.push(`ruta sin handler: ${path} → falta ${CRON_ROUTES_DIR}/${slug}/route.ts`);
    }
    const fields = typeof schedule === "string" ? schedule.trim().split(" ") : [];
    if (fields.length !== 5 || !fields.every((f) => CRON_FIELD_RE.test(f))) {
      errors.push(`horario inválido para ${path}: ${JSON.stringify(schedule)} (5 campos cron)`);
    }
  }
  return errors;
}

function cronLine({ path, schedule }) {
  return `${schedule} ${CURL_PREFIX}${path}`;
}

/** Arma el texto del crontab. No toca el disco. */
export function buildCrontab(vercelCrons, extras = EXTRA_CRONS) {
  const lines = [
    "# Generado por scripts/build-crontab.mjs desde vercel.json · no editar a mano.",
    "# Regenerar: node scripts/build-crontab.mjs · Verificar: node scripts/build-crontab.mjs --check",
    "# Horarios en UTC (los mismos que agenda Vercel). ${CRON_SECRET} se queda literal:",
    "# lo resuelve el contenedor `cron` (entrypoint con envsubst, o sh -c) desde su entorno.",
    "",
    `# ${vercelCrons.length} crons de vercel.json, en su mismo orden.`,
    ...vercelCrons.map(cronLine),
  ];
  if (extras.length > 0) {
    lines.push("", "# Solo en el servidor (no están en vercel.json).");
    for (const extra of extras) {
      lines.push(`# ${extra.path}: ${extra.reason}`, cronLine(extra));
    }
  }
  return `${lines.join("\n")}\n`;
}

/** Lee, valida y arma: lo que escribe `main` y lo que compara la prueba. */
export function generateCrontab(root = process.cwd(), extras = EXTRA_CRONS) {
  const vercelCrons = readVercelCrons(root);
  const errors = validateCronEntries([...vercelCrons, ...extras], root);
  return { content: buildCrontab(vercelCrons, extras), errors, count: vercelCrons.length + extras.length };
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const root = process.cwd();
  const target = resolve(root, CRONTAB_PATH);
  const { content, errors, count } = generateCrontab(root);

  if (errors.length > 0) {
    console.error(`[FAIL] build-crontab: ${errors.length} problema(s)`);
    for (const e of errors) console.error(`   · ${e}`);
    process.exit(1);
  }

  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (checkOnly) {
    if (current === content) {
      console.log(`[OK] build-crontab: ${CRONTAB_PATH} al día (${count} crons)`);
      process.exit(0);
    }
    console.error(
      `[FAIL] build-crontab: ${CRONTAB_PATH} ${current === null ? "no existe" : "no coincide con vercel.json"} → corre node scripts/build-crontab.mjs`,
    );
    process.exit(1);
  }

  if (current === content) {
    console.log(`[OK] build-crontab: ${CRONTAB_PATH} sin cambios (${count} crons)`);
    return;
  }
  writeFileSync(target, content, "utf8");
  console.log(`[OK] build-crontab: ${CRONTAB_PATH} ${current === null ? "creado" : "regenerado"} (${count} crons)`);
}

// Solo corre `main` cuando se invoca como script; al importarlo desde la prueba, no.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
