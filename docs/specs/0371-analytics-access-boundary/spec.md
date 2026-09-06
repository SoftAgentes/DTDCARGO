---
sdd: "0371"
title: Analytics fuera de puertas de acceso y URLs con credenciales
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-05
supersedes: null
superseded_by: null
related: ["0250", "0253", "0278"]
confidencialidad: interno
---

# SDD-0371 — Analytics fuera de puertas de acceso y URLs con credenciales

## Fuente y alcance

SEC-01 de `AUDIT-2026-09-03.md` detectó que Analytics global no excluía
`/acceso/[token]` ni `/entrar/[code]`. La reconciliación del 2026-09-04 amplía
el contrato al alcance pedido por el founder: ninguna puerta de acceso ni URL
que transporte credenciales, códigos o identificadores puede cargar o emitir
Google Analytics 4 o Google Ads.

El análisis de las rutas vivas añadió `/abrir?token_hash=...&type=magiclink`.
También cubre códigos o PII en query (`ref`, `est`, `code`, `email` y cualquier
clave no aprobada) y credenciales en el fragmento (`access_token`,
`refresh_token`, `token_hash`, entre otras). No se afirma una fuga real; todas
las reproducciones usan valores sintéticos.

## Decisión de reconciliación

Se elige como implementación única el paquete local de
`codex/analytics-privacy`, basado en `origin/main` `2a2e81bf`, porque aplica el
gate sobre la URL completa y no sólo sobre el pathname.

El commit `260384b2` de `codex/saneamiento-integral` queda descartado para
integración: cubre `/acceso` y `/entrar`, pero no `/abrir`, queries no
aprobadas, fragmentos sensibles ni cambios SPA que alteran sólo query/hash.
El commit documental mixto `37bc0848` tampoco se integra en bloque porque
combina SDD-0371 con SDD-0372 a SDD-0374 y auditorías ajenas. Este archivo es
la reconciliación selectiva de SDD-0371.

## Contrato y aceptación

1. Excluir loader, init, `page_view`, conversiones y helpers en `/acceso`,
   `/entrar`, `/abrir` y sus descendientes, sin excluir prefijos públicos
   parecidos como `/accesorios`, `/entradas` o `/abrigos`.
2. Excluir toda URL con query fuera de la allowlist de atribución:
   `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`,
   `origen`, `gclid`, `gbraid` y `wbraid`.
3. Excluir fragmentos con credenciales o identificadores sensibles y fallar
   cerrado ante fragmentos mal codificados.
4. En navegación cliente, activar `ga-disable-*` antes de delegar
   `pushState`/`replaceState`. Reactivar sólo después de confirmar una URL
   pública, sin duplicar listeners ni emitir helpers durante la transición.
5. Mantener redacción defensiva de segmentos conocidos y no cambiar IDs,
   consentimiento ni señales públicas válidas.
6. Probar carga inicial y navegación cliente con credenciales sintéticas. No
   usar clientes, códigos ni cuentas reales.
7. Mezclar escapes válidos con porcentajes malformados no puede esconder una
   credencial dentro de ninguno de los nueve parámetros de atribución. Ante
   UTF-8 ambiguo o demasiadas capas, bloquear. Conservar campañas legítimas con
   porcentajes/Unicode y sus valores originales; la decodificación es sólo para
   inspección. `sanitizeSearch()` omite valores sensibles como defensa adicional.

No cambia SQL, migraciones, Cloud, Google, deploy, permisos ni limpieza. La
verificación local no certifica el comportamiento interno del proveedor ni
autoriza publicación.

## Allowlist y ownership

- `components/Analytics.tsx`
- `components/Analytics.test.tsx`
- `__tests__/analytics.test.ts`
- `docs/specs/0371-analytics-access-boundary/spec.md`
- `docs/specs/README.md` (generado por `pnpm docs:index`)
- `docs/marketing/README.md`
- `docs/legal/privacidad/inventario-terceros.md`
- `.agents/handoffs/2026-09-04-analytics-privacy-close.md` (evidencia histórica)
- `.agents/handoffs/pr24-analytics-remediation-20260905.md`

## Plan y evidencia local

- [x] Reproducción RED del contrato ampliado.
- [x] Gate por pathname, query y fragmento; bloqueo previo de History.
- [x] Pruebas sintéticas de carga inicial y navegación cliente.
- [x] Documentación de marketing e inventario de terceros.
- [x] Gate canónico local: 14/15 pasos ejecutados sin fallos;
      `migrations-applied` no se midió porque consulta Cloud y quedó fuera del
      alcance autorizado.
- [ ] Publicación y verificación alojada: permisos independientes.

## Remediación sobre main · 2026-09-05

La evidencia anterior describe el cierre histórico. La revisión independiente
del HEAD `545af5756d61c1da27b6b86336e12f90a2459fd3` encontró un único bypass:
`utm_campaign=id_token%253DSYNTHETIC%25ZZ` y su variante con sufijo `%25`
pasaban porque `decodeURIComponent()` fallaba y devolvía el valor codificado.

La rama `codex/pr24-analytics-remediation-20260905` combina ese HEAD con main
`74bb52ab9677f96908cc032a15f2364ab9d94716`, conserva ambos historiales y
regenera el único conflicto, `docs/specs/README.md`.

- RED: 95 regresiones fallan y 120 controles pasan contra el componente
  original intacto; son variantes de un hallazgo, no 95 vulnerabilidades.
- GREEN: 215/215 pruebas focales. Los porcentajes literales se escapan sólo en
  la copia de inspección para decodificar escapes válidos vecinos; errores UTF-8
  y fragmentos malformados fallan cerrado. La URL permitida no se reescribe.
- Navegador Edge: 20 escenarios sintéticos con React y `next/script` real,
  adaptador de hooks de navegación y solicitudes externas interceptadas.
  Incluye inicio sin `gtag`, loader tardío, observadores de History antes y
  después del guard, regreso a público, hashchange/popstate y señales públicas.
  No hay solicitudes hacia Google ni errores de página. El comportamiento
  interno del proveedor y la integración completa de Next no quedan certificados.
- Revalidación independiente favorable de
  `7d13021224292b4b6379ebdd2f4e9d34b9273166`: 183 casos propios del auditor
  (129 de detector/sanitizador y 54 React/jsdom). El P1 está corregido en el
  alcance reproducido; no se demostraron nuevos bloqueantes. No hereda las
  pruebas del Worker ni aprueba merge/release.
- `pnpm verify` de ese SHA: 14/16 pasos reales, sin fallos ni reintentos;
  6359 pruebas en 502 archivos, 12 pruebas del harness, 4 Edge Functions,
  139 contratos SQL, schema reconstruido (380 migraciones + 18 sólo-ledger,
  aislamiento de 219 tablas) y build/postbuild aprobados. Lint: 0 errores,
  8 warnings históricos. Completado el 2026-09-05 a las 23:10 America/Caracas.
- Omisiones explícitas: ledger de producción sin credenciales, fuera del
  alcance, y E2E general por navegadores Playwright ausentes. Los 20 escenarios
  Edge focales no sustituyen esa suite. Exit 0 no es verde completo; Director
  debe clasificar las omisiones antes de aprobar integración. Evidencia,
  huellas y revisión independiente en el handoff vivo.

La continuación de preparación instaló Chromium/Headless Shell 1223 y WebKit
2287 para Playwright 1.60.0. Ambos motores arrancaron/cerraron `about:blank` y
el `--list` conserva los tres proyectos, 168 casos en 14 archivos. No se
ejecutó la suite: por código, 129 casos son elegibles sin backend, 21 necesitan
URL/anon para render sano y 18 requieren fixture autenticado. El comando
preparado falla cerrado sin entorno efímero real; no se usan claves ficticias
ni se cambia el guard. Requisitos y matriz por caso en el handoff. Si se elige
un entorno completamente local, su adaptación pertenece a SDD-0440/#28 y no se
implementa aquí.

La SDD conserva `in-progress` por E2E/entorno y clasificación de omisiones. El
cierre documental posterior a `7d130212` no cambia producto ni tests y se revisa por delta.
Publicar, integrar y desplegar mantienen sus permisos separados; no cambian
SQL, credenciales, consentimiento ni IDs.

## Reversión

Revertir selectivamente sólo los archivos de esta allowlist reabre SEC-01. No
revertir recibos Cloud ni cambios ajenos y no ejecutar limpieza automática.
