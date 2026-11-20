# Handoff — SDD-0682 fase 1: Almacén China por vistas y pestañas de Embarques

Fecha: 2026-11-20 · Rama: `claude/sdd-0682-almacen-china-vistas` · Base: `origin/main` `2ea18799a`
Spec: `docs/specs/0682-almacen-china-sin-consolidado/spec.md` (aprobada por Sam el 2026-11-19).
Sam pidió arrancar la implementación en esta sesión el 2026-11-20 («Sí, arranca»).

## Hecho (sin migración)

- **Almacén China abre en «En almacén»** (§2.1): sin `?status=` el filtro es `en_almacen` =
  `pendiente_consolidacion` + `incidencia` (`lib/studio/warehouse-cn-queries.ts`). `?status=all` sigue dando
  todo. Aviso con cuántas consolidadas quedan fuera y botón a «En camino». Vacío: «No hay mercancía en la bodega».
- **«En camino» dentro de Almacén China** (§2.2): `?vista=camino`. Contenedores `zarpado` («En el mar») y
  `consolidando`/`cerrado` («Cargados, sin zarpar»), con buque, ETA (`sailings.eta`), días y porcentaje de la
  regla de Tracking (`armarContenedor`). Sin nombres ni marcas de importador: solo clientes y cajas.
- **Embarques, opción (a)** (§2.5): regla única en `lib/studio/shipment-queries.ts` (`enPestana`,
  `contarPorPestana`, `filtrarPorPestana`); abre en «Activos», pestaña nueva «En camino» (`shipped`,
  `in_transit`). Prop `pestanaInicial` (por defecto «Activos»).
- i18n es-VE y zh-CN.

## Revisión independiente sobre `c006caa17`: CHANGES_REQUESTED (2026-11-20)

Corregido en la tanda siguiente:
- §2.2 completa: la fila dice «DTD #64» (`numeroDtdDeNotas`), la columna es «Naviera» (carriers por
  `sailings.carrier_id`) y «Ver recepciones (N)» abre las recepciones consolidadas del contenedor con MARKBOX
  (`FilaCamino.tsx`). §2.8 corregida: en el detalle viaja el MARKBOX, nunca el nombre.
- Menores: fuera `warehouse_cn.empty.title/description`, `camino.title` y `camino.col_vessel`; el texto pequeño
  de la bodega vacía es «En almacén»; el aviso de consolidadas cuenta con los mismos filtros de bodega y
  búsqueda que la tabla; `?status=` desconocido deja el selector en «En almacén» (`statusDelSelector`, misma
  regla que el servidor); caso nuevo en «Activos» con un envío en aduana en la prueba del encabezado; el
  fixture `DTD-0418` pasa a `DEMO-0001`.

## Decisión de Sam (2026-11-20)

- «721: solo los que ya zarparon». `ESTADOS_EN_CAMINO = ["zarpado"]`; fuera el grupo «Cargados, sin zarpar» y
  su texto; prueba explícita de que `consolidando` y `cerrado` no entran.

## Revisión sobre `658dfbbaf`: APPROVED, con tres menores corregidos en la tanda siguiente

- M1: `DTD-1004` → `DEMO-1004` en `EmbarquesClient.encabezado-cliente.test.tsx`.
- M2: el comentario de `cn/page.tsx` sobre «En camino» dice ahora que lee los contenedores zarpados y sus
  recepciones consolidadas.
- M3: el panel de recepciones es un `role="row"` con una celda (`aria-colspan`) y la tabla nativa adentro;
  prueba en `FilaCamino.test.tsx`.

## Pruebas

- Nuevas: `lib/studio/__tests__/almacen-cn-vistas.test.ts`, `almacen-cn-contenedores.test.ts`,
  `embarques-pestanas.test.ts`, `EmbarquesClient.pestanas.test.tsx`.
- Las 34 pruebas previas de `EmbarquesClient.*` arman envíos `in_transit`; se les pasa `pestanaInicial="all"`
  porque prueban contenedores y montos, no pestañas. No se debilitó ninguna aserción.
- Tras traer main con la 0689 (#716, `0f736b35f`): su prueba `EmbarquesClient.encabezado-cliente.test.tsx`
  abre en `pestanaInicial="camino"` (decisión del DG: es el camino real del 64, zarpado), y en su bloque
  «el encabezado no depende de la pestaña» los casos «Activos» pasan a «En camino», donde ahora viven los
  envíos en tránsito. Aserciones sin cambios.
- Turno de PC del DG, 2026-11-20, sobre `0c50a9fa8` y el arreglo encima:
  - typecheck (`pnpm typecheck`): PASÓ.
  - vitest de lo tocado (cn, embarques, contratos del Studio, app/m/cn y las pruebas de lib/studio
    relacionadas): primera corrida 743/744; FALLÓ `pestanas-contract` porque el enlace de pestaña llevaba
    `style` en línea. Arreglo: se quita el estilo y `a.studio-tab { text-decoration: none }` va a
    `studio.css`. Segunda corrida de contratos, cn y lectores de `studio.css`: 491/491 PASÓ.
  - eslint de los archivos tocados: PASÓ.
  - `pnpm verify` completo: NO EJECUTADO (el DG no lo dio en este turno; lo cubre la CI).

## Pendiente de esta tarea

- Correr las comprobaciones con turno, PR de la fase 1, revisión independiente (la lanza el DG).
- Fase 2 (§2.3–2.4, telex release): migración **0568** asignada por el DG, en PR aparte, cabecera
  «NO APLICADA EN NINGÚN ENTORNO»; no se fusiona sin aviso del DG ni se aplica sin OK nominal de Sam.
- Clasificación nueva de Sam (CONT.DDP, CONT.FCL, CARGA.DDP, LCL-L, «contenedor DDP consolidado»): enmienda
  dentro de la 0682 cuando Sam conteste la ronda de preguntas. Catálogo existente: modalidades de carga
  `ddp`/`fcl`/`mixto` (`scripts/consolidados/modelo.ts:142`), solo en notas; `BookingMode` FCL/LCL.

## FUERA DE ALCANCE DETECTADO

- Choque de comportamiento con la 0689 medido y resuelto aquí (ver Pruebas). El DG le pasó a la 0689 que el «Total sin
  facturar» debía ser del contenedor entero, no de la pestaña; su prueba ya lo cubre.
