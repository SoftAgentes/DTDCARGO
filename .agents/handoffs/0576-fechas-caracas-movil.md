# Handoff Worker · SDD-0576 C3 · gastos móviles

Fecha de adopción: 2026-10-21. Estado: primera receta canónica FALLÓ y CIERRE ADEMÁS INCOMPLETO; fixture TZ corregida y checkpoint siguiente para revisión del Director.
Task ID: 0576-fechas-caracas-movil.
Sesión escritora: /root/worker_0576_c3.
Owner: worker-0576c3-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0576-fechas-caracas-movil.
Rama: codex/sdd-0576-fechas-caracas-movil.
Base de implementación y PR: 0e630ede760dbc369ddf60133c18c4a77f2d8692.
Base de PR asignada: codex/sdd-0576-fechas-caracas-anuales (PR313).
SDD reutilizada: docs/specs/0576-fechas-caracas/spec.md, in-progress.

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

## VALIDACIÓN

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
- NO EJECUTADO: segunda receta canónica (requiere nuevo GO sobre checkpoint inmutable), DB/SQL vivo, producción, teléfono/Auth reales, lector de pantalla y zoom nativo200%. El layout fuente limita maximumScale1/userScalablefalse; CSSzoom no sustituye esa medición.
- Lecturas confirmadas en base: actions9f10b23265c8273e9a2f543ac04092d1c7beea86; MobileTSX684e417cc504e77fdacb0c372eb43221913c1530; helperCaracas00af1518045806694794defd7b4154d3ba5b0913; spec0754922bade809ba9f019fd8c3e89509dbb825a1.

## COMMITS

Checkpoint funcional a732bcb0221ad821c671b0ee18d52ab928da26eb publicado y revisado sobre base0e630. Este delta posterior contiene solo fixture TZ y anotación documental de la primera receta; su SHA inmutable se registra fuera del documento, en recibo de publicación y readback de PR, sin autocitar el SHA del mismo commit.

## PR / BRANCH

PR314 OPEN/DRAFT: https://github.com/SoftAgentes/DTDCARGO/pull/314, apilada sobre la rama/base indicadas arriba y adjunta al chat. Head/base actuales se cotejan en recibo externo/readback de cada checkpoint. Sin permiso de merge o producción.

## PENDIENTES DE ESTA TAREA

Publicar checkpoint exclusivo de fixture/docs para revisión del Director; nuevo GO/turno para segunda receta normal, resultado/bytecheck/cleanup, cierre documental y un único ciclo nativo de conocimiento posterior al commit documental estable. El sobre canónico siguiente usa carpeta nueva y anti-sobrescritura, conservando los primeros originales. El resultado de conocimiento postcommit se guardará en recibo externo y PR; no habrá primer ciclo solo para autocitarlo.

## FUERA DE ALCANCE DETECTADO

Carreras y fallos inciertos entre Storage/documento/posting son0575; no hay reparación histórica, nueva SQL, roles/RLS, moneda/FX, layout/CSS, deuda global de componentes o BCV en este slice. Timeout del Portal en el segundo intento canónico se conserva sin causa demostrada ni reparación autorizada.0495 ya aplicada no se repite. No se consultaron filas reales, secretos o PII. UI heredada: Archivo/ArchivoBlack medido por layout real frente al split operativo Nunito/Sora de la rúbrica; restricción zoom y legibilidad oscura sintética, sin cambio ni excepción por C3.

## HANDOFF AL DIRECTOR

Worker activo con claim propio. Primera receta y bytecheck revisados formalmente por Director; reparación de fixture autorizada y comprobada. El próximo checkpoint conserva producto por bytes y espera revisión/turno/GO explícitos antes de otra receta. Conocimiento integrado, semántica global, publicación compartida y producción conservan sus fronteras.

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
