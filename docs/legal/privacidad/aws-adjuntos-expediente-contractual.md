# Expediente contractual · AWS para adjuntos

**Fecha de captura:** 2026-08-03
**Estado:** alternativa técnica supersedida el 2026-08-04 por Cloudflare R2;
fuentes archivadas, sin cuenta ni aceptación AWS
**Servicios previstos:** S3, GuardDuty Malware Protection for S3, KMS,
EventBridge, SQS, CloudWatch y Budgets
**Región:** `us-east-1`

**Hardening local posterior (2026-09-02):** aunque esta alternativa continúa
supersedida y no conectada, SDD-0332 añadió `DeletionPolicy: Retain` y
`UpdateReplacePolicy: Retain` a `BackupKey`. Así el template ya no conserva el
bucket WORM mientras programa por defecto la eliminación de la llave necesaria
para descifrarlo. Esto no demuestra que exista un stack AWS desplegado.

Este expediente conserva punteros y huellas, no copias contractuales crudas. La
aceptación, factura y documentos descargados desde AWS deben vivir en el
repositorio legal externo autorizado; nunca en Git.

## 1 · Identidad contractual

| Elemento | Estado | Evidencia |
|---|---|---|
| País de la cuenta | **NO VERIFICABLE** | todavía no existe o no está autenticada una cuenta AWS |
| Titular previsto | INVERSIONES DTD SERVICES, C.A. | debe coincidir con billing/tax profile y primera factura |
| País previsto | Venezuela | debe fijarse en el alta; no se infiere de la tarjeta |
| Parte contractual esperada | Amazon Web Services, Inc., 410 Terry Avenue North, Seattle, WA 98109-5210, EE.UU. | la tabla oficial asigna a esa entidad los países no enumerados; debe confirmarse en la cuenta |
| Fecha/hora de aceptación | **NO VERIFICABLE** | guardar receipt o captura del evento de aceptación |
| Autoridad de quien acepta | **NO VERIFICABLE** | decisión corporativa y revisión legal humanas |

La parte contractual depende del `Account Country`; AWS lo determina usando
registro fiscal, billing address y, en ciertos casos, país de tarjeta/contacto.
Por eso la tabla oficial no sustituye la comprobación de la cuenta real.

## 2 · DPA y condiciones del servicio

AWS declara que el Data Processing Addendum se incorpora a sus Service Terms y
aplica globalmente cuando se procesan datos del cliente. Esto constituye
evidencia del texto publicado, no prueba de que DTD haya creado la cuenta,
aceptado las condiciones aplicables ni cumplido PIPL.

Antes de conectar:

- archivar Customer Agreement y Service Terms efectivamente aceptados;
- registrar versión/fecha, parte contractual, cuenta, representante y forma de pago;
- confirmar devolución/exportación y supresión al terminar;
- confirmar acceso de soporte y notificación de incidentes;
- enlazar este expediente desde el repositorio legal externo y guardar sus
  hashes, no secretos ni facturas en Git.

## 3 · Subprocesadores

Para `us-east-1`, la lista publicada identifica a **Amazon Data Services, Inc.**
como entidad de infraestructura en EE.UU. La lista también incluye entidades de
AWS que pueden intervenir en soporte iniciado por el cliente y mejora de
servicios. La relevancia exacta depende de región y servicios usados.

Condiciones operativas:

1. suscribirse a cambios de subprocesadores;
2. revisar el delta antes de vencer el aviso de 30 días publicado por AWS;
3. registrar objeción, aceptación o salida;
4. no enviar binarios a servicios distintos de los enumerados sin nueva evaluación;
5. conservar este registro y la evaluación PIPL durante al menos tres años.

## 4 · Registro de captura verificable

Contenido descargado por HTTPS desde dominios oficiales, sin autenticación y
hasheado sobre los bytes HTML recibidos:

| Fuente | `Last-Modified` observado | bytes | SHA-256 |
|---|---|---:|---|
| `https://aws.amazon.com/legal/aws-contracting-party/` | 2026-07-15 22:53:59 GMT | 199619 | `913ffdfd50bfb5663e041c4544e93b035107527af96fb8626ab082ec12edefa1` |
| `https://aws.amazon.com/service-terms/` | 2026-07-29 18:51:28 GMT | 1064867 | `dc4628317f7ff1596ce605789470fa6fe8de3f38d953f039e2363d65fd382fb2` |
| `https://aws.amazon.com/compliance/sub-processors/` | 2026-07-28 16:26:59 GMT | 413437 | `d7977e77577efe41c013bd72b50137d04a6b5d759221cfcc6504edbd102be5e5` |
| `https://aws.amazon.com/agreement/` | 2026-07-15 22:47:42 GMT | 389706 | `db0c42dfa773f1810fe518a8a011cf42c486566e4a2fc77a3f424cf917635272` |

La huella permite detectar cambios, pero el HTML público no es el receipt de la
cuenta. El receipt sigue **NO VERIFICABLE** hasta el alta real.

## 5 · Gate de contratación

- [ ] cuenta creada a nombre de la sociedad y país Venezuela;
- [ ] MFA raíz, contacto alterno y recuperación con dos responsables;
- [ ] Customer Agreement/Service Terms archivados con fecha de aceptación;
- [ ] DPA y lista de subprocesadores archivados en el repositorio legal externo;
- [ ] primera factura confirma parte contractual y titular;
- [ ] alertas de cambio y presupuesto confirmadas;
- [ ] revisión PIPL firmada;
- [ ] puntero y hashes del expediente externo registrados aquí.

El postflight automatizado exige seis artifacts externos con `kind`:
`customer-agreement`, `service-terms`, `dpa`, `subprocessors`,
`account-acceptance` y `billing-identity`. Compara sus SHA-256 con los archivos
reales y la cuenta STS antes de emitir el receipt de activación. La evidencia no
se mueve a Git.

Este documento es evidencia técnica y no asesoría legal.

## Fuentes oficiales

- [AWS Contracting Party](https://aws.amazon.com/legal/aws-contracting-party/)
- [AWS Service Terms](https://aws.amazon.com/service-terms/)
- [AWS DPA](https://docs.aws.amazon.com/whitepapers/latest/navigating-gdpr-compliance/aws-data-processing-addendum-dpa.html)
- [AWS Sub-processors](https://aws.amazon.com/compliance/sub-processors/)
- [AWS Customer Agreement](https://aws.amazon.com/agreement/)
