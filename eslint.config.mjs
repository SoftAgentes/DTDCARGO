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
    // Worktrees del harness / sesiones paralelas (`.claude/worktrees/<rama>/…`):
    // son checkouts completos de OTRAS ramas; `eslint .` no debe crawlearlos (sus
    // docs/mockups legacy rompen el lint del repo principal). También cubre
    // commands/settings de `.claude`, que no son código de la app.
    ".claude/**",
    // Documentación + mockups de handoff (Claude Design *.jsx congelados,
    // brand-books, etc.): material de referencia, NO código de la app. No se
    // lintea (genera cientos de jsx-no-undef/no-unescaped en snippets que no
    // son componentes reales).
    "docs/**",
    "e2e/**", // Playwright tests usan import maps distintos
    "playwright-report/**",
    "test-results/**",
    // Edge Functions de Supabase corren en Deno (imports jsr:/ global Deno):
    // no las lintea el config de Next. Se chequean con el bundler de deploy.
    "supabase/functions/**",
    // Grafo de conocimiento de graphify (AST generado + scripts _gen_*.js):
    // output regenerable y gitignored, NO código de la app. `graphify update`
    // deja .js con require() de Node que rompen el lint del gate.
    "graphify-out/**",
  ]),

  // ─── Frontera sitio-público ↔ ERP ────────────────────────────────────
  // CLAUDE.md "Aislamiento crítico" convertido en error de CI. El único puente
  // permitido entre el sitio público y el ERP es @/lib/shared/*.
  {
    // Marketing + tracking público + componentes raíz: cero código del ERP, cero @supabase.
    // (app/invitar/ NO está acá: es onboarding del Studio y usa DB por diseño.)
    files: [
      "app/estimacion/**",
      "app/cotizador-flete/**",
      "app/track/**",
      "app/contacto/**",
      "app/calculadora/**",
      "app/calculadora-terrestre/**",
      "app/servicios/**",
      "app/academia/**",
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

  // ─── Deuda de lint · reglas nuevas del React Compiler ────────────────
  // `eslint-plugin-react-hooks` v6 (bundleado por Next 16) sumó reglas del
  // React Compiler que marcan como ERROR patrones pre-existentes que hoy
  // funcionan (setState en effects de re-sync/hidratación, Date.now()/
  // Math.random() en render, const usado antes de declararse en callbacks
  // diferidos, refs). Son ~50 hits en ~30 componentes; refactorizarlos todos
  // a la vez es riesgoso y fuera del alcance de cada feature.
  //
  // Las dejamos en "warn": preservan la señal (siguen apareciendo) sin
  // romper `pnpm lint`/CI. Refactor incremental — usar GastosClient
  // (debounce en handler, sin effect de re-sync) como patrón de referencia.
  //
  // NO se bajan: react-hooks/rules-of-hooks (bugs reales), las reglas de
  // frontera público↔ERP, ni react/no-unescaped-entities.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);

export default eslintConfig;
