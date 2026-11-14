---
sdd: "0543"
title: "Consolidados en camino: carga de contenedores desde el packing list"
status: in-progress
author: "founder"
created: 2026-10-16
updated: 2026-11-13
supersedes: null
superseded_by: null
related: ["0047", "0054", "0101", "0156", "0170", "0255", "0258", "0522", "0524", "0530", "0532", "0540"]
confidencialidad: interno
---

# SDD-0543 — Consolidados en camino: carga de contenedores desde el packing list

> Cargar en el Studio, desde los Excel del almacén de Yiwu, los contenedores que ya zarparon (59 primero, después 60–64 y la bodega pendiente): recepciones en China, consolidación con contenedor, naviera y ETA, envíos por cliente visibles en su Portal y una factura por cliente en borrador. Primero en `prueba.dtdcargo.com`; producción se decide después con Sam.

## Contexto

El almacén de Yiwu registra la mercancía en Excel. Los contenedores en camino no existen en el Studio, así que el Portal no le muestra nada al cliente y lleva el aviso «Seguimiento en construcción» (`lib/portal/tracking-en-construccion.ts`, `TRACKING_EN_CONSTRUCCION = true`). Sam pidió montar esos contenedores como si hubieran pasado por el sistema, con todas las recepciones fechadas un día antes del consolidado, y probar primero en prueba.

Lo que ya existe y se reutiliza, con su evidencia, está en el handoff (`.agents/handoffs/0543-consolidados-en-camino.md`). Lo esencial:

- La recepción en China es `warehouse_receipts_cn` (migr 0008); su código `WR-YYYY-NNNN` lo pone un trigger sólo si llega vacío (0469); las cajas `DTD-B-` las crea otro trigger según `boxes` (0240).
- El contenedor es `consolidations` + `consolidation_items` + `sailings` (0096, 0154, 0249). El Portal agrupa los envíos del cliente por contenedor y muestra ETD/ETA/contenedor (`lib/portal/consolidation-queries.ts`, SDD-0101).
- El Portal lista envíos por `client_markbox` (`lib/portal/portal-queries.ts`). El camino actual de «consolidar» en CN cuelga la recepción de un envío `C-YYYY-NNNN` sin cliente (`lib/studio/expense-alerts-queries.ts`), que el Portal no ve.
- Las facturas DDP no se emiten sin aceptación de T&C (gate AUT-04 en bloqueo duro, `lib/studio/legal/gate-config.ts`); el borrador se le muestra al cliente como «pendiente de aceptar» en la portada del Portal (SDD-0054 Slice C) y el operador emite después.
- Los avisos al cliente se programan sólo desde la aplicación (`lib/studio/notifications/*`); una escritura por SQL no avisa a nadie.
- Los Shipping Mark del legado (`DTD-J031`) viven en `client_markbox_history` y `resolve_markbox` (0367) los sigue hasta el código vigente; los aliados llevan prefijo propio (0362).

## Fuentes de datos

- `DTD RASTREO DE CONTENEDORES.xlsx`, hoja «DTD»: una fila por contenedor (`# CONTENEDOR`, `FCL/DDP`, `FECHA DE CARGA`, `NRO DE CONTENEDOR`, `PRECINTO`, `EMPRESA`, `LLEGA A PUERTO`, `FECHA APROX. DE LLEGADA`, `LINK RASTREO`). No trae fecha de salida distinta de la de carga.
- `NUEVO FORMATO CONTENEDOR NN.xlsx`: encabezados en la fila 3: `marca de la caja`, `Remitente` (embarque del cliente, p. ej. `DTD-A116-06`), descripción, cajas, peso, CBM China, CBM a factura, peso acordado, kg permitidos, extra peso, precio × kg extra, valor $ kg extra, costo, precio venta CBM, total facturado, agente, ganancia. Una fila de totales al final.
- Medido en el del 59 por el generador (2026-10-16): 98 filas con Remitente (la 99.ª es la de totales), **50 remitentes = 50 envíos** (24 marcas de la casa `DTD-L999` + 1 `DTD-9999` + 8 claves de aliados DC/MMVE/TEJ = 33 clientes), 1.288 cajas, 68,811 m³, 20.373,45 kg, flete $47.241,75 según «TOTAL FACTURADO» más $1.411,05 de «valor $ kg extra». La fila de totales del Excel dice 1.285 cajas, 68,768 m³ y 20.363,45 kg: su SUM no cubre todas las filas (diferencia 3 cajas, 0,043 m³, 10 kg); el lote suma fila por fila. Las cifras de la primera lectura a ojo (39 remitentes, ≈ $47.210) contaban sólo las filas con marca `DTD-` y la celda de total del Excel; quedan reemplazadas por estas.
- Ninguno de los dos archivos entra a Git ni a los worktrees. Viven en `C:\Users\AKX generator\Desktop\DTD-consolidados\<contenedor>\` junto con el lote generado.

## Decisiones de Sam (2026-10-16)

1. **Una factura por cliente y contenedor**, en `borrador`, hasta que el cliente acepte los T&C. El estado de cuenta muestra el monto «por aceptar» y el detalle pide aceptar. (El Director anotó: vale para prueba; pasar a la base oficial y la parte contable se deciden después.)
2. **Código del envío = Remitente del Excel** (`DTD-A116-06`, `DC-014-21`): el cliente lo reconoce y es la clave que evita duplicados.
3. **Lote SQL aplicado con `psql`**, igual que las migraciones: `previa.sql` (lectura), `aplicar.sql` (una transacción), `verificar.sql` (agregados), `deshacer.sql`. Sin avisos por construcción.
4. **Fechas del 59**: recepciones 2026-08-10, zarpe (ETD) 2026-08-11, ETA 2026-10-19.
5. **Sin avisos a clientes en esta fase.** El aviso se diseña aparte (§ Aviso) y se dispara sólo en producción con su OK.
6. Prueba: autorización literal «autorizo cargar datos reales de los consolidados en prueba» (SDD-0540 §8); lista de IP de Sam; al terminar, los datos reales se borran de prueba con evidencia.
7. **Sin exceso de peso** (2026-10-16, ~23:40Z): «No cobres el exceso de peso: regenera el lote del 59 con --sin-exceso-peso». Las facturas llevan sólo el flete por m³; el «valor $ kg extra» del Excel ($1.411,05) no se factura y queda en los avisos del resumen. **Diferencia conocida:** la base del lote es $47.241,79 y el Excel suma $47.241,75; los $0,04 salen de redondear la base de cada factura a 2 decimales por cliente (`round(numeric, 2)`), mientras que el Excel suma celdas sin redondear. No se corrige: la factura de cada cliente es la que manda.
8. **Filas a $0 se facturan en $0** (2026-10-17): «Que las dos filas a $0 de DTD-J000 entren como líneas en $0, como están». Las dos líneas de ese cliente (0,4 m³ y 0,262 m³ a $0) quedan visibles en su factura en borrador; la v6 cargada en prueba ya las trae así.
9. **Contenedores 60 al 64 en prueba** (2026-10-17, dicho al Director; literal: «sí, carguen también los contenedores 60 al 64 en prueba» y «ok, sigue tu recomendación para el 60 al 63»). La recomendación aprobada, a su nombre: **61 (`MG-019`), 62 (`MG-020`) y 63 (`DTD-9038 FCL-2`)**, FCL de un cliente, llevan sólo el envío FCL del cliente dueño con su tracking, el contenedor y el zarpe, **sin factura** (una factura entra sólo si Sam da después el monto por contenedor). **60 (`HR-DTD`)**, FCL de aliado con 5,7 m³ nuestros: un solo contenedor con el envío FCL del aliado dueño más nuestros envíos DDP del packing list, facturados por m³ como el 59 (`--sin-exceso-peso`, $0 tal cual); lo que el aliado nos cobra por el espacio entra como **gasto** (`expenses`, categoría `otro`, colgado del envío FCL) con el monto que dé Sam, nunca inventado. **64** igual que el 59. Si la marca del dueño (`MG-019`, `HR`, `DTD-9038`) no resuelve en la base de prueba, se crea como cliente sintético sin contacto igual que en el 59; la insignia pelada (`HR`) se crea como ficha raíz del aliado (migr 0371). Modalidades del generador: `--modalidad ddp|fcl|mixto`. **Supuesto de prueba:** `MG` se trató como aliado raíz sintético (ficha `MG` + cliente `MG-0019`/`MG-0020`) porque la hoja de rastreo no dice quién es; en la base oficial, `MG-019` y `MG-020` tienen que resolver contra el cliente real o el mapa de Sam, nunca crearse. **Lotes que comparten fichas:** los conteos de verificar no cambian, pero el de «clientes creados» depende de lo que ya exista: cargados en serie en prueba, el 61 creó la raíz `MG` y el 62 sólo su cliente (1 cliente, 0 aliados, contra 2 y 1 en una base limpia). La dependencia obliga a **purgar en orden inverso a la carga**; `purgar.sql` lo comprueba antes de borrar y aborta con conteos y el id del otro lote.

## Alcance

**Dentro**
- Generador `scripts/consolidados/` (Excel → lote SQL) con pruebas unitarias sobre fixtures sintéticos.
- Script de servidor `infra/ops/consolidados/aplicar-lote.sh` para correr el lote en prueba con las mismas guardas de `aplicar-migracion.sh` (sólo `*-staging`).
- Portal: estado de cuenta con filas «por aceptar»; detalle de una factura pendiente que pide aceptar los T&C en vez de 404.
- Evento de aviso `carga_en_camino` (copy y regla), sin dispararlo.
- Spec, handoff y runbook corto de la carga.

**Fuera**
- Producción (base oficial), `TRACKING_EN_CONSTRUCCION`, la emisión automática de facturas al aceptar y la modalidad del contenedor 60 (FCL de un aliado con 5,7 CBM DDP adentro): se deciden con Sam después del 59.
- Pantalla de importación en el Studio (segunda fase).
- Comisiones por agente del Excel (`Agente`, `GANANCIA POR ENVIO`): no tienen entidad en el ERP.

### Extensión F2 (2026-11-13): camino a producción de `aplicar-lote.sh`

Pedido del Subdirector Portal para preparar la carga de los contenedores 61, 62 y 63 en la base oficial. **El script queda listo, pero no se corre.** Cada lote necesita el OK nominal de Sam.

- `--project dtd-cargo` (o `--proyecto`, o el `PROD_COMPOSE_PROJECT`) acepta solo lotes generados con `--entorno produccion`. Un `*-staging` acepta solo lotes de prueba.
- En producción, **cada paso** exige `AUTORIZACION.txt`, en la carpeta del lote o con `--autorizacion <archivo>`. Tiene que traer el OK literal de Sam y citar **el id completo del lote** (`carga-consolidado:<N>:<hash>`). Un número suelto no basta: lo cumplen una fecha o «no autorizo el 61» (revisión independiente, MEDIA). Aplica también a la previa, porque leer producción también requiere permiso. El archivo se copia a la evidencia. Un `--autorizacion` que apunte a otro archivo de la carpeta del lote, como el manifiesto o el resumen, se rechaza: citan el id, llevan nombres y se copiarían a la evidencia.
- Candado: los pasos que escriben toman `LOTES_CANDADO` (por defecto `/run/lock/dtd-lotes.lock.d`), creado con `mkdir` igual que en `migraciones/aplicar.sh`. El servidor no garantiza `flock` en todas las rutas y Git Bash no lo trae.
- Después de `verificar` PASÓ se borra el paquete del servidor. El `deshacer.sql` de producción no trae la guarda de base de prueba: el guion lo niega, pero un `psql` directo no. Desde el seguimiento de abajo, ese archivo ya no se emite en producción.
- Previa, simulacro, aplicar y verificar van de a uno, cada uno con su evidencia de conteos y huellas. `aplicar` exige un simulacro PASÓ del mismo lote en la misma base.
- **Idempotente.** Si ya hay un `aplicar` PASÓ del lote en la evidencia de esa base, se niega (código 3) sin tocar la base. Sin esa evidencia, el preflight de `aplicar.sql` aborta en la base: si el contenedor, los envíos o las facturas ya existen, sale con 6 y no deja nada escrito.
- En producción, `deshacer` y `purgar` están deshabilitados (código 3), aunque vengan confirmados: el borrado lo corre Sam.
- **Un lote de producción no crea clientes ni aliados.** El generador no acepta `--crear-clientes-faltantes` y `aplicar.sql` aborta si una marca no resuelve. Además, `previa.sql` termina con un corte (`do $corte$`): si alguna marca no resuelve a un cliente vivo, aborta con el conteo y las etiquetas, sin texto del Excel. Así la previa se niega antes del simulacro. Lo prueba `scripts/__tests__/consolidados-previa-corte.test.ts` en PGlite, con el mismo bloque que genera `generarSql` y un esquema mínimo. Son tres casos: sin cliente corta, cliente borrado corta y cliente vivo pasa. El `resolve_markbox` real, con historial y fusiones, lo cubre `schema-rebuild`, no esta prueba.
- Consulta mínima del 2026-11-13, corrida por el Subdirector con el OK de Sam: `DTD-9038` (63) resuelve; `MG-0019`/`MG-019` (61) y `MG-0020`/`MG-020` (62) no resuelven, y el aliado `MG` no existe en producción. Con estos lotes, la previa del 61 y la del 62 se cortarían hasta que Sam diga a qué cliente real corresponden. Sam aclaró que MG es un cliente, no un aliado, y que `MG-019`/`MG-020` son sus proveedores. El 61 y el 62 quedan estacionados hasta que el cliente MG exista en producción. El 63 es el único candidato.
- No hay prueba en una base real; la cobertura es `infra/ops/tests/prueba-aplicar-lote.sh` con un doble de docker.

### Seguimiento de la #534 (2026-11-13): observaciones bajas de la re-revisión

PR aparte desde `main` en `7b1e05050`. Cambios:

- **Enlaces simbólicos.** La autorización no puede ser un enlace simbólico, ni en `--autorizacion` ni en el `AUTORIZACION.txt` del lote: tiene que ser un archivo regular. Hay dos razones. La guarda de carpeta resuelve el directorio de la ruta (`pwd -P`), pero no el último componente: un enlace que esté fuera del lote y apunte a su `manifiesto.json`, que cita el id y lleva nombres, la pasaría. Además, el destino de un enlace puede cambiar entre el chequeo y el uso. Por eso la autorización se copia una sola vez a un temporal (`cp -P`) y el grep y la evidencia usan esa copia. Un texto con `"nombreExcel"` o `"lote":` se rechaza. Un paquete de producción que traiga `deshacer.sql` o `purgar.sql` también se rechaza (3). Revisión de la #538: H3 y H6.
- **Señales.** Los traps se ponen al principio del guion, antes de tomar el candado (H4). Una señal no hace rollback (H2): con TERM, psql puede haber terminado el COMMIT y el guion salir igual con 143; con HUP o INT, el psql del contenedor puede seguir vivo. Por eso 129, 130 y 143 están en los códigos del guion y el runbook manda leer la evidencia antes de repetir el paso, como con el 7.
- **Candado con dueño.** Ahora el candado lleva `pid` adentro.
  - Al salir, también por HUP, INT o TERM (`trap 'exit 129' HUP; … 130 INT; … 143 TERM`, como `migraciones/aplicar.sh`), solo se suelta si sigue siendo del proceso.
  - Un candado ajeno, o rehecho a mano durante el paso, no se toca.
  - El rechazo por candado tomado dice el pid del dueño.
- **Paquete de producción.** Con `--entorno produccion`, el generador ya no emite `deshacer.sql` ni `purgar.sql`, y se niega a escribir en una carpeta que ya los tenga. Revertir o borrar en producción lo corre Sam. El runbook §2b ya no manda borrarlos a mano.
  - Esto reemplaza la nota de arriba sobre el `deshacer.sql` de producción.
  - El paquete se sigue borrando del servidor después de `verificar`, porque lleva nombres.

### Seguimiento de la #538 (2026-11-14): después de cargar el 63

PR aparte desde `main` en `4c5c39581`, con el lote 63 ya cargado en producción (DTD-CONSOL-0003). Cambios:

- **Copia de `resumen.md`.** Una autorización que traiga el título de `resumen.md` (`Lote <id> · contenedor DTD #`, en cualquier parte de la línea, así que también con BOM, sangría, citada o renderizada sin `#`) o las cabeceras fijas de su tabla (`Nombre (Excel)`, `Candidatos a resolver`) se rechaza (3), igual que las que traen `"nombreExcel"` o `"lote":`. `resumen.md` cita el id y lleva nombres. Un OK que empieza con `Lote <id>` sin el resto del título sigue valiendo. La primera versión (`^# Lote `) dejaba pasar esas variantes: lo vio la revisión de la #545.
- **pid sin escribir.** Si el `printf` del pid en el candado falla, el guion se niega (3), no corre psql y suelta el candado. El pid vacío ya contaba como propio en `soltar_candado`, y ahora el `rm` del pid no impide el `rmdir`.
- **Runbook.** Para ver si queda psql vivo después de una señal, `docker top dtd-cargo-db-1`, porque la imagen de la base no trae procps. Mirar `pg_stat_activity` en producción requiere el OK de Sam.
- **Pruebas.**
  - Orden de los traps: EXIT y 129/130/143 antes del `mkdir` del candado y del pid. Es una prueba estructural, que se suma a las de señal durante el paso.
  - Un `deshacer.sql` que es un enlace roto también se rechaza.
  - El rechazo de la copia de `resumen.md`.
  - El refuse del pid, con `ulimit -f 0`; en Git Bash sale OMITIDA.
- **`validar-lote-local.sh --produccion <lote> <marcas>`.** Reemplaza al ensayo ad hoc del 63. El orden es:
  - la previa sin los dueños aborta;
  - entran los clientes sintéticos;
  - previa, simulacro sin filas, aplicar con «0 clientes creados», verificar PASÓ y un aplicar repetido que el preflight frena;
  - al final, clientes y aliados quedan sin cambio y hay un contenedor más.

  La evidencia va a `<padre>/ensayos-local/`, fuera del paquete. Los modos normal y cruzado se niegan con un lote de producción, y `--produccion` se niega con uno de prueba o con un paquete que traiga `deshacer.sql` o `purgar.sql`.

### Correlativo de China en el título del packing (2026-11-14)

El packing list del contenedor DTD #64 trae en su título «CONTENEDOR DTD #61», porque el almacén de China lo numera con su propio correlativo. El generador ya se negaba cuando el título no coincidía con `--contenedor`, y la única salida era `--ignorar-titulo-packing`, que es solo para pruebas. Aprobado por el DG el 2026-11-14 (D1). Cambios:

- **`--correlativo-origen N`** en `generar-lote`. Con la bandera, el título tiene que decir exactamente N; si dice otro número, o no se lee, se niega sin escribir nada. Sin la bandera, el rechazo de siempre queda igual, y su mensaje sugiere la bandera.
- **Registro del mapeo.** Queda en `manifiesto.json` (`contenedor.correlativoOrigen`), en `resumen.md` («N (China) → M (DTD)») y como aviso. Son solo los dos números, sin datos del Excel. No cambia el SQL ni el id del lote.
- **`--ignorar-titulo-packing` se niega con `--entorno produccion`.** Antes, que fuera solo para pruebas estaba únicamente en el runbook. No se combina con `--correlativo-origen`.
- **Pruebas** (`scripts/__tests__/consolidados-sql.test.ts`), en prueba y en producción:
  - título igual sin bandera: pasa;
  - título distinto sin bandera: se niega;
  - bandera correcta: pasa y el mapeo queda;
  - bandera incorrecta o título sin número: se niega;
  - una corrida de `generar()` de punta a punta con Excel inventados.

## Diseño

### Modelo del lote (por contenedor)

| Entidad | Regla |
|---|---|
| `carriers` | find-or-create por nombre (CMA CGM, Maersk/MSK, ZIM). |
| `ports` | POL `NGB` (Ningbo) para carga de Yiwu; POD por `LLEGA A PUERTO` (La Guaira = `LGU`, Puerto Cabello = `PBL`; otros se crean con código de 3 letras). |
| `sailings` | uno por contenedor: `vessel` «Por confirmar» hasta tener el buque, `etd` = fecha de carga, `eta` = la decidida, `status 'transito'`. |
| `consolidations` | `ref` = siguiente `DTD-CONSOL-NNNN`, `container_no`, `container_type 40HC`, `status 'zarpado'`, `sailing_id`, `created_at = authorized_at` = fecha de carga, `notes` con el lote. Insertar en `zarpado` no dispara el trigger de 0477 (sólo UPDATE): los envíos se avanzan en el mismo SQL. |
| `shipments` | uno por Remitente: `code` = Remitente, `client_markbox` canónico (`resolve_markbox`), `client_name` de `clients`, `origin 'Yiwu, China'`, `destination` = puerto de llegada, `shipment_service 'puerta_a_puerta_DDP'`, `vehicle_category 'contenedor_maritimo'`, `weight_kg`/`volume_m3` sumados, `created_at` = recepción. Nace en `in_warehouse` (así el evento inicial del trigger dice la verdad) y pasa a `in_transit`; eventos `consolidating`, `shipped` e `in_transit` fechados el día de carga. |
| `consolidation_items` | uno por envío con cbm, peso, cajas y snapshots. |
| `warehouse_receipts_cn` | una por envío: `receipt_code` explícito `WR-C<NN>-<remitente>` (clave natural; no gasta la serie `WR-YYYY`), `received_at` = carga − 1, `status 'consolidado'`, `shipment_id`, `boxes`, `total_cbm`, `total_weight_kg`, `warehouse_id` = YIW-A1; items una por fila del Excel; eventos `received` y `consolidated`. `destination_city` queda nula. |
| `invoices` | una por cliente y contenedor, `borrador`, `invoice_code` siguiente `F-YYYY-NNNN`, snapshots del cliente (`client_rif`, `client_doc_kind`), USD, IVA según `tenants.iva_enabled`, `lines` una por embarque («Flete DDP · <remitente> · <cbm> m³ × $<precio>», cada una con su `shipmentCode` = Remitente para que el Portal liste los embarques de la factura y sume su medida) más «Exceso de peso» cuando el valor $ kg extra es positivo, `fund_class 'third_party'`, `shipment_id/shipment_code` = primer embarque del cliente (la tarjeta «pendiente de aceptar» lo exige y el gate compara su medida), `notes` con el contenedor y los embarques. Aliados: al aliado raíz. |
| Auditoría | un `append_audit_event` por entidad creada, `p_actor_type 'system'`, `p_source 'job'`, `p_correlation_id 'carga-consolidado:<NN>:<sha8>'`. |

### Idempotencia y vuelta atrás

- `aplicar.sql` es una transacción con `\set ON_ERROR_STOP on`. El preflight aborta si ya existe el contenedor vivo con ese `container_no`, un `shipments.code`, un `receipt_code` o una factura del lote. Una segunda corrida no escribe nada.
- `verificar.sql` recuenta por lote (envíos, recepciones, cajas, items, facturas, Σ CBM, Σ kg, Σ base) y compara con `manifiesto.json`.
- `deshacer.sql` borra lógicamente lo del lote (facturas sólo en `borrador`, items de consolidación, recepciones, envíos y consolidación) con motivo y evento de auditoría, en una transacción, y se niega si alguna factura se emitió o si hay cajas estibadas, igual que los bloqueos de 0476. Es la vuelta atrás: los nombres siguen en la base.
- `purgar.sql` es el borrado definitivo para prueba (Sam pidió borrar los datos reales con evidencia): borra físicamente, en una transacción y en orden de dependencias, todo lo que el lote creó (facturas, recepciones con sus items/eventos/cajas, envíos con sus eventos, items del contenedor, el contenedor, su zarpe, la naviera si la creó el lote, y los clientes y aliados creados por el lote), y termina comprobando conteo cero por lote. Si una fila ajena al lote apunta a algo del lote (una aceptación de T&C, un reporte de pago del smoke), la FK lo aborta y el camino es el reinicio de prueba (`resetear-base-prueba.sh`). El log de auditoría es append-only (0267) y no lleva nombres: sus filas quedan como registro de la carga y de la purga.
- Guarda de base de prueba (revisión del Director, 2026-10-17): un lote generado con `--entorno prueba` se niega en `aplicar`/`simulacro`/`deshacer`/`purgar` donde no esté el cliente sintético de la semilla (`05400000-…-0101`), así que un psql directo contra la base oficial aborta antes de escribir. Todos los scripts ponen `set VERBOSITY terse` (psql no escribe `DETAIL` con filas en la evidencia) y los `raise` del bloque citan etiquetas `PREFIJO-#n`, nunca la clave del Excel.

### Marcas

- Producción/prueba con clientes reales: `previa.sql` resuelve cada marca con `resolve_markbox`; lo que no resuelve se lista para que Sam lo mapee en `marcas-mapa.json` (fuera de Git).
- Prueba con la semilla sintética: `--crear-clientes-faltantes` crea clientes mínimos (marca y nombre del Excel, sin contacto) y, para aliados, el aliado raíz con su prefijo. Sólo con `--entorno prueba`.

### Portal

- Estado de cuenta (`app/portal/(app)/facturas/page.tsx`, `lib/portal/statement-ledger.ts`): filas «Por aceptar» con el monto de los borradores DDP pendientes (lectura con admin scopeada como `listPendingAcceptanceInvoices`).
- Detalle (`app/portal/(app)/facturas/[code]/page.tsx`): para un borrador pendiente, en vez de 404, «Tienes que aceptar los T&C del portal para ver el detalle» con el botón a `/portal/facturas/[code]/aceptar`.
- Puerta del detalle y página de aceptación (revisión del Director, 2026-10-17): si la factura junta varios embarques, listan sus códigos y la medida **sumada** de sus envíos (`lines[].shipmentCode` → `embarques` en `PendingAcceptanceDetail`, leídos con scope de tenant), nunca la del primero junto al monto de todos. La aceptación sigue sellando la medida del primer envío (`shipment_code`, SDD-0054): limitación conocida que se decide aparte.
- «Mis facturas» sin facturas emitidas pero con borradores: el vacío habla de facturas emitidas y dice cuándo entran al estado de cuenta, en vez de contradecir la tarjeta.
- `loadPendingAcceptanceForClient`/`…DetailForClient` crean el admin client dentro del `try`: sin la variable de entorno devuelven vacío/null y la página sigue.

### Aviso (diseño; no se dispara en esta SDD)

Evento `carga_en_camino` en `CLIENT_JOURNEY_EVENTS`: un aviso por cliente y contenedor, anclado al primer envío del cliente, copy «Tu carga del contenedor NN viene en camino · N envíos · M facturas por aceptar · llega aprox. <ETA> · entra al Portal». Canal recomendado correo + push; aparece en la bandeja del Portal (0479). Antes de enviar, simulacro con la lista de destinatarios.

El evento está marcado `gancho: "pendiente"` en el catálogo: el Studio lo muestra aparte de los que «ya disparan desde su gancho», porque todavía nada lo emite.

### Datos personales (revisar-datos-ve)

Inventario del lote: `clients.markbox`, nombre del cliente (snapshot), descripciones de mercancía. Sin teléfonos ni direcciones. Los Excel, el mapa de marcas, los SQL y los manifiestos viven fuera del repo; la evidencia en el VPS lleva sólo agregados y códigos (desde la corrección del 2026-10-16: `previa.sql` y los errores del lote no imprimen nombres). El paquete del lote en el servidor (`/srv/ops/paquetes/lote-NN/`) sí lleva nombres en todos sus archivos: forma parte del borrado final de prueba junto con `purgar` (o el reinicio), con `ls` vacío como evidencia. Los fixtures de pruebas usan marcas y nombres inventados. Prueba corre con la lista de IP de Sam mientras tenga datos reales y se limpia al terminar (SDD-0540, runbook `entorno-prueba.md` §2.1).

**Log de auditoría y cierre de prueba (decisión del Director, 2026-10-17).** `purgar` no borra `public.entity_audit_log` (append-only, migr 0267) ni los puertos que el lote crea. Medición de Contabo en prueba (2026-10-17, sólo catálogo y conteos): las cargas y la purga del 59 dejaron 374 filas en el log (trigger `audit_d2_invoices` sobre facturas y los `append_audit_event` del lote), sin nombres —`invoice_code`, `client_markbox`, `base_amount`, `shipment_id`, `status`, `code`, `service`, `receipt_code` y el payload con lote, contenedor y `shipment_code`—, pero 9 filas llevan `code`/`shipment_code` de forma `XX-NN-<texto>`: el Remitente del Excel con texto de una marca. El log no tiene trigger que bloquee DELETE, y el conteo cero de `verificar`/`purgar` no lo mira. Por eso el **cierre** de los datos reales en prueba no es `purgar`: es **reiniciar prueba desde la semilla** (`resetear-base-prueba.sh`, `entorno-prueba.md` §5) más borrar los paquetes `/srv/ops/paquetes/lote-*`, con evidencia de conteo cero en las tablas de negocio y en `entity_audit_log` por ids `carga-consolidado:*`. Las purgas por lote quedan para rehacer lotes durante las pruebas.

**Condición previa a producción.** En la base oficial el log también guardará esos códigos, append-only y sin forma de borrarlos: antes de cualquier carga, las marcas y remitentes con texto de un nombre se normalizan o se mapean (`marcas-mapa.json` de Sam) para que no lleguen ni a `shipments.code` ni al log.

## Criterios de aceptación

1. `corepack pnpm vitest run scripts/__tests__/consolidados` en verde: parsers, resolución de marcas, SQL generado, preflight que aborta con duplicados, deshacer que se niega con factura emitida.
2. Corrida en seco del 59: `resumen.md` con 50 envíos, 50 recepciones, 98 items, 1.288 cajas, 33 clientes, 33 facturas, 68,811 m³, 20.373,45 kg y base $48.652,84 (o $47.241,75 con `--sin-exceso-peso`), con los avisos y la lista de marcas a resolver. CUMPLIDO el 2026-10-16 (lote `carga-consolidado:59:8dd77b3c`).
3. En prueba: `verificar.sql` cuadra con `manifiesto.json`; una segunda corrida de `aplicar.sql` aborta; CN muestra las recepciones en `consolidado` fechadas 2026-08-10; Naviera muestra el contenedor zarpado con ETA; Tracking lista los envíos `in_transit`; Facturación lista los borradores; un cliente de prueba ve sus envíos agrupados por contenedor y sus facturas «por aceptar». **Parte SQL CUMPLIDA** en `dtd-cargo-staging`: v5 el 2026-10-16 23:28Z y, tras la decisión 7, purga de la v5 y carga de la v6 el 2026-10-17 00:16Z (verificar PASÓ · 50 envíos · 50 recepciones · 1288 cajas · 98 items · 33 facturas · 68.811 m³ · 20373.45 kg · $47241.79; la segunda corrida aborta en el preflight, comprobado en local; la purga dejó conteo cero antes de recargar). Pantallas: pendiente del smoke de Sam.
4. `deshacer.sql` (volver atrás, borrado lógico) deja los conteos vivos del lote en cero, con evidencia. `purgar.sql` (borrado definitivo, sólo prueba) deja en cero las filas del lote por su marca, incluidos los clientes y aliados que el lote creó; si una FK ajena lo impide, el camino es el reinicio de prueba (`resetear-base-prueba.sh`). En los dos casos la evidencia muestra el conteo cero por lote.
5. Spec y handoff al día; `pnpm docs:check`, `pnpm sdd:check`, `pnpm typecheck`, `pnpm lint` en verde.
6. Cierre de prueba: reinicio desde la semilla + paquetes `/srv/ops/paquetes/lote-*` borrados, con evidencia de conteo cero en las tablas de negocio y en `entity_audit_log` por `carga-consolidado:*` (Contabo, con OK del Director). Antes de producción, ninguna marca ni remitente con texto de nombre entra al lote sin normalizar o mapear.
