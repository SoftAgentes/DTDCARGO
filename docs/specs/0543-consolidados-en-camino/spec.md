---
sdd: "0543"
title: "Consolidados en camino: carga de contenedores desde el packing list"
status: in-progress
author: "founder"
created: 2026-10-16
updated: 2026-10-16
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
| `invoices` | una por cliente y contenedor, `borrador`, `invoice_code` siguiente `F-YYYY-NNNN`, snapshots del cliente (`client_rif`, `client_doc_kind`), USD, IVA según `tenants.iva_enabled`, `lines` una por embarque («Flete DDP · <remitente> · <cbm> m³ × $<precio>») más «Exceso de peso» cuando el valor $ kg extra es positivo, `fund_class 'third_party'`, `shipment_id/shipment_code` = primer embarque del cliente (la tarjeta «pendiente de aceptar» lo exige y el gate compara su medida), `notes` con el contenedor y los embarques. Aliados: al aliado raíz. |
| Auditoría | un `append_audit_event` por entidad creada, `p_actor_type 'system'`, `p_source 'job'`, `p_correlation_id 'carga-consolidado:<NN>:<sha8>'`. |

### Idempotencia y vuelta atrás

- `aplicar.sql` es una transacción con `\set ON_ERROR_STOP on`. El preflight aborta si ya existe el contenedor vivo con ese `container_no`, un `shipments.code`, un `receipt_code` o una factura del lote. Una segunda corrida no escribe nada.
- `verificar.sql` recuenta por lote (envíos, recepciones, cajas, items, facturas, Σ CBM, Σ kg, Σ base) y compara con `manifiesto.json`.
- `deshacer.sql` borra lógicamente lo del lote (facturas sólo en `borrador`, items de consolidación, recepciones, envíos y consolidación) con motivo y evento de auditoría, en una transacción, y se niega si alguna factura se emitió o si hay cajas estibadas, igual que los bloqueos de 0476. Es la vuelta atrás: los nombres siguen en la base.
- `purgar.sql` es el borrado definitivo para prueba (Sam pidió borrar los datos reales con evidencia): borra físicamente, en una transacción y en orden de dependencias, todo lo que el lote creó (facturas, recepciones con sus items/eventos/cajas, envíos con sus eventos, items del contenedor, el contenedor, su zarpe, la naviera si la creó el lote, y los clientes y aliados creados por el lote), y termina comprobando conteo cero por lote. Si una fila ajena al lote apunta a algo del lote (una aceptación de T&C, un reporte de pago del smoke), la FK lo aborta y el camino es el reinicio de prueba (`resetear-base-prueba.sh`). El log de auditoría es append-only (0267) y no lleva nombres: sus filas quedan como registro de la carga y de la purga.

### Marcas

- Producción/prueba con clientes reales: `previa.sql` resuelve cada marca con `resolve_markbox`; lo que no resuelve se lista para que Sam lo mapee en `marcas-mapa.json` (fuera de Git).
- Prueba con la semilla sintética: `--crear-clientes-faltantes` crea clientes mínimos (marca y nombre del Excel, sin contacto) y, para aliados, el aliado raíz con su prefijo. Sólo con `--entorno prueba`.

### Portal

- Estado de cuenta (`app/portal/(app)/facturas/page.tsx`, `lib/portal/statement-ledger.ts`): filas «Por aceptar» con el monto de los borradores DDP pendientes (lectura con admin scopeada como `listPendingAcceptanceInvoices`).
- Detalle (`app/portal/(app)/facturas/[code]/page.tsx`): para un borrador pendiente, en vez de 404, «Tienes que aceptar los T&C del portal para ver el detalle» con el botón a `/portal/facturas/[code]/aceptar`.

### Aviso (diseño; no se dispara en esta SDD)

Evento `carga_en_camino` en `CLIENT_JOURNEY_EVENTS`: un aviso por cliente y contenedor, anclado al primer envío del cliente, copy «Tu carga del contenedor NN viene en camino · N envíos · M facturas por aceptar · llega aprox. <ETA> · entra al Portal». Canal recomendado correo + push; aparece en la bandeja del Portal (0479). Antes de enviar, simulacro con la lista de destinatarios.

### Datos personales (revisar-datos-ve)

Inventario del lote: `clients.markbox`, nombre del cliente (snapshot), descripciones de mercancía. Sin teléfonos ni direcciones. Los Excel, el mapa de marcas, los SQL y los manifiestos viven fuera del repo; la evidencia en el VPS lleva sólo agregados y códigos (desde la corrección del 2026-10-16: `previa.sql` y los errores del lote no imprimen nombres). El paquete del lote en el servidor (`/srv/ops/paquetes/lote-NN/`) sí lleva nombres en todos sus archivos: forma parte del borrado final de prueba junto con `purgar` (o el reinicio), con `ls` vacío como evidencia. Los fixtures de pruebas usan marcas y nombres inventados. Prueba corre con la lista de IP de Sam mientras tenga datos reales y se limpia al terminar (SDD-0540, runbook `entorno-prueba.md` §2.1).

## Criterios de aceptación

1. `corepack pnpm vitest run scripts/__tests__/consolidados` en verde: parsers, resolución de marcas, SQL generado, preflight que aborta con duplicados, deshacer que se niega con factura emitida.
2. Corrida en seco del 59: `resumen.md` con 50 envíos, 50 recepciones, 98 items, 1.288 cajas, 33 clientes, 33 facturas, 68,811 m³, 20.373,45 kg y base $48.652,84 (o $47.241,75 con `--sin-exceso-peso`), con los avisos y la lista de marcas a resolver. CUMPLIDO el 2026-10-16 (lote `carga-consolidado:59:8dd77b3c`).
3. En prueba: `verificar.sql` cuadra con `manifiesto.json`; una segunda corrida de `aplicar.sql` aborta; CN muestra las recepciones en `consolidado` fechadas 2026-08-10; Naviera muestra el contenedor zarpado con ETA; Tracking lista los envíos `in_transit`; Facturación lista los borradores; un cliente de prueba ve sus envíos agrupados por contenedor y sus facturas «por aceptar». **Parte SQL CUMPLIDA** el 2026-10-16 23:28Z en `dtd-cargo-staging` (v5, e2cbeec0; verificar PASÓ con los conteos del manifiesto; la segunda corrida aborta en el preflight, comprobado en local). Pantallas: pendiente del smoke de Sam.
4. `deshacer.sql` (volver atrás, borrado lógico) deja los conteos vivos del lote en cero, con evidencia. `purgar.sql` (borrado definitivo, sólo prueba) deja en cero las filas del lote por su marca, incluidos los clientes y aliados que el lote creó; si una FK ajena lo impide, el camino es el reinicio de prueba (`resetear-base-prueba.sh`). En los dos casos la evidencia muestra el conteo cero por lote.
5. Spec y handoff al día; `pnpm docs:check`, `pnpm sdd:check`, `pnpm typecheck`, `pnpm lint` en verde.
