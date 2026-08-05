# Evaluación previa · proveedor externo de adjuntos

| Campo | Valor |
|---|---|
| Estado | **R2 CONFIGURADO · activación bloqueada por gates externos** |
| Proveedor seleccionado | Cloudflare R2 + ClamAV administrado por DTD |
| Bucket | `dtdcargo-attachments-archive-prod` · privado · Standard |
| Ubicación | ENAM · sugerencia de ubicación, no jurisdicción garantizada |
| Retención | Bucket Lock `dtdcargo-gastos-10y1d` · 3654 días |
| Fecha | 2026-08-04 |
| SDD | [SDD-0224](../../specs/0224-adjuntos-seguros-reanudables/spec.md) |

AWS S3 + GuardDuty fue la primera selección y su código permanece como
contingencia, pero el alta quedó bloqueada por SMS desde Venezuela. El founder
autorizó avanzar con Cloudflare. No es asesoría legal.

## Datos y finalidad

La copia contiene el binario del adjunto y metadata técnica mínima: key
seudónima, SHA-256, MIME canónico y recibo `etag:<ETag>`. El nombre original,
actor, correo, teléfono, Shipping Mark, URL firmada y token no se copian.

El binario puede contener identidad, firma, rostro, voz, geolocalización,
cuentas financieras, contratos y datos de terceros no usuarios. Cifrar o usar
UUID no elimina el carácter personal del contenido.

La única finalidad aprobada es análisis antimalware, recuperación independiente
e integridad. No se autoriza analítica, entrenamiento, publicidad ni mejora de
producto del proveedor.

## Arquitectura seleccionada

1. Supabase conserva el origen y sus outboxes durables de scan/backup/restore.
2. `scripts/attachments-clamav-http.mjs` traduce HTTP local al protocolo
   `INSTREAM` de `clamd`; queda ligado a loopback y falla cerrado.
3. Solo un resultado limpio permite copiar a R2.
4. R2 recibe `dtdcargo/{object_key}`, SHA-256 en metadata y devuelve ETag.
5. El estado `protegido` exige `R2_BUCKET_LOCK`, recibo, checksum y retención.
6. El restore drill descarga el objeto y compara SHA-256 byte a byte.

Cloudflare Queues no es requisito: el outbox Postgres ya aporta reclamo,
reintentos e idempotencia. Evitar Queues elimina un plan Workers pago sin
debilitar el flujo aprobado.

R2 Bucket Lock no es S3 Object Lock y R2 no devuelve `VersionId`. La migración
`0346_r2_bucket_lock_backup_receipts.sql` amplía el contrato de base de datos
para registrar `R2_BUCKET_LOCK` y `etag:<ETag>` con semántica explícita.

## Evidencia real al 2026-08-04

`CORRECTO` en consola:

- facturación R2 activada;
- bucket privado Standard creado;
- token restringido al bucket y operaciones de objetos, guardado fuera de Git;
- regla de 3654 días habilitada para todos los objetos;
- alertas de gasto en USD 37,50, 56,25 y 67,50;
- objeto sintético sin PII cargado; el panel deshabilita `Eliminar`.

`NO VERIFICABLE` todavía:

- identidad fiscal, factura, aceptación, DPA y subprocesadores archivados;
- intento S3 de borrado con `403/AccessDenied` y receipt externo;
- restore alojado y medición real RPO/RTO;
- instalación/health de `clamd`, firmas y prueba EICAR;
- mecanismo PIPL, país efectivo y consentimiento separado.

Por eso `DTD_ATTACHMENTS_GASTOS_PILOT=0` y
`DTD_ATTACHMENTS_WORKER_ALLOW=0` permanecen como defaults.

## Retención e integridad

Para Gastos se configuró 10 años + 1 día como 3654 días. La regla sin prefijo
aplica a objetos existentes y nuevos. Cloudflare documenta que un lock evita
borrado y sobrescritura mientras está vigente y prevalece sobre lifecycle.

La credencial del worker no administra la configuración del bucket. Aun así,
Bucket Lock puede ser administrado por una identidad con permisos de cuenta;
la separación de administradores, MFA y auditoría de cambios debe comprobarse
operativamente. No se presenta Bucket Lock como equivalente regulatorio a AWS
Object Lock Compliance.

Objetivos aprobados:

- RPO ≤ 1 hora;
- RTO de evidencia crítica ≤ 4 horas;
- muestra de restore mensual y simulacro trimestral;
- sin borrado físico automático al vencer: revisión de hold y obligación.

## Región y transferencia

El bucket muestra ENAM. Cloudflare documenta que un *location hint* es mejor
esfuerzo y no garantía de residencia. Las restricciones jurisdiccionales R2
disponibles son UE y FedRAMP; no se configuraron y no pueden añadirse después
al mismo bucket.

Esto bloquea datos tratados en China: PIPL art. 39 exige informar el receptor
extranjero y el ejercicio de derechos; la evaluación necesita un país o alcance
territorial real. Véase
[pipl-cloudflare-r2-adjuntos.md](pipl-cloudflare-r2-adjuntos.md).

## Contrato y subprocesadores

El DPA público de Cloudflare v6.4 declara incorporación al acuerdo principal y
aviso de nuevos subprocesadores con al menos 30 días. Esa fuente no prueba que
la cuenta DTD tenga titular fiscal correcto, que una persona autorizada aceptó
el acuerdo ni que se archivó la lista aplicable. Véase
[cloudflare-r2-adjuntos-expediente-contractual.md](cloudflare-r2-adjuntos-expediente-contractual.md).

## Costos

Precios públicos R2 Standard consultados el 2026-08-04:

| Concepto | Incluido al mes | Excedente |
|---|---:|---:|
| almacenamiento | 10 GB-mes | USD 0,015/GB-mes |
| Clase A | 1 millón | USD 4,50/millón |
| Clase B | 10 millones | USD 0,36/millón |
| egress directo | gratuito | gratuito |

No incluye impuestos, VPS, monitoreo ni operación ClamAV. El presupuesto
aprobado es USD 75/mes. Las alertas no constituyen un límite duro.

## Veredicto

- [ ] activar Producción
- [x] **continuar con evidencia sintética y preparación alojada**
- [ ] descartar proveedor

Cloudflare R2 es la selección operativa por disponibilidad desde Venezuela,
costo y API S3 compatible. La activación permanece bloqueada hasta:

1. aplicar `0346` por gate nominal separado;
2. archivar contrato/DPA/subprocesadores/identidad;
3. resolver PIPL y el país efectivo;
4. instalar ClamAV y superar health + EICAR;
5. ejecutar borrado API denegado, restore y RPO/RTO;
6. confirmar scheduler/alertas y recién entonces cambiar flags.

## Fuentes oficiales

- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/)
- [R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
- [R2 data location](https://developers.cloudflare.com/r2/reference/data-location/)
- [R2 data security](https://developers.cloudflare.com/r2/reference/data-security/)
- [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/)
- [Cloudflare subprocesadores](https://www.cloudflare.com/gdpr/subprocessors/)
- [ClamAV](https://docs.clamav.net/)
