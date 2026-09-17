# Portal proveedor guiado · SDD-0468 etapa 2

Fecha: 2026-09-16. Estado: lista-para-revision-local; aceptación humana/integración pendiente.
Owner: worker-portal-proveedor-guiado-20260916, asignado por Director.
Worktree: C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\portal-proveedor-guiado-20260916
Rama: codex/portal-proveedor-guiado-20260916
Base: origin/main 30a9f89082ac37e933280e0a4e3240c8ae9288e1
SDD: docs/specs/0468-portal-enlace-proveedor-ux/spec.md (segunda etapa; anterior preservada).

## OBJETIVO ORIGINAL

Rediseñar profesionalmente compartir enlace y llenar Factura + Packing List. Primera entrega: recorrido navegable local con datos ficticios, cuatro pasos, chino por defecto y selector es/en, celular/escritorio; revisión antes de integrar o conectar operaciones reales.

## COMPLETADO

- Compartir: título común en tres superficies, copiar URL en un clic, alternativas chino/WhatsApp, confirmación y fallback accesible.
- Captura: proveedor/contacto/moneda; tarjetas de cajas y productos; archivos; revisión/envío. Resumen desktop, mobile sin tabla horizontal; primer campo visible tras compactar encabezado. Herramientas en desplegable. Fallo de persistencia se mantiene visible fuera del desplegable.
- Modelo conservado: payload/endpoints/cálculos core sin cambios; same/qtyDirect directo, monedas, fechas, draft por token/600ms/8s y cap12. Quitar grupo elimina sus hijos sin reasignarlos. Shipping Mark/referencia protegidos, sanitización de datos personales heredados conservada.
- Idioma UI separado del idioma latino del documento. Conserva campos ingresados. Mensajes de guardado/error reaccionan al idioma. Errores abren paso y enfocan/desplazan al encabezado.
- Excel alternativo conserva formulario y archivos al alternar, sin doble llenado ni importación automática. Recibos parciales/indeterminados no afirman completo; editar selección residual conserva incertidumbre.
- Vista read-only separada e impreso completo siempre montado pero inaccesible como editor. Conserva HS/material, referencia y medidas por caja, todas las filas y precisión de precio unitario (0.004). Impresión sigue contrato y etiquetas existentes.
- Folio/versión/labelsNeedReview tras envío. Corregir conserva datos; restaurar invalida recibo anterior. Mutaciones del documento bloqueadas durante POST. Reglas de almacén reutilizadas exactamente desde WAREHOUSE_RULES.
- Fixture Vite loopback fuera de rutas Next: UI real, funciones de transporte inyectadas y ficticias, backend bloqueado. QR local, escenarios éxito/parcial/red/503; frames375/390 y temas. Baseline de código30a9f por git show. Sin secretos, filas reales ni operaciones productivas.

## VALIDACIÓN

Fuentes de log ignoradas: test-results/provider-*.log.

| Comprobación | Estado | Evidencia/límite |
|---|---|---|
| pnpm verify, primer pase | FALLÓ, corregido posteriormente por gates focales | provider-verify-initial.log: errores lint/tsc por tabIndex duplicado introducido durante QA, ya retirado. 13/17 pasos ejecutados; no se presenta ese pase como verde. |
| Vitest global dentro de verify | PASÓ | 563 archivos, 7327 pruebas. |
| Harness, RSC, edge-functions, docs, numbering, features, componentes, gobernanza | PASÓ | Primer verify; Edge4 entradas compilan. |
| Build dentro de verify | PASÓ | Build de producción completo, sin credenciales. |
| Regresión final focal | PASÓ | provider-focal-final.log: 7 archivos, 82 pruebas; captura, payload, mixed boxes, historial/restaurar, storage, errores/idiomas, precio0.004, carga parcial/residual/recibos inválidos, copiar URL, cálculos/drafts/Excel/print. |
| ESLint global final | PASÓ con advertencias previas | provider-lint-final.log:0errores,11warnings fuera del cambio. |
| Typecheck, RSC, docs y build finales | PASÓ | Sesiones 95158 y 1643 terminaron con exit 0. provider-typecheck-final.log sin errores; provider-rsc-final.log: 1604 módulos sin cruces; docs:check 460 specs; provider-build-final.log: build de producción OK y tsconfig restaurado. |
| migrations-applied | NO EJECUTADO | Sin NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY; no se consulta producción. |
| sql-tests/schema-rebuild | NO EJECUTADO | VERIFY_SKIP_SQL=1, slice frontend sin SQL; no acredita DB. |
| E2E global | NO EJECUTADO | VERIFY_SKIP_E2E=1; no acredita suite ni token productivo. |
| UI-CHECK y navegador local | PASÓ en alcance local | Director revisó cliente→4pasos→confirmación,5c/58uds/132/15kg/2.5m3, recarga, idioma, adjuntos completos/parciales, Excel,503,desktop375/390,claro/oscuro,teclado/foco. |
| Impresión física/PDF paginado, chino humano, WeChat | NO EJECUTADO | Contratos/DOM y window.print simulado no sustituyen esas pruebas. |

Revisión UI independiente con capturas aceptadas:
C:\Users\AKX generator\.codex\visualizations\2026\09\16\01a0ab1b-863a-7322-aaa1-db2025e796cd\packing-list-review\review.md
Comparación10-before-desktop.png/11-after-desktop-products.png;13-after-mobile-375-start.png;07-mobile-390-dark-products.png;08-upload-partial-desktop.png;09-send-503-zh.png. 03/04 no se usan como evidencia final por stitching del capturador.

UI-CHECK: composición nueva basada en plan aprobado; tokens/fuentes existentes; foco visible y targets44; campos16px; sin colores/gradientes nuevos. Revisiones corrigieron acumulación de herramientas en móvil, copy ambiguo tras éxito y errores ocultos. Norte no modificado manualmente. Gobernanza Studio no aplica; no cambian captura/campos personales ni se transmite PII nueva.

## COMMITS

Producto: c584ff1347254f3a0df9e2e8e81fef9df8a9b169 — feat(DTD-0468): guiar factura y packing list del proveedor. Este documento recibe un segundo commit exclusivamente para registrar el cierre verificado; su hash se comunica al Director sin autorreferencia recursiva.

## PR / BRANCH

Rama publicada en `origin/codex/portal-proveedor-guiado-20260916` (sin upstream, como deja el harness).
**PR #129**: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/129 — base `main`.
Preview local en http://127.0.0.1:4316/docs/specs/0468-portal-enlace-proveedor-ux/qa/index.html; reinicio en qa/README.md.

Esta sección decía «Sin PR ni push: no autorizados» y quedó desactualizada cuando el cierre de fase 4
autorizó commit selectivo y PR draft. Corregido el 2026-09-16 al preparar la integración.

### Integración (2026-09-16, sesión Claude)

Sam autorizó explícitamente el merge y, por separado, el despliegue que ese merge dispara.
Verificado antes de integrar: **cada commit de `main` genera un deployment `Production` de
vercel[bot]** — 14 de 14 commits first-parent recientes — y el `ignoreCommand` de `vercel.json`
no saltea este build porque la PR toca 17 archivos bajo `app/`. Merge y publicación son el mismo
acto en este repo; el runbook `codex-engineering.md:189-190` exige que la autorización lo cubra, y
la cubre.

Revisión independiente del diff: **aprobada, sin bloqueantes**. Invariantes verificados: endpoints y
payload de `/p/[token]/packlist` intactos, `computeTotals` sin tocar, cero `.sql`, privacidad del
token conservada, y el caso canónico 5 cajas / 58 uds / USD 132 / 15 kg / 2,5 m³ afirmado en tres
pruebas distintas sin duplicar cajas, peso ni volumen.

Dos hallazgos se resolvieron antes de integrar:

1. **Regresión corregida.** Las etiquetas habían quedado `hidden aria-hidden="true"`, sólo visibles al
   imprimir. El proveedor perdía la forma de cotejar los códigos antes de pegarlos, y en el navegador
   de WeChat —donde `window.print()` suele no existir— se quedaba sin ninguna vía. Se devolvió la
   grilla visible con su encabezado trilingüe. Dos pruebas nuevas lo fijan, y la primera se verificó
   por mutación: volver a ocultar las etiquetas la pone en rojo.
2. **Chino primero, decidido por Sam.** Hoy producción sirve la página bilingüe simultánea (ocho
   bloques con el español al lado del chino); la PR la deja arrancando en chino con selector. Sam lo
   confirmó como la mejora buscada: el proveedor es chino. La revisión del chino por una persona que
   lo lea **sigue NO EJECUTADA** y se conserva como pendiente.

## PENDIENTES DE ESTA TAREA

- Aprobación visual de Sam sobre la preview. Las comprobaciones finales ya terminaron; sólo permanece activo el servidor local de preview.
- Revisión del chino por operación, prueba real WeChat y PDF/impresión física.
- Recorrido real condicionado a autorización y acceso adecuado. El fixture es evidencia local/simulada.
- Publicación de rama/PR, integración y despliegue requieren autorizaciones específicas. No realizados.
- SDD continúa in-progress por estos criterios; no se afirma aceptación total.

## Documentación y conocimiento

Spec0468 fase2 actualizada y fase1 intacta. Fixture reproducible documentado; índice docs comprobado. Graphify0.9.61: extracción local4142fuentes,34121nodos/63674relaciones/2274comunidades. Integridad sin endpointsfaltantes;0missing/deleted/excluded en status. Primera pasada quedó PENDING por9fuentes concurrentes. Semántica local0/16 piloto,0/1077global sin recibos: no copiados de main ni certificación LLM.

Archify2.16.0 buildPASÓ9/9,11fuentes verificadas, calidad0errores/0warnings; check ARCHIFY_STALE_CORPUS tras cambios. PreviewObsidian protegida SOURCE_CHANGED, no publicó mezcla de fuentes. Revisión visibleObsidian NO EJECUTADA. Evidencia ignorada en graphify-out/knowledge-run-receipts/ y graphify-out/knowledge-visual/. Refresco posterior de derivados locales pendiente tras estabilizar SHA/corpus; no bloquea esta primera entrega navegable y no se afirma CURRENT. No se toca bóveda compartida. Capas pendientes son explícitas, no cobertura global.

## FUERA DE ALCANCE DETECTADO

11warnings lint preexistentes en tests de compras/CRM/knowledge-vault; sin cambios para ocultarlos. Graphify advirtió interpretación parcial de dos módulos legales existentes y74selfloops/11destinos virtuales/22JSONdatos excluidos intencionalmente; no se presenta AST como prueba semántica. No se absorbieron correcciones ajenas.

## HANDOFF AL DIRECTOR

Revisar primer entregable local con Sam. Contratos backend intactos; cambios UI concentrados en allowlist. Preview4316 consume este worktree; conservarlo y no limpiar mientras usuario lo revisa. Owner se libera al terminar toda escritura y validación; estado final de claim/commit se comunica. Sin merge/deploy/producción.

## Segundo pase UX autorizado · 2026-09-16

Reapertura por Director en la misma rama desde db621a6637d2ebb71138ab306bd933fcece80ef0, guard OK y claim worker-portal-proveedor-guiado-20260916. Alcance: componentes públicos del proveedor, fixture, pruebas, esta spec/handoff; sin API, schema, DB, cálculo core, datos reales ni producción. Cambios y commits locales autorizados; push/PR/merge/deploy siguen fuera del encargo.

Completado: origen accesible de campos reales/restaurados/editados sin atenuar valores; placeholders zh/es/en sin contaminar review/payload; borrador local/guardado/error visible fuera de herramientas; paso móvil de una fila; Excel compacto; campos48px; acciones secundarias44px; resumen+mark en una tarjeta y disclosure móvil; adjuntos sin duplicación, resumen en revisión y una instancia permanente que conserva File objects. Demo persistente y restablecimiento acotado con pruebas de almacenamiento bloqueado, corrupto y contactos semilla antiguos.

Validación del pase:

| Comprobación | Estado | Evidencia |
|---|---|---|
| Regresión del flujo, upload, fixture y contratos core | PASÓ | provider-ux-p2-regression-final.log: 6 archivos,103 pruebas tras los3P2; pase anterior77 en provider-ux-regression-final.log. |
| Continuidad idioma y File objects | PASÓ | provider-ux-locale-files.log: caso focal posterior; conserva paso4 y mismo File ES→ZH→EN→ES, después upload+Excel. 19 casos excluidos por filtro, no se confunden con cobertura completa. |
| ESLint de rutas cambiadas y QA --no-ignore | PASÓ | provider-ux-p2-lint.log sin errores tras los3P2; verify final confirma0errores y11warnings preexistentes. |
| TypeScript | PASÓ | provider-ux-p2-typecheck-final.log, exit0 tras corregir narrowing del discriminante. |
| Build de producción definitivo | PASÓ | provider-ux-verify-final.log: build de producción OK, tsconfig restaurado, exit0. Se conserva provider-ux-build-final.log del pase anterior. |
| UI navegador Director | PASÓ en alcance revisado | Escritorio,375 y390/oscuro: sin overflow373/373 en375, paso4x46px, inputs48px;5cajas/50uds/USD132; adjuntos3→4→3/Excel e idioma en paso4 preservados. Carga parcial1/2 permanece honesta en paso4.390dark scrollWidth=clientWidth, contraste por tokens comprobado. Capturas del pase en ux-implementation (ruta abajo). |
| pnpm verify diagnóstico antes de los3P2 | PASÓ lo medido; cierre incompleto | provider-ux-verify.log: exit0,13/17pasos y7344pruebas;4SKIPs(migrations-applied/sql-tests/schema-rebuild/E2E). No valida las correcciones posteriores. |
| pnpm verify final tras los3P2 | PASÓ lo medido; cierre incompleto | provider-ux-verify-final.log, sesión12621 exit0:564archivos/7370pruebas;178pruebas harness,lint,RSC,typecheck,4edge-functions,docs,numbering,features,components,governance,pending-migration-symbols y build sin fallos medidos.13/17gates ejecutados.4SKIPs: migrations-applied sin credenciales;SQL/schema-rebuild con VERIFY_SKIP_SQL=1;E2E con VERIFY_SKIP_E2E=1. No acredita DB,release ni E2E; exit0 NO equivale a cierre verde completo. |

Incidentes de desarrollo: Vite puede rehidratar/remontar por HMR y por restauración de tsconfig durante build, perdiendo archivos en memoria. El caso de origen restaurado durante HMR no se reprodujo con fuentes estables. La prueba automatizada de idioma conserva estado; Director repitió con fuentes estables y build terminado: English→简体中文→Español conservó paso4, proveedor/cajas/totales y2archivos seleccionados. PASÓ; el incidente anterior fue recarga de desarrollo, no defecto del flujo. No se atribuye una recarga de desarrollo a persistencia garantizada de File objects.

Continúan pendientes revisión humana de chino, WeChat real, impresión/PDF y aceptación de Sam; sin nueva autorización de integración. Se preserva evidencia del primer pase. El cierre de derivados locales queda registrado abajo, sin publicación compartida.

Evidencia visual del segundo pase: C:\Users\AKX generator\.codex\visualizations\2026\09\16\01a0ab1b-863a-7322-aaa1-db2025e796cd\ux-implementation\. Capturas01-desktop-step1.png,03-mobile-375-step1-clean.png,04-mobile-375-step2.png,05-mobile-375-step3.png,06-mobile-375-step4.png,07-mobile-375-partial-upload.png y08-mobile-390-dark-step1.png.390dark: fondo rgb(11,20,40), texto rgb(242,240,236), placeholders visualmente distinguibles y sin overflow. La04full-page tiene repetición de elementos sticky por stitching; comprobación DOM/viewport y captura directa descartan duplicación real. No se atribuyen capturas del primer pase a este segundo pase.

Conocimiento del segundo pase (recibos ux-pass-*): Graphify0.9.61 update y cluster PASARON;34148nodos/63729aristas/2221comunidades. Archify2.16.0 build/check PASARON9/9 inicialmente. PreviewObsidian local PASÓ, solo graphify-out/obsidian-preview, sin conflictos ni publicación en bóveda compartida. Statusfinal ux-pass-06-knowledge-status.stdout.log ejecutado exit0 pero ok:false: PENDING estructural únicamente por este handoff editado durante cierre; missing/deleted/excluded/graphIssues vacíos. Ese cambio deja Archify ARCHIFY_STALE_CORPUS. Semántica local0/16piloto,0/1078global PENDING; no se copiaron recibos ni se usó LLM. Revisión visible Obsidian NO EJECUTADA. No se repite el ciclo para perseguir la última edición de evidencia.

Revisión UX final: se corrigieron3P2 adicionales antes del commit. Autoguardado por debounce/8s actualiza solo texto visual; región polite separada anuncia guardado/restauración manual y los fallos siguen alert visibles. SupplierUploadStatus conserva error discriminado; paso4 reproduce causa exacta (límite/size/503/429) y solo network/unconfirmed indican recepción incierta. Fixture compara baseline completo de fecha local,USD,es y fila vacía; retira solo draft demo actual intacto para evitar doble etiqueta errónea, preservando historia y datos editados. Director revalidó los3en navegador: intervalo>8s silencioso/manual anunciado,503 coherente en pasos3/4 y reset→autosave vacío→reload sigue ejemplo/borrador local. PASÓ.

Revisión independiente de contratos, solo lectura: sin bloqueadoresP0/P1/P2. Endpoints/helpers base y payload intactos; uploader único con montaje estable; misma selección/File tras pasos,idioma,Excel; impresión legacy permanece montada. No sustituye las pruebas ni revisión humana pendientes.

Cierre de revisión UX: Director y revisión independiente reabierta confirmaron los3P2 resueltos sin bloqueadores. Las fuentes de producto permanecieron estables durante el verify final. El segundo pase se guarda en un commit local selectivo que incluye esta evidencia; SHA comunicado al Director después de crearlo, sin autorreferencia. No hay publicación ni integración.

Conocimiento definitivo tras los3P2 (recibos ux-final-*): update nativo01 dejó1726dangling_edges al omitir clustering; ese INVALID intermedio se conserva en03. Se completó una sola vez el clustering nativo04, sin edición manual de aristas, LLM ni nueva extracción:34151nodos/63735aristas/2288comunidades,exit0. Integridad05 PASÓ:0dangling,0missing,0duplicados exactos;74selfloops previos visibles. Status06 terminó14:27:40: estructura PENDING únicamente por este handoff; graphIssues/missing/deleted/excluded vacíos. Ya no INVALID. Piloto0/16 yglobal0/1078 PENDING;Archify ARCHIFY_STALE_GRAPH y preview local PENDING tras este último grafo. No se repiten map/preview ni se publica en bóveda compartida. Todos los procesos de comprobación y derivados terminaron; permanece solo preview4316,HTTP200. Guard y ownership revalidados, diff-check PASÓ.

## Fase 3 · Paso 2 como líneas de factura · 2026-09-16

Asignación expresa de Sam vía Director sobre HEAD6b1e65e8; guard y nuevo claim worker-portal-proveedor-guiado-20260916 verificados antes de escritura. Una sesión escritora, sin subagentes. Alcance: paso2 y componente extraído, owner solo metadata de restauración UI, fixture, tests, spec/handoff. Cálculo core, endpoints, payload, DB, impresión y producción fuera del cambio. Autorizados implementación/pruebas/commits locales; sin push/PR/merge/deploy. Arquitectura y aceptación documentadas en spec fase3; evidencia final se registra al completar validación.

Completado fase 3:

- PackingListProductsStep separa cajas/medidas y líneas de producto. Un editor activo, nombre/cantidad/precio, detalles secundarios y Guardar producto explícito. Aceptar pliega la fila sin POST; el borrador sigue guardando mientras se escribe. Filas restauradas con nombre aparecen como líneas editables, sin metadata de aceptación en el contrato.
- Lista de factura con nombre dominante, cantidades y precios tabulares; móvil apilado sin tabla horizontal. El líder explica uds./caja × cajas; adicionales same explican cantidad total, sin multiplicación. Cabecera y pie del grupo conservan computeTotals. Plurales y formato por idioma consistentes con resumen, manteniendo precisión del precio unitario.
- Editor montado entre pasos/Excel/idiomas; restaurar historia reinicia solo esa presentación mediante rowsRevision no serializado. Una única instancia del uploader permanece intacta. Quitar base confirma grupo completo; borrar último grupo conserva editor vacío. Enter guarda, foco vuelve a la línea; nombre vacío enfoca error asociado; cancelar eliminación desde editor base vuelve al botón del grupo.
- Fixture incorpora caso guiado de tres productos en Controles de revisión, sin sembrar datos ni reemplazar borradores automáticamente. No cambia endpoints, payload, cálculo core, esquema, impresión, etiquetas ni contratos de idioma/archivos.

| Comprobación fase 3 | Estado | Evidencia y límites |
|---|---|---|
| Regresión focal final | PASÓ | test-results/provider-lines-focal-final.log: 6 archivos, 82 pruebas; 8 casos nuevos de líneas. Guardado explícito, foco/Enter/error, mixed, edición, eliminación, segundo grupo, borradores/idioma/Excel, precisión y payload/print. |
| Lint de rutas y QA | PASÓ | provider-lines-lint-final.log; canonical verify posterior al ajuste de foco confirma lint global sin errores, 11 warnings previos. |
| TypeScript final | PASÓ | provider-lines-verify-final.log; también hubo pase focal anterior provider-lines-typecheck-final.log. |
| Vitest global | PASÓ | provider-lines-verify-final.log: 565 archivos / 7.378 pruebas, 206,67 s. Aviso jsdom de navegación no implementada no produjo fallo. |
| Harness, RSC, Edge, docs, numbering, features, componentes, gobernanza y símbolos de migración | PASÓ | Verify final: 178 pruebas harness, 1.606 módulos RSC, 4 Edge Functions; gates sin fallos. |
| Build de producción | PASÓ | Verify final: compilación, tipos y páginas completos; build OK, tsconfig.json restaurado. |
| pnpm verify canónico | PASÓ lo medido; CIERRE INCOMPLETO | Sesión16573 exit0, 13/17 pasos ejecutados. No equivale a validación integral ni autorización de release. |
| migrations-applied | NO EJECUTADO / SKIP | Sin credenciales Supabase; no se consultó producción. |
| SQL / schema-rebuild | NO EJECUTADO / SKIP | VERIFY_SKIP_SQL=1; slice de presentación sin cambios SQL. |
| E2E global | NO EJECUTADO / SKIP | VERIFY_SKIP_E2E=1; Vitest y CUA local no sustituyen la suite. |
| UI-CHECK y revisión visual interactiva CUA | PASÓ en alcance local | Director comprobó escritorio, 375, 390 oscuro: scrollWidth=clientWidth, cero controles visibles menores de44px; campos48px; editor/guardar/editar/Enter/error/idiomas y fallback de foco. |
| Chino por operación, WeChat real, PDF/impresión física | NO EJECUTADO | Se conservan pendientes humanos de la entrega anterior. |

Evidencia visual fase 3: revisión interactiva CUA del Director, con imágenes emitidas en conversación pero sin after guardado en disco. Baseline existente comprobada: C:\Users\AKX generator\.codex\visualizations\2026\09\16\01a0ab1b-863a-7322-aaa1-db2025e796cd\ux-step2-invoice\01-before-step2-form.png. No se inventan rutas after ni se usan capturas de fase2 como evidencia nueva. Caso CUA: 5 cajas ×10 unidades +8 directas =58 unidades,15kg,2,5m³,USD168,00 tanto en grupo como resumen; sus precios difieren del caso automatizado de USD132,00. La captura comparativa after persistida queda pendiente; preview navegable sigue disponible.

UI-CHECK sobre el diff: tokens y fuentes existentes de /p (Archivo/Noto), acción principal vino, errores con texto/icono, rejilla fluida sin anchos monetarios fijos, foco visible, targets44 e inputs48. Se corrigieron plural y motivo accesible de acciones deshabilitadas. Norte sin edición manual; no cambios a Studio ni nuevos datos personales. Veredicto: OK para commit dentro del alcance local revisado.

Conocimiento fase3: recibos ignorados graphify-out/knowledge-run-receipts/phase3-*. Graphify0.9.61 update y cluster nativos PASARON:34.179nodos/63.806aristas/2.289comunidades; graphIssues/missing/deleted/excluded vacíos. Archify2.16.0 build/check PASARON9/9 (11fuentes). PreviewObsidian local PASÓ published:true, exclusivamente graphify-out/obsidian-preview; sin conflictos, con39avisos previos de enlaces. Status06 exit0,ok:false: PENDING por componente/test del último fallback posterior a extracción y tsconfig temporal del build; éste luego fue restaurado y no aparece en git diff. Archify ARCHIFY_STALE_CORPUS y preview PENDING en esa lectura. Semántica0/16piloto y0/1078global PENDING, sin LLM ni recibos copiados. Este cierre documental posterior también deja corpus pendiente. No se declara CURRENT ni se publica en bóveda compartida; no se prolonga la entrega con ciclos de derivados.

Estado de cierre fase3: todas las validaciones terminadas, sin fallos de producto medidos; guard/claim/diff-check revalidados. Commit local selectivo con SHA comunicado al Director, sin push/PR/merge/deploy. Claim se libera tras commit y confirmación de árbol limpio. Se conserva preview4316 y el worktree para Sam. SDD continúa in-progress por aceptación humana/integración y omisiones documentadas; no se borra evidencia de fases anteriores.

## Fase 4 · Formato estándar y Código de producto · 2026-09-16

Encargo posterior de Sam vía Director; mismo owner worker-portal-proveedor-guiado-20260916, misma rama/worktree, base de esta iteración48c3a9aecf1ee361330a3962422bc3a053eccbbb limpio. Guard y claim adquiridos antes de escribir. Worker único, sin subagentes. Autorizados cambios/pruebas/commits locales; no push/PR/merge/deploy/producción. Se conserva todo trabajo de fases anteriores.

Arquitectura implementada: selector Guiado/Estándar dentro de PackingListGuidedForm; la hoja canónica de PackingListFormSection se pasa como panel siempre montado. Estado, filas, computeTotals, almacenamiento, historial y payload siguen en el owner único. Inactivo oculto semánticamente, sin dos editores accesibles a la vez. Borrador/herramientas/recibo comunes. El uploader continúa en una única posición del árbol, con acceso Fotos y archivos desde la hoja; la alternativa Excel sigue independiente. Impresión selecciona el documento canónico fuera de no-print, incluidos hijos colapsados. Producto/Código aparecen primero en editor y tabla; código también en líneas guardadas. Confirmación de borrado evita hijos huérfanos, se cancela al cambiar de modo y reindexa editor tras mutaciones estructurales.

Norte referenciado sin cambios manuales: docs/design/studio/_norte/packlist/Packing List + Factura · DTD-Cargo.html. La hoja conserva todos sus campos, reglas, totales y dirección; impresión bilingüe usa datos originales independientes del idioma UI. En móvil, tabla estándar desplazable dentro de su región accesible; guiado sigue sin tabla horizontal. Estado/archivos no se duplican ni traducen al alternar.

Validación inicial: lint y tsc de producto pasaron; guiado/líneas/print existentes pasaron. Suite nueva standard-format.test.tsx:6/6 PASÓ (orden y código bidireccional, Files/recibo parcial y cambios de modo, POST/lock/corrección, eliminar base, DOM impreso bilingüe, error503/foco). Una aserción inicial llevaba un punto final ausente del texto real; se corrigió la expectativa sin cambiar el comportamiento. Cierre canónico y revisión CUA pendientes al momento de este registro; se actualizará al terminar.

Reanudación después de pausa explícita de Plan Mode: guard/HEAD/claim revalidados, claim conservado del mismo owner. Director autorizó completar únicamente SDD0468 y ahora publicar rama propia/PR; sin merge/deploy/DB. SDD0473 será Worker separado para importador/persistencia/calculadora; no entra en este diff. Preview4316 comprobada HTTP200, sin reinicio ni borrado de datos.

Ajustes finales fase4: fecha estándar usa input date visible y48px, fuera del impreso; fecha china del papel conserva el mismo valor. QA Director detectó que el legado mostraba sumatorio del grupo en la fila base y además importes por hijo. Se corrigió solo presentación: base50uds/USD100, hijo8uds/USD32 y pie58uds/USD132, sin subtotal implícito en producto base contraído/expandido. calcRow/computeTotals/payload mantienen las mismas reglas. Regresión nueva comprueba exactamente celdas visibles (separadas del duplicado sr-only).

UI-CHECK del diff: tokens existentes, Archivo/Noto actuales de /p, inputs48 y acciones44, selector con aria-pressed, foco explícito al panel/error y cancelación, tabla como región desplazable por teclado. Estados inactivo/sending/error/receipt/empty cubiertos. No hex/fuentes nuevas ni edición del Norte. La hoja estándar retiene tabla completa con scroll contenido; guiado continúa sin scroll horizontal. Advertencia de revisión: no se afirma contraste WCAG medido ni PDF físico; prueba de nombres/códigos largos en tabla depende del scroll, no de truncar valores. Veredicto: OK para commit dentro de lo medido.

QA manual CUA del Director PASÓ en fixture, no producción: dos líneas compactas y5cajas/58uds/15kg/2.5m³/USD132; guiado→estándar→guiado conserva datos, recarga restaura proveedor/contacto/productos;375px scrollWidth=clientWidth375 y controles48px;390oscuro chino legible; Tab desde encabezado enfoca Eliminar grupo con anillo. Revalidación importes estándar50/100 y8/32, pie58/132, expandido/contraído PASÓ. Capturas verificadas en C:\Users\AKX generator\.codex\visualizations\2026\09\16\01a0ab1b-863a-7322-aaa1-db2025e796cd\dtd-0468-review:01-productos-compactos.png,03-guia-movil-375.png,04-guia-movil-390-oscuro.png,05-estandar-corregido.png.02-formato-estandar.png documenta el hallazgo previo, no el resultado final.

Validación focal adicional PASÓ: provider-standard-resume-focal.log2archivos/9pruebas (fecha/print); provider-standard-line-amounts-final.log7pruebas estándar después de la corrección. La nueva aserción falló inicialmente por incluir dos representaciones del número (visual y sr-only); se precisó el selector sin debilitar valor esperado. El gate canónico comenzó antes del ajuste de celdas, que entró durante lint; lint focal posterior sobre owner/test garantiza la revisión de esos bytes. Typecheck/global test/build se ejecutan después del último cambio de producto. No se alteraron fuentes durante esos gates.

Durante el retry de Vitest, Director midió un P2 adicional en encabezados del estándar oscuro: pl-ighead2.63:1. Corrección limitada a @media screen para pl-ighead/pl-sect-t/pl-rules-head: color ink, sin cambiar impreso. Revalidación CUA:11.44:1 para pl-ighead sobre su fondo; captura06-estandar-oscuro-legible.png en el mismo directorio. No es una auditoría WCAG global. Lint final del owner y test dividido pasó (provider-standard-final-style-lint.log); build posterior comprueba CSS final.

Primer pase global:565archivos/7.384pruebas pasaron, un timeout20s en caso compuesto grupos+historia. Se separaron las dos regresiones independientes conservando todos sus asserts, sin modificar configuración/timeout; focal9/9 pasó (provider-standard-groups-split.log). El reintento automático canónico corre con los dos casos. Se preserva la salida fallida, no se presenta como un pase limpio al primer intento.

Conocimiento local fase4: Graphify0.9.61 update+cluster PASÓ34.188nodos/63.827aristas/2.283comunidades; advertencias AST previas en dos archivos legales ajenos al alcance. Archify2.16.0 build/check PASÓ9/9 con11fuentes, estructura/semántica PENDING (cambios posteriores). Preview local falló con SOURCE_CHANGED al detectar las correcciones concurrentes; conservó evidencia phase4-05-preview.log. No se publicó en bóveda compartida. Recibos en graphify-out/knowledge-run-receipts/phase4-*. Estado final se registra al cierre, sin certificar CURRENT.

| Cierre fase4 | Estado | Evidencia |
|---|---|---|
| Focales de flujo/archivos/cálculo/draft/print | PASÓ | provider-standard-focal-final.log7archivos/88pruebas antes de últimos ajustes; después9pruebas fecha/print,7estándar/importes y9líneas/grupos/historial. |
| Lint final de cambios y fixture | PASÓ | provider-standard-final-style-lint.log, provider-standard-line-lint-final.log; fixture explícita --no-ignore en provider-standard-qa-lint-final.log. |
| TypeScript y build finales | PASÓ | provider-standard-verify-final.log; compilación, tipos y prerender completos. tsconfig restaurado. |
| Vitest global final | PASÓ tras reintento | 566archivos/7.386pruebas; registro conserva el timeout inicial y su corrección, sin subir límites. |
| Harness/RSC/Edge/docs/numeración/gobernanza/símbolos | PASÓ |178harness,1.606módulos RSC,4Edge; gates del verify. |
| pnpm verify | PASÓ lo medido; CIERRE INCOMPLETO | Sesión89304 exit0,13/17pasos;4SKIPs explícitos. |
| migrations-applied | NO EJECUTADO / SKIP | Sin credenciales; ningún ledger/filas de producción consultado. |
| SQL/schema-rebuild | NO EJECUTADO / SKIP | VERIFY_SKIP_SQL=1; slice no cambia SQL. |
| E2E global | NO EJECUTADO / SKIP | VERIFY_SKIP_E2E=1; CUA fixture no sustituye E2E real. |
| UI-CHECK/CUA | PASÓ dentro del alcance medido | Desktop375/390oscuro, foco, modos/recarga, importes y contraste puntual; capturas01,03,04,05,06. |
| Chino operativo/WeChat/impresión física-PDF | NO EJECUTADO | Continúan pendientes humanos. |

Estado conocimiento final leído con knowledge-sync status --preview: exit0/ok:false. Estructura PENDING en5fuentes del pase; missing/deleted/excluded y graphIssues vacíos. ArchifyPENDING/STALE_CORPUS, semántica piloto0/16 y global0/1078 PENDING; ObsidianPENDING. Preview intentada falló SOURCE_CHANGED y no se presenta como publicada. Director indicó cerrar esta entrega sin nuevos ciclos de derivados; capa compartida queda para después de integración autorizada. No se editó main ni bóveda compartida.

Cierre producto: commit local selectivo y PR draft autorizados al retomar, con SHA/URL comunicados al Director; no merge/deploy. Sin importador, persistencia documental, migraciones ni calculadora de SDD0473. Preview4316 y worktree conservados. Claim se libera al concluir commit/publicación y verificar árbol limpio. SDD permanece in-progress por aceptación humana, omisiones e integración pendientes.
