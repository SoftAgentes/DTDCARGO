---
sdd: "0508"
title: "El objeto de un documento se firma y se borra en el bucket que dice su fila"
status: in-progress
author: "Sam + Claude Opus 5.5 (Worker)"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: ["0049", "0060", "0146", "0224", "0411", "0500", "0506"]
confidencialidad: interno
---

# SDD-0508 — El objeto de un documento se firma y se borra en el bucket que dice su fila

## Contexto

La [SDD-0506](../0506-bitacora-adjuntos-entidad/spec.md) (migración 0473,
todavía no aplicada) devuelve la rama `bitacora_task` a
`document_entity_in_tenant()`. Cuando se aplique, la «Prueba de avance» de
Bitácora va a empezar a crear filas en `public.documents` con
`entity_type = 'bitacora_task'`. Su handoff lo dejó anotado como fuera de alcance
(§ FUERA DE ALCANCE DETECTADO, punto 1).

### Lo que hace el código hoy (leído el 2026-10-14 sobre `main` = `221c48f4`)

- `0307_documents_attachment_metadata.sql` agregó `documents.bucket_id text not
  null default 'documents'` y el índice único `(bucket_id, object_key)`.
- `registerTaskAttachmentAction` (`app/studio/(app)/bitacora/collab-actions.ts`)
  sube el binario al bucket `bitacora` e inserta la fila **sin `bucket_id`**: la
  columna toma `'documents'` y la fila dice un bucket donde el objeto no está.
- `deleteDocument` (`app/studio/(app)/documentos/actions.ts`) hace el soft-delete
  y después `storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path])`. Para un
  adjunto de Bitácora el objeto quedaría **huérfano** en `bitacora`.
  `deleteDocument` es una server action: aunque hoy ningún botón del hub la
  ofrece para un `bitacora_task` (`DocsPanel` solo se monta en clientes y
  embarques), cualquier sesión con permiso de Documentos la puede invocar con un
  id.
- `signDocumentUrl` recibe un `storagePath` y firma siempre en `documents`. El
  hub lista los `bitacora_task` y su «Historial» llama a esa función: el «Ver»
  de un adjunto de Bitácora no abre nada.
- El cron `bitacora-purge-orphans` nunca toca adjuntos de tarea, así que nada
  recogería ese huérfano.
- La galería de la tarea (`listTaskAttachmentsAction`) y su borrado
  (`deleteTaskAttachmentAction`) usan `BITACORA_BUCKET` fijo. Aciertan para lo
  que sube Bitácora, pero el tipo de entidad no decide el bucket: el hub
  (`uploadDocument`, `addDocumentVersion` y la RPC `add_document_version` de
  0116) acepta `bitacora_task` y guarda el objeto en `documents`, con el mismo
  formato de path `{tenant}/bitacora_task/{tarea}/{uuid}.{ext}`. Para esa fila
  la galería firma en el bucket equivocado y el borrado deja el huérfano en
  `documents`.

Hay tres buckets detrás de `documents`: `documents` (hub, default),
`bitacora` (Bitácora) y `erp-attachments` (adjuntos seguros de la
[SDD-0224](../0224-adjuntos-seguros-reanudables/spec.md), con su propio ciclo:
la descarga exige `scan_status = 'clean'`). El worker piloto
(`scripts/attachments-pilot-worker.mjs`) ya descarga con `document.bucket_id`.

## Decisiones

### La fila es la única fuente del bucket

`lib/studio/documents/object-bucket.ts` expone
`documentObjectBucket(row)`. Todo consumidor que firme o borre el
`storage_path` de una fila de `documents` resuelve el bucket con esa función.

- `bucket_id = 'documents'` → `documents`.
- `bucket_id = 'bitacora'` → `bitacora` **solo si** la fila es un
  `bitacora_task` y el path es de la carpeta de su propia tarea, en su propio
  tenant (`isValidTaskAttachmentPath`). El bucket `bitacora` también guarda los
  audios de las actas (`{tenant}/bitacora_meeting/…`): una fila forjada por
  PostgREST no alcanza un audio a través del hub.
- Cualquier otro valor, incluido `erp-attachments` → `null`: no se firma ni se
  borra nada. Firmar `erp-attachments` desde el hub saltaría el
  `scan_status = 'clean'` de `authorizeAttachmentDownload`; borrarlo se saltaría
  su retención. Hoy el hub tampoco lo toca (lo busca en `documents` y no lo
  encuentra), así que el efecto no cambia.

### Cambios en la app

1. `registerTaskAttachmentAction` envía `bucket_id: BITACORA_BUCKET`.
2. `deleteDocument` pide `bucket_id` y `tenant_id` y borra en el bucket
   resuelto; si no hay bucket, hace el soft-delete y no toca Storage.
3. `signDocumentUrl(documentId)`: recibe el **id** de la fila, no un path. Lee la
   fila (con la RLS de `documents` y `deleted_at is null`) y firma su
   `storage_path` en el bucket resuelto. `DocsPanel` y el «Historial» pasan
   `doc.id` / `v.id`. Deja de firmar paths arbitrarios que le mande el cliente;
   sigue sin candado de módulo y sigue en la DEUDA de
   `lib/studio/rbac-actions-guard.test.ts`, con el texto actualizado.
4. La galería y el borrado de la tarea usan el bucket de la fila. Para eso
   `listDocumentsByEntity`/`listAllDocuments` piden `bucket_id` y
   `DocumentRow` lo declara.

### La regla como propiedad

`object-bucket.test.ts` escanea todo `app/` y `lib/` (sin pruebas) que consulte
`.from("documents")` y falla si encuentra
`storage.from(CONSTANTE o "literal").remove/createSignedUrl(s)/download(… storage_path …)`.
Tiene control rojo (las tres formas del código anterior caen) y comprueba que
el escaneo encuentra a los consumidores conocidos, para no pasar en vacío. Una
subida recién hecha (`remove([storagePath])` del rollback) sigue pudiendo usar
la constante: el objeto es propio y su bucket se conoce.

### Base de datos: sin migración

- **Backfill: no aplica.** Hoy hay 0 filas `bitacora_task` en producción (dato
  de Sam; la 0506 midió 0 en Cloud) y no se pueden crear hasta aplicar la 0473,
  porque el trigger las rechaza. Si esta PR se despliega antes de aplicar la
  0473, ninguna fila nace mintiendo.
- **Restricción: no se agrega.** `bitacora_task ⇒ bucket bitacora` sería falsa:
  el hub guarda legítimamente un `bitacora_task` en `documents`. La inversa
  (`bucket bitacora ⇒ bitacora_task`) es válida, pero el resolvedor ya la exige
  en los únicos lugares que actúan sobre el objeto, y agregarla pide una
  migración con su gate de producción para un beneficio marginal. Queda como
  propuesta, no como decisión.

## Alcance

### Qué cambia

- Las filas nuevas de la «Prueba de avance» guardan `bucket_id = 'bitacora'`.
- Borrar un adjunto de Bitácora desde el hub borra su objeto en `bitacora`,
  igual que el borrado de la propia tarea.
- El «Ver» del hub (panel e «Historial») abre un adjunto de Bitácora.
- `signDocumentUrl` recibe un id de documento.

### Qué NO cambia

- Subidas del hub (`uploadDocument`, `addDocumentVersion`): siguen en
  `documents` con el default de la columna.
- La permanencia: soft-delete de la fila más borrado best-effort del objeto,
  como ya hacían el hub y Bitácora. Nada nuevo se purga.
- `erp-attachments` y su servicio, la RLS, las policies de Storage, el cron de
  huérfanos, la firma de `shipment_documents` (otra tabla, otro bucket).
- Ninguna migración ni fila.

### Orden de despliegue

**Esta PR debería desplegarse antes de aplicar la 0473.** Si la 0473 se aplica
primero y alguien sube un adjunto en ese intervalo, la fila nace con
`bucket_id = 'documents'` y la galería no la firma (el borrado la deja huérfana
en `bitacora`). Contingencia, solo en ese caso y con OK nominal de Sam:

```sql
-- Lectura (READ ONLY): ¿hay filas que mienten?
select count(*) from public.documents d
where d.entity_type = 'bitacora_task' and d.bucket_id = 'documents'
  and exists (select 1 from storage.objects o where o.bucket_id = 'bitacora' and o.name = d.storage_path)
  and not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = d.storage_path);

-- Corrección (mismo filtro):
update public.documents d set bucket_id = 'bitacora'
where d.entity_type = 'bitacora_task' and d.bucket_id = 'documents'
  and exists (select 1 from storage.objects o where o.bucket_id = 'bitacora' and o.name = d.storage_path)
  and not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = d.storage_path);
```

### Allowlist exacta

- `lib/studio/documents/object-bucket.ts` (nuevo)
- `lib/studio/documents/types.ts` (`DocumentRow.bucket_id`, comentario de `LINK_KIND`)
- `lib/studio/documents/queries.ts` (`bucket_id` en las columnas)
- `app/studio/(app)/documentos/actions.ts` (`deleteDocument`, `signDocumentUrl`)
- `app/studio/(app)/bitacora/collab-actions.ts` (registro, galería, borrado)
- `app/studio/_components/documents/DocsPanel.tsx` (el «Ver» pasa el id)
- `lib/studio/documents/__tests__/object-bucket.test.ts` (nuevo)
- `lib/studio/documents/__tests__/documents-double.ts` (nuevo)
- `app/studio/(app)/documentos/__tests__/object-bucket-actions.test.ts` (nuevo)
- `app/studio/(app)/bitacora/__tests__/attachment-bucket.test.ts` (nuevo)
- `lib/studio/documents/__tests__/queries.test.ts` y
  `app/studio/_components/documents/__tests__/DocsPanel.test.tsx` (fixture con `bucket_id`)
- `lib/studio/rbac-actions-guard.test.ts` (texto de la DEUDA de `signDocumentUrl`)
- `docs/specs/0508-documentos-bucket-bitacora/spec.md` y `docs/specs/README.md` (regenerado)
- `.agents/handoffs/0508-documentos-bucket-bitacora.md`

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| MP-01 (permanencia) | cumplimiento sin cambio de clase | El borrado sigue siendo soft-delete de la fila más borrado best-effort del objeto, el mismo que ya hacían `deleteDocument` y `deleteTaskAttachmentAction`. La SDD solo corrige el bucket. Que «Documentos y evidencia» pida P2/R2 sin purgar el binario es una brecha previa del hub, no de esta SDD. |
| AUD-01 (auditoría de mutaciones) | no aplica | No se agrega ni se quita ninguna mutación auditable; el evento de borrado de archivo sigue igual que antes. |
| SGE-00.01 (acción predecible) | cumplimiento | «Eliminar» un adjunto de Bitácora tiene ahora el mismo resultado desde el hub y desde la tarea. |
| BTN-01 | no aplica | Sin cambios de interfaz: el «Ver» y el «Eliminar» son los mismos botones. |

## Aceptación

1. **Resolvedor** (`object-bucket.test.ts`): `documents` → `documents` para
   cualquier entidad, incluido un `bitacora_task`; `bitacora` → `bitacora` para
   el path de su tarea; `null` para el audio de un acta, la carpeta de otra
   tarea u otro tenant, otra entidad, `entity_id` nulo, `..`,
   `erp-attachments` y valores desconocidos.
2. **Propiedad**: ningún consumidor de `documents` en `app/` o `lib/` firma o
   borra el `storage_path` de una fila con un bucket fijo; control rojo con el
   código anterior; el escaneo encuentra a los cuatro consumidores conocidos.
3. **Acciones del hub** (`object-bucket-actions.test.ts`): `deleteDocument`
   borra en `bitacora` para un adjunto de Bitácora y en `documents` para uno del
   hub; para `erp-attachments` y para una fila `bitacora` que apunta a un audio
   hace el soft-delete y no toca Storage; si el soft-delete falla o la fila ya
   está borrada, no toca Storage. `signDocumentUrl` firma en el bucket de la
   fila, no firma `erp-attachments`, devuelve `null` sin consultar ante un id
   inválido y `null` para una fila borrada o inexistente.
4. **Acciones de Bitácora** (`attachment-bucket.test.ts`): el registro guarda
   `bucket_id = 'bitacora'` (el doble aplica el default de 0307, así que
   olvidarlo deja la fila en `documents`); el rollback borra en `bitacora`; la
   galería y el borrado usan el bucket de la fila, incluida una versión del hub
   en `documents`; un bucket no manejado no se firma.
5. **Control rojo**: con las dos acciones como están en `main`, 12 de las 27
   pruebas nuevas caen, cada una en su aserción.
6. **Mutantes**: siete (columnas sin `bucket_id`, `deleteDocument` sin
   `bucket_id`, borrado de tarea sin `tenant_id`, resolvedor sin chequeo de
   entidad, resolvedor sin chequeo de carpeta, `signDocumentUrl` sin
   `deleted_at`, registro sin `bucket_id`); todos mueren.
7. **Después de desplegar y aplicar la 0473** (fuera de esta PR): subir una
   foto a una tarea de prueba, verla en la galería y en el «Historial» del hub,
   quitarla desde el hub, y leer que la fila quedó con `bucket_id = 'bitacora'`
   y `deleted_at`, y que el objeto ya no está en `bitacora`.

## Riesgos

- **Orden con la 0473.** Ver «Orden de despliegue». Es el único caso en el que
  una fila nace mintiendo, y tiene consulta de lectura y corrección escritas.
- **El doble no reproduce RLS ni Storage RLS.** El borrado en `bitacora` con el
  user client pasa por la policy `bitacora tenant delete storage` (0443), que
  exige editar Bitácora; la fila solo se pudo marcar borrada si la RLS de
  `documents` ya aceptó la misma decisión (`document_entity_authorized`
  `'bitacora_task'`, `'edit'`). El smoke del punto 7 lo cierra en el sistema real.
- **`signDocumentUrl` cambia de firma.** Un consumidor que pasara un path ahora
  recibe `null` (el id no es un UUID). El repo tiene dos llamadas, ambas en
  `DocsPanel`, actualizadas; `tsc` no lo distingue porque ambos son `string`.

## Fuera de alcance detectado

- Las specs 0049, 0060 y 0500 describen el `signDocumentUrl` anterior (por
  path). Son evidencia fechada; esta SDD es la que manda.
- `addDocumentVersion` sobre una cadena de `bitacora_task` guarda la versión
  nueva en `documents`. Ya no rompe nada (cada fila lleva su bucket), pero la
  galería de la tarea solo muestra las extensiones que acepta Bitácora.
