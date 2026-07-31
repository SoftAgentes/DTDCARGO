---
sdd: "0224"
title: "Adjuntos seguros, reanudables y recuperables"
status: approved
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0049", "0186", "0191"]
confidencialidad: interno
---

# SDD-0224 · Adjuntos seguros, reanudables y recuperables

## Estado y aprobación

Esta SDD documenta el norte técnico y los gates de un sistema transversal de
adjuntos. Sam (founder) la aprobó formalmente el 2026-07-31 después de la
revisión de arquitectura, Supabase, seguridad, privacidad, pruebas y gobernanza.

La aprobación fija decisiones y criterios de aceptación; no autoriza por sí
sola código, dependencias, buckets, migraciones, Supabase Cloud, un proveedor de
respaldo, Vercel, Producción, commit ni push.

La primera implementación, si se aprueba después, será un piloto no productivo
en Gastos con allowlist y autorización separadas.

## Problema confirmado

La auditoría read-only sobre `origin/main` en `eafec42e` y la consulta de
metadatos de Supabase Cloud identificaron estas brechas:

1. Documentos, Gastos y otros módulos reciben el binario en Server Actions o
   Route Handlers antes de enviarlo a Storage. El archivo atraviesa el runtime
   de Next.js/Vercel.
2. La policy de `expense-receipts` valida el usuario del segundo segmento del
   path, pero no que el primer segmento sea su tenant. Un cliente autenticado
   puede plantar un objeto bajo el namespace de otro tenant.
3. Hub, Tracking, Inspecciones, Reclamos, Bitácora y Gastos móvil combinan
   `deleted_at` con `Storage.remove()`. La fila parece recuperable, pero el
   objeto ya no existe.
4. Las colas móviles guardan base64 en `localStorage` y descartan el elemento
   más antiguo al alcanzar el límite o la cuota. POD incluye firma, documento
   de identidad, fotografía y geolocalización.
5. Los flujos revisados confían en MIME declarado. No existe una verificación
   transversal de magic bytes, poliglotas, malware ni SHA-256 del binario.
6. `public.documents` aporta tenant, relación polimórfica y versionado, pero no
   modela bucket, intención idempotente, análisis, cuarentena, respaldo,
   retención, legal hold, restauración ni auditoría atómica del ciclo completo.
7. No hay copia externa independiente, inmutabilidad demostrada ni simulacro de
   restauración verificable.
8. Las pruebas actuales mockean Storage, conservan límites anteriores y no
   prueban TUS real, aislamiento cross-tenant, checksum ni restauración.

## Objetivo

Construir un plano común de adjuntos que:

- mantenga `public.documents` como registro canónico de identidad y versiones;
- suba binarios directamente desde el navegador a Supabase Storage mediante
  TUS, sin hacer de Vercel el plano de datos;
- resista red intermitente, recargas y reintentos sin duplicar ni perder
  archivos silenciosamente;
- verifique contenido, integridad y malware antes de exponer un archivo;
- conserve historial, permita borrado lógico y restauración auditada;
- produzca una copia externa independiente e inmutable antes de declarar un
  archivo como protegido;
- migre los módulos gradualmente sin mover ni romper objetos históricos.

## Fuera de alcance

- rediseñar pantallas o cambiar el lenguaje visual del ERP;
- mover todos los objetos históricos en una sola operación;
- convertir la PWA en aplicación nativa;
- aplicar migraciones o modificar buckets desde esta SDD;
- seleccionar o contratar B2 u otro proveedor sin evaluación separada;
- fijar plazos legales que no hayan sido decididos por una persona autorizada;
- prometer borrado físico mientras existan retención, legal hold o respaldo
  pendiente.

## Decisiones aprobadas

### 1. Registro canónico

`public.documents` seguirá siendo la identidad común del adjunto y su cadena de
versiones. No se creará una tabla principal paralela `attachments`.

Las tablas especializadas mantendrán temporalmente sus relaciones y recibirán
un enlace gradual al documento canónico. El binario histórico permanece en su
bucket y path actuales.

`documents.status` conserva su significado documental de negocio. Los estados
de ingesta, análisis y respaldo serán campos ortogonales.

### 2. Plano de control y plano binario

Next.js será únicamente plano de control:

1. validar sesión, tenant, módulo, permiso, entidad, clase, tamaño, MIME
   declarado e idempotencia;
2. reservar intención, `document_id`, versión y object key exacto;
3. emitir una autorización de subida de vida corta;
4. finalizar de forma idempotente y consultar metadata confiable;
5. autorizar descarga, borrado lógico y restauración por `document_id`.

El navegador enviará el binario directamente al host de Supabase Storage con
TUS y chunks de 6 MiB. Se usará `upsert:false` y una ruta nueva por versión.

La autorización de subida es un bearer secret. Nunca se guarda en IndexedDB,
query strings, logs, analytics ni audit payloads. IndexedDB conserva el Blob,
la identidad local de la intención y el progreso necesario para reanudar.

### 3. Identidad del objeto

Para adjuntos v2 se aprueba un bucket privado separado, provisionalmente
`erp-attachments`, con keys construidos por servidor:

```text
{tenant_id}/{entity_type}/{entity_id}/{document_id}/{version_id}.{ext}
```

El nombre original vive solo en metadata y nunca controla el path. El cliente
no elige tenant, bucket, entity ID, document ID ni versión.

El bucket v2 evita ampliar las policies legacy y permite retirar escritura
directa amplia sin romper los objetos actuales. `public.documents` debe conocer
explícitamente `bucket_id` y `object_key` para indexar tanto buckets legacy como
el nuevo.

### 4. Límites y contenido

- fotografías: máximo 8 MiB;
- documentos financieros y operativos: máximo 25 MiB;
- audio y video conservan sus límites específicos hasta una SDD posterior;
- ZIP genérico no se habilita por defecto;
- HEIC/HEIF queda condicionado a normalización y scanner probado.

El tamaño y MIME declarados se validan antes de reservar, pero no son evidencia
de contenido. Un proceso confiable, fuera del request de Vercel, debe:

1. leer el objeto desde Storage;
2. comprobar magic bytes y estructura cuando aplique;
3. detectar tipos no permitidos y archivos poliglotas;
4. ejecutar análisis antimalware;
5. recomputar SHA-256 sobre el binario almacenado;
6. comparar tamaño y tipo con la intención;
7. marcar `guardado` o `cuarentena` mediante una RPC privilegiada.

Un hash calculado únicamente en el browser no prueba integridad frente a un
cliente malicioso.

### 5. Estados verdaderos

La máquina de estados propuesta es:

```text
pendiente_local -> autorizado -> subiendo -> verificando -> guardado
                                                     -> respaldando -> protegido
                                  \-> fallido
                                  \-> cuarentena
```

- `subiendo` expone bytes transferidos y tamaño total;
- llegar al 100 % TUS no significa `guardado` ni `protegido`;
- `guardado` exige verificación del objeto y auditoría durable;
- `protegido` exige copia externa y checksum confirmados;
- un error conserva el Blob o el objeto recuperable y explica el siguiente paso;
- reconectar nunca reinicia falsamente el progreso a cero.

### 6. Idempotencia y concurrencia

Cada intención tendrá una idempotency key única por tenant. Reservar, finalizar,
analizar y respaldar serán operaciones idempotentes.

Dos pestañas con la misma intención no crean dos documentos ni dos versiones.
Una nueva selección explícita crea otra intención y, si corresponde, una nueva
versión.

La llegada de un objeto sin finalización no autoriza su lectura. Permanece en
cuarentena y se reconcilia; no se elimina automáticamente.

### 7. Cola durable y dispositivos compartidos

La cola persistirá Blobs en IndexedDB, separada por tenant, usuario y sesión de
dispositivo. Debe solicitar persistencia cuando el navegador la ofrezca y
comprobar cuota antes de aceptar la captura.

Reglas:

- cero descarte silencioso;
- si no hay cuota, bloquear la nueva captura con recuperación explícita;
- logout revoca tokens y bloquea el acceso a la cola de la identidad anterior;
- una persona distinta no puede abrir ni enviar Blobs ajenos;
- no depender exclusivamente de Service Worker, Background Sync ni Golden
  Retriever para durabilidad de archivos de 8 o 25 MiB;
- el piloto debe probar cierre del navegador, suspensión y terminación por el
  sistema operativo en Chrome, Android e iPhone.

### 8. Versionado, borrado y restauración

- reemplazar siempre crea un objeto y versión nuevos;
- `is_current` cambia atómicamente;
- ninguna acción interactiva ejecuta `Storage.remove()`;
- soft-delete registra actor, fecha, motivo y correlation ID;
- restaurar valida permiso, tenant, retención, legal hold, integridad y objeto;
- una versión eliminada lógicamente sigue inaccesible por descarga normal;
- la purga física será un proceso posterior, gobernado y fail-closed;
- retención vigente, legal hold, backup incompleto, referencia activa o duda de
  clasificación bloquean la purga.

MP-D6 hace elegible un upload incompleto o no vinculado para P0 después de 30
días; no ordena una purga automática.

### 9. Auditoría

Reserva, finalización, versión, cuarentena, liberación, descarga, borrado lógico,
restauración, respaldo, hold y purga deben producir evidencia con tenant, actor,
entidad, resultado, motivo y correlation ID.

La mutación crítica y el evento de auditoría nacen en la misma transacción o en
un outbox durable reconciliable. La auditoría guarda IDs y hashes, no blobs,
tokens, object keys completos ni PII innecesaria.

### 10. Respaldo independiente

El destino debe tener cuenta, credenciales, MFA y privilegios de borrado
independientes de Supabase y Vercel. Debe soportar:

- versionado e inmutabilidad desde el primer PUT;
- no replicar eliminaciones como borrado de la copia protegida;
- SHA-256 end-to-end, inventario y reconciliación;
- legal hold y retención por versión;
- restauración a infraestructura nueva sin depender de credenciales de
  Supabase;
- exportación completa al terminar el contrato;
- logs de subida, cambio de retención, intento de borrado y restore.

Backblaze B2 es candidato, no decisión. Su retención Object Lock de hasta 3.000
días no cubre por sí sola el default de diez años de MP-D1; se requiere una
estrategia adicional demostrable o un proveedor equivalente.

Objetivos operativos aprobados para el diseño:

- RPO: copia externa confirmada en menos de 1 hora;
- RTO: restauración de evidencia crítica en menos de 4 horas.

## Seguridad y privacidad

### Amenazas bloqueantes

- path o metadata controlados por el cliente;
- escritura o lectura cross-tenant;
- bypass de permiso de módulo mediante PostgREST o Storage directo;
- bearer token filtrado o reutilizado;
- MIME falso, malware, poliglota o decompression bomb;
- finalización con objeto distinto al reservado;
- sobrescritura con `upsert:true`;
- eliminación antes de respaldo o durante legal hold;
- pérdida de Blob offline o exposición en dispositivo compartido;
- compromiso común de origen y copia externa;
- restore corrupto o de otra versión.

### Datos personales

Los adjuntos pueden contener identidad, firma, rostro, voz, cuentas financieras,
documentos aduaneros, direcciones y geolocalización. También incluyen titulares
que no son usuarios: receptor de una entrega, contacto de proveedor, firmante o
persona visible en una foto.

La réplica externa reproduce esas categorías. Antes de conectar un proveedor se
deben documentar finalidad, datos mínimos, país, región, contrato,
subcontratistas, acceso humano, cifrado, retención, borrado y respuesta a
incidentes.

Como existe tratamiento por el equipo propio en China, la evaluación debe cubrir
PIPL: datos sensibles, tercero, evaluación de impacto y mecanismo/consentimiento
separado para transferencia transfronteriza cuando corresponda. Esta SDD no es
asesoría legal ni declara cumplimiento.

## Migración gradual

### Fase 0 · documentación aprobada

- SDD y ADR aprobados el 2026-07-31;
- RPO y RTO fijados como objetivos de diseño;
- evaluar el proveedor externo;
- preparar allowlist exacta del piloto.

### Fase 1 · piloto no productivo de Gastos

- corregir primero la frontera cross-tenant de `expense-receipts`;
- esquema aditivo e intenciones;
- uploader TUS headless sin rediseño visual;
- cola IndexedDB sin descarte;
- verificación, checksum, cuarentena y respaldo de prueba;
- dual-read de Gastos; sin mover objetos históricos;
- feature flag apagado por defecto.

### Fase 2 · Gastos Studio y móvil

- misma reserva/finalización para ambas superficies;
- objeto nuevo por reemplazo;
- soft-delete y restore comunes;
- retirar `upsert:true` y eliminación física interactiva.

### Fase 3 · módulos internos

Documentos, Bitácora, Inspecciones, Reclamos y Tracking se incorporan por slices
independientes, cada uno con compatibilidad y tests propios.

### Fase 4 · portal y capabilities externas

Payment Proofs, Prealertas/proveedor y Portal se migran al final. Sus modelos de
autorización y acceso externo requieren threat model específico.

### Fase 5 · históricos

- inventario metadata-only y dry-run;
- backfill idempotente por `batch_id`;
- no mover ni eliminar binarios;
- reconciliar conteos, tamaño, referencias y checksum cuando sea posible;
- rollback solo de metadata creada por el batch.

## Migraciones candidatas

Los correlativos se revalidan contra `origin/main` antes de crear archivos. Cada
migration se autoriza y aplica por basename exacto, de una en una:

1. `0306_expense_receipts_tenant_boundary.sql`
2. `0307_documents_attachment_metadata.sql`
3. `0308_document_upload_intents.sql`
4. `0309_document_reserve_finalize_rpcs.sql`
5. `0310_erp_attachments_bucket.sql`
6. `0311_document_scan_outbox.sql`
7. `0312_document_backup_outbox.sql`
8. `0313_document_restore_retention.sql`
9. `0314_expenses_document_adapter.sql`
10. `0315_documents_cloud_drift_repair.sql`

No forman parte de la allowlist documental ni están autorizadas para creación o
aplicación.

## Rollback conceptual

- apagar feature flag y workers;
- volver el consumidor piloto a lectura legacy;
- conservar objetos, intenciones, filas y eventos ya creados;
- no ejecutar `DROP`, truncados ni `Storage.remove()`;
- corregir mediante migration forward explícita;
- mantener en cuarentena el objeto cuya finalización falle;
- revertir un backfill únicamente por `batch_id` y solo sobre metadata;
- nunca restaurar la policy cross-tenant vulnerable como rollback.

## Criterios de aceptación

### Unitarios

- límites 8 MiB y 25 MiB en `N-1`, `N` y `N+1`;
- magic bytes para tipos admitidos, extensión/MIME falsos y poliglotas;
- transiciones válidas e inválidas;
- idempotencia y conflicto entre dos pestañas;
- cuota, logout y cero descarte en IndexedDB.

### Integración

- TUS real interrumpido en 25 %, 50 % y 90 %;
- recarga, offline, reconexión y reanudación;
- token expirado y reautorización sin duplicado;
- finalización repetida con el mismo resultado;
- cuarentena, SHA-256 y copia externa;
- restore byte a byte con checksum idéntico.

### SQL/RLS

- tenant A no puede seleccionar, insertar, actualizar, eliminar ni firmar paths
  de tenant B;
- grants mínimos para `anon`, `authenticated`, operario y workers;
- una sola versión vigente por root;
- soft-delete/restore y legal hold;
- purga bloqueada ante duda;
- outboxes reclamables e idempotentes.

### E2E y dispositivos

- ningún byte del archivo viaja a `/api/*` ni al host de Vercel;
- los chunks llegan solo al host de Storage;
- dos pestañas no duplican;
- progreso visible y veraz durante caída y recuperación;
- Chrome desktop, Android Chrome e iPhone Safari/PWA;
- suspensión, bloqueo, cierre del navegador, kill del SO y cuota baja.

## Matriz de gobernanza

| Política | Clasificación del legado auditado | Evidencia exigida al piloto |
|---|---|---|
| SGE-00.02 | no conformidad | cero pérdida silenciosa en cola, error y reconexión |
| SGE-00.03 | no conformidad | clasificación MP-01 y fricción proporcional |
| SGE-00.04 | no conformidad | mutación crítica y auditoría durable |
| SGE-00.05 | no conformidad | tests negativos de tenant, rol, entidad y estado |
| SGE-00.07 | no conformidad | 100 % TUS no anuncia éxito durable |
| MP-01 v1.1 | no conformidad | versión, retención, restore, hold y purge fail-closed |
| AUD-01 v1.0 | no conformidad | eventos atómicos o outbox reconciliable |
| UPL-01 v1.0 | no conformidad | validación server-side, path exacto, retry sin duplicado |
| LOD-01 v1.0 | no conformidad | estados persistentes y recuperación |
| ERR-01 v1.0 | no conformidad | error sin token/path/PII y con siguiente paso |
| PRG-01 v1.0 | no conformidad | progreso basado en bytes y durabilidad real |

Estas no conformidades describen el sistema existente y son bloqueantes para
aprobar el futuro piloto, no para conservar esta SDD en estado `proposed`. La
clasificación del piloto requerirá evidencia ejecutada; esta documentación no
declara conforme el legado ni una implementación futura.

## Allowlist de la fase documental cerrada

- `docs/specs/0224-adjuntos-seguros-reanudables/spec.md`
- `docs/architecture/decisions/0001-adjuntos-control-y-datos.md`
- `docs/architecture/module-sdd-map.md`
- `docs/specs/README.md` — generado
- `docs/legal/privacidad/registro-tratamiento.md`
- `docs/legal/privacidad/mapa-de-borrado.md`
- `docs/legal/privacidad/evaluacion-proveedor-respaldo-externo.md`

La allowlist cerrada del siguiente gate vive en
[`pilot-gastos-allowlist.md`](pilot-gastos-allowlist.md). Prepararla no autoriza
su implementación.

## Gates siguientes

1. aprobación separada de la allowlist del piloto no productivo;
2. implementación y pruebas locales en worktree limpio;
3. evaluación del proveedor y transferencia VE/China;
4. autorización separada por cada migration Cloud;
5. autorización separada de cuenta/proveedor externo;
6. `cerrar` para commit y push.
