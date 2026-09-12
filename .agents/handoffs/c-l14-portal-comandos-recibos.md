# L14 — Comandos, confirmación y recibos de reportes de pago del Portal (0420–0423)

Fecha: 2026-09-12. Task ID: `c-l14-portal-comandos-recibos`.
Owner / sesión escritora: `c-l14-portal-comandos-recibos-20260912` (Worker asignado por el Director; sin subagentes ni otras sesiones escritoras).
Estado de tarea: lista-para-revision. PR en borrador; release y aplicación de migraciones quedan fuera de esta tarea.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal en `main`, sin tocar).
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l14-portal-comandos-recibos`.
Rama: `codex/c-l14-portal-comandos-recibos`. Base: `origin/main` `42c8839e8e5ccad63e5bff8c05347b95fb720a9b`, sin merges posteriores.
Origen de solo lectura: `refs/dtd/pr/21` = `origin/codex/saneamiento-integral` = `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (PR #21, 2026-09-04). Base común con `main`: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
SDD: `docs/specs/0364-portal-payment-reports-tenant-boundary/spec.md` (`status: done` del origen), `docs/specs/0365-payment-report-command-safety/spec.md` y `docs/specs/0366-payment-report-historical-identity/spec.md` (`status: in-progress` del origen), cada una con nota de importación. Migraciones `0420_portal_payment_reports_tenant_boundary`, `0421_payment_report_commands`, `0422_payment_report_command_boundary` y `0423_payment_report_historical_identity` declaradas pendientes. Sin reserva de número: se conserva la numeración de origen. Las specs 0420–0423 de `main` (`structured-worker-internals`, etc.) son otra secuencia y no chocan con estas migraciones.
Permisos: commits selectivos; push de la rama a sí misma y PR en borrador contra `main`, autorizados por Sam. Prohibidos: merge, sacar la PR de borrador, deploy, aplicar migraciones, tocar el ruleset, borrar ramas o worktrees y leer filas de negocio.
Aceptación: L14 extraído desde #21 con SQL, contratos, specs, código y pruebas; lo que `main` agregó se conserva en cada archivo compartido; cuatro esperas con orden y párrafo de autorización; índice regenerado; `corepack pnpm verify` con veredicto por paso; handoff con orden de aplicación y locks.

## Contrato del encargo

- **Alcance asignado:** las cuatro migraciones y sus contratos en `supabase/tests/`; las tres specs; 14 rutas runtime/CSS y 7 pruebas de SDD-0365; `supabase/migrations-baseline.json`; `docs/specs/README.md` regenerado; este handoff.
- **Excluidos:** L07, L10, los 111 archivos declarados ajenos (accesibilidad, CSP, observabilidad), redefinir el principal de L18, `cutoff` y producción.
- **Dependencia:** L18 en `main` (PR #66): `getPortalClientPrincipal` en `lib/portal/portal-queries.ts:111`. No se redefine.
- **Ampliaciones sobre la allowlist literal, para decisión del Director:**
  1. `lib/portal/__tests__/portal-invoice-actions-principal-scope.test.ts`, recortado a los tres casos del reporte. El encargo lo permitía «si hace falta»: es la regresión del hunk de SDD-0397 adoptado en `reportar/actions.ts`.
  2. `supabase/pending-migration-symbol-declarations.json`, con dos declaraciones AMARILLO. No figuraba en la allowlist, pero la exigen el ADR `docs/architecture/decisions/0002-merge-semantico-registros-generados.md:131-132` («Cada PR migrate-first del bloque C agrega su declaración») y los precedentes L01–L06. Sin ella, `pending-migration-symbols` da ROJO con 6 símbolos y exit 1. Va en un commit propio (`6ca311e7`): revertirlo deja el ROJO, que bloquea la fusión por mecanismo.

## OBJETIVO ORIGINAL

Extraer el lote L14 del bloque C —comandos, confirmación y recibos de los reportes de pago del Portal— desde la PR #21 a esta rama, con su SQL, sus specs, su código y sus pruebas. Sobre `main` se integra sólo lo que pertenece a L14, y todo queda listo para revisión en una PR en borrador.

## COMPLETADO

- **Aislamiento.** Raíz y rama verificadas; `guard --owner` y `claim` PASÓ. Guard y rama se revalidaron antes de cada escritura en lote, de los commits y del push. El checkout principal no se tocó.
- **SQL y contratos**, importados por blob exacto (`git cat-file blob` del origen y `git hash-object` del archivo en la rama):

| Artefacto | Blob origen = blob en rama | Bytes |
|---|---|---|
| `supabase/migrations/0420_portal_payment_reports_tenant_boundary.sql` | `93a6902fedb80b6d6a6dd6d93f95ec08a030258f` | 4849 |
| `supabase/migrations/0421_payment_report_commands.sql` | `21e87dddb97b4329ce1e55233baf1702c6110270` | 22086 |
| `supabase/migrations/0422_payment_report_command_boundary.sql` | `12889f5a4c8003960f56580436a1d3438fefe1c8` | 8673 |
| `supabase/migrations/0423_payment_report_historical_identity.sql` | `45e714bcc1a59278649ad65e79be88d91f38805b` | 8612 |
| `supabase/tests/0420_portal_payment_reports_tenant_boundary.test.sql` | `17cb6e62b774d6435b987f491b66274d5c4b8e49` | 45205 |
| `supabase/tests/0421_payment_report_commands.test.sql` | `7c395353273d9526b470d4e0c36775f8799a8014` | 54376 |
| `supabase/tests/0422_payment_report_command_boundary.test.sql` | `e4c886f7b3a0b95ad66824bc82715afccc8e0b8f` | 36937 |
| `supabase/tests/0423_payment_report_historical_identity.test.sql` | `bcb13001e2aceffd4ec68448a6ecec93587ea9aa` | 40366 |
| `supabase/tests/0423_payment_report_historical_identity_cloud.test.sql` | `db69ceea9d670c600520db1bb9e51cf29bd47e33` | 460 |

- **Specs.** Contenido de origen más una nota fechada bajo el H1; quitando exactamente la nota se recupera el blob fuente:

| Spec | Blob final (bytes, líneas de nota) | Blob fuente sin la nota |
|---|---|---|
| 0364 | `5975e3f06b6fa3ca94b835cd4b83cb00995ec74b` (8932, 9) | `148fb5802beb56cfe7dc7c6994b10709b8732664` |
| 0365 | `6d186e37f19639c14c79a32ab52ab209a10aa13e` (36134, 15) | `d686b3ea040c3d01be7bcb795cf6a0533f5522ce` |
| 0366 | `db0e3104d56b09dbe7e45583c33ea1ed7fe862c5` (15829, 8) | `858f95641b9e24ebbf29d2fe823db276ab1edbd6` |

  Frontmatter, estados y casillas quedan intactos. La nota registra las migraciones pendientes, el orden MIGRATE-FIRST, el corte sobre `main` y los artefactos no importados.
- **Índice.** Regenerado con `node scripts/build-docs-index.mjs`: 441 specs. Sólo agrega 0364–0366 y las saca de «huecos».

### Corte por ruta, conflictos y solapamientos

Todas las rutas del allowlist que ya existían en `main` estaban **idénticas a la base común**, salvo dos que `main` cambió después (SDD-0441, `2ad97632`). Aun así, varias versiones de #21 mezclaban commits de otros SDD. El origen de cada hunk se fijó con `git log --full-history 2a2e81bf..ea9952a4 -- <ruta>`.

| Ruta | `main` frente a la base | Qué se tomó | Resolución |
|---|---|---|---|
| `app/portal/(app)/facturas/[code]/reportar/actions.ts` | igual | head de #21 `66eb9ca0`: SDD-0365 (`12ee7407`, `bcf111a8`) + hunk de SDD-0397 (`2d0628d0`) | Sin conflicto. El hunk de SDD-0397 sustituye la relectura admin de `clients.tenant_id` por el principal de L18, como dice la fila L14 del análisis: «reportar/actions importa y ejecuta getPortalClientPrincipal». `aceptar/` y su test quedan fuera. |
| `.../reportar/PaymentReportForm.tsx`, `.../facturas/[code]/page.tsx`, `.../_components/InvoicePaymentReports.tsx` | igual | #21 = `bcf111a8` | Sin conflicto. |
| `app/portal/_components/PortalPaymentConfirm.tsx` y `.module.css` | ausentes | #21 | Altas. |
| `app/studio/(app)/facturacion/payment-report-actions.ts` | igual | #21 = `bcf111a8` | Sin conflicto. |
| `app/studio/(app)/facturacion/[code]/page.tsx` | **cambió**: SDD-0441 retira `Badge.dot` | fusión a tres vías (`git merge-file --diff3`) | 0 conflictos. Blob final `cf7059ca26b73cb49f856935c56597cfab4fd9aa`; frente a #21 sólo difiere en la línea 164, sin `dot`. |
| `app/studio/(app)/facturacion/_components/StudioInvoicePaymentReports.tsx` | **cambió** (SDD-0441) | fusión a tres vías | 1 conflicto en el Badge (línea 123): se toma la expresión de cancelación de #21 (`neutral` / «Cancelado») sin `dot`. Blob final `1daf3329905bf22e9b4e30b630f7e94337990f50`; frente a #21 sólo difiere en `dot`. |
| `app/studio/_components/ui/ConfirmDialog.tsx` | igual | #21 = `bcf111a8` | Sin conflicto. Es un cambio compartido (44 archivos de `main` importan el componente): guards de Space sólo con `holdToConfirm`, reflow y scroll del panel, y `--danger-text`. |
| `lib/portal/payment-report-commands.ts` | ausente | #21 = `85912909` | Alta. |
| `lib/portal/payment-report-types.ts`, `lib/portal/payment-proof.ts` | igual | #21 | Sin conflicto. |
| `lib/portal/payment-report-queries.ts` | igual | **`bcf111a8`** (`63dbe421`) | Se excluye SDD-0390 (`08ec803d`: principal y tenant en `listMyInvoiceReports`). |
| `lib/portal/__tests__/payment-reports.test.ts` | igual | **`bcf111a8`** (`ce5de1c7`) | Se excluyen la aserción y el mock de SDD-0390. |
| `lib/portal/__tests__/payment-report-actions.test.ts` | ausente | #21 `f925bc0a` | Incluye los fixtures de identidad de SDD-0382 (`e7489096`), que calzan con el principal de L18. |
| `lib/portal/__tests__/payment-report-consumers.test.ts` | ausente | #21 `86a499c5` | Incluye los fixtures de SDD-0382 y el ajuste de SDD-0397, sin preflight de `clients`. |
| Tests `payment-proof-scope`, `payment-report-commands`, `payment-proof-retry` y `payment-report-ui` | ausentes | #21 | Altas. |
| `lib/portal/__tests__/portal-invoice-actions-principal-scope.test.ts` | ausente | **recorte** de #21 (`814ef869`), blob final `636d292a` | Sólo los tres casos del reporte: un principal inválido corta antes de construir admin; tenant y Shipping Mark se fijan sin releer `clients`; la cancelación exige principal antes del comando. Quedan fuera la aceptación legal y sus seis mocks. |
| `supabase/migrations-baseline.json` | `pendingBelowCutoff: {}` | — | Cuatro esperas nuevas; `$doc` y `cutoff: 238` intactos. |
| `supabase/pending-migration-symbol-declarations.json` | `degradations: []` | — | Dos declaraciones (ver abajo). |

Resultado: 19 rutas de código quedan idénticas a su origen (#21 o `bcf111a8`), 2 son fusiones y 1 es un recorte.

### Gate de símbolos: MIGRATE-FIRST declarado

Con las cuatro esperas, `node scripts/check-pending-migration-symbols.mjs` dio ROJO (exit 1) con seis símbolos nacidos sólo en 0421:
- las funciones `create_portal_payment_report`, `cancel_portal_payment_report` y `resolve_payment_report` (`lib/portal/payment-report-commands.ts:123-124`);
- las columnas `payment_reports.cancelled_at`, `cancelled_by` y `resolution_reason`.

0420 y 0422 sólo cambian policies y ACL, y 0423 redefine una función de 0195, así que no crean símbolos ausentes.

Se declararon dos AMARILLO:
- **`l14-payment-report-commands-pending-rpc`.** Sin 0421 la RPC da PGRST202 y el transporte devuelve resultado incierto: sin recibo, éxito, DML heredado ni `service_role` (`payment-report-commands.ts:141,146`). Alta, cancelación y resolución no declaran éxito (`reportar/actions.ts:89,127`, `payment-report-actions.ts:28`).
- **`l14-payment-report-columns-pending`.** El select de `REPORT_COLS` falla y las lecturas devuelven `null`, nunca una lista vacía (`payment-report-queries.ts:90,115`). Portal y Studio muestran el error sin controles de mutación (`InvoicePaymentReports.tsx:31`, `StudioInvoicePaymentReports.tsx:37`). El conteo también falla (`payment-report-queries.ts:141`), así que el alta corta con PAGO-CONSULTA **antes** de subir el comprobante (`reportar/actions.ts:76`).

**No es un degradado inocuo: sin 0421 los reportes de pago no operan.** La declaración lo dice y fija que la PR no se fusiona antes de aplicar y verificar 0420 y 0421.

El gate asocia columnas sólo por nombre. Por eso la declaración también lista como sitios «sin degradado», con evidencia anclada en su tabla:
- `cancelled_at` y `cancelled_by` de `dispatch_orders` (`0024_dispatch_core.sql`) y de `qr_print_orders` (`0027_qr_print_orders.sql`);
- `resolution_reason` de `expense_alerts` (`0075_expense_alerts.sql`).

Ver FUERA DE ALCANCE. Resultado final: `0 ROJO · 2 AMARILLO`, exit 0.

### Orden de aplicación y locks

La medición es local y efímera, no de producción: contenedor `dtd_l14_locks_566eb12d` (`postgres:17`, 17.11, con los stubs de plataforma del repo).
1. Se aplicaron las 418 migraciones de `main` sin L14 ni las sólo-ledger, hasta `0450_clients_aliado_mismo_tenant`, en 19 s.
2. Cada migración L14 se aplicó en su propia transacción, leyendo `pg_locks` antes del COMMIT.
3. Las cuatro aplicaron **encima de todo `main`**, que es el orden tardío real de producción.
4. `_tenant-isolation.assert.sql` pasó después.
5. El contenedor se retiró por nombre y no quedó ninguno.

| Paso | Migración | Qué hace | Requiere | Locks de relación retenidos hasta COMMIT | Timeouts | Compatibilidad |
|---|---|---|---|---|---|---|
| 1 | 0420 | Tres policies Portal de `payment_reports` por principal y tenant | 0080/0195/0230; inventario exacto de cinco policies | ACCESS EXCLUSIVE `payment_reports`; ACCESS SHARE `clients` y `client_users` | **ninguno propio** | Compatible con el código actual: el alta va por admin y la lectura propia se conserva. |
| 2 | 0421 | Columnas de cancelación y motivo con dos CHECK, recibos privados append-only, dos triggers, entidad de auditoría y tres comandos | bucket privado `payment-proofs`; auditoría 0267/0294 | ACCESS EXCLUSIVE `payment_reports` (los CHECK recorren la tabla); SHARE ROW EXCLUSIVE `tenants` (FK); ROW EXCLUSIVE `audit_entity_types` | `lock_timeout 5s`, `statement_timeout 30s` | Compatible con el código actual: los triggers sólo bloquean escribir las tres columnas nuevas (`0421:96-118`). |
| 3 | — | **Despliegue de esta PR** y smoke de alta, cancelación, confirmación, rechazo y replay | 0420 y 0421 aplicadas y verificadas | — | — | Antes de este paso el código nuevo no opera (MIGRATE-FIRST). |
| 4 | 0422 | Retira el DML API, sustituye cuatro policies de escritura por dos SELECT y revoca `confirm_payment_report` | huellas md5 de 0420 (`0422:68-85`); comandos y ACL de 0421 (`0422:41-57`) | ACCESS EXCLUSIVE `payment_reports`; ACCESS SHARE `clients`, `client_users` y `user_tenants` | 5s / 30s | **Rompe el código anterior**; revertir sólo la app no es rollback seguro. |
| 5 | 0423 | Reemplaza `payment_reports_validate_invoice()` para poder renombrar un Shipping Mark que tiene reportes sobre facturas archivadas | cuerpo de 0195 (md5 del repo o de Cloud), 0421 y 0422 (`0423:16-57`) | ACCESS SHARE `audit_entity_types` (preflight); ningún lock de tabla sobre `payment_reports` | 5s / 30s | SQL-only. |

Riesgos operativos:
- **0420 no fija `lock_timeout`.** Si la sesión de aplicación tampoco lo tiene y otra transacción retiene `payment_reports`, el ALTER POLICY espera sin tope y encola las lecturas que lleguen detrás.
- **El recorrido de los CHECK de 0421** cuesta según las filas de `payment_reports` en producción: NO VERIFICADO, no se leyeron filas. En el contenedor sintético cada migración tardó entre 267 y 290 ms.

### Revisión de datos personales (`revisar-datos-ve`, advisory)

Aplicada sobre los cambios de L14, con archivo y línea; no es asesoría legal. Resumen: 6 CORRECTO, 4 ENCONTRADO y 5 NO VERIFICABLE.

| Dato tocado por L14 | Qué es | Finalidad en el código | Quién lo ve | Retención |
|---|---|---|---|---|
| `payment_reports.amount`, `method`, `paid_at`, `note` y `proof_path` (columnas de 0195, sin cambios) | pago declarado por el cliente; `note` es texto libre de hasta 500 caracteres | conciliación (SDD-0134) | el cliente propio en Portal (`0420:42-52`); tras 0422, accounting/admin del tenant (`0422:102-112`) y lectura `service_role` (`0422:113-114`) | sin plazo en el código |
| `payment_reports.cancelled_at`, `cancelled_by` (`0421:41-43,52-55`) | fecha y actor de la cancelación | estado compensatorio irreversible | las mismas lecturas | `cancelled_by` no tiene FK a `auth.users`, para conservar la identidad histórica (`0421:52-53`) |
| `payment_reports.resolution_reason` (`0421:44,49-51`) | motivo libre de 4 a 500 caracteres al confirmar o rechazar | motivo financiero separado de la nota del cliente | cliente propio en Portal (`InvoicePaymentReports.tsx`, «Motivo:») y Studio | sin plazo |
| `payment_private.report_commands` (`0421:63-80`) | recibo: request_id, tenant, actor, reporte, verbo, `input_hash`, resultado mínimo y evento | idempotencia y constancia | ningún rol API (`0421:75-76,384-392`) | append-only (`0421:82-92`); FK `on delete restrict` a reporte y tenant (`0421:65,67`) |
| Eventos `payment_report_*` (`0421:326-336`) y `payment_report_markbox_updated` (`0423:139-147`) | actor, motivo y antes/después mínimos | AUD-01 | lectores del log de auditoría, sin cambio | sin plazo |
| Objetos `payment-proofs/<tenant>/<factura>/<reporte>/<id>.<ext>` (`payment-proof.ts:91-96`) | imagen o PDF del comprobante | evidencia del pago | URL firmada de hasta 300 s, acotada al path canónico (`payment-proof.ts:135-145`) | sin purga |

**CORRECTO**
1. Los recibos no guardan monto, nota ni comprobante (`0421:79-80,340-344`).
2. El resultado de aplicación tiene exactamente ocho claves (`payment-report-commands.ts:32,85-102`).
3. Los errores no exponen detalles SQL (`payment-report-commands.ts:38-50,136-146`).
4. Firmar el comprobante exige tenant, factura y reporte (`payment-proof.ts:141-145`).
5. No se sobrescribe ni se borra evidencia (`payment-proof.ts:105`, `upsert: false`).
6. El aviso al equipo no se reenvía en un replay (`reportar/actions.ts:92`).

**ENCONTRADO**
1. Hay dos textos libres obligatorios en su contexto que pueden contener datos personales: el motivo de cancelación, que va al evento de auditoría (`0421:329`), y el de resolución (`0421:44`). Su único límite es de 4 a 500 caracteres, sin guía de contenido (`InvoicePaymentReports.tsx:147`, `StudioInvoicePaymentReports.tsx:194`).
2. Conservación sin plazo (punto 5): `report_commands` es append-only y su FK bloquea el borrado físico del reporte y del tenant (`0421:65-67,82-92`). No hay purga ni plazo definidos.
3. `input_hash` es el SHA-256 del input normalizado, que incluye monto, nota y path (`0421:217-226`). No revela el dato, pero permite confirmar un valor conocido, y se conserva sin plazo.
4. Un comprobante subido cuyo comando no se confirma queda privado, sin vínculo ni disposición (`payment-proof.ts:105`). La spec lo remite a una revisión autorizada.

**NO VERIFICABLE**
1. La base de licitud y los plazos legales de conservación del expediente de pago.
2. Los contratos y la residencia de los proveedores de correo y Telegram, que ya reciben nombre, Shipping Mark y monto (`lib/studio/payment-report-notify.ts:31-33,70-86`; L14 no lo cambia).
3. La residencia y los backups de Storage.
4. Si el comprobante contiene datos de un pagador tercero, y la falta de aviso a ese titular (punto 12, preexistente desde SDD-0134).
5. El contenido real de notas, motivos y comprobantes: no se leyeron filas ni objetos.

### `/ui-check` manual

La skill no se puede invocar desde esta sesión. Se aplicó a mano la rúbrica de `.claude/commands/ui-check.md`, junto con `BRAND.md`, sobre los diffs de UI. No hubo navegador ni medición de píxeles; la evidencia de navegador de SDD-0365 es de la rama de origen.

```
UI-CHECK · L14 (Portal facturas/reportar, Studio facturación, ConfirmDialog, adaptador Portal)
Hallazgos (4):
1 (#1) [media] app/studio/(app)/facturacion/_components/StudioInvoicePaymentReports.tsx:37,185 — los
   errores usan role="alert" y color --danger-text, pero no llevan icono ni la escala tipográfica del
   resto del componente (heredan el tamaño del contenedor; las líneas vecinas fijan
   500 12px/1.5 var(--f-sans)). El estado se entiende por el texto, pero BRAND pide texto e icono.
   Corrección: icono de alerta del set de Studio y la misma fuente que las líneas vecinas. La línea 171
   (role="status") tampoco fija fuente.
2 [baja] app/portal/_components/PortalPaymentConfirm.module.css:13-19 — el adaptador redefine --r-* y
   --s-* en px, con los mismos valores de la escala del Norte. Riesgo de desfase si la escala cambia;
   alternativa: mapear a los tokens del Portal si existen.
3 [baja] app/portal/(app)/facturas/[code]/reportar/PaymentReportForm.tsx:92 — beforeunload nuevo al
   salir con datos. Es correcto para conservar el intento, pero cambia la navegación del Portal.
4 [baja] InvoicePaymentReports.tsx:36,139 y PaymentReportForm.tsx:273,325 — tamaños text-[12px]
   arbitrarios, consistentes con el Portal vigente.
Lo que está bien:
- sólo tokens var(--*) y ningún hex nuevo;
- --color-status-danger cambia a #f6929a en tema oscuro (app/globals.css:152);
- objetivos táctiles de 44 px (min-h-11, min-height 44px) y foco visible con outline de tinta;
- aria-invalid y aria-describedby por campo, y errores con role="alert" (PortalFieldError.tsx:53);
- confirmación canónica con consecuencia y motivo;
- tuteo sin voseo ni exclamaciones;
- sin anchos fijos nuevos (grid minmax(0,1fr)/auto).
Veredicto: OK con ajustes menores (no bloqueante).
```

### Gobernanza (AGENT-BRIEF)

- **SGE-00:** cumplimiento acotado a los comandos y consumidores probados: mismos verbos, sin éxito falso, conservación, auditoría atómica, idempotencia y errores seguros. La evidencia es local: vitest y contratos SQL de esta rama.
- **AUD-01 / AUD-02:** cumplimiento en los comandos de 0421. Los escritores heredados siguen como **no conformidad heredada** mientras no se aplique 0422.
- **MP-01:** cumplimiento en conservación: no hay purga, la cancelación conserva el original y la evidencia no se borra. La disposición de comprobantes sin vínculo sigue pendiente (ENCONTRADO 4).
- **BTN-01 / FRM-01 / ERR-01 / LOD-01:** cumplimiento acotado: confirmación con consecuencia y motivo, errores por campo, un resultado incierto distinto de un fallo y controles bloqueados durante `pending`.
- **A11Y-01:** cumplimiento acotado a lo verificable estáticamente y en jsdom. Teclado y reflow en navegador: NO VERIFICADO en esta importación.
- **CMP-01:** cumplimiento. Se reutiliza el `ConfirmDialog` canónico, sin API nueva ni promoción. Su ajuste compartido no muestra regresión en `ConfirmDialog.test.tsx`, `payment-report-ui.test.tsx` ni en los 17 archivos de `vitest related`, y `components:check` PASÓ.
- **SGE-00.12:** cumplimiento: no hubo merge, aplicación, deploy ni lectura productiva.
- **Excepciones:** ninguna aprobada. Las dos ampliaciones de allowlist están descritas arriba.

## VALIDACIÓN

Sin credenciales ni `.env` operativo. La evidencia es local; nada se corrió contra producción.

| Comprobación | Resultado / alcance |
|---|---|
| guard / claim | PASÓ; revalidado antes de escribir, de cada commit y del push |
| Identidad por blob | PASÓ: 9 SQL y 19 rutas de código iguales a su origen; las specs recuperan su blob al quitar la nota |
| Historia por archivo | PASÓ: `git log --full-history 2a2e81bf..ea9952a4` por ruta, sin commits ocultos |
| Fusiones a tres vías | PASÓ: 0 conflictos en la página Studio y 1 resuelto en el componente de reportes; ambos difieren de #21 sólo en `dot` |
| `corepack pnpm install --frozen-lockfile` | PASÓ en 28,1 s (pnpm 12.3.4); lockfile y `package.json` intactos |
| `corepack pnpm typecheck` | PASÓ (exit 0) |
| ESLint focal (21 archivos) | PASÓ (exit 0), incluido el import Portal → `ConfirmDialog` de Studio |
| vitest focal | PASÓ: 10 archivos / 405 pruebas (8 de L14, `ConfirmDialog.test.tsx` y `MobileErpClient.expense-void.test.tsx`) |
| `vitest related` sobre los 13 módulos runtime | PASÓ: 17 archivos / 440 pruebas |
| `node scripts/check-pending-migration-symbols.mjs` | Antes de declarar: ROJO, 6 símbolos, exit 1. Final: PASÓ, 0 ROJO · 2 AMARILLO |
| `docs:index` / `docs:check` / `sdd:check` / `governance:check` / `components:check` | PASÓ: 441 specs; numeración sin repetidos (sólo choques históricos exentos); 28 políticas; CMP-01 con 5 fuentes |
| `git diff --check` | PASÓ, también sobre cada commit (`--cached`) |
| Medición de locks y aplicación tardía | PASÓ en local: 418 migraciones de base hasta 0450 y luego 0420→0423, una por transacción; aislamiento multi-tenant PASÓ (detalle arriba) |
| `corepack pnpm verify` sobre `6ca311e7` | FALLÓ, exit 1. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` Corrieron 16 de 17 pasos y sólo e2e falló, por entorno; detalle abajo. |
| `/ui-check` | NO EJECUTADO como skill; checklist manual aplicado (arriba); navegador NO EJECUTADO |
| E2E autenticado y `migrations-applied` | NO DISPONIBLE: sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; no se consultó el ledger |
| Carreras reales con `scripts/test-payment-report-commands.mjs` | NO EJECUTADO: el script no se importó (fuera de la allowlist) |
| CI de la PR | Pendiente al cerrar este documento; se informa en el reporte final |

Detalle de verify sobre `6ca311e7` (inicio 16:56:43; sin cuelgue ni watchdog; árbol limpio al terminar):

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ: 41 pruebas, 0 fallos. |
| lint | PASÓ: 0 errores; 8 warnings en archivos fuera de L14 (ver FUERA DE ALCANCE). |
| rsc-boundary | PASÓ: 1601 módulos, sin cruces. |
| typecheck | PASÓ. |
| edge-functions | PASÓ: 4 funciones compilan. |
| test | PASÓ: 550 archivos / 7180 pruebas. |
| docs:check | PASÓ: índice sincronizado con 441 specs. |
| numbering | PASÓ: 441 specs y 440 migraciones sin números repetidos; sólo choques históricos exentos. |
| feature-constants | PASÓ: 5 banderas. |
| components:check | PASÓ: CMP-01 con 5 fuentes. |
| governance:check | PASÓ: 28 políticas. |
| migrations-applied | NO DISPONIBLE: SKIP por falta de `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; no se midió. |
| pending-migration-symbols | PASÓ: 0 ROJO · 2 AMARILLO declarados (`payment_reports.cancelled_at` y `create_portal_payment_report`). |
| sql-tests | PASÓ: 184 contratos con rollback total. Los cinco de L14, en verde: `0420_portal_payment_reports_tenant_boundary.test.sql`, `0421_payment_report_commands.test.sql`, `0422_payment_report_command_boundary.test.sql`, `0423_payment_report_historical_identity.test.sql` y `0423_payment_report_historical_identity_cloud.test.sql`. |
| schema-rebuild | PASÓ: 440 migraciones en inventario; 422 aplicadas desde cero, con 0420–0423 en orden numérico, y 18 sólo-ledger sin cambio de schema; aislamiento multi-tenant verificado en 219 tablas. |
| e2e | FALLÓ por entorno. Primera pasada: 152 PASÓ, 15 FALLÓ, 1 flaky (`auth.spec.ts:74`, chromium) y 18 omitidos, en 4,5 min. Reintento 1/1: 153 PASÓ, 15 FALLÓ y 18 omitidos, en 4,1 min. Los 15 son los ambientales conocidos: `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari. Ninguno toca facturas ni pagos. |
| build | PASÓ: Next.js 16.2.11, 160/160 páginas. Avisos esperables de getters públicos sin URL/clave Supabase; `tsconfig.json` restaurado. |

Recibos fuera de Git, en el scratchpad de la sesión: `verify.log`, `verify.sha`, `verify.exit`, `typecheck.log`, `eslint-focal.log`, `vitest-focal.log`, `vitest-related.log`, `l14-locks2.out`, `docs-*.log`, `pnpm-install.log` y las fusiones en `merge/`.

## COMMITS

- `b7e3ff940a98fa5eaa489c474eaa578feb4171cc`: SQL 0420–0423 y sus cinco contratos (9 archivos).
- `2972476294968b7fc7e59cfdfbf8eaac0890a3e3`: código y pruebas de SDD-0365, con el corte descrito (22 archivos).
- `97579264f49d04f37f37749eed36ace4a7a3e984`: tres specs con nota e índice (4 archivos).
- `3fe97c4e6f193bf8487fa7995d2f9ac51b0496c0`: cuatro esperas en el baseline.
- `6ca311e7e6efdceef9f218be3b8557830928971a`: declaraciones AMARILLO del gate de símbolos. Es el SHA de producto sobre el que corrió verify.
- Commit que contiene este documento: cierre del handoff, sólo documentación. El hash final va en la PR.

## PR / BRANCH

PR en borrador contra `main` desde `codex/c-l14-portal-comandos-recibos`, publicada con un único push de la rama a sí misma, sin force. La PR se abre después de este commit, así que su URL queda en el reporte al Director. Worktree conservado en la ruta de arriba. Sin merge, deploy ni aplicación de migraciones.

**Fusionar NO autoriza aplicar 0420, 0421, 0422 ni 0423. Y fusionar antes de aplicar 0420 y 0421 deja los reportes de pago sin operar en producción.**

## PENDIENTES DE ESTA TAREA

- Ninguno de implementación o preparación del lote.
- Revisión del Director: incluye las dos ampliaciones de allowlist y la decisión entre AMARILLO (conservar la declaración) o ROJO (revertir `6ca311e7`).
- Confirmar el CI «Calidad local sin secretos» sobre el SHA publicado.
- E2E autenticado y ledger productivo: NO DISPONIBLES. No autorizan copiar credenciales ni aplicar migraciones.

## FUERA DE ALCANCE DETECTADO

- **Falsos positivos del gate de símbolos.** `check-pending-migration-symbols.mjs` busca columnas sólo por nombre (`findSymbolReferences` usa `referenceName = symbol.name`). Eso obliga a declarar sitios de `dispatch_orders`, `qr_print_orders` y `expense_alerts` que no dependen de 0421. Además, cualquier cambio de línea en esos archivos invalidará la declaración (exit 2) aunque no toque pagos. Conviene una tarea de harness que asocie la columna a su relación.
- **SDD-0390 y SDD-0397 figuran `done` en `main` sin su código.** De 0390 no entró nada: ni el principal y tenant en `listMyInvoiceReports` y en eventos de envío, ni `portal-read-principal-scope.test.ts`. De 0397 sólo entró el hunk de `reportar/actions.ts`; `aceptar/actions.ts` sigue releyendo `clients.tenant_id` con admin. Hay riesgo de leer esas specs como cierre efectivo.
- **Evidencia de SDD-0365/0366 no importada.** No entraron `scripts/test-payment-report-commands.mjs` (carreras reales y advisors), `docs/audits/2026-09-02-codex-arranque-checklist.md`, `docs/audits/2026-09-02-codex-release-preflight.md` (enlace roto en 0366) ni los handoffs `2026-09-02-*`. Las notas de importación lo dicen.
- **0420 sin `lock_timeout`** (ver riesgos operativos). No se modificó, para conservar la identidad del archivo. Al aplicarla conviene una sesión con `lock_timeout` o una ventana de bajo tráfico.
- **Código muerto:** `getReportById` (`lib/portal/payment-report-queries.ts:156`) no tiene llamador.
- **Observabilidad de avisos:** SDD-0430 cambia `lib/studio/payment-report-notify.ts` en #21, pero no pertenece a L14.
- **Warnings de lint heredados, sin errores:** `app/portal/(app)/compras/nueva/NewPurchaseWizard.test.tsx` (4), `app/portal/(app)/compras/nueva/PurchaseStepDetalle.test.tsx` (2), `app/studio/(app)/crm/_components/KommoBoardView.tsx:124` y `app/studio/(app)/crm/_components/KommoClient.tsx:553`.
- **E2E sin configuración Supabase:** los 15 fallos ambientales conocidos, y en la primera pasada el flaky `auth.spec.ts:74` (chromium).

## HANDOFF AL DIRECTOR

- **Siguiente acción:**
  1. Revisar la PR, en especial el corte de `reportar/actions.ts` (hunk de SDD-0397), la exclusión de SDD-0390, las dos fusiones con SDD-0441 y el recorte del test.
  2. Decidir si se conserva la declaración AMARILLO o se revierte `6ca311e7` para dejar el ROJO como bloqueo.
  3. Correr `/ui-check` si lo consideras necesario.
- **Release** (fuera de esta tarea; cada paso con GO nominal de Sam y el runbook):
  1. Aplicar 0420 y 0421, y verificar objetos.
  2. Retirar sus esperas y las dos declaraciones en la rama.
  3. Fusionar y desplegar.
  4. Smoke de alta, cancelación, confirmación, rechazo y replay.
  5. Aplicar 0422 y verificar.
  6. Aplicar 0423 y verificar.

  Después de 0422 no se puede volver al código anterior sólo revirtiendo la app.
- **Integración:**
  - Con L07 (0414, `aceptar/`) y con futuras extracciones de SDD-0390/0397 se esperan solapamientos en `payment-report-queries.ts`, `payment-reports.test.ts` y `portal-invoice-actions-principal-scope.test.ts`.
  - Baseline y declaraciones se fusionan con el driver `dtd-generated-records`. Tras cualquier merge, `git diff origin/main -- supabase/migrations-baseline.json` debe mostrar sólo las cuatro esperas de L14.
- **Sesiones, procesos y contenedores:**
  - Sin subagentes ni sesiones consumidoras delegadas.
  - Sólo se usaron contenedores propios, con nombre aleatorio y etiqueta `dtd.task=c-l14-portal-comandos-recibos`, retirados por nombre.
  - No se tocaron los contenedores `supabase_*_dtd-pr28-auth…` ni el worktree o la rama `aliados-cadena-tenant` (PR #103).
- **Ownership:** se libera con `node scripts/harness-worktree.mjs release --owner c-l14-portal-comandos-recibos-20260912` después del push. Worktree y rama se conservan.
