# Realtime de conversaciones Portal · SDD-0401 / 0433 · evidencia local

Fecha: 2026-09-04

Alcance: PostgreSQL local desechable, documentación y gates proporcionales

Fuera de alcance: Cloud, mensajes reales, push, `main`, despliegue y limpieza

## Hallazgo reproducido

La policy histórica `conv_messages portal client read own` consultaba
`conversations` desde el principal Portal. Como esa tabla sólo expone la policy
tenant-wide del equipo, la subconsulta no veía el hilo y un principal válido
recibía cero filas de `conversation_messages`. El fallback de refresco a los 45
segundos ocultaba parcialmente el fallo funcional.

Además, `get_portal_client_id()` podía resolver un cliente cuyo tenant no
coincidía con `client_users.tenant_id`. No se usó ese helper como autoridad del
correctivo.

## Correctivo preparado

La migración `0433_portal_conversation_realtime_principal_tenant`:

- crea un helper booleano `SECURITY DEFINER` que no devuelve contenido ni ids;
- liga la autorización a `auth.uid()`, vínculo activo, cliente vivo, tenant
  coherente, conversación viva, canal Portal y tenant del mensaje;
- concede ejecución sólo a `authenticated`, no a `PUBLIC`, `anon` ni
  `service_role`;
- sustituye únicamente la expresión `USING` de la policy SELECT Portal;
- preserva policies de equipo/servicio, RLS, ACL de tabla y escrituras.

## Evidencia ejecutada

- RED causal: el principal Portal coherente recibió cero mensajes antes de
  aplicar 0433.
- GREEN focal: el principal coherente vio sólo su mensaje; vínculo incoherente,
  vínculo revocado, canal no Portal, conversación borrada y tenant discordante
  quedaron fuera.
- Escritura directa Portal rechazada; staff conservó sus tres mensajes del
  tenant y `service_role` sus cinco filas del fixture.
- ACL del helper verificada: `authenticated=true`, `anon=false`,
  `service_role=false`, sin privilegio de `PUBLIC`.
- Preflight fail-closed verificado para policy inesperada, policy objetivo
  ausente y RLS deshabilitado.
- `node scripts/run-sql-tests.mjs`: 175/175 contratos verdes. Una primera
  corrida se interrumpió al apagarse Docker Desktop; tras reactivar el motor,
  la repetición completa terminó en exit 0.
- `node scripts/check-schema-rebuild.mjs`: 430 migraciones, 412 aplicadas desde
  cero, 18 sólo-ledger y aislamiento multi-tenant en 219 tablas.

## Estado y límites

- Local: **CORRECTO** para el contrato acotado de SDD-0401.
- Producción: **NO VERIFICABLE**; 0433 no se aplicó ni se consultó Cloud.
- El contador histórico permanece 56/106 (52,8 %). Este correctivo no crea una
  casilla nueva.
- Quedan 33 migraciones preparadas 0401–0433 según el último ledger verificado
  0400. Push, `main`, despliegue y limpieza requieren autorización separada.
