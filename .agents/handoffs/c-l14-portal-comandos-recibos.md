# L14 — Comandos, confirmación y recibos de reportes de pago del Portal (0420–0423)

Fecha: 2026-09-12; ronda 2 el 2026-09-13. Task ID: `c-l14-portal-comandos-recibos`.
Owner / sesión escritora: `c-l14-portal-comandos-recibos-20260912` (Worker asignado por el Director; sin subagentes ni otras sesiones escritoras).
Estado de tarea: lista-para-revision. PR #104 en borrador; en la ronda 2, 0420 y 0421 ya están aplicadas en producción, así que fusionar y desplegar es el paso 3 del orden de L14; la aplicación de 0422 y 0423 queda fuera de esta tarea.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal en `main`, sin tocar).
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l14-portal-comandos-recibos`.
Rama: `codex/c-l14-portal-comandos-recibos`. Base: `origin/main` `42c8839e8e5ccad63e5bff8c05347b95fb720a9b` en la ronda 1; en la ronda 2 se incorporó `origin/main` tres veces por merge, `76797beb` (`81ea2c79`), `a9a12eed` (`e5e4b30c`) y `70ee6f458a328452a86c5728584ea612d75de3b1` (`3d12c90b`), sin rebase.
Origen de solo lectura: `refs/dtd/pr/21` = `origin/codex/saneamiento-integral` = `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (PR #21, 2026-09-04). Base común con `main`: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
SDD: `docs/specs/0364-portal-payment-reports-tenant-boundary/spec.md` (`status: done` del origen), `docs/specs/0365-payment-report-command-safety/spec.md` y `docs/specs/0366-payment-report-historical-identity/spec.md` (`status: in-progress` del origen), cada una con nota de importación. Migraciones `0420_portal_payment_reports_tenant_boundary` y `0421_payment_report_commands` aplicadas en producción el 2026-09-13 (ronda 2); `0422_payment_report_command_boundary` y `0423_payment_report_historical_identity` declaradas pendientes. Sin reserva de número: se conserva la numeración de origen. Las specs 0420–0423 de `main` (`structured-worker-internals`, etc.) son otra secuencia y no chocan con estas migraciones.
Permisos: commits selectivos; push de la rama a sí misma y PR en borrador contra `main`, autorizados por Sam. Prohibidos: merge, sacar la PR de borrador, deploy, aplicar migraciones, tocar el ruleset, borrar ramas o worktrees y leer filas de negocio.
Aceptación: L14 extraído desde #21 con SQL, contratos, specs, código y pruebas; lo que `main` agregó se conserva en cada archivo compartido; cuatro esperas con orden y párrafo de autorización; índice regenerado; `corepack pnpm verify` con veredicto por paso; handoff con orden de aplicación y locks.

> Lo que sigue describe la **ronda 1** tal como se cerró el 2026-09-12 (`93f1cbed`) y se conserva como evidencia fechada. Quedaron superados por la ronda 2: las esperas y las dos declaraciones de 0420 y 0421, que ya no existen porque las migraciones están aplicadas; el bloqueo MIGRATE-FIRST y la primera línea de la PR; las notas de importación de 0364, 0365 y 0366; la base de la rama, que ahora incluye `origin/main` `70ee6f45`; y la secuencia de release, cuyos pasos 1 y 2 ya ocurrieron. La sección «RONDA 2» manda sobre esos puntos.

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

> **Ronda 2 (2026-09-13):** 0420 y 0421 ya están aplicadas en producción, así que el orden migrate-first se cumplió y este bloqueo dejó de regir. Las dos declaraciones se retiraron (`04b99f0e`) y el gate da `0 ROJO · 0 AMARILLO`. Lo que sigue se conserva como evidencia fechada de lo que pasaría sin 0421.

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

## RONDA 2 — 2026-09-13 · 0420 y 0421 aplicadas y rama al día con `main`

Misma sesión y mismo owner que la ronda 1 (`c-l14-portal-comandos-recibos-20260912`), con el claim reclamado de nuevo. Antes de editar: `guard` OK, `git status --porcelain --untracked-files=all` vacío y `HEAD = 93f1cbed50797dc6c12353cce6530caf702a88d1`, la cabeza publicada de la PR #104. No se creó otra rama ni otro worktree; desde esta sesión no se ejecutó nada contra Supabase.

### Lo que cambió

- **0420 y 0421 dejaron de ser esperas.** Las aplicó el Director a producción el 2026-09-13, de a una y en ese orden, con autorización nominal de Sam, desde los archivos exactos de `93f1cbed`. Evidencia entregada por el Director (recibos fuera de Git en `…/scratchpad/prod-l14/`), copiada tal cual:
  - **0420:** ledger `20260913223809 | 1 sentencia | md5 b1d7b9429b84df5eaefbe384fb109c60 | 4849 bytes`. Preflight leído antes (catálogo, sin filas): las 5 policies de `payment_reports` con sus cmd/roles/permissive exactos, RLS activa, relacl `authenticated=arwdxtm`. Postflight: las 3 policies Portal con vínculo `client_users` + `auth.uid()` + tenant + Shipping Mark (INSERT sólo with_check con `reportado`), 0 policies con `get_portal_client_markbox`, relacl sin cambios, total 5 policies.
  - **0421:** `{"success": true}` al primer intento; ledger `20260913224126 | 1 sentencia | md5 6944ffddf61f4d20514ff78aad7f983f | 22086 bytes` (ledger total 452 tras las dos). Preflight previo (catálogo): schema, tabla, wrappers y columnas no existían; bucket privado `payment-proofs` presente; `append_audit_event` y `append_audit_event_v1` presentes. Postflight de catálogo, sin filas: `payment_reports` con las columnas nuevas `cancelled_at, cancelled_by, resolution_reason` y los CHECKs `payment_reports_cancellation_pair` y `payment_reports_resolution_reason_length`; schema `payment_private` con ACL `{postgres=UC, authenticated=U}`; tabla `payment_private.report_commands` con RLS activa y relacl `{postgres=arwdDxtm}`, `authenticated` y `service_role` sin SELECT/INSERT/UPDATE/DELETE; triggers `report_commands_immutable` y `payment_reports_command_fields` presentes; `payment_private.run_report_command(uuid,uuid,text,jsonb)` SECURITY DEFINER, owner postgres, `search_path=""`, ACL `{postgres=X, authenticated=X}`; wrappers `create_portal_payment_report`, `cancel_portal_payment_report` y `resolve_payment_report` SECURITY INVOKER, EXECUTE authenticated=true, anon=false, service_role=false; `audit_entity_types` con la fila `payment_report` activa.
  - **Advisors de seguridad de producción antes/después de 0420+0421**, comparados hallazgo por hallazgo. Antes: `rls_enabled_no_policy` INFO 21 · `extension_in_public` WARN 1 · `anon_security_definer_function_executable` WARN 22 · `authenticated_security_definer_function_executable` WARN 175. Después: idéntico salvo `rls_enabled_no_policy` INFO 22: entra `payment_private.report_commands` (tabla con RLS activa y sin policies). Es intencional: los recibos no tienen CRUD por API y sólo los escribe el comando definer. Ningún WARN cambió; `run_report_command` no aparece en los lints de definer porque vive en `payment_private`, fuera del schema expuesto.
  - Conector `claude.ai Supabase`, proyecto `xpfuzqombmjmxvprjgmi`, `apply_migration` con name exacto. No se leyó ninguna fila de negocio.
  - **Identidad comprobada aquí, en local:** `git show HEAD:supabase/migrations/0420_portal_payment_reports_tenant_boundary.sql | md5sum` da `b1d7b9429b84df5eaefbe384fb109c60` y `wc -c` da 4849; para 0421, `6944ffddf61f4d20514ff78aad7f983f` y 22086. Ambos con 0 CR; son los blobs `93a6902f` y `21e87ddd` que la rama lleva desde `b7e3ff94`, sin cambios. No se consultó producción desde esta sesión.
  - **Lo que esto cierra:** el bloqueo MIGRATE-FIRST de la ronda 1 dejó de regir. Las tres RPC y las tres columnas existen en la base antes de fusionar el código que las consume: `runPaymentReportCommand` ya no puede caer en `PGRST202`, y `listMyInvoiceReports`, `listInvoiceReports` y `countPendingReports` ya no reciben un rechazo por columna inexistente. La descripción de la ronda 1 de lo que pasaría sin 0421 sigue valiendo como evidencia fechada.
  - **Lo que NO cierra:** 0422 y 0423 siguen pendientes. Hasta aplicar 0422, `payment_reports` conserva el DML API y `confirm_payment_report` sigue ejecutable: los escritores heredados siguen siendo una no conformidad heredada (AUD-01), como en la ronda 1.
- **Registros.** `supabase/migrations-baseline.json` vuelve al blob de `main` (`0415` y `0414`, `cutoff: 238`, `$doc` intacto; 0451 salió con #110 y 0414 entró con #106) más las dos esperas vivas de L14, `0422_payment_report_command_boundary` y `0423_payment_report_historical_identity`, actualizadas: dicen que 0420 y 0421 quedaron aplicadas el 2026-09-13 con sus ledgers e identidad, qué dio su postflight, que el paso siguiente es desplegar esta PR (fusionarla incluida) y hacer el smoke de los comandos (alta, cancelación, confirmación y rechazo, con su replay), que 0422 se aplica sólo después de ese smoke y 0423 sólo después de 0422; conservan el orden de L14 con 0420 y 0421 marcadas como aplicadas, los locks medidos en la ronda 1 y el párrafo literal de autorización. La de 0422 aclara además que su preflight compara las huellas md5 exactas de las cinco policies, que no se leyeron en el postflight: si difieren en producción, aborta sin cambiar nada. `git diff origin/main -- supabase/migrations-baseline.json` son 4 líneas: la coma que gana la última espera de `main` (0414) y las dos esperas. `supabase/pending-migration-symbol-declarations.json` es byte a byte el de `main` (`degradations: []`) y ya no aparece en el diff de la PR. Gate: `0 ROJO · 0 AMARILLO`. Las 18 comprobaciones de `check-waits.mjs` PASÓ, repetidas después del segundo merge.
- **Notas de las specs.** Las de 0364 y 0365 pasan al patrón de una migración aplicada (`0336` en L01 ronda 2, `0353` en L10 ronda 2): fecha, ledger, identidad del archivo, preflight, postflight, advisors y registro en este handoff; en 0365 además el estado de 0422 (pendiente), el orden y el corte sobre `main` de la ronda 1. En la de 0366 sólo cambió lo que mencionaba a 0420/0421 como pendientes. Frontmatter intacto en las tres (`status` y `updated` del origen) y, al quitar exactamente la nota, cada spec vuelve a su blob de origen. El índice no cambia por esto.
- **Merge de `origin/main` `76797beb`** (commit `81ea2c79`, padres `93f1cbed` y `76797beb`), sin rebase ni force. Trae #103 (SDD-0461), #105 (L10: 0410 aplicada y 0415 pendiente), #107 (SDD-0462), #108 (SDD-0463) y #109 (registro de 0452 aplicada). Se forzó el driver de `main` con el override del punto 4 de la enmienda de retiro unilateral del ADR-0002 (`git -c merge.dtd-generated-records.driver="node \"<driver-de-main>\" %O %A %B %P" merge --no-commit --no-ff origin/main`), con el driver extraído de `origin/main:scripts/merge-generated-records.mjs` a un archivo fuera del repo; el de esta rama era idéntico (md5 `b4563696716d6893d48e619ec0e9eca4` en ambos, blob `4a5af4e5`), porque la rama nació después de las enmiendas del 2026-09-11.
  - `supabase/migrations-baseline.json`: `✓ merge semántico`; quedó el texto de `main` (0451 y 0415, en su orden) más las cuatro esperas de L14 al final, con `$doc` y `cutoff` iguales a `main`. La retirada de 0420 y 0421 va en el commit siguiente, `04b99f0e`.
  - `docs/specs/README.md`: `✓ merge semántico`; unión de las filas 0353, 0358, 0461, 0462 y 0463 de `main` con 0364–0366 de la rama, 446 specs y 17 huecos. `node scripts/build-docs-index.mjs` después no cambió un byte.
  - `supabase/pending-migration-symbol-declarations.json`: `main` no lo cambió en neto desde la base `42c8839e` (`degradations: []` en ambos), así que Git conservó el de esta rama sin ejecutar el driver.
  - **Conflictos: ninguno.** `main` cambió `lib/portal/portal-queries.ts` y `app/portal/(app)/facturas/[code]/pdf/route.ts` (SDD-0462/0463), que L14 no toca; los 32 archivos de `main` entraron tal cual. Los solapamientos previstos en la ronda 1 con L10 (baseline, declaraciones e índice) los resolvió el driver.
- **Segundo merge de `origin/main` `a9a12eed`** (commit `e5e4b30c`, padres `4d4a30d4` y `a9a12eed`), por aviso del Director después de la primera corrida de verify. Trae #110: registro de 0451 aplicada (sale de `pendingBelowCutoff`, spec 0461 actualizada y su handoff), sin producto. Mismo override del driver de `main`. `supabase/migrations-baseline.json`: `✓ merge semántico`; el retiro unilateral de 0451 gana y quedan 0415 (de `main`) más 0422 y 0423 (L14), con `$doc` y `cutoff` iguales a `main`. `docs/specs/README.md` no cambió y el script no cambió un byte. Sin conflictos.
- **Tercer merge de `origin/main` `70ee6f45`** (commit `3d12c90b`, padres `e5e4b30c` y `70ee6f45`), por aviso del Director después de la segunda corrida de verify. Trae #106 (L07): Fidelización, Conversaciones y Órdenes de venta por RPC, cinco specs (0350 y 0354–0357), la espera de 0414 y el índice regenerado. Mismo override del driver de `main`. `supabase/migrations-baseline.json`: `✓ merge semántico`; quedan 0415 y 0414 (de `main`) más 0422 y 0423 (L14), con `$doc` y `cutoff` iguales a `main`. `docs/specs/README.md`: `✓ merge semántico`; el script no cambió un byte (451 specs, 12 huecos). Sin conflictos: L14 no comparte archivos con L07, y los 29 archivos de `main` entraron tal cual.
- **Cuerpo de la PR.** La primera línea deja de ser «No fusionar antes de aplicar y verificar 0420 y 0421» y pasa a decir el estado real: 0420 y 0421 aplicadas; fusionar y desplegar es el paso 3 del orden de L14; 0422 después del smoke; 0423 después de 0422.

### Diff contra `origin/main` por archivo tras la ronda 2

`git diff --numstat origin/main...HEAD` sobre la cabeza de código `3d12c90b`: 36 archivos de producto más este handoff. Salvo el baseline, el índice y las tres specs, todos los blobs son los de la ronda 1 (`93f1cbed`).

| Archivo | Δ | Qué es |
|---|---|---|
| `supabase/migrations/0420_portal_payment_reports_tenant_boundary.sql` | +111 | Migración **aplicada en prod el 2026-09-13**; blob `93a6902f`, idéntico al ledger (md5 `b1d7b942…`, 4849 B). |
| `supabase/migrations/0421_payment_report_commands.sql` | +393 | Migración **aplicada en prod el 2026-09-13**; blob `21e87ddd`, idéntico al ledger (md5 `6944ffdd…`, 22086 B). |
| `supabase/migrations/0422_payment_report_command_boundary.sql` | +153 | **Pendiente**; blob `12889f5a`. |
| `supabase/migrations/0423_payment_report_historical_identity.sql` | +172 | **Pendiente**; blob `45e714bc`. |
| `supabase/tests/0420_…`, `0421_…`, `0422_…`, `0423_…` y `0423_…_cloud.test.sql` | +754, +790, +511, +595, +8 | Los cinco contratos, por blob exacto del origen. |
| `lib/portal/payment-report-commands.ts` | +148 | Transporte de los comandos (origen `85912909`). |
| `lib/portal/payment-report-queries.ts` | +56 −34 | Lecturas con `cancelled_at`/`cancelled_by`/`resolution_reason` y conteo fail-closed (versión `bcf111a8`, sin SDD-0390). |
| `lib/portal/payment-report-types.ts` | +6 −3 | Campos nuevos del modelo. |
| `lib/portal/payment-proof.ts` | +73 −26 | Path derivado del contenido, `upsert: false`, firma acotada. |
| `app/portal/(app)/facturas/[code]/reportar/actions.ts` | +106 −209 | Comandos de sesión con claves estables y hunk de SDD-0397 (principal de L18). |
| `app/portal/(app)/facturas/[code]/reportar/PaymentReportForm.tsx` | +149 −45 | Identidad estable, archivo conservado entre reintentos, resultado incierto. |
| `app/portal/(app)/facturas/[code]/page.tsx` | +1 −1 | Presenta la lectura fallida sin crash. |
| `app/portal/(app)/facturas/[code]/_components/InvoicePaymentReports.tsx` | +71 −43 | Cancelación con confirmación y motivo. |
| `app/portal/_components/PortalPaymentConfirm.tsx` y `.module.css` | +10, +50 | Adaptador Portal del `ConfirmDialog` canónico. |
| `app/studio/(app)/facturacion/payment-report-actions.ts` | +24 −51 | Resolución por comando con motivo y clave. |
| `app/studio/(app)/facturacion/[code]/page.tsx` | +8 −4 | Lectura fallida y firma acotada; conserva el retiro de `dot` (SDD-0441). |
| `app/studio/(app)/facturacion/_components/StudioInvoicePaymentReports.tsx` | +77 −92 | Confirmar/rechazar con `ConfirmDialog`; conserva el retiro de `dot`. |
| `app/studio/_components/ui/ConfirmDialog.tsx` | +7 −2 | Guards de Space, reflow y `--danger-text` (cambio compartido). |
| Tests `payment-report-actions`, `payment-proof-scope`, `payment-report-commands`, `payment-proof-retry`, `payment-report-consumers` y `payment-report-ui` | +469, +153, +434, +168, +328, +446 | Del origen. |
| `lib/portal/__tests__/payment-reports.test.ts` | +57 −6 | Versión `bcf111a8`. |
| `lib/portal/__tests__/portal-invoice-actions-principal-scope.test.ts` | +140 | Recorte de SDD-0397 a los tres casos del reporte. |
| `docs/specs/0364-…/spec.md`, `0365-…/spec.md` y `0366-…/spec.md` | +171, +611, +257 | Specs con las notas actualizadas en la ronda 2. |
| `docs/specs/README.md` | +5 −2 | Filas 0364–0366 y su retiro de los huecos; el conteo pasa a 451 con lo que trae `main`. |
| `supabase/migrations-baseline.json` | +3 −1 | Sólo las esperas de 0422 y 0423 y la coma que gana 0414; `cutoff`, `$doc`, 0415 y 0414 iguales a `main`. |
| `.agents/handoffs/c-l14-portal-comandos-recibos.md` | +302 en `93f1cbed`; crece con esta ronda | Este documento. |

**Ya no aparece** `supabase/pending-migration-symbol-declarations.json`: quedó igual a `main`. `git diff --check origin/main...HEAD` limpio.

### Validación de la ronda 2

Sobre `3d12c90b` (los tres merges y los dos commits de la ronda; el commit del handoff viene después y sólo agrega este documento). Dos corridas anteriores de verify, sobre `4d4a30d4` (antes del segundo merge) y `e5e4b30c` (antes del tercero), quedaron superadas y se resumen en la tabla. Recibos fuera de Git en `…/scratchpad/r2/`: `merge.log`, `merge2.log`, `merge3.log`, `README.driver.md`, `README.merge2.md`, `README.merge3.md`, `check-waits.log`, `-2.log` y `-3.log`, `pending-symbols.log`, `-2.log` y `-3.log`, `spec-notes.log`, `numstat.txt`, `numstat-3.txt`, `wait-r2.log`, `wait-r2c.log`, `verify-r2a-4d4a30d4.log`, `.meta` y `-clean.log`, `orphans-r2a.log`, `verify-r2b-e5e4b30c.log`, `.meta` y `-clean.log`, `e2e-diagnostico-r2b.log`, `orphans-r2b.log`, `verify-r2.log`, `verify-r2.meta`, `verify-r2-clean.log`, `e2e-diagnostico-r2.log` y `orphans-r2.log`; scripts `apply-registers.mjs`, `check-waits.mjs`, `apply-spec-notes.mjs`, `apply-handoff-r2.mjs`, `run-verify.sh` y `running-check.ps1`, y el driver extraído `dtd-merge-driver-main.mjs`. No se copiaron credenciales ni se tocó Supabase.

| Comprobación | Estado y evidencia |
|---|---|
| `claim` / `guard --owner` | PASÓ: claim reclamado de nuevo con el mismo owner; guard revalidado antes del merge, de cada commit, del verify y del push. Árbol limpio y `HEAD = 93f1cbed` al empezar |
| Identidad de 0420 y 0421 contra el ledger | PASÓ: md5 `b1d7b9429b84df5eaefbe384fb109c60` / 4849 bytes y `6944ffddf61f4d20514ff78aad7f983f` / 22086 bytes, 0 CR, sobre `HEAD:supabase/migrations/…`, iguales a los ledgers `20260913223809` y `20260913224126`. Comprobación local; no se consultó producción |
| Merges con el driver de `main` (override ADR-0002 §4) | PASÓ, tres veces: `76797beb` (`81ea2c79`), `a9a12eed` (`e5e4b30c`) y `70ee6f45` (`3d12c90b`), sin conflictos; baseline por unión semántica en los tres (`✓ merge semántico`) e índice en el primero y el tercero; índice regenerado sin cambios tras cada uno; las declaraciones no pasaron por el driver porque `main` no las cambió en neto |
| `git diff origin/main -- supabase/migrations-baseline.json` | PASÓ: sólo la coma de 0414 y las líneas de 0422 y 0423; `cutoff 238`, `$doc`, 0415 y 0414 iguales a `main` |
| `git diff origin/main -- supabase/pending-migration-symbol-declarations.json` | PASÓ: vacío, `degradations: []` |
| `check-waits.mjs` (18 comprobaciones, repetidas tras cada merge) | PASÓ: claves exactas y orden, esperas de `main` iguales por valor, 0420 y 0421 fuera, ledgers e identidad en 0422 y 0423, paso siguiente, orden de L14, párrafo literal de autorización, locks conservados, sin MIGRATE-FIRST, diff contra `main` y declaraciones vacías |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ tras cada merge: `0 ROJO · 0 AMARILLO declarado(s)` |
| `node scripts/build-docs-index.mjs` / `docs:check` | PASÓ: el índice del driver ya era el canónico tras cada merge (451 specs y 12 huecos al final); `docs:check` sincronizado tras las notas y tras cada merge |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos; sólo los choques históricos exentos |
| Notas de 0364, 0365 y 0366 | PASÓ: frontmatter igual al del origen `refs/dtd/pr/21`; sin la nota, cada spec recupera su blob de origen (`148fb580`, `d686b3ea` y `858f9564`) |
| `git diff --check` | PASÓ, en cada commit y en `origin/main...HEAD` |
| Chequeo previo a cada verify | PASÓ: el lanzador repite el chequeo (procesos de verify, e2e, dev server, vitest, contratos SQL o rebuild; puertos 3100–3799; contenedores `dtd_*`) y no arranca si hay algo. Antes de la corrida 2a la máquina estaba libre. Antes de la 2b encontró otro `scripts/verify.mjs` ajeno (PID 49528, luego Playwright y `next dev` en el puerto 3191) y esperó 20 min, hasta las 19:42:31, a que terminara. Antes de la definitiva encontró otro `scripts/verify.mjs` ajeno (PID 33912, luego vitest desde el worktree `harness-gate…` y Playwright con `next dev` en el puerto 3718) y esperó 21 min, de las 20:09:15 a las 20:30:27, a que terminara; después arrancó con la máquina libre (`wait-r2c.log`). |
| `corepack pnpm verify` sobre `4d4a30d4` (corrida 2a, superada por el segundo merge) | FALLÓ, exit 1, de las 18:56:04 a las 19:16:49 (−04:00), con HEAD `4d4a30d4` y árbol limpio al inicio y al final. 16 de 17 pasos: 15 PASÓ (test 552 archivos / 7204 pruebas; sql-tests 188 contratos; schema-rebuild 426 desde cero más 18 sólo-ledger; build OK), `migrations-applied` NO DISPONIBLE y `e2e` FALLÓ por entorno, sin cuelgue: dos pasadas con 152 PASÓ, 15 FALLÓ, 1 flaky (`smoke.spec.ts:150`, chromium, aprobada en su reintento) y 18 omitidos. Sin huérfanos después (`orphans-r2a.log`) |
| `corepack pnpm verify` sobre `e5e4b30c` (corrida 2b, superada por el tercer merge) | FALLÓ, exit 1, de las 19:42:33 a las 20:07:07, con HEAD `e5e4b30c` y árbol limpio al inicio y al final. 16 de 17 pasos: 15 PASÓ (mismas cifras que 2a), `migrations-applied` NO DISPONIBLE y `e2e` FALLÓ con motivo COLGADO/TIMEOUT en la primera pasada: imprimió 168 de 186 resultados (123 aprobadas, 15 omitidas y 30 renglones de fallo: los 14 ambientales conocidos con su reintento interno más un intento fallido de `smoke.spec.ts:150` en chromium y otro de `calculadora-semantic-colors.spec.ts:53` en mobile-chrome, cuyo reintento no volvió a fallar), se quedó en silencio tras `[mobile-safari] gastos-expense-void.spec.ts:99:7` y el watchdog terminó 25 procesos de su árbol (chrome-headless-shell ×15, node ×9, cmd ×1) con 0 sobrevivientes. Sin huérfanos después (`orphans-r2b.log`) |
| **`corepack pnpm verify` sobre `3d12c90b`** | **FALLÓ, exit 1**, de las 20:30:29 a las 21:01:20 (−04:00), con HEAD `3d12c90b` y árbol limpio al inicio y al final (`verify-r2.meta`). Corrieron de verdad 16 de 17 pasos: 15 PASÓ, `migrations-applied` NO DISPONIBLE y `e2e` FALLÓ, colgado en el reintento y cortado por el watchdog. Veredicto literal: `verify: 1 fallo(s) → e2e [COLGADO/TIMEOUT: sin salida durante 10 min; límite de inactividad 10 min (VERIFY_E2E_IDLE_MIN)] CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` Detalle por paso y diagnóstico del e2e abajo. No se absuelve ni se presenta como verde |
| `verify` · `migrations-applied` | NO DISPONIBLE: `[SKIP] migrations-applied: sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY`. El ledger real no se midió en este árbol; la evidencia de que 0420 y 0421 están aplicadas es la que entregó el Director, no una consulta hecha aquí. No autoriza copiar credenciales |
| `verify` · `e2e` | **FALLÓ con motivo COLGADO/TIMEOUT.** Primera pasada completa en 10,0 min: 152 PASÓ, 15 FALLÓ, 1 flaky y 18 omitidos; los 15 son los ambientales conocidos (`auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari) y el flaky es `auth.spec.ts:74` (chromium), aprobado en su reintento. El reintento automático 1/1 imprimió 138 de 186 resultados y se quedó 10 min en silencio; el watchdog de SDD-0454 cortó el paso. Como validación de acceso o de Supabase el paso es NO DISPONIBLE por falta de configuración, pero el corte no se absuelve: 48 resultados del reintento no se midieron. Ningún spec del e2e cubre las pantallas de L14. Detalle abajo |
| Procesos tras el verify | PASÓ: ninguno. El watchdog terminó 30 procesos de su propio árbol (raíz PID 44292; chrome-headless-shell ×18, node ×10, cmd ×1, Playwright ×1) con 0 sobrevivientes. Después (`orphans-r2.log`, 21:01): ningún proceso de verify, e2e, dev server, vitest, contratos SQL ni rebuild; sin puertos 3100–3799 en escucha; sin contenedores `dtd_*`. No hubo nada que detener. Lo mismo tras 2a y 2b |
| Producción / Supabase | NO EJECUTADO por límite del encargo: la aplicación de 0420 y 0421 la hizo el Director; desde esta sesión no se abrió conexión, no se aplicó nada y no se leyeron filas |
| `/ui-check` | NO EJECUTADO por no aplicar: la ronda 2 no toca UI; el checklist manual de la ronda 1 sigue vigente |

Detalle por paso de `corepack pnpm verify` sobre `3d12c90b` (`verify-r2.log`; Node 24.20.0, pnpm 12.3.4, Docker 29.7.2; 20:30:29 → 21:01:20 −04:00):

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 41 pruebas |
| lint | PASÓ, 0 errores y 8 advertencias en archivos que esta PR no toca: `NewPurchaseWizard.test.tsx` (4), `PurchaseStepDetalle.test.tsx` (2), `KommoBoardView.tsx:124` (1) y `KommoClient.tsx:553` (1); las mismas de la ronda 1 |
| rsc-boundary | PASÓ, 1601 módulos escaneados, sin cruces |
| typecheck | PASÓ |
| edge-functions | PASÓ, 4 funciones compilan |
| test | PASÓ, 555 archivos y 7213 pruebas (`main` sumó los tests de L10, SDD-0462/0463 y L07) |
| docs:check | PASÓ, 451 specs sincronizadas |
| numbering | PASÓ, 451 specs · 449 migraciones; conserva los choques históricos declarados |
| feature-constants | PASÓ, 5 banderas |
| components:check | PASÓ, CMP-01 con 5 fuentes |
| governance:check | PASÓ, 28 políticas |
| migrations-applied | NO DISPONIBLE: `[SKIP] migrations-applied: sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY`; no se midió el ledger real |
| pending-migration-symbols | PASÓ, `0 ROJO · 0 AMARILLO declarado(s)` |
| sql-tests | PASÓ, 193 contratos con rollback total, incluidos los cinco de L14 (`✓ 0420…`, `0421…`, `0422…`, `0423…` y `0423…_cloud`) y los que trae `main` desde la ronda 1 (0410, 0415, 0451, 0452, 0407 y 0411–0414) |
| schema-rebuild | PASÓ: inventario de 449; 431 migraciones desde cero (0420–0423 en orden numérico junto con las de `main`) y 18 sólo-ledger sin cambio de esquema; aislamiento multi-tenant en 219 tablas con 2 tenants |
| e2e | **FALLÓ: primera pasada completa con los fallos ambientales; reintento colgado y cortado por el watchdog.** Detalle en la lista siguiente |
| build | PASÓ: Next.js 16.2.11, 160 de 160 páginas estáticas; `[build] build de producción OK`; los avisos de `getPublic*` y `listPublishedPosts` por Supabase sin configurar salen durante la generación estática y no la detienen; `tsconfig.json` restaurado |

Diagnóstico del e2e, leído del log sin volver a correrlo (`e2e-diagnostico-r2.log`):
- **Arranque:** dev server propio en el puerto 3312; 186 pruebas con 8 workers.
- **Primera pasada, completa (10,0 min):** 152 aprobadas, 15 fallidas, 1 flaky y 18 omitidas. Los 15 fallos son los ambientales conocidos: `auth.spec.ts:21`, `:91`, `:98` y `:105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari, con `toBeVisible`/`toHaveURL` vencidos a 5 s porque el WebServer no puede crear el cliente Supabase sin URL ni clave (`proxy.ts:67`, 179 apariciones en el paso). El flaky es `[chromium] auth.spec.ts:74:7` («un token inválido renderiza el mismo error las dos veces»), aprobado en su reintento; en la ronda 1 también fue flaky en la primera pasada.
- **Reintento 1/1, colgado:** imprimió 138 de 186 resultados (105 aprobadas, 21 renglones de fallo y 12 omitidas; chromium y mobile-chrome completos, mobile-safari sin empezar). El último fue `[mobile-chrome] smoke.spec.ts:97:7 › las rutas viejas de calc/estimación redirigen (301)`, aprobado en 10,4 s, y después 10 min de silencio. Los 21 renglones de fallo son los 10 ambientales de chromium y mobile-chrome con su reintento interno más un intento fallido de `auth.spec.ts:74` (chromium), como en la primera pasada.
- **Dónde se colgó:** tras el resultado 138, con mobile-safari por empezar. En la corrida 2b (`e2e-diagnostico-r2b.log`) el cuelgue fue en la primera pasada, tras `[mobile-safari] gastos-expense-void.spec.ts:99:7`, el mismo punto que registró L10 en dos corridas. El reporter imprime cada prueba al terminar, así que el log no nombra la que quedó en curso; no se infiere causa raíz y el harness no se modificó.
- **Corte:** `watchdog: raíz PID 44292; 30 proceso(s) del árbol propio terminados (chrome-headless-shell.exe×18, node.exe×10, cmd.exe×1, Playwright.exe×1); sobrevivientes: 0.`
- **Relación con L14:** ningún spec de `e2e/` visita `/portal/facturas/*` ni `/studio/facturacion/*`. Los únicos que nombran pagos o facturas son `global-search.spec.ts:68` (la faceta «Pagos» del buscador, Tier 3 con seed, omitida en los tres navegadores) y un comentario en `sin-scroll-horizontal.spec.ts:56`; en el log del paso no hay otras menciones fuera de la tabla del build. Las pantallas de L14 exigen sesión y no están cubiertas por el e2e sin Supabase; su evidencia son los 405 tests focales de vitest y los 17 archivos de `vitest related` de la ronda 1, que corren dentro del paso `test` (7213 pruebas).

### Secuencia de release, actualizada

1. **0420 y 0421: hecho.** Aplicadas el 2026-09-13 (ledgers `20260913223809` y `20260913224126`); esperas y declaraciones retiradas en esta rama.
2. **Fusionar (Director) y desplegar esta PR.** Smoke con cuentas reales, por Sam o alguien del equipo: en el Portal, reportar un pago con comprobante (queda «Reporte registrado» y el reporte aparece en la factura), cancelarlo con motivo (queda «Cancelado» y el comprobante sigue en el historial); en Studio, confirmar un reporte con motivo (el saldo de la factura sube) y rechazar otro (el saldo no cambia); en ambos, repetir la misma operación con la misma clave devuelve el mismo recibo sin duplicar. Con 0421 aplicada y antes de 0422, la app ya escribe sólo por los comandos; el DML heredado sigue disponible para cualquier otro escritor hasta 0422.
3. **0422**, sólo después de ese smoke, con OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`, dentro de una transacción; su preflight compara las huellas md5 exactas de las cinco policies y aborta si hay drift. Verificar `payment_reports_accounting_select`, `payment_reports service_role read`, `portal self read` intacta, ACL sólo SELECT y `confirm_payment_report` sin EXECUTE; repetir el smoke. Retirar su espera en una rama propia.
4. **0423**, después de 0422, con OK nominal; verificar el validador con owner postgres y `search_path=""`, y un rename de Shipping Mark de un cliente con reportes sobre facturas archivadas. Retirar su espera.

Después de 0422 no se puede volver al código anterior sólo revirtiendo la app.
