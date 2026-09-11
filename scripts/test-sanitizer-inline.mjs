// Compatibilidad del comando antiguo; la suite importa el módulo de producción.
// Sus siete vectores P1 y siete sanity checks viven en la prueba descubierta
// por Vitest en verify y CI (SDD-0452), sin copia paralela del sanitizador.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url)),
  "run",
  "scripts/tests/bug-sanitizer.test.ts",
], { cwd: root, stdio: "inherit", windowsHide: true });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
