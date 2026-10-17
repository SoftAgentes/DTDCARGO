---
sdd: "0531"
title: "Ocultar nombres de clientes al equipo de China en Tracking y Naviera (PIPL)"
status: in-progress
author: "Sam (founder) + Claude"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0013", "0016", "0038", "0039", "0047", "0184", "0289", "0522", "0530"]
confidencialidad: interno
---

# SDD-0531 — Ocultar nombres de clientes al equipo de China en Tracking y Naviera (PIPL)

> Un usuario del Studio de la oficina de China (región `cn`, sin rol admin) deja
> de recibir en Tracking y en Naviera el nombre de los clientes y su ubicación de
> entrega. Ve el Shipping Mark y los códigos, igual que en Almacén CN. El
> ocultamiento ocurre en el servidor: el dato no llega a su navegador.

## Objetivo

**Lo que pidió Sam** (2026-10-15, opción elegida, transmitida por el Director):
«Ocultar nombres a usuarios de China». El Director se la describió así: «Hoy los
usuarios de China ven nombres de clientes en Tracking y Naviera; solo están
ocultos en el módulo CN. Es un tema de privacidad china (PIPL).»

Hasta hoy la regla vivía escrita a mano en una sola página
(`app/studio/(app)/cn/page.tsx`). Esta spec la pasa a un módulo compartido
(`lib/studio/privacidad-cn.ts`) y la aplica en las pantallas, la exportación y
las rutas JSON de Tracking y en la página y la asignación de carga de Naviera.

## Base: PIPL y la política publicada

Citado desde `.claude/skills/revisar-datos-ve/references/marco-legal-cn-pipl.md`.
Esto no es asesoría legal.

- **PIPL art. 3, supuesto 1.** El equipo propio en Yiwu que ve nombres,
  teléfonos o direcciones de clientes trata información personal **dentro de
  China**, sean los clientes de donde sean. La PIPL aplica directamente.
- **PIPL art. 6.** Finalidad clara y **mínimo alcance** necesario. Para recibir,
  estibar y consolidar no hace falta el nombre del importador: alcanza el
  Shipping Mark.
- **PIPL art. 51.** Control de permisos como medida técnica de protección.
- **La política publicada lo promete.** `app/privacidad/page.tsx:245-248`
  (§4): «Nuestro equipo en China, que trabaja solo con tu Shipping Mark… No ve
  tu nombre, ni tu documento, ni tu dirección, ni tu teléfono». Y `:274-280`
  (§5): «…está implementada en el sistema, no solo escrita acá». Con Tracking y
  Naviera mostrando nombres, esa frase era falsa: la regla de la casa es que la
  política no promete lo que el sistema no hace
  (`docs/engineering/project-rules.md` §Datos personales).
- **Precedente.** La auditoría de julio cerró la fuga en la app del teléfono
  (`docs/legal/privacidad/AUDITORIA-2026-07.md` H-7): «China ve códigos, no
  nombres» ya estaba en el Studio por SDD-0039 B.9, y el servidor resuelve el
  nombre desde el Shipping Mark (`resolveClientNameByMarkbox`). Esta spec aplica
  el mismo principio a las dos pantallas que quedaban.

## La regla

Igual a SDD-0039 B.9, sin cambios: **región `cn` sin rol `admin` no ve
nombres**. Admin de cualquier región y usuarios de Venezuela sí.

- `canSeeClientNames(membresía)` — la regla pura. Almacén CN la llama con la
  membresía que ya leyó para el idioma.
- `readCanSeeClientNames(supabase)` — lee la membresía **activa** del usuario de
  la **sesión** (`user_id` explícito, `disabled_at` nulo, `limit(1)`, como
  `getStudioAccess`) y **ante la duda oculta**: sin sesión, sin membresía o con
  la lectura en error devuelve «no ve».
- **Decisión: la región, no el alcance de almacén.** El encargo decía «región o
  alcance de China». `user_tenants.warehouse_scope` (SDD-0139) decide qué
  módulos con lado geográfico se abren; la región es la oficina, que es lo que
  define tratamiento en territorio chino. Usar el alcance cambiaría el
  comportamiento de Almacén CN, y el encargo pide conservarlo. Queda como
  pregunta para Sam en §Riesgos.

## Inventario de pantallas y campos

| Superficie | Antes llegaba al navegador del usuario de China | Ahora |
|---|---|---|
| `/studio/tracking` lista | `client_name` de cada envío activo (lista lateral, búsqueda local) | `null`; la fila muestra el Shipping Mark en vez de «Sin cliente» |
| `/studio/tracking` envío seleccionado | envío completo (nombre, `destination_gps`) a mapa, línea de tiempo y acciones | oculto antes de pasarlo (hoy son componentes de servidor; el contrato cubre que mañana no lo sean) |
| `/studio/tracking/[id]` encabezado | nombre del cliente | Shipping Mark |
| `/studio/tracking/[id]` panel de datos | `client_name` y `destination_gps` (campo editable) | sin esos campos; nota «La ubicación de entrega no se muestra en tu región» |
| `/studio/tracking/[id]` plan de fechas y cambio de destino | el envío entero como prop (se serializa) | el envío oculto |
| `/studio/tracking/nuevo` | hasta 500 nombres (autocompletado) y el buscador de clientes por cédula/nombre | ni la lista ni el buscador; sólo Shipping Mark; el servidor pone el nombre |
| `GET /api/studio/operativo/export?tipo=embarques` | columna `cliente` | vacía; cabecera igual |
| `GET /api/studio/shipments`, `GET\|PATCH /api/studio/shipments/[id]` | `client_name`, `destination_gps` | `null` |
| `/studio/naviera` contenedores | `consolidation_items.client_name` | `null` |
| `/studio/naviera` carga suelta | `shipments.client_name` | `null` |
| `/studio/naviera` estiba | `warehouse_boxes.client_name` | `null` |
| `/studio/naviera` plan de carga guardado | `input[].clientName`, `result.pasos/sinUbicar[].clientName` y el nombre dentro de `result.avisos[].mensaje` | `null` y «Lote sin Shipping Mark» en el aviso |
| `/studio/naviera` asignar carga | campo «Cliente» prellenado con el nombre | sin el campo; el servidor resuelve el nombre |

Los itinerarios, las reservas (`shipper` es la empresa que embarca, no el
cliente) y los catálogos no llevan datos del cliente. Las notas, motivos y
comentarios son texto libre y no se tocan (ver §Riesgos).

**Datos personales que se ocultan** (`CLAVES_DE_DATOS_DEL_CLIENTE`): nombre
(`client_name`, `clientName`, `customer_name`, `contact_name`), contacto
(`phone`, `email`, `whatsapp`, `client_phone`, `client_email`), dirección y
ubicación (`address`, `client_address`, `destination_gps`, `delivery_address`),
documento (`rif`, `cedula`, `document_number`, `client_document`, `client_rif`)
y quien firmó la entrega (`pod_signed_by`). Hoy en Tracking y Naviera aparecen
el nombre y `destination_gps`; las demás quedan cubiertas por si una consulta
las suma. El Shipping Mark (`markbox`, `client_markbox`) se conserva.

## Criterios de aceptación

1. **La regla vive en un solo lugar** y Almacén CN la usa sin cambiar lo que
   hace: sigue pidiendo `redactClientNames: true` para China sin admin y
   `false` para Venezuela. Evidencia: `app/studio/(app)/cn/__tests__/regla-nombres-compartida.test.ts`;
   matriz de la regla con admin en `lib/studio/__tests__/privacidad-cn.test.ts`.
2. **La lectura toma la membresía correcta y la duda oculta.** Con la de un
   compañero de Venezuela o una propia desactivada sembradas primero, el doble
   que filtra hace fallar la lectura que se las salte. Evidencia:
   `privacidad-cn.test.ts` «lectura…».
3. **Ningún dato del cliente con valor, a ninguna profundidad** — propiedad
   sobre 500 estructuras al azar con semilla, y el resto intacto y sin mutar la
   entrada. El conjunto se contrasta con un inventario escrito en la prueba, no
   leído del módulo. Evidencia: `privacidad-cn.test.ts` «propiedad…» y «el
   conjunto cubre el inventario…».
4. **Tracking en el servidor:** lo que cruza a cada componente (lista, panel de
   datos, plan de fechas, mapa, línea de tiempo, acciones) no lleva nombre ni
   ubicación, por clave y por valor; el encabezado y la fila muestran el
   Shipping Mark. Venezuela sigue igual. Evidencia (render en jsdom con las
   páginas reales): `app/studio/(app)/tracking/__tests__/ocultar-nombres-cn.test.tsx`.
5. **Búsqueda:** buscar el nombre no encuentra el envío; el Shipping Mark sí.
   Para Venezuela la búsqueda por nombre sigue. Mismo archivo.
6. **Guardar no borra lo que no se ve.** Con los nombres ocultos el panel guarda
   por `updateShipmentSinUbicacion`: relee la ubicación de ese envío en el
   servidor y delega en `updateShipment`; lo que mande el navegador en
   `destination_gps` no cuenta; sin permiso no lee ni delega. Evidencia:
   `app/studio/(app)/tracking/[id]/__tests__/datos-reservados-actions.test.tsx`.
7. **Alta:** para China la página no lee ni manda la lista de nombres, el
   formulario no tiene buscador de clientes y el servidor pone el nombre desde el
   Shipping Mark de su tenant (el mismo código en otro tenant no cuenta).
   Evidencia: `app/studio/(app)/tracking/nuevo/__tests__/ocultar-nombres-cn.test.tsx`.
8. **CSV y API JSON** sin nombre ni ubicación para China, cabecera del CSV
   igual. Evidencia: `app/api/studio/shipments/__tests__/ocultar-nombres-cn.test.ts`.
9. **Naviera:** lo que recibe `NavieraClient` no lleva nombres, ni dentro del
   texto de los avisos del plan; el Shipping Mark sigue en cada lugar. Al asignar
   carga el servidor pone el nombre desde el embarque de esa pieza o el Shipping
   Mark del tenant; para Venezuela se guarda lo escrito. Evidencia:
   `app/studio/(app)/naviera/__tests__/ocultar-nombres-cn.test.tsx`.
10. **Mutantes manuales** con control verde antes y después: cada uno muere con
    «N failed» (§Pruebas).

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/studio/privacidad-cn.ts` | nuevo · regla, lectura, ocultamiento profundo, plan de carga, etiqueta |
| `lib/studio/__tests__/privacidad-cn.test.ts` | nuevo |
| `lib/studio/__tests__/privacidad-cn-double.ts` | nuevo · doble que filtra, devuelve copias y modela UPDATE con la fila entera |
| `app/studio/(app)/cn/page.tsx` | llama la regla compartida (una línea y su import) |
| `app/studio/(app)/cn/__tests__/regla-nombres-compartida.test.ts` | nuevo |
| `app/studio/(app)/tracking/page.tsx` | lee la regla y oculta lista y seleccionado |
| `app/studio/(app)/tracking/_components/ActiveShipmentList.tsx` | prop `nombresOcultos`; Shipping Mark en vez de «Sin cliente» |
| `app/studio/(app)/tracking/[id]/page.tsx` | lee la regla y oculta el envío antes de los paneles |
| `app/studio/(app)/tracking/[id]/_components/ShipmentHeader.tsx` | prop `nombresOcultos` |
| `app/studio/(app)/tracking/[id]/_components/ShipmentDataPanel.tsx` | sin nombre ni ubicación; guarda por la acción nueva |
| `app/studio/(app)/tracking/[id]/datos-reservados-actions.ts` | nuevo · `updateShipmentSinUbicacion` |
| `app/studio/(app)/tracking/[id]/__tests__/datos-reservados-actions.test.tsx` | nuevo |
| `app/studio/(app)/tracking/nuevo/page.tsx` | sin lista de nombres para China |
| `app/studio/(app)/tracking/nuevo/_components/CreateShipmentForm.tsx` | sin buscador de clientes para China |
| `app/studio/(app)/tracking/nuevo/actions.ts` | nombre resuelto en el servidor para China |
| `app/studio/(app)/tracking/nuevo/__tests__/ocultar-nombres-cn.test.tsx` | nuevo |
| `app/studio/(app)/tracking/__tests__/ocultar-nombres-cn.test.tsx` | nuevo |
| `app/api/studio/operativo/export/route.ts` | CSV de embarques oculto para China |
| `app/api/studio/shipments/route.ts` | GET oculto para China |
| `app/api/studio/shipments/[id]/route.ts` | GET y respuesta del PATCH ocultos para China |
| `app/api/studio/shipments/__tests__/ocultar-nombres-cn.test.ts` | nuevo |
| `app/studio/(app)/naviera/page.tsx` | lee la regla y oculta contenedores, carga suelta, estiba y plan |
| `app/studio/(app)/naviera/_components/NavieraClient.tsx` | prop `nombresOcultos` hacia el cajón de asignar |
| `app/studio/(app)/naviera/_components/AssignCargoDrawer.tsx` | sin campo «Cliente» para China |
| `app/studio/(app)/naviera/actions.ts` | `assignLooseCargo` resuelve el nombre en el servidor para China |
| `app/studio/(app)/naviera/__tests__/ocultar-nombres-cn.test.tsx` | nuevo |
| `lib/studio/rbac-actions-guard.test.ts` | inventario 74 → 75 archivos (con prefijo 20 → 21) y 430 → 431 acciones, con la justificación escrita |
| `docs/specs/0531-ocultar-nombres-cn/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0531-ocultar-nombres-cn.md` | handoff |

**Fuera, por encargo:** `app/studio/(app)/embarques/**` (SDD-0522, PR #232),
`app/studio/(app)/tracking/[id]/actions.ts` y `_components/FooterActions.tsx`
(también de la 0522), `lib/studio/rbac.ts`, el Portal, la app del teléfono y las
notificaciones. No hizo falta tocar `rbac.ts`. La fila del mapa módulo↔spec
(`docs/architecture/module-sdd-map.md`) se agrega al cerrar la spec.

## Por qué no hay migración

La 0481 quedó sin usar. Una vista o RPC «con frontera de región» sólo para
Tracking y Naviera **no garantizaría** que el dato no llegue: la RLS de
`shipments` compara sólo tenant (`supabase/migrations/0012_rls_perf_and_rpc_guards.sql:228-231`,
y la 0230 le quitó `deleted_at`), igual la de `clients`
(`0456_clients_write_rbac.sql:203-204`), y el navegador del Studio tiene un
cliente de Supabase con la sesión (`lib/db/client.ts`). Un usuario que consulte
PostgREST con su propio token seguiría leyendo `shipments.client_name` y la
tabla `clients` entera, con o sin vista. Cerrar eso exige quitar el SELECT de
esas columnas a `authenticated` y pasar **todos** sus lectores del Studio
(decenas, en muchos módulos) a vistas o RPC con la regla: es otra spec, con su
propia migración y su OK. Esta spec hace lo mismo que Almacén CN —minimizar en
el servidor lo que el Studio entrega— y deja el hueco de base escrito como
riesgo, no como resuelto.

## Revisión de datos personales (`/revisar-datos-ve`)

Advisory; no afirma cumplimiento. Sólo `ENCONTRADO`, `CORRECTO` o `NO VERIFICABLE`.

| Punto | Estado | Evidencia |
|---|---|---|
| Tracking y Naviera entregaban el nombre del cliente al equipo de China, contra `/privacidad` §4 | ENCONTRADO y corregido en esta spec | antes: `app/studio/(app)/tracking/page.tsx` pasaba `client_name` a `ActiveShipmentList`; ahora `:71-75`, `:105`; detalle `[id]/page.tsx:65-66`; Naviera `naviera/page.tsx:45`, `:81-90`, `:106-118` |
| El ocultamiento ocurre antes de serializar hacia el navegador | CORRECTO | `lib/studio/privacidad-cn.ts:140` (`ocultarDatosDelCliente`), aplicado en las páginas y rutas de la allowlist; pruebas por clave y por valor sobre las props de los componentes de cliente |
| La escritura no obliga a mandar el nombre al navegador | CORRECTO | `tracking/nuevo/actions.ts:97` y `naviera/actions.ts:832` lo resuelven en el servidor (mismo principio que H-7) |
| Guardar no borra la ubicación que no se ve | CORRECTO | `tracking/[id]/datos-reservados-actions.ts` |
| La base sigue entregando nombres a cualquier sesión del tenant vía PostgREST | ENCONTRADO (fuera de alcance) | RLS sólo por tenant: `0012_rls_perf_and_rpc_guards.sql:228-231`, `0456_clients_write_rbac.sql:203-204`; cliente de navegador con sesión: `lib/db/client.ts`. Ver §Por qué no hay migración |
| Almacén CN manda la tabla `clients` completa al navegador del equipo de China | ENCONTRADO (fuera de alcance; el encargo pide no cambiar CN) | `app/studio/(app)/cn/page.tsx:75` (`listClients`) → `AlmacenCnClient`; columnas en `lib/studio/client-queries.ts:39-40` (nombre, correo, teléfono, dirección, RIF, `lat`/`lng`, `cedula_photo_path`) |
| La búsqueda global y el buscador de clientes devuelven nombres sin la regla | ENCONTRADO (fuera de alcance) | `lib/studio/global-search/search-action.ts:109`, `:136`; `lib/studio/client-search-action.ts:94` |
| Admin de la región China ve nombres | ENCONTRADO (decisión de Sam) | la regla de SDD-0039 lo permite (`privacidad-cn.ts:42-46`); `/privacidad` §4 dice que el equipo de China no ve el nombre, sin excepción |
| Textos libres (notas, motivos, eventos, comentarios, nombres de archivo) y el contenido de BL/POD | NO VERIFICABLE | pueden citar nombre o teléfono; no se reescriben porque son editables y reescribirlos borraría el dato (`ShipmentDataPanel` guarda `notes`) |
| Qué usuarios tienen región `cn` en producción y qué vieron antes | NO VERIFICABLE | no se leyó producción (sin autorización para filas ni PII) |
| `registro-tratamiento.md:23` y `:26` dicen que nombre y teléfono los ve el «Equipo VE y CN» | ENCONTRADO (documental, fuera de alcance) | contradice `/privacidad` §4; lo decide Sam con la abogada |

Marco: PIPL arts. 3, 6 y 51 (equipo de Yiwu); en Venezuela, CRBV art. 28
(habeas data) y la Ley Especial contra los Delitos Informáticos, arts. 20-22, por
revelación indebida. Esto no es asesoría legal.

## Gobernanza

- **BUS-01:** cumplimiento — la búsqueda de Tracking sólo encuentra lo que el
  usuario puede ver: el nombre no está en los datos que llegan, así que no hay
  coincidencia por nombre ni forma de descubrirlo buscando.
- **SGE-00 / MP-01 / AUD-01:** no aplica — no hay acción nueva que borre, anule
  ni audite; `updateShipmentSinUbicacion` es una puerta más angosta de
  `updateShipment` (mismo candado de edición, un campo menos).
- **BTN-01:** no aplica — no hay botones nuevos.
- **CMP-01:** cumplimiento — ningún componente nuevo ni consumidor de un
  `deprecated`; se reusan los campos y el shell existentes.
- **A11Y-01:** cumplimiento — los avisos nuevos son texto (`<p>`/`<div>`), con
  tokens de contraste del sistema (`--ink-soft`).

## Riesgos

1. **La base no tiene frontera de región** (ver §Por qué no hay migración). Esto
   minimiza lo que el Studio entrega; no detiene a quien consulte la API de
   Supabase con su sesión. Es el riesgo principal y queda propuesto como spec
   aparte.
2. **Admin de China ve nombres.** Es la regla vigente; `/privacidad` §4 no hace
   esa excepción. Decide Sam.
3. **Región, no alcance.** Un usuario con región `ve` y alcance de almacén `cn`
   ve nombres. Si Sam quiere que el alcance también cuente, cambia Almacén CN y
   se hace en otra spec.
4. **Textos libres y documentos** pueden llevar nombres o teléfonos (notas,
   comentarios, motivos, nombres de archivo, el BL y el POD que se abren desde
   el detalle).
5. **El reemplazo en los avisos del plan** busca cada nombre de `input` dentro
   del texto del aviso. Un nombre muy corto podría coincidir con parte de otra
   palabra del aviso y reemplazarla; los avisos son plantillas cortas del motor
   (`lib/shared/estiba-plan.ts:453`) y sólo se toca ese texto, que no se edita.
6. **Carrera al guardar la ubicación conservada:** si alguien cambia la
   ubicación entre la relectura y el guardado, gana la relectura. Es la misma
   ventana que ya tenía el formulario completo con cualquier otro campo.
7. **Conflicto previsto con la PR #232 (SDD-0522):** `lib/studio/rbac-actions-guard.test.ts`
   suma una acción cada una. `git merge-tree` contra
   `origin/codex/borrar-embarques-recepciones` deja sólo ese archivo en
   conflicto (`cn/page.tsx`, `tracking/[id]/page.tsx` y
   `api/studio/shipments/[id]/route.ts` se mezclan solos). Al integrar la
   segunda, los números quedan en 76 archivos (55 exactos, 21 con prefijo) y 432
   acciones. Contra `origin/codex/naviera-zarpado-avisa` (PR #233) la mezcla es
   limpia.

## Pruebas

Focalizadas (todas verdes): las siete suites nuevas y las existentes de
`app/studio/(app)/{tracking,naviera,cn,__tests__}`, `app/api/studio`,
`lib/studio/naviera`, `lib/studio/export` y el contrato anti-drift
`lib/studio/rbac-actions-guard.test.ts`.

Mutantes manuales (control verde antes y después; muerto = exit ≠ 0 con «N
failed»): 34 de 34 muertos, sobre la regla, la lectura (sin `user_id`, sin `disabled_at`,
fallo abierto), el conjunto de claves (sin `client_name`, `clientName`,
`destination_gps`), el ocultamiento (sin recursión, mutando la entrada), el
plan (sin limpiar avisos), cada página y ruta (sin ocultar), la acción que
conserva la ubicación (sin `.eq("id")`, aceptando la del navegador), el panel
(acción equivocada, GPS visible), las etiquetas, el alta (lista, resolución,
buscador), Naviera (cada prop, la resolución y su `.eq("id")`, el campo del
cajón), el CSV, la API y Almacén CN. La corrida y su conteo están en el handoff.

## Cierre

Pendiente: revisión del Director, `pnpm verify` completo (turno de corrida
pesada) y el smoke de Sam del handoff.

## Registro de integración (2026-10-15)

- **PR:** #234 (`codex/ocultar-nombres-cn`). Cabeza `01c3fcea` fusionada con `--match-head-commit`; merge `1bc88fca` a las 13:50:13Z.
- **CI:** «Calidad continua» PASÓ sobre esa cabeza (run 38742522922), con la suite y el build. `pnpm verify` local: NO EJECUTADO (una corrida pesada a la vez; el CI corre la suite completa).
- **Deploy:** el status de Vercel del merge dice «Deployment has completed» (13:51:44Z). El ID del deployment y el alias quedan NO VERIFICADOS: el conector de Vercel responde 403.
- **Conflicto al integrar:** `lib/studio/rbac-actions-guard.test.ts` cambió de totales con main; el Director lo resolvió con 76 archivos (55 exactos y 21 con prefijo) y 432 acciones, y la prueba pasó 437/437.
- **Smoke de Sam: PENDIENTE.** Guion en `.agents/handoffs/0531-ocultar-nombres-cn.md` § «Smoke para Sam».
- **Estado:** integrada. La spec sigue en `in-progress` hasta el smoke.
