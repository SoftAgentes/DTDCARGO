# Retiro del clip de cinta doortudoor · SDD-0503

Fecha: 2026-10-07 · Owner: retirar-video-cinta-doortudoor-20261007.
Sesión: subagente Worker /root/retirar_video_cinta asignado por Director.
Estado: lista-para-revision en PR draft; validación parcial.
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/retirar-video-cinta-doortudoor-20261007.
Rama: codex/retirar-video-cinta-doortudoor-20261007.
Base: ae198419fea5d94d95fc26721952a7be6f7edee9, merge PR191.
SDD reutilizada: docs/specs/0503-carrusel-fotos-empresa/spec.md, in-progress hasta revisión del ajuste.

## OBJETIVO ORIGINAL

Sam pidió retirar de la home el clip de cinta que dice doortudoor y precisó «cointa dice doortudoor no dtd cargo». Se retira la entrada /videos/cinta-embalaje-doortudoor-dtd-cargo-puerta-a-puerta-china-venezuela y su caption «Cinta de DTD Cargo en cada bulto». Se conservan archivos multimedia, video principal, su VideoObject, Shipping Mark y las ocho fotos/controles.

## Contrato de ejecución

Una sesión escritora con guard/claim, rama/worktree propios. Autorizados implementación, pruebas, commits, publicación de la rama a sí misma y PR base main. No merge ni deploy; Director revisa e integra/publica bajo la autorización de Sam «avanza a publicar». No hay permiso para leer filas o escribir DB, aplicar migraciones ni copiar secretos.

Allowlist exacta: components/OperationGallery.tsx; e2e/company-photo-carousel.spec.ts; docs/specs/0503-carrusel-fotos-empresa/spec.md; docs/specs/0503-carrusel-fotos-empresa/qa.md; docs/marketing/README.md; docs/specs/README.md solo generado; este handoff. docs:index no cambió el índice existente.

Dependencia original integrada/publicada: PR191, merge ae198419fea5d94d95fc26721952a7be6f7edee9; deployment dpl_31PymZTALo4DzHMsofaKVPjazmWQ READY confirmado por Director. Su excepción original no equivale a pnpm verify totalmente aprobado. Se corrigió el estado documental afectado sin reescribir el snapshot histórico.

## COMPLETADO

- Retirada la entrada de cinta de CLIPS y su aparición/leyenda; un solo clip vertical en contenedor max-w-[300px] aprobado por Director.
- Video principal, VideoObject y Shipping Mark intactos. CompanyPhotoCarousel/LazyVideo/fotos/archivos multimedia/app/page/globals/lockfile conservados.
- E2E existente actualizado a dos videos y ausencia del clip retirado: comportamiento DOM, fuentes y posters reales; layout 390/1440 sin segunda columna ni overflow.
- Spec/QA/marketing actualizados con la decisión de Sam, estado real de PR191 y límites de esta entrega.

## VALIDACIÓN

Evidencia local ignorada: outputs/retirar-video-cinta-0503/.

| Comprobación | Resultado | Límite |
|---|---|---|
| pnpm install --frozen-lockfile | PASÓ | Sin lockfile ni secretos copiados. |
| Componente CompanyPhotoCarousel | PASÓ | 5/5, component.log. |
| Chromium propio | PASÓ | 4/4 con retries=0; recorrido de ocho fotos, controles/foco/teclado/swipe/SSR/reduced-motion, videos y layout. |
| Chrome móvil propio | COBERTURA PARCIAL | Test manual PASÓ; siguientes workers no ejecutados por spawn EINVAL. |
| WebKit móvil propio (mobile-safari) | NO DISPONIBLE | Spawn EINVAL antes de aserciones; no retries. |
| Capturas 390/1440 y /ui-check | PASÓ | home/operation/gallery/gallery-portrait; lectura visual, columna de 300 px y overflow medidos. Sin hallazgos altos/medios propios del retiro. |
| pnpm verify | FALLÓ | Harness 201/201, lint 0 errores/15 warnings, RSC, typecheck y Edge 4/4 PASÓ; Vitest exits 1073807364/3221226091 y nueve checks/build con exit señal null. Log íntegro conservado. |
| E2E GENERAL | NO EJECUTADO | VERIFY_SKIP_E2E=1 autorizado expresamente por Director; omisión visible. |
| Ledger / SQL / schema-rebuild | NO DISPONIBLE | Fallo de lanzamiento de procesos; sin medición DB ni uso de producción. |
| Build adicional Webpack | NO EJECUTADO | No hubo diagnóstico next/font Turbopack en la corrida canónica; CI exacto head pendiente. |
| docs:check / sdd:check independientes | PASÓ | Tras fallo de ejecución, comprobaciones directamente afectadas repetidas; 489 specs, sin nuevas colisiones. |
| git diff --check / preservación / allowlist | PASÓ | Solo las seis rutas permitidas, sin cambios multimedia ni configuración. |

Diagnóstico acotado: dev propio arrancó tras timeouts de Google Fonts. Luego Playwright informó Error: spawn EINVAL en WorkerHost.startRunner y verify dejó exits/señal null sin stdout de checks. Evidencia de fallo de ejecución, causa raíz no confirmada; no prueba de regresión funcional. CI del exacto head y pruebas móviles pendientes. No se modificó configuración ni se debilitaron aserciones.

## COMMITS

Commit coherente que contiene este documento junto a código, E2E, SDD/QA/marketing. Hash final disponible en la PR; el último commit incluye código para activar ignoreCommand.

## PR / BRANCH

Publicación autorizada de codex/retirar-video-cinta-doortudoor-20261007 a sí misma; PR draft base main. URL/head se registran en la descripción de PR y cierre al Director, sin commit recursivo. Integración/deployment del retiro pendientes y no ejecutados por Worker.

## PENDIENTES DE ESTA TAREA

CI/build sobre el head exacto, completar batería propia de móviles sin retries, revisión Director e integración/publicación/smoke público. Aplicar recibo de marketing y cerrar derivados locales/integrados según runbook.

## FUERA DE ALCANCE DETECTADO

Warnings generales de lint existentes, advertencia LCP de next/image existente, dos fuentes legales con extracción AST parcial y fallos de lanzamiento de procesos Windows. No se absorben bugs de otros módulos ni se modifica config para ocultarlos.

## HANDOFF AL DIRECTOR

Revisar diff/allowlist/SDD y head/base actuales junto a CI alojada, evaluar límites y completar pruebas móviles antes de integración/publicación. Sin cambios compartidos de API/DB ni migraciones. Única sesión consumidora conocida de este worktree: Worker de esta tarea; conservar rama/worktree.

Impacto documental guardado en SDD/QA/marketing/handoff. Graphify 0.9.61 alcanzó AST 4424/4424 pero no hay recibo/exportación final confirmado; no se declara CURRENT. Revisión semántica de marketing completa, 249 líneas sin YAML, hash 3eca29e71fbe8a7fb0a1893bdb284f7e062c229cf458d363cce2c97531092a7f; fragmento preserva 33 nodos/33 relaciones/1 hiperarista y modifica solo nodo/referencia carrusel. graphify-out/retirar-cinta-0503-marketing.json y .review.json preparados; actualizar HEAD de revisión y aplicar tras commit. Conteo de tokens del subagente no disponible, no se inventa costo.

Archify 2.16.0 y preview Obsidian pendientes; bóveda habitual no publicada. Director coordina cierre integrado. Claim revalidado antes de commit y se libera al concluir la escritura; el resultado de release se confirma en el cierre/PR.
