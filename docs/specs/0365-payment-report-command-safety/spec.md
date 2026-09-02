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

- [ ] Inventariar todos los escritores; retirar DML directo y RPC heredada
  después de los consumidores nuevos, sin fallback inseguro de aplicación.
- [ ] Restringir lectura financiera interna, preservando Portal propio e
  historia. Probar principales duales, archivo del padre y revocación de vínculo.
- [ ] Separar expansión → aplicación/smoke → restricción. Cada migración con
  autorización nominal, no una aplicación en lote ni un deploy implícito.

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
y los dos handoffs ya enumerados. No cambia todavía UI ni consumidores.

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
