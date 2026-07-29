# Reparación del historial reproducible de Supabase

| Control | Valor |
|---|---|
| Revisión | REV-AUD-020 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) |
| Fecha | 2026-07-29 |
| Resultado | diseño y artefacto local aprobados; aplicación Cloud pendiente |

## 1. Hallazgo

REV-AUD-020 rechaza la causa original “seed no idempotente”. El seed
`team_invitation` ya contiene `ON CONFLICT DO NOTHING`; falla porque el ledger
intenta ejecutarlo antes de crear `mail_templates`.

El inventario metadata-only encontró quince entradas post-hoc. Tres son
duplicados documentales de SQL ya registrado y once requieren restaurar
contenido u orden para un replay fiel. La entrada `0018_mailing` es un
placeholder adicional que queda sustituido funcionalmente al anteponer su SQL
canónico al primer consumidor.

## 2. Diseño aprobado

La migración candidata:

```text
0271_repair_branch_replay_history
```

- valida versión, nombre, cardinalidad y digest del estado viejo o reparado;
- incorpora sólo archivos históricos ya versionados;
- escribe exclusivamente `schema_migrations.statements`;
- conserva los statements históricos originales;
- es idempotente cuando se ejecuta al final de un replay ya corregido;
- aborta ante cualquier drift.

No existe atomicidad entre PostgreSQL y el control plane de branches. El gate
Cloud sólo asegura una transacción PostgreSQL sobre el ledger. La creación,
salud y destrucción del branch se verifican después como estados externos.

## 3. Evidencia

| Verificación | Resultado |
|---|---|
| Preflight metadata-only fresco | 11/11 exactos; `0271` ausente; `0270` ausente |
| Fuentes canónicas | 12 archivos SQL, finales LF normalizados |
| Vitest focal | 3/3 |
| PostgreSQL 15 | verde; doble ejecución; rollback |
| PostgreSQL 17 | verde; doble ejecución; rollback |
| Escrituras de negocio | cero |
| Secretos o PII | cero |

La prueba SQL crea un ledger sintético, aplica `0271` dos veces, valida todos
los digests y termina en `ROLLBACK`.

## 4. Veredicto

REV-AUD-020 aprueba técnicamente el diseño, el generador, la migración y las
pruebas locales. No aprueba todavía la aplicación Cloud ni declara resuelto el
replay end-to-end.

El próximo gate requiere autorización expresa del founder nombrando
`0271_repair_branch_replay_history`. `0270`, Auth, Vercel, D1, los slices de
adopción, D2–D5 y PLG-P3 permanecen fuera de alcance.
