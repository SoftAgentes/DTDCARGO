# Handoff — SDD-0502 · mínimo facturable con batería configurable

Fecha: 2026-09-24. Estado de tarea: `lista-para-revision`.

- **Owner / sesión escritora:** `01a0cf85-0b0a-7a53-8817-e6cef69a8297` (Worker Codex).
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/calculadora-minimo-bateria-config`.
- **Rama:** `codex/calculadora-minimo-bateria-config`.
- **Base:** `origin/main` en `e9b7c4f43406a00d11068e032f07660e0391e821` después de `git fetch origin`.
- **PR:** [#190](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/190), abierto, listo para revisión y mergeable contra esa base. El Director lo cambió de DRAFT a `ready_for_review` el 2026-09-24.
- **SHA validado antes del retome con Docker:** `28986a8f8942d7522cb0f6c2c7b8fd163deccc28`.
- **Retome de revisión:** antes de esta ronda el worktree estaba limpio, la rama local coincidía con la remota y el claim estaba liberado. El Worker volvió a reclamar ownership y pasó `guard --owner` antes de escribir.
- **CI remoto del SHA `28986a8f`:** `Calidad local sin secretos` (16m45s), Vercel y Vercel Preview Comments en verde.
- **SDD:** `docs/specs/0502-minimo-bateria-configurable/spec.md`, reservada antes de editar producto.
- **Estado SDD:** `in-progress`. La implementación Worker está lista para revisión, pero la SDD no se marca `done` antes de la integración a `main`; el estado de tarea y el estado SDD son independientes según el runbook.
- **Permiso:** Sam autorizó implementar, probar, commitear, publicar la rama y abrir el PR. No autorizó merge, despliegue, migraciones ni cambios de configuración en producción.

## OBJETIVO ORIGINAL

Corregir la calculadora pública para que, cuando la cotización cae por debajo del mínimo y lleva baterías, primero alcance el mínimo facturable y después aplique el multiplicador de batería vigente en Administración. Con piso USD 50, `×1,5` debe producir USD 75 y, si Administración cambia la configuración a `×2`, el mismo caso debe producir USD 100 sin cambiar código ni hardcodear esos totales.

## COMPLETADO

- `lib/calculadora.ts` conserva la aritmética cruda y aplica el orden autorizado: subtotal → piso normal → batería configurable → descuento → protección final únicamente del piso normal.
- El multiplicador sigue entrando por `params.recargoBateriaMult`, alimentado por la configuración de Administración; no se agregó un valor fijo para USD 75, USD 100, `×1,5` ni `×2` en el motor.
- El desglose afectado reconcilia a centavos sin cambiar el total histórico sobre el piso. Ejemplo mínimo visible: USD 8,50 de volumen + USD 41,50 de ajuste + USD 25,00 de batería = USD 75,00.
- `components/CalculadoraForm.tsx` muestra dos decimales sólo cuando son necesarios. No hubo rediseño, cambio de jerarquía ni cambio en `CalculadoraPage.tsx`.
- `__tests__/calculadora.test.ts` cubre mínimo sin batería, batería `×1,5`, batería `×2`, descuentos, bases fraccionarias bajo/sobre el piso y preservación del total histórico.
- `__tests__/calculadora-sin-peso.test.ts` agrega la regresión explícita de compatibilidad con SDD-0257: bajo el piso, con peso omitido y batería `×1,5`, conserva `sinPeso`, el techo `pesoMaxSinRecargoKg`, calcula `piso × recargoBateriaMult` y reconcilia el desglose. La prueba pasó sin revelar una falla nueva del motor; no hubo cambio adicional de comportamiento.
- `components/CalculadoraForm.minimo-bateria.test.tsx` prueba la reconciliación visible del mínimo con batería.
- `lib/studio/document-import/estimate.test.ts` confirma que el consumidor documental compartido recibe la regla corregida sin duplicar la fórmula.
- Se actualizaron `docs/marketing/README.md`, `docs/marketing/calculadora-explicada.html` y la SDD-0502.
- `graphify update . --force` recorrió el corpus local, reportó dos archivos legales con extracción sintáctica parcial y no detectó cambios de topología. El grafo conservó dos desfases estructurales canónicos ya descritos por el propio runbook.
- Tres subagentes de la misma tarea leyeron lotes no solapados de las 16 fuentes canónicas; no editaron archivos de producto ni operaron como sesiones Worker independientes. Quedaron dos fragmentos canónicos, ignorados y parseables, para 9/16 fuentes: lote A (5 fuentes, 37 nodos, 43 aristas, 1 hyperedge) y lote C —que incluye la regla de SDD-0502— (4 fuentes, 54 nodos, 62 aristas, 3 hyperedges). El lote B de 7 fuentes no logró materializarse tras reintento y fue interrumpido; no se afirma 16/16.

## VALIDACIÓN

- **PASÓ:** pruebas focales — 3 archivos, 103 pruebas.
- **PASÓ:** matriz relevante — 16 archivos, 216 pruebas.
- **PASÓ (corrección de revisión):** `__tests__/calculadora-sin-peso.test.ts` — 1 archivo, 24 pruebas; incluye la nueva regresión SDD-0257.
- **PASÓ (matriz exigida por el Director):** `__tests__/calculadora-sin-peso.test.ts`, `__tests__/calculadora.test.ts`, `lib/studio/document-import/estimate.test.ts` y `components/CalculadoraForm.minimo-bateria.test.tsx` — 4 archivos, 127 pruebas.
- **PASÓ (corrección de revisión):** ESLint focal sobre esos 4 archivos; typecheck; `pnpm docs:check` con 488 specs; `pnpm sdd:check`; y `git diff --check`.
- **PASÓ:** ESLint focal sobre los archivos TypeScript/TSX cambiados.
- **PASÓ:** typecheck.
- **PASÓ:** `pnpm docs:check` — 488 specs.
- **PASÓ:** `pnpm sdd:check`.
- **PASÓ:** inspección manual por Webpack en `/tarifas`, desktop `1440×1000` y móvil `390×844`: USD 8,50 + USD 41,50 + USD 25 = USD 75, sin overflow.
- **FALLÓ (ambiental / Turbopack no disponible para esta prueba):** el servidor local con Turbopack no resolvió `@vercel/turbopack-next/internal/font/google/font`. Se reinició la misma rama con Webpack, sin alterar dependencias ni configuración, y allí pasó la prueba visual.
- **NO DISPONIBLE en la consola local:** faltaban `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; la calculadora usó su respaldo `×1,5`. Esto no prueba una lectura real de configuración productiva. La prueba automatizada demuestra que el motor también respeta `×2` cuando ese valor es inyectado.
- **PASÓ:** `node scripts/run-sql-tests.mjs` — 224 contratos SQL verificados en PostgreSQL 17 efímero, con rollback total.
- **PASÓ:** `node scripts/check-schema-rebuild.mjs` — 467 migraciones verificadas desde cero: 449 aplicadas al esquema y 18 sólo-ledger; aislamiento multi-tenant comprobado sobre 219 tablas y 2 tenants del fixture efímero.
- **PASÓ CON CIERRE INCOMPLETO:** `pnpm verify` terminó con exit 0 y 16/17 pasos medidos. Harness: 201 pruebas pasaron. Vitest: 655 archivos, 8.913 pruebas pasaron y 1 quedó omitida. `sql-tests` y `schema-rebuild` pasaron dentro del gate. E2E: 167 pasaron, 18 omitidas y 1 flaky pasó al reintento; el watchdog forzó el cierre de un worker WebKit en Windows después de 300.000 ms y el gate quedó `OK con aviso`. El build de producción pasó.
- **NO EJECUTADO / NO DISPONIBLE:** `migrations-applied`, por ausencia de credenciales autorizadas. Además, no aplica materialmente al diff de este PR: no modifica migraciones, esquema, RPC, DB ni Administración. Se conserva clasificado como gate crítico no medido; no se simula con acceso productivo para obtener verde.
- **Veredicto canónico de `pnpm verify`:** `CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied`. No hubo fallos en lo medido (16/17); exit 0 no equivale a cierre verde completo.
- **PASÓ CON PENDIENTE HISTÓRICO:** `graphify update . --force` refrescó el grafo local con Graphify `0.9.61`; `knowledge:status --preview` quedó sin fuentes estructurales pendientes, faltantes, eliminadas o excluidas. El estado estructural general sigue `PENDING` sólo por los desfases de encabezados ya existentes en `docs/engineering/project-rules.md` y `docs/runbooks/knowledge-graphify-obsidian.md`. El runbook exige que el Director quite/reinyecte la capa semántica desde el checkout principal para corregir ese caso; el Worker no alteró manualmente esa capa.
- **PENDIENTE / NO DISPONIBLE:** cobertura semántica piloto `0/16` en el recibo vigente. Los fragmentos A y C cubren 9/16, pero el lote B no quedó disponible y no se importó evidencia parcial sobre una estructura `PENDING`. Este handoff está fuera de las 16 fuentes del piloto y queda visible como pendiente global, sin presentarse como cobertura completa.
- **PASÓ:** `pnpm knowledge:visual` y `pnpm knowledge:visual:check` dejaron Archify `2.16.0` `CURRENT` en la medición previa al commit documental, con 9/9 comprobaciones y 11 fuentes; conserva explícitamente Graphify estructural/semántico como `PENDING`. Como el commit cambia el SHA sin cambiar esas 11 fuentes, el Worker repite la comprobación sobre el head final y registra el SHA exacto en PR/Director para evitar autorreferencia.
- **PASÓ:** `pnpm knowledge:publish --preview` generó localmente 1.163 documentos con estado `PREVIEW`, sin conflictos; no publicó ni modificó la bóveda compartida. Las advertencias históricas de enlaces permanecen visibles.
- **FALLÓ como gate esperado:** `pnpm knowledge:check --preview` terminó con exit 1 por `MAIN_REQUIRED`, `DIRTY_SOURCE` (este handoff previo a commit), `STRUCTURAL_PENDING` y `SEMANTIC_PILOT_PENDING: 0/16`. No se presenta como conocimiento integrado.
- **PASÓ:** `git diff --check` sobre el handoff final antes de commit.

## COMMITS

- `86abfc5d` — incorpora la reserva válida SDD-0502 (`codex/sdd-reserve-0502`, origen `11ed19287734ff7966506ce82a6f552633b5ff19`).
- `8fe94470` — especifica la decisión comercial y el alcance antes del cambio de producto.
- `700ec903` — implementa piso → batería configurable, reconciliación visible, pruebas y documentación.
- `90bd9f89` — cierre Worker, evidencia de conocimiento y handoff revisado inicialmente por el Director.
- `28986a8f` — agrega la regresión SDD-0257 y actualiza el cierre de revisión.
- **Commit de recibo Docker:** actualiza únicamente este handoff con los gates SQL/schema y `pnpm verify` canónico. Su SHA exacto se registra después de crearlo en el body de PR #190 y en el mensaje al Director; no se incrusta dentro de su propio contenido para evitar una autorreferencia imposible.

## PR / BRANCH

- **Base:** `main` / `e9b7c4f43406a00d11068e032f07660e0391e821` al crear la rama.
- **Head:** `codex/calculadora-minimo-bateria-config`.
- **PR:** [#190](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/190), abierto y **listo para revisión**; conserva el cierre incompleto únicamente por `migrations-applied`.
- **Estado remoto anterior al retome Docker:** head `28986a8f8942d7522cb0f6c2c7b8fd163deccc28`; los tres checks remotos estaban en verde. El nuevo head documental exacto y sus checks se registran fuera del commit después del push.
- El Worker no mergea, no despliega y no aplica migraciones.

### Propuesta de excepción limitada para el gate restante

Se propone que el Director/founder decida una excepción limitada exclusivamente al SHA exacto del nuevo head de PR #190 que se publique al cerrar este recibo. El único gate crítico sin medir es `migrations-applied`: requiere credenciales autorizadas y no aplica materialmente al diff, que no toca DB, esquema, migraciones, RPC ni Administración. `sql-tests`, `schema-rebuild`, las pruebas de producto, E2E y build sí pasaron. La propuesta no convierte `pnpm verify` en verde completo ni acredita el ledger productivo. Aceptar o rechazar la excepción corresponde expresamente al Director/founder y debe quedar vinculada al SHA final, no a la rama en abstracto.

## PENDIENTES DE ESTA TAREA

- Revisión del Director sobre el SHA correctivo exacto de PR #190 y sus checks remotos.
- Decisión explícita del Director/founder sobre aceptar o rechazar la excepción limitada de `migrations-applied`.
- Autorización explícita de merge y del auto-deploy que ese merge desencadenaría; ninguna de las dos está otorgada por este handoff.
- Verificación separada de `main`, deployment y recorrido productivo después de una eventual integración autorizada.
- Cierre de conocimiento: decidir si se recuperan/reextraen las 7 fuentes del lote B, aplicar los fragmentos A/C desde una copia o desde `main` integrado y publicar la bóveda sólo desde `main` comprobado.

## FUERA DE ALCANCE DETECTADO

- Hacer merge a `main`, desplegar a Vercel, aplicar migraciones o tocar datos/configuración de producción.
- Cambiar el valor vigente del multiplicador desde este Worker.
- Corregir el problema ambiental de Turbopack/`next/font` o proveer credenciales Supabase.
- Resolver los skips/flaky históricos del arnés E2E que no reproducen una regresión de esta fórmula.
- Publicar la bóveda Obsidian compartida: exige `main = origin/main` integrado y comprobado.
- Limpiar la reserva remota ambigua `codex/sdd-reserve-0501`. El Director detectó que otro handoff canónico ya usa ese número; la reserva `393aa37dff231ba1e888e03816fb5fb5b6bc563f` queda preservada, sin PR, sin borrado, sin force y sin reciclaje.

## HANDOFF AL DIRECTOR

Revisar el PR listo para revisión sobre su nuevo SHA remoto exacto, observar CI y decidir explícitamente la excepción limitada de `migrations-applied` antes de cualquier integración. La regla compartida impacta la calculadora pública y el estimador de importación documental mediante `calcularEnvioLCL`; no hay cambio de esquema, RPC ni Administración. Después de una integración autorizada, el Director debe comprobar `main`, despliegue y recorrido productivo como evidencias separadas antes de afirmar que está en producción.

El ownership del worktree se libera únicamente después del commit selectivo, push, actualización del body de PR #190 y notificación al Director. No se elimina el worktree ni la rama.
