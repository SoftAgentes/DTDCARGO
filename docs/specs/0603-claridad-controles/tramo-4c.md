# SDD-0603 · Tramo 4c · Avisos de Finanzas y compras en `Aviso`

Parte del tramo 4 de [la spec](spec.md) («Avisos»), en la ola 2: adopción del componente `Aviso` de SDD-0628 en el grupo Finanzas y compras. Regla de BD-037: lo que avisa es una franja plana con ícono y sin contorno. Rama `claude/0603-t4c-finanzas-8a1392`, desde `claude/tren-ae` @ `4441f65ac` (tren #540 de la ola 1, que trae `Aviso`).

**Fuera, a propósito:** `studio.css`, `tokens.css`, `Aviso.tsx`, `ErrorAlert.tsx`, los `spec.md` de 0603 y 0628, el registro de componentes y `docs/specs/README.md`. Los archivos del grupo que están en PRs abiertas quedaron fuera de la lista: `facturacion/[code]`, `rendiciones/[code]` y `reportes/embarques-sin-facturar` (#515), y `NavieraClient` (#318).

## Allowlist

Los 47 archivos de `rebrand-0603-allowlist-t4c-4441f65ac.txt`, que es el inventario del grupo en `tren-ae`, más:

- `app/studio/(app)/reportes/__tests__/estado-gerencial-mezclado.test.tsx` (ajuste de rol, abajo)
- `app/studio/(app)/__tests__/avisos-finanzas-contract.test.ts` (nuevo)
- este archivo y `.agents/handoffs/0603-t4c-finanzas.md`

Sin migraciones, rutas, acciones de servidor, permisos, dependencias, CSS ni colores nuevos. Sin cambios de texto, montos ni cálculos.

## Medición

Se buscaron en los 47 archivos las dos señales de una caja de aviso hecha a mano: un `role="alert"`, `"status"` o `"note"` literal, y un fondo o borde de estado en línea (`--danger`, `--warning`, `--success`, `--info` y sus `-bg`). Cada coincidencia se leyó en contexto y se clasificó.

| | Archivos | Avisos |
|---|---:|---:|
| Convertidos | 43 | 62 `<Aviso>` |
| No aplica | 4 | 0 |

Criterio:

- **Se convierte:** un bloque (`div` o `p`) que avisa algo a la persona, con fondo o borde de estado, o con rol de alerta o nota y color de estado. Por ejemplo: el error de un formulario, el error de carga de una sección, una nota de ayuda, una advertencia o la confirmación de una importación.
- **Queda:** los errores de campo bajo un input, las pastillas y badges, los `KpiCard`, los colores de montos y gráficos, las filas o celdas resaltadas, los botones destructivos, un `span` dentro de una frase y los estados vacíos neutros. Son lectura o acción, no aviso.

Tono por color original: danger → `error`, warning → `atencion`, success → `exito`, info → `info`. En drawers, modales y formularios densos va `compacto`. El ícono propio de la caja (`Icon.warn`, `Icon.info`, `Icon.bell`, `StatusIcon` o un «!» decorativo) se quitó, porque `Aviso` trae el suyo. Donde la caja tenía margen y el padre no tiene `gap`, el `Aviso` va dentro de un `div` con el mismo margen.

## Qué cambia, por archivo

Todo bajo `app/studio/(app)/`.

| Archivo | Avisos | Tono |
|---|---|---|
| `costing/CostEditorDrawer` | nota de ayuda; error | info, error |
| `costing/TemplateDrawer` | error | error |
| `cotizador/[code]/page` | «convertido a embarque», con su enlace dentro | exito |
| `cotizador/QuoteDetailClient` | error al vincular; error general | error |
| `cotizador/QuoteDrawer` | error | error |
| `facturacion/InvoiceDetailClient` | error; aviso de anulación con remisión; falta aceptación de T&C con sus botones; error del cobro | error, atencion `urgente` ×2, error |
| `facturacion/InvoiceDrawer` | error | error |
| `facturacion/StudioInvoicePaymentReports` | no se pudieron consultar los reportes; error al resolver | error |
| `financiero-china/` 5 drawers (`Charge`, `ClaimOffset`, `Conversion`, `CreditNote`, `ImportStatement`) | error | error |
| `financiero-china/` `ChargesTab`, `LedgerTab`, `ReconciliationTab`, `StatementDetail` | error de carga o de fila | error |
| `financiero-china/FinancieroChinaClient` | huecos contables, con título | atencion |
| `financiero-china/PartnerAlertsBanner` | pagos PP/CA vencidos, con título, lista y «Ver N más» | error |
| `fiscal/FiscalClient` | período en varias monedas | atencion |
| `fiscal/FiscalConfig` | error al guardar | error |
| `fiscal/WithholdingDrawer` | error | error |
| `gastos/GastosClient` | alertas de consolidado, con título y filas | atencion |
| `naviera/PlanCargaCard` | error; cada aviso del plan de carga | error, atencion |
| `naviera/SailingDrawer` | `FormError`, que también usan otros tres drawers de Naviera | error |
| `nomina/FiniquitoDetalle` | error de acción; borrador advisory; error de carga | error, atencion, error |
| `nomina/RecibosTab` | error de acción; error de carga | error |
| `ordenes-compra/PoDrawer` | error ×2 | error |
| `ordenes-venta/OvDrawer` | «Viene del estimado…»; `ErrorBanner` | info, error |
| `proveedores/` `OrderSignal`, `ProviderLink`, `ServiceRequest`, `SupplierClaim` | error | error |
| `proveedores/SupplierDrawer` | error; proveedores parecidos, con título y lista | error, atencion |
| `rendiciones/EmitDrawer` | error | error |
| `rendiciones/VoidDrawer` | error; conserva `id="void-reason-error"` para el `aria-describedby` | error |
| `reportes/ReportesClient` | mayor mezclado o sin verificar | atencion |
| `seniat/CreateFilingDrawer` | sin embarques elegibles; error | atencion, error |
| `seniat/FilingDetailDrawer` | «Alerta SENIAT», con título; error | error |
| `tarifas/ImportRatesDrawer` | lista de precios del aliado; error; resumen de la importación | info, error, exito |
| `tarifas/RateDrawer` | lista de precios del aliado; error | info, error |
| `tesoreria/BillDrawer` | error ×2 | error |
| `tesoreria/SupplierDrawer` | error | error |

`PartnerAlertsBanner`: el botón «Ver N más / Ver menos» era texto rojo de 32 px. Ahora es `studio-btn studio-btn-ghost studio-btn-sm` (36 px, 32 en compacto), el secundario con contorno de tinta: un rojo sobre la franja de error no se distinguía como botón.

## No aplica

| Archivo | Qué hay |
|---|---|
| `gastos/ExpenseRowActions` | ítem de menú «Anular» en rojo y un `ConfirmDialog` destructivo: son acciones |
| `reportes/BuilderView` | fondo rojo al pasar el cursor por el botón «×» |
| `seniat/CustomsFilingsList` | resaltado de la fila con alerta y su ícono en la celda |
| `nomina/form-bits` | **bloqueado:** `ErrorBox` es un aviso de error, pero lleva `tabIndex={-1}` porque `useDialogA11y` lleva el foco a `[role="alert"][tabindex="-1"]`. `Aviso` no acepta `tabIndex`. Convertirlo rompe el foco al primer error de los paneles de Nómina (`form-bits.test.tsx`, `PrestamoDrawer.foco.test.tsx`). Hace falta que `Aviso` acepte `tabIndex`, y `Aviso.tsx` está fuera de esta allowlist. |

Casos dentro de archivos convertidos que se dejaron como texto: el `role="status"` neutro de `EmitDrawer` («No se puede emitir…», sin color de estado y con `data-testid`); los mensajes de 11,5 px que ocupan el lugar de un select («No hay cuentas…») en `BillDrawer`, `PoDrawer` e `InvoiceDetailClient`; la pastilla de tarifa sugerida de `QuoteDrawer`; la nota en línea de `FiscalClient` dentro de la fila del badge «Asentado»; y las notas neutras de `FiscalConfig` («Esto NO es asesoría fiscal», permisos), que no tienen color de estado.

## Roles

`Aviso` pone `role="alert"` en error o `urgente`, y `role="status"` en el resto. Cambios respecto a antes:

- Los `role="note"` (`FiscalClient`, `ReportesClient`) pasan a `status`. La prueba `estado-gerencial-mezclado.test.tsx` buscaba `note`; ahora busca `status`, con las mismas cuatro aserciones.
- Los dos avisos amarillos de `InvoiceDetailClient` eran `alert`: llevan `urgente` para conservarlo.
- `PartnerAlertsBanner` (antes `status`) y «Alerta SENIAT» (antes sin rol) pasan a `alert`, porque son tono error. Si se prefiere que no interrumpan al abrir la pantalla o el drawer, el cambio es a `atencion`: queda para la revisión.
- Las franjas de ayuda y atención sin rol ganan `status`.

## Texto

No cambia ningún texto. Una salvedad: en `cotizador/[code]/page` se quitó el «✓» que precedía a «Este estimado ya fue convertido a un embarque.». Hacía de ícono y ahora lo pone el `Aviso` de éxito; dejarlo duplicaba la marca. Si la revisión lo quiere de vuelta, es una línea.

## Aceptación

- Los 43 archivos convertidos importan `Aviso` y no tienen `role="alert"` ni `role="note"` literal, ni un fondo de estado literal, salvo las excepciones medidas. Lo vigila `avisos-finanzas-contract.test.ts`: cuenta exacta por archivo, los 47 sin repetir y una tabla de excepciones con su motivo.
- Mutantes del contrato: reintroducir un `<p role="alert">`, añadir un fondo de estado literal, quitar el import de `Aviso` y borrar la señal de una excepción. Cada uno debe hacer fallar la regla.
- Las pruebas vecinas que buscan `getByRole("alert")` siguen valiendo, porque el error conserva `alert`.

## Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: no se suma ningún primario. El único botón tocado pasa de texto rojo a secundario. |
| Semántica de color | Cumple: el tono sale del color original. El texto va en tinta y el tono lo dan el ícono y la franja (BRAND §Estados). |
| Contraste | Cumple por herencia: `avisos-contract.test.ts` mide texto ≥ 4,5:1 e ícono ≥ 3:1 en claro y oscuro, sobre las tres superficies. |
| Tokens | Cumple: ninguno nuevo y ningún color nuevo. Se quitan colores de estado en línea. |
| Estados sin color | Cumple: cada aviso lleva ícono y texto. |
| Light/dark | Cumple en contrato: todo el color vive en `.studio-aviso*`. Falta verlo en pantalla (ver Límites). |
| Pulsables ≥ 32 px | Cumple: «Ver N más» sube a `-sm`; los botones de `InvoiceDetailClient` y `GastosClient` no cambian. |
| Movimiento reducido | Cumple: no se agrega movimiento. |

## Límites

- No se vio en pantalla con datos: el Studio pide sesión y datos, y la imagen de prueba no es de este encargo. Va en la imagen de prueba antes de fusionar, en claro, oscuro y compacto.
- Los avisos de error de los drawers pasan de 12 px a 13 px (compacto): es la medida de `Aviso`.
- `nomina/form-bits` queda pendiente de que `Aviso` acepte `tabIndex` (otro tramo, otro archivo).
