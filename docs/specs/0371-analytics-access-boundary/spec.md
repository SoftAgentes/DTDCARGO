---
sdd: "0371"
title: Analytics fuera de puertas de acceso y URLs con credenciales
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-04
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

## Plan y evidencia local

- [x] Reproducción RED del contrato ampliado.
- [x] Gate por pathname, query y fragmento; bloqueo previo de History.
- [x] Pruebas sintéticas de carga inicial y navegación cliente.
- [x] Documentación de marketing e inventario de terceros.
- [x] Gate canónico local: 14/15 pasos ejecutados sin fallos;
      `migrations-applied` no se midió porque consulta Cloud y quedó fuera del
      alcance autorizado.
- [ ] Publicación y verificación alojada: permisos independientes.

## Reversión

Revertir selectivamente sólo los archivos de esta allowlist reabre SEC-01. No
revertir recibos Cloud ni cambios ajenos y no ejecutar limpieza automática.
