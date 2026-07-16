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
- Las listas son inline para mantener el parser portable sin dependencias.
- Un documento legacy con `status: done` no equivale automáticamente a una
  implementación completa.

