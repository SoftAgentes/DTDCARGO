---
sdd: "0401"
title: Realtime de conversaciones Portal por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0148", "0355", "0385"]
confidencialidad: interno
---

# SDD0401 · Realtime de conversaciones Portal por principal y tenant

> **Nota de importación — 2026-09-11, actualizada tras la aplicación.** Esta spec entró a
> `main` desde la PR #21 con su contenido original, `status: done` incluido. Su migración
> `0433_portal_conversation_realtime_principal_tenant` **fue APLICADA a producción el
> 2026-09-11** con OK nominal de Sam (ledger
> `20260912000449 / 0433_portal_conversation_realtime_principal_tenant`) y se verificó contra
> el objeto; el registro y la vuelta atrás están en
> `.agents/handoffs/lote-11-migraciones-aplicadas-20260911.md`. Queda pendiente validar aparte
> la suscripción Realtime autenticada de `/portal/soporte`; el sondeo de 45 s sigue como
> respaldo.

## Evidencia y autoridad

La policy `conv_messages portal client read own` filtra mensajes mediante una
subconsulta a `conversations`. Esa tabla sólo tiene la policy tenant-wide del
equipo, de modo que un principal Portal no ve el hilo dentro de la subconsulta y
Realtime no entrega mensajes. Además, `get_portal_client_id()` no comprueba que
`client_users.tenant_id` coincida con el tenant del cliente.

La pantalla sigue funcionando mediante el fallback de refresco y una fachada
server-side ya endurecida; este slice corrige únicamente la autorización RLS de
la entrega Realtime. Usa fixtures sintéticos y no autoriza Cloud, mensajes
reales, push, `main`, despliegue ni limpieza.

## Contrato acotado

- Crear una función booleana SECURITY DEFINER sin datos de salida, ligada a
  `auth.uid()`, vínculo activo, cliente vivo, tenant coherente y canal Portal.
- Exigir coherencia entre el tenant del mensaje y el tenant de su conversación.
- Usar esa función sólo en la policy SELECT Portal de `conversation_messages`.
- Revocar ejecución a `PUBLIC` y `anon`; autorizar sólo `authenticated`.
- Conservar policies de equipo/servicio, RLS, ACL de tabla y escrituras.

## Allowlist exacta

- `supabase/migrations/0433_portal_conversation_realtime_principal_tenant.sql`.
- `supabase/tests/0433_portal_conversation_realtime_principal_tenant.test.sql`.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra que el principal Portal válido recibe cero mensajes.
- [x] GREEN entrega sólo mensajes vivos de su hilo Portal y mismo tenant.
- [x] Vínculo incoherente/revocado y mensaje con tenant discordante quedan fuera.
- [x] Staff y `service_role` conservan su acceso histórico.
- [x] La función no expone contenido/ids y `anon` no puede ejecutarla.
- [x] Contratos SQL, rebuild, documentación y gates proporcionales quedan verdes.
- [x] 0433 permanece sin aplicar y el checklist original sigue 56/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; autorización cruza principal, tenant y entidad.
- `SGE-00.07`: cumplimiento; Realtime puede reflejar el estado durable sin
  depender únicamente del sondeo tardío.
- `AUD-01` y `MP-01`: no aplica; no hay mutación ni cambio de permanencia.
