---
sdd: "0510"
title: "El selector de «Generar Bill of Lading» filtra con las etiquetas reales del enum"
status: done
author: "Claude"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: ["0034", "0465", "0494", "0509"]
confidencialidad: interno
---

# SDD-0510 — El selector de «Generar Bill of Lading» filtra con las etiquetas reales del enum

> El modal pedía los embarques abiertos excluyendo `entregado` y `cancelado`,
> etiquetas que `shipment_status` no tiene. Postgres rechazaba la consulta, el
> modal se tragaba el error y decía «No hay embarques activos». Se corrige a
> `delivered`/`cancelled`, tipado, y se excluyen los eliminados. Sin migración.

## Contexto

`GenerateBLModal` (`app/studio/_components/wiring/GenerateBLModal.tsx`, SDD-0034,
commit `596763ef` del 2026-05-26) se abre desde Documentos con el botón
«Generar BL» (`DocumentosHubClient.tsx` → `openGenerateBLModal`). Su paso 1 es
un selector de embarques que se llena desde el navegador:

```ts
supabase.from("shipments")
  .select("id, code, client_name, destination")
  .not("status", "in", "(entregado,cancelado)")
  .order("created_at", { ascending: false })
  .limit(50);
```

El enum `shipment_status` (`supabase/migrations/0002_shipments.sql:15-29`) tiene
13 etiquetas, todas en inglés: `draft`, `in_warehouse`, `consolidating`,
`shipped`, `in_transit`, `in_customs`, `arrived_destination`,
`delayed_warehouse`, `out_for_delivery`, `last_mile`, `delivered`, `exception`,
`cancelled`. Ninguna migración posterior lo altera: no hay `alter type …
shipment_status` ni cambio de tipo de la columna.

PostgREST traduce `not.in.(entregado,cancelado)` a una comparación contra la
columna, y Postgres tiene que convertir cada literal al enum. `entregado` no
existe, así que la consulta entera falla con **22P02** y PostgREST responde
**400**. El modal hace `if (error || !data) setShipments([])` y muestra «No hay
embarques activos. Crea uno desde Embarques primero.», aunque haya embarques
abiertos. Nadie podía generar un BL desde ese modal.

El mismo modal tampoco excluía eliminados. Desde la
`0230_fix_rls_soft_delete_blocked.sql` la policy de `shipments` no filtra
`deleted_at` (ver SDD-0509), así que, ya corregidas las etiquetas, un embarque
eliminado habría aparecido en el selector.

## Decisión

1. **Etiquetas reales y tipadas.** La lista vive en una constante
   `ESTADOS_SIN_BL: ShipmentStatus[] = ["delivered", "cancelled"]`. El tipo
   `ShipmentStatus` (`lib/shared/shipment-public.ts`) es el espejo del enum: una
   etiqueta que no existe ya no compila.
2. **Se conserva el criterio.** Se excluyen entregados y cancelados, como pedía
   el código original. `draft` sigue ofrecido; si un borrador debe o no admitir
   BL es decisión de producto y no se cambia aquí.
3. **Eliminados fuera, en la consulta.** `.is("deleted_at", null)`, igual que
   SDD-0465, SDD-0494 y SDD-0509. No se toca la RLS.
4. **La consulta se queda en el componente.** `lib/studio/shipment-queries.ts`
   tiene un `listActiveShipments` parecido, pero excluye también `draft`, devuelve
   otras columnas y lo modifica la PR de SDD-0509, todavía abierta. Unificarlos
   sería otro cambio.

## Alcance

Allowlist exacta:

| Archivo | Cambio |
|---|---|
| `app/studio/_components/wiring/GenerateBLModal.tsx` | `ESTADOS_SIN_BL` tipada; `.not("status", "in", …)` con `delivered,cancelled`; `.is("deleted_at", null)` |
| `app/studio/_components/wiring/__tests__/GenerateBLModal.test.tsx` | regresión con un doble que valida las etiquetas contra el enum de las migraciones |
| `docs/specs/0510-generar-bl-envios-enum/evidencia/reproducir-postgrest.mjs` | reproducción contra Postgres y PostgREST efímeros |
| Esta spec, `docs/specs/README.md` y `.agents/handoffs/0510-generar-bl-envios-enum.md` | documentación |

### Lo que NO se toca, a propósito

- **El manejo del error.** El modal sigue convirtiendo cualquier error de la
  consulta en «No hay embarques activos». Con las etiquetas corregidas ese camino
  sólo se recorre por red o permisos, pero el mensaje sigue mintiendo. Es una no
  conformidad con ERR-01 (nivel Sistema: mensaje recuperable) preexistente; va en
  FUERA DE ALCANCE del handoff.
- **El BL sigue siendo simulado.** El paso 2 inventa un código y el «PDF» es un
  `alert` (V1 de SDD-0034). No cambia.
- **`listActiveShipments`** y el resto de lectores de `shipments` son de SDD-0509.

## Aceptación

> **`status: in-progress` a propósito.** Los criterios 1-5 tienen evidencia
> (prueba con mutantes, `tsc` y diff). `pnpm verify` está **NO EJECUTADO**: el
> turno pedido al Director el 2026-10-14 expiró sin entregarse.

1. Con embarques abiertos y vivos, el selector los ofrece, del más reciente al
   más viejo.
2. No ofrece embarques entregados, cancelados ni eliminados, aunque sean los más
   recientes.
3. Sin embarques abiertos y vivos, muestra «No hay embarques activos».
4. Una etiqueta que no está en `shipment_status` no compila (`ShipmentStatus`).
5. Sin migración, sin cambio de policies, sin cambio en
   `supabase/migrations-baseline.json`.

## Evidencia

**Reproducción local, nunca producción.**
`node docs/specs/0510-generar-bl-envios-enum/evidencia/reproducir-postgrest.mjs`
levanta `postgres:17` en una red `--internal` y `postgrest/postgrest:v16.1`
publicado sólo en `127.0.0.1`, crea el enum copiándolo de la 0002, siembra un
embarque abierto, uno entregado, uno cancelado y uno eliminado, y corre con la
supabase-js del repo la cadena de main y la corregida. Corrida del 2026-10-14
03:17 UTC:

```text
enum shipment_status (0002): draft, in_warehouse, consolidating, shipped, in_transit, in_customs, arrived_destination, delayed_warehouse, out_for_delivery, last_mile, delivered, exception, cancelled
migraciones que alteran el enum después: ninguna
A · main      (entregado,cancelado): {"status":400,"error":{"code":"22P02","message":"invalid input value for enum shipment_status: \"entregado\""},"codes":null}
B · corregida (delivered,cancelled) + deleted_at: {"status":200,"error":null,"codes":["BL-VIVO"]}
A reproduce el error del enum: SÍ
B devuelve sólo el embarque vivo y abierto: SÍ
```

Salió 0 y no dejó contenedores ni redes. **Producción: NO VERIFICADO.** No se
leyó el enum ni filas en producción; que el enum vivo sea el de las migraciones
es inferencia de que ninguna lo altera.

**El doble.** `GenerateBLModal.test.tsx` lee las etiquetas del enum de las
migraciones (el `create type` más cualquier `add value`/`rename value`
posterior) y, si un filtro sobre `status` usa un valor fuera del enum, responde
como el PostgREST de la reproducción: 400, 22P02, `data: null`. Aplica de verdad
`eq/in/not.in/is`, ordena, corta, devuelve copias con sólo las columnas del
`select` y lanza si se filtra antes de `select()`. El fixture es infeliz: el
entregado, el cancelado y el eliminado son los más recientes.

**Mutantes.** Seis pruebas; el control sin mutar da 6 verdes. Cada mutante
reemplaza un patrón que aparece una sola vez en el archivo y se restaura al
final (verificado byte a byte):

| Mutante | Resultado |
|---|---|
| M0 · el `GenerateBLModal.tsx` de `origin/main` (`c80eea64`) | MUERE · 2 rojos |
| M1 · `["entregado", "cancelado"]` en la lista | MUERE · 2 rojos |
| M2 · sin `.is("deleted_at", null)` | MUERE · 2 rojos |
| M3 · sólo `delivered` | MUERE · 2 rojos |
| M4 · sólo `cancelled` | MUERE · 2 rojos |
| M5 · sin el `.not("status", …)` | MUERE · 2 rojos |

M0 es el rojo contra main: cae «con sólo embarques abiertos, la consulta no
falla y los ofrece», que es el defecto reportado aislado, y «ofrece sólo los
embarques vivos y abiertos».

**El mutante del doble.** Con el código de main y el doble SIN validar el
enum, la prueba aislada **pasa**: un doble que acepta cualquier etiqueta no ve
el selector vacío. Lo que la hace caer es la validación, y la prueba de control
«la cadena que tenía el modal da 22P02» es la que se pone roja si alguien la
quita del doble.

**Tipado.** Con `ShipmentStatus[]`, una etiqueta en español es un error de
`tsc`: `["entregado", "cancelado"]` da TS2322, y forzarlo con
`as ShipmentStatus[]` da TS2352 (comprobado con el `tsc` del repo sobre un
archivo de sonda, borrado después). El mutante M1 corre igual porque Vitest
transpila sin comprobar tipos: en `pnpm verify` lo frenaría el paso
`typecheck`, antes que la prueba.

## Riesgos y límites

- **Es lectura.** No cambia datos, policies ni migraciones.
- **Comportamiento visible.** Quien abra «Generar BL» con embarques abiertos va
  a ver el selector lleno por primera vez desde SDD-0034. El BL que genera sigue
  siendo simulado.
- **El enum en producción no se leyó.** Si alguien lo hubiera alterado a mano
  fuera de las migraciones, la reproducción no lo vería.

## Cierre (2026-10-14)

Este cierre reemplaza la nota de `status: in-progress` de «Aceptación».

- **CI.** PASÓ (11m51s).
- **`pnpm verify` local:** NO EJECUTADO, por decisión de Sam. Literal: «ok,
  fusiona la #204 así».
- **Merge.** PR #204, merge `4328f4fa` a las 03:47:33Z, con
  `--match-head-commit fb57a898`.
- **Deploy** a las 03:49:23Z.
- **Smoke.** PASÓ, Sam. Literal: «Aprobado, funciona el Generar BL».
