// @vitest-environment node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SDD-0540 · Fase 1 · los scripts del entorno de prueba, desde la suite.
 *
 * Corre las dos pruebas con dobles de infra/ops/tests (docker, curl y getent de
 * mentira: nada real) y exige «0 FALLÓ». Las de Docker y Postgres efímero
 * (prueba-compose-prueba.sh, *-efimera.sh) NO corren aquí: piden Docker y turno.
 * También revisa la sintaxis (`bash -n`) de todos los scripts nuevos.
 */

// En Windows, el `bash` del PATH puede ser el de WSL: se prefiere el de Git.
const BASH = (() => {
  if (process.platform !== "win32") return "bash";
  for (const p of ["C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files\\Git\\usr\\bin\\bash.exe"]) {
    if (existsSync(p)) return p;
  }
  return "bash";
})();

function correr(script) {
  return new Promise((done) => {
    const hijo = spawn(BASH, [script], { cwd: resolve("."), env: { ...process.env, LC_ALL: "C.UTF-8" } });
    let salida = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (salida += d));
    hijo.on("close", (codigo) => done({ codigo, salida }));
  });
}

const SCRIPTS = [
  ...readdirSync(resolve("infra/ops/staging")).filter((f) => f.endsWith(".sh")).map((f) => join("infra/ops/staging", f)),
  "infra/ops/migrate/aplicar-migracion.sh",
  "infra/ops/lib/migracion.sh",
  ...readdirSync(resolve("infra/ops/tests")).filter((f) => /prueba-(scripts-entorno-prueba|aplicar-migracion|compose-prueba|aplicar-migracion-efimera|resetear-base-efimera)\.sh$|dobles-prueba\.sh$/.test(f)).map((f) => join("infra/ops/tests", f)),
];

describe("SDD-0540 · scripts del entorno de prueba", () => {
  it("todos pasan bash -n", () => {
    expect(SCRIPTS.length).toBeGreaterThanOrEqual(15);
    for (const s of SCRIPTS) {
      const r = spawnSync(BASH, ["-n", s], { cwd: resolve("."), encoding: "utf8" });
      expect(r.status, `${s}: ${r.stderr}`).toBe(0);
    }
  });

  // Las dos en paralelo: en Windows cada una tarda cerca de un minuto (procesos de Git Bash).
  it(
    "las pruebas con dobles salen con 0 FALLÓ",
    async () => {
      const [a, b] = await Promise.all([
        correr("infra/ops/tests/prueba-scripts-entorno-prueba.sh"),
        correr("infra/ops/tests/prueba-aplicar-migracion.sh"),
      ]);
      for (const r of [a, b]) {
        const fallas = r.salida.split("\n").filter((l) => l.startsWith("FALLÓ"));
        expect(fallas, r.salida.slice(-3000)).toEqual([]);
        expect(r.salida).toMatch(/RESULTADO: \d+ PASÓ · 0 FALLÓ/);
        expect(r.codigo).toBe(0);
      }
    },
    600_000,
  );
});
