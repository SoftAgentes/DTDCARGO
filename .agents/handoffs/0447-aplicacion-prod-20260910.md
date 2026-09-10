# 0447 aplicada a producción — 2026-09-10

Tarea: aplicar `0447_identity_photo_replacement_privacy_gate` a producción y dejar el
registro coherente. Ejecutada por el Director con autorización nominal de Sam
(«aplica la 0447 a producción»), conforme a `docs/runbooks/aplicar-migraciones-prod.md`.

## Resultado

**APLICADA.** Ledger de prod: 410 → 411 filas, con el basename exacto como `name`,
que es la regla hacia adelante del runbook.

## Qué cambia en producción

Crea el trigger `client_profile_edits_identity_photo_privacy_gate`, `BEFORE INSERT`
por fila sobre `public.client_profile_edits`, que **detiene todo REEMPLAZO de foto de
identidad** dentro de la misma transacción, antes de mover el puntero.

**La primera carga sigue permitida**: `portal_set_identity_photo` no crea fila
`identity_photo` cuando `clients.cedula_photo_path` está vacío.

## Foto ANTES de escribir

Esta vez el inventario se hizo **antes**, que es el hueco de procedimiento que la
aplicación de la 0448 declaró haber invertido.

| | antes |
|---|---|
| contrato de 0445 (`client_profile_edits` + `portal_set_identity_photo(text)`) | presente |
| función del gate | **no existía** (el preflight no iba a abortar) |
| trigger | **no existía** |
| triggers no internos en la tabla | **0** |
| dueño de la tabla | `postgres` |
| filas totales | 4 |
| filas con `edit_kind = 'identity_photo'` | **0** |

El último número es el que importa operativamente: **ningún cliente había reemplazado
su foto todavía**. La contención llega antes de que el camino se usara, así que no
interrumpe nada en curso.

## Transacción única

La entrada del baseline exigía `psql --single-transaction -v ON_ERROR_STOP=1` porque el
archivo no abre transacción propia. Se envolvió en `begin`/`commit` explícitos, el mismo
método usado con la 0448. **El contenido del archivo no se modificó.**

Importaba: la migración **no es idempotente** —su preflight aborta si el gate ya existe—,
así que una aplicación parcial habría dejado la función huérfana y bloqueado el reintento.

## Verificación posterior, contra el OBJETO

| comprobación | resultado |
|---|---|
| función existe | sí |
| dueño | `postgres` |
| ACL | `postgres=X/postgres` — revocado a `public`, `anon`, `authenticated`, `service_role` |
| trigger | `BEFORE INSERT`, por fila, **HABILITADO (origin)** |
| función enganchada | `block_identity_photo_replacement_without_privacy_controls` |
| comentarios de función y trigger | presentes |
| ledger | 410 → **411**, con el basename exacto |
| **md5 del cuerpo desplegado vs archivo** | **`8b708210…` = `8b708210…` idénticos** |
| filas de la tabla | 4, sin cambio |
| triggers no internos | 0 → 1 |

El md5 del cuerpo se comparó contra el archivo para descartar un error de transcripción
del Director al pasar el SQL por el conector. Coincide byte a byte.

**Prueba funcional con insert sintético: NO EJECUTADA, deliberadamente.** Habría exigido
escribir en una tabla de PII real; aunque se revirtiera, la autorización fue aplicar la
migración, no insertar filas de prueba. Lo que esa prueba demostraría —que el trigger está
enganchado y activo— quedó cubierto por `tgenabled = 'O'` y por la identidad del cuerpo.

## Este cambio

Saca `0447_identity_photo_replacement_privacy_gate` de `pendingBelowCutoff`, que es lo que
la propia entrada mandaba al aplicarla. Pendientes declarados: **16 → 15**.
**El `cutoff` no se toca**, sigue en 238.

## PENDIENTES DE ESTA TAREA

Ninguno de aplicación.

## FUERA DE ALCANCE DETECTADO

- La cabecera de la propia migración dice que **una migración posterior deberá retirar el
  trigger** cuando la purga gobernada, el legal hold y el control regional de acceso tengan
  evidencia operativa. Hoy no existen. Mientras tanto el reemplazo queda cerrado.
- Quedan **15 migraciones declaradas pendientes**, entre ellas `0449`, que **exige avisar a
  Yiwu antes** porque cambia cómo reciben.
