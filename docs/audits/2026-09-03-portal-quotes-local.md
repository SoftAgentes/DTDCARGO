---
title: Cotizaciones Portal por principal y tenant
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
review-by: 2026-09-10
confidencialidad: interno
---

# SDD0380 · cierre local de cotizaciones Portal

## Alcance y causa

Trabajo sólo local, posterior a ef6101c4. Numeración consultada en15refs:
0380 y0428 disponibles. No Cloud, PII, push, main, deploy ni limpieza final.

La policy0117 comparaba sólo Shipping Mark. Reproducción independiente con
migraciones0006/0007/0080/0113/0117/0230 reales y fixtures sintéticos:
Portal A lee una cotización B con el mismo markbox; al retirar su cliente,
conserva tres cotizaciones visibles (dos propias y una ajena). El modo RED
apply_fix=false falla por esa lectura, no por falta de archivo/importación.

## Corrección acotada

- 0428 altera sólo quotes portal self read. Vincula auth.uid(), relación activa,
 cliente vivo y tenant coherente entre vínculo, cliente y cotización.
 Conserva condición no borrada y Shipping Mark coincidente.
- Preflight valida RLS e inventario de policies, roles, comandos y forma básica.
 No pretende verificar equivalencia semántica completa del SQL previo.
- No DML, nuevas RPC, SECURITY DEFINER, ACL, índices, triggers ni política de equipo.
- Las queries de cotizaciones resuelven identidad con el cliente de sesión y
 filtran tenant+markbox, también en sesiones híbridas. Sin identidad verificable,
 devuelven vacío; no caen a admin ni a un Shipping Mark aislado.
- Códigos de envíos vinculados: mismo ámbito. Un enlace ajeno conserva código
 null. Se mantienen split web/studio, orden, límite100, mapeos y etiquetas.

## Evidencia ejecutada

| Control | Resultado |
|---|---|
| SQL independiente0428 | 63 aserciones, PostgreSQL17 desechable, exit0 |
| Preflight | 8 derivas rechazadas; reejecución idempotente |
| Conservación | Filas y catálogo ajeno iguales; equipo, servicio y unión de derechos híbridos preservados |
| Queries reales con transporte sintético | RED18 fallos/4 controles; GREEN22 nuevos+9 históricos |
| Suite unitaria completa congelada | 7.149/7.149 en553archivos,421,24s, sin reintento |
| Contratos SQL completos | 170 aprobados |
| Reconstrucción | 425 archivos:407 ejecutables+18 sólo-ledger;219 tablas y2 tenants sintéticos |
| Estática | Tipos y lint focal correctos; documentación/componentes/gobernanza correctos |

Los controles SQL incluyen bajas, invitados, revocación, incoherencia,
principal ausente, otro cliente, cotizaciones borradas/huérfanas/sin markbox,
escritura Portal denegada, operaciones del equipo e históricos de servicio.
Los controles de aplicación no simulan RLS: el transporte aplica realmente
los filtros solicitados, para detectar la falta de tenant incluso en híbridos.

Logs de suite e inventario en outputs/e2e-lifecycle-2026-09-03T2207/.
Postgres aislado sin red, fixtures sintéticos, rollback y retirada comprobada
únicamente de los contenedores propios. No se consultó producción.

## Inventario para continuar

Un rebuild completo posterior0428 consultó pg_policies efectivo. Quedan ocho
policies que mencionan get_portal_client_* en seis tablas: client_change_requests,
clients, conversation_messages, prealerta_addons, prealerta_service_requests
(tres) y warehouse_boxes. Es inventario de ese patrón, no auditoría exhaustiva.
La siguiente reproducción se centra en las tres policies Portal de solicitudes
de recepción, sin inferir que todas las ocho son vulnerables.

## Pendientes

- Aplicación nominal0428 y permisos posteriores; nuevo push/publicación externos.
- No hay E2E autenticado de cotizaciones: el150/18 de0378 precede este delta.
- RBAC del equipo, escrituras de cotización y demás consumidores Portal no incluidos.
- 28 migraciones preparadas0401–0428, derivadas del último ledger0400 verificado.
 El checklist original continúa56/106: no se suman estos subpasos al denominador.
