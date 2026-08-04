# Evaluación PIPL · adjuntos enviados a Cloudflare R2

**Versión:** 1.0 · 2026-08-04
**Estado:** evaluación técnica preparada; mecanismo, país efectivo y
consentimientos **NO VERIFICABLES**
**Conservación del expediente:** mínimo 3 años
**Receptor previsto:** Cloudflare, Inc.; ubicación R2 ENAM no jurisdiccional

## Alcance e inventario

PIPL aplica cuando el equipo propio de Yiwu trata información personal dentro
de China (art. 3). Replicar esos adjuntos a R2 fuera de China es una transferencia
transfronteriza. El binario puede incluir cuenta financiera, firma, rostro,
ubicación o información de terceros; path y metadata se minimizan a UUID,
SHA-256, MIME y recibo `etag:<ETag>`.

PIPL exige finalidad y mínimo necesario (arts. 5–7), contrato y supervisión del
tercero (art. 21), consentimiento separado al entregar datos a otro tratante
(art. 23), medidas reforzadas para información sensible (arts. 28–30), un
mecanismo de salida (art. 38), aviso y consentimiento separado transfronterizo
(art. 39), y evaluación de impacto previa conservada tres años (arts. 55–56).

## Mecanismo fail-closed

1. Laboratorio solo con datos sintéticos y EICAR.
2. Datos que no fueron tratados en China siguen el aviso y contrato venezolano.
3. Datos tratados en China no salen hasta documentar el mecanismo aplicable:
   evaluación CAC, certificación, contrato estándar u otro supuesto vigente.
4. ENAM no identifica un país; antes del consentimiento debe confirmarse el
   receptor, país o países, soporte y subprocesadores efectivos.
5. `DTD_ATTACHMENTS_PIPL_TRANSFER_VERIFIED_AT` permanece vacío hasta una
   decisión firmada y evidencia de consentimiento cuando corresponda.

No se presume una excepción por necesidad contractual ni por volumen. La
condición CII, datos importantes, umbrales anuales y mecanismo CAC son
**NO VERIFICABLES** leyendo el repositorio.

## Texto separado propuesto

> Autorizo por separado que DTD Cargo transfiera fuera de China los adjuntos que
> entregue o genere durante la operación logística —incluidos recibos, facturas
> o fotografías que puedan contener mi información personal— a Cloudflare,
> Inc. y sus subprocesadores aplicables, para análisis antimalware, respaldo
> protegido y recuperación ante incidentes. Antes de otorgar esta autorización
> se me informarán el país o países efectivos, datos de contacto del receptor,
> categorías, método, plazo de conservación y cómo ejercer mis derechos frente
> al receptor. Puedo retirar este consentimiento por el canal informado; el
> retiro no invalida el tratamiento anterior ni permite borrar evidencia sujeta
> a una obligación o retención vigente.

El texto no puede publicarse con “ENAM” como sustituto del país exigido por el
art. 39. Es una plantilla bloqueada hasta completar los campos efectivos.

Registro mínimo append-only:

| Campo | Valor esperado |
|---|---|
| finalidad | `transferencia_cloudflare_r2_adjuntos_cn` |
| versión | `1.0-2026-08-04` |
| receptor y contacto | valor confirmado del expediente contractual |
| país o países | valor confirmado, no `ENAM` |
| categorías y plazo | texto exacto mostrado |
| otorgado/revocado | hora de servidor y canal |
| texto_sha256 | hash del texto exacto |

## Evaluación de impacto

| Prueba | Resultado técnico |
|---|---|
| finalidad necesaria | recuperación independiente e integridad; no analítica ni publicidad |
| minimización | key seudónima y metadata mínima; el contenido sigue siendo personal |
| impacto | acceso de soporte/autoridades, retención larga, dificultad de supresión y país no garantizado |
| controles | TLS, cifrado R2, bucket privado, token limitado, Bucket Lock, SHA-256, restore y gates fail-closed |
| riesgo residual | mecanismo CAC, país, DPA, subprocesadores, endpoint ClamAV y consentimiento pendientes |
| revisión | anual o ante cambio de proveedor, ubicación, subprocesador, finalidad o incidente |

## Dictamen técnico

Resumen: `CORRECTO` 3 · `ENCONTRADO` 1 · `NO VERIFICABLE` 4.

- `CORRECTO`: el worker usa key seudónima y metadata SHA-256 mínima.
- `CORRECTO`: el gate bloquea Producción sin evidencia PIPL y contractual.
- `CORRECTO`: el piloto y antivirus continúan apagados por defecto.
- `ENCONTRADO`: ENAM no permite informar el país efectivo exigido por PIPL
  art. 39; debe resolverse antes de solicitar consentimiento.
- `NO VERIFICABLE`: mecanismo CAC y umbrales aplicables.
- `NO VERIFICABLE`: DPA/Agreement aceptados y subprocesadores archivados.
- `NO VERIFICABLE`: consentimientos separados reales y revocación.
- `NO VERIFICABLE`: EICAR, borrado API denegado, restore y RPO/RTO alojados.

## Fuentes

- [Marco PIPL interno](../../../.claude/skills/revisar-datos-ve/references/marco-legal-cn-pipl.md)
- [Expediente Cloudflare R2](cloudflare-r2-adjuntos-expediente-contractual.md)

Esto no es asesoría legal; el mecanismo y el texto final deben revisarse con
asesoría competente en China.
