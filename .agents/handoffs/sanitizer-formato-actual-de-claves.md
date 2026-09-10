# Worker · sanitizer-formato-actual-de-claves

- Fecha: 2026-09-10.
- Owner/sesión: `worker-sanitizer-0452-20260910-root`.
- Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sanitizer-formato-actual-de-claves`.
- Rama: `codex/sanitizer-formato-actual-de-claves`.
- Base inicial `origin/main`: `b7ad23977b1905a25ba3154e52238f0e7baaaaa4`.
- Estado inicial: limpio; guard aprobado; claim adquirido. Asignación explícita de Sam a esta sesión; sin claim ni handoff previo. Procesos detectados: launcher Node y su hijo Codex de esta sesión.
- SDD asignada: `0452`, escribir en esta rama sin tocar la reserva.
- Estado: en-progreso; implementación preparada, criterio 5 sin cumplir.

## OBJETIVO ORIGINAL

Cerrar los tres huecos del sanitizador del Bug Reporter: descubrimiento automático de pruebas del harness primero; pruebas del módulo real en verify y CI; formatos actuales demostrados, preservando legibilidad y cobertura histórica.

## Contrato de ejecución

- Aceptación: ejecutar E1 huérfana y detener implementación si falla; conservar siete vectores originales y sanity checks; mostrar rojo/verde sintético; comprobar `apikey`; auditar Supabase, GitHub, Stripe y Slack con documentación primaria; SDD y cierre con evidencia.
- Allowlist: `lib/studio/bug-sanitizer.ts`; `scripts/test-sanitizer-inline.mjs`; pruebas nuevas en `scripts/tests/**`; `package.json` únicamente `harness:test`; `docs/specs/0452-sanitizer-formato-actual-de-claves/**`; `docs/specs/README.md`; este handoff.
- Exclusiones: no leer ni escribir `docs/archive/**` ni `.claude/worktrees/**`; no modificar captura, resto del Bug Reporter, workflow, verify/política E3, Supabase, cutoff, baseline, ruleset ni otro producto.
- Datos: nunca copiar la clave real. Hallazgo por formato/ubicación; vectores inventados inequívocamente falsos. Sin rotación ni acceso a credenciales.
- Permisos: commits selectivos, push de esta rama a sí misma, PR en borrador contra main. Sin merge, deploy, reescritura de historia ni eliminación de ramas/worktrees.
- Dependencias: ninguna dura. PR #58 y #59 declaradas independientes por el encargo.
- Subagente `audit_provider_formats`: investigación de documentación primaria, solo lectura, sin archivos asignados para escritura.

## COMPLETADO

- Hueco 3: `harness:test` usa un runner con descubrimiento de `.node.mjs`, rechazo de vacío y propagación de errores. E1 pasó 5/5 antes de tocar producción; prueba y driver intactos. El harness final pasó 26/26 en seis archivos.
- Hueco 2: suite Vitest que importa el módulo real; conserva siete P1 y siete sanity checks. Corre por los pasos Vitest existentes de verify y CI. La inline delega en ella y deja de duplicar implementación.
- Hueco 1: sb_secret y sb_publishable cubiertos en texto, consola/stack, paths y headers incidentales. `apikey` ya estaba cubierta; se prueba sin cambiar producción.
- Auditoría primaria: GitHub PAT fino y ghs compuesto; Stripe sk_org/whsec; Slack app/workflow/refresh/rotación; AWS ASIA. Solo se cambian formatos demostrados. Otras familias conservan comportamiento y limitaciones documentadas.
- SDD-0452 e índice generados. Evidencia y fuentes en la spec y `validacion.md`.
- No se declara cierre completo: revisión adversarial identifica falsos positivos nuevos para identificadores largos compatibles con formato de clave. Criterio 5 pendiente; SDD `in-progress`.

## VALIDACIÓN

- PASÓ: raíz, rama, estado limpio y `node scripts/harness-worktree.mjs guard`.
- PASÓ: `corepack pnpm install --frozen-lockfile` (813 paquetes, exit 0), Node 24.20.0, Corepack 0.35.0, pnpm 12.3.4; lockfile intacto.
- FALLÓ esperado, antes del arreglo: suite de formatos 48 fallos / 44 controles aprobados, 92 total, exit 1.
- PASÓ después, mismos vectores: 92/92, exit 0. Incluye catorce históricos, doce formas nuevas en cuatro contextos, apikey, negativos y familias previas.
- PASÓ: `corepack pnpm harness:test`, 26/26 (E1 5/5), exit 0; inline delegado 92/92; docs:check, sdd:check y diff --check.
- FALLÓ criterio 5 en revisión adversarial externa al corpus: `sb_secret_configuration_validation_failed` y `sk_org_configurationvalidationfailed` se preservan en base y se redactan ahora. Prefijo/alfabeto no distinguen siempre texto de credencial. No se imponen excepciones por palabras, dígitos o mayúsculas sin contrato que evite falsos negativos.
- En ejecución: `corepack pnpm verify`; resultado final pendiente.
- NO EJECUTADO todavía: CI alojado (requiere publicación).

## COMMITS

Commit de implementación que contiene este documento; hashes finales se registran en la PR para evitar autorreferencia.

## PR / BRANCH

PR pendiente. Rama y worktree indicados arriba; base main.

## PENDIENTES DE ESTA TAREA

- Resolver criterio 5: decisión explícita sobre colisiones de identificadores compatibles con clave o evidencia de formato más restrictivo que permita evitarlas sin debilitar redacción. Sin esa decisión, no marcar SDD done ni aprobar integración.
- Completar verify y registrar gates alojados de la PR en borrador.

## FUERA DE ALCANCE DETECTADO

`scripts/verify.mjs` contiene otra enumeración de cuatro pruebas: no ejecuta el script de package.json. Evaluar la aceptación del gate sin editarlo fuera de autorización.

- E1 y harness-discovery quedan fuera del paso harness de verify; sí corren en CI por `harness:test`. El sanitizador sí está en ambos gates por Vitest. Recomendar unificación sin añadir otro paso, en tarea autorizada.
- URL con query en `redactTokensInText` puede perder hostname antes del cambio; `redactUrl` la conserva. Repro de documentación sintética en SDD; no se toca este fallo ajeno.
- JWT/Bearer/Basic tienen límites heurísticos históricos; no se ensanchan sin tarea y negativos propios.
- Mientras se validaba, origin/main avanzó a `ad4958224239393e87780c36b39bf52b3350a69b` (merge PR #58). La base original revisada sigue siendo b7ad239; el diff de esta tarea se calcula desde su merge-base, no con comparación de dos puntas que atribuya archivos nuevos de main al Worker.

## HANDOFF AL DIRECTOR

Implementación disponible para revisión en borrador; aprobación funcional bloqueada por criterio 5. Ownership activo mientras se completa validación/publicación. No hubo merge, despliegue, rotación ni operaciones sobre datos reales o archivos archivados. No borrar rama/worktree. Director debe revisar especialmente falsos positivos y el desfase de listas entre verify/CI; los SKIPs no autorizan producción.
