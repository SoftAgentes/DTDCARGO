# SDD-0365 · recibos de contención y expansión de comandos de pago

Fecha: 2026-09-02. Estado: INCREMENTO LOCAL; OBJETIVO Y SPEC ABIERTOS.
Tarea: `01a05f15-80ff-77b1-9f3a-6b07d21df02d` · Audita y limpia worktrees.
Rol: worker. Rama: `codex/saneamiento-integral`.
Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`.
Base del incremento: `e9d499806c8a106bdda655ebf7eec8e44e823ee3`.
Commit: el commit selectivo que contiene este recibo, con intención SDD-0365.

Las secciones iniciales conservan el recibo histórico de etapa1 (`12ee7407`).
La actualización SQL0421 y su estado vigente están al final de este documento.

## Alcance y resultados

- `countPendingReports` devuelve null ante fallo/ausencia/valor inválido; la
  acción corta antes de upload, insert y avisos. Cero legítimo sí permite alta.
- Cancelar exige UUID, código de factura y count exact=1 sin error. Esto
  elimina el éxito falso, NO repara el rechazo real de la policy existente.
  No se usa admin para saltarla ni se amplía SELECT a registros borrados.
- El firmador real exige path canónico y contexto autorizado de tenant,
  factura y reporte. TTL de 1–300 segundos, con 300 por defecto; seis
  extensiones del uploader. No firma paths ajenos ni reescribe el historial.
- Un INSERT con resultado incierto conserva el comprobante privado. El
  mensaje pide revisar la factura/contactar al asesor antes de volver a
  enviar. Se retiró el helper de borrado sin otros consumidores; no se borró
  ningún archivo de usuario ni objeto de Storage.

Ownership: los once archivos de la allowlist exacta de la etapa 1 en
`docs/specs/0365-payment-report-command-safety/spec.md`. Pruebas escritas por
reproductor independiente, runtime/docs por el principal. Sin cambios ajenos.

## Evidencia local

- RED inicial: 3 fallos y 2 positivos. RED ampliado: 31 fallos/8 positivos
  sobre las funciones reales con DB/Storage/avisos/Next simulados.
- GREEN independiente: 62/62 nuevos tests en dos archivos. Después se añadieron
  LF/CRLF: los 41 del firmador pasaron; no se encontró ese bypass adicional.
- Suite completa: 6.094/6.094 en 532 archivos, 116,24 s; corrió antes de los
  dos últimos casos extra. No confundir totales de suites solapadas.
- TypeScript sin caché: exit 0; tipos de Next sanos, sin poda.
- Lint focal de cuatro archivos runtime y dos de tests: exit 0.
- Frontera RSC: 1.589 módulos, exit 0; cinco flags consistentes; docs,
  numeración (357 specs/417 migraciones), 28 políticas y CMP-01 pasan.
- Build aislado: exit 0, 158 páginas, postbuild correcto, tsconfig restaurado
  y .next-verify eliminado por el runner. Sin credenciales Supabase: los
  mensajes de configuración ausente son esperados, no un smoke de catálogos.
- No se ejecutó navegador autenticado, SQL/rebuild nuevo ni Cloud. No hay
  cambios SQL, UI o Edge; los 161 contratos SQL y rebuild417 previos siguen
  siendo evidencia de SDD-0364, no una nueva ejecución de este incremento.

## Privacidad · revisión advisory acotada

No certifica cumplimiento jurídico ni una revisión integral de producción.
Inventario: id de cliente/Shipping Mark, factura, monto/fecha/método/nota y
comprobante existentes; siguen en DB/Storage y avisos internos actuales.
No se añadió PII, destinatario, proveedor ni log de contenido.

| Punto del checklist VE | Resultado y evidencia |
|---|---|
| 1 Inventario | CORRECTO en el diff: mismos campos; actions.ts:171–183 y payment-proof.ts:72 |
| 2 Minimización | CORRECTO: firma sólo del contexto, payment-proof.ts:100; errores sin detalles DB, actions.ts:117/166 |
| 3 Consentimiento | NO VERIFICABLE: no se revisaron consentimientos reales ni su evidencia |
| 4 Caminos de derechos | NO VERIFICABLE: fuera del flujo modificado; no se promete exportación/borrado |
| 5 Borrado | CORRECTO para conservación: actions.ts:184 evita DELETE incierto; ENCONTRADO pendiente de disposición autorizada de uploads no vinculados |
| 6 Trazabilidad | ENCONTRADO: auditoría atómica e idempotencia aún pendientes en etapas 2/3 |
| 7 Política pública | NO VERIFICABLE: no se cambió ni se certificó la política pública |
| 8 Terceros | NO VERIFICABLE: proveedores/contratos alojados no revisados; no cambia payment-report-notify.ts |
| 9 Transferencia internacional | NO VERIFICABLE: sin medición de residencia ni contratos, sin nuevos destinos |
| 10 Decisiones automatizadas | CORRECTO en el diff: reporte sigue pendiente de confirmación humana, no autoacredita saldo |
| 11 Valor probatorio | NO VERIFICABLE: conservar archivo no lo convierte en firma ni acredita autenticidad del pago |
| 12 No usuarios | NO VERIFICABLE: no se abrieron comprobantes reales; pueden contener datos de terceros |

Las referencias actions.ts son `app/portal/(app)/facturas/[code]/reportar/actions.ts`;
payment-proof.ts es `lib/portal/payment-proof.ts`. Retención del expediente,
backups, holds y proveedores requieren sus verificaciones específicas. Ninguna
regla de retención autoriza purga desde este incremento.

## Cierre Git y siguiente responsable

Audit-close 20:20:52 UTC: rama propia, índice vacío, tres commits previos
locales y dos worktrees. La herramienta de tareas encontró sólo esta tarea
activa para DTDCargo; ningún otro cwd coincide. Se conserva el checkout main
en 22cec0c2 y ambas ramas archive. No se interrumpieron otras aplicaciones.

Push no ejecutado: el rechazo de auto-review exige nueva aprobación explícita
del commit/destino privado; no se reintentó por otra vía. PR21/CI siguen en
eabb230b. No merge, deploy, migración ni escritura alojada. El worktree activo
no es eliminable: tiene trabajo sin publicar/integrar y la spec en progreso.

Siguiente responsable: esta misma tarea continúa etapas 2/3 con contrato SQL,
auditoría, permisos, idempotencia y UI mínima. Antes de crear migraciones:
volver a consultar sdd:next; 0421 no quedó reservada. Integración/publicación
y cada cambio Cloud requieren sus gates; no marcar el objetivo completo.

## Actualización · expansión SQL0421 sobre 12ee7407

Estado: VERIFICADO LOCALMENTE; SPEC/OBJETIVO ABIERTOS. Publicación bloqueada.
Intención del commit: `feat(portal): SDD-0365 — agregar comandos de pago auditados`.

### Alcance propio

- `supabase/migrations/0421_payment_report_commands.sql`: tres wrappers invoker,
  comando privado definer, columnas de cancelación/motivo, recibos append-only,
  guarda de campos y entidad de auditoría. No modifica SQL histórico.
- `supabase/tests/0421_payment_report_commands.test.sql`: reproducción y
  contrato independiente; fixtures sintéticos, auditoría real0267/0294.
- `scripts/test-payment-report-commands.mjs`: cinco escenarios con conexiones
  concurrentes, bloqueo observado y advisors locales opcionales.
- Esta spec, checklist y los dos handoffs ya allowlisted. El índice se regeneró
  sin diff, porque la spec continúa in-progress.

No se cambió UI, app, tipos, env, Storage policy ni integración externa.
Los comandos aún NO tienen consumidores en la app. No se afirma cerrado el
rechazo de cancelación de producción ni retirado el DML financiero legacy.

### Evidencia ejecutada

- RED: cancelación heredada SQLSTATE42501/0; las3APIs ausentes, exit1.
- GREEN final:400 aserciones, exit0, rollbacktrue. Conserva Storage, tablas,
  historia, funciones, políticas, grants y triggers heredados. Nuevos recibos
  inaccesibles para rolesAPI; ni owner los puede mutar ordinariamente.
- `node scripts/run-sql-tests.mjs`:162 contratos completos, exit0.
- `node scripts/check-schema-rebuild.mjs`:418 archivos;400 desdecero+18ledger;
  aislamiento sobre219tablas públicas/2tenants; recibo privado en contrato0421.
- `node scripts/test-payment-report-commands.mjs --advisors`:5carreras verdes:
  cupo5, replay idéntico, doble confirmación, revocación Portal y financiera.
- SupabaseCLI2.108.0, advisors condb-url exclusivamente127.0.0.1 del contenedor
  propio: un WARN mutable-search-path de touch_updated_at del fixture; ningún
  objeto nuevo señalado. No significa Cloud ni todo el schema sin avisos.
- Suite Vitest:6.096/6.096,532archivos,155,02s. Lint delharness y node--check
  exit0. Docs, numeración357/418,28políticas y CMP pasan.
- No se repitió build/TS/E2E: no hay cambio de runtimeTS/JS ni UI; la evidencia
  build158 de etapa1 se conserva como histórica, no una nueva ejecución.

SHA-256 de0421:
`726C970B4D72246C918308FAAAF02B195F1E444CA1C11A057BC005879D9E2ACA`.

### Privacidad y gobierno del incremento

CORRECTO en el diff: actor y tenant de sesión, rol financiero vigente, motivo
separado de la nota del cliente; recibo sólo conIDs/huella/estado; auditoría
sin monto, nota ni path. Cancelación conserva el original y su comprobante.
Sin purga, nuevo destinatario ni datos reales; no se generaron asientos.
ENCONTRADO: UI de confirmación/motivo, escritores legacy y disposición de
uploads siguen pendientes. NO VERIFICABLE: autenticidad de comprobantes,
consentimientos, plazos específicos, residencia, backups y proveedores reales.
No se certifica cumplimiento jurídico. AUD/MP del comando no certifican el
flujo visible hasta adoptar consumidores/restricción.

### Cierre y continuidad

Audit-close20:50:21UTC: rama propia, índice vacío, cuatro commits por delante
del upstream y2worktrees. El último listado de tareas sólo identifica esta
tarea activa en DTDCargo; ninguna otra ocupa el worktree. Remoto confirmado:
main2a2e81bf y ramaeabb230b. Primarymain22cec0c2 intacto; ramasarchive preservadas.
El intento inicial del auditor usó una ruta ausente; se ejecutó correctamente
desde `C:\Users\Trabajo\.codex\skills\source-command-cerrar\scripts\audit-close.ps1`.

Se retiraron exclusivamente los contenedores sintéticos propios. El fixture
0421 fue comprobado porID/etiquetas y rollbacktrue antes de pararlo; SQL/rebuild
y concurrencia retiraron sus contenedores. No se tocó infraestructura ajena.

El rechazo de push sigue vigente: no se reintentó. Este incremento añade el
quinto commit local; no merge/deploy/Cloud. El worktree activo se conserva.
Siguiente acción dentro de esta misma tarea: adoptar los comandos en acciones
y UI, validar reintentos/confirmación/motivo y preparar la restricción de DML.
No abrir otro frente de auditoría antes de cerrar este lote. La integración y
cada migración alojada conservan autorización específica.

## Actualización · transporte y comprobantes sobre 7f4c1046

Intención: `fix(portal): SDD-0365 — estabilizar comprobantes y validar recibos`.
Ownership: ocho archivos enumerados en la allowlist de transporte de SDD-0365:
dos runtime, dos tests, spec, checklist y ambos handoffs. Índice previamente vacío;
ninguna otra tarea de DTDCargo ocupa este worktree. Main y archives intactos.

El transporte sólo usa tres RPC de sesión, valida entrada/recibo completo y
separa rechazo conocido de resultado incierto sin filtrar SQL. Conserva claves
del consumidor, no reintenta automáticamente ni usa DML o cliente elevado.
El uploader deriva un path del contenido y contexto, nunca del nombre local;
ante error de subida sólo recupera un objeto de bytes idénticos leído por su
path exacto. No sobrescribe, lista ni borra objetos.

Evidencia ejecutada:

- Uploader RED 14 fallos/10 controles; GREEN 24. Transporte independiente:
  222 GREEN, con RED real para año 0000 corregido antes del cierre.
- Suite completa final: 6.342/6.342, 534 archivos, 113,50 s.
- TypeScript sin caché y ESLint de cuatro rutas: exit 0. RSC: 1.590 módulos,
  cero cruces. Docs, gobernanza (28 políticas), CMP y diff-check aprobados.
- Sin nuevo build/E2E/rebuild SQL porque no cambia UI, rutas, SQL ni config.
  Las ejecuciones anteriores conservan su fecha/alcance; no se atribuyen a éste.

Revisión advisory de privacidad: CORRECTO en el diff: mismo bucket privado,
sin nombre original en path, logs de contenido, nuevo destinatario, borrado
ni overwrite; comparación temporal en memoria. ENCONTRADO: formulario aún
genera identidad por envío, escritores antiguos y disposición de uploads no
vinculados pendientes. NO VERIFICABLE: autenticidad, residencia, consentimientos,
retención, backups y proveedores reales. No certifica cumplimiento jurídico.

Este es el sexto commit local sin publicar. No push alternativo, merge, Cloud
ni deploy. La preparación no equivale a idempotencia del flujo visible; sigue
pendiente conectar acciones/pantallas y restringir los escritores heredados.

## Actualización · consumidores sobre 85912909

Estado: ADOPCIÓN LOCAL VERIFICADA · ETAPA 3/RELEASE ABIERTOS.
Intención: `feat(portal): SDD-0365 — adoptar comandos de pago auditados`.
Allowlist exacta de consumidores en la spec; no SQL, paquetes, secretos,
configuración compartida ni escrituras alojadas. Son acciones, consultas,
tres pantallas, dos páginas null-safe, adaptador Portal, ajuste acotado de
ConfirmDialog, cinco suites de prueba y documentos de cierre.

Alta/cancelación/resolución usan sesión y recibos validados. El alta verifica
factura/cliente/tenant y proof_path original antes de recuperar una subida;
replay propio sigue permitido tras cierre de factura/cupo lleno. La UI guarda
un intento en memoria, no en almacenamiento persistente, conserva archivo y
datos, exige motivo y bloquea doble ejecución. Notas y motivos son distintos;
cancelar conserva historial. Error de consulta no representa una lista vacía.

Evidencia:
- 106 focales de acciones/modelo/consultas/comprobante; UI independiente 19.
- Completa 6.401/536 archivos, 141,56 s. Focal final UI+canonical 32/32 después
  de cambios visuales. TypeScript sin caché aprobado.
- RSC 1.591 módulos sin cruces; lint, gobernanza28 y CMP5 ejecutados.
- Build final aprobado: 158 páginas, compilación26,5s y TypeScript66s.
  Postbuild completado, tsconfig restaurado y .next-verify retirado.
  Sin credenciales; avisos de catálogos ausentes no prueban estado alojado.
- Navegador: Portal claro/oscuro a 320/390 px y Studio oscuro a 320 px.
  Confirmación/cancelación sintéticas con teclado, incertidumbre y reintento;
  Portal con motivo500 conserva clave/motivo, recibe éxito y no desborda.
  Overlay, reflow, foco y contraste corregidos; detalles medidos en la spec.
- El upload del navegador quedó denegado por raíces de la herramienta y no
  se reintentó por otra vía. No afirmar un E2E con Auth/Storage o datos reales.
- Fixture/puerto43165 retirados. SQL0421 sin cambio de hash; no nuevo SQL/rebuild.

Revisión independiente del ajuste canonical: sin hallazgos concretos; API,
callbacks, HTD y foco conservados. Privacidad advisory: motivo es texto libre
limitado que puede contener datos personales; no hay logs/destinatarios nuevos.
Retención/residencia/backups/consentimientos no se verifican con estos tests.

Este incremento conserva el séptimo commit local; no se publica mientras siga
el rechazo de autorización. El GO consultado para los seis anteriores no
incluye automáticamente un séptimo. Main, archivos de otras tareas y ramas
archive permanecen intactos; el worktree no se puede retirar.

Siguiente trabajo: inventario real de escritores y lectura de payment_reports,
contrato de restricción y migración separada sólo local, preservando historia
y rename_client_markbox legítimo. Antes de numerar: revalidar todas las refs.
No crear otro frente ni aplicar Cloud/deploy sin el GO nominal correspondiente.

## Actualización · restricción0422 sobre bcf111a8

Estado: TRES ETAPAS TÉCNICAS VERIFICADAS LOCALMENTE · RELEASE ABIERTO.
Intención: `fix(portal): SDD-0365 — restringir escritores y lectura de pagos`.
Ocho archivos propios: migración0422 y su test; bootstrap del test0421;
harness de concurrencia; spec; checklist; este handoff y el de saneamiento.
No app/UI, dependencias, SQL histórico, env, secretos ni datos alojados.

### Resultado y límites

La API conserva sólo SELECT en payment_reports. Se retiran DML, privilegios
auxiliares y EXECUTE de confirm_payment_report legado. La lectura financiera
exige actor activo con rol accounting/admin en la misma membresía del tenant;
el SELECT Portal0420 se preserva exactamente, incluida historia con factura
archivada. Servicio conserva SELECT para los lookups scopeados del servidor.
Comandos0421 y rename0371 siguen con sus cuerpos, ACL y owner existentes.

Preflight valida expansión, identidades, policies exactas, RLS, owners y
recibos privados; postflight comprueba tres policies SELECT y privilegios
efectivos, también los heredados por roles y columnas. No se corrige drift
silenciosamente: el intento se revierte y requiere revisión.

### Evidencia ejecutada

- RED independiente: seis operaciones directas INSERT/UPDATE/DELETE de
  accounting/marketing sin auditoría ni recibos; confirmación directa no
  acredita. LegacyRPC de accounting admite motivo NULL y acredita sin evento.
  Marketing ve reportes completos de otros clientes del mismo tenant.
- GREEN0422: 301 aserciones y 35 derivas rechazadas, rollback de catálogo y
  filas; fixture_rolled_back=true. Test0421: 400 aserciones, rollback=true.
- Suite canónica: 163 contratos SQL, exit0 y rollback total.
- Rebuild final: 419 migraciones, 401 schema +18 sólo-ledger; aislamiento de
  219 tablas públicas con dos tenants sintéticos, exit0.
- `node scripts/test-payment-report-commands.mjs --restriction --advisors`:
  cinco carreras verdes (cupo, replay, doble confirmación, revocación Portal
  y financiera). Supabase CLI2.108.0 sólo en127.0.0.1; una advertencia del
  helper heredado/stub touch_updated_at, ninguna en objetos nuevos.
- Revisión independiente: corrigió dos hallazgos concretos reproducidos
  (current_studio_role/assert_studio_role y MAINTAIN heredado). APPROVE
  condicionado al GREEN focal, ya satisfecho; sin otros hallazgos pendientes.
- SQL0421 conserva SHA256
  `726C970B4D72246C918308FAAAF02B195F1E444CA1C11A057BC005879D9E2ACA`.
- No se repitieron TS/Vitest/build/navegador: no cambia runtime de aplicación.
  Su evidencia anterior no se atribuye a este incremento SQL.

Compatibilidad probada: alta/cancelación/confirmación/rechazo y replay bajo
ACL final; auditoría fallida revierte datos/saldo/recibos; Portal propio,
principal dual, membresías múltiples y revocadas; ningún cambio en buckets,
objetos, funciones, triggers, recibos ni ACL ajenas. Rename normal conserva
ID, comprobante, alias, lectura y replay. Deuda heredada registrada aparte:
rename con reporte sobre factura archivada falla23514 antes y después por
trigger0195; no se arregló ni se atribuye a0422.

### Gobierno, cierre y continuidad

SGE/AUD/MP: cumplimiento acotado al contrato y conservación probados; la matriz
está en la spec. No hay purga, nuevos destinatarios ni datos reales. Retención,
residencia, autenticidad, backups y disposición de comprobantes no se verifican
con estas pruebas. No se certifica cumplimiento jurídico ni todo el módulo.

Auditor de cierre22:32:07UTC: rama propia, índice inicialmente vacío, HEAD
bcf111a8, siete commits locales previos, upstream correcto y dos worktrees.
Se agregan sólo los ocho archivos allowlisted; este incremento será el octavo.
Main22cec0c2 y ambas ramas archive permanecen intactos. Los contenedores de
contratos, rebuild, concurrencia y reproducción se retiraron; no se tocó
infraestructura ajena. Recuento de checklist: 46 hechas,55 pendientes,101 total.

Push sigue sin autorización después del rechazo: no se reintentó por ninguna
vía. El GO consultado para seis commits no cubre automáticamente este lote de
ocho. No merge, deploy ni migración Cloud. El worktree no se elimina mientras
contenga trabajo sin publicar/integrar. El objetivo y la spec siguen abiertos.

Siguiente gate: autorización exacta de publicación del lote y CI en su SHA;
preparar release0421 → consumidores/smoke →0422/smoke, con GO nominal de cada
migración y autorización separada de integración/deploy. No iniciar un nuevo
barrido para sustituir estos gates ni marcar Cloud por la evidencia local.
