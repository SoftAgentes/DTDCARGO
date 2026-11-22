# Handoff · SDD-0690 · `--excluir-markbox` en el generador de consolidados

- Owner: Worker (sesión `worker-excluir-markbox`), encargo de Dir_DTD, 2026-11-21.
- Ruta: `.claude/worktrees/jovial-dubinsky-733c79` · rama `claude/jovial-dubinsky-733c79` · base `main`.
- PR: #750.
- SDD: 0690 (sin número nuevo; extiende `--solo-facturas`).
- Carril: **revisión previa** (toca facturación: pre-órdenes y sus montos).
- Permisos del encargo: push de la rama y PR, sí; merge, no. Producción, VPS y Supabase Cloud, no.

## OBJETIVO ORIGINAL

Una opción del generador para dejar fuera del lote los envíos de uno o varios Shipping Marks. El caso es el 64, «camino A, cargar hoy sin el comodín» (Sam): hoy se cargan las pre-órdenes de los clientes reales, y los envíos que siguen en `DTD-0000` van en un lote chico después de reasignarlos.

## COMPLETADO

- `scripts/consolidados/modelo.ts`:
  - `normalizarExclusiones` pone la lista en mayúsculas, sin repetidos y ordenada. Solo acepta códigos `PREFIJO-NNNN`.
  - `markboxDelCliente` devuelve el Shipping Mark del `--mapa`, o la clave si no está mapeado.
  - `agruparLote` recibe `excluirMarkbox` (desde la ronda 2; antes era `excluirPorMarkbox`, aplicado después):
    - descarta cada fila cuyo Shipping Mark (mapa o clave) está en la lista, **antes de agrupar y antes de dar sus avisos**;
    - deja `lote.excluidos` con los markbox, los conteos y los códigos de los envíos excluidos;
    - la fila de totales del Excel se compara con el contenedor completo, que es lo que entra más lo excluido;
    - falla si un markbox de la lista no tiene clientes, o si el lote queda vacío.
- `scripts/consolidados/lote-sql.ts`:
  - `OpcionesSql.excluirMarkbox`.
  - `idDelPaquete` cambia la huella cuando hay exclusiones: `carga-consolidado:N:<sha256(id de la carga + lista)[0..8]>:facturas`. Conserva la forma que acepta `aplicar-lote.sh` (`^carga-consolidado:[0-9]+:[0-9a-f]+(:facturas)?$`), así que el guion del VPS no se toca.
  - El cuerpo de `--solo-facturas` con exclusiones:
    - el `NOTICE` nombra el id nuevo;
    - **guarda 1:** aborta si un envío que entra está hoy en un markbox excluido;
    - **guarda 2 (M1):** aborta si un envío excluido está hoy, en el contenedor, en un Shipping Mark que no es de la lista (ya reasignado).
  - La previa agrega `=== excluidos por markbox: N` con 6 columnas. `excluidos_en_otro_markbox` e `incluidos_en_markbox_excluido` tienen que dar **0**.
  - El manifiesto lleva `excluidos` con los markbox, los conteos y el motivo, **sin** los códigos de los envíos. La cabecera de cada `.sql` también lo dice.
  - `generarSql` rechaza la opción sin `--solo-facturas`, y también un lote que no se filtró con la misma lista.
- `scripts/consolidados/generar-lote.ts`: `--excluir-markbox` es repetible y acepta comas. Solo va con `--solo-facturas`. Lo reportan el resumen impreso, `resumen.md` y el manifiesto.
- Pruebas:
  - `consolidados-excluir-markbox.test.ts`: exclusión, mapa, varias marcas, errores, avisos con cifras filtradas (B2), huella, las dos guardas, previa, resumen, «sin la opción no cambia nada» y el parser.
  - `consolidados-solo-facturas-pglite.test.ts`: 5 casos de exclusión en PGlite:
    - no sale pre-orden del comodín;
    - la guarda 1 aborta;
    - M1, el reasignado a un dueño con envíos que entran: aborta;
    - M1, el reasignado a otro cliente: aborta;
    - B1: la previa corre de verdad y devuelve los 6 números en dos escenarios.
- `docs/runbooks/cargar-consolidados.md`: la opción, la tabla de columnas de la previa con la regla «tiene que dar 0», las dos guardas, el ejemplo del 64, el lote chico de después, la nota de `deshacer`/`purgar` (B3) y la fila de pruebas.

## Ronda 2 · revisión de la #750 sobre `5e3da1537`

- **M1 (bloqueaba), resuelto.** Escenario: un envío excluido por el mapa ya se reasignó en la base a un cliente M que también tiene envíos que entran. Antes, M recibía una pre-orden sin ese envío, `verificar` daba PASÓ y el lote chico se saltaba a M. Ahora la guarda 2 aborta `aplicar` y `simulacro`, y la previa lo muestra en `excluidos_en_otro_markbox`. Hay prueba PGlite de los dos casos: M tiene envíos que entran, y M no los tiene.
- **B1, resuelto.** La consulta de la previa corre en PGlite y devuelve los 6 números en dos escenarios. Los mutantes `in`/`not in` de cada columna mueren (lista abajo).
- **B2, resuelto.** La exclusión pasa adentro de `agruparLote`. Los excesos de peso, la diferencia contra el TOTAL FACTURADO y los remitentes corregidos ya no ven las filas excluidas. La fila de totales del Excel se compara con el contenedor completo, y su aviso lo dice. Hay prueba.
- **B3 (informativa), anotada.** Va en el runbook y aquí, en «Fuera de alcance».

## VALIDACIÓN

Ronda 2, con el turno de PC de Dir_DTD, en este worktree, el 2026-11-21:

- Vitest de los 6 archivos `scripts/__tests__/consolidados-*`: **PASÓ, 104 de 104**. De esos, 30 son de `excluir-markbox` y `solo-facturas-pglite`.
- `tsc --noEmit -p .`: PASÓ (código de salida 0).
- **Byte a byte contra `origin/main`.** Comparé el `generarSql` de main con el de la rama, con reloj fijo y datos sintéticos, en 5 variantes:
  - producción `--solo-facturas`;
  - producción `--solo-facturas --sin-exceso-peso`;
  - producción, carga completa;
  - prueba con `--crear-clientes-faltantes`;
  - prueba con `--sin-facturas`.

  Los datos ahora incluyen un remitente que se corrige (`_` → `-`) y una fila de totales que no cuadra, para cubrir el orden de avisos que cambió en `agruparLote`. Resultado: **IGUAL en las 5**. Control: con un cambio plantado, las 5 salen DISTINTO. El guion está fuera del repo, en el scratchpad de la sesión (`byte-compare.mts`).
- **Mutantes.** Con cada uno fallan pruebas, y con la base limpia pasan 30 de 30:

  | Mutante | Fallan |
  |---|---|
  | la exclusión no saca filas | 17 |
  | no cuenta las claves excluidas | 4 |
  | guarda 1 vacía (`select 0`) | 2 |
  | M1: guarda 2 con la condición al revés | 3 |
  | M1: guarda 2 vacía | 4 |
  | la huella no cambia | 1 |
  | B1: `in` → `not in` en `excluidos_hoy_en_markbox_excluido` | 1 |
  | B1: `in` → `not in` en `excluidos_en_otro_markbox` | 1 |
  | B1: `excluidos_en_otro_markbox` mira el markbox excluido | 1 |
  | B1: `in` → `not in` en `incluidos_en_markbox_excluido` | 1 |
  | B1: `not in` → `in` en `otros_del_contenedor_en_markbox_excluido` | 1 (en la primera corrida sobrevivía; se reforzó el escenario con un segundo envío ajeno en el comodín) |
  | B2: la fila de totales se compara con lo filtrado | 1 |

- `pnpm verify`: NO EJECUTADO en local. El cambio es solo de `scripts/consolidados`, sus pruebas y documentación, y el portón es el CI de la PR.
- `infra/ops/tests/prueba-aplicar-lote.sh`: NO APLICA, porque `aplicar-lote.sh` no cambió.
- `node scripts/carril.mjs`: **revisión previa**.

## PENDIENTES DE ESTA TAREA

- La re-revisión independiente y el CI verde en la cabeza nueva. Los lanza el Director.

## FUERA DE ALCANCE DETECTADO

- **El lote chico no completa a un cliente que ya tiene pre-orden.** `--solo-facturas` es idempotente por cliente: se salta a un cliente si una factura viva cubre cualquiera de sus envíos del contenedor. Si un envío del comodín se reasigna el lunes a un cliente que ya tiene pre-orden del paquete de hoy, el lote chico se lo salta y ese envío queda sin línea. Hay que agregarlo a mano en Facturación, o hacer una extensión que agregue líneas a un borrador. Está anotado en el runbook. La decisión es del Director o de Sam.
- **B3: `deshacer` y `purgar` (solo prueba) no distinguen los paquetes de una misma carga.** Filtran por el id de la carga y `MARCA_SOLO_FACTURAS`, no por el id del paquete. Con dos paquetes, deshacer uno se lleva los borradores del otro. En producción no aplica, porque el paquete no los trae. Está anotado en el runbook.
- `aplicar-lote.sh` no cambió: el id nuevo ya cumple su expresión regular.

## HANDOFF AL DIRECTOR

1. Genera el lote con el ejemplo del runbook (§2b, «Dejar fuera los envíos de un Shipping Mark») y anota el id nuevo que sale en la primera línea.
2. Comprueba que `excluidos por markbox:` diga los envíos del comodín.
3. En la previa, `excluidos_en_otro_markbox` e `incluidos_en_markbox_excluido` tienen que dar **0**. Si alguna no da 0, `aplicar` aborta: revisa el mapa contra la base y vuelve a generar.
4. El OK de Sam tiene que citar el id nuevo y la palabra «pre-órdenes».
