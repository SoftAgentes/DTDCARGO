# deudas-cola-20260910

- Fecha: 2026-09-10.
- Owner / sesión: `codex-worker-deudas-cola-20260910` / Worker Codex.
- Estado: en-progreso.
- Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/deudas-cola-20260910`.
- Rama: `codex/deudas-cola-20260910`; base `origin/main`, SHA `710a8e0695f416700d75e7bc42e8e5cb889751e8` (fetch verificado).
- SDD: no requiere número nuevo por asignación del Director; correcciones documentales y de arnés sobre trabajo ya especificado.
- Dependencias: ninguna; cuatro deudas independientes.
- Permisos: commits locales selectivos, push de la rama propia y PR en borrador contra main. Sin merge, deploy, aplicación de migraciones, cambios SQL, ruleset, borrado de ramas/worktrees ni nuevos IDs SDD.
- Aceptación: cuatro veredictos explícitos; un commit por deuda; comentario 0449 aditivo y fechado; causa del test medida antes/después sin debilitar cobertura; cero cambios de comportamiento de producto.
- Allowlist: comentario de `supabase/migrations/0449_prealerta_exact_box_reception.sql`; `app/studio/(app)/clientes/_components/ClientsClient.contador.test.tsx`; `scripts/tests/verify-critical-coverage.node.mjs`; `scripts/verify.mjs` solo para exportar STEPS sin alterar ejecución; spec renumerada verificada en Git; `docs/specs/README.md` solo generado; este handoff.
- Exclusiones: sentencias SQL 0449; `scripts/verify-step-policy.mjs`; guarda real de verify; cutoff y pendingBelowCutoff; workflows; ruleset; producto; debilitamiento de tests.

## OBJETIVO ORIGINAL

Cerrar las cuatro deudas chicas de la cola de fusiones del 2026-09-10 en una rama, con evidencia, commits separados y PR en borrador.

## COMPLETADO

- Aislamiento y estado limpio comprobados; guard pasó; claim exclusivo adquirido.
- Deuda 1 — CORREGIDA: se añadió debajo de la primera línea de 0449 una nota `APLICADA a producción el 2026-09-10`, conservando el comentario original como estado histórico al preparar SQL. Se sigue la convención de nota fechada existente, por ejemplo en `0397_bug_advance_state_tuteo_sobre_sdd0313.sql:3`. La fecha/prod proviene de la comprobación del Director proporcionada en el encargo; este Worker no consultó producción.
- Deuda 3 — SE DEJA ASÍ, POR COSTO DESPROPORCIONADO: `STEPS` no se puede importar con solo exportarlo. `verify.mjs` ejecuta inmediatamente su runner y termina con `process.exit`; importar desde un test del propio paso harness lanzaría el gate recursivamente. Hacerlo importable exige encapsular las 90 líneas del ejecutor (413–502) y añadir frontera CLI/import (aproximadamente 9 adiciones efectivas y 180 líneas de diff por indentación). Extraer nombres con regex sustituiría el fixture por un parser frágil; un AST añadiría dependencia al harness Node. Para higiene de prioridad baja no se justifica ese costo. El fixture duplicado permanece como limitación conocida del test, no agujero del gate: `assertCompleteStepPolicy(STEPS.map((step) => step.name))` en `verify.mjs:416` clasifica los pasos reales antes de correr y sale 1 si falta política. Guarda, política y ambos archivos permanecen intactos.
- Deudas 2 y 4: pendientes de registrar su cierre.

## VALIDACIÓN

- PASÓ: guard, rama/base y estado inicial limpio.
- PASÓ: `corepack pnpm install --frozen-lockfile`, exit 0, 37.1 s; Node v24.20.0 / pnpm v12.3.4. Aviso de pnpm sobre `pnpm.onlyBuiltDependencies` ignorado; lockfile sin cambios.
- PASÓ: comparación de 0449 contra HEAD con Node/assert; al quitar exclusivamente la segunda línea añadida, el archivo completo coincide con el original (normalizando CRLF/LF). Ninguna sentencia SQL cambió y la primera línea permanece intacta.
- PASÓ: `node --test scripts/tests/verify-critical-coverage.node.mjs`, 6/6, cero omisiones, 84.5983 ms; diff vacío para test y `verify.mjs`.
- NO EJECUTADO: medición antes/después, harness:test y verify; pendientes de ejecución.
- NO DISPONIBLE: ledger de producción sin credenciales; no se solicitarán ni copiarán para este encargo.

## COMMITS

- Deuda 1: `ff08ef99` — comentario aditivo de 0449 y contrato inicial.
- Deuda 3: commit que contiene esta actualización — veredicto razonado de conservar el fixture.
- Deudas 2 y 4: pendientes; uno por deuda.

## PR / BRANCH

PR pendiente. Rama `codex/deudas-cola-20260910`, base `main`, worktree indicado arriba.

## PENDIENTES DE ESTA TAREA

Investigar/cerrar las cuatro deudas, validar, revisar diff, crear commits selectivos, publicar rama y abrir PR draft.

## FUERA DE ALCANCE DETECTADO

Ninguno hasta ahora.

## HANDOFF AL DIRECTOR

Trabajo en curso. Ownership retenido por esta sesión. No se autoriza integración ni producción.
