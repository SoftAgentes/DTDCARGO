import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Config de Vitest para tests unitarios y de componentes.
 *
 * - `jsdom` environment para componentes React.
 * - Alias `@/*` espejado al de TypeScript para que los imports de tests
 *   funcionen igual que en el código (ej. `@/lib/text`).
 * - `setupFiles` carga `@testing-library/jest-dom` para matchers DOM.
 * - `e2e/**` excluido para que Playwright corra por separado.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
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
