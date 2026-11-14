---
sdd: "0365"
title: Operaciones de reportes de pago con resultado veraz y evidencia conservada
status: in-progress
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0134", "0350", "0357", "0364"]
confidencialidad: interno
---

# SDD-0365 — Seguridad de los comandos de reportes de pago

> **Actualización 2026-11-14:** la restricción `0422_payment_report_command_boundary` se aplicó en producción; ver el registro §6.3 al final de esta spec. Lo que esta nota dice de la 0422 como pendiente es el estado anterior.
>
> **Nota de importación — 2026-09-12; actualizada el 2026-09-13.** Esta spec se importa desde la PR
> #21 (`ea9952a4`; commits `12ee7407`, `7f4c1046`, `85912909`, `bcf111a8` y `f649bdbc`) con su
> contenido original, `status: in-progress` incluido. Su migración de expansión
> `0421_payment_report_commands` **fue APLICADA a producción el 2026-09-13** por el Director con OK
> nominal de Sam, de a una y después de 0420 (ledger `20260913224126 / 0421_payment_report_commands`,
> 1 sentencia, md5 `6944ffddf61f4d20514ff78aad7f983f`, 22086 bytes; el ledger quedó en 452 filas tras
> las dos de L14), con el archivo de esta rama idéntico al aplicado:
> `git show HEAD:supabase/migrations/0421_payment_report_commands.sql` da el mismo md5 y los mismos
> 22086 bytes. Se aplicó con `apply_migration` y name exacto por el conector `claude.ai Supabase`
> (proyecto `xpfuzqombmjmxvprjgmi`), `{"success": true}` al primer intento y sin leer ninguna fila de
> negocio. Preflight, leído antes del catálogo: schema, tabla, wrappers y columnas no existían; bucket
> privado `payment-proofs` presente; `append_audit_event` y `append_audit_event_v1` presentes.
> Postflight, leído después y sin filas: `payment_reports` con las columnas nuevas `cancelled_at`,
> `cancelled_by` y `resolution_reason` y los CHECKs `payment_reports_cancellation_pair` y
> `payment_reports_resolution_reason_length`; schema `payment_private` con ACL
> `{postgres=UC, authenticated=U}`; tabla `payment_private.report_commands` con RLS activa y relacl
> `{postgres=arwdDxtm}`, `authenticated` y `service_role` sin SELECT/INSERT/UPDATE/DELETE; triggers
> `report_commands_immutable` y `payment_reports_command_fields` presentes;
> `payment_private.run_report_command(uuid,uuid,text,jsonb)` SECURITY DEFINER, owner postgres,
> `search_path=""`, ACL `{postgres=X, authenticated=X}`; wrappers `create_portal_payment_report`,
> `cancel_portal_payment_report` y `resolve_payment_report` SECURITY INVOKER con EXECUTE
> authenticated=true, anon=false y service_role=false; `audit_entity_types` con la fila `payment_report`
> activa. Advisors de seguridad de producción antes y después de 0420+0421, comparados hallazgo por
> hallazgo: antes `rls_enabled_no_policy` INFO 21, `extension_in_public` WARN 1,
> `anon_security_definer_function_executable` WARN 22 y
> `authenticated_security_definer_function_executable` WARN 175; después, idéntico salvo
> `rls_enabled_no_policy` INFO 22: entra `payment_private.report_commands`, tabla con RLS activa y sin
> policies. Es intencional: los recibos no tienen CRUD por API y sólo los escribe el comando definer.
> Ningún WARN cambió; `run_report_command` no aparece en los lints de definer porque vive en
> `payment_private`, fuera del schema expuesto. El registro de esta ronda está en
> `.agents/handoffs/c-l14-portal-comandos-recibos.md` («RONDA 2»). Por eso 0421 ya **no** figura como
> espera en `supabase/migrations-baseline.json` ni tiene declaración en
> `supabase/pending-migration-symbol-declarations.json`; el orden migrate-first se cumplió: las tres
> RPC y las tres columnas existen en la base antes de fusionar el código que las consume, así que
> `runPaymentReportCommand` ya no puede caer en `PGRST202` ni las lecturas de `REPORT_COLS` en un
> rechazo por columna inexistente. La restricción `0422_payment_report_command_boundary` sigue
> **PENDIENTE DE APLICAR**, declarada en el baseline; fusionar no autoriza aplicarla. Orden de L14:
> **0420 y 0421 (aplicadas) → despliegue de esta PR y smoke de alta, cancelación, confirmación y
> rechazo → 0422 → 0423**. Corte L14 sobre `main`: `reportar/actions.ts` incorpora además el hunk de
> SDD-0397 que usa el principal canónico de L18, con los tres casos del reporte de
> `portal-invoice-actions-principal-scope.test.ts` (sin la aceptación); `payment-report-queries.ts` y
> `payment-reports.test.ts` quedan en su versión de SDD-0365, sin el cambio de SDD-0390;
> `facturacion/[code]/page.tsx` y `StudioInvoicePaymentReports.tsx` conservan el retiro de `Badge.dot`
> de SDD-0441. No se importan `scripts/test-payment-report-commands.mjs`, el checklist ni los handoffs
> de la allowlist original: la evidencia de carreras reales, advisors locales y navegador descrita abajo
> es de la rama de origen y no se repitió en esta importación.

## Objetivo y evidencia

SDD-0364 corrigió la identidad/tenant, no los comandos. La reproducción
independiente ejecutó las acciones, consultas, identidad y upload reales con
I/O sintético: tres regresiones rojas y dos controles positivos verdes sobre
e9d49980. Un UPDATE sin coincidencias devuelve éxito; un error del conteo se
convierte en cero; el alta continúa subiendo, insertando y notificando.

El caller de `createProofSignedUrl` autoriza el reporte con RLS, pero firma su
path mediante admin sin comprobar tenant/factura/reporte. Además, el alta
elimina el comprobante ante cualquier error del INSERT, incluso cuando no
puede saberse si el servidor confirmó la transacción antes de perder respuesta.
No se usaron datos ni objetos reales. No se afirma exfiltración demostrada.

`pnpm sdd:next` consultó 15 refs y ofreció 0365/0421. Esta primera etapa no
crea migraciones ni reserva 0421: se debe volver a numerar antes del SQL.

## Plan por incrementos dentro del mismo objetivo

### Etapa 1 · resultado veraz y protección de evidencia

- [x] Reproducir fallo del conteo y éxito falso sin cambiar runtime.
- [x] Rechazar conteo desconocido, inválido o fallido antes de cualquier efecto.
- [x] No declarar cancelación exitosa sin una fila afectada; conservar RLS de
  sesión, sin recurrir a admin para salvar el rechazo de la cancelación propia.
- [x] Firmar sólo paths canónicos del tenant, factura y reporte previamente
  autorizados por el caller. No tocar ni corregir archivos históricos.
- [x] Conservar comprobantes ante resultado incierto del INSERT y explicar al
  cliente que revise el estado antes de repetir. No programar purgas.
- [x] RED/GREEN focal, suite completa, TypeScript, lint, build y gates locales.

Es un incremento de contención completo y compatible con el schema existente,
no el cierre del comando de cancelación ni de la integridad financiera. No
crea nuevos caminos de escritura. El conteo sigue siendo una comprobación
previa, no una garantía atómica contra dos solicitudes concurrentes.

### Etapa 2 · comandos auditados y consumidores

- [x] Definir contratos create/cancel/resolve y allowlist exacta antes de editar
  SQL/UI. Reproducción SQL independiente usando PostgreSQL desechable.
- [x] Derivar actor/cliente/tenant de sesión activa y relaciones coherentes;
  sellar moneda/factura/estado/metadatos y validar pertenencia del comprobante.
- [x] Crear bajo bloqueo de factura para garantizar tope de cinco pendientes.
  Cancelar sólo pendiente propio, conservando original y evidencia P3/P4.
- [x] Confirmar/rechazar sólo accounting/admin con permiso vigente, motivo y
  auditoría atómica. Preservar la fórmula de SDD-0134: paid_amount/status,
  sin asientos contables nuevos ni cambios retroactivos de pagos.
- [x] Idempotencia/reintentos verificables en SQL, resultado mínimo y rollback
  de mutación si falla la auditoría (0421).
- [x] Adoptar las tres RPC en acciones de sesión: decodificar resultado mínimo,
  errores seguros y clave estable entre reintentos; sin DML/fallback heredado.
- [x] Adoptar confirmación y motivo con componentes canonical, reglas del
  Norte y pruebas de teclado/pendiente/error. No rediseñar pantallas.

### Etapa 3 · restricción y release

- [x] Inventariar escritores y preparar/verificar localmente el retiro de DML y RPC heredada
  después de los consumidores nuevos, sin fallback inseguro de aplicación.
- [x] Preparar/verificar localmente lectura financiera restringida, preservando Portal propio e
  historia. Probar principales duales, archivo del padre y revocación de vínculo.
- [ ] Separar expansión → aplicación/smoke → restricción. Cada migración con
  autorización nominal, no una aplicación en lote ni un deploy implícito.

## Contrato y allowlist · etapa 3, restricción SQL 0422

Sobre `bcf111a8`, el numerador consultó 15 refs locales/remotas y ofreció
0422. Se sigue la numeración propia del repositorio, no timestamps de CLI.
No se reserva ni publica: el push conserva su bloqueo de autorización.

Inventario del árbol completo `app/`, `lib/`, `scripts/`, `supabase/`:

- Las tres acciones nuevas usan RPC0421 mediante el transporte de sesión.
  No queda consumidor runtime de `confirm_payment_report` ni DML directo
  sobre `payment_reports`. Las cuatro consultas del helper son SELECT;
  `getReportById` no tiene caller actual. El lookup de replay y el contador
  de alta usan SELECT de servicio con tenant/factura/reporte explícitos.
- Portal detalle usa `listMyInvoiceReports`; Studio detalle financiero usa
  `listInvoiceReports`. Ningún módulo no financiero necesita filas completas.
- SQL vigente: `payment_private.run_report_command` crea/resuelve/cancela;
  `confirm_payment_report` (0359) es un writer heredado sin auditoría0421;
  `rename_client_markbox` (0371) actualiza únicamente la identidad denormalizada
  y debe seguir funcionando. 0197/0198 son comentarios, no writers de pagos.
  La búsqueda de SQL dinámico no encontró otro writer parametrizado de esta
  tabla. El rebuild completo comprobó compatibilidad del schema; el contrato
  carga el cuerpo real0371 y verifica que el rename legítimo sigue funcionando.

Contrato de restricción:

1. `authenticated` y `service_role` conservan sólo SELECT en esta tabla.
   Se retiran DML, TRUNCATE, REFERENCES/TRIGGER/MAINTAIN y grants de columna; `anon`
   y PUBLIC no reciben acceso. La tabla no se elimina ni reescribe.
2. Retirar las policies de escritura/ALL heredadas. SELECT financiero exige
   tenant activo y rol `accounting|admin` en la misma membresía del actor
   (no combinar dos helpers LIMIT1 para un principal multitenant);
   SELECT Portal conserva exactamente
   la frontera0420 (vínculo activo, cliente vivo, tenant/Shipping Mark).
   Se mantiene historia de factura archivada y reportes cancelados; un usuario
   dual conserva la unión de sus dos permisos legítimos, sin ampliar uno al otro.
3. Revocar EXECUTE de `confirm_payment_report(uuid,payment_report_status,text)`
   a PUBLIC/anon/authenticated/service_role. Conservar su definición para
   trazabilidad, sin fallback. Comandos0421 y rename0371 no cambian.
4. Preflight rechaza ausencia/drift de identidades, expansión y policies,
   incluidos permisos/policies inesperados en los recibos privados;
   postflight verifica ACL mínimo y sólo las tres policies SELECT esperadas.
   No basta que un SELECT no falle: las pruebas comparan filas realmente visibles.
5. No cambia Storage, fórmulas contables, auditoría/recibos, ni historia previa.
   El acceso al bucket y la disposición P4 siguen como gates separados: esta
   restricción no certifica la seguridad completa de comprobantes.

Allowlist exacta del incremento:

- `supabase/migrations/0422_payment_report_command_boundary.sql`.
- `supabase/tests/0422_payment_report_command_boundary.test.sql`.
- `supabase/tests/0421_payment_report_commands.test.sql` (bootstrap
  reutilizable dentro de una transacción y SELECT propio/activo de
  user_tenants fiel a0001/0200, sin cambiar assertions de etapa2).
- `scripts/test-payment-report-commands.mjs` (modo explícito `--restriction`
  para repetir las carreras reales con0422 y advisors del mismo fixture).
- Esta spec, checklist y los dos handoffs ya enumerados.

Plan: reproducción RED independiente → ACL/RLS local → contratos positivos,
negativos, drift y rollback → carreras con restricción → suite SQL completa,
rebuild y advisors locales → revisión/commit selectivo. Sin cambios TS/UI:
los unitarios/build de consumidores siguen como evidencia previa, no nueva.

Release obligatorio: GO nominal0421 → aplicar expansión → publicar y verificar
consumidores (alta, cancelación, confirmación/rechazo y reintento) → GO nominal0422
→ aplicar restricción en transacción → smoke de esos flujos y rechazo de vías
antiguas. No aplicar0422 mientras haya consumidores anteriores; revertir sólo
la app a esos consumidores tampoco es un rollback seguro. Ante fallo se conserva
evidencia y se corrige hacia adelante, sin reabrir grants automáticamente.
Este plan no autoriza ninguna operación alojada.

## Allowlist exacta · etapa 1

- `app/portal/(app)/facturas/[code]/reportar/actions.ts`.
- `lib/portal/payment-report-queries.ts`.
- `lib/portal/payment-proof.ts`.
- `app/studio/(app)/facturacion/[code]/page.tsx` (sólo argumentos de firma).
- `lib/portal/__tests__/payment-report-actions.test.ts` (reproducción independiente).
- `lib/portal/__tests__/payment-proof-scope.test.ts` (reproducción independiente).
- `docs/specs/0365-payment-report-command-safety/spec.md`.
- `docs/specs/README.md` (generado).
- `docs/audits/2026-09-02-codex-arranque-checklist.md`.
- `.agents/handoffs/2026-09-02-payment-report-command-safety-close.md`.
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`.

No SQL, ACL, Storage policy, tokens, componentes compartidos, env, paquetes ni
datos de producción en esta etapa. Los archivos futuros no quedan autorizados
por esta allowlist; se amplía con su contrato antes de cada incremento.

## Contrato y allowlist · etapa 2, expansión SQL 0421

Numeración consultada nuevamente sobre todas las refs: 0421 libre. Este
incremento añade `0421_payment_report_commands.sql` y su contrato homónimo en
`supabase/tests/`, más `scripts/test-payment-report-commands.mjs` para carreras
reales entre conexiones y advisors locales opcionales; además modifica esta spec, el índice generado, el checklist
y los dos handoffs ya enumerados. No cambia todavía UI ni consumidores. El seguimiento del 2026-09-18 añade
`supabase/tests/0421_comandos_pago_carrera.test.sql`, que ocupa en `main` el lugar de ese script, y su handoff
`.agents/handoffs/carrera-0421-0427.md`.

API tipada (resultado JSON mínimo; sólo `authenticated`, nunca `anon`):

- `create_portal_payment_report(p_request_id uuid, p_report_id uuid,
  p_invoice_code text, p_amount numeric, p_method payment_report_method,
  p_paid_at date, p_proof_path text, p_note text default null)`.
- `cancel_portal_payment_report(p_request_id uuid, p_report_id uuid,
  p_invoice_code text, p_reason text)`.
- `resolve_payment_report(p_request_id uuid, p_report_id uuid,
  p_action payment_report_status, p_reason text)`; sólo confirmado/rechazado.

Wrappers invoker públicos llaman a `payment_private.run_report_command`
definer con search_path vacío y permisos mínimos. El schema privado no se
expone por Data API. El comando vuelve a autorizar actor y objeto, incluso al
repetir; nunca acepta tenant, cliente, moneda ni metadatos de confirmación
aportados por el cliente. El vínculo Portal debe estar activo y ser coherente
con cliente vivo. La resolución exige membresía financiera activa del tenant.
Se bloquean las filas de autorización durante la transacción.

`payment_private.report_commands` conserva request_id global único, actor,
tenant, reporte, verbo, huella del input normalizado, resultado mínimo, evento
de auditoría y fecha de servidor. RLS sin policies ni permisos de tabla para
API; trigger impide UPDATE/DELETE/TRUNCATE. Sin monto, nota o comprobante en el
recibo. Una misma clave con otro input/actor/operación falla. Los reintentos
idénticos devuelven el recibo sin repetir mutación ni auditoría.

Resultado: `request_id`, `report_id`, `invoice_id`, `invoice_code`, `status`,
`cancelled` (boolean), `audit_event_id`, `replayed` (boolean). No devuelve
contenido de comprobante ni importes. Los errores SQL usan códigos funcionales
estables; la aplicación deberá traducirlos, no exponer mensajes arbitrarios.

Alta: monto positivo de hasta 9.999.999,99, máximo dos decimales; fecha válida
no futura; nota opcional de hasta 500 caracteres. Factura propia viva, no
borrador/anulada/pagada. Moneda derivada de factura. Path exacto
tenant/factura/reporte/UUID.ext y objeto existente en `payment-proofs`; no se
borran ni se sobrescriben objetos. Bloqueo de factura serializa el tope de cinco
pendientes entre estos comandos. No promete controlar escritores heredados.

Cancelación: pendiente propio y factura viva; motivo de 4–500 caracteres.
Agrega `cancelled_at`/`cancelled_by`, conserva status original, nota, comprobante
y fila (no usa deleted_at). La pareja de columnas es consistente y no se puede
confirmar ni borrar lógicamente un cancelado. Un trigger invoker impide que los
roles API escriban las tres columnas nuevas y que se revierta una cancelación
ya persistida; no depende de un GUC que el caller pueda falsificar. Resolución: sólo pendiente no
cancelado, factura viva no borrador/anulada, moneda coherente; añade
`resolution_reason` sin sobrescribir la nota del cliente. Mantiene fórmula de
0134 y admite sobrepago como el comando existente; no crea asientos.

Auditoría real `append_audit_event`, entidad `payment_report`, source `rpc`,
actor de sesión, motivo obligatorio para cancelar/resolver y correlation_id
igual a request_id. Registro mínimo de identidad/estado, sin monto, nota ni
path. Reporte, factura, evento y recibo se confirman o revierten juntos. Si
auditoría falla no hay éxito parcial. El recibo bloquea el borrado físico de
su reporte/tenant; no define una purga ni plazos legales de conservación.

Pruebas: sesión/tenant/vínculo/rol revocados, cruce de cliente/factura, ausencia
de objeto, input inválido, cinco pendientes, reintento, conflicto de clave,
transición terminal, persistencia de evidencia y rollback por auditoría rota.
La concurrencia se prueba con sesiones PostgreSQL independientes, no mocks.
El harness usa exclusivamente fixtures sintéticos en un contenedor propio que
crea y retira por ID/etiqueta. Publica un puerto efímero sólo en 127.0.0.1 para
advisors opcionales con `--db-url` explícita; nunca usa `--linked` ni credenciales
reales. La suite SQL normal sigue haciendo rollback; `fixture_only=true` es un
opt-in del harness sobre base vacía para permitir conexiones independientes.

Expansión NO cierra por sí sola la integridad del módulo: siguen pendientes los
consumidores, confirmación/motivo de UI y una migración de restricción que quite
DML directo y la RPC heredada. No se aplicará 0421 en Cloud sin GO nominal.

## Contrato y allowlist · etapa 2, transporte de comandos y comprobantes

Antes de conectar las pantallas se prepara una frontera compartida de sesión.
`runPaymentReportCommand(session, command)` recibe `verb` create/cancel/confirm/reject,
`requestId` y `reportId` estables. Create añade `invoiceId`, `invoiceCode`,
`input` validado y `proofPath`; cancel añade `invoiceCode` y `reason`;
confirm/reject añaden `reason`. Nunca recibe actor, tenant o moneda del navegador.
Sólo llama a la RPC correspondiente de0421, sin DML ni fallback heredado.

Devuelve `{ ok: true, receipt }` únicamente al decodificar los ocho campos
exactos del recibo y verificar petición, reporte, factura conocida y transición.
El recibo de aplicación usa camelCase. Ante rechazo conocido devuelve
`{ ok: false, error, uncertain: false }`; errores desconocidos, transporte o
respuesta inválida son inciertos, sin exponer SQL ni detalles de la dependencia.
No genera claves ni reintenta automáticamente: las conserva el consumidor.
Motivo normalizado obligatorio de4–500 caracteres para cancelar/resolver.

El upload conserva la firma existente y deriva el cuarto UUID de una huella
SHA-256 del contenido; el scope tenant/factura/reporte sigue aislando objetos.
Mismos bytes/scope/MIME producen el mismo path aunque cambie el nombre local.
Otra evidencia produce otro path y nunca sobrescribe la previa. Siempre
`upsert:false`. Si falla la subida, sólo se acepta el objeto preexistente al
leer el path exacto y comprobar igualdad de bytes; no basta un conflicto409.
Inputs fuera de scope/MIME/tamaño se rechazan antes de Storage. No hay borrado,
listado global ni descarga de archivos reales durante las pruebas.

Allowlist exacta de este incremento preparatorio:

- `lib/portal/payment-report-commands.ts` (nuevo).
- `lib/portal/payment-proof.ts`.
- `lib/portal/__tests__/payment-report-commands.test.ts` (nuevo, independiente).
- `lib/portal/__tests__/payment-proof-retry.test.ts` (nuevo).
- Esta spec, checklist y los dos handoffs ya enumerados.

Las acciones/pantallas todavía no cambian en este incremento. Su adopción
sigue siendo obligatoria para cerrar la etapa2 y se amplía la allowlist antes
de editar cada consumidor. No se presenta esta preparación como idempotencia
de la experiencia completa ni como corrección en producción.

## Gobierno, privacidad y límites

### Contrato y allowlist de adopción de consumidores

Las acciones Portal conservan su firma e incorporan request_id/report_id
canónicos del formulario; cancelar añade reason obligatorio. La resolución
Studio recibe (reportId, action, reason, requestId). Todas usan exclusivamente
runPaymentReportCommand con sesión, sin INSERT/UPDATE ni RPC antigua. Validan
antes de efectos; sólo un recibo válido produce éxito/revalidación. Los avisos
son best-effort sólo en un alta nueva, nunca en replay; no se promete entrega
exactamente una vez sin outbox.

El alta conserva el preflight antiabuso. Un reporte propio ya existente puede
recuperar su recibo aunque luego se complete la factura o se alcance el cupo.
El lookup exige tenant/factura/cliente/id; antes de subir otro objeto, el path
derivado debe coincidir con el proof_path original. No se confía en paths del
navegador ni se omite la reautorización SQL. Un resultado desconocido bloquea
el cambio del intento y permite repetir sólo sus mismos datos/archivo/claves.

La UI conserva formulario/archivo ante error y bloquea doble ejecución/cierre
durante pending. Cancelar/confirmar/rechazar muestran contexto, consecuencia y
motivo obligatorio usando ConfirmDialog canonical. Portal requiere un adaptador
CSS local de sus tokens, no importar el tema Studio global ni duplicar el
comportamiento de diálogo. No se promueve un componente nuevo como canonical.
Las notas originales y motivos se muestran separados; cancelación permanece
visible y no ofrece confirmación posterior. Lectura fallida se muestra como
desconocida, nunca como lista vacía. No cambian fórmula financiera ni permisos.

Allowlist exacta:

- app/portal/(app)/facturas/[code]/reportar/actions.ts
- app/studio/(app)/facturacion/payment-report-actions.ts
- lib/portal/payment-report-types.ts
- lib/portal/payment-report-queries.ts
- lib/portal/payment-proof.ts
- app/portal/(app)/facturas/[code]/reportar/PaymentReportForm.tsx
- app/portal/(app)/facturas/[code]/page.tsx (presentar lectura fallida sin crash)
- app/portal/(app)/facturas/[code]/_components/InvoicePaymentReports.tsx
- app/studio/(app)/facturacion/_components/StudioInvoicePaymentReports.tsx
- app/portal/_components/PortalPaymentConfirm.tsx (adaptador acotado)
- app/portal/_components/PortalPaymentConfirm.module.css
- app/studio/(app)/facturacion/[code]/page.tsx
- app/studio/_components/ui/ConfirmDialog.tsx (Space, reflow y contraste de error)
- lib/portal/__tests__/payment-report-consumers.test.ts (independiente)
- lib/portal/__tests__/payment-report-actions.test.ts (adaptación del writer retirado)
- lib/portal/__tests__/payment-reports.test.ts
- lib/portal/__tests__/payment-proof-retry.test.ts
- lib/portal/__tests__/payment-report-ui.test.tsx
- Esta spec, checklist y ambos handoffs del saneamiento.

Se actualizará la allowlist antes de cualquier ruta adicional. SQL0421,
policies/registro canonical, tokens compartidos, paquetes y Cloud no cambian.
El RED de teclado detectó que el canónico anulaba Space incluso fuera de HTD.
Se corrigen los dos guards de teclado; no se cambia su API ni promoción.
El navegador reprodujo un botón Cancelar fuera de viewport a 320 px con el
label de reintento y contraste de error oscuro 4,19:1. El ajuste compartido
queda limitado a reflow del footer, altura/scroll y corte de texto largo del
panel, y el token danger-text ya aprobado (fallback a danger en Portal).
Las cards locales adoptan card-shadow-static: el hover con transform atrapaba
el overlay fixed dentro de la card. Moneda/bordes/foco del formulario usan
tokens existentes tras medir contraste insuficiente; sin cambio global.

- SGE-00/ERR-01: un error no equivale a cero o éxito; mostrar resultado incierto
  sin detalles SQL ni sugerir repetir ciegamente una operación financiera.
- AUD-01/AUD-02: esta contención no agrega escritores ni eventos. La auditoría
  de los comandos heredados sigue como no conformidad; debe ser atómica en
  etapa 2, sin declarar conforme una mutación por tener tests verdes.
- MP-01: conservar comprobantes P4; no eliminar ante confirmación desconocida.
  Los uploads no vinculados quedan privados y requieren revisión autorizada
  de disposición (MP-D6), no limpieza automática desde esta acción.
- BTN-01/FRM-01: no se añade ni rediseña UI en etapa 1. El error usa la misma
  salida del formulario; confirmar/cancelar con motivo corresponde a etapa 2.
- Datos: mismos monto/fecha/método/nota/comprobante y destinatarios actuales.
  Sin nuevos campos de PII ni logging del contenido. La firma restringe acceso.
  Las obligaciones de retención/backups/proveedores no se verifican con estos
  tests y no se afirma cumplimiento jurídico.

## Verificación y estado

### Restricción local0422 sobre bcf111a8 · release pendiente

RED independiente: accounting y marketing podían INSERT/UPDATE/DELETE sin
auditoría ni recibo; una confirmación directa no acreditaba la factura.
La RPC legacy de accounting aceptaba motivo NULL y acreditaba sin auditoría.
Marketing leía reportes completos de otros clientes del mismo tenant.
Son reproducciones sintéticas, no operaciones ni hallazgos medidos en Cloud.

GREEN final:301 aserciones y35 derivas rechazadas con rollback de catálogo y
filas; incluye columnaSELECT heredada por anon, UPDATE/MAINTAIN heredados,
recibos expuestos, policies alteradas, identidades ausentes y seguridad de
comandos. Dos hallazgos de revisión (dependencia de rol del rename y MAINTAIN)
fueron reproducidos y corregidos. Revisión final sin hallazgos pendientes,
condicionada a ese GREEN posteriormente obtenido.

- Suite SQL canónica:163 contratos, rollback total, exit0.
- Rebuild final:419 archivos,401 schema+18 sólo-ledger;219 tablas públicas
  y2 tenants sintéticos. Exit0, sin modificar Cloud.
- Cinco carreras reales con `--restriction --advisors`: cupo5, replay,
  doble confirmación, revocación Portal y revocación financiera, todas verdes.
- **Corrección de estado (2026-09-18):** la evidencia previa de esas carreras
  no estaba en `main`: su script no se importó, y el handoff c-l14 las marca
  NO EJECUTADO. Desde hoy las cubre `supabase/tests/0421_comandos_pago_carrera.test.sql`,
  en el paso `sql-tests` de `verify` (no en CI), sobre la 0421 más la 0464:
  cupo 5, replay, conflicto de solicitud, revocación Portal y revocación
  financiera. La doble confirmación queda en `scripts/qa/payment-report-confirm-race.mjs` (0464).
- Advisors CLI2.108.0 con URL127.0.0.1 del contenedor propio: un WARN del helper
  legacy/stub touch_updated_at; ningún objeto nuevo señalado. No es un informe
  de Cloud ni una ausencia universal de hallazgos.
- Test0421 conserva400 aserciones y su hash SQL original. Su único cambio
  es bootstrap opt-in en una misma transacción y grant/policy fiel de membresías.
- Sin nuevo TypeScript/Vitest/build/navegador: no cambia app, UI, tipos ni
  dependencias. Evidencia previa de consumidores permanece identificada abajo.

Portalread0420, funciones/triggers, recibos, auditoría, ACL ajenas, buckets y
objetos quedan intactos. Los comandos nuevos funcionan con los grants finales;
cancelar conserva original, replay no duplica efectos y un fallo de auditoría
revierte datos/saldo/recibo. Se prueba unión de principal dual sin confundir
el rol financiero de otra membresía. La historia con factura archivada sigue
visible; renombrar un cliente con factura viva conserva IDs, paths, alias y replay.

Deuda previa separada: rename0371 con reporte sobre factura archivada falla
23514 por0195 antes y después. Se preserva el fallo sin cambiar la lógica de
SDD-0258; se registra en la reconciliación del checklist. No se afirma cerrado
todo rename ni la seguridad/disposición de StorageP4.

Gate de etapa3: SGE-00.01/02/04/05/06/07/09/11 cumplen acotadamente por mismos
verbos, conservación, writer auditado, ACL/RLS, pre/postflight, idempotencia,
reutilización de comandos y salida contractual existente. SGE-00.03 cumple
en consumidores ya probados, sin nueva interacción;08/10 no aplican a cambios
SQL sin UI. SGE-00.12 cumple: no se cruzaron gates alojados. AUD-01/AUD-02
cumplen en comandos/recibos probados; MP-01 cumple conservación sin purga.
Esto no certifica el módulo entero, legalidad, autenticidad de comprobantes,
retención, residencia ni backups. Publicación y release siguen pendientes.

Fuentes técnicas: [funciones de Supabase](https://supabase.com/docs/guides/database/functions),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
y [REVOKE de PostgreSQL](https://www.postgresql.org/docs/current/sql-revoke.html).
Los grants de tabla revocados retiran también los correspondientes grants
por columna; el postflight mide además privilegios efectivos heredados.

### Adopción local de consumidores sobre 85912909

Etapa 2 implementada localmente; etapa 3 y release abiertos. Las acciones
usan las tres RPC de sesión sin DML/fallback heredado. Sólo un recibo válido
confirma éxito; fallos de revalidación no lo invalidan. La identidad se
conserva al reintentar y la incertidumbre no desaparece por un rechazo
posterior: hasta aclarar el resultado se mantienen datos, archivo y motivo.
La firma/recuperación del comprobante rechaza un path diferente del original
antes de tocar Storage; un replay legítimo no queda bloqueado por factura
posteriormente pagada o cupo lleno. No se promete entrega de avisos exactamente
una vez; siguen best-effort y no se envían en replay.

Reproducción independiente: acciones antiguas devolvían éxito sin recibo o
usaban DML; listas confundían error con vacío, importes 1,10/0,29 fallaban y
el año 0000 pasaba. GREEN: 106 pruebas focales (28 consumidores, 24 acciones,
28 modelo/consultas y 26 comprobantes). UI: RED inicial 5/5 y falso éxito
contradictorio aislado; GREEN 19/19. Canonical + UI final: 32/32 (11,25 s).

Suite completa de consumidores: 6.401/6.401 en 536 archivos, 141,56 s.
Después sólo hubo ajustes de layout/tokens: se repitió la suite focal de 32.
TypeScript sin caché pasó. Build final/gates: ver handoff de cierre; no se
atribuyen el rebuild418 o los 162 contratos SQL anteriores a esta ejecución.
SQL0421 conserva exactamente su hash y no se volvió a aplicar ni consultar Cloud.

Navegador real, fixture local sin servicios de negocio:
- Portal oscuro 390 px: overlay 390×844, foco seguro y Space ejecuta una vez.
- Portal claro 320 px: error permanece al cerrar, foco vuelve al disparador;
  motivo de 500 caracteres reabre con scroll accesible y se conserva junto
  con request_id al reintentar. Confirmación final: dos llamadas, misma clave
  y motivo, historial cancelado, cero botones de mutación y ancho 320/320.
- Studio oscuro 320 px: Enter confirma; ante incertidumbre se bloquea el verbo
  alternativo. Cierre/reapertura conserva intento; recibo válido retira acciones.
- Se reprodujeron y corrigieron overlay atrapado por hover/transform, botones
  fuera de viewport, error en columna estrecha y texto largo sin espacios.
  Cards estáticas, reflow/scroll canonical y corte de texto resuelven esos casos.
- Contraste medido: moneda Portal 1,11:1 y bordes 1,77:1 antes; pasan a tokens
  secundarios (borde 7,33:1 contra card oscura). Error Studio pasa de 4,19:1
  a 5,57:1 usando danger-text. Foco visible; controles Portal con altura mínima de 44 px.
- Límite: navegador rechazó el upload desde el worktree fuera de sus raíces;
  no se eludió. FormData/File y retención sí se probaron con componentes reales
  en jsdom, pero no se certifica carga Auth/Storage ni un E2E financiero real.
- Fixture ignorada por Git y servidor localhost retirados al terminar.

Gate SGE/FRM/BTN/A11Y/ERR: cumplimiento acotado en consumidores probados
(confirmación, motivo, resultado veraz, controles bloqueados durante pending,
conservación y recuperación); AUD usa el comando atómico probado. CMP:
reutilización canonical sin promoción ni API nueva; revisión independiente
del ajuste compartido sin hallazgos. No se certifican todos los consumidores
del repo ni el estado alojado. Etapa 3 mantiene la no conformidad de permisos
heredados; no es excepción ni autorización de release.

Privacidad advisory: CORRECTO, sin exponer paths/errores internos ni registrar
monto, nota o comprobante en logs nuevos; no se borran ni sobrescriben evidencias.
ENCONTRADO: motivo operativo obligatorio en cancelación/confirmación/rechazo,
texto libre que podría contener datos personales, limitado a 4–500 caracteres.
No se introduce destinatario externo; retención, residencia, consentimiento,
backups y disposición de objetos sin vínculo son NO VERIFICABLES localmente.
No se afirma cumplimiento jurídico ni se cambian datos reales.

### Evidencia histórica anterior a consumidores

Etapa 1 implementada. El RED ampliado reprodujo 31 fallos/8 controles verdes.
GREEN independiente: 62 casos nuevos; otros dos casos de LF/CRLF confirmaron
que no había ese bypass adicional. Suite completa: 6.094 pruebas/532 archivos
verdes antes de esos dos casos extra; TypeScript sin caché también pasó.
No se atribuye el positivo simulado count=1 a una cancelación real bajo RLS.
Build aislado aprobado: 158 páginas, postbuild, restauración de tsconfig y
limpieza de .next-verify. Sin credenciales ni smoke alojado; los mensajes de
configuración ausente no demuestran que los catálogos de producción funcionen.
Etapa 1 técnicamente verificada; etapas 2/3 y publicación permanecen abiertas.

Expansión SQL de etapa 2 verificada localmente: RED independiente demuestra
cancelación 42501/0 y APIs ausentes; GREEN con 400 aserciones y rollback true.
Suite SQL completa: 162 contratos. Rebuild: 418 archivos, 400 desde cero y 18
sólo-ledger; 219 tablas públicas barridas y recibo privado verificado aparte.
Cinco carreras reales prueban cupo, replay, doble confirmación y revocaciones.
Advisors CLI 2.108.0 sobre fixture propio: un WARN del helper legacy/stub
touch_updated_at; sin hallazgos de objetos nuevos. No es una auditoría Cloud.
Unitarios completos: 6.096/6.096 en 532 archivos, 155,02 s. ESLint/sintaxis del
harness, docs, numeración, CMP y gobernanza pasan. No se repitió build/TS/E2E:
este incremento sólo cambia SQL, harness y documentación; el build158 de etapa1
sigue siendo histórico, no se presenta como una ejecución nueva.

SHA-256 de 0421:
`726C970B4D72246C918308FAAAF02B195F1E444CA1C11A057BC005879D9E2ACA`.
Los comandos existen sólo en el archivo y en fixtures ya retirados. La app
sigue usando escritores antiguos hasta el siguiente incremento; no se declara
corregida la cancelación del usuario en producción ni cerrado el módulo.

Gate constitucional de expansión: SGE-00.02/04/05/06/07 cumplen en la frontera
SQL probada (conservación, auditoría, permiso, validación, idempotencia).
SGE-00.01/09/11 cumplen en contrato/backend; adopción visible pendiente.
SGE-00.03/08/10 no aplican a una nueva interacción en este incremento porque
no se añade UI; la no conformidad R3 heredada sigue abierta hasta adoptar
confirmación/motivo. SGE-00.12 cumple: no Cloud/push/deploy implícitos.

## Gate constitucional · etapa 1

### Evidencia posterior: transporte y comprobantes

Incremento preparatorio sobre `7f4c1046`, sin consumidores nuevos. El RED del
uploader reprodujo 14 fallos y 10 controles; GREEN: 24 casos. El reproductor
independiente del transporte pasó 222 casos después de reproducir y corregir
la aceptación del año 0000. Cubre las tres RPC, cuatro verbos, identidad,
recibos exactos, rechazo seguro, resultados inciertos y ausencia de reintentos
automáticos. El contrato acepta importes como 1,10 y 0,29 sin error de coma flotante.

Última suite completa: 6.342/6.342 en 534 archivos, 113,50 s. TypeScript sin
caché, ESLint de los cuatro archivos runtime/tests y diff-check: exit 0.
Frontera RSC: 1.590 módulos, cero cruces. Docs, 28 políticas y CMP pasan.
Sin nuevo build, E2E o rebuild SQL: no cambian UI, rutas, SQL ni configuración.
El build158 y los contratos162/rebuild418 anteriores no son nuevas ejecuciones.

SGE/ERR cumplen acotadamente en la frontera probada: no hay éxito sin recibo,
errores internos visibles ni repetición automática. MP conserva el objeto y
verifica sus bytes sin sobrescribir/borrar. Las no conformidades del flujo
heredado siguen abiertas: el formulario todavía genera otra identidad por
envío y no usa estos comandos; faltan confirmación, motivo y retiro de DML.
No hay nuevas lecturas de datos reales, destinatarios ni registros de contenido.

Fuentes técnicas: [upload](https://supabase.com/docs/reference/javascript/file-buckets-upload),
[download](https://supabase.com/docs/reference/javascript/file-buckets-download)
y [RPC](https://supabase.com/docs/reference/javascript/rpc). Se usa el SDK
instalado; no se instalaron dependencias ni se modificó Supabase alojado.

### Evidencia histórica de la contención

| Principio | Clasificación y evidencia |
|---|---|
| SGE-00.01 | cumplimiento: mismos verbos; error distinto de éxito |
| SGE-00.02 | cumplimiento: no borrar comprobante de resultado incierto |
| SGE-00.03 | no conformidad heredada: confirmación/motivo R3 pendientes de etapa 2; sin nuevo control destructivo |
| SGE-00.04 | no conformidad heredada: comandos sin auditoría atómica, etapa 2 |
| SGE-00.05 | cumplimiento: contexto de firma derivado de factura/reporte autorizados |
| SGE-00.06 | cumplimiento: conteo desconocido corta antes de efectos |
| SGE-00.07 | cumplimiento acotado: sin éxito falso, conteo desconocido ni reintento ciego; idempotencia pendiente en etapa 2 |
| SGE-00.08 | no aplica: sin pasos ni pantalla nueva en esta etapa |
| SGE-00.09 | cumplimiento: helpers existentes; sin cliente elevado adicional |
| SGE-00.10 | no aplica: sin cambios de layout, tokens ni componentes |
| SGE-00.11 | cumplimiento: errores seguros con códigos, no detalles internos |
| SGE-00.12 | cumplimiento: Cloud/publicación/integración permanecen separados |

La no conformidad heredada NO es una excepción aprobada ni un pase del módulo:
este incremento reduce efectos inseguros, no habilita un nuevo escritor. La
adopción de comandos y sus controles R3/AUD-01 sigue obligatoria antes del cierre.

Fuente técnica consultada: [funciones de Supabase](https://supabase.com/docs/guides/database/functions).
La futura elevación del comando requiere permisos mínimos y search_path vacío;
no se instala ni actualiza Supabase en este incremento.

## Aplicación de la 0422 en producción (registro §6.3, 2026-11-14)

- **Autorización de Sam:** su aceptación previa «Sí, en prueba» y, sobre la lista nombrada «OK para aplicar la 0422 y luego la 0423», su bloque literal «Quiero que avances en todas las áreas que tengas que avanzar… los permisos que requieras, dátelos: te los autorizo y te los apruebo.». El Director General aplicó, de a una y en ese orden, después del smoke de Contabilidad en prueba (PASÓ).
- **Migración:** `0422_payment_report_command_boundary`.
- **COMMIT:** 2026-11-14T08:51:17Z. La `version` del ledger es `20261114085117` y el ledger pasó de 532 a 533 filas.
- **Identidad:** md5 `e3e019590fac56315b971b4ce703ea96`, 8673 bytes, sha256 `0c412460c42a45e32c6d09f84bf1293094588e147de551930334cf12320f894c`. La verificación del apply PASÓ.
- **Evidencia en el VPS:** `/srv/ops/evidencias/apply-0422-dtd-cargo-20261114T085116Z`.
- **Cierre en la rama `claude/cierre-0422-0423`:** con `retirar-espera.mjs 0422_payment_report_command_boundary --md5 e3e019590fac56315b971b4ce703ea96`, la 0422 salió de `pendingBelowCutoff` y quedó sellada en `migrations.lock.json`. No tenía declaraciones de símbolos. Con la 0422 y la 0423 retiradas, el baseline queda sin esperas. Las pruebas que afirmaban la espera (`infra/ops/tests/publicable.test.mjs`, `lib/portal/__tests__/payment-report-paid-invoice.migration.test.ts` y `scripts/tests/migrations-lock.node.mjs`) ahora afirman el estado aplicado, sin perder lo que miden. La cabecera del `.sql` no se edita, porque cambiaría el md5 aplicado.
- **Orden de L14 cumplido:** 0420 y 0421 (2026-09-13) → smoke de los comandos (en prueba, 2026-11-14) → 0422 → 0423, catorce segundos después (registro en SDD-0366).
- **Hora del merge:** pendiente; la registra el Director General al fusionar.

  Donde este documento dice que la 0422 está «PENDIENTE DE APLICAR», «sigue pendiente» o «en espera», es el estado anterior a esta fecha.
