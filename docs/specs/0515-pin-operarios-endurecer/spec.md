---
sdd: "0515"
title: "PIN de operarios endurecido: matriz de módulos, «Ver PIN» con contraseña y auditado, motivo de la lista y sin repetidos"
status: in-progress
author: "Sam (founder) + Claude Opus 5.5 (Worker)"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: ["0139", "0166", "0174", "0235", "0251", "0252", "0412", "0505", "0513"]
confidencialidad: interno
---

# SDD-0515 — PIN de operarios endurecido

> El PIN de 4 dígitos con que los operarios entran a `/m/cn` y `/m/ve` deja de
> poder leerse desde la API; la base autoriza con la misma matriz de módulos que
> la app; quien tenga Operarios puede ver un PIN si vuelve a escribir su
> contraseña y elige un motivo, y eso queda en la auditoría; alta,
> restablecimiento y reactivación piden un motivo de la lista y dejan su evento
> sin el PIN; no puede haber dos operarios activos con el mismo PIN en el mismo
> tenant y región; y cada fila y cada PIN mostrado dicen por qué app entra el
> operario.

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

**Drift del validador.** Leído por el Director el 2026-10-14 a las 20:05:15Z,
READ ONLY: `md5(prosrc)` de `validate_operario_pin_format(text)` en producción es
`2c22a7b2b639e69464ced0e77173bbaf`, no el `62f64d916edf371cb7a2b8d4b784c18d` de
`0037_harden_operario_pin_validator.sql` (reafirmado sin cambios en 0271, 0280,
0287 y 0288). El cuerpo vivo, reconstruido hasta dar ese md5 exacto, es el de
0037 con el comentario «(top 10 + secuenciales obvios)», sin los tres
subcomentarios y con la lista en cinco renglones de 5/5/5/5/4: **no rechaza
«0987» y repite «7777»** (23 PIN distintos). Mismos INVOKER, IMMUTABLE y
`search_path = public`. El preflight de 0475 acepta los dos cuerpos de origen y
rechaza cualquier otro; 0475 instala el del repo (24, con «0987») más «Elige», que
es el que espeja `lib/studio/operario-pin.ts`. Hasta aplicar, el espejo de la app
es más estricto que la base en un solo PIN, que el generador nunca propone.

**Hallazgo en producción (Director, 2026-10-14).** Un operario de China probaba su
PIN en `/m/ve/login`, donde no existe (`verify_operario_pin` compara dentro de
tenant + región), y la columna «Rol» de Studio › Operarios mostraba «Operario» a
un camionero y a un bodeguero: sólo distinguía `supervisor`. La pantalla tampoco
decía por qué app entra cada uno, y su descripción sólo nombraba `/m/cn`.

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
5. «Sí, pedir la contraseña (Recomendado)»: «Ver PIN» vuelve a pedir la
   contraseña del Studio, y la base lo exige.
6. «Lista + «Otro» con texto (Recomendado)»: el motivo es un código de una lista
   fija —«Se le olvidó», «Empleado nuevo», «Revisión de seguridad», «Otro»— y sólo
   «Otro» lleva texto. El mismo campo en el alta, el restablecimiento y «Ver PIN».
7. «Sólo si hay sospecha o sale alguien con acceso (Recomendado)»: la clave del
   PIN cifrado no rota con calendario.

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
  actualiza las columnas que no son credencial; conserva DELETE y, como hoy,
  TRUNCATE, REFERENCES, TRIGGER y MAINTAIN (ACL viva `arwdDxtm`, leída por el
  Director): el preflight no los prohíbe y PostgREST no los expone.
- **Matriz en la base.** `operarios_module_authorized(tenant, 'view'|'edit')`
  reproduce `canAccessModule`/`canEditModule` con el patrón de
  `document_entity_authorized` (`0444_unlinked_document_entity_rbac.sql`): admin
  siempre, support nunca edita, desvío de 0357 si existe y, si no, el default
  `['operations']`.
- **PIN recuperable.** `pin_cifrado` (bytea) guarda el PIN con
  `pgp_sym_encrypt` (AES-256) y la clave `operario_pin_key` que la migración crea
  en Vault con 32 bytes aleatorios. Lo escriben sólo `admin_create_operario` y
  `admin_reset_operario_pin`.
- **«Ver PIN».** `admin_ver_operario_pin(operario, motivo, texto)`: SECURITY
  DEFINER, `search_path` vacío, la matriz en **edición** (la misma regla que
  restablecer), la **contraseña confirmada hace 5 minutos o menos**
  (`operario_password_reciente()`: un `amr` `password` en `auth.jwt()`; si no,
  P0022 «Confirma tu contraseña para ver el PIN.»), motivo de la lista, evento
  `pin_visto` en la misma transacción sin el PIN; devuelve el PIN o `NULL` si es
  anterior a 0475.
- **Motivo de la lista.** Alta, restablecimiento y «Ver PIN» reciben un código
  (`olvido`, `empleado_nuevo`, `revision_seguridad`, `otro`) y, sólo con `otro`,
  un texto de 4 a 200 caracteres sin el PIN (`operario_motivo_valido`, P0020). Las
  RPC de alta y restablecimiento cambian de firma (`p_motivo`, `p_motivo_texto`, y
  `p_reactivar` en el restablecimiento); las firmas viejas se quitan para que no
  quede una puerta sin motivo. El evento guarda el código en el payload y, en el
  `reason`, el código o el texto de «Otro».
- **Sin repetidos.** Alta y restablecimiento rechazan con **P0018** un PIN que
  coincida con otro operario **activo** del mismo tenant y región, con un advisory
  lock transaccional por tenant y región.
- **Reactivar.** `admin_set_operario_active` (0351) ya no reactiva (P0019);
  `admin_reset_operario_pin(p_reactivar => true)` reactiva con un PIN nuevo y
  libre y deja `operario_reactivated`.
- **Validador.** `validate_operario_pin_format`, reescrita desde
  `0037_harden_operario_pin_validator.sql`, dice «Elige» en vez de «Elegí» y
  vuelve a la lista de 24 del repo (ver drift arriba).
- **App.** «Ver PIN» por operario: motivo de la lista y la contraseña del Studio
  → modal con «Copiar PIN»; se borra al cerrar; aviso para un PIN anterior. La
  server action confirma la contraseña con Supabase Auth en una sesión aparte
  (`lib/db/password-confirmed.ts`) y llama a la RPC con esa sesión. Campo motivo
  (lista + texto de «Otro») en el cajón de restablecer y en el alta; el alta
  genera el PIN en el servidor (sin `Math.random`) con reintento ante P0018 o lo
  deja escribir; el toggle de un operario de baja abre «Reactivar».
- **Por qué app entra.** Cada fila dice «Entra por dtdcargo.com/m/cn/login» o
  «…/m/ve/login» según `region`; el bloque del PIN (alta, restablecimiento y «Ver
  PIN») dice «Entra por https://dtdcargo.com/m/<región>/login» con «Copiar
  enlace»; la descripción de la página nombra las dos apps. La columna «Rol»
  muestra Operario, Supervisor, Bodeguero o Camionero.

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
   operario, antes de la contraseña y antes del motivo.
4. **Auditoría en la misma transacción, sin el PIN.** `operario_created`,
   `operario_pin_reset`, `operario_reactivated` y `pin_visto` dicen quién, a qué
   operario, en qué tenant, con qué motivo y desde dónde; ni el PIN ni el hash
   aparecen en los datos del evento; si el evento no se puede escribir, el PIN no
   cambia, el operario no se crea y «Ver PIN» no devuelve nada.
5. **Motivo de la lista.** Sin código, con uno que no está en la lista, con
   «Otro» y un texto de menos de 4 o más de 200 caracteres, o con el PIN en el
   texto, la base rechaza con P0020 y no cambia nada; el código se compara sin
   mayúsculas ni espacios; un código fijo ignora el texto; con «Otro», el evento
   guarda el texto. La llamada de la app de antes (sin `p_motivo`, o con texto
   libre) también rebota. El espejo de la app coincide con la función SQL real en
   PGlite, código por código y con la misma lista.
6. **«Ver PIN» exige la contraseña reciente.** Sin `amr`, con `amr` vacío o que no
   es lista, con métodos que no son `password`, con una contraseña de hace más de
   5 minutos, con una hora futura (más de 60 s) o mal formada, la base responde
   P0022 sin evento; con una contraseña de hace 299 s, o entre otros métodos,
   pasa. La matriz se mira antes que la contraseña; restablecer no la pide. La
   action confirma la contraseña tal cual (sin recortar) en un cliente que no
   guarda sesión, llama a la RPC con ese cliente y no con la sesión del navegador,
   y cierra esa sesión siempre (`scope: "local"`), incluso si la llamada falla;
   una contraseña equivocada, una cuenta sin correo, la sesión de otra cuenta o
   Supabase Auth sin responder no llegan a la RPC; la contraseña no aparece en la
   consola, el resultado ni el DOM, y el diálogo la borra del campo después de
   cada respuesta.
7. **PIN recuperable.** El PIN restablecido o creado queda cifrado con la clave
   de Vault y «Ver PIN» lo devuelve; un PIN anterior devuelve `NULL` y la consulta
   igual queda registrada; la clave se crea una sola vez aunque la migración corra
   dos veces.
8. **Sin repetidos.** P0018 contra otro operario activo del mismo tenant y región;
   se acepta en otra región, otro tenant o contra uno de baja; un operario puede
   volver a su propio PIN; el lock está en `pg_locks` hasta el COMMIT.
9. **Reactivar exige PIN nuevo.** El toggle responde P0019 y deja al operario de
   baja; restablecer con `p_reactivar` lo reactiva con un PIN libre y entra;
   restablecer sin `p_reactivar` no reactiva; desactivar sigue igual.
10. **Login y validador.** `verify_operario_pin` no cambia y entra con el PIN
    nuevo; el validador dice «Elige» y rechaza los mismos 24 PIN; el preflight
    acepta el cuerpo vivo de producción y el del repo, y aborta con un tercero.
11. **Por qué app entra y el rol.** Cada fila dice la ruta de login de su región,
    y sólo esa; el bloque del PIN la dice completa y la copia; el alta del Studio
    (China) muestra `/m/cn/login`; con la variable vacía, la ruta cae a
    `https://dtdcargo.com`; la columna «Rol» nombra los cuatro roles de
    `operario_pins_role_check` (0025).
12. **La app.** «Ver PIN» pide motivo y contraseña, muestra y copia el PIN y lo
    borra al cerrar; el aviso de PIN anterior; el motivo en restablecer y en el
    alta; el alta sin `Math.random`; el reintento ante P0018; «Reactivar» manda
    `reactivar=1`. Pruebas de actions y de UI; 34 mutantes de la app mueren.
13. **Preflight y postflight.** Un ANTES con drift (cuerpos de 0351 y 0325, un
    tercer cuerpo del validador, policy, columnas, `pin_cifrado` previo, RLS
    forzada, entidad `operario`, anon, Vault ausente, clave previa, sobrecarga)
    aborta sin cambiar nada; re-aplicar es inocuo.
14. **Aplicada a producción** con OK nominal de Sam, preflight leído antes y
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

### La contraseña: la exige la base, la confirma Supabase Auth

La UI no basta: la RPC se puede llamar desde la consola del navegador con la
sesión del Studio. Por eso la regla vive en la base: `admin_ver_operario_pin` lee
`auth.jwt()->'amr'` y exige una entrada `{"method": "password", "timestamp": t}`
con `t` entre hace 300 s y dentro de 60 s (margen de reloj). Si no, P0022.

**`amr` en el Supabase propio.** El servidor corre `supabase/gotrue:v2.197.0`
(`infra/dtd-cargo/compose.supabase.yml`). En el código fuente de esa versión
(`supabase/auth`, etiqueta v2.197.0) el access token lleva `amr` como lista de
`{method, timestamp}` (`internal/models/sessions.go`, `AMREntry`), el inicio con
contraseña registra el método `password` y `CalculateAALAndAMR` pone como
`timestamp` la hora Unix de ese registro (`internal/models/sessions.go`, ~línea
390); `internal/hooks/v0hooks/v0hooks.go` (~líneas 107-108) define el mismo campo
para el hook de claims, y el compose **no** configura ningún hook
(`GOTRUE_HOOK_*`) que pudiera reescribirlo. **Comprobado en el código; NO
VERIFICADO con un JWT vivo**: el smoke lo prueba de punta a punta («Ver PIN» sólo
devuelve el PIN si el `amr` llegó).

**Por qué una sesión aparte.** La server action no vuelve a iniciar la sesión
del navegador: cambiaría sus cookies y, si algún día hay segundo factor, bajaría
su nivel. `withPasswordConfirmedClient` abre una sesión nueva con
`signInWithPassword` (el correo es el de la sesión del navegador) en un cliente
de `@supabase/supabase-js` con `persistSession: false` y sin cookies; comprueba
que el usuario sea el mismo; llama a la RPC con ese cliente, cuyo JWT trae el
`amr` recién emitido, y cierra esa sesión con `signOut({ scope: "local" })` en un
`finally`. La contraseña viaja a Supabase Auth y a ningún otro lado: no se
recorta, no se guarda en estado de React (el campo no es controlado), no va a la
consola ni al resultado, y el diálogo la borra del campo al volver la respuesta.

Se descartó `auth.reauthenticate()` (manda un código por correo: no es «pedir la
contraseña») y volver a firmar la sesión del navegador (cambia sus cookies).

### El motivo es un código

Con texto libre, la auditoría juntaba datos personales de quien escribía y el
PIN se colaba con facilidad. La lista fija (decisión 6) deja en el evento un
código que se puede contar; sólo «Otro» guarda texto, con el mismo tope y el
mismo bloqueo del PIN. La lista vive dos veces —`operario_motivo_valido` y
`OPERARIO_MOTIVOS`— y la prueba PGlite las enfrenta: la misma lista, en el mismo
orden, y la misma respuesta para cada caso.

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
dos defaults dejan de coincidir. Lo mismo vale para el motivo (lista y límites) y
para el validador (`operario-pin.migration.test.ts` recorre los 10.000 PIN).

### La ruta de login por región

`operarioLoginUrl(region)` arma `${NEXT_PUBLIC_SITE_URL}/m/<región>/login`, con
`https://dtdcargo.com` si la variable falta o está vacía (`||`, no `??`). El alta
del Studio crea operarios de China: `admin_create_operario` no recibe región y la
columna toma su default `cn` (0023), así que la action devuelve `region: "cn"`.
Los de Venezuela no se crean desde este formulario.

### Rotación de la clave (decisión 7)

No hay calendario. Se rota si se pierde o filtra un respaldo, si se sospecha una
lectura indebida de la base o si sale alguien con acceso a la raíz de Vault, a la
base como `postgres`/`supabase_admin` o al `.env` del servidor. Se hace con una
migración nueva que, en una transacción, bloquea `operario_pins`, vuelve a cifrar
cada `pin_cifrado` con una clave nueva y la guarda con `vault.update_secret` bajo
el mismo nombre; preflight y postflight por conteos, sin imprimir clave ni PIN.
Rotar no cambia los PIN: si la sospecha es sobre ellos, además se restablecen.
Procedimiento completo: `docs/runbooks/servidor-contabo.md` § 6.

### Orden de despliegue: MIGRATE-FIRST

Las RPC de alta y restablecimiento cambian de firma y la app nueva llama a
`admin_ver_operario_pin`. Con la app nueva y sin 0475, alta, restablecimiento y
«Ver PIN» fallan con un error de PostgREST sin cambiar nada (declarado como espera
en `supabase/pending-migration-symbol-declarations.json`). Con 0475 aplicada y la
app de antes, alta y restablecimiento responden «Elige un motivo de la lista.»
hasta el despliegue. Por eso: aplicar 0475 con OK nominal y desplegar enseguida,
fuera de la ventana del corte de dtdcargo.com al servidor propio (jueves
2026-10-15 en la noche).

## Seguridad

- **Riesgo aceptado por Sam (literal):** «Riesgo: quien lo vea puede entrar como
  ese operario, y la auditoría ya no prueba quién hizo cada entrega.» Desde 0475,
  una entrega registrada con el PIN de un operario prueba que alguien con ese PIN
  la hizo, no que fue el operario: cualquiera con «Ver PIN» pudo usarlo. El
  evento `pin_visto` dice quién lo vio, cuándo y por qué, y es lo que permite
  reconstruir.
- **La contraseña.** Pedirla otra vez frena a quien encuentra un Studio abierto;
  no frena a quien ya conoce la contraseña. Cada confirmación crea una sesión de
  Supabase Auth (una fila en `auth.sessions`, que se revoca al terminar), queda en
  el registro de Auth como inicio de sesión y actualiza `last_sign_in_at`.
  Supabase Auth limita los intentos por IP y el servidor de Next llama desde la
  suya, igual que el login del Studio: muchos «Ver PIN» seguidos de varias
  personas comparten ese límite (el valor exacto en el servidor propio, NO
  VERIFICADO). Si el límite salta, la action dice «No se pudo confirmar tu
  contraseña. Inténtalo de nuevo en unos minutos.» y no hay PIN.
- **Respaldos.** Un respaldo de la base lleva `pin_cifrado` y el secreto
  `operario_pin_key` cifrado en `vault.secrets`. Quien tenga el respaldo y la raíz
  de Vault del servidor puede descifrar todos los PIN. Dónde guarda esa raíz el
  Supabase del servidor propio, y si viaja con los respaldos, **NO VERIFICADO**:
  si viaja, el respaldo solo alcanza. Es un disparador de la rotación (decisión 7).
- **P0018.** Antes de «Ver PIN», el rechazo por repetido revelaba a quien edita
  Operarios que un PIN estaba en uso. Con «Ver PIN» esa misma persona puede ver
  cualquier PIN, así que la fuga queda moot (default c); lo que importa es que
  «Ver PIN» sí deja evento.
- **`service_role`.** No lee `pin_hash` ni `pin_cifrado`, no inserta operarios y
  sólo actualiza columnas que no son credencial (default d). Ningún código lo
  usaba (verificado por grep). Conserva DELETE (borrar filas, igual que hoy) y
  TRUNCATE, que no agrega nada a DELETE para un rol que ya salta la RLS.
- **El PIN en tránsito.** Viaja en la respuesta de la RPC y de la server action,
  no se escribe en logs, tablas, URL ni almacenamiento del navegador (pruebas de
  actions y UI). El enlace de login que se copia no lleva el PIN. Los logs del
  gateway del servidor propio no se revisaron (NO VERIFICADO).

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0475_pin_operarios_endurecer.sql` | nuevo · la migración |
| `supabase/tests/0475_pin_operarios_endurecer.test.sql` | nuevo · contrato SQL |
| `lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts` | nuevo · PGlite: texto, drift del validador, contrato, control rojo, preflights, mutantes, propiedad y espejo del motivo |
| `supabase/migrations-baseline.json` | espera `0475_pin_operarios_endurecer` |
| `supabase/pending-migration-symbol-declarations.json` | espera de `admin_ver_operario_pin` (AMARILLO) |
| `lib/db/password-confirmed.ts` | nuevo · confirmar la contraseña en una sesión aparte |
| `lib/studio/operario-pin.ts` | P0018, lista de motivos (espejo), contraseña (P0022 y copy), ruta de login por región, rótulo del rol, `saveWithFreshOperarioPin`, `ViewPinResult` |
| `lib/studio/operario-pin-generator.ts` | `saveWithGeneratedOperarioPin` |
| `lib/studio/operario-queries.ts` | comentario: RLS por matriz y columnas nombradas; `role` con los cuatro roles |
| `app/studio/(app)/operarios/actions.ts` | motivo de la lista, alta generada en el servidor, reintento, reactivar, `viewOperarioPinAction` con la contraseña |
| `app/studio/(app)/operarios/page.tsx` | descripción con las dos apps |
| `app/studio/(app)/operarios/layout.tsx` | comentario del gate |
| `app/studio/(app)/operarios/_components/OperariosClient.tsx` | «Ver PIN»; toggle de baja abre «Reactivar»; «Entra por …» por fila; rótulo del rol |
| `app/studio/(app)/operarios/_components/EditOperarioDrawer.tsx` | sólo el tipo del rol |
| `app/studio/(app)/operarios/_components/ResetPinDrawer.tsx` | motivo, modo «Reactivar», aviso de «Ver PIN», región |
| `app/studio/(app)/operarios/_components/NewOperarioDrawer.tsx` | sin `Math.random`; modos generar/escribir; motivo; región |
| `app/studio/(app)/operarios/_components/PinViewDialog.tsx` | nuevo · «Ver PIN» con motivo y contraseña |
| `app/studio/(app)/operarios/_components/PinRevealBlock.tsx` | nuevo · PIN en grande con «Copiar PIN» y la ruta de login copiable |
| `app/studio/(app)/operarios/_components/MotivoField.tsx` | nuevo · lista + texto de «Otro» |
| `app/studio/(app)/operarios/_components/*.test.tsx` | `ResetPinDrawer` actualizada; `NewOperarioDrawer`, `PinViewDialog` y `OperariosClient` nuevas |
| `app/studio/(app)/operarios/__tests__/reset-pin-actions.test.ts` | P0018, motivo, reactivar, alta y «Ver PIN» con la contraseña |
| `lib/studio/__tests__/operario-pin.test.ts` | reintento, motivo, contraseña, ruta y rol |
| `lib/studio/rbac-actions-guard.test.ts` | inventario 429 → 430 con la justificación |
| `docs/runbooks/servidor-contabo.md` | § 6 · rotación de `operario_pin_key` |
| `docs/specs/0515-pin-operarios-endurecer/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0515-pin-operarios-endurecer.md` | handoff |

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| AUD-01 §1, §4 (atomicidad) | cumplimiento | eventos por RPC en la misma transacción; prueba de fallo del log con rollback (contrato §12) |
| AUD-01 §2 (credenciales, acceso, consultas sensibles) | cumplimiento para alta, restablecimiento, reactivación y «Ver PIN» | `operario_created`, `operario_pin_reset`, `operario_reactivated`, `pin_visto` |
| AUD-01 §3 (`reason`) | cumplimiento | motivo de la lista obligatorio en los cuatro eventos (decisiones 4 y 6) |
| AUD-01 §5 (sin secretos) | cumplimiento | ni PIN, ni hash, ni contraseña en los datos del evento; el texto de «Otro» no puede llevar el PIN |
| AUD-01 §7 (flujos modificados) | cumplimiento para lo que cambia; no conformidad preexistente fuera de alcance | desactivar y editar siguen sin evento (default a, SDD aparte) |
| AUD-02 §4 y §7 (revelación sensible) | cumplimiento | `pin_visto` guarda actor, alcance, motivo y resultado, nunca el PIN; la reautenticación que pide AUD-02 es la contraseña reciente, exigida por la base (decisión 5) |
| BTN-01 | cumplimiento | una primaria por diálogo («Ver PIN», «Restablecer PIN», «Reactivar con PIN nuevo», «Crear operario»); Cancelar a la izquierda |
| FRM-01, ERR-01 | cumplimiento | errores en su campo (motivo o contraseña), con tuteo y foco en el campo; el botón espera un motivo válido |
| CMP-01 | cumplimiento con una salvedad | `DrawerShell`, `SegmentedControl`, `ErrorAlert`, `useDialogA11y`; el paso de motivo y contraseña de «Ver PIN» es un formulario propio con la estructura de `ConfirmDialog`, porque éste sólo admite un campo de texto |

## Revisión de datos (`/revisar-datos-ve`)

Advisory; no afirma cumplimiento. Alcance: la credencial de acceso de los
operarios (PIN), su copia recuperable, la contraseña del personal que la mira y
lo que la auditoría guarda de ellos.

| Punto | Estado | Evidencia |
|---|---|---|
| `pin_hash` y `pin_cifrado` legibles desde la API | CORRECTO tras aplicar 0475 | `0475_pin_operarios_endurecer.sql` § 11 (grant por columna) y contrato §1-§2; NO VERIFICADO contra producción hasta aplicar |
| PIN recuperable (cifrado reversible) | ENCONTRADO, riesgo aceptado por Sam | `pin_cifrado` + `operario_pin_key` en Vault; quien tenga «Ver PIN» y su contraseña, o un respaldo con la raíz de Vault, obtiene el PIN |
| El PIN en claro no se persiste ni se audita | CORRECTO | RPC y app: contrato §4, §8, §9; `reset-pin-actions.test.ts`, `PinViewDialog.test.tsx` |
| La contraseña del personal | CORRECTO | sólo viaja a Supabase Auth; ni estado, ni consola, ni resultado, ni auditoría (pruebas de actions y del diálogo) |
| Minimización en la auditoría | CORRECTO con salvedad | el evento guarda ids, región, rol, almacén, estado y un código de motivo; sólo «Otro» guarda texto, que puede llevar datos personales de quien lo escribe (se bloquea el PIN, no otros datos) |
| Valor probatorio de las acciones del operario | ENCONTRADO, riesgo aceptado por Sam | ver Seguridad |
| PIN duplicados ya existentes en producción | NO VERIFICABLE | no se detectan sin el PIN en claro; los PIN anteriores no tienen copia |
| Respaldos | NO VERIFICABLE | dónde vive la raíz de Vault del servidor propio y si viaja con los respaldos; disparador de rotación |

Marco citado desde `references/`: Ley Especial contra los Delitos Informáticos,
arts. 20-22 (obtención y revelación indebida; quien vea un PIN y lo use o lo
revele cae ahí); PIPL art. 51 (control de permisos y medidas técnicas) por el
equipo de Yiwu. No es asesoría legal.

## Riesgos

- **Ventana de despliegue.** MIGRATE-FIRST: entre aplicar 0475 y desplegar, alta y
  restablecimiento responden «Elige un motivo de la lista.».
- **`amr` sin JWT vivo.** Si el Supabase propio no emitiera el `amr` como dice su
  código, «Ver PIN» respondería siempre «Confirma tu contraseña para ver el PIN.»
  y no mostraría nada (falla cerrado). El smoke lo detecta.
- **Límite de intentos de Supabase Auth**, compartido con el login del Studio
  (ver Seguridad).
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
- **Ancho de la grilla.** La columna de acciones (290 px estimados) y la línea
  «Entra por …» bajo el nombre no se midieron en navegador.

## Decisiones resueltas

Las tres preguntas que esta spec le hacía a Sam quedaron resueltas el
2026-10-14: reautenticación para «Ver PIN» → decisión 5; forma y retención del
motivo → decisión 6 (sólo «Otro» guarda texto; la retención es la de AUD-02, sin
purga propia); rotación de la clave → decisión 7.
