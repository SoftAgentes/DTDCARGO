# Handoff Worker — SDD0576 C2 · anuales Caracas

Fecha de adopción: 2026-10-21. Estado: en-progreso; checkpoint revisable, cierre pendiente.
Owner: worker-0576c2-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
Sesión Director: 01a15a4e-ddf0-7d82-8656-d9dc56b58468; subagente worker_0576_c2.
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0576-fechas-caracas-anuales.
Rama: codex/sdd-0576-fechas-caracas-anuales. Base exacta: d6bcd0e8b9738cb5784579ef8e7f1802abef4644 de PR312.

## OBJETIVO ORIGINAL

Cambiar exclusivamente la fecha civil de los cálculos anuales a America/Caracas y conservar ventanas, dinero, grupos, DTO, permisos e historia. Implementación local, pruebas, commits/push y PR DRAFT autorizados. Sin merge, deploy, DB real ni PII. Reutilizar SDD0576 y migración asignada0500_annual_billing_caracas. C3 continúa fuera.

## Adopción y fuentes

Guard/claim propios PASÓ sobre base exacta y árbol inicial limpio; sin entorno/dependencias copiadas. Se leyeron AGENTS, Worker, runbook, reglas de proyecto, preparación vinculante y las instrucciones Supabase/gobernanza. Las instrucciones específicas DTD prevalecen sobre ejemplos generales CLI. La allowlist exacta y aceptación se incorporan íntegras abajo antes de editar producto. Turno pesado exclusivo concedido por el Director.

Fuentes externas verificadas SHA256:
- Asignación: 825ab8194a63ad542f2eb7c377f4e68ac5089cde0b352174a4d3771039c53943.
- Contrato preparación: 33977babc9b77f41df7a7124e3e6b1e90c6154190a6c2a062b50b0eab54d7243.
- Matriz funciones: 809a17866f7872e7a654529574b6ef293c7e565786e8749473877786222a4eb7.
- Inventario pruebas: e294b45cfdae29cae6795febdae1474e93c2039d63a9a0526c1bda52410dc506.
- Cierre C1: 2ace46582a02e86a49bac59ef017ac22d899f3da36992753f461924f18a445d4.
- Contraste documental oficial: 75958ad90a4723ade36cfbe154fe01ee4f514161a6ad78455685c80c1f179021; no evidencia de entorno vivo.
- Revisión independiente del encargo: 6349acb47df0b00ef538a3052f53328df4c07278bfb680234faa644bf92f4240.

Evidencia externa propia: C:/tmp/director-traspaso-20261020/0576-c2-codex-validation/.
SupabaseChangelog recibido200/102319bytes; PostgreSQL17 y Supabase Functions consultados. No cambios de versiones/CLI ni acceso a DB del proyecto. Memoria de aislamiento contrastada con guard/claim actuales; no se transfieren estados históricos a C2.

## COMPLETADO

Caller usa fechaCaracas(now) una vez antes de paginar. 0500 contiene completas las tres fachadas y solo cambia seis relojes/seis fallbacks; fuente SHA256 bf90fe717e7be3d0af70a1c1999758529e875855aa118ad9f36dad2fdbffbfaf. Contrato PGlite/PG17 propio, arnés HTTP aislado, baseline0500 y anclas reales0498 actualizados. Portalreader/helper/paginador/0411/0498/0499 no se editaron. Son11rutas de la allowlist12.

Se reparó el arnés propio al concatenar pg_get_functiondef sin separadores. Se reforzó el oráculo del futuro Portal legado por separado, mutantes upperpor fórmula, captura de hashscript/contrato/status y evidencia de recarga real. No se tocó producto para resolver fallos del arnés.

## VALIDACIÓN

Cada archivo JSON de corrida conserva comando, PID, cwd absoluto, inicio/fin/exit; logs originales externos. No sumar estos grupos solapados.

| Comprobación | Estado / alcance real |
|---|---|
| Aislamiento, base d6, guard/claim | PASÓ, árbol inicial limpio, owner propio |
| Dependencias congeladas | PASÓ04:42:42–04:43:04Z,817paquetes, Node24.20.0/pnpm11.25.0; lock intacto |
| Caller ROJO | FALLÓ previsto04:43:40–44Z,8fallidas/22pass; diferenciaUTC/Caracas funcional,0SKIP |
| Caller+Portal VERDE | PASÓ54/54,2archivos,0omisiones,04:44:27–30Z |
| PGlite primer intento | FALLÓ24/25 por comparación textual de escala v1; no ROJOtemporal. Se conserva diagnóstico |
| PGlite segundo intento | FALLÓ5/25 por etiquetas de muerte de mutantes anticipadas; contrato íntegro y3ROJO/3VERDE temporales PASARON |
| PGlite tercera focal | PASÓ29/29,0omisiones,04:50:41–04:51:40Z; snapshot previo al refuerzo Portal legado |
| Regresión ampliada final | PASÓ223/223en11archivos,0omisiones,04:54:48–04:56:35Z; incluye30casosC2/21mutantesSQL, históricos0498/helperC1/Portal/CRM/Fidelización/Reportes/listados |
| Mutantes caller | PASÓ muerte funcional UTC y relojporpágina, fuente restauradaSHA2569db8151732d6a99588ea32b0a51407b431f82275253a627ea12d24f541082601. Recibo caller-mutation-detail.json04:56:58–04:57:01Z; UTC6fallos/3pass/21no seleccionadas, relojporpágina1fallo/29no seleccionadas. Esas omisiones por -t no son cobertura global. El primer detalle fue sobrescrito por nombre compartido del wrapper; se repitió con nombres separados |
| PG17/HTTP primer intento | FALLÓ después de fase real PASÓ,04:52:35–51Z;423asercionesSQL+ROLLBACK y recarga realPID824 sinreinicio. La copia de reloj falló por separadoresSQL, no muerte funcional; cleanup0/ausentes |
| PG17/HTTP segunda | PASÓ04:53:33–47Z,PG17.11/PostgREST14.17,423asercionesSQL+ROLLBACK. TresRPC200antes→DDL0500real/COMMIT→después, PID1610/inicio04:53:38.876845343Z idénticos; interior/campos/ACL/helpers/RLS/filas conservados. Fasecopias02:30/03:59:59.999/04:00 y restauración; negativosreales;1202grupos500/500/202/0,202soloexcluidas; cleanup0/ausentes. Atribución a769+delta local2separadores, no al suplemento futuro. Recibo no había capturado hashscript/contrato; última corrida desde checkpoint limpio pendiente |
| Tipos/lint/gobernanza/docs | PASÓ tipos04:57:13–04:58:47Z; lintfocal0errores con4advertencias propias corregidas, lintHTTPfinal0errores/0advertencias05:00:36–40Z. Pluginread-only28políticas/5componentes PASÓ05:00:41Z solo consistencia, no conducta. Docs/numbering PASÓ04:59:57–59Z |
| Verify canónico C2 | NO EJECUTADO; requiere focales cerradas y confirmación del Director de la cabeza revisada |
| Release, DBreal, producción, UI/A11Y nuevos | NO EJECUTADO, fuera de autorización o no aplica al delta query/SQL; no aprobación global |

SQL real antes de instrumentación: catálogo registrado antes/después con MD5 de pg_proc, OID/firma/retorno/owner/proacl/ACL efectiva/STABLE/DEFINER/config y helpers completos. Default0033 de service_role del ownerpostgres reproducido; v1 conserva EXECUTE, Portal/v2 lo revocaron. Comparación completa de cuerpos verifica exclusivamente seisrelojes+seisfallbacks. Las copias de reloj usan dosanclas estrictas por función, mismo instante para las3, y restauran definiciones. Filtros/roles/autorización no se congelan ni se simulan siempre verdaderos.

ObservadorE2E externo preparado, no ejecutado aún: e2e-observer.cjsSHA256a7b2e303b9e72315bb98c31acd2f90633a8de9aa621e9b747f8c39c66a1336f4. Soloargv/cwd/PID del runner canónico de este árbol; captura bytes originales antes de readFileSync/rmSync/unlinkSync, registra intentos/rechazos/rutas canónicas y rootDir informativo sin filtro silencioso. No usa fs.watch, no cambia runner/gates, no reconstruye JSON. Si no está disponible se dirá así, sin repetir verify exitoso solo por capturarlo.

## COMMITS

- 769dd9ee2446c27123b041eefe7a78727a25f8af: primer checkpoint de implementación y pruebas propias.
- Suplemento de arnés/pruebas/recibos: commit que contiene este documento; hashes finales se registran en PR.

## PR / BRANCH

https://github.com/SoftAgentes/DTDCARGO/pull/313 OPEN/DRAFT, basecodex/sdd-0576-fechas-caracas-operaciones=d6; head propio según commit revisable. Primera lectura head769/base d6/título/body/DRAFT PASÓ; final pendiente. ConectorGitHubno conectado; sesiónCLIautorizada disponible. PR adjunta a la tarea; push rama a sí misma, sin merge/deploy.

## PENDIENTES DE ESTA TAREA

Última corrida PG17/HTTP sobre suplemento limpio con hashes exactos; revisión inmutable y confirmación; pnpmverifycanónico con diagnóstico/SKIPs; knowledge:status y límites de capas; cierre documental/PRreadback/ahead0/clean/cleanup/claimrelease/recibo final. Implementación yROJOtemporal ya ejecutados, no figuran como pendientes.

## FUERA DE ALCANCE DETECTADO

C1, C3móvil, BCV0569,0573/0575/2.3, producción, CIalojado bloqueado, cobertura histórica no medida y derivados ausentes de conocimiento. No se absorben. No hay defecto conocido propio de producto abierto en este checkpoint; validaciones/revisión aún pendientes.

## HANDOFF AL DIRECTOR

Conservar PRDRAFT y worktree. Antes de verify se ofrece SHA/base limpios, hashes de SQL/script y recibos reales para revisión. Turno pesado exclusivo y claim aún activos; solo se liberan al completar commits/push/readback/cleanup. FuturoMIGRATE-FIRST exige revisión de paquete, OK nominal de Sam y callerCaracas activo; respuesta200 de SQLanterior no activa una degradación ficticia. No se publica conocimiento compartido desde el borrador.
## Contrato ejecutable íntegro incorporado

Fuente externa: C:/tmp/director-traspaso-20261020/0576-caracas-c2-asignacion-worker.md, hash verificado arriba. Las concreciones y doce rutas siguientes son vinculantes.
$worker

# Asignación ejecutable — SDD0576 C2, anuales Caracas

Fecha:2026-10-21. Director `/root` de la conversación01a15a4e-ddf0-7d82-8656-d9dc56b58468. Esta es una **sesión Worker nueva y aislada**, no la sesión Director ni la escritora C1.

## Objetivo, base y ownership

Cambiar exclusivamente la fecha civil de los cálculos anuales a America/Caracas, conservando sus ventanas, dinero, grupos, DTO y permisos; cerrar implementación, evidencia, revisión, commits y **PR en borrador**. Una tarea, una rama, un worktree y un Writer. Ejecuta hasta entregar, sin detenerte a pedir permiso para pasos rutinarios autorizados.

| Campo | Valor asignado |
|---|---|
| TaskID | 0576-fechas-caracas-anuales |
| Owner | worker-0576c2-01a15a4e-ddf0-7d82-8656-d9dc56b58468 |
| Worktree exclusivo | C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0576-fechas-caracas-anuales |
| Rama | codex/sdd-0576-fechas-caracas-anuales |
| Base exacta | d6bcd0e8b9738cb5784579ef8e7f1802abef4644 |
| Base de PR | codex/sdd-0576-fechas-caracas-operaciones / PR312, headd6bcd0e8b9738cb5784579ef8e7f1802abef4644 |
| SDD reutilizada | docs/specs/0576-fechas-caracas/spec.md, in-progress; no SDD nueva ni recreación de stub |
| Handoff propio | .agents/handoffs/0576-fechas-caracas-anuales.md |
| Migración nominal asignada | 0500_annual_billing_caracas |
| Turno pesado | EXCLUSIVO concedido a este Worker desde la adopción. C1 y statusmainDirector terminaron; no otra corrida pesada autorizada |
| Destino de evidencia externa | C:/tmp/director-traspaso-20261020/0576-c2-codex-validation/ |

Director creó el árbol con harnessstart desde d6, verificó raíz/rama/HEAD/limpio y ausencia previa de ese árbol. Inventario canónico terminó04:39:47.207Z,exit0: **490refs+worktrees**, siguienteSDD0577 y migración0500, sin reservaautomática. Se asigna0500a C2, no se elige ni renumera. El SDD0576 ya existe y se conserva.

C1 fue entregado enPR312DRAFT, local/remoto d6, árbollimpio/claimliberado/cero recursos propios. El delta264e→d6 es solo3docs; Director cotejó que lib/supabase/scripts/app no cambian. C1verify16/17 y sus omisiones no son aprobaciónC2. Revisiones/cierreC1 y bytes de producto se preservan, sin copiarlos desde árboles antiguos.

**Todos los comandos de escritura, instalación, pruebas y Git usan workdir de TU worktree absoluto.** No depender del cwd compartido, que es el checkout principal. Antes de editar, lee AGENTS/Worker/runbook/reglas y reclama con harnessclaim `--owner worker-0576c2-01a15a4e-ddf0-7d82-8656-d9dc56b58468`; verifica guard con eseowner. El árbol empieza sin entorno ni dependencias; prepara dependencias propias con lockfile congelado, sin modificar versiones ni copiar .env/credenciales. Conserva worktrees ajenos y las dependencias del principal.

Antes de producto, registra este contrato íntegro o su incorporación verificable en tu handoff, adopta la allowlist y conserva objetivo/base/owner/aceptación/permisos. Publica rama propia y PRDRAFT cuando haya un checkpoint revisable; autorización ya dada, no vuelvas a pedirla. No editar handoff operativo C1, documentos del Director ni otros árboles. No iniciar otro Writer o subagente de producto; el Director coordinará revisión independiente de objetos inmutables.

## Fuentes vinculantes de preparación

Leer completas, cotejar hashes e incorporar sus criterios, con las concreciones posteriores de esta asignación. Todas están en C:/tmp/director-traspaso-20261020/:

1. `caracas-c2-contrato-director-preparacion.md`, SHA256 **33977babc9b77f41df7a7124e3e6b1e90c6154190a6c2a062b50b0eab54d7243**. Su estado de borrador y campos pendientes quedan resueltos por la tabla anterior y la API real siguiente; no se omiten sus aceptaciones.
2. `caracas-c2-matriz-funciones-preparacion.md`, **809a17866f7872e7a654529574b6ef293c7e565786e8749473877786222a4eb7**. Tres cuerpos completos, seiscurrent_date y seisfallbackscreated_at, firmas/ACL/owner/hash y controles. Su afirmación de que NOW era mediodía es errata corregida expresamente por la fuente3.
3. `caracas-c2-inventario-tests-preparacion.md`, **e294b45cfdae29cae6795febdae1474e93c2039d63a9a0526c1bda52410dc506**. NOWfidelización es2026-06-03T00:00:00Z; tres expectativas deben ser2026-06-02. Conservar instante, importes, peticiones, offsets y demás oráculos; no desplazar fixture a mediodía ni calcular expectativa con el helper probado. No se identificó ruta externa imprescindible. Pruebas históricas0498conservan su contratoUTC y su cargador explícito; C2 tiene contrato nuevo.
4. `caracas-c2-documentacion-oficial-preparacion.md`, contraste documental oficial; no evidencia del entorno vivo. Las reglas específicas DTD de numeración de cuatro dígitos/archivos/validación local conservan precedencia sobre ejemplos generales de CLI de la skill Supabase.
5. `caracas-c1-cierre-director-d6bcd0e8.md`, **2ace46582a02e86a49bac59ef017ac22d899f3da36992753f461924f18a445d4**, para preservar límites y atribución de C1. No requiere reejecutar C1 solo por leerlo.

API real comprobada en d6: `fechaCaracas(instant: Date|string = new Date()): string`, export de `lib/shared/fechas-caracas.ts`, blob **00af1518045806694794defd7b4154d3ba5b0913**. Rechaza instante inválido/date-only, usa IANA/historia. Caller `lib/studio/fidelizacion/queries.ts`, blob **72dc071a5d9e13e122210f5effd3af2cdfb99fc9**, ya usa RPCv2 y now:Dateinyectable. Reutiliza esa API antes del primerawait y de paginar; no edites el helper ni crees otro.

## Allowlist exacta — doce rutas máximas

```text
lib/studio/fidelizacion/queries.ts
lib/studio/fidelizacion/__tests__/queries.test.ts
lib/portal/__tests__/portal-referral-query.test.ts
lib/studio/__tests__/annual-billing-caracas.migration.test.ts
supabase/migrations-baseline.json
supabase/pending-migration-symbol-declarations.json
docs/specs/README.md
supabase/migrations/0500_annual_billing_caracas.sql
supabase/tests/0500_annual_billing_caracas.test.sql
docs/specs/0576-fechas-caracas/spec.md
.agents/handoffs/0576-fechas-caracas-anuales.md
scripts/tests/annual-billing-caracas-postgrest.mjs
```

Permite solo los cambios necesarios dentro de estas rutas, no obliga a fabricar un cambio en las doce. Índice solo generado; baseline solo0500pendiente preservando0499y demás; manifiesto soloanclas/callSites reales que se desplazan, sin nuevasexenciones/degradaciónficticia/checker. SQL0411/0498/0499, C1tests/arneses, helperdecimal/fechas, paginador, readerPortal y emisores son lectura/regresión, fuera de escritura. No framework/dependencias/rutasauxiliarespersistentes nuevas. Si una necesidad concreta fuera de12impide aceptar, presenta al Director ruta/caller/evidencia y propuesta mínima antes de editarla; no preguntar a Sam ni absorber bugs ajenos.

## Contrato temporal y financiero que se preserva

- Portal mantiene límite inferior inclusivo de hoyCaracasmenos **un año calendario**, sin límite superior. `billed_usd` legado y `billing_v2` comparten población temporal pero conservan fórmulas diferentes. Factura futura conserva pertenencia cuando cumple otros filtros.
- Studiov1/v2 mantienen p_as_ofobligatorio, tolerancia±1díaCaracascon extremosincluidos, error22023paraNULL/±2 y ventana[p_as_of−añocalendario,p_as_of]inclusiva. No pasar errores a cero/[]/hoy. Portal yStudio no unifican susuppers.
- issued_atDATEexplícita tiene prioridad; solo si falta derivar created_atTIMESTAMPTZ mediante America/Caracas. No truncar primeroUTC, fijaroffset−4 ni desplazar fechas sin hora. Calendario/bisiestos/historiaIANA, no365días.
- SQLusa **reloj de transacción** en los tres cuerpos; no copiar reloj de sentenciaC1, no relojglobal/sesión, RPCclock ni helperSQLpersistente nuevo. Caller captura fecha una sola vez y mantiene p_as_ofen todas las páginas aun si el reloj cruza medianoche.
- Redefinir completas únicamente public.get_portal_referral_program(), public.studio_client_annual_billing(date), public.studio_client_annual_billing_v2(date), con delta temporal previsto. Preservar firma/retorno/OID/owner/ACLefectiva/STABLE/DEFINER/search_path/tenant/roles/overrides/RLS/filtros/shape/orden.
- **ACL diferenciada:**0033defaultALLfuncionesservice_rolesegúnowner; v1no lo revoca, Portal/v2sí. Fixture debe reproducir defaults/herencias pertinentes y medir proacl+permisos efectivos, sin simetría inventada por omitir esa historia ni nuevoGRANT/revoke.
- Conservar v1HAVING>0 y fórmula legada; v2mantiene cero/negativos/soloexcluidas y sus DTO/textodecimal/centavos/contadores/estado. Preservar helperprivado annual_billing_private.convertir_factura_anual_usd(numeric,text,numeric) yto_usd, sin exponerlos ni modificarlos. Comparar población temporal con USDpositivos comparables sin imponer igualdad de grupos por HAVING.
- Conservar b: soloNULLes ausenciaPortal; shapeinválidoerror; principalválidosinbilling_v2mantieneotroscamposymétricano_disponible; CRMidentidad/cruce separados. Paginación completo/array/duplicados/errores reales sinBigIntporRSC. Sin refecha/backfill niUPDATEde documentos/asientos/importes.

## Evidencia exigida y orden de ejecución

1. Dependenciascongeladas/claim/handoff, ROJOfuncional frente a fuentesanteriores (no missingfile/import/sintaxis como oráculo). Luego implementación y focalesVERDE, tipos/lint/SQL proporcionales. Registrar comando,PID,cwd,tiempos,exit,archivo/casos/ceroomisiones o losSKIPs reales. No sumar grupos solapados.
2. SQL/PGlitepropios con contratos completos y grupos independientes. Cargar DDL0500 **íntegra primero**, medir catálogo y hashes/cuerpos reales antes/después, permisos/owner/OID/security/configyhelpers/policies intactos. Preflights de la base final, no copiar instalación0498queexigev2ausente ni hashPortal0404antiguo. Fuentes0411/0498hashes verificables en la matriz; contrastarcon pg_proc local, no afirmar catálogo vivo desde MD5defuente.
3. Solo DESPUÉS de fase real, instrumentar copias del reloj exclusivamente con anclas/cantidades estrictas y abortar deriva. Mismo instante para3funciones; no sustituciones generales, relojdeprueba enproducto, fakeJSquepretendacongelarPG ni autorizaciónsiempreverdadera. Conservar fuentehashintacta. Una hora fija no prueba por sí sola transacciónvsstatement: cotejar expresión/catálogo reales.
4. Controles de02:30Z,03:59:59.999Z,04:00Z,año nuevo,bisiesto/añocalendario,lower exacto/un díaantes,upperStudio/hoy±1permitidos/±2yNULLerror,futuroPortalconservado,issued_atprioritario yfallbackhistóricoIANA; sesiónUTC/Caracas/Shanghai mismoresultado. ReaderJSconfechafijaquecruzamedianochedurantepáginas, instantesinválidos rechazados.
5. Arnés HTTPnuevo propio dentroallowlist; **no importar arnésb con IOsuperior ni editar C1**. PG17/PostgREST14.17localespatrón comprobado, recursos propios con límites/cleanupdeclarados. TresRPC **yaexistenantes**; respuestas antes→DDL0500real/COMMIT/recarga→después **mismo proceso/inicioPostgREST**, sin reiniciar. Bordes cambian exactamente según oráculo; interior ycamposnoafectados se conservan. No copiar404como prueba de instalación. Separar fase instrumentada, JWT/roles/tenants/ACLnegativos/helpers privados reales.
6. HTTPpaginaciónreal>1000grupos, cap500, RPCPOSToffset/limit efectivos,500/500/resto/0hasta vacía, últimapágina soloexcluidas, mismo p_as_of, noconteos/numerales fabricados. Errores/shape/tenantambiguo/revocado/overridefalse/rolnohabilitado fallan según contrato actual, sinadminpermisivo.
7. Mutantesfocalesfuncionales:UTC/sesión,ignorarissued_at,upperPortal añadido,upperStudioquitado,validación±1quitada,365días,relojporpágina; no erroresdebootstrapcomo muertes. Hashes/restauración de todos los originales. Mantener contrasteindependiente porfunción/consumidor ycontroles históricosexplícitos.
8. Checkpointcoherentepublicado/PRDRAFTconhead/base; avisa alDirector para revisión de objetos inmutables. Resuelve sus hallazgos propios dentro12, sin ampliar de oficio. No empieces verifycanónico hasta focalesSQL/HTTP/listarevisión resuelta y cabeza congelada identificada. El Director confirmará el checkpoint de revisión; mientraspuedes cerrar evidencia/documentaciónque no cambia fuentes revisadas.
9. `pnpm verify`canónicoúnico, sin debilitar gates/overrides ni copiar secretos. Congelar fuentes/head/lock/runner, manifestantesycomparaciónbytes/statusantesde editarcierredocs. Conservar diagnóstico unitariocompleto si hay unfalloordinarionoautorizadocortarantesdelresumen, salvo seguridad/timeout/recursos. Ledgerproductivoes validaciónrelease, no motivo de aplicarSQL; registrar16/17uotroresultado literal y SKIPs reales. No atribuirresultado de otra corrida.
10. Guardar log/contexto/listaomisionesE2Eoriginales. Capturar JSONoriginal solo si realmente disponible, sin modificar runner ysin reconstruirlo después. El observerC1no capturóarchivo y tenía filtro silenciosorootDir; si preparas observadorexterno propio, registra intentos/rechazos/canonización exacta de ruta y suslímites, sin fs.watchnativo quefalló ni afirmarcausa no comprobada. No repetirunverifyexitoso solo por JSONno disponible.
11. Gobernanza:leerAGENT-BRIEF/registro/políticasaprobadasSGE/DAT/NUM/ERRsegúnalcance. Matrizde evidencia/acotación, no excepcióninventada ni A11Yglobal por queryonly. Pluginvalidatorreadonlyal cierre; conteosdeconsistencianoaprobaránconducta. UI nueva no está prevista; justificar noaplica o necesidadconcreta antes de ampliar.
12. Conocimientoal cierre:knowledge:statusserial en rama y reportar estructura/semántica/piloto/Archify/preview/Obsidian separado. Grafo/runtime no vienen en esteárbol; no copiar derivadosde main ni instalar/generar/publicar por defecto. Registrar prerrequisitosausentesypendientes en handoff. Ningunapublicacióncompartidaborrador. No se certifica el delta documental posterior semánticamente desde un status anterior.

## Permisos, límites y cierre

Sam autorizó continuidadlocal, commits/pushyramas propias/PRenborrador mientrasActionsbloqueado, y dijo «Avanza sin detenerte y termina todas las tareas. Un objetivo tras otro». Eso **no autoriza** merge/deploy/productionDB/VPS/datospersonales/cambiosdepago/cuentas. Permitidos instalar dependencias fijadas, fixtures totalmente sintéticas, PostgreSQL/PostgREST/Docker/HTTPloopback/JWTsintético y navegador local si es necesario, exclusivamente recursos propios y seriales. No leer filas de negocio/PII/archivos de proformas reales, .envni credenciales ajenas. No PATen repo.0500soloarchivo/ephemeral; producción requeriránombreexacto yOKnominal deSam.0495yaaplicadauna vez, no repetir.

MIGRATE-FIRST futuro conserva firma pero appantiguaUTCpuede pasar±1yseguirventanaequivocada: documentar esa convivencia y dependencia de calleractivo sin inventar no_disponibleautomático por ausencia0500. Sin C2lasRPCpuedenresponder200consemánticaanterior. Preservar warningsde símbolos de0498por falta real deRPC, ajusteanclasrealessinexenciones nuevas.

Fuera: gastosmóvilesC3,BCV0569,0573/0575/2.3,emisores/posters/pagos/cobros/PortalrecoveryC1, cierreimpuestos/correlativos/KPIshistóricos/producción. No nuevosobjetivosporcuenta propia. C2seentregaydevuelve turno antesdeC3nuevoWriter.

Handofffinalcon secciones exactasdelrunbook:OBJETIVOORIGINAL/COMPLETADO/VALIDACIÓN/COMMITS/PRBRANCH/PENDIENTESPROPIOS/FUERADEALCANCE/HANDOFFDIRECTOR; evidencia porSHA/estadoPASÓ-FALLÓ-NOEJECUTADO-NODISPONIBLE,omisiones/limitaciones/dependencias. SDD0576siguein-progresssiC3pendiente, sin certificaciónhoraria global. Cierrecommitdocumentalexclusivoconigualdadproducto demostrado; no recursiónparaautocitarSHA. Gitguardantesdecommitsselectivos, nuncaadd-A/reset/forcepush/checkoutajeno.

Antesdeterminar:readbackPRDRAFTtitle/body/head/baseexactos,origincountahead0,árbollimpio,procesos/puertos/Dockerpropioscerrados,claimliberadoconownerpropioyreciboexternofinal. No borrarWT/rama ni dependenciasporantigüedad. Informa alDirector que elturnoquedólibre ydetén escrituraC2; no arrancarC3desdeestasesión.
