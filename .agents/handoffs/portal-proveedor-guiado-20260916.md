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

Sin PR ni push: no autorizados. Rama y worktree indicados arriba. Preview activa en http://127.0.0.1:4316/docs/specs/0468-portal-enlace-proveedor-ux/qa/index.html. Reinicio documentado en qa/README.md. No hay respaldo remoto de esta rama.

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
