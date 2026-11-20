---
sdd: "0682"
title: "Almacén China en una pantalla: en almacén, en camino y pendiente por liberar"
status: in-progress
author: "Claude (Worker) + Sam"
created: 2026-11-19
updated: 2026-11-20
supersedes: null
superseded_by: null
related: ["0016", "0029", "0039", "0047", "0531", "0543", "0643", "0659", "0674"]
confidencialidad: interno
---

# SDD-0682 — Almacén China en una pantalla: en almacén, en camino y pendiente por liberar

> Sam, 2026-11-19: lo que se metió en el contenedor 64 sigue saliendo en Almacén China. Lo consolidado no
> debería estar ahí: debería verse «en ruta», en una opción de «contenedores en camino». Y los embarques ya
> no deberían salir en la lista activa.

**Aprobada por Sam el 2026-11-19.** Texto literal, en el chat del DG: «Sí, apruebo 0682». Antes contestó todas las preguntas del §5 y la spec pasó la revisión independiente. La implementación va en su propia tarea, después de fusionar esta spec; la migración del §2.4 recibe número del DG al programarse y se aplica en producción solo con OK de Sam. Se midió solo en código y
migraciones (base `origin/main` `c04f18fca`); no se leyó ninguna fila de producción.

## 1. «Confirmen»: qué pasa hoy (medido)

### 1.1 La carga del 64 sí marcó lo consolidado

La carga de consolidados (`scripts/consolidados/lote-sql.ts`, SDD-0543) deja todo con el estado de «ya
salió», no de «en almacén»:

| Qué crea | Estado que queda | Dónde |
|---|---|---|
| Consolidación (DTD-CONSOL-0004) | `zarpado` | `scripts/consolidados/lote-sql.ts:441` |
| Embarque por remitente | se inserta `in_warehouse` y se pasa a `in_transit` | `scripts/consolidados/lote-sql.ts:583`, `:588` |
| Recepción `WR-C64-<remitente>` | `consolidado` (con `shipment_id`) | `scripts/consolidados/lote-sql.ts:600-605` |
| Embarque FCL del dueño | `in_transit` | `scripts/consolidados/lote-sql.ts:653` |

O sea: la hipótesis «la carga no cambia el estado» **no** se cumple. Las recepciones del 64 nacen
`consolidado` y sus embarques `in_transit`.

### 1.2 Almacén China muestra todo por defecto, consolidado incluido

- El filtro de estado arranca en «todos»: sin `?status=` en la URL, `status = "all"`
  (`lib/studio/warehouse-cn-queries.ts:339`), y con «all» no se filtra
  (`lib/studio/warehouse-cn-queries.ts:116`).
- El selector de la pantalla arranca vacío = «Todos» (`app/studio/(app)/cn/_components/AlmacenCnClient.tsx:159`, `:275`).
- La lista trae las 100 recepciones más recientes por `received_at` (`lib/studio/warehouse-cn-queries.ts:114`).
  Las del 64 tienen la fecha del packing list, que es reciente, así que entran arriba.
- Los KPI sí distinguen: «pendientes» y «CBM en almacén» cuentan solo `pendiente_consolidacion`
  (`lib/studio/warehouse-cn-queries.ts:296`). La tabla no.

**Causa:** la pantalla no esconde lo consolidado; lo pinta con la insignia «Consolidado». Es la tabla, no
el dato.

### 1.3 Confirmado en producción: no hay duplicados

Quedaba una duda. Si la oficina hubiera registrado a mano en Almacén China la mercancía del 64 **antes** de
la carga, esas recepciones seguirían `pendiente_consolidacion`, porque la carga crea recepciones nuevas
`WR-C64-*` y no enlaza ni cierra las anteriores (`scripts/consolidados/lote-sql.ts:600`). El conteo del
2026-11-19 (§5, respuesta 1) lo descarta: las 111 recepciones del 64 están `consolidado`, no hay recepciones
manuales con sus marcas y el almacén no tiene ninguna pendiente. Todo lo que hoy se ve en Almacén China
está consolidado: es solo la vista (§1.2).

### 1.4 Embarques: «Activos» incluye lo que va en el mar

- La pestaña por defecto es «Todos» (`app/studio/(app)/embarques/_components/EmbarquesClient.tsx:233`).
- «Activos» = todo lo que no sea `delivered` o `cancelled`
  (`app/studio/(app)/embarques/_components/EmbarquesClient.tsx:115`, `:121`; el conteo usa la misma regla en
  `lib/studio/shipment-queries.ts:404`). Un embarque `in_transit` del 64 cuenta como activo.

### 1.5 La regla de «en camino» ya existe: Tracking

La pantalla de Tracking (SDD-0659) lista contenedores y no envíos sueltos, con el grupo «En mar» para todo
contenedor `zarpado` (`lib/studio/tracking-contenedores.ts:212`). El rol `warehouse` ya ve Tracking
(`lib/studio/rbac.ts:65`), y Almacén China lo ven `operations`, `warehouse` y `support` (`lib/studio/rbac.ts:70`).
Sam no quiere mandar al equipo de China a Tracking (§2): se reutiliza la regla, no la pantalla.

### 1.6 No hay dato de telex release por contenedor

Se buscó en migraciones, `lib/` y `app/` (`telex`, `liberad*`, `release`, `seaway`, `bl_*`). Lo que existe es esto:

- `consolidations` tiene `status` (consolidando/cerrado/zarpado/arribado), `container_no`, `notes`,
  `sailing_id` y solo marcas técnicas de tiempo (`created_at`, `updated_at`, `deleted_at`)
  (`supabase/migrations/0096_naviera_consolidacion.sql:166-179`; `container_no` en la 0154). No tiene fechas
  de negocio y ninguna columna dice si el BL se liberó.
- La ETA (y la ETD) no vive en el contenedor sino en su itinerario: `sailings.eta`, por
  `consolidations.sailing_id` (`supabase/migrations/0096_naviera_consolidacion.sql:96-108`). Tracking y
  Embarques ya la leen así (`lib/studio/tracking-contenedores-queries.ts:203-207`,
  `lib/studio/embarques-contenedores-queries.ts:96-97`). Un contenedor sin `sailing_id` o con `sailings.eta`
  nula no tiene ETA.
- «Liberado» existe solo para la aduana SENIAT en destino (`customs_status`, migraciones 0010 y 0318), que
  es otro hito.
- El modal «Generar BL» ofrece el tipo SeaWayBill (`app/studio/_components/wiring/GenerateBLModal.tsx:31`),
  pero no guarda ningún estado de liberación.

Conclusión: hoy **no hay** dónde marcar «telex release hecho». La vista «Pendiente por liberar» necesita
un dato nuevo (§2.4).

## 2. Propuesta (con las respuestas de Sam del 2026-11-19)

Sam: «Estoy tratando que el almacén China tenga todo en una sola pantalla. Los tres». El equipo de China
casi no tiene acceso al resto del sistema, solo a su área. Por eso **todo va dentro de Almacén China**, en
tres vistas de la misma pantalla. No se manda a nadie a Tracking.

| Vista | Qué muestra | Dato |
|---|---|---|
| **En almacén** (por defecto) | Recepciones `pendiente_consolidacion` + `incidencia`, y las `consolidado` cuyo contenedor no ha zarpado | ya existe |
| **En camino** | Contenedores en el mar: contador de días y porcentaje | ya existe |
| **Pendiente por liberar** | Contenedores en el mar sin telex release | **falta** (§2.4) |

### 2.1 En almacén (vista por defecto)

- Sin filtro en la URL, la tabla muestra lo que está físicamente en la bodega: `pendiente_consolidacion`,
  `incidencia` y las `consolidado` cuyo contenedor no ha zarpado (ver la decisión de abajo). El selector de
  estado queda con «En almacén» por defecto; «Consolidado» y «Todos» siguen a un clic (Sam: «si»).
- Arriba de la tabla, una línea: «N recepciones ya consolidadas no se muestran», con enlace a «En camino».
  N cuenta solo las de contenedores `zarpado`, con los mismos filtros de bodega y búsqueda: son las que se
  ven en «En camino», así el enlace dice la verdad.
- Sin migración: es lectura de `warehouse_receipts_cn`, `consolidation_items` y `consolidations`. Los KPI no
  cambian.

**Decisión de Sam (2026-11-20), vía el DG: «Quedan en almacén».** Una recepción `consolidado` cuyo
contenedor está `consolidando` o `cerrado` sigue en «En almacén», con la etiqueta «En contenedor DTD #N, sin
zarpar» (el número de `notes`; si no hay, la referencia). Al zarpar el contenedor pasa a «En camino»; al
arribar sale de las dos vistas. Lo decide el servidor con la misma regla de «En camino»
(`situacionDeRecepcion` en `lib/studio/almacen-cn-contenedores.ts`). El contenedor de una recepción es el
**vigente** de su envío, con la regla del proyecto: si el envío tiene más de una línea en
`consolidation_items`, gana la más reciente (`created_at`) en un contenedor vivo (SDD-0643 §3.2, SDD-0661,
`lib/portal/consolidation-queries.ts`). Dos líneas del mismo envío quieren decir que se movió de contenedor;
partir un envío (SDD-0563/0673) pone la línea nueva en el mismo contenedor. La aplica `lineaVigentePorEnvio`,
y la leen igual «En almacén», su aviso y «En camino» (`leerContenedorVigentePorEnvio`). Así, un envío que
pasó de un contenedor zarpado o arribado a uno que se llena sigue en la bodega con el contenedor nuevo, y no
sale en «En camino». Una `consolidado` sin contenedor vigente también se queda, sin etiqueta: ninguna
recepción se pierde ni sale dos veces. La lista se lee por páginas y salta lo que ya salió, para que las
recepciones de un contenedor zarpado no tapen a las que siguen en la bodega.

**Costo conocido.** En cada carga, «En almacén» recorre todas las recepciones `consolidado` que pasan los
filtros, con sus líneas y contenedores, para decidir qué sale. La lista se pide en páginas de 200, hasta 25
páginas (5.000 filas), para llenar sus 100 filas. Si la bodega llegara a tener más de 5.000 recepciones
recorridas antes de juntar 100 que se quedan, la lista mostraría menos de 100. Se acepta en esta fase; si
crece, la salida es mover la decisión a la base (una vista o un RPC).

### 2.2 En camino

- Una fila por contenedor `zarpado`: número DTD (de `notes`, como `numeroDtdDeNotas` en
  `lib/studio/embarques-contenedores.ts:184`), contenedor, naviera, ETA, **días que faltan** y **porcentaje
  del viaje**. Sam lo quiere muy simple: solo el contador y el porcentaje, sin mapa ni hitos.
- La ETA sale de `sailings.eta` por `consolidations.sailing_id` (§1.6). Sin ETA, el contador dice «sin
  ETA» y no se inventa (regla de Tracking, `lib/studio/tracking-contenedores.ts:11`).
- El contador y el porcentaje salen de la misma regla de Tracking (`diasRestantes` y `progreso` de
  `lib/studio/tracking-contenedores.ts:386-387`), sin copiarla. Así las dos pantallas no se separan.
- Al abrir un contenedor, las recepciones que lleva (las `consolidado` con `shipment_id` en sus
  `consolidation_items`), con MARKBOX y sin nombre del importador para el equipo de China (SDD-0039 B.9,
  SDD-0531).
- Sin migración.

### 2.3 Pendiente por liberar

Sam: el telex release lo hace **siempre China**. Hoy avisan «ya está listo» sin mandar nada, o se olvida
avisar. China da crédito en el flete y libera cuando el contenedor está por llegar, **unos 15 días antes
de la ETA**. Si no libera, la aduana no puede tocar el contenedor.

- **Solo** contenedores `zarpado` (en el mar) sin telex release. Los `cerrado` (cargados, sin zarpar) no
  entran. Primero los de ETA más cercana; la ETA es `sailings.eta` por `sailing_id` (§1.6). Los que no
  tienen ETA van al final, marcados «sin ETA», y no se resaltan.
- Cada fila: número DTD, contenedor, naviera, ETA y días que faltan. Cuando faltan 15 días o menos, la fila
  se resalta («toca liberar»). Ese umbral queda como constante con nombre: es el mismo que leerá el aviso.
- Botón **«Confirmar telex release»** para el equipo de China. Abre una confirmación con un campo opcional
  para subir el documento (PDF o imagen). Al confirmar, el contenedor sale de esta vista.
- Del lado de DTD (Venezuela), el contenedor aparece en verde como **«Liberado»**, con fecha y, si lo hay,
  el documento. Dónde se ve en Venezuela: la ficha del contenedor en Naviera y la vista por contenedor de
  Embarques, como una insignia que no cambia la lista (§2.5).
- Después vendría un aviso con antelación para que liberen (Sam). **No entra en esta SDD**: aquí se deja
  listo el dato que el aviso va a leer.

### 2.4 Propuesta de dato: telex release por contenedor (migración, sin número todavía)

El número lo da el DG cuando esté por programarse. Se aplica en producción solo con OK de Sam y el
[runbook de producción](../../runbooks/aplicar-migraciones-prod.md).

- En `consolidations`: `telex_released_at timestamptz null` y `telex_released_by uuid null` (usuario que
  confirmó). `null` = sin liberar.
- Confirmar y deshacer por un RPC gobernado: valida tenant y rol (equipo de China: `warehouse` y
  `operations`; `admin` siempre), exige el contenedor `zarpado` o `arribado`, es idempotente y deja evento en
  `entity_audit_log`. Deshacer solo `operations` y `admin`, con motivo (Sam, §5 respuesta 10).
- El documento va al hub de documentos que ya existe: `documents` con `entity_type = 'consolidation'`
  (el tipo ya está en el enum, `supabase/migrations/0097_documentos_hub.sql:44`) y `doc_type` «Telex
  release». No hace falta tabla nueva. Falta verificar al programar que la RLS de `documents` deja subir al
  rol `warehouse` de China.
- La lista de «Pendiente por liberar» sale de `status = 'zarpado' and telex_released_at is null`.

Se descartó usar solo el documento como prueba de liberación: Sam quiere que China pueda confirmar sin
adjuntar nada, y un adjunto no dice por sí solo que la naviera ya liberó.

### 2.5 Embarques: opción (a), elegida por Sam con la maqueta

**Decisión de Sam (2026-11-19, §5 respuesta 9): opción (a).** Lo que sigue describe lo que se vio en la
maqueta y lo que se programa.

Sam quiere **ver** cómo quedaría antes de cambiar nada, y cree que Embarques no debería cambiar. La maqueta
está en [`assets/maqueta-embarques.html`](assets/maqueta-embarques.html) (datos ficticios: DTD #91 a #94, DEMO-CONSOL-01 a 04), publicada
en privado para Sam en <https://claude.ai/artifact/MnQ36KhNCemhmqjzoQuAS8>. Se puede cambiar de pestaña y
abrir los contenedores, y alternar entre la opción (a) y «sin cambio, solo la insignia». Muestra el
cambio exacto propuesto, opción (a):

- **Antes (hoy):** pestañas Todos · Activos · Entregados · Alertas; abre en «Todos»; «Activos» incluye lo que
  va en el mar.
- **Después (a):** pestañas Activos · En camino · Entregados · Alertas · Todos, y abre en «Activos».
  «En camino» = lo que va en el mar: `shipped` (Embarcado) e `in_transit` (En tránsito). «Activos» = lo que
  pide trabajo en origen o en destino: todo lo que no es `shipped`, `in_transit`, `delivered` ni `cancelled`
  (bodega China, consolidando, aduana, bodega VE, bodegaje, reparto, última milla, alerta). Estados de
  `lib/shared/shipment-public.ts:143-157`. La insignia verde «Liberado» aparece en el encabezado del
  contenedor (§2.3).

La alternativa «sin cambio, solo la insignia» y la opción (b) (plegar los zarpados) quedan descartadas.
La regla de las pestañas vive en un solo lugar (`lib/studio/shipment-queries.ts`), para que el conteo y el
filtro no se separen.

### 2.6 Implementación por fases

- **Fase 1 (sin migración):** §2.1, §2.2 y §2.5. PR propia; se puede fusionar y publicar sin ataduras.
- **Fase 2 (migración 0568):** §2.3 y §2.4, telex release. Otra PR; Dir_DTD la fusiona solo con el camino
  despejado (revisión, CI verde y OK de Sam para aplicar a la vista), porque una migración en espera congela
  la publicación de la web.

**Cómo quedó la §2.2 en la fase 1:** la fila dice «DTD #64» (de `consolidations.notes`, con
`numeroDtdDeNotas`) y, debajo, la referencia y el número físico; la columna es «Naviera»
(`sailings.carrier_id` → `carriers.name`). «Ver recepciones (N)» abre las recepciones del contenedor:
las `warehouse_receipts_cn` en `consolidado` cuyo `shipment_id` está en sus ítems, con código, MARKBOX,
cajas y CBM. Las pendientes no se listan ahí: siguen en «En almacén».

**Decisión de Sam (2026-11-20), vía el DG:** «721: solo los que ya zarparon». «En camino» muestra solo
los contenedores `zarpado`; los `consolidando` y `cerrado` no entran, así ninguna recepción sale en dos
pantallas (una recepción pendiente de un contenedor que se llena sigue en «En almacén»). La primera versión
de la fase 1 los incluía en un grupo «Cargados, sin zarpar»; se quitó.

### 2.7 Allowlist exacta de la fase 1

Producto:
- `app/studio/(app)/cn/page.tsx`, `app/studio/(app)/cn/_components/AlmacenCnClient.tsx`
- `app/studio/(app)/cn/_components/CaminoCn.tsx`, `FilaCamino.tsx`, `EncabezadoCn.tsx`, `VistasAlmacen.tsx` (nuevos)
- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`
- `app/studio/studio.css` (solo `a.studio-tab { text-decoration: none }`)
- `lib/studio/warehouse-cn-queries.ts`, `lib/studio/warehouse-cn-types.ts`, `lib/studio/shipment-queries.ts`
- `lib/studio/almacen-cn-vistas.ts`, `almacen-cn-contenedores.ts`, `almacen-cn-contenedores-queries.ts` (nuevos)
- `lib/i18n/es-VE/warehouse.ts`, `lib/i18n/zh-CN/warehouse.ts`

Pruebas:
- `lib/studio/__tests__/almacen-cn-vistas.test.ts`, `almacen-cn-contenedores.test.ts`, `almacen-cn-contenedores-queries.test.ts`, `almacen-cn-en-almacen.test.ts`, `embarques-pestanas.test.ts` (nuevas)
- `app/studio/(app)/cn/_components/__tests__/FilaCamino.test.tsx` (nueva)
- `app/studio/(app)/cn/__tests__/regla-nombres-compartida.test.ts`: la página le pasa además a `listReceipts`
  lo que ya salió de la bodega; la aserción sigue exacta.
- `lib/studio/__tests__/listados-double.ts` (doble compartido): ordena como PostgREST, el primer `order` manda y
  los siguientes desempatan. Antes mandaba el último, y el desempate por `id` de `listReceipts` lo destapó.
- `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.pestanas.test.tsx` (nueva)
- `EmbarquesClient.{abrir,adjuntos,borrado,cajas-monto,contenedores,facturar,peso}.test.tsx`: abren en «Todos»
  (prueban contenedores y montos, no pestañas). `EmbarquesClient.encabezado-cliente.test.tsx` (SDD-0689):
  abre en «En camino», el camino real del 64.

Fuera de la allowlist: ninguna migración, ninguna escritura de datos, ninguna server action.

### 2.8 Clasificación de gobernanza de la fase 1

| Política | Clasificación | Evidencia |
|---|---|---|
| A11Y-01 (pestañas) | cumplimiento | `<nav aria-label>` + `.studio-tabs`, enlaces con `aria-current`; `pestanas-contract.test.ts` verde |
| BTN-01 | cumplimiento | La única acción nueva es la del `<Aviso>` (botón secundario del componente); no hay mutaciones |
| ERR-01 / LOD-01 | cumplimiento | Si falla la lectura de «En camino», `<Aviso tono="error">` lo dice; no se muestra vacío como si no hubiera |
| VIS-01 / VIS-02 | cumplimiento | Solo tokens de `tokens.css`; tipografía y clases existentes |
| MP-01 / AUD-01 / AUD-02 | no aplica | Solo lectura: no se crea, mueve ni borra nada |
| Privacidad China (SDD-0039 B.9, SDD-0531) | cumplimiento | «En camino» no envía nombres de importador. Al abrir un contenedor viaja el MARKBOX de cada recepción, que es lo que China sí ve (§2.2); el de los ítems no se copia. Pruebas en `almacen-cn-contenedores.test.ts` y `almacen-cn-contenedores-queries.test.ts` |

## 3. Fuera de alcance

- El aviso de «por liberar» (correo, WhatsApp o campana): otra SDD, que lee el dato del §2.4.
- Cerrar o borrar recepciones duplicadas en producción, si el conteo las encuentra: se decide aparte, con
  OK de Sam y el runbook.
- Cambiar la carga de consolidados para que enlace recepciones ya registradas a mano: otra SDD si hace falta.

## 4. Pruebas previstas

- Unitarias de `parseReceiptFiltersFromSearchParams` (por defecto «En almacén»; `?status=all` sigue dando
  todo) y de `listReceipts` con el filtro nuevo.
- Unitarias de la selección de «En camino» y «Pendiente por liberar» (solo zarpado, sin telex, orden por
  ETA, resaltado a 15 días o menos), con el contador y el porcentaje leídos de la regla de Tracking.
- Contrato SQL de la migración del §2.4: el RPC rechaza otro tenant, roles sin permiso y contenedores que no
  zarparon; es idempotente; deshacer pide motivo; todo deja auditoría.
- Componente: las tres vistas, el aviso «N consolidadas no se muestran» y la redacción del nombre para China.
- Unitarias de las pestañas de Embarques, opción (a): «Activos» sin `shipped` ni `in_transit`, «En camino»
  con solo esos dos, la pantalla abre en «Activos», y el conteo de cada pestaña es igual a su filtro.
- Cierre con `pnpm verify` en turno de PC del DG; `/ui-check` por ser UI.

## 5. Respuestas y preguntas abiertas

Contestadas por Sam el 2026-11-19, vía el DG:

1. Conteo en producción: **sí**. Lo corrió el DG el 2026-11-19 a las ~12:20Z, en una transacción de solo
   lectura y solo con conteos. Usó para las notas el patrón `~* 'contenedor\s+DTD\s*#\s*64\M'`, el mismo
   del alta del 64.

   | Conteo | Resultado |
   |---|---|
   | Consolidaciones del 64 | 1 |
   | Marcas (clientes) en el 64 | 40 |
   | Recepciones `WR-C64-*` en `consolidado` | 111 |
   | Recepciones `WR-C64-*` en otro estado | 0 |
   | Recepciones manuales con marcas del 64, pendientes | 0 |
   | ídem, recibidas hasta la fecha de la carga | 0 |
   | Recepciones manuales con marcas del 64, consolidadas | 0 |
   | Recepciones pendientes en todo el almacén | 0 |

   Lectura: la carga quedó como dice el código, no hay duplicados ni recepciones manuales pendientes. Con
   la vista por defecto del §2.1, Almacén China quedaría hoy vacía en «En almacén», y eso es lo correcto.
2. Almacén China abre con lo que está en bodega: **sí**.
3. y 4. «En camino» va **dentro de Almacén China**, con contador y porcentaje, junto con «Pendiente por
   liberar»: las tres vistas en una sola pantalla.

5. **A, Embarques:** resuelta por la respuesta 9. Antes de cambiar nada, Sam quiso ver cómo quedaría y se
   preparó la maqueta antes/después (§2.5).
6. **B, telex release:** lo hace siempre China. China tiene un botón para confirmarlo, con opción de subir
   el documento; del lado de DTD sale en verde como «Liberado» (§2.3, §2.4).
7. **C:** «Pendiente por liberar» incluye **solo** los contenedores en el mar. China libera unos 15 días
   antes de la ETA.
8. **D:** el contador son los días que faltan para la ETA.

9. **E, Embarques:** Sam vio la maqueta y eligió **(a)**. Literal: «Lo de embarques me gustó, el después. a».
   Lo transmitió el 2026-11-19 la sesión de la SDD-0661, que coordina con Sam. Embarques abre en «Activos»
   (solo lo que pide trabajo en origen o en destino) y lo que va en el mar pasa a la pestaña nueva «En camino».

10. **F, deshacer el telex:** **sí**. Literal: «Sí, está bien lo de la F. Quedó para operaciones y admin, sí»
    (2026-11-19, vía el DG). Deshacer una confirmación de telex release queda solo para `operations` y
    `admin`, con motivo (§2.4).

No quedan preguntas abiertas.

**Aprobación:** Sam, 2026-11-19, en el chat del DG: «Sí, apruebo 0682».
