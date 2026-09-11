# Handoff — guard admin en `sendTestTemplateAction` (Mailing)

Fecha: 2026-09-11. Task ID: `mailing-test-template-admin-guard`.
Owner / sesión: `claude-e271ce80-5e1f-46da-930b-ae096413cfda` (Worker Claude Code; sin subagentes escritores).

Estado de tarea: lista-para-revision, sin publicar (el push y la PR draft esperan autorización de Sam). Estado SDD: `done`, con los criterios 1-7 cumplidos. PR, merge y release se registran aparte.

- Repo: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal no modificado).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/mailing-test-template-admin-guard`, creado con `node scripts/harness-worktree.mjs start mailing-test-template-admin-guard`.
- Rama: `codex/mailing-test-template-admin-guard`, sin upstream.
- Base inicial: `07d000970011ee12364e31124ebe4b301f064b40` (`origin/main` al crear el worktree). El encargo citaba `3c6107012f754953323202a7386b3e7811593814`: es ancestro de esa base y `app/studio/(app)/mailing/` no cambió entre ambos.
- Reserva: fast-forward a `821a9df8`, cuyo padre es `50100cc4` (`origin/main` tras PR #70). Sin rebase.
- Base actual: `c6c673127dea93e6adb9094f6d217cfa1ec6974c` (`origin/main` con #72, #73 y #74), incorporada con el merge `2e0e3a35`. Sin rebase.
- SDD: `docs/specs/0453-mailing-test-template-admin-guard/spec.md`. El número lo asignó el Director (sesión «Hola Director», `dtdcargo-5f`) tras `pnpm sdd:next` sobre 209 refs y worktrees.
  - Reserva local del Director: rama `codex/sdd-reserve-0453-mailing-test-template-admin-guard` y lock `refs/dtd/reservations/0453`, commit `821a9df8f2c913e369df9f41be722b2b16418fe1`. No está publicada.
  - El Director aprobó spec nueva: no reabrir 0026 ni 0085.
- Origen del hallazgo: FUERA DE ALCANCE #1 y fila c4 del handoff `c-l08-mailing-rbac.md`. Su PR #74 ya está integrada en main (`c6c67312`); la migración `0408_mailing_admin_rbac` sigue pendiente de aplicar.

## OBJETIVO ORIGINAL

Añadir a `sendTestTemplateAction` (`app/studio/(app)/mailing/actions.ts:111-161` en la base) el mismo guard admin que usan las otras 14 Server Actions del módulo Mailing. Acompañarlo de un test que falle sin el guard (rol no-admin rechazado, sin envío) y pase con él (admin conserva el comportamiento). Sin depender de 0408 ni tocarla; sin merge a main ni producción.

## COMPLETADO

- **Guard:** `moduleEditDenial(supabase, "mailing")` justo después de `createClient()`, con un comentario de 2 líneas (`actions.ts:118-122`).
  - Es la misma posición que en `createMailRuleAction`, `addMailBlacklistAction` y `scheduleEmailAction`: antes de `auth.getUser()`, del lookup de tenant, de leer `mail_templates`, de crear el admin client y de enviar.
  - Reutiliza el helper; no duplica lógica de rol. `mailing` es `ADMIN_ONLY_MODULES`/`LOCKED_MODULES` (`lib/studio/rbac.ts:143, 173-188`), así que el guard equivale a exigir admin y ningún override lo abre.
- **Test:** `app/studio/(app)/mailing/__tests__/send-test-template-admin-guard.test.ts`, 9 casos con el guard y la matriz REALES. Solo se reemplazan sesión, admin client, `sendEmail`, `revalidatePath` y overrides por rol.
  - Cada rol no-admin de `STUDIO_USER_ROLES` (commercial, operations, accounting, warehouse, support, marketing): denegación exacta, sin leer `mail_templates`, sin `createAdminClient`, sin `sendEmail` y sin `revalidatePath`.
  - Override `marketing:mailing` con `view` y `edit`: sigue denegado (LOCKED).
  - Sin sesión: sin envío.
  - Admin: mismo `sendEmail(adminClient, tenant, { templateSlug, to, vars: buildSampleVars(...), metadata })`, mismo mensaje y `revalidatePath("/studio/mailing")`.
- **Spec 0453:** completa sobre el stub de la reserva, con contexto, alcance, tabla antes/después, aceptación, allowlist exacta, gobernanza y no-objetivos. Estado `done`.
  - El criterio 7 se precisó antes del cierre: «se registra por paso y ningún paso falla por este cambio».
- **Índice:** `docs/specs/README.md` regenerado con `corepack pnpm docs:index` (421 specs y 32 huecos tras el merge).

Alcance contra `origin/main` (`c6c67312`): 4 archivos, +255/−1. Son `actions.ts` (+5), el test nuevo (+173), la spec (+75) y el índice (conteo 420 → 421 y fila 0453), más este handoff. Coincide exactamente con la allowlist aprobada por el Director.

## VALIDACIÓN

- **PASÓ** aislamiento: `start`, `guard`, `claim --owner claude-e271ce80-5e1f-46da-930b-ae096413cfda`. `guard --owner` y la rama se revalidaron antes del fast-forward, de cada commit y del merge.
- **PASÓ** `corepack pnpm install --frozen-lockfile` (35.8 s), Node 24.20.0 / pnpm 12.3.4. El lockfile no cambió entre `07d00097` y `c6c67312`.
- **PASÓ** línea base en `07d00097`: `lib/studio/rbac-actions-guard.test.ts` 55/55, incluido `mailing/actions.ts`. Esto demuestra que el anti-drift por archivo no ve la action sin guard.
- **FALLÓ, esperado (fase roja)** en `821a9df8` con el test nuevo y `actions.ts` intacto: 7 fallos y 2 aprobados de 9.
  - Fallaron los 6 roles no-admin y el override LOCKED, con `expected { ok: true, …(1) } to deeply equal { Object (error) }`: hoy el correo sale.
  - Pasaron admin y sin sesión.
- **PASÓ** fase verde con el guard: 3 archivos y 100 tests (focal 9, `rbac-actions-guard` 55, `rbac.test.ts` 36).
- **PASÓ** focal verbose sobre `838fc99f`: 9/9 con nombre por caso.
- **PASÓ** ESLint de `actions.ts` y del test: 0 problemas.
- **PASÓ** `corepack pnpm docs:index`, `docs:check`, `sdd:check` (sin números repetidos; los avisos 0342/0394 «NO se renumera» son históricos) y `git diff --check`.
- **INTERRUMPIDO** `corepack pnpm verify` sobre `838fc99fe4851313d31af09c54fe8a47b2756960`, de 11:35:24Z a 12:15:50Z, con el árbol limpio salvo este handoff sin rastrear.
  - Lo detuve en e2e tras 16 min sin salida (detalle abajo). `verify.mjs` no llegó a imprimir su resumen ni su veredicto.
  - El `exit 0` que registró el wrapper de Git Bash es un artefacto de la terminación forzada, **no un verde**.
  - Por paso:
    - **PASÓ** harness (18/18).
    - **PASÓ** lint: 0 errores y 8 advertencias preexistentes en archivos no tocados (`NewPurchaseWizard.test.tsx` ×4, `PurchaseStepDetalle.test.tsx` ×2, `KommoBoardView.tsx:124`, `KommoClient.tsx:553`); las mismas que reportó L08.
    - **PASÓ** rsc-boundary (1597 módulos), typecheck, edge-functions (4) y test (527 archivos / 6693 tests; L08 midió 526 / 6684, la diferencia es este test).
    - **PASÓ** docs:check (418), numbering (418 specs · 422 migraciones), feature-constants (5), components:check, governance:check y pending-migration-symbols (0 ROJO · 0 AMARILLO).
    - **PASÓ** sql-tests: 164 contratos en postgres:17 efímero, con rollback total.
    - **PASÓ** schema-rebuild: 422 migraciones, 404 aplicadas desde cero, 18 solo-ledger, barrido de 219 tablas y 2 tenants.
    - **NO DISPONIBLE** migrations-applied: SKIP sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
    - **FALLÓ por entorno / NO DISPONIBLE** e2e: 186 tests, 8 workers, dev server propio en el puerto 3423. Ningún fallo toca Mailing.
      - chromium, 62/62 con resultado: 51 pasaron, 5 fallaron también en su reintento, 6 omitidos (Tier 3 sin seed). mobile-chrome dio lo mismo: 51 / 5 / 6.
      - Los 5 fallos son `e2e/auth.spec.ts:21, 91, 98, 105` y `e2e/global-search.spec.ts:22`, el mismo conjunto que en L08. El webServer registró 238 veces «Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY» (`proxy.ts:67`).
      - mobile-safari, 28/62: 21 pasaron, 4 fallaron (`auth.spec.ts:21, 91, 98, 105`) y 3 se omitieron. Desde las 11:59:14Z, silencio.
    - **NO EJECUTADO** build dentro de verify: va después de e2e. Se cubrió aparte (siguiente punto).
- **PASÓ** `node scripts/check-build.mjs` sobre `838fc99f`, corrido aparte tras detener verify, de 12:16:59Z a 12:26:26Z: «build de producción OK» en `.next-verify` aislado. El script restauró `tsconfig.json`, y el Norte regenerado es un archivo ignorado.
- **Tras el merge de `origin/main`** (`2e0e3a35`, padres `82c5afa3` y `c6c67312`):
  - **PASÓ** merge semántico del índice con el driver `dtd-generated-records` (verificado con `install-merge-drivers.mjs --check`) y `docs:index` (421 specs, 32 huecos). Contra main, el índice solo cambia el conteo y la fila 0453.
  - **PASÓ** `docs:check` (421), `sdd:check` (numbering sin repetidos) y `git diff --cached --check`.
  - **PASÓ** `node scripts/check-pending-migration-symbols.mjs`: 0 ROJO · 0 AMARILLO, con 0408, 0424 y 0432 ya en main.
  - **PASÓ** Vitest focal y RBAC: 3 archivos y 100 tests.
  - **NO EJECUTADO** tras el merge: typecheck, lint, Vitest completo, build y e2e. Main solo trajo SQL, specs, handoffs, baseline e índice (14 archivos, ningún TS/JS), así que el código TS/JS de `2e0e3a35` es idéntico al de `838fc99f` y esos resultados siguen aplicando.
  - **NO EJECUTADO** tras el merge: sql-tests y schema-rebuild. Los contratos 0408, 0424 y 0432 se validaron en sus propias PRs; este cambio no toca SQL.
- **NO EJECUTADO**, por no aplicar:
  - `/ui-check`: no hay UI.
  - revisión `revisar-datos-ve`: no se captura, mueve ni borra un dato personal; el cambio reduce quién puede disparar un envío.
- **NO DISPONIBLE:** E2E autenticado y migrations-applied, por falta de credenciales Supabase en el worktree. No se copiaron secretos ni se consultó producción.
- **NO DISPONIBLE:** CI remota. La rama no está publicada.

### Detención del E2E colgado

- **Criterio,** fijado antes de verlo: 15 min sin salida durante e2e. El monitor lo marcó con 921 s; la última escritura del log fue a las 11:59:14Z.
- **Identificación** en solo lectura, con `proc-tree.ps1`. Parte de los procesos cuya línea de comando contiene la ruta de este worktree y sube por `ParentProcessId`, con guardia contra PID reutilizado.
  - Raíz única: `36740`, el `sh.exe` del shim `corepack pnpm verify`, creado a las 11:35:24Z.
  - Cadena: `36740` → corepack `24376` → pnpm-native `19412` → cmd `1968` → `verify.mjs` `15412` → Playwright `14468`.
  - De Playwright cuelgan 6 workers. El más nuevo, `6076` (11:56:47Z), no tenía navegador hijo.
  - También cuelgan 15 `chrome-headless-shell` y `next dev` (`39576` → `47136` → `3392`, puerto 3423).
  - En total 30 procesos, guardados antes (`proc-tree-before-36740.txt`) y reconfirmados justo antes de detener (`proc-tree-prekill-36740.txt`).
- **Detención:** `taskkill /PID 36740 /T /F` a las 12:15:44Z, tras confirmar PID, hora de creación y comando de la raíz. Terminó los 30. El alcance fue solo el árbol descendiente de esa raíz: no se tocó ningún proceso de otros Workers.
- **Comprobación** a las 12:19:47Z: 0 sobrevivientes del árbol guardado (mismo PID y misma hora), 0 conexiones en el puerto 3423 y ninguna raíz verify de este worktree. Los únicos procesos con la ruta del worktree eran los del build aparte.
- Es el mismo síntoma que L08: silencio en mobile-safari y un worker sin navegador.

Evidencia local fuera de Git, en el scratchpad de la sesión (`…/e271ce80-5e1f-46da-930b-ae096413cfda/scratchpad/`):

- corridas: `install.log`, `red.log`, `green.log`, `green-focal-verbose.log`, `postmerge-vitest.log`, `sdd-check.log`;
- verify: `verify.log`/`.clean.log`, `verify.sha`/`.start`/`.end`/`.exit`/`.status`, `e2e-section.txt`;
- detención: `proc-tree.ps1`, `survivors.ps1`, `proc-tree-{before,prekill}-36740.txt`, `taskkill.log`, `survivors-check.txt`;
- build: `build.log` y `build.*`;
- escaneo: `scan-unguarded-actions.mjs` y `.txt`.

## COMMITS

- `821a9df8f2c913e369df9f41be722b2b16418fe1` — reserva SDD-0453 del Director. Entró por fast-forward y trae `origin/main` `50100cc4`.
- `838fc99fe4851313d31af09c54fe8a47b2756960` — `feat(studio): SDD-0453 — guard admin en el envío de prueba de Mailing`: guard, test, spec e índice (4 archivos, +245/−7).
- `82c5afa31d6382a1f9c0bd5d246f4f355f92db95` — `docs(sdd): SDD-0453 — criterio 7 precisado y estado done`: spec e índice.
- `2e0e3a35f97bbf34787e1c0be220db1dcb1c91c3` — merge de `origin/main` `c6c67312` (#72, #73, #74). El índice se regeneró con `docs:index`.
- Commit que contiene este documento — cierre del Worker. Su SHA va en la PR; no se crea un commit recursivo para registrarlo.

## PR / BRANCH

Sin publicar. La rama `codex/mailing-test-template-admin-guard` es local, en el worktree `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/mailing-test-template-admin-guard`, con base `main` (`c6c67312` al cerrar). El push de la rama a sí misma y la PR draft contra main esperan autorización de Sam en la sesión.

## PENDIENTES DE ESTA TAREA

- Publicar la rama y abrir la PR draft cuando Sam lo autorice. No hay pendientes de implementación ni de aceptación.

## FUERA DE ALCANCE DETECTADO

1. **El anti-drift RBAC valida por archivo, no por action.** `lib/studio/rbac-actions-guard.test.ts:76-77` usa `src.includes("moduleEditDenial")`: un export nuevo sin guard, en un archivo que ya lo usa en otra action, pasa en verde. Así sobrevivió este caso.
   - Propuesta: check por export (AST) con allowlist por función.
   - Escaneo heurístico de solo lectura sobre `838fc99f`, sin commit: AST de TypeScript sobre los exports async de los `actions.ts` con `"use server"` de `app/studio/(app)`. Encontró 129 exports y 22 sin un guard visible (`moduleEditDenial`, `capabilityDenial`, `moduleViewDenial`, `requireModuleView`, `requireAdmin*`, `isPlatformAdmin`, `getStudioRole`/`getStudioAccess` o comparación de rol con admin, directa o por una función local).
   - La mayoría son archivos de la ALLOWLIST por diseño (`bugs`, `mis-bugs`, `dashboard`, `debug`, `admin/feature-flags`) o self-service (`usuarios`: `updateMyProfileAction`, `updateMyPreferencesAction` y `link`/`unlinkTelegramAccountAction`).
   - Quedan 8 candidatos para triage, **sin verificar**. Pueden delegar en código de lib con guard, ser lecturas protegidas por RLS o por el RBAC por entidad de documentos, o ser abiertos por diseño:
     - `crm/actions.ts:48` `convertLeadToClientAction`, `:76` `searchKommoContactsAction`, `:89` `exportRecoverySmsCsvAction`;
     - `documentos/actions.ts:175` `addDocumentVersion`, `:403` `signDocumentUrl`, `:420` `listDocumentVersionsAction`;
     - `gastos/actions.ts:353` `resolveExpenseAlertAction`, `:394` `exportExpensesCsvAction`.
   - Aparte, `bugs/actions.ts:174` `updateBugAdminAction`: su nombre sugiere admin-only, pero el archivo está en la ALLOWLIST como abierto por diseño. Conviene confirmar dónde vive esa verificación.
2. **Cabecera de `mailing/actions.ts` desactualizada.** La lista «Cobertura» (`:12`) nombra `sendTestEmailAction`, que no existe (la real es `sendTestTemplateAction`). `:14` ya estaba en el FUERA DE ALCANCE #2 de L08. Es solo documentación.
3. **E2E se cuelga en mobile-safari en este entorno,** como en L08: sin salida durante más de 16 min y con un worker sin navegador. Playwright no tiene `globalTimeout` (`playwright.config.ts:111` fija `timeout: 60_000` por test), así que no aborta solo.
   - Hay una sesión Worker titulada «Agregar watchdog al E2E de verify».
   - Dato útil para esa tarea: al terminar el árbol a la fuerza desde Git Bash, el shim `corepack` devolvió `0` a su padre. Un watchdog o un wrapper debe leer el resumen de `verify.mjs`, no el código de salida del shim.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** cuando Sam lo autorice, push de la rama a sí misma y PR draft contra main. Después, tu revisión por SHA y la CI «Calidad local sin secretos» del head.
- **Validación parcial:** la corrida canónica de verify quedó interrumpida en e2e por el cuelgue conocido. Los pasos previos pasaron, E2E falló por entorno con el mismo conjunto que L08 y el build se corrió aparte. Después del merge se revalidó lo que la combinación podía afectar. Acéptala o recházala explícitamente.
- **Orden:** sin dependencias. #74 (L08) ya está en main. Este guard cierra en la app lo que 0408 cerrará en la base cuando se aplique, y no depende de que 0408 esté aplicada.
- **Compartidos:** `docs/specs/README.md` es generado. Si otra PR lo toca, se regenera con `corepack pnpm docs:index` en vez de elegir un lado; el merge driver ya lo resolvió una vez.
- **Reserva:** la rama `codex/sdd-reserve-0453-mailing-test-template-admin-guard` y el lock `refs/dtd/reservations/0453` siguen locales. Esta rama contiene su commit (`821a9df8`); decidir su publicación o limpieza te corresponde a ti. No se borró nada.
- **Sesiones consumidoras:** solo esta sesión escribió en el worktree. El claim se libera con `release --owner claude-e271ce80-5e1f-46da-930b-ae096413cfda` inmediatamente después del commit que contiene este documento.
