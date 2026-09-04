---
sdd: "0431"
title: Correlación y logs estructurados en rutas móviles
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0146", "0415", "0425"]
confidencialidad: interno
---

# SDD-0431 · Correlación y logs estructurados en rutas móviles

## Problema

Las tres rutas móviles de Web Push y el ping GPS conservan cinco logs libres y
no devuelven un correlador estable. El ping también contiene una respuesta en
voseo ajena al contrato de trato del producto.

## Contrato acotado

- Crear un logger desde la petición en las cuatro rutas.
- Añadir `x-request-id` a todas sus respuestas.
- Reemplazar cinco logs libres por eventos sin endpoints, coordenadas ni IDs.
- Corregir únicamente “pedile” por “pídele”.
- Mantener auth, validación, persistencia, rate limit y cuerpos de respuesta.

## Fuera de alcance

- Suscripciones, ubicaciones o sesiones reales.
- Permisos, RLS, migraciones y cambios visuales.
- Cloud, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- `app/api/m/{push/{subscribe,unsubscribe,resubscribe},tms/ping}/route.ts`.
- Contrato nuevo, acta, índice y checklist.

## Aceptación

- [x] RED confirma logs, falta de correlación y voseo.
- [x] Cero `console.*` libre queda en el alcance.
- [x] Toda respuesta lleva `x-request-id`.
- [x] Endpoints, coordenadas e identificadores quedan fuera de logs.
- [x] Contratos focales, suite completa y gates canónicos quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; correlador del borde a la respuesta.
- `AUD-01` / `AUD-02`: cumplimiento; fallos estructurados.
- `SEC-01`: cumplimiento; secretos, ubicación e IDs fuera de logs.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.
