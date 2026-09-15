---
sdd: "0470"
title: "El e2e de verify sin Supabase público: omite con motivo lo que no puede medir y lo declara cobertura parcial crítica"
status: done
author: "Claude Code (Worker) para Sam"
created: 2026-09-15
updated: 2026-09-15
supersedes: null
superseded_by: null
related: ["0454", "0320", "0329", "0440"]
confidencialidad: interno
---

# SDD-0470 — El e2e de `verify` sin Supabase público

> En un worktree sin `NEXT_PUBLIC_SUPABASE_URL` ni
> `NEXT_PUBLIC_SUPABASE_ANON_KEY`, el paso e2e fallaba siempre en los mismos
> 15 casos, se reintentaba entero y a veces se colgaba. Ahora esas pruebas se
> omiten con un motivo visible, el resto corre igual y el gate declara el e2e
> con cobertura parcial crítica: cierre incompleto, nunca TODO VERDE.

## Contexto

`proxy.ts:67-69` crea el cliente con `process.env.NEXT_PUBLIC_SUPABASE_URL!` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY!` en cada ruta de su `matcher`: `/studio`,
`/back`, `/portal`, `/m/erp`, `/m/emp`, `/entrar` y `/registro`. Sin esas
variables lanza «Your project's URL and Key are required to create a Supabase
client!» y el dev server responde con su página de error. Los worktrees no
reciben `.env.local` (no se copian credenciales), y en el checkout principal
`.env.local` es un directorio.

Tres Workers seguidos (L10, L14 y L17) registraron el mismo patrón, y la
corrida base de esta spec lo reprodujo sobre `c70956bf`, sin variables:

- **Primera pasada:** 149 passed, 15 failed, 4 flaky y 18 skipped en 6,9 min.
  Los 15 son 5 casos × 3 proyectos, con su reintento interno:
  - `auth.spec.ts:21` (Studio), `:91` (Back), `:98` y `:105` (Portal);
  - `global-search.spec.ts:22`.
- **Reintento del gate:** `retry: 1` volvió a correr la suite entera, con los
  mismos 15 fallos (153 passed, 18 skipped, 9,6 min). Terminó con `worker-45
  process did not exit within 300000ms after stop, force-killed it`.
- **Total:** el paso salió FALLÓ en 16,6 min. Un
  `WebKitNetworkProcess.exe` quedó huérfano (padre muerto) y seguía listado
  más de 19 minutos después, aun tras `Stop-Process -Force`.

`scripts/verify.mjs` (`e2ePreflight`) sólo omitía el e2e por
`VERIFY_SKIP_E2E=1`, por falta de navegadores o de puerto. No miraba Supabase.
`scripts/verify-step-policy.mjs` declara `e2e` crítico: una omisión suya no
puede presentarse como cierre completo.

SDD-0320 (`done` en el índice) describe otra salida: un servidor local
deny-only con URL y anon key sintéticas. Su código (`8725a341`) **no está en
main**: sólo llegó la spec, con el bloque A de PR #21.

## Alcance

- Detectar, con las mismas reglas que `next dev`, si el servidor local tendrá
  Supabase público.
- Declarar de forma explícita, prueba por prueba, cuáles lo necesitan, y
  omitirlas con motivo cuando falta.
- Contar esas omisiones desde el reporte de Playwright y llevarlas al veredicto
  de `verify` como cobertura parcial de un paso crítico.
- Diagnosticar el cuelgue recurrente tras `[mobile-safari]
  gastos-expense-void.spec.ts:99:7`.
- Fuera de alcance:
  - producto (`proxy.ts`, `app/`, `lib/`), CI, `playwright.config.ts` y
    `verify-runner.mjs`;
  - los Tier 3 que se omiten por falta de seed (conservan su `test.skip`);
  - migraciones.

## Diseño

1. **Detección única** en `e2e/_helpers/supabase-publico.cjs`:
   - **Fuentes:** lee el entorno y los archivos que carga `next dev`
     (`@next/env` 16.2.11, `loadEnvConfig` con dev=true), en su orden:
     `.env.development.local`, `.env.local`, `.env.development` y `.env`.
   - **Precedencia, la de Next:** una clave definida en el entorno gana aunque
     esté vacía; si no, gana el primer archivo que la define; una ruta que no
     es archivo se ignora (`!isFile()`).
   - **Modo test (ronda 2):** con `NODE_ENV=test`, `next dev` conserva ese
     NODE_ENV heredado (`next/dist/bin/next`: `process.env.NODE_ENV ||
     defaultEnv`), y @next/env carga `.env.test.local`, `.env.test` y `.env`,
     sin `.env.local`. La detección replica ese modo (`archivosEnvNextDev`), y
     el motivo nombra la lista que realmente miró.
   - **Una sola raíz (ronda 2):** `verify` usa la raíz por defecto
     (`RAIZ_REPO`, la del repositorio), la misma que los specs, en vez de
     `process.cwd()`.
   - **Salida:** sólo nombres y fuentes, nunca valores.
   - **Por qué CommonJS:** el loader de Playwright 1.60 compila un `.mjs`
     importado desde un spec como CJS y Node lo rechaza («exports is not
     defined in ES module scope», medido). Un `.cjs` lo cargan igual los
     workers (require) y el gate (import); `.d.cts` le da tipos a tsc.
2. **Sólo destinos locales.** Se omite únicamente si `baseURL` es `localhost`,
   `127.0.0.1`, `[::1]`, `0.0.0.0` o `*.localhost`. Contra un Preview, la
   configuración es del servidor desplegado: no se omite nada, como hoy.
3. **Declaración explícita.** `requiereSupabase()` (`e2e/_helpers/supabase.ts`)
   va en la primera línea del cuerpo de cada prueba que lo necesita. Llama a
   `test.skip(motivo !== null, motivo)` antes de navegar. El motivo empieza por
   `SIN SUPABASE PÚBLICO` y nombra lo que falta y los `.env*` ignorados.
   - **Quiénes lo llaman:** exactamente los 5 casos que fallaron en los 3
     proyectos, en intento y reintento, en la corrida base.
   - **Quiénes no**, porque lo que afirman no depende de Supabase:
     - `/acceso` ×2: fuera del matcher; su página atrapa el error del cliente
       admin.
     - `/m/ve/login`: fuera del matcher.
     - `smoke.spec.ts` «el rastreo público /track redirige a la puerta»:
       afirma la URL del redirect y pasó 3/3.
     - `attachments-gastos-pilot-network`: usa `/studio/login` como origen y
       afirma el cuerpo de su propio `fetch`; pasó 3/3.
     - El flaky de `auth.spec.ts:74` en chromium fue `net::ERR_ABORTED` en
       `/acceso`, no el error del proxy.
   - **Inventario en la prueba del harness,** por ruta y título: una llamada
     nueva o retirada sin actualizarlo rompe `harness:test`.
     - Desde la ronda 2 recorre todo `e2e/`, subdirectorios incluidos, e ignora
       comentarios, strings, templates y regex. Acepta la llamada con o sin
       punto y coma.
     - Falla cerrado: una llamada en `beforeEach`, a mitad de cuerpo, en otro
       helper, con alias o sin el import del helper es un error.
     - Límite: sólo reconoce `test("título", async (…) => {` con título
       literal. Cualquier otra forma se rechaza; no se acepta en silencio.
4. **En el gate:**
   - **La recolección se prueba con pasos falsos (ronda 2).** `evaluarPasos`
     corre los pasos y devuelve omisiones, fallos, parciales y veredicto;
     `main()` sólo imprime el resumen y sale. Las piezas exportadas son
     `recolectarParcial` y `recolectarResultado`, con esta regla:
     - a un paso omitido no se le consulta la cobertura parcial;
     - uno fallido o uno ok sí la llevan.
   - `e2ePreflight` avisa qué falta.
   - Después del paso, `e2eCoberturaParcial` lee el reporte JSON y cuenta los
     tests `skipped` con una anotación `skip` que empieza por la marca, en el
     test o en sus intentos.
   - Si hay alguno, imprime `[AVISO] e2e: COBERTURA PARCIAL — N prueba(s)
     omitidas sin Supabase público (falta …)` y la lista `archivo:línea
     «título» [proyectos]`.
   - Casos límite:
     - sin reporte legible y sin Supabase: también es parcial, y el motivo lo
       dice;
     - omitidas aunque verify ve Supabase: parcial, nombrando la
       inconsistencia.
5. **Veredicto** (`buildVerifyVerdict`, nuevo `partial = [{ name, reason }]`):
   - un paso crítico parcial deja `CIERRE INCOMPLETO — CRÍTICOS CON COBERTURA
     PARCIAL: e2e [motivo]`, tipo `critical-unmeasured`;
   - el exit es el mismo que para una omisión crítica: 0 sin fallos, 1 con
     fallos (con el sufijo `CIERRE ADEMÁS INCOMPLETO`);
   - un no crítico parcial queda como cobertura parcial;
   - se rechazan parciales desconocidos, duplicados, sin motivo o a la vez
     omitidos;
   - sin parciales, todos los mensajes son idénticos a los de antes (las
     pruebas existentes lo fijan).
6. El resumen agrega `(con cobertura parcial: e2e)` a «N de M pasos corrieron
   de verdad» y una línea `parcial: e2e — motivo`.

### Alternativas descartadas

- **Omitir el e2e entero sin Supabase:** perdería ~170 pruebas que sí miden.
- **Seleccionar por patrón** (`grepInvert`, tags, rutas en el título): una
  prueba filtrada desaparece del reporte en vez de quedar omitida con motivo, y
  el patrón se desincroniza en silencio.
- **Declarar en `describe`:** `auth.spec.ts` mezcla casos que necesitan
  Supabase con otros que no; anidar un `describe` cambiaría los títulos que usa
  el selector de 18 E2E del README.
- **Traer el fallback sintético de SDD-0320.** No es el encargo de esta spec;
  queda como propuesta en «Riesgos y límites». La corrida con URL y anon key
  sintéticas (puerto cerrado) hizo pasar los 5 casos: sólo necesitan
  configuración pública no vacía, no un Supabase real.

## Diagnóstico del cuelgue en mobile-safari (criterio 5)

**Qué había.** Los recibos locales de `verify` de esta máquina tienen 7 cortes
reales del watchdog de SDD-0454 en el e2e. Se deduplicaron por PID raíz; se
excluyen 3 salidas de las pruebas del propio watchdog, sin resultados e2e.
Así terminan los 7:

| Cortes | Último resultado impreso | Lo siguiente en mobile-safari | Salida antes del silencio |
|---|---|---|---|
| 5 | `[mobile-safari] gastos-expense-void.spec.ts:99:7` (omitida) | `global-search.spec.ts:22` → `/studio/dashboard` | exactamente 29 líneas del WebServer: el error de `proxy.ts:67` y su reenvío `[browser] Uncaught Error` |
| 1 | `[mobile-safari] auth.spec.ts:74:7` | `auth.spec.ts:91` → `/back/login` | las mismas 29 líneas |
| 1 | `[mobile-chrome] smoke.spec.ts:97:7` (mobile-safari sin empezar) | — | nada |

En los mismos logs, mobile-safari completó 706 resultados, 148 de ellos en
pruebas cuya ruta pasa por el proxy. Si los cuelgues cayeran al azar, que 6 de
6 empezaran en ese ~22 % tendría una probabilidad de ~1e-4.

**Diagnóstico:**

- **Disparador.** WebKit (mobile-safari, Windows) navega a una ruta del matcher
  sin Supabase público: el dev server responde error, el cliente de Next
  vuelve a lanzar el error en la página (`[browser] Uncaught Error`) y el
  worker deja de reportar.
- **No es `gastos-expense-void.spec.ts`.** Sus dos casos se omiten a nivel
  `describe` sin abrir el navegador. Es sólo la última línea impresa, porque
  el reporter escribe cada prueba al terminar.
- **No es un test lento.** El silencio superó los 60 s del test y los 300 s
  del cierre de workers de Playwright, sin ningún mensaje de Playwright.
- **Otro síntoma de WebKit en Windows, aparte:** al terminar, el worker no
  cierra (`did not exit within 300000ms`) y queda un `WebKitNetworkProcess`
  huérfano que no desaparece ni con `Stop-Process -Force`. Coincide con la
  observación de `e2eAbsolver` y de `resolveWebkitProjectWorkers`.
- **Mecanismo interno exacto:** no demostrado.
  - **E1, reproducción aislada sin el cambio.** Corrió sólo mobile-safari, con
    copias temporales de `auth.spec.ts` y `global-search.spec.ts` de la base,
    `--repeat-each=8` y `DEBUG=pw:api`, bajo el watchdog. Resultado: 40 failed,
    24 passed y 16 skipped en 11,1 min. Fueron 80 ejecuciones de WebKit sobre
    páginas del proxy caído, cada una con su reinicio de worker, y **ningún
    cuelgue**: el silencio máximo fue de 12 s, sin corte ni «did not exit». Con
    la tasa de las corridas completas (~4 %), cero cuelgues en 80 tendrían una
    probabilidad cercana a 4 %. El cuelgue parece necesitar la carga de la
    suite completa: 8 workers, los otros dos proyectos y el dev server
    compilando.
  - **E2, el mismo control con el cambio.** 24 passed y 56 skipped en 1,4 min,
    silencio máximo 11,2 s y cero errores de Supabase en el WebServer:
    mobile-safari ya no navega a esas rutas. Su último minuto coincidió con el
    e2e de otro worktree (ver el handoff).

**Corrección.**
- **Qué se hizo:** con el cambio de esta spec, sin Supabase, mobile-safari ya
  no navega a esas rutas: las 5 pruebas se omiten antes de `page.goto`. Es
  determinista y no debilita aserciones.
- **Qué no se tocó:** `gastos-expense-void.spec.ts` no se modifica, porque no
  es la causa.
- **Lo que queda (riesgo residual, declarado):**
  `attachments-gastos-pilot-network` sigue abriendo `/studio/login` en
  mobile-safari: una navegación por corrida, frente a las 10 de antes (5 casos
  con su reintento).
  - Su prueba pasa y lo que afirma no depende de Supabase, así que omitirla
    sería perder cobertura sin evidencia.
  - En los recibos nunca precedió a un corte. Los datos no permiten separar
    «navegar a la página caída» de «fallar ahí y reiniciar el worker»; sólo lo
    segundo fue exclusivo de los 5 casos omitidos.
  - Si vuelve a aparecer un corte con esa firma después de este cambio, el
    siguiente paso es la propuesta 1 de abajo, no una omisión más.

**Propuesta de política, sin implementar:**

1. Llevar a una spec propia el fallback deny-only de SDD-0320, u otro
   equivalente sin secretos. El proxy dejaría de lanzar y esas 15 ejecuciones
   volverían a medir sin Supabase real.
2. Si el cierre colgado de WebKit sigue costando 300 s por corrida, evaluar
   para el gate en Windows un `PWTEST_CHILD_PROCESS_TIMEOUT` menor, o correr
   mobile-safari en un paso propio. Cualquiera de las dos requiere medir el
   costo en cobertura.

## Evidencia

Todas las corridas son locales (Windows 11, Node 24.20.0, Playwright 1.60.0,
chromium 1223, webkit 2287), sin variables de Supabase ni `.env*`, y sin leer
producción.

- **Corrida base** sobre `c70956bf`, paso e2e del gate: descrita en
  «Contexto». FALLÓ, 2 intentos, 16,6 min.
- **Con el cambio** (`9177742c`), mismo paso e2e con su preflight, watchdog y
  cobertura parcial:
  - 152 passed, 33 skipped (18 Tier 3 y las 15 marcadas), 0 failed y 1 flaky
    ajeno (`calculadora-semantic-colors.spec.ts:53`, chromium);
  - 1 intento y 3,9 min, sin worker forzado ni corte del watchdog: `outcome ok`;
  - aviso con los 5 casos en los 3 proyectos y veredicto `CIERRE INCOMPLETO —
    CRÍTICOS CON COBERTURA PARCIAL: e2e [15 prueba(s) omitidas sin Supabase
    público (falta NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)]`,
    tipo `critical-unmeasured`, exit 0.
- **Focal chromium** (`auth` + `global-search`):
  - sin variables: 3 passed, 7 skipped (5 con la marca y 2 Tier 3), exit 0;
  - con URL y anon key sintéticas (`http://127.0.0.1:54321`, puerto cerrado):
    8 passed, 2 skipped (sólo Tier 3), 0 con la marca y 0 errores de
    `proxy.ts`.
  - Límite: la simulación prueba la detección y que el proxy no lanza; no
    prueba un Supabase real.
- **Pruebas del harness** (`scripts/tests/verify-e2e-sin-supabase.node.mjs`,
  9 casos): variables presentes y ausentes, `.env.local` directorio,
  precedencia de Next, destino remoto, conteo del reporte, veredicto,
  cableado de verify e inventario de specs.
- **Control rojo:** 10 mutantes sobre el código real, con reporter TAP. El
  control pasó 9/9 y los 10 mutantes murieron, cada uno en la prueba que le
  corresponde. Cubrían:
  - que el directorio se lea;
  - que el entorno vacío no gane;
  - ausente tomado como configurado;
  - remoto tomado como local;
  - que cuente cualquier skip;
  - que cuente no omitidas;
  - que sin reporte no sea parcial;
  - que el parcial crítico pase por no crítico;
  - que verify no pase `partial`;
  - que un spec pierda la declaración.
- **E1 y E2** (reproducción aislada del cuelgue): ver «Diagnóstico».
- **`corepack pnpm harness:test`:** 15 archivos, 107/107 PASÓ.
- **Documentación y numeración:** `docs:index` regenerado (457 specs),
  `docs:check` PASÓ y `sdd:check` PASÓ (sólo choques históricos exentos).
- **Typecheck, lint y diff:** typecheck 0, lint de los scripts tocados 0 y
  `git diff --check` 0.
- **`corepack pnpm verify` completo** sobre `5e935504`, de 13:56:14 a
  14:09:58 (−04:00). Mismo HEAD y árbol limpio al inicio y al final, sin
  variables de Supabase. Salió con **exit 0 y CIERRE INCOMPLETO**: corrieron
  de verdad 16 de 17 pasos, con cobertura parcial en e2e.
  - **PASÓ:**
    - harness, lint, rsc-boundary (1602 módulos), typecheck y edge-functions;
    - test: 562 archivos y 7279 pruebas;
    - docs:check (457 specs), numbering, feature-constants, components:check
      y governance:check;
    - pending-migration-symbols: 0 ROJO · 0 AMARILLO;
    - sql-tests: 195 contratos;
    - schema-rebuild: 433 migraciones desde cero y 18 sólo-ledger, aislamiento
      en 219 tablas;
    - build.
  - **e2e, `[OK]` con cobertura parcial:**
    - 152 passed, 33 skipped y 1 flaky ajeno (`calculadora-semantic-colors:53`,
      aprobado en su reintento) en 3,2 min;
    - sin reintento del gate ni watchdog;
    - aviso de cobertura parcial con los 5 casos × 3 proyectos;
    - no coincidió con el e2e de otro worktree.
  - **NO DISPONIBLE:** `migrations-applied`, que salió `[SKIP]` por falta de
    credenciales; el ledger no se midió.
  - **Veredicto literal:** `verify: CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR:
    migrations-applied. CRÍTICOS CON COBERTURA PARCIAL: e2e [15 prueba(s)
    omitidas sin Supabase público (falta NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY)]. No hubo fallos en lo medido (16/17, con
    cobertura parcial: e2e); exit 0 NO equivale a cierre verde completo.`

## Ronda 2 (2026-09-15): observaciones de la revisión de la PR #123

La revisión sobre `fac168c2` salió aprobada con observaciones.

**1. MEDIA: el cableado de la omisión en `main()` no tenía prueba.**
- **Medido:** sobre `fac168c2`, los dos mutantes de la revisión sobrevivieron
  con 16/16 pruebas en verde:
  - borrar `partial.push(…)`;
  - `if (false && step.partialCoverage)`.
- **Corrección:** `evaluarPasos`, `recolectarResultado` y `recolectarParcial`,
  exportadas desde `verify.mjs`. Se prueban con pasos falsos (omitido, fallido
  y ok) y con un caso de los 17 pasos reales, migrations-applied medido y las
  15 omisiones contadas con el código real. Ese caso da `CIERRE INCOMPLETO`, no
  TODO VERDE. Su control, sin omisiones, sí da TODO VERDE.
- **Resultado:** los equivalentes de los dos mutantes y otros seis mueren.

**2. BAJA: raíces distintas.** `verify` detecta con la raíz por defecto
(`RAIZ_REPO`), igual que los specs. La prueba rechaza cualquier `raiz` propia.

**3. BAJA: modo test de Next.** Se replica `NODE_ENV=test`: `.env.test.local`,
`.env.test` y `.env`, sin `.env.local`. Ver Diseño 1.

**4. BAJA: sin aviso fuera de verify.** No se implementó, porque requiere
`playwright.config.ts`. Queda documentado en `e2e/README.md` y en Riesgos.

**5. BAJA: inventario frágil.** Ahora es recursivo, ignora comentarios y
strings y falla cerrado. Ver Diseño 3.

**Validación por SHA:**
- `78bd1505`: código de la ronda.
- `13299d09`: merge de `origin/main` `42f80bea` (PR #122, SDD-0469). El driver
  `dtd-generated-records` resolvió `docs/specs/README.md` sin conflicto, y
  `docs:index` lo dejó igual: 458 specs, filas 0469 y 0470, sin hueco 0469.

| Comprobación | SHA | Resultado |
|---|---|---|
| Mutantes de la revisión, literales | `fac168c2` | Sobreviven 2/2 (16/16 en verde): el hueco existía |
| Pruebas focales (sin-supabase, critical-coverage, watchdog) | árbol = `78bd1505` | PASÓ, 36/36 |
| `tsc --noEmit` y ESLint de lo tocado | árbol = `78bd1505` | PASÓ |
| `corepack pnpm harness:test` | `13299d09` | PASÓ, 113/113 en 15 archivos |
| Mutantes de la ronda 2 (8) | árbol = `78bd1505` y `13299d09` | PASÓ: control 22/22 y 8/8 muertos, en ambos |
| Mutantes de la ronda 1 (10; M9 reapuntado al nuevo push) | árbol = `78bd1505` y `13299d09` | PASÓ: control 15/15 y 10/10 muertos, en ambos |
| `docs:index` / `docs:check` / `sdd:check` | `13299d09` | PASÓ: 458 specs, 12 huecos, sin números repetidos |
| `git diff --check` | `13299d09` | PASÓ |

**e2e y verify completos: no se repitieron.**
- El punto 3 sólo cambia la lista de archivos cuando `NODE_ENV=test`, y ni
  verify ni Playwright lo definen.
- El punto 4 no cambió código.
- La recolección cambió de lugar, pero no de comportamiento: la cubren las
  pruebas con pasos falsos y con el paso e2e real.
- Validación vigente del e2e: la de `5e935504` (arriba).

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.07 · estado visible y verdadero (aplicado al gate) | cumplimiento | Una prueba que no puede medir queda omitida con motivo, no roja ni verde. Si el paso crítico queda parcial, el cierre es INCOMPLETO y nunca TODO VERDE. |
| SGE-00.11 · qué ocurrió y qué sigue | cumplimiento | El motivo nombra las variables y los `.env*` ignorados. El aviso lista cada caso y el README dice cómo medirlos sin copiar credenciales. |
| SGE-00.06 · prevenir antes de informar | cumplimiento | El preflight avisa antes de correr. Un parcial mal formado rompe el veredicto. |
| AUD-01 | no aplica | Tooling local; no toca eventos de producto. |
| MP-01 / datos personales | no aplica | Lee sólo nombres de variables y la existencia de `.env*`; nunca imprime ni persiste valores (hay prueba). |
| UI / marca | no aplica | Sin UI. |

## Allowlist exacta

- `scripts/verify.mjs`
- `scripts/verify-e2e.mjs`
- `scripts/verify-step-policy.mjs`
- `scripts/tests/verify-e2e-sin-supabase.node.mjs` (nuevo)
- `e2e/_helpers/supabase-publico.cjs` (nuevo)
- `e2e/_helpers/supabase-publico.d.cts` (nuevo)
- `e2e/_helpers/supabase.ts` (nuevo)
- `e2e/auth.spec.ts`: import, 4 llamadas y comentario de cabecera
- `e2e/global-search.spec.ts`: import, 1 llamada y comentario
- `e2e/README.md`
- `docs/specs/0470-verify-e2e-sin-supabase/spec.md`
- `docs/specs/README.md` (regenerado con `docs:index`)
- `.agents/handoffs/verify-e2e-sin-supabase.md`

Sin cambios: `scripts/verify-runner.mjs`, `playwright.config.ts`,
`e2e/gastos-expense-void.spec.ts`, producto, CI y migraciones. Integrar a main
**dispara el deploy de Vercel**: `ignoreCommand` excluye sólo `docs/**` y el
Markdown de la raíz, no `scripts/**` ni `e2e/**`. El artefacto no cambia, pero
la autorización de merge tiene que cubrir ese deploy.

## Criterios de aceptación

- [x] 1. Sin las variables (ni en el entorno ni en un `.env*` válido), las
      pruebas que necesitan Supabase se reportan omitidas con motivo y el resto
      corre igual. La selección es explícita y tiene evidencia.
- [x] 2. El resumen muestra el e2e con cobertura parcial crítica: `CIERRE
      INCOMPLETO`, con el exit de una omisión crítica.
- [x] 3. Con las variables presentes no se omite nada (prueba del harness y
      corrida con valores sintéticos).
- [x] 4. Sin variables no hubo fallos, reintentos del gate ni cortes del
      watchdog por la ausencia.
- [x] 5. Cuelgue diagnosticado con evidencia:
      - 6 de 7 cortes empiezan justo en una navegación de mobile-safari a una
        ruta del proxy sin Supabase (p≈1e-4);
      - no es `gastos-expense-void.spec.ts`;
      - no se reprodujo en aislamiento (E1: 0 de 80);
      - el cambio quita el disparador de forma determinista (E2 y la corrida
        completa);
      - el mecanismo de WebKit en Windows y el riesgo residual quedan
        documentados, con una propuesta de política sin implementar.
- [x] 6. Pruebas del harness con control rojo: presentes, ausentes,
      `.env.local` directorio y reporte de la omisión.

## Riesgos y límites

- **Servidor reusado.** Si verify reusa un `next dev` levantado con otras
  variables en la shell, la detección puede discrepar. En ese caso se omite
  de más, y se reporta como parcial; nunca se omite en silencio.
- **Detección sólo por presencia.** No se resuelve la expansión `$VAR` de
  dotenv ni se valida la URL.
- **Fuera de verify no hay aviso.** Con `pnpm test:e2e` directo y sin
  variables, Playwright sale con exit 0 y cuenta las 15 en `skipped`.
  - El reporter `list` no muestra el motivo; los reporters `json` y `html` sí
    lo conservan como anotación `skip`.
  - Un aviso propio fuera de verify requiere `globalSetup` o un reporter en
    `playwright.config.ts`, fuera de `e2e/` y `scripts/`. No se implementó
    (ronda 2, decisión del Director): queda documentado en `e2e/README.md` y
    propuesto aquí.
- **Los Tier 3 sin seed** siguen sin contarse como cobertura parcial. Esa
  omisión es anterior a esta spec (SDD-0440 la registra como pendiente de una
  corrida alojada).
- **Cierre de WebKit en Windows** (worker que no cierra y
  `WebKitNetworkProcess` huérfano): no depende de Supabase y sigue igual. Ver
  la propuesta de política.
