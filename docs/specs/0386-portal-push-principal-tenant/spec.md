---
sdd: "0386"
title: Web Push Portal por principal y tenant coherentes
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0146", "0148", "0383", "0384"]
confidencialidad: interno
---

# SDD0386 · Web Push Portal por principal y tenant coherentes

## Evidencia y autoridad

La numeración 0386 se comprobó contra 15 refs actualizadas. El alta Web Push
del Portal eleva a `service_role` después de leer únicamente `tenant_id` de una
fila activa de `client_users`; no comprueba cliente vivo ni coherencia entre el
tenant del vínculo y el del cliente. La baja acepta cualquier sesión Supabase y
no demuestra que siga siendo un principal Portal. Ambos endpoints reciben un
endpoint push, que funciona como identificador técnico sensible del navegador.

No se usan suscripciones, cuentas, endpoints ni servicios reales. Este slice no
añade SQL ni autoriza Cloud, envío push, push Git, `main`, deploy o limpieza.

## Contrato acotado

- Extender el principal canónico con el `userId` autenticado que ya verifica.
- Resolver alta y baja mediante `getPortalClientPrincipal()`; exigir vínculo
  activo, cliente vivo y tenant coherente antes de construir `service_role`.
- Derivar `user_id` y `tenant_id` sólo del principal, nunca del body.
- Conservar normalización de la suscripción, user agent limitado, rebind por
  endpoint y baja filtrada por endpoint + usuario.
- Contener fallos de sesión y construcción admin en respuestas controladas sin
  mutación ni exposición de detalles internos.
- No modificar tabla, RLS, ACL, service worker, payload push ni rutas Studio/móvil.

## Allowlist exacta

- `lib/portal/portal-queries.ts`.
- `app/api/portal/push/subscribe/route.ts`.
- `app/api/portal/push/unsubscribe/route.ts`.
- `app/api/portal/push/__tests__/subscription-principal.test.ts`.
- Ajuste mínimo de la fixture compartida `subscribe-boundary.test.ts`.
- Esta spec, índice, auditoría local, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra mutación con vínculo incoherente/retirado y baja no Portal.
- [x] Auth fallido o principal inválido deja cero construcciones admin y DML.
- [x] Principal válido conserva alta/rebind y baja propia.
- [x] Falla admin produce respuesta controlada y cero excepción al caller.
- [x] Contratos focales, tipos, lint y suite proporcional quedan verdes.
- [x] Revisión focal separa evidencia local de operación no verificable.
- [x] Checklist histórico permanece 56/106.

Gobernanza: no conformidad de identidad previa a elevación corregida y
verificada localmente. No hay cambio visual.
