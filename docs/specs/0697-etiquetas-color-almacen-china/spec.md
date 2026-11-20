---
sdd: "0697"
title: "Etiquetas de color en Almacén China: catálogo propio, historial y lo que ve Venezuela"
status: draft
author: "Claude (Worker) + Sam"
created: 2026-11-20
updated: 2026-11-20
supersedes: null
superseded_by: null
related: ["0008", "0039", "0139", "0152", "0196", "0531", "0563", "0682"]
confidencialidad: interno
---

# SDD-0697 — Etiquetas de color en Almacén China

> Sam, 2026-11-20: en China le ponen etiquetas de color a los embarques, y cada embarque tiene un historial.
> El almacén de China tiene que poder crear sus propias etiquetas, con una lógica clara. Ejemplos:
> «Devolución de impuestos», marca sin documentación y «Montacargas». Hay más.

**Estado: borrador para preguntas.** No hay migración escrita ni aplicada, nada en producción y nada fusionado.
Se midió solo en código y migraciones (base `origin/main` `6a7787d08`, con la 0682 adentro); no se leyó ninguna fila de producción.
Las preguntas abiertas están en el §7 y se le hacen a Sam una por una.

## 1. Qué hay hoy (medido)

### 1.1 No hay etiquetas de negocio en el esquema

- En `supabase/migrations/` (552 archivos, hasta la 0567) no hay ninguna tabla ni columna de etiquetas
  para recepciones ni para embarques. Las coincidencias de «tag»/«etiqueta» son de otras cosas: las
  etiquetas físicas con QR de cada caja (`warehouse_boxes`, `supabase/migrations/0240_warehouse_boxes.sql:46`),
  el servicio «Etiquetado por pieza» (`supabase/migrations/0150_prealerta_addons.sql:274`) y las etiquetas de
  Kommo (`patch_tags`, `supabase/migrations/0365_kommo_outbox_claim.sql:57`).
- **Choque de nombre.** El Studio ya tiene un módulo que se llama «Etiquetas CN», en `/studio/etiquetas`
  (`lib/studio/modules.ts:111`, id `labels`): es la impresión de etiquetas con QR. Si la función nueva se
  llama solo «Etiquetas», el equipo de China va a confundir las dos (pregunta 1, §7).

### 1.2 La recepción ya tiene historial; Almacén China no lo muestra

- `warehouse_receipt_events` es el historial de cada recepción: `event_type`, `description`, `occurred_at`,
  `created_by`, con borrado lógico y RLS por tenant (`supabase/migrations/0008_warehouses_cn.sql:127-143`,
  `:239`; política rehecha en `supabase/migrations/0012_rls_perf_and_rpc_guards.sql:273-274`).
- Los tipos de evento son un enum cerrado: `received`, `consolidated`, `incident`, `note`, `status_change`
  (`supabase/migrations/0008_warehouses_cn.sql:15-21`). Ninguna migración posterior le agrega valores.
- Las acciones de la pantalla escriben ahí al crear, cambiar de estado, marcar incidencia y facturar
  (`app/studio/(app)/cn/actions.ts:231`, `:618`, `:690`, `:762`, `:838`, `:902`).
- La lectura existe (`listEventsForReceipt`, `lib/studio/warehouse-cn-queries.ts:252-265`), pero **nadie la
  llama**: Almacén China no tiene pantalla de detalle ni panel de historial. Hoy el historial se escribe y no
  se ve.

### 1.3 El embarque tiene otro historial, y ese lo ve el cliente

- `shipment_events` es el historial del embarque (`supabase/migrations/0002_shipments.sql:64-76`). Desde la
  SDD-0132 tiene una política para que **el cliente del portal lea los eventos de sus envíos**
  (`supabase/migrations/0196_shipment_events_portal_rls.sql`), y el portal los lee con su `note`
  (`lib/portal/shipment-events-queries.ts:55-56`, `:98-99`).
- Consecuencia: una etiqueta como «Devolución de impuestos» o la de marca sin documentos **no puede
  escribirse en `shipment_events`**: le llegaría al cliente. Su rastro va en el historial de la recepción.

### 1.4 Recepción y embarque

- La recepción (`warehouse_receipts_cn`) nace en China; al consolidarse recibe `shipment_id`
  (`supabase/migrations/0008_warehouses_cn.sql:73-74`). El embarque existe recién desde ahí, y un embarque se
  puede partir (SDD-0563, `supabase/migrations/0563_partir_embarque_y_medidas.sql`).
- Lo que China toca es la recepción: es lo que ve en «En almacén», y en «En camino» ve las recepciones
  consolidadas de cada contenedor (SDD-0682, `lib/studio/almacen-cn-contenedores-queries.ts`).

### 1.5 Idioma, privacidad y permisos

- La pantalla resuelve el idioma por perfil y región (`app/studio/(app)/cn/page.tsx:62-82`) y tiene
  diccionario es-VE y zh-CN (`lib/i18n/es-VE/warehouse.ts`, `lib/i18n/zh-CN/warehouse.ts`, 369 líneas). El
  zh-CN dice que debe revisarlo un hablante nativo antes de producción (`lib/i18n/zh-CN/warehouse.ts:4`).
- Privacidad: región `cn` sin rol `admin` no ve nombres de clientes, solo el MARKBOX; la regla vive en
  `lib/studio/privacidad-cn.ts` (SDD-0039 B.9, SDD-0531) y se aplica en el servidor
  (`app/studio/(app)/cn/page.tsx:83-86`).
- Ven Almacén China `operations`, `warehouse` y `support` (`lib/studio/rbac.ts:70`); Almacén VE, los mismos
  (`lib/studio/rbac.ts:73`). Embarques y Tracking los ve casi todo el equipo (`lib/studio/rbac.ts:64-65`).
- Colores: `BRAND.md:16` prohíbe inventar colores; hay que usar las variables del sistema (`--danger`,
  `--warning`, `--success`, `--info`, la tinta y el azul de acción del rebrand). El dorado como texto de
  insignia no se lee (`BRAND.md:137`): va como punto con texto en tinta.

## 2. La lógica propuesta

### 2.0 Color de fila y avisos: dos cosas distintas (Sam, 2026-11-20)

Sam mostró la hoja del contenedor (`CONT 53 YW` … `DTD-63-DG`): cada fila va pintada entera (verde, naranja,
blanco), la columna REMARKS lleva códigos arancelarios y notas en chino, y un bloque lleva al lado 封门
(«puerta sellada»). Y planteó el problema: una misma carga puede tener dos situaciones a la vez (marca sin
registro confirmado **y** carga especial), y una fila no puede tener dos colores.

Así lo resuelven los sistemas de almacén y de carga (WMS/TMS): separan dos capas.

| Capa | Cuántas por fila | Cómo se ve | Ejemplo |
|---|---|---|---|
| **Estado** | una sola | el color de la fila, como en el Excel | verde, naranja |
| **Avisos** | varias | íconos con texto en una columna propia | «Marca sin autorización» + «Montacargas» |

- El color de fila responde «¿en qué paso va?». Es uno solo y lo decide una regla, no la mano.
- Los avisos responden «¿qué hay que saber de esta carga?». Se suman sin combinarse: nunca se crea un aviso
  «marca sin autorización con montacargas». Dos situaciones = dos avisos.
- Para que no se multipliquen, el catálogo se ordena en tres grupos: **Carga especial** (rasgo de la
  mercancía: montacargas, batería de litio, frágil), **Documentos y aduana** (marca sin autorización, falta
  factura) y **Trámite con el proveedor** (devolución de impuestos). Los dos últimos se resuelven y se
  quitan; el primero acompaña la carga hasta Venezuela.
- La pantalla «En almacén» se ve como la hoja: columnas en el mismo orden que el Excel (MARKS, descripción,
  CTN, piezas, peso, CBM, recibido, REMARKS), filas pintadas por estado, totales abajo y la columna de avisos.
  Al consolidar, la fila sale del almacén y pasa a «En camino», que hace el papel del documento «consolidado»
  (SDD-0682).
- Falta saber qué significa cada color de la hoja hoy (pregunta 0, §7). Si el color ya es un aviso
  (por ejemplo, naranja = «hay un problema»), se vuelve aviso y el color de fila queda para el estado.

En esta spec, «etiqueta» se lee como **aviso** hasta que Sam elija el nombre (pregunta 1).

### 2.0b Qué responde cada aviso

Una etiqueta es **un aviso operativo sobre una recepción**: dice algo que el que la toca después tiene que
saber o hacer. No es un estado (el estado sigue siendo pendiente, consolidado o incidencia) y no bloquea
nada en esta fase.

Cada etiqueta del catálogo responde cuatro cosas:

| Campo | Para qué | Ejemplo «Montacargas» |
|---|---|---|
| Nombre (es-VE y zh-CN) | Lo que se lee en la insignia | «Montacargas» / 叉车 |
| Color | Distinguir de un vistazo, de una paleta fija | dorado (atención) |
| Descripción (es-VE y zh-CN) | Qué significa y qué hay que hacer | «Carga pesada o paletizada: hace falta montacargas para bajarla. En China lo paga el proveedor; en Venezuela hay que tenerlo listo.» |
| ¿La ve Venezuela? | Si sale en Almacén VE, Embarques y Tracking | sí |

### 2.1 Catálogo por tenant

- Tabla nueva `warehouse_tags` (nombre provisional): `tenant_id`, `nombre_es`, `nombre_zh`, `descripcion_es`,
  `descripcion_zh`, `color` (una clave de la paleta fija, no un hex libre), `visible_ve` (booleano), `orden`,
  `created_by`, `created_at`, `updated_at`, `archived_at`.
- Nombre único por tenant entre las vivas (sin distinguir mayúsculas), en cada idioma.
- **No se borra: se archiva.** Una etiqueta archivada no se puede asignar, pero sigue leyéndose en el historial
  y en las recepciones que ya la tienen.
- Hace falta al menos uno de los dos nombres. Si falta el otro idioma, la pantalla muestra el que hay con la
  marca «sin traducir», para que alguien lo complete (§5).
- Paleta fija de seis, todas de variables existentes: rojo (`--danger`), dorado (`--warning`), verde
  (`--success`), azul (acción), navy (`--ink`) y gris (`--ink-soft`). La insignia siempre lleva texto: el color
  ayuda, no informa solo. Un color nuevo necesita OK de diseño, no se agrega desde la pantalla.
- **Quién crea y edita** (propuesta, pregunta 2): `admin` y `warehouse`. `operations` asigna pero no edita el
  catálogo; `support` solo ve.

### 2.2 Asignación a la recepción

- Tabla nueva `warehouse_receipt_tags`: `tenant_id`, `receipt_id`, `tag_id`, `nota` (opcional, corta),
  `assigned_by`, `assigned_at`, `removed_by`, `removed_at`. Una etiqueta viva por recepción (índice único
  parcial `receipt_id, tag_id where removed_at is null`).
- Se asigna a la **recepción** (pregunta 3): es lo que China tiene en la mano, existe antes del embarque y
  aguanta que el embarque se parta. El embarque **hereda** las etiquetas de sus recepciones: al mirar un
  embarque se juntan las etiquetas vivas de las recepciones con su `shipment_id`, sin copiarlas.
- Se puede asignar en cualquier estado de la recepción, también después de consolidar (en «En camino»).
- Quitar una etiqueta no la borra: marca `removed_at` y queda en el historial (pregunta 5).
- Varias etiquetas por recepción; en la tabla se ven como insignias en la fila, hasta tres y «+N».
- Filtro por etiqueta en «En almacén» y «En camino».

### 2.3 Rastro en el historial

- Cada asignación y cada retiro escribe una fila en `warehouse_receipt_events`, con dos tipos nuevos del enum:
  `tag_added` y `tag_removed`. La `description` guarda una foto del nombre (es y zh) y la nota, para que el
  historial se siga leyendo igual aunque después renombren o archiven la etiqueta.
- Lo escribe la misma función que asigna, en la misma transacción (un RPC `security definer` con chequeo de
  tenant y de rol, patrón de las RPC de bodega), para que no haya etiqueta sin rastro ni rastro sin etiqueta.
- Cambios al catálogo (crear, renombrar, cambiar color o visibilidad, archivar) quedan en `entity_audit_log`,
  como el resto de catálogos.
- **Se agrega a Almacén China un panel de historial por recepción** (§1.2: hoy no existe), que lee
  `listEventsForReceipt`. Sin ese panel, el «rastro en el historial» no lo vería nadie.
- Nada de esto se escribe en `shipment_events` (§1.3).
- Nota técnica: `alter type … add value` no se puede usar dentro de la misma transacción que lo crea; la
  migración separa el cambio del enum del resto, o se usa un `text` con `check`. Lo decide la implementación.

### 2.4 Qué ve Venezuela

- Solo las etiquetas con `visible_ve = true`. Las demás son de trabajo interno de China.
- Dónde: Almacén VE (recepción en Caracas), el detalle del embarque en Embarques y en Tracking, como
  insignias con su descripción al pasar el cursor o tocar.
- Propuesta de partida para las tres de Sam (pregunta 4):

| Etiqueta | ¿La ve Venezuela? | Por qué |
|---|---|---|
| Montacargas | sí | Aquí también hay que tener montacargas listo |
| Marca sin documentos | sí | Puede trabarse en la aduana de Venezuela |
| Devolución de impuestos | no | Es un trámite con el proveedor en China |

- Venezuela **no** edita el catálogo de China ni quita etiquetas de China en esta fase.

### 2.5 El cliente no ve ninguna

Las etiquetas no llegan al portal ni al rastreo público (pregunta 6). Por eso viven fuera de
`shipment_events` y las lecturas del portal no las tocan. Una etiqueta como la de marca sin documentos
dicha al cliente es otra conversación, con su texto propio.

## 3. Privacidad (SDD-0039 B.9 y SDD-0531)

- El catálogo no tiene datos personales: son nombres de situaciones, no de personas.
- La recepción etiquetada se sigue mostrando a China con el MARKBOX; las lecturas nuevas (filtro, insignias,
  historial) pasan por la misma regla `canSeeClientNames`, en el servidor. Ninguna consulta nueva trae
  `client_name` para un usuario `cn` sin admin.
- **La nota libre es el riesgo.** Alguien puede escribir ahí el nombre del importador o el WeChat del
  proveedor, y ese texto lo vería Venezuela, o China si lo escribe Venezuela. Propuesta: nota opcional, de
  hasta 140 caracteres, con la ayuda «No escribas nombres, teléfonos ni contactos». No se valida el contenido.
- Proveedores: el contacto de un proveedor chino es dato personal bajo la PIPL (art. 6, mínimo alcance). Las
  etiquetas no lo piden ni lo guardan.
- Esta spec pasa por `.claude/skills/revisar-datos-ve/SKILL.md` antes de implementarse, por la nota libre.

## 4. Texto para la marca sin documentos

«Posible piratería» no sirve en la insignia: acusa sin pruebas y lo lee todo el que toca la carga. Lo que se
ve en el almacén es un hecho: llegó una marca conocida sin papeles. Propuesta (pregunta 7):

| | es-VE | zh-CN |
|---|---|---|
| **Nombre (recomendado)** | **Marca sin autorización** | 品牌无授权 |
| Alternativa A | Marca sin documentos | 品牌无文件 |
| Alternativa B | Marca por verificar | 品牌待核实 |
| Descripción | «Llega una marca conocida sin registro de marca ni carta de autorización del dueño de la marca. Pide los papeles al proveedor antes de embarcar: sin ellos la carga puede retenerse en la aduana.» | 「知名品牌货物到仓，但没有商标注册证或品牌授权书。装柜前请向供应商索取文件，否则货物可能在海关被扣。」 |

La recomendada nombra lo que falta (la autorización del dueño de la marca), que es lo que pide la aduana, y no
juzga al proveedor. El chino lo debe revisar un hablante nativo antes de producción.

## 5. i18n es-VE y zh-CN

- El texto de cada etiqueta es **dato**, no diccionario: vive en el catálogo con sus dos idiomas
  (`nombre_es`/`nombre_zh`, `descripcion_es`/`descripcion_zh`).
- El texto de la interfaz (crear etiqueta, asignar, quitar, filtro, historial, «sin traducir», la ayuda de la
  nota) va al diccionario `warehouse_cn.tags.*` en `lib/i18n/es-VE/warehouse.ts` y `lib/i18n/zh-CN/warehouse.ts`.
- Se muestra en el idioma del usuario; si falta, el otro con la marca «sin traducir» / 未翻译.
- En Venezuela (Almacén VE, Embarques, Tracking) se muestra `nombre_es`; si solo hay chino, el chino con
  «sin traducir».
- Sin traducción automática en esta fase.

## 6. Alcance

**Entra (fase 1):** catálogo con crear, editar y archivar; asignar y quitar en Almacén China (En almacén y En
camino); historial por recepción con los eventos nuevos; filtro por etiqueta; insignias de solo lectura en
Almacén VE, Embarques y Tracking para las `visible_ve`; las etiquetas iniciales que Sam confirme, sembradas
en la migración.

**No entra:** etiquetas que bloqueen o cambien un estado; etiquetas creadas por Venezuela; la app del teléfono
(`/m/cn`); avisos por correo o Telegram al asignar; reportes y KPI por etiqueta; el portal del cliente.

**Por definir con el DG:** el orden con la SDD-0682 fase 2 («Pendiente por liberar»), que toca la misma
pantalla.

## 7. Preguntas para Sam (una por una)

0. **Los colores de la hoja.** ¿Qué quiere decir hoy el verde, el naranja y el blanco en la hoja del
   contenedor, y qué es 封门? Ejemplo: «verde = ya recibido con papeles; naranja = recibido con algo
   pendiente».
1. **Nombre.** Ya existe «Etiquetas CN» (la impresión de etiquetas con QR). ¿Cómo llamamos a esto? Ejemplo:
   «Etiquetas de color» en el menú y «Etiqueta» en la fila.
2. **Quién crea.** ¿Quién puede crear y editar etiquetas? Ejemplo: el jefe del almacén de China crea
   «Montacargas»; un operario solo la pone.
3. **Dónde va.** ¿A la recepción (WR) o al embarque? Ejemplo: la WR-2026-0412 llega con marca sin papeles y
   se etiqueta ahí; el embarque la hereda.
4. **Qué ve Venezuela.** ¿Te sirve la tabla del §2.4? Ejemplo: Caracas ve «Montacargas», no ve «Devolución de
   impuestos».
5. **Quitar.** ¿Se pueden quitar? Ejemplo: llega la carta de autorización y quitan «Marca sin autorización»;
   queda en el historial quién la quitó y cuándo.
6. **El cliente.** ¿El cliente nunca ve ninguna? Ejemplo: el importador no ve «Montacargas» en su portal.
7. **Texto de la marca.** ¿«Marca sin autorización», «Marca sin documentos» o «Marca por verificar»?
8. **Las otras.** ¿Qué otras etiquetas usan hoy en China, con su color? Ejemplo: «Frágil», en rojo.
9. **Nota.** ¿La etiqueta lleva una nota corta? Ejemplo: «Montacargas · 2 paletas de 800 kg».

## 8. Criterios de aceptación (borrador)

- Un usuario `warehouse` crea una etiqueta con nombre es y zh, color y visibilidad, y la ve en el catálogo.
- La asigna a una recepción; la fila muestra la insignia y el historial muestra «etiqueta agregada», con quién
  y cuándo, en el idioma del usuario.
- La quita; la insignia desaparece y el historial muestra «etiqueta quitada».
- Renombrarla después no cambia lo que dice el historial.
- Una etiqueta archivada no aparece al asignar y sigue leyéndose donde ya estaba.
- Venezuela ve en el embarque las etiquetas `visible_ve` de sus recepciones, y ninguna de las otras.
- Un usuario `cn` sin admin no recibe el nombre del cliente en ninguna lectura nueva (prueba de servidor).
- El portal del cliente no recibe ninguna etiqueta (prueba de las lecturas del portal).
- RLS: un tenant no ve ni asigna etiquetas de otro (prueba SQL).
