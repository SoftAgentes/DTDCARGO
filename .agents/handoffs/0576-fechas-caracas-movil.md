# Handoff Worker · SDD-0576 C3 · gastos móviles

> **Estado vigente (2026-11-13):** la C3 va en la #526 (rama `claude/sdd-0576-fechas-caracas-movil`) contra main y reemplaza a la #314. Las asignaciones, los GO, los turnos y las recetas `verify` de abajo son el registro histórico de la #314, sobre la base `0e630ede`. No describen pasos pendientes de la #526, cuyo portón es el CI.

Fecha de adopción: 2026-10-21. Corte documental posterior a GO3: composición22bd revisada,16pasos medidos aceptados y CIERRE INCOMPLETO16/17 por ledger omitido. Las dos recetas anteriores conservan FALLÓ y CIERRE ADEMÁS INCOMPLETO; el primer intento de GO3 conserva FALLÓ/PARCIAL/OOM. Recursos propios observados cerrados y turno pesado devuelto; claim C3 activo al corte. Conocimiento postcommit y aceptación local final se acreditarán en recibo externo/PR, según el ciclo único acordado.
Task ID: 0576-fechas-caracas-movil.
Sesión escritora: /root/worker_0576_c3.
Owner: worker-0576c3-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0576-fechas-caracas-movil.
Rama: codex/sdd-0576-fechas-caracas-movil.
Base de implementación y PR: 0e630ede760dbc369ddf60133c18c4a77f2d8692.
Base de PR asignada: codex/sdd-0576-fechas-caracas-anuales (PR313). Histórico: hoy la C3 es la #526 (rama `claude/sdd-0576-fechas-caracas-movil`) contra main.
SDD reutilizada: docs/specs/0576-fechas-caracas/spec.md, in-progress.
Baseline heredada 0577: c4b2e72dabbdde80ec7fe5c8a7f128966b6494be, PR315 DRAFT base main; incorporación Git local autorizada sobre receptor55138b9cca4d304802337b50f353569531f9993e, sin merge de PR ni main.

Contrato activo leído completo y SHA256 cotejado antes de adoptar: C:/tmp/director-traspaso-20261020/0576-caracas-c3-asignacion-worker.md, 6b94cd33764fd13b05efe2881ce99d0ac579c563491f54f75b82c60894293c66.
Preflight anterior exclusivamente por objetos Git de esta base; sus antecedentes y las políticas aplicables se conservaron como preparación, sin transferir resultados de C1/C2 a C3.

## OBJETIVO ORIGINAL

Alta/edición/fila móvil usan día Caracas, tenant y origen propios, lecturas estrictas y guardas anteriores a efectos; conservar formulario y File ante rechazo recuperable, proteger cierre pending del alta y ubicar el error mediante foco/teclado. Sin re-fechar historia ni prometer atomicidad0575.

## COMPLETADO

- Identidad revalidada: raíz/rama/HEAD coinciden con la asignación; árbol inicialmente limpio.
- Guard PASÓ; claim adquirido con el owner exacto antes de esta primera escritura.
- Contrato durable completo incorporado abajo antes de cualquier cambio de producto.
- GO PESADO C3 recibido después de cierre serial de main a06:46:03.548Z; único turno pesado C3.
- Alta anclada antes del primer await, instante persistido y mismo día Caracas al poster; tenant RPC cero argumentos, settings/origen/asiento estrictos con límite2 y guardas antes de efectos.
- Fila con IANA America/Caracas explícita; N1 protege cierre pending del alta; N2 error persistente con foco local en respuesta nueva.
- Medición previa: JSDOM conservó File (2 PASÓ/21 omitidos por filtro), pero navegador nativo perdió File y método tras rechazo en ambos forms. El error inicial de diagnóstico por comparación global se corrigió: ese diff solo demostraba método; el multipart posterior sí demostró pérdida del archivo.
- Reparación mínima local onSubmit/preventDefault→FormData nativo→useActionState/startTransition evita reset tras rechazo. Sin caché/ref de File, exports o forms duplicados.
- Composición 0577 autorizada por contrato a8702feb4301de42ff694a19a47d62c9dd262856126b1391cd802d24016cd41e, leído completo y preservado abajo. Merge Git local normal c4b2e72d sobre55138, ancestro común eafbd910d1c082c9b416b558f8c3db5847b994a6; sin conflictos. Índice generado preserva ambas specs. No reescritura de producto/tests C3 ni de tests/spec/handoff 0577 heredados.
- Composición publicada22bd5192825199aeafd0cf5e3625606ff77657b0 revisada por Director, padres55138/c4 y once rutas acumuladas. GO3 ejecutó una única receta normal sobre ese SHA;16pasos medidos aceptados, ledger omitido y todos los fallos/omisiones/avisos preservados. Bytecheck43/43 anterior a docs, fuentes intactas y originales sellados.

## VALIDACIÓN

> **Evidencia histórica de la #314** sobre la base `0e630ede760dbc369ddf60133c18c4a77f2d8692`, no de la cabeza de la #526: 168/168, 248/248, tipos PASÓ y los 12 mutantes son de allí. Sobre la cabeza de la #526: NO EJECUTADO en local; lo cubre el CI.

- PASÓ: identidad Git y guard/claim locales; SHA256 del contrato activo.
- PASÓ: instalación explícita corepack pnpm12.14.0 install --frozen-lockfile (Node24.20.0); package SHA256b3f8a4feb66fea436215d17632a4951ef880ee0f096183afe87bb94cf5d2e1d5 y lock51550316928cf4ee17696eaa4c87f4e9e944146d2c2c9ca229f82caed4051608 iguales antes/después. La preparación automática anterior en knowledge:status se conserva literal y no se denomina congelada.
- ROJO funcional de acciones en base intacta:117 FALLÓ/28 PASÓ,145 casos. ROJO UI real:13 FALLÓ/8 PASÓ,21 casos; fallos de fixture de intentos anteriores separados y no contados como evidencia funcional.
- PASÓ primer VERDE:145/145 acciones; conjunto168/168 (145 acciones+23 UI), cero omisiones. No sumar corridas superpuestas.
- ROJO/VERDE nativo: Chrome headless, mismo componente/forms/CSS y handler reales, session/DB/Storage/posting sintéticos. Dos envíos del mismo form, fixture transporte11bytes igual en base/candidato. Base segundo File ausente y método cash; candidato segundo File name/type/size/bytes/SHA idénticos en FD cliente y multipart parseado, método transfer y todos los campos iguales, sin pageerrors.
- PASÓ regresión ampliada:248/248 en9archivos, cero omisiones;151 acciones C3+25 UI C3 y72 previas. Incluye error de campo MIME del handler real y fallos posteriores upload/UPDATE conservando la frontera incierta0575.
- PASÓ: tipos (primer fallo solo tipo unión de tabla C04 de test, corregido y conservado); lint de las cuatro rutas TS/TSX, sin advertencias; docs:index/check, sdd:check, components:check, governance:check y validador read-only del plugin instalado. Numeración conserva choques históricos aplicados y18huecos, no nueva colisión.
- PASÓ:12 mutantes de código M1–M9/M11+N1/N2 por aserción prevista y M10 nativo por File en ambos forms (13 variantes). Fuente actions7bd00bb3dfe9626d35ea1aab436483f3287e1447ed53d2c77b8029d48be07cab y UI6ab337a12cfe6e82018cbc1baf45a7d248e5c8a45ef17046eae6ea5fef33ed6a restauradas exactas. El intento shell inicial y dos clasificaciones del arnés se corrigieron sin repetir mutantes ya demostrados.
- PASÓ suplemento nativo con PNG válido:4recorridos alta/edición390×844/1280×900, foco del error, reintento Tab→Cancelar→Guardar→Enter, campos/File/hash, preview decodificada y primer rechazo sin efectos;2controles pending por botón/fondo y cierre real limpia selección. Recursos propios puertos64541/3175/7707 cerrados; ningún proceso ajeno eliminado.
- UI-check advisory del delta sin bloqueadores nuevos. Matriz SGE12principios/políticas y privacidad técnica por fuente en spec C3 y recibo externo ui-governance-review.md; riesgoR3, sin excepción nueva ni conformidad global inventada.
- FALLÓ y CIERRE ADEMÁS INCOMPLETO: primera receta normal corepack pnpm verify sobre a732bcb0221ad821c671b0ee18d52ab928da26eb,07:28:01.8197424–08:03:24.5892194Z,exit1.16/17pasos medidos, test falló y migrations-applied OMITIDO por URL/SERVICE_ROLE_KEY ausentes. Primer intento unitario12.934 PASÓ/1 FALLÓ/1 OMITIDO; reintento normal12.933/2/1. No sumar intentos ni presentar el fallo como verde.
- Diagnóstico original: env-example-contract:98 detectó literalmente TZ en ambos intentos por lecturas/asignaciones directas nuevas en el fixture UI. El reintento agregó timeout20000ms de supplier-flow.test.tsx:287; ese caso pasó en el primer intento. Causa de ese timeout NO VERIFICADA; Portal, tiempos y gates intactos.
- PASÓ con límites de la primera receta: harness237/237, lint0errores/15advertencias, RSC/tipos/cuatroEdgeFunctions/docs/numeración/componentes/gobernanza, SQL249contratos con rollback, reconstrucción492migraciones (474DDL+18historial) en DB efímera y build. El corpus real de proformas sigue OMITIDO. E2E fue OK con AVISO del runner:177expected/20skipped/0unexpected/1flaky,198casos; ERR_ABORTED de auth Chromium recuperado en reintento y error global worker-17 forzado después de300000ms. La interpretación WebKit/no-regresión del runner no demuestra causa.
- PASÓ bytecheck inmediatamente después del EXIT,08:03:24.6738369Z:39/39fuentes/hash/bytes iguales, HEADa732estable, árbol limpio, antes de documentación. JSON E2E original268808bytes capturado por observador externo sin hooks/filtro rootDir; no se reconstruyó ni repitió E2E. Originales de esa carpeta y wrapper49d030 quedan inmutables.
- PASÓ reparación exclusiva de fixture TZ autorizada tras revisión de EXIT/bytecheck: vi.stubEnv("TZ",tz)/vi.unstubAllEnvs(), conservando Intl/resolvedOptions real,25casos UI, aserciones y límites. Focal UI+env-contract26/26,0omitidos,08:07:27.756–08:07:56.240Z. M9 volvió a morir por día visible incorrecto:6FALLÓ/1PASÓ/18omitidos por filtro explícito D01-D04; producto UI restaurado al SHA6ab337a12cfe6e82018cbc1baf45a7d248e5c8a45ef17046eae6ea5fef33ed6a. No se repiten controles intactos por este delta exclusivo de test.
- FALLÓ y CIERRE ADEMÁS INCOMPLETO: segunda receta normal sobre d1a7cca287fafcfe978ac74a58c40040889193c2, 08:25:18.8874801–09:03:45.1958957Z, exit 1; 16/17 pasos medidos, test fallido y ledger OMITIDO. Primer intento: 12.934 PASÓ/1 FALLÓ/1 OMITIDO, 562,82 s; único fallo Portal supplier-flow.test.tsx:287 por timeout 20000 ms. Reintento nativo: 12.934/1/1, 567,73 s; único fallo EmbarquesClient.borrado.test.tsx:184 al buscar el botón «Eliminar embarques» mientras el DOM original mostraba submit disabled «Procesando…». No se atribuye causa ni se fusionan intentos; TZ ya no figuró entre fallos.
- PASÓ con límites en la segunda receta: harness 237/237, lint 0 errores/15 advertencias, RSC/tipos/cuatro Edge Functions/docs/numeración/componentes/gobernanza, SQL 249 con rollback, reconstrucción 492 (474 DDL+18 historial) en DB efímera y build. E2E OK con AVISO del runner: 177 expected/20 skipped/0 unexpected/1 flaky, 198 casos; auth Chromium ERR_ABORTED 14231 ms→13593 ms aprobado en reintento y error global worker-17 forzado tras 300000 ms. Wording WebKit/no-regresión del runner conservado sin promoverlo a causalidad.
- PASÓ bytecheck automático de segunda receta a 09:03:45.2883911Z: 39/39 rutas únicas, hashes/bytes iguales antes/después/actuales, HEAD d1a7 estable y árbol limpio antes de documentos. Trece primeros originales también intactos. JSON E2E original 268802 bytes/SHA4bb1943ae2400f1b70dd6b782b7e7060661da764c40cb8c7192633028d263e3e capturado a 09:01:54.279Z con inicio propio 08:52:33.075Z. No reconstrucción ni E2E adicional.
- PASÓ cierre de recursos observados: 89 identidades cerradas, cero listeners propios 3149/13149 y cero contenedores exactos dtd_sqltest_a6fd22e4/dtd_rebuild_a6fd22e4. Ningún proceso terminado por el Worker; cuatro WebKit anteriores no atribuidos se preservaron. Turno pesado devuelto expresamente al Director para el focal87 de 0574; claim C3 conservado. No se certifica limpieza global.
- PASÓ preflight de composición: receptor/remoto55138 y donante/remotoc4 exactos, PR314 y315 OPEN/DRAFT, claim propio y preimágenes comunes de ambos tests. Protegidos por hash/bytes los13primeros originales,32del segundo sobre y13artefactos del donante más su recibo2824bd5df16ac699c101024dcecace19de8577f7d1727c4fbfb499449c8f2d8e. Gestor efectivo pnpm12.14.0 sin alterar package/lock.
- PASÓ índice generado y docs:check sobre el árbol de composición previo al commit:559specs/18huecos. Los40casos originales/candidatos de0577 son evidencia previa del donante, ligada a sus blobs; en esa fase no se ejecutaron de nuevo ni se atribuyeron a un HEAD receptor futuro. La receta receptora posterior se registra por separado abajo. No se afirma causa del timeout Portal o estabilidad temporal por aquel par.
- GO3,exit0 con CIERRE INCOMPLETO16/17: única receta normal corepack pnpm verify sobre22bd5192825199aeafd0cf5e3625606ff77657b0,09:58:37.0499811–10:36:15.3461774Z; sin credenciales/overrides ni cambio de workers/tiempos/gates. Primer intento unitario FALLÓ/PARCIAL,519.63s:886archivos PASÓ/1OMITIDO de889;12823casos PASÓ/1OMITIDO de12936;2errores de pool tras2ZoneOOM/Worker exited unexpectedly. Faltan archivos/casos sin resultado, no omisiones normales. Reintento nativo único PASÓ,647.26s:888archivos PASÓ/1OMITIDO de889;12935casos PASÓ/1OMITIDO de12936. No sumar intentos, borrar el parcial o deducir causa/estabilidad.
- PASÓ con límites GO3: harness237/237;lint0errores/15warnings;RSC/tipos/cuatroEdgeFunctions/docs/numeración/constantes/componentes/gobernanza/manifiesto pendiente;SQL249 con rollback;rebuild492=474DDL+18solo-ledger, aislamiento sintético219tablas/2tenants;build y restauración automática de tsconfig. Migrations-applied SKIP por URL/SERVICE_ROLE_KEY ausentes. Nombre individual del1skip unitario acreditado por stdout NO DISPONIBLE; fuente corpus.test.ts:31 es correspondencia estática/inferencia, sin corpus ni cache/JSON de casos.
- E2E GO3 original capturado,270339bytes/SHA455ae60e2a70281f0f87ff808b3e96cc82369a774e3fba68476d70115059b437:198únicos,177expected/20skipped/0unexpected/1flaky,557377.402ms. Esta vez Chromium company-photo-carousel.spec.ts:93/:103 expected2/received1 de #operacion video,20335ms→retry1PASÓ20753ms; no es el auth previo. Error global worker-17 sin salir300000ms/force-killed y aviso del runner conservados, sin causalidad WebKit/no-regresión acreditada. Adjuntos reales contexto/trace copiados exactos. Las20omisiones conservan sus anotaciones, sin cobertura productiva inventada.
- PASÓ integridad GO3 inmediatamente trasEXIT,10:36:15.5742581Z:43/43rutas únicas con hash/bytes iguales antes/después/actuales, HEAD22bd y árbol limpio antes de docs. Director aceptó16medidos en revisión e46a0136ac34387f18ad5ddcb09238f167d305717658dac96dbe74901b697334. Cierre atribuible135identidades observadas/0restantes,28+28de ambos intentos/0restantes, puertos3149/13149 libres y dos contenedores exactos ausentes; cero kills, candidatos antiguos/inciertos preservados. SobreGO3 inmutable,40archivos sellados;13+32+13originales previos intactos.
- NO EJECUTADO al corte documental: conocimiento C3, pendiente de este commit estable y turno expreso. DB/SQL vivo, producción, teléfono/Auth reales, lector de pantalla y zoom nativo200% tampoco ejecutados. El layout fuente limita maximumScale1/userScalablefalse; CSSzoom no sustituye esa medición. El ciclo posterior irá a recibo externo/PR, sin reescribir este documento para autocitarlo.
- Lecturas confirmadas en base: actions9f10b23265c8273e9a2f543ac04092d1c7beea86; MobileTSX684e417cc504e77fdacb0c372eb43221913c1530; helperCaracas00af1518045806694794defd7b4154d3ba5b0913; spec0754922bade809ba9f019fd8c3e89509dbb825a1.

## COMMITS

Checkpoint funcional a732bcb0221ad821c671b0ee18d52ab928da26eb, reparación de fixture d1a7cca287fafcfe978ac74a58c40040889193c2 y anotación documental55138b9cca4d304802337b50f353569531f9993e publicados sobre base0e630. Composición publicada/probada22bd5192825199aeafd0cf5e3625606ff77657b0, padres receptor55138b9cca4d304802337b50f353569531f9993e y donantec4b2e72dabbdde80ec7fe5c8a7f128966b6494be. Este cierre documental conserva sus ocho blobs de producto/tests/herencia; SHA documental definitivo/remoto/readback se registran externos después del commit, sin una cadena para autocitar el SHA propio.

## PR / BRANCH

PR314 OPEN/DRAFT: https://github.com/SoftAgentes/DTDCARGO/pull/314 (reemplazada por la #526), apilada sobre la rama/base indicadas arriba y adjunta al chat. Head/base actuales se cotejan en recibo externo/readback de cada checkpoint. Sin permiso de merge o producción.

## PENDIENTES DE ESTA TAREA

Fijar/publicar este checkpoint documental estable y conservar claim hasta aceptación local final. La composición y GO3 ya fueron revisados/aceptados con sus límites; no hay otra canónica/focal prevista por documentos. Con turno expreso, ejecutar un único ciclo nativo de conocimiento sobre el SHA documental: Graphify0.9.61, Archify2.16.0 con hashZIP previo, visual/check/preview/publish/status/check locales del runbook. Resultados postcommit en C:/tmp/director-traspaso-20261020/0576-c3-next/knowledge-final y PR314; sin ciclo previo para autocitarse ni publicación compartida. Mantener13+32+13originales previos y40delGO3 íntegros. Después revisar remoto/PR/limpio/recursos y liberar claim mediante recibo externo y aceptación del Director. Semántica, Obsidian visible, integración y producción conservan estados independientes.

## FUERA DE ALCANCE DETECTADO

Carreras y fallos inciertos entre Storage/documento/posting son0575; no hay reparación histórica, nueva SQL, roles/RLS, moneda/FX, layout/CSS, deuda global de componentes o BCV en este slice. Portal y embarques conservan sus fallos anteriores sin causa demostrada; la reparación independiente0577 se heredó sin reescribir y su aceptación receptora se mide por GO3, no por transferir40focales históricos. ZoneOOM/pool del primer intento GO3 y el caso carousel recuperado conservan causa NO DETERMINADA; no autorizan cambiar memoria/workers/runner/tiempos. El corpus real sigue sin inspección; nombre individual nativo del skip no disponible.0495 ya aplicada no se repite;0496y0500 siguen sin aplicar a producción. No se consultaron filas reales, secretos o PII. UI heredada: Archivo/ArchivoBlack medido por layout real frente al split operativo Nunito/Sora de la rúbrica; restricción zoom y legibilidad oscura sintética, sin cambio ni excepción por C3.

## HANDOFF AL DIRECTOR

Worker conserva claim al corte documental y devolvió expresamente turno pesado a10:41:50Z, con cero recursos pesados propios observados. Director cotejó originales de las tres recetas,43/43fuentes y cierre atribuible, y aceptó16pasos medidos delGO3 con CIERRE INCOMPLETO16/17; primera/segunda FALLÓ e intento parcial actual permanecen. Producto/tests C3 y baseline0577 conservan blobs revisados. Se entrega este checkpoint para el único ciclo postcommit de conocimiento con nuevo turno/GO; resultados/cierre final de claim irán a recibo externo y PR sin autorreferencia documental. Conocimiento integrado, semántica global, publicación compartida y producción conservan sus fronteras; no se cierra0576/2.1globalmente.

## COMPOSICIÓN LOCAL 0577 — alcance y procedencia

Allowlist acumulada:11rutas frente a basePR0e630. Las siete originales C3 se conservan; se añaden por herencia app/p/[token]/supplier-flow.test.tsx, app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.borrado.test.tsx, docs/specs/0577-contratos-pruebas-portal-embarques/spec.md y .agents/handoffs/0577-contratos-pruebas-portal-embarques.md. README ya estaba y solo se genera. No se amplían SQL/helpers/dependencias/config/runners ni protección productiva.

Cuatro blobs C3 protegidos del receptor55138: actions894b99fc1cb0792f1617c665fddda8707f58dc4c; MobileErpClient1732f771fad250ed962fa7cc22dabb9b718bbac2; fechas-caracas.test59726dd390d072636ef1e71d259beffb9f81d666; pruebaUIbc54f37a308e9a60c688a39f2c41f9c01e316f9a. Tests heredados exactos: Portal8112f1d2d1d98623830e31855e67c0bf97b325d3 y Embarques64c357737fd383078ce3b68594f816561f93bed5; spec/handoff0577 también conservan sus blobs donantes.

Donante revisado por Director/peer e48f432cd469f299ef8f9db1d5ebee569f7941a554a8b810a680b0584592c057, PR315 OPEN/DRAFT, base main observada d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8. Esa base de PR no cambia el ancestro eaf ni la base de PR C3. Sus40casos originales/candidatos y171oráculos/29negativas conservados, más2comprobaciones de disponibilidad, son evidencia previa. No prueban estabilidad ni causa del timeout y no sustituyeron la canónica receptora medida después mediante GO3.

Preflight, merge normal sin conflictos, índice y recibo final de composición: C:/tmp/director-traspaso-20261020/0576-c3-next/composition-0577. Checkpoint-publication.json SHA8acaf6dddcdd171d90414625c47ef782d59ec778e81db75c2a88395210760be2; padres/blobs/delta revisados por Director. El sobre43fuentes se preparó separado y se ejecutó una vez tras GO3 explícito sobre22bd, con protección de13+32originales/recibos del donante. No focal/UI/SQL extra ni knowledge por la incorporación.

## EVIDENCIA EXTERNA — tercera receta y cierre atribuible

Carpeta C:/tmp/director-traspaso-20261020/0576-c3-next/canonical-3, ahora inmutable. Wrapper0a6d370fdbc58237be6ecf77822d8966775d2e70a4c1b6e07d6574d0e6eed2fb y observer54f457911e4853140a84a785fb0f9efb8865983f1620c82680124b3c43168aa1 revisados antes del GO3: misma receta normal delGO2; solo carpeta, cuatro fuentes heredadas y sellos actuales. Preflight root/guard/claim/remoto/limpio/gestor/entorno PASÓ, package/lock sin cambio. ObservadorPID5632 creado09:58:35.416504Z; wrapper16880 y verify54192 atribuidos por ancestry, hora y script canónico. Captura original a10:34:16.933Z, rootDir informativo/sin filtro, sin hooks/reconstrucción.

| Original o derivado identificado | SHA256 | Alcance |
|---|---|---|
| verify-canonical.json | 3b7fb1b1c2d0e2e8fb2ae063f7b050445cf2b6a1788251fdbcbe313eb6a18022 | Inicio/EXIT0 sobre22bd |
| verify-canonical.log | f4e8d39ee407d231b35836b889a4db39b30fefcb00d2c3a025e6ca95b40a5d14 | Original completo, parcial/reintento/omisiones/avisos |
| verify-manifest-before.json | 61c8e2eb51762659cd6f5ef005289aaa6af42283df9341d74a448ee30772dda8 | 43fuentes únicas congeladas |
| verify-bytecheck-after.json | ec9d2c3cb8ae8919321bec345900e0a439c857e0a83319a83b54e95deac39797 | 43/43hashes/bytes iguales, antes de docs |
| unit-attempt-1-native.log | b6a31fa2157d300e0d24f7255ffc0c5612980cfeb0d565eec3b1c0815c5404f9 | Proyección literal del original, parcial12823/1/2errores |
| unit-attempt-2-native.log | 2e83fa0448a91ffee8cd45073d112c82067fe4720164af29a9d00d544043531d | Proyección literal,12935PASÓ/1OMITIDO |
| e2e-c3-original-54192.json | 455ae60e2a70281f0f87ff808b3e96cc82369a774e3fba68476d70115059b437 | Original270339bytes,198casos únicos |
| e2e-c3-observer-final.json | 75a2afac0f19512496e55f31ab42f517fb9c0d53f5dcea0f8e6218c9db4212a5 | Original capturado una vez, sin repetir E2E |
| e2e-attachments.json | d016159208d5e754451a9af5ed9b3ee3f40ff885856cd9afba8149dfcf2bd87f | Dos adjuntos nativos fuente/copia idénticos |
| e2e-attachments/001-error-context.md | 4369b669ed3cdfea6e2dcae9e94338f87292db90a610436ba26b3f5ae3bbd1f2 | Contexto nativo del fallo carousel,33875bytes |
| e2e-attachments/002-trace.zip | 0d7b66420ff2a1fcbeff05082f5fe0692a0be940429ac0b8f6088a6d7976e90c | Trace nativo del retry aprobado,11795429bytes |
| completed-analysis.json | ad6444a6e23e01892e33f7dcd5c97975f4b9922fd7b9dfc9fee32b72c240cd85 | Derivado agregado, no JSON de casos unitarios ni sustituto del original |
| resource-close.json | 2ca7494c17fe0001a790198c18f7e6ffcf3ddb227ffeeed14f68ae81286c3da6 | 135identidades observadas,0restantes;28+28intentos cerrados |
| heavy-release.json | 5ae2c544c11e520c3899d56c54b9e3836d4a90e2e3759f11d80bb040c2eb81fa | Turno devuelto, puertos/contenedores propios libres, claim retenido |

Sello externo de40archivos: C:/tmp/director-traspaso-20261020/0576-c3-next/documentation-3/canonical-3-originals-seal.json, SHA9b960b6289d4f59a86250d048b270ffe15cbc0359eb282b7e5dce694cad3747a. Carpeta sellada sin escrituras posteriores; los13+32+13anteriores se revalidaron por hash/bytes. Revisión íntegra del Director caracas-c3-revision-director-go3-terminada.md, SHAe46a0136ac34387f18ad5ddcb09238f167d305717658dac96dbe74901b697334, aceptó resultados y límites antes de estas ediciones.

Las20omisiones E2E nativas conservan motivos: comments3 porPreview/credenciales/seed, carousel móvil2 porcapturas una vez, gastos6 poraccounting/admin+gasto vivo, búsqueda6 porcredenciales/branch+seed, nómina3 poradmin+finiquito desechable. La interpretación del runner sobre WebKitWindows no prueba la causa del error global. Los muestreos de memoria fueron posteriores/no causales. unit-progress-2.json conserva una comparación inválida por coerción DateTime; unit-progress-2-date-corrected.json la corrige con identidades ISO UTC, no representa una prueba nueva ni falla del producto. Los snapshots brutos incluyen candidatos19932/37612 anteriores al GO3 por PPID reutilizado; resource-close y observed-identities aplican creación/ancestry temporal y los excluyen. Cero kills y límite explícito del muestreo, sin limpieza global.

## EVIDENCIA EXTERNA — segunda receta completa

Carpeta separada: C:/tmp/director-traspaso-20261020/0576-c3-next/canonical-2. GO2 del Director leído íntegro en caracas-c3-revision-director-d1a7cca2.md, SHA7085550f50e6b32709aa061476dda97cf5e10d2b99b4b461305edb835b5f145b; wrapper13b8a101b0e9aca965956fae3057b9a43680453754e90e33d13fa330d00b8258 y observer8a93b26b40b6e73a31c9921859741e1e6b85e39db6ca0ab50a6042b636c942f3 cotejados antes de una sola receta normal. Nodo24.20.0/pnpm12.14.0, solo las dos variables Corepack locales autorizadas; sin credenciales ni overrides VERIFY/NODE_OPTIONS.

| Original o derivado identificado | SHA256 | Alcance |
|---|---|---|
| verify-canonical.json | 7f9eb200e8187810cf30ffaee4573758fb9f62c6bb28636c3fd82f08a6d0ffe0 | Inicio/EXIT 1 sobre d1a7 |
| verify-canonical.log | 6bf8fd29c0550453391b6a3965ac09165d9e073236b7a1df8db1373cd23ea53f | Original completo, ambos intentos/avisos/omisiones |
| verify-bytecheck-after.json | 7516cf1f673805edd5c09218b5c11060301cbc79aeb18e75b963e37aa1b0ebb0 | 39/39 sin diferencias, antes de docs |
| canonical-unit-attempt-1.log | e360934a767a3789602a4bfc5dfe9e6ce67d92bacd6f557cd9d9763cabd54893 | Derivado literal; Portal timeout |
| canonical-unit-attempt-2.log | 4fdb294224a9525335b39012775953138abb71fe8c47d2cff9022f2852ff8bda | Derivado literal; consulta de botón en embarques |
| e2e-c3-original-21296.json | 4bb1943ae2400f1b70dd6b782b7e7060661da764c40cb8c7192633028d263e3e | JSON original fresco, 198 casos |
| e2e-c3-observer-final.json | aa4400759fe460f5af8653ed9b748732aac3c9b88476609e884167ea8e9ad083 | Captura por ancestry/PID/tiempo, sin filtro rootDir |
| completed-analysis.json | dc16f5686cee883da2159b12557d08ef26d404497cf241d30d0654f7c47a9c20 | Análisis derivado; no sustituye originales |
| e2e-analysis.json | 6ac1f12104a250229452376303fcdc8aca4b4547df784748eab7f0341259808c | Casos omitidos/flaky y error global por separado |
| heavy-release.json | 68bdbefd98eef50f544688f7135116989ab69c3bcebfefab6fe52c7d18d42de3 | Cero pesado propio, 89 identidades cerradas y turno devuelto |

La carpeta canónica queda preservada. Sello de todos sus archivos existentes en C:/tmp/director-traspaso-20261020/0576-c3-next/documentation-2/canonical-2-originals-seal.json, SHA9c4197b732e98f3eeca682999b4a363c9e0e77a1607f5d79ad1f7f1c9e08459b. Los nuevos recibos documentales van en esa carpeta hermana; ninguna fuente de producto cambia para registrar resultados.

## EVIDENCIA EXTERNA — primera receta y fixture TZ

Primera carpeta preservada: C:/tmp/director-traspaso-20261020/0576-c3-validation. Revisión del Director: C:/tmp/director-traspaso-20261020/caracas-c3-primera-canonica-revision.md,SHA256bdc113f6e3497e97685071b76bff47bb3ceae3430f72e10aee2e1bf5dd5de7e9. No es GO de segunda receta.

| Recibo original/derivado identificado | SHA256 | Alcance |
|---|---|---|
| verify-canonical.json | 9541981d5ccfc1213d0ff21696f0116f841166b03b0c6866b96bd10bdccfd54d | Inicio/EXIT1 sobre a732 |
| verify-canonical.log | 3e97bb3cb16752106a9eaebfa33dab81c2bad6338f0f2a360e47e4cef60bc47a | Original completo, fallos/reintento/omisiones/avisos |
| verify-bytecheck-after.json | 4b74d8c2ec1bdd99298f01e11c6595c1eb1a10692e6bc956ccbf94e7191cb31b |39/39sin diferencia, antes de docs |
| canonical-unit-attempt-1.log | 1dd0498e6886298d718a66b655ac92c73e12c5411112f636a2c9f3ab814c0191 | Derivado literal del primer intento,12934/1/1 |
| canonical-unit-attempt-2.log | ffe4efe7f016c2f9aa5c81027cc7428db833eb15afa58b08336bd78a971b5fb0 | Derivado literal del reintento,12933/2/1 |
| e2e-c3-original-23324.json | 0ff365f96a63595b19bbb5db7138ff1c289a01c7f7fe6bf130d1603409a95114 | JSON original198casos, sin reconstrucción |
| e2e-c3-observer-final.json | cfd9c816759de5be049769d26a16fcf87327aff4832b50438572f637b8e7f890 | Captura atribuida por ancestry/PID/tiempo |

Fixture/focal/M9 guardados en carpeta hermana nueva C:/tmp/director-traspaso-20261020/0576-c3-tz-fixture. focal.json SHA25638b439f5609844183b5d3c5cad1d5442fac07408bdc95fe0ca3fb2d215daa506; focal.log1c520c93f67c579249df17cbd89cb9a86fb53da291a168a1531a671b8f856821. m9.json8eed3ef4d8374c3bf8d3fb78cecbe00b8a32655559fbdf70cc18c921c5bf1ddb; m9.loga2ecedb983715d4c9fbd60704f96144554fecae6d3ea85b2ca75030386e9e277. Primera selección de originales sellada sin modificarla en first-originals-seal.json,SHA256612faca34abc8c711f77b47cfdd4e9e1b662f5352f3ca8f45a09ffd0ad752a98.

## EVIDENCIA EXTERNA C3 — checkpoint funcional inicial

Directorio absoluto: C:/tmp/director-traspaso-20261020/0576-c3-validation. Recibos y logs son externos; ningún dato real.

| Recibo | SHA256 | Alcance |
|---|---|---|
| red-actions-functional.receipt.json | f2ff442f63259a9516f7f50295d3b5f9e59e805ffcf633973a1064109687ecd9 | ROJO puro117/28 |
| red-ui-real-form.receipt.json | f3402ae905b17206bbad2eb6b3707d76499788671f8b5d7628bf90f035a43d36 | ROJO13/8; comparación global acredita método, no File |
| file-independent-base.receipt.json | ec8e9bc2ef6f15c44e06221e078b7b03c1e03e45275c5860e902df2e6ddaae8d | File JSDOM2 PASÓ/21 omitidos; no navegador |
| install-frozen.receipt.json | e8fc7f8492513f9fc9d3b05ffae6dc7010036096f0a77b2bccbb2c579dde012f | Invocación congelada explícita |
| green-focal-first.receipt.json | 8ffb4ab0e8763ece217fb9047d238d266be0a3133b18f9d2f6be6faf8e86b735 |168/168 PASÓ |
| native/base-multipart.json | c1126322305176ceeecc0f8339d280142a81e2e8804c3cee0cafc17223718db1 | ROJO File y método nativos, ambos forms |
| native/base-provenance.json | 6ebaf17d8528a170a66efc48da87ef90df4a9c29c47f6709057dbf7194535b0f | Base/bundles/adapter/CSS/fonts |
| native/candidate-multipart.json | 3e18370ef781902c35b163821503e264942cd0b809cc61b408c0fcfe6d902129 | VERDE mismo fixture11bytes |
| native/candidate-provenance.json | a795f0b60eec51ead6d986b889711da9a784f3ff6aff1b1a5b8e6624e05b4420 | Candidato observado |
| regressions-focal.receipt.json | d9b9b933ec99f08fbb354efaa9b96280966b747f642ee498ca9c5be4fc831ea8 |248/248,9archivos |
| typecheck-final.receipt.json | 1d7484e6e41b0e0f7548466919a7d24b7c4af89393cdb11a5269446ff6ac2a99 | Tipos PASÓ |
| lint-focal.receipt.json | 1bfddfde5a9f7a224e3b468ef666460565fae127786854f73eb2fff3a31090f5 | Lint cuatro rutas PASÓ |
| mutants/results.json | b51f82307b762cc8a6255fce8bb4a714efc0a60180873ab523fc42fc2267c02c |12variantes funcionales, restauración exacta |
| native/M10-result.json | a106650a24a48868cacaca569902a16205afb5a7d50dd404056af4e0de670a6d | File nativo:dos AssertionError previstas, restauración exacta |
| native/review.json | 714a9b80c6300cf1c6a8b8a2e2dde443786b53e036525e07a601e37dc1ca6ea5 | PNG válido,4recorridos+2pending |
| ui-governance-review.md | cafc3d6ed4678417b9a7e3cf16d8e19ed7ad561a37bcf64769226dcee72d02d0 | Matriz normativa/UIcheck/privacidad |
| static-gates.receipt.json | 9a14b6b939cce4ef73a3190bf47e8f9dc38715e97e2c39cc0529dc8da126487f | Docs/SDD/componentes/gobernanza/plugin PASÓ |

El PNG11bytes es un fixture de transporte y no decodifica como imagen. Las capturas base/candidato se conservan con esa limitación; no prueban calidad visual de la preview. El suplemento visual usó PNG ficticio válido240×160/4421bytes/SHA2560e6d2f8ca3f566e34692303b1d8cf58ae963ba25d64fb3b443786f0c23af055c. native/artifacts-bytecheck.json confirma bundles candidato restaurados idénticos al provenance observado; observed-adapter.cjs conserva los bytes previos al flag posterior build-only.

## CONTRATO ACTIVO ÍNTEGRO ADOPTADO
# Asignación activa C3 — gastos móviles con día Caracas

Estado: **ACTIVADA por Director el2026-10-21**, después de aceptar C2 final y comprobar su liberación de claim/turno. Sam autorizó esta continuidad local con entregas en PR en borrador. El Worker asignado es `/root/worker_0576_c3`; su preflight completo terminó en solo lectura y sin dudas materiales. Esta es la asignación ejecutable, con identidad y siete rutas fijadas.

**Turno inicial:** puedes reclamar ownership, guardar el contrato/handoff y preparar las definiciones de pruebas/dobles después del guard. El Director ejecuta ahora su `corepack pnpm knowledge:status` de cierre en main. **No instalar, ejecutar pruebas/tipos/build/DB/navegador/Graphify ni otro proceso pesado hasta recibir su mensaje explícito GO PESADO C3.** No modificar comportamiento de producto antes de demostrar los ROJOS funcionales. Al recibir ese GO, el único turno pesado será tuyo para implementación/validaciones proporcionales; verify canónico conserva el GO posterior sobre checkpoint revisado.

El borrador revisado está preservado como `0576-caracas-c3-asignacion-worker-borrador-revisado.md`, SHA256bbaa2a1ddea899317f9dad1fadf51abf6c89231cd7f0e0d34a1d7e18b77552e9. Revisión de preactivación4df3ff707ef1cc545709439a3e97ef8d2cd472525c78f880225e83de8eaa6a91, PASÓ documental. Esta activación concreta identidad/turno y precisa un único ciclo final de conocimiento; no amplía las siete rutas ni los contratos aceptados.

C2 final aceptado:0e630ede760dbc369ddf60133c18c4a77f2d8692, PR313OPEN/DRAFT/base d6bcd0e8b9738cb5784579ef8e7f1802abef4644, remoto igual/0ahead/0behind/árbol limpio/claim ausente cotejados por Director. Recibo final SHA2563e25184d379eb658e8007a5aa0ad0f594d286f42efc0046a7c8fcd626ffa3682 y54referencias de evidencia cotejadas. Su16/17CIERREINCOMPLETO, avisos y semánticaPENDING no se convierten en producción aprobada.

## Identidad y aislamiento comprobados

- TaskID: `0576-fechas-caracas-movil`.
- Owner: `worker-0576c3-01a15a4e-ddf0-7d82-8656-d9dc56b58468`.
- Repositorio principal solo de lectura: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Worktree creado y comprobado: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0576-fechas-caracas-movil`.
- Rama creada y comprobada: `codex/sdd-0576-fechas-caracas-movil`.
- Base de implementación: **`0e630ede760dbc369ddf60133c18c4a77f2d8692`**; no sustituirla por0f2/b309/d6.
- Base de PR: `codex/sdd-0576-fechas-caracas-anuales` (#313), SHA **`0e630ede760dbc369ddf60133c18c4a77f2d8692`**.
- SDD reutilizada: `docs/specs/0576-fechas-caracas/spec.md`; preservar C1/C2 y estado global justificado. No reservar número nuevo. No se prevé SQL.
- Handoff propio: `.agents/handoffs/0576-fechas-caracas-movil.md`.

El Director creó el árbol con harness start desde ese SHA y comprobó raíz/rama/HEAD, status limpio, claim inicialmente ausente y `.env`/`.env.local` ausentes. No instaló dependencias ni copió secretos. El Worker debe ejecutar su guard/claim y volver a comprobar esas identidades antes de editar.

## Resultado autorizado

Corregir fecha contable Caracas en alta, edición y presentación de gastos móviles. Antes de cualquier efecto, comprobar tenant autorizado, gasto propio, cierre y coherencia de la historia contable. Conservar el mismo formulario, sus datos y el File ante rechazo recuperable; cerrar las dos vías de desmontaje del alta durante pending y ubicar el error con foco y recuperación por teclado. No re-fechar historia ni convertir las guardas de app en una transacción de0575.

Director coordina; este Worker es el único escritor de producto en el árbol propio. Ejecuta hasta implementación, pruebas proporcionales, revisión, commits selectivos, push, PR en borrador y handoff. No preguntar a Sam por pasos reversibles o decisiones ya resueltas. Comunicar al Director avances, checkpoints y dudas materiales; no enviar mensajes a otros chats de Codex.

## Lecturas y adopción antes de producto

Leer AGENTS/overrides del ámbito real, `.agents/skills/worker/SKILL.md`, runbook de ingeniería y `docs/engineering/project-rules.md`. Guard/claim propios antes de editar; registrar contrato durable en el handoff antes del primer cambio de producto. Reconfirmar raíz/rama/base/árbol limpio; nunca trabajar en main/detached/árbol ajeno. No copiar secretos, `.env`, derivados de main ni trabajo ajeno.

Leer `docs/governance/AGENT-BRIEF.md`, registro y versiones aprobadas de SGE/DAT/ERR/FRM/NUM/A11Y relevantes; skill governance-check read-only, BRAND, `docs/design/README.md`, Norte vigente y **`docs/design/studio/_norte/backend/README.md`**. Este último existe; la abreviatura desde raíz era incorrecta. Es handoff histórico del prototipo, no prueba de que Supabase vivo sea mock. UI check está en **`.claude/commands/ui-check.md`**, es advisory read-only. No invocar skill ausente ui-ux-designer.

Aplicar skills Supabase y Graphify pertinentes sin ampliar permisos. Para el File leer `.claude/skills/revisar-datos-ve/SKILL.md` y `references/checklist-datos-ve.md`: inventario técnico del delta, fuente/línea y ENCONTRADO/CORRECTO/NO VERIFICABLE. Solo datos ficticios; la guía genérica no autoriza filas/PII reales, auditoría jurídica global o políticas nuevas de licitud/retención. No prometer borrado físico de memoria o de archivos históricos.

Leer íntegros y comprobar estos antecedentes externos dentro de `C:/tmp/director-traspaso-20261020/`:

| Fuente | SHA256 | Uso |
|---|---|---|
| `caracas-c3-movil-contrato-director-preparacion.md` | `76f523ce8ca01115e878c5c4c6501d57f89aac3d37f4dd1c72e6be26094783df` | Objetivo y siete rutas; su base histórica se sustituye por la final asignada |
| `caracas-c3-movil-revision-diseno.md` | `be8f237334f5396617d9834fde6481f7550bf2b5e207400d24551a086d55a55e` | Revisión documental |
| `caracas-c3-movil-matriz-pruebas-preparacion.md` | `cf2920ddacbb8d8484127ab04436634e4923536b0e279694aff85e75bb3971f9` | 37 escenarios y11mutantes propuestos, todos NO EJECUTADOS al prepararse |
| `caracas-c3-decision-tenant-y-recuperacion-preparacion.md` | `367222e74a633ca94ecab4dad8970a04df171d052b4040fae1674e030ba384d0` | Decisiones aceptadas tenant/origen/lecturas/archivo |
| `caracas-c3-matriz-normativa-b309-preparacion.md` | `e8fc2817dd7ec064f13965767c89abbf5bc994773136e1c97534176b13b6afda` | Doce principios y normas; fuentes b309/d6 por reconfirmar en base final |
| `caracas-c3-addendum-recuperacion-y-norte-preparacion.md` | `87ae3e193a9d334f8a6f049f8586bd0144f3fdb392c0ef81c43031db18929ba8` | N1/N2 aceptados y Norte canónico |
| `caracas-c3-addendum-recuperacion-y-norte-revision-preparacion.md` | `81525ef6b9d5350bc7159209ab93312d1cb4b4150c5bc11860d40b6c0723887b` | Revisión independiente de addendum |

Esta asignación y las decisiones explícitas prevalecen sobre datos históricos de los borradores. Los números37/11 son la matriz propuesta, no resultados transferibles ni obligación de sumar casos solapados.

## Allowlist exacta — siete rutas

```text
app/m/erp/actions.ts
app/m/erp/_components/MobileErpClient.tsx
app/m/erp/__tests__/fechas-caracas.test.ts
app/m/erp/_components/MobileErpClient.fechas-caracas.test.tsx
docs/specs/0576-fechas-caracas/spec.md
docs/specs/README.md
.agents/handoffs/0576-fechas-caracas-movil.md
```

Índice generado solo si corresponde. Helpers compartidos, CSS/layout, void/gobernanza, monetarios, todos los tests existentes, SQL/baseline/manifiestos y rutas del Director son read-only. Si hace falta una octava ruta concreta, demostrar necesidad al Director antes de editarla. No exportar utilidades desde `use server` como acciones remotas ni crear RPC para facilitar pruebas.

## Contratos obligatorios

1. **Una sola ancla en alta:** capturar instante antes del PRIMER await, derivar día Caracas antes de auth/sesión/lecturas, persistir exactamente ese `occurred_at` y pasar el mismo día al poster. No usar timestamp de respuesta como segundo reloj. Helper canónico **`lib/shared/fechas-caracas.ts`**: `validInstant(Date|string)` devuelve Date clonado o LANZA RangeError, no es predicado; `fechaCaracas(Date|string)` valida; `isCalendarDate(unknown)` sí es predicado. Traducir histórico inválido a rechazo recuperable. Conservar UTC de auditoría. La numeración mantiene la RPC/contrato propio; no inventar parámetro de fecha o afirmar que su reloj queda anclado.
2. **Tenant confiable para ambas acciones:** después de auth, `await supabase.rpc("get_user_tenant_id")` SIN argumentos, mismo cliente de sesión/RLS.0453 devuelve UUID escalar con exactamente una membresía activa. Aceptar respuesta sin error y UUID canónico válido (no restringir a v4); NULL/error/excepción/undefined/array/objeto/número/bool/vacío/malformed bloquean sin efectos. No String/trim/first-row/fallback/membresía permisiva/tenant de FormData/ADMIN/roles web. Helpers privados solo para gastos.
3. **Cierre estricto:** solo `[]` íntegro o una fila coherente del tenant con closing_dateNULL significan abierto. Error/ausencia de tabla/cardinalidad múltiple/shape/tenant/fecha inválidos bloquean. No confiar el lector general permisivo ni cambiarlo. Validar calendario, no solo regex.
4. **Origen editado:** exactamente una fila, límite2 y filtros id/tenant/owner/noeliminado; seleccionar id/deleted_at y campos previos necesarios, validar fila real devuelta y ocurrido histórico. Conservar gasto propio aunque RLS permita ver equipo. No modificar occurred_at/created_at. No convertir ausencias malformadas en permiso.
5. **Antes de efectos en edición:** resolver cuenta y criterio vigente acctChanged (amount_usd/cuenta/método) antes de foto/UPDATE. Cuando cambie contabilidad, leer[] o UNA fila íntegra de asiento vivo, límite2, campos id/tenant_id/expense_id/source/entry_date/status/deleted_at y filtros coherentes; sourceexpense/statusasentado/deletednull. Solo[] es ausencia. Bloquear origen cerrado/asiento cerrado/fecha del asiento distinta al día Caracas del origen. No re-fechar ni void/post cuando se bloquea. Descripción abierta sin repost conserva su política y no añade guarda contable innecesaria. Accountnull permitido según resolver legado; no nueva regla de permisos.
6. **Efectos observados:** ante negativas conocidas, cero next_expense_code/upload/remove/INSERT/UPDATE/void/post/revalidación exitosa. Las lecturas previas no cierran carreras ni hacen atómica DB/Storage/posting; fallos inciertos y0575 conservan alcance propio. Mantener cálculos, FX, monedas, límites MIME/5MB, permisos y anulación gobernada/ConfirmDialog.
7. **Archivo, primero medir:** componente real→New/Edit forms privados→acción REAL con fronteras auth/DB/Storage/posting sintéticas. Dos submits del MISMO form sin volver a escoger archivo; comprobar name/type/size/**bytes** del segundo FormData recibido. Preview/input.files por sí solos no bastan. Si ya funciona, registrar y no inventar arreglo. Si hay fallo funcional, retención mínima local al form/selección, sin exportar/copiar form ni cache global/durable. Retirar/sustituir/cancelar/cerrar realmente se respeta; nunca reenviar un File retirado. Desajuste de realms JSDOM File/FormData es fixture, no ROJO funcional.
8. **N1:** reproducir cierre por fondo y botón Cerrar del alta durante pending real diferido, con campos/File. Si desmonta, proteger esas dos vías como edición ya hace; sin confirmación nueva/overlay/rediseño/doble envío. Mantener cierre voluntario cuando terminó y limpieza al cierre real. Rechazo recuperable conserva mismoform y reintento.
9. **N2:** reproducir error general por teclado bajo handler real. Mensaje persistente sanitizado y gestión mínima local de foco en ambos forms; comprobar foco real y segundo envío por teclado, campos/File conservados. No mover foco en cada render/tecleo/foto; no revelar errores SQL/tokens/tenant. Separar semánticaDOM, teclado observado y lector de pantalla NO EJECUTADO.
10. **Fila visible:** IANA America/Caracas/locale existente con Intl real. Bordes02:30Z,03:59:59.999Z/04:00Z, año/bisiesto y Caracas histórico−04:30; deviceTZ distinta no cambia día contable. No tocar tiempos relativos, selector de tema ni layout. Layout real es claro; oscuro solo fixture, native200% no disponible si herramienta no lo permite, jamás CSSzoom como sustituto.

## Validación y turno

- Reconfirmar blobs: actions `9f10b23265c8273e9a2f543ac04092d1c7beea86`, MobileTSX `684e417cc504e77fdacb0c372eb43221913c1530`, helperCaracas `00af1518045806694794defd7b4154d3ba5b0913` en0f2. Si base final difiere, inspeccionar y avisar antes de asumir equivalencia; no copiar test/spec C1/C2 antiguos.
- Preparar tests nuevos con doubles que soporten TANTO caminos anteriores (user_tenants.maybeSingle/lector settings/expenses.maybeSingle) como candidato rpc/arrays. ROJO debe ser aserción funcional prevista, nunca import/TypeError/fixture. Payload malformado se inyecta DESPUÉS de filtros, no se elimina casualmente por el propio doble.
- Registrar ROJO/VERDE comandos/casos/tiempos/exit/omisiones sin sumar grupos solapados. Cubrir negativos de auth, tenant, settings, origen, entrada múltiple/malformed/incoherente/closed/historia; positivos ausencia válida, nullopen, entrada coincidente y descriptivo. Tasa/importe/adjunto/anulación/regresiones previas preservados; no escribir tests ajenos.
- Mutantes focales de reloj tardío/corteUTC/omisión de guarda/filasfalsy/re-fechado/fila visible y recuperación según matriz. Muerte por aserción prevista y restauración por bytes; sin editar controles/timeouts/pools/gates/deps. El Director revisará checkpoint inmutable y delta completo antes de verify.
- UI loopback sintética del componente/CSS reales, m-root/ToastProvider y transporte de acciones que registre FormData real (hash/bytes)→handler.390px y desktop, teclado/foco/reintento/reflow/últimocontrol; fuente real observada, nunca captura pintada de otro form. Servidores/ports/PIDs con dueño; cleanup propio. Sin Auth real, teléfono o certificado WCAG integral. Evaluar SGE12principios y riesgosR3 con evidencia/cumplimiento/noaplica/excepción/no conformidad; no inventar excepción por ausencia de prueba.
- Verificar tipos/lint/docs/sdd/governance y regresiones proporcionales. Una sola ejecución pesada a la vez; turno C3 exclusivo después de GO PESADO C3, sin solaparlo con el cierre knowledge de main u otros. Dependencias fijadas se pueden instalar después del GO; usar **corepack pnpm** explícito para comandos de paquetes en Windows y registrar su versión real sin cambiar configuración global. No copiar `.env`, ni actualizar paquetes/lock fueraallowlist.
- Checkpoint coherente con commits selectivos/guard, push propio y PR DRAFT apilada, adjuntar PR al chat. Avisar al Director del SHA/base para revisión y resolver hallazgos propios. No empezar receta canónica hasta GO del Director sobre candidato congelado. Mientras tanto cerrar evidencia/documentación no invasiva.
- `corepack pnpm verify` receta normal completa, única pesada, sin overrides ni ampliar límites. Manifest antes y bytecheck después del EXIT ANTES de documentos; incluir producto/tests/runner/lock/config críticas. No cortar un fallo ordinario antes del diagnóstico completo o reintentar fuera de receta. Ledger real sigue release, no motivo de consultar DB o aplicar migración. Conservar PASÓ/FALLÓ/NO EJECUTADO/NO DISPONIBLE y SKIPs literales.
- Informe E2E original si existe mediante observador externo separado, sin --require/NODE_OPTIONS/hook/fsmonkeypatch/overrides ni modificaciones al runner. Canonizar8.3/ruta larga, PID runner por ancestry y target exacto, rootDir informativo no filtro. No reconstruir JSON o repetir verify solo por archivo ausente. En cierre forzado registrar AVISO y error literal, no asumir WebKit/infra/no-regresión como causa.
- Conocimiento propio: status inicial/cierre; realizar **un único ciclo nativo de cierre después del commit documental estable**, sin generar un primer ciclo solo para autocitarlo y repetirlo. Intentar Graphify0.9.61 estructural nativo con Python existente, sin copia de derivados/main, API externa o instalación global. Archify local2.16.0 según lock/hash (verificar ZIP ANTES de extraer/ejecutar),9/9checks, visual, previewObsidian/check--preview. Solo ignorados propios; nada de bóveda compartida. Semántica/piloto/global se reportan separadas y no se inventan recibos. El handoff puede declarar el ciclo postcommit y su destino externo; resultados observados finales van a recibo externo y PR. Si una corrección real cambia documento después, refrescar los derivados afectados, no repetir producto por docs.

## Permisos y cierre

Sam autorizó continuidad local y PR en borrador mientras se resuelve pago, y avanzar objetivo tras objetivo sin detenerse. Commits/push/PR propia, fixtures ficticias, recursos efímeros/loopback/instalación de dependencias fijadas autorizados. NO merge/main/deploy/VPS/cron/cuenta/pago/filas reales/PII/secretos/producción.0495 ya aplicada una vez, nunca repetir. No nuevo SQL salvo necesidad concreta devuelta al Director antes de editar. Cada migración de producción mantiene su OK nominal independiente. No revocar llaves, leer contratos reales ni hacer envcopias.

Handoff durable con secciones exactas del runbook, evidencia porSHA, límites/pendientes propios separados deFUERADEALCANCE. No declarar0576/2.1globalmente terminado por una rama oCIlocal. No absorber0573/0575/BCV, deudaCSS/RLS, atomicidad o políticas nuevas. No recursión documental para autocitarSHA.

Antes de entregar: diffcompleto/allowlist/estado/numeración, PRhead/base/body/títuloDRAFT exactos, remotoigual/ahead0/árbollimpio, fuentes probadas idénticas trasdocs, recursos propios cerrados y candidatos inciertos preservados con atribuciónhonesta, claim liberado y recibo externo final. No borrar rama/worktree. Devuelve turno y detén escritura C3; BCV será nuevo encargo del Director.

## Preparación de pruebas adoptada

El rechazo recuperable inicial para File/N1/N2 usa un cierre válido que abarque ambos días UTC/Caracas y una espera diferida del doble; ya existe en la base. Guardas de historia/settings estrictos tienen ROJOS separados. No contar éxito de la base, import, TypeError, realm o fallo de fixture como pérdida funcional del archivo.
Doble thenable compatible con lecturas anteriores y candidato; corrupción inyectada al terminal tras filtros. Forms y create/update reales; frontera auth/DB/Storage/posting/revalidación sintética. Dos submits del mismo form y bytes/name/type/size del segundo FormData; navegador nativo y multipart observados cuando se autorice su ejecución.


## AUTORIZACIÓN DE COMPOSICIÓN 0577 — TEXTO ÍNTEGRO

Fuente externa y SHA indicados arriba. La confirmación posterior de PR315 DRAFT, arranque y devolución del turno activa únicamente la composición; el cierre pendiente del texto no constituye GO3.

# Caracas C3 · incorporación local prevista de 0577

21 de octubre de 2026. **AUTORIZADA LA COMPOSICIÓN LOCAL, NO LA CANÓNICA.** Director y peer revisaron el SHA funcional c4b2e72dabbdde80ec7fe5c8a7f128966b6494be y sus40casos. La ejecución local por el owner C3 espera mensaje de arranque del Director tras confirmar PR DRAFT y devolución del turno0574; antes solo lectura. No se trabaja en main ni se integra PR.

Receptor: mismo Worker/owner/worktree/rama C3, actualmente checkpoint documental55138b9cca4d304802337b50f353569531f9993e, baseC2 0e630ede760dbc369ddf60133c18c4a77f2d8692. Claim C3 sigue adquirido; no se transfiere a0577. Donante: rama independiente `codex/sdd-0577-contratos-pruebas-portal-embarques`, SHA **c4b2e72dabbdde80ec7fe5c8a7f128966b6494be**, baseeafbd910d1c082c9b416b558f8c3db5847b994a6. Reserva8e1d2765 es solo stub. Producto/tests C3 conservan blobs del receptor; tests heredados esperados: Portal8112f1d2d1d98623830e31855e67c0bf97b325d3 yEmbarques64c357737fd383078ce3b68594f816561f93bed5.

Revisión independiente íntegra **e48f432cd469f299ef8f9db1d5ebee569f7941a554a8b810a680b0584592c057**, sin hallazgo obligatorio nuevo. Director leyó delta completo de cinco rutas y metadata/driver/lint; cotejó13/13artefactos porhash/bytes, parseó40nombres únicos iguales y ambos40PASÓ. Se conservaron171oráculos/29negativas/+2visible-enabled,38cuerpos iguales. Ejecucionesoriginal/candidato fueron sobre reserva8e con byteslocales, vinculados a blobsdelcheckpoint por recibo2824bd5df16ac699c101024dcecace19de8577f7d1727c4fbfb499449c8f2d8e; no se atribuyen retrospectivamente a una ejecución iniciada enHEADc4. OriginalPortal2506.32ms y candidato2259.59ms pasan; no se reprodujo timeout focal ni se demuestra estabilidad/causa. Esa aceptación general es precisamente la validación receptora pendiente.

## Herencia exacta que podrá incorporarse

Los dos tests, spec0577 y handoff0577 serán **baseline heredada revisada**, sin permiso del Writer C3 para reescribir sus aserciones o producto. Índice compartido se genera conservando ambas specs. Estas cinco rutas se suman a la autorización de composición, con README ya presente en las siete originales:

1. `app/p/[token]/supplier-flow.test.tsx`
2. `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.borrado.test.tsx`
3. `docs/specs/0577-contratos-pruebas-portal-embarques/spec.md`
4. `.agents/handoffs/0577-contratos-pruebas-portal-embarques.md`
5. `docs/specs/README.md` — generado, jamás resolver borrando specs del receptor.

La allowlist acumulada de la PR C3 pasa de7 a11rutas por herencia de cuatro nuevas. El producto C3 y sus dos tests deben mantener blobs exactos del checkpoint55138/d1a7. Ningún SQL, helper, dependencia, config, runner o protección de producción se amplía.

## Activación y validación prevista

1. Tras mensaje de arranque del Director, Worker comprueba clean/root/branch/owner, PR DRAFT/remoto/HEADs y preimágenes comunes; realiza únicamente merge Git local normal de **c4b2e72dabbdde80ec7fe5c8a7f128966b6494be** en su rama desde55138. No cherry/copia de WIP, main, force o reset. Si aparece conflicto fuera de README, conserva y eleva diagnóstico; README se regenera con script existente preservando ambas specs. Commit/push propios autorizados al quedar composición concreta y revisable. Puede anotar la adopción/composición en sus propios spec/handoff después del merge; no reescribe spec/handoff0577 heredados. No hace falta una cadena de commits para autocitar sus propios hashes.
2. Entregar SHA de composición y padres, diff exacto55138→composición/cotejo de siete rutas originales y herencia de los dos tests/spec/handoff; producto y tests C3 no cambian. Director revisa inmutable antes de conceder canónica nueva. Los mismos40 casos se validarán en la receta receptora; no repetir por rutina focales C3 intactos ni producir una falsa reproducción histórica.
3. Preparar carpeta exclusiva `0576-c3-next/canonical-3` y wrapper/observador externos nuevos, nunca modificar canonical-1/2. Receta normal `corepack pnpm verify`, sin cambios de gates/timeouts/config/omisión. Solo las dos variables Corepack locales ya autorizadas; sin credenciales/VERIFY*/NODE_OPTIONS. Validar gestor real y conservar avisos. Ninguna canónica histórica nueva en0577, cuya aceptación general se registrará por este SHA receptor y límites.
4. Manifiesto previsto:43fuentes únicas =39anteriores+dos tests heredados+spec0577+handoff0577; README ya estaba. Si otra fuente resulta necesaria se justifica antes de ejecutar. Sello de13primeros originales y32del segundo sobre, más recibos del donante, protegido. ROOT/HEAD/estado/guard/allowlist/huellas/sobre vacío y approvedHead verificados antes del GO final.
5. Único turno pesado del Director; freeze total incluido docs hasta EXIT y bytecheck inmediato de fuentes/HEAD/estado. Conservar originales y resultado fallido si ocurre. E2E original con ancestry/PID exacto sin hooks ni reconstrucción; falta de captura se declara NO DISPONIBLE, no se repite para fabricar evidencia. SQL249/rebuild492 esperados por herencia, pero resultados reales mandan.
6. Tras resultado revisado, anotar spec/handoff/PR y conservar las dos primeras FALLÓ+INCOMPLETO. Una receta posterior aprobada no las borra. Ledger productivo omitido y pruebas omitidas/avisos mantienen límites; no se consulta DB real ni se repite0495.0496y0500 siguen sin aplicar.
7. Cierre documental estable, único ciclo de conocimiento propio con turno, resultados externos/PR, revisión final de respaldo/limpio/claim/recursos. Sin publicación compartida/producción. Solo después de aceptación local final se activa BCV desde ese cierre.

Histórico, superado por la #526: faltaban confirmación de PR DRAFT0577, mensaje de arranque local y nuevo GO canónico sobre composición/receta inmutables. El permiso de composición no inicia ni aprueba por anticipado la canónica. No hay Worker nuevo ni otro propietario de C3. Conocimiento sigue esperando cierre documental estable; sin nuevos focales/UI/SQL por rutina antes del checkpoint de composición.
