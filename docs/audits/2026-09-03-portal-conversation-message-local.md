---
title: Mensajes Portal por principal y tenant coherentes
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
review-by: 2026-09-10
confidencialidad: interno
---

# SDD0385 · mensajes Portal

## Estado

Correctivo SQL local verificado. La migración 0431 quedó preparada pero no se
aplicó en Cloud. Tampoco se consultaron filas reales, se hizo push, se integró
`main`, se desplegó ni se limpió un worktree. La numeración 0385/0431 se
confirmó contra 15 refs actualizadas.

## Reproducción causal

La función histórica resolvía sólo `client_id` con
`get_portal_client_id()` y después tomaba el tenant desde `clients`. La fixture
real admite, por sus FK independientes, un vínculo activo tenant A → cliente B.
Antes de aplicar el correctivo, ese principal creó un hilo y un mensaje inbound
para B (`0431_portal_post_message_principal_tenant.test.sql:101-117`). La
primera expectativa posterior falló en RED porque la llamada no produjo
SQLSTATE `42501` (`:189-192`).

La inconsistencia se inyectó administrativamente. No demuestra que un cliente
pueda crearla ni que exista en producción. No se usaron identidades, mensajes,
cuentas o servicios reales.

## Delta

- El preflight exige helpers, firma UUID/`SECURITY DEFINER`, RLS en las cuatro
  relaciones y el ACL efectivo ya vigente (`0431...sql:5-50`).
- El principal se resuelve en una sola consulta: `auth.uid()` → vínculo activo
  → mismo tenant → cliente vivo; cero o más de un match falla cerrado con
  `42501` (`:74-93`).
- El hilo se busca y actualiza por tenant, cliente y canal; creación, mensaje
  inbound, contador y reapertura conservan la semántica histórica (`:95-123`).
- `search_path` queda en `pg_catalog, public`; propietario y retorno se
  preservan. `PUBLIC`/`anon` no ejecutan y `authenticated`/`service_role` sí
  (`:52-56`, `:129-130`).
- No cambia tablas, policies, índices, triggers, correlativos o filas.

## Revisión focal de datos

Esta revisión técnica no afirma cumplimiento legal.

- `CORRECTO` — minimización del delta: no agrega campos, categorías, destinos,
  terceros ni logs; reduce la escritura al principal Portal coherente.
- `CORRECTO` — el contrato demuestra cero DML para vínculo incoherente, cliente
  retirado, estados revoked/invited, usuario sin vínculo y sesión sin UID
  (`0431...test.sql:176-206`).
- `CORRECTO` — el flujo válido conserva sólo el cuerpo normalizado, el nombre
  existente y las referencias necesarias al hilo (`:208-250`).
- `NO VERIFICABLE` — propósito comunicado, retención, borrado, backups, logs,
  acceso del equipo, base jurídica y transferencias transfronterizas reales.
  Este slice no inspeccionó infraestructura ni datos alojados.

## Verificación local

- RED causal: el vínculo tenant A → cliente B escribió el hilo/mensaje B y la
  expectativa fail-closed terminó con exit 3.
- GREEN focal: 22/22 aserciones; incluye seis principales inválidos, cero DML,
  happy path, reuso, reapertura, inputs, ACL, definición, idempotencia, drift y
  rollback total.
- Regresión: 173/173 contratos SQL, todos con rollback.
- Rebuild: 428 archivos; 410 migraciones aplicadas desde cero, 18 sólo-ledger;
  aislamiento verificado en 219 tablas y dos tenants sintéticos.
- El warning de `wal_level` pertenece a la publicación efímera sin
  subscripciones y no invalida el contrato.

## Límites

- 0431 es un gate Cloud nuevo e independiente; no quedó autorizado ni aplicado.
- La aplicación debe seguir el runbook nominal, de una migración por vez, con
  preflight fresco y verificación posterior.
- El último ledger verificado sigue en 0400; producción continúa
  `NO VERIFICABLE` para este RPC.
- El checklist original permanece 56/106; este correctivo no crea una casilla.
