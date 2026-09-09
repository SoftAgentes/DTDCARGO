---
sdd: "0327"
title: "Cookie autenticada para sesiones de operario"
status: done
author: "Codex"
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0030", "0235"]
confidencialidad: interno
---

# SDD-0327 · Cookie autenticada para sesiones de operario

## Problema

La cookie móvil `dtd_op` contenía el UUID desnudo de un operario. Aunque era
HTTP-only, difícil de enumerar y se revalidaba contra una fila activa, quien
conociera un UUID vigente podía escribir la cookie manualmente sin demostrar el
PIN. La consulta posterior probaba que el operario existía, no que la identidad
había sido emitida por el servidor.

## Decisión

- Sellar la identidad con el primitivo AEAD AES-256-GCM ya compartido por el
  repositorio, usando propósito y versión exclusivos `dtd-operario-session-v2`.
- Incluir `operario_id`, `tenant_id`, emisión y vencimiento interno de 12 horas.
- Rechazar firma, forma, UUID, tenant, reloj o vida útil inválidos antes de
  crear el cliente administrativo o consultar datos.
- Volver a consultar la fila activa por `id + tenant_id` en cada request.
- Usar `OPERARIO_SESSION_SECRET` cuando exista; usar como fallback el
  `SUPABASE_SERVICE_ROLE_KEY` ya obligatorio. Cualquier secreto menor a 32
  caracteres hace fallar cerrado el login y la lectura.
- No aceptar el UUID V1 como fallback. Al desplegar, las sesiones existentes se
  cierran una sola vez y cada operario vuelve a introducir su PIN.
- Mantener `Secure` en producción, `HttpOnly`, `SameSite=Lax`, path `/m` y el
  borrado explícito al cerrar sesión.

## Alcance

- `lib/auth/operario-session-token.ts`
- `lib/auth/operario-session.ts`
- pruebas unitarias de token e integración estructural
- `.env.example`, documentación móvil e índice SDD generado

No cambia PIN, RPC, schema, RLS, datos ni Cloud. La cookie de modo permanece sin
firma porque sólo se acepta si el modo pertenece a los roles reconsultados de la
identidad autenticada; no amplía privilegios.

## Criterios de aceptación

- Cookie válida recupera exactamente operario y tenant.
- Token manipulado, secreto distinto, expiración o UUID desnudo devuelven
  sesión nula sin lanzar ni consultar DB.
- El token no expone los UUID en claro.
- La consulta enlaza simultáneamente `id` y `tenant_id` y conserva el chequeo
  `active`.
- `pnpm typecheck`, lint, tests focales y verificación canónica quedan verdes.

## Rollout y rollback

El despliegue no necesita una variable nueva porque el service role ya existe;
se recomienda configurar después un secreto dedicado de al menos 32 caracteres.
El corte invalida las cookies anteriores deliberadamente. El rollback es un
revert de código, nunca reactivar la aceptación del UUID legado como fallback.
