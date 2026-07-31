# VIS-02 Gate V4 · validación visual

| Control | Valor |
|---|---|
| Revisión | REV-VIS-006 |
| SDD | [SDD-0175](../../specs/0175-vis-02-tipografia-voz-idioma/spec.md) |
| Fecha | 2026-07-30 |
| Resultado | local aprobado; clientes externos pendientes |

## Matriz

| Superficie | Clasificación | Evidencia |
|---|---|---|
| Firma española | cumplimiento | Archivo, jerarquía, contraste y fallback renderizados |
| Firma formal `zh-CN` | cumplimiento | Noto Serif SC disponible, fallback seguro y cero tofu |
| UI china | cumplimiento | Noto Sans SC permanece antes y después de imprimir |
| Packing list impreso | cumplimiento | PDF y PNG sintéticos; texto chino extraíble |
| Gmail | no conformidad de evidencia | falta buzón controlado y envío real |
| Outlook | no conformidad de evidencia | falta buzón controlado y envío real |
| Apple Mail | no conformidad de evidencia | falta dispositivo/buzón controlado y envío real |

## Resultado

El gate local está aprobado. La revalidación de integración confirmó por
Chromium que UI y documento usan Noto Sans SC en pantalla, que sólo el bloque
formal `zh-CN` cambia a Noto Serif SC bajo media print y que ambas fuentes están
cargadas. El PDF conservó texto chino extraíble y el PNG no presentó tofu,
recortes ni superposición. V3 cubrió impresión y extracción.

No se enviaron correos ni se sustituyó la evidencia de clientes reales por una
captura de navegador. La comprobación externa exige destinatarios de prueba y
debe ejecutarse como smoke controlado; no bloquea el núcleo de gobernanza ni la
adopción ya probada.
