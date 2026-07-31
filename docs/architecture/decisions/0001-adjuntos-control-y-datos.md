# ADR-0001 · Plano de control y plano de datos para adjuntos

| Campo | Valor |
|---|---|
| Estado | aceptado |
| Fecha | 2026-07-31 |
| Decisores | Sam (founder) · aprobación formal 2026-07-31 |
| SDD | [SDD-0224](../../specs/0224-adjuntos-seguros-reanudables/spec.md) |
| Confidencialidad | interno |

## Contexto

DTD Cargo conserva adjuntos en varios buckets y tablas. Los flujos crecieron por
módulo y hoy difieren en límites, paths, autorización, versionado, borrado,
offline y auditoría.

La mayoría recibe el binario en Next.js antes de llamar a Storage. Algunos
borrados lógicos eliminan el objeto físico; las colas móviles pueden descartar
evidencia; `public.documents` no conoce el bucket ni el ciclo de protección; y
no existe respaldo externo independiente demostrado.

El sistema debe evolucionar sin una migración masiva y sin romper los links,
objetos o tablas especializadas existentes.

## Decisión

Separar tres responsabilidades:

1. **Plano de control:** Next.js y RPCs validan sesión, tenant, permiso, entidad,
   límites e idempotencia; reservan y finalizan metadata. No transportan el
   binario.
2. **Plano de datos:** el navegador transfiere el archivo directamente a un
   bucket privado de Supabase Storage mediante TUS y autorización exacta para un
   object key generado por servidor.
3. **Plano de protección:** un worker fuera del request de Vercel verifica
   contenido y SHA-256, decide cuarentena, y copia a un destino externo
   independiente antes de marcar el adjunto como protegido.

`public.documents` será el registro canónico de identidad y versiones. Se
extenderá de forma aditiva; no se creará un segundo DMS.

Las tablas legacy actuarán como adaptadores durante una migración gradual. Sus
objetos no se moverán. `documents` incorporará `bucket_id` y `object_key` para
referenciar tanto buckets actuales como el bucket v2.

## Flujo objetivo

```text
Browser/PWA
  ├─ reserve/finalize ──> Next.js control plane ──> RPC/Postgres
  ├─ TUS directo ──────> Supabase Storage
  └─ Blob durable ─────> IndexedDB local

Supabase Storage
  └─ worker de verificación ──> cuarentena o guardado
                                  └─ outbox ──> copia externa inmutable
                                                   └─ protegido
```

## Decisiones detalladas

### Registro canónico, no tabla paralela

Se conserva `documents.id`, `root_id`, `version_no`, `supersedes_id` e
`is_current`. Los estados técnicos no reutilizan `documents.status`, porque ese
campo expresa estado documental de negocio.

Se añadirán campos ortogonales para identidad del objeto, integridad, ingesta,
análisis, respaldo, borrado, restauración y retención.

### Bucket v2 separado

Se propone `erp-attachments` para archivos nuevos. La separación permite:

- no ampliar policies legacy;
- autorizar por object key exacto;
- retirar CRUD directo amplio sin romper consumidores actuales;
- mantener en cuarentena objetos no verificados;
- aplicar límites y tipos comunes al piloto.

El bucket es parte de una migration futura y no queda creado ni autorizado por
este ADR.

### Autorización por intención

El cliente envía metadata declarativa e idempotency key. El servidor resuelve
tenant, entidad, permiso y path. Una intención expira, pero su registro permite
reautorizar sin crear otra versión.

El token de subida no se persiste. Una reanudación solicita una autorización
nueva. El piloto debe demostrar si Supabase permite continuar el mismo upload
TUS después de renovar la firma; si no, debe reiniciar de forma controlada sin
duplicar la versión.

### Finalización no confiada

El cliente no decide tamaño real, MIME canónico, hash, estado de análisis ni
respaldo. Finalizar comprueba que el objeto reservado existe y transiciona a
`verificando`.

Solo el worker puede registrar el SHA-256 confiable y liberar de cuarentena.
Solo el worker de respaldo puede registrar una copia verificada.

### Borrado recuperable

Las acciones de usuario son lógicas y auditadas. La purga física queda separada,
con elegibilidad fail-closed. Un legal hold, retención vigente, respaldo
incompleto, referencia activa o estado desconocido impide purgar.

### Auditoría y outboxes

Las mutaciones críticas usan transacción con `entity_audit_log` o un outbox
durable. No se crea un log paralelo de adjuntos. Scan y backup usan outboxes
separados para reintentos e idempotencia.

## Alternativas descartadas

### Mantener Server Actions para transportar archivos

Descartada: conserva límites y fallos del runtime, dificulta reanudación y hace
de Vercel el plano de datos.

### Dar al browser CRUD amplio sobre cada bucket

Descartada: RLS por tenant no sustituye permiso de módulo, entidad, estado ni
capability exacta. Aumenta el impacto de un JWT o path filtrado.

### Reutilizar de inmediato el bucket `documents`

Descartada para el piloto: sus policies y consumidores actuales impedirían
endurecer el acceso sin una migración coordinada. El registro canónico sí se
reutiliza; el bucket no necesariamente.

### Crear una tabla principal `attachments`

Descartada: duplicaría identidad, versionado y relaciones ya presentes en
`public.documents`, generando dos fuentes de verdad.

### Depender solo de Uppy Golden Retriever o Background Sync

Descartada: no garantizan persistencia de Blobs de 8/25 MiB ante cierre, crash o
terminación del sistema operativo. La cola durable será explícita y verificable.

### Sobrescribir objetos con `upsert:true`

Descartada: destruye la versión binaria anterior y vuelve ambiguos los reintentos.

### Replicar al mismo proveedor o con las mismas credenciales

Descartada: no es una copia independiente frente a compromiso de cuenta,
ransomware o borrado administrativo.

## Consecuencias

### Positivas

- el binario evita Vercel;
- reanudación e idempotencia verificables;
- una identidad común sin mover históricos;
- versiones y borrado recuperable consistentes;
- estado visible que distingue transferencia, verificación y protección;
- menor blast radius por autorización exacta;
- restauración comprobable desde una cuenta independiente.

### Costos y complejidad

- nuevas tablas/columnas, RPCs y outboxes;
- un worker de análisis y otro de respaldo;
- cola IndexedDB con manejo de identidad, cuota y logout;
- operación de cuarentena y reconciliación;
- pruebas reales de Storage, TUS y dispositivos;
- evaluación contractual y transfronteriza del proveedor.

## Condiciones para implementar el ADR

- resolver el destino y runtime de los workers fuera de Vercel;
- demostrar reautorización/reanudación TUS;
- evaluar proveedor, Object Lock, región, contrato y PIPL;
- aprobar la [allowlist exacta del piloto Gastos](../../specs/0224-adjuntos-seguros-reanudables/pilot-gastos-allowlist.md);
- mantener Cloud, proveedor, commit y push como gates separados.

## Rollback

El rollout será aditivo y detrás de feature flag. Desactivar el piloto devuelve
el consumidor a lectura legacy sin borrar objetos ni metadata v2. Los cambios de
esquema se corrigen mediante migrations forward; no se destruyen evidencias para
volver al diseño anterior.
