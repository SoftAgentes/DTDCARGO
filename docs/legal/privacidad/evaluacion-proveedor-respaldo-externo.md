# Evaluación previa · proveedor de respaldo externo para adjuntos

| Campo | Valor |
|---|---|
| Estado | **SELECCIONADO CON CONDICIONES · conexión bloqueada** |
| Proveedor seleccionado | AWS S3 + GuardDuty Malware Protection for S3 |
| Región | `us-east-1` · EE.UU. |
| Finalidad | Recuperación independiente de adjuntos del ERP |
| Fecha | 2026-08-03 |
| Evaluador técnico | Codex, con aprobación documental de Sam |
| SDD | [SDD-0224](../../specs/0224-adjuntos-seguros-reanudables/spec.md) |

Este documento es una evaluación técnica preliminar. No autoriza crear una
cuenta, compartir datos, configurar credenciales ni contratar un proveedor. No
es asesoría legal.

## 1 · Datos que recibiría

| Categoría | ¿Es necesaria para restaurar? | Minimización propuesta |
|---|:-:|---|
| Binario del adjunto | sí | cifrado; object key seudónimo; sin nombre original en el path |
| Tenant, entidad y versión | sí | UUID; no marca comercial, nombre, cédula ni Shipping Mark |
| SHA-256, tamaño y MIME canónico | sí | metadata técnica mínima |
| Nombre original | no para restaurar bytes | conservar solo en Postgres; no copiar como object key |
| Actor/uploader | no | conservar solo en auditoría del ERP |
| Tokens y URLs firmadas | no | prohibido enviarlos o persistirlos |

El binario puede contener identidad, firma, rostro, voz, geolocalización,
información financiera, contratos, documentos aduaneros y datos de terceros no
usuarios. Cifrar o seudonimizar el path no elimina el carácter personal del
contenido.

## 2 · Necesidad y alcance

La finalidad propuesta es restaurar evidencia cuando Supabase, una cuenta o una
operación administrativa no pueda recuperarla. La copia no se usa para
analítica, entrenamiento, publicidad ni mejora del producto del proveedor.

El servicio debe recibir únicamente bytes cifrados, object key seudónimo y
metadata técnica indispensable. La aplicación de negocio no debe entregar
perfiles completos de clientes ni payloads de entidades.

## 3 · Rol y contrato

Estado: **NO VERIFICABLE** para contratación.

AWS está seleccionado técnicamente. El AWS Data Processing Addendum se publica
como parte de los términos del servicio y AWS mantiene una lista de
subprocesadores por región/servicio. Todavía no se verificó ni archivó la entidad
contractual que facturará a DTD Cargo, la aceptación aplicable, el contacto ni
las condiciones de terminación. No se conecta hasta que eso quede revisado.

Antes de conectar deben verificarse y documentarse:

- identidad legal y contacto del proveedor;
- contrato o anexo con finalidad, plazo, método, categorías y medidas;
- prohibición de uso propio de los datos;
- subcontratistas, países y mecanismo de notificación de cambios;
- devolución/exportación y eliminación al terminar;
- tiempos y evidencia de notificación de incidentes;
- acceso humano, soporte y logs administrativos;
- responsabilidad por mala configuración y exclusiones del SLA.

Para Venezuela el contrato es el mecanismo práctico para delimitar obligaciones
y responsabilidades. Para tratamiento sujeto a PIPL, el art. 21 exige pactar y
supervisar finalidad, plazo, método, categorías y medidas.

## 4 · Ubicación y transferencia

Estado: **CORRECTO para la selección regional; NO VERIFICABLE para la
transferencia jurídica**.

- El proyecto Supabase productivo reportó `us-east-1` en una consulta de
  metadatos de solo lectura del 2026-08-03. Ese dato no está fijado en el repo.
- Se selecciona AWS `us-east-1` para evitar una segunda región operativa y
  reducir latencia/RPO entre el origen y el respaldo.
- GuardDuty procesa el objeto en un entorno aislado de la misma región, cifrado
  temporalmente, y elimina su copia de trabajo al terminar el scan.
- AWS declara que el contenido permanece en la región elegida salvo instrucción
  del cliente o exigencia legal; la lista de subprocesadores depende de región y
  servicios y debe archivarse al contratar.

Se debe registrar:

- país y región primaria;
- réplicas, soporte y subcontratistas por país;
- capacidad de fijar residencia;
- nombre y contacto del receptor extranjero;
- mecanismo aplicable para salida desde China;
- forma de ejercicio de derechos frente al receptor.

Como DTD Cargo tiene operación y equipo propio en China, un adjunto tratado allí
puede quedar bajo PIPL. Cuando exista transferencia fuera de China se deben
resolver los mecanismos del art. 38 y la información/consentimiento separado del
art. 39. La evaluación de impacto previa de los arts. 55–56 también debe cubrir
datos sensibles, tercero y transferencia.

La región está definida, pero la salida de datos tratados en China hacia EE.UU.
sigue bloqueada hasta resolver PIPL arts. 38–39 y conservar la evaluación de
impacto de los arts. 55–56. El piloto externo solo puede usar archivos sintéticos
sin PII mientras falte ese gate.

## 5 · Independencia operativa

El proveedor solo califica como respaldo independiente si cumple todo lo
siguiente:

- cuenta, organización, facturación y MFA separados de Supabase y Vercel;
- credenciales write-only para backup y credenciales de restore separadas;
- ninguna credencial de borrado disponible en el runtime normal de la app;
- no sincronizar deletes del origen como eliminación de la copia protegida;
- Object Lock o inmutabilidad aplicada desde el primer PUT;
- legal hold por objeto/versión;
- logs de cambios de retención e intentos de borrado;
- restore a infraestructura nueva sin depender de Supabase.

Arquitectura seleccionada, todavía **NO VERIFICABLE** en una cuenta real:

1. cuenta AWS exclusiva, MFA y recuperación con dos responsables;
2. bucket `scan-inbox` privado con SSE-KMS, GuardDuty, tagging y acceso negado
   salvo resultado `NO_THREATS_FOUND`;
3. EventBridge → SQS con DLQ para resultados idempotentes y fail-closed;
4. bucket `worm-backup` separado, versionado y Object Lock `COMPLIANCE`;
5. roles distintos para scan, escritura de backup, restore y legal hold;
6. CloudTrail, Inventory, CloudWatch y AWS Budgets habilitados.

GuardDuty no expone el HTTP `DTD_ATTACHMENTS_AV_URL`. El worker actual debe
recibir un adaptador asíncrono EventBridge/SQS antes de ejecutar EICAR real; no se
debe simular el endpoint ni llenar evidencia manualmente.

## 6 · Integridad, retención y restore

Requisitos técnicos:

- SHA-256 end-to-end calculado nuevamente desde el objeto de origen;
- comparación de hash, tamaño y versión después de copiar;
- inventory API o manifiesto reconciliable;
- versiones anteriores preservadas;
- multipart incompleto identificado y no declarado protegido;
- simulacro de un archivo, una entidad, un tenant y pérdida total del origen;
- restore byte a byte con checksum idéntico;
- evidencia mensual de integridad y trimestral de restauración.

Objetivos de diseño aprobados por SDD-0224:

- RPO menor o igual a 1 hora;
- RTO de evidencia crítica menor o igual a 4 horas.

Retención seleccionada para el piloto de Gastos:

| Plano | Condición |
|---|---|
| `scan-inbox` limpio | borrar dentro de 24 h después de scan limpio + copia WORM confirmada |
| amenaza, scan fallido o no soportado | cuarentena sin acceso de negocio, máximo 30 días para incidente |
| `worm-backup` · Gastos | 10 años + 1 día por versión, modo `COMPLIANCE` |
| almacenamiento | S3 Standard durante 30 días; luego Glacier Instant Retrieval |
| vencimiento WORM | sin borrado automático; revisión humana de hold/fiscal antes de purgar |

Glacier Instant Retrieval conserva acceso en milisegundos y Object Lock se
mantiene durante transiciones de clase. Las futuras categorías de adjuntos no
heredan diez años automáticamente: deben usar el calendario de retención y su
base documental.

### Brecha específica de Backblaze B2

La documentación oficial de Object Lock indica una retención entre 1 y 3.000
días. MP-D1 usa diez años como default conservador para ciertas evidencias.
Por tanto, una configuración única de B2 Object Lock no demuestra por sí sola el
plazo completo.

Antes de elegir B2 debe probarse una de estas opciones:

1. renovación inmutable sin crear una ventana borrable;
2. legal hold gobernado con separación de privilegios;
3. una combinación contractual/técnica equivalente;
4. otro proveedor que cubra el plazo completo.

Referencia consultada el 2026-07-31:
[Backblaze Object Lock](https://www.backblaze.com/docs/cloud-storage-object-lock).

## 7 · Cifrado y claves

Configuración seleccionada, todavía **NO VERIFICABLE** en cuenta real:

- TLS en tránsito y SSE-KMS en reposo;
- dos claves administradas separadas: scan temporal y backup WORM;
- S3 Bucket Keys habilitadas para reducir llamadas KMS;
- runtime sin `kms:ScheduleKeyDeletion`, borrado ni reducción de retención;
- espera de borrado KMS de 30 días, alertada por CloudTrail;
- restore y recuperación de cuenta fuera de Supabase/Vercel.

Object Lock no protege contra perder o borrar una clave KMS. Por eso el restore
drill debe incluir la clave y la recuperación de cuenta, no solo el objeto.

## 8 · Costos y salida

Precios de referencia AWS `us-east-1`, consultados el 2026-08-03, sin impuestos:

- S3 Standard: USD 0,023/GB-mes; Glacier Instant Retrieval:
  USD 0,004/GB-mes y USD 0,03/GB recuperado;
- GuardDuty S3: USD 0,09/GB escaneado + USD 0,215 por 1.000 objetos;
- KMS: USD 1/mes por clave; se seleccionan dos claves;
- salida a Internet: primeros 100 GB/mes agregados en AWS sin cargo; luego la
  tarifa regional vigente;
- Business Support+: mínimo USD 29/mes para Producción; no se contrata en el
  laboratorio.

Estimación conservadora sin descontar free tiers, requests, logs, impuestos ni
soporte salvo donde se indica:

| Escenario | Supuesto | Base mensual aproximada |
|---|---|---:|
| laboratorio | 10 GB recientes · 1 GB/1.000 objetos nuevos · sin soporte pago | USD 2,54 |
| Producción pequeña | 100 GB totales, 90 GB en Glacier · 10 GB/4.000 objetos nuevos · Support+ | USD 33,35 |
| crecimiento | 1 TB total, 900 GB en Glacier · 100 GB/20.000 objetos nuevos · Support+ | USD 50,20 |

Condición de costo: presupuesto AWS inicial de USD 10/mes en laboratorio y USD
75/mes en Producción, con alertas al 50 %, 75 % y 90 %. Forecast mayor al 90 %,
más de 1 TB retenido o más de 100 GB nuevos/mes bloquean expansión hasta nueva
aprobación. Los objetos menores a 128 KB y múltiples versiones pueden elevar el
costo real; la factura piloto manda sobre esta proyección.

## 9 · Veredicto

- [ ] Adelante
- [x] **Adelante con condiciones para contratar; no conectar todavía**
- [ ] No

Motivos:

1. proveedor, región, arquitectura, retención y presupuesto ya están definidos;
2. falta archivar contrato/DPA, entidad de facturación y subprocesadores;
3. no se resolvió transferencia desde China;
4. falta implementar el adaptador EventBridge/SQS del worker;
5. no existen EICAR, Object Lock, restore drill ni RPO/RTO en cuenta real.

El gate se reabre únicamente con evidencia contractual, técnica, de privacidad y
de restauración. La revisión legal corresponde a un abogado.

## 10 · Comparativo técnico actualizado

| Opción | Inmutabilidad | Antivirus | Nivel gratuito útil | Ajuste al worker actual | Veredicto |
|---|---|---|---|---|---|
| AWS S3 + GuardDuty | Object Lock WORM por versión | administrado; free tier sujeto a condiciones vigentes | storage/requests aparte | backup alto; antivirus requiere adapter asíncrono | ⭐ seleccionada |
| Cloudflare R2 + ClamAV | bucket locks | autogestionado | 10 GB-mes Standard + operaciones/egress incluidos | requiere adaptar lock + operar AV | económica con trabajo adicional |
| Backblaze B2 + ClamAV | Object Lock sin recargo específico | autogestionado | primeros 10 GB | API S3 compatible, pero lock máximo 3.000 días | no cubre diez años por sí sola |
| Azure Blob + Defender | WORM/immutability | administrado por GB | no asumido | requiere adaptador nuevo | alternativa empresarial |

**Decisión técnica:** AWS S3 Object Lock `COMPLIANCE` más GuardDuty Malware
Protection for S3, región `us-east-1`. Coincide con el SDK de backup y evita
operar firmas AV, pero **no** coincide con el contrato HTTP del antivirus actual:
la integración será EventBridge/SQS y deberá validarse antes de activar.

La alternativa de menor costo es R2 + ClamAV, pero no se debe confundir
“software gratis” con servicio administrado: DTD asumiría VPS, actualizaciones,
colas, disponibilidad, alertas y respuesta a incidentes.

## 11 · Fuentes del proveedor

- [AWS GuardDuty pricing](https://aws.amazon.com/guardduty/pricing/)
- [GuardDuty data handling](https://docs.aws.amazon.com/guardduty/latest/ug/how-malware-protection-for-s3-gdu-works.html)
- [GuardDuty EventBridge results](https://docs.aws.amazon.com/guardduty/latest/ug/monitor-with-eventbridge-s3-malware-protection.html)
- [S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
- [Object Lock y Lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-managing.html)
- [Glacier Instant Retrieval](https://docs.aws.amazon.com/AmazonS3/latest/userguide/glacier-storage-classes.html)
- [AWS KMS pricing](https://aws.amazon.com/kms/pricing/)
- [AWS Support pricing](https://aws.amazon.com/premiumsupport/pricing/)
- [AWS DPA](https://docs.aws.amazon.com/whitepapers/latest/navigating-gdpr-compliance/aws-data-processing-addendum-dpa.html)
- [AWS subprocessors](https://aws.amazon.com/compliance/sub-processors/)
