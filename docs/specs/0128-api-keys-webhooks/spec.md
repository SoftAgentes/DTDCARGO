---
sdd: "0128"
title: "API keys & webhooks — gestión de credenciales de integración (tokens hasheados + webhooks salientes)"
status: done
author: "Claude Code (sesión secundaria · worktree web-norte) + founder"
created: 2026-07-01
updated: 2026-07-15
supersedes: null
superseded_by: null
related: ["0085", "0043"]
confidencialidad: interno
---

# SDD-0128 · API keys & webhooks

> Primera sección **PRO** real de Administración. Gestiona credenciales de
> integración. Migración 0193.

## Seguridad (lo importante)

- El **token en claro NUNCA se guarda**: se genera server-side
  (`randomBytes`), se almacena solo su **SHA-256** (`key_hash`) + un prefijo
  visible (`key_prefix`) para identificarlo. El token completo se devuelve UNA
  vez en el state de la action y se muestra con aviso de "cópialo ahora".
- `key_hash` **nunca se selecciona** en las queries (no se expone).
- Revocar = `revoked_at` (efecto inmediato una vez que exista el consumidor).
- Edición **admin-only** (`moduleEditDenial("admin")`); RLS por tenant.
- Webhook `secret` (firma HMAC) se guarda en claro a propósito: es un secreto
  compartido con el receptor, se muestra para configurarlo del otro lado.

## Modelo de datos (migración 0193)

- `api_keys` — name, key_prefix, key_hash (unique), last_used_at (nullable),
  created_by, revoked_at.
- `webhooks` — name, url, events (jsonb), secret, active, soft-delete.

Ambas RLS por tenant, grants explícitos, `revoke all from anon`.

## Frontera (follow-up)

⚠️ Esto modela la **gestión**. El **consumo** no existe todavía:
- Middleware que autentique requests entrantes contra `api_keys` (hash-match).
- Dispatcher que dispare los `webhooks` en cada evento + firme con `secret`.

Sin ese consumidor, las filas no autorizan ni disparan nada. La sección lo
avisa explícitamente en la UI.

## Superficie de código

- `lib/studio/api-integration-{types,queries}.ts`.
- `app/studio/(app)/admin/api-integration-actions.ts` — create/revoke key,
  save/delete webhook (admin-gated; `node:crypto`).
- `_components/ApiIntegrationSection.tsx` + `WebhookDrawer.tsx`.
- `app/studio/(app)/admin/page.tsx` — fetch + render.

## Estado

Código listo; `pnpm typecheck` + build en verde. Migración
`0193_api_keys_webhooks.sql` en la rama, **no aplicada a prod**.
