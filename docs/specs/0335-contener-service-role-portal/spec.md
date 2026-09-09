---
sdd: 0335
title: Contener el crecimiento de service_role en Portal y ordenar el arranque Codex
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0318
  - SDD-0334
confidencialidad: interno
---

# SDD-0335 — Contener `service_role` en Portal y ordenar el arranque Codex

## Estado real

Once Server Components del Portal construyen el cliente administrador 23 veces.
Los usos combinan ownership comprobado, tablas sin policy de cliente y firmado
de Storage. No se demostró una explotación, pero la seguridad depende de filtros
manuales y el inventario podía crecer sin ningún gate.

El saneamiento también necesitaba una cola vigente: 326 specs incluyen 93 sin
cierre documental, por lo que el front-matter no puede usarse sin reconciliar
como lista directa de trabajo.

## Decisión

1. Añadir un contrato estático que fije las 11 rutas y 23 construcciones.
2. Fallar si aparece otra ruta, se mueve una elevación o cambia el conteo sin
   actualizar deliberadamente el baseline.
3. Aclarar que el baseline contiene deuda; no la aprueba.
4. Crear un checklist único de arranque Codex con gates y orden de ejecución.
5. No cambiar RLS, Storage ni queries del Portal dentro de este slice.

## Gobernanza

- `cumplimiento` LOD-01: se impide expandir una frontera privilegiada sin
  evidencia explícita.
- `cumplimiento` ERR-01: el backlog separa lo no medido de los verdes reales.
- `no aplica`: cambio visual, PII nueva, migración, Cloud o Producción.

## Allowlist exacta

- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `README.md`
- `docs/specs/0335-contener-service-role-portal/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/2026-09-02-portal-boundary-checklist-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- El contrato ve exactamente 11 RSC y 23 construcciones de admin.
- Una ruta o llamada nueva hace fallar la suite.
- Ninguna elevación inventariada vive en un Client Component.
- El checklist distingue trabajo local, decisiones humanas y gates alojados.
- Test focal, documentación, gobernanza y diff pasan localmente.

## Fuera de alcance

- Declarar seguros los 23 usos actuales.
- Añadir policies/RPCs o firmar archivos de otra forma.
- Aplicar migraciones, cambiar Storage o limpiar worktrees.
