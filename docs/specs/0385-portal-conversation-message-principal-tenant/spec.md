---
sdd: "0385"
title: Mensajes Portal por principal y tenant coherentes
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0056", "0042", "0382", "0384"]
confidencialidad: interno
---

# SDD0385 · mensajes Portal por principal y tenant coherentes

> **Nota de importación — 2026-09-11, actualizada tras la aplicación.** Esta spec entró a
> `main` desde la PR #21 con su contenido original, `status: done` incluido. Su migración
> `0431_portal_post_message_principal_tenant` **fue APLICADA a producción el 2026-09-11** con
> OK nominal de Sam (ledger `20260912000336 / 0431_portal_post_message_principal_tenant`) y se
> verificó contra el objeto: `portal_post_message(text)` conserva firma, retorno `uuid`,
> `SECURITY DEFINER` y la ACL de `authenticated`/`service_role`. El registro y la vuelta atrás
> están en `.agents/handoffs/lote-11-migraciones-aplicadas-20260911.md`.

## Evidencia y autoridad

La numeración 0385 y la migración 0431 se comprobaron contra 15 refs después
de `git fetch origin`. La definición vigente de
`public.portal_post_message(text)` deriva primero `client_id` mediante
`get_portal_client_id()` y después confía en el tenant del cliente encontrado.
Las FK independientes de `client_users` admiten que una fila administrativa
activa declare tenant A y cliente B; una reproducción sintética demuestra que
esa incoherencia crea conversación y mensaje para B. La fixture no demuestra
que un usuario pueda crear el vínculo inconsistente.

No se usan datos ni servicios reales. Este slice prepara una migración nominal
local; no autoriza aplicarla, consultar filas de negocio, hacer push, integrar
`main`, desplegar ni limpiar worktrees.

## Contrato acotado

- Resolver en una sola consulta `auth.uid()` → `client_users` activo → cliente
  vivo, exigiendo igualdad entre tenant del vínculo y tenant del cliente.
- Fallar con SQLSTATE `42501` antes de cualquier escritura cuando la sesión, el
  vínculo, el estado, el cliente o la coherencia tenant/cliente no sean válidos.
- Conservar validación y trim de cuerpo, límite de 4000 caracteres, creación o
  reutilización del hilo Portal vivo, mensaje inbound, contador, timestamp y
  reapertura de hilos resueltos.
- Preservar `SECURITY DEFINER`, propietario, retorno UUID y ACL efectivo:
  `authenticated` y `service_role` sí; `PUBLIC` y `anon` no.
- Fijar `search_path` a `pg_catalog, public` y calificar relaciones y helpers.
- No cambiar tablas, RLS, policies, índices, triggers, filas o el correlativo.

## Allowlist exacta

- `supabase/migrations/0431_portal_post_message_principal_tenant.sql`.
- `supabase/tests/0431_portal_post_message_principal_tenant.test.sql`.
- Esta spec, `docs/specs/README.md` generado y auditoría local del slice.
- Checklist de arranque y handoff del saneamiento.

## Aceptación

- [x] RED causal reproduce escritura cruzada con vínculo tenant/cliente incoherente.
- [x] Principal incoherente, retirado, revocado, invitado, ausente o sin UID queda bloqueado sin DML.
- [x] Principal válido crea/reutiliza sólo su hilo y conserva semántica inbound.
- [x] Definición, propietario, ACL y `search_path` cumplen el contrato.
- [x] Reejecución es idempotente y el preflight revierte drift sin cambios parciales.
- [x] Contrato SQL completo y reconstrucción del schema quedan verdes.
- [x] Checklist histórico permanece veraz sin inflar 56/106.

Gobernanza: no conformidad de aislamiento corregida localmente y verificada.
Producción continúa `NO VERIFICABLE` hasta su gate nominal independiente.
No hay cambio visual ni tratamiento nuevo de datos personales.
