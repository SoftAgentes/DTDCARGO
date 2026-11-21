# Handoff · SDD-0690 · `--excluir-markbox` en el generador de consolidados

- Owner: Worker (sesión `worker-excluir-markbox`), encargo de Dir_DTD, 2026-11-21.
- Ruta: `.claude/worktrees/jovial-dubinsky-733c79` · rama `claude/jovial-dubinsky-733c79` · base `main`.
- SDD: 0690 (sin número nuevo; extiende `--solo-facturas`).
- Carril: **revisión previa** (toca facturación: pre-órdenes y sus montos).
- Permisos del encargo: push de la rama y PR, sí; merge, no. Producción, VPS y Supabase Cloud, no.

## OBJETIVO ORIGINAL

Una opción del generador para dejar fuera del lote los envíos de uno o varios Shipping Marks. El caso es el 64, «camino A, cargar hoy sin el comodín» (Sam): hoy se cargan las pre-órdenes de los clientes reales, y los envíos que siguen en `DTD-0000` van en un lote chico después de reasignarlos.

## COMPLETADO

- `scripts/consolidados/modelo.ts`:
  - `normalizarExclusiones` pone la lista en mayúsculas, sin repetidos y ordenada. Solo acepta códigos `PREFIJO-NNNN`.
  - `markboxDelCliente` devuelve el Shipping Mark del `--mapa`, o la clave si no está mapeado.
  - `excluirPorMarkbox` saca los clientes, envíos, filas y líneas, y recalcula `totales`. Deja `lote.excluidos` (conteos) y un aviso sin montos. Falla si un markbox de la lista no tiene clientes en el lote, o si el lote queda vacío.
- `scripts/consolidados/lote-sql.ts`:
  - `OpcionesSql.excluirMarkbox`.
  - `idDelPaquete` cambia la huella cuando hay exclusiones: `carga-consolidado:N:<sha256(id de la carga + lista)[0..8]>:facturas`. Conserva la forma que acepta `aplicar-lote.sh` (`^carga-consolidado:[0-9]+:[0-9a-f]+(:facturas)?$`), así que el guion del VPS no se toca.
  - Cuerpo de `--solo-facturas` con exclusiones:
    - el `NOTICE` nombra el id nuevo, porque `aplicar-lote.sh` lo busca en la evidencia del simulacro;
    - una guarda aborta si un envío que entra está **hoy** en un markbox excluido.
  - La previa agrega `=== excluidos por markbox: N`, con `excluidos_por_markbox`, `excluidos_hoy_en_markbox_excluido` e `incluidos_en_markbox_excluido`.
  - El manifiesto lleva `excluidos` (markbox, conteos y motivo), y la cabecera de cada `.sql` lo dice.
  - `generarSql` rechaza la opción sin `--solo-facturas`, y también un lote que no se filtró con la misma lista.
- `scripts/consolidados/generar-lote.ts`:
  - `--excluir-markbox` es repetible y acepta comas. Solo va con `--solo-facturas`: en una carga completa, esos envíos no entrarían al contenedor.
  - Lo reportan el resumen impreso, `resumen.md` y el manifiesto.
- Pruebas:
  - `scripts/__tests__/consolidados-excluir-markbox.test.ts` (nueva): exclusión, mapa, varias marcas, errores, huella, guarda, previa, resumen, «sin la opción no cambia nada» y el parser.
  - `consolidados-solo-facturas-pglite.test.ts`: 2 casos en PGlite. Uno comprueba que no sale pre-orden del comodín y que el aviso lleva el id nuevo. El otro, que la guarda aborta sin escribir.
- `docs/runbooks/cargar-consolidados.md`: la opción, el ejemplo del 64, el lote chico de después y la fila de pruebas.

## VALIDACIÓN

Se corrió con el turno de PC de Dir_DTD, en este worktree, el 2026-11-21.

- `pnpm install --frozen-lockfile`: PASÓ.
- Vitest de los 6 archivos `scripts/__tests__/consolidados-*` (modelo, excel, sql, previa-corte, solo-facturas-pglite y excluir-markbox): **PASÓ, 99 de 99**. De esos, 25 son de `excluir-markbox` y `solo-facturas-pglite`, y salen listados uno por uno en `--reporter=verbose`.
- `tsc --noEmit -p .`: PASÓ (código de salida 0).
- `eslint` de `scripts/consolidados` y de las dos pruebas: 0 errores. Quedan 3 avisos `_c/_e/_a` en `generar-lote.ts:342`, que ya estaban en main y no son de esta tarea.
- **Byte a byte contra `origin/main`:** el `generarSql` de main y el de la rama, con reloj fijo y datos sintéticos, en 5 variantes. Las variantes: producción `--solo-facturas`, producción `--solo-facturas --sin-exceso-peso`, producción con la carga completa, prueba con `--crear-clientes-faltantes` y prueba con `--sin-facturas`. Resultado: **IGUAL en las 5**, con el mismo sha de todo el `SalidaSql`. Control: con un cambio plantado en la rama (`vessel`), las 5 salen DISTINTO, así que el comparador sí mira. El guion está fuera del repo, en el scratchpad de la sesión (`byte-compare.mts`).
- **Mutantes** sobre `excluir-markbox` y `solo-facturas-pglite`. Con cada mutante fallan pruebas y con la base limpia pasan 25 de 25:
  - los envíos excluidos se quedan en el lote: 7 fallan;
  - los clientes excluidos se quedan con sus líneas: 9 fallan;
  - la guarda SQL no mira nada (`select 0`): 2 fallan, el texto y PGlite;
  - la huella no cambia: 1 falla.
- `pnpm verify`: NO EJECUTADO en local. El cambio es solo de `scripts/consolidados`, sus pruebas y documentación, y el portón es el CI de la PR.
- `infra/ops/tests/prueba-aplicar-lote.sh`: NO APLICA, porque `aplicar-lote.sh` no cambió. Que el id nuevo cumple su expresión regular lo prueba la unidad.
- `node scripts/carril.mjs`: **revisión previa** (3 de 7 archivos son de consolidados).

## PENDIENTES DE ESTA TAREA

- La revisión independiente y el CI verde en la cabeza de la PR. Los lanza el Director.

## FUERA DE ALCANCE DETECTADO

- **El lote chico del lunes no completa a un cliente que ya tiene pre-orden.** `--solo-facturas` es idempotente por cliente: se salta a un cliente si una factura viva cubre *cualquiera* de sus envíos del contenedor. Si un envío del comodín se reasigna a un cliente que ya tiene pre-orden del paquete de hoy, el lote chico se salta a ese cliente y ese envío queda sin línea. Habría que agregárselo a mano en Facturación, o hacer una extensión que agregue líneas a un borrador. Lo anoté en el runbook. La decisión es del Director o de Sam.
- `aplicar-lote.sh` no cambió: el id nuevo ya cumple su expresión regular.

## HANDOFF AL DIRECTOR

1. Genera el lote con el ejemplo del runbook (§2b, «Dejar fuera los envíos de un Shipping Mark») y anota el id nuevo de la primera línea.
2. Comprueba que `excluidos por markbox:` diga los envíos del comodín.
3. En la previa, `incluidos_en_markbox_excluido` tiene que dar 0.
4. El OK de Sam tiene que citar ese id nuevo y la palabra «pre-órdenes».
