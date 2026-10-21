---
sdd: "0569"
title: "Un solo conversor a USD, que falla cerrado, y una tabla de tasas con fuente y fecha"
status: in-progress
author: "founder"
created: 2026-10-20
updated: 2026-10-21
supersedes: null
superseded_by: null
related: ["0557", "0563", "0496"]
confidencialidad: interno
---

# SDD-0569 — Un solo conversor a USD, que falla cerrado, y una tabla de tasas con fuente y fecha

> La 2.1 del plan contable, primera parte: la tabla `fx_rates` y el conversor canónico (`to_usd` en SQL y `toUsd` en `lib/shared`), que nunca devuelve 0 ni el monto tal cual cuando falta la tasa. USDT = USD 1:1.

**Estado: P2 DEL AVISO CORREGIDO Y PUBLICADO EN `6ff0f586`; verify terminó con 14/17 pasos medidos aprobados y tres SKIPs explícitos. PR #301 permanece en borrador.** La revisión independiente sobre `eb22e2d4b414deb7d0983fa2e6524e0c99697fc8` detectó que `emitInvoice` guardaba la tasa nueva pero entregaba al evento `invoice_emitted` la tasa anterior del borrador. La corrección usa la tasa devuelta por el UPDATE condicional. En el turno exclusivo concedido tras A/B304, el control rojo detectó 36/— frente a 40; la focal pasó 37 pruebas y dos mutantes murieron por aserción con restauración exacta. Verify tuvo exit 0, sin certificar los pasos omitidos: ledger productivo sin credenciales y SQL/reconstrucción con Docker detenido. La aprobación nominal de 0495 espera revisión/CI de la cabeza documental final e identidad/previa actualizadas del paquete.

**Evidencia anterior, conservada por SHA:** el Director aprobó el diseño el 2026-10-20 y respondió las cinco preguntas (ver *Decisiones del Director*). El relevo Codex sobre `e6579944` corrigió procedencia y concurrencia. Sobre `5f0d04ad`, la focal pasó 89 casos de app y 32 de SQL/PGlite, incluidos 26 mutantes SQL; los 13 mutantes adicionales de app murieron por aserción. El verify pasó sus 14 pasos medidos, incluido build, con reintento unitario aprobado y tres SKIPs explícitos. Después pasaron por separado 246 contratos SQL y la reconstrucción de 471 migraciones más 18 sólo-ledger sobre PostgreSQL local; el ledger productivo continúa como validación de release del Director. El handoff conserva cada corrida, omisión y límite. El cierre documental `eb22e2d4` no cambió producto ni SQL frente a `5f0d04ad`; esa evidencia no acredita todavía la corrección P2. Graphify, Archify y preview siguen aplazados por coordinación expresa del Director.

### Reapertura acotada · tasa del aviso de emisión · 2026-10-20

- El UPDATE condicional exitoso debe devolver `id, fx_rate`; las variables del
  aviso usan esa tasa persistida. Se conserva el rechazo sin fila afectada antes
  de asiento o correo. No se cambia el helper de correo, su plantilla ni RBAC.
- Aceptación: catálogo automático 36→40 avisa 40; override expreso conserva 36;
  borrador VES sin tasa avisa la tasa persistida al emitir; las carreras CAS
  perdedoras producen cero asiento y cero evento. El doble de prueba devuelve
  únicamente las columnas solicitadas.
- Allowlist de esta reapertura, subconjunto de las 39 rutas de la SDD:
  `app/studio/(app)/facturacion/actions.ts`,
  `app/studio/(app)/facturacion/__tests__/factura-congela-la-tasa.test.ts`,
  esta spec y `.agents/handoffs/0569-conversor-usd-tasas.md`.
- El parche de tres líneas se preparó fuera de Git y se aplicó después del rojo:
  2 fallos de aserción y 27 casos aprobados sobre producto `eb22e2d4`. Focal verde:
  37/37 entre emisión, variables de correo y conservación de embarque. Mutantes:
  volver a `current.fx_rate` y omitir la tasa en SELECT fallan por aserción; se
  restauró el archivo exacto después de cada uno. Typecheck y lint focal
  **PASARON**, este último con cero warnings.
  SQL0495 y formulario permanecen idénticos; no se repiten los suplementos
  SQL/Docker ni la revisión visual focal por instrucción del Director.
  Tras los controles focales, autorizó commit/push de estas cuatro rutas y verify
  sobre la nueva cabeza, sin merge, migración ni despliegue.
- Verify canónico sobre `6ff0f586e1bdabf40accea5b00fcdd90adafc0e4`, de
  `2026-10-20T20:01:20Z` a `20:35:06Z`: **14/17 medidos aprobados, exit 0**.
  La primera corrida unitaria **FALLÓ** por dos errores de arranque de workers
  (12.226 casos aprobados, uno omitido); el reintento automático **PASÓ**:
  12.278 casos aprobados y uno omitido. E2E: 177 aprobados, un flaky recuperado
  y 20 omitidos. Build **PASÓ**; restauró `tsconfig.json` y dejó el árbol limpio.
  No se cambiaron timeouts ni reintentos. Los tres SKIPs siguen sin medir en
  esta corrida; los 246 contratos y 471 migraciones más 18 sólo-ledger son
  evidencia anterior sobre `5f0d04ad`, con SQL idéntico. El handoff registra
  causas observadas, logs, limpieza de recursos y devolución del turno pesado.

### Precisiones autorizadas por el Director · revisión del 2026-10-20

- La fuente del catálogo (`manual`, `bcv`, `operacion`) y la elección expresa del
  operador son datos distintos. `fx_rate_is_override` guarda esa elección y es
  `false` por defecto. La igualdad numérica no demuestra intención. Guardar un
  campo precargado conserva su intención; editarlo, aunque termine con el mismo
  número, la vuelve explícita. Vaciarlo o cambiar moneda vuelve al catálogo.
- El cambio VES↔CNY reinicia también el valor interno del campo numérico.
  Ante un error recuperable se conserva el estado del formulario: el selector
  visible y la moneda enviada no se desincronizan por el reset automático.
- Al emitir un borrador automático se resuelve nuevamente su tasa, incluso si la
  fuente del catálogo era `manual`. La copia de una factura inicia como automática.
  Un override documental explícito conserva tasa, fuente y fecha.
- **Solo para emisión automática VES** (`emitInvoice` y crear-y-emitir),
  `valid_on` tiene que coincidir con la fecha de emisión. Una tasa anterior no
  permite emitir: así se aplica §9 del plan maestro de Sam, «si un día no hay tasa,
  la factura en bolívares no se emite». `fx_rate_on` conserva su búsqueda `<= día`
  para borradores/CxP; esta exigencia no se extiende a CNY. No se definen reglas
  de fines de semana, autocarga ni una nueva política de hora.
- `write_version` de factura aumenta por trigger en **cada UPDATE**, ignorando
  cualquier valor enviado por el cliente. Guardar y emitir comparan versión,
  estado, moneda y tenant, y exigen una fila devuelta. Si otra operación gana,
  devuelven un conflicto recuperable antes de asiento o correo. La versión cubre
  también importes, destinatario, embarque y demás datos leídos.
- La captura de factura/CxP normaliza a ocho decimales con mitad lejos de cero.
  Si el resultado no es positivo o no cabe en `numeric(20,8)`, rechaza la entrada,
  sin sustituirla por una tasa del catálogo. `1e-9 → 0` es un borde preexistente
  detectado durante revisión, no atribuible al merge.
- La reparación tiene **39 rutas**: las 38 originales más una ampliación de prueba
  autorizada por el Director: `update-invoice-conserva-embarque.test.ts`, cuyo
  doble debe representar moneda/versión/fila afectada del UPDATE condicional,
  conservando las aserciones de embarques y totales. El Director autorizó
  ajustar la **0495 no aplicada**, contratos, símbolos pendientes, espera y
  documentación. La numeración se conserva; 0570 corresponde a PGlite y la
  unificación de hora Caracas sigue sin número asignado.

## Decisiones del Director, 2026-10-20 (respuesta a las preguntas del diseño)

1. **`tenant_fx_history`:** el Director midió **0 filas** en producción. No hay copia: `fx_rates` arranca vacía, y el preflight de la 0495 aborta si `tenant_fx_history` tiene alguna fila al aplicar. La tabla vieja no se borra, pero la app deja de escribirla y de leerla.
2. **Dos tasas manuales del mismo día:** la segunda reemplaza a la primera por la RPC, y la auditoría D2 guarda la anterior y la nueva.
3. **Preferencia de la fuente:** `bcv`, después `manual` y después `operacion`. De acuerdo.
4. **El gasto móvil en VES o CNY:** se precarga la última tasa y se muestra, editable.
5. **La partición:** aprobada. Los 13 reemplazos van en su propia SDD, con número al empezarla.

## Contexto

### El plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`)

- **B8:** «Conviven constantes fijas (36, 36.45, 7.18) y la regla de conversión a USD está copiada en seis sitios, con divergencia en CNY (en unos vale 0, en otros se divide por la tasa).» Además, `tenant_fx_history` no guarda si la tasa es BCV, paralela o manual, ni la fecha de vigencia.
- **2.1:** «Tasa BCV única: tabla `fx_rates` (8 decimales, fuente BCV / manual / operación, fecha de valor, quién) con carga diaria automática y respaldo; conversor canónico `to_usd` que falla cerrado (nunca cero ni el monto tal cual) y reemplaza las seis copias y las constantes; hora de Caracas para fechas de emisión y asiento; política USDT = USD 1:1 con el diferencial a 6.19.»

### Decisiones de Sam y del Director

- **Decisión 1 de Sam (2026-10-19):** el mayor va en USD, con USDT = USD 1:1. Los bolívares solo en reportes, y la diferencia en cambio a 6.19. Sin impuestos. Sam lo dijo así: «todo el sistema tiene que estar en USDT».
- **Decisión 2 de Sam:** lo que hay son datos de prueba. Según la radiografía, todo está en USD en producción.
- **El Director, 2026-10-20:** la 2.1 se parte en tres.
  - **SDD-0569** es esta: el conversor y la tabla, con la migración 0495.
  - La hora de Caracas sigue sin número asignado; **SDD-0570** corresponde a PGlite.
  - **La carga automática del BCV** va en otra entrega. La redacción inicial
    del 2026-10-20 dejaba la fuente por decidir; queda superada por §9 del plan
    maestro: fuente oficial BCV, carga diaria y respaldo manual. Lo pendiente
    es implementar y concretar la salida a internet y su operación, sin volver
    a solicitar a Sam la decisión de fuente. La automatización no pertenece a 0569.
  - El Director agregó: «CNY y VES siempre con tasa, fallando cerrado. Toma de modelo el `amountToUsd` de Financiero China, con `RMB` y `CNY` normalizados a un solo código.»

## Lo que hay hoy (mapa del 2026-10-20, sobre `9b932095`)

**No son seis copias: son 13 implementaciones con 6 reglas distintas,** sin contar envoltorios ni guardas.

| Regla | Dónde | Sin tasa | CNY | USDT |
|---|---|---|---|---|
| **A** | `invoiceUsdAmount` (`lib/studio/fidelizacion/types.ts:280`), con `balanceToUsd` (`payment-queries.ts:425`) y `billBalanceToUsd` (`treasury/bill-queries.ts:209`); la usan reportes (`reports/queries.ts:250, 844, 858, 1104, 1112`), costing (`costing/queries.ts:193`), el ingreso del período (`accounting/ingreso-periodo.ts:289`) y el dashboard; en SQL, `0404:28-33` y `0411:102-109, 124-131` | **0** | **0** | 1:1 |
| **B** | `receiptAmountUsd` (`accounting/receipt-posting.ts:75`), `billAmountUsd` (`bill-posting.ts:63`) y `paymentAmountUsd` (`supplier-payment-posting.ts:63`); la usan rendiciones, la separación de fondos y el subdiario | **el nominal** | /tasa | 1:1 |
| **C** | `amountToUsd` (`partner-finance/types.ts:343`) | **falla cerrado** | /tasa (`RMB`) | 1:1 |
| **D** | `toAmountUsd` (`expense-types.ts:255`) y la copia muerta `toUsd` (`lib/i18n/format.ts:102`) | 0, aunque el validador lo impide antes | /tasa | no existe |
| **E** | `convertToUsd` (`expense-queries.ts:76`, con las constantes 36 y 7.18) y `ceo-brief.ts:136` (36.5 y 7.18) | — | /7.18 | tal cual, o 0 en `ceo-brief` |
| **F** | `convertUsd` y `resolveDisplayRate` (`costing/types.ts:235`, `costing/ui.ts:34`), de USD a Bs | 36.45 | — | — |

**Además:**
- **El asiento de la venta no convierte:** `InvoicePostingInput` (`invoice-posting.ts:28-37`) no tiene ni moneda ni tasa. Es el B2 del plan.
- **`tenant_fx_history`** (`0074:55-63`):
  - tiene `currency_pair`, `rate numeric`, `set_at` y `set_by`;
  - no tiene fuente, fecha de valor ni unicidad;
  - la escriben Admin › Tasas y cada gasto VES o CNY de escritorio, y la leen gastos y Admin;
  - **no hay ninguna carga del BCV.**
- **Captura:** la factura exige la tasa solo en VES (`invoice-types.ts:420-426`), y la CxP nunca la exige (`treasury/types.ts:327-330`).
- **Pruebas que fijan lo de hoy:**
  - el nominal sin tasa: `payment.test.ts:341-343`, `treasury.test.ts:332-334` y `libro-control.test.ts:364-396`;
  - CNY = 0: `fidelizacion/types.test.ts:270-274` y `alerts.test.ts:101-115`;
  - CNY dividido por la tasa: `treasury.test.ts:328-330` y `renditions.test.ts:213, 249`.

## La partición (aprobada)

Reemplazar las 13 implementaciones cambia cifras visibles en reportes, cobranzas, CxP, costing, el dashboard y el móvil, y reescribe unas diez pruebas. Junto con la tabla y la migración, no entra en una PR revisable. Por eso:

- **0569 (esta PR):** la tabla `fx_rates`, `to_usd` en SQL y `toUsd` en `lib/shared/fx.ts`, la tasa vigente (`fx_rate_on`), la captura con tasa obligatoria y congelada en el documento, y Admin › Tasas, gastos y el móvil sobre `fx_rates`. **Ningún reporte cambia todavía.**
- **La SDD siguiente:** reemplaza las 13 implementaciones y las constantes por `toUsd`, con la lista de pantallas que cambian de cifra, y reescribe las pruebas que fijan lo de hoy, cada una citando la decisión 1.

## Implementación

### 1. La migración `0495_fx_rates_conversor_usd.sql` (MIGRATE-FIRST)

- **Preflight:** aborta si `fx_rates` o `to_usd` ya existen, o si `tenant_fx_history` tiene filas. Exige `append_audit_event` SECURITY DEFINER con `search_path` vacío y el tipo de entidad de auditoría `exchange_rate`.
- **La tabla `fx_rates`:**

  | Columna | Tipo | Qué es |
  |---|---|---|
  | `id` | `uuid` | |
  | `tenant_id` | `uuid` | en cascada, como el resto |
  | `currency` | `text` | `VES` o `CNY`; un CHECK (`RMB` se normaliza antes) |
  | `rate` | `numeric(20,8)` | unidades de esa moneda por 1 USD; mayor que 0 y menor que 1e12 (eso descarta NaN e Infinity) |
  | `valid_on` | `date` | la fecha de valor, el día de Caracas |
  | `source` | `text` | `bcv`, `manual` u `operacion`; un CHECK |
  | `set_by` | `uuid` | quién, o null si la cargó un proceso |
  | `set_at` | `timestamptz` | cuándo |
  | `note` | `text` | opcional, hasta 500 caracteres |

  Única por `(tenant_id, currency, valid_on, source)`. RLS de lectura por tenant; `authenticated` solo lee. La escritura va por la RPC o por `service_role`, que es la futura carga del BCV.
- **`fx_normalizar_moneda` y `to_usd(amount, currency, rate)`:** IMMUTABLE, sin acceso a tablas; la tasa llega ya resuelta. USD y USDT 1:1. VES y CNY divididos por la tasa, con `RMB` = CNY. Redondeo a 2 decimales al final, con la mitad lejos de cero. **Falla cerrado** con hint `dtd-fx`:
  - `FX_RATE_MISSING` sin una tasa finita y mayor que 0;
  - `FX_CURRENCY_UNKNOWN` con otra moneda;
  - `FX_AMOUNT_INVALID` sin monto (null) o con |monto| >= 1e12 (NaN incluido): los mismos bordes que `toUsd`.
- **`fx_rate_on(tenant, currency, date)`:** STABLE e INVOKER, así que la RLS filtra por tenant. Devuelve la tasa, su fuente y su fecha: la de la fecha más reciente menor o igual a `date`, y ese día la de `bcv`, después `manual` y después `operacion`. Sin ninguna, `FX_RATE_MISSING`.
- **`registrar_tasa_de_cambio(currency, rate, valid_on, note)`:** SECURITY DEFINER, solo admin o accounting del tenant. Valida la moneda, la tasa (hasta 8 decimales, como la columna) y que la fecha no sea posterior a hoy en Caracas. Una segunda tasa manual del mismo día y moneda reemplaza a la primera.
- **La auditoría D2:** un disparador sobre `fx_rates` llama a `append_audit_event` con `exchange_rate_recorded`, `exchange_rate_corrected` o `exchange_rate_deleted`, y guarda la tasa anterior y la nueva en `before_data` y `after_data`. El borrado lleva un motivo fijo, porque `append_audit_event` lo exige para los `_deleted` (0267), como en la 0491.
- **`invoices` y `supplier_bills`:** `fx_rate_source` (CHECK `bcv`, `manual` u `operacion`), `fx_rate_valid_on` y `fx_rate_is_override boolean NOT NULL DEFAULT false`; `invoices` además tiene `write_version bigint NOT NULL DEFAULT 0`, incrementado en todo UPDATE por `increment_invoice_write_version`. La función de trigger es INVOKER, con `search_path` vacío y sin EXECUTE para roles API. `fx_rate` pasa de `numeric(14,4)` a `numeric(20,8)`. Cambiar la escala reescribe las dos tablas con ACCESS EXCLUSIVE hasta COMMIT; los valores del tipo anterior caben sin pérdida. El preflight exige el tipo anterior, ausencia de columnas/trigger de esta reparación y ausencia de vistas dependientes. El documento emitido congela su tasa; la fuente manual del catálogo no se interpreta como override documental.
- **El contrato** (`supabase/tests/0495_fx_rates_conversor_usd.test.sql`) replica la 0261: retira el CHECK legacy de `entity_type` que las migraciones viejas de facturas vuelven a crear en el fixture; en producción manda la FK a `audit_entity_types`. **Lo confirmó el Director en producción el 2026-10-20, leyendo solo el catálogo:** `entity_audit_log` no tiene ningún CHECK que mencione `entity_type` (0 constraints), y `audit_entity_types` tiene `exchange_rate` con `status = active`, que es lo que exige el preflight.
- **Postflight:** volatilidades, lectura exclusiva de `fx_rates` para `authenticated`, ACL de RPC/auditoría, disparador de auditoría, RLS, tipo `numeric(20,8)`, columnas de intención/versión y disparador de versión en todo UPDATE con su función y ACL.

**Por qué `to_usd` es IMMUTABLE y `fx_rate_on` STABLE:** el conversor no lee tablas, así que puede ir en índices, CHECK y columnas generadas. La tasa vigente sí lee `fx_rates`, que cambia entre transacciones.

### 2. `lib/shared/fx.ts`

`normalizarMoneda`, `necesitaTasa`, `tasaValida` y `toUsd`, con la misma regla que `to_usd`: devuelve `{ ok: true, usd }` o `{ ok: false, reason }`, con las razones `missing-fx-rate`, `unknown-currency` e `invalid-amount`. La cuenta es **decimal exacta** (enteros escalados con BigInt, a partir del número tal como se escribe), con la mitad lejos de cero como `round(numeric, 2)`: con coma flotante, 15,66 CNY a 7,2 daba 2,17 y `to_usd` 2,18. Los mismos casos espejo están en `fx.test.ts` y en el contrato. Vive en `lib/shared` porque la SDD siguiente lo usa también fuera del Studio.

### 3. `lib/studio/fx-rates.ts`

- `tasaVigente`: llama a `fx_rate_on`; null si no hay tasa o si la base todavía no tiene la 0495.
- `tasaDelDocumento`: la tasa que congela un documento, incluida su intención (`fxRateIsOverride`). En USD/USDT deja tasa/fuente/fecha en null e intención false. `preserve` conserva la tasa guardada y su intención sin inferir por igualdad; `manual` normaliza una entrada explícita a ocho decimales e indica override; `catalog` consulta la vigente y marca false aunque su fuente sea manual. Una entrada no persistible falla cerrada. Sin tasa, el error explica cómo cargarla.
- `ultimaTasa`: la última tasa de una moneda, para precargar gastos, Admin y el móvil. Del último día, la misma preferencia que `fx_rate_on`.

### 4. La captura con tasa obligatoria

- **Factura** (`invoice-types.ts`, `facturacion/actions.ts`): exige tasa persistible en VES/CNY. Guarda fuente, fecha e intención explícita; en USD/USDT vacía esos datos. Al emitir conserva solo un override documental; las tasas automáticas se resuelven de nuevo, y VES exige la del día. Duplicar resuelve automáticamente hoy, antes del correlativo. Drawer limpia la tasa al cambiar VES↔CNY y transporta la intención. Guardar/emitir usan la versión completa de la fila para impedir carreras. El día del documento sigue siendo hoy UTC; la unificación Caracas queda sin número y fuera de este alcance.
- **CxP** (`treasury/types.ts`, `treasury-actions.ts`): exige la tasa fuera de USD y USDT. `createBillFor` la resuelve al día de emisión, y el asiento de causación usa la tasa que quedó guardada (la que devuelve el INSERT), no la escrita.
- **Gastos de escritorio:** ya exigían la tasa. Dejan de copiarla a `tenant_fx_history`, y la precarga sale de `fx_rates` (`getLastFxRate` usa `ultimaTasa`; `setAt` pasa a ser la fecha de valor, que el drawer muestra como día y no como instante).
- **Gasto móvil:** el formulario de crear y el de editar muestran la tasa en VES o CNY, precargada con la última del Studio y editable (`CampoTasaGasto`); la acción la manda. Sin tasa, el validador lo rechaza como en escritorio.

### 5. Admin › Tasas y Contabilidad › Tasas de cambio

La misma sección en los dos lugares: la contadora entra por Contabilidad y el admin también por Admin. La acción pide el permiso del módulo de Contabilidad (admin y accounting), el mismo que la RPC. Registra por la RPC, con la fecha de la tasa (por defecto hoy en Caracas, sin fechas futuras), hasta 8 decimales y una nota opcional. Muestra la última por par con su fecha y su fuente. Muestra solo los mensajes de la 0495 (hint `dtd-fx`); cualquier otro error de la base se cambia por uno genérico. La descripción de la pantalla deja de prometer «configuración de qué tasa usa cada flujo».

## Qué NO cambia en esta PR

- Ninguna cifra de los reportes, cobranzas, CxP, costing ni el dashboard. Eso es la SDD siguiente.
- El asiento de la venta, que es la 2.3 y el B2.
- La unificación de hora Caracas, todavía sin número asignado (0570 es PGlite).
- La carga del BCV, que es la tercera.
- `tenant_fx_history` no se borra.

## Riesgos

- **Entre aplicar la 0495 y desplegar la PR:** la migración es aditiva salvo la ampliación de `fx_rate`, que la app desplegada no nota. La ventana entre aplicar y fusionar son segundos, y el Director vuelve a contar `tenant_fx_history` justo antes del apply y después del merge.
- **La PR desplegada sin la 0495:** factura/CxP en VES o CNY falla al guardar por las columnas nuevas; editar y emitir cualquier borrador, incluso USD/USDT, requiere además `write_version` y falla antes de escribir si falta. Admin › Tasas tampoco guarda. Crear/duplicar en USD/USDT conserva el comportamiento anterior. El contrato está declarado en `pending-migration-symbol-declarations.json`; se requiere MIGRATE-FIRST con el paquete reparado.
- **Un documento en VES o CNY sin tasa cargada:** ya no se guarda con una tasa inventada; pide la tasa. Es el comportamiento buscado (falla cerrado).

## El smoke de la espera (Director, 2026-10-20)

Después de la publicación y, por parte del Director, solo mirando: Admin › Tasas abre, y un borrador VES sin tasa muestra el error sin guardarse ni consumir correlativo. Cargar una tasa de prueba en producción necesita el OK de Sam, y se limpia con un DELETE, que deja `exchange_rate_deleted` en la auditoría.

## Revisión de seguridad del Director (2026-10-20, sobre `cc6e7333`)

Cada hallazgo se confirmó con su prueba en rojo antes de corregirlo, y tiene su mutante.

| # | Hallazgo | Corrección |
|---|---|---|
| B1 | Ningún DELETE de `fx_rates` funcionaba: `exchange_rate_deleted` iba sin motivo y la 0267 lo exige | motivo fijo para el DELETE; aserción y mutante |
| B2 | Factura CNY: el campo de tasa iba oculto y el error no se veía | el campo en VES y en CNY, con ayuda, `aria-invalid` y su error; `NumericInput` acepta un `aria-describedby` propio |
| I3 | Editar un borrador reescribía la procedencia; al pasar a USD quedaba la tasa | corrección original por igualdad, sustituida en el relevo por intención explícita; USD/USDT limpia tasa/fuente/fecha y override |
| I4 | Duplicar y emitir esquivaban la tasa | duplicar resuelve antes del correlativo; la revisión actual distingue override documental de fuente manual y exige fecha exacta solo para VES automática |
| I5 | `toUsd` y `to_usd` no daban lo mismo (2,17 contra 2,18) | aritmética decimal exacta en TS; casos espejo en las dos pruebas |
| I6 | La tasa del documento perdía decimales (`numeric(14,4)`) | `fx_rate` a `numeric(20,8)` en la 0495, con el lock medido; el asiento de la CxP usa la tasa guardada |
| I7 | El smoke y la ventana | escritos arriba y en la espera |
| 8 | La precarga de gastos mostraba el día anterior | la fecha de valor se formatea como día |
| 9 | `step="0.0001"` en el móvil | `step="any"` |
| 10 | `ultimaTasa` no respetaba bcv > manual > operacion | la misma preferencia, del último día |
| 11 | Faltaba la nota en Admin › Tasas | el campo, con su etiqueta y tope de 500 |
| 12 | Los bordes de `toUsd` y `to_usd` | sin monto falla cerrado en los dos; tope `abs(monto) < 1e12` en los dos |
| 13 | Call sites mal citados | regenerados con las líneas de hoy. El gate asocia la columna por archivo, así que los sitios de `facturacion/actions.ts` figuran también bajo `supplier_bills.*`; la evidencia lo explica |
| 14 | Más de 8 decimales; RLS y `anon` | la RPC y la validación lo rechazan con su mensaje; el postflight comprueba RLS activa y que `anon` no lea |
| NO VERIFICADO | La acción exigía el módulo «admin», pero la RPC admite accounting | la acción pide el módulo de Contabilidad, y la sección está también en Contabilidad › Tasas de cambio; prueba de RBAC |

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0495_fx_rates_conversor_usd.sql` | la migración |
| `supabase/tests/0495_fx_rates_conversor_usd.test.sql` | el contrato |
| `lib/studio/__tests__/fx-rates-conversor.migration.test.ts` | contrato PGlite: control rojo, 26 mutantes, preflight con filas y con instalación parcial, reaplicación y espera |
| `supabase/migrations-baseline.json` | la espera de la 0495 |
| `supabase/pending-migration-symbol-declarations.json` | símbolos alcanzables y evidencias de degradación, incluida intención documental y versión |
| `lib/shared/fx.ts` | nuevo: el conversor canónico en TS |
| `lib/shared/__tests__/fx.test.ts` | nueva |
| `lib/studio/fx-rates.ts` | nuevo: la tasa vigente, la del documento y la última |
| `lib/studio/__tests__/fx-rates.test.ts` | nueva: la tasa del documento y los validadores |
| `lib/studio/invoice-types.ts` | la tasa obligatoria también en CNY |
| `app/studio/(app)/facturacion/actions.ts` | la tasa congelada al crear, editar, emitir y duplicar |
| `app/studio/(app)/facturacion/_components/InvoiceDrawer.tsx` | el campo de tasa en VES y CNY, con su error |
| `app/studio/(app)/facturacion/_components/InvoiceDrawer.tasa.test.tsx` | nueva |
| `app/studio/_components/ui/NumericInput.tsx` | un `aria-describedby` propio, sumado al de la vista previa |
| `app/studio/(app)/facturacion/__tests__/factura-congela-la-tasa.test.ts` | nueva |
| `app/studio/(app)/facturacion/__tests__/update-invoice-conserva-embarque.test.ts` | ampliación autorizada: doble de UPDATE condicional, conserva embarques y totales |
| `lib/studio/treasury/types.ts` | la tasa obligatoria fuera de USD y USDT |
| `lib/studio/treasury/treasury-actions.ts` | la tasa congelada al crear la CxP; el asiento usa la guardada |
| `lib/studio/treasury/__tests__/cxp-congela-la-tasa.test.ts` | nueva |
| `lib/studio/exchange-rates-types.ts` | fecha y nota; fuente y fecha de valor en la última tasa |
| `lib/studio/exchange-rates-queries.ts` | lee `fx_rates` |
| `app/studio/(app)/admin/exchange-rates-actions.ts` | registra por la RPC, con el permiso de Contabilidad |
| `app/studio/(app)/admin/__tests__/exchange-rates-actions.test.ts` | nueva |
| `app/studio/(app)/admin/_components/ExchangeRatesSection.tsx` | fecha de la tasa, nota, fuente y textos nuevos |
| `app/studio/(app)/admin/_components/ExchangeRatesSection.test.tsx` | nueva |
| `app/studio/(app)/contabilidad/page.tsx` | carga las tasas en la pestaña nueva |
| `app/studio/(app)/contabilidad/_components/ContabilidadClient.tsx` | la pestaña Tasas de cambio |
| `app/studio/(app)/contabilidad/__tests__/tasas-de-cambio-tab.test.tsx` | nueva |
| `app/studio/(app)/admin/page.tsx` | la descripción de la sección |
| `lib/studio/expense-queries.ts` | la precarga sale de `fx_rates` |
| `app/studio/(app)/gastos/actions.ts` | deja de escribir `tenant_fx_history` |
| `app/studio/(app)/gastos/_components/ExpenseDrawer.tsx` | la fecha de la precarga como día |
| `app/studio/(app)/gastos/_components/ExpenseDrawer.fecha-tasa.test.ts` | nueva |
| `app/m/erp/_components/MobileErpClient.tsx` | el campo de la tasa en el gasto móvil, con `step="any"` |
| `app/m/erp/actions.ts` | manda la tasa al crear y al editar |
| `app/m/erp/page.tsx` | la precarga de la tasa |
| `docs/specs/0569-conversor-usd-tasas/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0569-conversor-usd-tasas.md` | handoff |

## Criterios de aceptación

1. `to_usd` y `toUsd` dan lo mismo: USD y USDT 1:1, VES y CNY divididos por la tasa, `RMB` = CNY, redondeo al final. Sin tasa válida, con moneda desconocida o con un monto inválido, fallan cerrado: nunca 0 ni el monto tal cual.
2. `fx_rate_on` devuelve la tasa vigente con su fuente y su fecha, prefiere `bcv`, después `manual` y después `operacion`, y falla cerrado sin tasa.
3. Solo admin o accounting registran una tasa, nunca con fecha futura; la segunda manual del día reemplaza a la primera, y la auditoría guarda las dos.
4. `authenticated` solo lee `fx_rates`, y solo las de su tenant. `fx_rate_on` filtra por tenant en la consulta **y** en la RLS: sin RLS (`service_role`) sigue devolviendo solo la tasa del tenant pedido (pedido del Director).
10. La auditoría D2 de `fx_rates` guarda solo la moneda, la tasa, el día y la fuente: ni la nota ni `set_by`. Quién la cargó queda en `actor_id`, como en toda la D2 (pedido del Director).
5. Una factura o una CxP en VES o CNY guarda la tasa que usó, con su fuente y su fecha; sin ninguna tasa, no se guarda y el error dice qué hacer. En USD y USDT no cambia nada.
6. Admin › Tasas, Contabilidad › Tasas de cambio, gastos y el móvil leen y escriben `fx_rates`; nada escribe `tenant_fx_history`. La contadora puede cargar tasas.
11. Emitir en VES/CNY reconsulta el catálogo salvo override documental explícito. VES automática exige fecha exacta de emisión; CNY admite la última vigente `<= día`. Duplicar inicia como automática. Guardar conserva intención expresa sin inferir por igualdad; USD/USDT limpia tasa y metadatos.
12. Borrar una tasa queda en la auditoría con su motivo. La tasa del documento tiene 8 decimales, y el asiento de la CxP usa la guardada.
7. El preflight aborta si `tenant_fx_history` tiene filas; aplicada dos veces, aborta con «ya existe».
8. Control rojo: sin la 0495 el contrato falla en la primera aserción, y cada regla tiene un mutante que muere en su aserción.
9. Ninguna cifra de reportes cambia.
13. Un borrador automático creado el día 19 con catálogo `source=manual, rate=36` usa 40 al emitir el día 20; un override explícito conserva tasa y fecha, y la duplicación vuelve a resolver al emitir otro día.
14. Las dos intercalaciones editar/emitir rechazan la escritura perdedora; cambios de importes o destinatario en la misma moneda también se detectan. Cero filas afectadas significa cero asiento/correo de esa operación.
15. `write_version` aumenta en todo UPDATE, incluso en una misma transacción, e ignora el valor enviado por cliente. El contrato comprueba ejecución bajo `authenticated` aunque la función no exponga EXECUTE directo.
16. Drawer limpia la tasa al cambiar VES↔CNY; una cifra explícita igual a la anterior se distingue de conservar el campo precargado. Factura/CxP rechazan `1e-9` y los valores que redondean a cero, y comparten con PostgreSQL los límites de mitad a ocho decimales.
17. El evento `invoice_emitted` usa la tasa devuelta por el UPDATE condicional exitoso. Catálogo 36→40 entrega `bcv_rate="40"`, override explícito conserva `"36"` y un borrador sin tasa entrega la persistida. Sin fila afectada no produce asiento ni evento.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec, con allowlist exacta |
| SGE-00.07 · veracidad del aviso | cumplimiento focal P2 | el evento usa la tasa persistida; rojo 36/— frente a 40 y verde en la prueba de emisión, con proyección real del doble |
| AUD-01 | cumplimiento | la tasa guarda quién, cuándo y la fuente, y cada alta, corrección o borrado entra en la auditoría D2 con la tasa anterior y la nueva |
| ERR-01 | cumplimiento | Admin › Tasas muestra solo los mensajes con `hint = 'dtd-fx'`; el resto, un mensaje genérico (prueba de la acción) |
| FRM-01, A11Y-01 | cumplimiento | la fecha y la tasa del móvil con `<label>`; la ayuda de la tasa con `aria-describedby` |
| Producción | cumplimiento | el conteo de `tenant_fx_history` lo midió el Director; la 0495 se aplica con el OK nominal de Sam y el runbook |
| Datos personales | no aplica | las tasas no son datos personales |

## Validación

Ver el handoff `.agents/handoffs/0569-conversor-usd-tasas.md`.

## Continuación BCV diario · 2026-10-21 · Worker aislado

**EN PROGRESO: GO04B FALLÓ e INCOMPLETO; GO05A reparó paridad y su focal PASÓ 3/3. Nueva canónica GO05B y conocimiento pendientes.** Esta continuación conserva los resultados históricos de la tabla/conversor y no los atribuye al importador nuevo. La0495 aplicada permanece inmutable. Su razónNULL en INSERT y source rpc no bastan para la auditoría R3 del nuevo job: el Director aprobó una SQL aditiva estrecha0501 y capability GET service-only, con motivo fijo generado en DB/source job para el contexto verificado.

Raíz propia `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0569-bcv-carga-diaria`, rama `codex/sdd-0569-bcv-carga-diaria`, base literal C3 `1905aef75680a80055621cffd717198915d089f9`, owner `worker-0569bcv-01a15a4e-ddf0-7d82-8656-d9dc56b58468`. El handoff propio `.agents/handoffs/0569-bcv-carga-diaria.md` conserva íntegros encargo c477, addendum87589 y activación93c4. No incluye0573 ni carril de embarques.

Inventario nativo actualizado antes de stub:502refs+worktrees, siguienteSQL0501 y spec0578, exit0, sin aviso de fetch incompleto. Recibo externo `0569-bcv-validation/inventario-0501-antes-stub.txt`, SHA256 `bce71f1d1d907de38a2ef820272a70c488a9e4d4dd11d3d5d079ed51d0d91dfb`.0501 queda reservada localmente con stub en esta rama; no es implementación, aplicación ni respaldo remoto. Reutiliza0569; no reserva0578.

### Resultado y aceptación de esta continuación

- Fuente constante BCV HTTPS normal, parser parse5 directo8.0.1, bloque/USD/FechaValor únicos y coherentes; decimal textual completo hasta8fracciones, >0 y <1e12. No Number/parseFloat/redondeo de tasa.
- Fecha exactamente hoyCaracas capturada; futura espera, anterior no satisface hoy y día cambiado detiene pendientes. Fuente20s/1MiB/hasta2redirects canónicos, deadline común50s/cancelación/retry(false),24ticks nominales5 * * * * sin cron instalado.
- Bearer y query estrictos antes de IO; normalOFF ceroIO. Scope servidor UUIDúnicos/cap25, SELECTid exacto y snapshotBCV/VES/hoy íntegro textual antes de fuente. DryRun exige capability válida inclusoOFF antes de fetch/candidata y nunca muta.
- INSERT directo sin upsert, correcciónCAS por identidad/clave/rate/set_at observados y nuevo set_at explícito. UNCHANGED requiere relectura; incertidumbre solo reconcilia por lectura o UNKNOWN, detiene lo restante y conserva conteos. Sin garantíaABA/exactly-once/frescura editorial/cuota global.
- SQL0501 conserva trigger/append real atómico y cuatro claves auditadas sin note/set_by; contexto rol nativo+claimsJSONsin sub+auth.uidNULL, motifijo/sourcejob solo BCV/VES/SYSTEM. Motivos humanos y manual/operacion/CNY/documentos intactos. Capability no inmovilizaDDL ni atesta exclusividad del cron.
- B1–B19 del prevuelo y R1–R14 de auditoría obligatorios con B10 sourcejob/motivo y B16 ensayo estricto del addendum. SDK real con proxy404/503/truncado/ACKperdido, SQL/PGlite/HTTPPG17.11/PostgREST14.17, compatibilidad0495, focales/mutantes/UI y revisión independiente porSHA. No ROJO por módulos nuevos ausentes.

Primero instalación congelada propia y baseline cron/UI bajo turno; después gate pequeño HTTP del contexto dentro del trigger definer con servicio sin sub positivo, humano positivo y negativos. Si no acredita la candidata, detener esa parte y volver al Director. Cron/UI/package/lock existentes se preservan hasta sus gates. Ese fue el orden inicial; los recibos GO01/01B/01C del handoff actualizan su avance.

### Allowlist exacta de esta continuación · 32 rutas

~~~~text
app/api/cron/bcv-rates/route.ts
app/api/cron/bcv-rates/__tests__/route.test.ts
lib/studio/fx/bcv-types.ts
lib/studio/fx/bcv-parser.ts
lib/studio/fx/bcv-source.ts
lib/studio/fx/bcv-sync.ts
lib/studio/fx/__tests__/bcv-parser.test.ts
lib/studio/fx/__tests__/bcv-source.test.ts
lib/studio/fx/__tests__/bcv-sync.test.ts
lib/studio/fx/__tests__/bcv-persistence.migration.test.ts
lib/studio/fx/__tests__/fixtures/bcv-usd-20261021.html
lib/studio/fx/__tests__/fixtures/bcv-decoys.html
lib/studio/fx/__tests__/fixtures/bcv-ambiguous.html
scripts/tests/bcv-rates-postgrest.mjs
scripts/build-crontab.mjs
scripts/__tests__/build-crontab.test.ts
infra/dtd-cargo/cron/crontab
package.json
pnpm-lock.yaml
app/studio/(app)/admin/_components/ExchangeRatesSection.tsx
app/studio/(app)/admin/_components/ExchangeRatesSection.test.tsx
docs/runbooks/bcv-tasas-diarias.md
docs/runbooks/servidor-contabo.md
docs/specs/README.md
docs/specs/0569-conversor-usd-tasas/spec.md
.agents/handoffs/0569-bcv-carga-diaria.md
supabase/pending-migration-symbol-declarations.json
.env.example
supabase/migrations/0501_bcv_rates_system_audit.sql
supabase/tests/bcv_rates_system_audit.test.sql
supabase/migrations-baseline.json
infra/dtd-cargo/.env.example
~~~~

La allowlist histórica de 39 rutas pertenece a la entrega anterior. La continuación usa la unión literal de 32 rutas del addendum Director d73e2afc: las 31 anteriores más únicamente infra/dtd-cargo/.env.example. La fuente31 original se conserva íntegra en el handoff. Regresiones leídas/ejecutadas no reciben permiso implícito de edición; una ruta adicional requiere coordinación previa.

### SGE-00 · clasificación inicial de producto, sin excepción

| Principio | Clasificación y evidencia pendiente |
|---|---|
|01 predecible|no conformidad todavía verificable: estados/casos B5/B9/B15 pendientes de ejecutar.|
|02 conservación|no conformidad todavía verificable: CAS/manual/frozen B11/B14 pendientes.|
|03 riesgo/fricción|cumplimiento del encargo: productoR3, autorización de automatización separada de producción; ejecución pendiente.|
|04 auditoría|no conformidad del nuevo job hasta0501/R4/R5/R9; no se hereda conformidad histórica.|
|05 permisos/tenant|no conformidad todavía verificable: bearer/scope/contexto/ACL B7/B8/R3 pendientes.|
|06 prevención|no conformidad todavía verificable: parser/fecha/capability antes de DML pendientes.|
|07 estado verdadero|no conformidad todavía verificable: UNKNOWN/reconciliación/conteos B12/B15 pendientes.|
|08 pasos|no aplica a formulario nuevo: no se crea uno; respaldo existente debe conservarse enB18.|
|09 patrón|no conformidad todavía verificable: helperCaracas/SDK/generador/componentes reales pendientes.|
|10 accesibilidad|no conformidad todavía verificable: componente/teclado/disposiciónestrecha/clarooscuro pendientesB18.|
|11 lenguaje|no conformidad todavía verificable: avisos y errores seguros pendientesB18.|
|12 autoridad|cumplimiento del encargo: sin merge/deploy/DBreal/croninstalado ni activación productiva; prueba local no los autoriza.|

Validación de esta continuación: harness/claim/guard y preimágenes31 PASARON como metadatos. Módulos ausentes inicialmente son AUSENTES. Instalación/baselines/producto/tests/SQLHTTP/UI/verify/conocimiento: **NO EJECUTADOS**. No interpretar el stub o la matriz como entrega funcional. Handoff y recibos externos conservan omisiones y límites.

Actualización acotada21oct: instalación inicial congelada y baseline válido2archivos/12casos/0omisiones PASARON sobreD; preparación del primer shim y dos promociones offline fallaron por separado, sin ROJO funcional. Promoción parse5 directo8.0.1 exacto en9cd35b1ef y enlace/importación mínimos GO01C PASARON;31fuentes sin reescritura. Todavía no se han ejecutado módulos/testsBCV ni SQLHTTP/UI/canónica/conocimiento. GO02 autoriza solo contextoHTTP y después focalpersistencia0501, con inputs congelados/recibos nuevos; no acredita cierre global ni levanta el resto de fronteras.

Cierre GO02: PASÓ contexto HTTP acotado con PG17.11/PostgREST14.17/SDK2.106.1, siete controles y 26 negativos INSERT/PATCH observados (24 rechazos sin efectos y 2 humanos user/rpc, nunca job). Focal 0501 PASÓ 10/10 sin omisiones en f1061d2ea: cuatro mutantes funcionales, compatibilidad 0495 y rollback poscreación/catálogo exacto en la misma DB. Recibos, fallos materiales de preparación, diagnóstico de 1 caso con 9 omisiones y límites están en el handoff; no se suman a cobertura. 41 entradas base por corrida, 44 con soporte focal, 0 diferencias tras EXIT. F01/F02/F03 siguen primero oráculos/ROJO futuro antes de corregir parser/source; importador amplio, cron/UI/canónica/conocimiento continúan pendientes. 0501 aplicada solo en fixtures propias, sin producción ni release aprobado.

Respaldo parcial DRAFT autorizado el 21 de octubre sobre la rama C3 exacta; no es cierre completo ni permiso de integración/producción. Nuevos casos F01/F02 autorados y NO EJECUTADOS, con parser/source productivos conservados para medir primero ROJO. F03 sigue pendiente; candidato Content-Range del SDK permanece en revisión por lectura, sin reproducción. El cuerpo de la PR y el handoff separan esos pendientes de baseline/HTTP/focal medidos.

[PR #317 DRAFT](https://github.com/SoftAgentes/DTDCARGO/pull/317) creada y adjuntada como respaldo parcial. Base remota C3 revalidada en 1905aef7; primera relectura head 021868d743b868c4e4f22155ccb4ce9c21da3031, 25 rutas dentro de 31 y body exacto. Checks sin resultados reportados en ese corte; no conformidad global ni prueba de CI verde. Recibos locales y head final de publicación en el handoff/evidencia externa.

Autoría ligera posterior: F03 ya tiene oráculos de cancel diferido con liberación/espera del productor, redirects positivos, abort durante body, presupuesto acumulado y comprimido real por HTTP local. S01 incluye metadata Content-Range malformada ante SDK real, preservación de paginación/capability y preparación de muestras nativas en el driver. Todos **NO EJECUTADOS**; fuente/parser/sync productivos conservan el candidato para medir ROJO válido antes de reparar. Informe S01 por lectura `3b028de74af523b14800961d655720b7a213126ba8303c198e1bb4ece810397b`; no se suma cobertura a HTTP02/focal05 por esta autoría.

Preparación GO03: texto íntegro `8410d224c3a7f3581a9d0a3d97f6d340c743a8afe998c76d2d313bc1ffcccdc1` leído, con turno todavía en 0574. Peer de oráculos `368aefb9abbd28a6c65e3b9cf0bf15fd5329b63cea5535870ea02424ef3acdab` no identifica bloqueo material por lectura; F01 .001 es regresión previa, no cuarto ROJO nuevo. Cron/UI autorados tras su baseline: una entrada BCV horaria en el generador, derivado pendiente de generación nativa, aviso veraz con fecha/fuente completas y formulario manual conservado. Casos DOM/foco/error/pending autorados, NO EJECUTADOS. Sin reparación anticipada de parser/source/sync ni ampliación de rutas. Cumplimiento estático del aviso revisado con gobernanza/marca/Norte; ejecución y /ui-check real siguen pendientes.

GO03 efectivo a 2026-10-21 13:27:50.1825184 UTC, después de devolución de 0574. Guard nativo pasó en e9a65db2; crontab generado y check pasó con 21 entradas. Índice regenerado sin delta. Checkpoint previo a ROJOS conserva parser/source/sync/types/0501 idénticos a f106 y los oráculos de 8b4. Pruebas funcionales nuevas aún pendientes en este corte; instalación/baseline no se repiten. Canónica/build/conocimiento separados del GO funcional.

Corte posterior GO03, producto `16eab3620aba3acfd1f7676453d3f30c37be5779`: ROJO inicial 23/129 funcional, reparaciones F01/F02/F03/S01 y residual inline F02 ROJO 1/46 → parser/fuente 79/79 PASÓ; sync ampliado 75/75 y UI DOM 19/19 PASARON. La focal de seis archivos tuvo 176/177 con un fallo del select tras error, conservado y reparado; el intento onReset delegado insuficiente y el positivo asíncrono mal esperado se separan en el handoff. HTTP full 01 falló preparación por colisión de fecha ficticia con legado humano; full 02 PASÓ 18 controles/27 escenarios/26 negativos, dos sesiones DML reales, strings extremos/auditoría, CAS/relectura, transporte/ACK perdido/UNKNOWN, ensayo, rollback y preservación manual/CNY/frozen/tenant. Receipt `5ad79026ec2c4d65707b73a6b648e0bd0f520008be5bb04c7bca99bc3d1dc954`, freeze129/0 diferencias y cleanup propio completo. No sumar intentos como cobertura distinta. UI real, mutantes TS, regresiones/gates, matriz integral, GET oficial condicionado y aceptación global siguen pendientes. Canónica/build/conocimiento/producción no acreditados ni ejecutados por este bloque.

### Checkpoint funcional BCV · matriz medida del 21 de octubre

Este corte sustituye únicamente los pendientes temporales de la continuación BCV de arriba. Producto/pruebas `390227699d167a7d6cdf7b22e1512f8d5a18a97c`; documentación posterior no cambia esos módulos. **Cierre local acotado: GO04B FALLÓ en test y quedó INCOMPLETO por ledger crítico sin medir; build PASÓ. GO05A reparó sólo paridad de plantilla y su focal PASÓ 3/3 sobre fd09677f8. GO05B/conocimiento pendientes, PR317 DRAFT/base C3, sin integración ni producción.** Fuente pública positiva NO DISPONIBLE por TLS. SDD permanece in-progress.

La matriz conserva fuentes y oráculos efectivos; PASÓ significa la medición local indicada, no cobertura universal. No se suman casos repetidos, selección omitida, reparación roja o slices HTTP solapados. Los archivos están en esta rama; los recibos externos propios en `C:/tmp/director-traspaso-20261020/0569-bcv-validation/`. El handoff conserva primeros fallos y recibos completos.

| Clave / recibo | SHA de entrada y resultado efectivo | SHA256 del log/recibo |
|---|---|---|
| P · go03-f02-residual-verde-01 | 658ca47a8; parser46/fuente33 =79/79 sin omisiones | log `5b3db583b048e7c765a440bf0caf57b988f6c177c738fd6e26aeb91b1aec2e63` |
| S · go03-mutantes-control-01 | a3550ab64; parser46+sync76 =122/122, sin omisiones | log `5a6f85797b7a81d536df229c6f5fc40af092b09558b33becc140bcd67c928246` |
| D · go03-deadline-phases-01 | 36fe66961;4 seleccionados/76 omitidos | log `0927c9a73b0bc31743e8ed6ff63508fc3bf772252a9cf2d5fe4c8ee027c73564` |
| T · go03-three-tenants-01 | 390227699;3 seleccionados/80 omitidos | log `83334b76490866ba4b37c0b00735db2dbd2abe470ece8845c2d16828304e2b85` |
| H · go03-http-full-02 | 16eab3620;18 controles/27 escenarios y 26 intentos DML (24 rechazos y 2 humanos legítimos); PG17.11/REST14.17/SDK2.106.1 | receipt `5ad79026ec2c4d65707b73a6b648e0bd0f520008be5bb04c7bca99bc3d1dc954` |
| X · go03-http-supplemental-01 | b8385d100; FALLÓ global por sintaxis de preparación de retirada; B5/B12/locks de instalación medidos y aceptados como evidencia parcial | receipt `d10f9edab3ad76b432ef8784eb6d1a7eba43de6d8bebd7fadc8668fdb16265aa` |
| W · go03-http-withdrawal-02 | 71ea1132b; retirada aislada PASÓ, sin repetir B5/B12/timeout | receipt `a4a64bdc2317c562ba86bbce63e92e0e6e0552a49b0c6a60e06b44fc5677e7ee` |
| Q · go02-persistencia-05 | f1061d2ea;10/10 sin omisiones, cuatro SQL mutantes incluidos | log `ef104af239c431b82ab19a5ad0aaa954968cb4c9430a3ae35057f36cb84eba14` |
| U · go03-ui-real-07 | producto7b534e047;53 controles,14 PNG sellados; no24 capturas | receipt `1b4d3990a24d792ad469aefc8a336e90662b702517a818b9a7bccd0ebc464a1c` |
| M · go03-mutantes-close-01; M06; readiness02 | a355/36fe: seis TS detectados con restauración exacta; quinto SQL readiness constante detectado; omitidos excluidos | cierre cinco TS `472dd49c4d4c09216d632f5ad9625ea237fed364ea83f19005200afb6b874294`; M06 stderr `d61ffd5bef6b0b92737dc4009edb27cf54af95d42b87c110ae57fad207ffc8e2`; readiness log `f51373cfda080e1307cdc9881ca57b1b20042d687760ab69d8751e9a210205cc` |
| A · go03-focales-01 | a12e25b35; ruta19/19 y cron11/11 dentro de corrida global176/177 FALLÓ por UI; no se renombra como verde global | result `aac3e50a450b113b840c44a8ff18a5f0bfc02de1526d4d40a3882e52fd21127d`, logs nativos conservados |

| Caso | Ruta y oráculo efectivamente medido | Resultado / atribución |
|---|---|---|
| B1 | `bcv-parser.test.ts:11`, fixture oficial/decoys; parser puro retorna VES/USD883.39630000/día21; M06 selector global devuelve2.50 | PASÓ P/S; mutante M06 falla por tasa,1 fallo/1 positivo/44 omitidos; parser restaurado exacto |
| B2 | `bcv-parser.test.ts:15–61`, cardinalidad, etiqueta/markup/date/weekday/calendario/offset IANA y rótulo inline duplicado | PASÓ P; F01/F02 y residual tuvieron ROJO válido previo. Fracción .001 ya rechazaba: regresión |
| B3 | `bcv-parser.test.ts:63–75`, extremos textuales, inválidos, equivalencia decimal; `bcv-sync.test.ts:291` sin churn | PASÓ P/S/H; M01 Number pierde último decimal y falla; precisión SQL/audit se compara como texto |
| B4 | `bcv-source.test.ts`, GET fijo, redirects1/2/tercero/rechazados, gzip nativo>1MiB, reader/UTF8/deadline20 s y cancel diferido9 modos | PASÓ P. Reloj/streams controlados y gzip HTTP loopback; no acredita TLS/disponibilidad oficial |
| B5 | `bcv-sync.test.ts:360`; driver `runSupplemental`: `b5-between-tenants`, `b5-committed-ack`, `b5-committed-lost-ack` | PASÓ S y tres parciales X aceptados; reloj app controlado cruza04:00Z con COMMIT real. Una DML, A original conservado, B diferido; ACK perdido=UNKNOWN, sin refecha ni rollback supuesto |
| B6 | `bcv-sync.test.ts:366`, fecha pasada/futura/lejana; body DB50 s compartidos:219 | PASÓ S; espera/código explícito/cero DML, sin calendario laboral inferido |
| B7 | `route.test.ts`; `bcv-sync.test.ts:85–121,212`, auth/query antes de sync, OFF antes de factory, scope0/duplicados/26 y25válidos | PASÓ A/S; bearer real regresión aparte; no IO/auth inválida ni scope del caller; M02 detectado |
| B8 | `bcv-sync.test.ts:122–211`, arrays/count/shape/cobertura/cap; fábrica/SDK reales. Driver H404array/vacío/objeto,503/truncado/S01 | PASÓ S/H; vacío200count0 real y página206 válidos preservados; capability sin count no exige header; fallo no es ausencia |
| B9 | `bcv-sync.test.ts:291`; driver `unchanged-reread`, filas/eventos/note/set_at observados | PASÓ S/H; cero UPDATE equivalente, identidad/token/nota/evento iguales, relectura íntegra |
| B10 | `bcv-sync.test.ts:302`; driver `correction-cas`; Q/SQL contrato de corrección | PASÓ S/H/Q;7 predicados y token microsegundos original,1 evento SYSTEM/job y motivo fijo. Addendum sustituye rpc solo para job nuevo |
| B11 | `bcv-sync.test.ts:312–380`; driver dos sesiones INSERT/CAS y `unchanged-interleaved` | PASÓ S/H; un ganador, pérdida/reconciliación sin segundo write; M04 detecta filtro ausente en fixture, no sustituye carrera PG real; sin ABA universal |
| B12 | driver H `audit-rollback` INSERT y ACK perdido; X `b12-patch-append-rollback.json` PATCH con cambio efectivo+23514 | PASÓ H y parcial X; fila/eventos/contexto íntegros iguales tras append fallido. ACK/aborto no demuestra rollback; solo relectura acotada o UNKNOWN |
| B13 | driver H strings0.00000001/999999999999.99999999, rate::text/audit->>rate, CAS microsegundos por SDK/HTTP real | PASÓ H; no cast float como oráculo ni PATCH artesanal; sesiones backend reales observadas |
| B14 | driver H `isolation-frozen`, RPC humano y negativos/contexto; Q contrato0495 original | PASÓ H/Q; ajeno/manual/operacion/CNY/factura/CxP iguales, prioridad BCV y RLS humana conservadas; no lectura de negocio real |
| B15 | `bcv-sync.test.ts:231,255,273,341,382,391`; T tres tenants con primero confirmado y segundo conflict/SQL/UNKNOWN | PASÓ S/D/T/H;4 deadlines seleccionados y3 particiones seleccionadas. Fake50 s+SDK/transporte controlado no equivalen a COMMIT real; H acredita éste aparte. Pendientes no sumados doble |
| B16 | `route.test.ts`, `bcv-sync.test.ts:96,116`; driver H `dry-false/dry-true/normal-off`; M03 | PASÓ A/S/H; ensayo on/off solo GET/fuente/cero efecto y exige capability; modo/guard independiente, candidata no registrada |
| B17 | `scripts/__tests__/build-crontab.test.ts`; generador/crontab f32cb6503 | PASÓ A;21 entradas,19 previas+SeaRates intactas,1 BCV `5 * * * *`, LF/secreto literal/determinismo.24 ticks nominales, sin cron instalado |
| B18 | `ExchangeRatesSection.test.tsx`19DOM; UI07 helper/acción/toast ficticios, componente/CSS/fonts reales Edge155 | PASÓ U acotado:24 estados DOM/53 controles/14 PNG; Director inspeccionó8. Touch390/coarse/maxTouch1 cinco 48px, reflow320, teclado/pending/error/éxito/zoom nativo2x. PNG zoom viewport parcial, sinSSR/AT/dispositivo físico |
| B19 | `bcv-sync.test.ts:419`, nueva invocación al día siguiente obtiene fuente otra vez y falla; UI no infiere último cron | PASÓ S; sin caché futura, replay o timer durable. No reinicio de VPS acreditado |
| R1 | `bcv-sync.test.ts:116`; Q ausencia0501; W app después de retirada real | PASÓ S/Q/W; SQL_CONTRACT_UNAVAILABLE antes de fetch/DML, también dryRun, sin fallback0495 |
| R2 | driver H/W y Q: GET service-only version1/readytrue y ausencia efecto; catálogo íntegro | PASÓ H/Q/W; no se atribuye lock/lease a GET |
| R3 | HTTP02/fullH: roleGUC/service_role, current_user postgres, session_user authenticator, auth.uidNULL/claims sin sub; 26 intentos DML (24 rechazos y 2 humanos legítimos) | PASÓ H y GO02:24 rechazos sin cambios+2 humanos user/rpc, nunca job. No claim aislado ni current_user definer como caller; secreto de servicio no atesta exclusividad cron |
| R4 | Q/H INSERT directo; auditoría system/NULL/job/motivo fijo, cuatro campos y note fuera | PASÓ Q/H; razón generada DB, no note/header humano inventado |
| R5 | Q/H corrección CAS7, rate::text/microsegundos/before-after/motivo; cero CAS sin evento | PASÓ Q/H/S; no token monotónico universal |
| R6 | S/H repetición equivalente y relectura | PASÓ, sin nota/token/motivo/evento nuevo |
| R7 | `bcv-persistence.migration.test.ts:101`, contrato0495 original intacto sobre0501; regresiones69/69 | PASÓ Q y regresiones en 71ea1132b; source/motivo manual, CNY, DELETE y documentos históricos sin ampliación de alcance |
| R8 | contrato SQL0501 motivo transaccional ajeno no vacío y control humano | PASÓ Q; branch nuevo rechaza, no hereda reason0294 ni cambia manual |
| R9 | Q/H fallo append real por catálogo o trigger acotado; X corrección23514 | PASÓ Q/H y parcial X; INSERT y PATCH revierten fila/evento/contexto, sin stub exitoso |
| R10 | S shapes/version/ready; Q trigger drift; `bcv-persistence.migration.test.ts:140` readiness constante | PASÓ Q/S y M-readiness02:1seleccionado/10 omitidos; se reaprueban solo huellas fixture, falla assert SQL `trigger disabled cierra capability`. Readiness01 seleccionó0/11 omitidos=NO EJECUTADO |
| R11 | S/H capability falsa entre tenants después del primer confirmado | PASÓ,1confirmado conservado/1diferido/cero segunda DML; no rollback global ni lease |
| R12 | H ACK perdido después de COMMIT: presencia reconcilia o lectura no disponible=UNKNOWN | PASÓ;1 write, sin autoría inferida; X cruce medianoche conserva efecto comprometido |
| R13 | A/S ensayo/auth/OFF; D capability body y señal previamente abortada, PATCH/reconciliación con presupuesto común | PASÓ, solo GET en ensayo, SDK.retry(false)/abortSignal. No se traslada un deadline SELECT a todas las fases IO |
| R14 | Q preflight/reaplicación/error posDDL+ROLLBACK; X pg_locks/timeout/instalación; W retirada exitosa con evento job previo | PASÓ por evidencias separadas: bloqueo151→166 en transactionid ShareLock/55P03 y catálogo exacto; instalación/retirada observadas con object AccessExclusiveLock. Quiescencia propia y eventos conservados; sin protección prometida ante DDL concurrente ni disponibilidad garantizada |

Rutas abreviadas `bcv-*.test.ts` están en `lib/studio/fx/__tests__/`; `route.test.ts` en `app/api/cron/bcv-rates/__tests__/`; driver en `scripts/tests/bcv-rates-postgrest.mjs`; UI en `app/studio/(app)/admin/_components/`. Regresión69: `lib/studio/__tests__/fx-rates.test.ts`, `lib/shared/__tests__/fx.test.ts`, `app/studio/(app)/admin/__tests__/exchange-rates-actions.test.ts`, `lib/http/__tests__/secret-compare.test.ts`, log SHA256 `a52d696f8b93999d2af4c192430831807cc8084fd67e7d3d33c0ccc73c0f44dc`.

Los rótulos históricos «26 negativos» o «26 intentos negativos» son inexactos: en esos cortes significan 26 intentos DML, 24 rechazados sin efectos y dos humanos legítimos user/rpc, nunca job. Se conserva la historia y los recibos; esta precisión no altera casos ni contratos.

### SGE-00 · clasificación medida del nuevo job y aviso

| Principio | Clasificación acotada y evidencia |
|---|---|
|01 predecible|Cumplimiento local B5/B6/B15: día fijo, espera/candidata/UNKNOWN veraces; sin promesa diaria.|
|02 conservación|Cumplimiento local S/H/X/U: CAS, manual/frozen/contexto preservados; error conserva4campos.|
|03 riesgo/fricción|Cumplimiento del diseño R3 aprobado: automatización autorizada y ejecución productiva separadas; sin confirmación humana inventada por tick.|
|04 auditoría|Cumplimiento local del nuevo job Q/H/X/W: motivo DB, origen job y atomicidad; las brechas manuales históricas siguen fuera, no excepción nueva.|
|05 permisos/tenant|Cumplimiento local A/S/H/Q: bearer antes de IO, scope acotado, rol/login/claims/ACL verificados; no permisos humanos nuevos.|
|06 prevención|Cumplimiento local P/S/H: estructura/fecha/decimal/snapshot/capability antes de DML.|
|07 estado verdadero|Cumplimiento local S/H/X/T: partición, reconciliación/UNKNOWN y parciales; público NO DISPONIBLE no se renombra como éxito.|
|08 pasos|Cumplimiento local U: respaldo manual conservado, pending bloquea duplicado y recuperación conserva contexto; no formulario nuevo.|
|09 patrón|Cumplimiento local: helper Caracas, cliente SDK dedicado, generador canónico, tokens/icono existente; gates de5 componentes/28 políticas validan registro, no conformidad total.|
|10 accesibilidad|Cumplimiento acotado del aviso/flujo medido U: teclado, foco, neutral>=4.5,16px,320px/2x / cinco 48px. No certificación A11Y integral, AT o teléfono físico. NC táctil06 corregida antes de UI07.|
|11 lenguaje|Cumplimiento local A/U: no se confirmó, fecha/fuente atribuibles, siguiente acción manual; sin secretos/IDs/SQL crudos en summary.|
|12 autoridad|Cumplimiento de límites: propia rama/DRAFT,0501 solo fixtures,0495 intacta; canónica/conocimiento/merge/release/producción siguen separados.|

Typecheck delta03 PASÓ en 390227699; lint delta02 cuatro archivos,0 errores/3 avisos `_note` conservados. Primer gate conjunto FALLÓ por declaración pendiente; seis pasos verdes conservados y reintento único beaa5350 PASÓ 0 ROJO/3 AMARILLO/3 homónimos. No nuevas repeticiones por rutina. Cinco warnings del lint anterior y cada fallo de preparación se conservan en handoff.

Única lectura pública implementada a 2026-10-21T14:54:05.174–05.824Z:1 intento GET/TLS normal/DB 0, **NO DISPONIBLE SOURCE_UNAVAILABLE**, causa nativa `UNABLE_TO_VERIFY_LEAF_SIGNATURE` antes de headers;0 bytes/sin hash de cuerpo completo. Receipt `go03-public-source-01/receipt.json` SHA256 `01c8f8f9fc7e7ff6c2f6e889d885b99a793e87e90c81ff079c35a766c83e116a`. Sin retry/fallback/TLS alternativo; no acredita obtención oficial positiva ni cron/operación disponible. Director permite documentar cierre local con este límite.

La receta prevista en `go03-checkpoint-funcional-01/` se concretó con supervisor V2 bajo GO04B: comando normal, freeze completo y original E2E conservado, con FALLÓ/INCOMPLETO según el corte siguiente. Una nueva canónica requiere revisión del checkpoint reparado y GO05B; no se repite por documentación. La capa documental queda guardada en rama; integración, estructura/semántica Graphify, Archify/preview/Obsidian y publicación compartida continúan pendientes separados. No se escribe memoria ni se cambia política para cerrar el job.

### GO04B preservado · paridad de plantilla GO05A

Una canónica normal sobre `62f64e8e5b8a3279892b95748487444a2e07eadb`, 16:26:49–17:00:34 UTC: **FALLÓ, exit 1, 16/17 ejecutados y cierre INCOMPLETO**. Los dos intentos nativos de Vitest dieron cada uno 13144 aprobados, 1 fallido y 1 omitido. Falló la misma aserción original `scripts/__tests__/infra-env-example.test.ts:34`: faltan `BCV_RATES_ENABLED` y `BCV_RATE_TENANT_IDS` en la plantilla de infra. No se suma cobertura entre intentos ni se llama flaky resuelto a ese fallo. Ledger crítico `migrations-applied` SKIP sin credenciales; los otros 15 pasos, incluido build, PASARON. Lint conserva 20 avisos; SQL local 250 contratos y esquema 475 migraciones más 18 sólo-ledger no acreditan producción.

Freeze completo: 6447 entradas, 0 diferencias, HEAD y árbol limpios; captura/supervisor sin errores. Nativo: 1788 identidades conocidas, 0 vivas. Postflight: 1789 incluido launcher, 0 vivas, cinco puertos observados libres y dos IDs propios ausentes con Docker consultable. Recibo externo `go04b-canonical-native-01/go04b-terminal-receipt-01.json`, SHA256 e2a8105372ade30b78446cd87b54fd76f50f11c9c7aec472588f9f4a76be378c. Director aceptó el resultado como FALLÓ/INCOMPLETO y cotejó con SHA256 58262137986cb7e907eea87df9154e79e8b1e50211626590642674f088bae355.

Original E2E: 268459 bytes, SHA256 0363dc645e9484960f92ae2715453a2bef852c7496bb2306eef16ea65f23c40c; 177 aprobados, 20 omitidos y 1 flaky `auth.spec.ts:81/chromium` recuperado por su reintento nativo, 0 inesperados finales. No cobertura integral; 2 omisiones visuales duplicadas y 18 por fixture/seed ausente. Preparaciones de captura y dos fallos del lector/ensamblaje posterior al EXIT se conservan sin alterar el original ni repetir E2E.

GO05A amplía sólo a `infra/dtd-cargo/.env.example`, con las cinco líneas literales del contrato siguiente: OFF false, scope vacío y tres comentarios; resto de bytes idéntico. Test, raíz, Compose, módulos, 0495/0501, lock y receta intactos. La única focal nativa de tres casos PASÓ 3/3 sobre fd09677f8, sin omisiones ni retry agregado; GO04B conserva su fallo histórico. No GO05B ni conocimiento. Fuente pública positiva sigue NO DISPONIBLE por el TLS anterior, sin otro GET.

### GO05A · resultado focal medido, sin nueva canónica

Checkpoint de ejecución `fd09677f83908c5ba0a9ea033220e37e1308d1af`: una invocación normal de Vitest 4.1.7 al test intacto `scripts/__tests__/infra-env-example.test.ts`, 18:07:02–18:07:16 UTC: **PASÓ, exit 0, 1 archivo y 3/3 casos, sin omisiones ni retry agregado**. El cambio funcional es únicamente la inserción literal de cinco líneas autorizadas en la plantilla de infra; el resto de bytes reconstruye exactamente su preimagen. Raíz, test, Compose, producto, 0495/0501 y lock conservados.

Freeze completo: 6451 entradas antes/después, 0 diferencias, HEAD y árbol limpios hasta EXIT y comparación. Tres identidades nativas conocidas y launcher ya ausentes por PID/ticks UTC, sin Kill ni censo universal. Native stdout SHA256 `5078a1a2d8bd81f842e6e3b6ef950787c258176aec5a8f3559a6d64d377332bc`; result `f3abaae08b601d551a82fed4a28550af7e37241dd703e23c7aec4a28e3e5f4f2`; postflight `b0a5a58c2ba986f69ccf9856e584aed7bb047e09096049bb03af62f5d1c3fd07`, en `C:/tmp/director-traspaso-20261020/0569-bcv-validation/go05a-parity-native-01/`.

Director aceptó acotadamente GO05A y cotejó las 6451 entradas, seis artefactos y cuatro identidades ausentes: prueba externa SHA256 `dd2cc49a147219d03b75f63b0e27d00be4f7c3d3efc5acedf8ed70c914bc364a`. La focal corrige el oráculo de paridad medido; **GO04B permanece FALLÓ e INCOMPLETO**, con sus dos intentos y omisiones. El fallo auxiliar inicial de comparación de nombres antes del commit se conservó como preparación, sin ejecución de tests ni cambio de producto para pasarlo. Nueva canónica GO05B y ciclo de conocimiento siguen NO EJECUTADOS. Cierre documental, commit/push y DRAFT son respaldo para revisión; no integración, release ni producción.
### Addendum Director32 y GO05A · original íntegro d73e2afc
~~~~~~markdown
# SDD-0569 · addendum Director32 y GO05A de reparación local

21 de octubre de2026. Director Codex. **AUTORIZADO: reparación mínima local y prueba focal nativa.** Mismo SDD0569, Worker/claim `worker-0569bcv-01a15a4e-ddf0-7d82-8656-d9dc56b58468`, rama `codex/sdd-0569-bcv-carga-diaria` y worktree `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0569-bcv-carga-diaria`. PR317 permanece DRAFT. No autoriza main/merge/deploy/producción/VPS/DB real/filas/PII/secretos/flags/agenda/GET oficial ni conocimiento todavía.

## Evidencia y decisión

Se conserva íntegro el addendum31 `0569-bcv-addendum-auditoria-director-31-rutas.md`, SHA256 `87589d14362e2e740713db01775ba5c7c551a2c6bbf4fe307932abd664049412`, y sus contratos B1–B19/R1–R14. Esta enmienda sustituye exclusivamente su límite de31 por la unión literal32 de abajo y concede GO05A acotado, posterior al cierre de GO04B. No autoriza nueva SQL, cambio de receta, tests debilitados ni alteración de los archivos protegidos.

GO04B ejecutó una canónica normal sobre `62f64e8e5b8a3279892b95748487444a2e07eadb`, de16:26:49 a17:00:34UTC, exit1. **FALLÓ test y además quedó incompleto16/17 por ledger crítico omitido**. Dos intentos nativos de Vitest fallaron la misma aserción `scripts/__tests__/infra-env-example.test.ts:34`: faltan en infra los nombres `BCV_RATES_ENABLED` y `BCV_RATE_TENANT_IDS`. No es un flaky resuelto. El resultado previo, sus dos intentos, originales y omisiones permanecen sin sobrescribir ni reinterpretar como aprobados.

Director leyó la nota independiente completa `0569-bcv-revision-paridad-env-infra-peer.md`, SHA256 `25c8ac6e856db9916fe69caadc08355b3c67b157a1cc582f39f88b367dd73969`. El oráculo original exige documentar los nombres de la plantilla raíz; las dos asignaciones ya existen en raíz y faltan en infra. Preimagen infra Git `37d1bf351226384012e62472a34c1efe079188d2`, test Git `78c80a8c287a34839e692cbfa1681f77f7cac741`, raíz Git `6d8599cad32f7ca11dc0b8b5428eaed11d7bb422`. No cambiar test, script, raíz ni Compose para eludir la aserción.

Cotejo independiente Director aceptado `0569-bcv-canonica-04b-cotejo-director.json`, SHA256 `58262137986cb7e907eea87df9154e79e8b1e50211626590642674f088bae355`:6447 antes/después/actual, cero diferencias, HEAD62 y árbol limpio,1788 identidades conocidas sin coincidencias vivas, claim correcto retenido. Paquete terminal Worker `go04b-terminal-receipt-01.json`, SHA256 `e2a8105372ade30b78446cd87b54fd76f50f11c9c7aec472588f9f4a76be378c`, devuelve expresamente el turno pesado. Se conserva Docker Desktop y se preservan procesos ajenos.

## Delta funcional único autorizado

Añadir después de `CRON_SECRET` en `infra/dtd-cargo/.env.example`, antes de `DEBUG_HEALTH_SECRET`, exclusivamente este bloque con la separación de líneas necesaria:

```dotenv
# SDD-0569 · BCV VES/USD. Normal OFF; activación productiva pendiente.
BCV_RATES_ENABLED=false
# Scope explícito de UUID únicos (máximo25); vacío falla cerrado. Sin IDs reales.
BCV_RATE_TENANT_IDS=
# Reutiliza CRON_SECRET; ver docs/runbooks/bcv-tasas-diarias.md para ensayo/activación.
```

No poner true, tenant real o ficticio, credenciales ni valores operativos. Conservar todos los demás bytes y asignaciones de la plantilla. El ensayo autenticado estricto ya documentado sigue siendo modalidad distinta de OFF normal; esta inserción no activa job, instala cron, aplica0501 o autoriza ensayo. No editar `.env` vivo ni configuración de Docker/Compose.

## Allowlist acumulada32, sin obligación de editar todas

```text
app/api/cron/bcv-rates/route.ts
app/api/cron/bcv-rates/__tests__/route.test.ts
lib/studio/fx/bcv-types.ts
lib/studio/fx/bcv-parser.ts
lib/studio/fx/bcv-source.ts
lib/studio/fx/bcv-sync.ts
lib/studio/fx/__tests__/bcv-parser.test.ts
lib/studio/fx/__tests__/bcv-source.test.ts
lib/studio/fx/__tests__/bcv-sync.test.ts
lib/studio/fx/__tests__/bcv-persistence.migration.test.ts
lib/studio/fx/__tests__/fixtures/bcv-usd-20261021.html
lib/studio/fx/__tests__/fixtures/bcv-decoys.html
lib/studio/fx/__tests__/fixtures/bcv-ambiguous.html
scripts/tests/bcv-rates-postgrest.mjs
scripts/build-crontab.mjs
scripts/__tests__/build-crontab.test.ts
infra/dtd-cargo/cron/crontab
package.json
pnpm-lock.yaml
app/studio/(app)/admin/_components/ExchangeRatesSection.tsx
app/studio/(app)/admin/_components/ExchangeRatesSection.test.tsx
docs/runbooks/bcv-tasas-diarias.md
docs/runbooks/servidor-contabo.md
docs/specs/README.md
docs/specs/0569-conversor-usd-tasas/spec.md
.agents/handoffs/0569-bcv-carga-diaria.md
supabase/pending-migration-symbol-declarations.json
.env.example
supabase/migrations/0501_bcv_rates_system_audit.sql
supabase/tests/bcv_rates_system_audit.test.sql
supabase/migrations-baseline.json
infra/dtd-cargo/.env.example
```

## Secuencia GO05A

1. Leer íntegro y confirmar SHA de este addendum; copiar contrato íntegro al handoff/spec propios con autorización32 y fuente31 conservada. Revalidar raíz/rama/HEAD62/claim/guard y limpieza antes de editar. Si hay cambio ajeno o nueva diferencia, conservar y comunicar antes de tocarla.
2. Aplicar únicamente la inserción anterior y actualización documental de alcance/evidencia ya autorizada. Registrar diff literal y hashes antes/después. Confirmar originales test/raíz/Compose/producto/SQL/lock/receta sin cambio. 0495 aplicada y0501 local permanecen inmutables.
3. Concedido turno para **una ejecución focal** de la suite nativa intacta `scripts/__tests__/infra-env-example.test.ts`, mediante el Vitest instalado y su configuración normal, sin filtros de casos, cambios de timeout/worker/CI/retries/configuración ni flags de omisión. Esperadas3 comprobaciones originales; registrar total real, stdout/stderr/exit y recursos conocidos. No repetir automáticamente ante fallo.
4. Congelar inputs antes/después de esa ejecución, cotejar bytes y HEAD, conservar salidas nativas, ausencia de procesos propios por identidad. Guard y diffcheck; commits selectivos coherentes de la reparación/documentación, push de rama propia y actualización de PR317DRAFT ya autorizados. Ningún git add global.
5. Entregar SHA local/remoto/DRAFT, diff completo, artefactos y límites. **No invocar otra canónica aún.** Director revisará el checkpoint corregido y el plan de nueva canónica. El fallo concreto de GO04B justifica repetir el cierre canónico una vez revisada la corrección; no lo justifica una preferencia por resultados verdes ni documentación sola.

Las pruebas previas siguen con sus resultados y alcance. `migrations-applied` sin credenciales es NO EJECUTADO/SKIP crítico; no buscar credenciales ni aplicar DB para cambiar ese resultado. GET oficial positivo sigue NO DISPONIBLE por TLS bajo la única consulta anterior; sin reintento/fallback. Cobertura E2E no es integral por20 omisiones y1 flaky original. Toda aprobación posterior será local y con estos límites, sin cierre global2.1 ni producción implícita.
~~~~~~
