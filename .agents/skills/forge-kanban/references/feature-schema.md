# Contrato de feature v1

El contrato separa el estado de la definición, la implementación y la
verificación. Es opcional para specs legacy; no reescribirlas en masa.

```yaml
---
feature_schema: 1
feature_id: F-001
scope_status: complete          # draft|complete|future|out_of_scope
implementation_status: partial  # not_started|partial|complete
verification_status: pending    # pending|verified|failed
domain: general_code
artifact_type: code
priority: yellow
owned_paths: [src/features/example/**]
shared_paths: []
forbidden_paths: [.env*]
gate: npm test -- example
acceptance_criteria: [implementa el alcance aprobado, conserva evidencia del gate]
risk_tags: []
task_effort: 5
build_method: yunque
tickets: [T-001, T-002]
evidence_code: [src/features/example/**]
evidence_tests: [tests/example.spec.ts]
evidence_migrations: []
human_decisions: []
future_scope: []
---
```

## Reglas

- `scope_status: complete` sólo afirma que el alcance está definido.
- `implementation_status: complete` exige evidencia declarada.
- `verification_status: verified` sólo es válido si todas las rutas declaradas
  existen; una declaración rota se muestra como contradicción.
- `future` y `out_of_scope` no generan propuestas de tickets.
- `human_decisions` bloquea la ejecución aunque exista código.
- `domain`, `artifact_type`, `owned_paths`, `gate` y `acceptance_criteria` son
  obligatorios para aprobar y convertir una propuesta en ticket; sin ellos la
  propuesta permanece negra para completar contrato.
- El modelo se resuelve desde `.forge/forge-kanban.yml`; si la clase requerida
  no tiene un modelo configurado, la propuesta no es elegible.
- `approve` liga la decisión humana al hash completo de la spec y al commit
  base. Cualquier cambio obliga a ejecutar `propose` y aprobar nuevamente.
- Las listas son inline para mantener el parser portable sin dependencias.
- Un documento legacy con `status: done` no equivale automáticamente a una
  implementación completa.

## Varias features en una spec

Usar un marcador antes de cada sección. Si existe al menos un marcador, cada
marcador es una feature independiente y el documento no se duplica como feature
adicional:

```markdown
<!-- forge-feature
feature_id: F-001
title: Facturación atómica
scope_status: complete
implementation_status: partial
verification_status: pending
domain: general_code
artifact_type: code
owned_paths: [src/features/facturacion/**]
gate: npm test -- facturacion
acceptance_criteria: [prueba concurrencia, conserva evidencia]
tickets: [T-003]
evidence_code: [src/features/facturacion/**]
evidence_tests: [tests/facturacion.spec.ts]
-->

## Facturación atómica

- [x] Guardar cabecera y líneas.
- [ ] Probar concurrencia.
```
