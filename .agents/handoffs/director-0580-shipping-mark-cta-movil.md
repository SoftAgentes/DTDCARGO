# Director — SDD-0580, recorte del botón Shipping Mark

Fecha: 2026-10-23, America/Caracas.
Dueño: Director de esta conversación.
Estado: entrega local revisada y aceptada con límites de QA explícitos; sin integración ni publicación.

## Encargo y límites

Sam autorizó otro Worker aislado para reproducir y corregir el recorte del botón Shipping Mark, con implementación y pruebas locales. No autoriza push, PR, merge ni despliegue. No se operan cuentas, Ads, Kommo, PII, DB o servicios productivos. La entrega de seguimiento SDD-0579 queda separada y conservada en su rama sin integrar.

El objetivo es permitir que ambos CTA de la home contengan completos sus dos renglones, conservando copy, destino `/registro`, marca, foco, contraste y «Casillero» tachado debajo. La altura fija global frente a contenido apilado es una hipótesis que el Worker debe demostrar con render y medidas antes de editar producto.

## Aislamiento y fuentes de estado

- Principal y origin/main tras fetch sin prune: `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`. Dos untracked preexistentes preservados; no se abrieron ni limpiaron.
- Inventario Director actualizado: GitHub disponible, repositorio `SoftAgentes/DTDCARGO`, 18 PR abiertas incluidas bases distintas de main; ninguna modifica `components/ShippingMarkCta.tsx`, `app/globals.css` o `e2e/sin-scroll-horizontal.spec.ts`. Actividad de sesiones ajenas NO VERIFICADA.
- Reserva local tras 529 refs más worktrees: SDD-0580; branch `codex/sdd-reserve-0580-shipping-mark-cta-movil`; commit `dd0ea538b49dfa01f7126a4ef737e7cedb3691b3`. Avisos históricos de colisiones conservados, sin renumerar ni publicar. La reserva no excluye otras máquinas.
- Worker: `/root/worker_movil`, owner `worker-0580-cta-movil`.
- Rama: `codex/0580-shipping-mark-cta-movil`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0580-shipping-mark-cta-movil`.
- Base integrada: `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`.
- Spec y handoff propios: `docs/specs/0580-shipping-mark-cta-movil/spec.md` y `.agents/handoffs/0580-shipping-mark-cta-movil.md`.
- Coordinación de Director en rama propia `codex/plan-mejoras-web-20261023`, sin editar el árbol del Worker.

Dependencia con 0579: runtime independiente, sin incorporar aquella implementación. Ambas ramas modifican `docs/marketing/README.md` y el índice generado `docs/specs/README.md`; requieren reconciliación documental e índice regenerado al preparar una futura integración conjunta. El índice de 0580 refleja su propia base, por eso no incluye todavía la spec de 0579. No es autorización para fusionar esas ramas ahora.

## Contrato de aceptación asignado

1. Evidencia previa con fuente real cargada, ambos CTA y cajas del control/etiqueta/tachado. Regresión falla sobre baseline antes de la corrección.
2. Ambos CTA completos en 320/360/375/390/414 px, 768/1280 de escritorio y ampliación de texto al 200 %, registrando el método exacto. Sin recorte, solapamiento ni desborde atribuible al CTA.
3. Sin reducir fuente, truncar texto, ocultar overflow global ni imponer un alto por dispositivo. Selector mínimo; preferir componente si las medidas lo justifican.
4. Conservar nombre/destino, Casillero debajo, contraste, foco/teclado y objetivo táctil al menos 44 px. Comparar botones vecinos antes/después.
5. Chromium y WebKit si disponible localmente. WhatsApp y caracteres chinos se comprueban como recorrido; hallazgos ajenos se documentan y no amplían el arreglo.
6. Ensayos cerrados con fixtures loopback, medición apagada, sin `.env` reales, sin enviar formularios/mensajes. Guard servidor/subprocesos más barrera del navegador; controles negativos probados antes del gate. Son controles de ensayo, no sandbox del sistema operativo.
7. UI-check antes de commit; pruebas focales, gate canónico con omisiones explícitas y build. No alterar verificadores ajenos ni perseguir bugs fuera de alcance.
8. Commits selectivos, QA/handoff duraderos, revisión de SHA final, liberación del claim y cierre de procesos propios. Conservar rama/worktree sin publicar.

La allowlist exacta reside en la spec asignada: componente, CSS solo acotado si hace falta, regresión E2E existente, nota marketing, documentación e índice propios, tres auxiliares locales y seis capturas nombradas. Nuevos archivos requieren ampliación concreta por Director. No se incluyen app/page, nav, footer, registro, WhatsApp, fuentes CJK, Ads/CSP, APIs ni producto de 0579.

## Conocimiento al inicio

Estado principal observado mediante Node directo equivalente a knowledge:status: ok true, estructura CURRENT, semántica PENDING, Archify CURRENT, archivos Obsidian CURRENT. No se publicó ni abrió Obsidian desde esta sesión. El Worker registra las capas de su propia rama y sus límites, con fuentes finales estables antes de intentar una preview.

## Revisión final

Reproducción previa inspeccionada por Director: ambas capturas a 375 px muestran etiqueta/tachado fuera de la caja. Worker midió Chromium y WebKit, 16 escenarios/32 CTA. Caja fija de 48 px frente a altura requerida 83,17 px en hero y 81,17 px en cierre; overflow visible, no clipping CSS. La ausencia de scroll horizontal normal no detectaba este fallo.

Primera corrección de altura intrínseca del componente: capturas normales de ambos CTA y escritorio legibles, revisadas por Director. Revisión de imagen de texto al 200 % detectó control fuera del viewport aunque el texto quedaba dentro del control. Director leyó `fixed-results.json`: hero a 320/375 px terminaba en x 473,92 y documento de ancho 480 px. No se aceptó esa matriz como resultado final; se pidió conservarla como evidencia intermedia y reforzar el runner con viewportInside.

Atribución posterior Worker: pista móvil `1fr` de `.hero-grid` crece a 441,92 px por mínimo automático. Ensayo de la única regla móvil `minmax(0, 1fr)` contiene pista/CTA a 256 px y borde derecho 288 en viewport 320. Director aceptó ese ajuste mínimo dentro de la allowlist de CSS/home. Cualquier desborde restante del heading ampliado se registra aparte, sin rediseñarlo, reducir fuentes ni ocultar overflow.

La revisión visual al 200 % detectó además el texto del vecino Cotizar fuera de su caja tras estrechar la pista. Se exigió atribución con Range.getClientRects, no solo comparar altura del enlace. Worker confirmó regresión derivada: a 320 px con 1fr rango 37 px dentro de caja 48; con minmax rango 71 px en dos líneas, 12 px sobre el borde superior y 11 bajo el inferior. No se aceptó clasificarlo como ajeno. Director autorizó corregir exclusivamente `.home-surface .hero-ctas > .btn` para altura intrínseca, mínimo y padding con tokens existentes, conservando geometría normal, más aserción de rangos para el vecino. No se modifica `.btn` global. Es reparación necesaria de la regresión del propio ajuste.

Revisión de producto posterior: altura intrínseca en ShippingMarkCta, regla únicamente para hijos .btn de hero-ctas con tokens existentes y mínimo de pista móvil minmax(0, 1fr). Sin observaciones bloqueantes del diff ni de las capturas actuales, incluida ampliación al 200 % con ambos botones íntegros. .btn global, copy, fuentes, colores, rutas y arquitectura conservados.

Director leyó la matriz definitiva: 26 escenarios geométricos, 52 CTA en Chromium y WebKit; anchos 320/360/375/390/414/430/640/768/1280, con texto 200 % en 320/375/768/1280. Ningún CTA insuficiente, con texto fuera de la caja o fuera del viewport; cero overflow horizontal normal. Caras Archivo/ArchivoBlack cargadas y recursos WOFF2 locales registrados. Vecino normal 191,203125 × 48 px se conserva; el texto ampliado envuelve dentro de altura intrínseca.

E2E inicial tras la corrección: 47/48 PASÓ; único fallo de la nueva espera de navegación Chromium durante la primera compilación de registro. No hubo cambio de producto por ese fallo. Se ajustó la espera explícita de URL a 20 s dentro del presupuesto del test de 60 s, conservando Enter/tap reales y destino. También se espera hidratación antes de modificar las fuentes en el ensayo. Recheck de los diez casos afectados PASÓ (ocho ampliaciones y activación en ambos motores). No se presenta como una única corrida 48/48. Controles previos de scroll/menú conservados.

Fuera de alcance comprobado: reflow global al 200 % aún desborda por titular/estadísticas ajenos al CTA; flotante WhatsApp intersecta geométricamente algunas acciones durante scroll de home/tarifas, sin demostrar bloqueo completo del área clicable; el muestreo FAQ no tuvo esas intersecciones. No se modificó el flotante. CJK legible en las capturas locales; no certifica todos los dispositivos. No hubo formularios, registros, mensajes ni conexiones productivas. El control es del ensayo, no sandbox del SO.

Verificación canónica original leída por Director: **FALLÓ / INCOMPLETO**, 12 de 17 pasos ejecutados. Harness 236/237 PASÓ, un fallo por barrera del ensayo: `git clone --bare` de fixture local `dtd-harness-bare-*` bloqueado por guard que solo contemplaba los temporales de numeración. No se atribuye al producto ni se modifica el harness. Worker corregirá exclusivamente esa excepción temporal de su auxiliar y hará recheck focal con probes negativos.

Suite general **PASÓ en una sola pasada, sin retry**: 860 archivos aprobados y uno omitido; 12.278 pruebas aprobadas y una omitida, 564,38 s. Lint PASÓ con 15 warnings existentes/0 errores; RSC, tipos, docs, numeración, seis constantes, componentes, gobernanza y símbolos de migraciones pendientes PASÓ. Build de release completo/postbuild Norte **PASÓ**; tsconfig restaurado. Ningún despliegue.

Cinco omisiones explícitas: Edge, ledger de migraciones aplicadas, SQL, reconstrucción de esquema y E2E general. No se consultó producción ni se ejecutaron Docker/DB para forzar verde. La E2E acotada aprobada no sustituye la cobertura general omitida. El resultado del gate original se conserva aunque el recheck posterior del auxiliar pase.

Recheck posterior **PASÓ 10/10** en `scripts/tests/harness-worktree.node.mjs` (28,5 s), incluido el clon bare temporal. Director leyó el nuevo límite del auxiliar: cwd temporal resuelto, origen real y destino nuevo del mismo fixture, forma exacta clone -q --bare y protocolo file; ningún remoto del worktree real habilitado. Nueve controles negativos PASÓ (origen/destino ajenos, URL/UNC, fetch, curl y proxies remotos/file, entre otros). Log de red de recheck vacío. No se alteró el harness ni se repitió la suite general después.

Cierre de conocimiento Director observado mediante Node directo: principal `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`, ok true, estructura CURRENT, semántica PENDING, Archify CURRENT y Obsidian CURRENT. Son estados leídos; esta sesión no publica ni abre la bóveda. Coordinación en `839a10fa2dcf31d8c213a81c7b603863a7b3c335`: ok false, estructura/semántica INVALID, Archify/Obsidian PENDING, rama no integrada. Los derivados del Worker se registran aparte.

Revisión inmutable de implementación: **`b7b283107f2f5cfe44a7c55efc8cc75675ac7b03`**. Diff total de 17 archivos coincide con la allowlist, incluye tres fuentes de producto/regresión, documentación y auxiliares/capturas propios. `git diff --check` PASÓ; árbol tracked limpio. Director reabrió las capturas actuales anterior/corregida, texto 200 % y escritorio, además de las dos variantes ya inspeccionadas; sin observaciones bloqueantes del producto en su alcance.

Conocimiento Worker: Graphify 0.9.61 generó 43.774 nodos y 79.851 aristas propios. Recibo sobre b7b283107: estructura CURRENT, sin pendientes/drift/missing/deleted; semántica PENDING (0 verificadas/1.325 pendientes). Fragmento del README marketing preparado (cinco conceptos/cuatro relaciones), no aplicado ni presentado como recibo vigente. Dos advertencias de parseo parcial de Studio legal se conservan fuera de alcance. El shim del PATH apuntaba a otro runtime; se usó únicamente Python fijado 0.9.61, sin instalar ni modificar PATH global.

Tras cierre documental intermedio `94bcaaa413d2ea1535fbfa53b8e3407d13b94239`, Archify 2.16.0 build y check PASÓ / CURRENT con nueve validaciones y once fuentes. Director leyó ambos recibos locales: especificación `6ac8e65ef225e8a93dd92459f5fe75b164777cce8e77e941405f3e3c9407dcfc`, artefacto `c05d1946272de99427cf9efef92b02b12c11a34aa13d9fe4437b08946d56f276`. Declaran estructura/semántica PENDING en esa revisión; el mapa no las certifica. No se descarga runtime ni se publica bóveda compartida. Se ejecuta una sola preview local antes de terminar la documentación, sin ciclos para perseguir un SHA cambiante.

Preview única **PASÓ** sobre `94bcaaa413d2ea1535fbfa53b8e3407d13b94239`: ok true, estado PREVIEW, ruta propia `graphify-out/obsidian-preview`, 1.324 documentos y 43 advertencias de enlaces históricos. Director leyó el recibo: conserva STRUCTURAL_PENDING y SEMANTIC_PILOT_PENDING 0/16; el bloqueo MAIN_REQUIRED corresponde a publicación compartida, que no se ejecuta. Semántica global 0/1.325 PENDING. No equivale a cobertura semántica aprobada ni a apertura visible en Obsidian. Bóveda compartida NO EJECUTADO. Tras documentar estos resultados, los derivados pueden quedar pendientes para el nuevo SHA; no se repetirán exportaciones por esa razón.

## Aceptación y cierre Director

**SHA final revisado: `c2a933aac5ad8bc6ce3b8d78688e2dcaae9dc780`**, base integrada `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`. Director contrastó el delta completo desde la implementación b7b283107: solo cambia el handoff propio para registrar las capas y el cierre; producto, pruebas y capturas son idénticos. Diff-check final PASÓ; árbol tracked limpio y 17 archivos exactos autorizados.

**Aceptado localmente en el alcance del recorte.** Ambos CTA completos en móvil, escritorio y ampliación de texto, con marca/destino intactos y regresión del vecino reparada. Suite general y build aprobados. Gate original FALLÓ/INCOMPLETO conservado, con recheck del auxiliar PASÓ y cinco omisiones explícitas; no es aprobación de release ni de reflow global del sitio. Recibos de conocimiento conservan su revisión observada, no se certifica semántica pendiente ni se publica la bóveda.

Worker confirmó claim `worker-0580-cta-movil` liberado y archivo ausente, puerto 45800 sin listener y procesos propios UI/Graphify/Archify/preview/status finalizados. Rama/worktree conservados sin respaldo remoto nuevo. No hubo push, PR, merge, despliegue, cuentas, datos de clientes ni cambios en 0579. No hay pendientes de implementación o pruebas del recorte; los hallazgos ajenos y derivados pendientes anteriores siguen visibles.

Principal revalidado al cierre: `main` permanece en d410ab2e, sin cambios rastreados; los dos untracked preexistentes se preservan. Coordinación de Director guardada en el commit que contiene este documento y claim `director-0580-coordinacion` liberado después de ese commit. Una integración posterior requiere autorización y reconciliar los dos índices documentales compartidos entre 0579 y 0580; no se inicia ahora.
