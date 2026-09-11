---
sdd: "0362"
title: Aislar el aprendizaje del Portal por principal y tenant
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0093", "0359", "0361"]
confidencialidad: interno
---

# SDD-0362 — Academia Portal: frontera del alumno

> **Nota de importación — 2026-09-10.** Esta spec entró a `main` desde la PR #21 con su
> contenido original, `status: done` incluido, que refleja su estado **en la rama de origen**.
> Su migración `0418_portal_academia_tenant_boundary` está **declarada pendiente** en
> `supabase/migrations-baseline.json` y **no se ha aplicado a producción**: el `done` de la
> cabecera no significa que este contrato esté vigente en la base real. Aplicarla exige OK
> nominal de Sam y el runbook `docs/runbooks/aplicar-migraciones-prod.md`.

## Evidencia y objetivo

Las policies de 0144/0145/0149 comparan Shipping Mark sin tenant en
inscripciones, diplomas y lectura/borrado de progreso. Las policies de catálogo
permiten cursos publicados y previews a cualquier authenticated; el acceso por
inscripción tampoco ata el tenant de la fila. El Shipping Mark no es global.
Las queries de `lib/portal/portal-academy-queries.ts` confían en RLS, y
`setLessonComplete` exige inscripción en aplicación pero el INSERT directo no.

Se corrige la frontera de aprendizaje de SDD-0093, no se crea una Academia
nueva. Reproducido con PostgreSQL real y fixtures sintéticos; la prueba no
demuestra explotación ni estado de Producción. Numeración
consultada con `pnpm sdd:next`: 15 refs, spec 0362 / migración 0418.

## Decisión y límites

1. Sustituir ocho policies Portal en seis tablas: cursos, módulos, lecciones,
   inscripciones, diplomas y SELECT/INSERT/DELETE de progreso.
2. Exigir principal `auth.uid()`, vínculo activo, cliente vivo y tenant
   coherente entre vínculo, cliente y fila. No usar claims editables.
3. El alumno conserva el catálogo publicado de su tenant; inscribirse permite
   su curso no publicado. Lecciones sólo publicadas, con módulo/curso vivos
   coherentes, y preview de curso publicado o inscripción propia.
4. Inscripciones/diplomas propios conservan su historia sin exigir padre vivo:
   un diploma emitido no desaparece por archivar una inscripción. No se añade
   una dependencia circular curso → inscripción → curso.
5. Progreso: leer/borrar sólo lo propio; INSERT exige inscripción propia viva,
   curso/lección/módulo coherentes y lección publicada legible. Se preservan
   INSERT ON CONFLICT DO NOTHING y DELETE propios, sin añadir UPDATE.
   No se purga ni migra progreso histórico; la retención no cambia.
6. Conservar ACL, policies internas, triggers, RPCs, datos y Storage. No añadir
   SECURITY DEFINER. Cohortes/eventos del Club, asistencia, RBAC interno,
   retención y otras entidades Portal quedan fuera y conservan revisión propia.
7. Preflight rechaza RLS ausente o inventario inesperado de policies.
   Postflight y contrato verifican las ocho sustituciones y ausencia de
   ampliaciones laterales.
8. Migración sólo local, con aplicación Cloud individual y nominal. No requiere
   RPC o despliegue previo. No autoriza leer alumnos reales, emitir diplomas,
   cambiar cursos alojados, integrar main ni desplegar.

La solicitud de saneamiento continuo autoriza preparar y verificar la
corrección local; no se atribuye una aprobación nominal de Cloud al founder.
El protocolo SDD del repositorio prevalece sobre rutas genéricas tasks/plan.md.

## Allowlist exacta y ownership

- `supabase/migrations/0418_portal_academia_tenant_boundary.sql` — agente principal.
- `supabase/tests/0418_portal_academia_tenant_boundary.test.sql` — reproducción independiente.
- `docs/specs/0362-portal-academia-tenant-boundary/spec.md` — agente principal.
- `docs/specs/README.md` — índice generado.
- `docs/audits/2026-09-02-codex-arranque-checklist.md` — agente principal.
- `.agents/handoffs/2026-09-02-portal-academia-tenant-close.md` — agente principal.
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md` — agente principal.

## Plan y aceptación

- [x] Reproducir antes de corregir: lectura cruzada de datos del alumno,
  borrado cruzado de progreso y exposición de catálogo/lecciones ajenos.
  RED debe fallar por autorización real, no por falta del archivo 0418.
- [x] Cambiar sólo las ocho policies; probar acceso A/B con Shipping Mark
  repetido, cliente retirado, vínculo revocado/invitado/incoherente y sin sesión.
- [x] Conservar catálogo/previews permitidos, curso inscrito, diplomas históricos,
  progreso propio idempotente, principal dual y operación interna legítima.
- [x] Rechazar INSERT de progreso sin inscripción o con curso/lección/módulo
  ajenos/incoherentes; no otorgar UPDATE o CRUD del catálogo al Portal puro.
- [x] Comparar bidireccionalmente policies internas/ACL antes y después.
  Probar inventario desviado, policy ausente y RLS apagada.
- [x] Ejecutar contratos SQL completos, rebuild y consumidores.
- [ ] Confirmar el CI del commit publicado, sin sustituirlo por el de su base.
- [ ] Integración y aplicación Cloud con sus gates independientes; conservar
  main/worktree/evidencia hasta la contención del commit en main.

`done` significa cierre técnico local, no migración aplicada ni release.
RED sin 0418: exit 1 por catálogo cruzado después de reproducir seis lecturas,
una lectura de borrador, DELETE ajeno e INSERT sin inscripción. GREEN: exit 0,
incluidos ocho escenarios de drift y rollback del fixture. Pasan 159 contratos
SQL, rebuild de 415 migraciones (397 desde cero + 18 sólo-ledger) y 68 unitarios
de Academia en dos archivos. El barrido estructural del rebuild cubre 219
tablas y dos tenants sintéticos; no reemplaza los negativos de este contrato.
Se reutilizan índices existentes de principal, PK de padres e inscripción;
no se declara una medición de rendimiento sobre volumen productivo.

## Comandos y estilo

- RED aislado: `psql -U postgres -v ON_ERROR_STOP=1 -v apply_fix=false -f /sb/tests/0418_portal_academia_tenant_boundary.test.sql`.
- SQL completo: `node scripts/run-sql-tests.mjs`.
- Rebuild: `node scripts/check-schema-rebuild.mjs`.
- Consumidores: `pnpm exec vitest run lib/studio/academia/__tests__/types.test.ts lib/studio/academia/__tests__/person-link.test.ts`.
- Gates: `pnpm docs:index`, `pnpm docs:check`, `pnpm sdd:check`,
  `pnpm governance:check`, `pnpm components:check`, `git diff --check`.
- Aplicación sin cambios: el CI completo del HEAD publicado es independiente.

Patrón existente 0416/0417: `alter policy ... using (exists (...))`,
`(select auth.uid())`, SQL explícito y preflight fail-closed. Fixture
transaccional BEGIN/ROLLBACK y transporte local Docker, nunca MCP alojado.

## Gate constitucional

| Principio | Clasificación y evidencia requerida |
|---|---|
| SGE-00.01 | cumplimiento: verbos/operaciones propias sin cambios |
| SGE-00.02 | cumplimiento: no DML/purga; progreso y diplomas legítimos conservados |
| SGE-00.03 | cumplimiento: autorización R3 con negativos y gate Cloud nominal |
| SGE-00.04 | no aplica a nuevos escritores: no se introducen; release exige recibo |
| SGE-00.05 | cumplimiento: tenant/principal/inscripción y padres comprobados en SQL |
| SGE-00.06 | cumplimiento: preflight rechaza drift antes de las sustituciones |
| SGE-00.07 | cumplimiento: resultados locales no se declaran estado alojado |
| SGE-00.08 | no aplica: sin pasos o pantallas nuevos |
| SGE-00.09 | cumplimiento: patrón existente, sin helper elevado nuevo |
| SGE-00.10 | no aplica: sin cambio visual/interactivo |
| SGE-00.11 | cumplimiento: errores de preflight identifican precondición |
| SGE-00.12 | cumplimiento: Cloud, release e integración separados |

MP-01: no cambia retención ni tratamiento del progreso ya registrado. BTN-01:
no cambia controles. AUD-01/AUD-02: sin nuevo log/exportación/mutación de
negocio; no se declara conforme el legado no auditado. No se captura, mueve
ni borra PII real; el fixture usa valores sintéticos.

Fuente: [RLS oficial de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
Changelog consultado: no se actualiza Postgres, paquete, API ni exposición de
tablas; la migración no crea tablas nuevas.
