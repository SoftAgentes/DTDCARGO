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
