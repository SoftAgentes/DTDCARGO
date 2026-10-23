# Cierre estático 0579–0581 y paquete de publicación separado

Fecha: 2026-10-23 (America/Caracas). Director/sesión: /root.
Rama de coordinación propia: codex/plan-mejoras-web-20261023, partida de 3e32ef082c1d9a88858aa0f15739234bcc57cdba.
Claim de coordinación reutilizado: director-ads-traza-real-20261023. Los owners Worker originales se conservan; no se reclama ni edita ninguno de sus árboles.

## Dictamen y frontera

Las tres correcciones están terminadas para revisión técnica local de sus alcances exactos. Ninguna tiene aprobación de aptitud para producción ni un canónico completamente verde. La traza posterior del tag real permanece INCONCLUSA / NO DISPONIBLE; no es una corrección CSP, no se presenta como PR de producto ni bloquea revisar la corrección aislada de cookie.

Se recibió un encargo de cierre estático/revisable: leer evidencia existente, conservar los resultados originales y separar la propuesta de publicación. No se lanzaron Writers, chats, modelos, tests, builds, UI, conocimiento, diagnósticos de red Ads o acceso a cuentas. Este checklist es el único cambio rastreado de esta revisión. Los handoffs de Workers y de otros Directores no se modifican. No se publica, integra, despliega, archiva o elimina ninguna entrega.

## Checklist observado ahora

- [x] Main y origin/main comprobados tras fetch origin --no-prune: d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8.
- [x] Tres worktrees limpios, en sus ramas originales y con archivos claim ausentes.
- [x] Owners e identidad de tarea originales preservados.
- [x] Allowlist/diff real: 0579 dieciséis archivos, 0580 diecisiete, 0581 quince; diff --check del rango base..HEAD exit 0 en los tres.
- [x] Ancestro común y base de los tres: d410ab2e2. Detrás/delante de esa base: 0579 0/3 commits; 0580 0/4; 0581 0/4.
- [x] Consultas GitHub por rama exacta, todos los estados: cero PR para cada una. ls-remote de los tres heads: cero ramas remotas. No tienen upstream.
- [x] Resultados PASÓ/FALLÓ/NO EJECUTADO históricos reconstruidos desde handoffs finales, sin repetir comandos de prueba.
- [x] Correcciones listas para revisión diferenciadas del diagnóstico inconcluso.
- [ ] Publicación de ramas y creación de PR: SIN AUTORIZACIÓN en esta revisión; paquete propuesto abajo.
- [ ] CI de PR sobre los SHA finales: NO EJECUTADO; no existe PR.
- [ ] Integración/combinación de las tres ramas y validación conjunta: NO EJECUTADO.
- [ ] Aptitud para producción, merge y release: NO APROBADOS.

Main conserva exactamente sus dos untracked preexistentes: .pnpm-store y el PDF DPA, cuyo contenido no se abrió. No se limpian ni integran worktrees sin respaldo remoto.

## 0579 — promesas de seguimiento

Owner original: worker-0579-promesas-seguimiento.
WT: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0579-promesas-seguimiento-web-kommo
Rama: codex/0579-promesas-seguimiento-web-kommo
Producto/UI probados y revisados: 206728c5a4eca131a6240a67144be3749039b4fc.
HEAD final: d069b5b26df962b25f6476bfd7c3c626c4764be2.

Cinco respuestas FAQ siguen el interruptor existente, todavía true; describen seguimiento en construcción y consulta por WhatsApp. False recupera los literales previos. Cuatro cláusulas KB, fuente de infografía y una descripción factual de privacidad alineadas. No se activa seguimiento ni se implementa notificación. Fuente Kommo preparada localmente / subida NO EJECUTADA; no se generaron sus entregables derivados DOCX/infografía.

Entre 206728 y el HEAD final cambiaron handoff, QA, spec/índice y los dos auxiliares de ensayo. El código de producto y capturas permanecen; los auxiliares tuvieron sus rechecks focales. No se presenta el final como un nuevo canónico global probado.

Validación histórica:
- PASÓ: 41 focales; UI/JSON-LD de /faq, /shipping-mark, /puerta-a-puerta y privacidad; tres capturas revisadas; build completo/postbuild; lint/RSC/tipos y gates documentales.
- FALLÓ / INCOMPLETO: canónico, 12/17 pasos; harness original 216/237, 21 fallos por el guard propio; suite original 12.284 pasaron / cuatro fallaron / una omitida, 859 archivos pasaron / dos fallaron / uno omitido.
- PASÓ después, sin repetir canónico: numeración 21/21, actions 17/17, puertos 12/12 y watchdog 15/15; controles negativos y contratos promisify conservados.
- NO EJECUTADO: Edge, ledger productivo, SQL, schema y E2E global; corpus comercial ausente. Ningún acceso productivo o Kommo.

Pendiente de implementación dentro del alcance P1 local: ninguno según aceptación final. Para una declaración de release faltan la revisión del canónico incompleto, cobertura aplicable/CI y decisión de integración. Subir la KB a Kommo es otra operación, no requisito para revisar el cambio web ni algo ya entregado en la cuenta. Textos históricos newsletter/alta de cuentas quedan fuera de alcance.

Conocimiento observado, sin ejecutar nada ahora: estructura/semántica pendientes; fragmento de marketing preparado no importado por estructura pendiente; Archify pasó sobre 206728; preview cancelada SOURCE_CHANGED. No hay certificación del HEAD final ni publicación de bóveda.

Allowlist real completa (16):
```text
.agents/handoffs/0579-promesas-seguimiento-web-kommo.md
app/__tests__/faq-seguimiento-coherente.test.tsx
app/privacidad/page.tsx
docs/marketing/README.md
docs/marketing/seo.md
docs/marketing/servicios-infografias/prealerta-compra.md
docs/specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md
docs/specs/0579-promesas-seguimiento-web-kommo/assets/01-faq-local.png
docs/specs/0579-promesas-seguimiento-web-kommo/assets/02-shipping-mark-local.png
docs/specs/0579-promesas-seguimiento-web-kommo/assets/03-privacidad-local.png
docs/specs/0579-promesas-seguimiento-web-kommo/assets/local-ui-check.mjs
docs/specs/0579-promesas-seguimiento-web-kommo/assets/offline-network-guard.cjs
docs/specs/0579-promesas-seguimiento-web-kommo/qa.md
docs/specs/0579-promesas-seguimiento-web-kommo/spec.md
docs/specs/README.md
lib/faqs.ts
```

Fuentes: .agents/handoffs/0579-promesas-seguimiento-web-kommo.md y docs/specs/0579-promesas-seguimiento-web-kommo/qa.md, dentro del WT indicado.

## 0580 — CTA Shipping Mark móvil

Owner original: worker-0580-cta-movil.
WT: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0580-shipping-mark-cta-movil
Rama: codex/0580-shipping-mark-cta-movil
Producto, pruebas y assets probados/revisados: b7b283107f2f5cfe44a7c55efc8cc75675ac7b03.
HEAD final: c2a933aac5ad8bc6ce3b8d78688e2dcaae9dc780.
Intermedio documental observado: 94bcaaa413d2ea1535fbfa53b8e3407d13b94239.
Entre b7b283 y el final solo cambia el handoff.

El CTA crece con el contenido, el hero móvil usa mínimo cero y el vecino Cotizar puede crecer al envolver texto ampliado conservando su tamaño normal. Etiqueta, tachado, tipografía, colores y /registro conservados; sin editar la clase .btn global ni app/page.tsx.

Validación histórica:
- PASÓ: 26 escenarios geométricos / 52 CTA Chromium-WebKit, nueve anchos y cuatro ampliaciones por motor; seis recorridos adicionales, foco/nombre/área táctil/Enter/tap.
- E2E inicial 47/48: un timeout Chromium en compilación fría, preservado; recheck afectado PASÓ 10/10. No se transforma en una corrida global 48/48.
- FALLÓ / INCOMPLETO: canónico 12/17, harness 236/237 por fixture Git bare bloqueada; recheck focal del auxiliar PASÓ 10/10 y nueve sondas negativas denegadas. No se repitió gate general.
- PASÓ: Vitest general 12.278 pruebas / 860 archivos, una prueba/archivo omitidos; lint/RSC/tipos/gates documentales y build de release.
- NO EJECUTADO: Edge, ledger productivo, SQL, schema y E2E global; dispositivos físicos y zoom nativo no probados.

Pendiente de implementación del recorte exacto: ninguno según aceptación. Reflow global al 200 % por títulos/estadísticas y cruces del FAB WhatsApp durante scroll permanecen fuera del recorte; no se afirma móvil/accesibilidad global resueltos. Para release faltan revisión de cobertura canónica/CI y combinación autorizada.

Conocimiento observado sobre 94bcaaa, sin refresco ahora: estructura PENDING por handoff, semántica PENDING piloto 0/16/global 0/1325, Archify CURRENT y Obsidian PREVIEW (1324 documentos/43 warnings/0 conflictos). Cierre documental posterior no certificado por esos recibos.

Allowlist real completa (17):
```text
.agents/handoffs/0580-shipping-mark-cta-movil.md
app/globals.css
components/ShippingMarkCta.tsx
docs/marketing/README.md
docs/specs/0580-shipping-mark-cta-movil/assets/01-antes-hero.png
docs/specs/0580-shipping-mark-cta-movil/assets/02-antes-cierre.png
docs/specs/0580-shipping-mark-cta-movil/assets/03-despues-hero.png
docs/specs/0580-shipping-mark-cta-movil/assets/04-despues-cierre.png
docs/specs/0580-shipping-mark-cta-movil/assets/05-texto-200.png
docs/specs/0580-shipping-mark-cta-movil/assets/06-escritorio.png
docs/specs/0580-shipping-mark-cta-movil/assets/local-ui-check.mjs
docs/specs/0580-shipping-mark-cta-movil/assets/offline-network-guard.cjs
docs/specs/0580-shipping-mark-cta-movil/assets/playwright.local.config.ts
docs/specs/0580-shipping-mark-cta-movil/qa.md
docs/specs/0580-shipping-mark-cta-movil/spec.md
docs/specs/README.md
e2e/sin-scroll-horizontal.spec.ts
```

Fuentes: .agents/handoffs/0580-shipping-mark-cta-movil.md y docs/specs/0580-shipping-mark-cta-movil/qa.md, dentro del WT indicado.

## 0581 — consentimiento y diagnóstico de medición Ads

Owner original: worker-0581-ads.
WT: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0581-medicion-ads-csp-offline
Rama: codex/0581-medicion-ads-csp-offline
Corrección de producto y pruebas ejecutadas: c5a4f253aca4554ed43174fffd9667b3eef8d7e2.
Ajuste de descubrimiento aceptado: bfc36c37b8e42024043c19859718a8cd424963a3.
HEAD final: 6e3bbfbe560e97ec216d43788062b490c3cd6bd1.
Entre bfc y el final solo cambian spec, índice generado, QA y handoff. El rename E2E es R100: mismo cuerpo que pasó 32/32.

Única corrección de producto: lectura exacta de nombre/valor de cookie, compartida por init y helper; cookies ajenas, valores parciales o duplicados no conceden señales al iniciar. No elimina cookies de otros paths/domains. Conserva IDs, modelo, valores/eventos y exclusiones. next.config.ts y CSP intactos; no hay corrección de atribución/ROAS demostrada.

Validación histórica:
- PASÓ: 267 focales; E2E Chromium/WebKit recheck completo 32/32, sin retry/skip; descubrimiento final general cero propios / configuración aislada 32 con contenido idéntico.
- PASÓ: suite general 12.294 pruebas / 861 archivos, una prueba/archivo de corpus omitidos; harness 237/237; build/postbuild. Build GAoff retenido con 218 chunks, cero IDs; fixture activa usa loader inerte.
- FALLÓ / INCOMPLETO: primer canónico por lint recorriendo derivados propios; recibo preservado. E2E previo 16/32 por sonda Chromium, corregida y recheckeada.
- Segundo canónico: 12/17 pasos medidos PASÓ; CIERRE INCOMPLETO por cinco SKIPs. Wrapper posterior FALLÓ exit 1 por tres denegaciones Git genéricas; raw preservado. Reproducción focal posterior PASÓ 36/36, mantiene denegaciones y no reescribe el raw.
- NO EJECUTADO: Edge, ledger productivo, SQL, schema, E2E global y cuentas Google; no prueba recepción ni atribución real.

Pendiente de la corrección aislada de cookie: ninguno según aceptación. El canónico incompleto/CI y la combinación siguen pendientes para release. La traza de pagead2 NO bloquea revisar este arreglo de consentimiento, pero sí impide declarar validada toda la medición Ads/CSP. Valor fijo de WhatsApp 1 USD es nominal, no ingresos probados. Cookies duplicadas persistentes requieren revisión independiente.

Conocimiento observado sobre bfc, sin refresco ahora: estructura CURRENT/0 issues, semántica PENDING piloto 1/16/global 1/1325, Archify CURRENT y Obsidian PREVIEW. Cuatro documentos posteriores dejan revisiones/hashes pendientes. No publicación compartida.

Allowlist real completa (15):
```text
.agents/handoffs/0581-medicion-ads-csp-offline.md
components/Analytics.consent-cookie.test.tsx
components/Analytics.tsx
docs/marketing/README.md
docs/marketing/diagnostico-medicion-ads-2026-10-23.md
docs/qa/0581-medicion-ads-csp-offline.md
docs/specs/0581-medicion-ads-csp-offline/assets/fixture-app.mjs
docs/specs/0581-medicion-ads-csp-offline/assets/local-ads-check.mjs
docs/specs/0581-medicion-ads-csp-offline/assets/offline-network-guard.cjs
docs/specs/0581-medicion-ads-csp-offline/spec.md
docs/specs/README.md
e2e/analytics-csp-offline.offline.ts
lib/cookie-consent.ts
lib/runtime/__tests__/next-config.test.ts
playwright.analytics-csp-offline.config.ts
```

Fuentes: .agents/handoffs/0581-medicion-ads-csp-offline.md, docs/qa/0581-medicion-ads-csp-offline.md y docs/marketing/diagnostico-medicion-ads-2026-10-23.md, dentro del WT indicado.

## Traza real posterior: diagnóstico inconcluso, separado

Acta de esta misma sesión: .agents/handoffs/director-ads-traza-real-20261023.md, commit 3e32ef082c1d9a88858aa0f15739234bcc57cdba en la rama de coordinación, no en 0581.
Tres contextos HTTP 200; comandos preparados pero cero scripts reales descargados/runtime ausente. Bootstrap falla por conectividad del entorno. Cero intentos a pagead2 NO demuestra ausencia de uso. La CSP no se amplía por ese resultado. No se repitió diagnóstico/red/cuentas en este cierre. No se propone PR de CSP ni se mezcla el auxiliar temporal de captura con producto.

## Compatibilidad y límites estáticos

Los tres heads parten exactamente de main d410ab2e2, sin commits ajenos de las otras dos entregas. Helpers copiados de fuentes commitidas 0579→0580→0581 son autónomos, sin dependencia runtime entre worktrees. No requieren integrar el producto anterior para revisarse individualmente.

Para cada par 0579/0580, 0579/0581 y 0580/0581, las únicas rutas de diff compartidas son:
- docs/marketing/README.md.
- docs/specs/README.md.

Las rutas de producto no se solapan: FAQ/privacidad frente a CSS/CTA frente a Analytics/consentimiento. Esto indica separación estática del cambio, no prueba de compatibilidad de ejecución. No se realizó merge, merge-tree, rebase, checkout de otra rama ni validación combinada. Integración futura debe reconciliar las tres notas de marketing y regenerar índice desde las specs combinadas; no escoger un README completo de una rama perdiendo las demás. No se reenumeran SDD ni se toman sus huecos como reservas libres.

## Paquete de publicación propuesto — NO EJECUTADO

Tres PR independientes de las ramas originales, inicialmente draft, base main y head exacto indicado. No se publica la rama de coordinación como si contuviera las tres implementaciones. No se cambian owners ni autoría. Recomendación de revisión: 0579 → 0580 → 0581 conforme a prioridad original; integración posterior serializada y con base/head revalidados.

1. 0579 — título propuesto: fix(web): alinear las promesas de seguimiento con el estado disponible (SDD-0579)

   Cuerpo propuesto: Las FAQ y fuentes locales prometían seguimiento por Portal mientras la capacidad está en construcción. Las cinco respuestas ahora siguen la bandera existente y remiten al equipo por WhatsApp; KB, fuente de infografía y descripción factual de privacidad quedan alineadas. La bandera conserva true y false restaura los textos previos. Fuente Kommo solo preparada localmente. Validación: 41 focales, UI/JSON-LD y build PASÓ; canónico FALLÓ/INCOMPLETO (12/17), originales y rechecks focales conservados. Sin aprobación de release. Head: d069b5b26df962b25f6476bfd7c3c626c4764be2.

2. 0580 — título propuesto: fix(web): contener el texto del CTA Shipping Mark en móvil (SDD-0580)

   Cuerpo propuesto: La caja fija de 48 px dejaba salir el texto de Shipping Mark. El botón crece con el contenido y el hero permite envolver texto ampliado, conservando etiqueta, estilo y destino. Validación: 26 escenarios/52 CTA en Chromium-WebKit y activación Enter/tap; E2E inicial 47/48 y recheck afectado 10/10; Vitest 12.278 y build PASÓ. Canónico FALLÓ/INCOMPLETO (12/17); no declara móvil/accesibilidad global resueltos ni aprueba release. Head: c2a933aac5ad8bc6ce3b8d78688e2dcaae9dc780.

3. 0581 — título propuesto: fix(analytics): exigir una cookie de consentimiento exacta y no ambigua (SDD-0581)

   Cuerpo propuesto: Una cookie ajena o un valor parcial podía conceder consentimiento durante la inicialización. Init y helper ahora exigen nombre/valor completos y una sola cookie visible; duplicados arrancan denied. IDs, conversiones, exclusiones y CSP se conservan. Validación: 267 focales, 32/32 E2E inertes, 12.294 pruebas generales y build PASÓ; canónico 12/17 PASÓ con cierre INCOMPLETO; wrapper exit 1 y reproducción focal 36/36 preservados. Descubrimiento offline aislado por rename idéntico. No acredita recepción/atribución ni uso real de pagead2. Head: 6e3bbfbe560e97ec216d43788062b490c3cd6bd1.

Condiciones anteriores a publicar:
- Autorización explícita de push de las tres ramas y creación de sus PR draft, incluidos los checks automáticos de PR que eso inicia.
- Revalidar HEAD/base y que los worktrees sigan limpios; si hay cambios, revisar nuevo SHA.
- Conservar resultados canónicos incompletos en las PR, sin convertir rechecks focales en verde global.
- Revisar cualquier automatización externa de previews antes de prometer que publicar una rama no tiene efectos adicionales.

Por lectura estática actual: quality.yml se activa en pull_request hacia main y push main; build-image.yml publica imagen en push main; publicable.yml puede promover tras workflows main aprobados, y el código documenta un timer servidor consumidor de publicable. No se consultó el estado efectivo del timer, variables de congelación ni configuración externa. Por tanto el merge conserva frontera de autorización productiva; abrir PR no es permiso de merge/deploy. No se disparó ningún workflow en este cierre.

## Siguiente acción mínima y entrega

Paquete estático terminado: revisar cada diff exacto y sus límites, autorizar o rechazar publicación como operación separada. No hay corrección nueva autorizada en este cierre ni se necesita repetir la traza de red para abrir revisión del parche de cookie. El encargo no queda bloqueado por trabajo ajeno; aptitud productiva permanece NO DETERMINADA con las evidencias actuales.

Guardar este único checklist en commit selectivo de coordinación, verificar limpieza y liberar el mismo claim de coordinación. No tocar archivos de otros Directores ni ramas Worker; conservar todo sin push, merge, despliegue o limpieza. El SHA del commit que contiene este documento se informa al entregar, sin recursión por su propio hash.
