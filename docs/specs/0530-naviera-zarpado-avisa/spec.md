---
sdd: "0530"
title: "Naviera: al zarpar el contenedor, los envíos de los clientes avanzan y se les avisa"
status: in-progress
author: "Claude"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0047", "0096", "0156", "0170", "0232", "0283", "0311", "0357", "0475", "0511", "0524"]
confidencialidad: interno
---

# SDD-0530 — Al zarpar el contenedor, sus envíos avanzan y se les avisa

> Marcar «zarpado» un contenedor en Naviera pasa sus envíos a «Embarcado» y les programa el aviso de
> embarque; marcarlo «arribado» los pasa a «En aduana». El contenedor, los envíos, su historial y la
> auditoría cambian en una sola transacción. Los envíos que no pueden avanzar no se tocan y la
> pantalla dice cuáles y por qué. Migración **0477**.

## Pedido de Sam

Sam eligió «"Zarpado" en Naviera avisa». El Director se lo describió así:

> «Que al marcar un contenedor como zarpado en Naviera se actualicen los envíos de los clientes y se
> les avise. Hoy hay que avanzar cada envío a mano en Tracking.»

## Diagnóstico

Verificado sobre `main` = `a8d99acf`. Las líneas son de ese commit.

### Naviera avisa en tres casos, y el zarpe no es uno

`app/studio/(app)/naviera/actions.ts`:

- Contenedor **cerrado** → `consolidated` (`:559-573`, mapa `EVENTO_POR_ESTADO`).
- Contenedor **arribado** → `received_ve` (`:561`, SDD-0311).
- Itinerario con ETA → `eta_set` (`:176-185` en `updateSailing`, `:723-740` en `linkConsolidation`).
- **Zarpado no avisa.** `changeConsolidationStatus` (`:522-582`) sólo hace el UPDATE de
  `consolidations.status`; `changeSailingStatus` (`:191-207`) tampoco avisa, y además **no tiene
  llamadores**: el estado del itinerario se cambia desde `SailingDrawer` con `updateSailing`.

### Naviera nunca cambia el estado de un envío

Naviera sólo lee `shipments`: `lib/studio/naviera/queries.ts:550`, en `listLooseCargo`, y sin
`status`. Los envíos se unen al contenedor por `consolidation_items.shipment_id`
(`0096_naviera_consolidacion.sql:197-201`).

### El cambio de estado con aviso vive en Tracking

`transitionShipment` (`app/studio/(app)/tracking/[id]/actions.ts:253-345`):

- valida que el estado aplique al servicio (`isValidStatusForService`);
- hace el UPDATE de `shipments.status` y el INSERT en `shipment_events`;
- programa `status:<nuevo>` con `scheduleClientNotifications` (`:323-339`), salvo
  `arrived_destination`, cuyo aviso canónico es `received_ve`.

No escribe auditoría AUD-01 y no es atómico: el UPDATE y el INSERT van por separado.

La máquina de estados por servicio está en `lib/studio/shipment-state-machine.ts:15-98`: dice qué
estados **aplican** a cada servicio, no las transiciones. El orden del recorrido está en
`lib/studio/tracking-progress.ts:19-29` (`STATUS_FLOW_ORDER`), con `delayed_warehouse` al nivel de
`arrived_destination` (`:48`).

En producción la regla `status:shipped` está activa por correo (dato del Director; no lo leí).

## Decisiones

### 1. El evento es el contenedor, no el itinerario

Lo que se marca es el **contenedor** (`consolidations`), con el botón «Marcar zarpado»
(`NavieraClient.tsx:991-1000` en `main`):

- los envíos cuelgan del contenedor, no del itinerario (`consolidation_items`);
- un itinerario puede llevar contenedores que no zarparon, y un contenedor puede no tener
  itinerario (`sailing_id` es opcional);
- `changeSailingStatus` no tiene llamadores, y el estado del itinerario es un dato editable del
  drawer, no un hecho operativo con botón.

### 2. Zarpe → `shipped`; arribo → `in_customs`

| Contenedor | Envíos pasan a | Aviso |
|---|---|---|
| `cerrado → zarpado` | `shipped` («Embarcado») | `status:shipped`, por la llamada de Tracking |
| `zarpado → arribado` | `in_customs` («En aduana») | `status:in_customs` por la llamada de Tracking, y `received_ve` como hasta hoy |

**Por qué `in_customs` y no `arrived_destination`:**

- `arrived_destination` es «En bodega VE». Al arribar el contenedor al país todavía faltan el
  puerto y el traslado (SDD-0311 §4); decir «en bodega» sería falso.
- `in_customs` es el paso siguiente al tránsito en los cuatro servicios marítimos
  (`STATUS_FLOW_ORDER`).
- Almacén VE trabaja desde ahí: `markCustomsReleasedAction` (`app/studio/(app)/ve/actions.ts:88`)
  pasa `in_customs → arrived_destination`.

**Sin duplicar `received_ve`:**

- `received_ve` se sigue programando una vez por envío con `scheduleConsolidationEvent`, igual que
  antes. Su índice único impide un segundo.
- `status:in_customs` es otro evento. Sólo sale si el tenant tiene esa regla activa, y es
  exactamente lo que habría salido si el operador moviera cada envío a mano en Tracking.
- No se programa `status:arrived_destination`, que sí repetiría «Tu carga llegó a Venezuela».

### 3. Qué envío avanza: la regla

`decidirAvance` (`lib/studio/naviera/avance-por-contenedor.ts`) y, en la base,
`naviera_avance_decision` (0477). Para cada envío vivo del contenedor:

1. **Cancelado, entregado o en excepción** → no se toca. La excepción la resuelve una persona en
   Tracking.
2. **El servicio no tiene el estado destino** → no se toca. El terrestre no zarpa ni pasa por
   aduana.
3. **Ya está en el destino** → no se toca y no se le vuelve a avisar.
4. **Ya va más adelante** → no retrocede.
5. **Eliminado** → no se toca.
6. **Si no, avanza.** `draft`, `in_warehouse` y `consolidating` pasan a `shipped`; además `shipped`
   e `in_transit` pasan a `in_customs`.

**`draft` avanza a propósito.** Hoy los envíos de un contenedor suelen quedarse en el estado en que
se crearon, porque nadie los movía. Si el envío está en un contenedor que zarpó, su carga zarpó.

**Las dos copias de la regla:** la prueba PGlite compara las dos caso por caso: 5 servicios más uno
inexistente, por 13 estados más uno inexistente, por los 2 destinos. Si cambia
`shipment-state-machine.ts` o `tracking-progress.ts`, la prueba se pone roja y hace falta una
migración hermana. Es el mismo trade-off que aceptaron 0357 y 0475.

### 4. RPC con auditoría, no un bucle best-effort

Un bucle en la server action no cumple AUD-01: el cambio de estado de un envío es un evento
obligatorio (§2) y la mutación y su evento tienen que ser una sola operación (§1, §4). Un bucle
dejaría contenedores zarpados con la mitad de sus envíos avanzados y sin rastro del resto.

Se sigue el patrón del repo para mutaciones gobernadas y masivas: RPC `SECURITY DEFINER` con lock,
estado esperado y AUD-01 en la misma transacción (0322 autorización de consolidación, 0336 POD que
cierra varios embarques), y un trigger que impide el atajo por PostgREST (0321, 0322).

`advance_consolidation_governed(p_consolidation_id, p_to)`:

1. **Quién.**
   - Exige `auth.uid()`.
   - El contenedor tiene que estar vivo y en un tenant donde el actor tenga membresía activa. Si
     no, P0002, y no se revela que existe.
   - Hace falta edición de **Naviera y de Tracking** (`naviera_avance_module_authorized`).
2. **Desde dónde.** Se zarpa desde `cerrado` y se arriba desde `zarpado`. Desde otro estado: 40001,
   con el estado actual en el mensaje.
3. **Ya estaba.** Si el contenedor ya está en el destino, devuelve `outcome: already` y no toca nada.
4. **Lo demás, en una transacción:**
   - el contenedor cambia de estado;
   - cada envío de `consolidation_items` se bloquea `FOR UPDATE`, en orden de id;
   - los que la regla deja avanzan, con su `shipment_events` (autor y la nota del contenedor) y su
     AUD-01 `shipment_status_changed`;
   - al final va el AUD-01 `consolidation_status_advanced` del contenedor, con avanzados, saltados y
     su motivo, y las piezas sin envío;
   - todos comparten un `correlation_id` `naviera-avance:<uuid>`.
5. **Si la auditoría falla, no cambia nada.**
6. **El atajo está cerrado.** `guard_consolidation_advance_trg` rechaza con 42501 cualquier UPDATE
   que ponga el contenedor en `zarpado` o `arribado` sin pasar por la RPC.

**La auditoría no guarda nombres ni Shipping Mark:** sólo ids y códigos de envío. El nombre y el
Shipping Mark vuelven en la respuesta, para el aviso.

### 5. Avisos: la misma llamada que Tracking, después del commit

`programarAvisosDelAvance` (`lib/studio/naviera/avance-por-contenedor-queries.ts`) llama a
`scheduleClientNotifications` con lo mismo que `transitionShipment`:

- ancla de envío;
- Shipping Mark;
- nombre;
- `statusEvent(destino)`;
- la hora.

Una prueba lo compara contra la llamada real de `transitionShipment` para el mismo envío.

- Va **en serie**, como `scheduleForTargets`.
- Es **best-effort**: el aviso nunca fue parte de la transacción en Tracking, y no se puede meter en
  la de la base sin tocar `lib/studio/notifications/*`.
- **Con `already` no se programa nada.** Marcar zarpado dos veces, con dos clics o en dos pestañas,
  no avanza ni avisa dos veces.

### 6. Pantalla

- «Marcar zarpado» y «Marcar arribado» abren un `ConfirmDialog` (canonical). El diálogo nombra el
  contenedor, cuántos envíos tiene y la consecuencia, antes de cambiar nada.
- Mientras corre, el diálogo bloquea un segundo envío. Si falla, el error se queda en el diálogo y
  se puede reintentar.
- Al terminar queda a la vista un **resumen** en el detalle del contenedor:
  - cuántos envíos avanzaron;
  - cuántos avisos quedaron en la agenda;
  - cuáles no cambiaron y por qué;
  - las piezas sin envío.
- El resumen sobrevive al cambio de estado del contenedor, aunque el botón desaparezca. También
  sale un toast con una línea.
- Los números son los que devuelve el servidor (SDD-0311): no se infieren de los ítems.

### 7. Permisos

- La acción exige `moduleEditDenial` de `naviera` (`lib/studio/rbac.ts:74`) **y** de `tracking`
  (`:62`) antes de llamar la RPC.
- La base vuelve a exigir lo mismo. En los defaults, eso deja a admin, operations y accounting.
- Cerrar el contenedor sigue pidiendo sólo Naviera.
- No se escala ningún permiso: `rbac.ts` no cambia.

## Gobernanza

| Política | Resultado |
|---|---|
| SGE-00.01 | cumplimiento: «Marcar zarpado» conserva su verbo y su resultado de negocio; ahora también lo cumple sobre los envíos |
| SGE-00.02 | no aplica: no hay trabajo del usuario que perder (el diálogo no tiene campos) |
| SGE-00.03 | cumplimiento: MP-01 R2 (§ abajo), con diálogo de consecuencia |
| SGE-00.04 | cumplimiento: AUD-01 por envío y por contenedor, en la misma transacción |
| SGE-00.05 | cumplimiento: pruebas negativas de rol, desvío, membresía desactivada, otro tenant y sin sesión en la base y en la acción |
| SGE-00.06 | cumplimiento: el diálogo dice qué no se va a tocar antes de ejecutar |
| SGE-00.07 | cumplimiento: el resumen sale después del resultado durable; doble ejecución bloqueada en la UI y en la base (`already`) |
| SGE-00.08 | cumplimiento: quita N transiciones a mano en Tracking por contenedor |
| SGE-00.09 | cumplimiento: `ConfirmDialog` canonical, sin primitiva nueva |
| SGE-00.10 | cumplimiento: diálogo accesible del sistema, resumen como `region` con encabezado y lista |
| SGE-00.11 | cumplimiento: el resumen dice qué pasó y por qué no cambió cada envío |
| SGE-00.12 | no aplica: no hay IA |
| AUD-01 | cumplimiento: atomicidad, actor, antes/después, `correlation_id`, sin PII; el fallo del writer revierte todo (probado) |
| MP-01 | cumplimiento: R2. El estado de cada envío se puede corregir en Tracking; el correo que salió no |
| BTN-01 | cumplimiento: abrir el diálogo no muta; confirmar nombra la acción; pending y error en el diálogo |
| HTD-01 | no aplica: acción R2, frecuente, con revisión de alcance y resumen (§2 «acción masiva») |
| ERR-01 | cumplimiento: errores estables por código y reintento seguro |
| LOD-01 | cumplimiento: pending y anti-doble envío |
| A11Y-01 | cumplimiento: foco, teclado y live region del diálogo canonical |
| CMP-01 | cumplimiento: dos componentes nuevos de módulo (no primitivas), consumidores de `ConfirmDialog` canonical |
| TBL-01 | no aplica: no hay tabla nueva |

## Alcance — allowlist exacta

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0477_naviera_zarpe_avanza_envios.sql` (nuevo) | RPC, regla, matriz y trigger |
| `supabase/tests/0477_naviera_zarpe_avanza_envios.test.sql` (nuevo) | contrato SQL: 60 aserciones |
| `lib/studio/__tests__/naviera-zarpe-avanza-envios.migration.test.ts` (nuevo) | PGlite: contrato, control rojo, mutantes y propiedades |
| `supabase/migrations-baseline.json` | espera de 0477 |
| `supabase/pending-migration-symbol-declarations.json` | degradación de `advance_consolidation_governed` |
| `lib/studio/naviera/avance-por-contenedor.ts` (nuevo) | regla, tipos, lectura del resultado y resumen (puro) |
| `lib/studio/naviera/avance-por-contenedor-queries.ts` (nuevo) | RPC y avisos (servidor) |
| `lib/studio/naviera/__tests__/avance-por-contenedor.test.ts` (nuevo) | puro |
| `lib/studio/naviera/__tests__/avance-por-contenedor-queries.test.ts` (nuevo) | RPC y avisos |
| `app/studio/(app)/naviera/actions.ts` | `changeConsolidationStatus` deriva zarpado/arribado a `avanzarContenedor`; el mapa de eventos sube a nivel de módulo |
| `app/studio/(app)/naviera/__tests__/zarpe-avanza-envios.test.ts` (nuevo) | acción real con el doble que filtra |
| `app/studio/(app)/naviera/_components/NavieraClient.tsx` | los dos botones pasan por el diálogo; resumen en el detalle |
| `app/studio/(app)/naviera/_components/AvanceContenedorAccion.tsx` (nuevo) | botón + diálogo |
| `app/studio/(app)/naviera/_components/AvanceContenedorResumen.tsx` (nuevo) | resumen |
| `app/studio/(app)/naviera/_components/__tests__/AvanceContenedor.test.tsx` (nuevo) | jsdom: diálogo y resumen |
| `app/studio/(app)/naviera/_components/__tests__/NavieraClient.avance.test.tsx` (nuevo) | jsdom: el detalle real |
| Esta spec, `docs/specs/README.md` y `.agents/handoffs/0530-naviera-zarpado-avisa.md` | documentación |

**No se tocan:**

- `app/studio/(app)/tracking/[id]/actions.ts` (SDD-0522);
- `lib/studio/notifications/*` (#227);
- `lib/studio/rbac.ts`, `app/studio/(app)/embarques/`, `app/studio/(app)/cn/` y `app/portal/**`.

La prueba de la acción **importa** `transitionShipment` para comparar la llamada, sin editarlo.

## Aceptación

1. **Zarpe.**
   - Con el contenedor `cerrado`, «Marcar zarpado» lo deja `zarpado`.
   - Pasa a `shipped` cada envío vivo que la regla deja, con su `shipment_events` y su AUD-01.
   - Programa `status:shipped` con la llamada de Tracking.
2. **Arribo.**
   - Con el contenedor `zarpado`, «Marcar arribado» lo deja `arribado`.
   - Pasa a `in_customs` los que la regla deja y programa `status:in_customs`.
   - Programa `received_ve` como antes, sin `status:arrived_destination`.
3. **Los que no avanzan.** Entregado, cancelado, en excepción, eliminado, servicio sin el estado,
   ya en el destino y más adelante no se tocan. Salen en el resultado con su motivo, y en el
   resumen de la pantalla.
4. **Dos veces.** El segundo zarpe devuelve `already`: no agrega eventos, auditoría ni avisos.
5. **Atomicidad.** Si la auditoría no se puede escribir, el contenedor, los envíos y sus eventos
   quedan como estaban.
6. **Atajo cerrado.** Un UPDATE directo a `zarpado` o `arribado` falla con 42501, también para el
   dueño de la tabla.
7. **Permisos.**
   - Sin edición de Naviera o de Tracking no se zarpa, en la acción ni en la base.
   - La matriz de la base decide lo mismo que `canEditModule` para cada rol y cada desvío de 0357.
   - Membresía desactivada, otro tenant o sin sesión no ven el contenedor.
8. **Pantalla.**
   - El diálogo dice contenedor, cantidad de envíos y consecuencia.
   - El resumen queda a la vista después del cambio de estado.
   - El error se queda en el diálogo y se puede reintentar.
9. **Migración.**
   - Cabecera «⚠️ NO APLICADA A PRODUCCIÓN.».
   - Espera en el baseline y degradación declarada (gate en amarillo).
   - MIGRATE-FIRST.

`status: in-progress` a propósito: la 0477 no está aplicada, falta el smoke de Sam y `pnpm verify`
está **NO EJECUTADO**, porque el turno pesado es de otro Worker.

## Evidencia

**Rojo contra `main`.** Con el `actions.ts` de `a8d99acf`, la prueba de la acción da **12 rojos y 2
verdes** de 14. Los dos verdes son controles de no regresión: sin Naviera no hay RPC, y cerrar el
contenedor no cambia. Cada rojo falla porque no hay RPC ni avisos: el zarpe era un UPDATE directo.

**Contrato 0477 en PGlite.**

- `TEST 0477 GREEN: 60 aserciones`.
- Control rojo: sin 0477 cae en la primera aserción.
- **16 mutantes** de la migración, uno por regla, y cada uno muere en la aserción de su regla.
- Hay **dos defensas dobles**, y su mutante muere por otro camino. Está anotado en la prueba:
  - Sin la rama `eliminado`, el `deleted_at is null` del UPDATE aborta la RPC entera. Es decir: un
    envío eliminado impediría zarpar todo el contenedor.
  - Sin el chequeo de estado de origen, el `status = v_from` del UPDATE frena igual. Muere en el
    mensaje, que es lo que esa rama agrega.

**Propiedades (PGlite).**

- Regla de la base contra `decidirAvance`: 168 casos.
- Matriz de la base contra `canEditModule`: 97 casos (admin y 6 roles × 4 × 4 desvíos).
- Los enums del fixture son los de `lib/shared/shipment-public.ts`.

**Mutantes de app y lib.** Son 31, uno por decisión del diff, con reemplazo exacto. **Mueren los
31.**

- Un mutante cuenta como muerto sólo con una línea «N failed».
- La batería de 7 archivos estuvo verde, 78/78, antes y después.
- La lista completa está en el handoff.

**Verde con el arreglo.**

- La batería de Naviera completa: 19 archivos y 199 pruebas.
- `vitest related` sobre los archivos de producto: 7 archivos y 81 pruebas.
- Los contratos que recorren el árbol del Studio: 21 archivos y 685 pruebas.

## Riesgos y límites

- **Avisos masivos.** Un contenedor con N envíos programa hasta N avisos `status:shipped` de una
  vez, y cada uno dispara un drain inline. Ya pasaba al cerrar el contenedor (`consolidated`) y al
  arribar (`received_ve`).
  - La acción los programa en serie.
  - La función puede tardar con contenedores muy grandes: la RPC más N programaciones de 3-4
    consultas cada una.
  - Lo esperado es que salga un correo por cliente y envío, porque eso pidió Sam.
- **El aviso no es atómico con el cambio**, igual que en Tracking. Si el servidor se cae entre el
  commit y la programación, el envío queda `shipped` sin aviso, y reintentar no lo repara (devuelve
  `already`). El riesgo es el mismo de `transitionShipment`.
- **Concurrencia.** PGlite tiene una sola conexión: el `FOR UPDATE` del contenedor y de los envíos
  no se probó con dos sesiones. El orden por id evita interbloqueos entre dos avances. Tracking
  bloquea un envío a la vez y no toma el contenedor.
- **MIGRATE-FIRST con ventana.** Con 0477 aplicada y la app de antes, los dos botones fallan con
  42501 hasta el despliegue, sin cambiar nada. No aplicar en la ventana del corte al servidor
  propio (jueves 2026-10-15 en la noche).
- **Regla duplicada** en TypeScript y en SQL, y defaults de la matriz duplicados con `rbac.ts`. Lo
  vigilan las propiedades PGlite.
- **`status:in_customs`.** Si el tenant tiene esa regla activa (por ejemplo, el aviso de cobro
  anticipado), al arribar el cliente recibe ese aviso y el `received_ve`. Es lo mismo que pasaría
  moviéndolos a mano. **NO VERIFICADO** qué reglas de aduana hay en producción.
- **La nota del historial es visible en el Portal** (`listMyShipmentEvents`).
  - El zarpe dice «Zarpó con el contenedor DTD-CONSOL-NNNN.».
  - El arribo dice «Llegó a Venezuela con el contenedor DTD-CONSOL-NNNN.». No dice «aduana», para no
    delatar el hito si el tenant lo oculta.

## Datos personales

Revisé `.claude/skills/revisar-datos-ve/SKILL.md`. El cambio no captura datos nuevos ni crea
columnas.

- Mueve el Shipping Mark y el nombre del cliente, que ya están en `shipments`. Van de la RPC a la
  acción y de ahí al motor de avisos, la misma finalidad y el mismo camino que Tracking.
- La auditoría guarda ids y códigos de envío, sin nombres ni Shipping Mark: hay una aserción que lo
  exige.
- El resumen de pantalla muestra códigos y Shipping Mark, sin nombres.

Resultado:

- **CORRECTO** en minimización.
- **NO VERIFICABLE** el contenido de las reglas de aviso en producción.

## Fuera de alcance

Detalle en el handoff:

- WhatsApp.
- Crear envíos automáticamente.
- Cambiar reglas de aviso.
- `in_transit` automático después del zarpe.
- Que `createConsolidation` fuerce `consolidando`. Hoy acepta cualquier estado del cliente, y el
  trigger sólo cubre UPDATE.
- Unificar `transitionShipment` con `programarAvisosDelAvance` cuando entre la 0522.
