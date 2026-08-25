import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    // ⚠️ El dist dir del GATE, hermano de `.next/**` — y su ausencia acá ya
    // costó un rojo falso (2026-08-24). `verify.mjs` construye en
    // `.next-verify/` y lo limpia al terminar; si una corrida se corta antes
    // (sesión reiniciada, Ctrl-C), el bundle queda en disco y la corrida
    // SIGUIENTE lo lintea — `lint` va antes que `build`, así que falla con
    // errores de `require()` y `@ts-ignore` sobre código generado que nadie
    // escribió. El síntoma no se parece en nada a la causa.
    ".next-verify/**",
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
    // Vault de Obsidian (el repo se abre como vault local · ver .gitignore):
    // config + bundles minificados de plugins de terceros (main.js de 500KB+),
    // gitignored y NO código de la app. ESLint no respeta .gitignore por sí solo
    // → sin esto, los bundles inflan el gate con miles de warnings/errores ajenos.
    ".obsidian/**",
  ]),

  // ─── Frontera sitio-público ↔ ERP ────────────────────────────────────
  // CLAUDE.md "Aislamiento crítico" convertido en error de CI. El único puente
  // permitido entre el sitio público y el ERP es @/lib/shared/*.
  {
    // Marketing + tracking público + componentes raíz: cero código del ERP, cero @supabase.
    //
    // NO están acá, y por qué (todas son públicas PERO respaldadas por la DB, así
    // que la regla no aplica; su control de acceso es propio y explícito):
    //   · app/invitar/  — onboarding del Studio; usa DB por diseño.
    //   · app/verificar/, app/registro/, app/p/[token]/ — usan el admin client
    //     con el visitante anónimo (throttle + tokens como control).
    //   · app/marca/ — SDD-0238. El centro de marca dejó de ser sólo una vitrina
    //     estática: valida un código contra `brand_access` y lee el catálogo de
    //     `brand_assets`. Se sacó de la lista de forma explícita en vez de dejar
    //     la violación TRANSITIVA que ya existía (importaba `@/lib/auth/session`,
    //     que importa `@/lib/db/server`, y el lint sólo mira imports directos).
    files: [
      "app/tarifas/**",
      "app/fcl/**",
      "app/shipping-mark/**",
      "app/pre-alertas/**",
      "app/track/**",
      "app/contacto/**",
      "app/calculadora-terrestre/**",
      "app/servicios/**",
      "app/academia/**",
      "app/noticias/**",
      "app/glosario/**",
      "app/importar-de-china/**",
      "app/brochure/**",
      "app/nosotros/**",
      "app/faq/**",
      "app/enlaces/**",
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

  // ─── El tope de 1.000 filas de PostgREST ────────────────────────────────
  //
  // `.limit(5000)` NO sortea `db-max-rows`: PostgREST devuelve 1.000 filas, sin
  // error y sin aviso. El número es una intención, no un contrato.
  //
  // Donde se pinta una lista se ven menos filas y se nota. Donde el resultado
  // se AGREGA en JS —una suma, un conteo, un promedio— no falta una fila: sale
  // un número equivocado con cara de verdad. Ya pasó: el tablero del CRM decía
  // "1.000 leads" teniendo 3.145, y el embudo, la antigüedad, la cartera por
  // asesor y la conversión salían todos del 32% de los datos. Meses así, porque
  // nada falla — sólo miente.
  //
  // Esta regla es el mecanismo que impide la recaída. Entre la auditoría del
  // 2026-08-13 y el día siguiente, los sitios pasaron de 102 a 105 **sin que
  // nadie hiciera nada mal**: simplemente no había nada que lo cazara.
  //
  // Si de verdad hace falta un tope alto y declarado (una lista de UI que se
  // corta a propósito), el `eslint-disable-next-line` va con el motivo escrito
  // al lado. Un tope dicho es una decisión; uno silencioso es este bug.
  {
    files: ["lib/**/*.ts", "lib/**/*.tsx", "app/**/*.ts", "app/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='limit'][arguments.0.type='Literal'][arguments.0.value>1000]",
          message:
            "`.limit(N)` con N > 1000 no sortea el tope de PostgREST: devuelve 1000 filas en silencio. Usa fetchAllPaged() de @/lib/db/paginate, o agrega en SQL con una RPC. Si el tope es a propósito, decláralo con un eslint-disable y el motivo.",
        },
      ],
    },
  },
]);

export default eslintConfig;
