import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "_handoff_preview/**",
    "_payload-disabled/**",
    "e2e/**", // Playwright tests usan import maps distintos
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
