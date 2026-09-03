---
title: Direcciones Portal - aislamiento local por principal y tenant
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
confidencialidad: interno
---

# Direcciones Portal · SDD-0372 · evidencia local

## Resultado

Correctivo 0425 preparado y probado sólo en PostgreSQL 17.10 desechable;
conservado en el commit local 3d3ab047. No aplicado en Cloud.
La reproducción ejecutó las migraciones 0006, 0080, 0198, 0230 y 0347, sin
desactivar triggers/RLS. Dos tenants sintéticos comparten Shipping Mark.

Antes: PortalA leyó una direcciónB, insertó para clientB (el trigger selló
tenantB aunque el input dijera A) y modificó una direcciónB. La aserción de
aislamiento falló causalmente (psql exit3); no es una inferencia de texto SQL.
Después: 54 aserciones, exit 0. Fixture y auth ausentes tras ROLLBACK; el
contenedor exclusivo se retiró. Sin Cloud ni direcciones reales.

## Cobertura

- Lectura propia A/B y rechazo recíproco, INSERT/UPDATE ajenos y DELETE físico.
- Mismo tenant con otro cliente, vínculo incoherente, revoked/invited,
  cliente retirado, principal sin vínculo y miembro de equipo deshabilitado.
- Sellado de identidad, índice único de predeterminada y edición propia.
- Renombre coherente conserva acceso por client_id; no ejecuta la RPC completa
  de renombre, sólo la propagación equivalente sobre sus relaciones.
- Equipo conserva CRUD permitido y soft delete; anon no obtiene lectura;
  service_role conserva acceso.
- Datos, ACL, triggers, índices, helpers y policies ajenas preservados;
  reejecución idéntica; siete variantes de drift rechazadas.
- Rebuild general pasó 422 migraciones, incluida 0425. El pase integrado final
  pasó los 167 contratos, incluido el nuevo 0425 (el primer pase ejecutó 166).

Contrato: supabase/tests/0425_portal_delivery_addresses_tenant_boundary.test.sql.
Migración: supabase/migrations/0425_portal_delivery_addresses_tenant_boundary.sql.
El preflight comprueba inventario/forma de policies; no afirma comparar todas
las expresiones históricas de las policies ajenas. Su revisión Cloud sigue
siendo obligatoria y requiere permiso nominal.

## Fallo preexistente separado

Soft delete de la propia dirección Portal devuelve 42501 por la interacción
SELECT/UPDATE RLS, tanto antes como después del correctivo. El test afirma
el rechazo y la conservación de la fila. No se abrió SELECT de históricos
para ocultarlo y no se anuncia que eliminar ya funciona. Requiere un comando
acotado y contrato propios, no ensanchar 0425 ni modificar 0198 aplicada.

## Privacidad y autorización

CORRECTO técnico: las tres expresiones nuevas exigen principal activo,
tenant coherente y client_id, además del Shipping Mark; no hay DML ni campos
nuevos. NO VERIFICABLE: estado efectivo de estas policies en producción.
No constituye auditoría legal ni certificación global del Portal.

Las 24 migraciones anteriores siguen pendientes de autorización independiente.
0425 es una preparación adicional, no parte del permiso de 0400. Tampoco se
autoriza nuevo push, main, deploy, lectura de PII o limpieza final.
