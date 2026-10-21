# SDD-0569 · carga diaria oficial BCV · handoff Worker

## OBJETIVO ORIGINAL

Cargar exclusivamente VES por 1 USD de la fecha valor igual a hoy America/Caracas, con decimal completo, control de concurrencia e incertidumbre, auditoría atómica SYSTEM/job con motivo DB fijo y respaldo manual. Reutiliza SDD0569. Desarrollo local y eventual PR DRAFT; sin producción, merge ni deploy.

## ADOPCIÓN Y PROPIEDAD

- Estado: EN PROGRESO · fase ligera activa desde 2026-10-21. Única sesión escritora `/root/revision_bcv_prevuelo`, ahora explícitamente Worker; Director conserva coordinación y revisión.
- TaskID: `0569-bcv-carga-diaria`.
- Owner: `worker-0569bcv-01a15a4e-ddf0-7d82-8656-d9dc56b58468`.
- Raíz: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0569-bcv-carga-diaria`.
- Rama: `codex/sdd-0569-bcv-carga-diaria`.
- Base literal: `1905aef75680a80055621cffd717198915d089f9` (D C3 aceptado).
- Aislamiento creado por harness start con --from exacto; claim nuevo adquirido y guard --owner PASÓ. No traslado de trabajo ajeno.
- Evidencia propia: `C:/tmp/director-traspaso-20261020/0569-bcv-validation/`, creada nueva tras verificar ausencia. Recibo `preimagenes-31.json`: 13 rutas existentes, 18 ausentes, 0 diferencias frente a D; ausencia no es control rojo.
- Allowlist exacta acumulada: 31 rutas del addendum íntegro conservado abajo. Sus 31 preimágenes se verificaron antes de escribir. No ruta32 implícita.

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
| Reserva0501 | Inventario nativo PASÓ:502refs+worktrees, SQL0501 libre; stub local coordinado creado. Reserva local commit9591b2436. Cuerpo candidato0501 autorado después, todavía sin ejecutar ni publicar. |
| Nuevos módulos | AUSENTES inicialmente; no se ejecutó import/ENOENT como rojo. |
| Instalación congelada, baseline cron/UI | PASÓ GO01: bootstrap único, baseline válido2archivos/12casos/0omisiones sobre preimagenD. Primer shim falló en preparación antes de pruebas; recibo separado. |
| Promoción/importación parse5 | PASÓ autoría mínima9cd35b1ef y enlace/importación GO01C: versión efectiva8.0.1 desde árbol propio,31fuentes sin cambios. Promociones offline GO01/01B FALLARON PREPARACIÓN por metadata, sin ROJO funcional ni red añadida. |
| SQL/HTTP/contexto/SDK | PASÓ gate acotado GO02: PG17.11/PostgREST14.17/SDK2.106.1, siete controles y 26 negativos DML. 24 rechazos sin efecto y 2 humanos user/rpc. No cubre el importador completo ni transporte amplio. |
| Focal persistencia 0501 | PASÓ 10/10, 0 omisiones en f1061d2ea: contexto inicial/restaurado exigido, compatibilidad 0495, cuatro mutantes funcionales y rollback poscreación/catálogo en la misma DB. Intentos previos conservados, no sumados a cobertura. |
| Parser/source/sync/route generales, UI, tipos/lint/build/verify | NO EJECUTADO. F01/F02/F03 siguen pendientes de ROJO válido y reparación posterior. |
| Graphify/semántica/Archify/preview/publicación | NO EJECUTADO; único ciclo local tras documentos estables y turno del Director. Sin bóveda compartida. |
| Producción/ledger/migración/cron instalado | NO EJECUTADO y no autorizado.0495 aplicada no se repite;0501 exige OK nominal futuro. |

## PRIMER GATE PREPARADO PARA TURNO PESADO

1. Completado bajo GO01/01B/01C: Node24.20.0/pnpm12.14.0 reales, instalación propia congelada, baseline cron/UI antes de alterarlos y promoción/importación parse5 directa8.0.1. No repetir ese baseline por documentación.
2. Fixture efímera PG17.11 y PostgREST14.17 propios/loopback; verificar versiones efectivas. Setup durable COMMIT separado de contrato0495 original ROLLBACK. Cargar cadena real0267/0294/0495 sin editarla y contrato nuevo0501.
3. Gate pequeño: observar dentro del trigger SECURITY DEFINER role GUC/current_user/session_user/claims; servicio sin sub positivo, humano positivo para auth.uid, anon/authenticated y servicio con sub/contexto ambiguo negativos. Current_user del definer no acredita caller. Si no se demuestra, detener esa parte y devolver evidencia; sin fallback a claim aislado.
4. Capability real GET service-only y huellas/ACL/preflight/drift; dryRun también la exige antes de fetch/candidata. Verificar motivo DB fijo/source job y rollback real de tasa si append falla. GET no inmoviliza DDL; no exclusividad del cron frente a otro poseedor legítimo de servicio.
5. Después ampliar B1–B19/R1–R14 y transporte SDK real404/503/truncado/ACK perdido, focales/regresiones/mutantes/UI. Checkpoint por SHA para revisión antes de GO canónico separado. No afirmar estabilidad por una pasada.

## COMMITS

Reserva local `9591b2436033f1200ef71a79bb4e9ce67f10fbac`; candidato ligero `1ff0bbee4`; cleanup driver `01e830bdf632052c0f798e3de737b4336e949c55`; proxy loopback propio `93ac1a33f47bdeb4c4f85ffa6a8627e113092d1a`; promoción mínima parse5 `9cd35b1ef252b477969a3c50fdda0bd47c3da04e`. Ninguno constituye checkpoint funcional integral. Publicación solo después de checkpoint funcional revisable.

## PR / BRANCH

Rama propia indicada arriba. PR todavía NO CREADA. Base futura exacta: `codex/sdd-0576-fechas-caracas-movil`. Push propio y PR DRAFT autorizados después del checkpoint, no main/merge/auto-merge/deploy.

## PENDIENTES DE ESTA TAREA

- Reserva0501 completada localmente. Módulos/parser/source/sync/route, fixtures, SQL/contratos, driver pequeño y documentación autorados como candidatos; falta demostrar y corregir bajo turno. Cron/UI aún idénticos aD; package/lock solo promoción directa8.0.1.
- Gate SQL/HTTP pequeño y focal0501 completados bajo GO02; resto B1–B19/R1–R14 y canónica pendientes. Dos P2 SQL medidos: negativos DML con efectos/eventos y mutante funcional del guard; rechazo después de ambosDDL y catálogo exacto tras ROLLBACK en la mismaDB. Parser/source conservan producto candidato hasta ROJOS F01/F02/F03 en turno funcional futuro.
- Matriz SGE12 de producto con clasificación/evidencia real, no ascender matriz estática a conformidad.
- Documentos finales, recibos de cierre nativos, ciclo único de conocimiento local, PR DRAFT, integridad y cleanup de recursos atribuibles; liberar claim solo al concluir escritura y cierre aceptado.

## FUERA DE ALCANCE DETECTADO

- Main conserva archivos no rastreados preexistentes observados al iniciar; no se copian, abren ni limpian en esta tarea.
- Brechas manuales históricas de auditoría no se absorben; no tocar0495/0267/0294, append global o UI manual por inercia.
- No producción/Supabase real/VPS/cuentas/pagos/PII/secretos/env reales, configuración o instalación de cron, flags reales, CNY, historial durable, dashboard, documentos congelados, permisos humanos nuevos o ruta32.

## HANDOFF AL DIRECTOR

Fase ligera activa. El Director conserva el único control de turnos y concede el pesado posterior; no se necesita otro “sigue” para autoría reversible permitida. Ninguna evidencia preparatoria sustituye ejecución. Las decisiones más recientes de activación/addendum prevalecen sobre estados preparados/exclusiones históricas conservados abajo.

## RECIBOS GO01/GO01B/GO01C · 2026-10-21

En `C:/tmp/director-traspaso-20261020/0569-bcv-validation/`: GO01 `go01-instalacion-baseline-01/go01-close.json`, SHA256 `7c1789d2cc8450ecaea97d2a434bf9ffb38e4becd6fb601299733f12ad4e21f0`; GO01B `go01b-promocion-importador-01/go01b-close.json`, SHA256 `59e0f3a1cc5003b731675b7dfc98294093895cd764ff781c565aa444955d14fb`; GO01C `go01c-enlace-congelado-01/go01c-close.json`, SHA256 `f55394987be013be6609e5452c780a39053bef3cd12cb12002c8ace162293c40`.

GO01 conservó por separado el shim previo fallido y la promoción offline sin metadatafsevents. GO01B conservó su único enlace offline fallido sin metadata@next/env y no trató el módulo ausente como ROJO. GO01C permitió registro para metadata/artefactos bloqueados:936entradas pasaron la política, resolución omitida, enlace5.5s e importación mínima8.0.1 PASARON. Advertencia pnpm12 sobre `pnpm.onlyBuiltDependencies` ignorado conservada; sin cambiar config/política. Su primera captura amplia no produjo recibo completo/salida de sesión retenida; la captura acotada02 de31rutas sí quedó completa. No hubo gestor en la captura fallida.

Los tres turnos fueron devueltos expresamente. Cotejos residuales propios:0identidades/descendientes observables vivos,0puertos/contenedores iniciados/terminaciones. GO01C duró6.2s y no tuvo snapshot durante la corrida; el recibo declara ese límite. Claim se conserva para autoría ligera. Módulos/testsBCV, SQL/HTTP/Docker/PGlite, tipos/build/verify, browser, conocimiento y fetch implementado siguen NO EJECUTADOS.

## CHECKPOINT DE AUTORÍA LIGERA · 2026-10-21

Registro anterior a GO01/01B/01C, conservado como estado fechado; los recibos superiores lo actualizan.

Autorados tipos/decimal, parser estructural y3fixtures mínimas; fuente acotada; factory/transportSDK dedicados; sync/route y casos funcionales preparados.0501 y contrato adicional/PGlite conservan cadena real con preflight/huellas/ACL y motivos nuevos acotados. Manifiesto/baseline/env.example/runbooks registran cierre propio sin cambiar gates. Driver context-only está preparado, sin ejecutarse; todavía falta ampliar HTTP de transporte/concurrencia/incertidumbre después del gate de contexto.

No se modificaron cron/UI/package/lock porque esperan baseline/instalación bajo turno. Ningún test/suite, Node de producto, SQL/Docker, navegador, fuente remota desde implementación o conocimiento se ejecutó en esta fase. Las autorías todavía pueden contener defectos de preparación/comportamiento: no se declaran conformes ni verdes. El primer bloque reproducible quedó en `C:/tmp/director-traspaso-20261020/0569-bcv-validation/primer-turno-preparado.md`.

SQL/contexto: la candidata role GUC+claims+auth.uid/login necesita HTTP real. Solo después se amplía aceptación. GETcapability no inmovilizaDDL; uso de servicio no atesta cron exclusivo; timestampCAS no promete ABA universal. Se conserva UNKNOWN y no se repite write ante falta de certeza.

Dos incidentes de preparación corregidos, sin ejecución de producto: PowerShell pipe inválido al formatear metadatos y rechazo de apply_patch por Delete+Add de la misma ruta. La receta externa los conserva; no son ROJOS ni mutantes detectados.

## PREPARACIÓN GO02 · 2026-10-21

Estado anterior a ejecución; se conserva como registro fechado. Los recibos de cierre siguientes lo actualizan.

GO02 `40d640bd1cc93506268899f861fefe034e5cd474ec03e2e4fb54f4cff07d16e6` concede gateHTTP pequeño y, solo tras positivo, focalpersistencia0501. Nuevos oráculos P2 autorados:13contextos negativos con INSERT/PATCH reales y lectura de tasa/eventos/contexto por entidad; sub humano válido user/rpc o rechazo, nunca job; mutante del guard de sub con huellas reaprobadas solo en fixture; instalación que falla después de ambosDDL y ROLLBACK explícito con comparación íntegra de pg_proc/tabla/triggers/cadena y capability ausente en la mismaDB. Todavía no son resultados ejecutados.

Peer fuente `c1b4bb846fcfec5efec8d6095764778438ec6ba90bebbb4c211b9ecca0d76749` leído íntegro: F01 medianoche, F02 asociación de FechaValor y F03 cancelación diferida son P2 por lectura. Parser/source conservan el candidato93ac/9cd; primero oráculos y ROJO válido en otro turno funcional antes de corregir producto. Incluye pendientes comprimido real>1MiB,200tras1/2redirects, abort durantebody, presupuesto acumulado y teardown del deferred. GO02 no ejecuta esas focales ni cron/UI/canónica/conocimiento.

## CIERRE GO02 · 2026-10-21

Paquete externo `C:/tmp/director-traspaso-20261020/0569-bcv-validation/go02-cierre-01/go02-close.json`, SHA256 `b576deafdf8ab090696929d79fed5e19f1b60647e86a9d56b47564794e1635dc`. Turno pesado devuelto expresamente; claim conservado para autoría ligera. No selección 06 ni pruebas posteriores por documentación. Corrección de emisor be383666e se restituyó en 2cd0250fc sin ejecución entre ambos; árbol de producto/pruebas idéntico a f106 antes de este cierre documental.

HTTP01 conservó siete controles y 26 negativos parciales, pero FALLÓ global por consultar el Set antes del evento close. Reparación fa2f0395 espera cada close y mantiene cero exigido. HTTP02 PASÓ exit 0: recibo `http-context-02/receipt.json`, SHA256 `aedb2f010fa9864f2ef7825f269cda3cbcd05c67f09e3c4bb415e9065e7b79d6`. Dentro del definer se midieron role service_role/current_user postgres/session_user authenticator/auth.uid NULL y claims sin sub; evento real SYSTEM/job, motivo DB y cuatro campos. 24 DML rechazados sin cambios y 2 humanos legítimos user/rpc, nunca job. CAS textual y microsegundos reales. GET no es lease ni atesta exclusividad del cron.

Focal01: 5/10 pasaron, cinco casos no alcanzaron oráculo por permisos de recibo temporal. Focal02: misma cobertura incompleta; SET ROLE postgres rechazado sin nuevos grants. Diagnóstico03: 1 falló y 9 omitidos; contexto user/session authenticator, role none, authorization vacío, superuser off tras RESET; no se suma. 617b67cd captura/exige login inicial postgres/superuser on y restaura nominalmente la misma autorización antes de leer recibos. Focal04: 7/10 pasaron; oráculo temporal acoplado a sufijo +00 corregido en f1061d2ea por igualdad del instante timestamptz exacto con seis microsegundos, sin configurar zona. Focal05: 10/10 PASARON, 0 omisiones, 11.97 s; log SHA256 `ef104af239c431b82ab19a5ad0aaa954968cb4c9430a3ae35057f36cb84eba14`.

El contexto inicial/restaurado fue capturado en SQL y exigido por las aserciones de `bcv-persistence.migration.test.ts:94–95`; console.info no apareció en el log nativo. No reconstruir un literal ni repetir por impresión. R2 provocó error después de reemplazar/crear, ejecutó ROLLBACK y comparó OID/owner/ACL/prosrc/tabla/triggers/append exactos y capability ausente en la misma DB. Cuatro mutantes llegaron a sus oráculos funcionales con huellas reaprobadas solo para fixture; 0495 y 0501 productiva permanecen intactas.

Freeze por corrida: 41 entradas base en HTTP y 44 en focal (más setup/stub/metadata PGlite), 0 diferencias después de EXIT. 17 identidades PID+creationDate cotejadas sin vivos; cero terminaciones. HTTP02 cerró servidor/sockets/tareas, contenedores y red por ID/owner; puertos sin listeners. Observers de focal llegaron después de terminar y no se inventan descendientes no capturados. Cierre local acotado, sin promesa de terminación física universal ni conformidad global. No parser/source/sync/route generales, UI/browser, tipos/lint/build/verify/conocimiento/BCV remoto/producción por GO02.

## CONTRATOS ÍNTEGROS CONSERVADOS ANTES DE PRODUCTO

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

1. **Una migración aditiva:** ruta coordinada `supabase/migrations/0501_bcv_rates_system_audit.sql`. Inventario del Director ejecutado con fetch normal:501refs+worktrees, siguiente SQL0501 y spec0578, salida0; recibo `bcv-numero-inventario-20261021-1130.txt`, SHA256 `39ddb10126e42643b02fdf2a9c111d495e66ceba014d74b00382863240a32851`. El nombre del recibo no es su hora real. Este documento coordina el número pero NO crea reserva. Al activar, revalidar colisiones antes del primer stub/commit propio; si0501 está ocupado, volver al Director sin elegir otro. SDD0569 se reutiliza; no reservar0578. La numeración estable NNNN del repositorio prevalece sobre el generador timestamp genérico de la skill Supabase.
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
supabase/migrations/0501_bcv_rates_system_audit.sql
supabase/tests/bcv_rates_system_audit.test.sql
supabase/migrations-baseline.json
```

Baseline solo agrega la espera nominal0501 con dependencia/aplicación/verificación y fallo cerrado por capability ausente; cutoff238/0495 y otras esperas intactos. No declarar aplicada. Manifiesto de símbolos registra referencias y anclas reales del código, sin inventar líneas, omitir scanner o cambiar gates. Las tres rutas adicionales se cotejan también antes de escribir; no autorización de ruta32. SQL nueva y contrato durable entran en las recetas canónicas nativas existentes sin cambiar runner/config/timeout. Índice y crontab se regeneran con sus scripts.

## Evidencia y pruebas adicionales obligatorias

Conservar B1–B19 completos del prevuelo; B10 del documento histórico espera source rpc y **se sustituye solo para el nuevo job por source job/motivo no vacío**, sin renombrar resultados anteriores. Añadir R1–R14 de la propuesta, con decisión de ensayo del punto8. No declarar que leer este addendum ejecutó algo.

- Ausencia de0501/capability: normalON y ensayo no envían DML, no fetch/candidata ni éxito. OFFnormal/authqueryinválida mantienen cero IO.
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

Excluidos: edición/reaplicación0495, appendglobal, RLS/ACL humana nueva, tablas, RPC escritora, caché futura/diario durable de corridas, dashboard, backfill, documentos congelados, CNY, flags/env reales, cron instalado, billing/cuentas, main/merge/deploy/VPS/datos/PII/secretos/contactos. El número0501 y31rutas se harán efectivos únicamente con activación aislada posterior; hasta entonces **NO ACTIVO**.


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

El Director verificó ausencia de esa rama/ruta durante preparación y coordinó inventario501refs+WTs con0501siguiente. Revalidar antes de crear. Crear mediante **harness start** con slug `sdd-0569-bcv-carga-diaria` y `--from 1905aef75680a80055621cffd717198915d089f9`, sin mover/alterar árboles existentes. El harness documentado no instala ni copia.env. Verificar la ruta/rama/base devueltas y usar esa raíz para todo lo posterior. Reclamar ownership nuevo con harness claim/owner anterior y guard antes de escribir. Si hay rama/ruta/claim ajeno, no robar ni resetear: informar y continuar solo lectura independiente.

## Contrato activo y alcance exacto

Leer íntegro y aplicar conjuntamente, conservando sus hashes:

1. Encargo original `0569-bcv-asignacion-worker.md`, SHA256 `c477578e870ce7567d9c5e3ca10500e787169ded114bc41356daef6b4983f842`, incluidas fuentes/lecturas/B1–B19 originales. Su estado preparado queda sustituido por esta activación, y sus exclusiones sin SQL nueva se sustituyen solo como sigue.
2. Addendum Director de **31 rutas literales** `0569-bcv-addendum-auditoria-director-31-rutas.md`, SHA256 `87589d14362e2e740713db01775ba5c7c551a2c6bbf4fe307932abd664049412`. Es la allowlist acumulada exacta y fija SQL **0501_bcv_rates_system_audit.sql**, pruebaSQL y declaraciónbaseline adicionales. No ruta32 por conveniencia.
3. Prevuelo preparado `0569-bcv-prevuelo-casos.md` SHA256 `15e8471722d54fe32bdab65da06cfb78a08a2fc7f4fb7f78bb2452d82d818c9a`; propuesta AUD `aac64841eef9f43a9f49e964151cf719fa8e978631e5794202795d0e40960adb`; contexto `c403d21ce5e691677f52c7d8f34bfda76d121a02cd25ebbf249290e8a4168957`. Son preparación, no pruebas ejecutadas; prevalecen las decisiones del addendum, incluido dryRun con capability válida antes de fetch/candidata.
4. Revisión independiente `0569-bcv-revision-addendum31-peer.md`,12570bytes/SHA256 `d17c5ef8f204d59d07f957b94c3e4718b1dd41245b0da045eee83b65f12b5d36`: sin contradicciones obligatorias nuevas de diseño, productoR3 y gatesHTTP todavía pendientes.

Antes del primer producto, conservar íntegros encargo original, addendum y esta activación en el handoff propio, con objetivo/owner/base/31rutas/permisos/aceptación/dependencias y estado en progreso. No actualizar el checklist del Director ni handoffs de otros dueños. Registrar propuesta/decisión/prueba como categorías distintas.

**0501 está coordinada, no reservada todavía.** Revalidar colisiones de refs/PR/worktrees/archivos sin commit antes del primer stub; ejecutar inventario nativo de lectura y comprobar que el número asignado sigue libre. No pedirte elegir el siguiente: si0501ya está ocupado, volver al Director. Si libre, reserva localmente mediante un stub/commit coherente en esta rama propia y0569continuada, sin publicar directa o indirectamente main. No renumerar0495 aplicada ni ninguna aplicada. No nuevoSDD.

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

El objetivo anterior terminó localmente y sigue este objetivoBCV. 0574 realiza su canónica desde11:38:08Z; BCV **no tiene turno pesado aún**. Root coordina y revisa, nunca producto. Sin main/merge/deploy/VPS/cron instalado, flags/env/cuentas/pagos reales, DBreal/negocio/PII/secretos/contactos o bóveda compartida. **0495 aplicada una vez no se repite;0501 requiere OK nominal futuro de Sam para producción**. La autorización de trabajo local no lo sustituye.


~~~~
