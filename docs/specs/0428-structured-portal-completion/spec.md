---
sdd: "0428"
title: Cierre de observabilidad estructurada del Portal
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0093", "0387", "0425", "0426", "0427"]
confidencialidad: interno
---

# SDD-0428 · Cierre de observabilidad estructurada del Portal

## Problema

Tras los slices anteriores quedan tres logs libres en producción dentro del
Portal: dos en el progreso de Academia y uno en el límite de error. Este último
también conserva el voseo “Volvé”, contrario a la voz venezolana del proyecto.

## Contrato acotado

- Adoptar el logger canónico en Academia y el límite de error.
- Reemplazar tres logs libres por eventos con operación y etapa.
- Corregir “Volvé” a “Vuelve” sin alterar estructura ni estilos.
- Añadir un contrato que mantenga todo `app/portal` y `app/api/portal` sin logs
  libres en archivos de producción.

## Fuera de alcance

- Cambios visuales, progreso o datos reales, permisos y RLS.
- Migraciones, Cloud, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- Acción de Academia y límite de error del Portal.
- Suite de scope de Academia, contrato nuevo, acta, índice y checklist.

## Aceptación

- [x] RED confirma tres logs libres y el voseo existente.
- [x] Cero `console.*` libre queda en producción dentro del Portal.
- [x] Curso, lección, cliente, tenant y digest quedan fuera de logs.
- [x] El copy usa tuteo venezolano sin cambiar el diseño.
- [x] Contratos focales, suite completa y gates canónicos quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; logger canónico por acción/componente.
- `AUD-01` / `AUD-02`: cumplimiento; fallos estructurados.
- `SEC-01`: cumplimiento; identificadores fuera de logs.
- `BD-001`: cumplimiento; tuteo venezolano y cero cambio visual estructural.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.
