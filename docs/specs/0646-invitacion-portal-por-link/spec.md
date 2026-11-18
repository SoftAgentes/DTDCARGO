---
sdd: "0646"
title: "Invitación al portal por link: el cliente del legado completa SU ficha con su código de siempre"
status: in-progress
author: "Claude (Worker del DG) + Sam"
created: 2026-11-16
updated: 2026-11-17
supersedes: null
superseded_by: null
related: ["0042", "0151", "0246", "0253", "0255", "0258", "0483"]
confidencialidad: interno
---

# SDD-0646 — Invitación al portal por link

> El equipo deja en la ficha el código real del cliente (o crea la ficha con ese código), genera
> desde la ficha un link de registro y lo manda por WhatsApp. El cliente llena sus datos con su
> código ya fijo y queda dentro de su portal. El equipo revisa después qué cambió.

**Estado:** `in-progress`. La primera entrega (migración 0552) está fusionada y publicada. **Enmienda
del 2026-11-17 (D-1, opción C):** el correo que escribe el cliente se comprueba antes de servir para
entrar (§5.1, §4.1). Su migración, la 0559, **no está aplicada**: aplicarla en producción y fusionar a
`main` necesitan autorizaciones separadas de Sam a través del DG.

## 1. Problema

En agosto de 2026 entraron 361 clientes del sistema anterior. Hoy tienen código DTD-8001 a DTD-8361 y su
código viejo quedó como alias en `client_markbox_history`, que lo sigue resolviendo (SDD-0258, migr.
0367 y 0379). Casi ninguno tiene correo, empresa ni datos cargados, y ninguno tiene acceso al portal.

La invitación de hoy (SDD-0042) sale por correo, y de estos clientes no hay correo. El registro público
(`/registro`) les crearía una ficha nueva con un código nuevo: el duplicado que la SDD-0246 trata de
evitar.

## 2. Decisión de Sam (2026-11-16)

1. Alejandro (operaciones) deja en la ficha el código real del cliente, el viejo de siempre, o crea la
   ficha con ese código si no existe.
2. Desde la ficha genera un link de registro y lo manda por WhatsApp.
3. El cliente llena sus datos con su código ya fijo y queda dentro de su portal.
4. Alejandro revisa qué cambió.

## 3. Alcance

### 3.1 Link de registro (Studio, ficha del cliente)

- En «Acceso al portal» (`PortalAccessCard.tsx`), para el cliente **sin acceso activo**, el botón
  «Generar link de registro». Da un link copiable y un «Abrir WhatsApp con el link». No envía correo.
- Token de 32 bytes aleatorios (256 bits) en base64url. La base guarda **solo su sha256**. Un solo uso,
  vence a los 14 días, regenerar revoca el anterior (un índice único parcial impide dos vivos).
- La URL es `/registro/link/<token>`. **Nunca lleva el Shipping Mark**: si lo llevara, bastaría cambiar
  el número para quedarse con el portal de otro cliente.
- Lo emite la RPC `portal_registration_link_create` (roles admin, commercial y operations, tenant del
  usuario; rechaza al cliente con acceso activo, a la ficha borrada y a la fusionada).
- El bloque sólo se le muestra a quien puede editar clientes (`canEditModule`); quien sólo ve la ficha no
  lo recibe. La acción y la RPC lo exigen igual.

### 3.2 Página pública

- `GET /registro/link/[token]` **solo lee** (`portal_registration_link_peek`): el robot de vista previa
  de WhatsApp hace GET y no debe gastar el link (lección de la SDD-0253). No se indexa.
- Muestra el Shipping Mark de la ficha **congelado**: sale de la base, no de la URL ni del formulario.
  Es lo **único** de la ficha que ve la página («Tu Shipping Mark es …»): `peek` no devuelve el nombre,
  para que no salga a quien abra el link (revisión independiente, 2026-11-16).
- Pide los datos del registro actual con los mismos campos (`RegisterForm.tsx` exporta `Field`,
  `CedulaInput`, `PhoneInput`, `CiudadEntrega`, `TypeCard`, `LeyendaObligatorio`) y valida con
  `validateRegisterInput`: tipo, nombre o empresa, cédula/RIF, correo, WhatsApp, teléfono de oficina
  opcional, ciudad y estado. Suma una dirección de entrega opcional, libre, de hasta 300 caracteres.
- Un solo mensaje para todo link que no sirve (no existe, usado, revocado, vencido, ficha borrada o ya
  con acceso), para no confirmarle a un curioso cuáles tokens son reales.
- El `POST` (`registerByLinkAction`) completa la ficha **existente**. No llama a `next_markbox_service`
  ni inserta en `clients`. Después crea la cuenta de Auth con contraseña aleatoria (nunca la cédula),
  vincula `client_users` con `portal_registration_link_bind` y acuña un magic-link de un clic.
- **Enmienda D-1 (opción C).** La cuenta de Auth no nace con el correo que escribió el cliente: nace con
  una dirección interna que no recibe correo, y el magic-link de un clic se acuña para esa dirección y se
  entrega en la misma página. El correo queda en la ficha, «sin comprobar», y le llega un enlace de
  comprobación (§5.1).
- Mensaje final: «¡Ya eras cliente de DTD Cargo! Este es tu código de siempre: <código>. Ya puedes ver tu
  portal.» y el botón «Entrar a mi portal». Debajo, que le enviamos un correo para comprobar su dirección
  y que lo abra en ese mismo teléfono o computadora, con su portal abierto.
- El POST pasa por el **throttle por IP** de `/registro` (`portal_registro_throttle`, 5 por hora, fail-open
  si la lectura falla) antes de tocar la ficha.
- Si el correo ya tiene una cuenta de Auth, la base lo rechaza **antes** de gastar el link. El cliente lee
  un mensaje **genérico** en el formulario, no en el campo del correo, y sólo después del throttle: un
  link vivo no sirve para averiguar qué correos tienen cuenta. Si la cuenta o el vínculo fallan después,
  la ficha queda completa, se anota `access_error` y el cliente lee que lo contactamos por WhatsApp.
- Frontera: la ruta sigue el patrón de `app/registro` (ruta pública respaldada por la base, admin
  client con el visitante anónimo y el token como control), que la regla ESLint de frontera excluye
  por diseño. La página y el formulario no importan `@/lib/studio`; la acción importa
  `generatePortalAccessLink` de `@/lib/studio/portal-invite-email`, como ya lo hace `app/entrar`.

### 3.3 Duplicados

`find_duplicate_client_service` devuelve una sola ficha y la propia ficha del legado suele coincidir
consigo misma (mismo teléfono). La regla pasa a `find_duplicate_client_except_service(tenant, excepto,
…)`, con el cuerpo de la 0342 más `c.id is distinct from p_except_client_id`, y la función vieja la
llama con `null`: mismo resultado para el registro de siempre, una sola definición.

Si la cédula, el correo o el teléfono coinciden con **otra** ficha, no se fusiona nada: el link guarda
`duplicate_client_id` y `duplicate_matched_by`, y el par aparece en «Posibles duplicados»
(`client_duplicate_candidates`, que desde la 0349/0362 compara cualquier par). La cédula de otra ficha
no se copia (`rif_skipped`); tampoco si el índice único la rechaza por una ficha borrada que la retiene.

### 3.4 Revisión del equipo: «Registros por link»

`/studio/clientes/registros-link` (menú «Mantenimiento» de Clientes). Cada link usado muestra lo que
tenía la ficha al lado de lo que escribió el cliente, resalta lo que cambió, avisa del posible
duplicado, de la cédula no copiada y del acceso fallido, y ofrece «Marcar comprobado»
(`portal_registration_link_mark_reviewed`, mismos roles). Filtro «Pendientes» / «Todos».

- **Estado del correo (enmienda D-1).** Cada tarjeta dice «Correo comprobado» o «Correo sin comprobar»
  con el estado real (`portal_email_check_estado`); ya no usa la regla de «volvió a entrar más de 1 h
  después». Si al confirmar ese correo ya tenía otra cuenta, o la comprobación quedó a medias, la tarjeta
  avisa y no se fusiona nada. Si el equipo revocó y volvió a invitar por correo a un cliente que nunca
  comprobó el suyo, la tarjeta sigue diciendo «Correo nunca comprobado». Quien puede editar clientes tiene
  «Reenviar comprobación» (`resendEmailCheckAction`).
- La pantalla es entera de datos personales: quien no puede ver nombres de clientes
  (`readCanSeeClientNames`, equipo de China sin rol admin, SDD-0531 / PIPL) no entra; el servidor no lee
  la tabla y muestra «Sin acceso a esta lista».
- «Marcar comprobado» sólo aparece para quien puede editar clientes.

**Por qué no `client_change_requests` (SDD-0151).** Aquella tabla es una propuesta que el asesor
aprueba **antes** de tocar `clients`, con tres campos y una sola abierta por cliente. Aquí el cliente
completa la ficha en el acto (es su primer acceso) y el equipo revisa **después**, con correo, ciudad,
estado y dirección. Meterlo ahí cambiaría el sentido de `pending` para las pantallas que ya la leen. El
historial de la SDD-0483 está en planes, no en `main`. Por eso el token y la revisión viven en la misma
fila de `client_registration_links`: un link usado **es** el registro a revisar.

### 3.5 Código real

- **Alta nueva.** El drawer de «Nuevo cliente» acepta un Shipping Mark opcional. Con él,
  `createClientAction` no llama a ningún generador; valida con `validateNuevoMarkbox`; si el código es
  el retirado de otra ficha, responde «Ese es el código viejo de la ficha DTD-8xxx. Ábrela y recupéralo…»
  en vez de crear otra ficha. Las guardas de aliados e insignias las aplica el trigger de `clients`
  (0362/0371). Un trigger nuevo, `clients_guard_markbox_retirado_t` (BEFORE INSERT), rechaza en la base
  cualquier ficha nueva con un código retirado: `clients_tenant_id_markbox_key` solo mira `clients`.
- **Cliente existente con DTD-8xxx.** `rename_client_markbox` (cuerpo de la 0371) rechazaba cualquier
  código del historial, incluso el retirado del MISMO cliente. Ahora, si el código está retirado y es
  de esa ficha, su fila **no se borra** (0367:49-50): queda marcada con `restored_at` y `restored_by`, y
  el código actual (DTD-8xxx) entra al historial. El índice único del historial pasa a mirar sólo lo
  retirado vigente (`restored_at is null`), para que el mismo código pueda volver a retirarse. Si es de
  otro cliente, sigue el 23505 de siempre. El resultado agrega `recovered`. `resolve_markbox` resuelve
  los dos códigos a la misma ficha (contrato §D).

## 4. Migración 0552 (`supabase/migrations/0552_registro_portal_por_link.sql`)

- Preflight: compara por md5 los cuerpos vivos de `rename_client_markbox` (0371,
  `ed233ed2354925960ffc4cd798f8549f`) y `find_duplicate_client_service` (0342,
  `61d5707d7c63d2c3647a554a497c7569`); si producción tiene otro, aborta sin tocar nada.
- Tabla `client_registration_links` con RLS: el equipo solo lee su tenant; nadie escribe por PostgREST.
- RPC: `create` y `mark_reviewed` para `authenticated`; `peek`, `complete`, `bind` y `access_error`
  solo para `service_role`. Las funciones nuevas llevan `search_path = ''` y todo nombre calificado;
  `rename_client_markbox` conserva el de la 0371.
- `client_markbox_history` suma `restored_at` y `restored_by`; el índice `client_markbox_history_uq` se
  recrea parcial (`where restored_at is null`).
- Sin backfill ni locks de tabla largos. Desarme: el de la 0552 en `supabase/desarmes/` (no deshace
  datos: las fichas completadas, los accesos creados y los códigos recuperados se quedan).
- Gate de pendientes: entrada en `supabase/migrations-baseline.json`. MIGRATE-FIRST: sin la 0552, el
  botón dice «Esta acción todavía no está disponible», la lista avisa que falta la migración y el link
  público muestra «Enlace no disponible».

## 4.1 Migración 0559 (`supabase/migrations/0559_registro_link_correo_comprobado.sql`) — enmienda D-1

**No aplicada a producción.** Espera declarada en `supabase/migrations-baseline.json`. Orden: la
migración primero.

- Preflight: exige la tabla de la 0552 y compara por md5 el cuerpo vivo de
  `portal_registration_link_bind` (0552, `9dc4862d3d6d1a9fe43726203322b2cd`); si producción tiene otro,
  aborta sin tocar nada.
- Tabla `client_email_checks`, una fila por cliente registrado por link, con RLS encendida y **sin
  policies**: nadie la lee ni la escribe por PostgREST. Guarda la cuenta de Auth que nació del link, su
  dirección interna, el correo por comprobar, el sha256 del token del enlace (el token no se guarda), su
  vencimiento y uso, cuándo se comprobó, si hubo choque con otra cuenta y si quedó para revisión.
- El equipo ve **solo el estado** y la fecha del último envío, por `portal_email_check_estado`
  (`authenticated`, tenant del usuario). Ni el correo por comprobar ni el hash del token salen por ahí: el
  correo se ve donde ya se veía, en la ficha, con los permisos de siempre.
- `portal_registration_link_bind` acepta la cuenta con dirección interna y anota la fila «sin comprobar».
  Sigue aceptando la cuenta con el correo real, para no romper la app anterior entre la migración y la
  publicación; esa queda anotada igual.
- RPC solo para `service_role`: `portal_email_sin_comprobar`, `portal_email_check_auth_interno`,
  `portal_email_check_issue` (7 días, un enlace vivo por cuenta), `portal_email_check_peek` (lee; el
  correo por comprobar solo para la sesión del titular),
  `portal_email_check_claim`, `portal_email_check_confirm`, `portal_email_check_release` y
  `portal_email_check_revisar`. Reclamar y confirmar reciben el usuario de la sesión del portal y exigen
  que sea el titular de la comprobación. Para el equipo (`authenticated`, roles admin/commercial/operations
  y tenant): `portal_email_check_prepare`.
- Trigger `clients_email_vuelve_sin_comprobar_t` (AFTER UPDATE OF email): si cambia el correo de la ficha,
  la fila vuelve a «sin comprobar» y el enlace emitido deja de servir.
- Escribe datos: una fila «sin comprobar» por cada cuenta por link que ya existe. No toca `clients`,
  `client_users` ni Auth.
- Retira `portal_registration_link_email_status` (la heurística de la 0552).
- Desarme: el de la 0559 en `supabase/desarmes/`. No devuelve el correo a las cuentas que ya llevan
  dirección interna: su cabecera dice qué decidir antes de usarlo.
- MIGRATE-FIRST: sin la 0559, el registro por link guarda la ficha y avisa «te contactamos» (no activa el
  acceso), el enlace de comprobación muestra «Enlace no disponible», «Reenviar comprobación» dice que
  todavía no está disponible, la tarjeta dice que no se sabe si el correo está comprobado y `/entrar` y
  la invitación por correo siguen como siempre.

**Cuentas por link creadas antes de la 0559.** Quedan «sin comprobar» al aplicar la migración. El paso
que la migración no puede hacer (necesita la API de Auth) lo completa la corrida única
`infra/ops/portal-correo-comprobacion/pasar-cuentas-a-direccion-interna.mjs`: ensayo por defecto,
recorre todas las filas por lotes y solo termina en 0 si no queda ninguna pendiente. La corre el DG con
OK nominal de Sam **inmediatamente después de publicar, en la misma ventana** (aplicar → publicar →
corrida). «Reenviar comprobación» hace ese mismo paso, cuenta por cuenta.

## 5. Privacidad (skill `revisar-datos-ve`, revisión acotada a este cambio)

| Punto | Estado | Evidencia |
|---|---|---|
| Inventario | CORRECTO | Datos nuevos: copia en `prev_data`/`submitted_data` (nombre, cédula/RIF, correo, teléfonos, ciudad, estado, dirección) en `0552:…client_registration_links`. |
| Minimización | CORRECTO | Mismos campos que `/registro`; la dirección es opcional. El token no se guarda, solo su hash. |
| Finalidad | CORRECTO | Mismo texto de finalidad que `/registro` en `RegistroLinkForm.tsx`; opt-in de correo explícito y apagado por defecto. |
| Acceso | CORRECTO | RLS de solo lectura por tenant; RPC con rol y tenant; las públicas, solo `service_role`. |
| Borrado y retención | ENCONTRADO | `prev_data`/`submitted_data` duplican datos personales y no hay flujo general de supresión de clientes en el repo. Decisión pendiente de Sam: plazo para vaciar esas copias después de «comprobado» (propuesta: 90 días). |
| Transferencias | NO VERIFICABLE | Sin terceros nuevos; Auth es el mismo Supabase de hoy. El aviso D-1 sale por el mismo envío de correos (`sendEmail`) que la invitación al portal. |

**Enmienda D-1, opción C (2026-11-17), revisión acotada al cambio.** Marco: Constitución arts. 28 y 60 y
jurisprudencia de habeas data (Venezuela). El equipo de China sin rol admin no entra a la pantalla
(§3.4), así que no hay tratamiento nuevo en China. No es asesoría legal.

| Punto | Estado | Evidencia |
|---|---|---|
| Inventario | CORRECTO | Un dato personal nuevo: `client_email_checks.pending_email`, copia del correo de la ficha (`0559_registro_link_correo_comprobado.sql`, «1. La tabla»). `internal_email` es un id aleatorio y `token_hash` un sha256: ninguno identifica a una persona. Finalidad: comprobar que el correo es del cliente antes de que sirva para entrar. Lo lee solo el servidor: la tabla no tiene policies ni permisos de lectura para `authenticated` (contrato §G), y el equipo ve solo el estado. |
| Minimización | CORRECTO | La dirección interna no sale del Shipping Mark, del nombre ni del correo (`lib/studio/portal/correo-comprobacion.ts`, `nuevoCorreoInterno`; contrato §H). El enlace lleva solo el token (`lib/portal/correo-comprobacion.ts`, `comprobarCorreoUrl`). El correo real deja de estar en la cuenta de Auth hasta que se comprueba: un sistema menos con el dato. |
| Titular que no es usuario | CORRECTO | El correo de comprobación puede llegarle a un tercero si el cliente escribió una dirección ajena. Lleva el Shipping Mark, no el nombre ni ningún dato de la ficha, y su único enlace no abre el portal (`lib/studio/registro-link-aviso-email.ts`; `registro-link-aviso-email.test.ts`). La página pública muestra el Shipping Mark y, solo a la sesión del portal de la cuenta titular, el correo que va a confirmar, para que lo revise antes; sin sesión o con otra cuenta no sale el correo (`portal_email_check_peek`, contrato §J; `comprobar-correo-page.test.tsx`). |
| Acceso | CORRECTO | Tabla sin lectura por PostgREST; el estado, solo para el equipo del tenant y sin el correo ni el hash (`portal_email_check_estado`, contrato §G/§H); las RPC del enlace, solo `service_role`; preparar el reenvío exige rol y tenant (contrato §N). El correo sigue viéndose solo en la ficha, donde ya rige quién puede ver datos de contacto (§3.4). |
| Registros y salidas | CORRECTO | Los avisos de consola de las rutas nuevas llevan códigos de error, no correos; la corrida única imprime conteos e ids internos (`registro-link-correo-estado.test.ts`, «no lleva correos»). El correo sí queda en `mail_logs` como cualquier envío (ya era así con el aviso de la opción A). |
| Borrado y retención | ENCONTRADO | `pending_email` se borra con la ficha (`on delete cascade`), pero el borrado de clientes es lógico: la copia queda mientras la ficha exista, también después de comprobado, cuando ya no hace falta. Mismo hallazgo que `prev_data`/`submitted_data`. Arreglo propuesto: vaciar `pending_email` al confirmar (el correo ya está en la ficha y en la cuenta) y sumar la tabla al plazo que Sam decida para las copias de la 0552. No se hizo en este cambio porque el trigger compara contra ese valor para saber si el correo cambió; hay que compararlo contra la ficha. |
| Transferencias | NO VERIFICABLE | Sin terceros nuevos. El correo de comprobación sale por el mismo proveedor de envío que el aviso anterior; su contrato y dónde guarda los registros no se ven en el repo. |

## 5.1 Preguntas abiertas para Sam

**D-1 · El correo que escribe el cliente.** Decidido por Sam el 2026-11-17: **opción C.** (El DG había
dejado la A el 2026-11-16, a la espera de Sam.)

El punto de partida: el link llega por WhatsApp a quien el equipo ya conoce, y eso prueba quién es la
persona, pero no que el correo sea suyo. Si teclea mal el correo, o escribe uno ajeno, ese correo no
debe servir para entrar al portal de ese cliente.

Límite técnico que descarta el `email_confirmed_at` de Auth como prueba: verificar un magic-link marca
el correo como confirmado, y la entrada directa desde la página lo confirma sin que el correo
intervenga. Por eso «comprobado» es un estado propio (`client_email_checks`, §4.1).

- **C (vigente).** Tres piezas:
  1. **Entra directo.** Al terminar el formulario el cliente queda dentro, como pidió Sam. No hay un paso
     antes de entrar.
  2. **El correo no sirve hasta comprobarse.** La cuenta nace con una dirección interna que no recibe
     correo (dominio reservado `.invalid`, id aleatorio). El correo que escribió queda en la ficha, «sin
     comprobar». Mientras tanto `/entrar` responde con ese correo lo mismo que con uno que no existe, y
     la invitación por correo, su recordatorio y el reenvío masivo no le mandan enlace
     (`correoSinComprobar`, segunda capa). El portal no tiene contraseña que recuperar: la entrada es
     por enlace. La recuperación de estas cuentas va por el acceso de WhatsApp (SDD-0253), que acuña
     para la cuenta del cliente.
  3. **Un enlace que solo comprueba, y solo con el portal del cliente abierto.** Al correo le llega un
     enlace de un solo uso, de 7 días, a `/registro/correo/<token>`. Abrirlo solo lee (un filtro de
     correo que lo abra no lo gasta); el botón «Sí, este correo es mío» lo confirma. No abre sesión ni da
     acceso a nada.
     **El enlace solo no comprueba:** tener el enlace prueba que se lee ese buzón, no que quien lo lee
     sea el cliente. El POST exige la sesión del portal del titular de esa comprobación; el usuario sale
     de la sesión en el servidor y la base lo vuelve a comparar al reclamar y al confirmar. Sin sesión, o
     con la sesión de otra cuenta, no se confirma, el enlace no se gasta y la página pide entrar primero
     al portal (por el acceso de WhatsApp) y volver a abrir el enlace, sin decir de quién es. Ni la
     pantalla de éxito ni el correo invitan a pedir un enlace de acceso.
     Al confirmarlo, el correo pasa a la cuenta. Si para entonces ese correo ya tiene otra cuenta, se
     rechaza con el mismo mensaje genérico, queda marcado en «Registros por link» y no se fusiona nada.
     Si la confirmación queda a medias y no se puede deshacer, el enlace no se suelta y la fila queda
     «para revisar» a la vista del equipo.
- **A quién aplica.** Solo a la cuenta que nació de un link de registro, mientras siga siendo la cuenta
  del cliente. La invitación por correo (SDD-0042) y el registro público no cambian. Si el equipo revoca
  el acceso y vuelve a invitar por correo, el cliente pasa a ese camino: entra desde su correo, y esa es
  la prueba. Es una decisión del equipo y queda a la vista: al invitar, Studio pide una confirmación
  explícita si ese cliente nunca comprobó su correo, y «Registros por link» sigue diciendo «Correo nunca
  comprobado».
- **Si el correo se corrige** (el equipo en la ficha; el portal no deja al cliente cambiar su correo), el
  nuevo nace sin comprobar: el enlace emitido deja de servir y la cuenta vuelve a su dirección interna.
  El equipo reenvía la comprobación desde «Registros por link».
- **Cuentas por link ya creadas:** §4.1.
- **A (anterior).** Entrada directa y un aviso sin enlaces. Reemplazada por la C.
- **B (descartada).** Sin sesión inmediata: el cliente entra desde el enlace de su correo. Prueba el
  correo, pero agrega un paso, y el cliente del legado pudo haber escrito mal un correo que ni revisa.

**Decisiones abiertas para Sam (enmienda):**

1. **Aviso dentro del portal.** Hoy el enlace llega por correo y lo reenvía el equipo. Propuesta: un
   aviso «Tu correo está sin comprobar» con «Reenviar» dentro del portal, con sesión. No se hizo: es
   pantalla nueva del portal.
2. **Nombre del botón «Marcar comprobado».** En la misma tarjeta ahora conviven «Comprobado» (el equipo
   revisó el registro) y «Correo comprobado». Propuesta: «Marcar revisado» / «Revisado». No se cambió por
   ser texto ya aprobado.
3. **Vaciar la copia del correo al confirmar** (tabla de privacidad, «Borrado y retención»).

## 6. Criterios de aceptación

1. El link tiene ≥128 bits (son 256), se guarda como hash, es de un solo uso, vence a los 14 días y
   regenerarlo revoca el anterior. — contrato SQL §A/§B y `registro-por-link-studio.test.ts`.
2. La URL no lleva el Shipping Mark; uno puesto en la URL no abre nada. — `registro-link.test.ts`,
   `e2e/registro-link.spec.ts`.
3. Completar no crea ficha ni código y deja el acceso activo. — contrato §B4/§B7 y
   `registro-link-action.test.ts`.
4. El duplicado se marca sin fusionar y la cédula ajena no se copia. — contrato §C.
5. Un cliente recupera su propio código retirado sin borrar su historia, `resolve_markbox` sigue
   resolviendo los dos códigos, y nadie más puede tomarlo. — contrato §D.
6. Una ficha nueva no nace con un código retirado. — contrato §E.
7. El alta acepta el código a mano sin pasar por el generador. — `registro-por-link-studio.test.ts`.
8. «Registros por link» muestra antes/después y marca comprobado con rol y tenant. — contrato
   («Marcar comprobado»).

**Enmienda D-1, opción C:**

9. El cliente sigue entrando directo al completar el formulario, y el correo que escribió no entra a la
   cuenta de Auth: la cuenta nace con una dirección interna aleatoria. — `registro-link-action.test.ts`
   (D-1), contrato 0559 §L.
10. Un correo sin comprobar no recibe un enlace de entrada por ningún camino: `/entrar` responde igual
    que con un correo que no existe (mismas consultas, ningún envío), y la invitación por correo no
    acuña ni envía. Si no se puede saber, no sale. — `app/entrar/__tests__/actions.test.ts`,
    `portal-invite-email.test.ts`, contrato §H.
11. Solo los caminos conocidos acuñan o piden un enlace de entrada; uno nuevo hace fallar la prueba
    hasta decidir cómo respeta la regla. — `lib/studio/portal/__tests__/correo-comprobacion.test.ts`
    (inventario).
12. El enlace de comprobación no crea sesión ni devuelve nada con qué entrar, y ni su página ni el
    correo ofrecen una entrada al portal. — `comprobar-correo-action.test.ts`,
    `registro-link-aviso-email.test.ts`.
13. Un GET no lo gasta; vencido, usado, reemplazado o inventado no sirve; es de un solo uso. — contrato
    §J/§K, `comprobar-correo-action.test.ts`.
14. «Comprobado» exige que el correo ya esté en la cuenta; el choque con otra cuenta queda marcado y no
    fusiona nada. — contrato §K/§L.
15. Corregir el correo lo devuelve a «sin comprobar». — contrato §M, `correo-comprobacion-studio.test.ts`.
16. Las cuentas de otros caminos no cambian; las cuentas por link que ya existían quedan «sin
    comprobar». — contrato §H/§P.
17. «Registros por link» muestra el estado real, y el reenvío exige rol y tenant antes de usar
    `service_role`. — `registro-link-correo-estado.test.ts`, `correo-comprobacion-studio.test.ts`,
    contrato §N.
18. Ningún envío toma la dirección interna como destinatario. — `correo-comprobacion.test.ts`
    (`sendEmail`).
19. El enlace solo no comprueba: un POST sin la sesión del titular no confirma ni gasta el enlace; con la
    sesión de otra cuenta tampoco. El usuario sale de la sesión, no del formulario, y la base lo compara
    al reclamar y al confirmar. — contrato §K, `comprobar-correo-action.test.ts`.
20. Si la confirmación queda a medias y no se puede deshacer, el enlace no se suelta y queda «para
    revisar»; los avisos de consola no llevan el correo ni el token. — contrato §Q,
    `comprobar-correo-action.test.ts`.
21. La tabla no se lee por PostgREST y el estado que ve el equipo no trae el correo ni el hash del token.
    — contrato §G/§H, `registro-link-correo-estado.test.ts`.
22. Revocar y volver a invitar no borra la señal: «Correo nunca comprobado» en la tarjeta y confirmación
    explícita al invitar. — contrato §P, `correo-comprobacion-studio.test.ts`.
23. `/entrar` no llega al envío de Auth por ningún camino sin haber preguntado antes; sin el cliente
    admin no envía nada. — `correo-comprobacion.test.ts` (inventario),
    `app/entrar/__tests__/actions.test.ts`, `entrar-no-promete-envio.test.tsx`.
24. La corrida única recorre todas las filas y nunca termina en 0 con pendientes. —
    `registro-link-correo-estado.test.ts`.
25. El titular ve el correo completo antes de confirmarlo y tiene una salida «No es mi correo» que no
    confirma nada y le dice cómo corregirlo; sin sesión o con la de otra cuenta el correo no aparece. —
    contrato §J, `comprobar-correo-page.test.tsx`.
26. El acceso por WhatsApp falla cerrado: si hay (o no se puede descartar que haya) una cuenta por link
    sin comprobar y no se puede leer lo necesario, o el cliente no tiene ningún acceso activo, no se
    acuña ni se crea nada. — `correo-comprobacion.test.ts`.
27. La entrada por WhatsApp se acuña para la cuenta del link solo si sigue siendo el acceso activo del
    cliente. Revocado y reinvitado por correo, con la invitación ya aceptada: la cuenta vieja no la recibe
    y se usa el correo de la ficha. Mientras la invitación no se acepta (sin ningún acceso activo), o si
    se revocó sin reinvitar, el acceso por WhatsApp falla cerrado. — `correo-comprobacion.test.ts`.
28. Si la confirmación quedó hecha aunque la respuesta volvió con error, no se deshace. —
    `comprobar-correo-action.test.ts`.
29. En la corrida única, una fila cuya cuenta de Auth ya no existe se cuenta aparte, no se toca y no
    cuenta como pendiente (código de salida propio). — `registro-link-correo-estado.test.ts`.

## 7. Límites de las pruebas

- PGlite tiene una sola conexión: los `FOR UPDATE` (link, ficha, historial) no se prueban en carrera.
- El camino feliz completo en el navegador necesita una base con la 0552 y Auth; el e2e cubre la cara
  pública sin base.

- **Enmienda D-1.** En las pruebas unitarias Auth está doblado. La prueba contra el Auth real del entorno de
  prueba se hizo el 2026-11-18 (`infra/ops/portal-correo-comprobacion/probar-auth-prueba.mjs`): acepta la
  dirección `.invalid`, acuña la entrada para ella, la sesión sigue viva al cambiar el correo y los caminos
  propios de Auth con el correo real no encuentran la cuenta. El correo ocupado llega como 500 · 23505 (no
  como `422 email_exists`); la app reconoce las dos formas. Resultado completo en el handoff.
- La igualdad de respuesta de `/entrar` se prueba por consultas y envíos, no cronometrando.

## 8. Allowlist

- `supabase/migrations/0552_registro_portal_por_link.sql`, `supabase/tests/0552_registro_portal_por_link.test.sql`,
  el desarme de la 0552 en `supabase/desarmes/`, `supabase/migrations-baseline.json`,
  `supabase/pending-migration-symbol-declarations.json`
- `lib/portal/registro-link.ts`, `lib/portal/registro-link-types.ts`, `lib/studio/registro-link-queries.ts`,
  `lib/studio/registro-link-aviso-email.ts`,
  `lib/studio/client-types.ts`
- `app/registro/RegisterForm.tsx` (solo `export` de seis campos), `app/registro/link/[token]/*`
- `app/studio/(app)/clientes/actions.ts`, `…/[markbox]/page.tsx` (`canEdit` a la tarjeta), `…/_components/PortalAccessCard.tsx`, `…/_components/ClientDrawer.tsx`,
  `…/_components/ClientsClient.tsx`, `…/_components/RegistrosLinkClient.tsx`, `…/registros-link/page.tsx`
- Pruebas: `lib/portal/__tests__/registro-link.test.ts`, `lib/portal/__tests__/registro-por-link.migration.test.ts`,
  `app/registro/link/[token]/__tests__/registro-link-action.test.ts`,
  `app/studio/(app)/clientes/__tests__/registro-por-link-studio.test.ts`, `lib/studio/__tests__/registro-link-aviso-email.test.ts`,
  `lib/studio/rbac-actions-guard.test.ts` (inventario), `e2e/registro-link.spec.ts`
- `docs/specs/0646-invitacion-portal-por-link/spec.md`, `.agents/handoffs/sdd-0646-invitacion-portal-por-link.md`

- **Enmienda D-1 (opción C):** `supabase/migrations/0559_registro_link_correo_comprobado.sql`,
  `supabase/tests/0559_registro_link_correo_comprobado.test.sql`, el desarme de la 0559,
  `supabase/migrations-baseline.json`, `supabase/pending-migration-symbol-declarations.json`;
  `lib/portal/correo-comprobacion.ts`, `lib/studio/portal/correo-comprobacion.ts`,
  `lib/studio/portal/access-link.ts` (`loadAccessTarget`), `lib/studio/portal-invite-email.ts`,
  `lib/studio/mail/send-email.ts`, `lib/studio/registro-link-aviso-email.ts`,
  `lib/studio/registro-link-queries.ts`, `lib/portal/registro-link-types.ts`; `app/entrar/actions.ts`,
  `app/registro/link/[token]/actions.ts` y `RegistroLinkForm.tsx`, `app/registro/correo/[token]/*`;
  `app/studio/(app)/clientes/actions.ts` (`resendEmailCheckAction`, `updateClientAction`,
  `invitePortalAction`), `…/_components/RegistrosLinkClient.tsx`, `…/_components/PortalAccessCard.tsx`; `infra/ops/portal-correo-comprobacion/*`; y sus pruebas:
  `lib/portal/__tests__/correo-comprobado.migration.test.ts`,
  `lib/studio/portal/__tests__/correo-comprobacion.test.ts`,
  `lib/studio/__tests__/registro-link-correo-estado.test.ts`,
  `app/registro/correo/[token]/__tests__/comprobar-correo-action.test.ts`,
  `app/registro/correo/[token]/__tests__/comprobar-correo-page.test.tsx`,
  `app/studio/(app)/clientes/__tests__/correo-comprobacion-studio.test.ts`, más las ya listadas que se
  ajustaron (`registro-link-action.test.ts`, `registro-link-aviso-email.test.ts`,
  `portal-invite-email.test.ts`, `app/entrar/__tests__/actions.test.ts`,
  `app/entrar/__tests__/entrar-no-promete-envio.test.tsx`, `rbac-actions-guard.test.ts`).

## 9. Fuera de alcance

- Mandar el link por la API de WhatsApp (hoy se abre `wa.me` y el asesor lo envía).
- Fusionar duplicados (se resuelven en «Posibles duplicados»).
- Aplicar la 0552 en producción y fusionar a `main`.
- Enmienda D-1: aplicar la 0559, correr la corrida única de las cuentas ya creadas, cambiar la
  configuración del servicio de Auth, el aviso dentro del portal y la purga de las copias.
