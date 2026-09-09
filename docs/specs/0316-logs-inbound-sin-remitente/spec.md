---
sdd: "0316"
title: "Los logs de email inbound no exponen al remitente"
status: done
author: "Sam (founder) + Codex"
created: 2026-09-01
updated: 2026-09-01
supersedes: null
superseded_by: null
related: ["0056"]
confidencialidad: interno
---

# DTD-0316 — Logs inbound sin dirección de correo

## Problema

El webhook de Resend escribía `input.fromEmail` en `console.warn` cuando el
remitente no coincidía con un cliente o coincidía con varios tenants. La
dirección personal quedaba copiada en la plataforma de logs aunque no era
necesaria para procesar, reintentar ni investigar el evento.

## Decisión

Los dos eventos conservan datos operativos no personales:

- `email_id` de Resend para correlacionar el webhook con el proveedor;
- cantidad de coincidencias en el caso ambiguo;
- resultado `unmatched` o `ambiguous`.

No se guarda correo completo, parcial ni hash. La respuesta HTTP y el flujo de
ingesta no cambian.

## Allowlist exacta

- `app/api/conversaciones/email/route.ts`
- `app/api/conversaciones/email/route.test.ts`
- esta spec y el índice generado de specs

## Revisión de datos personales

| Estado | Evidencia |
|---|---|
| ENCONTRADO antes | `console.warn` incluía `input.fromEmail` en los casos sin match y ambiguo |
| CORRECTO en el slice | el log conserva `email_id` y conteo, pero no la dirección del remitente |
| NO VERIFICABLE | retención, acceso y exportación real de logs del proveedor alojado |

La reducción implementa minimización y temporalidad técnica vinculadas con
CRBV arts. 28 y 60 y SC 332/2001. Para el tratamiento realizado por el equipo
en China también reduce alcance bajo PIPL arts. 6 y 51. Esto no declara
cumplimiento legal ni verifica la operación alojada.

## Gobernanza

| Control | Clasificación | Evidencia |
|---|---|---|
| SGE-00.05 · privacidad | cumplimiento | el servidor no replica el correo en logs |
| SGE-00.06 · prevención | cumplimiento | el dato se omite en el punto de emisión |
| UI y componentes | no aplica | no cambia interfaz ni respuestas |

## Verificación

- contrato de fuente que prohíbe `fromEmail` dentro de `console.warn`;
- conserva correlación por `email_id` y conteo ambiguo;
- tests de ingesta inbound existentes;
- typecheck, lint y gates documentales.
