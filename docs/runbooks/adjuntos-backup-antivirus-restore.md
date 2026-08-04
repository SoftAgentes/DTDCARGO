# Runbook · antivirus, respaldo inmutable y restauración de adjuntos

**SDD:** 0224 + 0235
**Estado:** adaptador e IaC listos; ninguna cuenta ni ambiente AWS autenticado
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

## 2 · Decisión para DTD Cargo

### Seleccionada · AWS S3 + GuardDuty Malware Protection for S3

Región: `us-east-1`, alineada con el proyecto Supabase productivo. Arquitectura:

- `scan-inbox`: bucket temporal SSE-KMS protegido por GuardDuty;
- EventBridge → SQS + DLQ: resultados idempotentes y fail-closed;
- `worm-backup`: bucket separado con versionado, checksum y Object Lock
  `COMPLIANCE` por diez años + un día para Gastos;
- S3 Standard por 30 días y Glacier Instant Retrieval después;
- dos claves KMS y roles separados para scan, backup, restore y legal hold.

GuardDuty **no ofrece** el endpoint HTTP `DTD_ATTACHMENTS_AV_URL`: escanea objetos
después de subirlos y publica EventBridge/tags. El adaptador en
`scripts/attachments-guardduty-adapter.mjs` valida cuenta, región, bucket,
VersionId, key y metadata antes de ejecutar las RPC. La plantilla reproducible
vive en `infra/attachments-aws/cloudformation.json`. El worker sigue bloqueado
hasta que la cuenta real entregue outputs y evidencia.

Presupuesto: USD 10/mes para laboratorio y USD 75/mes para Producción, con
alertas 50/75/90 %. La estimación base es USD 2,54 para laboratorio, USD 33,35
para 100 GB totales y USD 50,20 para 1 TB, bajo los supuestos documentados en la
evaluación de privacidad. Producción incluye Business Support+ desde USD 29/mes.

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
- adapter GuardDuty EventBridge/SQS implementado y probado; el endpoint HTTP
  heredado no se usa con este proveedor;
- firmas actualizadas, health check y prueba EICAR;
- worker programado con frecuencia suficiente para RPO ≤ 1 hora;
- alerta por jobs fallidos, backlog, firma vieja, checksum y lock inválido;
- presupuesto y límites para evitar que el proveedor detenga el scanning.

La plantilla crea alarmas para backlog SQS de 30 minutos y cualquier mensaje en
la DLQ. El correo debe confirmar manualmente la suscripción SNS. CloudTrail
organizacional e Inventory se verifican como configuración de la cuenta, no se
presumen por desplegar el stack.

## 4 · Secuencia no productiva

1. Crear una cuenta/proyecto de prueba sin PII real.
2. Crear bucket privado con Object Lock/retención y versionado. Probar que una
   credencial de backup no puede borrar ni reducir el lock.
3. Habilitar GuardDuty tagging antes del primer upload y conectar EventBridge a
   SQS con DLQ. `FAILED`, `UNSUPPORTED`, `ACCESS_DENIED` y timeout nunca son
   `clean`.
4. Subir EICAR al bucket temporal y confirmar `THREATS_FOUND`/cuarentena; subir
   PDF/JPEG/PNG/WebP benignos y confirmar `NO_THREATS_FOUND`. Nunca usar malware
   real ni PII en el laboratorio.
5. Con el adapter ya implementado, definir `DTD_ATTACHMENTS_WORKER_ALLOW=1`,
   ejecutar `pnpm attachments:preflight` y el worker con secretos efímeros. La
   salida no debe incluir tokens, URLs firmadas, object keys completos ni PII.
   Volver el flag a `0` al terminar.
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

El gate alojado se ejecuta con `pnpm attachments:aws:validate` y
`DTD_ATTACHMENTS_AWS_VALIDATION_ALLOW=1`. Crea únicamente objetos sintéticos:
archivo limpio, EICAR y una versión WORM JSON. El receipt se escribe fuera del
repo con creación exclusiva; falla si ya existe, si EICAR no es detectado, si la
versión puede borrarse o si el checksum restaurado cambia.

El despliegue reproducible se ejecuta con `pnpm attachments:aws:deploy` y exige
un allow explícito, identidad STS de la cuenta esperada y receipt externo. El
postflight `pnpm attachments:aws:postflight` no emite evidencia de activación
hasta cruzar, en la misma cuenta y región:

- stack CloudFormation completo y plan GuardDuty `ACTIVE`;
- versionado/SSE-KMS de ambos buckets y Object Lock `COMPLIANCE` por diez años;
- SQS cifrada, DLQ y ocho reintentos;
- receipt sintético vigente con EICAR, borrado denegado, restore y RPO/RTO;
- expediente contractual con hashes de Agreement, Service Terms, DPA,
  subprocesadores, aceptación e identidad de facturación;
- decisión PIPL, evaluación de impacto, texto de consentimiento separado y
  export del registro de consentimientos, todos fuera de Git y con SHA-256.

Los manifests contractual y PIPL son JSON `schemaVersion: 1`. Cada documento
externo se registra como `{ "kind", "path", "sha256" }`; el postflight vuelve a
leerlo y rechaza cualquier hash cambiado. Solo su receipt final proporciona los
valores `*_VERIFIED_AT`; no se copian desde una captura ni se completan a mano.

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
El worker además exige `DTD_ATTACHMENTS_WORKER_ALLOW=1`; no puede arrancar en
Producción con evidencia antivirus mayor a 24 horas o con Object Lock/restore
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
