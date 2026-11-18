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

> El aliado tiene un portal con extras: registra a sus clientes y subaliados, les hace prealertas y ve su cuenta por trabajo. Sus clientes finales tienen su propio portal con la marca del aliado, sin nada de DTD, en un dominio de marca blanca.
> **Estado:** `proposed`. Solo spec: sin código ni migración. **El primer entregable es una maqueta navegable** que Sam aprueba antes de programar. Los números de migración los da el Director General.
> **Hermana:** la parte del Studio (sección Aliados, asignar códigos, estado de cuenta por trabajo) está en la [SDD-0663](../0663-subaliados-como-jobs/spec.md).
> Etiquetas: **C** código leído · **D** documento del repo · **I** inferencia · **NV** sin verificar.
> Los ejemplos usan nombres genéricos: «aliado A» (prefijo `AA`) y «subaliado M» (prefijo `MD`). El dominio de marca blanca no se escribe en el repo hasta que Sam lo decida: aquí es «el dominio de marca blanca».

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
| Dominio | Un dominio de marca blanca de Sam, en Cloudflare, sin nada montado y sin enlace visible con DTD Cargo. **Cuál, pendiente de Sam**: no se escribe en el repo hasta que lo decida |
| Dirección de cada aliado | Las letras de su código delante del dominio de marca blanca (subdominio). Forma exacta: por confirmar con Sam |
| Quién entra por ahí | El aliado, sus usuarios y sus clientes finales. Los clientes directos de DTD siguen en el portal de DTD |
| Subaliado | Usa la marca y la dirección del aliado principal |
| Dominio sin letras | Página neutra de ingreso, sin marca de DTD |
| Correo de ingreso | Sale del dominio de marca blanca, con el nombre del aliado |
| QR de etiquetas y link del proveedor | Apuntan a la dirección del aliado |
| Más adelante | El dominio propio del aliado, que da acceso para configurarlo |

### 2.3 Aspecto gráfico

| Tema | Decisión |
|---|---|
| Qué personaliza el aliado | Logo, nombre y un color principal, cargados por él en su portal. El sistema corrige el color si no contrasta |
| Diseño base del cliente final | La versión simple del portal (SDD-0654), sin dinero ni nada de DTD |
| Seguimiento del cliente final | Etapas y fecha estimada; sin contenedor, buque, naviera ni mapa |
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
| La URL base (`NEXT_PUBLIC_SITE_URL`) arma links de ingreso, comprobación de correo, registro por link y referidos | `app/entrar/actions.ts`, `lib/portal/correo-comprobacion.ts`, `lib/portal/registro-link-types.ts`, `app/portal/(app)/referidos/actions.ts` | C |
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
- **Las lecturas que muestran contenedor, buque y naviera** (`lib/portal/consolidation-queries.ts`, que hoy lee con el cliente admin) **dejan de devolver esos campos** cuando el rol es `cliente_final`. Igual las de facturas, estado de cuenta, club, referidos y academia: el servidor responde vacío o 404, no solo esconde el enlace.
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

- **La misma aplicación.** El dominio de marca blanca sirve la misma app Next.js, sin copiarla. Las fronteras del repo no cambian: el sitio público sigue sin importar `@/lib/studio`, `@/lib/db` ni `@supabase/*`, y el Studio no se publica en el dominio de marca blanca.
- **Marca por dirección**: el aliado se resuelve por el host antes del login, además de `get_portal_brand()` después.
- **La marca sube al aliado raíz** (SDD-0663 §3.5). Aquí cambia `get_portal_brand()`.
- **Antes del login, sin enumeración**: la página de ingreso de una dirección desconocida responde igual que la de una existente (página neutra), sin revelar si el aliado existe. El logo se sirve por una URL que no deja listar otros.
- **URL base por petición**: los cuatro usos de `SITE_URL`, el link del proveedor, `/verificar` y el QR toman la dirección del aliado.
- **Sesión**: las cookies no cruzan dominios; el ingreso y el callback de Supabase Auth necesitan el dominio de marca blanca y sus direcciones en la lista de redirecciones permitidas.
- **Marca que sube el aliado**: PNG, JPG o WebP con tamaño máximo; **sin SVG** (o saneado si Sam lo pide); Storage separado por aliado; color con contraste suficiente. La oficina tiene «restablecer marca» en el Studio.
- **Infraestructura** (tarea de ops con OK de Sam, fuera de esta spec): registro comodín en Cloudflare hacia el servidor, certificado comodín y envío de correo desde el dominio de marca blanca (SPF y DKIM).
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
| P5 | Dominio de marca blanca: marca por dirección, amarre en los dos sentidos, URL base, correo | Posible | No |
| P6 | Portal del cliente final e invitación por link | Sí | **Sí** |
| P7 | Mi marca (logo, nombre, color) | Sí (Storage) | No |

Aceptación por fase:

- **M**: Sam aprueba la maqueta.
- **P0**: con rol `cliente_final`, la lectura de envíos no trae contenedor, buque ni naviera, y facturas y estado de cuenta responden vacío; prueba por cada lectura. Un cliente directo ve lo mismo que hoy.
- **P1**: la RPC devuelve solo la cuenta del aliado que llama; otro aliado o un cliente final reciben rechazo.
- **P2**: el aliado registra un cliente y obtiene un código de su cadena; no puede registrar bajo otro aliado; el choque de prefijo da el mensaje neutro; editar no cambia el código; contrato SQL con mutantes.
- **P3**: la prealerta queda a nombre del cliente elegido y solo de un cliente de su cadena; el proveedor sigue sin ver nombre ni teléfono.
- **P4**: dos usuarios del mismo aliado ven lo mismo; el amarre exige el token; altas y bajas en auditoría; invitación de un solo uso.
- **P5**: las pruebas de amarre en los dos sentidos del §4.4; dirección desconocida y conocida responden igual antes del login; el QR y los links usan la dirección del aliado.
- **P6**: el cliente final entra por invitación de un solo uso y ve solo lo del §4.2; no ve nada de dinero.
- **P7**: un SVG o un archivo grande se rechazan; un color sin contraste se corrige; «restablecer marca» funciona.

Allowlist base (se detalla por fase antes de programarla): `app/portal/(app)/**` de las secciones nuevas, `lib/portal/consolidation-queries.ts`, `lib/portal/**` de las RPC nuevas, `app/portal/(app)/layout.tsx`, `proxy.ts`, `lib/studio/etiquetas-qr.ts`, los cuatro usos de `SITE_URL`, `lib/studio/aliados/brand-resolve.ts`, las migraciones con número del DG y sus contratos SQL, y el handoff.

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
| D2 | 2 · Minimización | Diseño | Solo nombre y teléfono; el teléfono se pide solo si el aliado eligió «DTD entrega al cliente final». Sin cédula, correo ni dirección |
| D3 | 4 y 5 · Supresión | **ENCONTRADO** | El aliado no borra (decisión de Sam) y no hay solicitud de supresión desde el portal (`app/privacidad/page.tsx:438-454`). **Quién la atiende:** el aliado la pide a la oficina, que borra con `softDeleteClientAction` (lógico, revoca el portal, auditoría sin datos: `mapa-de-borrado.md:324-333`). El cliente final puede pedirla al aliado o al correo de privacidad. El borrado definitivo del nombre y el teléfono queda **NO VERIFICABLE** hasta que el mapa de borrado lo cubra |
| D4 | 12 · Titulares que no son usuarios | **ENCONTRADO** | El cliente final no ve ninguna política de DTD (decisión: ningún término de DTD). El aviso le toca al aliado; el acuerdo con el aliado tiene que obligarlo |
| D5 | 9 · Transferencia a China | **CORRECTO** | El proveedor en `/p/[token]` no ve nombre ni teléfono (`lib/studio/prealertas/queries.ts:361-364`); el QR solo lleva el Shipping Mark y la caja (`lib/studio/etiquetas-qr.ts:31-41`); el equipo de China no ve nombres (`lib/studio/privacidad-cn.ts:92-158`). Con la marca blanca, `/p` mostrará la marca del aliado en vez de la de DTD; no agrega datos personales |
| D6 | 9 · Regla D-2 | No aplica | La D-2 prohíbe enviar datos de clientes a un proveedor de IA chino (SDD-0639 §4, citada en `docs/specs/0637-faro-asistente-ayuda/privacidad.md:145`). Esta spec no usa IA |
| D7 | Seguridad | **ENCONTRADO** | La ocultación del equipo de China no es frontera de base de datos (`lib/studio/privacidad-cn.ts:19-23`). Las RPC nuevas del aliado no deben devolver nombre ni teléfono a un usuario de región `cn` |
| D8 | Verificación contra datos | **NO VERIFICABLE** | No se probó ningún borrado contra una base real |

### 6.3 Qué tiene que pasar antes de producción

- La cláusula de la SDD-0255 §8.5 y el acuerdo con el aliado (abogado de Sam).
- La supresión del cliente final escrita en `docs/legal/privacidad/mapa-de-borrado.md`.
- La infraestructura del dominio de marca blanca, con OK de Sam.

## 7. Por confirmar con Sam

- El dominio de marca blanca y la forma exacta de la dirección de cada aliado.

## 8. Fuera de alcance

- Acceso propio de los subaliados.
- Avisos automáticos al cliente final y plantillas con la marca del aliado.
- Mostrar dinero al cliente final.
- El dominio propio de cada aliado.
- Consultas o cambios en producción.

## 9. Aceptación de esta spec

- [ ] Sam aprueba la spec.
- [ ] Sam aprueba la maqueta navegable (fase M).
- [ ] Sam decide el dominio de marca blanca.
- [ ] Existe la cláusula de la SDD-0255 §8.5 antes de P2, P3 y P6 en producción.
- [ ] El Director General asigna las fases y los números de migración.
