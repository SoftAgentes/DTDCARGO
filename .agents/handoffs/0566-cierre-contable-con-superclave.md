# Handoff · SDD-0566 · Cierre contable con superclave y reporte de excepciones

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19, en Caracas de 15:00 a 17:30 aprox. (UTC 19:00 a 21:30) |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0566-cierre-contable-con-superclave` |
| Rama | `codex/sdd-0566-cierre-contable-con-superclave`, desde `origin/main` `b34c8d57` |
| SDD | [0566](../../docs/specs/0566-cierre-contable-con-superclave/spec.md), `in-progress`. La reserva es `codex/sdd-reserve-0566` (`fb597a2c`) y entró por cherry-pick. La migración 0493 la asignó el Director |
| Estado | lista para revisión, con PR en borrador y la espera declarada; `pnpm verify` necesita turno del Director; la 0493 se aplica antes de fusionar (MIGRATE-FIRST), con el OK nominal de Sam |
| Permisos | El Director la asignó el 2026-10-19 («cierre contable con superclave y reporte de excepciones»), con las decisiones de Sam de ese día. Eso cubre commits selectivos, push de la rama propia y PR en borrador. **No incluye aplicar la 0493 ni leer producción:** eso es del Director, con el OK nominal de Sam |

## OBJETIVO ORIGINAL

Decisión de Sam del 2026-10-19, registrada por el Director: el período cerrado se maneja como en QuickBooks, con advertencia y una «superclave de autorización» distinta de la clave del usuario. Lleva un reporte «Excepciones al cierre» y el historial de cambios de la fecha. El diseño de partida del Director está en la spec.

## COMPLETADO

- **Migración `0493_cierre_contable_superclave.sql`:**
  - **el modo del cierre:** `superclave` por defecto, que sin clave definida bloquea como hoy, o `advertencia`;
  - **la superclave:** solo como hash bcrypt, en una tabla sin acceso de API, con bloqueo tras 5 fallidos durante 15 minutos, `for update` y un tope de 72 bytes;
  - **la excepción como permiso:** la fila con su nonce y `txid_current()`, que los disparadores de la 0133 exigen;
  - **las cuatro operaciones en período cerrado:** crear, asentar, anular y eliminar borrador, como RPC DEFINER;
  - **el historial del cierre**, con fecha, modo, superclave, intentos y bloqueos.
  - **El preflight** compara el md5 del cuerpo de las seis funciones de las que depende, y aborta si producción difiere.
  - **Corrige el «%s» del mensaje de la 0133**, que en producción dice «modificars».
- **App:**
  - las acciones de los asientos piden la excepción o la usan;
  - las acciones del admin para el modo y la superclave;
  - el diálogo y los campos de la excepción en el Libro diario y en «Nuevo asiento»;
  - los ajustes en el cajón del cierre;
  - la pestaña «Excepciones al cierre», con su CSV;
  - sin la 0493, todo vuelve a lo de hoy.
- **Gobierno de la migración:**
  - la espera en `supabase/migrations-baseline.json`;
  - los 10 símbolos en `supabase/pending-migration-symbol-declarations.json`;
  - el inventario de RBAC, de 435 a 438.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| Contrato `supabase/tests/0493_cierre_contable_superclave.test.sql` en **PostgreSQL 17** (Docker) | la migración | PASÓ: «TEST 0493 GREEN: 75 aserciones». Sin la 0493 (`apply_fix=false`): «TEST 0493: existe public.anular_asiento_en_cierre(uuid,text,text)» en la primera aserción |
| `cierre-contable-superclave.migration.test.ts` (el mismo contrato en PGlite) | contrato, control rojo, 18 mutantes de la migración, aborto del preflight por cuerpo distinto, espera declarada y centinela del FOR UPDATE | PASÓ: `Tests  23 passed` |
| `vitest run` de contabilidad, `lib/studio/accounting`, la prueba de la migración, `account-types`, guardas de RBAC, reportes y `lib/studio/reports` | lo tocado y sus vecinos | PASÓ: `Test Files  31 passed (31)`, `Tests  919 passed (919)` |
| Control rojo de la app, 13 mutantes, restaurados por copia con la huella sha256 | campos con otro nombre, un error de la base a la vista, la RPC sin excepción, un aviso inventado sin la 0493, la anulación sin su motivo, la superclave sin vaciar (diálogo y cajón), la superclave a la vista, el diario sin ver el cierre, la fecha ISO en el aviso, el modo sin validar y la confirmación sin exigir | `MUERTOS 13/13 · restaurados 13/13` |
| `typecheck`, eslint `--max-warnings=0` (todos los .ts/.tsx tocados), `check-rsc-boundary` | repo y archivos tocados | PASÓ |
| `check-pending-migration-symbols` | código alcanzable que usa la 0493 | PASÓ: «0 ROJO · 2 AMARILLO declarado(s)» (la 0492 y la 0493) |
| `migrations-lock verificar` | candado | PASÓ: la 0493 figura como espera, «0 nueva(s) sin sellar» |
| `docs:check` (551 specs), `sdd:check`, `governance:check`, `components:check` | documentación | PASÓ |
| `/ui-check` | la UI nueva | OK con ajustes menores. El ⭐ (foco inicial del diálogo en el primer campo) quedó aplicado, con prueba. Los otros tres son de baja prioridad y se anotan abajo |
| `pnpm verify` | completo | PENDIENTE: turno del Director |

### Lo que destaparon las pruebas y se corrigió

1. **El mensaje de la 0133 dice «modificars» en producción:** usa `%s` dentro de un `raise`. Lo vio el primer mutante del disparador.
2. **La ayuda del motivo estaba dentro del `<label>`:** el nombre accesible del campo era «Motivo del cambioQueda en el reporte…». Ahora la ayuda va con `aria-describedby`.
3. **bcrypt usa solo 72 bytes:** con el tope de 200 caracteres, dos superclaves que comparten esos 72 bytes eran la misma. Ahora el tope es de 8 a 64 caracteres y 72 bytes, en la base y en la app.
4. **El control rojo fallaba antes de su primera aserción:** un ayudante `language sql` del contrato se valida al crearse. Pasó a plpgsql.

## Impacto documental y conocimiento

La spec 0566 y el índice. **Cambia el esquema** (la 0493), así que el Director tiene que publicar Graphify y Archify después de integrarla. El plan (§9 del diagnóstico) lo actualiza el Director en su PR; aquí no se tocó.

## PENDIENTES DE ESTA TAREA

1. **Decisión de Sam, A o B (spec §8):** superclave compartida o autorizador con su propia cuenta. Esta SDD hace A; si elige B, cambia solo la verificación.
2. **La previa de producción, antes de aplicar** (la corre el Director):
   - releer las seis huellas del preflight;
   - **revisar si el Postgres del VPS registra los parámetros de las sentencias** (`log_statement`, `log_min_duration_statement`, `log_parameter_max_length`). Si los registra, la superclave quedaría en ese log en texto plano.
3. `pnpm verify` con turno del Director.
4. Aplicar la 0493 con el OK nominal de Sam NOMBRANDO `0493_cierre_contable_superclave`, hacer el smoke de la espera y después fusionar.

## FUERA DE ALCANCE DETECTADO (para el Director)

1. **Los documentos que generan asientos (facturas, recibos, CxP, pagos y gastos) no pasan por la excepción.** Cada flujo necesita su RPC atómica con el mecanismo de esta SDD; se proponen como SDD de seguimiento, una por flujo. Además, **facturas, recibos, CxP y pagos ni siquiera miran el cierre en la app**: su asiento best-effort choca con el disparador y falla en silencio, y el documento queda en «Por contabilizar». El diseño de partida decía lo contrario; el `git grep` está en la spec.
2. **La sombra y el respaldo del fondo** del diálogo usan los mismos `rgba` del `ConfirmDialog` del sistema. Conviene pasar los dos a `var(--shadow-pop)` en una limpieza común (`/ui-check`, baja).
3. **En los ajustes del cierre**, los errores no están ligados a sus campos con `aria-describedby` y los botones no dicen «Guardando…» mientras esperan (`/ui-check`, baja).
4. **Riesgo aceptado:** un editor puede bloquear la superclave 15 minutos con 5 intentos fallidos. El admin la restablece o reabre el período.
5. **Que el motivo llegue a `entity_audit_log`** por `dtd.audit_reason` es INFERIDO de la 0294: el contrato no aplica el escritor de auditoría.
