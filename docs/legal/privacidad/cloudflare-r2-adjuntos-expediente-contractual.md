# Expediente contractual · Cloudflare R2 para adjuntos

**Fecha:** 2026-08-04
**Estado:** cuenta y facturación activas; identidad contractual, DPA aceptado y
archivo de subprocesadores **NO VERIFICABLES**
**Servicio:** Cloudflare R2 Standard
**Ubicación configurada:** ENAM, ubicación sugerida y no garantía jurisdiccional

Este documento registra hechos técnicos visibles y punteros públicos. Contratos,
facturas, capturas con datos fiscales y credenciales viven fuera de Git.

## Evidencia técnica encontrada

- cuenta `HailuwayFlare` con R2 facturable activado;
- bucket privado `dtdcargo-attachments-archive-prod` en Standard;
- regla `dtdcargo-gastos-10y1d`, sin prefijo, 3654 días, habilitada;
- token limitado al bucket y a lectura/escritura de objetos, con vencimiento
  2027-08-04; su valor no fue copiado al repositorio ni al chat;
- alertas de presupuesto USD 37,50, USD 56,25 y USD 67,50;
- objeto sintético `.cloudflare-lock-probe.txt` de 102 bytes, sin PII, cargado
  el 2026-08-04; el panel deshabilitó `Eliminar` por Bucket Lock.

Cloudflare documenta que las reglas sin prefijo cubren objetos nuevos y
existentes y evitan borrado/sobrescritura mientras aplica la retención. La
acción deshabilitada en el panel es evidencia de consola, pero el gate alojado
exige además un intento S3 que reciba `403/AccessDenied`.

## Costo y condiciones

R2 Standard publica 10 GB-mes, 1 millón de operaciones Clase A y 10 millones
Clase B mensuales incluidos; después cobra USD 0,015/GB-mes, USD 4,50 por millón
Clase A y USD 0,36 por millón Clase B. El egress directo de R2 es gratuito. Los
precios no incluyen impuestos ni operación del VPS/ClamAV.

El presupuesto operativo aprobado permanece en USD 75/mes. Las alertas no son
un límite duro ni suspenden el servicio; requieren respuesta humana.

## Identidad y términos

| Evidencia | Estado |
|---|---|
| titular de billing = INVERSIONES DTD SERVICES, C.A. | **NO VERIFICABLE** |
| país fiscal y primera factura | **NO VERIFICABLE** |
| Self-Serve Subscription Agreement aceptado y versión | **NO VERIFICABLE** |
| Service-Specific Terms aplicables a R2 | fuente pública encontrada; aceptación **NO VERIFICABLE** |
| DPA Cloudflare v6.4, vigente 2026-04-03 | fuente pública encontrada; incorporación a la cuenta **NO VERIFICABLE** |
| lista de subprocesadores y suscripción a cambios | fuente pública encontrada; archivo/suscripción **NO VERIFICABLE** |

Antes de datos personales deben archivarse fuera de Git: factura o perfil
fiscal, receipt de aceptación, Self-Serve Agreement, términos específicos, DPA,
lista de subprocesadores y autoridad de quien acepta. Cada archivo se registra
por ruta externa, fecha y SHA-256.

## Ubicación y salida

ENAM es un *location hint*. Cloudflare indica que los hints son mejor esfuerzo;
no garantizan residencia en un país. R2 ofrece restricciones jurisdiccionales
para UE y FedRAMP, pero este bucket no usa una de ellas y no puede cambiar de
jurisdicción después de crearse. Por tanto, no se documenta “EE.UU.” como hecho:
el país exacto, acceso de soporte y subprocesadores siguen **NO VERIFICABLES**.

## Gate contractual

- [ ] identidad fiscal y primera factura archivadas;
- [ ] recibo de aceptación y autoridad corporativa archivados;
- [ ] Agreement, términos específicos, DPA y subprocesadores hasheados;
- [ ] mecanismo de aviso ante cambios de subprocesadores;
- [ ] salida/exportación y cierre de cuenta ensayados;
- [ ] evaluación PIPL firmada para el destino efectivamente confirmado.

Hasta cerrar esas casillas,
`DTD_ATTACHMENTS_CLOUDFLARE_CONTRACT_VERIFIED_AT` permanece vacío.

## Fuentes oficiales

- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/)
- [Cloudflare R2 data location](https://developers.cloudflare.com/r2/reference/data-location/)
- [Cloudflare R2 data security](https://developers.cloudflare.com/r2/reference/data-security/)
- [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/)
- [Cloudflare subprocesadores](https://www.cloudflare.com/gdpr/subprocessors/)
- [Cloudflare Self-Serve Agreement](https://www.cloudflare.com/terms/)

Este expediente técnico no es asesoría legal.
