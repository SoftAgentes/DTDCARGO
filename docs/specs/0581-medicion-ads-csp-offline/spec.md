---
sdd: "0581"
title: "Diagnóstico local de medición Ads y CSP"
status: in-progress
author: "Codex"
created: 2026-10-23
updated: 2026-10-23
supersedes: null
superseded_by: null
related: ["0371", "0413", "0518", "0544"]
confidencialidad: interno
---

# SDD-0581 — Diagnóstico local de medición Ads y CSP

Dueño: Worker `worker-0581-ads`, coordinado por Director. Fecha: 2026-10-23.
Base: `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`; reserva `654d972afd3c0766c644340956c92a7e62bd7094`.

## Objetivo y autoridad

Sam pide diagnosticar primero y aplicar solamente correcciones justificadas,
implementadas y probadas localmente. No autoriza push, PR, merge, despliegue,
acceso/cambios de cuentas Ads o Analytics, Kommo, producción ni datos reales.
Una ausencia en una receta CSP no demuestra que el recurso sea usado ni bloqueado.
Si no hay defecto reproducible se entrega diagnóstico y contratos, sin ampliar CSP.

## Alcance exacto

- `next.config.ts`: únicamente tras RED específico y aprobación del Director.
- `components/Analytics.tsx`, `lib/cookie-consent.ts` y `components/Analytics.consent-cookie.test.tsx`: ampliación mínima aprobada por Director tras RED del consentimiento.
- `lib/runtime/__tests__/next-config.test.ts`.
- `e2e/analytics-csp-offline.offline.ts` (nombre exclusivo de la configuración offline).
- `playwright.analytics-csp-offline.config.ts`.
- Esta spec y `assets/offline-network-guard.cjs`, `assets/local-ads-check.mjs`, `assets/fixture-app.mjs`.
- `docs/qa/0581-medicion-ads-csp-offline.md`.
- `docs/marketing/diagnostico-medicion-ads-2026-10-23.md` y `docs/marketing/README.md`.
- `docs/specs/README.md`, generado.
- `.agents/handoffs/0581-medicion-ads-csp-offline.md`.

La prueba previa con fuentes intactas produjo ocho fallos y cuatro controles
aprobados en Chromium/WebKit: una cookie ajena concedía consentimiento, y un valor
propio `granted-synthetic` también. Director incorporó una corrección mínima de
nombre/valor completos en el init y helper a este slice. Aunque el plan P3 proponía
separar cambios de consentimiento, esta excepción acotada aplica la autorización
de Sam de corregir defectos justificados de medición. No cambia modelo v2, UI,
IDs, eventos, cuentas ni política jurídica. Ante varias cookies visibles del mismo
nombre, la lectura devuelve ausencia de decisión y el init conserva denied;
no hay migración ni selección silenciosa de una concesión ambigua.
No se borran cookies de otros paths/domains: una duplicada persistente puede
requerir limpieza independiente; este slice no promete resolver esa persistencia.
Los helpers offline se adaptan desde SDD-0580 commit
`b7b283107f2f5cfe44a7c55efc8cc75675ac7b03`, sin dependencia runtime de ese árbol.

## Aceptación

- [x] Inventario de tags, eventos, consentimiento, rutas y CSP con fuentes actuales.
- [x] Prueba de headers HTTP de un build real retenido con GA/Ads `off`.
- [x] Fixture Next activa con fuentes trazables, loader inerte, consentimiento,
  SPA, loader tardío, exclusión privada y WhatsApp exclusivamente sintético.
- [x] Probes CSP distinguen permiso técnico de necesidad real del proveedor.
- [x] Node/SSR/subprocesos y navegador con controles previos, sin salida real.
- [x] Contratos existentes y canónico ejecutados con límites y SKIPs explícitos.
- [x] Diagnóstico y corrección mínima RED/GREEN aprobada.
- [ ] Handoff, commits selectivos, derivados locales y claim liberado.

## Privacidad y límites de evidencia

Consent Mode avanzado puede emitir pings restringidos con `denied`; la prueba no
equipara rechazo con ausencia de tráfico. Todos los endpoints externos se
interceptan antes de navegar. No se ejecuta JavaScript de Google. La cola local
no demuestra recepción, cookies internas, deduplicación o atribución en Google.
Las barreras de ensayo no equivalen a una sandbox universal del sistema operativo.
Sin nuevas funciones Studio, DB, UX ni cambios de conversión/cuentas; gobernanza
Studio no aplica por superficie. No se promete mejora de ROAS, CPC o Quality Score.

## Evidencia

Ver `docs/qa/0581-medicion-ads-csp-offline.md` y el diagnóstico de marketing.

El cierre detectó que el nombre inicial `.spec.ts` añadía 48 casos offline al
descubrimiento general sin sus servidores/barreras propios. Se renombró a
`e2e/analytics-csp-offline.offline.ts` y se ajustó únicamente su `testMatch`:
el general descubre cero casos propios y la configuración propia conserva 32.
El cuerpo conserva su SHA-256 byte a byte; la ejecución previa 32/32 mantiene
su alcance. No cambia configuración general, skips, producto ni aserciones.
