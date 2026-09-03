---
sdd: "0378"
title: Verificacion local sin falsos verdes y aislamiento de pruebas CLI
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0300", "0329", "0376", "0377"]
confidencialidad: interno
---

# SDD0378 · integridad y cierre del gate local

## Fuente y permisos

Cola local acordada: cerrar timeouts E2E sin ocultarlos. El gate de0377 además
reprodujo tres timeouts del CLI sintético bajo suite conjunta; los demás6954
tests pasaron en el segundo intento. El primer intento vio RED de foco de
Cancelar, corregido y verificado focalmente; no fue un flaky.

pnpm sdd:next tras6ae46e81 consultó15refs:0378 libre, sin reserva/push.
No cambio de Cloud, credenciales, datos reales, main ni worktrees reales.
No aumentar timeouts para maquillar fallos. No matar procesos ajenos.

## Contratos

- Error global de Playwright, salida por señal, fallo de wrapper/limpieza,
  reporte ilegible/incoherente o error real de test debe fallar el gate.
- No inferir WebKit a partir de expected>0/unexpected0. RED independiente
  reprodujo salida0 y TODO VERDE con timeouts globales.
- Navegador ausente exclusivamente puede ser cobertura omitida, jamás un
  paso ejecutado verde. Todos los mensajes/resultados fallidos deben
  corresponder al lanzamiento ausente; uno mezclado implica fallo.
- Distinguir pass/fail/skip en classifyE2EReport(exitStatus, report).
  Reporte con errors no vacío o forma inválida falla. Counters enteros no
  negativos, coherentes con pruebas. Cero pruebas aprobadas no es verde.
- Reporte fresco por corrida y conservarlo para diagnosticar. No borrar el
  JSON al empezar otros gates ni repetir automáticamente toda la suite
  por un fallo global; retries individuales de Playwright se conservan.
- Diagnóstico real E2E con DEBUG de lifecycle, mismos480s/8workers. Primero
  medir, después corregir el ciclo de vida en su capa real. No atribuir un
  incidente upstream sin reproducción local.
- Investigar CLI en aislamiento antes de cambiar su planificación. Si la
  contención se confirma, serializar sólo ese proyecto después del grupo
  unitario, sin eliminar casos, mocks de Git ni ampliar sus10s de subprocesso.

## Allowlist

- scripts/verify-e2e.mjs y scripts/verify.mjs: clasificación y gate.
- scripts/__tests__/verify-e2e-report.test.mjs: regresión independiente.
- scripts/__tests__/verify-e2e-gate.test.mjs: integración sintética del bucle real.
- scripts/__tests__/verify-e2e.test.mjs: conservar pruebas de puertos y actualizar contrato obsoleto.
- scripts/check-e2e.mjs y scripts/__tests__/check-e2e.test.mjs: lifecycle/reporte sólo si evidencia lo exige.
- playwright.config.ts: sólo configuración de ejecución/lifecycle demostrada.
- vitest.config.mts y scripts/__tests__/verification-scheduling.test.mjs: aislamiento CLI si se demuestra.
- Esta spec, docs/specs/README.md generado.
- docs/audits/2026-09-03-verification-lifecycle-local.md.
- docs/audits/2026-09-03-portal-address-delete-local.md: gate agregado.
- docs/audits/2026-09-02-codex-arranque-checklist.md.
- .agents/handoffs/2026-09-02-saneamiento-integral-close.md.

## Aceptación

- [x] RED causal de absolución:4expectativas fallan y4controles pasan en VM
      sobre funciones/bucle reales; transporte/lecturaJSON instrumentados.
- [x] Regresión persistida y clasificación fail-closed.
- [x] Ningún error mixto ni reporte incompleto se convierte en éxito/SKIP.
- [ ] Timeouts E2E localizados con evidencia real, no con el mensaje heurístico.
- [x] CLI medido solo y planificación validada:7066/7066 en550archivos,
      390,65s, sin ampliar plazos ni cambiar maxWorkers del grupo unitario.
- [ ] Gate completo y reservas comunicadas, sin falsos porcentajes.

SGE00.02/04/05/07/12: conservación de evidencia y autoridad, estado verdadero.
Sin modificación visual ni de captura personal. Los fixtures son sintéticos.
Un problema externo sólo estaciona su gate; la cola local mantiene su orden.
