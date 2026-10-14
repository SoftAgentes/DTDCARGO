---
sdd: "0515"
title: "PIN de operarios endurecido: matriz de módulos, «Ver PIN» auditado, motivo obligatorio y sin repetidos"
status: in-progress
author: "Sam (founder) + Claude Opus 5.5 (Worker)"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: ["0139", "0166", "0174", "0235", "0251", "0252", "0412", "0513"]
confidencialidad: interno
---

# SDD-0515 — PIN de operarios endurecido

> El PIN de 4 dígitos con que los operarios entran a `/m/cn` y `/m/ve` deja de
> poder leerse desde la API; la base autoriza con la misma matriz de módulos que
> la app; quien tenga Operarios puede ver un PIN con un motivo, y eso queda en la
> auditoría; alta, restablecimiento y reactivación piden motivo y dejan su
> evento sin el PIN; y no puede haber dos operarios activos con el mismo PIN en
> el mismo tenant y región.

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

### Decisiones de Sam (2026-10-14, AskUserQuestion), literales

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
3. «Sí, con un botón «Ver PIN» auditado». Lo que se le explicó: «Además del hash
   (que sigue sin poder leerse), se guarda el PIN cifrado con una clave del
   servidor. Un botón «Ver PIN» lo muestra sólo a los roles con acceso a
   Operarios en la matriz, y cada vez que alguien lo ve queda en la auditoría.
   Riesgo: quien lo vea puede entrar como ese operario, y la auditoría ya no
   prueba quién hizo cada entrega. Los PIN actuales no se pueden recuperar: hay
   que restablecerlos una vez para que empiecen a verse.»
4. «Sí, un motivo corto obligatorio (Recomendado)», para restablecer y para ver
   un PIN (AUD-01).

### Defaults del Director para las decisiones que esta spec dejó abiertas

(a) Activar, desactivar y editar operarios por la matriz van en una SDD aparte.
(b) Al reactivar a un operario dado de baja se exige un PIN nuevo. (c) La fuga de
P0018 queda moot con «Ver PIN» y se anota. (d) `service_role` no lee `pin_hash`
ni `pin_cifrado`. (e) El alta deja de usar `Math.random` en el navegador y genera
en el servidor como el restablecimiento.

## Alcance

Una migración, `0475_pin_operarios_endurecer.sql`, más la app de Operarios:

- **Lectura.** El SELECT de `operario_pins` de `authenticated` y de
  `service_role` pasa a ser por columna: las 13 columnas menos `pin_hash` y la
  nueva `pin_cifrado`. La policy SELECT exige, además del tenant, el permiso de
  **vista** de Operarios según la matriz. `service_role` deja de insertar y sólo
  actualiza las columnas que no son credencial.
- **Matriz en la base.** `operarios_module_authorized(tenant, 'view'|'edit')`
  reproduce `canAccessModule`/`canEditModule` con el patrón de
  `document_entity_authorized` (`0444_unlinked_document_entity_rbac.sql`): admin
  siempre, support nunca edita, desvío de 0357 si existe y, si no, el default
  `['operations']`.
- **PIN recuperable.** `pin_cifrado` (bytea) guarda el PIN con
  `pgp_sym_encrypt` (AES-256) y la clave `operario_pin_key` que la migración crea
  en Vault con 32 bytes aleatorios. Lo escriben sólo `admin_create_operario` y
  `admin_reset_operario_pin`.
- **«Ver PIN».** `admin_ver_operario_pin(operario, motivo)`: SECURITY DEFINER,
  `search_path` vacío, la matriz en **edición** (la misma regla que restablecer),
  motivo obligatorio, evento `pin_visto` en la misma transacción sin el PIN;
  devuelve el PIN o `NULL` si es anterior a 0475.
- **Motivo obligatorio.** Alta, restablecimiento y «Ver PIN»: 4 a 300 caracteres
  y sin el PIN adentro (`operario_motivo_valido`). Las RPC de alta y
  restablecimiento cambian de firma (`p_motivo`, y `p_reactivar` en el
  restablecimiento); las firmas viejas se quitan para que no quede una puerta sin
  motivo. El motivo va al `reason` del evento.
- **Sin repetidos.** Alta y restablecimiento rechazan con **P0018** un PIN que
  coincida con otro operario **activo** del mismo tenant y región, con un advisory
  lock transaccional por tenant y región.
- **Reactivar.** `admin_set_operario_active` (0351) ya no reactiva (P0019);
  `admin_reset_operario_pin(p_reactivar => true)` reactiva con un PIN nuevo y
  libre y deja `operario_reactivated`.
- **Validador.** `validate_operario_pin_format`, reescrita desde
  `0037_harden_operario_pin_validator.sql`, dice «Elige» en vez de «Elegí».
- **App.** «Ver PIN» por operario (motivo → modal con «Copiar PIN», se borra al
  cerrar; aviso para un PIN anterior); campo motivo en el cajón de restablecer y
  en el alta; el alta genera el PIN en el servidor (sin `Math.random`) con
  reintento ante P0018 o lo deja escribir; el toggle de un operario de baja abre
  «Reactivar».

Fuera de alcance: la autorización de `admin_set_operario_active` y de
`admin_update_operario`, que sigue escrita a mano (default a); el login
(`verify_operario_pin`), que no cambia.

## Criterios de aceptación

El contrato es `supabase/tests/0475_pin_operarios_endurecer.test.sql` y su
envoltorio PGlite `lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts`.

1. **Nadie lee `pin_hash` ni `pin_cifrado` desde la API.** admin, operations,
   commercial, support y service_role reciben 42501 al pedirlos; service_role no
   los escribe ni inserta operarios; las otras 13 columnas siguen legibles por
   columna; la lista de Studio › Operarios y la sesión del operario siguen
   funcionando.
2. **La lectura sigue la matriz.** Default, desvíos en las dos direcciones,
   membresía desactivada y otro tenant.
3. **Escritura y «Ver PIN» siguen la matriz.** Para los 7 roles, sin desvío y con
   cada desvío (25 casos), la policy, el helper, las dos RPC de escritura y «Ver
   PIN» deciden lo mismo que `moduleViewDenial`/`moduleEditDenial` reales; el
   mutante del rol escrito a mano rompe exactamente los 6 casos donde difieren;
   con sólo la vista no se ve el PIN; el candado corre antes de buscar el
   operario y antes del motivo.
4. **Auditoría en la misma transacción, sin el PIN.** `operario_created`,
   `operario_pin_reset`, `operario_reactivated` y `pin_visto` dicen quién, a qué
   operario, en qué tenant, con qué motivo y desde dónde; ni el PIN ni el hash
   aparecen en los datos del evento; si el evento no se puede escribir, el PIN no
   cambia, el operario no se crea y «Ver PIN» no devuelve nada.
5. **Motivo obligatorio.** Sin motivo, con menos de 4 o más de 300 caracteres, o
   con el PIN adentro, la base rechaza con P0020 y no cambia nada; la llamada de
   la app de antes (sin `p_motivo`) también rebota. El espejo de la app coincide
   con la función SQL real en PGlite.
6. **PIN recuperable.** El PIN restablecido o creado queda cifrado con la clave
   de Vault y «Ver PIN» lo devuelve; un PIN anterior devuelve `NULL` y la consulta
   igual queda registrada; la clave se crea una sola vez aunque la migración corra
   dos veces.
7. **Sin repetidos.** P0018 contra otro operario activo del mismo tenant y región;
   se acepta en otra región, otro tenant o contra uno de baja; un operario puede
   volver a su propio PIN; el lock está en `pg_locks` hasta el COMMIT.
8. **Reactivar exige PIN nuevo.** El toggle responde P0019 y deja al operario de
   baja; restablecer con `p_reactivar` lo reactiva con un PIN libre y entra;
   restablecer sin `p_reactivar` no reactiva; desactivar sigue igual.
9. **Login y validador.** `verify_operario_pin` no cambia y entra con el PIN
   nuevo; el validador dice «Elige» y rechaza los mismos 24 PIN.
10. **La app.** «Ver PIN» pide motivo, muestra y copia el PIN y lo borra al
    cerrar; el aviso de PIN anterior; el motivo en restablecer y en el alta; el
    alta sin `Math.random`; el reintento ante P0018; «Reactivar» manda
    `reactivar=1`. Pruebas de actions y de UI; 16 mutantes de la app mueren.
11. **Preflight y postflight.** Un ANTES con drift (cuerpos de 0351 y 0325,
    policy, columnas, `pin_cifrado` previo, RLS forzada, entidad `operario`, anon,
    Vault ausente, clave previa, sobrecarga) aborta sin cambiar nada; re-aplicar
    es inocuo.
12. **Aplicada a producción** con OK nominal de Sam, preflight leído antes y
    smoke después. **Pendiente**: la spec no pasa a `done` hasta entonces.

## Diseño

### Por qué pgcrypto y Vault

`pgcrypto` ya está instalado en `extensions` y es lo que el repo usa para el PIN
(`crypt`/`gen_salt`). `pgp_sym_encrypt` (OpenPGP simétrico, AES-256) usa sesión y
sal aleatorias: dos PIN iguales no producen el mismo texto cifrado, así que
`pin_cifrado` no delata repetidos ni se puede comparar entre filas. La clave no
vive en el código ni en una variable de entorno: la crea la migración en Vault,
como se crearon `kommo_cron_key` y la KEK de No-Olvidar, y la leen sólo dos
funciones privadas (`operario_pin_cifrar`/`operario_pin_descifrar`) sin EXECUTE
para ningún rol de la API. Se descartó un secreto de Vault por operario: mezcla
el ciclo de vida de una credencial operativa con el de Vault y multiplica los
secretos.

### El chequeo de repetidos compara `pin_hash`

El Director sugirió que el chequeo pudiera descifrar `pin_cifrado` cuando
existiera. Se dejó contra `pin_hash` a propósito: es lo que compara el login, así
que es la única comparación que garantiza la invariante del login; descifrar
haría depender el chequeo de que Vault esté disponible y de que `pin_cifrado`
siga al día con `pin_hash`. El costo es un bcrypt por operario activo de la
región, milisegundos.

### La regla duplicada TS ↔ SQL

El default `['operations']` de Operarios queda escrito dos veces: en
`ROLE_MODULE_ACCESS.operarios` de `lib/studio/rbac.ts` y en el contrato de
`operarios_module_authorized`. Es el mismo trade-off que aceptó 0357 con la lista
de módulos candado. **`rbac.test.ts` es la fuente**; la prueba PGlite falla si los
dos defaults dejan de coincidir. Lo mismo vale para el motivo: los límites viven
en `operario_motivo_valido` y en `operarioMotivoProblem`, y una prueba los
enfrenta contra la función SQL real.

### Orden de despliegue: MIGRATE-FIRST

Las RPC de alta y restablecimiento cambian de firma y la app nueva llama a
`admin_ver_operario_pin`. Con la app nueva y sin 0475, alta, restablecimiento y
«Ver PIN» fallan con un error de PostgREST sin cambiar nada (declarado como espera
en `supabase/pending-migration-symbol-declarations.json`). Con 0475 aplicada y la
app de antes, alta y restablecimiento responden «Escribe el motivo…» hasta el
despliegue. Por eso: aplicar 0475 con OK nominal y desplegar enseguida, fuera de
la ventana del corte de dtdcargo.com al servidor propio (jueves 2026-10-15 en la
noche).

## Seguridad

- **Riesgo aceptado por Sam (literal):** «Riesgo: quien lo vea puede entrar como
  ese operario, y la auditoría ya no prueba quién hizo cada entrega.» Desde 0475,
  una entrega registrada con el PIN de un operario prueba que alguien con ese PIN
  la hizo, no que fue el operario: cualquiera con «Ver PIN» pudo usarlo. El
  evento `pin_visto` dice quién lo vio y cuándo, y es lo que permite reconstruir.
- **Respaldos.** Un respaldo de la base lleva `pin_cifrado` y el secreto
  `operario_pin_key` cifrado en `vault.secrets`. Quien tenga el respaldo y la raíz
  de Vault del servidor puede descifrar todos los PIN. Dónde guarda esa raíz el
  Supabase del servidor propio, y si viaja con los respaldos, **NO VERIFICADO**:
  si viaja, el respaldo solo alcanza.
- **P0018.** Antes de «Ver PIN», el rechazo por repetido revelaba a quien edita
  Operarios que un PIN estaba en uso. Con «Ver PIN» esa misma persona puede ver
  cualquier PIN, así que la fuga queda moot (default c); lo que importa es que
  «Ver PIN» sí deja evento.
- **`service_role`.** No lee `pin_hash` ni `pin_cifrado`, no inserta operarios y
  sólo actualiza columnas que no son credencial (default d). Ningún código lo
  usaba (verificado por grep).
- **El PIN en tránsito.** Viaja en la respuesta de la RPC y de la server action,
  no se escribe en logs, tablas, URL ni almacenamiento del navegador (pruebas de
  actions y UI). Los logs del gateway del servidor propio no se revisaron (NO
  VERIFICADO).

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0475_pin_operarios_endurecer.sql` | nuevo · la migración |
| `supabase/tests/0475_pin_operarios_endurecer.test.sql` | nuevo · contrato SQL |
| `lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts` | nuevo · PGlite: texto, contrato, control rojo, preflights, mutantes, propiedad y espejo del motivo |
| `supabase/migrations-baseline.json` | espera `0475_pin_operarios_endurecer` |
| `supabase/pending-migration-symbol-declarations.json` | espera de `admin_ver_operario_pin` (AMARILLO) |
| `lib/studio/operario-pin.ts` | P0018, motivo (espejo), códigos, copy, `saveWithFreshOperarioPin`, `ViewPinResult` |
| `lib/studio/operario-pin-generator.ts` | `saveWithGeneratedOperarioPin` |
| `app/studio/(app)/operarios/actions.ts` | motivo, alta generada en el servidor, reintento, reactivar, `viewOperarioPinAction` |
| `app/studio/(app)/operarios/_components/OperariosClient.tsx` | botón «Ver PIN»; toggle de baja abre «Reactivar» |
| `app/studio/(app)/operarios/_components/ResetPinDrawer.tsx` | motivo, modo «Reactivar», aviso de «Ver PIN» |
| `app/studio/(app)/operarios/_components/NewOperarioDrawer.tsx` | sin `Math.random`; modos generar/escribir; motivo |
| `app/studio/(app)/operarios/_components/PinViewDialog.tsx` | nuevo · «Ver PIN» |
| `app/studio/(app)/operarios/_components/PinRevealBlock.tsx` | nuevo · PIN en grande con «Copiar PIN» |
| `app/studio/(app)/operarios/_components/MotivoField.tsx` | nuevo · campo motivo |
| `app/studio/(app)/operarios/_components/*.test.tsx` | `ResetPinDrawer` actualizada; `NewOperarioDrawer` y `PinViewDialog` nuevas |
| `app/studio/(app)/operarios/__tests__/reset-pin-actions.test.ts` | casos de P0018, motivo, reactivar, alta y «Ver PIN» |
| `lib/studio/__tests__/operario-pin.test.ts` | reintento y motivo |
| `lib/studio/rbac-actions-guard.test.ts` | inventario 429 → 430 con la justificación |
| `lib/studio/operario-queries.ts` | comentario: RLS por matriz y columnas nombradas |
| `app/studio/(app)/operarios/layout.tsx` | comentario del gate |
| `docs/specs/0515-pin-operarios-endurecer/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0515-pin-operarios-endurecer.md` | handoff |

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| AUD-01 §1, §4 (atomicidad) | cumplimiento | eventos por RPC en la misma transacción; prueba de fallo del log con rollback (contrato §12) |
| AUD-01 §2 (credenciales, acceso, consultas sensibles) | cumplimiento para alta, restablecimiento, reactivación y «Ver PIN» | `operario_created`, `operario_pin_reset`, `operario_reactivated`, `pin_visto` |
| AUD-01 §3 (`reason`) | cumplimiento | motivo obligatorio en los cuatro eventos (decisión 4) |
| AUD-01 §5 (sin secretos) | cumplimiento | ni PIN ni hash en los datos del evento; el motivo no puede llevar el PIN |
| AUD-01 §7 (flujos modificados) | cumplimiento para lo que cambia; no conformidad preexistente fuera de alcance | desactivar y editar siguen sin evento (default a, SDD aparte) |
| AUD-02 §4 y §7 (revelación sensible) | cumplimiento del registro; excepción a decidir en la reautenticación | `pin_visto` guarda actor, alcance, motivo y resultado, nunca el PIN; AUD-02 pide reautenticación para revelar campos sensibles del log; «Ver PIN» no la pide (decisión pendiente) |
| BTN-01 | cumplimiento | una primaria por diálogo («Ver PIN», «Restablecer PIN», «Reactivar con PIN nuevo», «Crear operario»); Cancelar a la izquierda |
| FRM-01, ERR-01 | cumplimiento | errores en su campo, con tuteo; el botón espera un motivo válido |
| CMP-01 | cumplimiento | `ConfirmDialog`, `SegmentedControl`, `ErrorAlert`, `DrawerShell`, `useDialogA11y` |

## Revisión de datos (`/revisar-datos-ve`)

Advisory; no afirma cumplimiento. Alcance: la credencial de acceso de los
operarios (PIN), su copia recuperable y lo que la auditoría guarda de ellos.

| Punto | Estado | Evidencia |
|---|---|---|
| `pin_hash` y `pin_cifrado` legibles desde la API | CORRECTO tras aplicar 0475 | `0475_pin_operarios_endurecer.sql` § 11 (grant por columna) y contrato §1-§2; NO VERIFICADO contra producción hasta aplicar |
| PIN recuperable (cifrado reversible) | ENCONTRADO, riesgo aceptado por Sam | `pin_cifrado` + `operario_pin_key` en Vault; quien tenga «Ver PIN», o un respaldo con la raíz de Vault, obtiene el PIN |
| El PIN en claro no se persiste ni se audita | CORRECTO | RPC y app: contrato §4, §8, §9; `reset-pin-actions.test.ts`, `PinViewDialog.test.tsx` |
| Minimización en la auditoría | CORRECTO con salvedad | el evento guarda ids, región, rol, almacén, estado y el motivo; el motivo es texto libre y puede llevar datos personales de quien lo escribe (se bloquea el PIN, no otros datos) |
| Valor probatorio de las acciones del operario | ENCONTRADO, riesgo aceptado por Sam | ver Seguridad |
| PIN duplicados ya existentes en producción | NO VERIFICABLE | no se detectan sin el PIN en claro; los PIN anteriores no tienen copia |
| Respaldos | NO VERIFICABLE | dónde vive la raíz de Vault del servidor propio y si viaja con los respaldos |

Marco citado desde `references/`: Ley Especial contra los Delitos Informáticos,
arts. 20-22 (obtención y revelación indebida; quien vea un PIN y lo use o lo
revele cae ahí); PIPL art. 51 (control de permisos y medidas técnicas) por el
equipo de Yiwu. No es asesoría legal.

## Riesgos

- **Ventana de despliegue.** MIGRATE-FIRST: entre aplicar 0475 y desplegar, alta y
  restablecimiento responden «Escribe el motivo…».
- **Locks.** ALTER TABLE, DROP/CREATE POLICY y los GRANT toman ACCESS EXCLUSIVE
  sobre `operario_pins` hasta el COMMIT; el login espera milisegundos dentro del
  `lock_timeout` de 5 s.
- **La carrera no se ejerce con dos conexiones.** PGlite tiene una sola: el
  contrato prueba que el advisory lock existe en `pg_locks`, no que dos sesiones
  se serialicen (un `*_carrera.test.sql` con dblink, patrón 0459, lo cubriría en
  `verify` con Docker).
- **Vault en producción.** El contrato usa Vault real si la base lo trae y, si no,
  el stub de 0472; en PGlite corrió con el stub. La creación de la clave en el
  Supabase del servidor propio se verifica en el postflight al aplicar.
- **Ancho de la columna de acciones.** 290 px estimados para «Ver PIN»,
  «Restablecer PIN» y el lápiz, con `nowrap`; no se midió en navegador.

## Decisiones que necesitan a Sam

1. **Reautenticación para «Ver PIN».** AUD-02 la pide para revelar campos
   sensibles del log; «Ver PIN» hoy sólo pide sesión, permiso y motivo. ¿Se exige
   volver a autenticarse (por ejemplo, contraseña o segundo factor) antes de ver?
2. **Rotación de la clave.** `operario_pin_key` no rota sola; rotarla exige una
   migración que vuelva a cifrar. ¿Con qué frecuencia, o sólo ante incidente?
3. **Retención del motivo.** El motivo es texto libre en la auditoría (clase A,
   sin purga hasta el calendario de AUD-02). ¿Alcanza la advertencia de no
   escribir el PIN, o se limita a una lista de motivos?
