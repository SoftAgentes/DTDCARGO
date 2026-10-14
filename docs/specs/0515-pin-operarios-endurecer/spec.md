---
sdd: "0515"
title: "PIN de operarios endurecido en la base: sin lectura de pin_hash, con la matriz, auditado y sin repetidos"
status: in-progress
author: "Sam (founder) + Claude Opus 5.5 (Worker)"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: ["0139", "0166", "0174", "0235", "0251", "0252", "0412", "0513"]
confidencialidad: interno
---

# SDD-0515 — PIN de operarios endurecido en la base

> El PIN de 4 dígitos con que los operarios entran a `/m/cn` y `/m/ve` deja de
> poder leerse desde la API, la base autoriza con la misma matriz de módulos que
> la app, cada alta y restablecimiento queda auditado sin el PIN, y no puede
> haber dos operarios activos con el mismo PIN en el mismo tenant y región.

## Contexto

Medido por el Director en el catálogo de producción el 2026-10-14 a las
17:36:43Z: `has_column_privilege('authenticated','public.operario_pins',
'pin_hash','select') = t`. El SELECT de tabla viene de
`0021_operario_admin_rpcs.sql` y `0023_operario_region.sql`, y la única policy
de lectura, «operario_pins select by admin of tenant», sólo exige
`tenant_id = get_user_tenant_id()`, sin rol. `get_user_tenant_id()` (última
definición en `0453_portal_helpers_principal_determinista.sql`) sale de
`user_tenants`: cualquier miembro del personal del tenant, con cualquier rol, lee
los hashes. Con 4 dígitos, el bcrypt se revierte probando los 10.000 valores. Los
clientes del Portal no están expuestos (no tienen fila en `user_tenants`).

Además, `admin_reset_operario_pin` y `admin_create_operario`
(`0351_operario_rpc_exige_rol.sql`) exigían `admin|operations` escrito a mano,
mientras la app decide con `moduleEditDenial(supabase, "operarios")`: el default
de `ROLE_MODULE_ACCESS` en `lib/studio/rbac.ts` más los desvíos por rol de
`studio_role_module_overrides` (`0357_role_module_overrides.sql`). Restablecer no
dejaba rastro (criterio 5 pendiente de SDD-0513), y el login
(`0325_operario_pin_login_hardening.sql`) exige una sola coincidencia en tenant +
región: un PIN repetido deja fuera a los dos operarios.

**Decisiones de Sam (2026-10-14, AskUserQuestion), literal de la opción elegida:**

1. «Sí, en una tarea aparte (Recomendado)», sobre «Nueva SDD-0515 con una
   migración que: quita al personal la lectura de pin_hash (sólo
   admin/operaciones vía RPC), registra en auditoría cada restablecimiento en la
   misma transacción, y evita PIN repetidos en el mismo tenant y región. Aplicarla
   a producción te la pido con OK nominal aparte.»
2. «Por rol, con la matriz (Recomendado)», explicada como «Usas la matriz de
   permisos que ya existe: le das el módulo Operarios al rol de la
   administradora. La 0515 hace que la base respete esa matriz (hoy sólo acepta
   admin u operaciones).» La administradora tiene rol Admin. Los permisos por
   usuario siguen descartados (SDD-0139).

## Alcance

Una migración, `0475_pin_operarios_endurecer.sql`, más el reintento de la app:

- **Lectura.** El SELECT de `operario_pins` de `authenticated` y de
  `service_role` pasa a ser por columna: las 13 columnas menos `pin_hash`. La
  policy SELECT exige, además del tenant, el permiso de **vista** de Operarios
  según la matriz. `pin_hash` sólo lo leen las funciones SECURITY DEFINER: el
  login y las de alta y restablecimiento.
- **Matriz en la base.** `operarios_module_authorized(tenant, 'view'|'edit')`
  reproduce `canAccessModule`/`canEditModule` con el patrón de
  `document_entity_authorized` (`0444_unlinked_document_entity_rbac.sql`): admin
  siempre, support nunca edita, desvío de 0357 si existe y, si no, el default
  `['operations']`.
- **RPC.** `admin_reset_operario_pin` y `admin_create_operario`, reescritas desde
  0351, autorizan con la matriz (de primero, sin oráculo de ids), rechazan con
  **P0018** un PIN que coincida con otro operario **activo** del mismo tenant y
  región (con un advisory lock transaccional por tenant y región) y escriben el
  evento de auditoría en la misma transacción.
- **Auditoría (AUD-01).** Entidad `operario` (dominio `access`) en
  `audit_entity_types`; eventos `operario_pin_reset` y `operario_created` con
  actor `user`, `source = rpc`, `sensitivity = restricted`, `correlation_id`
  propio y `after_data` sin el PIN ni el hash.
- **Validador.** `validate_operario_pin_format`, reescrita desde
  `0037_harden_operario_pin_validator.sql` (su última definición; 0271, 0280,
  0287 y 0288 sólo la reafirman en el ledger), dice «Elige» en vez de «Elegí» y
  conserva el `search_path = public` de 0210.
- **App.** `generateOperarioPinAction` reintenta con otro PIN generado si la base
  contesta P0018 (hasta 5 PIN distintos); el camino manual y el alta devuelven el
  rechazo como error del campo PIN, sin cambiar el PIN que eligió el admin.

Fuera de alcance: `admin_set_operario_active`, `admin_update_operario`,
`verify_operario_pin` y el sorteo con `Math.random` de `NewOperarioDrawer.tsx`
(ver Riesgos y decisiones).

## Criterios de aceptación

Cada uno con su evidencia; el contrato es
`supabase/tests/0475_pin_operarios_endurecer.test.sql` y su envoltorio PGlite
`lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts`.

1. **Nadie lee `pin_hash` desde la API.** admin, operations, commercial, support
   y service_role reciben 42501 al pedirlo; las otras 13 columnas siguen
   legibles por columna; `select *` falla; la lista de Studio › Operarios
   (`lib/studio/operario-queries.ts`, columnas nombradas) y la sesión del
   operario (`lib/auth/operario-session.ts`, service_role) siguen funcionando.
2. **La lectura sigue la matriz.** operations y admin ven los operarios de su
   tenant; commercial y support no; un desvío que le da la vista a commercial la
   abre y uno que le quita Operarios a operations la cierra; un usuario
   desactivado no ve nada; otro tenant sólo ve los suyos.
3. **Restablecer y crear siguen la matriz.** Para los 7 roles, sin desvío y con
   cada desvío posible (25 casos), la policy, el helper y las dos RPC deciden lo
   mismo que `moduleViewDenial`/`moduleEditDenial` reales. El mutante que vuelve
   al rol escrito a mano rompe exactamente los 6 casos donde la lista a mano y
   la matriz difieren. El candado corre antes de buscar el operario.
4. **Auditoría en la misma transacción, sin el PIN.** Cada restablecimiento y
   cada alta dejan un evento con quién, a qué operario, en qué tenant y cuándo;
   ni el PIN ni el hash aparecen en `payload`, `before_data`, `after_data` ni
   `reason`. Si el evento no se puede escribir (entidad desactivada), el PIN no
   cambia y el operario no se crea.
5. **Sin PIN repetidos.** El PIN de otro operario activo del mismo tenant y región
   se rechaza con P0018 y el mensaje «Ese PIN ya lo usa otro operario activo de la
   misma región. Usa otro o genera uno nuevo.»; en otra región, en otro tenant o
   igual al de un operario dado de baja se acepta; un operario puede volver a su
   propio PIN; el lock por tenant y región está en `pg_locks` hasta el COMMIT.
6. **El login sigue funcionando.** `verify_operario_pin` no cambia (md5 de 0325)
   y entra con el PIN nuevo, no con el viejo, y con el mismo PIN en otra región u
   otro tenant cada login encuentra a su operario.
7. **Tuteo.** El PIN común se rechaza con «PIN demasiado común. Elige uno menos
   predecible.»; el validador rechaza los mismos 24 de siempre
   (`lib/studio/__tests__/operario-pin.migration.test.ts`, de SDD-0513, corre
   ahora contra la definición de 0475).
8. **La app reintenta.** Con un P0018, `generateOperarioPinAction` guarda otro PIN
   distinto, nunca devuelve ni escribe en consola el rechazado y se rinde tras 5
   con el mensaje de la base; un rechazo que no es P0018 no reintenta; el camino
   manual y el alta devuelven el error en el campo PIN
   (`lib/studio/__tests__/operario-pin.test.ts`,
   `app/studio/(app)/operarios/__tests__/reset-pin-actions.test.ts`; 8 mutantes
   de la app mueren).
9. **Preflight y postflight.** Un ANTES con drift (cuerpo de 0351, login de 0325,
   policy de más, columna de más, RLS forzada, entidad `operario` con otra forma,
   anon con SELECT) aborta sin cambiar nada; re-aplicar la migración es inocuo.
10. **Aplicada a producción** con OK nominal de Sam, preflight leído antes y smoke
    después. **Pendiente**: el estado de la spec no pasa a `done` hasta entonces.

## Diseño

### La regla duplicada TS ↔ SQL

El default `['operations']` de Operarios queda escrito dos veces: en
`ROLE_MODULE_ACCESS.operarios` de `lib/studio/rbac.ts` y en el contrato de
`operarios_module_authorized`. Es el mismo trade-off que aceptó 0357 con la lista
de módulos candado: no hay forma de que SQL lea `rbac.ts` en runtime.
**`rbac.test.ts` es la fuente**; la prueba PGlite de esta spec falla si los dos
defaults dejan de coincidir, y si cambia el de TS hace falta una migración
hermana. Las premisas que hacen que el helper sea toda la regla de
`moduleEditDenial` (Operarios no es LOCKED, no tiene lado de almacén ni es de
superadmin) también están afirmadas.

### Por qué la comparación de PIN vive en la RPC

Un bcrypt lleva sal propia: dos hashes del mismo PIN no se parecen. Sólo quien
tiene el PIN en claro puede compararlo, y eso pasa únicamente dentro de la RPC.
Por eso no hay índice ni trigger que lo garantice, y por eso
`operario_pin_assert_available` no tiene EXECUTE para ningún rol de la API.

### Orden de despliegue

**Independiente.** Ningún código desplegado lee `pin_hash` con el cliente de
usuario ni depende de los símbolos nuevos; antes de la migración el reintento de
la app nunca ve un P0018, y después de la migración la app de hoy muestra el
mensaje de la base. Recomendado: fusionar y desplegar la PR primero (sólo con su
autorización), aplicar 0475 después, con OK nominal de Sam y fuera de la ventana
del corte de dtdcargo.com al servidor propio (jueves 2026-10-15 en la noche).

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0475_pin_operarios_endurecer.sql` | nuevo · la migración |
| `supabase/tests/0475_pin_operarios_endurecer.test.sql` | nuevo · contrato SQL |
| `lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts` | nuevo · PGlite, control rojo, preflights, mutantes y propiedad |
| `supabase/migrations-baseline.json` | espera `0475_pin_operarios_endurecer` en `pendingBelowCutoff` |
| `lib/studio/operario-pin.ts` | P0018, copy y `saveWithFreshOperarioPin` (puro) |
| `lib/studio/operario-pin-generator.ts` | `saveWithGeneratedOperarioPin` (reintento con `crypto.randomInt`) |
| `app/studio/(app)/operarios/actions.ts` | reintento en el PIN generado; P0018 como error de campo en manual y alta |
| `lib/studio/__tests__/operario-pin.test.ts` | casos del reintento |
| `app/studio/(app)/operarios/__tests__/reset-pin-actions.test.ts` | casos de P0018 |
| `lib/studio/operario-queries.ts` | comentario: RLS por matriz y columnas nombradas |
| `app/studio/(app)/operarios/layout.tsx` | comentario del gate |
| `docs/specs/0515-pin-operarios-endurecer/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0515-pin-operarios-endurecer.md` | handoff |

Sin cambios de UI: el cajón de restablecer y el de alta ya muestran `error` y
`fieldErrors.pin`.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| AUD-01 §1, §4 (atomicidad) | cumplimiento | evento por RPC en la misma transacción; prueba de fallo del log con rollback (contrato §9) |
| AUD-01 §2 (credenciales y acceso) | cumplimiento para alta y restablecimiento | `operario_created`, `operario_pin_reset` |
| AUD-01 §3 (`reason` en cambios de acceso) | excepción propuesta, a decidir por Sam | sin motivo humano, como `membership.role_change` en D1 (0289); exigirlo pide UI |
| AUD-01 §5 (sin secretos) | cumplimiento | contrato §4 y §7: ni PIN ni hash en los datos del evento |
| AUD-01 §7 (flujos modificados) | no conformidad preexistente fuera de alcance | `admin_set_operario_active` y `admin_update_operario` mutan sin evento (0351) |
| AUD-02 | no aplica | no cambia quién consulta el log; `sensitivity = restricted` |
| BTN-01, FRM-01, ERR-01 | no aplica | sin cambios de UI; los mensajes nuevos van en tuteo |

## Revisión de datos (`/revisar-datos-ve`)

Advisory; no afirma cumplimiento. Alcance: la credencial de acceso de los
operarios (PIN) y lo que la auditoría guarda de ellos.

| Punto | Estado | Evidencia |
|---|---|---|
| `pin_hash` legible por cualquier rol del personal | CORRECTO tras aplicar 0475 | `0475_pin_operarios_endurecer.sql` § 7 (grant por columna) y contrato §1-§2; NO VERIFICADO contra producción hasta aplicar |
| El PIN en claro no se persiste ni se audita | CORRECTO | RPC: `crypt(p_pin, gen_salt('bf'))` y `after_data` sin el PIN (contrato §4, §7); app: el PIN rechazado no sale en la respuesta ni en consola (`reset-pin-actions.test.ts`) |
| Minimización en la auditoría | CORRECTO | el evento guarda ids, región, rol, almacén y estado; no el nombre del operario |
| Oráculo de PIN en uso | ENCONTRADO | un rol con edición de Operarios puede saber, por el P0018, que un PIN está en uso en la región, y los rechazos no dejan evento (se revierten con la transacción). Ver decisión 3 |
| PIN duplicados ya existentes en producción | NO VERIFICABLE | no se pueden detectar sin el PIN en claro; probar los 10.000 valores sería romper los hashes |
| Transferencia o terceros | no aplica | sin integraciones nuevas |

Marco citado desde `references/`: Ley Especial contra los Delitos Informáticos,
arts. 20-22 (obtención y revelación indebida); PIPL art. 51 (control de permisos)
por el equipo de Yiwu. No es asesoría legal.

## Riesgos

- **Locks.** DROP/CREATE POLICY y los GRANT toman ACCESS EXCLUSIVE sobre
  `operario_pins` hasta el COMMIT; el login espera milisegundos dentro del
  `lock_timeout` de 5 s.
- **La carrera no se ejerce con dos conexiones.** PGlite tiene una sola: el
  contrato prueba que el advisory lock existe en `pg_locks`, no que dos sesiones
  se serialicen. Un `*_carrera.test.sql` con dblink (patrón 0459) lo cubriría en
  `verify` con Docker.
- **Reactivar puede reintroducir un repetido.** El PIN de un operario dado de baja
  no bloquea a los demás; si se lo reactiva, la base no puede comparar su hash con
  los otros. Ver decisión 2.
- **Drift en producción.** Los md5 del preflight salen del repo; si producción
  difiere, la migración aborta sin cambiar nada y hay que leer el cuerpo vivo.

## Decisiones que necesitan a Sam

1. **Activar/desactivar y editar operarios siguen con `admin|operations` escrito a
   mano** (0351): un rol al que la matriz le dé Operarios podrá ver, crear y
   restablecer, pero no editar ni desactivar (la action de activar ignora el error
   en silencio); y a operations con Operarios revocado la base todavía le deja
   editar y desactivar. Pasarlas a la matriz obliga a auditarlas (AUD-01 §7) y,
   para desactivar, a pedir un motivo (precedente `membership.disable` de D1), o
   sea UI. Propuesta: SDD aparte.
2. **Reactivar un operario**: ¿exigir un PIN nuevo al reactivarlo, para que nunca
   vuelva un repetido?
3. **Oráculo del P0018**: ¿generar el PIN dentro de la base y retirar el camino
   manual, o limitar intentos? Hoy quien puede restablecer ya puede entrar como
   cualquier operario, pero dejando rastro; el sondeo no lo deja.
4. **Motivo del restablecimiento**: AUD-01 pide `reason` en cambios de acceso; esta
   spec sigue el precedente D1 (`role_change` sin motivo). ¿Se exige en el cajón?
5. **service_role también pierde `pin_hash`**, por «nadie lo lee desde la API».
   Ningún código lo usa (verificado por grep); confirmar.
