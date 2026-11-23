---
sdd: "0687"
title: "Cifras en formato venezolano: punto de miles y coma decimal, al mostrar y al teclear"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-11-20
updated: 2026-11-22
supersedes: null
superseded_by: null
related: ["0686", "0688", "0629", "0660", "0667", "0704"]
confidencialidad: interno
---

# SDD-0687 — Cifras en formato venezolano

> El mismo monto se lee de dos maneras según la pantalla, y lo que se teclea no siempre se entiende como se ve.
> Sin migraciones y sin datos de producción. Etiquetas: **C** código leído · **M** medido · **I** inferencia · **NV** sin verificar.

## Estado (2026-11-22)

Spec propuesta, **esperando la aprobación de Sam**. **Nada implementado.** Número asignado por el Director General (reserva `codex/sdd-reserve-0687`, `4b121866d`). Texto retomado de la rama local `claude/sdd-0687-cifras-formato-ve` (2026-11-20) y vuelto a medir sobre `main` `27d8b46d9`. Va con **revisión previa** (toca montos) y con revisión independiente propia sobre la interpretación de cifras. La implementación entra después, por fases, cuando Sam apruebe esta spec.

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

## 2. El caso concreto: qué se escribe, qué se entiende hoy y qué se entenderá

Hay **tres caminos de entrada** y no se comportan igual.

### 2.1 Campos con `<NumericInput>` (analizador `lib/studio/util/parse-numeric-expression.ts:273-311`)

Regla de hoy: con coma **y** punto, el último es el decimal; con **un solo** separador, ese separador es **decimal**; con el mismo separador repetido, son miles.

| Se teclea | Hoy se guarda | Con esta spec, en **dinero** | Con esta spec, en **CBM y peso** |
|---|---|---|---|
| `1234,5` | 1234.5 | 1234.5 | 1234.5 |
| `1.234,50` | 1234.5 | 1234.5 | 1234.5 |
| `1,234.50` | 1234.5 | **Se rechaza** con mensaje: el formato es `1.234,50` | Se rechaza igual |
| `1.234` | **1.234** (uno coma dos tres cuatro) | **Se rechaza y se pide aclarar**: «Escribe 1234 o 1.234,00 si son mil doscientos treinta y cuatro, o 1,234 si es un decimal» | 1.234 (el punto es decimal; se muestra «= 1,234»; pendiente de confirmar, §9) |
| `1,234` · `10,000` | 1.234 · 10 | **Se rechaza y se pide aclarar** (§4.2): tres decimales no caben en dinero, y en teclados en inglés es «mil doscientos treinta y cuatro» | 1.234 · 10 (la coma es decimal) |
| `1.234.567` | 1234567 | 1234567 | 1234567 |
| `12.5` · `12.50` | 12.5 | 12.5: no puede ser miles, así que no hay duda; se muestra «= 12,50» (pendiente de confirmar, §9) | 12.5 |
| `0.125` | 0.125 | Se rechaza: un punto seguido de tres cifras no se interpreta en dinero | 0.125 |

Las tres últimas columnas muestran el valor de máquina (punto decimal); lo que ve la persona va entre «= …».

El campo ya muestra debajo lo que entendió («= …»); eso se conserva y pasa a escribirse en el formato nuevo.

**En modo tasa** (campo de tasa de cambio):

| Se teclea | Hoy se guarda | Con esta spec |
|---|---|---|
| `36,500` | 36.5 | 36.5 (legítimo; se muestra «= 36,5000») |
| `36.500` | 36.5 | **Se rechaza y se pide aclarar** (§4.2) |
| `36,51259999` | 36.51259999 | 36.51259999 (8 decimales, como hoy) |
| `36,512599991` | Se rechaza («hasta 8 decimales») | Se rechaza, igual |

### 2.2 Campos que convierten a mano con `replace(",", ".")`

Ejemplo real: el reporte de pago del Portal, `lib/portal/payment-report-types.ts:164`: `Number(String(raw.amount).replace(",", "."))`, seguido de la comprobación de máximo dos decimales (`:169`).

| El cliente teclea | Hoy | Con esta spec |
|---|---|---|
| `1250,50` | 1250.50 | 1250.50 |
| `1.250,50` | No es un número → «Escribe el monto que pagaste» | 1250.50 |
| `1.234` | 1.234 → «El monto puede tener máximo 2 decimales» (mensaje equivocado) | Se rechaza y se pide aclarar |
| **`1.250`** | **Se acepta como 1,25** | Se rechaza y se pide aclarar |
| **`10.000`** | **Se acepta como 10** | Se rechaza y se pide aclarar |

Los dos últimos son el caso que importa: **cualquier monto cuyos miles terminan en cero se acepta hoy mil veces menor** en este camino. Con las cifras mostradas como `1.250,00`, teclearlo así será más frecuente. El mismo patrón está en la tasa de cambio (`lib/studio/exchange-rates-types.ts:65`), el monto cotizado de un servicio (`app/studio/(app)/proveedores/actions.ts:67`), los descuentos de lista de precios (`lib/studio/price-books/price-book-types.ts:134`) y la solicitud de cotización del Portal (`lib/portal/cotizacion-request.ts:71`), entre los demás.

### 2.3 `<input type="number">` crudo (46 archivos)

El navegador decide cómo se ve y qué acepta según el idioma del equipo; el valor que entrega al código siempre usa punto decimal. **NV**: no se midió en cada navegador. Regla de esta spec: los campos de **dinero** dejan de usar `type="number"` crudo y pasan a `<NumericInput>` (ya es la norma de `app/studio/CLAUDE.md`); los contadores de interfaz se quedan.

## 3. Qué pasa con lo ya guardado

- **Los números guardados no cambian.** En la base de datos son valores numéricos; el formato es solo de pantalla. **No hay migración.**
- **Lo que pudo quedar mal guardado antes** por el caso 2.2 no lo arregla esta spec ni se puede detectar por formato: un 1,25 legítimo y un 1250 mal tecleado son indistinguibles. Si Sam quiere revisarlo, es una consulta aparte sobre producción, con su autorización nominal. **No se propone aquí.**
- **Textos ya generados** (mensajes enviados, correos, notas, PDF emitidos y guardados) conservan el formato con que se crearon; no se reescriben.
- **Documentos que se generan al momento** (recibo, estado de cuenta, rendición) saldrán con el formato nuevo desde que se publique. Un mismo documento impreso antes y después se verá distinto: **decisión pendiente** para la factura (§9).

## 4. La regla

1. **Al mostrar:** punto de miles y coma decimal en todo el sistema, para todo número que lee una persona.
2. **Al guardar y al enviar entre sistemas:** formato de máquina (`1234.50`). No cambia.
3. **Al teclear dinero:** la coma es el decimal. El punto se acepta como miles bien formados cuando hay coma decimal o más de un punto (`1.234,50`, `1.234.567`). **Un separador único (punto o coma) seguido de exactamente tres cifras no se interpreta en dinero: se rechaza y se pide aclarar** (`1.234`, `1,234`, `10,000`). El sistema nunca adivina un monto. Cada tipo de campo fija su modo y su precisión (§4.2).
4. **Un solo lugar para formatear y uno solo para interpretar.** Nadie formatea ni convierte a mano.
5. **Archivos para máquinas** (CSV, Excel con celdas numéricas) llevan el número real, no texto con formato.

### 4.1 Cómo queda la política NUM-01 (v1.1 → v1.2)

NUM-01 (`docs/governance/policies/num-01.md`) es la política aprobada de campos numéricos. La regla de arriba **la enmienda en dos líneas y se apoya en una tercera**; el cambio de política lo aprueba Sam junto con la fase 1.

| Línea de NUM-01 hoy | Qué pasa |
|---|---|
| `:15` «Separadores de miles/decimal se muestran según locale sin cambiar el valor almacenado.» | **Se enmienda:** se muestran con punto de miles y coma decimal. «Sin cambiar el valor almacenado» se conserva. Si el ERP en chino mantiene su formato es la decisión pendiente de §9 |
| `:16` «Los separadores se interpretan por literal, nunca normalizando la expresión completa.» | **Se conserva y se precisa:** en un campo de dinero, un separador único (punto o coma) seguido de exactamente tres cifras no se interpreta; se rechaza y se pide aclarar. Cada tipo de campo fija su modo y su precisión (§4.2) |
| `:25` «Error de campo conserva el texto introducido y explica el formato esperado.» | **Se conserva:** es lo que obliga al mensaje de aclaración a no borrar lo tecleado |
| Gate («pegado con distintos separadores, locale por operando») | **Se amplía** con la tabla de §2 en los cuatro modos (dinero, tasa, porcentaje y medida) |

FRM-01 depende de NUM-01 y no cambia. La cápsula de gobernanza (`docs/governance/generated/`) se regenera en la misma PR.

### 4.2 Modo y precisión por tipo de campo de entrada

La precisión máxima manda: un valor con más decimales que el modo permite **se rechaza**, no se redondea en silencio. Por eso `1,234` en dinero (3 decimales) se rechaza por sí solo y el mensaje de aclaración le dice qué escribir.

| Tipo de campo | Modo | Decimales | Un separador único + tres cifras | Fuente |
|---|---|---|---|---|
| **Dinero** (montos, costos, tarifas, pagos, descuentos en monto) | dinero | 2 | Se rechaza y se pide aclarar, con punto o con coma | norma de esta spec |
| **Tasa de cambio** | tasa | **Al teclear, hasta 8** (como hoy: `exchange-rates-types.ts:70` rechaza el noveno; la base es `numeric(20,8)`). **Al mostrar, 4** (decisión 5): no es un cambio de lo que se acepta, solo de lo que se ve | La coma es decimal: `36,500` = 36,5 y es legítimo. El punto único con tres cifras (`36.500`) se rechaza y se pide aclarar | `lib/studio/exchange-rates-types.ts:65-70` |
| **Porcentaje y descuento en %** | porcentaje | 2, entre 0 y 100 | Se rechaza (tres decimales no caben; además, un porcentaje no tiene miles) | NV: el máximo real de cada campo se fija al abrir la fase 2 |
| **CBM** | medida | 4 | Se acepta como decimal mostrando lo entendido (decisión 2 de §9) | `lib/shared/cbm.ts` (`CBM_MAX_DECIMALS`), SDD-0667 |
| **Peso y cantidades** | medida | las de su campo | Igual que CBM | NV: se fija campo por campo en la fase 2 |

El analizador recibe el modo como argumento; no hay un modo por defecto, para que nadie lo olvide. Las pruebas de §6 se corren **por modo**.

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

- **Ida y vuelta (propiedad):** para cualquier monto con hasta dos decimales, mostrar y volver a interpretar lo mostrado devuelve el mismo valor. Probado con valores generados, no solo con ejemplos.
- **Tabla de §2 como prueba**, caso por caso, en los cuatro modos (dinero, tasa, porcentaje y medida). Cada rechazo comprueba el mensaje y que **no se guarda nada**.
- **Mutantes obligatorios:** aceptar `1.250` como 1,25 en modo dinero; aceptar `1,234.50`; devolver el formateador a `en-US`; aceptar `1,234` o `10,000` como decimal en modo dinero; aceptar `36.500` en modo tasa. Todos deben romper una prueba.
- **Contrato de entrada:** ningún archivo fuera del analizador contiene `replace(",", ".")` aplicado a un valor tecleado, ni quita puntos con `replace(/./g, "")` (el caso de `parseAmount` en `lib/studio/global-search/classify.ts:75`, que ya interpreta en formato venezolano y pasa al analizador); cuenta exacta, con la lista de excepciones justificadas (por ejemplo, lectores de archivos ajenos: `lib/studio/fx/bcv-parser.ts`, `lib/studio/partner-finance/statement-parser.ts`, `lib/studio/document-import/extract.ts`, que leen formatos de terceros y **no** se tocan).
- **Contrato de salida:** ningún archivo fuera de los formateadores llama a `toLocaleString` o `Intl.NumberFormat` con `en-US` para un número que se muestra; lista congelada que solo baja (modelo `fechas-contract.test.ts`).
- **CSV:** una prueba abre el archivo generado y comprueba que cada fila tiene el mismo número de columnas y que los montos se leen como números.
- **Las 37 pruebas con `1,234.50` se actualizan al formato nuevo, no se debilitan ni se saltan.**
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
| R7 | El teclado numérico escribe punto en equipos configurados en inglés: rechazar todo punto único frenaría a quien teclea `12.50` | Solo se rechaza el caso ambiguo (tres cifras tras un punto único); `12.5` y `12.50` se aceptan mostrando lo entendido. Decisión pendiente (§9) |

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
| 2 | CBM y peso al teclear | Punto o coma decimal; se muestra lo entendido («= 1,234») | Solo coma, igual que el dinero |
| 3 | ERP en chino | Formato único `1.234,50` en todos los idiomas | Cada idioma con el suyo (`12,323.50` en chino) |
| 4 | Factura y estado de cuenta en PDF | Cambian con el resto | Conservan `1,234.50` por ser para el contador |
| 5 | Tasa de cambio, al mostrar | `36,5000` (siempre 4 decimales) | Mínimo 2 y hasta 4 si los hay (`36,50` · `36,5125`). Teclear sigue aceptando hasta 8 en las dos |
| 6 | Punto único con una o dos cifras (`12.5`, `12.50`) en dinero | Se acepta como decimal mostrando «= 12,50» | También se rechaza y se pide la coma |
| 7 | KPI compactos de Reportes | `$1,2K` · `$1,25M` | `$1.2K` (el punto se queda en lo compacto) |
| 8 | Número no válido (`NaN`) | Se muestra «—» | Se sigue mostrando `$0,00` |
| 9 | CSV y Excel exportados | Número real, sin formato (`1234.50`) | Texto con formato `1.234,50` (se lee bien al ojo; Excel en español de Venezuela lo entiende, otros no) |
| 10 | Enlace de proveedores (`app/p/[token]/`) | Conserva el idioma del proveedor (`zh-CN`, `es-ES`, `en-US`) | Formato único `1.234,50` |

Las fases 1 y 2 (entrada) esperan las decisiones **2, 5 y 6**; el resto se necesitan desde la fase 3. La coma única con tres cifras en dinero (`1,234`, `10,000`) **no es decisión**: es norma (§4.2), porque con dos decimales máximo no hay una B real.

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

Regla que fija la revisión (H1): en un campo de dinero con tres o más decimales (el precio por ft³ lleva cuatro) la coma de tres cifras es decimal (`3,498`), pero el punto sigue pidiendo aclarar (`3.498`, `1.250`): el sistema nunca adivina un monto. El valor de máquina que el campo manda oculto al servidor se lee con `parseMaquina`, que no es la regla de lo que teclea una persona.

No cambia lo que se muestra en pantallas, PDF ni exportes (fase 3 en adelante) ni el color (SDD-0686). NUM-01 v1.2 queda **pendiente de confirmación de Sam**: no consta su aprobación por escrito.
