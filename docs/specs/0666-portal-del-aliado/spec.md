---
sdd: "0666"
title: "Portal del aliado: sus clientes, prealertas y marca blanca"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0042", "0177", "0255", "0258", "0336", "0443", "0454", "0460", "0531", "0552", "0646", "0654", "0663"]
confidencialidad: interno
---

# SDD-0666 — Portal del aliado

> El aliado tiene un portal con extras: registra a sus clientes y subaliados, les hace prealertas y ve su cuenta por trabajo. Sus clientes finales tienen su propio portal con la marca del aliado, sin nada de DTD, en el dominio de marca blanca `hailuway.com`.
> **Estado:** `proposed`. Solo spec: sin código ni migración. **El primer entregable es una maqueta navegable** que Sam aprueba antes de programar. Los números de migración los da el Director General.
> **Hermana:** la parte del Studio (sección Aliados, asignar códigos, estado de cuenta por trabajo) está en la [SDD-0663](../0663-subaliados-como-jobs/spec.md).
> Etiquetas: **C** código leído · **D** documento del repo · **I** inferencia · **NV** sin verificar.
> Los ejemplos usan nombres genéricos: «aliado A» (prefijo `AA`) y «subaliado M» (prefijo `MD`). El dominio de marca blanca es `hailuway.com`: Sam autorizó nombrarlo en el repo público (respuesta «si» en el chat del Director General, 2026-11-18).

## 1. Pedido

Es la pieza que el programa «Aliados DTD» dejó prevista en julio de 2026 (`docs/marketing/adquisicion.md` §2c y §7; `docs/marketing/oferta-borradores.md` §4): un espacio propio del aliado, con lectura del tracking de sus clientes y codificación de letras propia. Sam la precisó el 2026-11-18:

- El portal del aliado es distinto al de un cliente normal: tiene una sección para registrar a sus clientes o subaliados y hacerles prealertas.
- Sus clientes finales pueden entrar a su propio portal con la marca del aliado.

## 2. Decisiones de Sam (2026-11-18)

### 2.1 Quién entra y qué hace

| Tema | Decisión |
|---|---|
| Quién usa el portal del aliado | Solo el aliado principal; los subaliados no tienen acceso propio |
| Usuarios del aliado | Varios. Los crea el propio aliado; todos con los mismos permisos |
| Datos al registrar un cliente | Nombre y teléfono |
| Fichas de sus clientes | Puede editar nombre y teléfono; no borra ni cambia códigos |
| Cliente final | Tiene acceso propio, con la marca del aliado |
| Invitación del cliente final | La hace el aliado, por link |
| Prealertas | Las crea el cliente final y también el aliado a su nombre |
| Dinero para el cliente final | Nada por ahora. Se deja la base para que más adelante el aliado ponga su precio de facturación a cada cliente |
| Avisos automáticos | Solo al aliado; nada al cliente final |
| Entrega en Venezuela | Depende del aliado: dato en su ficha (retira el aliado / DTD entrega al cliente final) |
| Términos para el cliente final | Ninguno de DTD; responde el aliado. El acuerdo con el aliado tiene que decirlo (abogado de Sam) |

### 2.2 Dirección web

| Tema | Decisión |
|---|---|
| Dominio | `hailuway.com`, de Sam, en Cloudflare, sin nada montado y sin enlace visible con DTD Cargo |
| Dirección de cada aliado | Las letras de su código delante de `hailuway.com` (subdominio, por ejemplo `aa.hailuway.com`). Forma exacta: por confirmar con Sam |
| Quién entra por ahí | El aliado, sus usuarios y sus clientes finales. Los clientes directos de DTD siguen en el portal de DTD |
| Subaliado | Usa la marca y la dirección del aliado principal |
| Dominio sin letras | Página neutra de ingreso, sin marca de DTD |
| Correo de ingreso | Sale de `hailuway.com`, con el nombre del aliado |
| QR de etiquetas y link del proveedor | Apuntan a la dirección del aliado |
| Más adelante | El dominio propio del aliado, que da acceso para configurarlo |

### 2.3 Aspecto gráfico

| Tema | Decisión |
|---|---|
| Qué personaliza el aliado | Logo, nombre y un color principal, cargados por él en su portal. El sistema corrige el color si no contrasta |
| Diseño base del cliente final | La versión simple del portal (SDD-0654), sin dinero ni nada de DTD |
| Seguimiento del cliente final | Etapas y fecha estimada; sin contenedor, buque, naviera ni mapa. Sin los datos de la naviera (L2 y L3 del §4.3), la fecha estimada es la que carga la oficina en el envío, no la del rastreo de la naviera |
| Inicio del aliado | Resumen: clientes, cargas en camino por contenedor, prealertas pendientes y saldo con DTD, con accesos a registrar cliente y hacer prealerta |
| Pie de página | Solo el nombre del aliado |
| Etiquetas de cajas | Solo código corto y QR, sin logo de nadie |
| «Mis clientes» | Por cliente: carga con su etapa, m³ y lo que DTD le facturó al aliado por ese cliente |
| Antes de programar | Maqueta navegable que Sam aprueba |

## 3. Lo que hay

| Hecho | Fuente | Etiqueta |
|---|---|---|
| `client_users`: un vínculo por cliente (`unique (tenant_id, client_id)`) y por usuario (`unique (auth_user_id)`); **sin columna de rol** | `supabase/migrations/0080_portal_cliente.sql:13-30` | C |
| `portal_bind_session` amarra el primer ingreso con `limit 1` **sin `order by`** entre invitaciones con el mismo correo; no se redefinió después | `0080_portal_cliente.sql:148-181` | C |
| Con su propio token, un cliente **no** lee `consolidations`, `sailings`, `consolidation_items` ni `tracking_snapshots`: sus políticas son por tenant con `get_user_tenant_id()`, que da NULL para un usuario del portal | `0096_naviera_consolidacion.sql:332-361`; `0158_tracking_snapshots.sql:89-96`; `0453_…:235-247` | C |
| El portal **sí muestra** contenedor, buque y naviera: los lee en el servidor con el cliente admin, limitado a los envíos del cliente | `lib/portal/consolidation-queries.ts:15-19,75-93` | C |
| `shipments` se lee por la política «portal self read» (Shipping Mark y vínculo activo) | `0416_portal_shipments_tenant_boundary.sql:41-53` | C |
| `/p/[token]`: el proveedor en China ve Shipping Mark, código de la compra, cajas, sus propios datos y la marca del cliente; **no** ve nombre ni teléfono (`clientName: null`) | `app/p/[token]/page.tsx:42-50,92-98`; `lib/studio/prealertas/queries.ts:329,361-364`; SDD-0443:21 | C, D |
| QR de etiquetas: `<SITE_URL>/verificar?c=<markbox>&n=<caja>/<total>`, con host fijo; `/verificar` solo confirma que el código existe | `lib/studio/etiquetas-qr.ts:16-41`; `app/verificar/page.tsx:12-56` | C |
| El equipo de China no ve nombres (`canSeeClientNames`, `ocultarDatosDelCliente`), oculto en el servidor; la PWA `/m/cn` no selecciona el nombre. No es frontera de base de datos | `lib/studio/privacidad-cn.ts:16-23,42-46,92-158`; SDD-0531 | C, D |
| Borrar un cliente es lógico (`deleted_at`), revoca su portal en la misma transacción y deja eventos de auditoría sin datos personales | `app/studio/(app)/clientes/actions.ts:579-619`; `0455`; `0454:21-33`; `docs/legal/privacidad/mapa-de-borrado.md:324-333` | C, D |
| No hay solicitud de supresión desde el portal; se pide por correo | `app/privacidad/page.tsx:438-454` | C |
| Invitación por link: un solo uso, vence a los 14 días, token guardado como sha256 | `0552_registro_portal_por_link.sql:13,85-86,109,234,382`; SDD-0646 | C, D |
| `proxy.ts` no mira el host; `/portal` solo refresca sesión; la protección está en `app/portal/(app)/layout.tsx:49` | `proxy.ts:29-31,139-203` | C |
| La URL base (`NEXT_PUBLIC_SITE_URL`) arma los links que recibe o abre un cliente: ingreso, enlace mágico, código de acceso, invitación, comprobación de correo, registro por link, referidos, bienvenida, avisos de hitos, cola de avisos y resolución de pagos | Lista U1 a U12 del §4.7 | C |
| La marca se resuelve por el usuario autenticado y toma el aliado directo | SDD-0336; `get_portal_brand()` (0401, 0451) | D, C |
| No existe la cláusula de tratamiento de datos para aliados | SDD-0255 §8.5 | D |

## 4. Propuesta

### 4.1 Portal del aliado

El portal de un cliente más un bloque «Aliado» que solo ve un usuario con rol de aliado:

- **Inicio de aliado** con el resumen de su operación.
- **Mis clientes**: sus clientes directos y, agrupados, los de cada subaliado. «Registrar cliente» (nombre, teléfono y a quién pertenece; el código lo da `next_markbox_aliado`) y «Registrar subaliado» (nombre comercial y letras; mismas guardas de prefijo que el Studio; ficha ancla sin correo). Editar nombre y teléfono.
- **Prealertas**: el flujo de «Compras» con un paso previo «¿Para quién es?».
- **Cuenta por trabajo**: el estado de cuenta por trabajo de la SDD-0663, con PDF completo o de un trabajo.
- **Mi marca**: logo, nombre y color.
- **Usuarios**: invitar y quitar a sus empleados.

Cuando «Registrar subaliado» choca con un prefijo ocupado, el mensaje es neutro: «Esas letras no están disponibles. Prueba otras». No dice de quién son ni si existen.

### 4.2 Portal del cliente final

Sobre la versión simple del portal: Inicio, Mis envíos, Prealertas, Etiquetas y Mi perfil.

- Ve: marca del aliado, su código en forma impresa, sus envíos por etapa con fecha estimada, prealertas, etiquetas y el contacto del aliado.
- No ve: marca de DTD, tarifa, facturas ni estado de cuenta de DTD, club, referidos, academia, número de contenedor, buque, naviera ni mapa.
- No pasa por el gate de aceptación legal de DTD.

### 4.3 La restricción va en los datos, no en el menú

- `client_users` gana un rol: `cliente` (hoy), `aliado` (usuario del aliado) y `cliente_final` (cliente de un aliado).
- **Cada lectura con el cliente admin que muestra contenedor, buque, naviera, zarpe o rastreo deja de devolver esos datos** cuando el rol es `cliente_final`. Son estas (leídas en el código):

| # | Lectura | Dónde se usa | Qué muestra hoy |
|---|---|---|---|
| L1 | `getConsolidationsForShipments` (`lib/portal/consolidation-queries.ts:75-93`) | `app/portal/(app)/envios/page.tsx` | Contenedor, buque y naviera de cada envío |
| L2 | `getShipmentNaviera` (`lib/studio/naviera-tracking/queries.ts`) | `app/portal/(app)/envios/[code]/page.tsx:105-108` | Naviera del envío |
| L3 | `getShipmentTrackingSnapshot` | `app/portal/(app)/envios/[code]/page.tsx:105-108` | Rastreo de la naviera, con posición |
| L4 | `getShipmentNaviera` del próximo arribo | `app/portal/(app)/page.tsx:111` | Naviera del envío que llega primero |
| L5 | `lib/portal/next-sailing-queries.ts` (`PortalSailing`) | `app/portal/(app)/layout.tsx`, `app/portal/(app)/page.tsx`, `app/portal/(app)/envios/page.tsx`, `PortalShell.tsx`, `PortalTopbar.tsx`, `PortalDashboardNorte.tsx` y `PortalNextSailingCard.tsx:119` («Buque») | Próximo zarpe y buque |
| L6 | Club | `app/portal/(app)/club/page.tsx` | Programa de fidelización de DTD |
| L7 | Referidos | `app/portal/(app)/referidos/page.tsx` y `actions.ts` | Programa de referidos de DTD |
| L8 | Academia | `app/portal/(app)/academia/**` | Cursos de DTD |
| L9 | Facturas y estado de cuenta | `app/portal/(app)/facturas/**`, `app/portal/(app)/finanzas/page.tsx` | Dinero con DTD |
| L10 | Órdenes por aceptar: `loadPendingAcceptanceForClient` (`lib/portal/pending-acceptance.ts:56`, con cliente admin) | `app/portal/(app)/page.tsx:103`; inicio simple, `lib/portal/simple/cargar.ts:74` (`pendingAcceptanceCodes`, `:112`); `app/portal/(app)/envios/[code]/page.tsx:141` (`loadPendingAcceptance`) | Facturas de DTD por aceptar, con montos |
| L11 | Documentos firmados con cliente admin: `signDocumentUrls` en `app/portal/(app)/envios/[code]/page.tsx:66-70` y en `lib/portal/signed-portal-documents.ts:26` | Detalle del envío y `app/portal/(app)/documentos/` | Documentos del envío, entre ellos el BL, que trae contenedor, buque y naviera |
| L12 | Historial de avisos: `listShipmentNotificationHistory` (`lib/studio/notifications/notification-history-queries.ts:52`, con cliente admin) | `app/portal/(app)/envios/[code]/page.tsx:89-92` | Título y cuerpo de cada aviso enviado (`payload.title`, `payload.body`). Las plantillas no nombran buque, contenedor ni zarpe (`lib/studio/notifications/client-notification-types.ts`); un texto editado por la oficina podría hacerlo (NV) |
| L13 | Cotizaciones | `app/portal/(app)/cotizaciones/**` | Tarifas de DTD |
| L14 | Estimados | `app/portal/(app)/estimados/**` | Tarifas de DTD |

  Con rol `cliente_final`:

  - L1 a L5 no consultan esos datos o los devuelven en `null`.
  - L6 a L9, L13 y L14 responden 404 en el servidor. Cotizaciones y estimados son tarifas de DTD: el cliente final no las ve (§4.2); le cotiza su aliado.
  - L10 no se consulta: el cliente final no acepta facturas de DTD; las acepta el aliado.
  - L11: el cliente final no ve documentos de DTD; `documentos/` responde 404 y el detalle del envío no firma URLs.
  - L12 no se consulta: el cliente final no recibe avisos (§2.1), así que no tiene historial.

  No basta con esconder el enlace.

  **Revisadas y descartadas** (no entregan datos del viaje ni dinero):

  - `app/portal/(app)/compras/[code]/**`: las lecturas con cliente admin (`etiquetas/page.tsx:60,69,82,127`) son la compuerta y la presentación de la etiqueta. La etiqueta del cliente final solo lleva código y QR (§2.3).
  - `app/portal/(app)/layout.tsx:70`: `getPortalLastReplyAt` solo trae la hora del último mensaje de soporte.
  - `app/portal/(app)/soporte/`: no lee datos del viaje. Para el cliente final el contacto es su aliado (§4.2), así que la sección de soporte de DTD no se muestra y responde 404.
- Las políticas RLS del portal no se reescriben. Lo del aliado va por RPC `security definer` que derivan la identidad de `auth.uid()` (patrón de `get_portal_brand()`): listar mis clientes, registrar cliente, registrar subaliado, editar nombre y teléfono, crear prealerta a nombre de, leer envíos de mis clientes y leer la cuenta por trabajo. Cada una comprueba el rol y que el cliente cuelga de la cadena del aliado que llama.
- El aliado no reporta pagos ni cambia direcciones de entrega de sus clientes (SDD-0255 §8.4).

### 4.4 Amarre por dirección, en los dos sentidos

- Un usuario con rol `aliado` o `cliente_final` **no entra** por el portal de DTD: el layout del portal y `proxy.ts` lo redirigen a la dirección de su aliado.
- Un cliente directo de DTD no entra por la dirección de un aliado.
- Un usuario de un aliado no entra por la dirección de otro aliado.
- Lo mide una prueba por cada sentido.

### 4.5 Usuarios del aliado

- Varios usuarios por aliado: migración sobre `client_users` que quita la unicidad por cliente solo para el rol `aliado`.
- El primer ingreso deja de depender de `portal_bind_session` con `limit 1` sin orden (SDD-0258 §6.1): el amarre exige el token de la invitación.
- Invitación de usuarios y de clientes finales: un solo uso y vencimiento, como la SDD-0646.
- Cada alta, baja y cambio de usuario queda en el log de auditoría con quién lo hizo.
- Recuperación: si el aliado pierde a su último usuario, la oficina lo restablece desde el Studio.

### 4.6 Base para el precio del aliado (se diseña, no se muestra)

Dónde guardaría el aliado su precio por cliente o por envío, separado de las facturas de DTD y sin acceso de DTD a esa cuenta. Se define el modelo para que la pantalla de dinero se encienda después sin rehacerlo. No se construye en esta spec.

### 4.7 Marca blanca técnica

- **La misma aplicación.** `hailuway.com` sirve la misma app Next.js, sin copiarla. Las fronteras del repo no cambian: el sitio público sigue sin importar `@/lib/studio`, `@/lib/db` ni `@supabase/*`, y el Studio no se publica en el dominio de marca blanca.
- **Marca por dirección**: el aliado se resuelve por el host antes del login, además de `get_portal_brand()` después.
- **La marca sube al aliado raíz** (SDD-0663 §3.5). Aquí cambia `get_portal_brand()`.
- **Antes del login, sin enumeración**: la página de ingreso de una dirección desconocida responde igual que la de una existente (página neutra), sin revelar si el aliado existe. El logo se sirve por una URL que no deja listar otros.
- **URL base por petición**: el link del proveedor, `/verificar` y cada uso de `SITE_URL` que llega a un usuario del aliado toman la dirección del aliado. Los usos, leídos en el código:
  - U1 `app/entrar/actions.ts:15,70` (ingreso);
  - U2 `lib/studio/portal/magic-link.ts:48,77` (enlace mágico);
  - U3 `lib/studio/portal/access-link.ts:97` (código de acceso);
  - U4 `lib/studio/portal-invite-email.ts:33,54` (invitación);
  - U5 `lib/portal/correo-comprobacion.ts:15` (comprobación de correo);
  - U6 `lib/portal/registro-link-types.ts:24` (registro por link);
  - U7 `app/portal/(app)/referidos/actions.ts:62` (referidos; el cliente final no los tiene, L7);
  - U8 `lib/studio/welcome-email.ts:56` (bienvenida);
  - U9 `lib/studio/shipment-milestone-notify.ts:103` (avisos de hitos);
  - U10 `lib/studio/notifications/drain-client-notifications.ts:247` (cola de avisos);
  - U11 `lib/studio/payment-report-resolution-notify.ts:190` (resolución de pagos);
  - U12 `lib/studio/etiquetas-qr.ts:16-17` (QR).

  Los avisos (U9 a U11) van solo al aliado (§2.1), pero el link que llevan tiene que abrir en su dirección.
- **Sesión**: las cookies no cruzan dominios; el ingreso y el callback de Supabase Auth necesitan `hailuway.com` y sus direcciones en la lista de redirecciones permitidas.
- **Marca que sube el aliado**: PNG, JPG o WebP con tamaño máximo; **sin SVG** (o saneado si Sam lo pide); Storage separado por aliado; color con contraste suficiente. La oficina tiene «restablecer marca» en el Studio.
- **Infraestructura** (tarea de ops con OK de Sam, fuera de esta spec): registro comodín en Cloudflare hacia el servidor, certificado comodín y envío de correo desde `hailuway.com` (SPF y DKIM).
- **Dominio propio del aliado**, más adelante: el mismo mecanismo, con una tabla de hosts por aliado.

## 5. Fases, aceptación y allowlist

Dependen de la SDD-0663 F1 a F3. Cada fase tiene su allowlist exacta; se escribe completa en la spec antes de programar esa fase. Las fases que tratan datos personales (P2, P3, P6) **no salen a producción sin la cláusula de la SDD-0255 §8.5**.

| Fase | Qué entrega | Migración | Necesita §8.5 |
|---|---|---|---|
| M | Maqueta navegable (Artifact privado y copia en `maqueta/`, sin nombres reales) | No | No |
| P0 | Rol en `client_users` y restricción de datos por rol (§4.3) | Sí | No |
| P1 | Cuenta por trabajo en el portal | Sí (RPC) | No |
| P2 | Mis clientes y registrar cliente o subaliado | Sí (RPC) | **Sí** |
| P3 | Prealerta a nombre de un cliente | Sí (RPC) | **Sí** |
| P4 | Varios usuarios por aliado | Sí | No |
| P5 | `hailuway.com`: marca por dirección, amarre en los dos sentidos, URL base, correo | Posible | No |
| P6 | Portal del cliente final e invitación por link | Sí | **Sí** |
| P7 | Mi marca (logo, nombre, color) | Sí (Storage) | No |

Aceptación por fase:

- **M**: Sam aprueba la maqueta.
- **P0**: una prueba por cada lectura del §4.3, con rol `cliente_final`:
  - L1: la lista de envíos no trae contenedor, buque ni naviera;
  - L2 y L3: el detalle del envío no trae naviera ni rastreo;
  - L4: el inicio no trae la naviera del próximo arribo;
  - L5: ni el inicio, ni la barra, ni la lista de envíos traen próximo zarpe ni buque, y `PortalNextSailingCard` no se monta;
  - L6, L7 y L8: club, referidos y academia responden 404 en el servidor;
  - L9: facturas y finanzas responden 404 en el servidor;
  - L10: ni el inicio completo, ni el inicio simple (`pendingAcceptanceCodes` vacío), ni el detalle del envío consultan órdenes por aceptar;
  - L11: `documentos/` responde 404 y el detalle del envío no firma URLs de documentos;
  - L12: el detalle del envío no consulta el historial de avisos;
  - L13 y L14: cotizaciones y estimados responden 404 en el servidor;
  - soporte responde 404.

  Un cliente directo ve lo mismo que hoy en las catorce.
- **P1**: la RPC devuelve solo la cuenta del aliado que llama; otro aliado o un cliente final reciben rechazo.
- **P2**: el aliado registra un cliente y obtiene un código de su cadena; no puede registrar bajo otro aliado; el choque de prefijo da el mensaje neutro; editar no cambia el código; contrato SQL con mutantes.
- **P3**: la prealerta queda a nombre del cliente elegido y solo de un cliente de su cadena; el proveedor sigue sin ver nombre ni teléfono.
- **P4**: dos usuarios del mismo aliado ven lo mismo; el amarre exige el token; altas y bajas en auditoría; invitación de un solo uso.
- **P5**: las pruebas de amarre en los dos sentidos del §4.4; dirección desconocida y conocida responden igual antes del login; el QR y los links usan la dirección del aliado.
- **P6**: el cliente final entra por invitación de un solo uso y ve solo lo del §4.2; no ve nada de dinero.
- **P7**: un SVG o un archivo grande se rechazan; un color sin contraste se corrige; «restablecer marca» funciona.

Allowlist base (se detalla por fase antes de programarla):

- P0: las lecturas L1 a L14 del §4.3 y soporte (`lib/portal/consolidation-queries.ts`, `lib/studio/naviera-tracking/queries.ts` solo si hace falta, `lib/portal/next-sailing-queries.ts`, `lib/portal/pending-acceptance.ts`, `lib/portal/simple/cargar.ts`, `lib/portal/signed-portal-documents.ts`, `app/portal/(app)/page.tsx`, `app/portal/(app)/layout.tsx`, `app/portal/(app)/envios/**`, `app/portal/(app)/documentos/**`, `app/portal/(app)/club/page.tsx`, `app/portal/(app)/referidos/**`, `app/portal/(app)/academia/**`, `app/portal/(app)/facturas/**`, `app/portal/(app)/finanzas/page.tsx`, `app/portal/(app)/cotizaciones/**`, `app/portal/(app)/estimados/**`, `app/portal/(app)/soporte/**`, `app/portal/_components/PortalShell.tsx`, `app/portal/_components/PortalTopbar.tsx`, `app/portal/(app)/_components/PortalDashboardNorte.tsx`, `app/portal/(app)/_components/PortalNextSailingCard.tsx`), con una prueba por lectura, y la migración del rol.
- P1 a P3 y P6: `app/portal/(app)/**` de las secciones nuevas, `lib/portal/**` de las RPC nuevas, `app/portal/(app)/compras/**` (paso «¿Para quién es?») y las migraciones con número del DG y sus contratos SQL.
- P4: la migración de `client_users`, el amarre del primer ingreso, la pantalla de usuarios del aliado y, en el Studio, la **recuperación del último usuario** del aliado.
- P5: `proxy.ts`; `app/portal/(app)/layout.tsx`; los usos U1 a U12 de `SITE_URL` del §4.7; `app/p/[token]/**`; `app/verificar/**`; `lib/studio/etiquetas-qr.ts`; `lib/studio/aliados/brand-resolve.ts`; la **migración que cambia `get_portal_brand()`** (marca del raíz y por dirección); y `docs/specs/0336-marca-portal-por-principal/spec.md` (solo la nota de cambio).
- P7: la pantalla «Mi marca», el bucket de Storage por aliado y, en el Studio, **«restablecer marca»**.
- Todas: el handoff.

## 6. Datos personales (revisar-datos-ve, corrida el 2026-11-18 sobre el diseño)

Se corrió el método de `.claude/skills/revisar-datos-ve/SKILL.md` sobre lo que esta spec agrega, leyendo el repo. No es asesoría legal. Estados: `ENCONTRADO`, `CORRECTO`, `NO VERIFICABLE`.

### 6.1 Inventario

| Dato | Qué es | Finalidad | Base de licitud | Retención | Quién más lo ve |
|---|---|---|---|---|---|
| `clients.name` del cliente final | Nombre que carga el aliado | Identificar la carga y avisar | Consentimiento que el aliado tiene que obtener; **no lo recoge DTD** | La del cliente (lógico, `deleted_at`) | Aliado, oficina de DTD. No el equipo de China (SDD-0531), no el proveedor (`/p`) |
| `clients.phone` del cliente final | Teléfono que carga el aliado | Entrega directa cuando el aliado eligió «DTD entrega» | Igual | Igual | Aliado, oficina. No China ni proveedor |
| Correo del cliente final | Solo si el aliado lo invita al portal | Ingreso | Lo pone el propio cliente final al aceptar | 30 días tras revocar (0460) | Nadie más |
| Usuarios del aliado | Correo de cada empleado | Ingreso | Relación con el aliado | Igual que hoy | Oficina |

Los clientes finales son **titulares que no son usuarios de DTD** (punto 12 del checklist): sus datos los entrega un tercero (el aliado).

### 6.2 Hallazgos

| # | Punto | Estado | Detalle |
|---|---|---|---|
| D1 | 3 · Consentimiento (CRBV 28 y 60; SC 332/2001, autonomía) | **ENCONTRADO** | No hay base para tratar datos de un tercero que carga el aliado. Hace falta la cláusula de la SDD-0255 §8.5: el aliado declara que tiene el consentimiento del cliente final y que responde por él. Sin eso, P2, P3 y P6 no salen |
| D2 | 2 · Minimización | **Recomendación pendiente de Sam** | Sam decidió «nombre y teléfono» (§2.1). La recomendación es pedir el teléfono solo cuando el aliado eligió «DTD entrega al cliente final», porque es el único caso en que DTD lo usa. Sin cédula, correo ni dirección en ningún caso. Hasta que Sam decida, rige su decisión |
| D3 | 4 y 5 · Supresión | **ENCONTRADO** | El aliado no borra (decisión de Sam) y no hay solicitud de supresión desde el portal (`app/privacidad/page.tsx:438-454`). **Quién la atiende:** el aliado la pide a la oficina, que borra con `softDeleteClientAction` (lógico, revoca el portal, auditoría sin datos: `mapa-de-borrado.md:324-333`). El cliente final puede pedirla al aliado o al correo de privacidad. El borrado definitivo del nombre y el teléfono queda **NO VERIFICABLE** hasta que el mapa de borrado lo cubra |
| D4 | 12 · Titulares que no son usuarios | **ENCONTRADO** | El cliente final no ve ninguna política de DTD (decisión: ningún término de DTD). El aviso le toca al aliado; el acuerdo con el aliado tiene que obligarlo |
| D5 | 9 · Transferencia a China | **CORRECTO** | El proveedor en `/p/[token]` no ve nombre ni teléfono (`lib/studio/prealertas/queries.ts:361-364`); el QR solo lleva el Shipping Mark y la caja (`lib/studio/etiquetas-qr.ts:31-41`); el equipo de China no ve nombres (`lib/studio/privacidad-cn.ts:92-158`). Con la marca blanca, `/p` mostrará la marca del aliado en vez de la de DTD; no agrega datos personales |
| D6 | 9 · Regla D-2 | No aplica | La D-2 prohíbe enviar datos de clientes a un proveedor de IA chino. Se cita por `docs/specs/0637-faro-asistente-ayuda/privacidad.md:145` mientras la SDD-0639 (PR #606) no se fusione. Esta spec no usa IA. **Si el cliente final llega a tener Faro** u otro asistente en su portal, la D-2 pasa a aplicar y se revisa antes |
| D7 | Seguridad | **ENCONTRADO** | La ocultación del equipo de China no es frontera de base de datos (`lib/studio/privacidad-cn.ts:19-23`). Las RPC nuevas del aliado no deben devolver nombre ni teléfono a un usuario de región `cn` |
| D8 | Verificación contra datos | **NO VERIFICABLE** | No se probó ningún borrado contra una base real |

### 6.3 Qué tiene que pasar antes de producción

- La cláusula de la SDD-0255 §8.5 y el acuerdo con el aliado (abogado de Sam).
- La supresión del cliente final escrita en `docs/legal/privacidad/mapa-de-borrado.md`.
- La infraestructura de `hailuway.com`, con OK de Sam.

## 7. Por confirmar con Sam

- La forma exacta de la dirección de cada aliado (`aa.hailuway.com`).

## 8. Fuera de alcance

- Acceso propio de los subaliados.
- Avisos automáticos al cliente final y plantillas con la marca del aliado.
- Mostrar dinero al cliente final.
- El dominio propio de cada aliado.
- Consultas o cambios en producción.

## 9. Aceptación de esta spec

- [ ] Sam aprueba la spec.
- [ ] Sam aprueba la maqueta navegable (fase M).
- [ ] Existe la cláusula de la SDD-0255 §8.5 antes de P2, P3 y P6 en producción.
- [ ] El Director General asigna las fases y los números de migración.
