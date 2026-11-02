# SDD-0599: reintentar un envío del portal no lo duplica

- **Fecha:** 2026-11-02. **Owner:** `claude-sweet-curie-8102cb`.
- **Ruta:** `DTD-worktrees/reintento-no-duplica`. **Rama:** `codex/reintento-no-duplica`. **Base:** `codex/accion-que-lanza` en `dc049dcb5` (PR #360, apilada sobre #358).
- **SDD:** 0599, reservada con `sdd:next --reserve`, sin publicar: `codex/sdd-reserve-0599-reintento-no-duplica`, `refs/dtd/reservations/0599`. **Migración 0512:** libre en todas las ramas al escribirla, sin reservar. La confirma el Director General.
- **Límite:** nada entra a `main` antes de publicar. **La 0512 está sin aplicar:** aplicarla exige OK nominal de Sam.
- **Reporta a:** Director General, `local_25e2dded-103b-4eaa-b10e-6527564b9cad`.
- **Ojo:** `node_modules` es una junction al de `error-no-borra-portal`. **No correr `pnpm` en este worktree:** reinstala y rompe el original. Usar `node node_modules/vitest/vitest.mjs` y `node scripts/...`.

## OBJETIVO ORIGINAL

Sam, literal: «Haz esta tarea aquí: "Que reintentar un envío del portal no lo duplique"».

Decisión de Sam, literal: «Sí, con candado», a «¿Apruebas el diseño con candado en la base?», con la propuesta y su alternativa a la vista. **No autoriza aplicar.**

## Resultado

Un reintento con el mismo identificador devuelve la compra, cotización, reclamo o mensaje del primer envío, sin crear otro. Causa, decisión y límites en `docs/specs/0599-reintento-no-duplica/spec.md`.

**No funciona hasta aplicar la 0512.** Sin ella, el código degrada: todo entra sin candado, como hoy.

## COMPLETADO

- Migración `0512_portal_intento_sin_duplicar.sql`: columna e índice único en `prealertas`, `quotes` y `client_claims`, y la firma `portal_post_message(text, uuid)`.
- `useActionKeepingDraft` con `{ requestId: true }`, y `lib/shared/client-request.ts`.
- Las cinco acciones responden `replayed`, sin otro correlativo ni otro aviso. Adjuntos, evidencia y direcciones se comparan por contenido.
- Avisos y pantallas de éxito actualizados en los cinco formularios.
- Espera en `migrations-baseline.json` y declaración en `pending-migration-symbol-declarations.json`.
- Datos personales clasificados con `revisar-datos-ve`, en la spec. `/ui-check` del diff, sin hallazgos.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Contrato en PGlite, con los `.sql` reales | PASÓ, 39 aserciones |
| Control rojo, 8 mutantes de la migración, postflight, preflight | PASÓ, 12 de 12 casos |
| `reintento-no-duplica.test.ts` | PASÓ, 25 de 25. Con el identificador anulado, 9 de 25 en rojo, como se esperaba |
| `la-accion-lanza.test.tsx`, `use-action-keeping-draft.test.tsx` | PASÓ, 46 de 46 |
| `principal-tenant-actions`, `actions-tenant-scope`, `PortalClaims`, `PortalAddresses`, `NewPurchaseWizard` | PASÓ, 38 de 38, una por una con `--maxWorkers=1` |
| ESLint de los archivos tocados | PASÓ |
| `tsc` limitado a los archivos tocados | Sin errores en ellos; 1 ajeno de la configuración limitada |
| `check-pending-migration-symbols.mjs` | PASÓ, `0 ROJO`. **Los sitios citan número de línea: al editar esas acciones hay que actualizarlos** |
| `docs:check`, `sdd:check` | PASÓ |
| `next dev`, contrato en `supabase/postgres` con el rol real | **NO EJECUTADO:** sin turno. **PGlite tiene una conexión y corre como superusuario:** no prueba la carrera ni los permisos reales |
| Mutantes de las acciones, demás pruebas vecinas, `tsc` completo, `pnpm verify` | **NO EJECUTADO:** sin turno |
| Check obligatorio de la PR | **NO DISPONIBLE** mientras apunte a la rama de #360 |
| Filas por tabla y lectura previa en producción | **NO EJECUTADO:** necesita OK de Sam. No se leyó producción |
| Graphify, Archify, Obsidian | NO EJECUTADO: los publica la dirección desde main |

**Sin medir:** lector de pantalla, portal con sesión real, corte real contra estas acciones.

## COMMITS

- `27efd2641`: la propuesta.
- `fix(portal): SDD-0599 — reintentar un envío del portal no lo duplica`.
- El commit que contiene esta versión no se autorreferencia.

## PR / BRANCH

Rama `codex/reintento-no-duplica`, en PR en borrador contra `codex/accion-que-lanza`, **retenida**. El número queda en la propia PR.

## PENDIENTES DE ESTA TAREA

1. Con turno del Director General: `next dev`, contrato con el rol real, mutantes, pruebas vecinas, `tsc` completo.
2. Con OK de Sam: conteo de filas y lectura previa en producción.
3. Con OK nominal de Sam, después de la salida, #358 y #360: aplicar la 0512.
4. Reapuntar la PR a `main` cuando #360 entre, y esperar el check en verde.
5. Integrar, publicar y retirar la espera con `retirar-espera.mjs`.
6. Otra migración retira la firma vieja de `portal_post_message`.

## FUERA DE ALCANCE DETECTADO

1. **Candados de proveedor, referido y registro:** leen y después escriben; dos intentos simultáneos podrían pasar.
2. **Aviso al asesor si el primer envío murió antes de avisar:** sin una cola de avisos no se puede garantizar.

## HANDOFF AL DIRECTOR

- **Orden:** #358, #360 y esta.
- **Migrate-first:** la web nueva con la base vieja no se rompe, pero el aviso «no se registrará dos veces» sería falso. Aplicar antes de publicar este código.
- **Número de migración:** confirma la 0512 antes de que entre otra con el mismo número.

### Impacto documental

Spec 0599 nueva e índice regenerado. No cambian políticas.
