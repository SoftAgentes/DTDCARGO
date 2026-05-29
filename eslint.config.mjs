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
    "e2e/**", // Playwright tests usan import maps distintos
    "playwright-report/**",
    "test-results/**",
  ]),

  // ─── Frontera sitio-público ↔ ERP ────────────────────────────────────
  // CLAUDE.md "Aislamiento crítico" convertido en error de CI. El único puente
  // permitido entre el sitio público y el ERP es @/lib/shared/*.
  {
    // Marketing + tracking público + componentes raíz: cero código del ERP, cero @supabase.
    // (app/invitar/ NO está acá: es onboarding del Studio y usa DB por diseño.)
    files: [
      "app/cotizar/**",
      "app/track/**",
      "app/contacto/**",
      "app/calculadora/**",
      "app/servicios/**",
      "app/noticias/**",
      "app/glosario/**",
      "components/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/studio/**",
                "@/lib/db/**",
                "@/app/studio/**",
                "@supabase/*",
              ],
              message:
                "Frontera: el sitio público no importa código del ERP (lib/studio, lib/db, app/studio) ni @supabase directo. Tipos compartidos → @/lib/shared/* ; datos → lib/public/.",
            },
          ],
        },
      ],
    },
  },
  {
    // lib/public es la capa de datos del sitio público: PUEDE usar @supabase
    // (cliente anon para el RPC público_track), pero NO el código del ERP.
    files: ["lib/public/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/studio/**", "@/lib/db/**", "@/app/studio/**"],
              message:
                "Frontera: lib/public no importa código del ERP. Tipos compartidos → @/lib/shared/*.",
            },
          ],
        },
      ],
    },
  },
  {
    // app/back (CMS del sitio público) es su propia superficie: no importa el Studio.
    files: ["app/back/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/studio/**", "@/app/studio/**"],
              message:
                "Frontera: app/back es superficie propia (CMS). No importa lib/studio ni app/studio.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
