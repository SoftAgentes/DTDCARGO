# Cargar un contenedor en camino desde el packing list (SDD-0543)

Dueño: ingeniería · Estado: vigente · Actualizado: 2026-10-16 · review-by: 2027-01-16

Cómo se lleva al Studio un contenedor que ya zarpó y que el almacén de Yiwu registró en Excel: recepciones en China fechadas un día antes de la carga, consolidación con contenedor, naviera y ETA, un envío por Remitente visible en el Portal del cliente y una factura por cliente en borrador. La spec es [SDD-0543](../specs/0543-consolidados-en-camino/spec.md).

## 0 · Qué sí y qué no

- **Sólo prueba por este runbook.** `aplicar-lote.sh` rechaza cualquier proyecto que no termine en `-staging`. Pasar un lote a la base oficial se decide con Sam y el Director, con OK nominal y otro procedimiento.
- **Sin avisos.** El lote escribe por SQL: ninguna recepción, envío ni factura dispara correos ni push. El aviso `carga_en_camino` existe en el catálogo de reglas y se dispara aparte, con OK de Sam.
- **Nada con nombres en Git ni en la evidencia.** Los Excel, el lote generado (`resumen.md`, `manifiesto.json` y los `.sql` llevan nombres de clientes) y `marcas-mapa.json` viven en `C:\Users\AKX generator\Desktop\DTD-consolidados\<contenedor>\`. En el servidor, la evidencia guarda sólo la salida de psql, los conteos y las huellas.
- Prueba con datos reales corre con la lista de IP de Sam (`entorno-prueba.md` §2.1). Al terminar, el **borrado final** tiene tres partes, todas con evidencia y avisando antes al Director: (1) `purgar` en la base (o reinicio de prueba); (2) borrar el paquete del lote en `/srv/ops/paquetes/` entero, porque todos sus `.sql` (incluido `purgar.sql`), `manifiesto.json` y `resumen.md` llevan nombres reales, con `ls` vacío como prueba; (3) borrar cualquier evidencia que haya quedado con nombres (sólo pasa con paquetes anteriores a la corrección del 2026-10-16: `previa.out` de la v1). La evidencia de las corridas nuevas no lleva nombres y se conserva.

## 1 · Generar el lote (en el checkout, con los Excel en la PC)

```bash
pnpm consolidados:lote -- --rastreo "C:\...\DTD RASTREO DE CONTENEDORES.xlsx" --packing "C:\...\NUEVO FORMATO CONTENEDOR 59.xlsx" --contenedor 59 --eta 2026-10-19 --entorno prueba --crear-clientes-faltantes --salida "C:\Users\AKX generator\Desktop\DTD-consolidados\59\2026-10-16"
```

- `--eta` es obligatoria: el Excel la trae vencida o vacía. `--etd` por defecto es la fecha de carga del rastreo; `--fecha-carga` sólo si el Excel la trae ilegible («13 DE JULIO» no tiene año).
- `--crear-clientes-faltantes` sólo vale con `--entorno prueba`: crea el cliente con la marca y el nombre del Excel (y el aliado raíz si hace falta). Con clientes reales, las marcas que no resuelvan se mapean a mano en `marcas-mapa.json` (`{ "DTD-J031": "DTD-8042" }`) y se pasa con `--mapa`.
- `--sin-facturas` carga sin facturas; `--sin-exceso-peso` no cobra las líneas de «Exceso de peso» (el «TOTAL FACTURADO» del Excel no las incluye: Sam decide).
- Salida: `previa.sql`, `simulacro.sql`, `aplicar.sql`, `verificar.sql`, `deshacer.sql`, `purgar.sql`, `manifiesto.json`, `resumen.md`, `SHA256SUMS`. Leer `resumen.md` entero antes de seguir: trae los conteos, la tabla de clientes y los avisos (remitentes corregidos, embarques sin peso, filas a $0, la fila de totales del Excel que no cuadra).

Idempotencia: el id del lote es `carga-consolidado:<NN>:<sha256 del packing>`; `aplicar.sql` aborta si ya existe el contenedor vivo, un envío con el mismo código, una recepción `WR-C<NN>-…` o facturas del lote. Dos corridas no duplican nada.

## 2 · Subir y aplicar en prueba (en el VPS)

```bash
scp -r "C:\Users\AKX generator\Desktop\DTD-consolidados\59\2026-10-16" root@217.216.54.70:/srv/ops/paquetes/lote-59
/srv/ops/consolidados/aplicar-lote.sh --project dtd-cargo-staging --confirm dtd-cargo-staging --lote /srv/ops/paquetes/lote-59 --paso previa
/srv/ops/consolidados/aplicar-lote.sh --project dtd-cargo-staging --confirm dtd-cargo-staging --lote /srv/ops/paquetes/lote-59 --paso simulacro
/srv/ops/consolidados/aplicar-lote.sh --project dtd-cargo-staging --confirm dtd-cargo-staging --lote /srv/ops/paquetes/lote-59 --paso aplicar
/srv/ops/consolidados/aplicar-lote.sh --project dtd-cargo-staging --confirm dtd-cargo-staging --lote /srv/ops/paquetes/lote-59 --paso verificar
```

- `previa` sólo lee: la tabla de marcas tiene que dar `sin_resolver = 0` (o el lote se generó con `--crear-clientes-faltantes`) y los conflictos `0`.
- `simulacro` corre todo y termina en `ROLLBACK`; su evidencia habilita `aplicar` (sin simulacro PASÓ del mismo lote en la misma base, `aplicar` sale 5).
- `aplicar` es una transacción: si algo falla, psql sale distinto de 0 y no queda nada.
- `verificar` recuenta y compara con el manifiesto; su `NOTICE` dice `verificar: PASÓ …`.
- Evidencia en `/srv/ops/evidencias/lote-<id>-dtd-cargo-staging-<ts>/` (`<paso>.out`, `<paso>.err`, `LOTE.txt` con los conteos, `SHA256SUMS`).
- Para volver atrás: `--paso deshacer --confirm-deshacer <id del lote>` (borrado lógico). Se niega si alguna factura dejó de ser borrador o hay cajas estibadas. Los clientes creados en prueba se conservan y los nombres siguen en la base.
- Para el **borrado definitivo** que pidió Sam (los datos reales salen de prueba con evidencia): `--paso purgar --confirm-purga <id del lote>`. Borra físicamente todo lo que el lote creó, incluidos los clientes y aliados que creó, y termina con conteo cero por lote (`purgar: PASÓ · conteo cero …`). El SQL se niega si no encuentra el cliente sintético de la semilla (o sea, si la base no es la de prueba). Si algo ajeno al lote apunta a sus filas (un reporte de pago o una aceptación hechos en el smoke), la FK lo aborta: entonces se reinicia prueba con `resetear-base-prueba.sh` (`entorno-prueba.md` §5), que también deja evidencia. El log de auditoría es append-only y no lleva nombres: sus filas quedan como registro de la carga y de la purga. Avisar al Director antes de purgar o reiniciar.

## 3 · Qué mirar después (smoke)

| Pantalla | Qué se espera |
|---|---|
| Studio › Almacén CN | las recepciones `WR-C59-…` en `consolidado`, fecha un día antes de la carga, cajas creadas |
| Studio › Naviera | el contenedor `DTD-CONSOL-NNNN` con su número, naviera, ETD/ETA, en `zarpado`, con sus items |
| Studio › Tracking | un envío por Remitente, `in_transit`, con sus eventos fechados el día de carga |
| Studio › Facturación | una factura en borrador por cliente, con una línea por embarque |
| Portal › Envíos | el cliente ve sus envíos agrupados por contenedor con el ETA |
| Portal › Mis facturas | la tarjeta «por aceptar» con el monto; el detalle pide aceptar los T&C; el estado de cuenta avisa lo que falta por entrar |

Para entrar al Portal como uno de los clientes cargados en prueba hay que vincular el usuario sintético del portal a ese cliente (Studio › Clientes › invitar al correo `.test` de la semilla) o crear la invitación desde el Studio de prueba.

## 4 · Pruebas de las piezas

| Comando | Qué cubre |
|---|---|
| `pnpm vitest run scripts/__tests__/consolidados-modelo.test.ts scripts/__tests__/consolidados-excel.test.ts scripts/__tests__/consolidados-sql.test.ts` | lectores de Excel, agrupación, líneas de factura, redondeo como `round(numeric, 2)`, forma de los scripts, preflight y deshacer |
| `bash infra/ops/tests/prueba-aplicar-lote.sh` | guardas de `aplicar-lote.sh` (producción, `-staging`, `--confirm`, SHA256SUMS, entorno), orden simulacro → aplicar, forma de la salida, evidencia sin nombres |
| `pnpm vitest run lib/portal/__tests__/pending-acceptance.test.ts "app/portal/(app)/facturas/[code]/_components/PendingInvoiceGate.test.tsx"` | el Portal: facturas por aceptar y la puerta del detalle |
