# Handoff · SDD-0690 · `--solo-markbox` + `--agregar-a-preorden` (el lote chico del comodín)

- Owner: Worker (sesión `worker-agregar-a-preorden`), encargo de Dir_DTD, 2026-11-21. Sam lo pidió literal: «Sí, prepáralo hoy».
- Ruta: `DTD-worktrees/sdd-0690-agregar-a-preorden` · rama `codex/sdd-0690-agregar-a-preorden` · base `origin/main` `f67daa778`.
- SDD: 0690 (extiende `--solo-facturas` y `--excluir-markbox`, #750).
- Carril: **revisión previa** (toca facturación: líneas y montos de pre-órdenes).
- Permisos del encargo: rama, push y PR, sí; merge, no. Producción, VPS y Supabase Cloud, no.

## OBJETIVO ORIGINAL

Hoy se aplicó en producción el lote `carga-consolidado:64:cd4a6378:facturas`, con `--excluir-markbox DTD-0000`: 39 pre-órdenes para 88 envíos. El lunes la oficina reasigna los 23 envíos del comodín, y varios de esos clientes ya tienen pre-orden. Con `--solo-facturas` el lote chico los saltaría por idempotencia y el envío quedaría sin facturar. Hace falta un modo que:
- agregue las líneas a la pre-orden borrador del cliente;
- cree la pre-orden si el cliente no tiene;
- aborte si la pre-orden ya no está en borrador.

## COMPLETADO

- **`modelo.ts`:** `agruparLote` recibe `soloMarkbox`, lo contrario de `excluirMarkbox`. Entran solo las filas cuyo Shipping Mark (mapa o clave) está en la lista. Deja `lote.seleccion` con conteos y un aviso sin montos. No va junto con `excluirMarkbox`, y falla si un markbox de la lista no tiene clientes.
- **`lote-sql.ts`:**
  - `OpcionesSql.soloMarkbox` y `agregarAPreorden`. `generarSql` exige `--solo-facturas`, las dos juntas, sin `--excluir-markbox` y con un lote filtrado con la misma lista.
  - **Id propio:** `carga-consolidado:N:<sha256(id de la carga + "--agregar-a-preorden --solo-markbox " + lista)[0..8]>:facturas`. Es distinto del de la carga, del paquete completo y del de `--excluir-markbox`. Conserva la forma que acepta `aplicar-lote.sh`, así que el guion del VPS no se toca.
  - **`cuerpoAgregar`:** reutiliza el preflight de `--solo-facturas` hasta el bucle (contenedor, lista exc0674, envíos cargados y vigentes, Shipping Mark, líneas colgadas de envíos cargados).
    - Guardas antes de escribir: envío que sigue en el markbox de origen; envío que ya tiene línea, es el envío o está en los envíos cubiertos de una factura viva (no duplica).
    - Por cliente: aborta si ya está facturado por la 0564/0569 (`exc0674_facturas` vivo), si su pre-orden de la carga no está en borrador o si tiene más de una en borrador.
    - Con una en borrador, le agrega las líneas y recalcula base, IVA y total desde todas las líneas, con `for update` y nota `agregados: … · líneas agregadas aparte (SDD-0690)`. Sin pre-orden, la crea.
    - Auditoría: `invoice_lines_appended` o `invoice_imported`. El trigger 0495 sube `write_version` solo.
  - **`previaAgregar`:** 11 conteos (tabla en el runbook). Las columnas que tienen que dar 0 están marcadas.
  - **`verificarAgregar`:** cada envío tiene todas sus líneas, y solo esas, en una sola factura viva, que es una pre-orden de la carga de su cliente a facturar. En cada pre-orden tocada, base, IVA y total cuadran con la suma de sus líneas.
  - **`deshacerAgregar`:** se niega (no se deshace por partes). El manifiesto lleva `agregarAPreorden` con conteos. La cabecera de los `.sql` lo dice.
- **`generar-lote.ts`:** `--solo-markbox` (repetible, con comas) y `--agregar-a-preorden`, con sus validaciones. Lo reportan la consola y `resumen.md`.
- **Pruebas:** `scripts/__tests__/consolidados-agregar-preorden-pglite.test.ts` (nueva, 15 casos). Corre el paquete de hoy y después el lote chico en PGlite, con el esquema mínimo más `exc0674_facturas`.
- **Runbook** `cargar-consolidados.md`: el modo, las guardas, la tabla de la previa, la receta del lunes para el 64 y la fila de pruebas.

## VALIDACIÓN

Con el turno de PC de Dir_DTD, en este worktree, el 2026-11-21:

- `pnpm install --frozen-lockfile`: PASÓ.
- Vitest de los 7 archivos `scripts/__tests__/consolidados-*`: **PASÓ, 119 de 119** (15 nuevos).
- `tsc --noEmit -p .`: PASÓ. eslint: 0 errores. Quedan 3 avisos que ya estaban en main.
- **Byte a byte contra `origin/main` `f67daa778`.** Comparé el `generarSql` de main con el de la rama, con reloj fijo y datos sintéticos (con remitente corregido y fila de totales), en 6 variantes. Las 6 salen **IGUAL**:
  - `--solo-facturas`, con y sin exceso de peso;
  - `--solo-facturas --excluir-markbox DTD-0000`;
  - carga completa en producción;
  - prueba con `--crear-clientes-faltantes`;
  - prueba con `--sin-facturas`.

  Control: con un cambio plantado salen DISTINTO. El guion está fuera del repo, en el scratchpad de la sesión (`byte-compare.mts`). En el repo, la prueba «sin las opciones nuevas…» compara la rama consigo misma.
- **Mutantes** sobre la prueba nueva. Con cada uno fallan pruebas, y con la base limpia pasan 15 de 15:
  - guarda de origen vacía;
  - guarda de duplicados sin mirar las líneas;
  - no mira si la pre-orden sigue en borrador;
  - no mira `exc0674_facturas`;
  - reemplaza las líneas en vez de agregarlas;
  - recalcula solo con las líneas nuevas;
  - destino sin filtrar por cliente;
  - huella igual a la de `--excluir-markbox`;
  - previa: `a_preorden_existente` mira lo que no es borrador;
  - previa: `a_preorden_nueva` al revés (en la primera corrida sobrevivía; agregué el caso con dos envíos a un cliente sin pre-orden y la aserción en la segunda corrida);
  - verificar no mira el total;
  - verificar no mira el cliente;
  - `--solo-markbox` no filtra.
- `pnpm verify`: NO EJECUTADO en local. El portón es el CI de la PR.
- `infra/ops/tests/prueba-aplicar-lote.sh`: NO APLICA, porque `aplicar-lote.sh` no cambió.

## PENDIENTES DE ESTA TAREA

- La revisión independiente y el CI verde en la cabeza de la PR. Los lanza el Director.

## FUERA DE ALCANCE DETECTADO

- **El sufijo es `:facturas`, no `:facturas-agregar`.** El Director lo propuso «por ejemplo». Un sufijo nuevo obliga a cambiar la expresión regular de `aplicar-lote.sh` (`^carga-consolidado:[0-9]+:[0-9a-f]+(:facturas)?$`) y a publicar el guion en el VPS antes del lunes. La huella propia ya separa el paquete para la idempotencia y para el OK. Si se quiere el sufijo, es una PR aparte de `infra/ops`.
- **Las pre-órdenes de `--solo-facturas` no llenan `exc0674_factura_envios`.** Eso lo hace la emisión (0569). La guarda de duplicados mira las tres vías: `shipment_id`, envíos cubiertos y `lines[].shipmentCode`.
- **`deshacer`/`purgar` en prueba** siguen sin distinguir paquetes de una misma carga (B3 de la #750).

## HANDOFF AL DIRECTOR

1. Genera el paquete con la receta del runbook (§2b, «Agregar los envíos reasignados…») después de que la oficina reasigne. Anota el id que sale en la primera línea.
2. En la previa, las columnas marcadas tienen que dar **0**. Si `siguen_en_markbox_de_origen` no da 0, falta reasignar; no hace falta regenerar.
3. El OK de Sam tiene que citar ese id y la palabra «pre-órdenes».
