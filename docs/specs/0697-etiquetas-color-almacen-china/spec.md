---
sdd: "0697"
title: "Indicadores de carga en Almacén China: catálogo propio, historial, consecuencias y lo que ve Venezuela"
status: draft
author: "Claude (Worker) + Sam"
created: 2026-11-20
updated: 2026-11-20
supersedes: null
superseded_by: null
related: ["0008", "0039", "0067", "0139", "0152", "0196", "0476", "0522", "0531", "0563", "0682"]
confidencialidad: interno
---

# SDD-0697 — Indicadores de carga en Almacén China (etiquetas de color)

> Sam, 2026-11-20: en China le ponen etiquetas de color a los embarques, y cada embarque tiene un historial.
> El almacén de China tiene que poder crear sus propias etiquetas, con una lógica clara. Ejemplos:
> «Devolución de impuestos», marca sin documentación y «Montacargas». Hay más.

**Estado: borrador para preguntas.** No hay migración escrita ni aplicada, nada en producción y nada
fusionado. Se midió solo en código y migraciones (base `origin/main` `6a7787d08`, con la 0682 adentro); no
se leyó ninguna fila de producción. Las preguntas abiertas están en el §7 y se le hacen a Sam una por una.
Segunda vuelta: corrige la revisión independiente sobre `fc390fd77`.

## 1. Qué hay hoy (medido)

### 1.1 No hay etiquetas de negocio en el esquema

- En `supabase/migrations/` (552 archivos, hasta la 0567) no hay ninguna tabla ni columna de etiquetas
  para recepciones ni para embarques. Las coincidencias de «tag»/«etiqueta» son de otras cosas: las
  etiquetas físicas con QR de cada caja (`warehouse_boxes`, `supabase/migrations/0240_warehouse_boxes.sql:42`),
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
- **Escritores.** Con la sesión del usuario, las acciones de la pantalla al crear, cambiar de estado, marcar
  incidencia y operar en lote (`app/studio/(app)/cn/actions.ts:231`, `:618`, `:690`, `:762`, `:838`, `:902`).
  Con cliente de servicio, tres notas de sistema (`event_type = 'note'`): el aviso de bodega al crear
  (`app/studio/(app)/cn/actions.ts:342`) y las dos notas de la facturación automática
  (`app/studio/(app)/cn/actions.ts:579`, `:590`).
- **Lectores.** `listEventsForReceipt` (`lib/studio/warehouse-cn-queries.ts:252-265`) existe pero **nadie la
  llama**: Almacén China no tiene panel de historial. El único lector en producción es el resumen del CEO,
  que cuenta los eventos `incident` (`lib/news/ceo-brief.ts:131-136`). Los tipos nuevos de esta spec no
  cambian ese conteo, porque filtra por `incident`.

### 1.3 El embarque tiene otro historial, y ese lo ve el cliente

- `shipment_events` es el historial del embarque (`supabase/migrations/0002_shipments.sql:64-76`). Desde la
  SDD-0132 tiene una política para que **el cliente del portal lea los eventos de sus envíos**
  (`supabase/migrations/0196_shipment_events_portal_rls.sql`), y el portal los lee con su `note`
  (`lib/portal/shipment-events-queries.ts:55-56`, `:98-99`).
- Consecuencia: una etiqueta como «Devolución de impuestos» o la de marca sin autorización **no puede
  escribirse en `shipment_events`**: le llegaría al cliente. Su rastro va en el historial de la recepción.

### 1.4 Recepción, embarque y recepción en Venezuela

- La recepción (`warehouse_receipts_cn`) nace en China; al consolidarse recibe `shipment_id`
  (`supabase/migrations/0008_warehouses_cn.sql:73-74`).
- Partir un embarque (`split_shipment`, SDD-0673, `supabase/migrations/0563_partir_embarque_y_medidas.sql`)
  crea un embarque nuevo. El vínculo con el de origen queda solo en el evento (`from_shipment_id`,
  `0563:901`), no en una columna, y la recepción CN sigue apuntando al embarque de origen.
- En Venezuela, la caja recibida guarda su recepción CN de origen en
  `warehouse_receipt_ve_boxes.source_receipt_cn_id` (`supabase/migrations/0067_warehouse_receipts_ve.sql:83`).
  Es opcional (`on delete set null`), y fuera de las lecturas y del borrado (`0476:528`) ningún flujo de
  `app/` ni de `lib/` la llena: hoy puede venir nula.

### 1.5 Idioma, privacidad y permisos

- La pantalla resuelve el idioma por perfil y región (`app/studio/(app)/cn/page.tsx:62-82`) y tiene
  diccionario es-VE y zh-CN (`lib/i18n/es-VE/warehouse.ts`, 406 líneas; `lib/i18n/zh-CN/warehouse.ts`, 386
  líneas). El zh-CN dice que lo debe revisar un hablante nativo antes de producción
  (`lib/i18n/zh-CN/warehouse.ts:4`).
- Privacidad: región `cn` sin rol `admin` no ve nombres de clientes, solo el MARKBOX; la regla vive en
  `lib/studio/privacidad-cn.ts` (SDD-0039 B.9, SDD-0531) y se aplica en el servidor
  (`app/studio/(app)/cn/page.tsx:83-86`).
- Ven Almacén China `operations`, `warehouse` y `support` (`lib/studio/rbac.ts:70`); Almacén VE, los mismos
  (`lib/studio/rbac.ts:73`). Embarques y Tracking los ve casi todo el equipo (`lib/studio/rbac.ts:64-65`).
  Las acciones con candado propio son capabilities (`lib/studio/rbac.ts:273`), y la base repite el candado
  en sus RPC (por ejemplo `0563:281-284`: `role in ('admin','operations')` y `disabled_at is null`).
- Colores: `BRAND.md:16` prohíbe inventar colores; se usan las variables del sistema (`--danger`,
  `--warning`, `--success`, `--info`, la tinta y el azul de acción del rebrand). El dorado como texto de
  insignia no se lee (`BRAND.md:137`): va como punto, con el texto en tinta.

## 2. La lógica propuesta

### 2.0 Indicadores de carga: la leyenda de la hoja, el color de fila y sus consecuencias (Sam, 2026-11-20)

Sam mostró la hoja de cálculo con la que trabaja hoy el almacén de China, una pestaña por contenedor. Cada
fila va pintada entera (verde, naranja, blanco), la columna de observaciones lleva códigos arancelarios y
notas en chino, y un bloque lleva al lado 封门 («puerta sellada»). Y planteó el problema: una misma carga
puede tener dos situaciones a la vez (marca sin registro confirmado **y** carga especial), y una fila no
puede tener dos colores.

**La leyenda de la hoja (Sam, 2026-11-20, respuesta a la pregunta 0).** La hoja tiene un cuadro «Indicadores
de carga». Los colores de fila **no son estados: son indicadores**.

| Color en la hoja | Indicador |
|---|---|
| Ámbar | Marca o piratería |
| Rojo | Carga especial |
| Verde | Tax refund, o elementos en la puerta del contenedor |
| Celeste | Revisión o remedida |
| Rosa | Uso de elevador o montacargas |

**Medido en una hoja real (2026-11-20).** Solo conteos, sin datos de clientes. De los archivos locales, el
único en el formato de China es el packing list del contenedor 63 (columnas MARKS, BRAND, DESCRIPTION,
CHINESE DESCRIPTION, CTNS, PCS, G.W, CBM, DELIVERY DATE y REMARKS). Los del 59, 60 y 64 son el formato de
precios de Venezuela, y no se encontraron archivos del 65 ni del 67.

| Color de fila en el 63 | Filas de producto | Con BRAND |
|---|---|---|
| Verde | 11 | 4 |
| Ámbar (dorado del tema) | 9 | 4 |
| Naranja | 4 | 4 |
| Sin color | 132 | 14 |

- 24 de 156 filas (15 %) llevan color. Ninguna va en rojo, celeste ni rosa: en ese contenedor no hubo carga
  especial, remedida ni montacargas marcados.
- Hay **dos tonos parecidos** (ámbar del tema y naranja). Los 4 naranjas tienen BRAND. **Sam (2026-11-20): los dos son «marca».**
  Por eso, a mano, el mismo indicador se pinta de dos formas: con el catálogo, el color lo pone el sistema.
- La hoja ya trae una columna **BRAND**. Idea para una fase posterior: si la recepción trae marca, la pantalla
  sugiere «Marca sin autorización», sin ponerlo sola. No entra en esta spec.

Así lo resuelven los sistemas de almacén y de carga (WMS/TMS): la fila puede llevar varias marcas a la vez,
y ninguna se combina con otra.

| Qué | Cuántos por fila | Cómo se ve |
|---|---|---|
| **Indicadores** | varios | una insignia por indicador, con su color y su texto, en la columna «Indicadores» |
| **Color de la fila** | uno | el color del indicador de **mayor prioridad** (el campo `orden` del catálogo), como en la hoja |
| **Estado** | uno | la insignia de estado que ya existe (pendiente, consolidado, incidencia); no pinta la fila |

- Una carga con marca sin autorización **y** montacargas: la fila se pinta ámbar (si la marca tiene más
  prioridad) y la columna muestra las dos insignias. El color de la fila sirve para leer rápido, como hoy;
  las insignias evitan perder la segunda situación.
- Nunca se crea un indicador combinado («marca con montacargas»). Dos situaciones = dos indicadores.
- «Tax refund, o elementos en la puerta del contenedor» son dos situaciones con un solo color. **Decisión
  de Sam (2026-11-20): se parten en dos indicadores**, «Devolución de impuestos» (verde) y
  «Va en la puerta del contenedor» (pregunta 10, §7), que **deja el verde y pasa a navy** con su ícono de puerta
  (Sam, 2026-11-20). 封门 («puerta sellada») en la hoja marca ese bloque.
- Celeste y rosa no existen en la paleta de `BRAND.md` (§2.2): agregarlos necesita OK de diseño.

**Los indicadores tienen consecuencias (Sam, 2026-11-20).** No son solo información: pueden generar un cobro,
un costo o una segunda tarea.

- **Tax refund:** la oficina cobra, el proveedor en China cobra algo y a veces se le cobra algo al cliente.
- **Montacargas:** puede generar extras, en China y en Venezuela.
- **Batería de litio** (carga especial): factura más cara.

Por eso cada indicador del catálogo declara su **efecto** (§2.1). En esta spec el efecto solo se registra y
se muestra: en Venezuela, la lista de recepciones o embarques con un indicador que «genera cobro» sirve para
no olvidar el cargo al facturar. **El monto y el cargo en la factura o la pre-orden van en otra SDD**,
porque son dinero (montos que China no ve, SDD-0039 B.9) y tocan Facturación.

**Nombre (Sam, 2026-11-20, respuesta a la pregunta 1):** «Indicadores de carga», como lo llama el equipo
técnico. No choca con «Etiquetas CN». En el resto de esta spec, «aviso» y «etiqueta» se leen como
**indicador**; los nombres de pantalla, ruta, componentes y capabilities ya usan «indicador».
- Para que no se multipliquen, el catálogo se ordena en tres grupos: **Carga especial** (rasgo de la
  mercancía: montacargas, batería de litio, frágil), **Documentos y aduana** (marca sin autorización, falta
  factura) y **Trámite con el proveedor** (devolución de impuestos). Los dos últimos se resuelven y se
  quitan; el primero acompaña la carga hasta Venezuela.
- La pantalla «En almacén» se ve como la hoja: columnas en el mismo orden (marca, descripción, cajas,
  piezas, peso, CBM, recibido, observaciones), filas pintadas por el indicador de mayor prioridad, totales
  abajo y la columna «Indicadores». Al consolidar, la fila sale del almacén y pasa a «En camino», que hace
  el papel del documento «consolidado» (SDD-0682).

### 2.1 Qué responde cada aviso

Una etiqueta es **un aviso operativo sobre una recepción**: dice algo que el que la toca después tiene que
saber o hacer. No es un estado (el estado sigue siendo pendiente, consolidado o incidencia) y no bloquea
nada en esta spec.

| Campo | Para qué | Ejemplo «Montacargas» |
|---|---|---|
| Nombre (es-VE y zh-CN) | Lo que se lee en la insignia | «Montacargas» / 叉车 |
| Grupo | Carga especial, documentos y aduana, o trámite con el proveedor | carga especial |
| Color | Distinguir de un vistazo y pintar la fila, de una paleta fija | rosa (como en la hoja) |
| Prioridad (`orden`) | Qué color gana cuando la fila tiene varios | 5 |
| Descripción (es-VE y zh-CN) | Qué significa y qué hay que hacer | «Carga pesada o paletizada: hace falta montacargas para bajarla. En China lo paga el proveedor; en Venezuela hay que tenerlo listo.» |
| Efecto | Si genera cobro al cliente, costo del proveedor, los dos, una tarea o nada | cobro y costo |

**Catálogo inicial (sembrado en la migración B, a confirmar con las preguntas 4, 7, 8 y 10):**

| Prioridad | Indicador (es-VE / zh-CN) | Color | Ícono | Grupo | Efecto |
|---|---|---|---|---|---|
| 1 | Marca sin autorización / 品牌无授权 | ámbar | escudo (`shield`) | documentos y aduana | tarea |
| 2 | Carga especial / 特殊货物 | rojo | llama (`flame`) | carga especial | cobro al cliente |
| 3 | Devolución de impuestos / 退税 | verde | factura (`invoice`) | trámite con el proveedor | cobro y costo |
| 4 | Va en la puerta del contenedor / 装在柜门口 | navy | puerta (`door`, nuevo) | carga especial | ninguno |
| 5 | Uso de montacargas / 需要叉车 | rosa | montacargas (`forklift`, nuevo) | carga especial | cobro y costo |
| 6 | Revisión o remedida / 复查或复量 | celeste | regla (`ruler`, nuevo) | trámite con el proveedor | tarea |
| 7 | Batería de litio / 锂电池 | rojo | batería (`battery`, nuevo) | carga especial | cobro al cliente |

Los textos zh-CN los revisa un hablante nativo antes de producción.

### 2.2 Catálogo por tenant

- Tabla nueva `warehouse_tags` (nombre provisional; DDL en el §2.7).
- Nombre único por tenant entre las vivas, sin distinguir mayúsculas, en cada idioma.
- Hace falta al menos uno de los dos nombres. Si falta el otro idioma, la pantalla muestra el que hay con la
  marca «sin traducir» (§5).
- **No se borra: se archiva.** Una etiqueta archivada no se puede asignar, pero sigue leyéndose en el
  historial y en las recepciones que ya la tienen.
- Paleta fija de ocho claves. Seis salen de variables existentes: `ambar` (`--warning`), `rojo` (`--danger`),
  `verde` (`--success`), `azul` (acción), `navy` (`--ink`) y `gris` (`--ink-soft`). Dos son los de la leyenda
  de la hoja que no existen en `BRAND.md`: `celeste` y `rosa`. Esas dos necesitan **OK de diseño** (`/ui-check`
  y el dueño de la marca) para agregar sus variables, en claro y oscuro, con contraste medido. Mientras no
  haya OK, se pintan con `azul` y `rojo` en tono suave, y la leyenda lo dice. La insignia siempre lleva
  texto: el color ayuda, no informa solo. Un color nuevo necesita una migración, no se agrega desde la
  pantalla.
- **Color de fila:** el del indicador vivo con menor `orden` (mayor prioridad), en tono suave para que el
  texto se lea. Sin indicadores, la fila va sin color.
- **Ícono (Sam, 2026-11-20):** cada indicador lleva un ícono además del color, de una lista fija (§2.7). El
  ícono distingue dos indicadores del mismo color y sirve a quien no distingue colores. Sale del catálogo
  central `app/studio/_components/icons.tsx` (ICO-01): `shield`, `flame`, `invoice`, `flag`, `warn`, `box`,
  `camera`, `clock`, `lock` y `star` ya existen; `door`, `forklift`, `ruler`, `battery`, `fragile` y `scale` se agregan ahí, con su revisión de ICO-01 (significado único,
  nombre accesible, claro y oscuro). La insignia lleva ícono **y** texto; en la fila pintada, el ícono va al
  lado de la marca.
- **Efecto:** `ninguno`, `cobro_cliente`, `costo_proveedor`, `cobro_y_costo` o `tarea`. En esta spec solo se
  muestra (ícono de moneda o de tarea en la insignia) y permite filtrar «genera cobro» en Venezuela. No
  calcula montos ni toca facturas (§2.0).
- **Quién crea y edita** (Sam, 2026-11-20, preguntas 2 y 13: «cualquiera de China», y Venezuela crea los de
  aduana y logística): `admin`, o cualquier miembro activo con rol `warehouse` u `operations`, de China o de
  Venezuela (`support` solo lee). Antes decía que Venezuela no edita
  el catálogo de China.

### 2.2.1 La sección «Indicadores de carga» (Sam, 2026-11-20)

Sam pidió un lugar para crear indicadores con un paquete de íconos, sin que se repitan, y simple. Buenas
prácticas de las herramientas que lo hacen bien (las etiquetas de Linear, Jira, GitHub o Notion):

- **Es una sección, no un módulo.** Un módulo es una entrada del menú lateral con sus propios permisos. Esto
  es la configuración de Almacén China: una página `/studio/cn/indicadores`, a la que se entra con un botón
  «Indicadores» en el encabezado de Almacén China. No suma nada al menú.
- **Una sola pantalla, una lista.** Cada fila muestra la insignia tal como se verá (ícono, color y nombre),
  la descripción, el efecto y cuántas recepciones vivas la usan. Arriba, «Nuevo indicador».
- **Crear y editar en un panel lateral corto**, con vista previa en vivo de la insignia. Campos en este orden:
  nombre (es y zh), ícono, color, descripción y efecto. El grupo y la prioridad tienen un
  valor por defecto; la prioridad se cambia arrastrando la fila (con botones subir y bajar para teclado).
- **Paquete fijo de íconos**, en una cuadrícula: los 16 de la §2.7. Los que ya usa otro indicador vivo se ven
  apagados, con el nombre de quién lo usa al pasar el cursor, y no se pueden elegir. La base lo repite con un
  índice único. Si se acaban, se archiva uno o se pide un ícono nuevo (cambio de código con revisión ICO-01).
- **Colores:** la paleta de ocho. Pueden repetirse, porque el ícono ya distingue; si el color elegido ya lo
  usa otro, la pantalla lo avisa sin bloquear.
- **No se crea desde la fila.** Al poner un indicador a una recepción solo se elige de la lista; crear va
  siempre en la sección. Así el catálogo no se llena de duplicados escritos con prisa.
- **Archivar, no borrar** (§2.2), con «Mostrar archivados» al pie de la lista.
- **Tope sugerido:** hasta 12 indicadores vivos. Más que eso ya no se lee de un vistazo, como pasa con la
  leyenda de la hoja.

### 2.3 Asignación a la recepción

- Tabla nueva `warehouse_receipt_tags` (DDL en el §2.7). Una asignación viva por recepción y etiqueta.
- Se asigna a la **recepción** (pregunta 3): es lo que China tiene en la mano, existe antes del embarque y
  aguanta que el embarque se parta. El embarque **hereda** las etiquetas de sus recepciones: al mirarlo se
  juntan las etiquetas vivas de las recepciones con su `shipment_id`, sin copiarlas.
- **Quién asigna y quita** (propuesta, pregunta 2): `admin`, `warehouse` y `operations`.
- Se puede asignar en cualquier estado de la recepción, también después de consolidar (en «En camino»). No
  en una recepción borrada.
- Quitar una etiqueta no la borra: marca `removed_at` y queda en el historial (pregunta 5).
- Varias etiquetas por recepción; en la tabla se ven como insignias en la columna «Indicadores», hasta tres y
  «+N».
- Filtro por etiqueta en «En almacén» y «En camino».

### 2.3.1 Dos etapas: China en la recepción, Venezuela en el embarque (Sam, 2026-11-20, pregunta 3)

Cómo se trabaja hoy, según Sam:

- **Quien recibe en el almacén de China casi nunca pone indicadores.** A veces sabe que hace falta
  montacargas; nada más. La carga especial se avisa antes, en el grupo de WeChat, porque el almacén le cobra
  al proveedor por entrar (montacargas, carga especial o falta de descargadores).
- **Una segunda persona, en la oficina de China**, revisa la lista y pone los indicadores («este proveedor
  necesita montacargas, este no»). Lo hace en Almacén China **antes de consolidar**, porque la declaración de
  aduana necesita esa información.
- **Venezuela pone los suyos después**, cuando la carga ya está consolidada: en Embarques, sobre lo que va
  dentro de contenedores despachados. Agrega los suyos; lo que puso China no lo toca (regla de abajo).

| Etapa | Pantalla | Sobre qué | Quién |
|---|---|---|---|
| 1 · Lo que llega | Almacén China («En almacén») | la recepción | la oficina de China (y el que recibe, a veces montacargas); **Venezuela también puede poner algunos aquí** |
| 2 · Lo consolidado | Embarques | el embarque | **solo Venezuela** |

Sam, 2026-11-20: «China lo va a hacer en su Almacén China. Venezuela va a poder hacer algunos en Almacén
China y otros en Embarques. Embarques solamente lo va a tocar Venezuela.» Por eso el candado de asignar en
la recepción no mira la región (admin, `warehouse` u `operations` de China o de Venezuela), y el del embarque
exige región `ve` (o admin). Queda abierto el etiquetado en Almacén VE (pregunta 13).

**Lo que hace Venezuela en Embarques** (Sam, 2026-11-20): nota cosas, averigua en los grupos y entonces:

- **Pone y quita los suyos** en el embarque. Los de China los ve, pero no los cambia (regla de abajo).
- **Comenta** los indicadores de China, sin cambiarlos. Por ejemplo, en «Marca sin autorización» de una
  recepción: «el proveedor mandó la carta por WeChat, queda resuelto». Se reutiliza el hilo de comentarios
  que ya existe (`public.comments`, `supabase/migrations/0090_comments.sql:24-45`), sumando dos tipos de
  entidad: `warehouse_receipt_tag` y `shipment_tag`. Así hereda lo que ya resuelve ese hilo: autor, edición,
  borrado lógico y moderación (MP-01, SDD-0168). China lee esos comentarios en su historial; la nota de
  privacidad del §3 vale igual para ellos.
- **Crea indicadores nuevos** de aduana y logística (por ejemplo «Retenido en aduana»), en el mismo catálogo.
  Por eso crear y editar el catálogo queda abierto a `warehouse` y `operations` de las dos regiones (§2.2).

**Regla de cambios (Sam, 2026-11-20):** «Venezuela no puede eliminar los de China ni modificarlos sino con
autorización. Hay indicadores que tienen cobro; por eso no deberían cambiarse, porque puede estar atado a algo
de contabilidad.»

| Quién | Indicadores de China (en la recepción) | Con efecto de dinero o impuesto | Los suyos |
|---|---|---|---|
| **China** | pone y quita; corrige un error desde su historial | **pide el cambio; lo aprueba Contabilidad** | — |
| **Venezuela** | ve y comenta; **no** quita ni cambia | **pide el cambio; lo aprueba Contabilidad** | pone y quita en el embarque; crea indicadores nuevos |
| **Contabilidad** | ve | **aprueba o rechaza** las solicitudes | — |

- **Con efecto de dinero o impuesto** = `efecto` en `cobro_cliente`, `costo_proveedor` o `cobro_y_costo`
  (por ejemplo Devolución de impuestos, Carga especial, Uso de montacargas).
- **«Con autorización» = lo aprueba Contabilidad** (Sam, 2026-11-20, pregunta 14). El flujo:
  1. Quien quiere quitar o cambiar el indicador (China, Venezuela u Operaciones) pide el cambio con **motivo
     escrito**. Nada cambia todavía; el indicador muestra «cambio pendiente».
  2. Un usuario de `accounting` (o un `admin`) lo **aprueba o rechaza**, con comentario. Nadie aprueba su
     propia solicitud.
  3. Al aprobar, la base aplica el cambio en la misma transacción y deja en el historial quién pidió, quién
     aprobó y el motivo; también en `entity_audit_log` (MP-01 R3).
  - Contabilidad ve las solicitudes en una lista «Cambios de indicadores por aprobar», dentro de Embarques
    (ya tiene acceso, `lib/studio/rbac.ts:64`), con aviso en la campana. No entra a Almacén China.
  - Tabla `warehouse_tag_change_requests` y RPC `pedir_cambio_indicador`, `aprobar_cambio_indicador`,
    `rechazar_cambio_indicador` (§2.7). Capability nueva `approve_tag_changes: ["accounting"]` (admin
    implícito), repetida en la base.
- Lo mismo vale para el catálogo: cambiar el `efecto` de un indicador o archivar uno con efecto de dinero
  pasa por la misma solicitud.
- Poner un indicador nunca necesita autorización: sumar información no cambia una cuenta.

**Nombre:** «indicadores de carga» (decidido, pregunta 1). En la conversación se dice «etiquetas» a veces;
en la pantalla, la base y el código es «indicador».

Diseño:

- **Etapa 1** es la asignación a la recepción de arriba.
- **Etapa 2** es una asignación nueva, al **embarque**: tabla `shipment_tags` (DDL en el §2.7), con las mismas
  reglas (una viva por embarque e indicador; quitar marca `removed_at`; solo por RPC).
- **El embarque muestra los dos, cada uno con su origen:** los heredados de sus recepciones llevan «CN» (y
  «de WR-…» al pasar el cursor); los que puso Venezuela llevan «VE». Si el mismo indicador viene de China y
  Venezuela también lo puso, se muestra una vez con «CN · VE».
- **Ejemplo (Sam, 2026-11-20):** China no marcó «Carga especial», pero en Venezuela se ve que sí lo es y se le
  puede cobrar al cliente. Venezuela pone «Carga especial» en el embarque, del mismo catálogo, y la insignia
  dice «VE». Poner no necesita autorización, aunque el indicador tenga cobro; quitarlo después sí (regla de
  cambios). La recepción de China queda como estaba: se ve qué dijo cada uno.
- **Venezuela no oculta ni borra lo que puso China.** Si cree que uno ya no aplica, lo comenta; lo quita China
  o, si tiene efecto de dinero, un admin con motivo.
- **Mismo catálogo.** Venezuela usa los indicadores del mismo catálogo del tenant; si necesita uno nuevo, lo
  crea (respuesta de Sam a la pregunta 13).
- **Rastro de la etapa 2:** las filas de `shipment_tags` (puesto y quitado, con actor y fecha) más
  `entity_audit_log`. No va a `shipment_events`, que lo lee el portal (§1.3).
- **China no entra a Embarques** (Sam, 2026-11-20). Almacén China es lo que está en el almacén; lo
  consolidado pasa a Embarques, que es de Venezuela. China solo ve su historial de consolidados («En camino»,
  SDD-0682), y ahí, de solo lectura, los indicadores de sus recepciones y los que Venezuela agregó a esos
  embarques. Cerrarle a China el acceso a Embarques y Tracking (hoy abierto al rol `warehouse`,
  `lib/studio/rbac.ts:64-65`) y el telex release con su prueba son de la SDD-0682 fase 2, no de esta.

### 2.4 Rastro en el historial

- Cada asignación y cada retiro escribe una fila en `warehouse_receipt_events`, con dos tipos nuevos del
  enum: `tag_added` y `tag_removed`. La `description` guarda una foto del nombre en los dos idiomas y la nota
  (formato en el §2.7), para que el historial se siga leyendo igual aunque después renombren o archiven la
  etiqueta.
- Lo escribe la misma RPC que asigna, en la misma transacción: por esa vía no hay etiqueta sin rastro.
- **Quién más escribe esos dos tipos.** La política de `warehouse_receipt_events` es «for all» por tenant
  (`supabase/migrations/0012_rls_perf_and_rpc_guards.sql:273-274`), así que la tabla, por diseño, acepta
  filas de cualquier miembro del tenant con su sesión. Para que `tag_added`/`tag_removed` salgan solo de las
  RPC, la migración B agrega un trigger `before insert or update or delete` en `warehouse_receipt_events`
  que rechaza esos dos tipos (en la fila nueva o en la vieja) cuando `current_user` es `authenticated` o
  `anon`. Dentro de una RPC `security definer`, `current_user` es su dueño y el trigger deja pasar. Los demás
  tipos no cambian. Con ese trigger, el historial de etiquetas es tan confiable como las tablas de
  asignación; sin él, sería un registro de lo que dijo la RPC más lo que cualquier miembro quiso agregar.
- Los cambios al catálogo (crear, renombrar, cambiar color, grupo o visibilidad, archivar) quedan en
  `entity_audit_log` por `append_audit_event` (§2.7, AUD-01).
- **Panel de historial por recepción en Almacén China** (§1.2: hoy no existe), sobre `listEventsForReceipt`.
  Muestra los tipos `received`, `consolidated`, `incident`, `status_change`, `tag_added` y `tag_removed`. Las
  notas (`note`) quedan fuera de la fase 1: varias las escribe el sistema (§1.2) y su contenido no pasó la
  revisión de privacidad China. Sumarlas es otra decisión, con esa revisión hecha.
- Nada de esto se escribe en `shipment_events` (§1.3).

### 2.5 Qué ve Venezuela

**Venezuela ve todos** (Sam, 2026-11-20, pregunta 4). No hay indicadores ocultos para Venezuela: se quita el
campo `visible_ve` de propuestas anteriores. Con eso desaparece también el límite de «filtro de servidor
contra frontera de base» que traía ese campo: no hay nada que esconder entre oficinas.

- **Embarques y Tracking:** los indicadores vivos de las recepciones con `warehouse_receipts_cn.shipment_id`
  = el embarque (con «CN»), más los que Venezuela puso en el embarque (con «VE», §2.3.1).
- **Almacén VE:** los de las recepciones CN que nombran sus cajas por
  `warehouse_receipt_ve_boxes.source_receipt_cn_id` (§1.4), sin repetir.
- **Recepción VE sin origen CN** (todas sus cajas con `source_receipt_cn_id` nulo): no muestra indicadores de
  China. No se adivina por MARKBOX ni por contenedor, porque juntaría la carga de otros envíos. Es un límite
  conocido mientras ese dato no se llene; llenarlo es otra SDD.
- **Embarque partido:** la mitad de origen conserva los indicadores de sus recepciones. La mitad nueva no
  tiene recepción propia (§1.4) y no hereda ninguno en esta spec. Límite conocido: al partir, la pantalla
  muestra los indicadores del de origen, para que Venezuela los ponga en la mitad nueva si hace falta.
- Lo que sí queda fuera de Venezuela es **editar** lo de China (regla de cambios, §2.3.1), no verlo.

### 2.6 El cliente no ve ninguna

Los indicadores no llegan al portal ni al rastreo público (pregunta 6; Sam, 2026-11-20: «nunca ve ninguno»). Viven fuera de `shipment_events`, no
hay política para el portal en ninguna de las dos tablas y las lecturas del portal no las tocan. Una
etiqueta como la de marca sin autorización dicha al cliente es otra conversación, con su texto propio.

### 2.7 Propuesta de migración (sin número, sin aplicar)

Dos migraciones, porque un valor nuevo del enum no se puede usar en la misma transacción que lo agrega. Los
números los da el DG al programar la fase 1; se aplican en producción solo con OK nominal de Sam y el
runbook (`docs/runbooks/aplicar-migraciones-prod.md`). Orden: **migrate-first**. Sin la app nueva, nada
cambia: nadie llama a las RPC.

**Migración A — enum.**

```sql
alter type public.warehouse_receipt_event_type add value if not exists 'tag_added';
alter type public.warehouse_receipt_event_type add value if not exists 'tag_removed';
```

**Migración B — tablas, índices, RLS, grants y RPC.**

```sql
create table public.warehouse_tags (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  nombre_es      text check (nombre_es is null or length(btrim(nombre_es)) between 1 and 40),
  nombre_zh      text check (nombre_zh is null or length(btrim(nombre_zh)) between 1 and 20),
  descripcion_es text check (descripcion_es is null or length(descripcion_es) <= 280),
  descripcion_zh text check (descripcion_zh is null or length(descripcion_zh) <= 140),
  grupo          text not null check (grupo in ('carga_especial', 'documentos_aduana', 'tramite_proveedor')),
  color          text not null check (color in ('ambar', 'rojo', 'verde', 'celeste', 'rosa', 'azul', 'navy', 'gris')),
  efecto         text not null default 'ninguno'
                 check (efecto in ('ninguno', 'cobro_cliente', 'costo_proveedor', 'cobro_y_costo', 'tarea')),
  icono          text not null
                 check (icono in ('shield', 'flame', 'invoice', 'door', 'forklift', 'ruler', 'flag', 'warn',
                                  'box', 'battery', 'fragile', 'scale', 'camera', 'clock', 'lock', 'star')),
  orden          smallint not null default 0,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz,
  archived_by    uuid references auth.users(id),
  check (nombre_es is not null or nombre_zh is not null),
  check ((archived_at is null) = (archived_by is null))
);

create unique index warehouse_tags_nombre_es_vivo_uq
  on public.warehouse_tags (tenant_id, lower(btrim(nombre_es)))
  where archived_at is null and nombre_es is not null;
create unique index warehouse_tags_nombre_zh_vivo_uq
  on public.warehouse_tags (tenant_id, btrim(nombre_zh))
  where archived_at is null and nombre_zh is not null;

-- Un ícono no se repite entre los indicadores vivos del tenant (Sam, 2026-11-20).
create unique index warehouse_tags_icono_vivo_uq
  on public.warehouse_tags (tenant_id, icono) where archived_at is null;

create table public.warehouse_receipt_tags (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  receipt_id   uuid not null references public.warehouse_receipts_cn(id) on delete cascade,
  tag_id       uuid not null references public.warehouse_tags(id) on delete restrict,
  nota         text check (nota is null or length(nota) <= 140),
  assigned_by  uuid not null references auth.users(id),
  assigned_at  timestamptz not null default now(),
  removed_by   uuid references auth.users(id),
  removed_at   timestamptz,
  check ((removed_at is null) = (removed_by is null))
);

create unique index warehouse_receipt_tags_viva_uq
  on public.warehouse_receipt_tags (receipt_id, tag_id) where removed_at is null;
create index warehouse_receipt_tags_tag_idx
  on public.warehouse_receipt_tags (tenant_id, tag_id) where removed_at is null;

-- Etapa 2 (§2.3.1), en la migración C: indicadores que pone Venezuela en el embarque,
-- y los heredados que Venezuela da por resueltos en ese embarque.
create table public.shipment_tags (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  shipment_id   uuid not null references public.shipments(id) on delete cascade,
  tag_id        uuid not null references public.warehouse_tags(id) on delete restrict,
  nota          text check (nota is null or length(nota) <= 140),
  assigned_by   uuid not null references auth.users(id),
  assigned_at   timestamptz not null default now(),
  removed_by    uuid references auth.users(id),
  removed_at    timestamptz,
  check ((removed_at is null) = (removed_by is null))
);
create unique index shipment_tags_viva_uq
  on public.shipment_tags (shipment_id, tag_id) where removed_at is null;
-- Misma RLS de solo lectura para miembro activo, sin política de portal, y escritura solo por las RPC
-- poner_indicador_embarque / quitar_indicador_embarque

-- Solicitudes de cambio de indicadores con dinero o impuesto (§2.3.1, pregunta 14).
create table public.warehouse_tag_change_requests (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  accion          text not null check (accion in ('quitar_recepcion', 'quitar_embarque', 'editar_catalogo', 'archivar_catalogo')),
  objetivo_id     uuid not null,          -- asignación o indicador, según accion
  cambios         jsonb,                  -- para editar_catalogo: campos nuevos
  motivo          text not null check (length(btrim(motivo)) between 10 and 500),
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  pedido_por      uuid not null references auth.users(id),
  pedido_at       timestamptz not null default now(),
  resuelto_por    uuid references auth.users(id),
  resuelto_at     timestamptz,
  comentario      text check (comentario is null or length(comentario) <= 500),
  check ((estado = 'pendiente') = (resuelto_por is null)),
  check (resuelto_por is null or resuelto_por <> pedido_por)
);
create unique index warehouse_tag_change_requests_una_pendiente_uq
  on public.warehouse_tag_change_requests (objetivo_id, accion) where estado = 'pendiente';
-- Misma RLS de solo lectura y escritura solo por RPC. aprobar_* exige accounting o admin activo.
-- (candado: admin, u operations / warehouse de región ve; commercial según la pregunta 13).

alter table public.warehouse_tags enable row level security;
alter table public.warehouse_receipt_tags enable row level security;

-- Solo lectura para el Studio. Sin insert/update/delete: se escribe por RPC.
revoke all on public.warehouse_tags, public.warehouse_receipt_tags from anon, authenticated;
grant select on public.warehouse_tags, public.warehouse_receipt_tags to authenticated;

-- Miembro ACTIVO del tenant. No basta tenant_id = get_user_tenant_id(): se exige
-- la fila viva en user_tenants. Sin política para el portal ni para anon.
create policy "warehouse_tags lectura miembro activo"
  on public.warehouse_tags for select to authenticated
  using (exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = warehouse_tags.tenant_id
      and ut.disabled_at is null));
create policy "warehouse_receipt_tags lectura miembro activo"
  on public.warehouse_receipt_tags for select to authenticated
  using (exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = warehouse_receipt_tags.tenant_id
      and ut.disabled_at is null));
```

```sql
-- Solo las RPC escriben los dos tipos de etiqueta en el historial (§2.4).
create function public.warehouse_receipt_events_tags_solo_rpc()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (tg_op <> 'INSERT' and old.event_type in ('tag_added', 'tag_removed'))
     or (tg_op <> 'DELETE' and new.event_type in ('tag_added', 'tag_removed')) then
    if current_user in ('authenticated', 'anon') then
      raise exception 'las etiquetas del historial se escriben solo por su RPC' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger warehouse_receipt_events_tags_solo_rpc
  before insert or update or delete on public.warehouse_receipt_events
  for each row execute function public.warehouse_receipt_events_tags_solo_rpc();
-- Función de trigger: nadie la llama directo (patrón de la 0327).
revoke all on function public.warehouse_receipt_events_tags_solo_rpc()
  from public, anon, authenticated;
```

- **Es una lista de denegación:** bloquea solo a `authenticated` y `anon`, los roles con los que entra una
  sesión por PostgREST. Cualquier otro rol (el dueño de las RPC, `service_role`, `postgres`) pasa. Si mañana
  aparece otro rol de sesión, hay que sumarlo a la lista; una lista de permitidos (solo el dueño de las RPC)
  sería más cerrada, pero también bloquearía las correcciones de datos por runbook.

**Reglas de las cinco RPC** (todas, sin excepción):

- `security definer`, `set search_path = ''` y **todo calificado**: tablas y funciones con `public.`,
  funciones del sistema con `pg_catalog.` (`pg_catalog.now()`, `pg_catalog.btrim`, `pg_catalog.lower`).
- **El actor es `auth.uid()`.** Ninguna recibe un `p_actor`, `p_user_id` ni `p_role`. Si `auth.uid()` es nulo,
  `42501`.
- **El rol y la región se leen siempre en la base**, en `user_tenants` (`user_id = auth.uid()`, tenant de
  `public.get_user_tenant_id()`, `disabled_at is null`), con el patrón de `0563:281-284`. Nunca del JWT ni de
  un parámetro.
- `revoke all … from public, anon, authenticated, service_role` y después `grant execute … to authenticated`,
  como la 0563 (`0563:523`, `:918`). El cliente de servicio no las llama.
- **Auditoría del catálogo por `public.append_audit_event`** (0267/0294), con el mismo precheck que
  `0563:173-182`: la migración aborta si la función no existe, no es `security definer` con `search_path`
  vacío o el rol que aplica no puede ejecutarla. Tipo de entidad `warehouse_tag`, fuente `studio`,
  `before`/`after` con los campos cambiados.
- La migración B empieza con un precheck de roles (`authenticated`, `anon`, `service_role`) y de las
  columnas que lee, como `0563:53-54`.

Candados por RPC:

| RPC | Candado | Qué hace |
|---|---|---|
| `crear_etiqueta_almacen(...)` | `admin`, `warehouse` u `operations` (cualquier región) | Inserta en el catálogo y escribe `entity_audit_log` |
| `editar_etiqueta_almacen(p_id, ..., p_motivo)` | ídem; cambiar `efecto`, o cualquier campo de un indicador con efecto de dinero: rechaza y pide usar `pedir_cambio_indicador` | Cambia nombre, descripción, grupo, color, visibilidad u orden; audita antes y después |
| `archivar_etiqueta_almacen(p_id, p_archivar boolean, p_motivo)` | ídem; con efecto de dinero: solo por solicitud aprobada | Archiva o desarchiva; audita |
| `asignar_etiqueta_recepcion(p_receipt_id, p_tag_id, p_nota)` | `admin`, `warehouse` u `operations` | Valida recepción viva del tenant y etiqueta no archivada; inserta la asignación y el evento `tag_added` |
| `quitar_etiqueta_recepcion(p_asignacion_id, p_motivo)` | `admin`, o `warehouse`/`operations` de región `cn`; si el indicador tiene efecto de dinero, solo por solicitud aprobada | Exige que la asignación sea del tenant del actor y siga viva; marca `removed_*` y escribe `tag_removed` con el motivo. Venezuela no puede |

- La `description` del evento: `«<nombre_es> · <nombre_zh>»` y, si hay nota, `« — <nota>»`. Con un solo
  idioma, ese solo. Es la foto del §2.4.
- Errores con `errcode = '42501'` para permiso y `P0001` con texto en español para lo demás (archivada,
  repetida, recepción borrada). La pantalla los traduce con el diccionario.
- Capabilities nuevas en `lib/studio/rbac.ts`, que repiten el candado de la base:
  `manage_warehouse_tags: ["warehouse", "operations"]` (sin filtro de región) y
  `assign_warehouse_tags: ["warehouse", "operations"]`.

## 3. Privacidad (SDD-0039 B.9 y SDD-0531)

- El catálogo no tiene datos personales: son nombres de situaciones, no de personas.
- La recepción etiquetada se sigue mostrando a China con el MARKBOX. Las lecturas nuevas (filtro, insignias,
  historial) pasan por la misma regla `canSeeClientNames`, en el servidor. Ninguna consulta nueva trae
  `client_name` para un usuario `cn` sin admin.
- El panel de historial no muestra las notas (`note`) en la fase 1 (§2.4).
- **La nota libre es el riesgo.** Alguien puede escribir ahí el nombre del importador o el WeChat del
  proveedor, y ese texto lo vería Venezuela, o China si lo escribe Venezuela. Propuesta: nota opcional, de
  hasta 140 caracteres, con la ayuda «No escribas nombres, teléfonos ni contactos». No se valida el
  contenido (pregunta 9).
- Proveedores: el contacto de un proveedor chino es dato personal bajo la PIPL (art. 6, mínimo alcance). Las
  etiquetas no lo piden ni lo guardan.
- Esta spec pasa por `.claude/skills/revisar-datos-ve/SKILL.md` antes de implementarse, por la nota libre.

## 4. Texto para la marca sin documentos

«Posible piratería» no sirve en la insignia: acusa sin pruebas y lo lee todo el que toca la carga. Lo que se
ve en el almacén es un hecho: llegó una marca conocida sin papeles. Propuesta (pregunta 7):

| | es-VE | zh-CN |
|---|---|---|
| **Nombre (elegido por Sam, 2026-11-20)** | **Marca sin autorización** | 品牌无授权 |
| Alternativa A | Marca sin documentos | 品牌无文件 |
| Alternativa B | Marca por verificar | 品牌待核实 |
| Descripción | «Llega una marca conocida sin registro de marca ni carta de autorización del dueño de la marca. Pide los papeles al proveedor antes de embarcar: sin ellos la carga puede retenerse en la aduana.» | 「知名品牌货物到仓，但没有商标注册证或品牌授权书。装柜前请向供应商索取文件，否则货物可能在海关被扣。」 |

La recomendada nombra lo que falta (la autorización del dueño de la marca), que es lo que pide la aduana, y
no juzga al proveedor. El chino lo debe revisar un hablante nativo antes de producción.

## 5. i18n es-VE y zh-CN

- El texto de cada etiqueta es **dato**, no diccionario: vive en el catálogo con sus dos idiomas.
- El texto de la interfaz (catálogo, asignar, quitar, filtro, historial, «sin traducir», la ayuda de la
  nota, los errores de las RPC) va al diccionario `warehouse_cn.tags.*` en `lib/i18n/es-VE/warehouse.ts` y
  `lib/i18n/zh-CN/warehouse.ts`. El tipo `WarehouseDict` obliga a tener las dos.
- Se muestra en el idioma del usuario; si falta, el otro con la marca «sin traducir» / 未翻译.
- En Venezuela (Almacén VE, Embarques, Tracking) se muestra `nombre_es`; si solo hay chino, el chino con
  «sin traducir».
- Sin traducción automática en esta spec.

## 6. Alcance, fases y allowlist

**No entra:** etiquetas que bloqueen o cambien un estado; etiquetas creadas por Venezuela; la app del
teléfono (`/m/cn`); notificaciones por correo o Telegram al asignar; reportes y KPI por etiqueta; el portal del
cliente; mostrar las notas `note` en el panel; llenar `source_receipt_cn_id`; el vínculo persistente del
embarque partido.

### 6.1 Fases y orden

| Fase | Qué | Depende de |
|---|---|---|
| **F0** | Esta spec aprobada por Sam, con las preguntas del §7 contestadas | — |
| **F1** | Migraciones A y B; catálogo; asignar y quitar en Almacén China («En almacén» y «En camino»); columna «Indicadores»; filtro; panel de historial; capabilities; i18n | F0 y la **0682 fase 2 fusionada** |
| **F2** | Venezuela: lectura en Almacén VE, Embarques y Tracking (todos los heredados), y la etapa 2: poner y quitar sus indicadores en el embarque y comentar los de China (migración C) | F1 en producción |
| **F3** | La pantalla con forma de hoja (columnas de la hoja y fila pintada por el indicador de mayor prioridad, §2.0), con la leyenda visible | F1; los colores celeste y rosa con OK de diseño |

La 0682 fase 2 («Pendiente por liberar») toca la misma pantalla (`page.tsx`, `VistasAlmacen.tsx`,
`warehouse-cn-queries.ts`) y trae su propia migración. Por eso F1 arranca después de que se fusione, y el DG
serializa los números de migración. Si el DG prefiere el orden inverso, la 0682 fase 2 se rebasa sobre F1.

### 6.2 Allowlist provisional

Provisional: se cierra al programar cada fase, contra la base de ese momento.

**F1**
- `supabase/migrations/NNNN_etiquetas_almacen_enum.sql` (A) y `supabase/migrations/NNNN_etiquetas_almacen.sql` (B).
- `supabase/tests/etiquetas_almacen.test.sql`: las pruebas del §8.1.
- `lib/studio/rbac.ts`: las dos capabilities.
- `lib/studio/warehouse-tags-types.ts` y `lib/studio/warehouse-tags-queries.ts` (nuevos): catálogo, asignaciones vivas por recepción, filtro.
- `lib/studio/warehouse-cn-queries.ts`: el filtro por etiqueta y las etiquetas de cada fila.
- `lib/studio/warehouse-cn-types.ts`: los tipos de evento nuevos.
- `lib/studio/almacen-cn-contenedores-queries.ts`: las etiquetas en «En camino».
- `app/studio/(app)/cn/page.tsx`, `app/studio/(app)/cn/tag-actions.ts` (nuevo, server actions que llaman a las RPC).
- `app/studio/(app)/cn/_components/AlmacenCnClient.tsx`, `CaminoCn.tsx`, `FilaCamino.tsx`.
- `app/studio/(app)/cn/_components/IndicadoresRecepcion.tsx`, `HistorialRecepcion.tsx` (nuevos).
- `app/studio/(app)/cn/indicadores/page.tsx` y `app/studio/(app)/cn/indicadores/_components/CatalogoIndicadores.tsx` (nuevos: la sección del §2.2.1).
- `app/studio/(app)/cn/_components/EncabezadoCn.tsx`: el botón «Indicadores».
- `app/studio/_components/icons.tsx`: los íconos nuevos del paquete (`door`, `forklift`, `ruler`, `battery`, `fragile`, `scale` y los que falten).
- `lib/i18n/es-VE/warehouse.ts`, `lib/i18n/zh-CN/warehouse.ts`.
- Pruebas: `app/studio/(app)/cn/__tests__/tag-actions.test.ts`, `app/studio/(app)/cn/_components/__tests__/IndicadoresRecepcion.test.tsx`, `HistorialRecepcion.test.tsx`, `CatalogoIndicadores.test.tsx`, `lib/studio/__tests__/warehouse-tags-queries.test.ts`.
- `docs/specs/0697-etiquetas-color-almacen-china/spec.md`, `docs/specs/README.md`, `.agents/handoffs/`.

**F2**
- `lib/studio/warehouse-tags-queries.ts`: lectura por embarque y por recepción VE.
- `app/studio/(app)/ve/page.tsx`, `app/studio/(app)/ve/_components/AlmacenVeClient.tsx`.
- `app/studio/(app)/embarques/page.tsx`, `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`.
- `app/studio/(app)/tracking/[id]/page.tsx`, `app/studio/(app)/tracking/[id]/_components/ShipmentHeader.tsx`.
- `app/studio/_components/IndicadoresSoloLectura.tsx` (nuevo) y sus pruebas.
- Prueba de que el portal no recibe etiquetas: `lib/portal/__tests__/sin-etiquetas-almacen.test.ts` (nueva).
- Etapa 2: migración C (`shipment_tags` y sus RPC, y los tipos `warehouse_receipt_tag` y `shipment_tag` en el `check` de `public.comments`; número del DG), `app/studio/(app)/_actions/comments.ts` y `lib/studio/comments/comments-queries.ts` (el hilo existente: solo los dos tipos nuevos), `app/studio/(app)/embarques/indicadores-actions.ts` (nuevo), `app/studio/(app)/embarques/_components/IndicadoresEmbarque.tsx` (nuevo) y `supabase/tests/indicadores_embarque.test.sql`.

**F3**: se define con la respuesta a la pregunta 0; toca `AlmacenCnClient.tsx` y `ReceiptStatusBadge.tsx`.

Fuera de la allowlist: escrituras de datos en producción, cambios al portal y a `shipment_events`.

### 6.3 Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| MP-01 | cumplimiento | Asignar y quitar: R1, con **Deshacer** 10 s y sin diálogo; quitar es reversible y no pierde nada (`removed_at`, se puede volver a asignar). Archivar una etiqueta del catálogo: R2, `ConfirmDialog` con el nombre y la consecuencia («deja de poder asignarse; las recepciones que la tienen la conservan»); desarchivar la restaura. No hay borrado físico. Los eventos son P4 (fila «Operación logística», `docs/governance/policies/mp-01.md:67`) |
| AUD-01 | cumplimiento | Asignar y quitar dejan `tag_added`/`tag_removed` con actor (`auth.uid()`) y fecha, en la misma transacción, y el trigger del §2.7 hace que esos dos tipos solo salgan de las RPC. Los cambios al catálogo van a `entity_audit_log` por `append_audit_event`, con precheck. Sin el trigger, el historial de etiquetas no contaría como evento auditable |
| AUD-02 | cumplimiento parcial | Consulta: el panel de historial (§2.4). Conservación: las asignaciones y los eventos no se borran (P4). Exportación: no aplica en esta spec |
| FRM-01 | cumplimiento | Formulario del catálogo: al menos un nombre, nombre único, largos del §2.7, error en línea por campo, envío deshabilitado solo mientras guarda |
| TBL-01 | cumplimiento | Una columna nueva («Indicadores») con tope de tres insignias y «+N»; el filtro por etiqueta se suma a los existentes; no cambia la densidad |
| A11Y-01 | cumplimiento | Insignias con texto, nunca solo color; el ámbar como punto con texto en tinta (`BRAND.md:137`); menú de asignar operable con teclado (rol `menu`/`listbox`), foco visible y nombre accesible en «+N»; el color de fila nunca es la única señal: la columna «Indicadores» repite cada uno con texto |
| VIS-01 / VIS-02 | cumplimiento | Solo variables existentes (§2.2) |
| Privacidad China | cumplimiento | §3 |

**Módulo y permisos de la pantalla del catálogo:** vive dentro del módulo `cn` (no es un módulo nuevo), en
`/studio/cn/indicadores`, para no chocar con `/studio/etiquetas`. La ven quienes ven `cn`
(`lib/studio/rbac.ts:70`); editar exige `manage_warehouse_tags`. Asignar exige `assign_warehouse_tags`.
`support` solo lee.

## 7. Preguntas para Sam (una por una)

0. **Los colores de la hoja.** ¿Qué quiere decir hoy el verde, el naranja y el blanco en la hoja del
   contenedor, y qué es 封门? Ejemplo: «verde = ya recibido con papeles; naranja = recibido con algo
   pendiente».
   **Contestada (2026-11-20):** son indicadores, no estados (leyenda en el §2.0). Y tienen consecuencias de
   cobro, costo o tarea.
1. **Nombre.** **Contestada (2026-11-20):** «Indicadores de carga», como lo llama el equipo técnico.
2. **Quién crea.** ¿Quién puede crear y editar etiquetas, y quién ponerlas? Ejemplo: el jefe del almacén de
   China crea «Montacargas»; un operario solo la pone.
   **Contestada (2026-11-20): cualquiera de China** (`warehouse` u `operations` de región `cn`, más admin).
3. **Dónde va.** ¿A la recepción o al embarque? Ejemplo: la WR-2099-0001 llega con una marca sin papeles y
   se etiqueta ahí; el embarque la hereda.
   **Contestada (2026-11-20): a los dos, por etapas** (§2.3.1). China en la recepción antes de consolidar;
   Venezuela en el embarque después.
4. **Qué ve Venezuela.** ¿Te sirve la tabla del §2.5? Ejemplo: Caracas ve «Montacargas», no ve «Devolución de
   impuestos».
   **Contestada (2026-11-20): Venezuela ve todos.** Se quita `visible_ve`.
5. **Quitar.** ¿Se pueden quitar? Ejemplo: llega la carta de autorización y quitan «Marca sin autorización»;
   queda en el historial quién la quitó y cuándo.
   **Contestada (2026-11-20, regla de cambios del §2.3.1):** China quita los suyos; Venezuela no quita los de
   China; los de dinero o impuesto, solo con aprobación de Contabilidad. Todo queda en el historial.
6. **El cliente.** ¿El cliente nunca ve ninguna? Ejemplo: el importador no ve «Montacargas» en su portal.
   **Contestada (2026-11-20): nunca ve ninguno.** Si un indicador genera un cargo, el cliente lo ve en su factura, no como indicador.
7. **Texto de la marca.** ¿«Marca sin autorización», «Marca sin documentos» o «Marca por verificar»?
   **Contestada (2026-11-20): «Marca sin autorización» / 品牌无授权.**
8. **Las otras.** Además de las cinco de la leyenda, ¿hay otras? Ejemplo: «Batería de litio», ¿va dentro de
   «Carga especial» o aparte, por su cobro propio?
   **Contestada en parte (2026-11-20): «Batería de litio» va aparte** (fila 7 del catálogo inicial), con su
   cobro propio. Comparte el rojo con «Carga especial»; los distingue el ícono.
9. **Nota.** ¿La etiqueta lleva una nota corta? Ejemplo: «Montacargas · 2 paletas de 800 kg».
10. **El verde.** ¿Partimos «Tax refund o elementos en la puerta del contenedor» en dos indicadores verdes?
    Ejemplo: una carga en la puerta sin tax refund no debería salir como «cobro y costo».
    **Contestada (2026-11-20): sí, en dos.**
11. **Prioridad.** Cuando una fila tiene dos indicadores, ¿qué color gana? Ejemplo: marca y montacargas → la
    fila ámbar, con las dos insignias.
12. **Cobro.** ¿Quién en Venezuela debe ver «genera cobro» al facturar? Ejemplo: Contabilidad ve los
    embarques del 65 con «Uso de montacargas» antes de la pre-orden.
13. **Venezuela y el catálogo.** ¿Quién en Venezuela pone indicadores en el embarque, y puede crear
    indicadores nuevos o solo usar los de China? Ejemplo: Operaciones en Caracas pone «Montacargas» al
    embarque; si necesita «Retenido en aduana», ¿lo crea o lo pide a China?
    **Contestada en parte (2026-11-20):** Venezuela crea indicadores de aduana y logística y comenta los de
    China. Falta: el etiquetado en Almacén VE.
14. **La autorización.** Para quitar o cambiar un indicador con dinero o impuesto, ¿basta un admin con motivo, o
    lo aprueba alguien más? Ejemplo: Caracas pide quitar «Uso de montacargas» y Contabilidad lo aprueba.
    **Contestada (2026-11-20): lo aprueba Contabilidad.**

## 8. Criterios de aceptación y pruebas

### 8.1 Pruebas SQL (`supabase/tests/etiquetas_almacen.test.sql`, PGlite o Postgres local)

Con dos tenants (T1, T2) y usuarios sintéticos: admin T1, `warehouse` región `cn` T1, `warehouse` región `ve`
T1, `operations` T1, `support` T1, miembro deshabilitado T1, `warehouse` T2 y un cliente del portal de T1.

1. **Portal denegado:** con el JWT del cliente del portal (con `get_portal_client_markbox()` resuelto),
   `select` sobre las dos tablas devuelve 0 filas aunque su envío tenga recepciones etiquetadas; las cinco RPC
   fallan con `42501`. `anon` no tiene `select`.
2. **Escritura directa denegada:** `insert`, `update` y `delete` directos sobre las dos tablas fallan para
   `authenticated` (sin grant), también para admin.
3. **Escritura por rol:** `crear_etiqueta_almacen` pasa con admin y con `warehouse` u `operations` de las dos
   regiones; falla con `42501` para `support` y el miembro deshabilitado.
   `asignar_etiqueta_recepcion` pasa con admin, `warehouse` y `operations`; falla con `support` y el
   deshabilitado.
4. **Entre tenants:** `warehouse` de T2 no lee nada de T1 y no puede asignar una etiqueta de T1 ni a una
   recepción de T1.
5. **Unicidad del nombre:** dos vivas con «Montacargas» y « montacargas » en T1 → la segunda falla. Archivada
   la primera, la segunda pasa. El mismo nombre en T2 pasa.
   **Ícono único:** dos vivas con `forklift` en T1 → la segunda falla; archivada la primera, pasa; el mismo
   ícono en T2 pasa. Un ícono fuera del paquete falla por el `check`.
6. **Unicidad de la asignación viva:** asignar dos veces la misma etiqueta a la misma recepción → la segunda
   falla. Quitada, se puede volver a asignar, y quedan dos filas (una con `removed_at`).
7. **Archivada no se asigna:** `asignar_etiqueta_recepcion` con una archivada falla y no escribe evento.
8. **Snapshot del historial:** asignar «Montacargas»/叉车 con nota, renombrar a «Grúa» → el evento
   `tag_added` sigue diciendo «Montacargas · 叉车 — <nota>». Quitar escribe `tag_removed` con el nombre
   vigente.
9. **Atomicidad:** si el insert del evento falla (forzado), no queda asignación.
10. **Recepción borrada:** asignar a una recepción con `deleted_at` falla.
11. **Conteo del CEO intacto:** los eventos nuevos no suben el conteo de `incident`.
12. **Anon no ejecuta:** con el rol `anon`, las cinco RPC fallan por permiso (`has_function_privilege` falso y
    llamada rechazada). `service_role` tampoco tiene `execute`.
13. **Quitar ajena:** `operations` quita una asignación puesta por `warehouse` del mismo tenant → pasa, y el
    evento `tag_removed` lleva a `operations` como actor. `warehouse` de T2 intenta quitar una de T1 → falla
    y no escribe evento.
14. **Quitar dos veces:** quitar una asignación ya quitada falla (`P0001`), no cambia `removed_by` ni
    `removed_at` y no escribe un segundo `tag_removed`.
15. **Historial solo por RPC:** como `authenticated` (miembro activo de T1), insertar directo en
    `warehouse_receipt_events` un `tag_added` falla con `42501`; actualizar o borrar uno existente, también.
    Insertar directo un `note` sigue pasando (no se cambia lo que ya funciona). Casos de `old`/`new` nulos:
    un `insert` de `note` (sin `old`) y un `delete` de un `note` (sin `new`), ambos como `authenticated`,
    terminan sin error del trigger; el `delete` de un `tag_added` falla con `42501`.
16. **Actor desde la sesión:** ninguna RPC acepta un actor por parámetro; `assigned_by` y el `created_by` del
    evento son `auth.uid()` del que llama.
17. **Auditoría del catálogo:** crear, editar y archivar dejan una fila en `entity_audit_log` con tipo
    `warehouse_tag` y actor; si la llamada falla, no queda fila.
18. **Etapa 2, embarque:** `operations` de región `ve` pone «Montacargas» a un embarque → pasa; un usuario
    `cn` sin admin → falla con `42501`. Dos vivas iguales en el mismo embarque → la segunda falla.
19. **Venezuela no toca lo de China:** `operations` de región `ve` intenta quitar una asignación de recepción →
    falla con `42501`; comentarla pasa.
19b. **Dinero solo con autorización de Contabilidad:** `warehouse` de región `cn` intenta quitar «Devolución
    de impuestos» directo → falla; la pide con motivo → queda `pendiente` y el indicador sigue vivo; un
    `accounting` la aprueba → se quita en la misma transacción y quedan quién pidió, quién aprobó y el motivo.
    Quien pidió no puede aprobar la suya; `operations` no puede aprobar; una segunda solicitud pendiente
    igual falla; rechazar no cambia nada.
20. **Origen visible:** un indicador heredado y el mismo puesto en el embarque se leen una vez, con «CN · VE»;
    uno puesto solo por Venezuela se lee con «VE» y no aparece en la recepción de China.
21. **Comentario sobre un indicador de China:** Venezuela comenta una asignación de recepción → queda en
    `public.comments` con tipo `warehouse_receipt_tag`; la asignación no cambia; China lo lee.

### 8.2 Pruebas de aplicación

- **«Sin traducir»:** etiqueta solo con `nombre_zh` → en es-VE se ve el chino con «sin traducir»; solo con
  `nombre_es` → en zh-CN se ve el español con 未翻译. Con los dos, cada idioma ve el suyo.
- La fila muestra hasta tres insignias y «+N»; el filtro por etiqueta deja solo las recepciones con ella viva.
- El panel de historial muestra «etiqueta agregada» y «etiqueta quitada», con quién y cuándo, y no muestra
  notas `note`.
- Un usuario `cn` sin admin no recibe `client_name` en ninguna lectura nueva (prueba de servidor).
- F2: Venezuela ve en el embarque y en Almacén VE todos los indicadores de sus recepciones; una recepción VE
  sin origen CN no muestra ninguna; la mitad nueva de un embarque partido no muestra ninguna.
- F2: las lecturas del portal no traen etiquetas.
