---
sdd: "0374"
title: Verificación pública bloqueada ante fallo del throttle
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0373"]
confidencialidad: interno
---

# SDD-0374 — Fallo seguro del throttle público

## Fuente y alcance

SEC-03 de AUDIT-2026-09-03.md: isVerifyThrottled permite verificar cuando
SELECT o INSERT fallan. El único consumidor es app/verificar/page.tsx:
si retorna true, omite tanto la consulta del diploma como la existencia
del Shipping Mark. Corregir esta porción local no necesita SQL ni datos reales.

Al preparar el slice, pnpm sdd:next consultó 15 refs; libre 0371.
Las specs 0371–0373 pertenecían a esta misma sesión, entonces aún sin commit;
0374 quedó libre al unir ambos inventarios.
Sin reserva remota. No cambiar migraciones aplicadas ni ampliar permiso0400.

## Contrato

Sólo retorna false tras count entero, finito, no negativo y menor que40,
y después de confirmar INSERT con error:null. Lectura/escritura inválida,
respuesta sin confirmación o excepción: retorna true y aviso diagnóstico
genérico, sin IP, códigos, mensajes del proveedor ni PII.
Count>=40 bloquea sin INSERT; se conserva ventana de 30 minutos y contrato booleano.
No cambia UI ni límites comerciales.

Limitación explícita: count e insert siguen separados y NO garantizan cupo
atómico bajo concurrencia. Se documentará reproducción sintética del residuo;
su solución requiere diseño de reserva transaccional y migración nominal aparte.
No se declara SEC-03 completamente cerrado ni protección contra enumeración total.
IP/anti-proxy, disponibilidad alojada y códigos secuenciales no se rediseñan aquí.

## Allowlist y ownership

- lib/public/verify-throttle.ts: principal.
- lib/public/verify-throttle.test.ts: agente de pruebas independiente.
- Esta spec y docs/specs/README.md generado: principal.
- docs/audits/2026-09-03-public-verify-local.md: principal.
- docs/audits/2026-09-02-codex-arranque-checklist.md: principal.
- .agents/handoffs/2026-09-02-saneamiento-integral-close.md: continuidad de la
  misma tarea; principal. No modifica permisos, herramientas ni skills.

## Plan

- [x] RED causal de lectura/escritura/respuesta/excepción.
- [x] GREEN con positivos, límite y preservación.
- [x] Verificar tipos, lint, suite y registrar concurrencia aún pendiente.
  Gate conjunto: 14/15 medidos, Cloud omitido y reservas E2E documentadas.
- [ ] Resolver cupo atómico y smoke alojado en su propio cambio autorizado.

## Privacidad y gobernanza

Minimización técnica según revisar-datos-ve: no capturar ni exponer campos
nuevos; mantener la salida neutra existente sin consultar alumnos reales.
SGE-00.05/.06 y ERR-01: rechazo seguro antes del lookup sensible.
SGE-00.07: no tratar una reserva fallida como verificación permitida.
AUD-01/02: diagnóstico mínimo, sin secretos ni cambio de retención.
Otros principios no aplican: no nuevo formulario, UI, permanencia ni efecto
externo del agente. No constituye certificación legal o integral.
