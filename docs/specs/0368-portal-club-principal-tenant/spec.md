---
sdd: "0368"
title: Aislar el principal de Club por vínculo, cliente y persona
status: in-progress
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0042", "0106", "0116", "0362"]
confidencialidad: interno
---

# SDD-0368 — Club Portal: coherencia del principal

## Objetivo y evidencia inicial

El helper `get_portal_person_id()` de0187 resuelve la persona mediante
`get_portal_client_id()` y comprueba cliente vivo, pero no compara el tenant
del vínculo client_users, del cliente y de la persona. Las FK simples no
imponen esa igualdad. Seis policies SELECT de0187/0235 dependen del helper:
membresía, rondas, participaciones, eventos, inscripciones y proveedor destacado.

La búsqueda en app/lib/components/scripts/supabase sólo encontró consumidores
SQL en esas seis policies, sin invocadores RPC literales en la aplicación.
Esto acota el cambio, no demuestra ausencia de consumidores externos.
La prueba debe demostrar el efecto con las migraciones originales y datos
sintéticos; no se afirma explotación ni presencia de vínculos corruptos en Cloud.

El catálogo alojado fue leído el2026-09-02 (Caracas) sin filas de negocio:
helper OID25301, owner postgres, uuid/SQL/STABLE/SECURITY DEFINER,
search_path=public y cuerpo MD5 `d6d407d74ea4426a960fe03991625b35`, idéntico
al texto0187. `pg_depend` confirma las seis policies consumidoras; las seis
tablas tienen exactamente dos policies (interna ALL y Portal SELECT), todas
authenticated/permissive. RLS está activo en esas seis y client_users/clients/persons.
Esto prueba definición/configuración, no incidencia sobre personas reales.

Numeración consultada con `pnpm sdd:next`:15 refs,0368/0424 libres.
No se reservó mediante push. La solicitud de saneamiento continuo permite
preparar/verificar el correctivo local, no aplicar la migración alojada.

## Contrato y límites

1. Sustituir únicamente el cuerpo/configuración del helper existente.
   Sigue sin parámetros, devuelve uuid o NULL, STABLE y SECURITY DEFINER.
   No crea una nueva API elevada ni nuevos grants.
2. Resolver desde auth.uid(), vínculo active, cliente no eliminado y persona
   existente. Igualdad obligatoria: vínculo.tenant = cliente.tenant = persona.tenant.
   Sin parámetros del cliente ni claims editables para la autorización.
3. Preservar la membresía por persona, no por Shipping Mark. Un código repetido,
   vacío o ausente no otorga acceso ni lo retira a una persona correctamente ligada.
4. Preservar las seis policies, sus reglas de estados y la operación interna:
   membresía propia incluso pausada/cancelada, participaciones e inscripciones
   propias conservadas; sólo activos ven rondas abiertas, eventos Club y proveedor
   publicado. No exigir padre abierto/vivo nuevo para leer historia propia.
5. No cambiar el estado de autorización por archivar persons: el contrato actual
   lo determina el vínculo active y cliente vivo. Se valida identidad/tenant,
   no se inventa una política de retención/desactivación adicional.
6. Sin DML, ACL, policies, triggers, columnas, UI, precios, planes, cuotas,
   Storage o cambios a get_portal_client_id/get_user_tenant_id.
   No se certifica RBAC interno ni toda integridad del Club.
7. Preflight fail-closed: dependencias, RLS, firma/propiedades/cuerpo del helper
   y seis consumidores esperados por identidad/dependencia. No certifica todos
   los predicados internos heredados. Postflight comprueba la definición final.
   Conservar owner, firma y permisos efectivos existentes.
8. Aplicación Cloud sólo nominal y transaccional, separada de push/merge/deploy.
   No requiere nueva RPC ni consumidor nuevo. Repetir preflight fresco al aplicar.
   Sin lecturas de personas/miembros reales ni invocación alojada para probar.

## Allowlist exacta y ownership

- `supabase/migrations/0424_portal_club_principal_tenant.sql` — agente principal.
- `supabase/tests/0424_portal_club_principal_tenant.test.sql` — reproducción independiente.
- `docs/specs/0368-portal-club-principal-tenant/spec.md` — agente principal.
- `docs/specs/README.md` — índice generado.
- `docs/audits/2026-09-02-codex-arranque-checklist.md` — agente principal.
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md` — agente principal.

## Plan y criterios de aceptación

- [x] RED causal con helper y seis policies reales: vínculo→cliente de otro
  tenant y cliente→persona de otro tenant; medir helper y las seis lecturas.
  No basta fallar porque0424 no existe. No crear datos fuera del contenedor propio.
- [x] GREEN para ambos cruces; controles A/B, cliente eliminado, vínculo
  revoked/invited, sin persona/sin sesión y principal dual.
- [x] Preservar lectura legítima de las seis tablas, membresía pausada/cancelada,
  historia propia y operación interna; Portal puro no gana INSERT/UPDATE/DELETE.
- [x] Comparar bidireccionalmente ACL/policies/triggers antes/después; probar
  preflight con dependencia ausente, RLS apagada, firma/cuerpo alterado,
  consumidor retirado o policy adicional.
- [x] Contratos SQL completos, rebuild, consumidores Club y gates documentales/
  numeración/gobernanza/componentes; revisión independiente sin bloqueantes.
- [ ] Publicación/CI del SHA propio, integración y aplicación/smoke alojado
  mediante autorizaciones separadas. Hasta entonces no equivale a release.

## Comandos y estilo

- RED local: `psql -U postgres -v ON_ERROR_STOP=1 -v apply_fix=false -f /sb/tests/0424_portal_club_principal_tenant.test.sql`.
- GREEN: mismo comando sin `-v apply_fix=false`, en PostgreSQL17 desechable.
- SQL completo: `node scripts/run-sql-tests.mjs`.
- Rebuild: `node scripts/check-schema-rebuild.mjs`.
- Consumidores: `pnpm exec vitest run lib/studio/club/__tests__`.
- Gates: `pnpm docs:index`, `pnpm docs:check`, `pnpm sdd:check`,
  `pnpm governance:check`, `pnpm components:check`, `git diff --check`.
- Ejemplo de estilo: `join public.clients c on c.id = cu.client_id and c.tenant_id = cu.tenant_id`.
  Objetos calificados, search_path vacío, `(select auth.uid())` y NULL fail-closed.
- Fixtures BEGIN/ROLLBACK; Docker propio sin puertos ni volúmenes persistentes,
  montaje de supabase/ read-only. No usar contenedores de otros proyectos.

## Evidencia de verificación local

- RED causal independiente: ambos vínculos incoherentes devuelven persona B
  con0187 y permiten leer una fila de tenant B en cada una de las seis tablas.
  Doce observaciones positivas del defecto; falla después por la aserción
  `bad-link: helper debe denegar vínculo incoherente`, no por ausencia de0424.
  No se desactivaron los triggers reales para fabricar el caso.
- GREEN:374 aserciones y27 derivas rechazadas. La matriz principal contiene
  364 aserciones y26 derivas; el canario restrictivo separado añade10 y1.
  Controles por IDs esperados independientes del helper: seis tablas bajo
  authenticated, A/B, historia pausada/cancelada, equipo y principal dual.
  Revocación y cliente archivado tienen efecto; archivar persona o cambiar
  Shipping Mark a vacío/NULL no destruye acceso legítimo. Portal puro no gana
  DML y el equipo conserva sus UPDATE. Catálogo/filas iguales antes/después
  salvo el helper previsto; reejecución idempotente, sin cambiar OID/ACL.
- Aislamiento del canario27: durante el desarrollo, DROP/CREATE de una policy
  restrictiva afectó las lecturas posteriores dentro de la misma conexión,
  aun con rollback y catálogo aparentemente restaurado. No se atribuye una
  causa al motor sin una reproducción independiente. El arnés definitivo
  termina y verifica el rollback principal, reconecta a la misma DB desechable
  con PID distinto y fixture nuevo, y ejecuta la migración real contra esa
  deriva: exige P0001 con prefijo0424, rechazo y cero efectos en catálogo/filas.
  Ambos rollbacks se verifican con guardas que fallan si quedan objetos.
  No se omite el caso ni se agrega un workaround al runtime. Contenedor propio
  del test retirado y ausencia comprobada al terminar RED/GREEN.
- Rebuild con0424:421 migraciones,403 desde cero y18 sólo-ledger;219 tablas
  y dos tenants sintéticos. Resultado aprobado. No representa un test de Auth
  o Storage alojado ni aplica el ledger de producción.
- Consumidores TypeScript sin cambios:37 pruebas/4 archivos de Club aprobadas
  antes del correctivo SQL. Es baseline de consumidores, no prueba de RLS.
- Advisors de seguridad con CLI2.108.0, sólo contra una base local efímera:
  prefijo de dependencias reales del fixture, sin filas de negocio, más0424.
  Dos WARN heredados por search_path: `touch_updated_at` y
  `academy_enrollments_validate_person`; ninguno en `get_portal_person_id`.
  No se modificaron esos objetos fuera de alcance ni se silenciaron avisos.
  La CLI imprimió su mensaje genérico de conexión remota, pero el db-url
  comprobado apuntaba exclusivamente a127.0.0.1 con puerto efímero y sin linked.
  El contenedor identificado por ID y etiqueta propios fue retirado con --rm.
- Docs, numeración, gobernanza, componentes y diff aprobados tras crear la spec:
  360 specs,421 migraciones; se conservó la allowlist histórica de numeración.
  Suite global posterior:166 contratos SQL aprobados, incluido0424, con rollback
  total y contenedor efímero retirado por el runner. No se omitió el contrato.
- Revisión independiente final: APROBADO, sin bloqueantes en helper/preflight,
  negativos, permisos conservados, historia, paridad y aislamiento del canario27.
  No certifica todo el Club ni autoriza Cloud. No se repitieron build/E2E/Deno
  o suite TypeScript global por un delta exclusivamente SQL/documental; sus
  resultados históricos no se presentan como ejecuciones de esta pieza.
- Quedan publicación y CI del SHA propio, integración y gate nominal0424 con
  su smoke autorizado. La spec permanece in-progress hasta ese cierre.

## Gate constitucional

| Principio | Clasificación y evidencia requerida |
|---|---|
| SGE-00.01 | no aplica: no cambia verbos/acciones de negocio |
| SGE-00.02 | cumplimiento local: paridad de filas e historia propia comprobadas |
| SGE-00.03 | cumplimiento: autorización R3; reproducción y gate Cloud nominal |
| SGE-00.04 | no aplica a escritor nuevo; no se crean mutaciones de negocio |
| SGE-00.05 | no conformidad inicial corregida localmente con RED/GREEN; Cloud pendiente |
| SGE-00.06 | cumplimiento local:27 derivas rechazadas antes de cambiar el helper |
| SGE-00.07 | cumplimiento: evidencia local y alojada se separa explícitamente |
| SGE-00.08 | no aplica: sin pasos/pantallas nuevas |
| SGE-00.09 | cumplimiento: reutiliza el helper de0187, sin primitiva nueva |
| SGE-00.10 | no aplica: sin delta visual/interactivo |
| SGE-00.11 | cumplimiento local: errores0424 identifican la precondición fallida |
| SGE-00.12 | cumplimiento: sin push/merge/migración/deploy implícitos |

MP-01: conserva registros e historia; no interpreta archivo como purga.
BTN-01, AUD-01/AUD-02: no se cambia control, mutación/log ni exportación.
No se captura, mueve ni borra PII real. El contrato usa sólo datos sintéticos.

Fuente: [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
Changelog consultado: no se cambia versión de Postgres, CLI, extensión o API.
El SDD del proyecto es la fuente de plan/aceptación; no se crea otro tracker.
