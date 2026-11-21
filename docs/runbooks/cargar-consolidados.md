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
- **Modalidad** (`--modalidad`, por defecto `ddp`): `fcl` = contenedor de un cliente, sólo su envío FCL (`--dueno <marca>`, opcional `--servicio-fcl fcl_directo|fcl_bodega`, `--cbm-fcl`, `--kg-fcl`), sin packing list, sin recepciones ni facturas; `mixto` = FCL de un aliado con nuestros DDP adentro: `--dueno <insignia o marca>` más el packing list de los DDP, y opcionalmente el gasto por el espacio (`--gasto-espacio <USD> --gasto-usuario <correo de un usuario del Studio>`, que se registra en `expenses` colgado del envío FCL). La marca del dueño puede ser la insignia pelada de un aliado (`HR`): en prueba se crea como ficha raíz. `--ignorar-titulo-packing` es sólo para pruebas locales con un packing de otro contenedor como doble: con `--entorno produccion` el generador lo rechaza.
- **Correlativo de China en el título** (`--correlativo-origen N`): el generador compara el número del título del packing list («CONTENEDOR DTD #N») con `--contenedor` y se niega si no coinciden. Cuando el almacén de China numera el packing con su propio correlativo (p. ej. el título dice #61 y para DTD es el 64), se genera con `--contenedor 64 --correlativo-origen 61`, en prueba o en producción.
  - El título tiene que decir exactamente N. Si dice otro número, o no se lee, el generador se niega sin escribir nada.
  - Sin la bandera, el rechazo de siempre queda igual.
  - El mapeo queda en `manifiesto.json` (`contenedor.correlativoOrigen`) y en `resumen.md` («Correlativo de origen: 61 (China) → 64 (DTD)»). No cambia el SQL ni el id del lote: el lote es del contenedor DTD #64.
  - No se combina con `--ignorar-titulo-packing`, y exige `--packing`.
- Salida, en dos carpetas (**empaque mínimo**, decisión del DG del 2026-11-14):
  - `--salida` es **el paquete que sube al servidor**: `previa.sql`, `simulacro.sql`, `aplicar.sql`, `verificar.sql`, `deshacer.sql` y `purgar.sql` (solo en prueba: un lote `--entorno produccion` no los trae), `manifiesto.json` y `SHA256SUMS`, que cubre solo esos archivos.
    - El `manifiesto.json` del paquete lleva solo lo que lee `aplicar-lote.sh`: el id, el entorno, los conteos esperados y los datos del contenedor. No lleva `clientes` (con `nombreExcel` y los candidatos), `embarques` ni `avisos`.
    - En producción, `aplicar.sql` y `simulacro.sql` tampoco llevan el nombre de la marca del Excel: solo lo usan los clientes que se crean en prueba.
    - Con `--sin-facturas`, las líneas con descripción y precio no se emiten.
    - Los códigos de remitente y las descripciones de las filas sí viajan, porque son lo que se carga (`shipments.code`, recepciones e items).
  - `<salida>-local/` **se queda en la PC y no sube**: `resumen.md` y `manifiesto-completo.json`, con la tabla de clientes, los nombres y los avisos. Leer `resumen.md` entero antes de seguir: trae los conteos, la tabla de clientes y los avisos (remitentes corregidos, embarques sin peso, filas a $0, la fila de totales del Excel que no cuadra).
  - El generador se niega si la carpeta de salida ya trae un `resumen.md` o un `manifiesto-completo.json` de una corrida anterior.
  - `aplicar-lote.sh` rechaza (3), en producción, un paquete que traiga `resumen.md` o un `manifiesto.json` con `"nombreExcel"`: así se rechaza un paquete generado con el generador viejo.

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

  El guion copia la autorización una sola vez a un temporal (`cp -P`), y el grep y la evidencia usan esa copia. También rechaza un texto que traiga `"nombreExcel"` o `"lote":`, porque eso es un manifiesto, y una copia de `resumen.md`, que se reconoce por su título (`Lote <id> · contenedor DTD #`, en cualquier parte de la línea: con BOM, sangría, citado o sin `#`) o por las cabeceras fijas de su tabla (`Nombre (Excel)`, `Candidatos a resolver`). Ninguno de los dos es el OK de Sam.
- **Un paquete de producción que traiga `deshacer.sql` o `purgar.sql` se rechaza (3).** El generador no los emite para producción: si están, se mezclaron paquetes.
- **Candado.** Simulacro y aplicar (y deshacer y purgar, en prueba) toman `/run/lock/dtd-lotes.lock.d`, o lo que diga `LOTES_CANDADO`. Es un directorio que se crea con `mkdir`, igual que el de migraciones, y evita que dos pasos que escriben corran a la vez: el segundo se niega (3) y el mensaje dice el pid del dueño.
  - Adentro queda `pid` con el dueño. Si ese `pid` no se puede escribir (disco lleno, permisos), el guion se niega (3) y suelta el candado: no corre un paso con un candado sin dueño. Al salir, también por una señal (HUP 129, INT 130, TERM 143), el guion solo suelta el candado si sigue siendo suyo; nunca suelta uno ajeno.
  - Si quedó de una corrida muerta, comprueba con `ps -o lstart=,args= -p <pid>` que ese pid no existe o que es otro proceso: compara la hora de inicio y el comando con `aplicar-lote.sh`, porque los pid se reciclan. Recién entonces bórralo a mano (`rm -r`).
- Un lote generado para prueba se rechaza en `dtd-cargo`, y uno generado para producción se rechaza en un `*-staging`.
- **Pre-órdenes de un contenedor ya cargado (`--solo-facturas`, SDD-0690).** El paquete tiene **id propio**: el de la carga más `:facturas` (`carga-consolidado:64:6303f821:facturas`). Ese es el id que va en `manifiesto.json`, en cada `.sql`, en el aviso del simulacro y en `AUTORIZACION.txt`. Así:
  - la guarda de idempotencia no lo confunde con la carga del contenedor, que tiene el id sin sufijo, y un segundo `aplicar` de las pre-órdenes sigue negándose;
  - un OK de Sam para la carga no sirve para las pre-órdenes, y al revés tampoco: el guion busca el id como palabra entera, así que un OK con `…:facturas` no autoriza el paquete de la carga. El OK nuevo cita el id con `:facturas` y dice «pre-órdenes».
  - El contenedor y sus envíos se siguen buscando por el id de la carga, que es lo que quedó en sus notas. Por eso se genera con **el mismo Excel** de la carga (y el mismo `--mapa` y `--correlativo-origen`).
  - El exceso de peso se elige al generar: con `--sin-exceso-peso` las pre-órdenes no llevan esas líneas. Para el 64, Sam eligió sin exceso (2026-11-20), como el 59.
  - **Las pre-órdenes del 64, para copiar.** Antes de esto tiene que estar aplicada la 0569, y el 64, en `exc0674_contenedores`. Los valores salen de la carga v2 del 2026-11-16 (`DTD-consolidados/64/2026-11-16-produccion-v2`):
    - `--eta 2026-12-12` y la modalidad `ddp` (que es el valor por defecto) salen de su `manifiesto.json`;
    - el packing es el mismo: su sha256 empieza con `6303f821`, que es la huella del id;
    - el rastreo tiene un sha256 que empieza con `e1ebd577`;
    - el `--mapa` no queda en el manifiesto. Se identificó así: con `marcas-mapa-prod-v2.json`, el `lote_clientes` generado es idéntico al de la v2 (sin contar el nombre), y sin mapa cambia;
    - `--correlativo-origen 61` hace falta porque el título del packing dice #61, y no cambia el id.

    En la PC, desde un worktree con `node_modules` (no uses `pnpm` en el checkout principal), con una carpeta `--salida` nueva:

    ```bash
    node_modules/.bin/tsx scripts/consolidados/generar-lote.ts --rastreo "C:\Users\AKX generator\Desktop\DTD-consolidados\DTD RASTREO DE CONTENEDORES 2026-11-13.xlsx" --packing "C:\Users\AKX generator\Desktop\DTD-consolidados\64\64-produccion-v2.xlsx" --contenedor 64 --correlativo-origen 61 --eta 2026-12-12 --modalidad ddp --entorno produccion --solo-facturas --sin-exceso-peso --mapa "C:\Users\AKX generator\Desktop\DTD-consolidados\64\marcas-mapa-prod-v2.json" --salida "C:\Users\AKX generator\Desktop\DTD-consolidados\64\2026-11-20-produccion-solo-facturas"
    ```

    El id esperado es **`carga-consolidado:64:6303f821:facturas`**, y tiene que salir así en la primera línea del generador y en `manifiesto.json`. Si sale otro, el Excel o los argumentos no son los de la carga: no se sigue.

    El OK de Sam va literal en `AUTORIZACION.txt`, dentro de la carpeta, y tiene que citar el id con `:facturas` y la palabra «pre-órdenes». Por ejemplo, para que Sam lo repita: «Autorizo cargar las pre-órdenes del 64, lote carga-consolidado:64:6303f821:facturas, en producción». Después se sube la carpeta a `/srv/ops/paquetes/lote-64-facturas` y se corren los pasos de a uno, leyendo la evidencia entre paso y paso:

    ```bash
    scp -r "C:\Users\AKX generator\Desktop\DTD-consolidados\64\2026-11-20-produccion-solo-facturas" root@217.216.54.70:/srv/ops/paquetes/lote-64-facturas
    ```

    En el VPS:

    ```bash
    /srv/ops/consolidados/aplicar-lote.sh --proyecto dtd-cargo --confirm dtd-cargo --lote /srv/ops/paquetes/lote-64-facturas --paso previa
    /srv/ops/consolidados/aplicar-lote.sh --proyecto dtd-cargo --confirm dtd-cargo --lote /srv/ops/paquetes/lote-64-facturas --paso simulacro
    /srv/ops/consolidados/aplicar-lote.sh --proyecto dtd-cargo --confirm dtd-cargo --lote /srv/ops/paquetes/lote-64-facturas --paso aplicar
    /srv/ops/consolidados/aplicar-lote.sh --proyecto dtd-cargo --confirm dtd-cargo --lote /srv/ops/paquetes/lote-64-facturas --paso verificar
    ```

    - **`previa`** solo cuenta. Revisa el contenedor cargado con el lote, los envíos y los clientes que resuelven.
    - **`simulacro`** termina con `NOTICE: solo-facturas lote carga-consolidado:64:6303f821:facturas · contenedor … · S Shipping Marks · N clientes con pre-orden nueva · M saltados (ya tenían factura viva) · K sin líneas` y `ROLLBACK`.
      - **Sale una pre-orden por cliente:** por el Shipping Mark que tienen los envíos *al correr*, no por la marca del Excel. Si dos marcas del Excel son del mismo dueño, salen en una sola pre-orden. Si los envíos de una marca quedaron con dos dueños (por ejemplo, después de «Pasar a otro cliente»), sale una para cada uno.
      - Por eso **S = N + M + K = los Shipping Marks vivos de los 111 envíos en ese momento**. No son las 59 marcas del Excel.
      - Para comparar antes de aplicar está la columna `shipping_marks_vivos` de la `previa`.
      - Primero se reasignan los envíos del comodín y después se carga. Con la pre-orden ya creada, la 0551 no puede pasar a otro cliente un envío cuya pre-orden también factura otros envíos (`factura_varios_embarques`).
    - **`aplicar`** se niega sin ese simulacro, y también si ya hay un `aplicar` PASÓ de ese id.
    - **`verificar`** es PASÓ cuando cada cliente con líneas tiene exactamente una factura viva.
    - Al terminar, se borra el paquete del servidor, igual que en cualquier lote.
    - **Emitir no es parte de la carga.** Decisión de Sam (2026-11-20, por el DG), literal: «64: la oficina emite con Facturar todo cuando las revise». Después de `verificar` nadie emite: la oficina revisa las pre-órdenes en Facturación y emite desde Embarques con «Facturar todo».
- **Dejar fuera los envíos de un Shipping Mark (`--excluir-markbox`, SDD-0690).** Solo va con `--solo-facturas`. Sirve para cargar hoy las pre-órdenes de los clientes reales y dejar para después los envíos que siguen en el comodín `DTD-0000`. Si se cargaran juntos, esos envíos quedarían en una sola pre-orden del comodín, y el lunes «Asignar cliente» (0551) se negaría a moverlos con `factura_varios_embarques`. Decisión de Sam para el 64: «camino A, cargar hoy sin el comodín».
  - Se escribe `--excluir-markbox DTD-0000`. Es repetible y acepta comas: `--excluir-markbox DTD-0000,DTD-NNNN`. Solo acepta códigos `PREFIJO-NNNN`, nunca un nombre. Cada Shipping Mark de la lista tiene que tener al menos un cliente en el lote: si no, el generador se niega, para que un error de tipeo no pase callado.
  - **Qué queda fuera.** Sale cada fila del Excel cuyo Shipping Mark, el del `--mapa` o, si no está mapeado, su clave, está en la lista. Sale antes de agrupar, así que con ella salen sus envíos, sus clientes y sus líneas. No generan pre-orden ni línea y no suman en los totales del manifiesto.
    - Los avisos del resumen también se calculan sin esas filas: excesos de peso, diferencia contra el TOTAL FACTURADO y remitentes corregidos.
    - La excepción es la fila de totales del Excel: se compara con el contenedor completo (lo que entra más lo excluido), porque es un control del Excel y no del paquete.
  - **Qué lo dice.** Solo con conteos, sin montos por cliente:
    - el generador imprime `excluidos por markbox: N envíos (…)`;
    - `resumen.md` y el `manifiesto.json` (campo `excluidos`) llevan los conteos y el motivo, sin los códigos de los envíos;
    - la cabecera de cada `.sql` lo dice;
    - la `previa` agrega una consulta `=== excluidos por markbox: N`.
  - **Las columnas de la previa:**

    | Columna | Qué cuenta | Qué tiene que dar |
    |---|---|---|
    | `excluidos_por_markbox` | los N envíos que el Excel deja fuera | N |
    | `excluidos_en_el_contenedor` | de esos N, los que están vivos y vigentes en el contenedor | lo normal es N |
    | `excluidos_hoy_en_markbox_excluido` | de esos, los que siguen hoy en un Shipping Mark de la lista | lo normal es N |
    | `excluidos_en_otro_markbox` | los excluidos que ya están en otro Shipping Mark (ya reasignados) | **0** (si no, aplicar aborta) |
    | `incluidos_en_markbox_excluido` | los envíos que entran y están hoy en un Shipping Mark de la lista | **0** (si no, aplicar aborta) |
    | `otros_del_contenedor_en_markbox_excluido` | envíos del contenedor en la lista que el Excel no trae | informativo |

  - **Las dos guardas.** `aplicar` y `simulacro` abortan sin escribir en dos casos.
    - **Un envío que entra está hoy, en la base, en un Shipping Mark de la lista.** El error es `solo-facturas: N envíos del lote están hoy en un Shipping Mark excluido`. Así el comodín no recibe una pre-orden aunque el Excel resuelva el envío a otro cliente.
    - **Un envío excluido ya está, en el contenedor, en un Shipping Mark fuera de la lista** (la oficina ya lo reasignó). El error es `solo-facturas: N envíos excluidos ya están en un Shipping Mark fuera de la lista`. Sin esta guarda, su dueño recibiría hoy una pre-orden sin ese envío, `verificar` daría PASÓ y el lote chico de después se saltaría a ese cliente por la idempotencia: el envío quedaría sin facturar sin que nada falle.
    - En los dos casos se revisa el mapa contra la base y se vuelve a generar. Si los excluidos ya se reasignaron todos, el paquete se genera sin `--excluir-markbox`.
  - **Otro id.** El paquete ya no es el mismo, así que cambia la huella: `carga-consolidado:64:<8 hex>:facturas`. Los 8 hex salen del sha256 del id de la carga más la lista ordenada de exclusiones, y no dependen del orden en que se escribieron. El id nuevo va en el manifiesto, en cada `.sql` y en el aviso del simulacro. El OK de Sam tiene que citar **ese** id: el del paquete completo (`…:6303f821:facturas`) no sirve. El contenedor se sigue buscando por el id de la carga.
  - Sin la opción, el paquete es idéntico byte a byte al de antes.
  - **Ejemplo, el 64 sin el comodín.** Mismos argumentos que arriba, más la opción y una carpeta `--salida` nueva:

    ```bash
    node_modules/.bin/tsx scripts/consolidados/generar-lote.ts --rastreo "C:\Users\AKX generator\Desktop\DTD-consolidados\DTD RASTREO DE CONTENEDORES 2026-11-13.xlsx" --packing "C:\Users\AKX generator\Desktop\DTD-consolidados\64\64-produccion-v2.xlsx" --contenedor 64 --correlativo-origen 61 --eta 2026-12-12 --modalidad ddp --entorno produccion --solo-facturas --sin-exceso-peso --excluir-markbox DTD-0000 --mapa "C:\Users\AKX generator\Desktop\DTD-consolidados\64\marcas-mapa-prod-v2.json" --salida "C:\Users\AKX generator\Desktop\DTD-consolidados\64\2026-11-21-produccion-solo-facturas-sin-comodin"
    ```

    La primera línea trae el id nuevo, y la línea `excluidos por markbox:` tiene que decir los envíos que siguen en el comodín. Ese id es el que va en `AUTORIZACION.txt`. Después del simulacro, `S Shipping Marks` cuenta solo los clientes reales.
  - **Después, el lote chico: no con `--solo-facturas` a secas.** Sin más opciones, `--solo-facturas` se salta por idempotencia a cada cliente que ya tiene pre-orden. Si un envío del comodín se reasignó a uno de esos clientes, quedaría sin facturar. Para eso está `--agregar-a-preorden` (lo que sigue).
- **Agregar los envíos reasignados a la pre-orden del cliente (`--solo-markbox` con `--agregar-a-preorden`, SDD-0690).** Es el lote chico, después de que la oficina reasigna con «Asignar cliente» los envíos que estaban en el comodín. Va con `--solo-facturas` y las dos opciones van juntas.
  - **Qué entra.** `--solo-markbox DTD-0000` es lo contrario de `--excluir-markbox`: entran **solo** las filas del Excel cuyo Shipping Mark (el del `--mapa` o la clave) está en la lista. Es repetible y acepta comas. Se usan el mismo Excel y el mismo mapa de la carga.
  - **Qué hace, por cliente** (el Shipping Mark que tienen los envíos *al correr*, facturado a él o a su aliado raíz, como siempre):
    - si tiene una pre-orden **en borrador** de esta carga, le **agrega las líneas** de sus envíos nuevos y recalcula base, IVA y total desde todas sus líneas. El IVA es el de esa pre-orden, no el que tenga hoy el tenant. En las notas queda `agregados: <envíos> · líneas agregadas aparte (SDD-0690)`;
    - si no tiene, le **crea** la pre-orden, como `--solo-facturas`;
    - nunca toca una factura que no esté en borrador.
  - **De quién es una pre-orden.** Se usa el criterio de la 0569 al emitir: el dueño es el Shipping Mark vivo del envío de la pre-orden (`shipment_id`), vigente en el contenedor. No es el titular a facturar (`client_markbox`).
    - Con aliado raíz, dos clientes del mismo aliado facturan al mismo titular, pero cada uno tiene su propia pre-orden. Si un envío se reasigna a un cliente del aliado que no tenía pre-orden, se le crea una. No va a la pre-orden del otro cliente: al emitirla, la 0569 solo cubriría los envíos de ese otro y el envío quedaría «sin facturar».
    - Si la pre-orden del cliente factura a otro titular (alguien la editó), aborta.
  - **Cuándo aborta, sin escribir nada** (`aplicar` y `simulacro`):
    - un envío del lote **sigue** en un Shipping Mark de `--solo-markbox`, es decir, no se reasignó;
    - un envío del lote **ya tiene línea** en una factura viva, o es su envío o está en sus envíos cubiertos. Así, correr el paquete dos veces no duplica;
    - la pre-orden del cliente **ya no está en borrador** (emitida, pagada o anulada);
    - el cliente tiene **más de una** pre-orden borrador de esta carga;
    - la pre-orden del cliente **factura a otro titular**;
    - el cliente ya está **facturado en el contenedor** por la regla 0564/0569 (`exc0674_facturas` vivo).
  - **Otro id.** `carga-consolidado:64:<8 hex>:facturas`. Los 8 hex salen del sha256 del id de la carga, la etiqueta `--agregar-a-preorden` y la lista de `--solo-markbox`, así que no coinciden con los de la carga, el paquete completo ni el de `--excluir-markbox`. El sufijo sigue siendo `:facturas` porque es la forma que acepta `aplicar-lote.sh`; así no hay que cambiar el guion del VPS. El OK de Sam tiene que citar **este** id.
  - **Las columnas de la previa** (`=== agregar a pre-orden: envíos a cargar N`). Solo conteos:

    | Columna | Qué cuenta | Qué tiene que dar |
    |---|---|---|
    | `envios_a_cargar` | los envíos del Excel que entran | N |
    | `envios_cargados` | de esos, los vivos y vigentes en el contenedor | N |
    | `siguen_en_markbox_de_origen` | los que siguen en un Shipping Mark de `--solo-markbox` | **0** |
    | `sin_shipping_mark` | los que no tienen Shipping Mark | **0** |
    | `sin_cliente_a_facturar` | los que no resuelven a un cliente con Shipping Mark | **0** |
    | `ya_con_linea_en_factura_viva` | los que ya están en una factura viva | **0** |
    | `preordenes_destino_no_borrador` | pre-órdenes destino que ya no están en borrador | **0** |
    | `clientes_con_varias_preordenes` | clientes con más de una pre-orden borrador de la carga | **0** |
    | `preordenes_destino_otro_titular` | pre-órdenes destino que facturan a otro titular que el del cliente | **0** |
    | `clientes_ya_emitidos_en_el_contenedor` | clientes con factura 0564/0569 viva en el contenedor | **0** |
    | `a_preorden_existente` | envíos cuyas líneas van a una pre-orden que ya existe | informativo |
    | `a_preorden_nueva` | envíos cuyo cliente no tiene pre-orden: se le crea | informativo |

  - **`simulacro`** termina con `NOTICE: agregar-a-preorden lote <id> · contenedor … · N envíos · S Shipping Marks · E pre-órdenes con líneas agregadas · C pre-órdenes nuevas · K sin líneas` y `ROLLBACK`.
  - **`verificar`** da PASÓ cuando se cumplen dos cosas:
    - cada envío del lote tiene **todas sus líneas, y solo esas**, en **una sola** factura viva. Esa factura es una pre-orden de esta carga, su dueño (criterio 0569) es el Shipping Mark vivo del envío, y factura al titular del cliente;
    - en cada pre-orden que tiene líneas del lote, base, IVA y total son iguales a la suma de sus líneas.
  - **`deshacer`** no existe por partes, porque las líneas viven en pre-órdenes que ya estaban. En prueba, `purgar.sql` borra todas las pre-órdenes de la carga. En producción el paquete no trae ninguno de los dos.
  - **La receta del lunes, el 64.** La oficina ya reasignó los envíos que estaban en `DTD-0000`. El paquete usa el mismo Excel y el mismo mapa de la carga y de las pre-órdenes de hoy, y va en una carpeta `--salida` nueva:

    ```bash
    node_modules/.bin/tsx scripts/consolidados/generar-lote.ts --rastreo "C:\Users\AKX generator\Desktop\DTD-consolidados\DTD RASTREO DE CONTENEDORES 2026-11-13.xlsx" --packing "C:\Users\AKX generator\Desktop\DTD-consolidados\64\64-produccion-v2.xlsx" --contenedor 64 --correlativo-origen 61 --eta 2026-12-12 --modalidad ddp --entorno produccion --solo-facturas --sin-exceso-peso --solo-markbox DTD-0000 --agregar-a-preorden --mapa "C:\Users\AKX generator\Desktop\DTD-consolidados\64\marcas-mapa-prod-v2.json" --salida "C:\Users\AKX generator\Desktop\DTD-consolidados\64\2026-11-23-produccion-agregar-comodin"
    ```

    1. **Generar.** La primera línea trae el id nuevo. La línea `agregar a pre-orden:` tiene que decir los envíos que estaban en el comodín (23 en el 64) y que los otros quedan fuera.
    2. **`previa`.** Las columnas que tienen que dar **0**, en 0. `envios_cargados` igual a `envios_a_cargar`. Si `siguen_en_markbox_de_origen` no da 0, la oficina no terminó de reasignar: se espera y se vuelve a correr la previa. No hace falta regenerar, porque el paquete no depende de quién es el dueño.
    3. **OK de Sam.** El OK nominal va en `AUTORIZACION.txt` con el id nuevo y la palabra «pre-órdenes». Por ejemplo: «Autorizo agregar a las pre-órdenes del 64 los envíos reasignados del comodín, lote carga-consolidado:64:<id>:facturas, en producción».
    4. **Nadie edita pre-órdenes del 64 durante la carga.** Antes del `simulacro` se avisa a la oficina que no abra ni guarde pre-órdenes del 64 en Facturación hasta que `verificar` dé PASÓ. Un formulario del Studio abierto desde antes y guardado después pisa las líneas agregadas sin avisar: `updateInvoice` lee `write_version` al guardar, no al abrir.
    5. **`simulacro`, `aplicar` y `verificar`.** Se corren con `aplicar-lote.sh` en `/srv/ops/paquetes/lote-64-agregar`, como cualquier paquete. Después se borra el paquete del servidor.
    6. **No se emite enseguida.** La oficina revisa las pre-órdenes y emite desde Embarques con «Facturar todo», como con las de hoy. **Justo antes de emitir se vuelve a correr `verificar`**, que solo lee. Así se ve si alguien editó una pre-orden después de la carga. Si no da PASÓ, no se emite: se revisa a mano.
  - **`deshacer` y `purgar` no distinguen los dos paquetes.** Solo existen en prueba. Filtran por el id de la carga y la marca `pre-orden cargada aparte (SDD-0690)`, no por el id del paquete. Si una carga tiene dos paquetes de pre-órdenes (el de hoy y el chico), deshacer o purgar uno se lleva también los borradores del otro. En producción no aplica, porque el paquete no los trae.
- **Idempotente.**
  - Si ya hay un `aplicar` PASÓ del lote en la evidencia de esa base, el segundo `aplicar` se niega (3) sin tocar la base.
  - Sin esa evidencia, el preflight de `aplicar.sql` encuentra el contenedor o los envíos ya cargados, aborta y psql sale con 6 sin escribir nada.
  - No se repite un `aplicar` que salió con 7: primero se lee la evidencia.
- **Después de una señal (129 HUP, 130 INT, 143 TERM) no se repite el paso**, igual que con 7. Una señal no hace rollback:
  - con TERM, psql puede haber terminado el COMMIT y el guion salir igual con 143;
  - con HUP o INT, el psql del contenedor puede seguir corriendo después de que el guion soltó el candado.

  Antes de cualquier otra cosa:
  1. lee la evidencia del paso (`<paso>.out` y `<paso>.err`);
  2. comprueba que no quede psql vivo en `dtd-cargo-db-1` con `docker top dtd-cargo-db-1`, que lista los procesos del contenedor desde el host (la imagen de la base no trae `ps`: no tiene procps). Mirar `pg_stat_activity` en producción es una consulta a la base oficial: solo con el OK de Sam;
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
| `pnpm vitest run scripts/__tests__/consolidados-agregar-preorden-pglite.test.ts` | `--solo-markbox` con `--agregar-a-preorden` corrido en PGlite. Prueba el paquete de hoy y después el lote chico: líneas agregadas a una pre-orden existente con los totales recalculados, una pre-orden nueva, factura emitida o anulada que aborta, cliente ya facturado por la 0564/0569 que aborta, envío todavía en el comodín que aborta, segunda corrida que se niega sin duplicar, `verificar` que detecta un total descuadrado y un envío en la factura de otro cliente, la previa con sus conteos, el id propio, y que sin las opciones el paquete no cambia |
| `pnpm vitest run scripts/__tests__/consolidados-excluir-markbox.test.ts scripts/__tests__/consolidados-solo-facturas-pglite.test.ts` | `--solo-facturas` corrido en PGlite y `--excluir-markbox`: qué sale del lote, que los totales no lo cuentan, conteos sin montos en manifiesto, resumen y previa, la huella nueva con la forma de `aplicar-lote.sh`, la guarda contra un envío que entra y está en un markbox excluido, y que sin la opción el paquete no cambia |
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

Tras la revisión de la #538 también cubre: autorización con forma de manifiesto (`"lote":`, `"nombreExcel"`), paquete de producción con `deshacer.sql` o `purgar.sql`, y que psql vea el candado con el pid del guion. El seguimiento de la #538 suma la copia de `resumen.md` (con BOM, sangría, citada, renderizada sin `#` o solo con las cabeceras de su tabla), el orden de los traps, `deshacer.sql` como enlace roto y el pid que no se puede escribir. El empaque mínimo (2026-11-14) suma el paquete de producción con `resumen.md` o con `nombreExcel` en el manifiesto, sin llamar a docker. En total son 78 casos en Linux. En Git Bash para Windows `ln -s` copia y `ulimit -f` no se aplica: los 3 casos de enlace y el del pid salen OMITIDOS, así que allí cuenta 74. Desde la SDD-0550 también la corre el CI «Calidad continua» (`infra/ops/tests/pruebas-linux.sh`) |
| `bash infra/ops/consolidados/validar-lote-local.sh <lote> [<lote que depende>]` | **antes de mandar un lote al servidor** (Docker, turno del Director): postgres:17 con el esquema entero y la secuencia completa del lote, incluidos deshacer y purgar; con dos lotes, comprueba que purgar el primero aborte mientras el segundo dependa de él. ~40 s por lote |
| `bash infra/ops/consolidados/validar-lote-local.sh --produccion <lote> <marca>[,<marca>…]` | **antes de subir un lote de producción** (Docker, con turno): la previa sin los dueños aborta, entran clientes sintéticos con esas marcas y siguen previa, simulacro sin filas, aplicar (0 clientes creados), verificar PASÓ y un aplicar repetido que el preflight frena; al final, clientes y aliados sin cambio y un contenedor más. Sin deshacer ni purgar. La evidencia queda en `<padre>/ensayos-local/`, fuera del paquete |
| `pnpm vitest run lib/portal/__tests__/pending-acceptance.test.ts lib/portal/__tests__/portal-legal-queries.test.ts "app/portal/(app)/facturas/[code]/_components/PendingInvoiceGate.test.tsx" "app/portal/(app)/facturas/page.test.tsx" "app/portal/(app)/facturas/[code]/page.test.tsx"` | el Portal: facturas por aceptar (el admin se crea dentro del try), los embarques de la factura con su medida, la puerta del detalle (contra el 404) y «Mis facturas» con y sin borradores |
