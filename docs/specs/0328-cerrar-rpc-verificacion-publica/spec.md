---
sdd: "0328"
title: "Cerrar el bypass público del throttle de verificación"
status: in-progress
author: "Codex"
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0093", "0169", "0258"]
confidencialidad: interno
---

# SDD-0328 · Cerrar el bypass público del throttle de verificación

## Problema

`/verificar` limita por IP antes de confirmar un Shipping Mark o mostrar un
diploma. Sin embargo, las RPC `markbox_existe_publico(text)` y
`academy_verify_diploma(text)` conservaban `EXECUTE` para `anon` y
`authenticated`. Cualquier cliente de Data API podía invocarlas directamente,
saltarse el límite y enumerar códigos secuenciales; la de diplomas además
devuelve nombre del alumno, curso, fecha, duración y lugar.

## Evidencia actual

- La página aplica `isVerifyThrottled()` antes de cualquier lookup.
- Shipping Mark se resuelve con `createAdminClient().rpc(...)`.
- Diploma se consulta con el mismo cliente administrativo.
- No hay llamadores de navegador ni de rol autenticado en el repositorio.
- La documentación vigente de Supabase distingue permisos de Data API y RLS, y
  recomienda revocar `EXECUTE` de funciones no destinadas a roles públicos.

## Decisión

La migración forward `0400_revoke_public_verify_rpc_execute.sql`:

1. revoca `PUBLIC`, `anon` y `authenticated` de ambas firmas;
2. concede `EXECUTE` sólo a `service_role`;
3. conserva cuerpos, firmas y resultados para no cambiar la página;
4. actualiza comentarios de catálogo para hacer visible el contrato.

No se mueve ni borra información, no se cambia el throttle y no se aplica la
migración a Cloud dentro de este carril.

## Criterios de aceptación

- `has_function_privilege` es falso para `anon` y `authenticated` en ambas RPC.
- `service_role` conserva `EXECUTE` en ambas RPC.
- `/verificar` sigue llamando únicamente después del throttle.
- Contrato SQL focal, reconstrucción completa, typecheck, lint, E2E y build
  quedan verdes localmente.
- El estado sólo pasa a `done` después de autorización nominal, aplicación
  individual y verificación del ACL real en Producción.

## Rollout y rollback

Aplicar únicamente con autorización que nombre
`0400_revoke_public_verify_rpc_execute.sql`, siguiendo el runbook de migraciones.
Verificar los cuatro `has_function_privilege` negativos y los dos positivos,
después hacer un smoke de un QR de carga y un diploma reales aprobados. Ante una
regresión, corregir con otra migración forward; no restaurar acceso anónimo como
atajo.
