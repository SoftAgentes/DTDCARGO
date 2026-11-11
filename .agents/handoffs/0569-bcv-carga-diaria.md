# SDD-0569 · carga diaria oficial BCV · handoff Worker

## OBJETIVO ORIGINAL

Cargar exclusivamente VES por 1 USD de la fecha valor igual a hoy America/Caracas, con decimal completo, control de concurrencia e incertidumbre, auditoría atómica SYSTEM/job con motivo DB fijo y respaldo manual. Reutiliza SDD0569. Desarrollo local y eventual PR DRAFT; sin producción, merge ni deploy.

## ADOPCIÓN Y PROPIEDAD

- Estado: EN PROGRESO · GO05B sobre ce7e628e terminó FALLÓ e INCOMPLETO: test falló en sus dos intentos nativos y ledger crítico quedó omitido, 16/17 pasos ejecutados. Build PASÓ; E2E PASÓ CON AVISO NATIVO, con original conservado y límites abajo. GO04B conserva su fallo histórico y GO05A su focal 3/3. Producto/pruebas 390227699 y paridad fd09677f8 intactos. Conocimiento NO EJECUTADO y sin GO. Única sesión escritora /root/revision_bcv_prevuelo, rol Worker; claim retenido y turno pesado devuelto. Fuente pública positiva NO DISPONIBLE por TLS; sin aceptación global ni producción.
- TaskID: `0569-bcv-carga-diaria`.
- Owner: `worker-0569bcv-01a15a4e-ddf0-7d82-8656-d9dc56b58468`.
- Raíz: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0569-bcv-carga-diaria`.
- Rama: `codex/sdd-0569-bcv-carga-diaria`.
- Base literal: `1905aef75680a80055621cffd717198915d089f9` (D C3 aceptado).
- Aislamiento creado por harness start con --from exacto; claim nuevo adquirido y guard --owner PASÓ. No traslado de trabajo ajeno.
- Evidencia propia: `C:/tmp/director-traspaso-20261020/0569-bcv-validation/`, creada nueva tras verificar ausencia. Recibo `preimagenes-31.json`: 13 rutas existentes, 18 ausentes, 0 diferencias frente a D; ausencia no es control rojo.
- Allowlist exacta acumulada: 32 rutas por addendum Director d73e2afce065977664eb71a6ec8afe268138015b66542b5ae1a460fd4b882d51, copiado íntegro abajo. Unión31 + únicamente infra/dtd-cargo/.env.example; 32 preimágenes sobre HEAD62 verificadas, guard PASÓ. La fuente31 original se conserva intacta como historia; no ruta33 implícita.

## COMPLETADO

- Adopción del rol Worker y lectura de activación, contrato, addendum y peer independiente completos; preparaciones anteriores conservadas como evidencia estática.
- Raíz/rama/base/ownership concretos; árbol inicial limpio. Cron/UI/package/lock se conservaron en preimagen D hasta medir el baseline bajo turno.
- GO01: instalación inicial congelada PASÓ una vez; baseline nativo de cron/UI PASÓ con2archivos/12casos/0omisiones. El primer shim falló antes de Vitest; el intento válido usó Node→Corepack.js. No se repitió bootstrap.
- GO01B: promoción parse5 directo8.0.1 con delta mínimo package+1/importador+3, resto byteidéntico. Su enlace offline falló en preparación por metadata@next/env; sin fallback ni ROJO funcional. GO01C: enlace normal congelado e importación mínima parse5 PASARON;31fuentes/lock/manifiesto sin reescritura. Recibos separados abajo.
- Contratos originales íntegros conservados al final de este handoff antes del primer cambio de producto.

## VALIDACIÓN

| Comprobación | Estado / alcance |
|---|---|
| Harness start/claim/guard | PASÓ: aislamiento/owner/base exactos. Es metadato de trabajo, no validación de producto. |
| Preimágenes31 | PASÓ: 13 existentes/18 ausentes/0 diferencias. Recibo externo con blobs y SHA256 de archivos. |
| Preimágenes32 GO05A | PASÓ: 32 existentes sobre HEAD62; infra 37d1bf35, raíz 6d8599ca y test 78c80a8c coinciden con el addendum. |
| Paridad de plantilla GO05A | Cinco líneas literales en infra: OFF=false/scope vacío y tres comentarios. Resto de bytes exacto; focal original PASÓ 3/3 sobre fd09677f8, sin omisiones ni retry agregado. |
| Reserva0535 | Inventario nativo PASÓ:502refs+worktrees; reserva local9591b2436 y SQL0535 publicados solo en rama DRAFT. Aplicada únicamente en fixtures propias; nunca producción. |
| Nuevos módulos | AUSENTES inicialmente; no se ejecutó import/ENOENT como rojo. |
| Instalación congelada, baseline cron/UI | PASÓ GO01: bootstrap único, baseline válido2archivos/12casos/0omisiones sobre preimagenD. Primer shim falló en preparación antes de pruebas; recibo separado. |
| Promoción/importación parse5 | PASÓ autoría mínima9cd35b1ef y enlace/importación GO01C: versión efectiva8.0.1 desde árbol propio,31fuentes sin cambios. Promociones offline GO01/01B FALLARON PREPARACIÓN por metadata, sin ROJO funcional ni red añadida. |
| SQL/HTTP/contexto/SDK | PASÓ gate acotado GO02: PG17.11/PostgREST14.17/SDK2.106.1, siete controles y 26 intentos DML: 24 rechazos sin efecto y 2 humanos legítimos user/rpc, nunca job. No cubre el importador completo ni transporte amplio. |
| Focal persistencia 0535 | PASÓ 10/10, 0 omisiones en f1061d2ea: contexto inicial/restaurado exigido, compatibilidad 0495, cuatro mutantes funcionales y rollback poscreación/catálogo en la misma DB. Intentos previos conservados, no sumados a cobertura. |
| Parser/source/sync/route/cron y UI DOM | GO03: ROJO inicial 23/129; reparación y positivos aprobados dentro de focal 176/177 con un fallo B18. Residual F02 ROJO 1/46 → parser/fuente 79/79 PASÓ. Sync ampliado 75/75 PASÓ; UI DOM 19/19 PASÓ. Intentos/SHAs y límites abajo; no sumar corridas solapadas. |
| HTTP funcional ampliado | PASÓ HTTP full 02 en 16eab3620: 18 controles, 27 escenarios y 26 intentos DML (24 rechazos y 2 humanos legítimos), con dos sesiones DML reales, ACK perdido, auditoría/rollback e aislamiento. Primera full FALLÓ PREPARACIÓN de fixture. |
| UI real | PASÓ UI07, 53 controles/14 PNG sellados; Director inspeccionó ocho. React DOM cliente con componente/CSS/fonts reales, Edge155, 390 táctil/coarse/1 touch, cinco48px, teclado/pending/error/éxito/reflow320/zoom nativo2x. No SSR, dispositivo físico, AT o certificación A11Y global; PNG de zoom son viewport parcial por scroll. UI01–06 conservados, incluida NC táctil real reparada en7b534e047. |
| Mutantes TS y readiness | Seis mutantes TS detectados por siete aserciones seleccionadas, restauración exacta; M04 CAS es fixture estricta, concurrencia real acreditada aparte por HTTPfull02. Cinco SQL funcionales: cuatro GO02 y readiness constante nuevo, reapproval solo fixture. Primera selección R10 cero/11 omitidos = NO EJECUTADO; omisiones no sumadas. |
| Suplementos B5/B12/R14 | Suplemento01 conserva FALLÓ global de preparación de retirada, con casos parciales aceptados: PATCH/append23514 y fila/eventos/contexto íntegros iguales; tres cruces de medianoche con reloj app controlado/COMMIT real; bloqueo151→166,55P03/ROLLBACK/catálogo exacto e instalación positiva. Retirada aislada02 PASÓ: locks reales, historia job conservada y app cierra antes de fuente/DML. |
| B15/R13, regresiones, tipos/lint/gates | Cuatro fases IO seleccionadas PASARON (76 omitidos) y tres particiones de3tenants PASARON (80 omitidos), SDK real/transporte y reloj ficticios. Regresiones manual/conversor/secreto69/69. Typecheck delta03 PASÓ sobre390; delta02 no inició Node por ExtraInput ausente. Lint delta0errores/3warnings; cinco avisos del lint anterior conservados. Seis gates iniciales PASARON; conjunto01 FALLÓ por declaración, reintento único beaa5350 PASÓ0ROJO/3AMARILLO/3homónimos. |
| Fuente pública implementada | NO DISPONIBLE: una invocación/1 intento GET TLS normal, 2026-10-21T14:54:05.174–05.824Z, UNABLE_TO_VERIFY_LEAF_SIGNATURE antes de respuesta,0bytes/sin hash de cuerpo completo/DB0. No acredita obtención oficial positiva ni disponibilidad operativa. Sin retry/fallback/TLS alternativo. |
| Matriz y canónica | Matriz B1–B19/R1–R14/SGE12 local. GO05B exit 1: test FALLÓ en ambos intentos nativos, 16/17 ejecutados y ledger crítico OMITIDO. Build PASÓ; E2E PASÓ CON AVISO NATIVO: 176 esperados, 20 omitidos, 2 flaky, 0 inesperados. Freeze 6447 entradas/0 diferencias y 11 extras/0 diferencias, slices solapados. Director aceptó integridad y recursos; no aceptación global BCV. GO04B conserva FALLÓ/INCOMPLETO. |
| Graphify/semántica/Archify/preview/publicación | NO EJECUTADO; único ciclo local tras documentos estables y turno del Director. Sin bóveda compartida. |
| Producción/ledger/migración/cron instalado | NO EJECUTADO y no autorizado.0495 aplicada no se repite;0535 exige OK nominal futuro. |

## PRIMER GATE PREPARADO PARA TURNO PESADO

1. Completado bajo GO01/01B/01C: Node24.20.0/pnpm12.14.0 reales, instalación propia congelada, baseline cron/UI antes de alterarlos y promoción/importación parse5 directa8.0.1. No repetir ese baseline por documentación.
2. Fixture efímera PG17.11 y PostgREST14.17 propios/loopback; verificar versiones efectivas. Setup durable COMMIT separado de contrato0495 original ROLLBACK. Cargar cadena real0267/0294/0495 sin editarla y contrato nuevo0535.
3. Gate pequeño: observar dentro del trigger SECURITY DEFINER role GUC/current_user/session_user/claims; servicio sin sub positivo, humano positivo para auth.uid, anon/authenticated y servicio con sub/contexto ambiguo negativos. Current_user del definer no acredita caller. Si no se demuestra, detener esa parte y devolver evidencia; sin fallback a claim aislado.
4. Capability real GET service-only y huellas/ACL/preflight/drift; dryRun también la exige antes de fetch/candidata. Verificar motivo DB fijo/source job y rollback real de tasa si append falla. GET no inmoviliza DDL; no exclusividad del cron frente a otro poseedor legítimo de servicio.
5. Después ampliar B1–B19/R1–R14 y transporte SDK real404/503/truncado/ACK perdido, focales/regresiones/mutantes/UI. Checkpoint por SHA para revisión antes de GO canónico separado. No afirmar estabilidad por una pasada.

## COMMITS

Reserva local `9591b2436033f1200ef71a79bb4e9ce67f10fbac`; candidato ligero `1ff0bbee4`; cleanup driver `01e830bdf632052c0f798e3de737b4336e949c55`; proxy loopback propio `93ac1a33f47bdeb4c4f85ffa6a8627e113092d1a`; promoción mínima parse5 `9cd35b1ef252b477969a3c50fdda0bd47c3da04e`. Ninguno constituye checkpoint funcional integral. Publicación solo después de checkpoint funcional revisable.

GO05A: commit de ejecución `fd09677f83908c5ba0a9ea033220e37e1308d1af`, cinco líneas de plantilla y documentación de alcance/evidencia. Cierre documental posterior separado; no nueva prueba por documentación.

## PR / BRANCH

Rama propia indicada arriba. Publicación parcial autorizada por el Director el 21 de octubre después de revisar GO02: [PR #317 DRAFT](https://github.com/SoftAgentes/DTDCARGO/pull/317), apilada sobre `codex/sdd-0576-fechas-caracas-movil`, base C3 `1905aef75680a80055621cffd717198915d089f9`. Head inicial publicado `021868d743b868c4e4f22155ccb4ce9c21da3031`; relectura inicial confirmó OPEN/DRAFT, body exacto y 25 rutas dentro de 31. No había checks reportados en ese corte; no equivale a CI verde. Es respaldo parcial; no aceptación completa, main, merge, auto-merge ni deploy. Las actualizaciones posteriores del mismo alcance están autorizadas sin pedir otra vez.

## PENDIENTES DE ESTA TAREA

- GO05B quedó FALLÓ e INCOMPLETO. Director aceptó su integridad y recursos y autorizó sólo actualizar estos tres documentos y el mismo DRAFT317. Cuatro fallos de Portal, fuera de las 32 rutas, tienen causa NO DETERMINADA y diagnóstico separado del Director; no se absorbe su reparación. No otra receta, focal, GET o conocimiento en este bloque. Claim retenido hasta cierre coordinado.
- Obtención pública positiva NO DISPONIBLE por TLS; la única lectura autorizada ya se consumió. No reparar cadena remota, cambiar TLS ni reintentar sin otro encargo concreto. No afecta la atribución de pruebas locales ni acredita operación disponible.
- Documentos finales y ciclo único local de conocimiento después del D estable y turno específico: preparación 02 UNBOUND, sin GO y NO EJECUTADA. Store y graphify-out ausentes; no crear exclusiones por una existencia supuesta. Graphify estructural/semántica, Archify, preview y revisión visible de Obsidian se reportan separados. Integración y bóveda compartida no autorizadas.
- Ledger migrations-applied sigue NO EJECUTADO por credenciales ausentes; los 20 omitidos E2E y el aviso de salida del proceso no equivalen a cobertura completa. Producción0535, cron/flags/scope/env reales, merge/deploy siguen excluidos y nominalmente futuros.

## FUERA DE ALCANCE DETECTADO

- Main conserva archivos no rastreados preexistentes observados al iniciar; no se copian, abren ni limpian en esta tarea.
- Brechas manuales históricas de auditoría no se absorben; no tocar0495/0267/0294, append global o UI manual por inercia.
- GO05B: cuatro fallos de Portal en supplier-flow/standard-format, fuera de las 32 rutas. Causa NO DETERMINADA; el Director coordina diagnóstico separado, sin reparación ni ampliación de esta tarea.
- No producción/Supabase real/VPS/cuentas/pagos/PII/secretos/env reales, configuración o instalación de cron, flags reales, CNY, historial durable, dashboard, documentos congelados, permisos humanos nuevos o rutas fuera de las 32 autorizadas.

## HANDOFF AL DIRECTOR

GO05B sobre ce7e628e terminó FALLÓ e INCOMPLETO, exit 1 y 16/17 ejecutados; ambos intentos nativos de test fallaron y el ledger crítico quedó omitido. Director cotejó 6447 entradas antes/después/actuales sin diferencias, 11 extras iguales, streams y original E2E sellados, 772 identidades conocidas con 0 vivas/0 UNKNOWN y recursos propios ausentes. Aceptó integridad y recursos y quedó libre el turno pesado; claim retenido. GO04B y GO05A conservan sus resultados históricos. Sólo se autorizaron tres documentos y respaldo en DRAFT317; conocimiento sin GO, sin aceptación global BCV, integración ni producción. Este estado actual prevalece sobre los pendientes temporales de los cortes históricos conservados abajo.

## RECIBOS GO01/GO01B/GO01C · 2026-10-21

En `C:/tmp/director-traspaso-20261020/0569-bcv-validation/`: GO01 `go01-instalacion-baseline-01/go01-close.json`, SHA256 `7c1789d2cc8450ecaea97d2a434bf9ffb38e4becd6fb601299733f12ad4e21f0`; GO01B `go01b-promocion-importador-01/go01b-close.json`, SHA256 `59e0f3a1cc5003b731675b7dfc98294093895cd764ff781c565aa444955d14fb`; GO01C `go01c-enlace-congelado-01/go01c-close.json`, SHA256 `f55394987be013be6609e5452c780a39053bef3cd12cb12002c8ace162293c40`.

GO01 conservó por separado el shim previo fallido y la promoción offline sin metadatafsevents. GO01B conservó su único enlace offline fallido sin metadata@next/env y no trató el módulo ausente como ROJO. GO01C permitió registro para metadata/artefactos bloqueados:936entradas pasaron la política, resolución omitida, enlace5.5s e importación mínima8.0.1 PASARON. Advertencia pnpm12 sobre `pnpm.onlyBuiltDependencies` ignorado conservada; sin cambiar config/política. Su primera captura amplia no produjo recibo completo/salida de sesión retenida; la captura acotada02 de31rutas sí quedó completa. No hubo gestor en la captura fallida.

Los tres turnos fueron devueltos expresamente. Cotejos residuales propios:0identidades/descendientes observables vivos,0puertos/contenedores iniciados/terminaciones. GO01C duró6.2s y no tuvo snapshot durante la corrida; el recibo declara ese límite. Claim se conserva para autoría ligera. Módulos/testsBCV, SQL/HTTP/Docker/PGlite, tipos/build/verify, browser, conocimiento y fetch implementado siguen NO EJECUTADOS.

## CHECKPOINT DE AUTORÍA LIGERA · 2026-10-21

Registro anterior a GO01/01B/01C, conservado como estado fechado; los recibos superiores lo actualizan.

Autorados tipos/decimal, parser estructural y3fixtures mínimas; fuente acotada; factory/transportSDK dedicados; sync/route y casos funcionales preparados.0535 y contrato adicional/PGlite conservan cadena real con preflight/huellas/ACL y motivos nuevos acotados. Manifiesto/baseline/env.example/runbooks registran cierre propio sin cambiar gates. Driver context-only está preparado, sin ejecutarse; todavía falta ampliar HTTP de transporte/concurrencia/incertidumbre después del gate de contexto.

No se modificaron cron/UI/package/lock porque esperan baseline/instalación bajo turno. Ningún test/suite, Node de producto, SQL/Docker, navegador, fuente remota desde implementación o conocimiento se ejecutó en esta fase. Las autorías todavía pueden contener defectos de preparación/comportamiento: no se declaran conformes ni verdes. El primer bloque reproducible quedó en `C:/tmp/director-traspaso-20261020/0569-bcv-validation/primer-turno-preparado.md`.

SQL/contexto: la candidata role GUC+claims+auth.uid/login necesita HTTP real. Solo después se amplía aceptación. GETcapability no inmovilizaDDL; uso de servicio no atesta cron exclusivo; timestampCAS no promete ABA universal. Se conserva UNKNOWN y no se repite write ante falta de certeza.

Dos incidentes de preparación corregidos, sin ejecución de producto: PowerShell pipe inválido al formatear metadatos y rechazo de apply_patch por Delete+Add de la misma ruta. La receta externa los conserva; no son ROJOS ni mutantes detectados.

## PREPARACIÓN GO02 · 2026-10-21

Estado anterior a ejecución; se conserva como registro fechado. Los recibos de cierre siguientes lo actualizan.

GO02 `40d640bd1cc93506268899f861fefe034e5cd474ec03e2e4fb54f4cff07d16e6` concede gateHTTP pequeño y, solo tras positivo, focalpersistencia0535. Nuevos oráculos P2 autorados:13contextos negativos con INSERT/PATCH reales y lectura de tasa/eventos/contexto por entidad; sub humano válido user/rpc o rechazo, nunca job; mutante del guard de sub con huellas reaprobadas solo en fixture; instalación que falla después de ambosDDL y ROLLBACK explícito con comparación íntegra de pg_proc/tabla/triggers/cadena y capability ausente en la mismaDB. Todavía no son resultados ejecutados.

Peer fuente `c1b4bb846fcfec5efec8d6095764778438ec6ba90bebbb4c211b9ecca0d76749` leído íntegro: F01 medianoche, F02 asociación de FechaValor y F03 cancelación diferida son P2 por lectura. Parser/source conservan el candidato93ac/9cd; primero oráculos y ROJO válido en otro turno funcional antes de corregir producto. Incluye pendientes comprimido real>1MiB,200tras1/2redirects, abort durantebody, presupuesto acumulado y teardown del deferred. GO02 no ejecuta esas focales ni cron/UI/canónica/conocimiento.

## CIERRE GO02 · 2026-10-21

Paquete externo `C:/tmp/director-traspaso-20261020/0569-bcv-validation/go02-cierre-01/go02-close.json`, SHA256 `b576deafdf8ab090696929d79fed5e19f1b60647e86a9d56b47564794e1635dc`. Turno pesado devuelto expresamente; claim conservado para autoría ligera. No selección 06 ni pruebas posteriores por documentación. Corrección de emisor be383666e se restituyó en 2cd0250fc sin ejecución entre ambos; árbol de producto/pruebas idéntico a f106 antes de este cierre documental.

HTTP01 conservó siete controles y 26 negativos parciales, pero FALLÓ global por consultar el Set antes del evento close. Reparación fa2f0395 espera cada close y mantiene cero exigido. HTTP02 PASÓ exit 0: recibo `http-context-02/receipt.json`, SHA256 `aedb2f010fa9864f2ef7825f269cda3cbcd05c67f09e3c4bb415e9065e7b79d6`. Dentro del definer se midieron role service_role/current_user postgres/session_user authenticator/auth.uid NULL y claims sin sub; evento real SYSTEM/job, motivo DB y cuatro campos. 24 DML rechazados sin cambios y 2 humanos legítimos user/rpc, nunca job. CAS textual y microsegundos reales. GET no es lease ni atesta exclusividad del cron.

Focal01: 5/10 pasaron, cinco casos no alcanzaron oráculo por permisos de recibo temporal. Focal02: misma cobertura incompleta; SET ROLE postgres rechazado sin nuevos grants. Diagnóstico03: 1 falló y 9 omitidos; contexto user/session authenticator, role none, authorization vacío, superuser off tras RESET; no se suma. 617b67cd captura/exige login inicial postgres/superuser on y restaura nominalmente la misma autorización antes de leer recibos. Focal04: 7/10 pasaron; oráculo temporal acoplado a sufijo +00 corregido en f1061d2ea por igualdad del instante timestamptz exacto con seis microsegundos, sin configurar zona. Focal05: 10/10 PASARON, 0 omisiones, 11.97 s; log SHA256 `ef104af239c431b82ab19a5ad0aaa954968cb4c9430a3ae35057f36cb84eba14`.

El contexto inicial/restaurado fue capturado en SQL y exigido por las aserciones de `bcv-persistence.migration.test.ts:94–95`; console.info no apareció en el log nativo. No reconstruir un literal ni repetir por impresión. R2 provocó error después de reemplazar/crear, ejecutó ROLLBACK y comparó OID/owner/ACL/prosrc/tabla/triggers/append exactos y capability ausente en la misma DB. Cuatro mutantes llegaron a sus oráculos funcionales con huellas reaprobadas solo para fixture; 0495 y 0535 productiva permanecen intactas.

Freeze por corrida: 41 entradas base en HTTP y 44 en focal (más setup/stub/metadata PGlite), 0 diferencias después de EXIT. 17 identidades PID+creationDate cotejadas sin vivos; cero terminaciones. HTTP02 cerró servidor/sockets/tareas, contenedores y red por ID/owner; puertos sin listeners. Observers de focal llegaron después de terminar y no se inventan descendientes no capturados. Cierre local acotado, sin promesa de terminación física universal ni conformidad global. No parser/source/sync/route generales, UI/browser, tipos/lint/build/verify/conocimiento/BCV remoto/producción por GO02.

## CHECKPOINT PARA RESPALDO PARCIAL DRAFT · 2026-10-21

Sobre el producto/pruebas validado en f106 se autoraron nuevos negativos F01 de hora no medianoche y F02 de asociación inequívoca Fecha Valor, con positivos de día bisiesto/entidades. Esos casos están NO EJECUTADOS; no se reparó parser/source antes de ROJO válido. F03 de cancelación diferida y comprimido/redirects/abort/presupuesto acumulado siguen pendientes de autoría y ejecución.

El Director informó un candidato adicional por lectura de sync/SDK: Content-Range malformado `*/0basura` podría normalizarse como count 0 por parseInt. Revisión todavía abierta, sin reproducción ejecutada. Conservar producto/transporte para un oráculo con SDK real antes de reparar; no cambio de cliente compartido ni ampliación de rutas.

Al publicar: entrega parcial con baseline 12/12, HTTP02 y focal 10/10 acotados; mantener todos los intentos/fallos/omisiones. B1–B19/R1–R14, F01/F02/F03, sync/transporte, cron/UI, canónica y conocimiento siguen abiertos. No listo para integrar ni para producción; 0535 sólo fixtures locales y 0495 intacta. Único turno pesado pertenece a 0574; aquí sólo autoría/publicación y verificaciones proporcionales de Git.

PR #317 creada una vez y adjuntada a la tarea. Recibos de publicación en `C:/tmp/director-traspaso-20261020/0569-bcv-validation/publicacion-parcial-01/`; preflight remoto `711df0c68563ce743822ceef8d24e3ec1b23efa007e5bd1b44e0a60f35fddeae`. Un wrapper PowerShell falló al parsear antes de ejecutar gh; no creó PR ni es fallo funcional. Invocación corregida creó #317; push propio sin force, sin hook pre-push activo, sin cambiar configuración del remoto antiguo redirigido por GitHub. Relecturas y SHA remoto final quedan en el recibo externo; esta actualización de URL es documental y no exige repetir pruebas.

## ORÁCULOS LIGEROS DESPUÉS DEL RESPALDO PARCIAL · 2026-10-21

Autoría nueva, **NO EJECUTADA** mientras 0574 conserva el turno pesado. F03 añade nueve salidas con cancel diferido (longitud inválida/excesiva, bytes reales, lectura lenta, abort del padre, redirects, status/tipo), observación de asentamiento dentro de presupuesto y teardown que libera/espera el productor incluso ante ROJO. Se autoraron además 200 tras uno/dos redirects, abort durante body, presupuesto headers 18 s + body 3 s, stream/UTF8 inválidos y gzip real mayor de 1 MiB sobre un HTTP loopback propio. El gzip usa fetch nativo hacia la fixture; no acredita TLS ni comportamiento remoto del BCV. Parser/source productivos permanecen intactos.

Informe sync `3b028de74af523b14800961d655720b7a213126ba8303c198e1bb4ece810397b` leído íntegro: P2-S01 confirmado por lectura de la frontera antes del SDK, sin reproducción. Nuevos oráculos con fábrica/SDK reales y sólo doble de transporte: `*/0basura`, `*/0.5`, `*/0/9`, prefijo inválido en snapshot y sus variantes de total 1 en tenants; exige cerrar antes de fuente/DML. Positivos de total paginado preservado y capability sin Content-Range; ausencia genuina `*/0` conservada. Fixture de respuestas usa rangos completos para arrays no vacíos, sin asignar Reply/count manualmente.

Driver posterior al gate aceptado sólo está preparado: registrará Content-Range bruto y Prefer de cada salto, y añadirá muestras nativas de ausencia/página. Ese control adicional no se atribuye al HTTP02 ya medido. No hubo ejecución nueva, corrección de transporte/SDK/cliente compartido ni reparación F01/F02/F03 antes de ROJO. Se mantienen pendientes los oráculos nativos amplios B1–B19/R1–R14, cron/UI y cierre canónico/conocimiento.

## PREPARACIÓN GO03 Y CRON/UI · 2026-10-21

GO03 leído íntegro, SHA256 `8410d224c3a7f3581a9d0a3d97f6d340c743a8afe998c76d2d313bc1ffcccdc1`; no empieza hasta transferencia expresa del turno de 0574. Revisión de oráculos `368aefb9abbd28a6c65e3b9cf0bf15fd5329b63cea5535870ea02424ef3acdab` leída completa: sin bloqueo material por lectura, sin ejecución. F01 .001 ya se rechazaba; regresión, no cuarto ROJO nuevo. Driver ampliado exige evidencia nueva, sin heredar HTTP02.

Preimágenes D de generador/test/crontab/UI/test revalidadas por blob y SHA256 antes de autoría, sin diferencias. Entrada BCV `5 * * * *` y oráculos de unicidad/precedentes/secret literal autorados. Crontab todavía sin regenerar: se preserva hasta ejecutar su generador nativo bajo turno, sin edición manual del derivado. No se cambia vercel.json, Compose, CURL_PREFIX ni entradas anteriores.

Aviso UI autorado con Icon.info existente, tokens neutrales, región status/polite y calendario IANA compartido. Solo una VES BCV completa de hoy permite ocultar el aviso. Fecha/fuente completas se atribuyen a esta vista; incompletos dicen tasa no confirmada. No se deduce salud del cron, ausencia DB ni origen BCV desde una tasa manual. Campos/acción manual conservados, con casos de fecha Caracas, teclado DOM, foco durante rerender, error y pending preparados. Todos NO EJECUTADOS; navegador/contraste/reflow/zoom siguen pendientes.

Governance Check aplicado por lectura: SGE-00, VIS-01/02, A11Y-01, CMP-01, ICO-01, FRM-01, ERR-01 y AVS-01; búsqueda del registro/primitivas no encontró banner informativo canónico que reemplazar. Se conserva la composición local y el icono central, sin primitiva global nueva ni API toast nueva. Cumplimiento estático del nuevo aviso en tokens/semántica/copy; cumplimiento funcional y visual todavía no acreditado. No se declara conformidad integral del formulario histórico ni se absorben sus brechas de error/contraste fuera del aviso. Validator del plugin y /ui-check real esperan turno. Las indicaciones históricas del comando sobre MARKBOX no sustituyen BRAND vigente.

Se encontraron rutas supuestas ausentes al preparar lecturas (HANDOFF/CHANGELOG de raíz, registry relativo y nombres de helper); se resolvieron con inventario focal a sus rutas reales. Son preparación de lectura, sin runtime ni ROJO funcional. Notas de prevuelo/peer y checkpoint 8b4 permanecen inmutables; producto parser/source/sync/types/0535 idéntico a f106 hasta medir los hallazgos.

## GO03 · CORTE FUNCIONAL PARCIAL PARA RESPALDO · 2026-10-21

Producto actual de este corte: `16eab3620aba3acfd1f7676453d3f30c37be5779`, aún sin cierre integral. Se preservan f106/8b4, cada primer fallo y cada carpeta externa. No se repitió instalación, baseline ni focal PGlite por rutina. 0495 y 0535 no cambiaron; 0535 solo fixtures. PR #317 continúa DRAFT apilada en C3; actualización remota autorizada por Director durante este corte sin corrida activa.

| Recibo en 0569-bcv-validation | Resultado y atribución |
|---|---|
| go03-rojos-01 | f32cb6503: 23 fallos funcionales previstos / 129, 106 pasaron, 0 omisiones: F01 3, F02 3, F03 9, S01 8. Fracción .001 fue regresión aprobada. Freeze 127 entradas/0 diferencias. |
| go03-focales-01 | a12e25b35: 176/177 pasaron, único fallo B18 de select controlado tras error. Los 129 oráculos originales reparados, ruta y cron pasaron; salida global 1 conservada. |
| go03-ui-dom-02 | 3ffb3c855: 17/19 pasaron. onReset delegado no bastó porque React19 suspende sus eventos durante commit; el positivo nuevo de éxito además asertó antes del effect, clasificado preparación y corregido con espera, no bug de producto. |
| go03-ui-dom-03 | c728a33a4: 19/19, 0 omisiones. Listener nativo reset con cleanup conserva campos controlados; éxito confirmado vacía solo tasa. Evidencia DOM/acciones ficticias, no navegador. |
| go03-sync-aceptacion-01 | cd369ce64: 75/75, 0 omisiones: cobertura exacta de scope, shapes/capability/25 IDs/deadline común50s, CAS/token equivalente, partición y sin cache futura. |
| go03-f02-residual-rojo-01 | a13de1183, parser idéntico a a12/c728: nuevo rótulo duplicado con markup inline falló por aserción 1/46; 45 positivos/negativos pasaron. |
| go03-f02-residual-verde-01 | 658ca47a8: parser/fuente 79/79, 0 omisiones. Detección de rótulos visibles propios, sin contar wrappers ni omitir inline; vínculo válido directo/único intacto. |
| go03-http-full-01 | bf68f1e79 FALLÓ PREPARACIÓN: noviembre4 ya tenía alta humana legítima del bloque previo, así que no era carrera de INSERT ausente. 10 controles parciales, no aceptación completa; no defecto de producto ni carrera INSERT demostrada. Fixture corregida a diciembre con precondición de ausencia, sin borrar legado. |
| go03-http-full-02 | 16eab3620 PASÓ: 18 controles, 27 escenarios funcionales y 26 intentos negativos; PG17.11/PostgREST14.17/SDK2.106.1 reales. Receipt SHA256 5ad79026ec2c4d65707b73a6b648e0bd0f520008be5bb04c7bca99bc3d1dc954. |

HTTP full 02 mide strings extremos 0.00000001 y 999999999999.99999999 desde fuente/parser reales (HTTP loopback, URL BCV interceptada solo por fixture), pasando por SDK/SQL y rate auditado como texto; CAS siete predicados/microsegundos, relectura UNCHANGED sin note/token/evento nuevo; dos sesiones DML observadas en pg_stat_activity (PID internos 129/587) con un ganador INSERT y CAS; intercalación, 404[]/vacío/objeto/503/truncado/S01, ACK perdido tras COMMIT real reconciled o UNKNOWN sin segundo write, capability fallida entre tenants, ensayo on/off con solo GET, OFF normal sin fábrica/IO, fallo real de auditoría que revierte tasa/evento en la misma DB, y tenant ajeno/manual/operacion/CNY/factura/CxP congeladas intactos. No prueba exactly-once, ABA universal, lease DDL, VPS ni producción.

Muestras nativas HTTP: vacío 200 `*/0`, página 206 `0-0/3` con total 3, capability sin count exacto `0-0/*`; el transporte conserva total de página y no exige metadata a capability. Supervisor full 02 SHA256 89dbec29d8ab8fd3815eedc72d598a53fd553e7972fb25b0ec2bcfc4c3052343: freeze 129/0 diferencias, HEAD/estado intactos, 12 identidades observadas ausentes. Gateway sin listener/sockets/tareas, dos contenedores y red eliminados por owner/ID, puertos 7233/7231 sin listeners. Se declara límite de captura de procesos transitorios, sin inventar identidades ni terminación física remota.

Pendiente GO03: UI real claro/oscuro/390/escritorio/teclado/reflow/zoom200%, mutantes TS proporcionales, regresiones/gates/tipos/lint y matriz completa B1–B19/R1–R14/SGE con fuente/log/SHA; único GET oficial implementado tras sus condiciones. Después checkpoint revisado para canónica separada; sin verify/build/conocimiento en este GO. Claim retenido.

## GO03 · CHECKPOINT FUNCIONAL PARA REVISIÓN CANÓNICA POSTERIOR

Producto/pruebas `390227699d167a7d6cdf7b22e1512f8d5a18a97c`; posterior autoría únicamente documental. Matriz B1–B19/R1–R14 y SGE12 en la continuación final de la spec propia, con rutas/oráculos/SHAs/recibos/omisiones. No es aceptación canónica ni cierre de producción. Director aceptó las evidencias locales acotadas; conserva revisión del checkpoint y el próximo turno. No hubo nueva prueba/GET por documentación.

Desde a355: beaa5350 corrige únicamente anclas/declaración de llamada fx_rates real detectada por gate; 7b534e047 aplica mínimo 48px a cuatro campos y CTA; 36fe66961 añade cuatro deadlines IO y mutante SQL readiness; b8385d100 añade suplemento HTTP/PG; 71ea1132b repara separador de definición restaurada y aísla retirada; 390227699 añade tres particiones de lote y IDs ficticios únicos. Parser `ef05112f115ac692d4f7b489b297042dbdaf4d3a`, source `e5d1d3a0600833875167e16763e9655391d9da65`, sync `1648a88f1a5ed9c25bde736a499da0a800844add`, types `e517fb4ba8362d7b52da555b5cc024a2110c4300`,0535 `c88895a18a66f603f8a2edcfd62bfede9c4ffffa` son blobs Git actuales. 0495/0267/0294 y prueba0495 sin delta frente a D; package/lock solo promoción parse5 ya medida, sin upgrade.

| Evidencia propia adicional | Resultado y límites / SHA256 |
|---|---|
| go03-typecheck-01; go03-lint-scope-01 | PASARON en a355; lint0 errores/5 warnings conservados. Cinco TS mutantes y controles122/122 se aceptan por sus SHAs, sin extrapolar al delta posterior. |
| go03-local-gates-01; go03-pending-symbols-02 | Conjunto01 FALLÓ por dos anclas declarativas: llamada fx_rates:71 ausente y evidencia desplazada. Seis gates PASARON: docs559, numbering559/493 con excepciones previas, componentes5, governance28, RSC1713 y flags6. Fix beaa5350; solo gate fallido reejecutado y PASÓ 0 ROJO/3 AMARILLO/3 homónimos, stdout `106808dfaa3cbc90c6b934ad1207f1656523789cecf26a856ff39ead9d9dd6b3`. |
| go03-deadline-phases-01 | PASÓ 4 seleccionados/76 omitidos: padre previamente abortado, capability body, PATCH body y body reconciliación. SDK real, transporte/reloj50 s ficticios; cancel/timers/cero IO posterior exigidos. No PGCOMMIT/50 s físicos. Stdout `0927c9a73b0bc31743e8ed6ff63508fc3bf772252a9cf2d5fe4c8ee027c73564`. |
| go03-readiness-mutant-01/02 |01=0 seleccionados/11 omitidos, exit0 NO EJECUTADO.02=1 PASÓ/10 omitidos: readiness true constante alcanza assert SQL de trigger deshabilitado tras reaprobar solo hashes de fixture. No fallo por digest/instalación. Stdout02 `f51373cfda080e1307cdc9881ca57b1b20042d687760ab69d8751e9a210205cc`. |
| go03-mutante-M06-parser-first-strong-01 | Mutante funcional detectado:2 seleccionados,1 fallo por tasa 2.50 frente a 883.39630000/1 positivo/44 omitidos. Parser original/restaurado SHA256 `14a598fcd7a4af303267b93d4d537c5da907ecfa197140e7c7e0a65b4ada6456`,130 inputs/0 diff/3 identidades ausentes. Stderr `d61ffd5bef6b0b92737dc4009edb27cf54af95d42b87c110ae57fad207ffc8e2`. |
| go03-http-supplemental-01 | FALLÓ global por preparación de retirada: faltó `;` tras pg_get_functiondef, DROP siguiente no llegó a oráculo, observador terminó LOCAL_READINESS_TIMEOUT. Receipt `d10f9edab3ad76b432ef8784eb6d1a7eba43de6d8bebd7fadc8668fdb16265aa`. Evidencia parcial aceptada: B12 PATCH23514 con CAS7/cambio de rate/set_at efectivo y fila/eventos/contexto íntegros iguales; tres B5 reloj app controlado cruzando04:00Z y COMMIT real, original conservado/una DML/B diferido; locks de instalación reales151→166/ShareLock transactionid/55P03+ROLLBACK/catálogo exacto y positivo abierto.130 inputs/0 diff/14 identidades ausentes; cleanup0. No renombrar la corrida como verde global. |
| go03-http-withdrawal-02 | PASÓ retirada aislada tras fix71ea: fixture nueva y una tasa/evento job comprometidos por syncHTTP; quiescencia observada; restore cuerpo0495/dropcap/COMMIT con locks reales y catálogo exacto, historia íntegra conservada. App posterior SQL_CONTRACT_UNAVAILABLE/soloGET/0 fuente/0 DML. Sin repetir B5/B12/timeout. Receipt `a4a64bdc2317c562ba86bbce63e92e0e6e0552a49b0c6a60e06b44fc5677e7ee`, supervisor `f0642e0bc8910f51662f1243d013507762a85f3577f14efd30c1b3ec3f4393d1`;130 inputs/0 diff/8 identidades ausentes. |
| go03-three-tenants-01 | PASÓ 3 seleccionados/80 omitidos en390: A confirmado, B conflicto o SQL fallido permite C; B UNKNOWN difiere C, particiónscope 3. SDK real/doble transporte, no competenciaPG nueva. Stdout `83334b76490866ba4b37c0b00735db2dbd2abe470ece8845c2d16828304e2b85`,128 inputs/0 diff/3 identidades ausentes. |
| go03-regresiones-manual-01 | PASÓ 69/69 sin omisiones: fx-rates, shared/fx, acción manual Admin y secreto Bearer; fuentes sin edición. Stdout `a52d696f8b93999d2af4c192430831807cc8084fd67e7d3d33c0ccc73c0f44dc`,136 inputs/0 diff/8 identidades ausentes. |
| go03-typecheck-delta-02/03 |02 terminó en freeze por ExtraInput supuesto tsconfig.typecheck.json ausente, antes de iniciar Node/tsc: NO EJECUTADO, no ROJO.03 comando nativo normal PASÓ en 390227699 sin podar tipos: resultado `43dfd63bbb814b5eca1891cf772302ecf14dd3864a91fd181e4a5fc7bf638b93`;128 inputs/0 diff/5 identidades ausentes. |
| go03-lint-delta-02 | PASÓ en390, cuatro archivos posteriores al lint previo;0 errores/3 warnings `_note` conservados. No oculta los otros dos warnings del testUI sin nuevo cambio. Resultado `37634d70cc15ff9da8eb826bf215fde441979fe2685409c4846190ca824f2b80`,129 inputs/0 diff/5 identidades ausentes. |
| go03-public-source-01 | NO DISPONIBLE/SOURCE_UNAVAILABLE: única invocación implementada,1 intento GET con TLS normal,14:54:05.174–05.824Z del 21 de octubre, UNABLE_TO_VERIFY_LEAF_SIGNATURE antes de headers,0 bytes/sin hash de cuerpo completo/DB 0. Receipt `01c8f8f9fc7e7ff6c2f6e889d885b99a793e87e90c81ff079c35a766c83e116a`;131 inputs/0 diff/1 identidad ausente. Helper solo observa el reader nativo, sin clone/tee/cambio de URL/status/TLS ni reintento. No se presume obtención positiva por fixtures anteriores. |

UI01–06 se conservan completos.01/02 no renderizaron por cache Chromium/side-by-side;03 faltó puente nativo de tipografía;04 trató CTA vacío/deshabilitado como Tabstop;05 aplicó medición táctil después de volver al viewport escritorio y PNG fullPage de zoom no fueron evidencia fiable;06 ya con 390/coarse/maxTouch1 midió heights37–43px: NC táctil real. Fix7b usa token 48px solo en cinco controles existentes. UI07 PASÓ 53 controles,24 estadosDOM y14 PNG; no son 24 capturas inspeccionadas. Edge155.0.4283.62 instalado, perfil propio, sin arreglar/instalar runtime. Fixture ReactDOM cliente, estilos/tokens/fonts reales y puente studio-sys exacto; acción/toast ficticios, sin DB/SSR/AppShell ni perfil de usuario. Zoom nativo2x medido por navegador/DOM/teclado/pending/error/éxito; PNG son viewport CDP parcial por scroll. Cinco controles de 48px táctiles, reflow320 y aviso16px/contraste neutral>=4.5 medidos. Sin certificación A11Y/AT/dispositivo físico. Receipt07 `1b4d3990a24d792ad469aefc8a336e90662b702517a818b9a7bccd0ebc464a1c`,249 inputs/0 diff/23 identidades conocidas ausentes/puertos 28477 y 25016 libres;14 PNG sellados, Director inspeccionó 8 y Worker 4, sin afirmar unión única de 12.

Cotejos independientes del Director, sin elevarlos a nuevos casos: UI07 `5044f45e8bd3af8272013ac6d8705358a273c3c0bc233da904fbe3592c00fc30`; cincoTS/gates `dd34f3ef132e545c44ca77864cd5939584e63d97ec208a06408104e0f70c13b0`; deadlines/readiness/M06 `62574d977ee1abcb2c8ba50784b9781daa2ff93d1b8c4dc3223d030b5cd70218`; suplementos/pública/regresión/particiones `2344a577b9fbaa7df620cceb8dfcf2c9471be5957eef140131daabfa1b5aab22`. Comparación de identidades por PID+ticks UTC: PID reciclado ajeno conservado, no comparación ISO contra DateTime ni repetición de runtime por impresión.

Impacto documental guardado: esta spec continuada, runbook BCV, nota de servidor y handoff propio. Las decisiones originales íntegramente conservadas abajo no se reescriben; prevalece el addendum31 para job/motivo/dryRun. Receta canónica prevista `go03-checkpoint-funcional-01/canonica-prevista.md`: comando normal sin overrides/hooks, freeze de fuentes/config/lock/docs/HEAD y entradasruntime; originalesJSON E2E propios por PID antes del borrado, sin reconstrucción/repetición si falta captura; cleanup por identidad/ID. Solo propuesta, todavía sin supervisor canónico autorado/ejecutado ni GO.

Conocimiento: documentos en rama = guardado de tarea. Integración, Graphify AST/semántica, Archify/preview, publicación y revisión visible en Obsidian siguen NO EJECUTADOS en este GO. Director coordina el único ciclo local tras documento estable. No edición de memoria, reglas o derivados globales; no bóveda compartida.

## GO04B · cierre canónico preservado y GO05A de paridad

GO04B sobre 62f64e8e5b8a3279892b95748487444a2e07eadb corrió una vez, 16:26:49–17:00:34 UTC, exit 1: **FALLÓ y además INCOMPLETO**. Ambos intentos nativos de Vitest: 13144 aprobados / 1 fallido / 1 omitido; misma aserción infra-env-example.test.ts:34 por BCV_RATES_ENABLED y BCV_RATE_TENANT_IDS ausentes en la plantilla de infra. No fue flaky resuelto. Ledger migrations-applied SKIP crítico sin credenciales. Los otros 15 pasos, incluido build, PASARON; lint conserva 20 avisos. SQL local 250 contratos y reconstrucción 475+18 sólo-ledger son fixtures, no producción.

Freeze 6447 antes/después/0 diferencias; streams completos y supervisor sin errores. Nativo 1788 identidades conocidas/0 vivas; postflight 1789 incluido launcher/0 vivas, cinco puertos observados libres y dos IDs de contenedores propios ausentes con Docker consultable. No censo universal; procesos ajenos de PID reutilizado preservados. Claim retenido. Recibo terminal externo e2a8105372ade30b78446cd87b54fd76f50f11c9c7aec472588f9f4a76be378c; Director cotejó independientemente con 58262137986cb7e907eea87df9154e79e8b1e50211626590642674f088bae355.

E2E original 268459 bytes/SHA0363dc645e9484960f92ae2715453a2bef852c7496bb2306eef16ea65f23c40c/fileIDd88e71b7-006a000000011081:177 aprobados / 20 omitidos / 1 flaky auth.spec.ts:81 recuperado por retry1,0 inesperados finales. Dos omisiones visuales duplicadas y 18 por fixture/seed ausente; no cobertura integral. Se conservan fallos auxiliares del lector/ensamblaje posteriores al EXIT, sin reejecución E2E/canónica ni cambio del original.

GO05A: única reparación funcional de cinco líneas literales en infra/dtd-cargo/.env.example; OFF false y scope vacío. Focal nativa intacta scripts/__tests__/infra-env-example.test.ts PASÓ 3/3 sobre fd09677f8, sin omisiones. No cambios a raíz, test, Compose, producto/SQL/lock/receta. Contrato32 íntegro recibido a continuación; no nueva política por inferencia.

### GO05A · resultado focal medido, sin nueva canónica

Checkpoint de ejecución `fd09677f83908c5ba0a9ea033220e37e1308d1af`: una invocación normal de Vitest 4.1.7 al test intacto `scripts/__tests__/infra-env-example.test.ts`, 18:07:02–18:07:16 UTC: **PASÓ, exit 0, 1 archivo y 3/3 casos, sin omisiones ni retry agregado**. El cambio funcional es únicamente la inserción literal de cinco líneas autorizadas en la plantilla de infra; el resto de bytes reconstruye exactamente su preimagen. Raíz, test, Compose, producto, 0495/0535 y lock conservados.

Freeze completo: 6451 entradas antes/después, 0 diferencias, HEAD y árbol limpios hasta EXIT y comparación. Tres identidades nativas conocidas y launcher ya ausentes por PID/ticks UTC, sin Kill ni censo universal. Native stdout SHA256 `5078a1a2d8bd81f842e6e3b6ef950787c258176aec5a8f3559a6d64d377332bc`; result `f3abaae08b601d551a82fed4a28550af7e37241dd703e23c7aec4a28e3e5f4f2`; postflight `b0a5a58c2ba986f69ccf9856e584aed7bb047e09096049bb03af62f5d1c3fd07`, en `C:/tmp/director-traspaso-20261020/0569-bcv-validation/go05a-parity-native-01/`.

Director aceptó acotadamente GO05A y cotejó las 6451 entradas, seis artefactos y cuatro identidades ausentes: prueba externa SHA256 `dd2cc49a147219d03b75f63b0e27d00be4f7c3d3efc5acedf8ed70c914bc364a`. La focal corrige el oráculo de paridad medido; **GO04B permanece FALLÓ e INCOMPLETO**, con sus dos intentos y omisiones. El fallo auxiliar inicial de comparación de nombres antes del commit se conservó como preparación, sin ejecución de tests ni cambio de producto para pasarlo. Nueva canónica GO05B y ciclo de conocimiento siguen NO EJECUTADOS. Cierre documental, commit/push y DRAFT son respaldo para revisión; no integración, release ni producción.

## GO05B · cierre canónico del 21 de octubre, FALLÓ e INCOMPLETO

Una invocación normal de `pnpm verify` sobre `ce7e628e46d8e4e59176c9a84171d44b46261d4d` y base C3 `1905aef75680a80055621cffd717198915d089f9`, bajo GO 8c552b9c y activación 28ddc5a9. Inicio nativo 18:24:54.8345503Z; supervisor terminó 19:22:55.6252856Z. El instante exacto del EXIT nativo no se serializó por separado. Native, launcher y sesión exterior terminaron con **exit 1: FALLÓ y además INCOMPLETO, 16/17 pasos ejecutados**. Quince pasos aprobados, incluido build y E2E con aviso; test falló y migrations-applied quedó OMITIDO crítico sin credenciales. No nuevos overrides, retries de aplicación o receta adicional.

| Intento nativo de Vitest | Archivos | Casos | Duración |
|---|---|---|---|
| 1 | 1 fallido / 892 aprobados / 1 omitido, total 894 | 1 fallido / 13144 aprobados / 1 omitido, total 13146 | 935.03 s |
| 2 | 2 fallidos / 891 aprobados / 1 omitido, total 894 | 3 fallidos / 13142 aprobados / 1 omitido, total 13146 | 912.02 s |

No se suman intentos como cobertura distinta; el log no identifica el caso unitario omitido. Primer intento: `app/p/[token]/supplier-flow.test.tsx:256:82`, no encontró el mensaje «Deja un contacto: WeChat, teléfono o email.». Segundo: `app/p/[token]/standard-format.test.tsx:60:97`, esperaba el texto ficticio Empresa real y recibió vacío; `supplier-flow.test.tsx:260:3` y `:287:3`, timeout nativo de 20000 ms en corrección/reenvío y revisión de adjuntos. Los cuatro casos están **FUERA DE ALCANCE DETECTADO**, fuera de las 32 rutas; causa **NO DETERMINADA**. No se infiere bug de producto, causalidad BCV ni flaky desde estos fallos o el mensaje genérico de retry del runner. Director prepara diagnóstico separado, sin fix autorizado en esta tarea.

Harness 237/237, tipos y cuatro Edge Functions PASARON; lint 0 errores/20 avisos. SQL local: 250 contratos con rollback y reconstrucción de 475 migraciones más 18 sólo-ledger PASARON; los dos tenants materializados son fixtures sintéticas en DB desechable, no negocio real. Ninguno sustituye ledger productivo ni autoriza aplicar 0535.

E2E original: **198 casos = 176 esperados + 20 omitidos + 2 flaky + 0 inesperados**. Flaky nativos recuperados en retry 1: `calculadora-semantic-colors.spec.ts:53/mobile-chrome` y `company-photo-carousel.spec.ts:93/chromium`. Omitidos por grupo: comments-lifecycle 3, company-photo-carousel 2, gastos-expense-void 6, global-search 6 y nomina-settlement-void 3; anotaciones y 198 casos completos en `e2e-readonly-interpretation-01.json`, SHA256 `94cb918941e77f59e4447d75e4a6eef3715f5ded9710f71a3136c9ac36b49cf0`. El proceso E2E salió **distinto de cero, valor exacto no publicado**; el entry existente lo absolvió con aviso y marcó PASÓ CON AVISO NATIVO. Su atribución a WebKit en Windows se conserva como explicación del runner, sin diagnóstico independiente. No es salida limpia ni cobertura integral y no se repitió E2E.

Recibos en `C:/tmp/director-traspaso-20261020/0569-bcv-validation/go05b-canonical-native-01/`: terminal `go05b-terminal-receipt-01.json`, SHA256 `689a95faf068868c79265c5637209aec493c08702508ebe82e88705334108f5e`; stdout `03ebdba03ed3f28ab2ecf6be183fb2d02931738054a1cbad9dc9c45e06f9af55`; stderr `d8e084ebe140d1a6d730625c9026af857b57b9db5f70eacdad6e14be8810cf00`. Original `e2e-original-46880-d88e71b7-002000000000bbbd.json`, 276532 bytes, fileID `d88e71b7-002000000000bbbd`, SHA256 `b8bd7f0c978148eccd7b8678b484ef8f36acf1cfebf58b639ed978200e4b3153`, copiado desde el handle del PID propio abierto antes del borrado del nombre; JSON completo, sin reconstrucción.

Freeze de 6447 entradas antes/después: 0 diferencias; 11 extras: 0 diferencias, slices solapados que no se suman como archivos únicos. Incluye Git completo fuera del store raíz y entradas runtime propias fijadas, no todo node_modules transitivo. Streams completos; supervisorPartial false, sin errores de observador/monitor. Postflight propio: 772 identidades conocidas incluido launcher, 0 vivas/0 UNKNOWN; puertos 3776/13776/49796/49798 libres y dos nombres/dos IDs Docker propios ausentes con Docker consultable. Sin Kill, sin censo universal ni terminación de PID reutilizados ajenos.

Director cotejó también los 6447 archivos físicos actuales, originales y recursos a 19:27:48.474Z: `C:/tmp/director-traspaso-20261020/0569-bcv-canonica-05b-cotejo-director.json`, SHA256 `482a900a6858799ba3fb67094d2787450234d022bf876303efa746afc96ac963`. Aceptó **integridad y recursos**, no aceptación global BCV; turno pesado devuelto y claim retenido. Autorizó sólo los tres documentos propios y el mismo DRAFT317. Producto/pruebas del checkpoint 390227699, 0535, 0495, plantillas, Compose, lock y receta no se modifican por este cierre documental. GO04B conserva FALLÓ/INCOMPLETO; GO05A conserva su focal 3/3. Fuente pública positiva sigue NO DISPONIBLE por el único GET TLS anterior; conocimiento, preparación 02 UNBOUND/NO GO/NO EJECUTADO. Sin nueva receta, tests, instalación, SQL, GET, integración, merge, deploy o producción por este cierre.

### Addendum Director32 y GO05A · original íntegro d73e2afc

~~~~~~markdown
# SDD-0569 · addendum Director32 y GO05A de reparación local

21 de octubre de2026. Director Codex. **AUTORIZADO: reparación mínima local y prueba focal nativa.** Mismo SDD0569, Worker/claim `worker-0569bcv-01a15a4e-ddf0-7d82-8656-d9dc56b58468`, rama `codex/sdd-0569-bcv-carga-diaria` y worktree `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0569-bcv-carga-diaria`. PR317 permanece DRAFT. No autoriza main/merge/deploy/producción/VPS/DB real/filas/PII/secretos/flags/agenda/GET oficial ni conocimiento todavía.

## Evidencia y decisión

Se conserva íntegro el addendum31 `0569-bcv-addendum-auditoria-director-31-rutas.md`, SHA256 `87589d14362e2e740713db01775ba5c7c551a2c6bbf4fe307932abd664049412`, y sus contratos B1–B19/R1–R14. Esta enmienda sustituye exclusivamente su límite de31 por la unión literal32 de abajo y concede GO05A acotado, posterior al cierre de GO04B. No autoriza nueva SQL, cambio de receta, tests debilitados ni alteración de los archivos protegidos.

GO04B ejecutó una canónica normal sobre `62f64e8e5b8a3279892b95748487444a2e07eadb`, de16:26:49 a17:00:34UTC, exit1. **FALLÓ test y además quedó incompleto16/17 por ledger crítico omitido**. Dos intentos nativos de Vitest fallaron la misma aserción `scripts/__tests__/infra-env-example.test.ts:34`: faltan en infra los nombres `BCV_RATES_ENABLED` y `BCV_RATE_TENANT_IDS`. No es un flaky resuelto. El resultado previo, sus dos intentos, originales y omisiones permanecen sin sobrescribir ni reinterpretar como aprobados.

Director leyó la nota independiente completa `0569-bcv-revision-paridad-env-infra-peer.md`, SHA256 `25c8ac6e856db9916fe69caadc08355b3c67b157a1cc582f39f88b367dd73969`. El oráculo original exige documentar los nombres de la plantilla raíz; las dos asignaciones ya existen en raíz y faltan en infra. Preimagen infra Git `37d1bf351226384012e62472a34c1efe079188d2`, test Git `78c80a8c287a34839e692cbfa1681f77f7cac741`, raíz Git `6d8599cad32f7ca11dc0b8b5428eaed11d7bb422`. No cambiar test, script, raíz ni Compose para eludir la aserción.

Cotejo independiente Director aceptado `0569-bcv-canonica-04b-cotejo-director.json`, SHA256 `58262137986cb7e907eea87df9154e79e8b1e50211626590642674f088bae355`:6447 antes/después/actual, cero diferencias, HEAD62 y árbol limpio,1788 identidades conocidas sin coincidencias vivas, claim correcto retenido. Paquete terminal Worker `go04b-terminal-receipt-01.json`, SHA256 `e2a8105372ade30b78446cd87b54fd76f50f11c9c7aec472588f9f4a76be378c`, devuelve expresamente el turno pesado. Se conserva Docker Desktop y se preservan procesos ajenos.

## Delta funcional único autorizado

Añadir después de `CRON_SECRET` en `infra/dtd-cargo/.env.example`, antes de `DEBUG_HEALTH_SECRET`, exclusivamente este bloque con la separación de líneas necesaria:

```dotenv
# SDD-0569 · BCV VES/USD. Normal OFF; activación productiva pendiente.
BCV_RATES_ENABLED=false
# Scope explícito de UUID únicos (máximo25); vacío falla cerrado. Sin IDs reales.
BCV_RATE_TENANT_IDS=
# Reutiliza CRON_SECRET; ver docs/runbooks/bcv-tasas-diarias.md para ensayo/activación.
```

No poner true, tenant real o ficticio, credenciales ni valores operativos. Conservar todos los demás bytes y asignaciones de la plantilla. El ensayo autenticado estricto ya documentado sigue siendo modalidad distinta de OFF normal; esta inserción no activa job, instala cron, aplica0535 o autoriza ensayo. No editar `.env` vivo ni configuración de Docker/Compose.

## Allowlist acumulada32, sin obligación de editar todas

```text
app/api/cron/bcv-rates/route.ts
app/api/cron/bcv-rates/__tests__/route.test.ts
lib/studio/fx/bcv-types.ts
lib/studio/fx/bcv-parser.ts
lib/studio/fx/bcv-source.ts
lib/studio/fx/bcv-sync.ts
lib/studio/fx/__tests__/bcv-parser.test.ts
lib/studio/fx/__tests__/bcv-source.test.ts
lib/studio/fx/__tests__/bcv-sync.test.ts
lib/studio/fx/__tests__/bcv-persistence.migration.test.ts
lib/studio/fx/__tests__/fixtures/bcv-usd-20261021.html
lib/studio/fx/__tests__/fixtures/bcv-decoys.html
lib/studio/fx/__tests__/fixtures/bcv-ambiguous.html
scripts/tests/bcv-rates-postgrest.mjs
scripts/build-crontab.mjs
scripts/__tests__/build-crontab.test.ts
infra/dtd-cargo/cron/crontab
package.json
pnpm-lock.yaml
app/studio/(app)/admin/_components/ExchangeRatesSection.tsx
app/studio/(app)/admin/_components/ExchangeRatesSection.test.tsx
docs/runbooks/bcv-tasas-diarias.md
docs/runbooks/servidor-contabo.md
docs/specs/README.md
docs/specs/0569-conversor-usd-tasas/spec.md
.agents/handoffs/0569-bcv-carga-diaria.md
supabase/pending-migration-symbol-declarations.json
.env.example
supabase/migrations/0535_bcv_rates_system_audit.sql
supabase/tests/bcv_rates_system_audit.test.sql
supabase/migrations-baseline.json
infra/dtd-cargo/.env.example
```

## Secuencia GO05A

1. Leer íntegro y confirmar SHA de este addendum; copiar contrato íntegro al handoff/spec propios con autorización32 y fuente31 conservada. Revalidar raíz/rama/HEAD62/claim/guard y limpieza antes de editar. Si hay cambio ajeno o nueva diferencia, conservar y comunicar antes de tocarla.
2. Aplicar únicamente la inserción anterior y actualización documental de alcance/evidencia ya autorizada. Registrar diff literal y hashes antes/después. Confirmar originales test/raíz/Compose/producto/SQL/lock/receta sin cambio. 0495 aplicada y0535 local permanecen inmutables.
3. Concedido turno para **una ejecución focal** de la suite nativa intacta `scripts/__tests__/infra-env-example.test.ts`, mediante el Vitest instalado y su configuración normal, sin filtros de casos, cambios de timeout/worker/CI/retries/configuración ni flags de omisión. Esperadas3 comprobaciones originales; registrar total real, stdout/stderr/exit y recursos conocidos. No repetir automáticamente ante fallo.
4. Congelar inputs antes/después de esa ejecución, cotejar bytes y HEAD, conservar salidas nativas, ausencia de procesos propios por identidad. Guard y diffcheck; commits selectivos coherentes de la reparación/documentación, push de rama propia y actualización de PR317DRAFT ya autorizados. Ningún git add global.
5. Entregar SHA local/remoto/DRAFT, diff completo, artefactos y límites. **No invocar otra canónica aún.** Director revisará el checkpoint corregido y el plan de nueva canónica. El fallo concreto de GO04B justifica repetir el cierre canónico una vez revisada la corrección; no lo justifica una preferencia por resultados verdes ni documentación sola.

Las pruebas previas siguen con sus resultados y alcance. `migrations-applied` sin credenciales es NO EJECUTADO/SKIP crítico; no buscar credenciales ni aplicar DB para cambiar ese resultado. GET oficial positivo sigue NO DISPONIBLE por TLS bajo la única consulta anterior; sin reintento/fallback. Cobertura E2E no es integral por20 omisiones y1 flaky original. Toda aprobación posterior será local y con estos límites, sin cierre global2.1 ni producción implícita.
~~~~~~

## CONTRATOS ÍNTEGROS CONSERVADOS ANTES DE PRODUCTO

Estado GO03 efectivo: transferencia exclusiva confirmada a 2026-10-21 13:27:50.1825184 UTC / 09:27:50.1825184 Caracas, HEAD inicial e9a65db2ced8820587c8c7952c274cc7ca826449. Guard nativo pasó. Solo generador/test cron estaban modificados; se generó el crontab con el script nativo, 21 entradas y check PASÓ. Índice nativo regenerado, 559 specs/18 huecos preexistentes, sin delta. Fuentes parser/source/sync/types/0535 idénticas a f106 antes de ROJOS. No se repite instalación/baseline ni focal PGlite por rutina. /ui-check estático previo no sustituye navegador; ejecución funcional autorizada, canónica/build/conocimiento todavía fuera del bloque.

### Encargo original · SHA256 c477578e870ce7567d9c5e3ca10500e787169ded114bc41356daef6b4983f842

~~~~markdown

# SDD-0569 · BCV diario · encargo Worker preparado

**PREPARADO, NO ACTIVO.** Falta aceptar el cierre C3 y fijar su SHA final, árbol/rama/owner/claim y turno. No constituye permiso de producto mientras conserve este estado. Sam autorizó desarrollo local y PR en borrador de la2.1; producción conserva autorizaciones específicas. El Director se mantiene coordinador/revisor y el Worker será el único escritor de su tarea aislada.

**Base pendiente:** C3 final aceptado, que incluirá b+C1+C2+C3. d1a7cca287fafcfe978ac74a58c40040889193c2 es solo checkpoint del preflight, no base definitiva. No se asigna un número nuevo: reuseSDD0569. La rama/árbol BCV no existen en el inventario local de08:39Z; ese dato deberá revalidarse al activar, sin mover ramas ajenas.

## Resultado y fuentes

Cargar de manera acotada la cotización oficial VES por 1 USD correspondiente exactamente a hoy America/Caracas, con decimal completo, protección de concurrencia, auditoría existente y respaldo manual. Cotización futura espera y se vuelve a consultar al llegar su día; la anterior no se copia como hoy. No almacenamiento futuro durable ni promesa de disponibilidad diaria.

Reutiliza `docs/specs/0569-conversor-usd-tasas/spec.md`, con continuación fechada y evidencia histórica conservada. Handoff propio `.agents/handoffs/0569-bcv-carga-diaria.md`. Sin SDD o migración nuevas;0495 ya aplicada una vez no se repite ni se edita. La base incorporará los cierres locales b+C1+C2+C3 comprobados; la integración de esas PR sigue pendiente. No heredar anticipadamente0573 ni el carril de embarques.

Lecturas obligatorias completas antes de implementar:

- Propuesta `C:/tmp/director-traspaso-20261020/bcv-alcance-actual-codex.md`, SHA256 `d074fca456e7e4cb9b91f7f29cbc49ddd5c3cb6dd46ccf94b788a192cd7a742b`. Sus exclusiones antiguas del manifiesto y nombresSDD no asignados quedan sustituidos por este contrato.
- Decisiones `C:/tmp/director-traspaso-20261020/bcv-decisiones-director-preparacion.md`, SHA256 `7684e65827cf94c61882eacecde336e1895fc67aa2756af0b551f61356b36578`.
- Dictamen `C:/tmp/director-traspaso-20261020/bcv-revision-diseno-codex.md`, SHA256 `2e78347492f663dd776660f6c8b1f948051cb0e4a6413f35e758d4eb673d1ea0`. Es diseño, no resultado de prueba.
- Evidencia oficial `C:/tmp/director-traspaso-20261020/bcv-fuente-oficial-lectura-20261020.md`; HTML no ejecutado `bcv-oficial-lectura-20261020.html`, SHA256 `e0f20e7e5a3652d72d07e6ecd28ee4ec85b440b14e3c470d4e89078d7953bc46`. HTTP200 observado20oct20:28Caracas con FechaValor21: no tasa vigente20 ni prueba del VPS.
- Addendum `C:/tmp/director-traspaso-20261020/bcv-addendum-director-preasignacion.md`, SHA256 `ad777232f7c573de9b8df21dfda053d617236bf249380106e241486eb3669636`, y preflight `bcv-preflight-c3-preasignacion.md`, SHA256 `ec96b612e65a9d5211c8e6ebf41ef552db49fbc8ab254401cff28f331d1f7f1e`, leídos completos. Director cotejó37blobs,12conhashcrudo, sin diferencias: `bcv-preflight-c3-cotejo-director.json`, SHA256 `c4fc91bfdb3aac01763e4ae2d6afb24d75452ff32887c3febdde4999657e7e6b`. Menciones obsoletas C2/27rutas no sustituyen este encargo unificado; ninguna lectura demuestra pruebas ejecutadas.
- Observación oficial21 `bcv-fuente-oficial-lectura-20261021.md`, SHA256 `cf178a62fe57b5929de95131be8053e031be92d998959668446ee207ecd3279a`; HTML `c7c8c1861ff7a0e01e24fd493278565d9a450949713ff1694d8c59bc00ac2e14`, recibo `a210968e582e6563283b592ea569051d5d6d611d91357d1e1ddbc3e1a908b90a`. HTTP200/TLSnormal06:49:23–24Z,USD883,39630000/FechaValor21coherentes, fechas señuelo conservadas. Es observación pública, no importación/agenda/disponibilidad diaria/VPS.
- AGENTS, Worker/runbook, project-rules, AGENT-BRIEF, políticas normativas/NUM/ERR y marca/diseño/Norte aplicables. Producir matriz de los12 principios SGE con evidencia y clasificación explícita.

## Decisiones aprobadas de la entrega

1. Parser puro parse5 de producción 8.0.1 ya resuelta: bloque oficial único, USD/strong y FechaValor del mismo bloque, fecha visible/atributo coherentes, calendario/offset IANA válidos. Decimal textual con coma1–8decimales, >0 y <1e12; sin Number/parseFloat ni redondeo. Comparar cantidades por valor decimal exacto, admitiendo ceros finales equivalentes sin escribir una corrección ficticia. Cambio de formato falla cerrado; fixture mínima oficial más señuelos/ambigüedad, sin HTML completo enGit.
2. Fuente constante `https://www.bcv.org.ve/`, TLS normal, sin secretos/cookies ni URL recibida. Timeout20s total incluyendo cuerpo/redirects, máximo2redirects canónicos verificados,200text/html,1MiB real leído/descomprimido, sin caché del framework ni retries internos. No usar Date deHTTP como fecha valor, ni tasa de otra fuente tras fallo.
3. Agenda única generada `5 * * * *`:24 invocaciones nominales/día, una obtención por invocación con posiblesredirects. No cuota global exacta ni instalación ahora. Deadline global50s con señal en fetch y DB, promises propias terminadas/esperadas; maxDuration60 no sustituye timeout bajo Node propio. Desactivar retries dedicadas SDK mediante retry(false), sin alterar cliente global.
4. Capturar día Caracas al iniciar, reutilizando helper finalC1; verificar vigencia antes de cada escritura. Ante cambio de día detener pendientes, sin cambiar valid_on. La revisión previa no garantiza COMMIT remoto anterior a medianoche; reportar resultado/ incertidumbre reales. Futuraespera/pasadanosatisfacehoy, sin copiar fines de semana/feriados/CNY ni caché futura durable.
5. Autenticación bearer con matchesBearerSecret antes deIO. Missing/invalid/querytoken no habilitan acceso. Flag BCV_RATES_ENABLED apagado por defecto; scope BCV_RATE_TENANT_IDS explícito UUIDúnicos/no vacío/cap25, validado porSELECTid y cobertura exacta. No todoslostenants ni scope porquery/body. No leer/configurar IDs/env productivos en esta entrega.
6. Petición normalflagoff→DISABLED/ceroIO; dryRun=1 estricto/autenticado con scopeválido permite lecturas/fetch incluso apagado, sin persistencia/auditoría/estado durable. Parámetro ausente significa modo normal; exactamente una ocurrencia con valor 1 significa ensayo; cualquier otro valor o repetición se rechaza antes de DB/red. Incluye true, vacío, 0, 01 y 1 repetido. Modo inmutable, guard de escritura independiente enabled&&!dryRun. Probar matriz on/off×dryRun y negativas; candidata jamás se anuncia registrada.
7. Cliente servicio servidor sin JWT humano; set_by=null y actor system comprobado porHTTPreal. No llamar RPCmanual excluida para servicio ni ampliarACL. Snapshot completo BCV/VES de hoy antes del fetch; rate::text exacto y set_at original sin truncar precisión. Error/null/duplicados/tenantajeno/truncamiento/shapeinválido no equivalen a ausencia.
8. INSERT sin upsert cuando ausente; conflicto unique solo relectura/reconciliación oconflicto. CorrecciónCAS porid+tenant+currency+day+source+rate+set_at observados, nuevo set_at explícito y retorno de una fila. InclusoUNCHANGED exige relectura íntegra exacta, sinUPDATE/nota/set_atchurn. No promesa de frescura editorial ni detección universalABA.
9. Timeout/respuesta perdida de escritura no prueba rollback ni autoría. Reconciliar solo por lectura dentro del presupuesto, sin segunda escritura automática. Incierto no reconciliado detiene las escrituras restantes y cuenta notAttempted/deferred. Resumen distingue inserted/corrected/unchanged/reconciled/conflicts/failed/unknown y pendientes, sin IDs/filas/HTML/secrets. No transacción global entre tenants ni exactly-once.
10. Auditoría existente atómica de cambios confirmados; prueba de actorSYSTEM y before/after porHTTPservicio sin auth.uid. Fallo de auditoría revierte tasa. Manual/operacion/CNY/prioridadbcv>manual>operacion/documentoscongelados intactos. NotaURL/retrievedAt/hash/day sanitizada y<=500. Repetición semánticamente idéntica no altera set_at ni crea auditoría ficticia.
11. UI solo aviso veraz enExchangeRatesSection y conservación del formulario manual: “no se confirmó una tasa para hoy” con última fecha/fuente comprobables. Null no demuestra ausencia ni caída del cron. Source manual permanece manual; no borrarBCV ni cambiar prioridades. Componente real/teclado/disposiciónestrecha/clarooscuro según política; no certificar A11Y integral o dispositivo físico porfixture.
12. Manifiesto pendiente permitido si0495 sigue pendiente en la base Git: callSites exactos de nuevos .from(fx_rates) y anclas verificadas del cierre propio del importador ante tabla/RPC ausente. No heredar el claim de ultimaTasa como prueba del escritor, cambiar cutoff/baseline/gate/exenciones ni retirar espera. Si el sello ya está integrado en la base final, reevaluar sin resucitar declaración vencida. Las incertidumbres posteriores auna escritura no pueden declararse cero escrituras o rollback sin prueba.

## Allowlist del encargo,28 rutas exactas

```text
app/api/cron/bcv-rates/route.ts
app/api/cron/bcv-rates/__tests__/route.test.ts
lib/studio/fx/bcv-types.ts
lib/studio/fx/bcv-parser.ts
lib/studio/fx/bcv-source.ts
lib/studio/fx/bcv-sync.ts
lib/studio/fx/__tests__/bcv-parser.test.ts
lib/studio/fx/__tests__/bcv-source.test.ts
lib/studio/fx/__tests__/bcv-sync.test.ts
lib/studio/fx/__tests__/bcv-persistence.migration.test.ts
lib/studio/fx/__tests__/fixtures/bcv-usd-20261021.html
lib/studio/fx/__tests__/fixtures/bcv-decoys.html
lib/studio/fx/__tests__/fixtures/bcv-ambiguous.html
scripts/tests/bcv-rates-postgrest.mjs
scripts/build-crontab.mjs
scripts/__tests__/build-crontab.test.ts
infra/dtd-cargo/cron/crontab
package.json
pnpm-lock.yaml
app/studio/(app)/admin/_components/ExchangeRatesSection.tsx
app/studio/(app)/admin/_components/ExchangeRatesSection.test.tsx
docs/runbooks/bcv-tasas-diarias.md
docs/runbooks/servidor-contabo.md
docs/specs/README.md
docs/specs/0569-conversor-usd-tasas/spec.md
.agents/handoffs/0569-bcv-carga-diaria.md
supabase/pending-migration-symbol-declarations.json
.env.example
```

No obligación de editar todo. Índice/cron mediante generador; package/lock solo dependencia parse5 directa8.0.1sin upgrades. `.env.example` documenta BCV_RATES_ENABLED apagado y BCV_RATE_TENANT_IDS vacío por defecto, formatoUUIDúnico/cap25, bearerCRON_SECRET existente y ensayo sin escritura; sin valores reales. No esconder lecturas para esquivar scanner ni modificar test/gate/Compose. Nueva ruta obligatoria se justifica al Director antes de editar. Regresiones0495/fx-rates/acciónmanual/RBAC/CAS/documentos/secret comparator se leen/ejecutan sin permiso de edición implícito.

## Aceptación y cierre local exigidos, todavía NO EJECUTADOS

Cumplir B1–B19 con reloj/stream/redirects/decimales/flags/scope/CAS/reconciliación y cuotas nominales. Definir casos/oráculos antes de implementar. Los módulos nuevos ausentes se registran como ausencia por objeto, no ROJO por missing-import/export/ENOENT/stub artificial. En cron/UI existentes sí reproducir comportamiento previo observable con módulos válidos; positivosSQLexistentes no se renombran defectos previos. Ejecutar módulos reales nuevos y mutantes proporcionales que fallen por la aserción funcional prevista, con restauración exacta. No contar sintaxis/fixture/timeout de preparación como defecto demostrado ni mutante detectado. No sumar corridas solapadas como casos nuevos.

PGlite0495 intacta y PostgreSQL/PostgREST14.17 local conJWTsintéticos: rate::text/ocho decimales, INSERT/correcciónCAS/unique/auditoríaSYSTEM/rollback alfallo, ninguna fuente/fila ajena tocada. Arnés durable solo loopback con endpoints/recursos propios y limpieza limitada; no prod/PII/secrets. Fuente real pública una vez desde el fetch implementado si permite la red, sin DBreal, informando instante/fecha observados; no acredita disponibilidad diaria ni VPS.

Tipos/lint/docs/cron/scope/guard/diff-check y pnpm verify sobre SHA guardado, una corrida pesada a la vez con turno delDirector. Conservar recibos/logs/hashes/omisiones e intentos fallidos, resultados PASÓ/FALLÓ/NO EJECUTADO/NO DISPONIBLE. Revisión independiente completa porSHA antes de aceptación local, sin confundir estadoAPR/CI/integración/publicación con pruebas.

Handoff durable con objetivo/completado/validación/commits/PR/pendientes/FUERADESCOPE/procesos/owner y conocimiento. Copiar íntegro este contrato al handoff antes de producto, conservar su versión original externa y registrar aclaraciones posteriores. Graphifyestructural, semántica, Archify, previewObsidian e integración/publicación se reportan separados; no bóveda compartida desde rama no integrada. PR en borrador apilada sobre la rama C3 final aceptada; commits selectivos/push propios sin main. Publicar únicamente después de checkpoint funcional revisable; no merge.

Excluidos: merge/auto-merge/deploy/VPS/cron instalado/configuraciónenv o flags reales/cuentas/pagos/migraciones/filas reales/contactos/PII/secrets/BCVCNY/cachéfutura/historialoperacionaldurable/dashboardnuevo. Env_file ya permite las futurasvariables; no modificar compose. Activación futura requiere configuración/scope y recreaciónweb concretos con aprobación/gates; no se pide ahora ni se ejecuta restart/install.

## Secuencia y frontera de turnos

Al activar: leer normas/overrides y las fuentes completas; comprobar raíz/rama/base y reclamar ownership mediante harness antes de editar; handoff y contrato previo a producto. Preservar tareas/worktrees ajenos. Lecturas y autoría ligera de pruebas/casos pueden separarse de instalaciones y ejecución. El primer turno pesado será expreso del Director y único; durante el turno ajeno no instalar ni ejecutar Node/tests/tipos/lint/build/SQL/Docker/navegador/conocimiento. Corepack explícito, auto-pin/downloadprompt desactivados solo en el proceso propio, sin cambios globales/secretos copiados; observar la versión real y conservar package/lock salvo el delta directo parse5 autorizado. No repetir una instalación exitosa para ocultar fallo de su envoltorio.

Con turno propio: instalación congelada inicial, autoría de pruebas/ausencias/ROJOS observables, implementación completa, focales/regresiones/mutantes/SQLHTTP/UI proporcional. Antes de la receta canónica, checkpoint selectivo/push propio y revisión porSHA, fuentes/sobre exclusivos y approvedHead; GO canónico específico del Director. Mantener freeze total incluido docs hasta EXIT y bytecheck inmediato de fuentes/HEAD/estado anterior a documentos. Si falta JSON original E2E, registrar NO DISPONIBLE sin reconstruir ni repetir para fabricar evidencia. No alterar runner/config/timeouts/gates.

Tras resultados revisados: documentos finales estables, un único ciclo nativo de conocimiento local, derivados separados/reportados y resultados externos+PR para no generar ciclos de autocita. Integridad/remoteequal/DRAFT/handoff/cleanup atribuible y liberación delclaim al entregar. No limpieza global ni procesos inciertos eliminados. Una tarea cerrada no significa release aprobado.

**Antes de activar este archivo:** fijar C3 final, árbol/rama/owner/claim, cotejar28rutas/lock/manifest/equivalencias y ausencia de colisiones/sesiones, y coordinar turno con0574. Este archivo preparado todavía no constituye el encargo ejecutable.


~~~~


### Addendum Director31rutas · SHA256 87589d14362e2e740713db01775ba5c7c551a2c6bbf4fe307932abd664049412

~~~~markdown

# SDD-0569 · decisión de alcance BCV, auditoría y 31 rutas

2026-10-21 · Director Codex. **DISEÑO LOCAL APROBADO; ASIGNACIÓN TODAVÍA NO ACTIVA.** Este addendum modifica únicamente los puntos expresos del encargo c477; no concede escritura de repositorio hasta la activación posterior con C3 final aceptado, worktree/rama/owner/claim y turno identificados. No autoriza producción, merge, deploy, VPS, datos reales, PII ni secretos.

## Fuentes y motivo de la enmienda

El encargo original completo `0569-bcv-asignacion-worker.md`, SHA256 `c477578e870ce7567d9c5e3ca10500e787169ded114bc41356daef6b4983f842`, queda conservado. Se aplican todas sus decisiones y evidencias salvo la exclusión de nueva SQL, la allowlist de28 y la fuente rpc del nuevo job indicadas abajo. El Worker copiará contrato y addendum íntegros al handoff propio antes de producto y conservará las versiones externas.

El Director leyó íntegros el prevuelo `0569-bcv-prevuelo-casos.md` (51635bytes, SHA256 `15e8471722d54fe32bdab65da06cfb78a08a2fc7f4fb7f78bb2452d82d818c9a`) y la propuesta `0569-bcv-propuesta-auditoria-r3.md` (28031bytes, SHA256 `aac64841eef9f43a9f49e964151cf719fa8e978631e5794202795d0e40960adb`). Son preparación y fuentes estáticas, no pruebas ejecutadas. Acepta la vía propuesta con las decisiones cerradas de este addendum.

AUD-01 v1.0 exige motivo para R3 y origen confiable. En0495 el INSERT auditado conserva reasonNULL y la nota queda fuera del evento. Por eso la nueva carga automática no puede declararse conforme solo por guardar procedencia en note. La decisión previa «sin SQL nueva» era de alcance y se sustituye por un ajuste local aditivo; **0495 ya aplicada permanece inmutable y no se repite**. No se modifica la política ni se inventa una excepción. Las brechas manuales preexistentes permanecen fuera del nuevo job.

## Decisiones de diseño obligatorias

1. **Una migración aditiva:** ruta coordinada `supabase/migrations/0535_bcv_rates_system_audit.sql`. Inventario del Director ejecutado con fetch normal:501refs+worktrees, siguiente SQL0535 y spec0578, salida0; recibo `bcv-numero-inventario-20261021-1130.txt`, SHA256 `39ddb10126e42643b02fdf2a9c111d495e66ceba014d74b00382863240a32851`. El nombre del recibo no es su hora real. Este documento coordina el número pero NO crea reserva. Al activar, revalidar colisiones antes del primer stub/commit propio; si0535 está ocupado, volver al Director sin elegir otro. SDD0569 se reutiliza; no reservar0578. La numeración estable NNNN del repositorio prevalece sobre el generador timestamp genérico de la skill Supabase.
2. **Rama estrecha de auditoría:** reemplazar solo el cuerpo de `audit_fx_rate_change()` mediante nueva SQL, conservando owner/SECURITYDEFINER/search_path vacío/OID cuando corresponda, ACL y trigger existentes. No editar0495/0267/0294 ni sus tests. Solo INSERT o UPDATE real de BCV/VES por contexto HTTP de servicio confiable, sin sub humano/auth.uidNULL, set_byNULL; UPDATE conserva identidad/clave BCV/VES. Fuera de esa rama se conserva el comportamiento previo.
3. **Contexto confiable:** candidato concreto `current_setting('role',true)` para el rol de request, combinado con claimsJSON modernos válidos, role service_role, ausencia de sub y auth.uidNULL. `current_user` dentro de SECURITYDEFINER observa al definer y no acredita el rol del request. Capability INVOKER debe comprobar contexto coherente. No basarse solo en claims, set_byNULL, note, query o header libre. La prueba HTTP por PostgREST14.17 dentro del trigger es gate obligatorio: positivo servicio sin sub, humano positivo, anon/authenticated negativos, servicio con sub y contexto ambiguo rechazados. Si el mecanismo no se demuestra, detener esa parte y entregar evidencia al Director; no reemplazarlo por una suposición o ampliar permisos.
4. **Motivo generado en DB y origen job:** INSERT «Carga automática del catálogo BCV: tasa oficial VES por 1 USD para la fecha valor AAAA-MM-DD.»; UPDATE «Actualización automática del catálogo BCV: tasa oficial VES por 1 USD para la fecha valor AAAA-MM-DD.». La fecha se obtiene de la fila validada. Son motivos del propósito de la automatización autorizada, no confirmación humana de cada tick. Append vigente conserva actor system/NULL, eventos recorded/corrected, resultado succeeded, sensibilidad restricted, versión y correlación fx-rate existentes. Source **job solo en la rama nueva**; source rpc y motivos anteriores del resto permanecen iguales. La rama debe rechazar dtd.audit_reason previo no vacío para no heredar otro motivo a través de0294.
5. **Atomicidad y minimización:** mismo trigger/transacción para tasa y evento; un fallo real del append revierte la sentencia. No segundo evento desde app. Before/after mantiene exclusivamente currency/rate/valid_on/source; note y set_by siguen fuera. Nota<=500 conserva solo procedencia sanitizada autorizada; no historial nuevo de observaciones ni copia de HTML enGit. Valor equivalente no cambia note/set_at ni genera evento.
6. **Capability exacta:** nueva `public.bcv_rates_write_capability()`, sin argumentos, STABLE, SECURITYINVOKER, search_path vacío, owner explícito, EXECUTE revocado aPUBLIC/anon/authenticated y otorgado únicamente a service_role. Respuesta pequeña `version:1` y `ready:boolean`, sin filas/IDs/secretos/definiciones. True solo si contexto y catálogo cumplen el contrato instalado: huella de cuerpo aprobada, seguridad/owner/search_path, trigger asociado/habilitado y cadena append requerida. Huellas esperadas fijas revisadas; jamás autogenerarlas desde cualquier cuerpo encontrado y darlo por aprobado. Readyfalse/error ante ausencia o drift. No helper global nuevo, tabla, RLS o permiso de escritura adicional.
7. **GET real y fallo cerrado:** usar SDK2.106.1 `.rpc(..., ..., {get:true})` con `.retry(false)` y `.abortSignal` del mismo presupuesto50s. Capability solo lectura comprobada por HTTP real. Auth/query/flagOFFnormal siguen antes de crear cliente/IO; scope y snapshot íntegros antes del fetch oficial. Capability válida antes del fetch y de cada DML efectivamente intentado, sin retrasar/reiniciar deadline. Si falla, no enviar esa mutación y detener pendientes, conservando confirmados/unknown anteriores. Un true no es lock/lease ni protección ante DDL posterior; rollout/rollback exige jobOFF y quiescencia demostrada, sin promesa de corte físico por abort o sleep50s.
8. **Ensayo único y estricto:** dryRun1 exige también capability íntegra/válida, incluso con flagOFF. Si falta, devolver contrato SQL no disponible; cero fetch oficial, DML, audit o éxito integral. No modalidad alternativa de candidata de solo fuente. Preserva parámetros exactos/no repetidos, scope, modo inmutable y guard independiente enabled&&!dryRun. La matriz B16/R13 deberá medir tráfico por método: GET de capability no permite ningún POST/PATCH/DELETE durante ensayo.
9. **Transporte dedicado dentro de bcv-sync:** crear cliente dedicado mediante `createClient`/`options.global.fetch` nativos; no inventar opciones para `createAdminClient()` ni cambiar cliente global. Observar status HTTP original antes de que SDK convierta404array/vacío en200/204. Errores no se normalizan a ausencia: cuerpo seguro objeto/error conservando status y solo código SQLSTATE/PostgREST validable cuando haga falta; nunca SQL/messages/rows/auth crudos. Cuerpo/error bajo deadline, cleanup correcto, sin retries. Controles con SDK real + proxy loopback:404array,404vacío,404objeto,503,2xxtruncado y200[]count0 genuino; lecturas inválidas nunca permiten DML.23505 solo si código válido y se reconcilia por lectura;409genérico no basta. Tras mutación enviada sigue UNKNOWN si falta certeza, nunca rollback por un status de transporte.
10. **Preflight/postflight SQL y compatibilidad:** comprobar preimagen real de prosrc en fixture, owner/ACL/trigger/cadena existente; abortar ante instalación parcial o drift. Instalación transaccional sin DML de negocio/auditoría ni backfill; límites de locks/tiempo medidos, no promesa de cero bloqueo. Nueva capability y cuerpo audit se instalan juntos; recarga PostgREST alCOMMIT y falta de caché nueva cierra. Prueba negativa por preflight incompatible y rollback de instalación. Las tasas/documentos históricos/prioridadBCV>manual>operacion/manual/CNY y RPC humana conservan oráculos originales. Usar ACL efectiva paraPUBLIC y no confundirla con un rol ordinario; PostgreSQL17 documenta además su tratamiento especial en consultas de privilegios.

## Allowlist acumulada:31 rutas literales, sin obligación de editar todas

```text
app/api/cron/bcv-rates/route.ts
app/api/cron/bcv-rates/__tests__/route.test.ts
lib/studio/fx/bcv-types.ts
lib/studio/fx/bcv-parser.ts
lib/studio/fx/bcv-source.ts
lib/studio/fx/bcv-sync.ts
lib/studio/fx/__tests__/bcv-parser.test.ts
lib/studio/fx/__tests__/bcv-source.test.ts
lib/studio/fx/__tests__/bcv-sync.test.ts
lib/studio/fx/__tests__/bcv-persistence.migration.test.ts
lib/studio/fx/__tests__/fixtures/bcv-usd-20261021.html
lib/studio/fx/__tests__/fixtures/bcv-decoys.html
lib/studio/fx/__tests__/fixtures/bcv-ambiguous.html
scripts/tests/bcv-rates-postgrest.mjs
scripts/build-crontab.mjs
scripts/__tests__/build-crontab.test.ts
infra/dtd-cargo/cron/crontab
package.json
pnpm-lock.yaml
app/studio/(app)/admin/_components/ExchangeRatesSection.tsx
app/studio/(app)/admin/_components/ExchangeRatesSection.test.tsx
docs/runbooks/bcv-tasas-diarias.md
docs/runbooks/servidor-contabo.md
docs/specs/README.md
docs/specs/0569-conversor-usd-tasas/spec.md
.agents/handoffs/0569-bcv-carga-diaria.md
supabase/pending-migration-symbol-declarations.json
.env.example
supabase/migrations/0535_bcv_rates_system_audit.sql
supabase/tests/bcv_rates_system_audit.test.sql
supabase/migrations-baseline.json
```

Baseline solo agrega la espera nominal0535 con dependencia/aplicación/verificación y fallo cerrado por capability ausente; cutoff238/0495 y otras esperas intactos. No declarar aplicada. Manifiesto de símbolos registra referencias y anclas reales del código, sin inventar líneas, omitir scanner o cambiar gates. Las tres rutas adicionales se cotejan también antes de escribir; no autorización de ruta32. SQL nueva y contrato durable entran en las recetas canónicas nativas existentes sin cambiar runner/config/timeout. Índice y crontab se regeneran con sus scripts.

## Evidencia y pruebas adicionales obligatorias

Conservar B1–B19 completos del prevuelo; B10 del documento histórico espera source rpc y **se sustituye solo para el nuevo job por source job/motivo no vacío**, sin renombrar resultados anteriores. Añadir R1–R14 de la propuesta, con decisión de ensayo del punto8. No declarar que leer este addendum ejecutó algo.

- Ausencia de0535/capability: normalON y ensayo no envían DML, no fetch/candidata ni éxito. OFFnormal/authqueryinválida mantienen cero IO.
- GET/ACL/rol dentro deSECURITYDEFINER, JWTserviciosinsub y humano positivo reales; claims de rol sin rol efectivo no habilitan rama. Probar sub no válido/no vacío y contexto de motivo previo. Cualquier error de parseo de claims falla seguro; no actor SYSTEM por fallback silencioso.
- INSERT/correcciónCAS/UNCHANGED, cuatro campos exactos en auditoría, motivo y job, rollback por append real; before/after rate::text y timestamps microsegundos por SQL. Control de fuente/moneda/tenant/documentos ajenos y pruebas0495 originales intactas, incluidas las expectativas de nota excluida.
- Readiness no autovalida cuerpo anterior/trigger disabled/versión oshape falso/readytrue constante. Intercalación entre tenants detiene lo pendiente sin borrar confirmados. Pérdida de ACK trasCOMMIT solo reconcilia o UNKNOWN, sin repetirwrite. No garantía frente a DDL arbitrario concurrente; se documenta quiescencia.
- Mutantes funcionales proporcionales de motivo/origen/contexto/capacidad y transporte, además de parser/fecha/decimal/scope/ensayo/CAS. Restauración exacta; una falla de sintaxis/importación/infra no cuenta como defecto previo o mutante detectado.

Pruebas HTTP soloPG17.11/PostgREST14.17/SDKreal con JWTsintéticos loopback y recursos propios; versiones efectivas por SQL/binario, no inferidas de etiqueta postgres:17. SetupCOMMIT separado de contrato0495ROLLBACK; no shim auth.uid siempreNULL. Driver duradero, inliner TS real y cleanup atribuido. Ningún secreto/PII/contrato financiero crudo enGit. Fuente oficial pública una vez desde fetch implementado bajo turno, sin DBreal.

Primero checkpoint funcional revisable con spec/handoff/allowlist exactos y commits selectivos. Revisión por SHA antes de GO canónico. Freeze de fuentes/lock/receta/documentos hasta EXIT y bytecheck; originales nativos E2E capturados por observación externa antes de SQL/build, sin hooks/replay/reconstrucción. Después documentos finales estables y un único ciclo nativo de conocimiento local; recibo externo para evitar autocitas. Guard/remoto/DRAFT/claim/resources al cerrar. Sin repetición por documentación ni publicación compartida desde borrador.

## Normativa, documentos públicos y límites

Director revisó AGENT-BRIEF/registro y políticasAUD-01/SGE-00/MP-01; validator del plugin PASÓ28políticas/5componentes, lo cual valida registro y no conformidad de producto. La matriz de12principios se entrega con evidencia; conformidad del job permanece PENDIENTE de implementación/pruebas. Activación humana del job/producción sigue nominal y futura, sin confirmación humana inventada por tick.

Consulta primaria pública del Director21oct: [PostgREST14 autenticación](https://docs.postgrest.org/en/v14/references/auth.html) describe impersonación del rol validado durante el request; [transacciones14](https://docs.postgrest.org/en/v14/references/transactions.html) documenta settings transaccionales, claimsJSON, role y GETREADONLY. [PostgreSQL17 información de sesión](https://www.postgresql.org/docs/17/functions-info.html) distingue usuario efectivo bajoSECURITYDEFINER; [SETROLE17](https://www.postgresql.org/docs/17/sql-set-role.html) explica límites de cambio de rol. Estas fuentes justifican la vía candidata, **no sustituyen su prueba HTTP local**. El SDK instalado fue leído por hash/rangos del prevuelo.

Se consultó [changelog Supabase](https://supabase.com/changelog); el endpoint.md devolvió contenido no soportado por el navegador y se usó suHTML. Esto no cambia versiones fijadas ni habilita upgrades/Compose/configuración. La automatización mantiene controles de retry explícitos del SDK actual; CLI/advisors reales y datos alojados siguen fuera de alcance. Ninguna actualización de servicio se deduce de una noticia del proveedor.

Excluidos: edición/reaplicación0495, appendglobal, RLS/ACL humana nueva, tablas, RPC escritora, caché futura/diario durable de corridas, dashboard, backfill, documentos congelados, CNY, flags/env reales, cron instalado, billing/cuentas, main/merge/deploy/VPS/datos/PII/secretos/contactos. El número0535 y31rutas se harán efectivos únicamente con activación aislada posterior; hasta entonces **NO ACTIVO**.


~~~~


### Activación Worker fase ligera · SHA256 93c4ebe5eab90ad823c44a2715829efbd49cf7ced64eb4c2b13ccc0d596843ce

~~~~markdown

# $worker · activación aislada0569 BCV diario

Director Codex · 2026-10-21. **ACTIVO EN FASE LIGERA.** Sam autorizó continuidad local, commits/push propios y entregas enPR DRAFT. El Director conserva su rol y asigna implementación a un único Worker aislado. El único turno pesado actual pertenece a0574; este archivo NO concede instalación, suites, tipado/build, SQL/Docker, UI/navegador o conocimiento en paralelo.

## Resultado observable y propiedad

- Objetivo: carga oficial BCV VES por1USD exactamente de hoyCaracas, con decimal completo, concurrencia/incertidumbre honestas, auditoría atómica de sistema con motivo/origen y respaldo manual; parser, ruta cron, agenda generada, controles y documentación completos según contrato. Sin activación productiva.
- Worker único: `/root/revision_bcv_prevuelo`, que **adopta explícitamente el rol Worker en esta fase nueva**. Su preparación anterior terminó read-only y no le transfirió ningún árbol/claim ajeno.
- TaskID: `0569-bcv-carga-diaria`. Owner nuevo: `worker-0569bcv-01a15a4e-ddf0-7d82-8656-d9dc56b58468`.
- Repositorio canónico: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Base literal: C3 final aceptado **`1905aef75680a80055621cffd717198915d089f9`**. No origin/main, otra punta o cambios sin commit. C3 PR314DRAFT/baseC2/once rutas y todos sus límites permanecen; no incorporar0573 ni carril de embarques.
- Rama nueva exacta: `codex/sdd-0569-bcv-carga-diaria`.
- Worktree nuevo esperado: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0569-bcv-carga-diaria`.
- Handoff propio: `.agents/handoffs/0569-bcv-carga-diaria.md`. SDD reutilizada `docs/specs/0569-conversor-usd-tasas/spec.md`, continuación fechada; noSDD0578.
- Evidencia externa propia nueva: `C:/tmp/director-traspaso-20261020/0569-bcv-validation/`. Si existe con datos/owner no esperados, preservar y reportar antes de usar; nunca sobrescribir.

El Director verificó ausencia de esa rama/ruta durante preparación y coordinó inventario501refs+WTs con0535siguiente. Revalidar antes de crear. Crear mediante **harness start** con slug `sdd-0569-bcv-carga-diaria` y `--from 1905aef75680a80055621cffd717198915d089f9`, sin mover/alterar árboles existentes. El harness documentado no instala ni copia.env. Verificar la ruta/rama/base devueltas y usar esa raíz para todo lo posterior. Reclamar ownership nuevo con harness claim/owner anterior y guard antes de escribir. Si hay rama/ruta/claim ajeno, no robar ni resetear: informar y continuar solo lectura independiente.

## Contrato activo y alcance exacto

Leer íntegro y aplicar conjuntamente, conservando sus hashes:

1. Encargo original `0569-bcv-asignacion-worker.md`, SHA256 `c477578e870ce7567d9c5e3ca10500e787169ded114bc41356daef6b4983f842`, incluidas fuentes/lecturas/B1–B19 originales. Su estado preparado queda sustituido por esta activación, y sus exclusiones sin SQL nueva se sustituyen solo como sigue.
2. Addendum Director de **31 rutas literales** `0569-bcv-addendum-auditoria-director-31-rutas.md`, SHA256 `87589d14362e2e740713db01775ba5c7c551a2c6bbf4fe307932abd664049412`. Es la allowlist acumulada exacta y fija SQL **0535_bcv_rates_system_audit.sql**, pruebaSQL y declaraciónbaseline adicionales. No ruta32 por conveniencia.
3. Prevuelo preparado `0569-bcv-prevuelo-casos.md` SHA256 `15e8471722d54fe32bdab65da06cfb78a08a2fc7f4fb7f78bb2452d82d818c9a`; propuesta AUD `aac64841eef9f43a9f49e964151cf719fa8e978631e5794202795d0e40960adb`; contexto `c403d21ce5e691677f52c7d8f34bfda76d121a02cd25ebbf249290e8a4168957`. Son preparación, no pruebas ejecutadas; prevalecen las decisiones del addendum, incluido dryRun con capability válida antes de fetch/candidata.
4. Revisión independiente `0569-bcv-revision-addendum31-peer.md`,12570bytes/SHA256 `d17c5ef8f204d59d07f957b94c3e4718b1dd41245b0da045eee83b65f12b5d36`: sin contradicciones obligatorias nuevas de diseño, productoR3 y gatesHTTP todavía pendientes.

Antes del primer producto, conservar íntegros encargo original, addendum y esta activación en el handoff propio, con objetivo/owner/base/31rutas/permisos/aceptación/dependencias y estado en progreso. No actualizar el checklist del Director ni handoffs de otros dueños. Registrar propuesta/decisión/prueba como categorías distintas.

**0535 está coordinada, no reservada todavía.** Revalidar colisiones de refs/PR/worktrees/archivos sin commit antes del primer stub; ejecutar inventario nativo de lectura y comprobar que el número asignado sigue libre. No pedirte elegir el siguiente: si0535ya está ocupado, volver al Director. Si libre, reserva localmente mediante un stub/commit coherente en esta rama propia y0569continuada, sin publicar directa o indirectamente main. No renumerar0495 aplicada ni ninguna aplicada. No nuevoSDD.

## Fase ligera autorizada ahora

- Lecturas Git/locales/SDD/AGENTS/Worker/runbooks/project-rules/AGENT-BRIEF/políticas/marca/Norte pertinentes y documentación pública primaria. Harness start/claim/guard, metadatosGit y generadores documentales ligeros permitidos. No significa otro turno pesado.
- Verificar31preimágenes sobreD:28previas12existentes/16ausentes, más baseline existente y dos SQL/test nuevos ausentes. Lock/manifest y funciones críticas deben coincidir con la base; diferencias legítimas se informan antes de adaptar, sin heredar cambios de otros árboles.
- Especificar casos/oráculos y authorar nuevos módulos/fixtures/tests/SQL dentro de allowlist, documentación y commits locales selectivos. No tratar ausencias de módulos como ROJO por import/ENOENT, ni declarar conformidad/ejecución al escribir código.
- **Preservar cron/UI existentes hasta medir su baseline funcional bajo turno**, y package/lock hasta instalación congelada inicial y promoción directa parse5 autorizada. Puedes leer/diseñar sus cambios mientras tanto. No crear symlinks/copiar node_modules o secretos para evitar la instalación propia.
- Preparar plan reproducible del primer bloque pesado: instalación congelada con manager real, baseline válida y gate pequeño SQL/HTTP del rol dentrodefiner, antes de ampliar la aceptación. No ejecutar todavía Node de pruebas, gestor/instalación, PGlite, SQL/Docker, tipado, build, servidor/browser, fetch BCV implementado o Graphify/Archify.

No se requiere permiso adicional para ediciones reversibles/commits de esa fase dentro del alcance. Reportar adopción/root/rama/claim/base/31preimágenes y reserva local al quedar concretas, además de qué puedes seguir authorando mientras0574 corre. Después continuar autónomamente en fase ligera, sin esperar un «sigue». El Director concederá turno pesado explícito al devolver0574.

## Validación y entrega autorizadas, con turno posterior

El alcance completo B1–B19/R1–R14 permanece obligatorio: fuente/parser reales; auth/query/flagOFF/scope; deadline50s/20s/cancelación/retryfalse; snapshot íntegro textual/INSERT/CAS/relectura/UNKNOWN; transporte404SDK por HTTP; nueva auditoríaSYSTEM/job/motivo y rollback real; capabilityGET/contexto y huellas/ACL. Gate de roleGUC/claimsJSON/sinausenciaambigua desub/login/auth.uid dentrotrigger real por PG17.11/PostgREST14.17, humano positivo y negativos, no una inferencia del rol definer. Regresiones0495/manual/tenant/CNY/frozen intactas. SQL aplicada anterior no se edita. Focales, mutantes funcionales y UI proporcional, recibos/omisiones/errores de preparación separados; no sumar cobertura solapada.

Recorrido SDK/TS real debe probarse, sin inventar factories existentes o métodos. Role/job no atesta exclusividad del cron frente a otro poseedor legítimo de servicio; GET no inmovilizaDDL. No afirmar rollback/autoría sin certeza ni estabilidad por una pasada. Contexto/capacidad faltante no activa fallback antiguo del importador. Reglas de ensayo y flagOFF no se relajan para la fixture.

Checkpoint funcional con hash/allowlist/diff/handoff y pruebas recibidas por Director antes de canónica. Commits locales selectivos y **publicación de rama propia/PR DRAFT autorizadas después del checkpoint funcional revisable**, base de PR exacta `codex/sdd-0576-fechas-caracas-movil`; adjuntar PR con herramienta app al crearla. No merge ni auto-merge. Una reserva local inicial no se presenta como entrega probada o respaldo remoto; mantenerla visible y publicar el trabajo al llegar ese checkpoint.

Canónica normal pnpmverify sobreSHA revisado y guardado, con freeze de fuentes/config/lock/docs hasta EXIT/bytecheck, originalesnativos E2E capturados externamente antes de su eliminación, sin hooks/reconstrucción/replay. No overrides de tiempo/memoria/workers/gates ni nueva DBpara satisfacerledger. Un exit0 conSKIP queda incompleto. Documentos finales estables y único ciclo nativo de conocimiento después, recibo externo/PR para evitar autocita; semántica/Archify/preview/Obsidianvisible/integración separados. Recursos atribuidos y releaseclaim al cierre aceptado, sin eliminarWT/rama/store.

## GateC3 cumplido y fronteras persistentes

C3 finalD1905 aceptado por dictamen `ea3a694b5b088523542e868732d683fd1f661e75b86b13f6d56bbbfa7279e562`,1527archivos cotejados/0diff; claim liberado11:36:47.5802903Z,guard/release0,161identidadesconocidas/0restantes,remoto/DRAFT/body/limpio verificados. Recibo `0576-c3-next/documentation-3/claim-release-final.json`,SHA256 `4edd64a01e9ca8719c963bfccc652b76345103b4a1582374d6c9d5dfa99614ca`; checksum y ausencia delclaim comprobados por Director. El cierre local se guardó enPR308 `d0a3229a6b48ee5a481cb971895b2ead284a2b28`, limpia/remoto/body exactos.

El objetivo anterior terminó localmente y sigue este objetivoBCV. 0574 realiza su canónica desde11:38:08Z; BCV **no tiene turno pesado aún**. Root coordina y revisa, nunca producto. Sin main/merge/deploy/VPS/cron instalado, flags/env/cuentas/pagos reales, DBreal/negocio/PII/secretos/contactos o bóveda compartida. **0495 aplicada una vez no se repite;0535 requiere OK nominal futuro de Sam para producción**. La autorización de trabajo local no lo sustituye.


~~~~

## Renumeración 0501 → 0535 (2026-11-11)

La migración de auditoría BCV pasa a `0535_bcv_rates_system_audit` (contrato
`supabase/tests/bcv_rates_system_audit.test.sql`, sin número en el nombre): main
llegó a la 0526, la 0501 no está aplicada en ningún entorno y 0528-0532 están
ocupadas. Se renumeraron sus literales, la espera de `migrations-baseline.json`
(sigue sin aplicar), el grupo de símbolos, pruebas, arnés HTTP, runbooks,
`.env.example` y citas. Los UUID sintéticos `…-000000000501` del contrato no son
el número de la migración y no cambian. SHA-256 anterior `bf265183a6c483cd2aae0412b330cbccc2e3804de7423b00664e89ae8c046d2e`, nuevo
`5966336a166a140db7b4044c73a043230cf3b82d8441ad017cc078448f6f1a75`. La entrega sigue PARCIAL como la #317 que reemplaza
(rama `claude/sdd-0569-bcv-carga-diaria`).
