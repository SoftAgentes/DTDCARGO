---
sdd: "0371"
title: Excluir puertas de acceso de Analytics
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0253"]
confidencialidad: interno
---

# SDD-0371 — Analytics fuera de las puertas de acceso

## Fuente y alcance

SEC-01 de AUDIT-2026-09-03.md y cola local autorizada por Sam el 2026-09-03.
Numeración: pnpm sdd:next, fetch exitoso, 15 refs, 0371 libre; sin reserva/push.
El objetivo guardado permanece blocked; no impide trabajar en esta sesión.
Las puertas /acceso/[token] y /entrar/[code] transportan llaves al portador:
el GET no las consume. Analytics global no las excluía. No se afirma una fuga
real; únicamente el comportamiento reproducido con valores sintéticos.

## Contrato y aceptación

1. Excluir /acceso, /entrar y descendientes de loader, init y page_view.
   Preservar /registro, /tarifas, /servicios y prefijos públicos parecidos.
   Redactar tokens como defensa adicional.
2. Al navegar hacia privado, desactivar GA/Ads antes del observador de history.
   Los helpers/listeners verifican la URL real al emitir. Volver a público
   recupera medición sin duplicar listeners; no cambia IDs ni consentimiento.
3. Pruebas RED/GREEN, navegador local con Google interceptado y llaves
   sintéticas, gate canónico y documentación. No probar con clientes reales.

No cambia SQL, Cloud, main, cuentas Google, deploy, permisos o limpieza.
El comportamiento interno del proveedor real no se certifica por un stub.
No hay GO de producción ni afirmación de privacidad integral.

## Allowlist y ownership

- components/Analytics.tsx: principal.
- __tests__/analytics.test.ts y components/Analytics.test.tsx: agente de
  pruebas independiente; principal integra después de RED.
- Esta spec y docs/specs/README.md generado: principal.
- docs/marketing/README.md: índice de medición; principal.
- docs/audits/2026-09-02-codex-arranque-checklist.md: continuidad; principal.
- docs/audits/2026-09-03-analytics-local.md: evidencia local; principal.
- Artefactos sintéticos de navegador en output/playwright/: temporales.

## Plan

- [x] Reproducción RED independiente.
- [x] Corrección mínima y pruebas GREEN.
- [x] Navegador local con solicitudes Google interceptadas.
- [x] Gate canónico, revisión y evidencia: 14/15 medidos; Cloud omitido y
  E2E con dos timeouts globales. Reservas en el checklist, no cierre completo.
- [ ] Publicación/verificación alojada: permiso independiente.

## Reversión

Revertir selectivamente este paquete reabre SEC-01; no cambia datos ni permisos.
No revertir recibos Cloud o cambios ajenos. No ejecutar reversión automática.
