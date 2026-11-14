# Cargar un contenedor en camino desde el packing list (SDD-0543)

Dueño: ingeniería · Estado: vigente · Actualizado: 2026-11-13 · review-by: 2027-02-13

Cómo se lleva al Studio un contenedor que ya zarpó y que el almacén de Yiwu registró en Excel: recepciones en China fechadas un día antes de la carga, consolidación con contenedor, naviera y ETA, un envío por Remitente visible en el Portal del cliente y una factura por cliente en borrador. La spec es [SDD-0543](../specs/0543-consolidados-en-camino/spec.md).

## 0 · Qué sí y qué no

- **Prueba o producción, cada una con su lote.** `aplicar-lote.sh` acepta un `*-staging` con un lote generado con `--entorno prueba`, y `dtd-cargo` (producción) con un lote generado con `--entorno produccion`. Cualquier otro proyecto o cruce se rechaza. Producción sigue el §2b: OK nominal de Sam por lote y sin borrado.
- **Sin avisos.** El lote escribe por SQL: ninguna recepción, envío ni factura dispara correos ni push. El aviso `carga_en_camino` existe en el catálogo de reglas y se dispara aparte, con OK de Sam.
- **Nada con nombres en Git ni en la evidencia.** Los Excel, el lote generado (`resumen.md`, `manifiesto.json` y los `.sql` llevan nombres de clientes) y `marcas-mapa.json` viven en `C:\Users\AKX generator\Desktop\DTD-consolidados\<contenedor>\`. En el servidor, la evidencia guarda sólo la salida de psql, los conteos y las huellas.
- Prueba con datos reales corre con la lista de IP de Sam (`entorno-prueba.md` §2.1). Al terminar, el **borrado final** tiene tres partes, todas con evidencia y avisando antes al Director: (1) **reiniciar prueba desde la semilla** (`resetear-base-prueba.sh`, `entorno-prueba.md` §5) — decisión del Director del 2026-10-17: `purgar` por lote sirve para rehacer lotes durante las pruebas, no como cierre, porque no borra `entity_audit_log` ni los puertos que crea; (2) borrar el paquete del lote en `/srv/ops/paquetes/` entero, porque todos sus `.sql` (incluido `purgar.sql`), `manifiesto.json` y `resumen.md` llevan nombres reales, con `ls` vacío como prueba; (3) borrar cualquier evidencia que haya quedado con nombres (sólo pasa con paquetes anteriores a la corrección del 2026-10-16: `previa.out` de la v1). La evidencia de las corridas nuevas no lleva nombres y se conserva. El cierre se prueba con conteo cero en las tablas de negocio y en `entity_audit_log` por `correlation_id like carga-consolidado:%`.

## 1 · Generar el lote (en el checkout, con los Excel en la PC)

```bash
pnpm consolidados:lote -- --rastreo "C:\...\DTD RASTREO DE CONTENEDORES.xlsx" --packing "C:\...\NUEVO FORMATO CONTENEDOR 59.xlsx" --contenedor 59 --eta 2026-10-19 --entorno prueba --crear-clientes-faltantes --salida "C:\Users\AKX generator\Desktop\DTD-consolidados\59\2026-10-16"
```

- `--eta` es obligatoria: el Excel la trae vencida o vacía. `--etd` por defecto es la fecha de carga del rastreo; `--fecha-carga` sólo si el Excel la trae ilegible («13 DE JULIO» no tiene año).
- `--crear-clientes-faltantes` sólo vale con `--entorno prueba`: crea el cliente con la marca y el nombre del Excel (y el aliado raíz si hace falta). Con clientes reales, las marcas que no resuelvan se mapean a mano en `marcas-mapa.json` (`{ "DTD-J031": "DTD-8042" }`) y se pasa con `--mapa`.
- `--sin-facturas` carga sin facturas; `--sin-exceso-peso` no cobra las líneas de «Exceso de peso» (el «TOTAL FACTURADO» del Excel no las incluye; Sam decidió no cobrarlo en el 59).
- **Modalidad** (`--modalidad`, por defecto `ddp`): `fcl` = contenedor de un cliente, sólo su envío FCL (`--dueno <marca>`, opcional `--servicio-fcl fcl_directo|fcl_bodega`, `--cbm-fcl`, `--kg-fcl`), sin packing list, sin recepciones ni facturas; `mixto` = FCL de un aliado con nuestros DDP adentro: `--dueno <insignia o marca>` más el packing list de los DDP, y opcionalmente el gasto por el espacio (`--gasto-espacio <USD> --gasto-usuario <correo de un usuario del Studio>`, que se registra en `expenses` colgado del envío FCL). La marca del dueño puede ser la insignia pelada de un aliado (`HR`): en prueba se crea como ficha raíz. `--ignorar-titulo-packing` es sólo para pruebas locales con un packing de otro contenedor como doble.
- Salida: `previa.sql`, `simulacro.sql`, `aplicar.sql`, `verificar.sql`, `deshacer.sql` y `purgar.sql` (solo en prueba: un lote `--entorno produccion` no los trae), `manifiesto.json`, `resumen.md`, `SHA256SUMS`. Leer `resumen.md` entero antes de seguir: trae los conteos, la tabla de clientes y los avisos (remitentes corregidos, embarques sin peso, filas a $0, la fila de totales del Excel que no cuadra).

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
- Un lote generado con `--entorno prueba` **se niega fuera de la base de prueba**: `aplicar`, `simulacro`, `deshacer` y `purgar` buscan el cliente sintético de la semilla y abortan antes de escribir si no está (un psql directo contra `dtd-cargo-db-1` no toca nada). Todos los scripts ponen además `\set VERBOSITY terse`: psql no escribe `DETAIL` con filas (nombres) en la evidencia, y los `raise` del bloque citan etiquetas `PREFIJO-#n`, nunca la clave del Excel.
- `verificar` recuenta y compara con el manifiesto; su `NOTICE` dice `verificar: PASÓ …`.
- Evidencia en `/srv/ops/evidencias/lote-<id>-dtd-cargo-staging-<ts>/` (`<paso>.out`, `<paso>.err`, `LOTE.txt` con los conteos, `SHA256SUMS`).
- Para volver atrás: `--paso deshacer --confirm-deshacer <id del lote>` (borrado lógico). Se niega si alguna factura dejó de ser borrador o hay cajas estibadas. Los clientes creados en prueba se conservan y los nombres siguen en la base. **Después de deshacer no se puede volver a aplicar el mismo lote**: `shipments.code` y `receipt_code` son únicos sin filtro por `deleted_at`, así que los códigos quedan ocupados por las filas borradas; el preflight lo dice con un conteo. En prueba, `purgar` libera los códigos; en otra base lo decide el Director.
- **Orden de la purga: inverso al de la carga** (63 → 62 → 61 → 59). Un lote puede colgar de otro: en prueba el 62 colgó su cliente del aliado raíz `MG` que creó el 61, así que purgar el 61 primero abortaría por la FK `clients.aliado_id`. El preflight de `purgar` lo detecta antes de tocar nada y lo dice con conteos y el id del otro lote («… purga ese lote primero»); también cuando filas de otro lote usan la marca de un cliente creado por este. Por lo mismo, el conteo de «clientes creados» de un lote depende de qué fichas ya existían: el segundo lote de un mismo aliado no vuelve a crear la raíz.
- `purgar` (`--paso purgar --confirm-purga <id del lote>`) borra físicamente todo lo que el lote creó, incluidos los clientes y aliados que creó, y termina con conteo cero por lote (`purgar: PASÓ · conteo cero …`). Sirve para **rehacer un lote durante las pruebas**; no es el cierre de los datos reales (decisión del Director, 2026-10-17): no borra `entity_audit_log` (append-only, migr 0267; las cargas y la purga del 59 dejaron 374 filas sin nombres, 9 con códigos de envío de forma `XX-NN-<texto>`) ni los puertos que el lote crea. El cierre es el reinicio desde la semilla (§0). El SQL se niega si no encuentra el cliente sintético de la semilla (o sea, si la base no es la de prueba). Si algo ajeno al lote apunta a sus filas (un reporte de pago o una aceptación hechos en el smoke), la FK lo aborta: entonces se reinicia prueba con `resetear-base-prueba.sh` (`entorno-prueba.md` §5), que también deja evidencia. El log de auditoría es append-only y no lleva nombres: sus filas quedan como registro de la carga y de la purga. Avisar al Director antes de purgar o reiniciar.

## 2b · Producción (`dtd-cargo`, extensión F2 de la SDD-0543)

**Nada de esto se corre sin el OK nominal de Sam para ese lote.** Antes de pedirlo:

- las marcas tienen que resolver contra los clientes reales (consulta mínima con su propio OK);
- `marcas-mapa.json` tiene que estar al día;
- la previa de producción tiene que estar revisada en la PC: ningún texto con nombre llega al SQL.

1. Genera el lote con `--entorno produccion`. Un lote de producción **nunca crea clientes ni aliados**: el generador no acepta `--crear-clientes-faltantes`, y `aplicar` aborta si una marca no resuelve. Además, la `previa.sql` de producción termina con un corte: si alguna marca no resuelve a un cliente vivo, aborta con el conteo y las etiquetas (`previa: N marca(s) sin resolver…`). Entonces psql sale distinto de 0, el guion sale con 6 y no hay que seguir. Las tablas de marcas quedan impresas en la evidencia antes del corte.
2. Guarda la respuesta **literal** de Sam en `AUTORIZACION.txt`, dentro de la carpeta del lote, después de generar el `SHA256SUMS`. Si prefieres no ponerla ahí, pásala con `--autorizacion <archivo>`. Usa la herramienta de escritura, no un heredoc, como en `aplicar-migraciones-prod.md` §3. El texto tiene que citar **el id completo del lote**, tal como sale en `manifiesto.json` y en el nombre del paquete (`carga-consolidado:63:<hash>`). Un número suelto no basta, porque lo cumplen una fecha o «no autorizo el 63». El id además fija el packing exacto: un OK para un lote no sirve para otro, ni para el mismo contenedor regenerado con otro Excel. Cuando le pidas el OK a Sam, dale el id para que lo repita. Si usas `--autorizacion`, tiene que apuntar a un archivo **fuera** de la carpeta del lote: dentro de ella solo vale `AUTORIZACION.txt`, porque el manifiesto y el resumen citan el id, llevan nombres y se copiarían a la evidencia.
3. Sube la carpeta y corre los pasos de a uno, leyendo la evidencia entre paso y paso:

```bash
/srv/ops/consolidados/aplicar-lote.sh --proyecto dtd-cargo --confirm dtd-cargo --lote /srv/ops/paquetes/lote-61 --paso previa
/srv/ops/consolidados/aplicar-lote.sh --proyecto dtd-cargo --confirm dtd-cargo --lote /srv/ops/paquetes/lote-61 --paso simulacro
/srv/ops/consolidados/aplicar-lote.sh --proyecto dtd-cargo --confirm dtd-cargo --lote /srv/ops/paquetes/lote-61 --paso aplicar
/srv/ops/consolidados/aplicar-lote.sh --proyecto dtd-cargo --confirm dtd-cargo --lote /srv/ops/paquetes/lote-61 --paso verificar
```

- **Sin `AUTORIZACION.txt`, o si no cita el id del lote, cada paso se niega (3), la previa también.** Leer producción también exige permiso. La autorización se copia a la evidencia.
- **La autorización no puede ser un enlace simbólico.** Tiene que ser un archivo regular, por dos razones:
  - La guarda de carpeta resuelve el directorio de la ruta, no el último componente. Un enlace que esté fuera del lote y apunte a su `manifiesto.json`, que cita el id y lleva nombres, pasaría.
  - El destino de un enlace puede cambiar entre el chequeo y el uso.

  El guion copia la autorización una sola vez a un temporal (`cp -P`), y el grep y la evidencia usan esa copia. También rechaza un texto que traiga `"nombreExcel"` o `"lote":`, porque eso es un manifiesto, no el OK de Sam.
- **Un paquete de producción que traiga `deshacer.sql` o `purgar.sql` se rechaza (3).** El generador no los emite para producción: si están, se mezclaron paquetes.
- **Candado.** Simulacro y aplicar (y deshacer y purgar, en prueba) toman `/run/lock/dtd-lotes.lock.d`, o lo que diga `LOTES_CANDADO`. Es un directorio que se crea con `mkdir`, igual que el de migraciones, y evita que dos pasos que escriben corran a la vez: el segundo se niega (3) y el mensaje dice el pid del dueño.
  - Adentro queda `pid` con el dueño. Al salir, también por una señal (HUP 129, INT 130, TERM 143), el guion solo suelta el candado si sigue siendo suyo; nunca suelta uno ajeno.
  - Si quedó de una corrida muerta, comprueba con `ps -o lstart=,args= -p <pid>` que ese pid no existe o que es otro proceso: compara la hora de inicio y el comando con `aplicar-lote.sh`, porque los pid se reciclan. Recién entonces bórralo a mano (`rm -r`).
- Un lote generado para prueba se rechaza en `dtd-cargo`, y uno generado para producción se rechaza en un `*-staging`.
- **Idempotente.**
  - Si ya hay un `aplicar` PASÓ del lote en la evidencia de esa base, el segundo `aplicar` se niega (3) sin tocar la base.
  - Sin esa evidencia, el preflight de `aplicar.sql` encuentra el contenedor o los envíos ya cargados, aborta y psql sale con 6 sin escribir nada.
  - No se repite un `aplicar` que salió con 7: primero se lee la evidencia.
- **Después de una señal (129 HUP, 130 INT, 143 TERM) no se repite el paso**, igual que con 7. Una señal no hace rollback:
  - con TERM, psql puede haber terminado el COMMIT y el guion salir igual con 143;
  - con HUP o INT, el psql del contenedor puede seguir corriendo después de que el guion soltó el candado.

  Antes de cualquier otra cosa:
  1. lee la evidencia del paso (`<paso>.out` y `<paso>.err`);
  2. comprueba que no quede psql vivo en `dtd-cargo-db-1`, con `docker exec dtd-cargo-db-1 ps -o pid,lstart,args -C psql` o con `pg_stat_activity` de solo lectura;
  3. después corre `verificar`, que es de solo lectura, para saber si el lote quedó cargado.
- **`deshacer` y `purgar` están deshabilitados en producción (3)**, aunque vengan confirmados. Además, el paquete de producción **ya no trae** `deshacer.sql` ni `purgar.sql`: el generador no los emite con `--entorno produccion` y se niega a escribir en una carpeta que ya los tenga. Borrar o revertir un lote de la base oficial lo corre Sam, con su propio procedimiento.
- La evidencia queda en `/srv/ops/evidencias/lote-<id>-dtd-cargo-<ts>-<paso>/`, igual que en prueba, más `AUTORIZACION.txt`.
- Un `aplicar` en producción **no publica nada**: el Portal muestra el envío cuando el cliente entra. Los avisos siguen apagados.
- **Después de `verificar` PASÓ, borra el paquete del servidor: `/srv/ops/paquetes/lote-N` entero, con un `ls` vacío como prueba.** El manifiesto, el resumen y los `.sql` llevan nombres y no tienen por qué quedarse en el servidor. Ya no hay un `deshacer.sql` que proteger: desde el seguimiento de la #534, el paquete de producción no lo trae. La evidencia (`/srv/ops/evidencias/`) se queda, porque no lleva nombres. El paquete local, en `DTD-consolidados/<N>/` de la PC, también se queda.

## 3 · Qué mirar después (smoke)

| Pantalla | Qué se espera |
|---|---|
| Studio › Almacén CN | las recepciones `WR-C59-…` en `consolidado`, fecha un día antes de la carga, cajas creadas |
| Studio › Naviera | el contenedor `DTD-CONSOL-NNNN` con su número, naviera, ETD/ETA, en `zarpado`, con sus items |
| Studio › Tracking | un envío por Remitente, `in_transit`, con sus eventos fechados el día de carga |
| Studio › Facturación | una factura en borrador por cliente, con una línea por embarque |
| Portal › Envíos | el cliente ve sus envíos agrupados por contenedor con el ETA |
| Portal › Mis facturas | la tarjeta «por aceptar» con el monto; sin facturas emitidas, el vacío dice «todavía no tienes facturas emitidas» y cuándo entran; el detalle pide aceptar los T&C y, si la factura junta varios embarques, los lista con la medida sumada (no la del primero junto al monto de todos); el estado de cuenta avisa lo que falta por entrar |

Para entrar al Portal como uno de los clientes cargados en prueba hay que vincular el usuario sintético del portal a ese cliente (Studio › Clientes › invitar al correo `.test` de la semilla) o crear la invitación desde el Studio de prueba.

## 4 · Pruebas de las piezas

| Comando | Qué cubre |
|---|---|
| `pnpm vitest run scripts/__tests__/consolidados-modelo.test.ts scripts/__tests__/consolidados-excel.test.ts scripts/__tests__/consolidados-sql.test.ts` | lectores de Excel, agrupación, líneas de factura con su `shipmentCode`, redondeo como `round(numeric, 2)`, forma de los scripts (`VERBOSITY terse`), preflight, guarda de base de prueba, `raise` con etiquetas, deshacer y purgar con sus dependencias |
| `bash infra/ops/tests/prueba-aplicar-lote.sh` | guardas de `aplicar-lote.sh` (destino, `-staging`, `--confirm`, SHA256SUMS, entorno), orden simulacro → aplicar, forma de la salida, evidencia sin nombres y el control de que una fuga plantada en psql sí se vería. En producción cubre:
- autorización ausente, vacía, con el número suelto, de otro hash o con el id en mayúsculas, en previa, simulacro y aplicar;
- `--autorizacion` apuntando al manifiesto del lote, también por una ruta con `..`;
- `deshacer` y `purgar` deshabilitados;
- lote ya aplicado, por la evidencia y por el preflight;
- `--autorizacion` externa;
- el candado: tomado, liberado y sin soltar un candado ajeno;
- `PROD_COMPOSE_PROJECT` y nombres de proyecto en mayúsculas.

Desde el seguimiento de la #534 también cubre:
- la autorización como enlace simbólico, por `--autorizacion` o en el lote;
- el candado con dueño: TERM, HUP e INT sueltan el propio, un candado rehecho a mano no se suelta y el rechazo nombra el pid.

Tras la revisión de la #538 también cubre: autorización con forma de manifiesto (`"lote":`, `"nombreExcel"`), paquete de producción con `deshacer.sql` o `purgar.sql`, y que psql vea el candado con el pid del guion. En total son 64 casos en Linux. En Git Bash para Windows, `ln -s` copia y los 2 casos de enlace salen OMITIDOS, así que allí cuenta 62. Desde la SDD-0550 también la corre el CI «Calidad continua» (`infra/ops/tests/pruebas-linux.sh`) |
| `bash infra/ops/consolidados/validar-lote-local.sh <lote> [<lote que depende>]` | **antes de mandar un lote al servidor** (Docker, turno del Director): postgres:17 con el esquema entero y la secuencia completa del lote, incluidos deshacer y purgar; con dos lotes, comprueba que purgar el primero aborte mientras el segundo dependa de él. ~40 s por lote |
| `pnpm vitest run lib/portal/__tests__/pending-acceptance.test.ts lib/portal/__tests__/portal-legal-queries.test.ts "app/portal/(app)/facturas/[code]/_components/PendingInvoiceGate.test.tsx" "app/portal/(app)/facturas/page.test.tsx" "app/portal/(app)/facturas/[code]/page.test.tsx"` | el Portal: facturas por aceptar (el admin se crea dentro del try), los embarques de la factura con su medida, la puerta del detalle (contra el 404) y «Mis facturas» con y sin borradores |
