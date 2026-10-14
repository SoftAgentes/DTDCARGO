---
sdd: "0506"
title: "Los adjuntos de Bitácora vuelven a pasar la validación de entidad"
status: in-progress
author: "Sam + Claude Opus 5.5 (Worker)"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: ["0146", "0224", "0411", "0412", "0505"]
confidencialidad: interno
---

# SDD-0506 — Los adjuntos de Bitácora vuelven a pasar la validación de entidad

## Contexto

Observado el 2026-10-14, durante el corte al servidor propio
([SDD-0505](../0505-dockerizar-dtd-cargo-contabo/spec.md)): en el Studio,
Bitácora → editar una tarea → «Prueba de avance» → «Subir foto o documento»
falla con

> No se pudo registrar el adjunto: documento sobre entidad inexistente, de otro
> tipo o ajena al tenant: bitacora_task/&lt;id&gt;

aunque la tarea existe y es del mismo tenant. El archivo sí sube al bucket
`bitacora`. Lo que falla es el INSERT en `documents` que hace
`registerTaskAttachmentAction`, y la acción borra el objeto al recibir el error.

### Causa, medida

El trigger `documents_validate_entity_trg` (0097) llama a
`public.document_entity_in_tenant(p_type, p_id, p_tenant)`. Su `case p_type::text`
cubre shipment, invoice, supplier_bill, supplier_payment, journal_entry, client,
supplier, consolidation, booking y expense, pero no `bitacora_task`: cae en
`else ok := false`.

La rama existió. La [SDD-0146](../0146-bitacora/spec.md) la agregó en
`0215_bitacora_enums.sql` junto con el valor del enum. La
[SDD-0224](../0224-adjuntos-seguros-reanudables/spec.md) volvió a escribir la
función en `0314_expenses_document_adapter.sql` para sumar `expense`, partiendo
del CASE de 0097, y la rama de 0215 se perdió. Es una regresión de la 0314.

- `md5(prosrc)` de la función en Supabase Cloud: `fe0e86178dfd646dc7d58b46ef404949`.
  Lo midió Sam en Cloud y en el servidor propio; esta tarea lo releyó en el
  catálogo de Cloud el 2026-10-14. Es exactamente el md5 del cuerpo de la 0314
  en el repo (calculado sobre el archivo). Dueño `postgres`, DEFINER, STABLE,
  `search_path=""`, EXECUTE para `postgres`, `authenticated` y `service_role`.
- En Cloud hay 0 filas de `documents` con `entity_type = 'bitacora_task'` (medido
  por Sam). La subida nunca funcionó en producción.
- El enum y la autorización sí conocen el tipo: 0215 agregó el valor, y
  0443/0444 ([SDD-0411](../0411-bitacora-document-entity-rbac/spec.md),
  [SDD-0412](../0412-unlinked-document-entity-rbac/spec.md)) lo mapean al módulo
  `bitacora` en `document_entity_authorized`, que es lo que exigen las policies
  del bucket y el INSERT de `documents`.

### Los comentarios no tienen el mismo defecto

`comments_validate_entity()` llama a `comment_entity_in_tenant()`. Esa función se
definió por última vez en 0215, con la rama `bitacora_task` y el filtro de
tenant, y ningún archivo posterior la reescribe. El cuerpo vivo en Cloud
(leído el 2026-10-14) es el de 0215 sin sus dos comentarios de línea, que se
perdieron al aplicarla: md5 `473bd66fcd3a2ccc1fe83f0d1699b63a` contra
`86d37a438337bc91e2f44e204d2051d4` del archivo. La diferencia es solo de
comentarios; la lógica es la misma. Si alguna vez se escribe un preflight por md5
sobre esa función, hay que usar el valor vivo.

## Decisiones

### Una línea sobre el cuerpo de 0314, copiado verbatim

`0473_document_entity_bitacora_task.sql` hace `create or replace` con el cuerpo de
0314 (líneas 13-38) y una sola línea nueva antes del `else`:

```sql
when 'bitacora_task' then select exists(select 1 from public.bitacora_tasks where id=p_id and tenant_id=p_tenant) into ok;
```

Se conservan SECURITY DEFINER, STABLE, `search_path = ''` y la firma.
`create or replace` mantiene oid, dueño y ACL, y el archivo repite el
revoke/grant de 0209 para que se lea solo. El comentario de la función se
actualiza: el de 0215 seguía diciendo «+SDD-0146 bitacora_task» con la rama
ausente.

### Sin filtro de borrado lógico

`bitacora_tasks` no tiene `deleted_at` (0214): el ciclo de vida es `estado`, y
`authenticated` no tiene DELETE (`using (false)`). La rama filtra id y tenant,
igual que la de 0215. Una tarea `hecho` acepta adjuntos, como una `pendiente`. El
preflight aborta si la tabla llegara a tener `deleted_at`, porque entonces la
rama tendría que filtrarlo.

### Preflight por md5

La migración aborta sin cambiar nada si la función no tiene el cuerpo de 0314
(el medido en producción) ni el de la propia 0473, que así se puede re-aplicar.
También aborta si no es DEFINER/STABLE con `search_path` vacío, si el enum no
tiene `bitacora_task` o si `bitacora_tasks` no tiene `id` y `tenant_id`. El
postflight exige el cuerpo de 0473 por md5, la misma forma, y EXECUTE solo para
`authenticated` y `service_role`.

### La regresión como propiedad, no como consejo

El envoltorio de Vitest exige que **la última definición** de
`document_entity_in_tenant` en `supabase/migrations/` tenga una rama
`when '<valor>'` para cada valor del enum. Los valores se derivan del
`create type` de 0097 y de todos los `alter type … add value`. Si una migración
futura suma un valor sin rama, o reescribe la función desde una copia vieja como
hizo la 0314, el CI de calidad se pone rojo antes de llegar a producción.

### Sin cambios de app

`registerTaskAttachmentAction` ya inserta lo correcto. No se toca código de
`app/` ni de `lib/` salvo la prueba nueva.

## Alcance

### Qué cambia

- `document_entity_in_tenant()` acepta `('bitacora_task', id, tenant)` cuando la
  tarea existe en ese tenant.

### Qué NO cambia

- Las otras once ramas, `none`/null → true, y el rechazo de una tarea de otro
  tenant, inexistente o presentada con otro tipo.
- `documents_validate_entity()`, `comment_entity_in_tenant()`,
  `comments_validate_entity()`, las policies, la autorización por módulo y el
  bucket `bitacora`.
- Ninguna fila: sin DML ni backfill.

### Orden de despliegue

**Libre respecto de la PR.** No hay código nuevo que dependa de la migración:
hasta que se aplique, la subida sigue fallando como hoy, y después funciona con
la app ya desplegada. **Fusionar la PR no autoriza aplicarla.** Requiere el OK
nominal de Sam nombrando `0473_document_entity_bitacora_task`. Desde el
2026-10-14 producción es el Supabase self-hosted del servidor propio
([runbook](../../runbooks/servidor-contabo.md)), y su §4 dice que, mientras
[aplicar-migraciones-prod.md](../../runbooks/aplicar-migraciones-prod.md) no se
reescriba para el VPS, no se aplican migraciones allí.

### Aplicación (2026-10-14)

**APLICADA al servidor propio** el 2026-10-14 a las 01:44:06Z, con el OK nominal
de Sam en esta tarea: «ok, aplica la 0473_document_entity_bitacora_task en el
servidor». Sam la ordenó en el servidor sabiendo que el procedimiento del §4 no
existe todavía, y eso cuenta como la excepción explícita. Se hizo así:

- Lectura previa READ ONLY: cuerpo `fe0e8617…` de 0314, dueño `postgres`,
  DEFINER, STABLE, `search_path=""`, la ACL esperada, el enum con el valor,
  `bitacora_tasks` sin `deleted_at`, ledger de 478 filas sin 0473, 0 adjuntos de
  Bitácora y nadie esperando locks.
- Una sola transacción por `psql` como `postgres`, dentro del contenedor `db` del
  proyecto `dtd-cargo`: el archivo del commit `6e72a85b` y su fila del ledger
  (versión `20261014014406`, name `0473_document_entity_bitacora_task`, una
  sentencia con el archivo entero, md5 `e4db161f…` y 11078 bytes, igual al blob;
  `created_by` = `servidor-propio:psql:SDD-0506`). Preflight y postflight
  pasaron; 36 ms.
- Verificación READ ONLY: cuerpo `333626d3…`, misma forma y ACL, sin EXECUTE
  para `anon`, el trigger de `documents` y el helper de comentarios intactos,
  ledger de 479 filas. En la prueba funcional, agregada y sin mostrar filas, toda
  tarea existente se acepta con su tenant y ninguna con un tenant ajeno ni con un
  id inexistente.

Evidencia en el servidor: `/srv/ops/evidencias/apply-0473-dtd-cargo-20261014T0144Z/`
(scripts, salidas y `SHA256SUMS`). **No se aplicó en Supabase Cloud**, que queda
como red de seguridad del corte: si se volviera a Cloud, la subida fallaría allí
de nuevo hasta aplicarla. La espera se agregó y se retiró del baseline en esta
misma PR. La cabecera «NO APLICADA» del archivo no se corrige, porque el ledger
guarda su texto exacto.

### Allowlist exacta

- `supabase/migrations/0473_document_entity_bitacora_task.sql` (nuevo)
- `supabase/tests/0473_document_entity_bitacora_task.test.sql` (nuevo)
- `lib/studio/__tests__/document-entity-bitacora-task.migration.test.ts` (nuevo)
- `supabase/migrations-baseline.json` (espera de 0473 agregada y retirada al
  aplicarla: diff neto vacío contra main)
- `docs/specs/0506-bitacora-adjuntos-entidad/spec.md` y `docs/specs/README.md`
  (regenerado)
- `.agents/handoffs/0506-bitacora-adjuntos-entidad.md`

## Aceptación

1. **El contrato** (`0473_document_entity_bitacora_task.test.sql`, 48 aserciones)
   corre con el archivo real de la migración, aplicado dos veces, sobre un ANTES
   que es la copia verbatim de lo que corre en producción. Comprueba: las once
   ramas de 0314 (viva → true, de otro tenant → false, con `deleted_at` → false),
   `none`/null; la rama nueva (tarea del mismo tenant y tarea `hecho` → true;
   inexistente, de otro tenant y con el tipo cruzado → false); el camino de la
   app con `authenticated` sin grant sobre `bitacora_tasks` (INSERT aceptado;
   tarea ajena rechazada con `23514` y el mensaje exacto de 0097; UPDATE hacia
   una tarea ajena rechazado); el catálogo (mismo oid y dueño, DEFINER, STABLE,
   boolean, `search_path` vacío, EXECUTE solo para `authenticated` y
   `service_role`, `anon` recibe `42501`); el comentario, y que no se toca ninguna
   otra función de `public`.
2. **Control rojo**: sin la 0473 el contrato pasa las once ramas viejas y cae en
   «bitacora_task del mismo tenant se acepta». Medido en PGlite, en `postgres:17`
   y en `supabase/postgres:17.6.1.165`.
3. **El mismo contrato en PGlite**
   (`document-entity-bitacora-task.migration.test.ts`, 20 pruebas). Es la única
   cobertura de la migración en el CI de calidad. Incluye: copias del ANTES
   iguales a 0314, 0215, 0209, 0097 y 0210; 0473 = 0314 + la rama y nada más; el
   md5 de 0314 igual al medido en producción y el de 0473 igual a su cuerpo; la
   propiedad del enum completo; que ya no es una espera y que el archivo sigue
   siendo el que guarda el ledger (md5 y bytes); cuatro preflights que
   abortan (cuerpo de 0215, un espacio de más, `deleted_at`, enum sin el valor);
   un mutante del preflight sin md5 que deja pasar el drift; y **seis mutantes**
   coherentes (sin filtro de tenant, sin filtro de id, otra etiqueta, sin la rama
   `expense`, INVOKER, EXECUTE para `anon`), cada uno cayendo en su aserción.
4. **El gate de símbolos pendientes** sin rojos: la 0473 no crea símbolos nuevos.
5. **Aplicada en el servidor propio** con preflight, postflight, identidad del
   ledger y prueba funcional (ver «Aplicación»). **Falta el smoke en la UI**:
   subir una foto a una tarea de prueba, verla en la galería «Prueba de avance»
   y quitarla.

## Riesgos

- **El preflight por md5.** Si el cuerpo vivo en el servidor difiere del de
  0314, la migración aborta sin cambiar nada, que es lo deseado; hay que releerlo
  en el servidor antes de aplicar.
- **Lo que el fixture no cubre.** El contrato no reproduce RLS ni el guardia RBAC
  de `documents`. Por las policies de 0438, el INSERT exige
  `document_entity_authorized('bitacora_task', tenant, 'edit')`, la misma decisión
  que ya pasó la subida al bucket `bitacora`. El guardia
  `documents_entity_rbac_guard_trg` corre antes del trigger que hoy falla (orden
  alfabético), así que ya pasó en el intento de Sam. En INSERT no hay más triggers en
  `documents` (`documents_touch` es solo de UPDATE). El smoke del punto 5 lo
  cierra en el sistema real.

## Fuera de alcance detectado

- **`documents.bucket_id` miente para los adjuntos de Bitácora.** La acción no lo
  envía, así que la fila queda con el default `'documents'` (0307) aunque el
  objeto vive en `bitacora`. Hoy nadie lo lee para esas filas, y el hub ya sabe
  que no las firma (`lib/studio/documents/types.ts`, nota de SDD-0146). Pero el
  borrado desde el hub (`deleteDocument`, `app/studio/(app)/documentos/actions.ts`) intenta quitar el objeto del
  bucket `documents`, y en `bitacora` quedaría huérfano.
- **El runbook de aplicación para el VPS** (SDD-0505 Fase 4) bloquea la
  aplicación de esta migración y de cualquier otra en el servidor propio.
