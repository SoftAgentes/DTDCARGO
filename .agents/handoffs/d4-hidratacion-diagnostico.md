# Handoff — d4-hidratacion-diagnostico

- Fecha: 2026-09-10
- Owner / sesión: `d4-hidratacion-diagnostico-worker-20260910`
- Estado de tarea: `lista-para-revision`
- Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/d4-hidratacion-diagnostico`
- Rama: `codex/d4-hidratacion-diagnostico`
- Base asignada: `8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2` (`main`)
- SDD reutilizada: `docs/specs/0440-e2e-harness-general-determinista/spec.md`
- Dependencias / orden: ninguna; no comparte archivos con las ramas abiertas declaradas.

## OBJETIVO ORIGINAL

Hacer que `esperarHidratado()` conserve siempre el fallo original de hidratación y añada el
conteo únicamente como diagnóstico opcional, incluso si el contexto del navegador muere
durante una navegación y `page().evaluate()` también falla.

## ACEPTACIÓN Y ALCANCE

- Conservar la causa original del `expect.poll` en el error final.
- Si `contarHidratados()` falla, mantener el error de hidratación y anotar que el conteo no
  pudo obtenerse porque el contexto ya no estaba disponible.
- Registrar una prueba roja sobre el código original y la misma prueba verde tras el arreglo.
- Conservar íntegros los tres avisos largos del encabezado de `hidratacion.ts`.
- No tocar `sondearReact()` ni el marcador `__reactProps$` salvo necesidad demostrada.
- Allowlist: `e2e/_helpers/hidratacion.ts`, su prueba focal,
  `docs/specs/0440-e2e-harness-general-determinista/spec.md`, `docs/specs/README.md`
  regenerado y este handoff.
- Exclusiones: `TIMEOUT_HIDRATACION`, esperas, `playwright.config.ts`, specs consumidores,
  `supabase/**`, producto y los demás hallazgos D1/D2/D3.

## PERMISOS

- Autorizados: commits locales selectivos, push de esta rama a sí misma y PR en borrador
  contra `main`.
- Prohibidos: merge, deploy, migraciones, ruleset, limpieza de ramas/worktrees, timeout y
  cualquier cambio de producto.

## COMPLETADO

- `esperarHidratado()` liga el fallo del `expect.poll` como `causa`, conserva su mensaje
  en el error de hidratación y mantiene la misma instancia en `Error.cause`.
- `contarHidratados()` quedó como diagnóstico opcional: su propio error se captura y se
  incorpora como nota sobre la pérdida del contexto, sin sustituir el fallo primario.
- La prueba focal simula por separado la condición original y el
  `page.evaluate: Execution context was destroyed`; también cubre la rama histórica en la
  que el conteo sí devuelve nodos.
- La firma pública no cambió y no hubo que editar ningún spec consumidor.
- Los tres avisos largos del encabezado quedaron íntegros. `sondearReact()`,
  `__reactProps$`, `TIMEOUT_HIDRATACION = 20_000` y `playwright.config.ts` no cambiaron.
- SDD-0440 conserva estado `in-progress`, actualiza `updated: 2026-09-10` y registra la
  decisión, allowlist, criterios y límite de rendimiento. `docs:index` se regeneró;
  `docs/specs/README.md` quedó idéntico y por eso no genera diff.

## VALIDACIÓN

- **PASÓ** — `node scripts/harness-worktree.mjs guard`: worktree aislado, rama asignada y
  fuera del checkout principal.
- **PASÓ** — `corepack pnpm install --frozen-lockfile`: lockfile vigente; 813 paquetes
  reutilizados/instalados, pnpm 12.3.4, exit 0.
- **FALLÓ COMO ROJA ESPERADA** —
  `corepack pnpm vitest run scripts/__tests__/hidratacion.test.ts --reporter=verbose`
  sobre el helper original: 1/1 falló, exit 1. Recibió únicamente
  `page.evaluate: Execution context was destroyed, most likely because of a navigation`
  en vez de `React nunca tomó el control de prueba`; reprodujo la pérdida del diagnóstico.
- **PASÓ COMO VERDE** — el mismo comando después del arreglo: primero 1/1 y, después de
  añadir cobertura del conteo disponible, 2/2 en 2,38 s, exit 0.
- **PASÓ** — `corepack pnpm harness:test`: 12/12, 0 fallos, 0 skips, exit 0.
- **PASÓ** — `corepack pnpm docs:index`: índice regenerado, 395 specs y 54 huecos;
  el archivo generado permaneció byte a byte igual.
- **FALLÓ EL WRAPPER, NO LOS CHECKS** —
  `corepack pnpm docs:check && corepack pnpm sdd:check`: Windows PowerShell 5.1 rechazó
  `&&` como separador, exit 1, y no inició ninguno de los dos procesos.
- **PASÓ** — `corepack pnpm docs:check`: exit 0.
- **PASÓ** — `corepack pnpm sdd:check`: 395 specs, 403 migraciones, choques históricos
  reconocidos y `[OK] numbering: sin números repetidos`, exit 0.
- **FALLÓ** — `corepack pnpm verify`: exit 1 en el paso E2E. Antes del corte pasaron
  harness 12/12; lint con 0 errores/8 warnings ajenos; RSC sobre 1.596 módulos;
  typecheck; 4 Edge Functions; Vitest 514 archivos/6.498 pruebas; docs; numbering;
  feature constants; componentes; gobernanza; 145 contratos SQL; reconstrucción de 385
  migraciones más 18 sólo-ledger y aislamiento sobre 219 tablas/2 tenants.
- **NO DISPONIBLE** — `migrations-applied` dentro de `verify`: omitido por ausencia de
  `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; no se midió el ledger real.
- **FALLÓ POR ENTORNO / COBERTURA AUTENTICADA NO DISPONIBLE** — E2E dentro de `verify`:
  186 casos planificados con 8 workers; 152 pasaron, 1 fue flaky recuperado, 18 Tier 3 se
  omitieron y 15 fallaron definitivamente. La salida y 16 artefactos lógicos (15 fallos +
  1 flaky) apuntan a auth/proxy sin `NEXT_PUBLIC_SUPABASE_URL` ni
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Los 6 casos de `calculadora-hidratacion.spec.ts`
  (2 × 3 proyectos) pasaron, pero no sustituyen el E2E autenticado.
- **NO EJECUTADO dentro de `verify` / PASÓ por separado** — el fail-fast E2E impidió el
  paso build; `node scripts/check-build.mjs` ejecutado luego compiló producción, generó
  160 páginas, restauró `tsconfig.json` y terminó `[build] build de producción OK`, exit 0.
- **PASÓ** — revisión de alcance y `git diff --check`: sólo los cuatro archivos
  permitidos con diff; sin errores de whitespace. El encabezado de `hidratacion.ts` no
  tiene hunks y no cambió ninguna constante, sonda, marcador, timeout ni llamador.
- **NO EJECUTADO** — Supabase Producción, migraciones reales, UAT autenticado, merge y
  deploy: prohibidos o no aplicables a este cambio exclusivo de harness.

## COMMITS

- `0fcbbe43` — `chore(harness): SDD-0440 — preservar diagnóstico de hidratación`:
  helper, regresión focal y actualización de la spec.
- Handoff: commit que contiene este documento; sus hashes finales se registrarán en la PR
  sin crear recursión de commits por su propio SHA.

## PR / BRANCH

- Rama: `codex/d4-hidratacion-diagnostico`
- Base: `main` en `8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2`
- PR draft: [#49](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/49), contra `main`.
- Rama publicada explícitamente a sí misma; primer SHA remoto: `0fcbbe43`.

## PENDIENTES DE ESTA TAREA

- Ninguno para los criterios propios de `d4-hidratacion-diagnostico`.
- La revisión, integración y la corrida hospedada pendiente de SDD-0440 corresponden al
  Director/release y no cambian el estado completo de esta unidad Worker.

## FUERA DE ALCANCE DETECTADO

- El consumo de los 20 s completos de `TIMEOUT_HIDRATACION` bajo carga pertenece a
  rendimiento de producto. Esta tarea confirmó por diff que la constante sigue en 20.000
  ms, pero no midió ni intentó optimizar latencia bajo carga; los E2E públicos que pasaron
  no son una medición de ese problema.
- El E2E autenticado y el ledger remoto no estuvieron disponibles por credenciales ausentes.
  No se copiaron secretos ni se convirtió esa indisponibilidad en una regresión del helper.
- Lint conserva 8 warnings preexistentes fuera del allowlist: seis variables sin uso en dos
  tests de compras y dos avisos de hooks/pureza en componentes CRM. Cero errores.
- Los otros tres hallazgos del arnés, D1/D2/D3, no se investigaron ni tocaron.

## HANDOFF AL DIRECTOR

Revisar el PR draft contra `main` y el SHA publicado, en especial la preservación de la
causa y la nota de conteo no disponible. No mergear ni desplegar sin autorización separada.
No hay contratos compartidos ni cambios de firma. El owner seguirá activo sólo hasta el
push final de este mismo handoff y se liberará inmediatamente después; conservar worktree y
rama para la revisión del Director.
