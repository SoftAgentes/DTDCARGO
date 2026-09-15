/**
 * Las dos decisiones del paso `e2e` del gate, separadas de `verify.mjs` para
 * poder PROBARLAS: qué puerto usa el dev server, y cuándo se absuelve una
 * corrida que salió ≠0.
 *
 * Viven juntas porque fallaron juntas el 2026-08-25, y la segunda tapó a la
 * primera: el puerto cayó en un rango que Windows reserva, el dev server nunca
 * levantó, la suite corrió CERO tests y el gate imprimió `[OK] e2e (con aviso)`.
 */

import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  MARCA_SIN_SUPABASE,
  detectarSupabasePublico,
  motivoSinSupabase,
} from "../e2e/_helpers/supabase-publico.cjs";

// La detección vive en e2e/_helpers para que los specs y el gate usen la misma.
export { MARCA_SIN_SUPABASE, detectarSupabasePublico, motivoSinSupabase };

export const PUERTO_BASE = 3100;
export const PUERTO_RANGO = 700; // 3100–3799
/** Coprimo con 700 → la sucesión recorre el rango ENTERO sin repetir. */
const PASO = 101;

/**
 * Puertos candidatos para el dev server del e2e, en orden de preferencia.
 *
 * DETERMINÍSTICO POR WORKTREE: el primero sale del hash del directorio, así que
 * dos ventanas en carpetas distintas nunca se pelean el mismo puerto — que es
 * lo que este cálculo vino a resolver, para que Playwright no reuse con
 * `reuseExistingServer` el `next dev` de OTRA ventana y mida código ajeno.
 *
 * PERO YA NO ES UNO SOLO, y ahí estaba el bug. Windows reserva rangos enteros
 * para Hyper-V/WSL (`netsh interface ipv4 show excludedportrange protocol=tcp`)
 * y en esta máquina el bloque va de **3308 a 3807 sin cortes** — casi todo el
 * rango de arriba. Al worktree `cambios-erp` le tocó el 3365 y el servidor
 * murió con `EACCES: permission denied 0.0.0.0:3365`.
 *
 * ⚠️ Los saltos son de 101 y NO de 1 a propósito: con pasos de 1 los 40
 * candidatos caerían todos dentro del mismo bloque reservado, que mide
 * cientos de puertos, y la lista entera sería inútil.
 */
export function candidatosDePuerto(cwd, cuantos = 40) {
  const h = crypto.createHash("sha1").update(cwd).digest();
  const base = h.readUInt16BE(0) % PUERTO_RANGO;
  return Array.from({ length: Math.min(cuantos, PUERTO_RANGO) }, (_, i) =>
    PUERTO_BASE + ((base + i * PASO) % PUERTO_RANGO),
  );
}

/**
 * El primer candidato en el que el sistema operativo DEJA escuchar, o `null`.
 *
 * No se parsea la salida de `netsh`: sus encabezados están traducidos y varían
 * por máquina. Se prueba a atar el puerto, que es la pregunta real y no depende
 * de adivinar por qué está prohibido — reservado por Hyper-V, tomado por otro
 * worktree o por cualquier otro proceso, da igual.
 *
 * Corre en un hijo porque el gate resuelve esto de forma síncrona.
 */
export function primerPuertoLibre(candidatos) {
  const guion = `
    const net = require("node:net");
    const puertos = ${JSON.stringify(candidatos)};
    (async () => {
      for (const p of puertos) {
        const libre = await new Promise((res) => {
          const s = net.createServer();
          s.once("error", () => res(false));
          s.listen(p, "0.0.0.0", () => s.close(() => res(true)));
        });
        if (libre) { process.stdout.write(String(p)); return; }
      }
    })();
  `;
  const r = spawnSync(process.execPath, ["-e", guion], { encoding: "utf8" });
  const p = Number(String(r.stdout ?? "").trim());
  return Number.isInteger(p) && p > 0 ? p : null;
}

/**
 * ¿Se puede absolver una corrida de Playwright que salió ≠0?
 *
 * 🔴 **Cero tests NO es verde.** Antes bastaba `unexpected === 0`, y eso también
 * es cierto cuando no corrió NADA: si el `webServer` no arranca, Playwright
 * sale 1 con `expected: 0` y `unexpected: 0`. El gate lo absolvía con el texto
 * del worker de WebKit — que describe el caso OPUESTO, "pasaron todos pero el
 * proceso no cerró". Un paso que no midió tiene que salir rojo, no verde.
 */
export function absuelveCorrida(stats) {
  if (!stats) return false;
  if (stats.unexpected !== 0) return false;
  return Number(stats.expected) > 0;
}

/**
 * El watchdog del gate (SDD-0454) canaliza la salida del e2e para medir la
 * inactividad, y un Playwright que escribe a un pipe cree que no hay terminal:
 * pierde los colores y el reporter `list` deja de reescribir líneas. Si quien
 * corre el gate SÍ está en una terminal, se le pasa su tamaño con
 * `PLAYWRIGHT_FORCE_TTY` (Playwright 1.60, `terminalScreen` en
 * `lib/runner/index.js`) y la corrida se ve como antes. Un valor puesto a mano
 * gana; sin terminal —un Worker que guarda el log— no se agrega nada.
 */
export function envParaSalidaCanalizada(stdout, env = process.env) {
  if (!stdout?.isTTY || env.PLAYWRIGHT_FORCE_TTY !== undefined) return {};
  return { PLAYWRIGHT_FORCE_TTY: `${stdout.columns || 100}x${stdout.rows || 40}` };
}

/**
 * SDD-0470 · Las pruebas que el reporte JSON de Playwright da por omitidas por
 * falta de Supabase público. Cuenta sólo las anotaciones `skip` cuyo motivo
 * empieza por `MARCA_SIN_SUPABASE`, en el test o en cualquiera de sus
 * intentos. Un Tier 3 omitido por falta de seed tiene otro motivo y no cuenta:
 * esa omisión es anterior a esta spec y no cambia.
 */
export function omisionesSinSupabase(reporte) {
  const encontradas = [];
  const visitar = (suite) => {
    for (const spec of suite?.specs ?? []) {
      for (const t of spec.tests ?? []) {
        if (t.status !== "skipped") continue;
        const anotaciones = [
          ...(t.annotations ?? []),
          ...(t.results ?? []).flatMap((r) => r.annotations ?? []),
        ];
        const marcada = anotaciones.some(
          (a) => a?.type === "skip" && String(a.description ?? "").startsWith(MARCA_SIN_SUPABASE),
        );
        if (marcada) {
          encontradas.push({
            archivo: spec.file,
            linea: spec.line,
            titulo: spec.title,
            proyecto: t.projectName ?? "?",
          });
        }
      }
    }
    for (const hija of suite?.suites ?? []) visitar(hija);
  };
  for (const suite of reporte?.suites ?? []) visitar(suite);
  return encontradas;
}

/**
 * SDD-0470 · ¿El e2e quedó con COBERTURA PARCIAL por falta de Supabase público?
 *
 * Devuelve `null` o `{ reason, casos }`. `reason` es corto porque viaja al
 * veredicto final; `casos` lista cada prueba omitida como
 * `archivo:línea «título» [proyectos]` para el aviso del paso.
 *
 * - Hay pruebas omitidas con la marca: parcial, las cuente quien las cuente.
 *   Si verify ve Supabase configurado, el motivo dice que hay una
 *   inconsistencia: no se esconde.
 * - Falta Supabase y no hay reporte legible (un corte del watchdog, por
 *   ejemplo): parcial, y el motivo dice que no se pudieron contar.
 * - Falta Supabase, el reporte es legible y no omitió nada (un BASE_URL
 *   remoto): no es parcial, porque no se dejó nada sin medir.
 */
export function coberturaParcialE2E({ deteccion, reporte }) {
  const faltan = deteccion.faltan.join(", ");
  if (!reporte) {
    return deteccion.configurado
      ? null
      : {
          reason: `sin Supabase público (falta ${faltan}); sin reporte legible para contar las pruebas omitidas`,
          casos: [],
        };
  }
  const omitidas = omisionesSinSupabase(reporte);
  if (omitidas.length === 0) return null;

  const porCaso = new Map();
  for (const o of omitidas) {
    const clave = `${o.archivo}:${o.linea}`;
    const caso = porCaso.get(clave) ?? { clave, titulo: o.titulo, proyectos: new Set() };
    caso.proyectos.add(o.proyecto);
    porCaso.set(clave, caso);
  }
  const casos = [...porCaso.values()]
    .sort((a, b) => a.clave.localeCompare(b.clave, "en", { numeric: true }))
    .map((c) => `${c.clave} «${c.titulo}» [${[...c.proyectos].sort().join(", ")}]`);
  const causa = deteccion.configurado
    ? "por falta de Supabase público, aunque verify lo ve configurado: revisa el entorno y los .env* del worktree"
    : `sin Supabase público (falta ${faltan})`;
  return { reason: `${omitidas.length} prueba(s) omitidas ${causa}`, casos };
}
