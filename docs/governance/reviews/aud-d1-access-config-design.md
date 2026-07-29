# Revisión técnica del diseño D1 — acceso y configuración

| Control | Valor |
|---|---|
| Revisión | REV-AUD-017 |
| SDD | [SDD-0174](../../specs/0174-audit-atomicidad-dominios/spec.md) |
| Diseño | [D1 acceso/configuración](../../specs/0174-audit-atomicidad-dominios/diseno-d1-acceso-configuracion.md) |
| Inventario | [47 acciones](../../specs/0174-audit-atomicidad-dominios/inventario-d1-acceso-configuracion-2026-07-29.md) |
| Fecha | 2026-07-29 |
| Resultado | aprobado técnicamente |

## Veredicto

El diseño cierra el ledger de 47 acciones, limita D1 a 24 operaciones
obligatorias y mantiene 21 operaciones en D5 más dos preferencias personales
fuera de D1. La máquina de estados trata Supabase Auth como efecto externo,
define intención durable, idempotencia, confirmación, compensación y
reconciliación sin declarar atomicidad ACID distribuida.

## Controles aprobados

- un fallo de auditoría revierte toda mutación PostgreSQL;
- disable/enable nunca anuncian éxito antes de observar Auth y DB;
- una clave idempotente no puede cambiar target ni resultado;
- estados ambiguos son visibles y reconciliables;
- errores externos se reducen a códigos estables;
- secretos, PII, cuentas, URLs completas y mensajes están prohibidos;
- la allowlist futura tiene 18 rutas exactas y no abre implementación.

## Límites

Esta revisión no crea `0271`, no modifica acciones/adapters, no toca Auth,
Cloud, correos, PDFs, documentos vivos o Vercel, y no abre D2–D5.
