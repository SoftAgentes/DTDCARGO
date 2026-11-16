---
sdd: "0643"
title: "Embarques por contenedor: la vista empieza por el contenedor, después el cliente y después sus embarques"
status: in-progress
author: "Claude (Worker del Subdirector Portal) + Sam"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0012", "0047", "0154", "0507", "0522", "0543", "0560", "0603"]
confidencialidad: interno
---

# SDD-0643 — Embarques por contenedor

> La vista Embarques del Studio (`/studio/embarques`) deja de abrir con todos los embarques agrupados
> por cliente. Ahora abre con los contenedores («Contenedor 64», «FCL 63»); dentro de cada uno están sus
> clientes y, dentro de cada cliente, sus embarques. Se filtra por contenedor (número DTD o ISO) y por
> cliente (nombre o Shipping Mark).

## 1. Pedido

Sam, 2026-11-16, revisando en vivo con el equipo:

> «me salen todos los embarques, y lo primero que debe salir son los containers (o sea, tiene que decir
> container 61, container 62). Después de eso, ya puedo entrar a ver la lista. La vista sería primero los
> contenedores, es decir, el consolidado… La vista de embarque tiene que empezar por contenedores.
> Después de contenedores, uno puede especificar los nombres de los clientes, y después, abrir en el
> nombre del cliente los embarques que tiene adentro.»
>
> «Y que se pueda organizar por filtros… Cliente (tanto por nombre como por código de cliente, que es el
> Shipping Mark) • Código o contenedor (por ejemplo, el código del contenedor)».

Nombres visibles, también de Sam: un consolidado (carga suelta de varios clientes, modalidades `ddp` y
`mixto`) se llama **«Contenedor 64»**; un contenedor de un solo dueño se llama **«FCL 63»**. Nunca «lote».

## 2. Lo que existe

| Pieza | Dónde | Qué aporta |
|---|---|---|
| Vista por cliente | `app/studio/(app)/embarques/` (SDD-0012) | Tabs, búsqueda, acordeón por cliente, drawer de detalle. |
| Adjuntos | SDD-0507 | Columna y filtro «Adjuntos». |
| Borrado | SDD-0522, SDD-0560 | Casillas, barra de selección, asistente. |
| Contenedores | `consolidations`, `consolidation_items`, `sailings`, `carriers` (migr 0096) y `container_no` (migr 0154) | En qué contenedor va cada embarque, su ISO, su estado, ETA y naviera. |
| Cargador | `scripts/consolidados/lote-sql.ts` (SDD-0543) | Escribe en `consolidations.notes` «… contenedor DTD #NN · …» y crea un `consolidation_items` por embarque, incluido el envío FCL del dueño. |
| RLS | migr 0096 §10 | Las cuatro tablas son por `tenant_id` para `authenticated`, sin puerta de módulo. Quien abre Embarques (módulo `shipments`) las puede leer. |

## 3. Decisiones

### 3.1 Navegación

1. **Nivel 1, contenedores.** Un acordeón por contenedor. La cabecera muestra:
   - nombre visible («Contenedor 64» o «FCL 63»);
   - número ISO (`container_no`), si está;
   - estado del contenedor, con las etiquetas de `CONTAINER_STATUS` (`lib/studio/naviera/types.ts`);
   - naviera (`carriers.name` del zarpe) o «Sin naviera»;
   - ETA (`sailings.eta`) o «sin fecha». La fecha `YYYY-MM-DD` se formatea sin pasar por UTC;
   - ref interna (`DTD-CONSOL-NNNN`);
   - conteos: clientes, envíos, alertas y m³.
2. **Nivel 2, clientes.** Dentro del contenedor, el acordeón por cliente de la SDD-0012, sin cambios.
3. **Nivel 3, embarques.** Las filas de siempre, con «Abrir», drawer, adjuntos y casillas de borrado.
4. **Orden de los contenedores:** los que tienen alertas primero; después por número DTD descendente;
   los que no tienen número, por fecha de creación descendente; «Sin contenedor» siempre al final.
5. **Abierto por defecto:** con un solo grupo de contenedor, abierto; con varios, cerrados. Con un
   filtro de texto activo, todos los que quedan se abren. Los clientes siguen la regla de antes (menos
   de 3, abiertos) contada dentro de cada contenedor; con filtro de texto, hasta 5. «Expandir todo» y
   «Colapsar todo» actúan sobre los dos niveles.

### 3.2 Embarques sin contenedor

Van a un grupo **«Sin contenedor»**, al final, con el texto «Embarques que no van en ningún contenedor».
Un embarque cuyo contenedor está eliminado (`deleted_at`) también cae ahí: un contenedor eliminado no
agrupa. Si un embarque tiene más de una asignación, gana la más reciente (`consolidation_items.created_at`),
igual que el Portal (`lib/portal/consolidation-queries.ts`).

### 3.3 Consolidado o FCL: con qué dato se distingue

**No hay una columna que lo diga.** `consolidations` no tiene modalidad; `bookings.mode` (FCL/LCL) no lo
llena el cargador y la modalidad de la hoja de rastreo sólo queda como texto en `notes`. Se decide con
los servicios de los embarques que van en el contenedor:

- **FCL** si todos son `fcl_directo` o `fcl_bodega` (lo que crea el cargador para `--modalidad fcl`: un
  solo envío del dueño).
- **Consolidado** en cualquier otro caso: con un `puerta_a_puerta_DDP` o un `consolidado_lcl` adentro
  (modalidades `ddp` y `mixto`), o sin embarques visibles.

Límite: se cuentan los embarques que están en la vista. Si un tab o un filtro deja sólo el envío FCL de un
contenedor mixto, ese contenedor se muestra como «FCL». Se acepta para esta tarea; una columna de
modalidad en `consolidations` lo resolvería y exige migración (fuera de alcance, §6).

### 3.4 Número DTD («64»)

**Tampoco hay columna.** El cargador lo escribe en `consolidations.notes` como «contenedor DTD #NN». La
vista lo lee con la expresión `contenedor\s+DTD\s*#\s*(\d{1,4})`. Sin ese texto (contenedores creados a
mano en Naviera) no hay número y no se inventa: el nombre usa el ISO y, si falta, la ref
(«Contenedor DTD-CONSOL-0009»). Que el número dependa de un texto libre es frágil; una columna
`numero_dtd` exige migración (§6).

### 3.5 Filtros

- **Contenedor** (campo nuevo, monoespaciado): número DTD exacto de 1 a 4 cifras («64», «#64»,
  «Contenedor 64», «FCL 63»), o parte del ISO o de la ref (`TLLU779`, `7792550`, `CONSOL-0012`). Un número
  corto es sólo el número DTD: «64» no trae un ISO que tenga «64» adentro. «Sin contenedor» no pasa este
  filtro. No se pinta si no se pudieron leer los contenedores.
- **Cliente** (campo nuevo): nombre sin acentos ni mayúsculas, o Shipping Mark.
- **Buscar** sigue igual (código, cliente, Shipping Mark, origen, destino); su texto de ejemplo pasa a
  «Código, ruta…».
- Tabs, «Servicio» y «Adjuntos» siguen igual y se aplican antes de agrupar.

### 3.6 Datos

- Cuatro lecturas con la sesión del usuario (`lib/studio/embarques-contenedores-queries.ts`), en tramos de
  100 ids: `consolidation_items` → `consolidations` vivas → `sailings` → `carriers`. Respeta la RLS de la
  migr 0096. **Sin migración nueva y sin service_role.**
- Si una lectura falla, devuelve `null`: la vista lo dice («No se pudieron leer los contenedores. La lista
  se agrupa sólo por cliente.») y agrupa como antes. No manda todo a «Sin contenedor», que no sería cierto.
- **Tope:** un consolidado trae decenas de embarques (el 64, 58 clientes) y la lista se cortaba en 100.
  `listShipments` acepta `opts.limit`; Embarques pide 500. Si llega al tope, la vista lo dice. Adjuntos y
  borrado ya leen por tramos, así que más ids no rompen sus URLs.
- La vista no muestra datos que no mostrara antes, salvo el ISO, la naviera, la ETA y la ref del
  contenedor, que no son datos personales.

## 4. Allowlist

- `docs/specs/0643-embarques-por-contenedor/spec.md`
- `lib/studio/embarques-contenedores.ts` (nuevo)
- `lib/studio/embarques-contenedores-queries.ts` (nuevo)
- `lib/studio/shipment-queries.ts` (sólo `listShipments`: parámetro `opts.limit`)
- `app/studio/(app)/embarques/page.tsx`
- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`
- `lib/studio/__tests__/embarques-contenedores.test.ts` (nuevo)
- `lib/studio/__tests__/embarques-contenedores-queries.test.ts` (nuevo)
- `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.contenedores.test.tsx` (nuevo)
- `docs/specs/README.md` (índice regenerado, si `docs:check` lo pide)
- `.agents/handoffs/0643-embarques-por-contenedor.md`

## 5. Aceptación

1. Sin filtros, el primer nivel de `/studio/embarques` son los contenedores, con nombre, ISO, naviera, ETA,
   estado y conteos; «Sin contenedor» al final.
2. Un consolidado se llama «Contenedor NN» y un contenedor sólo con envíos FCL, «FCL NN». En ningún texto
   nuevo aparece «lote».
3. Al abrir un contenedor se ven sus clientes; al abrir un cliente, sus embarques.
4. «Contenedor» filtra por número DTD exacto y por ISO; «Cliente», por nombre o Shipping Mark.
5. Tabs, servicio, adjuntos, borrado (casillas, barra, asistente) y drawer funcionan como antes, dentro de
   cada contenedor.
6. Si no se pueden leer los contenedores, la vista lo dice y agrupa por cliente.
7. Si la lista llega al tope de 500, la vista lo dice.
8. Sin migración, sin service_role, nada en producción ni en el VPS.

Pruebas: `lib/studio/__tests__/embarques-contenedores.test.ts` (1–2, 4), `…-queries.test.ts` (6, 3.2,
tramos), `EmbarquesClient.contenedores.test.tsx` (1–7) y las pruebas que ya existían de la vista (5).

## 6. Fuera de alcance

- Columnas `modalidad` y `numero_dtd` en `consolidations` (exigen migración y aviso previo al Subdirector
  Portal; harían exacto lo que hoy se deduce, §3.3 y §3.4).
- Paginación de Embarques más allá de 500.
- Cambios en Naviera, Tracking o el Portal.

## 7. Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| BUS-01 (búsqueda) | cumplimiento | Dos filtros con etiqueta visible y texto de ejemplo; filtran en el cliente sin ida y vuelta. |
| A11Y-01 | cumplimiento | Cabecera de contenedor = `<button aria-expanded aria-controls>` dentro de `<section aria-label>`; teclado nativo. |
| BTN-01 | cumplimiento | Sin acciones nuevas; los botones de borrado no cambian. |
| AVS-01 / ERR-01 | cumplimiento | Falla de lectura y tope con `<Aviso>` (SDD-0628). |
| VIS-01 / BRAND | cumplimiento | Tokens del Studio, sin colores en línea; ISO y ref en monoespaciado. |
| MP-01 / AUD | no aplica | No hay mutaciones nuevas. |
| Privacidad | no aplica | No se capturan, mueven ni borran datos personales; no se muestran datos personales nuevos. |
