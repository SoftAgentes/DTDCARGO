import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "node:url";

const configDir = fileURLToPath(new URL(".", import.meta.url));

/**
 * Config de Vitest para tests unitarios y de componentes.
 *
 * - `jsdom` environment para componentes React.
 * - Alias `@/*` espejado al de TypeScript para que los imports de tests
 *   funcionen igual que en el código (ej. `@/lib/text`).
 * - Alias `server-only` → stub vacío: ese módulo lo provee el bundler de Next
 *   (no existe en disco), así que sin el alias la resolución estática de
 *   `import "server-only"` falla. Permite testear módulos server-only.
 * - `setupFiles` carga `@testing-library/jest-dom` para matchers DOM.
 * - `e2e/**` excluido para que Playwright corra por separado.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": configDir,
      "server-only": path.resolve(configDir, "vitest/server-only.stub.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // `.claude/**` excluye los worktrees del harness (checkouts de otras ramas):
    // sus tests corren en su propio entorno y no son del repo principal.
    exclude: ["**/node_modules/**", "**/.next/**", "**/.claude/**", "**/e2e/**"],
    css: false,
    /**
     * 20 s en vez de los 5 s por defecto.
     *
     * Este equipo corre el gate con 30+ worktrees vivos y el paso `test` fallaba
     * al azar: dos corridas seguidas SIN cambiar una línea rompieron conjuntos
     * DISTINTOS (registro · fuentes chinas · horneado del Norte, y después copy ·
     * fuentes chinas · registro), siempre con `Test timed out in 5000ms` y con
     * 4855 de 4858 en verde. Los mismos archivos pasan 17/17 en aislamiento.
     *
     * No es que los tests sean lentos: es que bajo contención un render de jsdom
     * se pasa de los 5 s. Playwright ya había recibido este mismo tratamiento
     * (`retries: 1` en local, 2026-08-05) y a vitest nunca se le puso red.
     *
     * ⚠️ Un gate que falla al azar enseña a ignorar el rojo — así se perdió la
     * migración 0228. Subir el techo NO tapa un test roto: uno roto falla igual,
     * y con una aserción, no con un reloj.
     */
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // SDD0378: Windows expone32 CPU pero sólo16GB de RAM en este host.
    // El default31 workers agotó20s al importar un servicio (7125/7126).
    // Acotar procesos, no ampliar tiempos ni retirar casos. CLI sigue solo;
    // las otras plataformas conservan el default del runner.
    maxWorkers: process.platform === "win32" ? 4 : undefined,
    // SDD0378: el CLI pasó52/52 aislado, pero agotó10s de spawn bajo la
    // tanda paralela. Conservar todos los casos y plazos; correr sólo ese
    // archivo después del grupo unitario acotado.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          exclude: ["scripts/__tests__/harness-worktree-safety.test.mjs"],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: "worktree-cli",
          include: ["scripts/__tests__/harness-worktree-safety.test.mjs"],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
