---
sdd: "0574"
title: "Embarques sin facturar: el reporte y las tarjetas en Dirección"
status: in-progress
author: "founder + Claude Opus 5.5 + Codex"
created: 2026-10-20
updated: 2026-10-21
supersedes: null
superseded_by: null
related: ["0048", "0052", "0357", "0557", "0571"]
confidencialidad: interno
---

# SDD-0574 — Embarques sin facturar

> Un reporte dice qué carga recibida en Yiwu todavía no tiene factura fiscal y cuánto hay que facturar: primero lo que ya llegó a Venezuela, después lo que no tiene tarifa congelada y al final lo que va en camino con su tarifa. Dirección lo muestra en tres tarjetas.

**Estado actual:** retoma aislada en `codex/sdd-0574-embarques-cierre`. La combinación `e6b0129c6026ef32db9b5ae37d4a3ce669b17e76` incorpora 0571 `ba43747a803ea9aec3b8750d1b461d69795834a5` y la implementación histórica 0574 `18edcd8127f3acdd93e5a9e85c15c589c8712b88` mediante merge normal. **Fase ligera: contrato y pruebas preparados; producto sin reparación y pruebas nuevas NO EJECUTADAS.** F1–F3 siguen abiertos. Depende de la PR #307; sin migración propia. El árbol histórico se conserva.

## Contexto

- **El plan contable** (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`): la 4.5 es «Reporte "Embarques sin facturar" y tarjetas en Dirección», tamaño S, sin migración, adelantada al carril paralelo con la 4.1 y la 4.2 («Mi ajuste» del §8). B17 lo pone entre los reportes que faltan.
- **Decisión 9** (2026-10-20): la factura fiscal sale al llegar a Venezuela, con vencimiento inmediato; antes, al consolidar, hay una pre-factura informativa. Por eso «llegó sin factura» es lo urgente, y un borrador no cuenta como facturado.
- **El Director** (2026-10-20) autorizó leer `invoices` solo en lectura, justificado en el BASELINE de `invoice-read-boundary`, sin escribir `invoices` ni tocar `lib/studio/accounting`, y avisándole a «Contabilidad» qué columnas se leen. Aviso enviado el mismo día.

## La regla (`lib/studio/rate-snapshots/sin-facturar.ts`)

- **Unidad: la recepción en Yiwu**, hasta la 4.2. El contenedor `C-` de hoy mezcla clientes; la recepción es por cliente y tiene su tarifa congelada (SDD-0571).
- **Facturada:** existe una factura viva del mismo envío y del mismo Shipping Mark (los dos con `upper(btrim())`) en emitida, parcial, pagada o vencida (los estados de SDD-0557/0558). Esa recepción no aparece.
- **Pre-factura:** un borrador del mismo envío y Shipping Mark no la cubre; se muestra su código.
- **Anulada:** no cuenta.
- **Fuera:** recepciones borradas, huérfanas, sin Shipping Mark o de un envío cancelado.
- **Estados**, en este orden:
  1. `llego_sin_factura`: el envío está en `arrived_destination`, `out_for_delivery`, `last_mile` o `delivered`, o tiene `arrived_destination_at`;
  2. `sin_tarifa`: no tiene tarifa congelada viva;
  3. `en_camino`: tiene tarifa y todavía no llegó.
- **A facturar:** el `amount_to_invoice` de la tarifa congelada (máx(CBM × tarifa, mínimo)).
- **Días:** desde la llegada si llegó con fecha; si no, desde la recepción. Dentro de cada estado, lo más viejo primero.

## Lectura

Con el cliente de SESIÓN, bajo RLS, solo lectura y paginada (`fetchAllPaged`, `fetchAllByIds`); si una lectura se corta en el tope de páginas, el reporte lo dice. Lee:
- `warehouse_receipts_cn`: `id, receipt_code, client_markbox, received_at, status, total_cbm, shipment_id`, vivas y no huérfanas;
- `shipments`: `id, code, status, arrived_destination_at` de esas recepciones;
- `invoices`: `id, invoice_code, shipment_id, client_markbox, status`, vivas, de esos envíos — `invoices_accounting_select` (0414) deja leer a accounting y admin, que son quienes ven Reportes y Dirección;
- `shipment_rate_snapshots`: las tarifas vivas (SDD-0571). Sin la 0496 aplicada, no se puede determinar su importe; la prioridad de llegada se conserva. Eso no equivale a afirmar que todas las filas pertenecen al grupo exclusivo `sin_tarifa`.

## Contrato de reparación F1–F3 · 2026-10-21

El Director aceptó estos tres hallazgos de lectura y su reparación dentro de doce rutas. La revisión no fue una prueba ejecutada. Este apartado fija la aceptación; la API siguiente es la propuesta técnica del Worker para revisar en el preflight, todavía sin parche de producto.

### F1 · Importe conocido, faltante y alcance

- Cada grupo exclusivo y el agregado global conservan cantidad observada, subtotal de importes conocidos y cantidad de recepciones sin tarifa disponible.
- El total `aFacturar` del agregado solo tiene un decimal textual exacto cuando la lectura está completa y todas las filas de ese agregado tienen importe. En otro caso es `null`. **No se pasa `null` a `fmtUsd`, que lo convertiría en cero, ni se convierte el agregado textual a Number para presentarlo.**
- Una tarifa cuyo importe generado es cero aporta un cero conocido. En cambio, con todas las tarifas desconocidas, el subtotal algebraico cero no se presenta como dinero conocido: la pantalla dice «Importe no disponible» y muestra el faltante.
- Si hay un cero conocido y otra recepción desconocida, puede mostrarse «Subtotal conocido: $0.00», con el contador y el total pendiente. Con 1700 + desconocido se muestra el subtotal 1700, no un total certificado.
- `completo=false` conserva cantidades y subtotales observados, pero invalida como totales globales los importes de todos los grupos, incluso los vacíos. No se altera el paginador ni se rechaza por defecto todo subconjunto útil.
- Falta de esquema 0496, falta de snapshot vivo y corte de paginación se comunican por separado. El contador bajo esquema no disponible describe filas **sin tarifa disponible en esta lectura**, no una inexistencia probada en la base.

### API técnica propuesta para este cierre

```ts
type TarifaReporte = {
  amount_to_invoice: number;
  per_cbm: number;
  cbm: number;
  min_charge: number;
};

// Cadena canónica no negativa con dos decimales, sin separadores ni exponente.
type ImporteUsdExacto = string;
type TotalesSinFacturar = {
  cantidad: number;          // recepciones elegibles observadas, no facturas
  subtotalConocido: ImporteUsdExacto; // suma exacta de importes conocidos
  sinTarifa: number;         // recepción observada sin snapshot disponible
  aFacturar: ImporteUsdExacto | null; // null si falta tarifa o lectura
};

type ResumenSinFacturar = Record<EstadoSinFacturar, TotalesSinFacturar>;
// FilaSinFacturar conserva cbm (actual) y aFacturar (snapshot o null),
// y añade cbmCongelado: number | null y minimo: number | null.
// clasificarSinFacturar mantiene las entradas existentes, añade
// lecturaCompleta?: boolean (true por defecto), y devuelve filas/resumen/total.
// reporteSinFacturar devuelve también total: TotalesSinFacturar; pasa a la
// regla la conjunción real de complete de recepciones/envíos/facturas.
// SinFacturarCard recibe total además de resumen/completo/tarifasDisponibles;
// Dirección transmite el mismo agregado del lector, sin recalcularlo.
```

`aFacturar !== null` representa completitud del importe; no se añade un booleano redundante que pueda contradecirlo. `completo` sigue describiendo la lectura, y `tarifasDisponibles` la disponibilidad del esquema. El subtotal suma importes ya generados con dos decimales por 0496; no vuelve a multiplicar CBM y precio.

**Precisión propuesta, cerrada para revisión antes del ROJO:** centavos enteros `BigInt` internos en `sin-facturar.ts`, proyectados a `ImporteUsdExacto` al terminar cada grupo y el global. La fila conserva su `number | null` actual; `BigInt` nunca cruza el DTO/RSC/JSON. `subtotalConocido` siempre devuelve dos decimales (`"0.00"` cuando la suma observada es cero); `aFacturar` devuelve esa misma representación solo si el agregado es completo. Una magnitud grande válida no crea `sinTarifa`, truncamiento ni un tope nuevo: sigue siendo un importe exacto conocido.

La fuente es `amount_to_invoice numeric(14,2)` generado por 0496, con importes no negativos y máximo de tipo `999999999999.99`. Su normalización a Number por fila permite recuperar los dos decimales sin ambigüedad: por debajo de `10^12`, la separación máxima entre números representables es `2^-13`, menor que un centavo. Se recupera la cadena de dos decimales de **cada fila** y se convierten sus dígitos a centavos enteros; no se multiplica ni se suma el agregado en Number. Esto usa el contrato existente del tipo SQL, no una restricción nueva de facturación. La recuperación no autoriza redondear una entrada ajena a ese contrato ni reconstruir la tarifa desde CBM. Si la fuente dejara de cumplirlo, se requiere un error explícito de lectura, nunca un importe aproximado conocido ni un faltante de tarifa ficticio.

Reporte y tarjeta formatean el decimal textual por sus partes, con agrupación y dos decimales, sin `Number`, `parseFloat` ni el formateador numérico global. Se prevén adaptadores locales pequeños en las dos rutas UI autorizadas: el componente cliente conserva el import **solo de tipo** de la biblioteca del lector. No se añade una dependencia del cliente sobre consultas ni una ruta compartida/global. Las pruebas atraviesan cada salida real para comprobar centavos y serialización.

Oráculos escritos, **NO EJECUTADOS**: las siguientes filas respetan las escalas y la fórmula generada de 0496, no son importes imposibles del snapshot. Sea `M = 100.000 m³ × 9999999999.99 USD/m³ = 999999999999.00 USD`; el mínimo es cero.

| Filas sintéticas / alcance | Subtotal exacto esperado | Total / faltantes |
|---|---|---|
| 90 × M + (100.000 × 700000000.00) + (1.000 × 1992547499.91), 92 filas completas | `"90071992547409.91"` (2^53−1 centavos) | Mismo texto / 0 |
| Mismas primeras 91 filas, último precio `1992547499.92` | `"90071992547409.92"` (2^53 centavos) | Mismo texto / 0 |
| Mismas primeras 91 filas, último precio `1992547499.93` | `"90071992547409.93"` (2^53+1 centavos) | Mismo texto / 0 |
| Caso anterior + una recepción sin tarifa, 93 filas | `"90071992547409.93"` | `null` / 1 |
| 60000 × M observadas con `lecturaCompleta=false` | `"59999999999940000.00"` | `null` / 0; el corte no es falta de tarifa |
| `0.10 + 0.20`, cero generado, vacío completo, todo desconocido | `"0.30"` o `"0.00"` según el caso | Se conserva la distinción F1/F3 de cero conocido y desconocido |

El escenario de 60000 filas es una regla pura sobre el subconjunto observado: con el paginador actual 60 páginas llenas no acreditan haber alcanzado vacío. No se presenta como lectura completa ni se ejecutó ese volumen durante el preflight. Estas propuestas no modifican `lib/money`, el normalizador compartido, SQL, FX ni el máximo de páginas.

**Dirección:** «Llegó sin factura» y «En camino» conservan sus cantidades por estado. «Sin tarifa disponible» muestra `total.sinTarifa`, incluido lo llegado. Es un **contador transversal**, no un tercer grupo que pueda sumarse a las otras tarjetas; llevará la explicación visible «incluye las que ya llegaron» y una aclaración de que las tarjetas se cruzan. El resumen global muestra la cantidad elegible una sola vez, subtotal/total según alcance y faltantes. En el reporte, las tres categorías siguen siendo exclusivas y se conserva su orden.

### F2 · Base congelada visible

La tabla presenta CBM congelado y CBM actual como magnitudes distintas, con m³ y tarifa USD/m³. Conserva `amount_to_invoice` y el mínimo de la tarifa viva. Con snapshot 2 m³ × 850 = 1700 y actual 3 m³, siguen siendo 1700; se explican ambos volúmenes y el cambio. Se reutiliza `cbmCambio` de 0571 (tolerancia `>= 0.0005`), sin modificarlo. CBM actual ausente tiene aviso propio; ni igualdad ni discrepancia autorizan reemplazar el snapshot. Si aplica mínimo, se explica junto al importe. Nunca se usa el snapshot reemplazado.

### F3 · Vacío verdadero

El vacío de una lectura completa puede comunicar «Al día» con alcance de **recepciones elegibles**. Un subconjunto vacío con lectura cortada dice que no se encontraron pendientes en la parte leída y que no se puede concluir el total; no certifica ausencia universal ni usa éxito por cero. Los errores se propagan a la frontera de error existente, sin convertirlos en arrays vacíos. Los avisos de estado son persistentes y textuales; la revisión visual queda pendiente.

## Pantallas

- **Reporte** `/studio/reportes/embarques-sin-facturar`, bajo el layout de Reportes (`requireModuleView("reports")`: accounting + admin): tres tarjetas (cantidad y monto por estado), y la tabla con estado, recepción, Shipping Mark, envío, CBM, tarifa, a facturar, días y pre-factura. Enlace desde Reportes › Contables.
- **Dirección** (`requireModuleView("direccion")`, admin): la tarjeta «Por facturar» con los tres estados, cada uno enlazado al reporte.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/studio/rate-snapshots/sin-facturar.ts` | la regla y la lectura |
| `lib/studio/rate-snapshots/__tests__/sin-facturar.test.ts` | pruebas de la regla y de la lectura |
| `app/studio/(app)/reportes/embarques-sin-facturar/page.tsx` | el reporte |
| `app/studio/(app)/reportes/page.tsx` | el enlace desde Contables |
| `app/studio/(app)/direccion/page.tsx` | la tarjeta |
| `app/studio/(app)/direccion/_components/SinFacturarCard.tsx` | la tarjeta |
| `scripts/__tests__/invoice-read-boundary.test.mjs` | el lector nuevo, justificado (20 archivos, 45 lecturas) |
| `docs/specs/0574-embarques-sin-facturar/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0574-embarques-sin-facturar.md` | handoff |
| `app/studio/(app)/reportes/embarques-sin-facturar/page.test.tsx` | lector, regla, página y primitivas reales; gate de Reportes |
| `app/studio/(app)/direccion/_components/SinFacturarCard.test.tsx` | tarjeta real, cableado desde Dirección y gate admin |

No toca `lib/studio/accounting`, `invoices` (solo lee), recibos ni tasas.

## Criterios de aceptación

1. Una recepción con factura fiscal viva del mismo envío y Shipping Mark no aparece; una de otro cliente del mismo contenedor no la cubre.
2. Un borrador no la cubre y se muestra como pre-factura; una anulada no cuenta.
3. Los tres estados, su orden, los días y el resumen por estado salen de la regla pura, con prueba.
4. La lectura filtra borradas, huérfanas, facturas borradas y tarifas reemplazadas, y no se rompe sin la 0496.
5. El lector de `invoices` está en el BASELINE, con su candado, tenant y uso escritos.
6. Reporte y tarjeta solo para quien ve Reportes (accounting, admin) y Dirección (admin).
7. Mutantes de la regla mueren.
8. F1: llegada sin tarifa, mezcla, todo desconocido, cero conocido y centavos preservan subtotal, contador y completitud por grupo/global en ambas salidas reales. Los agregados alrededor de 2^53 centavos conservan sus tres textos distintos y exactos, incluidos lector, JSON y ambas UI; magnitud, ausencia y lectura parcial no se confunden.
9. F2: CBM igual/distinto/ausente, tolerancia de 0571, mínimo y snapshot reemplazado conservan el importe fuente y muestran una base inequívoca.
10. F3: vacío completo, vacío parcial y parcial con filas no se contradicen; errores de las cuatro fuentes no fabrican un vacío exitoso.
11. Paginación continúa después de página corta, llega al vacío, cruza lotes y propaga el corte de cualquiera de sus tres fuentes paginadas. No se modifica el paginador para que pasen las pruebas.
12. Negativos de roles/tenant, componentes reales/CSS, claro/oscuro, 390/escritorio, última columna, foco/teclado y reflow se verifican con datos sintéticos y sus límites. Dobles y jsdom no prueban PostgreSQL ni navegador.
13. Checkpoint estable/DRAFT y revisión por SHA preceden al único `pnpm verify` autorizado por receta del Director. Exit, pasos y SKIPs se informan separados; el ledger de release no permite aplicar 0496.

## Pendiente

- **Después de la 4.2** (envío por cliente), la unidad pasa a ser el envío y la factura se cruza por `shipment_id` sin Shipping Mark.
- La auto-factura de la orden de venta (0128) liga la factura a la prealerta, no al envío: hoy esas facturas no se reconocen como cobertura. No hay casos medidos; SDD-0284 contó 0 de 8 compras con orden de venta.

## Gobernanza · revisión de preparación, no gate cerrado

| Principio | Clasificación actual | Evidencia/límite |
|---|---|---|
| SGE-00.01 · predecible | cumplimiento por lectura | enlaces navegan al reporte; sin mutaciones |
| SGE-00.02 · trabajo conservado | no aplica | no captura, edición ni estado de formulario |
| SGE-00.03 · riesgo/fricción | no aplica | no se añade una operación de permanencia o financiera |
| SGE-00.04 · auditoría | no aplica | solo lectura; los avisos no se presentan como auditoría |
| SGE-00.05 · permisos/tenant | cumplimiento de diseño por lectura; ejecución pendiente | cliente de sesión, gates accounting/admin y admin, RLS existente; dobles de membresía no acreditan RLS |
| SGE-00.06 · prevenir errores | no conformidad | F1/F2: importe/base todavía pueden inducir una conclusión falsa |
| SGE-00.07 · estado verdadero | no conformidad | F1/F3 abiertos; pruebas preparadas sin ejecutar |
| SGE-00.08 · frecuencia/complejidad | cumplimiento de diseño por lectura | mismo enlace y lectura; sin pasos adicionales de operación; no se inventa ahorro medido |
| SGE-00.09 · patrón común | cumplimiento por lectura | reutilización de Badge/KpiCard/EmptyState/MiniStat y Link existentes; no se crean primitivas ni consumidores deprecated. Su ausencia del registro no se presenta como promoción canonical |
| SGE-00.10 · accesibilidad | cumplimiento parcial por lectura; cierre pendiente | tabla semántica/headers, enlaces y texto; CSS/teclado/foco/reflow no ejecutados, sin certificación WCAG integral |
| SGE-00.11 · lenguaje | no conformidad | F1–F3: mensajes actuales contradictorios; copy de reparación en contrato |
| SGE-00.12 · autoridad humana | no aplica al producto | ninguna función de IA ni acción externa nueva; ingeniería respeta turno y alcance del Director |

| Política/frontera | Clasificación y alcance |
|---|---|
| SDD/allowlist y SDD-0357 | cumplimiento por lectura; doce rutas y BASELINE exacto pendiente de ejecutar en combinación |
| TBL-01 / NUM-01 | no conformidad F1/F2 pendiente; importes derivados, unidades y base congelada por corregir, sin nueva captura numérica |
| LOD-01 / ERR-01 | no conformidad F3 pendiente; errores se relanzan y no hay recuperación escrita nueva; no se muestran mensajes SQL al cliente |
| VIS-01/VIS-02, A11Y-01, ICO-01, LNK-01 | fuentes leídas; revisión de componentes/CSS/foco pendiente. No sustituir evidencia de navegador por jsdom |
| CMP-01 | se consultó el registro generado y los componentes existentes; no hay promoción, variante global ni migración de biblioteca |
| AVS-01, FRM-01, MP-01/AUD de mutación | no aplica a toasts/confirmación/formulario/mutación: esta superficie solo lee |
| Privacidad | no captura/movimiento/borrado nuevo ni filas reales. Shipping Mark y códigos siguen sujetos a minimización y tenant, aunque no se muestren nombres/RIF |
| Excepciones | ninguna excepción concedida ni inferida; no se declara cierre mientras F1–F3 y gates sigan pendientes |

## Validación

Ver el [handoff](../../../.agents/handoffs/0574-embarques-sin-facturar.md). Los diez casos y tres mutantes de 2026-10-20 son evidencia histórica, no resultados de esta combinación. En la fase ligera actual: guard/claim/merge PASÓ; pruebas nuevas, tipos/lint, documentos generados, RLS, UI, verify, CI y conocimiento NO EJECUTADOS. Se autoriza respaldo de la preparación mediante commit/push selectivo de cinco rutas de pruebas/documentación; todavía sin PR nueva, merge a main ni producción.

La instalación futura, pendiente de turno, usará Corepack con `pnpm@11.19.0`, `--frozen-lockfile --ignore-scripts --store-dir .pnpm-store`, y `COREPACK_ENABLE_AUTO_PIN=0` / `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` limitados al proceso, restaurados al terminar. El Corepack instalado 0.35.0 admite esa sintaxis por lectura de su parser/ejecutor y README; no se ejecutó el manager. Se guardan hashes de `package.json` y `pnpm-lock.yaml` antes/después incluso si falla, y se rechaza cualquier modificación. No se ejecuta `corepack use`, `enable`, `prepare` ni se cambia configuración global. El recibo externo conserva rutas, líneas y hashes de esa inspección; resolver/descargar la versión y la instalación real siguen **NO EJECUTADOS**.
