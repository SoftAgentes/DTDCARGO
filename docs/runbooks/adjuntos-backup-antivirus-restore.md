# Runbook · antivirus, respaldo inmutable y restauración de adjuntos

**SDD:** 0224 + 0235
**Estado:** R2 configurado; adaptadores listos; antivirus y piloto apagados
**RPO objetivo:** ≤ 1 hora
**RTO de evidencia crítica:** ≤ 4 horas

## 1 · Qué resuelve y qué no

Este runbook convierte un adjunto limpio en una copia externa verificable y
restaurable. Bucket Lock protege contra borrado/sobrescritura; el antivirus
reduce el riesgo de distribuir archivos maliciosos. Son controles distintos:
uno no reemplaza al otro.

No se declara `protegido` por tener variables de entorno. Se exige evidencia de
scanner actualizado, EICAR detectado, SHA-256 coincidente, recibo inmutable y
restore byte-idéntico.

## 2 · Decisión para DTD Cargo

### Seleccionada · Cloudflare R2 + ClamAV administrado por DTD

- bucket privado `dtdcargo-attachments-archive-prod`, Standard;
- ubicación sugerida ENAM; no es una garantía de país o jurisdicción;
- Bucket Lock `dtdcargo-gastos-10y1d`, sin prefijo, 3654 días;
- recibo `etag:<ETag>` y mecanismo `R2_BUCKET_LOCK`;
- outbox de Supabase como cola durable; Cloudflare Queues no es requisito;
- `clamd` local detrás de `scripts/attachments-clamav-http.mjs`, ligado a
  loopback, con bearer, límite 25 MiB y respuesta fail-closed.

R2 no implementa S3 Object Lock ni `VersionId`; por eso la migración `0346`
amplía el recibo sin etiquetarlo falsamente como AWS `COMPLIANCE`. El gate
alojado `pnpm attachments:r2:validate` crea un único objeto sintético, exige
borrado S3 denegado, restaura bytes y compara SHA-256.

R2 Standard incluye 10 GB-mes, 1 millón de Clase A y 10 millones de Clase B al
mes. El excedente publicado es USD 0,015/GB-mes, USD 4,50/millón A y
USD 0,36/millón B, con egress directo gratuito. El presupuesto es USD 75/mes,
con alertas reales en USD 37,50, 56,25 y 67,50. ClamAV es gratuito; VPS,
operación y disponibilidad no lo son.

### Alternativa conservada · AWS S3 + GuardDuty

El adaptador EventBridge/SQS y la plantilla AWS permanecen probados como plan de
contingencia, pero no están seleccionados ni conectados. No se elimina esa
implementación porque permite volver sin reescribir la arquitectura si el alta
AWS deja de estar bloqueada.

### Piloto de costo mínimo · Backblaze B2 + ClamAV

B2 ofrece los primeros 10 GB sin cargo y Object Lock sin recargo específico.
No satisface por sí solo el default de diez años: su retención documentada llega
a 3.000 días. Solo puede usarse si se aprueba otra estrategia demostrable
(legal hold gobernado, renovación sin ventana borrable o plazo menor decidido).

## 3 · Gates previos obligatorios

- cuenta de respaldo distinta a Supabase/Vercel, con MFA y recuperación
  documentada;
- bucket privado con retención protegida desde el primer PUT;
- credencial de backup sin permiso de borrar/acortar retención;
- credencial de restore separada y fuera del runtime normal;
- región, contrato, subprocesadores y transferencia VE/China revisados;
- adaptador R2 y puente ClamAV implementados y probados;
- firmas actualizadas, health check y prueba EICAR;
- worker programado con frecuencia suficiente para RPO ≤ 1 hora;
- alerta por jobs fallidos, backlog, firma vieja, checksum y lock inválido;
- presupuesto y límites para evitar que el proveedor detenga el scanning.

El outbox existente evita contratar Cloudflare Queues solo para este flujo. El
scheduler debe alertar por job mayor de 30 minutos, tres fallos seguidos y firma
AV mayor de 24 horas.

## 4 · Secuencia no productiva

1. Crear una cuenta/proyecto de prueba sin PII real.
2. Confirmar el Bucket Lock R2 y probar que la credencial del worker no puede
   borrar ni sobrescribir el objeto sintético.
3. Instalar `clamd` y `freshclam` al final, mantenerlos en loopback y arrancar
   el adaptador con allow explícito.
4. Enviar EICAR al adaptador y confirmar `clean:false`/cuarentena; enviar
   PDF/JPEG/PNG/WebP benignos y confirmar `clean:true`. Nunca usar malware
   real ni PII en el laboratorio.
5. Con el adapter ya implementado, definir `DTD_ATTACHMENTS_WORKER_ALLOW=1`,
   ejecutar `pnpm attachments:preflight` y el worker con secretos efímeros. La
   salida no debe incluir tokens, URLs firmadas, object keys completos ni PII.
   Volver el flag a `0` al terminar.
6. Confirmar `ETag`, metadata SHA-256, regla de lock y retención. Un PUT sin
   recibo o un intento de borrado permitido falla cerrado.
7. Ejecutar el simulacro con `NODE_ENV` distinto de `production`,
   `DTD_ATTACHMENTS_DRILL_ALLOW=1` y
   `scripts/attachments-pilot-restore-drill.mjs`.
8. Comparar el SHA-256 restaurado con el esperado y registrar tiempo total,
   bytes, versión, región y operador; nunca copiar el contenido al informe.
9. Repetir borrado/overwrite con credencial normal y guardar el rechazo del
   proveedor como evidencia.
10. Solo entonces registrar las fechas verificadas del gate y probar el piloto
    no productivo de Gastos.

El gate R2 se ejecuta con `pnpm attachments:r2:validate` y
`DTD_ATTACHMENTS_R2_VALIDATION_ALLOW=1`. Crea únicamente un JSON sintético sin
PII. El receipt se escribe fuera del repo con creación exclusiva; falla si ya
existe, si el objeto puede borrarse o si el checksum restaurado cambia. EICAR es
un gate posterior y separado del adaptador ClamAV.

Los receipts contractual y PIPL viven fuera de Git. Cada documento externo se
registra por tipo, ruta y SHA-256; solo el cierre de esos expedientes proporciona
los valores `*_VERIFIED_AT`. Las herramientas AWS permanecen como contingencia
y no forman parte de la activación R2.

## 5 · Evidencia mínima

| Evidencia | Criterio |
|---|---|
| AV health | firma vigente y endpoint disponible |
| EICAR | detectado y objeto en cuarentena |
| Archivo limpio | magic bytes + SHA-256 + AV limpio |
| Backup | `etag:<ETag>`, checksum, `R2_BUCKET_LOCK` y retención |
| Intento de borrado | rechazado por el proveedor |
| Restore | mismos bytes y SHA-256 |
| RPO/RTO | ≤ 1 h / ≤ 4 h o piloto bloqueado |

Las variables `*_VERIFIED_AT` son punteros a esa evidencia, no la evidencia
misma. No se llenan manualmente para “hacer pasar” el gate.

## 6 · Operación y alertas

- scanner: health cada minuto; alerta si firmas > 24 h o EICAR falla;
- colas: alerta si el job más viejo supera 30 min o hay tres fallos seguidos;
- backup: reconciliación diaria entre documentos limpios y versiones externas;
- restore: muestra mensual no productiva y simulacro trimestral de pérdida del
  origen;
- costos: alarma al 50 %, 75 % y 90 % del presupuesto/cap de scanning;
- credenciales: rotación trimestral y después de cada incidente;
- cuenta: prueba semestral de recuperación con segundo responsable.

## 7 · Fail-closed y rollback

- AV caído, firmas viejas o respuesta inválida → `scan_failed`, nunca limpio;
- checksum distinto → cuarentena y bloqueo de backup;
- recibo/lock R2 no verificable → backup fallido, nunca `protegido`;
- restore distinto → incidente y piloto apagado;
- rollback = apagar piloto/workers y conservar objetos, jobs y auditoría;
- nunca borrar evidencia, acortar locks ni restaurar una policy cross-tenant.

## 8 · Gates de producción

Producción solo avanza después de: migrations Cloud autorizadas por basename,
proveedor/contrato aprobados, scanner y scheduler reales, restore drill verde,
RPO/RTO demostrados, revisión de datos personales y orden `cerrar` para
publicación. Si falta uno, `DTD_ATTACHMENTS_GASTOS_PILOT` permanece en `0`.
El worker además exige `DTD_ATTACHMENTS_WORKER_ALLOW=1`; no puede arrancar en
Producción con evidencia antivirus mayor a 24 horas o con Bucket Lock/restore
sin una comprobación dentro de los últimos 93 días.

## Fuentes técnicas consultadas

- [AWS S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
- [AWS GuardDuty Malware Protection for S3](https://docs.aws.amazon.com/guardduty/latest/ug/guardduty-pricing.html)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/)
- [Backblaze B2 Object Lock](https://www.backblaze.com/docs/cloud-storage-object-lock)
- [ClamAV](https://docs.clamav.net/)
- [GuardDuty y EventBridge](https://docs.aws.amazon.com/guardduty/latest/ug/monitor-with-eventbridge-s3-malware-protection.html)
- [Glacier Instant Retrieval](https://docs.aws.amazon.com/AmazonS3/latest/userguide/glacier-storage-classes.html)
- [AWS Support pricing](https://aws.amazon.com/premiumsupport/pricing/)
