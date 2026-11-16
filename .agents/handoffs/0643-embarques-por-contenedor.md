# Handoff — SDD-0643 · Embarques por contenedor

Fecha: 2026-11-16.

Worker: Claude, en una sesión hija del Subdirector Portal («Portal del cliente»). El DG revisa y fusiona.

- **Rama:** `claude/0643-embarques-por-contenedor-b96f26`, en el worktree `.claude/worktrees/0643-embarques-por-contenedor-b96f26`. Nació en `cacec906b` (main).
- **Spec:** [`docs/specs/0643-embarques-por-contenedor/spec.md`](../../docs/specs/0643-embarques-por-contenedor/spec.md), en estado `in-progress`.
- **Reserva:** `node scripts/next-number.mjs --reserve embarques-por-contenedor --number 0643`. Se publicaron los dos refs, `codex/sdd-reserve-0643-embarques-por-contenedor` y `refs/dtd/reservations/0643`, ambos en `ebc95da8a`, y el stub se trajo a la rama con cherry-pick.

## OBJETIVO ORIGINAL

Pedido de Sam (2026-11-16): que `/studio/embarques` empiece por los contenedores, siga con los clientes de cada contenedor y termine en los embarques de cada cliente. Lleva dos filtros:

- cliente, por nombre o por Shipping Mark;
- contenedor, por número ISO o por número DTD.

Más tarde Sam pidió «FCL 63» y «DDP 64», y aclaró que el 63 es de un solo cliente con varios embarques adentro.

## COMPLETADO

- **Nivel 1, contenedores.** Cada cabecera muestra:
  - nombre («FCL 63», «DDP 64», o «Contenedor NN» si no lleva DDP);
  - número ISO, estado, naviera, ETA y ref;
  - conteos de clientes, envíos, alertas y m³.

  «Sin contenedor» va al final. Dentro de cada contenedor sigue el acordeón por cliente de la SDD-0012, con tabs, adjuntos, borrado y drawer sin cambios.
- **Filtros nuevos.** «Contenedor» busca el número DTD exacto, o parte del ISO o de la ref. «Cliente» busca por nombre (sin acentos) o por Shipping Mark. «Buscar» se queda como estaba.
- **FCL o consolidado.** Se deduce de los embarques que lleva, porque no hay una columna que lo diga. El número DTD se lee de `consolidations.notes`, también por falta de columna. Las dos reglas están en la spec, §3.3 y §3.4.
- **Lectura de datos.** Son cuatro lecturas con la sesión del usuario y su RLS (migr 0096), de 100 en 100 ids:
  - `consolidation_items`;
  - `consolidations` vivas;
  - `sailings`;
  - `carriers`.

  Sin migración y sin service_role. Si una lectura falla, la vista lo avisa y agrupa solo por cliente.
- **Tope de la lista.** `listShipments` acepta `opts.limit`, y Embarques pide 500 (antes eran 100) para no cortar un consolidado. Si se llega al tope, la vista lo avisa.
- **`/ui-check`.** Encontró que la cabecera del contenedor no tenía hover y que el foco quedaba recortado por `overflow: hidden`. Está corregido en `ef99adfe3`.

## EVIDENCIA

| Comprobación | Resultado |
|---|---|
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ: sin números repetidos; solo avisos de choques históricos |
| `docs:check` | PASÓ, con el índice regenerado (624 specs) |
| `governance:check` | PASÓ: 29 políticas aprobadas, cápsula vigente |
| `components:check` | PASÓ: CMP-01 válido |
| `pnpm install --frozen-lockfile` | PASÓ, con turno del DG |
| vitest de los dos tests nuevos de `lib/studio/__tests__/embarques-contenedores*` y de `app/studio/(app)/embarques` | PASÓ: 9 archivos, 123 pruebas, incluidas las que ya existían de adjuntos, borrado, «Abrir» y el asistente |
| `pnpm typecheck` | PASÓ |
| eslint de los archivos tocados | PASÓ. El `pnpm lint` completo NO se ejecutó |
| `pnpm verify` | NO EJECUTADO: se consultó al DG, y el CI de la PR lo cubre |
| Prueba visual en el navegador | NO EJECUTADO: el Studio local necesita Supabase con datos; la vista se probó con Testing Library |
| Producción y VPS | No se tocaron |

## PENDIENTES DE ESTA TAREA

- **Rótulo del consolidado.** El DG tiene que confirmar «DDP 64» frente a «Contenedor 64», porque Sam usó las dos formas (spec §1).
- Revisión independiente, que lanza el DG, y CI de la PR.
- La spec queda en `in-progress` y se cierra al fusionar.

## Impacto documental

Solo la spec y el índice de specs. No cambian reglas ni runbooks.

## FUERA DE ALCANCE DETECTADO

- **Columnas en `consolidations`.** Agregar `modalidad` y `numero_dtd` haría exacto lo que hoy se deduce de los servicios y del texto de `notes`. Exige migración y aviso previo al Subdirector Portal.
- **Contenedores sin número.** Los creados a mano en Naviera no llevan «contenedor DTD #NN» en las notas, así que se muestran con el ISO o con la ref.
- **Más de 500 embarques.** Hoy se avisa al llegar al tope; paginar es otra tarea.
