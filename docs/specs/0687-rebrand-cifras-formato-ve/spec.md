---
sdd: "0687"
title: "Cifras en formato venezolano: punto de miles y coma decimal, al mostrar y al teclear"
status: approved
author: "Claude Worker (Sam)"
created: 2026-11-20
updated: 2026-11-23
supersedes: null
superseded_by: null
related: ["0686", "0688", "0629", "0660", "0667", "0704"]
confidencialidad: interno
---

# SDD-0687 — Cifras en formato venezolano

> El mismo monto se lee de dos maneras según la pantalla, y lo que se teclea no siempre se entiende como se ve.
> Sin migraciones y sin datos de producción. Etiquetas: **C** código leído · **M** medido · **I** inferencia · **NV** sin verificar.

## Estado (2026-11-24)

Opción A de entrada elegida por Sam y asignada mediante el Director: un solo
punto o una sola coma significa decimal; no se aceptan miles en literales humanos.
Esta enmienda sustituye las reglas de ambigüedad de §§2, 4 y 6 y la regla H1
histórica de §12. La autorización inicial de implementación se distinguió de la aprobación
posterior de Sam de la regla y vista previa de NUM-01 (2026-11-24), confirmada
por el Director en `msg_c31b38185eb6`. No autoriza integración ni fases futuras.

La evidencia anterior sobre `27d8b46d9` se conserva como historia. Esta tarea parte
de `8580490f8d95872a407ab83ab9acb6b1b265a451`. Se conserva el estado aprobado de
la spec original sin marcarla done. Regla y vista de la enmienda aprobadas por
Sam; implementación sujeta a revisión independiente y CI antes de integrar.

## 1. Problema

**Decisiones de Sam, 2026-11-20, literal, en el chat de la sesión «Rebrand Design»:**

- «El formato que se usa va a ser el segundo, el que dice 1.235,50: la coma siempre va a ser los decimales.»
- A la pregunta «Al teclear «1.234» en un campo de dinero, ¿qué debe entender el sistema?»: «Pedir que se aclare».

Esto **sustituye** la decisión del 2026-08-11 que fijó `$1,234.50` como formato del ERP (cabecera de `lib/money.ts`).

**Lo medido (C y M, sobre `main` `27d8b46d9`):**

| Qué | Cifra |
|---|---|
| Formateador único de dinero (`lib/money.ts`: `fmtUsd`, `fmtAmount`, `fmtUsdCompact`), en `en-US` | Lo usan 40 archivos |
| Archivos de producto con `en-US` | 78 (47 en el Studio) |
| Archivos de producto con `toFixed(` | 111 |
| Archivos con `toLocaleString` o `Intl.NumberFormat` | 127 |
| Archivos que ya mencionan `es-VE` | 226 (la mayoría por fechas y textos, no por cifras) |
| Campos con `<NumericInput>` | 45 archivos |
| Campos con `<input type="number">` crudo | 46 archivos |
| Lugares que convierten lo tecleado con `replace(",", ".")` a mano | 26 archivos |
| Pruebas con cifras escritas como `1,234.50` | 37 archivos |

Conteos por texto sobre `main` `27d8b46d9`, sin pruebas ni `docs/`; son techo, no cuenta exacta. La cuenta exacta la fija el contrato de la fase 3 (§6). Sobre `2ea18799a` (2026-11-20) las filas eran, en el mismo orden: 40, 65, 49, 54, 43, 42, 22 y 34; la fila de `toLocaleString` es nueva. La diferencia no es crecimiento de `main`: la revisión midió ambas cabezas con el mismo criterio y dio lo mismo (`en-US` 77 y 77, `toFixed(` 106 y 106, `es-VE` 208 y 210); la variación sale del criterio de conteo (qué carpetas y qué pruebas entran), no del código.

Hoy conviven `$1,234.50`, `1.234,50` y `USD 1.234,50` en el mismo sistema.

## 2. Entrada humana: opción A (2026-11-24)

Cada literal se lee por separado, incluido el que aparece en una expresión.
Un punto o una coma únicos son decimales aunque haya exactamente tres cifras
después. No se eliminan separadores para inventar miles. Los ceros finales
cuentan para validar la precisión: `1.250` tiene tres decimales de entrada.

| Se escribe | Dinero (2 decimales) | Tasa (8) | Medida (4) | Porcentaje (2, 0–100) |
|---|---|---|---|---|
| `12.5` · `12,5` · `12.50` · `12,50` | 12.5 | 12.5 | 12.5 | 12.5 |
| `1234,50` · `1234.50` | 1234.5 | 1234.5 | 1234.5 | Rechazo por rango |
| `1250` | 1250 | 1250 | 1250 | Rechazo por rango |
| `0.366` · `0,366` | Rechazo por precisión | 0.366 | 0.366 | Rechazo por precisión |
| `1.234` · `1,234` | Rechazo por precisión | 1.234 | 1.234 | Rechazo por precisión |
| `1.250` · `10.000` · `10,000` | Rechazo por precisión | 1.25 · 10 · 10 | 1.25 · 10 · 10 | Rechazo por precisión |
| `36.500` · `36,500` | Rechazo por precisión | 36.5 | 36.5 | Rechazo por precisión |
| `1.234,50` · `1,234.50` | Rechazo por agrupación | Igual | Igual | Igual |
| `1.234.567` · `1,234,567` | Rechazo por agrupación | Igual | Igual | Igual |
| `36,51259999` | Rechazo por precisión | 36.51259999 | Rechazo por precisión | Rechazo por precisión |
| `36,512599991` | Rechazo por precisión | Rechazo por precisión | Rechazo por precisión | Rechazo por precisión |
| `-12.5` | -12.5 si el campo admite negativo | Igual | Igual | Rechazo por rango |
| `0` | 0 | 0 | 0 | 0 |
| Vacío | Sin dato | Sin dato | Sin dato | Sin dato |
| `12.` · `12,` · `12+` | Edición parcial; conserva el último válido y bloquea confirmar | Igual | Igual | Igual |

La agrupación se rechaza con **«Escribe el número sin puntos de miles»**.
El texto permanece para corregirlo. En campos intactos el mensaje se presenta
al confirmar (blur, Enter, Tab o submit); después del primer error, al corregir.
Una entrada inválida borra el valor oculto anterior; una entrada incompleta
conserva el último válido, pero la validez HTML bloquea enviar.

### 2.1 Vista inmediata en NumericInput

| Entrada ficticia | Campo | Valor canónico | Vista |
|---|---|---|---|
| `0.366` | Medida, m³ | `0.366` | `= 0,366 m³` |
| `1250` | Medida, m³ | `1250` | `= 1.250 m³` |
| `1234.50` | Dinero | `1234.5` | `= 1.234,50` |
| `36.51259999` | Tasa | `36.51259999` | `= 36,51259999` |
| `3.498` | Dinero con 4 decimales, ft³ existente | `3.498` | `= 3,498` |

Se conserva la precisión mínima visual declarada por el campo; el máximo de la
vista nunca oculta los decimales aceptados del resultado. No cambia ningún
redondeo ni cálculo de negocio. El formato de salida sigue siendo `1.234,50`.
El texto editable al confirmar es decimal con coma **sin miles**, de modo que
se puede volver a interpretar. Una salida agrupada no sirve como entrada humana.

### 2.2 Canónico y datos anteriores

`parseNumero` y sus cuatro wrappers leen texto humano. `parseMaquina` conserva
su gramática y límites para el valor serializado del servidor. No se cambian
almacenamiento, montos antiguos, exportaciones ni formateadores de otras fases.
Los consumidores ft³ y sus conversiones permanecen disponibles.
`<input type="number">` entrega un decimal canónico según el navegador; esta
enmienda no migra campos ni amplía fases.

## 3. Qué pasa con lo ya guardado

- **Los números guardados no cambian.** En la base de datos son valores numéricos; el formato es solo de pantalla. **No hay migración.**
- **Lo que pudo quedar mal guardado antes** por el caso 2.2 no lo arregla esta spec ni se puede detectar por formato: un 1,25 legítimo y un 1250 mal tecleado son indistinguibles. Si Sam quiere revisarlo, es una consulta aparte sobre producción, con su autorización nominal. **No se propone aquí.**
- **Textos ya generados** (mensajes enviados, correos, notas, PDF emitidos y guardados) conservan el formato con que se crearon; no se reescriben.
- **Documentos que se generan al momento** (recibo, estado de cuenta, rendición) saldrán con el formato nuevo desde que se publique. Un mismo documento impreso antes y después se verá distinto: **decisión pendiente** para la factura (§9).

## 4. La regla

1. **Al mostrar:** punto de miles y coma decimal en todo el sistema, para todo número que lee una persona.
2. **Al guardar y al enviar entre sistemas:** formato de máquina (`1234.50`). No cambia.
3. **Al teclear:** un punto o una coma únicos son decimales en todos los modos. Agrupaciones mixtas o repetidas se rechazan con «Escribe el número sin puntos de miles». La precisión y el rango del campo siguen mandando (§4.2).
4. **Un solo lugar para formatear y uno solo para interpretar.** Nadie formatea ni convierte a mano.
5. **Archivos para máquinas** (CSV, Excel con celdas numéricas) llevan el número real, no texto con formato.

### 4.1 NUM-01 v1.2, opción A aprobada el 2026-11-24

`docs/governance/policies/num-01.md` registra opción A y la trazabilidad desde
v1.1 y la propuesta v1.2 previa. Sam aprobó regla y vista previa según confirmación
del Director `msg_c31b38185eb6`. Se actualiza solo su fila del registro maestro
y se regeneran los derivados canónicos aplicables, sin promover componentes ajenos.

FRM-01 y ERR-01 conservan su contrato: primera validación al confirmar,
corrección en vivo posterior, texto preservado, relación `aria-describedby` y
vista sin región viva durante la escritura.

### 4.2 Modo y precisión por campo

| Modo | Precisión predeterminada | Rango / signo | Separador único |
|---|---|---|---|
| Dinero | 2 | Según campo | Decimal; si excede precisión se rechaza |
| Tasa | 8 | Según campo | Decimal, incluido `36.500` |
| Medida | 4 | Según campo | Decimal, incluido `0.366` |
| Porcentaje | 2 | 0 a 100 | Decimal; precisión especial explícita permitida |

El modo es obligatorio. `decimales` puede declarar una precisión distinta,
incluido 0; no se redondea silenciosamente un literal excedido. Dinero con
4 decimales acepta tanto `3.498` como `3,498`. No se retiran campos ft³.
`min`, `max`, signo, moneda y unidades se conservan por campo.

### 4.3 El helper compartido (propuesta)

Un solo módulo, `lib/shared/cifras.ts`, en `lib/shared/` porque lo importan la web pública, el Portal, el Studio y el móvil (la web pública no puede importar `@/lib/studio`). `lib/money.ts` queda como fachada que reexporta, para no tocar de un golpe los 40 importadores.

| Función | Para qué | Ejemplo (opciones A de §9) |
|---|---|---|
| `fmtUsd(n)` · `fmtAmount(n)` · `fmtUsdCompact(n)` | Dinero con y sin símbolo; KPI compactos | `$1.234,50` · `1.234,50` · `$1,2K` |
| `fmtNumero(n, {min, max})` | Cantidades, bultos, porcentajes | `1.234` · `12,5` |
| `fmtTasa(n)` | Tasa de cambio, 4 decimales | `36,5000` |
| `fmtMedida(n, unidad)` | CBM y peso: reutiliza la regla de `lib/shared/cbm.ts` (SDD-0667) | `0,1250 m³` |
| `fmtParaArchivo(n)` | CSV y Excel: número de máquina, sin miles y con punto | `1234.50` |
| `parseNumero(texto, modo)` con `modo` = `dinero` · `tasa` · `porcentaje` · `medida` (sin valor por defecto, §4.2). `parseDinero`, `parseTasa`, `parsePorcentaje` y `parseMedida` son atajos de esa misma función | Lo que teclea una persona; devuelve `{ok, valor}` o `{ok: false, pedirAclarar}` | tablas de §2 |

Reglas del helper: no depende del idioma del equipo (se fija `es-VE` con opciones explícitas, no el idioma del navegador); redondea una sola vez, al mostrar; `NaN` e infinito salen como «—», nunca como `$0,00` (hoy `fmtUsd` los pinta `$0.00`, que esconde errores; decisión 8 de §9). El analizador de hoy vive en `lib/studio/util/parse-numeric-expression.ts` y lo usa `<NumericInput>` del Studio; el Portal y la web no pueden importar de `lib/studio`, así que la fase 1 mueve la parte de separadores a `lib/shared/cifras.ts` y el archivo del Studio la reutiliza. Ya existe `lib/i18n/format.ts` (`formatNumber`, `formatCurrency`) que depende del idioma (`es-VE` o `zh-CN`): se conserva solo para lo que de verdad cambie con el idioma (decisión 3 de §9). También `lib/shared/equivalente-bs.ts` (`fmtTasa`, en `en-US`) pasa al helper.

## 5. Fases

**El orden importa: primero se arregla lo que se teclea y después se cambia lo que se muestra.** Nunca se publica el formato nuevo sobre el analizador viejo. Una fase, una rama, una PR.

| Fase | Qué | Allowlist (se fija archivo por archivo al abrirla) | Tamaño |
|---|---|---|---|
| **1** | **Entrada única.** Un analizador con un modo por tipo de campo (dinero, tasa, porcentaje, medida; §4.2); `<NumericInput>` lo usa y muestra el mensaje de aclaración (ERR-01 «Campo») | `lib/studio/util/parse-numeric-expression.ts`, `app/studio/_components/ui/NumericInput.tsx`, sus pruebas, `docs/governance/components/numeric-input.json`, `docs/governance/policies/num-01.md` (v1.2, §4.1), `docs/governance/README.md` y `docs/governance/generated/` | M |
| **2** | **Los conversores a mano (26 archivos)** pasan al analizador único, en servidor y cliente, empezando por dinero (reporte de pago del Portal, tasa de cambio, monto cotizado, descuentos) | los archivos de §1 y sus pruebas | M |
| **3** | **Formateador único.** `lib/money.ts` cambia a `1.234,50`; se añaden formateadores de número, tasa y medida; cabecera reescrita con la decisión nueva | `lib/money.ts`, `lib/shared/equivalente-bs.ts`, `lib/shared/cbm.ts`, `lib/i18n/format.ts`, los formateadores propios que pasan a reexportar o a usar el helper (`lib/portal/portal-types.ts:427-432`, `lib/studio/costing/types.ts:249-256`, `lib/studio/agent-types.ts:426-444` con K y M compactos, `lib/studio/nomina/ficha-empleado.ts:106` que hoy muestra «USD …» con `es-VE` y currency, `lib/shared/annual-billing.ts:102`, `lib/studio/rate-types.ts:274`, `lib/studio/expense-types.ts:395`), pruebas | M |
| **4** | **Formato a mano → formateador**, por grupos de módulos, con un contrato que congela la lista y solo baja | los archivos de §1 con `en-US` y `toFixed`, por grupos | L, varias PR |
| **5** | **Lo que sale del sistema:** CSV (`lib/studio/export/comercial-csv.ts`, `lib/studio/renditions/rendition-csv.ts`), Excel, PDF, recibos, textos de WhatsApp y correos | por decisión de §9 | M |
| **6** | **Portal, móvil y calculadoras de la web** (`components/CalculadoraForm.tsx`, `FclCalculator.tsx`, `TarifasTabs.tsx`, `app/portal`, `app/m`) | por grupos | M |

### 5.1 Pantallas y salidas afectadas

Lista por texto (no se abrió cada una); la lista exacta y congelada nace en la fase 3.

| Zona | Dónde | Cómo se muestra hoy | Fase |
|---|---|---|---|
| **Facturación (Studio)** | `app/studio/(app)/facturacion/` (`FacturacionClient`, `InvoiceDrawer`, `InvoiceDetailClient`, `StudioInvoicePaymentReports`, `[code]/page`) | `fmtUsd` en-US y `toFixed` | 4 |
| **Cobranzas (Studio)** | `app/studio/(app)/cobranzas/` (`CobranzasClient`, `CobranzaDrawer`, `IdentifyPaymentDrawer`, `RecordatoriosDrawer`, `recibo/[code]/page`, `actions.ts`) | en-US; los recordatorios arman texto con montos | 4 y 5 |
| **Contabilidad, Tesorería, Gastos, Fiscal, Nómina, Rendiciones, Financiero China** | `app/studio/(app)/{contabilidad,tesoreria,gastos,fiscal,nomina,rendiciones,financiero-china}/` (`contabilidad/_components/format.ts` es un formateador propio) | en-US, mezcla con `es-VE` | 4 |
| **Cotizador, tarifas, costos, órdenes (Studio)** | `app/studio/(app)/{cotizador,tarifas,costing,ordenes-venta,ordenes-compra}/` | en-US | 4 |
| **Dirección, Reportes, Dashboard** | `direccion/`, `reportes/`, `dashboard/` (KPI compactos y gráficos: ejes y tooltips) | `fmtUsdCompact`; gráficos con `toFixed` | 4 |
| **Portal del cliente** | `app/portal/(app)/{facturas,envios,compras,referidos,_components/PortalDashboardNorte}`, `lib/portal/portal-avisos.ts`, `lib/portal/portal-types.ts`; reporte de pago en `lib/portal/payment-report-types.ts` | mezcla; **entrada con `replace(",", ".")`** | 2 y 6 |
| **`/tarifas`, calculadoras y cotizador web** | `components/TarifasTabs.tsx`, `components/CalculadoraForm.tsx`, `components/FclCalculator.tsx`, `components/CbmExplicador.tsx`, `components/CotizadorFletes.tsx`, `components/UltimoKmCalculator.tsx`, `components/document-import/DocumentCalculator.tsx`, `components/document-import/DocumentEditor.tsx` | `$${n.toLocaleString("en-US")}` y `toFixed(2)` a mano; son cifras visibles al público | 6 |
| **Proveedores (enlace por token)** | `app/p/[token]/` (packing list, documento compartido) | `toLocaleString` | 6 |
| **Móvil** | `app/m/{emp,ve}/...` (recibo del empleado, camionero, bodeguero) | `es-VE` en el recibo, mezcla en el resto | 6 |
| **PDF** | `lib/studio/pdf/factura-pdf.tsx:240`, `lib/studio/pdf/estado-de-cuenta-pdf.tsx:80`, `lib/studio/pdf/pdf-doc.tsx:22`, `lib/studio/pdf/recibo-pdf.tsx:46`, `lib/studio/receipts/receipt-template.ts:98-99` (las rutas `app/portal/(app)/facturas/[code]/pdf/route.ts`, `facturas/estado-de-cuenta/pdf/route.ts` y `app/m/emp/recibo/[period]/pdf/route.ts` delegan en ellos), `lib/studio/document-import/pdf.tsx` | Formateadores propios con `en-US` (señalado por la revisión; corrige una fila anterior que decía «sin verificar») | 5 |
| **Correos y mensajes** | `lib/studio/invoice-mail-vars.ts:34` (hace `toFixed` y convierte `NaN` en 0), `lib/public/cotizador-flete.ts:53` (texto de WhatsApp en `en-US`), `app/api/cron/portal-cold-reminder/route.ts`, `app/api/cron/conversation-digests/route.ts`, recordatorios de cobranza | `toFixed` y `en-US`; los dos últimos **NV**: se miden en la fase 5 | 5 |
| **CSV y Excel** | `lib/studio/export/{csv,comercial-csv,operativo-csv}.ts`, `lib/studio/renditions/rendition-csv.ts`, `lib/studio/accounting/libro-control.ts`, `lib/studio/audit/export-service.ts`, `lib/studio/bitacora/reports.ts`, **`lib/studio/reports/export-csv.ts` (libros SENIAT en `FiscalClient.tsx:25` y Retenciones en `WithholdingsView.tsx:105-130`)**, **`app/studio/(app)/gastos/actions.ts:424-438` (el CSV de la contadora)**, **`buildCostingCsv` en `CostingClient.tsx:43`**, `lib/studio/document-import/export.ts:12,55`, `lib/studio/prealertas/packlist.ts` | texto o número según el archivo; **riesgo R2 directo**: una cifra `1.234,50` sin comillas parte la columna en un CSV con coma | 5 |

### 5.2 Choques con trabajo en curso (esta spec no edita ahí)

- **Rama `claude/sdd-0686-fase3-movil-noticias`** (app/m y Noticias web, colores). Archivos que esa rama toca y que la fase 6 de esta spec tocaría: `app/m/emp/_components/EmpClient.tsx`, `app/m/emp/_components/MensajesTab.tsx`, `app/m/ve/camionero/_components/CamioneroClient.tsx`, `app/m/ve/camionero/_components/CurrentDelivery.tsx`, `app/m/ve/bodeguero/_components/BodegueroClient.tsx`. **La fase 6 espera a que esa rama esté fusionada** y arranca desde `main` actualizado.
- **SDD-0704 F1-B** (`lib/studio/ia/`, `app/studio/(app)/admin/ia/`). Esta spec no toca esas rutas; los costos de IA que se muestren con `fmtUsd` entran en la fase 4 solo cuando esa fase se haya fusionado.
- Las fases 1 a 3 (`lib/shared/`, analizador, `lib/money.ts`) no coinciden con ningún archivo de ninguna de las dos.
- Las PR de color de la 0686 recorren los mismos archivos del Studio que la fase 4: el orden y el rebase los coordina el Director.

Las fases 1 y 2 **no cambian lo que se ve**; sí cambian qué se acepta. Se pueden publicar antes que el resto y cierran el caso de §2.2 por sí solas.

### 5.3 Lo que viaja a otro sistema sigue siendo numérico

- Lo que sale por `NEXT_PUBLIC_HAILUWAY_API` (las props de `/tarifas`) viaja como número; **cada lado formatea** al mostrar. La web pública no recibe texto ya formateado.
- Lo que va a Kommo (`lib/studio/kommo-writeback.ts:164-166`) también es numérico; el formato lo decide Kommo. Esta spec no lo toca.
- **Enlace de proveedores** (`app/p/[token]/provider-format.ts:6`): formatea con `zh-CN`, `es-ES` o `en-US` según el idioma del proveedor, a propósito (decisión 10 de §9). Entra en la fase 6 solo si Sam elige la opción B. Aparte, `PackingListFormSection.tsx:116,118,120,121` usa `en-US` fijo, sin depender del idioma del proveedor: ese sí es un formateador más y entra en la fase 6 con el resto.
- **Búsqueda global** (`lib/studio/global-search/classify.ts:75`): `parseAmount` ya interpreta en formato venezolano (punto de miles y coma decimal) pero quita todos los puntos sin mirar cuántas cifras siguen. Se anota en el **contrato de entrada** (§6): es un conversor más y pasa al analizador en la fase 2.

### 5.4 Las cifras dependen de ICU (nota de la revisión)

Con Node 24 e ICU 78, `Intl.NumberFormat("es-VE", {style: "currency", currency: "USD"})` da `USD 1.234,50`. Para `$1.234,50` hace falta `currencyDisplay: "narrowSymbol"`, y entonces el negativo sale `$-1.234,50`; el compacto sale `1,3 K` con espacio. Dos salidas, a elegir al abrir la fase 3:

- **A (propuesta):** el helper depende de ICU **solo para los dígitos y los separadores** (usa `Intl.NumberFormat` con `es-VE` fijo, así que sigue sujeto a la versión de ICU), y pone él mismo el símbolo, el signo y el sufijo. El negativo se escribe **`-$1.234,50`** (signo delante del símbolo, como hoy).
- **B:** se usa ICU completo y se acepta lo que dé cada versión.

Con cualquiera, la fase 3 incluye **una prueba de que el servidor (Node) y el navegador dan el mismo texto** para un conjunto fijo de valores (cero, negativo, miles, millones, compacto, `NaN`), y un contrato que fije la versión de ICU de la que se partió.

## 6. Aceptación

- **Ida y vuelta editable (propiedad):** para montos de hasta dos decimales, el texto decimal sin agrupación se vuelve a interpretar igual, con punto y con coma. La salida `1.234,50` conserva su formato, pero no se reinterpreta como entrada.
- **Tabla de §2 como prueba**, caso por caso, en los cuatro modos (dinero, tasa, porcentaje y medida). Cada rechazo comprueba el mensaje y que **no se guarda nada**.
- **Mutantes de opción A:** aceptar agrupaciones `1.234,50`, `1,234.50` o miles repetidos; volver a interpretar `1.250` como miles; rechazar `36.500` en tasa o `3.498` en dinero de cuatro decimales; omitir precisión; cambiar el eco a `en-US`; ocultar decimales válidos. Cada mutante debe romper una prueba propia.
- **Contrato de entrada:** ningún archivo fuera del analizador contiene `replace(",", ".")` aplicado a un valor tecleado, ni quita puntos con `replace(/./g, "")` (el caso de `parseAmount` en `lib/studio/global-search/classify.ts:75`, que ya interpreta en formato venezolano y pasa al analizador); cuenta exacta, con la lista de excepciones justificadas (por ejemplo, lectores de archivos ajenos: `lib/studio/fx/bcv-parser.ts`, `lib/studio/partner-finance/statement-parser.ts`, `lib/studio/document-import/extract.ts`, que leen formatos de terceros y **no** se tocan).
- **Contrato de salida:** ningún archivo fuera de los formateadores llama a `toLocaleString` o `Intl.NumberFormat` con `en-US` para un número que se muestra; lista congelada que solo baja (modelo `fechas-contract.test.ts`).
- **CSV:** una prueba abre el archivo generado y comprueba que cada fila tiene el mismo número de columnas y que los montos se leen como números.
- **Los fixtures de entrada humana se actualizan según §2.** Los fixtures canónicos, serializados, de datos guardados y de salida formateada se conservan. Las fases futuras mantienen su alcance separado.
- El acceso por lector de pantalla del mensaje de aclaración cumple ERR-01: ligado al campo con `aria-describedby`, sin región viva mientras se escribe.

## 7. Riesgos

| # | Riesgo | Cómo se contiene |
|---|---|---|
| R1 | Publicar el formato nuevo con la entrada vieja y guardar montos mil veces menores | Orden de fases (§5): entrada antes que salida; mutantes de §6 |
| R2 | CSV roto: `1.234,50` dentro de un archivo separado por comas parte la columna | Regla 5: número real en archivos para máquinas; prueba de columnas |
| R3 | El ERP en chino (`zh-CN`) escribe `12,323.50` (`lib/i18n/format.ts`) | Decisión pendiente (§9). Propuesta: formato único en todos los idiomas, porque las cifras se comparan entre oficinas |
| R4 | Documentos fiscales o contables con formato distinto antes y después | Decisión pendiente para la factura (§9) |
| R5 | `<input type="number">` se comporta distinto por navegador | Dinero pasa a `<NumericInput>`; el resto se prueba en Chromium, Firefox y WebKit |
| R6 | Lectores de archivos de terceros (BCV, extractos, importación de documentos) usan su propio formato | Fuera de alcance, listados como excepción en el contrato |
| R7 | Un usuario pega miles antiguos en la entrada humana | Opción A: agrupación rechazada; cada punto o coma únicos es decimal con precisión validada y eco inmediato |

## 8. Verificación y publicación

- Revisión independiente específica para la interpretación de cifras, con modelo fuerte, que lanza el Director General.
- `pnpm verify` con turno del Director; CI verde sobre la cabeza exacta.
- Prueba manual en la imagen de prueba: registrar un pago en el Portal, una tasa, un gasto y una cotización tecleando los casos de §2, con datos de mentira.
- Fusionar y publicar piden cada uno su autorización. Las decisiones de Sam del 2026-11-20 cubren el diseño.

## 9. Pendientes de decisión (Sam): opciones A/B para dibujar

Sam decide viendo: cada una se dibuja con `show_widget` (la tarjeta de un monto en Facturación, una fila de Cobranzas, la tarjeta del Portal, un cotizador web) antes de pedir la respuesta. **A** es la propuesta del Worker.

| # | Decisión | A (propuesta) | B |
|---|---|---|---|
| 1 | Símbolo de moneda | `$1.234,50` | `USD 1.234,50` |
| 2 | CBM y peso al teclear (opción A elegida; §2) | Punto o coma decimal; se muestra lo entendido («= 1,234») | Solo coma, igual que el dinero |
| 3 | ERP en chino | Formato único `1.234,50` en todos los idiomas | Cada idioma con el suyo (`12,323.50` en chino) |
| 4 | Factura y estado de cuenta en PDF | Cambian con el resto | Conservan `1,234.50` por ser para el contador |
| 5 | Tasa de cambio, al mostrar | `36,5000` (siempre 4 decimales) | Mínimo 2 y hasta 4 si los hay (`36,50` · `36,5125`). Teclear sigue aceptando hasta 8 en las dos |
| 6 | Separador único al teclear (opción A elegida; §2) | Se acepta como decimal mostrando «= 12,50» | También se rechaza y se pide la coma |
| 7 | KPI compactos de Reportes | `$1,2K` · `$1,25M` | `$1.2K` (el punto se queda en lo compacto) |
| 8 | Número no válido (`NaN`) | Se muestra «—» | Se sigue mostrando `$0,00` |
| 9 | CSV y Excel exportados | Número real, sin formato (`1234.50`) | Texto con formato `1.234,50` (se lee bien al ojo; Excel en español de Venezuela lo entiende, otros no) |
| 10 | Enlace de proveedores (`app/p/[token]/`) | Conserva el idioma del proveedor (`zh-CN`, `es-ES`, `en-US`) | Formato único `1.234,50` |

La opción A de §2 resuelve la lectura humana de separadores para esta enmienda.
Las demás decisiones visuales y fases mantienen sus gates; no se aprueban aquí.

## 10. Lo que esta spec no cubre

Color (SDD-0686), simetría de pantallas (SDD-0688), fechas (SDD-0660), CBM de cuatro decimales (SDD-0667, que ya formatea en `es-VE`), revisar montos guardados en producción y cualquier escritura en la base de datos. Tampoco cubre el texto que arma la base de datos: `supabase/migrations/0497_reverso_al_anular_factura.sql:795` usa `to_char` en un mensaje de error; una migración aplicada no se toca, y ese mensaje queda en su formato.

## 11. Límites

Todo sale de leer el código; nada se ejecutó. Los conteos son por texto. El comportamiento de `<input type="number">` por navegador y por idioma del equipo no se midió.

## 12. Enmienda: allowlist exacta de las fases 1 y 2 (PR #790)

La entrada de datos (§2.1, §2.2 y §4.2) entra por la PR #790. Esta enmienda no cambia el estado de la spec ni sus decisiones. Archivos de la PR, fijados al revisarla (la revisión independiente añadió `lib/studio/freight-carriers/types.ts`, `ShipmentDataPanel.tsx` y sus pruebas, esta enmienda y `app/studio/CLAUDE.md`):

- `.agents/handoffs/2026-11-22-sdd-0687-fases-1-2-entrada.md`
- `__tests__/parse-numeric-expression.test.ts`
- `app/studio/(app)/admin/_components/ExchangeRatesSection.tsx`
- `app/studio/(app)/admin/_components/calculator/ParametrosPanel.tsx`
- `app/studio/(app)/admin/_components/calculator/TariffDrawer.tsx`
- `app/studio/(app)/cobranzas/_components/UnidentifiedPaymentDrawer.tsx`
- `app/studio/(app)/facturacion/_components/InvoiceDrawer.tsx`
- `app/studio/(app)/financiero-china/_components/ChargeDrawer.tsx`
- `app/studio/(app)/financiero-china/_components/ConversionDrawer.tsx`
- `app/studio/(app)/financiero-china/_components/CreditNoteDrawer.tsx`
- `app/studio/(app)/fiscal/_components/WithholdingDrawer.tsx`
- `app/studio/(app)/gastos/_components/ExpenseDrawer.tsx`
- `app/studio/(app)/ordenes-compra/_components/PoDrawer.tsx`
- `app/studio/(app)/proveedores/actions.ts`
- `app/studio/(app)/tesoreria/_components/BillDrawer.tsx`
- `app/studio/(app)/tms/_components/TruckDrawer.tsx`
- `app/studio/(app)/tracking/[id]/__tests__/shipment-data-panel-cifras.test.tsx`
- `app/studio/(app)/tracking/[id]/_components/CargaDelEmbarque.tsx`
- `app/studio/(app)/tracking/[id]/_components/ShipmentDataPanel.tsx`
- `app/studio/CLAUDE.md`
- `app/studio/_components/ui/NumericInput.test.tsx`
- `app/studio/_components/ui/NumericInput.tsx`
- `docs/governance/README.md`
- `docs/governance/components/numeric-input.json`
- `docs/governance/generated/component-registry.json`
- `docs/governance/generated/governance-capsule.json`
- `docs/governance/policies/num-01.md`
- `docs/specs/0687-rebrand-cifras-formato-ve/spec.md`
- `lib/portal/__tests__/cotizacion-request.test.ts`
- `lib/portal/__tests__/payment-reports.test.ts`
- `lib/portal/cotizacion-request.ts`
- `lib/portal/payment-report-types.ts`
- `lib/shared/__tests__/cifras.test.ts`
- `lib/shared/cifras.ts`
- `lib/studio/__tests__/freight-carriers-types.test.ts`
- `lib/studio/__tests__/fx-rates.test.ts`
- `lib/studio/__tests__/scorecard-types.test.ts`
- `lib/studio/exchange-rates-types.ts`
- `lib/studio/freight-carriers/types.ts`
- `lib/studio/price-books/__tests__/price-books.test.ts`
- `lib/studio/price-books/price-book-types.ts`
- `lib/studio/proveedores/scorecard-types.ts`
- `lib/studio/rate-snapshots/__tests__/types.test.ts`
- `lib/studio/rate-snapshots/types.ts`
- `lib/studio/util/parse-numeric-expression.ts`

Regla histórica de la revisión H1 (sustituida por opción A de §2): en un campo de dinero con tres o más decimales (el precio por ft³ lleva cuatro) la coma de tres cifras es decimal (`3,498`), pero el punto sigue pidiendo aclarar (`3.498`, `1.250`): el sistema nunca adivina un monto. El valor de máquina que el campo manda oculto al servidor se lee con `parseMaquina`, que no es la regla de lo que teclea una persona.

No cambia lo que se muestra en pantallas, PDF ni exportes (fase 3 en adelante) ni el color (SDD-0686). La propuesta de NUM-01 v1.2 de esta fase histórica estaba pendiente de confirmación.
La opción A aprobada el 2026-11-24 la sustituye según §4.1.


## 13. Allowlist de la enmienda opción A (2026-11-24)

- `lib/shared/cifras.ts`
- `lib/shared/__tests__/cifras.test.ts`
- `app/studio/_components/ui/NumericInput.tsx`
- `app/studio/_components/ui/NumericInput.test.tsx`
- `__tests__/parse-numeric-expression.test.ts` (ampliación Director)
- `lib/studio/__tests__/freight-carriers-types.test.ts` (ampliación Director)
- `docs/specs/0687-rebrand-cifras-formato-ve/spec.md`
- `docs/governance/policies/num-01.md` (opción A aprobada el 2026-11-24)
- `.agents/handoffs/sdd-0687-decimales-opcion-a-20261124.md`

Ampliación del Director `msg_505aa05df7cb`, solo pruebas de entradas humanas:

- `lib/portal/__tests__/payment-reports.test.ts`
- `lib/portal/__tests__/cotizacion-request.test.ts`
- `lib/studio/__tests__/fx-rates.test.ts`
- `lib/studio/__tests__/scorecard-types.test.ts`
- `lib/studio/price-books/__tests__/price-books.test.ts`
- `lib/studio/rate-snapshots/__tests__/types.test.ts`

Matriz de consumidores, evidencia de pruebas, demo y ampliaciones posteriores
del Director: handoff propio. Esta lista no autoriza fases futuras, cambios de
código consumidor, merge, datos reales, migraciones ni deploy.

Ampliación `msg_c31b38185eb6`: prueba de tracking y adopción normativa aprobada:

- `app/studio/(app)/tracking/[id]/__tests__/shipment-data-panel-cifras.test.tsx`
- `docs/governance/README.md` (solo fila NUM-01)
- `docs/governance/generated/component-registry.json` (regeneración canónica si aplica)
- `docs/governance/generated/governance-capsule.json` (regeneración canónica)

La vista previa y regla de NUM-01 fueron aprobadas expresamente por Sam en el
turno del Director, después de preparar la implementación; no se infiere
aprobación del resto de decisiones/fases de esta spec.

Ampliación `msg_3a65db49fba6`, tras la anotación de Quality #45412543217:

- `app/studio/(app)/fiscal/_components/WithholdingDrawer.test.tsx`: entrada humana
  sin miles, rechazo de agrupación por operando y conservación del total canónico
  y de la salida fiscal existente. No cambia código de producto ni cálculo fiscal.
