# BCV diario · VES por 1 USD

SDD-0569 · 2026-10-21. **EN PROGRESO: respaldo parcial en PR #317 DRAFT.** La instalación congelada, el baseline previo de cron/UI y el bloque acotado de contexto HTTP/persistencia están medidos; aceptación funcional general, revisión visual, canónica y conocimiento siguen pendientes. Agenda generada localmente; activación y producción no están autorizadas. El handoff propio conserva contratos y evidencia por fase; esta nota no autoriza operar el servidor.

El objetivo es guardar únicamente la cotización oficial cuyo día valor sea exactamente hoy en America/Caracas. El formulario de Tasas de cambio conserva el respaldo manual. Una fecha futura se vuelve a consultar cuando llegue su día; una fecha pasada no se copia como hoy. No hay historial durable de consultas ni disponibilidad diaria garantizada.

## Fuente, fecha y precisión

La fuente es la constante `https://www.bcv.org.ve/`, con TLS normal, sin cookies/credenciales ni URL elegida por el caller. El parser inerte parse5 toma el USD y la Fecha Valor del bloque oficial único; valida atributo, texto visible, calendario y offset IANA. Se almacena currency VES/source bcv, en unidades VES por USD. No se importa CNY ni un indicador ajeno.

La tasa conserva texto decimal completo hasta ocho fracciones: >0 y <1e12. No se redondea un dato oficial no representable. Ceros finales equivalentes no crean una corrección, ni cambian note/set_at. Las lecturas usan `rate::text`; el CAS compara la columna numérica con el texto y preserva el timestamp observado, incluidos microsegundos.

La fuente tiene20s incluyendo cuerpo y hasta dos redirects estrictamente canónicos; el límite es1MiB realmente leído/descomprimido. Una obtención por invocación, sin retry interno ni copia vieja tras un fallo. El deadline de toda la corrida es50s con señales también hacia DB y `.retry(false)` en cada builder dedicado. maxDuration60 es metadata de plataforma y no sustituye ese deadline.

## Acceso, scope y ensayo

- Auth exclusiva por `Authorization: Bearer` y `CRON_SECRET` existente, con comparación canónica. Secreto ausente/incorrecto o query inválida se rechazan antes de DB/red. No registrar el header ni secretos.
- `BCV_RATES_ENABLED=false` por defecto. Petición normal OFF devuelve DISABLED y cero IO; un archivo de agenda no activa el flag.
- `BCV_RATE_TENANT_IDS` es lista explícita de UUID únicos, máximo25. Se valida solo SELECT id y cobertura exacta. No scope por caller ni todos los tenants por defecto; configurar IDs reales exige decisión operativa específica.
- Único ensayo: exactamente un `dryRun=1`. Ausente significa normal. Vacío, true,0,01, espacios o repetición se rechazan. El modo es inmutable y el guard de persistencia exige además enabled&&!dryRun.
- Ensayo autenticado también puede leer con OFF, pero **exige capability0501 íntegra antes del fetch/candidata**. Si falta, cero fetch, DML y auditoría; contrato SQL no disponible. Nunca se anuncia una candidata como registrada.

El cliente servidor es dedicado y sin JWT humano. No usa la RPC manual, no cambia el cliente admin global y no manda credenciales Supabase al BCV. Constructor/IO ocurren después de los gates de acceso/modo aplicables.

## Persistencia y estados veraces

Se valida scope y snapshot íntegro BCV/VES/hoy antes de obtener la fuente. Error/null/duplicado/tenant ajeno/count truncado/shape inválido no son ausencia. El transporte dedicado observa HTTP original antes de los workarounds404 del SDK2.106.1:404[] o vacío no pueden convertirse en un200[] válido. Un200[] con count0 auténtico es un caso distinto.

Con fecha exacta de hoy, INSERT directo sin upsert cuando falta la fila. Corrección por id+tenant+moneda+fuente+día+rate+set_at observados, con set_at nuevo explícito y representación íntegra de una fila. Si el reloj da el mismo instante del token observado, no se fabrica otro timestamp: se informa conflicto. UNCHANGED exige otra lectura íntegra y no envía UPDATE. Conflicto/unique solo permiten relectura, nunca forzar otra escritura.

| Estado/reason | Significado y recuperación |
|---|---|
| DISABLED | Normal OFF; no DB ni fuente. No acredita agenda instalada. |
| CANDIDATE | Ensayo completo de lectura/fuente; cero persistencia. |
| COMPLETED | Cada tenant del scope quedó confirmado en una categoría segura; no es prueba de autoría para reconciled. |
| WAITING_FOR_VALUE_DATE | Fecha oficial futura; esperar al próximo tick autorizado. |
| NO_TODAY_QUOTE_IN_RESPONSE | El origen respondió otra fecha pasada; respaldo manual, sin inventar calendario BCV. |
| SQL_CONTRACT_UNAVAILABLE | Falta/contexto/drift/caché de capability. Antes del fetch: ninguna candidata. Antes del próximo DML: detener pendientes. |
| SCOPE_UNAVAILABLE / SNAPSHOT_UNAVAILABLE | Lectura incompleta o fallida; corregir contrato/configuración, no tratarla como fila ausente. |
| SOURCE_* | Fuente no válida/disponible/acotada. No cambiar TLS, host ni parser por heurística para pasar. |
| DAY_CHANGED / DEADLINE | Detener pendientes sin refecha ni ampliar presupuesto. |
| WRITE_CONFLICT / WRITE_FAILED | No se confirma ese registro; conservar efectos anteriores y detalle seguro. |
| WRITE_UNKNOWN | Mutación enviada sin certeza y relectura no concluyente; detener las restantes. No repetir ni deducir rollback por HTTP/abort. |

Los conteos separan inserted, corrected, unchanged, reconciled, conflicts, failed y unknown; más notAttempted para scope pendiente. deferred es el subconjunto pendiente que se difiere por corte/espera/error de la corrida. No sumarlo otra vez al total. Cada tenant tiene una sola categoría de resultado o pendiente. No hay transacción global entre tenants ni exactamente-una-vez, frescura editorial o detección universal ABA.

Reconciled significa que una lectura acreditó la candidata presente, no quién la escribió. Una respuesta perdida después de COMMIT puede haber guardado tasa y evento; aborto no demuestra que DB ya terminó. Un estado parcial conserva confirmados previos. Las respuestas/logs no deben incluir tenant IDs, filas, HTML, auth, SQL o mensajes internos.

## Auditoría0501 y prerequisito de escritura

0495 se conserva aplicada e inmutable.0501 propone solo reemplazar el cuerpo de `audit_fx_rate_change()` para la rama verificada de INSERT/UPDATE real BCV/VES/SYSTEM: rol nativo service_role, login HTTP esperado, claims JSON válidos sin sub, auth.uid NULL y set_by NULL. El gate por HTTP real dentro del definer es obligatorio; current_user allí representa al propietario. No sustituir contexto por note/header/claim aislado.

DB genera el motivo fijo de carga o actualización y source job. La cadena real0267/0294, actor system/NULL, evento/correlación y sensibilidad se conservan. Before/after tiene solo currency/rate/valid_on/source; note/set_by quedan fuera. Un motivo transaccional ajeno no vacío se rechaza para evitar que0294 sustituya el motivo fijo. La tasa y el evento comparten sentencia/transacción; el fallo real del append debe revertir ambos.

`bcv_rates_write_capability()` es STABLE/INVOKER, sin argumentos, EXECUTE service-only. GET nativo acepta solo version1/readytrue y comprueba contexto/huellas fijas/owner/seguridad/trigger/cadena. Se exige antes de fuente y cada DML. Es compatibilidad instalada, **no lock/lease contra DDL posterior**. Tampoco distingue al cron de otro poseedor legítimo de las mismas credenciales de servicio.

La nota de fila guarda solo URL/retrievedAt/hash/día sanitizados y<=500. No sustituye motivo auditado ni promete historial de notas. Manual/operacion/CNY, prioridades y tasas de documentos congelados permanecen intactos; sus deudas históricas no se reclasifican como resueltas por este job.

## Agenda e instalación futura, no realizadas

Entrada generada localmente después del baseline: `5 * * * *`, ruta única `/api/cron/bcv-rates`. El script nativo produjo 21 entradas y su check pasó; no hay instalación de cron. Son 24 invocaciones nominales/día, no cuota global exacta ni 24 requests HTTP garantizados por los redirects/repeticiones. Sin Vercel/Actions/scheduler paralelo. El generador y el crontab del servidor se mantienen como fuentes canónicas.

El aviso de Tasas distingue una BCV VES completa de hoy de manual/operación, anterior, futura o incompleta. Muestra la última fecha/fuente recibidas cuando son completas; null no demuestra que no exista tasa ni que haya fallado el cron. El formulario manual conserva par, tasa, fecha y nota. La autoría y sus casos DOM todavía no prueban teclado, contraste o disposición real.

La futura operación requiere, por separado: checkpoint/PR revisados; aprobación nominal de Sam para0501 conforme al runbook productivo; preflight/postflight/caché HTTP y login real verificados; configuración/scope aprobados con flagOFF; ensayo estricto sin mutación; aprobación concreta de recreaciónweb/instalación de agenda y activación. La existencia de esta documentación o una PR DRAFT no concede ninguno de esos pasos.

Rollback preferido: app anterior con0501 compatible conservada. Retirar SQL requiere jobOFF y quiescencia demostrada de requests/transacciones, revisión de catálogo, restauración exacta del cuerpo anterior y retiro exclusivo de capability en transacción, con recarga. No basta abort o esperar50s. No revertir0495/0267/0294 completas, borrar eventos job ni reescribir razones históricas. No se garantiza protección frente a administrador que cambie DDL entre GET y DML.

## Validación local y límites de evidencia

Instalación propia congelada y baseline previo de cron/UI: PASÓ, 2 archivos y 12 casos sin omisiones. GO02: PASÓ contexto acotado PG17.11/PostgREST14.17/SDK2.106.1 con siete controles, 24 rechazos DML sin efectos y dos humanos legítimos user/rpc; PASÓ focal persistencia 0501, 10/10 sin omisiones y cuatro mutantes funcionales. Los fallos de preparación y el diagnóstico omitido se conservan separados en el handoff.

GO03 reprodujo F01 medianoche, F02 vínculo Fecha Valor, F03 cancelación diferida y S01 Content-Range: 23 fallos funcionales entre 129, sin ausencias/imports como ROJO. Se corrigieron después de medir. El residual F02 de etiqueta con markup inline tuvo su propio ROJO 1/46; parser/fuente 79/79, sync ampliado 75/75 y UI DOM 19/19 PASARON. La variante F01 de fracción .001 ya rechazaba en el candidato y es regresión conservada. La conservación del formulario tras error se reparó con listener nativo reset, después de un intento delegado insuficiente; los errores de preparación se preservan separados.

HTTP full 02 PASÓ 18 controles y 27 escenarios, además de los 26 negativos de contexto: dos sesiones DML reales, precisión extrema hasta auditoría, CAS/relectura, errores de transporte/ACK perdido, reconciliación/UNKNOWN, ensayo y rollback de auditoría; manual/operacion/CNY/documentos congelados/tenant ajeno intactos. Full 01 falló preparación por colisión de fixture, no producto. Recibos/SHAs y omisiones en el handoff. Quedan UI real, mutantes TS, regresiones/gates, matriz B/R integral y canónica posterior; no conformidad global por estas focales.

Driver durable del gate pequeño: `node scripts/tests/bcv-rates-postgrest.mjs --context-only --evidence <directorio-nuevo-externo>`, solo con turno explícito del Director. SetupCOMMIT y contratoROLLBACK se separan; imágenes/versiones efectivas, recursos propios y cleanup se registran. Un gate pequeño aprobado no se presenta como aceptación completa.

La fuente pública se consultará una vez desde el fetch implementado cuando exista turno/autorización; las observaciones oficiales archivadas son fixtures fechadas, no ejecución del importador. Prueba local no acredita VPS, cron instalado, carga de datos reales o disponibilidad diaria. Verify/CI/PR/merge/release/conocimiento se reportan separados en el handoff propio.
