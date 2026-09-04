---
title: Web Push Portal por principal y tenant coherentes
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
review-by: 2026-09-10
confidencialidad: interno
---

# SDD0386 · Web Push Portal

## Estado

Correctivo local verificado, sin migración. No se usaron endpoints, cuentas,
suscripciones o entregas push reales. No hubo escritura Cloud, push Git,
integración en `main`, deploy ni limpieza. La numeración 0386 se confirmó
contra 15 refs actualizadas.

## Reproducción causal

La prueba ejecutó las dos rutas reales con sesión, relación Portal, admin y DML
sintéticos. El baseline produjo 7 fallos y 2 controles:

- alta con vínculo tenant A → cliente de tenant B: respuesta 200 y upsert;
- alta con cliente retirado: respuesta 200 y upsert;
- baja con vínculo incoherente: respuesta 200 y delete;
- error Auth con user presente: ignorado y mutación;
- fallo al construir sesión o admin: excepción al caller.

La fixture está en `subscription-principal.test.ts:138-205`. No demuestra que
una cuenta pueda crear la relación incoherente ni que exista en producción.

## Delta

- El principal canónico ahora devuelve el `userId` obtenido internamente de
  `auth.getUser()`; no acepta ids proporcionados por callers
  (`portal-queries.ts:48-64`, `:92-118`).
- Alta y baja verifican sesión, luego vínculo activo, cliente vivo y tenant
  coherente antes de construir admin (`subscribe/route.ts:18-36`,
  `unsubscribe/route.ts:15-32`).
- El upsert deriva tenant/user del principal y conserva normalización,
  user-agent limitado y rebind por endpoint (`subscribe/route.ts:38-90`).
- La baja conserva el filtro conjunto endpoint + usuario y contiene fallos del
  constructor admin (`unsubscribe/route.ts:34-68`).
- La fixture compartida de las cuatro superficies ahora representa la relación
  Portal completa; no cambia expectativas de Studio o móvil.

## Revisión focal de datos

Esta revisión técnica no afirma cumplimiento legal.

| Dato | Uso observable | Estado |
|---|---|---|
| Endpoint y claves Web Push | Entrega al navegador opt-in | CORRECTO local: sólo payload normalizado |
| `user_id` y `tenant_id` | Enlace de la suscripción | CORRECTO local: sólo principal coherente |
| User-Agent, máximo 300 caracteres | Diagnóstico del dispositivo | CORRECTO local: límite preservado |

- `CORRECTO` — minimización: no agrega campos, destinos, terceros o contenido;
  reduce quién puede escribir/borrar la suscripción.
- `CORRECTO` — las regresiones demuestran cero construcción admin y cero DML
  para tenant cruzado, cliente retirado, error Auth o transporte
  (`subscription-principal.test.ts:138-166`).
- `NO VERIFICABLE` — consentimiento efectivo del navegador, retención, purge,
  backups, logs del endpoint/user-agent, entrega real y accesos alojados. No se
  consultó infraestructura ni se envió una notificación.

## Verificación local

- RED: 7 fallos / 2 controles aprobados.
- GREEN focal: 186/186 en tres archivos.
- Conjunto Portal: 867/867 en 61 archivos, 38,78 s.
- TypeScript y ESLint focal: aprobados; el focal definitivo se repitió tras
  impedir que callers proporcionaran el `userId`.
- Sin SQL: no se repitieron los 173 contratos/rebuild ya verdes de SDD0385.

## Límites

- No se verificó el proveedor Web Push ni se cambió el diseño histórico de
  rebind por endpoint compartido.
- No se modifica Push de Studio, móvil, service worker, RLS o esquema.
- Producción continúa `NO VERIFICABLE` hasta push/deploy/smoke autorizados.
- El checklist original sigue 56/106; este correctivo no crea una casilla.
