---
sdd: "0559"
title: "Radiografía de integridad contable repetible"
status: in-progress
author: "founder"
created: 2026-10-18
updated: 2026-10-19
supersedes: null
superseded_by: null
related: ["0040", "0041", "0044", "0068", "0134", "0137", "0557", "0558"]
confidencialidad: interno
---

# SDD-0559 — Radiografía de integridad contable repetible

> La consulta con la que el Director midió producción el 2026-10-18 pasa a ser un script versionado de solo lectura, `scripts/qa/radiografia-integridad.sql`, con las definiciones corregidas, las filas que faltaban y una prueba que falla si una definición vuelve a la versión equivocada o si la salida filtra un dato de negocio.

## Contexto

El diagnóstico contable del 2026-10-18 (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`) pide en su tarea 1.1 (§8, fase 1) una «radiografía de integridad repetible». El Director ya la corrió una vez, el 2026-10-18 hacia las 23:00Z, con la autorización de Sam «autorizo la radiografía 1.1 con conteos y sumas, sin datos personales». Esa corrida dejó en el §0 del diagnóstico solo conteos y comparaciones, sin montos.

Aquella consulta fue un SQL escrito para la ocasión y tenía definiciones que daban cifras equivocadas (ver «Lo que corrige»). Además, le faltaba cruzar el cobrado de cada factura contra sus fuentes, que el §0 pide para la próxima corrida. Esta SDD la convierte en un script del repo. Se corre antes de cada migración de reparación de la fase 2, siempre con autorización escrita de Sam.

## Decisión

- **Un archivo de solo lectura**, que el Director pasa por stdin a psql en el VPS: `scripts/qa/radiografia-integridad.sql`. Su primera línea útil es `\set ON_ERROR_STOP on`; abre una transacción con `begin transaction read only;`, fija `statement_timeout` 60 s y `lock_timeout` 5 s, y termina en `rollback;`. Entre esa primera sentencia y el `rollback;` final no hay ningún control de transacción. Solo usa las metaórdenes `\set`, `\if`, `\else` y `\endif`. Tiene la forma que `infra/ops/migraciones/aplicar.sh:114-117` exige a una lectura previa, y la prueba exige además lo del medio.
- **Una sola tabla de salida**: `orden · seccion · indicador · n · monto_usd`. Cada indicador tiene una sola definición, que comparten los dos modos.
- **Dos capas de prueba.** El comportamiento se prueba en PGlite, en el CI de calidad y sin Docker, sobre una fixture que aplica las migraciones reales de las tablas que lee el script. La compatibilidad con el esquema completo la prueba un paso nuevo de `scripts/check-schema-rebuild.mjs`.
- **No convierte monedas.** Un documento en VES o CNY se cuenta, pero no entra en las sumas en USD. La regla de conversión ya existe en seis lugares y la radiografía no agrega una séptima (B8).
- **Sin migración, sin envoltorio de shell y sin script en `package.json`.** El comando exacto va en la cabecera del SQL y en esta spec.

## Lo que corrige de la consulta del Director

| # | Antes | Ahora | Evidencia |
|---|---|---|---|
| 1 | «Vivo» era `status <> 'anulado'`, así que contaba los borradores | `status = 'asentado'` y `deleted_at` nulo, lo mismo que suman los saldos | `lib/studio/account-queries.ts:154-175`, `lib/studio/journal-queries.ts:214-218` |
| 2 | Una factura con solo un crédito de referido contaba como asentada | El asiento de una factura es el de origen `invoice` | `lib/studio/accounting/referral-credit-posting.ts:204-216`: el asiento del crédito también lleva `invoice_id` |
| 3 | «Recibo sin asiento» era `journal_entry_id is null` | Sin asiento vivo de origen `receipt` por ninguno de los dos lados; aparte, los que apuntan a un asiento anulado y los que tienen asiento pero no vínculo | `lib/studio/collections-actions.ts:215-219` guarda el vínculo solo si el posting devuelve el id; `receipt-posting.ts:203-211` no lo devuelve si ya hay un asiento no borrado, aunque esté anulado |
| 4 | El saldo de CxP sumaba las anuladas | Solo las no anuladas | `0088_tesoreria.sql:74` (status de texto); `0294_audit_d2_human_reasons.sql:217-223`: anular exige `paid_amount = 0` |
| 5 | «Sin asiento» no miraba `vencida` | Se incluye por defensa | `0077_invoices.sql:12`. Hoy nadie la escribe (`app/studio/(app)/facturacion/actions.ts:6`, «vencida se deriva visual»), así que no corrige una cifra real |
| 6 | USDT contaba como moneda sin tasa | VES y CNY en una fila; USDT en otra, solo informativa | `receipt-posting.ts:75-85` y `bill-posting.ts:63-73` asientan USDT 1:1. La moneda funcional es la decisión 1 del §9 del diagnóstico (Sam y la contadora) |
| 7 | Partida doble con join interno: un asiento sin líneas no aparecía | `left join` y la fila «menos de dos líneas» | — |
| 8 | 1.1.2 y 2.1.1 comparados en total | Por tenant: dos diferencias de signo contrario ya no se cancelan | `0078_contabilidad.sql`: `unique (tenant_id, code)` en `accounts` |
| 9 | Solo la cuenta exacta | La cuenta y sus subcuentas (`code like 'x.%'`) | El rollup por código de `account-queries.ts:95-136` |
| 10 | El cobrado no se cruzaba | `paid_amount` contra los recibos vivos y contra las tres fuentes | El §0 del diagnóstico lo pide; los escritores, en «Definiciones canónicas» |
| 11 | Los reportes cancelados salían como «reportado» | Estado derivado «cancelado» | `0421_payment_report_commands.sql:46-47`: la cancelación deja el reporte en `reportado`, con `cancelled_at` |
| 12 | Un 0 contra 0 salía como «cuadra» | «Sin movimiento en la cuenta», en su propia fila | En el §0, la fila de 2.1.1 de la primera corrida dice «cuadra» con 0 en el mayor y 0 en CxP |
| 13 | Una factura VES asentada contaba como diferencia | «No comparable» (decisión 7) | B2: la factura se asienta al nominal (`invoice-posting.ts:28-37`, `:75`, `:151`; `facturacion/actions.ts:571`) y el recibo convierte (`receipt-posting.ts:75-85`) |
| 14 | Un recibo anulado cuyo único asiento vivo es la reclasificación no aparecía | Fila propia, separada de la del asiento de cobro | `receipt-posting.ts:427` (origen `receipt`) y `:490` (origen `receipt_reclass`) |

### Lo que corrigió la revisión adversaria (2026-10-19)

| # | Hallazgo | Ahora | Evidencia |
|---|---|---|---|
| R1 | Un asiento de venta vivo cuya factura está borrada, o sin `invoice_id`, inflaba 1.1.2, 4.5 y 2.1.5 y salía como «mayor por encima» sin explicación | Fila 47. Es defensiva: desde la SDD-0465, `softDeleteInvoice` solo borra borradores, y el asistente de la SDD-0560 solo elimina borradores sin asiento vivo (spec 0560, matriz de dependencias). Cubre los borrados de antes de la 0465 y la escritura directa (B16) | `0078_contabilidad.sql:52` (`invoice_id` con `on delete set null`); `app/studio/(app)/facturacion/actions.ts:746-756` |
| R2 | Un pago sin referencia en VES volvía «no comparable» a 1.1.2 aunque su asiento va a 2.1.8 | Solo cuenta el recibo con factura | `receipt-posting.ts:376-378` («NO toca CxC ni ingresos»); CHECK `payment_receipts_sinref_invoice_check` de `0122_recibos_cobranza.sql` |
| R3 | El crédito se unía a su asiento por la factura: dos errores en la misma factura se tapaban | `journal_entries.referral_id` o `referrals.applied_entry_id` | `referral-credit-posting.ts:462-464`; `app/studio/(app)/fidelizacion/actions.ts:521-525` |
| R4 | Las filas 80 y 83 contaban como «igual» la factura sin cobrado ni fuentes | Exigen algo que comparar; el 0 contra 0 va a la fila 87 | El mismo criterio de la corrección 12 |
| R5 | Un recibo con asiento de cobro vivo cuyo vínculo apunta a un asiento anulado o borrado no salía en ninguna fila | Fila 58 | `collections-actions.ts:215-219`: el vínculo se guarda solo si el posting devuelve el id |
| R6 | El desvío 3 decía que la CxP anulada se asienta convertida | Solo con tasa > 0; sin tasa queda al nominal y sigue como diferencia (ver «Decisiones del Director») | `bill-posting.ts:58-72` |

## Definiciones canónicas

La SDD-0557 (Reportes y «Por contabilizar» en el Studio) ya las adopta en su sección «Definiciones del cruce (canónicas de la SDD-0559)». La SDD-0558 (saldo único del cliente) tiene que adoptarlas para el lado «facturas». Con un mismo dato, los tres lugares tienen que contar igual.

- **Asiento vivo:** `journal_entries.status = 'asentado'` y `deleted_at` nulo. El borrador y el anulado no cuentan.
- **Origen por `source`:**
  - factura → `invoice`;
  - recibo → `receipt`, y su reclasificación al identificarlo → `receipt_reclass`;
  - cuenta por pagar → `supplier_bill`;
  - pago a proveedor → `supplier_payment`;
  - crédito de referido → `referral_credit`.

  Un `referral_credit` también guarda `invoice_id` y no es el asiento de venta. El `source` es texto libre (`0078_contabilidad.sql:51`), así que la salida lo reduce a 14 orígenes conocidos más «otro».
- **Vínculo en los dos sentidos:** `doc.journal_entry_id = asiento.id` o `asiento.<doc>_id = doc.id`. Las facturas no tienen `journal_entry_id`. Un mismo asiento unido por los dos lados cuenta una vez.
  - Un recibo tiene el **vínculo viejo** cuando tiene asiento de cobro vivo pero su `journal_entry_id` apunta a otro asiento: anulado, borrado o de otro origen (fila 58).
  - Dos ramas son defensivas: hoy ningún escritor las vuelve decisivas, pero se miden igual. La reclasificación unida por `payment_receipts.journal_entry_id`: ese vínculo solo lo escribe el cobro (`collections-actions.ts:218` y `:317`), y la identificación no lo toca. Y el filtro de origen de CxP y pagos: `bill_id` y `supplier_payment_id` solo los escriben sus postings (`bill-posting.ts:185-186`, `supplier-payment-posting.ts:189-190`). Este segundo filtro tiene trampa en la fixture: los manuales MBA1 y MOP1.
- **Anulado:** la factura y la CxP, por `status = 'anulada'`; el recibo y el pago, por `deleted_at`. Las facturas y CxP borradas (`deleted_at`) no se leen como documentos. Sus asientos vivos sí se ven: la fila 47 cuenta los asientos de venta vivos cuya factura está borrada o no existe (`invoice_id` nulo).
- **Facturas abiertas:** emitidas, parciales, pagadas o vencidas, sin borradores ni anuladas. Es el mismo conjunto que «documentos vivos» en «sin asiento». `vencida` se incluye por defensa: hoy nadie la escribe.
- **Saldo:** `total_amount − paid_amount`, con signo y sin convertir. Solo entra en la suma el documento en USD o USDT.
- **Las tres fuentes del cobrado:** recibos vivos, reportes confirmados vivos y créditos de referido aplicados no borrados. `paid_amount` tiene **cinco escritores**:
  - el cobro de 0467 (`0467_cobro_factura_atomico.sql:240`);
  - la confirmación de reportes de 0464 (`0464_reporte_pago_factura_pagada.sql:312`);
  - el crédito de referido de 0471 (`0471_credito_referido_atomico.sql:272-277`), que es un abono no monetario, sin recibo;
  - `run_report_command` de 0421 (`0421_payment_report_commands.sql:316`);
  - `confirm_payment_report`, heredada de 0359 (`0359_confirm_payment_report_exige_rol.sql:99-116`), que sigue ejecutable hasta que se aplique la `0422_payment_report_command_boundary.sql`.

  El modelo de tres fuentes se sostiene porque los dos escritores de reportes los dejan en `confirmado`. Por eso ya no vale la invariante del comentario de `scripts/qa/cobro-factura-race.mjs:20-22` (recibos + reportes): le faltan los créditos.

  Cada factura cae en una sola fila contra los recibos (80, 81, 82 u 87) y en una sola contra las tres fuentes (83, 84, 85 u 87). «Igual» exige algo que comparar: cobrado > 0 o fuentes > 0. La factura sin cobrado ni fuentes es un 0 contra 0 y va a la 87.
- **Crédito ↔ asiento:** un crédito aplicado tiene asiento si hay uno vivo de origen `referral_credit` unido por cualquiera de los dos lados. El lado del asiento es `journal_entries.referral_id`; el del documento, `referrals.applied_entry_id`. Este segundo lado es el que usa la reversión para los asientos viejos sin `referral_id` (`referral-credit-posting.ts:462-464`). La factura (`applied_invoice_id`) no sirve de vínculo: un asiento colgado y un crédito sin asiento en la misma factura se taparían entre sí. Esa columna se lee solo para el cobrado.
- **Estados de 1.1.2 y 2.1.1, por tenant con movimiento:** se evalúan en este orden, y gana el primero que se cumple. Cada tenant cae en uno solo, y la prueba lo verifica.

| # | Estado | Cuándo |
|---|---|---|
| 1 | Sin movimiento en el mayor | La cuenta, con sus subcuentas, no tiene debe ni haber de asientos vivos y hay documentos abiertos con saldo, en cualquier moneda (decisión 6). |
| 2 | No comparable | En 1.1.2, una factura no borrada en VES o CNY con su asiento `invoice` vivo, o un recibo vivo **con factura** en VES o CNY con su asiento `receipt` vivo. En 2.1.1, una CxP no anulada o un pago vivo, fuera de USD/USDT, con su asiento vivo de origen (decisión 7). |
| 3 | Sin movimiento en la cuenta | La cuenta no tiene debe ni haber y no hay documentos con saldo: es un 0 contra 0, no una verificación. Un borrador, una anulada o una pagada con total = cobrado no tienen saldo abierto (tenant M). |

El recibo sin factura es el pago sin referencia: el CHECK `payment_receipts_sinref_invoice_check` de 0122 ata `recibido_sin_ref` a `invoice_id` nulo. Se asienta contra 2.1.8 y no toca 1.1.2 (`receipt-posting.ts:376-378`) hasta que se identifica. La identificación le escribe la factura (`0467_cobro_factura_atomico.sql:312-313`), así que el recibo identificado cuenta, aunque su asiento de cobro haya ido a 2.1.8 (tenant I).
| 4 | Cuadra, mayor por encima, mayor por debajo | El saldo del mayor contra la suma en USD/USDT, con tolerancia cero (`round 2`). |

### Decisiones del Director (2026-10-19)

Las dos son **decisión del Director, 2026-10-19, revisable por Sam**. Este es el texto literal, el mismo que cita la spec de la SDD-0557:

> **6. Sí:** el mayor vacío también gana en el subdiario de clientes (regla E1 de la 0559). Con un mismo dato, Reportes y «Por contabilizar» tienen que decir lo mismo. Cuando 1.1.2 no tiene movimiento vivo, la comparación muestra «sin movimiento en el mayor» en vez de una diferencia. Hoy es el caso real: 5 facturas sin asiento y el mayor en cero.
>
> **7. Sí:** «no comparable» cuenta solo las facturas VES o CNY **con asiento vivo**, porque esas son las que distorsionan 4.5 (B2). Una VES o CNY sin asiento ya cae en «sin asiento» (B3), y contarla dos veces confundiría.

En esta radiografía, las dos decisiones se aplican igual a 2.1.1, por simetría. La SDD-0557 aplica la decisión 6 a proveedores, pero no «no comparable», porque su subdiario convierte con la regla del asiento. Esta radiografía no convierte, así que cuenta como «no comparable» una CxP o un pago fuera de USD/USDT con asiento vivo.

**La CxP anulada no vuelve «no comparable» a 2.1.1, con tasa o sin ella.** `bill-posting.ts:58-72` asienta convertido solo con tasa > 0; sin tasa asienta el monto tal cual, al nominal. Aun así, su asiento vivo es B1 (fila 44) y queda como diferencia, igual que en la SDD-0557, que salta las anuladas y no tiene «no comparable» en proveedores (`subdiario.ts`, `if (b.status === "anulada") continue`). La trampa es BP1, del tenant P: CNY, anulada, sin tasa y con su asiento vivo. P queda «mayor por encima». El límite: si ese monto nominal convive con otra diferencia en USD, el signo del total puede cambiar. Por eso la fila 44 es la que lo dimensiona.

### Dónde coincide con la SDD-0557 y dónde no

- **Sin asiento.** La fila 50 es la lista de la 0557 para facturas: sus motivos «sin asiento», «asiento anulado» y «sin monto» juntos. La 0557 cuenta aparte «sin monto» (monto ≤ 0, que el posting no asienta).
- **Recibos anulados con asiento vivo.** La 0557 mira solo el origen `receipt`, igual que la fila 42. La reclasificación va en la fila 43.
- **VES con tasa sin asiento.** El subdiario de la 0557 la convierte y la suma, así que puede decir «no cuadra». La radiografía no la suma y puede decir «cuadra». La fila 96 cuenta esos tenants, y la 106 hace lo mismo en 2.1.1. Las dos reglas coinciden cuando no hay documentos abiertos en VES/CNY.
- **Borrador con asiento vivo.** La radiografía no filtra el estado de la factura para «no comparable», y la 0557 no lee los borradores. No llegan a diferir porque el asiento de venta nace al emitir (`facturacion/actions.ts:396`, `:565`). Esto es INFERIDO, sin un recorrido de todos los escritores.
- **Subcuentas.** La 0557 hace el rollup por código y exige que exista la cuenta padre. La radiografía usa el prefijo. Con un plan de cuentas normal dan lo mismo.
- **El recibo de «no comparable» (divergencia abierta, R2).** La 0557, ya en `main`, cuenta para su K10 cualquier recibo vivo en VES o CNY con asiento `receipt` vivo (`lib/studio/accounting/libro-control-queries.ts:341-347`), con o sin factura. La radiografía cuenta solo los que tienen factura, porque el pago sin referencia se asienta contra 2.1.8 y no toca 1.1.2. Con un pago VES sin referencia asentado, la 0557 dice «no comparable» y la radiografía compara (tenant K: cuadra). Mientras no se decida, rompe la regla de arriba («los tres lugares tienen que contar igual»). La decisión es del Director: alinear la 0557 en una SDD de seguimiento o aceptar la diferencia. Hoy no tiene efecto en producción: el §0 mide 0 asientos vivos.
- **El vínculo viejo del recibo.** La 0557 une por los dos lados y no distingue adónde apunta `journal_entry_id` cuando ya hay un asiento vivo (`libro-control.ts`). La fila 58 es nueva y no tiene par en la 0557.

## Salida

En el modo por defecto (conteos), `n` siempre es un conteo y `monto_usd` va vacío. Es lo **único** que puede ir a Git, a un handoff o a un documento. Sobre el esquema vacío salen 63 filas fijas en cero. Las filas que agrupan (20, 30, 70 y 120) aparecen cuando hay datos.

| Sección | Filas |
|---|---|
| 0 · tamaño | 10 tenants con movimiento; 11 facturas; 12 asientos asentados vivos; 13 recibos vivos; 14 reportes; 15 CxP; 16 pagos vivos |
| 1 · documentos por estado y moneda | 20 facturas · estado · moneda; 21 no borrador en VES/CNY sin tasa (nula o ≤ 0); 22 USDT sin tasa (informativa); 23 facturas VES/CNY con asiento de venta vivo; 24 recibos vivos VES/CNY con asiento de cobro vivo (las dos últimas dimensionan la 2.3) |
| 2 · asientos | 30 asientos · estado · origen |
| 3 · B1 anulados con asiento vivo | 40 facturas; 41 de ellas con abonos (cobrado > 0 o recibo vivo); 42 recibos con asiento de cobro; 43 recibos con reclasificación; 44 CxP; 45 pagos; 46 asientos `referral_credit` vivos sin crédito aplicado; 47 asientos de venta vivos cuya factura está borrada o no existe |
| 4 · B3 sin asiento vivo | 50 facturas abiertas; 51 recibos vivos; 52 de ellos con vínculo a un asiento anulado (un vínculo a un asiento borrado o en borrador queda solo en la 51); 53 recibos con asiento pero sin vínculo; 54 recibos identificados sin reclasificación; 55 CxP vivas; 56 pagos vivos; 57 créditos aplicados sin asiento; 58 recibos con asiento de cobro vivo y el vínculo a otro asiento (anulado, borrado o de otro origen) |
| 5 · más de un asiento vivo de su origen | 60 facturas; 61 recibos; 62 CxP; 63 pagos (dimensionan el índice único de la 2.2) |
| 6 · B4 reportes | 70 reportes · estado (con «cancelado»); 71 confirmados; 72 en otra moneda que su factura; 73 con un recibo vivo del mismo monto |
| 7 · cobrado contra sus fuentes | 80-82 igual, mayor o menor que los recibos vivos; 83-85 igual, mayor o menor que las tres fuentes («igual» exige cobrado > 0 o fuentes > 0); 86 anuladas con cobrado; 87 sin cobrado ni fuentes |
| 8 · 1.1.2 | 90 sin movimiento en el mayor; 91 no comparables; 92 sin movimiento en la cuenta; 93 cuadran; 94 mayor por encima; 95 mayor por debajo; 96 de los comparados, con facturas VES/CNY fuera de la suma; 97 asientos manuales vivos en 1.1.2 |
| 9 · 2.1.1 | 100-105, los mismos estados; 106 de los comparados, con CxP VES/CNY fuera de la suma |
| 10 · B16 partida doble | 110 debe ≠ haber; 111 menos de dos líneas |
| 11 · B5 por año | 120 año de emisión de las no borrador; 121 sin fecha |
| 12 · 4.5 y 2.1.5 | 130 y 131 asientos vivos que tocan cada cuenta, con sus subcuentas |

**Modo montos (`-v montos=on`).** Sam autorizó «conteos y sumas», así que el modo se conserva, pero acotado:

- `monto_usd` se llena solo en seis filas, todas de documentos en USD o USDT: 40, 50, 51, 71, 84 y 85;
- las filas del mayor no llevan monto, porque el mayor mezcla monedas (B2);
- cada sección empieza con la marca `MONTOS-NO-VA-A-GIT · `.

Esa salida es solo para la conversación. La prueba recorre `docs/` y `.agents/` y falla si encuentra una fila con la marca seguida del número de sección.

**Privacidad por diseño:**

- la salida solo proyecta literales, los enums cerrados (`invoice_status`, `invoice_currency`, `entry_status`, `payment_report_status`), el año como entero y `count`/`sum`;
- el script no lee nombres, RIF, Shipping Mark, códigos de documento, memos, notas ni referencias;
- no tiene divisiones ni conversiones de texto a número, así que un error no puede citar un valor; se corre con `VERBOSITY` terse;
- de `public.referrals`, que la corrida del 2026-10-18 no leía, solo lee `id`, `status`, `reward_usd`, `applied_invoice_id`, `applied_entry_id` y `deleted_at`. Esa tabla tiene datos personales (nombre, correo y teléfono del referido) que el script nunca nombra;
- la salida tiene exactamente cinco columnas, y en modo conteos ningún valor tiene forma de monto. La prueba lo verifica.

## Cómo se corre en producción

1. Solo con una **autorización escrita de Sam** que nombre esta radiografía, diga si es con montos y nombre la migración de reparación que dimensiona, si la hay. Texto propuesto: «autorizo la radiografía SDD-0559 [con montos] antes de la NNNN». La próxima autorización tiene que mencionar que ahora también lee `public.referrals`, solo en las seis columnas de arriba (`id`, `status`, `reward_usd`, `applied_invoice_id`, `applied_entry_id` y `deleted_at`). El Director registra el texto literal.
2. La corre el **Director**, desde la raíz de un checkout de `main`:

   ```
   MSYS_NO_PATHCONV=1 /c/Windows/System32/OpenSSH/ssh.exe -o BatchMode=yes root@<vps> \
     'docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X -q -A -F "|" -P footer=off \
      -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never' \
     < scripts/qa/radiografia-integridad.sql
   ```

   Para los montos, se agrega `-v montos=on` dentro de las comillas. Corre en una transacción de solo lectura y termina en ROLLBACK. Si coincide con una migración que tome ACCESS EXCLUSIVE, `lock_timeout` 5 s la hace fallar sin esperar, y se reintenta en otra ventana.
3. **En Git solo va la salida de conteos.** Una salida con montos no se pega en docs/ ni en .agents/, y la prueba lo vigila. Un monto copiado a mano y sin la marca no lo ve nadie: esa regla sigue dependiendo de quien escribe.
4. Esta SDD no corre nada contra producción.

## Pruebas y controles rojos

**`scripts/__tests__/radiografia-integridad.test.ts`** corre en PGlite, en `pnpm test` y en el CI de calidad. Todo lo que afirma vive en el mismo archivo: los esperados, los mutantes y los controles. No depende de ningún `.txt`.

- **La fixture** `scripts/qa/radiografia-integridad.fixture.sql`:
  - aplica con `\ir` las migraciones reales `0077_invoices.sql`, `0078_contabilidad.sql`, `0079_cobranzas.sql`, `0088_tesoreria.sql`, `0098_fidelizacion_referidos.sql`, `0122_recibos_cobranza.sql`, `0195_payment_reports.sql` y `0237_referral_credit_apply.sql`;
  - agrega las tres columnas y el CHECK de cancelación que `0421_payment_report_commands.sql:41-50` suma a `payment_reports`. El resto de esa migración pide auditoría, identidad y el bucket, y la radiografía no lo lee;
  - siembra dieciséis tenants trampa (A-N, P y S), con CENTINELA en cada texto;
  - aborta si la base ya tiene objetos de aplicación.

  Las trampas por tenant:
  - **A** reúne la mayoría de las trampas por documento. Entre ellas:
    - el crédito unido por `applied_entry_id` (Q1) y el asiento de crédito colgado en la factura de un crédito sin asiento (AQ5 y Q2);
    - los recibos con vínculo viejo (R14 y R15), con vínculo a un asiento borrado o en borrador (R16 y R17) y con su asiento unido solo por el lado del documento (R18);
    - los recibos anulados de F5 y F10 (R19 y R20);
    - los borradores CNY y USDT sin tasa (F23 y F24);
    - los manuales con `bill_id` y `supplier_payment_id` (MBA1 y MOP1);
  - **B** cuadra pese a un borrador, una CxP anulada y documentos VES/CNY sin saldo abierto (una anulada y dos pagadas);
  - **C** y **D** tienen diferencias de signo contrario, en subcuentas;
  - **E** tiene VES y CNY con asiento, y dos manuales con dos líneas en la misma cuenta de control (ME2 y ME3);
  - **F** no tiene movimiento;
  - **G** es la trampa de B2: una factura VES pagada, asentada al nominal, con su recibo convertido;
  - **H** tiene una VES sin asiento junto a 1.1.2 en dólares;
  - **I** prueba que el mayor vacío gana, aunque su recibo VES identificado lo volvería no comparable;
  - **J** tiene documentos con dos asientos y una VES anulada con asiento;
  - **K** tiene un pago VES sin referencia asentado contra 2.1.8 y cuadra (R2);
  - **L** tiene solo proveedores;
  - **M** marca el límite de la decisión 6: sin asientos vivos y solo con documentos sin saldo abierto, da «sin movimiento en la cuenta» en las dos cuentas;
  - **N** es no comparable solo por un recibo VES con factura;
  - **P** tiene el mayor por encima por asientos que ningún documento explica: dos asientos de venta huérfanos y la CxP CNY anulada sin tasa;
  - **S** tiene un recibo y un pago VES anulados con su asiento vivo, y sigue siendo comparable.
- **Casos:**
  - el esquema vacío da las 63 filas fijas en cero;
  - los 96 conteos esperados, revisados a mano contra la fixture;
  - cada tenant cae en un solo estado por cuenta;
  - cada factura cae en una sola fila del cobrado, contra los recibos y contra las tres fuentes;
  - la privacidad del modo conteos: exactamente las cinco columnas, `n` entero, monto nulo, ningún valor con forma de monto, vocabulario cerrado y ningún CENTINELA, ni siquiera el del origen libre;
  - el modo montos: la marca en cada sección, los mismos conteos y los seis montos. El número de la cabecera se deriva del mismo mapa de montos que se afirma.
- **69 mutantes**, cada uno afirmado sobre todas las filas que cambia y solo sobre esas:
  - 7 reproducen la consulta del Director: vivo = no anulado, factura sin filtrar el origen, recibo sin asiento = sin vínculo, CxP abiertas con las anuladas, sin `vencida`, USDT sin tasa y partida doble con join interno;
  - 62 prueban las reglas nuevas. Entre ellas:
    - la regla vieja de «no comparable» por saldo abierto (G y J), «no comparable» sin exigir el asiento (H), con los recibos sin referencia (K), con los recibos anulados y con los pagos anulados (S);
    - el mayor vacío que no gana (I) y cada condición de los documentos «abiertos» (M);
    - el 0 contra 0 como «cuadra» y como cobrado «igual»;
    - los tres disyuntos de «con abonos», el recibo anulado del mismo monto que un reporte, el vínculo a cualquier asiento y el vínculo viejo;
    - los dos lados del vínculo de recibos, CxP, pagos y créditos, el respaldo viejo por la factura, el asiento contado dos veces y el filtro de origen de CxP y pagos;
    - los asientos de venta huérfanos, las subcuentas de las cuatro cuentas y el `distinct` de 97, 130 y 131;
    - la tasa cero, la CNY sin tasa, los borradores de 21, 22 y 120, «fuera de la suma» sin abierta y sin saldo, los créditos borrados y la cancelación.
- **Controles rojos de privacidad:**
  - proyectar `client_name` hace que aparezca CENTINELA;
  - quitar la máscara pone montos en el modo conteos;
  - una sexta columna `monto as monto_crudo` rompe la forma y trae montos.
- **Revisión estática** sobre el SQL sin comentarios: el script no nombra ninguna columna de texto del negocio de la lista prohibida y no tiene ninguna palabra que escriba (`insert`, `update`, `delete`, `merge`, `into`, DDL, `nextval`, `setval`), sin exigir su forma completa. Un `update … as i set` o un `update only` se detectan. La fuga también se detecta antes de correr nada.
- **Forma psql de solo lectura**: fallan las variantes con `begin;` al inicio o `commit;` al final, y cualquier control de transacción en el medio: `commit`, `end`, `abort`, `rollback`, `begin`, `start transaction`, `savepoint`, `release`, `prepare transaction`, `set transaction` y `set session characteristics`. Hay un control con el mutante de la revisión: un `commit;`, un `update … as i set` y un `start transaction read only;` después de los `set local`. También fallan una metaorden con sangría (`  \! …`) y una al final de una sentencia (`… \gexec`), que psql ejecuta igual.
- **Guarda de Git**: ninguna fila con la marca de montos en `docs/` ni en `.agents/`. Un control sintético comprueba que la función la detecta.

**`scripts/check-schema-rebuild.mjs`** corre la radiografía por stdin sobre las migraciones reconstruidas, después del contrato de aislamiento, una sola vez y en modo conteos. Exige exit 0 y la forma: cinco columnas, `n` entero y monto vacío. Así detecta un renombre de columna que la fixture de PGlite no ve. Necesita Docker, así que corre dentro de `verify` y no en el CI de calidad (`scripts/__tests__/ci-workflow-contract.test.mjs:65`). El control rojo es manual: una copia del script con una columna inexistente, pasada con `SCHEMA_REBUILD_RADIOGRAFIA`, tiene que salir 1 con «la radiografía de integridad no corre sobre el esquema completo».

El paso no toca `LEDGER_ONLY`. Sus consumidores leen solo ese bloque y no cambian:

- `scripts/qa/cobro-factura-race.mjs:49`;
- `infra/ops/consolidados/validar-lote-local.sh:60`;
- `infra/ops/staging/resetear-base-prueba.sh:115`;
- `infra/ops/tests/prueba-scripts-entorno-prueba.sh:213`;
- `scripts/verify.mjs:504`, que lo ejecuta;
- `package.json:50` (`schema:rebuild:supabase`).

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `scripts/qa/radiografia-integridad.sql` | nuevo: la radiografía |
| `scripts/qa/radiografia-integridad.fixture.sql` | nuevo: la fixture sintética |
| `scripts/__tests__/radiografia-integridad.test.ts` | nuevo: la prueba en PGlite |
| `scripts/check-schema-rebuild.mjs` | el paso de la radiografía sobre el esquema completo |
| `docs/specs/0559-radiografia-integridad-repetible/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0559-radiografia-integridad-repetible.md` | handoff |

## Criterios de aceptación

1. La primera línea útil del script es `\set ON_ERROR_STOP on`, su primera sentencia es `begin transaction read only;` y la última es `rollback;`, sin ningún control de transacción en el medio. Solo usa `\set`, `\if`, `\else` y `\endif`.
2. Sin banderas devuelve una tabla de cinco columnas en la que `n` es siempre un conteo entero, `monto_usd` va vacío y ningún valor tiene forma de monto. Ninguna celda trae texto de una fila de negocio.
3. Con `-v montos=on` trae montos en seis filas de documentos en USD/USDT y la marca en cada sección. Ninguna otra fila cambia su `n`.
4. Aplica las definiciones canónicas de esta spec, con las decisiones 6 y 7.
5. La prueba en PGlite pasa. Cada uno de los 69 mutantes, las tres fugas (`client_name`, la máscara y la sexta columna), las variantes `begin;` y `commit;`, cada control de transacción en el medio, las metaórdenes escondidas, la escritura con alias y la fila sintética con la marca la hacen fallar en su aserción.
6. `check-schema-rebuild` corre la radiografía sobre el esquema completo y falla en rojo con una columna renombrada.
7. No hay migración y no cambia `supabase/migrations-baseline.json`.
8. Ni esta spec ni su handoff traen una salida en modo montos.

## Fuera de alcance

| Tema | Dueño |
|---|---|
| Correr la radiografía en producción | El Director, con la autorización escrita de Sam |
| Reparar B1-B5 y B16, y la bandeja «Asientos no creados» | Fase 2 del plan: 2.2, 2.3, 2.5 y 2.7 |
| Gastos vivos sin asiento `expense` (el quinto documento best-effort: `expense-posting.ts:1-20`, `0132_expense_posting.sql:26`) | SDD 2.2 (unicidad por origen) |
| Proveedores sin RIF: contarlos obliga a leer `suppliers.tax_id`, que está en la lista prohibida | Fase 3 (libros fiscales, 3.4) |
| Número de control: `invoices.control_number` no existe | Fase 3 (3.1) |
| El pasivo paralelo 2.1.7 del socio China y los cargos de `supplier_charges` (B11). La comparación es solo 2.1.1 contra `supplier_bills` | Fase 4 (4.7) |
| Los reportes del Studio | SDD-0557 |
| Alinear el recibo de «no comparable» entre la 0557 (cualquier recibo VES/CNY con asiento) y esta radiografía (solo con factura), R2 | El Director: SDD de seguimiento o diferencia aceptada |
| Recibos y pagos anulados fuera de USD/USDT, sin tasa y con asiento vivo: quedan al nominal (`receipt-posting.ts:81-84`, `supplier-payment-posting.ts:70-72`) y hoy salen como diferencia, igual que la CxP de P | El Director, si decide volverlos «no comparable» en los tres lugares a la vez |
| Un envoltorio de shell con candado de autorización, un script en `package.json` o un runbook propio | No se hace: el comando vive en la cabecera |

## Gobernanza

| Política o regla | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio (AGENT-BRIEF) | no aplica | No toca `app/` ni `lib/`. Igual lleva su spec con allowlist exacta |
| Privacidad (`revisar-datos-ve`) | cumplimiento | Solo agregados: la prueba siembra CENTINELA, revisa la lista de identificadores prohibidos y tiene dos controles rojos. No captura, mueve ni borra datos personales |
| Producción Supabase y runbook de migraciones | cumplimiento | La tarea no lee ni escribe producción y no trae migración. La corrida es del Director, con autorización escrita |
| Montos fuera de Git | cumplimiento | La guarda de la prueba recorre `docs/` y `.agents/`. Esta spec no tiene ninguna fila en modo montos |
| AUD-01, AUD-02 | no aplica | No muta nada y no consulta los logs de auditoría |

## Validación

`corepack pnpm exec vitest run scripts/__tests__/radiografia-integridad.test.ts`, después de las correcciones R1-R14: «Test Files  1 passed (1)», «Tests  82 passed (82)». Son 13 casos más los 69 mutantes. El detalle, los controles rojos en el lugar y lo NO EJECUTADO están en el handoff `.agents/handoffs/0559-radiografia-integridad-repetible.md`.
