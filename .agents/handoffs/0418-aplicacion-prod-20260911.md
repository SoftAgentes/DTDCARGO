# 0418 aplicada a producción — 2026-09-11

Tarea: aplicar `0418_portal_academia_tenant_boundary` (SDD-0362, lote L12 del bloque C). La
ejecutó el Director con autorización nominal de Sam («Autorizo aplicar a producción
0418_portal_academia_tenant_boundary»), conforme a `docs/runbooks/aplicar-migraciones-prod.md`.
Proyecto `xpfuzqombmjmxvprjgmi`.

## Resultado

**APLICADA.** Ledger de producción: `20260911180337 / 0418_portal_academia_tenant_boundary`, con el
basename exacto. Se aplicó sola y con el SQL idéntico al archivo de `main` `bbc7493f` (blob
`e5cf659b`, 10071 B, md5 `a41faff0796d8581cea11b6810d7b021`). El ledger guarda una sola sentencia
con ese mismo md5 y tamaño. Su preflight (inventario exacto de 14 policies, RLS en las ocho tablas
que usa y `auth.uid()`) y su postflight (ocho policies Portal con principal, tenant y padres)
pasaron; si hubieran fallado, la transacción se habría abortado.

## Qué cierra

Antes, las policies Portal de inscripciones, diplomas y progreso ligaban la fila propia solo por
Shipping Mark (`client_markbox = get_portal_client_markbox()`), sin tenant ni vínculo activo, y el
Shipping Mark no es global. El catálogo (cursos y módulos publicados, lecciones en vista previa)
era legible por cualquier sesión `authenticated` de cualquier tenant. Un alumno inscrito veía
también las lecciones no publicadas de su curso, y el INSERT directo de progreso no exigía
inscripción.

Ahora cada policy Portal exige un vínculo `client_users` activo del `auth.uid()`, un cliente vivo
del mismo tenant y el tenant de la fila; las filas propias exigen además el markbox de ese
cliente. La lectura Portal de lecciones exige `status = 'publicado'`. Completar una lección exige
inscripción propia viva y coherencia de curso, módulo y lección publicada del mismo tenant. Leer
o desmarcar progreso histórico propio y leer un diploma propio no exigen catálogo vivo. Las seis
policies de equipo «… by tenant», la RLS y la ACL no cambian.

## Estado previo (capturado antes de aplicar; solo catálogo, sin filas de negocio)

| Objeto | Valor previo |
|---|---|
| `academy_enrollments portal self read` (SELECT) | `deleted_at IS NULL AND client_markbox IS NOT NULL AND client_markbox = get_portal_client_markbox()` |
| `academy_diplomas portal self read` (SELECT) | igual que la anterior, sobre `academy_diplomas` |
| `academy_courses portal read` (SELECT) | `deleted_at IS NULL AND (status = 'publicado' OR EXISTS inscripción viva con client_markbox = get_portal_client_markbox())` |
| `academy_modules portal read` (SELECT) | `deleted_at IS NULL AND EXISTS curso vivo (publicado OR con inscripción viva por markbox)` |
| `academy_lessons portal read` (SELECT) | `deleted_at IS NULL AND ((free_preview AND status = 'publicado') OR EXISTS inscripción viva por markbox)` |
| `academy_lesson_progress portal read` / `portal delete` | `client_markbox IS NOT NULL AND client_markbox = get_portal_client_markbox()` |
| `academy_lesson_progress portal insert` (WITH CHECK) | `client_markbox IS NOT NULL AND client_markbox = get_portal_client_markbox() AND tenant_id = get_portal_client_tenant()` |
| Seis `… by tenant` (ALL) | `tenant_id = get_user_tenant_id()` en USING y WITH CHECK |
| Roles / modo | las 14 policies: `{authenticated}` · PERMISSIVE |
| RLS | activa en las seis tablas y en `client_users`/`clients`; `force` desactivado |
| `relacl` | `authenticated=arwxtm` en cursos, módulos, lecciones, inscripciones y diplomas; `authenticated=ardxtm` en progreso |
| Helpers | `get_portal_client_markbox()`, `get_portal_client_tenant()` y `get_user_tenant_id()` en `public`, SECURITY DEFINER, STABLE |
| Ledger | última entrada `20260911111907 / 0409_bank_reconciliation_rbac`; 0418 ausente |

## Vuelta atrás

Las expresiones previas solo existían en la base. Se capturaron **antes** de aplicar y este SQL
es el único artefacto de reversión. Solo se ejecuta con OK nominal de Sam y en una transacción.
Antes de usarlo hay que evaluar la compatibilidad, porque vuelve a abrir el catálogo publicado de
todos los tenants a cualquier sesión `authenticated` y a ligar las filas propias solo por
markbox. Este SQL no retira la fila del ledger; si se revierte, hay que registrarlo aparte.

```sql
begin;

alter policy "academy_enrollments portal self read" on public.academy_enrollments
  using ((deleted_at is null) and (client_markbox is not null)
    and (client_markbox = public.get_portal_client_markbox()));

alter policy "academy_diplomas portal self read" on public.academy_diplomas
  using ((deleted_at is null) and (client_markbox is not null)
    and (client_markbox = public.get_portal_client_markbox()));

alter policy "academy_courses portal read" on public.academy_courses
  using ((deleted_at is null) and ((status = 'publicado'::text) or (exists (
    select 1 from public.academy_enrollments e
    where (e.course_id = academy_courses.id) and (e.deleted_at is null)
      and (e.client_markbox = public.get_portal_client_markbox())))));

alter policy "academy_modules portal read" on public.academy_modules
  using ((deleted_at is null) and (exists (
    select 1 from public.academy_courses c
    where (c.id = academy_modules.course_id) and (c.deleted_at is null)
      and ((c.status = 'publicado'::text) or (exists (
        select 1 from public.academy_enrollments e
        where (e.course_id = c.id) and (e.deleted_at is null)
          and (e.client_markbox = public.get_portal_client_markbox())))))));

alter policy "academy_lessons portal read" on public.academy_lessons
  using ((deleted_at is null) and (((free_preview = true) and (status = 'publicado'::text)) or (exists (
    select 1 from public.academy_enrollments e
    where (e.course_id = academy_lessons.course_id) and (e.deleted_at is null)
      and (e.client_markbox = public.get_portal_client_markbox())))));

alter policy "academy_lesson_progress portal read" on public.academy_lesson_progress
  using ((client_markbox is not null) and (client_markbox = public.get_portal_client_markbox()));

alter policy "academy_lesson_progress portal delete" on public.academy_lesson_progress
  using ((client_markbox is not null) and (client_markbox = public.get_portal_client_markbox()));

alter policy "academy_lesson_progress portal insert" on public.academy_lesson_progress
  with check ((client_markbox is not null) and (client_markbox = public.get_portal_client_markbox())
    and (tenant_id = public.get_portal_client_tenant()));

commit;
```

## Verificación posterior, contra el objeto

| Comprobación | Resultado |
|---|---|
| Policies en las seis tablas | 14: las ocho Portal y las seis «… by tenant» |
| Policies Portal con principal y tenant (criterio del postflight) | 8 de 8 |
| Policies Portal que aún usan `get_portal_client_markbox()` o `get_portal_client_tenant()` | 0 |
| Policies «… by tenant» | 6, sin cambios (`tenant_id = get_user_tenant_id()`) |
| Roles / modo | las 14: `{authenticated}` · PERMISSIVE |
| RLS | activa en las seis; `force` desactivado, igual que antes |
| ACL | idéntica a la previa |
| Helpers | md5 del cuerpo sin cambios |
| Ledger | `20260911180337 / 0418_portal_academia_tenant_boundary`: 1 sentencia, md5 `a41faff0…`, 10071 B |
| Advisors de seguridad (resultado completo procesado, antes y después) | 4 lints en el proyecto, idénticos antes y después salvo `observed_at`; ninguno sobre `academy_*`, `client_users` ni `clients` |

## Qué no se midió

No se leyeron filas de negocio, así que no hay conteo de alumnos Portal afectados, por ejemplo por
un vínculo `client_users` no activo o por una inscripción cuyo markbox no coincida con un cliente
vivo del tenant. Esos casos pierden el acceso, que es justo lo que se buscaba.

- **Smoke funcional: NO EJECUTADO.** Requiere una sesión Portal real. Se recomienda que un cliente
  Portal activo abra Academia y compruebe que ve los cursos publicados de su tenant, sus
  inscripciones y diplomas, y que puede marcar y desmarcar una lección.
- **Rendimiento en producción: no medido.** Las policies nuevas añaden joins por fila.

## Cambios en el repositorio (esta rama)

- `supabase/migrations-baseline.json`: `0418_portal_academia_tenant_boundary` sale de
  `pendingBelowCutoff`. El cutoff sigue en 238 y las demás esperas quedan intactas.
- `docs/specs/0362-portal-academia-tenant-boundary/spec.md`: la nota de importación pasa a
  «aplicada».
- Este registro.

## OBJETIVO ORIGINAL

Aplicar 0418 en producción con autorización nominal, verificarla contra el objeto y dejar
registro y vuelta atrás en Git.

## COMPLETADO

Aplicación, verificación contra el objeto, artefacto de rollback y retiro de la espera del
baseline.

## VALIDACIÓN

El detalle está en la PR. Incluye `docs:check`, `sdd:check`, `check-pending-migration-symbols`
y `git diff --check` sobre esta rama.

## COMMITS / PR / BRANCH

El commit que contiene este documento está en la rama `codex/c-0418-aplicada-prod`; la URL de la
PR está en su descripción.

## PENDIENTES DE ESTA TAREA

- Integrar esta PR, con autorización de merge de Sam.
- Smoke funcional de Academia en el Portal con una cuenta real.

## FUERA DE ALCANCE DETECTADO

Ninguno propio de esta aplicación.

## HANDOFF AL DIRECTOR

El worktree `c-0418-aplicada-prod` pertenece a la sesión Director. Después del merge se puede
limpiar según el runbook.
