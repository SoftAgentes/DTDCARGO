# SDD-0224 · Allowlist cerrada del piloto no productivo de Gastos

| Campo | Valor |
|---|---|
| Estado | aprobada por el founder · 2026-07-31 |
| Riesgo | R3 · evidencia financiera, tenant y permanencia |
| Superficie | Studio ERP · `/studio/gastos` |
| Entidad piloto | `expenses` · recibo/foto del gasto |
| Entornos permitidos | local y proyecto efímero no productivo, con autorización separada |
| Entornos prohibidos | Supabase Cloud productivo, Vercel preview/Producción y cuenta externa real |
| SDD | [SDD-0224](spec.md) |
| ADR | [ADR-0001](../../architecture/decisions/0001-adjuntos-control-y-datos.md) |

## Regla de alcance

Esta lista es cerrada. Implementar el piloto requerirá autorización explícita
posterior. Durante la implementación:

- se pueden crear o modificar únicamente los archivos enumerados aquí;
- descubrir la necesidad de otro archivo obliga a detenerse y pedir ampliación;
- no se cambia móvil, Hub Documentos, Tracking, Portal, Bitácora, Reclamos,
  Inspecciones ni otros módulos;
- no se aplica ninguna migration a Supabase Cloud;
- no se crea cuenta B2/MinIO/S3 ni se configura Vercel;
- no se guardan secretos, PAT, `service_role`, tokens o credenciales en el repo;
- no se hace commit ni push hasta recibir `cerrar`;
- no se rediseña Gastos: el uploader será headless y reutilizará el drawer,
  tokens y componentes canónicos actuales.

## Resultado que debe demostrar

El piloto validará en un entorno desechable:

1. reserva idempotente y path generado por servidor;
2. subida TUS browser → Storage sin bytes por Vercel;
3. pausa/reanudación en 25 %, 50 % y 90 %;
4. reautorización tras token vencido sin duplicar documento ni versión;
5. Blob durable en IndexedDB sin descarte silencioso;
6. límites exactos de 8 MiB para foto y 25 MiB para documento;
7. comprobación de magic bytes y SHA-256 fuera del request de Vercel;
8. cuarentena ante tipo falso, archivo corrupto o scanner no disponible;
9. aislamiento negativo entre tenants y permisos de módulo;
10. nueva versión sin `upsert:true`;
11. soft-delete y restauración sin `Storage.remove()` interactivo;
12. auditoría durable e idempotencia con dos pestañas;
13. contrato de backup/restore con adaptador de prueba;
14. estado máximo `guardado` mientras no exista copia externa real verificada.

El piloto no puede declarar `protegido`: ese estado exige proveedor
independiente, Object Lock, checksum y restore drill autorizados por separado.

## Allowlist de dependencias y configuración

- `.env.example`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml` (overrides de seguridad requeridos por el audit)
- `playwright.config.ts`

Dependencias candidatas limitadas a:

- `@uppy/core`;
- `@uppy/tus`;
- `file-type`;
- `@aws-sdk/client-s3` únicamente para el adapter S3-compatible de prueba.

Agregar cualquier otra dependencia requiere ampliar esta allowlist. Las
variables de `.env.example` contienen solo nombres y valores seguros; nunca
secretos.

## Allowlist de migrations locales

Cada archivo tiene una responsabilidad y se prueba localmente. Crear el archivo
no autoriza aplicarlo en Cloud:

- `supabase/migrations/0306_expense_receipts_tenant_boundary.sql`
- `supabase/migrations/0307_documents_attachment_metadata.sql`
- `supabase/migrations/0308_document_upload_intents.sql`
- `supabase/migrations/0309_document_reserve_finalize_rpcs.sql`
- `supabase/migrations/0310_erp_attachments_bucket.sql`
- `supabase/migrations/0311_document_scan_outbox.sql`
- `supabase/migrations/0312_document_backup_outbox.sql`
- `supabase/migrations/0313_document_restore_retention.sql`
- `supabase/migrations/0314_expenses_document_adapter.sql`

`0315_documents_cloud_drift_repair.sql` queda expresamente fuera del piloto
porque corresponde a un gate Cloud separado.

## Allowlist de contratos SQL

- `supabase/tests/0306_expense_receipts_tenant_boundary.test.sql`
- `supabase/tests/0307_documents_attachment_metadata.test.sql`
- `supabase/tests/0308_document_upload_intents.test.sql`
- `supabase/tests/0309_document_reserve_finalize_rpcs.test.sql`
- `supabase/tests/0310_erp_attachments_bucket.test.sql`
- `supabase/tests/0311_document_scan_outbox.test.sql`
- `supabase/tests/0312_document_backup_outbox.test.sql`
- `supabase/tests/0313_document_restore_retention.test.sql`
- `supabase/tests/0314_expenses_document_adapter.test.sql`

Los contratos deben cubrir grants, RLS, tenant ajeno, paths, idempotencia,
versionado, legal hold, restore, auditoría y purga fail-closed.

## Allowlist del dominio común

- `lib/studio/attachments/types.ts`
- `lib/studio/attachments/policy.ts`
- `lib/studio/attachments/state-machine.ts`
- `lib/studio/attachments/storage-path.ts`
- `lib/studio/attachments/service.ts`
- `lib/studio/attachments/verification.ts`
- `lib/studio/attachments/backup.ts`
- `lib/studio/attachments/restore.ts`
- `lib/studio/attachments/pilot-gate.ts`

## Allowlist de tests del dominio

- `lib/studio/attachments/__tests__/policy.test.ts`
- `lib/studio/attachments/__tests__/state-machine.test.ts`
- `lib/studio/attachments/__tests__/storage-path.test.ts`
- `lib/studio/attachments/__tests__/service.test.ts`
- `lib/studio/attachments/__tests__/verification.test.ts`
- `lib/studio/attachments/__tests__/backup.test.ts`
- `lib/studio/attachments/__tests__/restore.test.ts`
- `lib/studio/attachments/__tests__/pilot-gate.test.ts`

## Allowlist del plano de control

- `app/api/studio/attachments/reserve/route.ts`
- `app/api/studio/attachments/[id]/reauthorize/route.ts`
- `app/api/studio/attachments/[id]/finalize/route.ts`
- `app/api/studio/attachments/[id]/download/route.ts`
- `app/api/studio/attachments/[id]/restore/route.ts`

El segmento dinámico se llama `[id]` en los cuatro routes porque Next.js no
permite nombres de slug distintos en rutas hermanas. Cada handler conserva la
semántica estricta de `intent_id` o `document_id` según la operación.

Los routes son finos. Autorización, tenant, estado e idempotencia viven en el
dominio/RPC; ningún route recibe el binario.

## Allowlist del uploader compartido

- `app/studio/_components/attachments/AttachmentUploader.tsx`
- `app/studio/_components/attachments/attachment-queue.ts`
- `app/studio/_components/attachments/useAttachmentUpload.ts`
- `app/studio/_components/attachments/__tests__/AttachmentUploader.test.tsx`
- `app/studio/_components/attachments/__tests__/attachment-queue.test.ts`
- `app/studio/_components/attachments/__tests__/useAttachmentUpload.test.tsx`

El componente debe reutilizar estilos existentes y ofrecer selector operable
por teclado. No se allowlistea ningún CSS, token, icono o componente visual
nuevo.

## Allowlist de integración con Gastos

- `app/studio/(app)/gastos/page.tsx`
- `app/studio/(app)/gastos/actions.ts`
- `app/studio/(app)/gastos/_components/GastosClient.tsx`
- `app/studio/(app)/gastos/_components/ExpenseDrawer.tsx`
- `lib/studio/expense-types.ts`
- `lib/studio/expense-queries.ts`
- `lib/i18n/es-VE/expenses.ts`
- `lib/i18n/zh-CN/expenses.ts`

Reglas del adapter:

- el flujo legacy sigue disponible con el gate apagado;
- el piloto está deshabilitado en `production` aunque una variable esté mal
  configurada;
- crear gasto y vincular documento usa intención/RPC; no recibe `File` en la
  Server Action;
- leer recibos históricos continúa usando `receipt_path`;
- los nuevos usan `document_id` sin mover el objeto anterior;
- editar o eliminar el gasto no elimina físicamente el adjunto.

## Allowlist de worker y simulacro

- `scripts/attachments-pilot-worker.mjs`
- `scripts/attachments-pilot-preflight.mjs`
- `scripts/attachments-pilot-restore-drill.mjs`
- `scripts/__tests__/attachments-pilot-preflight.test.mjs`

El worker se ejecuta fuera del request de Next.js y solo en entorno desechable.
Debe fallar cerrado si faltan scanner, target de backup o credenciales. El
preflight exige habilitación operacional explícita; en Producción también exige
el piloto, la confirmación y evidencia vigente. El restore drill compara SHA-256
byte a byte y no escribe en Producción.

No se incluye Docker Compose, cuenta externa ni infraestructura alojada. Si se
necesita uno de esos recursos, se solicita autorización y ampliación antes de
crearlo.

## Allowlist E2E

- `e2e/attachments-gastos-pilot.spec.ts`
- `e2e/attachments-gastos-pilot-network.spec.ts`

La evidencia mínima incluye:

- ningún request con bytes del archivo hacia `/api/*` ni host de Vercel;
- chunks exclusivamente hacia el host de Storage;
- dos pestañas, recarga, offline y reintento;
- progreso real y estados terminales veraces;
- Desktop Chrome, emulación Mobile Chrome y WebKit Mobile Safari;
- prueba manual separada en Android Chrome e iPhone Safari/PWA reales.

## Archivos expresamente excluidos

- `app/m/**`
- `app/portal/**`
- `app/p/**`
- `app/studio/(app)/documentos/**`
- `app/studio/(app)/tracking/**`
- `app/studio/(app)/bitacora/**`
- `app/studio/(app)/reclamos/**`
- `lib/studio/inspecciones/**`
- `public/sw.js`
- `public/m/sw.js`
- `vercel.json`
- cualquier migration distinta de `0306`–`0314` enumerada arriba;
- cualquier archivo `.env`, credencial o configuración real de proveedor.

## Orden obligatorio de implementación

1. crear worktree limpio y revalidar correlativos/ownership;
2. corregir frontera tenant y escribir su contrato SQL;
3. esquema aditivo e intenciones;
4. RPCs, bucket local y contratos RLS;
5. dominio puro y tests unitarios;
6. routes sin binario;
7. cola IndexedDB y uploader headless;
8. integrar Gastos detrás del gate;
9. worker de prueba y restore drill;
10. E2E Network y dispositivos;
11. ejecutar gates completos;
12. detenerse antes de Cloud, proveedor, commit o push.

## Gates de aceptación

Obligatorios antes de presentar el piloto:

- `pnpm typecheck`;
- `pnpm lint`;
- tests Vitest focalizados de todos los archivos allowlisteados;
- `node scripts/run-sql-tests.mjs`;
- E2E focalizados del piloto;
- `pnpm docs:check`;
- `pnpm governance:check`;
- `pnpm components:check`;
- `pnpm verify`;
- `git diff --check`;
- `/ui-check` sobre el drawer, sin rediseño;
- revisión de datos VE/China con estados `ENCONTRADO`, `CORRECTO` y
  `NO VERIFICABLE`;
- evidencia Network y restore drill adjuntas al handoff.

## Rollback del piloto

- apagar el gate y volver a lectura legacy;
- conservar filas, objetos, versiones, intenciones y auditoría;
- no ejecutar `DROP`, truncados ni `Storage.remove()`;
- revertir backfill solo por batch identificable y solo metadata;
- reparar mediante migration forward;
- no restaurar la policy cross-tenant vulnerable;
- dejar objetos no finalizados en cuarentena para reconciliación.

## Registro de autorización

- El founder aprobó explícitamente esta allowlist cerrada el 2026-07-31.
- La implementación debe ocurrir en el worktree limpio dedicado y mantener el
  feature gate apagado por defecto.
- Los permisos posteriores para commit, push, Cloud y Producción se registran
  y verifican como gates separados; no se infieren de esta aprobación.

## Ampliación AWS · 2026-08-03

El founder autorizó explícitamente implementar/probar EventBridge/SQS, preparar
la cuenta AWS, cerrar el expediente contractual/PIPL, ejecutar EICAR/Object
Lock/restore/RPO/RTO y activar únicamente después de evidencias verdes. Esta
ampliación no permite inventar credenciales, aceptar contratos en nombre de la
sociedad ni presentar pruebas locales como alojadas.

Archivos adicionales permitidos:

- `infra/attachments-aws/cloudformation.json`;
- `scripts/attachments-guardduty-adapter.mjs`;
- `scripts/attachments-aws-live-validation.mjs`;
- `scripts/__tests__/attachments-guardduty-adapter.test.mjs`;
- `scripts/__tests__/attachments-aws-infra.test.mjs`;
- `docs/legal/privacidad/aws-adjuntos-expediente-contractual.md`;
- `docs/legal/privacidad/pipl-aws-adjuntos.md`;
- documentación, configuración segura y lockfile ya enumerados en esta
  allowlist.

La activación permanece fail-closed mientras falte una cuenta autenticada,
receipt contractual, decisión PIPL, consentimiento cuando corresponda y receipt
del simulacro alojado.
