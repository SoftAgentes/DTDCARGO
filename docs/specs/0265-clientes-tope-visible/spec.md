---
sdd: 0265
title: El listado de Clientes dice cuántos hay y deja llegar a los que no entran
status: in-progress
author: Claude (ventana 2026-08-14)
created: 2026-08-14
updated: 2026-08-14
supersedes: null
superseded_by: null
related: [0010, 0106, 0246, 0262]
confidencialidad: interna
---

# SDD-0265 · El listado de Clientes dice cuántos hay y deja llegar a los que no entran

## Problema

`listClients` traía 200 filas con `.limit(200)` y la pantalla no lo decía en
ninguna parte. Para el usuario, el catálogo **es** lo que ve.

Medido en producción el 2026-08-14, con autorización del founder (sólo conteos,
ninguna fila de negocio):

| Medida | Valor |
|---|---|
| Filas en `clients` | **451** |
| Las que mostraba la lista | **200** |
| **Inalcanzables al navegar** | **251 — el 56%** |
| Sólo se veía lo creado desde | **2026-06-12** |
| Cliente más viejo (invisible) | 2026-05-24 |
| Tenants | 1 |

Y como el orden es `created_at DESC`, los que desaparecían eran **los más
viejos** — los clientes de más recorrido.

El buscador no alcanzaba a tapar el hueco: `q` viaja en la **misma** query con
el mismo tope, así que una búsqueda con más de 200 coincidencias también
truncaba, y también por lo más viejo.

Lo levantó la [auditoría del módulo](../../design/studio/2026-08-14-auditoria-ui-pro-clientes.md)
(hallazgo 3), que lo dejó abierto a falta de saber cuántos clientes había.

## Decisión

El listado dice la verdad y ofrece traer el resto.

1. **Contador honesto** — «Mostrando 200 de 451 clientes». Con filtros activos
   aclara que el total es el de la búsqueda, no el del catálogo.
2. **"Ver más"** — suma un bloque de `CLIENTS_PAGE` (200) conservando los
   filtros vigentes. El botón dice cuántos faltan de verdad («Ver 51 más»), no
   un bloque redondo.
3. **Techo declarado** — al llegar a `CLIENTS_MAX` (1000) no se ofrece otro
   bloque: se dice que es el máximo y se manda al buscador.

### Por qué 1000 y no "todos"

PostgREST corta en su `max-rows` **sin avisar**. Pedir 5000 devolvería 1000 y la
pantalla mostraría otro número igual de falso — el mismo error que se está
corrigiendo, una capa más arriba. Al tope se le dice tope.

*(Nota medida: hoy ninguna tabla del módulo se acerca a 1000 —`clients` 451,
`client_users` 90, `prealertas` 7—, así que los `.limit(5000)` que hay en
`client-queries.ts` **no están truncando nada todavía**. Se arman al llegar a
1000.)*

### Alcance exacto (allowlist)

| Archivo | Cambio |
|---|---|
| `lib/studio/client-types.ts` | Constantes `CLIENTS_PAGE` y `CLIENTS_MAX` |
| `lib/studio/client-queries.ts` | `construirQuery` compartido · `listClientsPage` nueva · `limite` normalizado en el parser |
| `app/studio/(app)/clientes/page.tsx` | Usa `listClientsPage` y pasa total/límite |
| `app/studio/(app)/clientes/_components/ClientsClient.tsx` | Contador + "Ver más" |

**`listClients` conserva su firma a propósito.** La usan otros **cinco**
consumidores —buscador global, combobox de cédula, Bitácora, CN y el ERP
móvil—. Cambiarles el tipo de retorno para arreglar una pantalla habría metido
el cambio en cuatro módulos que nadie pidió tocar. El `count` tampoco va
siempre: lo paga la query y ellos no lo necesitan.

**Dónde viven las constantes y por qué:** en `client-types.ts`, no en
`client-queries.ts`. El componente client las necesita para armar el "Ver más",
y no puede importar el módulo de queries sin cruzar la frontera server→client
—que el gate vigila con su paso `rsc-boundary`—.

## Gate SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| SGE-00.01 Predecible | `cumple` | "Ver más" sólo agrega filas; no cambia orden, filtros ni selección |
| SGE-00.02 Sin pérdida silenciosa | `no aplica` | No hay trabajo del usuario que perder: es un listado de lectura |
| SGE-00.03 Riesgo ↔ fricción | `cumple` | Acción frecuente y sin riesgo → un clic, sin confirmación (MP-01 no aplica: no muta) |
| SGE-00.04 Auditable | `no aplica` | Lectura sin permanencia |
| SGE-00.05 Permisos y tenant | `cumple` | RLS por `tenant_id` sigue filtrando; el `limite` sólo acota filas, no amplía alcance. `requireModuleView("clients")` intacto |
| SGE-00.06 Prevenir antes de informar | `cumple` | El `limite` de la URL se normaliza antes de la query: basura, negativos y valores gigantes caen al bloque o al techo |
| SGE-00.07 Estado visible y verdadero | `cumple` | **Es el principio que se estaba incumpliendo.** El contador es `role="status"` + `aria-live="polite"`; el total lo cuenta el servidor con los mismos filtros, no `clients.length` |
| SGE-00.08 Frecuencia ↔ pasos | `cumple` | Navegar el catálogo pasa de **imposible** a un clic por bloque. Cero pasos agregados al camino frecuente |
| SGE-00.09 Mismo patrón | `cumple` | Reusa el estado-en-URL + `useTransition` que el módulo ya usaba para filtros; cero primitivas nuevas |
| SGE-00.10 Accesible | `cumple` | El botón es `<button>` nativo con `aria-busy` durante la carga; el contador se anuncia solo al cambiar |
| SGE-00.11 Lenguaje | `cumple` | Dice qué se ve y qué falta; en el techo explica el límite y qué hacer (buscar) en vez de ofrecer un botón que no cumpliría |
| SGE-00.12 IA | `no aplica` | No interviene IA |

Sin `no cumple`. Ningún bloqueador constitucional abierto.

## Verificación

- `pnpm verify` — cierre canónico.
- 13 tests nuevos, **validados con mutación**: quitar el clamp del `limite` tumba
  3 del parser; hacer que "Ver más" arme la URL desde cero tumba el que exige
  conservar los filtros.

## Lo que queda abierto

1. **`listClients` no filtra `deleted_at`** — las otras cinco queries del archivo
   sí. Hoy son 3 filas de 451, y el contador es *consistente* (cuenta lo mismo
   que lista), pero habría que decidir si un cliente fusionado debe aparecer en
   el catálogo. Puede ser deliberado: SDD-0246 conserva la fila soft-deleted
   **como alias** del cliente fusionado. **Es una pregunta, no un bug declarado.**
2. **Paginación real** — se evaluó y se descartó para este slice: con 451
   clientes el bloque incremental alcanza, y la paginación tocaba tabla, query y
   URL. Si el catálogo crece hacia el techo de 1000, se replantea.
3. Los hallazgos 1, 4, 5 y 6 de la auditoría siguen abiertos.
