# Worker SDD-0580 — Shipping Mark CTA móvil

Fecha: 2026-10-23. Estado: en-progreso (cierre de derivados locales pendiente).
Owner/sesión: `worker-0580-cta-movil` / subagente `/root/worker_movil`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0580-shipping-mark-cta-movil`.
Rama: `codex/0580-shipping-mark-cta-movil`.
Base integrada: `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`.
Reserva: `dd0ea538b49dfa01f7126a4ef737e7cedb3691b3`.
Spec: `docs/specs/0580-shipping-mark-cta-movil/spec.md`.

## OBJETIVO ORIGINAL

Reproducir y corregir el recorte de los dos CTA Shipping Mark de la home y
probarlo localmente en móvil, ampliación de texto y escritorio. Commits locales
autorizados por Sam; sin push, PR, merge, despliegue, cuentas ni producción.

## COMPLETADO

- Guard y claim propios comprobados antes de editar. Árbol nuevo, separado de
  SDD-0579, sin copiar su implementación ni secretos.
- Reproducción con Archivo real local en Chromium y WebKit. La caja fija de
  48 px dejaba salir texto; no era clipping CSS. Evidencia anterior conservada.
- `ShippingMarkCta` crece con el contenido; etiqueta, tachado ligado, colores
  y destino `/registro` intactos. Sin editar `.btn` global ni la página.
- La pista del hero móvil usa mínimo cero. El vecino Cotizar conserva exactamente
  191,203125×48 px en tamaño normal y crece al envolver texto ampliado. Se corrigió
  la regresión derivada de la pista; no se clasificó como hallazgo ajeno.
- Contrato E2E mide rangos, caja, viewport, nombre accesible, foco, target mínimo,
  destino y activación mediante Enter y tap real. QA contiene matriz y capturas.
- Marketing actualizado con nota mínima; spec e índice actualizados.
- Helpers de ensayo propios, adaptados de fuente commitida SDD-0579 `d069b5b2`.
  Sin dependencia runtime de otro worktree. No hay cambios en cuenta Kommo.

## VALIDACIÓN

Producto y pruebas sobre esta rama, con dependencias offline/frozen-lockfile:
817 paquetes reutilizados, cero descargas. Sin `.env` reales. GA apagado,
APIs Hailuway/Supabase contra fixtures loopback; Node y browser con barreras
de ensayo y controles negativos. No equivalen a una sandbox universal del SO.

| Comprobación | Resultado |
|---|---|
| UI Chromium y WebKit | **PASÓ**: 26 escenarios geométricos/52 CTA, nueve anchos y cuatro ampliaciones por motor; seis recorridos de observación adicionales. |
| Regresión en baseline | **FALLÓ como se esperaba** en 24 escenarios verticales iniciales; contratos horizontales previos pasaron. |
| E2E final inicial | **47/48 PASÓ**, un timeout nuevo de navegación Chromium a 5 s en cold compile. Se conserva ese resultado. |
| E2E recheck afectado | **PASÓ 10/10** tras esperar navegación real con límite 20 s e hidratación antes de ampliar texto. Incluye Enter/tap en ambos CTA/motores. |
| Canónico `node scripts/verify.mjs` | **FALLÓ / INCOMPLETO**, 12/17 pasos medidos: único fallo del guard en fixture Git bare; cinco pasos omitidos. |
| Harness original / recheck | Original **236/237**, recheck focal **10/10**. Guard corregido después; sin repetir gate general. Nueve probes negativos rechazados; red del recheck vacía. |
| Vitest general | **PASÓ**, 860 archivos/12.278 pruebas, un archivo/una prueba omitidos (corpus comercial no disponible). Una pasada, sin retry. |
| Lint, RSC, tipos, docs, numeración, constantes, componentes, gobernanza, símbolos pendientes | **PASÓ**; 15 advertencias lint existentes. |
| Build local de release | **PASÓ**. |
| Edge, ledger productivo, SQL, reconstrucción, E2E global | **NO EJECUTADO**, motivos/SKIPs individuales en QA. Sin accesos productivos. |
| UI-check advisory | **PASÓ en el alcance del recorte**; sin excepciones nuevas de marca. |

Detalle: `docs/specs/0580-shipping-mark-cta-movil/qa.md`; logs y matrices en
`.codex/qa/`. Las seis capturas versionadas son menores de 1 MB cada una.

## COMMITS

Implementación y evidencia: commit que contiene este documento. No crear
recursión de commits para guardar su propio hash; Director registrará el SHA
revisado en su artefacto. Reserva local indicada arriba.

## PR / BRANCH

Sin PR ni respaldo remoto. Rama y worktree conservados. Integración y publicación
pendientes; no están autorizadas por este encargo.

## PENDIENTES DE ESTA TAREA

Cerrar comprobación local de Graphify, recibo semántico de README marketing,
Archify y preview Obsidian. Después, guardar resultados y liberar claim propio.
La aceptación de producto local está satisfecha, con límites de QA explícitos.

## FUERA DE ALCANCE DETECTADO

- Reflow global a texto 200 %: home aún da scrollWidth 480 px a 320/375 px por
  título/estadísticas ajenas; ambos CTA quedan contenidos. No se declara móvil
  completo ni conformidad global de accesibilidad resueltos.
- FAB WhatsApp se cruza geométricamente con controles de home/tarifas al hacer
  scroll. FAQ no mostró cruces en el muestreo. No se accionó ni editó el flotante.
- CJK no mostró cuadrados en los motores locales; no prueba todos los teléfonos.
- Zoom nativo, dispositivos físicos, cuentas, Ads y producción no se probaron.
- Los SKIPs canónicos son límites de esta entrega local; no autorizan release.

## HANDOFF AL DIRECTOR

Revisar SHA final, diff de 17 archivos autorizados, QA y seis capturas. Conservar
las ramas aisladas 0579/0580 sin integrar hasta autorización. No reutilizar los
resultados focales como certificación de un gate general nuevo. La única sesión
escritora de esta tarea es la indicada arriba; claim activo durante el cierre.
Los procesos UI, browser, servidor y fixtures de ensayo ya terminaron. Al liberar
ownership se informará al Director; no eliminar rama ni worktree.
