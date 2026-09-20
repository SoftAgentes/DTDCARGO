---
sdd: "0469"
title: "Borrar un cliente deja un evento de auditoría atómico y se confirma con un diálogo R2"
status: in-progress
author: "Claude"
created: 2026-09-15
updated: 2026-09-15
supersedes: null
superseded_by: null
related: ["0010", "0467", "0166", "0174", "0187", "0377"]
confidencialidad: interno
---

# SDD-0469 · Borrar un cliente deja un evento de auditoría atómico y se confirma con un diálogo R2

> El borrado de un cliente desde el Studio (Clientes › Editar › Eliminar) pasa a cumplir las
> políticas de permanencia y auditoría. Se confirma con un `ConfirmDialog` R2 que nombra al cliente,
> su Shipping Mark y la consecuencia. La mutación y su evento `client_deleted` son una sola operación
> (migración `0455_borrado_cliente_auditado`). La acción ya no devuelve `ok` cuando no borró ninguna
> fila.

## Contexto

- **La acción no auditaba ni comprobaba filas.** `softDeleteClientAction`
  (`app/studio/(app)/clientes/actions.ts:412-450` en main `c70956bf`) validaba
  `moduleEditDenial(…, "clients")` y hacía `update({ deleted_at })` por Shipping Mark
  (`:438-441`). No dejaba ningún evento y devolvía `ok` aunque el UPDATE no alcanzara ninguna fila:
  cliente ya borrado, de otro tenant o inexistente.
- **La confirmación no era R2.** `ClientDrawer.tsx` confirmaba inline con «¿Seguro? El cliente
  pierde su acceso al Portal.» (`:50`, `:780-831` en main): sin diálogo, sin el nombre del registro y
  con «Sí, eliminar» / «No».
- **Políticas.**
  - MP-01 clasifica a los clientes como maestros P1/R2 (`docs/governance/policies/mp-01.md:69`).
  - R2 es «`ConfirmDialog` con nombre del registro y consecuencia» (`mp-01.md:39`).
  - AUD-01 §2 exige auditar «eliminar».
  - AUD-01 §1 y §4 exigen que la mutación y el evento sean una sola operación.
  - AUD-01 §3 exige tenant, actor, entidad, antes/después, hora del servidor, motivo y correlación.
  - AUD-01 §6 exige, para P2, clasificación, consecuencia, motivo, recuperación y archivos.
- **Auditoría existente.**
  - `append_audit_event` (0267) valida el contrato y es append-only.
  - El CHECK de 0267 exige motivo en todo evento `_deleted` (`0267_audit_contract_append_only.sql:354`,
    `:556`).
  - El wrapper de 0294 da prioridad al motivo transaccional `dtd.audit_reason`
    (`0294_audit_d2_human_reasons.sql:88`).
  - El tipo de entidad `client` está activo desde 0293. El único trigger de auditoría sobre `clients`
    (`audit_d5_clients_contact`, `0293_audit_d5_residual_and_writer_retirement.sql:517`) sólo mira
    `email` y `phone` (`:404-423`).
  - No existe una tabla-catálogo de tipos de evento. El vocabulario lo fijan el tipo de entidad, la
    forma `^[a-z][a-z0-9_]{1,79}$` y el CHECK de motivo.
- **Portal (SDD-0467).** `0454_borrar_cliente_revoca_portal` está aplicada en producción. Su trigger
  `clients_revoke_portal_on_soft_delete` revoca el acceso en la misma transacción del borrado y reusa
  `dtd.audit_reason` si el caller trae uno (`0454_borrar_cliente_revoca_portal.sql:284-305`).
- **Fusión.** `merge_clients` (0361) retira la ficha fusionada con un solo UPDATE que pone
  `merged_into_client_id` y `deleted_at` (`0361_merge_clients_conserva_kommo_contact.sql:233-236`).
  Las formas de 0341 y 0358 hacen lo mismo.
- **RLS.** «clients by tenant» es FOR ALL con `tenant_id = get_user_tenant_id()`
  (`0012_rls_perf_and_rpc_guards.sql:248-251`); 0230 le quitó `deleted_at is null` al USING para que
  el soft-delete no choque con la policy.
- **Restauración.** No hay en el repo ningún camino que vuelva a poner `clients.deleted_at` en NULL
  (SDD-0467, Contexto; búsqueda repetida en `app/`, `lib/`, `supabase/` y `scripts/`).
- **Otros escritores de `clients.deleted_at`.** Sólo `merge_clients` (0341, 0358, 0361). La acción
  del Studio era el único escritor desde TypeScript. Las demás sentencias sobre `clients` que
  mencionan `deleted_at` (0243, 0383) sólo filtran por él.

## Alcance

- `supabase/migrations/0455_borrado_cliente_auditado.sql` y su contrato
  `supabase/tests/0455_borrado_cliente_auditado.test.sql`.
- `supabase/migrations-baseline.json`: únicamente la espera `0455_borrado_cliente_auditado` en
  `pendingBelowCutoff`.
- `supabase/pending-migration-symbol-declarations.json`: la degradación declarada de la RPC nueva,
  que el gate `pending-migration-symbols` exige mientras 0455 esté pendiente.
- `app/studio/(app)/clientes/actions.ts` (sólo `softDeleteClientAction`, sus mensajes y el import de
  `validateAuditReason`), `ClientDrawer.tsx` (el borrado) y sus dos tests.
- `docs/legal/privacidad/mapa-de-borrado.md` (§10), esta spec, el índice generado y el handoff.
- Fuera de alcance:
  - la retención de los datos de un vínculo del Portal revocado (Sam decidió 30 días; es la
    siguiente tarea);
  - una UI de restauración, el borrado físico y cualquier otra entidad;
  - redefinir objetos de 0454 o `merge_clients`, que no se tocan;
  - 0414, 0415, 0422, 0423 y sus esperas; los archivos de la PR #114; los scripts de verify y e2e;
  - aplicar migraciones o leer producción.

## Diseño

### Contrato por entidad (MP-01 §7)

| Campo | Cliente vivo |
|---|---|
| Resultado | P2: `deleted_at`, con identidad y referencias conservadas. MP-01 pide P1 para maestros (no conformidad preexistente, ver Gobernanza) |
| Fricción | R2: `ConfirmDialog` con nombre, Shipping Mark y consecuencia |
| Permiso | `moduleEditDenial(…, "clients")` en el servidor, y RLS «clients by tenant» en la base |
| Consecuencia | Sale de las listas; pierde el vínculo al Portal y sus códigos cortos (0454); queda el evento |
| Recuperación | Ninguna en el Studio. El diálogo no promete restauración |
| Motivo | Opcional; sin motivo humano, el evento lleva un motivo por defecto explícito |
| Auditoría | `client_deleted` atómico, con tenant, actor, antes/después, motivo y correlación D5 |
| Retención | La fila y lo que cuelga de ella se conservan (mapa de borrado §10) |
| Archivos | Foto del documento, avatar y fachada se conservan sin cambios; `related_files: []` |

### Motivo opcional con motivo por defecto

- MP-01 pide R2 para clientes y R2 no exige motivo (`mp-01.md:39`). SGE-00.08 no admite un campo
  obligatorio nuevo sin riesgo documentado.
- AUD-01 §3 exige motivo para R3, rechazo, anulación, override y cambios de acceso. El cambio de
  acceso de este borrado ya lleva su motivo propio (0454), clasificado como cumplimiento en SDD-0467.
- El CHECK de 0267 exige motivo en un evento `_deleted`. Sin motivo humano el trigger escribe
  «Cliente eliminado sin motivo indicado (SDD-0469).», que no se confunde con uno del operador.
- Con motivo humano, 0454 lo reusa también en el evento `portal_access_status_changed`.

### Por qué un trigger y una RPC

- **Trigger `clients_audit_soft_delete`** (AFTER UPDATE en `clients`,
  `WHEN (old.deleted_at IS NULL AND new.deleted_at IS NOT NULL)`, la misma transición que 0454). Es
  el patrón «trigger de dominio» de AUD-01 §4: cubre la RPC nueva, el UPDATE directo del código ya
  desplegado y `merge_clients` con una sola regla. `authenticated` puede hacer ese UPDATE por
  PostgREST, así que sólo un trigger impide que un caller omita el evento (AUD-01 §4). Si el evento
  falla, falla el UPDATE, y con él la revocación de 0454.
- **RPC `soft_delete_client_with_audit_reason(p_client_id uuid, p_reason text default null)`**,
  SECURITY INVOKER como las RPC `*_with_audit_reason` de 0294. PostgREST no deja fijar un GUC por
  petición, así que el motivo humano sólo llega por una RPC.
  - Valida el id y el motivo (4 a 1000 caracteres).
  - Fija `dtd.audit_reason` sólo para su transacción. Sin motivo lo vacía, para no heredar uno ajeno.
  - Borra por id sólo si el cliente vive y devuelve `found`. Después restaura el motivo previo.
  - Es INVOKER y no DEFINER: la RLS sigue siendo la frontera de tenant y no se amplía ningún
    permiso. Un cliente de otro tenant es invisible y la RPC devuelve `false`.
- Sin backfill. Los borrados históricos no tienen actor ni motivo reconstruibles y 0267 no inventa
  historia.

### Fusiones

- Si el mismo UPDATE fija `merged_into_client_id`, el evento es `client_merged`, con el motivo
  «Ficha retirada por fusión con otro cliente (merge_clients).» y la consecuencia `retired_by_merge`.
  Nunca es `client_deleted`.
- La condición exige que `merged_into_client_id` cambie en ese UPDATE. Una ficha ya fusionada,
  restaurada a mano y borrada por un operador es `client_deleted`.
- `merge_clients` no se redefine. El preflight exige, sobre el cuerpo vivo, que retire con un solo
  UPDATE de las dos columnas y que no ponga `deleted_at` aparte. Si no, la fusión quedaría auditada
  como borrado y la migración aborta.

### El evento

| Campo | Valor |
|---|---|
| `tenant_id` / `entity_type` / `entity_id` | Los del cliente (`client`) |
| `event_type` | `client_deleted` o `client_merged` |
| `actor_type` / `actor_id` | `user` y `auth.uid()`; `system` sin principal, como D5 |
| `before_data` / `after_data` | Sólo `deleted_at` y `merged_into_client_id` |
| `reason` | El motivo humano o el motivo por defecto de cada evento |
| `payload` | `permanence: P2`, `consequence`, `recovery: no_studio_restore`, `related_files: []` (forma del precedente P2 de SDD-0377) |
| `occurred_at` | Hora del servidor (la pone `append_audit_event`) |
| `correlation_id` | `d5:clients:<id>:<txid>`: la misma transacción que el evento D5 de revocación del Portal |
| `source` / `result` / `sensitivity` | `rpc` / `succeeded` / `restricted` |

Sin nombre, Shipping Mark, correo ni teléfono. El trigger no sabe si el UPDATE vino del Studio, por
eso no declara la fricción.

### Cero filas

La RPC devuelve `false` si el cliente ya estaba borrado, es de otro tenant o no existe. La acción
exige `data === true`. Cualquier otro valor devuelve «No se eliminó ningún cliente: ya estaba
eliminado, no existe o no tienes acceso a él. Recarga la lista.», sin revalidar.

### La migración

`supabase/migrations/0455_borrado_cliente_auditado.sql`:

1. `set lock_timeout = '5s'` y `set statement_timeout = '30s'` de sesión.
2. `do $preflight$` (`:70`), que falla cerrado con `P0001` y mensajes sin ids ni Shipping Marks.
   Exige:
   - los roles de la API;
   - `clients` con RLS y las columnas `id`, `tenant_id`, `deleted_at` y `merged_into_client_id`;
   - `append_audit_event` SECURITY DEFINER con `search_path` vacío y ejecutable por el rol que aplica
     (`:111`), que queda como dueño del trigger. Va antes de leer `audit_entity_types`;
   - el tipo de entidad `client` activo;
   - el trigger `clients_revoke_portal_on_soft_delete` de 0454 habilitado y con su definición exacta,
     porque la confirmación del Studio promete esa consecuencia;
   - `merge_clients(uuid,uuid)` SECURITY DEFINER que retira con un solo UPDATE (`:146`);
   - funciones y trigger con los nombres de la migración ausentes o con su forma final, sin otra
     firma de la RPC;
   - una huella md5 del catálogo dependiente, que el postflight exige intacta: triggers, policies,
     ACL y RLS de `clients` y `entity_audit_log`; los writers de auditoría, `merge_clients`, la
     revocación de 0454 y la función D5; y el estado del tipo `client`.
3. `clients_audit_soft_delete()` (`:231`): SECURITY DEFINER, volátil, `search_path` vacío, comentada
   y con `revoke all … from public, anon, authenticated, service_role`.
4. `soft_delete_client_with_audit_reason(uuid, text)` (`:284`): SECURITY INVOKER, `search_path`
   vacío, comentada, `revoke all` de los cuatro roles y `grant execute` sólo a `authenticated`
   (`:327-328`).
5. `do $triggers$` (`:330`): crea el trigger sólo si no existe; reaplicar conserva los oid.
6. `do $postflight$` (`:346`). Exige:
   - la forma final de las dos funciones;
   - el trigger sin EXECUTE para nadie más que su dueño, y ese dueño capaz de ejecutar el writer;
   - la RPC con una sola firma y EXECUTE sólo para `authenticated`, sin PUBLIC ni grants delegables;
   - el trigger habilitado con su definición completa;
   - la huella idéntica.
7. `reset statement_timeout` y `reset lock_timeout`.

### Locks y tiempos (PostgreSQL 17, fixture del contrato)

- **Primera aplicación, en su propia transacción.** Toma `ShareRowExclusiveLock` sobre `clients` por
  el `CREATE TRIGGER` hasta el COMMIT: bloquea escrituras, no lecturas. Sobre `audit_entity_types` y
  los catálogos sólo toma `AccessShareLock`. En total: 8 tablas y 13 índices. Suma de sentencias:
  18,8 ms.
- **Reaplicación.** No toma `ShareRowExclusiveLock`: 7 tablas y 13 índices, 19,6 ms.
- **Contención.** Otra sesión retenía un UPDATE sin confirmar sobre `clients`. La 0455 cortó a los
  5,4 s por `lock_timeout` en el bloque de triggers y se revirtió entera: 0 triggers y 0 funciones.
  Una sesión nueva quedó con `lock_timeout` 0. Mientras espera, hasta 5 s, también esperan las
  escrituras sobre `clients`: aplicar en baja actividad.
- **Límite.** Se midió sobre el fixture del contrato, no sobre el schema completo. `schema-rebuild`
  de `pnpm verify` comprueba que la migración aplica sobre todas las del repo.

### Frontera e impacto en la aplicación

- **Acción.** `softDeleteClientAction(clientId, reason = "")`:
  - Valida el permiso, el id (uuid) y el motivo recortado: vacío viaja como `NULL`; escrito, debe
    tener entre 4 y 1000 caracteres.
  - Llama a la RPC (`actions.ts:477`).
  - Un error de la base registra el mensaje crudo en el log del servidor y devuelve el mensaje de
    SDD-0467, que no promete un borrado a medias (`:483`).
  - `data !== true` es «cero filas» (`:485`). Sólo revalida con `true`.
- **Drawer.** El botón «Eliminar» del pie abre el `ConfirmDialog` canónico:
  - `danger`, título «Eliminar cliente», confirmación «Eliminar cliente» y motivo opcional con la
    etiqueta «Motivo (opcional, sin datos personales)».
  - Mensaje: «Vas a eliminar a {nombre} (Shipping Mark {DTD-XXXX}). Sale de las listas del Studio y
    pierde su acceso al Portal: se revocan su vínculo y sus códigos de acceso. Desde el Studio no se
    puede restaurar.» (`ClientDrawer.tsx:53-62`).
  - Un error queda dentro del diálogo y el reintento sigue disponible: el drawer limpia el error antes
    de cada intento. El éxito cierra el drawer y avisa por `toast.show` (AVS-01) «Cliente DTD-XXXX
    eliminado. Ya no aparece en las listas.».
  - La acción recibe `client.id`, no el Shipping Mark: un mismo Shipping Mark puede existir en otro
    tenant.
- **Compatibilidad y orden: migrate-first.**
  - Con 0455 aplicada, el código hoy desplegado (UPDATE directo) sigue funcionando y queda auditado
    con el motivo por defecto.
  - El código nuevo sin 0455 no borra: la RPC no existe y el Studio muestra «No se pudo confirmar el
    borrado…».
  - Por eso 0455 se aplica antes de desplegar esta PR. La degradación está declarada en
    `supabase/pending-migration-symbol-declarations.json`.

### Contrato de acción (BTN-01 §8)

| Campo | Valor |
|---|---|
| `actionKey` / `verb` | `client.soft_delete` / Eliminar |
| `outcome` | El cliente sale de las listas, pierde su acceso al Portal y queda `client_deleted` |
| `role` / `risk` | destructive / important |
| `permanence` / `friction` | P2 / R2 |
| `permission` | `clients` edit (`moduleEditDenial`) y RLS de tenant |
| `preconditions` | Cliente vivo del tenant; id uuid; motivo vacío o de 4 a 1000 caracteres |
| `buttonType` | `button` (abre el diálogo) y `submit` (confirma dentro del diálogo) |
| `idleLabel` / `loadingLabel` / `successLabel` | «Eliminar cliente» / «Procesando…» / «Cliente DTD-XXXX eliminado. Ya no aparece en las listas.» |
| `errorRecovery` | Error dentro del diálogo, reintento disponible y recargar la lista |
| `audit` | `{ required: true, eventKey: "client_deleted" }` |
| `correlationId` | `d5:clients:<id>:<txid>` en la base; el toast no lo muestra |
| `afterSuccess` | `close`, y el listado se revalida |
| `undo` | `{ available: false }`: no hay restauración |

## Evidencia

Todo sobre PostgreSQL 17 en Docker 29.7.2 y Vitest 4.1.7, con fixtures sintéticos y rollback. Cero
lecturas de producción.

### Contrato SQL con control rojo

`supabase/tests/0455_borrado_cliente_auditado.test.sql` corre con `node scripts/run-sql-tests.mjs`.

- **Migraciones reales que aplica:** 0006, 0080, 0081, 0230, 0360, 0361, la plataforma de auditoría
  0258, 0261, 0267 y 0294, y 0454.
- **Funciones extraídas del archivo real:** `get_user_tenant_id()` de 0453, `current_studio_role()`
  de 0200, `assert_tenant_match` de 0012, `assert_studio_role` de 0351 y la función D5 de 0293, con
  los triggers D5 de `clients` y `client_users`.

**85 aserciones.**

| Punto | Qué defiende |
|---|---|
| 1. RED | Sin 0455, el borrado del Studio por RLS no deja ningún evento sobre el cliente y la RPC no existe (NOTICE en `:403`) |
| 3. Drift (13 casos) | `merge_clients` que retira con dos UPDATE, ausente o sin SECURITY DEFINER; `merged_into_client_id` renombrada; `clients` sin RLS; tipo `client` deprecado; writer sin SECURITY DEFINER; trigger de 0454 ausente o deshabilitado; trigger ajeno con el nombre de la migración; RPC ajena SECURITY DEFINER o con otra firma; rol que aplica sin EXECUTE sobre el writer. Todos abortan con `P0001` en el preflight, con su mensaje, sin uuid ni Shipping Marks y con el catálogo intacto. Las formas de `merge_clients` de 0341 y 0358 pasan |
| 4. Aplicada | Timeouts restaurados; ni huella ni motivo en la sesión; sin filas ni eventos nuevos; policies, RLS, ACL, tipos de entidad, funciones y triggers existentes idénticos; forma final y ACL de las dos funciones; definición del trigger. Reaplicar deja catálogo y filas idénticos |
| 3c. Drift de reaplicación | Trigger propio con otro WHEN o deshabilitado; RPC SECURITY DEFINER; trigger SECURITY INVOKER: aborta con «ya existe … con otra forma» |
| 2. Estático | Timeouts antes del preflight; orden preflight → trigger → RPC → trigger → postflight → reset; una función DEFINER y una INVOKER con `search_path` vacío; `revoke` de los cuatro roles; un solo GRANT; sin INSERT, DELETE, ALTER, DROP, policies, tablas ni backfill; sobre el `prosrc` aplicado, la RPC fija el motivo, borra sólo un cliente vivo por id, devuelve `found` y restaura el motivo previo |
| Postflight (7 sondas) | Huella distinta; trigger con otra condición; RPC ejecutable por `anon`; RPC SECURITY DEFINER; trigger ejecutable por `authenticated`; dueño del trigger sin EXECUTE sobre el writer; tipo `client` deprecado |
| 5. Comportamiento | UPDATE directo del código desplegado auditado con el operador y el motivo por defecto (`:702`). RPC con motivo: un solo `client_deleted` con tenant, entidad, actor, motivo recortado, antes y después exactos, payload, fuente, sensibilidad y correlación de la transacción de la revocación; sin nombre, Shipping Mark, correo ni teléfono (`:745`); revocación del Portal en la misma transacción con el motivo humano; motivo fuera de la transacción. Sin motivo y en blanco: motivo por defecto, sin heredar ni pisar un motivo previo del caller. Cero filas (ya borrado, inexistente, otro tenant): `false` y ningún evento (`:785`). Mismo Shipping Mark en otro tenant: B borra lo suyo. Motivo de 3 y de 1001 caracteres, id nulo y motivo inválido sobre un cliente ya borrado: `22023`; `anon` y `service_role`: `42501` (`:810`). Límites 4 y 1000 aceptados. Fusión: un `client_merged` con operador, superviviente y motivo propio, ningún `client_deleted` (`:831`); ficha ya fusionada borrada después: `client_deleted`. Fallo atómico (`:856`): con el writer roto, por la RPC y por el UPDATE directo, el cliente sigue vivo con su vínculo y su código, y no queda ningún evento; con el tipo `client` inactivo, `23503` y sin borrado. Restaurar no escribe `client_deleted` y volver a borrar escribe otro (`:903`). Mover `deleted_at` de un borrado no escribe nada. Totales: 10 borrados y 1 fusión, todos con motivo y sensibilidad restringida |

### Control rojo y mutantes

- **Control rojo** (`-v apply_fix=false`): falla en la primera aserción de comportamiento, «El
  UPDATE directo del código desplegado deja exactamente un evento client_deleted».
- **Mutantes de la migración, serie 1.**
  - **Método:** 23 mutantes sobre una copia de `supabase/`, restaurando el original y verificándolo
    por sha256 después de cada uno. Los dos controles con el original salieron en verde.
  - **Resultado:** 23 de 23 muertos:
    - WHEN sin `old`;
    - fusión etiquetada como borrado;
    - `v_merge` sin comparar con `old`;
    - actor siempre `system`;
    - antes con `new`;
    - payload sin permanencia;
    - RPC sin filtro `deleted_at`, que devuelve siempre `true`, que hereda o no restaura el motivo,
      sin validar motivo o id, SECURITY DEFINER o ejecutable por `anon`;
    - trigger con `search_path = public` o sin `revoke`;
    - preflight sin los chequeos de `merge_clients`, tipo `client`, trigger de 0454 o EXECUTE del
      writer;
    - postflight sin huella;
    - sin `lock_timeout`;
    - evento tragado con `exception when others`.
- **Muertes revisadas por su causa.**
  - «Evento tragado» murió en la serie 1 por un error de sintaxis del corredor. `String.replace`
    convertía `$$` en `$`, la misma trampa registrada en SDD-0467. Se repitió con reemplazo por
    `split`/`join` y murió en «Con el writer roto la RPC falla».
  - Cuatro mutantes de la RPC (sin filtro, `true` siempre, hereda y no restaura el motivo) murieron en
    la aserción estática del `prosrc`. Se repitieron con esa aserción neutralizada en una copia del
    test y murieron también por comportamiento: «Un cliente ya borrado: false…» (los dos primeros),
    «…no hereda el motivo previo y lo restaura…» y «El motivo no queda en la transacción…». Los
    controles de esa serie también salieron en verde.
  - «Preflight sin EXECUTE del writer» muere porque el contrato exige el aborto con su mensaje en el
    preflight y recibe un `42501` posterior al leer `audit_entity_types`. Es el mismo criterio que
    SDD-0467 aceptó para su chequeo de dueño.
- **Mutantes de la acción y del drawer:** 16 de 16 muertos contra sus tests, con los controles en
  verde:
  - la acción: sólo `false` como cero filas; motivo vacío como texto; sin validar id; mensaje genérico
    de motivo corto; revalidar aunque no borró; permiso después de validar;
  - el drawer: reintento sin limpiar el error; el error cierra el diálogo; ignora el motivo; borra por
    Shipping Mark; no destructivo; sin campo de motivo; promete restauración; sin la consecuencia del
    Portal; la excepción cierra; sin `pending`.

### Aplicación y gates

- `vitest`, 29 tests.
  - `app/studio/(app)/clientes/__tests__/soft-delete-client.test.ts` (20):
    - RPC por id con el motivo recortado;
    - motivo vacío, en espacios, con saltos u omitido como `NULL`;
    - `false`, `null`, `"true"`, `1` y `undefined` nunca son `ok`;
    - error de la base sin revalidar y sin prometer un borrado;
    - motivos de 1 a 3 y de 1001 caracteres, y los límites 4 y 1000;
    - ids que no son uuid, incluido un Shipping Mark;
    - permiso antes que cualquier validación;
    - nunca escribe `clients` directo.
  - `app/studio/(app)/clientes/_components/ClientDrawer.confirm-delete.test.tsx` (9):
    - el diálogo nombra al cliente (nombre con signos), su Shipping Mark y la consecuencia, sin
      mostrar el id;
    - no promete restauración, con tuteo y sin voseo;
    - foco inicial en Cancelar, confirmación roja y motivo no obligatorio;
    - cancelar no borra;
    - con motivo y sin motivo;
    - cero filas deja el error en el diálogo y el reintento con el mismo error sigue vivo;
    - una excepción no cierra;
    - `pending` bloquea la doble ejecución y la cancelación.
- `node scripts/check-pending-migration-symbols.mjs`: 0 ROJO · 1 AMARILLO declarado
  (`soft_delete_client_with_audit_reason` → `actions.ts:477`, evidencia `:483`).
- `node scripts/check-numbering.mjs`: sin números repetidos.
- Contratos SQL vecinos, `pnpm verify` y los checks de docs y gobernanza: resultado por paso en el
  handoff.

## Datos personales (`revisar-datos-ve`)

No es asesoría legal.

- **ENCONTRADO en main; esta SDD lo corrige.** El borrado lógico de la ficha de una persona natural
  o empresa (`clients`) no dejaba constancia de quién lo hizo, cuándo ni por qué
  (`app/studio/(app)/clientes/actions.ts:438-441` en main; el único trigger de auditoría de `clients`
  sólo mira contacto, `0293_audit_d5_residual_and_writer_retirement.sql:517`). Sin esa traza no se
  puede responder con evidencia sobre el uso que se hizo del registro de la persona. Referencia: CRBV
  art. 28, «conocer el uso» de los datos «y su finalidad», según
  `.claude/skills/revisar-datos-ve/references/marco-legal-ve.md:33-41`.
- **CORRECTO, en local.**
  - El evento no copia datos personales. Antes y después sólo llevan `deleted_at` y
    `merged_into_client_id` (`0455_borrado_cliente_auditado.sql:258-261`), el payload es constante
    (`:262-267`) y la correlación usa uuid y txid (`:270`).
  - El contrato lo exige: sin nombre, Shipping Mark, correo ni teléfono
    (`supabase/tests/0455_borrado_cliente_auditado.test.sql:745`).
  - Los mensajes del preflight y del postflight llevan reglas, nunca ids ni Shipping Marks. El drift
    lo verifica.
  - Lo mide el contrato en PostgreSQL efímero con datos sintéticos. En producción sigue abierto hasta
    aplicar 0455.
- **ENCONTRADO, mitigado en parte.** El motivo es texto libre del operador, de hasta 1000 caracteres,
  y queda en `entity_audit_log.reason` con sensibilidad `restricted` (`0455:272`). Un operador podría
  escribir datos personales. Mitigación: la etiqueta «Motivo (opcional, sin datos personales)»
  (`ClientDrawer.tsx:55`) y el límite de longitud. La base no lo comprueba.
- **CORRECTO.** No agrega columnas, tablas, buckets ni tratamientos. No borra ni mueve datos: los
  archivos de la ficha (foto del documento, avatar, fachada) se conservan sin cambios.
- **ENCONTRADO, fuera de alcance.**
  - `authenticated` conserva DELETE sobre `clients` (`0006_clients.sql:63`) y la policy «clients by
    tenant» es FOR ALL (`0012_rls_perf_and_rpc_guards.sql:248-251`). Un miembro del tenant puede
    borrar físicamente una ficha por PostgREST, sin evento y arrastrando por cascada las tablas de §3.A
    del mapa de borrado. Ningún código del repo lo hace; la búsqueda de `.from("clients").delete(` no
    da resultados.
  - La retención de los datos del vínculo revocado sigue 🔴 SIN FUNDAMENTO en el mapa §10: es la
    siguiente tarea.
- **NO VERIFICABLE:**
  - el estado en producción hasta aplicar 0455;
  - si algún proceso fuera del repo pone `clients.deleted_at` con `service_role`; sus eventos saldrían
    con actor `system`;
  - que los operadores escriban el motivo sin datos personales.

## Gobernanza

Políticas abiertas desde `docs/governance/AGENT-BRIEF.md` para «acción, borrado, permanencia,
auditoría» y «componente»: SGE-00, MP-01, BTN-01, AUD-01, AUD-02 y CMP-01.

| Principio / política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.01 predecible · BTN-01 vocabulario | cumplimiento | «Eliminar» aplica al resultado P2 autorizado por MP-01 (BTN-01 §3); la confirmación usa verbo y objeto: «Eliminar cliente» |
| SGE-00.02 pérdida de trabajo | cumplimiento | Un error deja el diálogo abierto con el motivo escrito; test «si no se borró ninguna fila, el error queda en el diálogo…» |
| SGE-00.03 riesgo y fricción | cumplimiento | Clasificación MP-01 P2/R2, consecuencia visible, permiso en servidor y confirmación proporcional; sin campo obligatorio nuevo |
| SGE-00.04 auditoría · AUD-01 | cumplimiento | §1 y §4: trigger de dominio en la misma transacción; §8: fallo forzado del writer revierte borrado y revocación. §2: «eliminar». §3: tenant y actor del contexto, antes/después, motivo, hora del servidor, correlación, fuente y resultado. §6: permanencia, consecuencia, motivo, recuperación y archivos en el payload. Límite: `source` es siempre `rpc` |
| SGE-00.05 permisos y tenant | cumplimiento en esta frontera; no conformidad preexistente en la base | `moduleEditDenial` antes de validar (vitest) y RLS de tenant (contrato: otro tenant devuelve `false`). La RPC es INVOKER y no amplía nada. La base no aplica la matriz de roles a UPDATE ni DELETE de `clients` (`0006_clients.sql:63`): hallazgo previo, fuera de alcance |
| SGE-00.06 prevenir errores | cumplimiento | Id y motivo se validan antes de la base; preflight que falla cerrado |
| SGE-00.07 estado verdadero | cumplimiento | Sólo `data === true` es éxito; «cero filas» es error; `pending` bloquea la doble ejecución; el toast llega después del resultado |
| SGE-00.08 pasos | cumplimiento | Los mismos dos pasos (Eliminar → confirmar); el motivo es opcional |
| SGE-00.09 patrón · CMP-01 | cumplimiento | Reusa `ConfirmDialog` (`canonical`, `docs/governance/components/confirm-dialog.json`), el patrón `*_with_audit_reason` de 0294 y el writer de 0267. Sin primitivas nuevas |
| SGE-00.10 accesibilidad | cumplimiento del componente; verificación visual NO EJECUTADA | Foco inicial en Cancelar (test), Escape y trampa de foco de la capa superior (`useDialogA11y`) y etiqueta del motivo. `/ui-check` no se pudo correr en esta sesión: lo corre el Director |
| SGE-00.11 lenguaje | cumplimiento | Consecuencia explícita, sin prometer restauración, errores con recuperación, tuteo sin voseo (tests) |
| SGE-00.12 IA | no aplica | Sin IA |
| MP-01 | cumplimiento R2; no conformidad preexistente de permanencia | Diálogo con nombre y consecuencia (`mp-01.md:39`). MP-01 pide P1 con restauración para maestros (`mp-01.md:69`) y P2 exige política de restauración (§2, MP-D2). El borrado es P2 sin camino de restauración; la UI de restauración está excluida de este encargo y queda como deuda |
| BTN-01 | cumplimiento | Contrato de acción en Diseño; diálogo destructivo con foco en Cancelar; «Procesando…» es un label de carga admitido (§5) |
| AUD-02 | no aplica | No cambia quién consulta, conserva ni exporta eventos |
| CMP-01 | cumplimiento | Consumidor nuevo de un `canonical`, sin variante. El registro no exige listar consumidores y `components:check` no los valida |

## Allowlist exacta

- `supabase/migrations/0455_borrado_cliente_auditado.sql`
- `supabase/tests/0455_borrado_cliente_auditado.test.sql`
- `supabase/migrations-baseline.json` (únicamente la espera `0455_borrado_cliente_auditado` en
  `pendingBelowCutoff`, sin subir el `cutoff` 238 ni tocar las otras esperas)
- `supabase/pending-migration-symbol-declarations.json` (únicamente la degradación
  `sdd-0469-borrado-cliente-auditado`)
- `app/studio/(app)/clientes/actions.ts` (sólo `softDeleteClientAction`, sus mensajes y el import de
  `validateAuditReason`)
- `app/studio/(app)/clientes/_components/ClientDrawer.tsx` (sólo el borrado: textos, estado y
  `ConfirmDialog`)
- `app/studio/(app)/clientes/__tests__/soft-delete-client.test.ts`
- `app/studio/(app)/clientes/_components/ClientDrawer.confirm-delete.test.tsx`
- `docs/legal/privacidad/mapa-de-borrado.md` (§10)
- `docs/specs/0469-borrado-cliente-auditado/spec.md`
- `docs/specs/README.md`: generado por `node scripts/build-docs-index.mjs`
- `.agents/handoffs/borrado-cliente-auditado.md`

## Aceptación

- [x] 1. Borrar desde el Studio abre un `ConfirmDialog` danger con el nombre, el Shipping Mark y la
      consecuencia: sale de las listas y pierde su acceso al Portal. No promete restauración, que no
      existe. El motivo es opcional (AUD-01 §3 y MP-01 R2) y, sin él, el evento lleva «Cliente
      eliminado sin motivo indicado (SDD-0469).».
- [x] 2. Borrado y evento son atómicos (0455): si el evento no se escribe, el cliente no queda
      borrado ni su acceso revocado, por la RPC y por el UPDATE directo (contrato, «fallo atómico»).
- [x] 3. El evento registra actor, tenant, entidad, antes y después, hora del servidor y motivo, sin
      datos personales. Las fusiones escriben `client_merged`, nunca `client_deleted`.
- [x] 4. La acción devuelve un error claro cuando no borró ninguna fila (ya borrado, de otro tenant o
      inexistente), nunca un `ok` falso (contrato y vitest).
- [x] 5. 0455 con preflight y postflight en el estilo de 0454, `search_path` vacío, grants mínimos,
      espera en el baseline y contrato SQL con control rojo y mutantes.
- [x] 6. Tests de vitest de la acción y del diálogo con casos de fallo, cero filas, reintento y
      doble ejecución; mutantes muertos.
- [x] 7. Allowlist exacta, matriz de gobernanza, revisión `revisar-datos-ve` y mapa de borrado §10.
- [ ] 8. `/ui-check` del diálogo: NO EJECUTADO en esta sesión; lo corre el Director.

## Producción

`0455_borrado_cliente_auditado` **quedó aplicada a producción el 2026-09-15** por el Director, con OK
nominal de Sam («autorizo aplicar 0455_borrado_cliente_auditado»), en orden migrate-first: aplicada a
las 18:34:59 UTC y PR #122 fusionada a las 18:35:53 UTC (`42f80bea`). Registro completo en
`.agents/handoffs/0455-aplicacion-prod-20260915.md`.

- **Ledger:** `20260915183459`, name exacto, 1 sentencia, md5 `a4b7398aac442b5279fc2b35930011fc` y
  23.394 bytes, iguales al blob revisado en `4ea05e47`, que es el mismo de `main`.
- **Lectura previa, repetida justo antes e idéntica:** PostgreSQL 17.6; `postgres` con BYPASSRLS y
  dueño de `clients`, sin FORCE; `append_audit_event` con la firma exacta, SECURITY DEFINER, `search_path`
  vacío y ejecutable por el rol que aplica; tipo `client` activo; el trigger de 0454 con su definición;
  `merge_clients` con un solo UPDATE de retiro; nada de 0455 presente.
- **Postflight de catálogo:** `clients_audit_soft_delete()` SECURITY DEFINER, volátil, con `search_path`
  vacío y ACL solo del dueño; la RPC SECURITY INVOKER, `boolean`, con `search_path` vacío y EXECUTE solo
  para `authenticated`; el trigger habilitado con su definición; sin cambios en los otros 7 triggers,
  las policies y la ACL de `clients`, `append_audit_event`, `merge_clients` ni las funciones de 0454.
- **Advisors de seguridad:** idénticos antes y después, excluido `observed_at`.
- **Espera y declaración de símbolos:** retiradas en la PR del registro de la aplicación.

Lo que sigue es la guía con la que se aplicó.

- Aplicar `0455_borrado_cliente_auditado` exige el OK nominal de Sam y
  `docs/runbooks/aplicar-migraciones-prod.md`: de a una y con el name exacto.
- **Orden: migrate-first.** Aplicar 0455 antes de desplegar esta PR.
  - Con 0455 aplicada y el código actual desplegado, el Studio sigue borrando igual y cada borrado
    queda auditado con el motivo por defecto.
  - Si se desplegara el código sin 0455, borrar clientes quedaría no disponible: error, sin borrado a
    medias.
- **Lectura previa recomendada, sólo catálogo y sin filas:**
  - `prosecdef`, `proconfig` y dueño de `append_audit_event`, y `has_function_privilege` del rol que
    va a aplicar;
  - el estado del tipo `client` en `audit_entity_types`;
  - `pg_get_triggerdef` de `clients_revoke_portal_on_soft_delete`;
  - el cuerpo normalizado de `merge_clients`: un solo UPDATE de `merged_into_client_id` y
    `deleted_at`;
  - los triggers de `clients` y cualquier función o trigger con los nombres de 0455.

  Si algo difiere de lo que exige el preflight, la migración aborta sin cambiar nada.
- Aplicar en baja actividad de clientes por el `ShareRowExclusiveLock` de hasta 5 s. Si corta por
  `lock_timeout`, reintentar.
- **Postflight en producción recomendado, sólo catálogo:**
  - las dos funciones con su forma y su ACL: la RPC sólo con EXECUTE para `authenticated` y el
    trigger sin EXECUTE para roles de la API;
  - el trigger habilitado con su definición;
  - los advisors de seguridad antes y después.
- Después de aplicar: retirar la espera del baseline y la declaración de
  `pending-migration-symbol-declarations.json`.
- Pendiente de Sam tras desplegar: smoke de borrar un cliente de prueba con y sin motivo, y comprobar
  en Administración › Auditoría el evento `client_deleted` con su operador.
