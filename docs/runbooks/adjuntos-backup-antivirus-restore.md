# Runbook · antivirus, respaldo inmutable y restauración de adjuntos

**SDD:** 0224 + 0235
**Estado:** preparado; ningún proveedor ni ambiente productivo configurado
**RPO objetivo:** ≤ 1 hora
**RTO de evidencia crítica:** ≤ 4 horas

## 1 · Qué resuelve y qué no

Este runbook convierte un adjunto limpio en una copia externa verificable y
restaurable. Object Lock protege contra borrado/sobrescritura; el antivirus
reduce el riesgo de distribuir archivos maliciosos. Son controles distintos:
uno no reemplaza al otro.

No se declara `protegido` por tener variables de entorno. Se exige evidencia de
scanner actualizado, EICAR detectado, SHA-256 coincidente, versión inmutable y
restore byte-idéntico.

## 2 · Recomendación para DTD Cargo

### Opción prioritaria · AWS S3 + GuardDuty Malware Protection for S3

Es la ruta con menor trabajo operativo para el contrato actual:

- S3 Object Lock ofrece WORM, retención y legal hold;
- GuardDuty analiza uploads de S3 y puede usarse de forma independiente;
- el worker existente ya usa AWS SDK, `VersionId`, checksum,
  `ObjectLockMode=COMPLIANCE` y `GetObjectRetention`;
- permite fijar diez años sin la brecha de 3.000 días de Backblaze B2.

El costo es mayor que un stack autogestionado, pero reduce adaptadores,
mantenimiento de firmas y riesgo de que el scanner quede caído silenciosamente.

### Opción económica · Cloudflare R2 + ClamAV administrado por DTD

R2 incluye 10 GB-mes de Standard, operaciones y egress dentro de su nivel
gratuito, y soporta reglas de bloqueo de bucket. ClamAV es GPLv2 y gratuito.
Sin embargo, **no es plug-and-play con el worker actual**: se debe adaptar y
probar la verificación de lock de R2, alojar `clamd`, actualizar firmas, medir
colas, endurecer el endpoint y operar alertas. El software puede ser gratis; el
VPS, la operación y la disponibilidad no lo son.

### Piloto de costo mínimo · Backblaze B2 + ClamAV

B2 ofrece los primeros 10 GB sin cargo y Object Lock sin recargo específico.
No satisface por sí solo el default de diez años: su retención documentada llega
a 3.000 días. Solo puede usarse si se aprueba otra estrategia demostrable
(legal hold gobernado, renovación sin ventana borrable o plazo menor decidido).

## 3 · Gates previos obligatorios

- cuenta de respaldo distinta a Supabase/Vercel, con MFA y recuperación
  documentada;
- bucket privado con versionado e inmutabilidad desde el primer PUT;
- credencial de backup sin permiso de borrar/acortar retención;
- credencial de restore separada y fuera del runtime normal;
- región, contrato, subprocesadores y transferencia VE/China revisados;
- endpoint AV privado que reciba bytes y responda únicamente
  `{ "clean": boolean, "signature": string | null }`;
- firmas actualizadas, health check y prueba EICAR;
- worker programado con frecuencia suficiente para RPO ≤ 1 hora;
- alerta por jobs fallidos, backlog, firma vieja, checksum y lock inválido;
- presupuesto y límites para evitar que el proveedor detenga el scanning.

## 4 · Secuencia no productiva

1. Crear una cuenta/proyecto de prueba sin PII real.
2. Crear bucket privado con Object Lock/retención y versionado. Probar que una
   credencial de backup no puede borrar ni reducir el lock.
3. Desplegar el scanner en red privada. Actualizar firmas y registrar versión y
   fecha; el token vive solo en el secret manager.
4. Subir EICAR y confirmar `cuarentena`; subir PDF/JPEG/PNG/WebP benignos y
   confirmar `clean`. Nunca usar malware real.
5. Ejecutar `scripts/attachments-pilot-worker.mjs` con secretos efímeros. La
   salida no debe incluir tokens, URLs firmadas, object keys completos ni PII.
6. Confirmar en el proveedor `VersionId`, SHA-256, modo `COMPLIANCE` y
   `RetainUntilDate`. Un PUT sin cualquiera de esos datos falla cerrado.
7. Ejecutar el simulacro con `NODE_ENV` distinto de `production`,
   `DTD_ATTACHMENTS_DRILL_ALLOW=1` y
   `scripts/attachments-pilot-restore-drill.mjs`.
8. Comparar el SHA-256 restaurado con el esperado y registrar tiempo total,
   bytes, versión, región y operador; nunca copiar el contenido al informe.
9. Repetir borrado/overwrite con credencial normal y guardar el rechazo del
   proveedor como evidencia.
10. Solo entonces registrar las fechas verificadas del gate y probar el piloto
    no productivo de Gastos.

## 5 · Evidencia mínima

| Evidencia | Criterio |
|---|---|
| AV health | firma vigente y endpoint disponible |
| EICAR | detectado y objeto en cuarentena |
| Archivo limpio | magic bytes + SHA-256 + AV limpio |
| Backup | `VersionId`, checksum, lock COMPLIANCE y retención |
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
- Object Lock/VersionId no verificable → backup fallido, nunca `protegido`;
- restore distinto → incidente y piloto apagado;
- rollback = apagar piloto/workers y conservar objetos, jobs y auditoría;
- nunca borrar evidencia, acortar locks ni restaurar una policy cross-tenant.

## 8 · Gates de producción

Producción solo avanza después de: migrations Cloud autorizadas por basename,
proveedor/contrato aprobados, scanner y scheduler reales, restore drill verde,
RPO/RTO demostrados, revisión de datos personales y orden `cerrar` para
publicación. Si falta uno, `DTD_ATTACHMENTS_GASTOS_PILOT` permanece en `0`.

## Fuentes técnicas consultadas

- [AWS S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
- [AWS GuardDuty Malware Protection for S3](https://docs.aws.amazon.com/guardduty/latest/ug/guardduty-pricing.html)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/)
- [Backblaze B2 Object Lock](https://www.backblaze.com/docs/cloud-storage-object-lock)
- [ClamAV](https://docs.clamav.net/)
