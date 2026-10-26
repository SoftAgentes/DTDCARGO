---
sdd: "0580"
title: "Shipping Mark CTA: altura intrínseca y recorrido móvil"
status: done
author: "Codex"
created: 2026-10-23
updated: 2026-10-23
supersedes: null
superseded_by: null
related: []
confidencialidad: interno
---

# SDD-0580 — Shipping Mark CTA móvil

## Objetivo y autorización

Sam autorizó el 2026-10-23 otro Worker aislado para reproducir y corregir el
recorte del botón Shipping Mark de la home, con implementación, commits y pruebas
locales. Sin push, PR, merge, despliegue, cuentas externas ni producción.

Base integrada: `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`; reserva local
`dd0ea538b49dfa01f7126a4ef737e7cedb3691b3`. Rama
`codex/0580-shipping-mark-cta-movil`, owner `worker-0580-cta-movil`.

## Problema e hipótesis a medir

Los dos CTA de la home comparten `ShippingMarkCta`. `.btn` impone 48px de alto;
el componente apila la etiqueta y «Casillero» tachado, con padding vertical.
La hipótesis es una caja insuficiente para la suma real de líneas y relleno.
Se debe medir antes de cambiar producto, con Archivo local realmente cargada.
La ausencia de scroll horizontal por sí sola no detecta el defecto vertical.

## Alcance exacto

- `components/ShippingMarkCta.tsx`.
- `app/globals.css`: únicamente selector necesario del CTA de home; no `.btn` global.
- `e2e/sin-scroll-horizontal.spec.ts`.
- `docs/marketing/README.md`.
- `docs/specs/0580-shipping-mark-cta-movil/spec.md` y `qa.md`.
- `docs/specs/README.md`, generado.
- `.agents/handoffs/0580-shipping-mark-cta-movil.md`.
- Assets de esta spec: `offline-network-guard.cjs`, `local-ui-check.mjs`,
  `playwright.local.config.ts`, `01-antes-hero.png`, `02-antes-cierre.png`,
  `03-despues-hero.png`, `04-despues-cierre.png`, `05-texto-200.png`,
  `06-escritorio.png`.

Logs y fixtures propios ignorados en `.codex/qa`. No modificar home, navegación,
WhatsApp, CJK, copy, destino `/registro`, registro, Ads, CSP, API, DB ni bandera
de tracking. La SDD-0579 permanece independiente y sin integrar.

## Criterios de aceptación

1. Evidencia antes/después de ambos CTA y geometría de etiqueta, tachado y caja.
2. La regresión de geometría falla en baseline y pasa tras la corrección.
3. Texto íntegro y sin solapamiento a 320/360/375/390/414/430px; revisión a
   768/1280px; texto 200% y escenario equivalente a zoom con método explícito.
   No presentar CSS zoom como zoom nativo.
4. Sin scroll horizontal atribuible al CTA; sin reducción tipográfica,
   truncamiento, ellipsis, overflow hidden global ni alturas por dispositivo.
5. «Casillero» tachado permanece debajo; etiqueta, colores, contraste y destino
   conservados; foco visible, teclado y target táctil mínimo 44×44 CSSpx.
6. Geometría de botón vecino comparada antes/después; ambas variantes conservadas.
7. Recorrido home/tarifas/FAQ: comprobar WhatsApp y CJK, registrar ajenos sin editarlos.
8. Chromium y WebKit si existen localmente; no descargar navegadores.
9. Pruebas locales aisladas de red externa, sin formularios enviados ni eventos
   a terceros. `pnpm verify` equivalente Node con omisiones explícitas.
10. UI-check advisory, diff acotado, QA/handoff, commits locales, claim liberado
    y procesos propios cerrados; conservar rama y worktree.

## Validación y evidencia

La matriz, método de ampliación, resultados por navegador/ancho, capturas,
prueba negativa de red y resultados canónicos se conservan en `qa.md`.
Helpers de ensayo reutilizados desde fuente commitida de SDD-0579
`d069b5b26df962b25f6476bfd7c3c626c4764be2`, copiados a esta spec, sin importar
otro worktree ni sus cambios de producto. La barrera es de ensayo Node/browser,
no una sandbox universal del sistema operativo.

## Gobernanza y documentación

Web pública; gobernanza de comportamiento Studio no aplica. Se conservan
BRAND.md, Archivo, tokens, variantes de botones y regla founder 2026-07-31 del
tachado ligado a Shipping Mark. No captura/movimiento/borrado de datos personales.
Marketing recibe una nota mínima. Grafo/Archify/preview locales se clasifican
separados de integración y publicación de la bóveda compartida.

## Resultado local

Implementado con altura intrínseca del componente, pista móvil acotada y ajuste
local del vecino para evitar una regresión a 200 %. Matriz UI y E2E afectados
aprobados; build y 12.278 pruebas unitarias aprobados. La corrida canónica se
conserva FALLÓ/INCOMPLETO: un fallo de barrera de ensayo del harness, corregido
y revalidado por separado, y cinco pasos omitidos. No acredita release global.
Detalle reproducible, límites y hallazgos fuera de alcance en `qa.md`.
