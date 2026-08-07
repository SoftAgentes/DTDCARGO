import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

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
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "vitest/server-only.stub.ts"),
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
  },
});
