---
sdd: "0508"
title: "El objeto de un documento se firma y se borra en el bucket que dice su fila"
status: done
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

La [SDD-0506](../0506-bitacora-adjuntos-entidad/spec.md) (migración 0473)
devuelve la rama `bitacora_task` a `document_entity_in_tenant()`. Con ella, la
«Prueba de avance» de Bitácora crea filas en `public.documents` con
`entity_type = 'bitacora_task'`. Su handoff lo dejó anotado como fuera de alcance
(§ FUERA DE ALCANCE DETECTADO, punto 1). La 0473 se aplicó en el servidor el
2026-10-14 a las 01:44:06Z, mientras esta SDD estaba en curso (ver «Base de
datos»).

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

### Base de datos: backfill 0474, sin restricción

- **Backfill: sí, en `0474_documents_bitacora_bucket_backfill.sql`.** Al
  escribir esta spec había 0 filas y la idea era desplegar esta PR antes de la
  0473. No pasó: la 0473 se aplicó en el servidor el 2026-10-14 a las
  01:44:06Z, y Sam hizo el smoke subiendo una foto hacia las 01:53Z, con la app
  todavía sin el fix. Conteo READ ONLY del 2026-10-14 a las 02:26:44Z, solo
  agregados, autorizado por Sam («Sí, solo el conteo»): **1 fila**
  `bitacora_task`, viva, con `bucket_id = 'documents'`, cuyo objeto existe en
  `bitacora` y no en `documents`. Sin corregirla, al desplegar esta PR esa foto
  dejaría de verse en la galería y su borrado dejaría el objeto huérfano. Sam
  eligió corregirla con una migración en esta PR («Migración 0474 en la PR»).
- **Qué hace la 0474.** Pasa `bucket_id` a `'bitacora'` solo en las filas
  `bitacora_task` cuyo objeto existe en `storage.objects` del bucket
  `bitacora` y **no** en el de `documents`: la existencia del objeto es la
  prueba, porque el tipo de entidad no basta. Incluye filas con `deleted_at`.
  No toca las que tienen el objeto en `documents`, en los dos buckets o en
  ninguno, ni otras entidades u otros buckets de origen. Sin DDL; no cambia
  `storage_path`, `object_key` ni Storage.
  - Preflight: `public.documents` con sus columnas, `storage.objects` y la rama
    `bitacora_task` de la 0473 en `document_entity_in_tenant`. El trigger
    `documents_validate_entity` revalida la entidad en el UPDATE; sin la rama,
    fallaría con un error críptico.
  - Postflight: no queda ninguna fila con el mismo filtro (la prueba compara
    los dos textos).
  - Se puede volver a correr. `lock_timeout` 5 s, `statement_timeout` 30 s.
  - El guardia RBAC de 0435/0438 solo actúa con `auth.role() =
    'authenticated'`; aplicada por `psql` como `postgres`, no interviene.
    `documents_touch` actualiza `updated_at` de las filas corregidas.
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
- Ningún objeto de Storage, ningún DDL. La única escritura en la base es el
  `bucket_id` de las filas que la 0474 demuestra mal ubicadas.

### Orden de despliegue

La 0473 ya está aplicada (01:44:06Z), así que hasta desplegar esta PR cada
subida nueva de Bitácora sigue naciendo con `bucket_id = 'documents'`. El orden
es:

1. Fusionar esta PR (el merge a `main` despliega la app con el fix).
2. Repetir el conteo READ ONLY en el servidor:
   ```sql
   select count(*) from public.documents d
   where d.entity_type = 'bitacora_task' and d.bucket_id = 'documents'
     and exists (select 1 from storage.objects o where o.bucket_id = 'bitacora' and o.name = d.storage_path)
     and not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = d.storage_path);
   ```
3. Con OK nominal de Sam, aplicar `0474_documents_bitacora_bucket_backfill`
   **de a una**, con el mismo procedimiento que la 0473 (`psql` en el
   contenedor, migración y ledger en una transacción, identidad contra el
   blob). El NOTICE dice cuántas filas cambió; el postflight aborta si queda
   alguna.

Entre el deploy y la aplicación, las filas que todavía mienten (hoy 1) no se
ven en la galería; nada se pierde: el objeto sigue en `bitacora`. Aplicar la
0474 **antes** del deploy no sirve: las subidas posteriores volverían a nacer
mal y la migración ya no las vería.

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
- `supabase/migrations/0474_documents_bitacora_bucket_backfill.sql` (nuevo, **no aplicada**)
- `supabase/tests/0474_documents_bitacora_bucket_backfill.test.sql` (nuevo)
- `lib/studio/__tests__/documents-bitacora-bucket-backfill.migration.test.ts` (nuevo)
- `supabase/migrations-baseline.json` (la espera de 0474)
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
7. **Contrato de la 0474** (`0474_documents_bitacora_bucket_backfill.test.sql`,
   10 aserciones) corre el archivo real de la migración **dos veces** sobre un
   fixture con el trigger `documents_validate_entity` de 0097. Comprueba:
   - se corrigen el adjunto medido en producción (A) y su variante borrada (B);
   - no se tocan la versión del hub en `documents` (C), el objeto en los dos
     buckets (D), el objeto en ninguno (E), otra entidad (F), una fila que ya
     decía `bitacora` (G) ni otro bucket de origen (H);
   - `storage_path` y `storage.objects` quedan intactos.

   En `postgres:17` con `psql` real: la primera corrida corrige 2 filas y la
   segunda 0. El control rojo (`-v apply_fix=false`) cae en A. Los preflights
   (`-v sin_rama=true`, `-v sin_storage=true`) abortan con su mensaje.
8. **El mismo contrato en PGlite**
   (`documents-bitacora-bucket-backfill.migration.test.ts`, 14 pruebas): verde,
   control rojo y los dos preflights. Además:
   - el postflight usa exactamente el filtro del UPDATE, comparado por texto;
   - el archivo no tiene DDL y fija los timeouts;
   - la espera está declarada con su orden y el OK nominal;
   - el mutante del preflight sin chequeo de rama muestra el error críptico del
     trigger;
   - cinco mutantes del filtro caen, cada uno en el caso que protege: sin «no
     está en `documents`» → D, sin «está en `bitacora`» → E, sin entidad → F,
     sin bucket de origen → H, sin los borrados → postflight.
9. **`schema-rebuild`** con la 0474 en la cadena: 470 migraciones sobre
   `postgres:17` y sobre `supabase/postgres:17.6.1.136` (la imagen del
   servidor), con aislamiento multi-tenant verificado.
10. **Después del deploy y de aplicar la 0474** (fuera de esta PR): el conteo
    READ ONLY da 0; la foto del smoke se ve en la galería y en el «Historial»
    del hub; borrar un adjunto de prueba desde el hub deja la fila con
    `deleted_at` y el objeto fuera de `bitacora`.

## Riesgos

- **El intervalo entre el deploy y la 0474.** Las filas que todavía mienten
  (hoy 1) no se ven en la galería hasta aplicar la migración; el objeto no se
  pierde. Borrar esa fila en ese intervalo la dejaría huérfana en `bitacora`:
  aplicar la 0474 apenas termine el deploy.
- **Filas borradas cuyo objeto ya no existe.** Si alguien borró un adjunto
  desde la galería antes del fix, su objeto salió de `bitacora` y la fila quedó
  con `bucket_id = 'documents'`. La 0474 no la toca (no puede probar dónde
  estaba). Es una fila borrada sin objeto; no tiene efecto.
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

## Aplicación de la 0474 (2026-10-14)

`status: done` desde que Sam hizo la prueba manual del criterio 10, el
2026-10-14 (abajo). Hasta entonces, la spec estuvo en `in-progress` a propósito.

### Merge y deploy

- PR #200, merge `ddf14c06` a las 03:31:43Z, con `--match-head-commit
  e611ae3f`. CI PASÓ (18m14s).
- Deploy a las 03:33:39Z.

### Aplicación en el servidor propio

- **OK nominal de Sam**, literal: «OK, aplica la
  0474_documents_bitacora_bucket_backfill en el servidor propio».
- **Lectura previa READ ONLY, 04:01:13Z.** Ledger de 479 filas, con la última
  en 0473 y sin 0474; la rama `bitacora_task` de la 0473 presente; 1 fila por
  corregir; 30 conexiones y 0 esperando locks.
- **Script.** Generado desde el blob `4f901d17` de `origin/main` `4328f4fa`:
  md5 `6f4bb32df48a6e8851c8ced80ca02361`, 5786 bytes. El md5 del script se
  verificó en el servidor (`55b519c003286b8f4dee9cc1907b9c07`) antes de
  correrlo.
- **Aplicación**, de 04:02:18.561Z a 04:02:18.794Z, en una transacción.
  Salida: `SET`, `SET`, `DO`, `DO` con «NOTICE: 0474: 1 fila(s) bitacora_task
  pasaron a bucket_id = bitacora», `DO`, `INSERT 0 1`, `COMMIT`; psql exit 0.
- **Verificación READ ONLY, 04:02:34Z.** Ledger de 480 filas;
  `20261014040218 · 0474_documents_bitacora_bucket_backfill`, `created_by =
  servidor-propio:psql:SDD-0508`, 1 sentencia, md5 igual al blob, 5786 bytes;
  0 filas por corregir; `bitacora_task` en `bitacora` 1 y en `documents` 0; 0
  esperando locks.
- **Evidencia** en `/srv/ops/evidencias/apply-0474-dtd-cargo-20261014T0402Z/`,
  con `SHA256SUMS`. Supabase Cloud no tiene la 0474.

### En el repo

- La espera de la 0474 sale de `pendingBelowCutoff` en
  `supabase/migrations-baseline.json` (PR de cierre
  `codex/cierres-noche-20261014`). `cutoff` y las demás esperas no cambian.
- El archivo de la migración no se edita, ni siquiera la cabecera «NO
  APLICADA»: el ledger guarda el archivo entero y editarlo rompería la
  identidad. En el criterio 8, la prueba «la espera está declarada con su orden
  y el OK nominal» pasa a afirmar que ya no hay espera y que el archivo sigue
  teniendo el md5 y los bytes del ledger.

### Criterio 10

- El conteo READ ONLY da 0: **cumplido** (verificación de las 04:02:34Z).
- La foto del smoke en la galería y en el «Historial» del hub, y borrar un
  adjunto de prueba desde el hub: **cumplido**. Lo probó Sam en producción el
  2026-10-14, después del deploy de `ddf14c06` y de aplicar la 0474. Su texto
  literal: «Ya probé la 0508, funciona la Bitácora». Queda registrado también en
  el comentario del Director en la PR #200.
