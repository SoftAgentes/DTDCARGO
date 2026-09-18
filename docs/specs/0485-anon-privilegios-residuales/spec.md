---
id: 0485
slug: anon-privilegios-residuales
status: reserved
related: ["0365"]
---

# SDD-0485 — anon pierde los privilegios residuales sobre las tablas de public

**RESERVA DE NÚMERO.** El contenido real lo escribe la sesión asignada en su
propia rama de trabajo. Este stub sólo existe para que el número quede tomado.

Reservado por coordinación el 2026-09-18, sobre `1d80c18a`. Migración
reservada: **`0465`**.

## La evidencia

Catálogo de producción, leído el 2026-09-18 con `aclexplode(relacl)` sobre las
tablas de `public`, sin filas de negocio: `anon` conserva MAINTAIN, REFERENCES y
TRIGGER en 180 tablas, y SELECT en 5. Entre ellas están `invoices` y
`mail_logs`. Es el default de Supabase recortado sólo en parte. El riesgo es
bajo, porque PostgREST no ejecuta DDL: esto es defensa en profundidad.

## Condición frente a L14

`0422` sigue pendiente, y su preflight exige que `authenticated` conserve SELECT
sobre `public.user_tenants`. También exige que `payment_private.report_commands`
no tenga privilegios API y que las cuatro funciones de comandos conserven su
EXECUTE. La `0465` sólo retira privilegios de tablas, y tiene que dejar pasar
ese preflight.
