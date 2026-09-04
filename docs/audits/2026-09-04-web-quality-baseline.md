---
title: "Baseline web local y accesibilidad de shells"
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-04
updated: 2026-09-04
review-by: 2026-09-11
confidencialidad: interno
---

# Baseline web local y accesibilidad de shells

## Alcance y método

Se midieron cuatro entradas con Lighthouse 13.4.1, emulación móvil y un build
de producción local de Next.js. Para permitir el build sin leer datos reales se
usó una URL Supabase sintética cerrada en `127.0.0.1`; no hubo sesión, Cloud,
PII, despliegue ni escritura externa.

Budgets de referencia por superficie: transferencia total menor a 1,5 MB,
JavaScript menor a 300 KB, CSS menor a 100 KB, fuentes menores a 100 KB,
imágenes above-fold menores a 500 KB y terceros menores a 200 KB.

## Resultado Lighthouse móvil

| Entrada | Rendimiento antes → después | A11y antes → después | LCP después | TBT después | CLS después |
|---|---:|---:|---:|---:|---:|
| Público `/` | 61 → 57 | 90 → 96 | 5.140 ms | 684 ms | 0 |
| Portal `/entrar` | 72 → 73 | 98 → 100 | 5.463 ms | 155 ms | 0 |
| Studio `/studio/login` | 74 → 70 | 90 → 100 | 5.267 ms | 107 ms | 0 |
| Móvil `/m/ve/login` | 79 → 74 | 98 → 100 | 5.622 ms | 85 ms | 0 |

La variación de rendimiento entre corridas locales no demuestra regresión ni
mejora. Las cuatro rutas conservan CLS 0; todos los LCP quedan por encima de
4 s. TBT es sólo un indicador de laboratorio: esta medición no sustituye INP
ni CrUX alojados.

## Budgets medidos después del cambio

| Entrada | Total | JavaScript | CSS | Fuentes | Terceros |
|---|---:|---:|---:|---:|---:|
| Público | 1.436 KB | 737 KB | 319 KB | 204 KB | 381 KB |
| Portal | 780 KB | 310 KB | 317 KB | 74 KB | 0 KB |
| Studio | 780 KB | 283 KB | 328 KB | 134 KB | 0 KB |
| Móvil | 743 KB | 313 KB | 327 KB | 74 KB | 0 KB |

Todas cumplen el límite total y el de imágenes above-fold. CSS falla en las
cuatro superficies; JavaScript falla en público, Portal y móvil; fuentes fallan
en público y Studio; terceros falla en público.

## Correcciones verificadas

- Portal, Studio y móvil exponen un único landmark `main`.
- La home publica `main-content` desde SSR y el skip link vuelve a tener destino.
- El drawer móvil cerrado queda `inert`, sin descendientes enfocables activos.
- Los textos secundarios corregidos en footer y Studio alcanzan AA con tokens o
  clases existentes.
- Contrato focal 7/7, suite completa 7.491/7.491 en 600 archivos, build de 158
  rutas, gobernanza de 28 políticas y registro de 5 fuentes quedaron verdes.

## Residuos y gates

- La home conserva un único fallo de contraste: `BrandMark` reverso pinta la
  palabra DTD en vino sobre navy, 1,55:1 frente al mínimo 3:1 para texto grande.
  Cambiar la variante contradice el contrato de marca actual y requiere decisión
  de diseño/founder; no se alteró silenciosamente.
- Google Ads carga `AW-561290482` y solicita
  `pagead2.googlesyndication.com`, bloqueado por la CSP actual. La home registra
  seis errores y 381 KB de terceros. Ampliar CSP habilitaría transferencia a un
  tercero: requiere decisión conjunta de marketing y privacidad.
- Los SEO bajos de Portal, Studio y móvil corresponden a shells privados con
  `noindex`; no son un defecto público.
- Optimización de CSS, bundles, fuentes y LCP queda para cortes locales
  independientes. INP/CrUX sólo puede confirmarse después de un despliegue
  autorizado con telemetría alojada.
