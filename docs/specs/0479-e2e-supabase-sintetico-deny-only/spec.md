---
sdd: "0479"
title: "Supabase sintético deny-only para el e2e local: las pruebas que necesitan Supabase corren en vez de omitirse"
status: in-progress
author: "Claude Code (Worker) para Sam"
created: 2026-09-18
updated: 2026-09-18
supersedes: null
superseded_by: null
related: ["0470", "0320", "0454"]
confidencialidad: interno
---

# SDD-0479 — Supabase sintético deny-only para el e2e local de `verify`

> Sin `NEXT_PUBLIC_SUPABASE_URL` ni `NEXT_PUBLIC_SUPABASE_ANON_KEY`, SDD-0470
> omite con motivo 5 pruebas (15 ejecuciones en tres proyectos) y el cierre
> local de `verify` queda con cobertura parcial en el e2e. Ahora, en el caso
> habitual (faltan las dos, destino local y `next dev` propio), Playwright
> levanta un Supabase sintético que rechaza todo y le pasa a `next dev` su URL
> y una anon key visible que no es secreta. `proxy.ts` crea su cliente y esas
> pruebas corren. Ningún dato real entra ni sale.

## Decisiones de Sam (2026-09-18, textual, por AskUserQuestion)

- **Decisiones 1 y 2 de SDD-0470.** Pregunta: «¿Abro una spec para correrlas
  contra un Supabase sintético local que rechaza todo, y qué hago con
  attachments-gastos-pilot-network?». Eligió «Spec nueva; attachments igual»,
  cuya descripción decía: «Un servidor local deny-only con URL y anon key
  sintéticas: las 15 vuelven a medir y WebKit deja de navegar a páginas caídas.
  attachments sigue corriendo: pasa 3/3 y no depende de Supabase.».
- **Decisión 3 de SDD-0470.** Eligió «Medir y no cambiar»: sin cambios en WebKit
  en Windows; si en los recibos de `verify` vuelve a salir «did not exit», se
  abre la spec del remedio.

Esta spec cumple la primera. `attachments-gastos-pilot-network.spec.ts` no se
toca, y WebKit tampoco.

## Contexto

- **SDD-0470** (en `main`) detecta Supabase público como lo haría `next dev`
  (`e2e/_helpers/supabase-publico.cjs`). Omite con la marca `SIN SUPABASE
  PÚBLICO` las pruebas que llaman a `requiereSupabase()`:
  - `auth.spec.ts`, 4 casos;
  - `global-search.spec.ts`, 1 caso.
  `verify` declara el e2e con cobertura parcial crítica: cierre INCOMPLETO.
- **SDD-0320** proponía un servidor local deny-only con URL y anon key
  sintéticas. Su código (`8725a341`) nunca llegó a `main`.
- **Evidencia de 0470.** Con URL y anon key sintéticas, apuntando a un puerto
  cerrado, los 5 casos pasaban y `proxy.ts` no lanzaba: sólo necesitan
  configuración pública no vacía.
- **Por qué no hace falta un Supabase real.** Sin cookie de sesión, `getUser()`
  de `@supabase/auth-js` 2.106.1 devuelve `AuthSessionMissingError` sin salir a
  la red (`GoTrueClient.js:2489-2498`). `proxy.ts:93` trata eso como «sin
  usuario» y redirige al login, que es lo que afirman las 5 pruebas.

## Alcance

- `e2e/_helpers/supabase-publico.cjs` y `.d.cts`: el plan único
  (`planSupabaseE2E`), el puerto, la anon key sintética y la detección
  efectiva.
- `scripts/e2e/supabase-deny-server.mjs` (nuevo): el servidor deny-only.
- `playwright.config.ts`: `resolveSupabaseE2E`, `buildWebServers` y la
  metadata del modo.
- `e2e/_helpers/supabase.ts`: `requiereSupabase()` no omite en modo sintético.
- `scripts/verify.mjs` y `scripts/verify-e2e.mjs` (+ `.d.mts` nuevo): el
  preflight usa el mismo plan y comprueba que el puerto esté libre.
- Pruebas:
  - `scripts/tests/e2e-supabase-sintetico.node.mjs` (nuevo);
  - `scripts/tests/verify-e2e-sin-supabase.node.mjs`, el regex del cableado;
  - `scripts/__tests__/playwright-config.test.ts`.
- `e2e/README.md`, esta spec, el índice y el handoff.
- Fuera de alcance:
  - producto (`proxy.ts`, `app/`, `lib/`), CI y los specs e2e: ningún
    `*.spec.ts` cambia;
  - propagar a `next dev` las variables de un branch efímero (Tier 3);
  - WebKit en Windows (decisión 3: medir);
  - los Tier 3 sin seed, que conservan su `test.skip`.

## Diseño

### Una sola decisión: `planSupabaseE2E`

La toman `playwright.config.ts`, `requiereSupabase()` (a través de la
metadata) y `verify`, con la misma detección de SDD-0470: el entorno y los
`.env*` que carga `next dev`, con su precedencia y su modo test.

| Modo | Cuándo | Qué pasa |
|---|---|---|
| `remoto` | El destino no es local | Nada, igual que en 0470 |
| `configurado` | El entorno o un `.env*` define las dos | Se usa lo real; nunca se pisa |
| `parcial` | Define una sola | Nunca se mezcla lo real con lo sintético: omisión con motivo de 0470 |
| `ausente` | Faltan las dos, pero el `next dev` no lo levanta Playwright (servidor reusado) o es un branch efímero | Omisión con motivo de 0470 |
| `sintetico` | Faltan las dos, destino local, `next dev` propio y no efímero | Deny-only y `next dev` con su URL y la anon key sintética |

- **Vacías cuentan como ausentes.** Una variable vacía en un `.env*` cuenta
  como ausente, como en 0470. El entorno del `next dev` gana sobre el
  archivo, como en `@next/env`.
- **El puerto.** Gana `E2E_SUPABASE_SINTETICO_PORT`; si no está, el de la app
  + 10000 (− 10000 si se pasa de 65535). Un valor inválido, o igual al de la
  app, es un error, no una adivinanza.
- **La anon key** (`e2e-supabase-sintetico-deny-only-no-es-un-secreto`) es
  visible a propósito: no pertenece a ningún proyecto.

### El servidor deny-only

`scripts/e2e/supabase-deny-server.mjs`:

- Escucha sólo en `127.0.0.1`.
- `GET /__health` responde 200; es la URL que espera Playwright.
- `OPTIONS` responde 204.
- Todo lo demás, Auth, PostgREST, Storage o Realtime, en cualquier método,
  responde 503 con un JSON corto, sin eco del pedido.
- No lee cabeceras, descarta el cuerpo, no guarda nada y no escribe logs del
  pedido.
- Es el de SDD-0320, con la ruta de salud compartida.

### `playwright.config.ts`

- **Qué levanta.** `buildWebServers(runtime, plan)`:
  - sin sintético, el mismo `next dev` de siempre, con la misma forma;
  - con sintético, primero el deny-only (sin reuso: un puerto ocupado es un
    error visible) y después `next dev`, con `env` = entorno actual + URL y anon
    key sintéticas.
- **El proceso del runner no se muta.** Así, importar la config (por ejemplo,
  en Vitest) no cambia el entorno de nadie.
- **La metadata** lleva sólo el modo: `metadata.supabaseE2E.modo`. Viaja al
  reporte y nunca lleva valores.

### `requiereSupabase()`

- **Primero mira el modo.** Si es `sintetico`, la prueba corre: el worker no ve
  las variables en su entorno, pero el `next dev` sí las tiene.
- **En cualquier otro modo**, la misma omisión con motivo de 0470.
- **Ningún spec cambia**, y el inventario de 0470 sigue vigente.

### `verify`

- **El plan del paso.** `planSupabaseDelPaso` calcula el plan con el mismo
  entorno que recibirá Playwright.
  - El destino lo da `destinoE2E`, una réplica de `resolvePlaywrightRuntime`.
    Una prueba de Vitest compara las dos.
  - En los dos caminos del preflight: `next dev` propio o reusado.
- **El puerto del deny-only.** En modo sintético el gate prueba candidatos
  libres (`candidatosSupabaseSintetico`): primero el de la app + 10000, después
  una sucesión propia por worktree en 13100–13799. Pasa el elegido en
  `E2E_SUPABASE_SINTETICO_PORT`. Sin puerto libre lo avisa, y Playwright usa el
  suyo por defecto.
- **Aviso del preflight.** «Sin Supabase público: el next dev del e2e corre
  contra un Supabase sintético deny-only en 127.0.0.1:P (SDD-0479)». En los
  otros modos, el de 0470.
- **Cobertura.** `e2eSupabase` pasa a ser la detección efectiva del plan: en
  modo sintético, «configurado».
  - Sin omisiones marcadas, el e2e no es parcial.
  - Si aun así aparecen omisiones marcadas, es parcial y el motivo dice la
    inconsistencia («aunque verify lo ve configurado»), igual que en 0470.

### Alternativas descartadas

- **Puerto cerrado en vez de servidor.** Hace pasar los 5 casos, pero en
  Windows un `connect` a un puerto cerrado de loopback puede tardar segundos
  por los reintentos de SYN. Una llamada inesperada de la app quedaría lenta y
  opaca. El deny-only responde al instante y con un error explícito.
- **Mutar `process.env` en la config**, como hacía SDD-0320. Los workers lo
  heredarían, pero importar la config en Vitest cambiaría el entorno del
  proceso de prueba. Además, un `.env.local` real con las variables quedaría
  pisado. La metadata y `webServer.env` evitan las dos cosas.
- **Fallar temprano con una variable sola**, como hacía SDD-0320. 0470 ya la
  omite con motivo y la declara parcial. Mantenerlo evita convertir un entorno
  a medias en un e2e rojo.

## Evidencia

Todas las corridas son locales: Windows 11, Node 24.20.0 y Playwright 1.60.
Sin variables de Supabase ni `.env*`, y sin leer producción.

- **Pruebas del harness** (`node --test --test-reporter=tap`):
  `e2e-supabase-sintetico.node.mjs` y `verify-e2e-sin-supabase.node.mjs`, 28/28.
- **Vitest de la config** (`scripts/__tests__/playwright-config.test.ts`):
  34/34.
- **Control rojo:** 16 mutantes sobre el código real, 16/16 muertos, cada uno
  en la prueba que le corresponde. El control pasó antes y después.
  - **La decisión:** no respetar lo configurado; mezclar real y sintético;
    sintético en efímero, con servidor reusado o con destino remoto; el puerto
    sin desfase; la detección efectiva sin el plan.
  - **Los specs:** `requiereSupabase()` ignora el modo.
  - **El deny-only:** acepta todo; responde salud a cualquier método.
  - **Verify:** no pasa el puerto comprobado; no calcula el plan en el reuso;
    `destinoE2E` ignora `E2E_START_WEB_SERVER=1`.
  - **La config:** `next dev` sin el entorno sintético; el deny-only después de
    Next; la metadata con valores.
- **Typecheck, lint y diff:** `tsc --noEmit` 0, ESLint de lo tocado 0 y
  `git diff --check` 0.
- **e2e focal y `verify` completo:** ver el handoff
  (`.agents/handoffs/e2e-supabase-sintetico-deny-only.md`), con SHA y
  resultado por paso.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.07 · estado visible y verdadero | cumplimiento | En modo sintético, las 5 pruebas miden en vez de omitirse. En los demás modos sigue la omisión con motivo y la cobertura parcial. El aviso del preflight dice cuál aplica |
| SGE-00.06 · prevenir antes de informar | cumplimiento | Puerto comprobado antes de correr; un puerto inválido o igual al de la app es un error |
| MP-01 / datos personales | no aplica | El deny-only no recibe ni guarda datos; la anon key no es un secreto; la metadata sólo lleva el modo |
| AUD-01 | no aplica | Tooling local |
| UI / marca | no aplica | Sin UI |

## Allowlist exacta

- `e2e/_helpers/supabase-publico.cjs`
- `e2e/_helpers/supabase-publico.d.cts`
- `e2e/_helpers/supabase.ts`
- `e2e/README.md`
- `playwright.config.ts`
- `scripts/e2e/supabase-deny-server.mjs` (nuevo)
- `scripts/verify.mjs`
- `scripts/verify-e2e.mjs`
- `scripts/verify-e2e.d.mts` (nuevo)
- `scripts/tests/e2e-supabase-sintetico.node.mjs` (nuevo)
- `scripts/tests/verify-e2e-sin-supabase.node.mjs`: sólo el regex del cableado
- `scripts/__tests__/playwright-config.test.ts`
- `docs/specs/0479-e2e-supabase-sintetico-deny-only/spec.md`
- `docs/specs/0470-verify-e2e-sin-supabase/spec.md`: sólo la nota de las
  decisiones del 2026-09-18 y `updated`
- `docs/specs/README.md` (regenerado con `docs:index`)
- `.agents/handoffs/e2e-supabase-sintetico-deny-only.md`

Sin cambios: producto, CI, `scripts/verify-runner.mjs`,
`scripts/verify-step-policy.mjs` y todo `*.spec.ts`. Integrar a `main`
**dispara el deploy de Vercel**, porque `ignoreCommand` no excluye `scripts/**`
ni `e2e/**`. El artefacto no cambia, pero la autorización de merge tiene que
cubrir ese deploy.

## Criterios de aceptación

- [x] 1. Sin las dos variables, con destino local y `next dev` propio,
      Playwright levanta el deny-only y `next dev` recibe su URL y la anon key
      sintética. Probado en la config.
- [x] 2. Con las variables reales, en el entorno o en un `.env*`, no cambia
      nada. Con una sola, con un servidor reusado, en efímero o con destino
      remoto, rige 0470.
- [x] 3. El deny-only rechaza todo salvo su salud, sin eco, sin logs del
      pedido y sólo en `127.0.0.1`.
- [x] 4. `verify` toma la misma decisión que Playwright, comprueba el puerto y
      no declara parcial un e2e que midió todo.
- [x] 5. Evidencia e2e: sin variables, las 5 pruebas corren y pasan en los tres
      proyectos, con 0 omisiones marcadas, y `verify` no declara parcial el e2e.
      - Corrida focal sobre `efef3d93`: 24 passed y 6 skipped (sólo Tier 3), con
        0 omisiones marcadas y 0 errores de `proxy.ts`.
      - `verify` completo sobre `efef3d93`: e2e 164 passed y 18 skipped, sin
        cobertura parcial.
      - El detalle está en el handoff.
- [x] 6. Pruebas con control rojo por mutantes.

## Riesgos y límites

- **Servidor reusado fuera de verify.** Con `pnpm test:e2e` directo, si ya hay
  un `next dev` en el puerto, Playwright lo reusa (`reuseExistingServer`) y no
  tiene la URL sintética. En modo sintético esas 5 pruebas fallan en vez de
  omitirse; se ve, pero es un rojo por entorno. `verify` elige un puerto libre
  y no lo reusa.
- **El deny-only no simula un Supabase.** Una prueba que necesite datos o una
  sesión sigue requiriendo un Supabase autorizado (Tier 3).
- **Sin puerto libre para el deny-only,** Playwright falla a la vista al
  levantarlo. No se omite en silencio.
- **Branch efímero:** no se propagan a `next dev` sus variables; queda como en
  `main`.
