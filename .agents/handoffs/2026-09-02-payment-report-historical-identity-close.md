# SDD-0366 · recibo local de identidad histórica de reportes de pago

Fecha: 2026-09-02. Estado: CORRECTIVO LOCAL VERIFICADO; PUBLICACIÓN/RELEASE PENDIENTES.
Tarea: `Audita y limpia worktrees` (`01a05f15-80ff-77b1-9f3a-6b07d21df02d`).
Rol: worker aislado. Rama: `codex/saneamiento-integral`.
Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`.
Base del incremento: `f649bdbc4296711def2e4e6a1a5a42a3124abbd6`.
Commit de esta pieza: el que contiene este recibo; buscar con
`git log --oneline -- .agents/handoffs/2026-09-02-payment-report-historical-identity-close.md`.

## Resultado y alcance

El rename de Shipping Mark fallaba si el cliente conservaba un reporte sobre
una factura archivada. El contrato reprodujo23514 con los cuerpos reales0195
y0371; no era una regresión de0422. La nueva0423 sólo reemplaza la función del trigger:
permite sincronizar identidad, con actor/tenant/rol/alias/motivo validados,
conservando todo el resto de la fila y anexando un evento mínimo por reporte.
No habilita altas, cancelación, confirmación ni edición financiera sobre archivo.

Los caminos sobre facturas vivas, ACL/RLS0422, recibos idempotentes, eventos
previos, documentos y Storage se conservan. No se tocaron migraciones históricas
ni UI. No se afirma que todo SDD-0258 ni todo el módulo de pagos esté cerrado.

Rutas propias exactas:

- `supabase/migrations/0423_payment_report_historical_identity.sql`.
- `supabase/tests/0423_payment_report_historical_identity.test.sql`.
- `docs/specs/0366-payment-report-historical-identity/spec.md`.
- `docs/specs/README.md`, generado.
- `docs/audits/2026-09-02-codex-arranque-checklist.md`.
- Este recibo y `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`.

Ownership: coordinador implementa migración/docs; `academia_rls_regression`
escribió sólo el contrato0423, desde RED independiente. `sdd0286_reviewer5`
revisó sin editar: aprobación sin hallazgos bloqueantes del correctivo.
La inspección de tareas sólo mostró la tarea actual en DTDCargo; app cwd
principal, trabajo efectivo en el worktree aislado. Ninguna tarea ajena archivada.

## Evidencia ejecutada

| Gate | Resultado |
|---|---|
| RED final, psql `-v apply_fix=false` | exit1,23514 en rename real; rollback integral=true. |
| GREEN focal | exit0,323 aserciones incluidas18 derivas; rollback=true. |
| `fixture_only=true` | exit0,2 tenants sintéticos;0 aliases/0 eventos nuevos de rename. Segunda carga rechazada por base no vacía. |
| `node scripts/run-sql-tests.mjs` |164/164 contratos, exit0, rollback total. |
| `node scripts/check-schema-rebuild.mjs` |420 archivos:402 schema+18 sólo-ledger;219 tablas+2 tenants, exit0. Ejecutado sobre esta migración, sin cambios SQL posteriores. |
| Supabase CLI2.108.0 Advisors |5 WARN heredados del fixture,0 señalados en la función modificada. No es un diagnóstico de Cloud. |
| Revisión independiente | Código y contrato aprobados; SDD-0258 completo fuera de alcance. |
| Docs / numeración / gobernanza / CMP | exit0;358 specs,420 migraciones,28 políticas y5 fuentes CMP. Diff sin errores. |

El focal incluye fila completa con NULL, snapshot fiscal, cinco estados de
reportes, padre vivo como control, actores/tenants/roles/aliases incorrectos,
motivo inválido, GUC ajeno sellado/restaurado y fallo del destino real de
auditoría en la segunda fila, tanto por excepción como por UUID nulo.
Verifica conservación de recibos, comprobantes, buckets y eventos previos,
igualdad de IDs visibles en Portal A/B y ausencia de DML/legacy RPC API.

Ejecución reproducible: contenedor PostgreSQL17 exclusivo y vacío, montaje
read-only de `supabase` en `/sb`; `psql -X -U postgres -v ON_ERROR_STOP=1 -f
/sb/tests/0423_payment_report_historical_identity.test.sql`. Por defecto termina
en rollback. `fixture_only=true` es opt-in sólo para el contenedor de Advisors.
Los runners canónicos comprueban antes la ausencia de sus nombres deterministas.

Advisors: puerto publicado exclusivamente en127.0.0.1 y URL
`postgresql://postgres:postgres@127.0.0.1:<puerto>/postgres?sslmode=disable`;
credencial exclusivamente sintética. Comando: `supabase db advisors --db-url
<url-local> --type all --fail-on none --output-format json`. La primera conexión
sin `sslmode=disable` falló; no fue un fallo SQL ni una consulta Cloud. La segunda
verificó TCP y terminó0. WARN: auth_rls_initplan de client_users, policies SELECT
permisivas múltiples de clients/invoices/payment_reports y search_path del
stub touch_updated_at.0423 no modifica ninguno de esos objetos/policies.
Los dos contenedores propios se detuvieron sólo tras verificar ID y etiqueta;
ausencia confirmada. El agente también retiró su contenedor aislado.

No se repiten TypeScript/Vitest/build/E2E como si SQL hubiera cambiado la UI;
sus resultados anteriores están en el recibo general y no son ejecuciones nuevas.
La matriz SGE-00 completa y el contrato BTN/MP/AUD viven en la spec0366.

## Revisión advisory de datos personales

Alcance técnico: sólo datos que cruza este correctivo. Resumen de los12 puntos:
3 CORRECTO y9 NO VERIFICABLE;0 ENCONTRADO. No es una auditoría legal integral.

| Campos inventariados | Finalidad técnica | Base de licitud / retención | Destinatario comprobado |
|---|---|---|---|
| payment_reports.client_markbox,invoice_id,tenant_id,id | Vincular el expediente conservado al cliente y factura correctos | No verificadas jurídicamente; este cambio conserva el expediente | Validador M:72, evento mínimo M:137; no nuevo permiso de lectura |
| client_markbox_history.id,client_id,tenant_id,markbox | Probar el alias del mismo cliente/tenant y correlacionar cambio | No verificadas; no elimina el historial | Validador M:114–120 y writer existente |
| client_markbox_history.retired_by,reason | Autoría y motivo de la rectificación | No verificadas; evento nuevo restricted | M:119/124/135, writer AUD existente |
| entity_audit_log.actor_id,reason,before_data,after_data,payload,correlation_id | Reconstruir la rectificación sin duplicar el pago | No se fija plazo ni se habilita purga | M:135–143; ACL/AUD-02 sin cambios |
| payment_reports.proof_path,note y objetos Storage existentes | Sólo comparar conservación; no copiarlos al evento | No verificadas; este correctivo no borra ni sustituye | T:450–516 verifica conservación sintética, no archivos reales |

`M` = `supabase/migrations/0423_payment_report_historical_identity.sql`;
`T` = `supabase/tests/0423_payment_report_historical_identity.test.sql`.

| Punto | Estado | Evidencia o límite |
|---|---|---|
|1 Inventario|CORRECTO|M:72/114/135, campos del delta enumerados arriba; no se inventarian datos reales.|
|2 Minimización|CORRECTO|M:137–143 permite sólo IDs/códigos/motivo/contexto; T:491–495 no copia monto, pagador, nota o comprobante.|
|3 Consentimiento|NO VERIFICABLE|M:124 valida motivo, no consentimiento; no se revisaron acuerdos vigentes.|
|4 Derechos como caminos reales|NO VERIFICABLE|M:87 permite rectificación operativa, no prueba un procedimiento completo para solicitudes de titulares.|
|5 Borrado y réplicas|CORRECTO|M:92 conserva la fila; T:500–516 conserva evidencia. No promete supresión ni ejecuta borrado.|
|6 Solicitudes de titulares|NO VERIFICABLE|M:135 prueba evento de cambio, no recepción/resolución de solicitudes de privacidad.|
|7 Política pública|NO VERIFICABLE|Este delta M:1–168 no modifica ni comprueba la política publicada.|
|8 Terceros|NO VERIFICABLE|M:135 reutiliza la base; contratos y accesos alojados no se inspeccionaron.|
|9 Transferencia internacional|NO VERIFICABLE|No puede deducirse residencia/mecanismos de M:135; no se consultó infraestructura real.|
|10 Decisiones automatizadas|NO VERIFICABLE|M:100 exige actor de sesión; no revisa otros sistemas de decisión del proyecto.|
|11 Aceptación electrónica|NO VERIFICABLE|M:135 es un evento de auditoría, no prueba firma certificada ni aceptación contractual.|
|12 Titulares no usuarios|NO VERIFICABLE|M:124 acota texto libre, pero no revela si el motivo real contiene datos de terceros; no se leyó PII.|

No se confirma una exposición de PII por el solo hecho de existir un motivo
libre. Se limita a500 caracteres, se registra sólo con propósito de auditoría
y no se amplían lectores. Contenido real, avisos, base de licitud, proveedores,
residencia, retención y backups requieren revisión autorizada y, cuando
corresponda, asesoría legal. Esta revisión no es asesoría legal.

## Publicación, integración y limpieza

No push: persiste el rechazo de auto-review del lote anterior y falta OK exacto
de commit/destino. La solicitud anterior hasta f649bdbc no incluye implícitamente
este incremento. Remoto conocido: eabb230b; su CI no cubre los cambios locales.
No merge/main, deploy, Cloud, datos reales, secretos ni configuración alojada.

Aplicación futura, una operación autorizada cada vez:0421 → consumidores y
smoke →0422 y smoke →0423 y smoke nominal de rename/historial/rechazo financiero.
Usar el runbook de migraciones antes de cualquier aplicación. No revertir la
app a escritores legacy ni reabrir grants automáticamente.

LIMPIEZA BLOQUEADA: el worktree activo conserva trabajo no publicado/integrado;
principal y dos ramas archive se preservan. No hubo borrado material en esta pieza.
Siguiente responsable: coordinador/integrador con autorización exacta de publicación
y gates alojados nominales. El objetivo integral sigue activo.
