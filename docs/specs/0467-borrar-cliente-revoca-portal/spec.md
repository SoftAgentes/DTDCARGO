---
sdd: "0467"
title: "Borrar un cliente revoca su acceso al Portal"
status: in-progress
author: "Claude"
created: 2026-09-14
updated: 2026-09-15
supersedes: null
superseded_by: null
related: ["0010", "0042", "0246", "0253", "0466"]
confidencialidad: interno
---

# SDD-0467 · Borrar un cliente revoca su acceso al Portal

> Decisión de Sam del 2026-09-14, textual: «borrar un cliente: debe revocar el acceso. Así debe
> ser.» La migración `0454_borrar_cliente_revoca_portal` hace que todo borrado lógico de un
> cliente (Studio › Clientes › Eliminar, o la ficha retirada por `merge_clients`) revoque en la
> misma transacción su vínculo en `client_users` y todos sus códigos cortos de
> `portal_access_links`. La base rechaza además cualquier acceso vigente sobre un cliente borrado.
> El Studio avisa la consecuencia antes de confirmar.

## Contexto

- **Borrado del Studio.** `softDeleteClientAction` (`app/studio/(app)/clientes/actions.ts:412-431`
  en main) valida `moduleEditDenial(…, "clients")` y sólo pone `clients.deleted_at` por RLS. No
  toca `client_users` ni `portal_access_links`. La llama la confirmación inline de
  `ClientDrawer.tsx:791`.
- **Fusión.** `merge_clients` (última forma: `supabase/migrations/0361_merge_clients_conserva_kommo_contact.sql`)
  también retira la ficha fusionada. Si el superviviente no tiene acceso, le muda la fila de
  `client_users` (0361:128-133). Si ya lo tiene, marca la del duplicado sólo con
  `status = 'revoked'` (0361:123-127): sin `revoked_at`, con `auth_user_id` y con `token`.
  Después pone `deleted_at` en la ficha fusionada (0361:233-236). Con
  `unique (auth_user_id)` (`0080_portal_cliente.sql:30`), esa persona no puede vincularse a otra
  ficha.
- **RPC del Portal.** `portal_revoke_client` (0080:184-202) valida el tenant con
  `get_user_tenant_id()` y deja `status = 'revoked'`, `revoked_at`, `auth_user_id` y `token` en
  NULL: es la forma completa de una revocación. `portal_bind_session()` (0080:148-181) activa
  una fila `invited` por email y reconoce las `active` por `auth_user_id`, sin mirar
  `clients.deleted_at`. `portal_invite_client` (0080:106-110) y `portal_create_access_link`
  (`0360_portal_access_links.sql:103-109`) sí rechazan un cliente borrado.
- **La app ya cierra la puerta.** El Portal rechaza al principal cuyo cliente está borrado
  (`lib/portal/portal-queries.ts:89-95`, `app/portal/(app)/layout.tsx:39-40`). El canje del
  código corto también: `abrirPortalAction` (`app/entrar/[code]/actions.ts:52-53`) y la página
  (`app/entrar/[code]/page.tsx:71`) cargan el cliente con `loadAccessTarget`, que filtra
  `deleted_at is null` (`lib/studio/portal/access-link.ts:229-242`). Por eso
  `access-link.ts` no cambia. El hueco está en los datos y en las RPC: un vínculo activo con
  identidad y un código abierto sobreviven al borrado, y restaurar la ficha los reactivaría.
- **Triggers sobre `clients` en el repo:** `clients_touch` (0006), `clients_advisor_same_tenant`
  (0151), `clients_guard_markbox_aliado_t` y `clients_guard_no_merge_aliado_t` (0362),
  `audit_d5_clients_contact` (0293) y `clients_profile_edits_follow_merge` (0446). Ninguno toca
  el acceso al Portal. Sobre `client_users` existen `client_users_touch` (0080) y
  `audit_d5_client_users` (0293, `after insert or update of status`).
- **Restauración.** No hay en el repo ningún camino que vuelva a poner `clients.deleted_at` en
  NULL (búsqueda en `app/`, `lib/`, `supabase/migrations/`, `supabase/functions/` y `scripts/`).
  Aun así la regla cubre el caso: restaurar no devuelve el acceso.
- **Producción, conteo agregado del 2026-09-14** (autorizado para SDD-0466, sin ids ni datos):
  1 vínculo `client_users` activo cuyo cliente está borrado. No se leyó ni se tocó.

## Alcance

- Migración `supabase/migrations/0454_borrar_cliente_revoca_portal.sql` y su contrato
  `supabase/tests/0454_borrar_cliente_revoca_portal.test.sql`.
- `supabase/migrations-baseline.json`: únicamente la espera `0454_borrar_cliente_revoca_portal`
  en `pendingBelowCutoff`, sin subir el `cutoff` 238 ni tocar las otras esperas.
- `app/studio/(app)/clientes/actions.ts` (sólo `softDeleteClientAction` y su mensaje de error),
  el texto de la confirmación de `ClientDrawer.tsx` y sus tests.
- `docs/legal/privacidad/mapa-de-borrado.md` (§10), esta spec, el índice generado y el handoff.
- Fuera de alcance:
  - `lib/studio/portal/access-link.ts`: el canje ya rechaza clientes borrados (ver Contexto);
  - redefinir `merge_clients`, `portal_bind_session` o cualquier otra RPC: el trigger cubre el
    contrato sin cambiarlas;
  - aplicar en producción o revocar a mano el vínculo huérfano;
  - 0414, 0415, 0422, 0423 y sus esperas; los archivos de la PR #114 y del rediseño del enlace
    del proveedor (SDD-0468); las helpers con `limit 1` y las lecturas por Shipping Mark.

## Diseño

### La regla

**Ningún acceso al Portal queda vigente sobre un cliente borrado.**

| Pieza | Qué hace |
|---|---|
| `clients_revoke_portal_on_soft_delete` (AFTER UPDATE en `clients`, `WHEN old.deleted_at IS NULL AND new.deleted_at IS NOT NULL`) → `clients_revoke_portal_access()` | En la misma transacción: toda fila `client_users` del cliente queda `revoked`, con `revoked_at = coalesce(revoked_at, now())`, `auth_user_id` y `token` en NULL; todo `portal_access_links` del cliente queda con `revoked_at`, usado o no. Si falla, falla el UPDATE y el cliente no se borra |
| `client_users_require_live_client` (BEFORE INSERT OR UPDATE OF status, client_id, `WHEN new.status IN ('invited','active')`) → `portal_access_require_live_client()` | El cliente tiene que existir y vivir; si no, `23514` |
| `portal_access_links_require_live_client` (BEFORE INSERT OR UPDATE OF revoked_at, client_id, `WHEN new.revoked_at IS NULL`) → la misma función | Igual para los códigos cortos |
| Backfill idempotente | Revoca los vínculos y los códigos de los clientes que ya estaban borrados, con conteos agregados en un NOTICE |

### Por qué un trigger y no la acción

- «Cualquier borrado lógico» incluye la acción del Studio, `merge_clients` y un UPDATE directo
  por PostgREST: `authenticated` tiene UPDATE sobre `clients` (0006:63) y «clients by tenant» lo
  permite. Sólo un trigger cubre los tres caminos con una sola regla.
- AUD-01 admite el trigger de dominio para transiciones simples y uniformes, siempre que capture
  actor y contexto confiables. `auth.uid()` es el del operador que borra, también dentro de
  `merge_clients`.
- La acción del Studio no necesita otra llamada. El UPDATE que ya hace es el acto que revoca.

### `merge_clients` conserva su contrato sin redefinirse

`merge_clients` muda o revoca el acceso **antes** de poner `deleted_at`:

- **Acceso mudado:** la fila ya apunta al superviviente cuando dispara el trigger. El trigger no
  la ve y el acceso sigue activo con la misma identidad. La ficha retirada queda sin vínculos y
  sus códigos se revocan.
- **Superviviente con acceso:** `merge_clients` pone `status = 'revoked'` y el trigger completa
  `revoked_at` y vacía `auth_user_id` y `token`. La persona queda libre para vincularse a otra
  ficha. El superviviente y sus códigos no se tocan.

El preflight exige ese orden sobre el cuerpo vivo, sin fijar el cuerpo entero: acepta las formas
de 0341, 0358 y 0361 y aborta si la ficha se retira antes de mudar o revocar.

### Restaurar no devuelve el acceso

La revocación borra la identidad (`auth_user_id`) y el token, y deja la fila `revoked`.
`portal_bind_session()` sólo activa filas `invited` y sólo reconoce filas `active`, así que, con
la ficha restaurada, la sesión del antiguo titular no se vincula. `portal_invite_client` sobre la
ficha viva vuelve a dejar la fila `invited` con token nuevo. Hace falta esa invitación nueva.

### Concurrencia

- **Reinvitación o activación en curso contra borrado.** La revocación actualiza **todas** las
  filas del cliente sin filtrar por estado: queda esperando la fila que la otra sesión modifica y,
  al re-evaluar en READ COMMITTED, también la revoca. Si la reactivación llega después del
  borrado, la guarda la rechaza.
- **Fila nueva o mudada contra borrado.** La revocación concurrente no la ve. La guarda toma
  `FOR SHARE` sobre el cliente en INSERT o cambio de `client_id`: espera al borrado y, al
  confirmarse, ya no encuentra al cliente vivo y rechaza con `23514`.
- **Por qué la guarda no bloquea en los UPDATE del mismo cliente.** Ahí la otra sesión ya tiene
  la fila de `client_users` (la bloquea el trigger BEFORE) y el borrado ya tiene la de `clients`:
  pedir `FOR SHARE` invertiría el orden de locks y abriría un interbloqueo. La revocación sin
  filtro cubre ese caso.

### Auditoría D5

`audit_d5_client_users` (0293) ya registra `portal_access_status_changed` con `before`/`after`
de status, tenant y actor (`user` con principal, `system` sin él). Mientras revoca, el trigger
fija `dtd.audit_reason` si el caller no trae uno: «Cliente borrado: acceso al Portal revocado
(SDD-0467).». Al terminar restaura el valor previo, así que no contamina otros eventos de la
transacción. El backfill hace lo mismo con «Migración 0454: cliente ya borrado, acceso al Portal
revocado (SDD-0467).». Una fila ya `revoked` que sólo pierde identidad o token no cambia de
status y no emite evento. Si el catálogo de auditoría rechazara el evento, la revocación fallaría
y con ella el borrado (AUD-01 §1). Por eso el preflight exige `portal_invitation` activo cuando el
trigger D5 existe.

### La migración

`supabase/migrations/0454_borrar_cliente_revoca_portal.sql`:

1. `set lock_timeout = '5s'` y `set statement_timeout = '30s'` de sesión.
2. `do $preflight$`, que falla cerrado con `P0001` y mensajes sin ids ni Shipping Marks. Exige:
   - roles `authenticated`, `anon` y `service_role`;
   - RLS y columnas de `clients`, `client_users` y `portal_access_links`, y el CHECK de status de
     0080 exacto;
   - **RLS del dueño (ronda 2).** Las dos funciones SECURITY DEFINER quedan con dueño
     `current_user`, y la revocación, las guardas y el backfill corren como ese rol. Tiene que
     saltarse la RLS de las tres tablas: superusuario, `BYPASSRLS` o dueño (por membresía, como
     evalúa PostgreSQL). Ninguna de las tres puede tener `FORCE ROW LEVEL SECURITY`; FORCE aborta
     aunque el rol tenga BYPASSRLS, por conservadurismo. Si no se cumple, aborta con «0454
     abortada: public.… tiene FORCE ROW LEVEL SECURITY…» o «…el rol que aplica no es dueño de
     public.… ni tiene BYPASSRLS…». Sin este chequeo, la revocación y el backfill actualizarían 0
     filas sin error, y los conteos del postflight también pasarían por la RLS. Va antes del
     chequeo D5, que ya necesita leer `audit_entity_types`;
   - `merge_clients(uuid,uuid)` SECURITY DEFINER que revoca y muda antes de retirar;
   - `portal_bind_session()` con la forma de 0080 (activa sólo `invited`, reconoce sólo
     `active`);
   - `portal_invitation` activo si `audit_d5_client_users` está vivo;
   - triggers con los nombres de la migración ausentes o con su forma final **completa** (ronda 2):
     habilitados, con su función y con `pg_get_triggerdef` normalizado en espacios idéntico a la
     constante (evento, momento, columnas y WHEN). Se quita el esquema de la función porque su
     calificación depende del `search_path` de la sesión. En la ronda 1 sólo se comparaban
     `tgtype`, `tgfoid` y `tgattr`: un trigger con el mismo nombre y otro WHEN u otras columnas
     pasaba. El `coalesce` evita que, antes de la primera aplicación, un NULL de
     `to_regprocedure()` deje pasar uno ajeno.

   Además guarda en un GUC de sesión una huella md5 del catálogo dependiente: triggers ajenos,
   policies, RLS y ACL de las tres tablas, y oid, cuerpo, ACL, `proconfig` y `SECURITY DEFINER`
   de `merge_clients` y de las RPC del Portal.
3. Dos `create or replace function` SECURITY DEFINER, volátiles, con `search_path = ''`, nombres
   calificados, comentario y `revoke all … from public, anon, authenticated, service_role`.
4. `do $triggers$`: crea cada trigger sólo si no existe, así la reaplicación conserva los oid.
5. `do $backfill$`, idempotente.
6. `do $postflight$`. Exige:
   - la forma final de las dos funciones, sin EXECUTE para roles de la API;
   - **(ronda 2)** que su dueño (`proowner`) evite la RLS de las tres tablas: superusuario,
     BYPASSRLS o dueño, y ninguna con FORCE;
   - los tres triggers habilitados, con su función y con la definición completa normalizada
     **(ronda 2)**;
   - la huella idéntica;
   - **cero** vínculos o códigos vigentes sobre clientes borrados, en conteos agregados.
7. `reset statement_timeout` y `reset lock_timeout`.

Reaplicada no crea ni cambia nada: mismo catálogo, mismas filas y ningún evento nuevo.

### Locks y tiempos (PostgreSQL 17, fixture del contrato)

- **Primera aplicación, en su propia transacción.** Retiene hasta el COMMIT:
  - `ShareRowExclusiveLock` sobre `clients`, `client_users` y `portal_access_links`, por los
    `CREATE TRIGGER`: bloquea escrituras, no lecturas;
  - `RowExclusiveLock` sobre `client_users`, `portal_access_links` y `entity_audit_log`, por el
    backfill y sus eventos;
  - `RowShareLock` por el `FOR UPDATE` del backfill y las FK del evento;
  - `AccessShareLock` sobre las tablas que lee: 11 tablas y 34 índices en el fixture.

  Suma de sentencias: 27,4 ms.
- **Reaplicación.** No toma `ShareRowExclusiveLock`: sólo `AccessShareLock`, más
  `RowExclusiveLock` y `RowShareLock` del backfill vacío. Suma de sentencias: de 14,5 a 17,7 ms.
- **Contención.** Otra sesión retenía un UPDATE sin confirmar sobre `clients`. La 0454 cortó a
  los 5,3 s por `lock_timeout` en el primer `CREATE TRIGGER`, se revirtió entera (cero triggers,
  cero funciones, vínculos intactos) y una sesión nueva quedó con `lock_timeout` 0. Mientras
  espera, hasta 5 s, también esperan las escrituras sobre esas tablas: aplicar en baja actividad.
- **Límite de la medición.** Se midió sobre el fixture del contrato, no sobre el schema
  completo. En producción la huella deparsa más policies de esas tres tablas y puede tomar
  `AccessShareLock` sobre más tablas; ninguno bloquea lecturas ni escrituras. La reconstrucción
  completa del schema (`schema-rebuild` de `pnpm verify`) comprueba que la migración aplica sobre
  todas las migraciones del repo.

### Frontera e impacto en la aplicación

- `softDeleteClientAction` hace el mismo UPDATE. Si recibe un error, registra el mensaje crudo en
  el log del servidor y devuelve «No se pudo confirmar el borrado. Recarga la lista: si el cliente
  sigue ahí, conserva su acceso al Portal y puedes intentarlo de nuevo.». No revalida. El drawer
  muestra ese error y no se cierra.
  - El mensaje no afirma que no se borró nada, a propósito (ronda 2). Si la base rechaza el
    UPDATE, incluida una revocación que falla, borrado y revocación no ocurren. Pero un fallo de
    red después del COMMIT también llega como error, y ahí el borrado sí ocurrió.
  - En los dos casos la lista recargada dice la verdad, porque borrado y revocación son atómicos.
- La confirmación inline del drawer dice «¿Seguro? El cliente pierde su acceso al Portal.».
  Mismos botones, mismo flujo y sin cambio visual sustancial: `/ui-check` no aplica.
- La acción anterior, todavía desplegada, funciona igual con la 0454 aplicada: el trigger no
  depende del código. Si la 0454 se aplica antes que la app, el operador ve el mensaje crudo en
  un error, como hasta hoy.
- Portal: el principal de un cliente borrado ya no entraba. Ahora además no conserva vínculo ni
  códigos: su fila queda `revoked`, un estado que las lecturas del Studio ya tipan
  (`lib/studio/client-queries.ts:235`). No se verificó cómo lo pinta cada tarjeta.

## Evidencia

Todo sobre PostgreSQL 17 en Docker 29.7.2, con fixtures sintéticos y rollback. Cero lecturas de
producción.

### Contrato SQL con control rojo

`supabase/tests/0454_borrar_cliente_revoca_portal.test.sql` corre como
`scripts/run-sql-tests.mjs`.
- **Migraciones reales que aplica:** 0006, 0080, 0081, 0230, 0360, 0361 y la plataforma de
  auditoría 0258, 0261, 0267 y 0294.
- **Funciones extraídas por regexp del archivo real:** `get_user_tenant_id()` de 0453,
  `current_studio_role()` de 0200, `assert_tenant_match` de 0012, `assert_studio_role` de 0351 y
  la función D5 de 0293, más su trigger.

**84 aserciones** (73 en la ronda 1). La ronda 2 del 2026-09-15 agrega:
- los drift de RLS, que exigen su mensaje claro;
- los drift de reaplicación con un trigger de otra forma;
- las sondas del postflight para trigger, dueño y FORCE;
- el FOR SHARE exigido sobre `prosrc` (filas 2b, 3, 3c y 3b).

| Punto | Qué defiende |
|---|---|
| 1. RED | Sin 0454: tras el borrado del Studio por RLS el vínculo sigue `active` y quedan 2 códigos sin revocar; `portal_bind_session()` activa la invitación de un cliente borrado; `merge_clients` deja al duplicado sin `revoked_at`, con identidad y código, y la persona choca con `unique (auth_user_id)` al vincularse a otra ficha |
| 2. Estático | Timeouts antes del preflight; orden preflight → funciones → triggers → backfill → postflight → reset; dos funciones SECURITY DEFINER con `search_path` vacío, comentadas y con `revoke all` de los cuatro roles; tres `create trigger`; sin GRANT, INSERT, DELETE, policies, tablas, índices, locks, ALTER ni DROP; bloques cerrados |
| 3. Drift (10 casos) | `merge_clients` que retira antes de mudar, sin SECURITY DEFINER o ausente; `portal_bind_session` con otra forma; `client_users.revoked_at` o `clients.deleted_at` renombradas; `portal_access_links` sin RLS; CHECK de status ausente; `portal_invitation` deprecado con D5 vivo; trigger ajeno con el nombre de la migración: `P0001` en el preflight, sin uuid ni Shipping Marks, y catálogo intacto. Las formas de `merge_clients` de 0341 y 0358 pasan el preflight |
| 3b. Postflight | Rechaza una huella distinta («0454: cambió el catálogo dependiente…») y un vínculo vigente sobre un cliente borrado colado con la guarda deshabilitada («0454: quedaron 1 vínculo(s) y 0 código(s)…») |
| 2b. Estático, ronda 2 | Sobre el `prosrc` aplicado de `portal_access_require_live_client()`, sin comentarios ni espacios: la rama `if tg_op='INSERT' or new.client_id is distinct from old.client_id` hace `perform 1 … for share of c; v_alive := found;`. Es la propiedad de concurrencia que un contrato de una sesión no observa por comportamiento |
| 3, ronda 2. Drift de RLS (antes de aplicar) | Con `FORCE ROW LEVEL SECURITY` en `portal_access_links`: aborta con «0454 abortada: public.portal_access_links tiene FORCE ROW LEVEL SECURITY…». Aplicada por un rol sin BYPASSRLS que no es dueño: aborta con «0454 abortada: el rol que aplica no es dueño de public.clients ni tiene BYPASSRLS…». En los dos casos el catálogo queda intacto y se exige el mensaje exacto, no otro aborto posterior |
| 3c. Drift de reaplicación (después de aplicar) | Un trigger con el nombre de la migración, la misma función y el mismo tipo pero otro WHEN (`clients`), otras columnas (`client_users`, sin `client_id`), otro WHEN (`portal_access_links`) o deshabilitado: reaplicar aborta en el preflight con «0454 abortada: ya existe un trigger… con otra forma», y catálogo y filas quedan intactos |
| 3b, ronda 2. Postflight | Además de la huella y el invariante, rechaza un trigger con la misma función y tipo pero otra condición («0454: los tres triggers no quedaron vivos con su forma»), una función cuyo dueño no evita la RLS («0454: el dueño de las funciones no evita la RLS…») y FORCE en `client_users` |
| 4. Aplicada | Timeouts restaurados; ni huella ni motivo en la sesión; policies, RLS, ACL, funciones y triggers existentes idénticos; los tres triggers con su evento, momento, columnas y condición; reaplicar deja catálogo y filas idénticos |
| 5. Backfill | Activo, invitado y revocado a medias de clientes ya borrados, revocados del todo; sus códigos abiertos y vencidos, revocados; exactamente dos eventos D5 de sistema con el motivo de la migración, ninguno por el revocado a medias; los clientes vivos conservan acceso y códigos |
| 6. Comportamiento | Borrado del Studio por RLS: vínculo activo e invitación revocados del todo, códigos abiertos y usados revocados, evento D5 con el operador y el motivo, y motivo fuera de la transacción. Con el mismo Shipping Mark en otro tenant, el cliente de B conserva acceso y código. `portal_bind_session()` no activa ni reconoce. El sellado de `consumeAccessLink` no encuentra fila y `releaseAccessLink` no reabre. Restaurar no reactiva; la sesión del antiguo titular no se vincula; una invitación nueva sí. Guardas: 8 casos `23514` (INSERT activo, invitado y de cliente inexistente; reinvitación; mudanza a cliente borrado; código nuevo, reapertura y mudanza) y 5 cambios permitidos. Las RPC de invitación y de código corto siguen rechazando. Fallo atómico: si la revocación falla, cliente, vínculo y código quedan como estaban. `merge_clients` con acceso mudado: sigue activo en el superviviente con la misma identidad; la ficha retirada queda sin códigos. `merge_clients` con acceso en el superviviente: duplicado revocado del todo con un solo evento D5 y la persona se vincula a otra ficha. Tenants: B borra lo suyo, no toca A y no alcanza a borrar un cliente de A. Invariante final en cero |

### Control rojo y mutantes

- **Control rojo** (`-v apply_fix=false`): falla en la primera aserción de comportamiento,
  «Backfill: el vínculo activo, el invitado y el revocado a medias de clientes ya borrados quedan
  revocados del todo».
- **Mutantes de la migración.**
  - **Método:** 35 mutantes sobre una copia de `supabase/`, restaurando el original y
    verificándolo por sha256 después de cada uno. Los dos controles con el original salieron en
    verde.
  - **Trigger (11), todos muertos:** sin cambiar status, sin `revoked_at`, conservando
    `auth_user_id` o `token`, sin revocar códigos o sólo los no usados, filtrando vínculos ya
    revocados, sin motivo D5 o sin restaurarlo, WHEN sin `old`, BEFORE en vez de AFTER.
  - **Guardas (6):** cinco muertos: aceptar cliente borrado en INSERT o en UPDATE, sin
    `client_id` o sin `revoked_at` en las columnas, otro errcode. Sobrevive «guarda INSERT sin
    `FOR SHARE`»: es concurrencia y un contrato de una sola sesión no la observa. Lo delatan las
    carreras de abajo.
  - **Backfill (4), todos muertos:** sin revocar vínculos, ignorando revocados a medias, sin
    revocar códigos, sin motivo.
  - **Preflight, postflight y estructura (14), todos muertos:** sin orden de `merge_clients`, sin
    su SECURITY DEFINER, sin forma de bind, sin CHECK, sin chequeo D5, sin chequeo de triggers
    propios, sin RLS, sin columnas, postflight sin huella o sin invariante, `revoke` sin PUBLIC,
    `search_path = public`, sin `lock_timeout`, sin `reset`.
  - **Resultado:** 34 de 35 en una sesión y 35 de 35 con las carreras.
- **Mutante muerto por la causa equivocada.** En la primera serie, «`search_path = public`»
  murió por un error de sintaxis: el corredor usaba `String.replace` con `$$` en la cadena de
  reemplazo, que JS convierte en `$`. Se corrigió el corredor (reemplazo por función) y el
  mutante murió en el postflight por la forma final.
- **Hallazgo del propio contrato.** El drift «trigger ajeno con el nombre de la migración»
  encontró un NULL en el preflight: antes de la primera aplicación
  `to_regprocedure('public.clients_revoke_portal_access()')` es NULL y el `not (…)` dejaba pasar
  la fila. Se corrigió con `coalesce(…, false)`.

### Ronda 2 (2026-09-15): control rojo y mutantes en la suite versionada

Endurecimiento pedido en la revisión de la PR #120, antes de aplicar. Todo sobre `ea21ad14`,
PostgreSQL 17 en Docker 29.7.2:

- **Contrato nuevo contra la 0454 publicada en `5af835a5`** (sha256 `3f3abc08…` frente a
  `6f58da4e…`): falla en el primer caso nuevo, «preflight aceptó drift o alteró catálogo: alter
  table public.portal_access_links force row level security».
- **Control rojo por caso**, con mutantes de la migración nueva. Todos mueren en la suite
  versionada, sin carreras:
  1. **Forma completa de triggers.** «preflight triggers sin definición completa (sólo tipo y
     función)» y «preflight triggers sin tgenabled» mueren en el drift de reaplicación (3c).
     «postflight triggers sin definición completa» muere en la sonda «el postflight aceptó un
     trigger con otra condición».
  2. **RLS del dueño.**
     - «preflight sin chequeo de FORCE» muere porque el preflight acepta y aborta el postflight,
       y el contrato exige el aborto en el preflight.
     - «preflight sin chequeo de dueño o BYPASSRLS» muere por un 42501 posterior del preflight al
       leer `audit_entity_types`.
     - Los mensajes específicos se prueban aparte: «preflight FORCE con mensaje genérico» y
       «preflight dueño con mensaje genérico» mueren en «el drift de RLS abortó sin su mensaje
       claro».
     - «postflight sin chequeo de dueño y FORCE» muere en su sonda.
  3. **FOR SHARE.** «guarda INSERT sin FOR SHARE», que en la ronda 1 sólo morían las carreras,
     muere en la aserción estática 2b.
- **Serie completa:** 43 mutantes (35 de la ronda 1 y 8 nuevos). **43 de 43 muertos** en la suite
  versionada, con los dos controles del original en verde. `-v apply_fix=false` sigue fallando en
  «Backfill: el vínculo activo, el invitado y el revocado a medias…».
- **Cambio en la muerte de un mutante de la ronda 1.** «guarda INSERT acepta cliente borrado» ahora
  muere antes, en la aserción de FOR SHARE, porque altera el texto de esa rama. Los casos de
  comportamiento de la guarda lo matan igual.

### Concurrencia (dos sesiones, `deadlock_timeout` 200 ms)

| Carrera | Original | Mutante sin `FOR SHARE` |
|---|---|---|
| 1. INSERT de invitación mientras otra sesión borra (2 s sin confirmar) | espera y responde `23514`; 0 filas vigentes | inserta; 1 fila vigente sobre cliente borrado |
| 2. Reinvitación sin confirmar (`revoked` → `invited`) y luego borrado | el borrado espera, re-evalúa y revoca: `revoked`, `revoked_at`, sin identidad ni token | igual |
| 3. Borrado sin confirmar y luego activación del mismo cliente | la activación espera y responde `23514`; fila revocada | igual |
| 4. Código corto nuevo mientras otra sesión borra | espera y responde `23514`; 0 códigos sin revocar | inserta; 1 código sin revocar |

Sin interbloqueos. Invariante final: 0 con el original y 1 con el mutante.

### Aplicación y gates

- `vitest`, 7 tests:
  - `app/studio/(app)/clientes/__tests__/soft-delete-client.test.ts`: UPDATE único por Shipping
    Mark con revalidación; error de la base sin revalidar y con el mensaje que no promete un
    borrado; sin permiso no toca la base.
  - `app/studio/(app)/clientes/_components/ClientDrawer.confirm-delete.test.tsx`: el texto avisa
    el Portal, con tuteo y sin voseo; pedir eliminar no borra; confirmar borra y cierra; un error
    se muestra y no cierra.
- Contratos SQL vecinos en verde con la misma imagen: 0341, 0358, 0360, 0293 y 0453.
- `node scripts/check-numbering.mjs` sin repetidos. `node scripts/check-pending-migration-symbols.mjs`:
  0 ROJO · 0 AMARILLO sin declaración, porque las dos funciones nuevas sólo las invocan triggers y
  ningún código las nombra.
- `pnpm verify` con su veredicto por paso: en el handoff.

## Datos personales (`revisar-datos-ve`)

No es asesoría legal.

- **ENCONTRADO en main; esta SDD lo corrige.**
  - **La credencial sobrevive al borrado.** Borrar un cliente deja vigente su credencial de acceso
    al Portal: vínculo `active` con `auth_user_id` e invitación `invited` con `token`
    (`app/studio/(app)/clientes/actions.ts:420-423` en main; `0080_portal_cliente.sql:168-178`).
    Deja además los códigos cortos al portador sin revocar (`0360_portal_access_links.sql:26-36`).
  - **La fusión deja la identidad.** `merge_clients` deja al duplicado con `auth_user_id` y
    `token` (0361:123-127).
  - **Mitigación parcial ya existente.** La app rechaza al principal (`lib/portal/portal-queries.ts:89-95`)
    y el canje (`lib/studio/portal/access-link.ts:229-242`). La identidad y el token, que ya no
    tienen finalidad, seguían guardados.
  - **Normas de referencia:** CRBV art. 28 (acceso a los datos propios y conocer su uso y
    finalidad) y art. 60 (confidencialidad y límite al uso de la informática), según
    `.claude/skills/revisar-datos-ve/references/marco-legal-ve.md`.
- **CORRECTO, en local.** La 0454 vacía `auth_user_id` y `token` y revoca vínculos y códigos en
  la misma transacción del borrado (funciones `clients_revoke_portal_access` y
  `portal_access_require_live_client` de la migración). Lo mide el contrato en PostgreSQL efímero
  con datos sintéticos. En producción sigue abierto hasta aplicar.
- **CORRECTO.** La migración no agrega columnas, tablas, logs con PII ni tratamientos nuevos.
  - Los mensajes de error y los NOTICE llevan reglas y conteos, nunca ids, emails ni Shipping
    Marks.
  - Los motivos de auditoría no llevan datos de la persona.
  - El evento D5 conserva sólo el status anterior y el posterior (0293:436-439).
- **ENCONTRADO, fuera de alcance.** La fila revocada conserva `email`, `invited_at`, `bound_at` y
  `last_login_at` (0080:17-26) y el código conserva sus fechas (0360:30-35), sin plazo de
  conservación. Queda 🔴 SIN FUNDAMENTO en `docs/legal/privacidad/mapa-de-borrado.md` §10, igual
  que el resto de §3.A. Un borrado físico del cliente las alcanza por `on delete cascade`
  (0080:16, 0360:29).
- **Conteo del 2026-09-14,** agregado y sin ids: 1 vínculo activo con cliente borrado, que el
  backfill revoca al aplicar.
- **NO VERIFICABLE:**
  - si ese principal usó su acceso después del borrado: haría falta revisar registros de Auth y de
    la API con retención suficiente, que no se pidieron ni se leyeron;
  - el estado real en producción hasta aplicar la 0454.

## Gobernanza

Políticas abiertas desde `docs/governance/AGENT-BRIEF.md` para «acción, borrado, permanencia,
auditoría»: SGE-00, MP-01, BTN-01, AUD-01 y AUD-02.

| Principio / política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.01 predecible · BTN-01 vocabulario | cumplimiento | «Eliminar» conserva el resultado P2; la confirmación nombra la consecuencia nueva |
| SGE-00.02 pérdida de trabajo | no aplica | No hay trabajo del usuario en juego |
| SGE-00.03 riesgo y fricción · MP-01 | cumplimiento parcial + no conformidad preexistente | La consecuencia es visible antes de confirmar y el permiso se valida en servidor (`moduleEditDenial` y RLS). MP-01 pide R2 para clientes (ConfirmDialog con el nombre del registro y restauración); el drawer usa confirmación inline y no hay restauración en la UI. Deuda anterior a esta SDD, reportada fuera de alcance |
| SGE-00.04 auditoría · AUD-01 | cumplimiento para el acceso; no conformidad preexistente para el borrado | La revocación deja `portal_access_status_changed` en la misma transacción, con tenant, actor, status anterior y posterior, y motivo (AUD-01 §2 «cambios de acceso»). El borrado lógico del cliente en sí no deja evento (AUD-01 §2 «eliminar»); deuda anterior, reportada fuera de alcance |
| SGE-00.05 permisos y tenant | cumplimiento | RLS «clients by tenant» y `moduleEditDenial`; el contrato prueba que B no alcanza a A y que el mismo Shipping Mark en otro tenant no se toca |
| SGE-00.06 prevenir errores | cumplimiento | Guardas en base; preflight que falla cerrado |
| SGE-00.07 estado verdadero | cumplimiento | El drawer cierra sólo con `ok`, muestra el error y deshabilita la doble ejecución (`isDeleting`); la acción no revalida si falló |
| SGE-00.08 / .09 pasos y patrón | cumplimiento | Mismo flujo y mismos componentes; sin primitivas nuevas |
| SGE-00.10 accesibilidad | no aplica | Sólo cambia el texto de un `span` existente |
| SGE-00.11 lenguaje | cumplimiento | Confirmación con consecuencia; error con causa y recuperación, tuteo y sin voseo |
| SGE-00.12 IA | no aplica | Sin IA |
| AUD-02 | no aplica | No cambia consulta, conservación ni exportación de logs |

## Allowlist exacta

- `supabase/migrations/0454_borrar_cliente_revoca_portal.sql`
- `supabase/tests/0454_borrar_cliente_revoca_portal.test.sql`
- `supabase/migrations-baseline.json` (únicamente la espera `0454_borrar_cliente_revoca_portal` en
  `pendingBelowCutoff`, sin subir el `cutoff` 238 ni tocar las otras esperas)
- `app/studio/(app)/clientes/actions.ts` (sólo `softDeleteClientAction` y su mensaje)
- `app/studio/(app)/clientes/_components/ClientDrawer.tsx` (sólo el texto de la confirmación)
- `app/studio/(app)/clientes/__tests__/soft-delete-client.test.ts`
- `app/studio/(app)/clientes/_components/ClientDrawer.confirm-delete.test.tsx`
- `docs/legal/privacidad/mapa-de-borrado.md` (§10)
- `docs/specs/0467-borrar-cliente-revoca-portal/spec.md`
- `docs/specs/README.md`: generado por `node scripts/build-docs-index.mjs`
- `.agents/handoffs/borrar-cliente-revoca-portal.md`

## Aceptación

- [x] 1. Todo borrado lógico, sea la acción del Studio o `merge_clients`, deja en la misma
      transacción cero `client_users` del cliente en `invited` o `active`, las revocadas con
      `revoked_at` y sin `auth_user_id` ni `token`, y cero `portal_access_links` del cliente sin
      revocar.
- [x] 2. Si la revocación falla, el borrado no ocurre (contrato, «fallo atómico») y el Studio
      muestra el error sin cerrar el drawer (vitest).
- [x] 3. `merge_clients` conserva su contrato. El acceso mudado sigue activo en el superviviente y
      la ficha fusionada queda sin acceso ni códigos. La persona del duplicado se vincula a otra
      ficha.
- [x] 4. Tras el borrado, `portal_bind_session()` no activa ni reconoce y el código corto no
      canjea, ni por la base ni por la app. Restaurar no devuelve el acceso; una invitación nueva
      sí.
- [x] 5. Migración 0454 con preflight y postflight, dos funciones con `search_path` vacío y sin
      EXECUTE para la API, backfill idempotente con conteos agregados, espera en el baseline y
      contrato SQL que cubre `invited` y `active`, los dos caminos de `merge_clients`, códigos,
      idempotencia y dos tenants. Control rojo, mutantes y carreras.
      Ronda 2:
      - preflight y postflight exigen la forma completa de los triggers y un dueño que evite la
        RLS de las tres tablas, sin FORCE;
      - el FOR SHARE de la guarda está versionado en el contrato;
      - 43 de 43 mutantes mueren en la suite versionada.
- [x] 6. La confirmación del drawer avisa que el cliente pierde su acceso al Portal, con tuteo y
      sin voseo.
- [x] 7. Mapa de borrado actualizado (§10); allowlist exacta y revisión `revisar-datos-ve` en esta
      spec.

## Producción

`0454_borrar_cliente_revoca_portal` **no está aplicada**. Este estado no acredita aplicación; lo
acredita el ledger.

- Aplicarla exige el OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`: de a una,
  con el name exacto. No depende de ningún despliegue.
- **Lectura previa recomendada, sólo catálogo y sin filas:**
  - dueño (`relowner`) y `relforcerowsecurity` de `clients`, `client_users` y
    `portal_access_links`, y `rolsuper` / `rolbypassrls` del rol que va a aplicar. Ese rol queda
    como dueño de las dos funciones SECURITY DEFINER: si no es dueño de las tres tablas ni tiene
    BYPASSRLS, o alguna tiene FORCE, la revocación y el backfill actualizarían 0 filas sin error,
    y el preflight aborta;
  - el cuerpo normalizado de `merge_clients` y de `portal_bind_session`;
  - el CHECK de status de `client_users`;
  - los triggers de `clients`, `client_users` y `portal_access_links` (si ya existiera uno con el
    nombre de la migración, su `pg_get_triggerdef` completo);
  - el estado de `portal_invitation` en `audit_entity_types`.

  Si cualquiera difiere de lo que exige el preflight, la migración aborta sin cambiar nada y hay
  que revisar.
- **Conteos esperables del NOTICE.** El conteo agregado del 2026-09-14 daba 1 vínculo activo con
  cliente borrado. Pueden aparecer además «revocados incompletos» y códigos cortos mayores que
  cero: `merge_clients` dejaba al duplicado `revoked` sin `revoked_at` y con `auth_user_id` y
  `token` (0361:124-126), y los códigos de las fichas retiradas nunca se revocaban. Es esperable y
  el backfill los completa.
- **Ventana entre el merge y la aplicación.** Desde que se despliega el merge, el aviso del drawer
  promete la revocación, pero hasta aplicar 0454 sólo la app cierra la puerta al cliente borrado:
  el vínculo y los códigos siguen vigentes en la base. Aplicarla poco después del merge.
- Aplicar en baja actividad del Studio y del Portal por el `ShareRowExclusiveLock` de hasta 5 s.
  Si corta por `lock_timeout`, reintentar.
- **Deadlock posible.** La migración toma los locks en el orden `clients` → `client_users` →
  `portal_access_links`. Una transacción concurrente que escriba `client_users` o
  `portal_access_links` y después `clients` puede formar un interbloqueo con ella: PostgreSQL
  aborta una de las dos (`40P01`) y se reintenta entera la que cayó.
- **Postflight en producción recomendado, sólo catálogo y agregados:**
  - las dos funciones con `search_path` vacío y sin EXECUTE para `anon`, `authenticated` y
    `service_role`;
  - los tres triggers habilitados;
  - cero vínculos o códigos vigentes sobre clientes borrados;
  - el NOTICE del backfill, que el 2026-09-14 debería dar 1 activo;
  - los advisors de seguridad antes y después.
- Pendiente de Sam tras aplicar: smoke de borrar un cliente de prueba con acceso (Studio ›
  Clientes › Eliminar) y comprobar el acceso revocado en su tarjeta del Portal.
