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
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**"],
    css: false,
  },
});
