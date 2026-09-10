# 0446 aplicada a producción — 2026-09-10

Tarea: aplicar `0446_portal_profile_functional_remediation` a producción. Ejecutada por el
Director con autorización nominal de Sam («aplica la 0446 también»), conforme a
`docs/runbooks/aplicar-migraciones-prod.md`. Aplicada **después** de la 0447.

## Resultado

**APLICADA.** Ledger de prod: 411 → 412, con el basename exacto como `name`.

## El orden se invirtió, y se comprobó que no importa

El orden natural era 0446 → 0447; se aplicó al revés porque las autorizaciones llegaron en
ese orden. **0446 hace `create or replace` de `portal_set_identity_photo`**, que es la función
de la que depende el trigger de 0447 para no bloquear la PRIMERA carga.

Verificado en el código antes de aplicar (`0446…sql:286`): el insert del asiento
`identity_photo` está guardado por `if v_old_path is not null and btrim(v_old_path) <> ''`.
O sea, **solo se crea fila en un REEMPLAZO**. La primera carga sigue sin crear ledger y sigue
sin ser bloqueada por 0447. **El invariante se conserva y la inversión de orden es inocua.**

Precedencia resultante en un reemplazo: la RPC verifica el cupo, intenta el insert, y el
trigger de 0447 lo detiene con `identity_photo_replacement_temporarily_disabled`.

## El backfill que bloquea tablas

Esta migración contiene una reparación única que hace
`lock table public.clients, public.client_profile_edits in share row exclusive mode`, y su
propio comentario pide una ventana tranquila.

**Se sondeó antes de aplicar:**

| | antes |
|---|---|
| filas en `clients` | 571 |
| filas en `client_profile_edits` | 4 |
| clientes fusionados | 2 |
| **asientos a reparar** | **0** |
| condiciones de aborto (tenant nulo) | 0 |
| conexiones activas | 2 |

Con **0 asientos a reparar el bucle nunca entra**: el lock se sostiene lo que dura una
transacción trivial. Comprobado después: 571 y 4 filas, sin cambio.

## Vuelta atrás asegurada antes de escribir

`0446` reemplaza `portal_set_identity_photo`. Se verificó que el cuerpo vivo en producción era
**byte a byte el de `0445_portal_profile_edit_limit.sql`** (md5 `49b0006b…` en ambos lados),
así que ese archivo del repo es el restore exacto si hiciera falta revertir.

## Integridad de la transcripción

El SQL pasó por el conector, transcrito a mano: 368 líneas. Se calcularon los md5 de los tres
cuerpos de función **desde el archivo, antes de aplicar**, y se compararon después.

| función | md5 esperado | resultado |
|---|---|---|
| `portal_profile_edit_follow_request_reassignment` | `10b6e764…` | **coincide** |
| `portal_profile_edits_follow_client_merge` | `8948fa55…` | **coincide** |
| `portal_set_identity_photo` | `057aea5c…` | **coincide** |

## Verificación posterior, contra el OBJETO

| comprobación | resultado |
|---|---|
| dueño de las tres funciones | `postgres` |
| ACL de `portal_set_identity_photo` | `postgres=X/postgres \| authenticated=X/postgres` — **idéntica a antes** |
| triggers en `clients` | 5 → **6** |
| triggers en `client_change_requests` | 2 → **3** |
| triggers en `client_profile_edits` | **1**, sin cambio (el de 0447 intacto) |
| ledger | 411 → **412**, basename exacto |
| filas de negocio | 571 y 4, sin cambio |

## Este cambio

Saca `0446_portal_profile_functional_remediation` de `pendingBelowCutoff`. Pendientes
declarados: **15 → 14**. **El `cutoff` no se toca**, sigue en 238.

## PENDIENTES DE ESTA TAREA

Ninguno de aplicación.

## FUERA DE ALCANCE DETECTADO

- Quedan **14 migraciones declaradas pendientes**, entre ellas `0449`, que **exige avisar a
  Yiwu antes** porque cambia cómo reciben.
- Sigue vigente lo que dice la cabecera de 0447: una migración posterior deberá retirar su
  trigger cuando la purga gobernada, el legal hold y el control regional tengan evidencia.
