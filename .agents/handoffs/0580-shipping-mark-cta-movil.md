# Worker SDD-0580 — Shipping Mark CTA móvil

Fecha: 2026-10-23. Estado: lista-para-revision; derivados pendientes explícitos.
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

Implementación, pruebas y evidencia: `b7b283107f2f5cfe44a7c55efc8cc75675ac7b03`.
Cierre documental: commit que contiene esta versión del handoff. No crear
recursión de commits para guardar su propio hash; Director registrará el SHA
final revisado en su artefacto. Reserva local indicada arriba.

## PR / BRANCH

Sin PR ni respaldo remoto. Rama y worktree conservados. Integración y publicación
pendientes; no están autorizadas por este encargo.

## PENDIENTES DE ESTA TAREA

Producto: ninguno para la aceptación local del recorte, con los límites de QA.
Derivados locales: recibo semántico de README marketing y cobertura piloto/global
permanecen pendientes. Mapa Archify y preview local generados en la revisión
observada indicada abajo. Director autorizó cerrar con las capas pendientes,
sin otra extracción global ni refrescos por el SHA del propio handoff. Integración
y publicación compartida o web no están autorizadas.

### Conocimiento local observado

- Revisión observada: `b7b283107f2f5cfe44a7c55efc8cc75675ac7b03`, antes de este
  cierre documental. Graphify **0.9.61**, 43.774 nodos/79.851 aristas, vista
  agregada de comunidades. El recibo de `knowledge-graph.py record --root .`
  confirmó estructura **CURRENT**, sin pending/drifted/missing/deleted.
- Dos advertencias nativas de parseo parcial en Studio legal, fuera del cambio:
  `app/studio/(app)/legal/_components/LegalClient.tsx` y
  `app/studio/(app)/legal/expediente/[code]/page.tsx`. No se ocultan ni se corrigen.
- Semántica **PENDING**, cero fuentes verificadas/1.325 pendientes en este grafo
  propio. El fragmento del README modificado está preparado en
  `graphify-out/0580-marketing-fragment.json` (cinco conceptos/cuatro relaciones),
  pero **NO APLICADO** y no constituye un recibo semántico.
- Una única pasada local posterior, con fuentes estables en
  `94bcaaa413d2ea1535fbfa53b8e3407d13b94239`, completó los comandos de cierre:
  `node scripts/knowledge-visual.mjs build`, `node scripts/knowledge-visual.mjs check`
  y `node scripts/knowledge-sync.mjs publish --preview`.
- Archify **2.16.0 CURRENT** en esa revisión: paquete local validado por hashes
  del lock, nueve checks aprobados y 11 fuentes. HTML/SVG/evidencia generados;
  no se abrió su interfaz ni se declara revisión visual humana del mapa.
  Recibos: `.codex/qa/knowledge-visual-build.json` y `knowledge-visual-check.json`.
- Obsidian **PREVIEW** local generada, 1.324 documentos y 43 advertencias de
  enlaces históricos; cero conflictos. Recibo `.codex/qa/knowledge-preview.json`.
  Bóveda compartida no publicada ni abierta. La preview lleva sus límites y no
  certifica el piloto ni la cobertura global.
- La lectura única final `node scripts/knowledge-sync.mjs status --preview`
  confirmó sobre `94bcaaa413d2ea1535fbfa53b8e3407d13b94239`: `ok:false`,
  estructura **PENDING** solo por este handoff, semántica **PENDING**, piloto
  **0/16**, global **0/1.325**, Archify **CURRENT**, Obsidian **PREVIEW**.
  Evidencia: `.codex/qa/knowledge-status-final-observed.json`. También se conserva
  `knowledge-record-initial.json` con el estado estructural anterior.
- Este último cierre documental cambia el handoff después de la foto observada.
  Los recibos no certifican el SHA documental posterior. No se repite el grafo,
  el mapa ni la exportación para perseguir el hash del propio handoff.

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
escritora de esta tarea es la indicada arriba. Los procesos UI, browser, servidor,
fixtures y extracción ya terminaron. El claim se libera al guardar este cierre;
su confirmación y el SHA definitivo se entregan al Director por el canal de la
tarea. Conservar rama y worktree, sin respaldo remoto; no eliminar.
