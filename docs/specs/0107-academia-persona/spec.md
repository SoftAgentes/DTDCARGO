---
sdd: "0107"
title: "Academia ligada a la persona (cédula) — academy_enrollments.person_id"
status: done
author: "Claude Code (forja · ventana secundaria) + founder"
created: 2026-06-26
updated: 2026-06-26
supersedes: null
superseded_by: null
related: ["0106", "0093", "0095", "0042"]
confidencialidad: interno
---

# SDD-0107 · Academia ligada a la persona (cédula) — `academy_enrollments.person_id`

> **Fase 2 de [SDD-0106](../0106-persons-identidad/spec.md).** SDD-0106 creó `persons`
> (cédula = ancla de identidad) y dejó la Academia desconectada: `academy_enrollments`
> identifica al alumno con `student_name` (NOT NULL) + `student_ci` (texto libre, nullable),
> sin vínculo a `persons` ni a `clients`. Esta fase **ancla cada inscripción a una persona
> por cédula**, para que un mismo humano sea reconocible a través de carga + academia.

## 0. Por qué — y qué NO es

**Objetivo:** que una inscripción de Academia quede ligada a la **persona** (`persons.id`)
por su cédula normalizada — reusando el ancla de SDD-0106. Así la Academia deja de ser una
isla de `student_ci` sueltos y se integra a la identidad única del tenant.

**Regla de oro (heredada de SDD-0106):** NO re-apuntar de golpe las tablas que usan
`client_markbox`. `academy_diplomas.client_markbox` y `academy_lesson_progress.client_markbox`
**siguen igual**; el portal sigue ligando por `clients.id`/markbox. Solo agregamos
`academy_enrollments.person_id` (additivo, nullable) + validación de cédula en el alta.

**NO entra en esta fase:**
- ❌ Tocar `academy_lesson_progress` ni el RLS del portal (siguen por `client_markbox`).
- ❌ Crear una fila `clients` (sin markbox) para alumnos academia-only — diferido; el vínculo
  a `persons` ya ancla la identidad sin necesidad de perfil de carga.
- ❌ Comboboxes cédula-first ni decisión de ruta `[markbox]` vs `[id]` (eso es Fase 3 / SDD-0108).
- ❌ Re-emitir diplomas existentes; `academy_diplomas` se deriva de la inscripción si hace falta,
  pero no gana columna en esta fase.

## 1. Modelo objetivo

- **`academy_enrollments`** gana `person_id uuid references persons(id)` (nullable: una
  inscripción sin cédula no puede anclarse y queda con `person_id = null`).
- La **cédula sigue viviendo en `student_ci`** (texto que el operador tipea); `person_id` es
  el vínculo normalizado y deduplicado hacia la persona.
- Alta/edición de inscripción: si hay `student_ci` con formato válido → **ubica o crea** la
  persona (lazy) por cédula normalizada y setea `person_id`.

## 2. Alcance — entregable

### 2.1 Migración `0177_academia_person_link.sql`
1. `alter table academy_enrollments add column person_id uuid references persons(id)`.
2. **Índice FK** `create index on academy_enrollments (person_id)` (patrón `fk_indexes` del repo).
3. **Backfill** (en la misma migración, scoped por `tenant_id` en cada join), en orden de confianza:
   - **(a) por cédula:** `person_id = p.id` donde `upper(regexp_replace(e.student_ci,'[^A-Za-z0-9]','','g'))
     = upper(regexp_replace(p.national_id,'[^A-Za-z0-9]','','g'))` y `p.tenant_id = e.tenant_id`
     y `p.deleted_at is null` y `e.student_ci is not null`. **Espejo exacto** del índice normalizado
     de `0095`/`0170`.
   - **(b) por markbox:** para las que quedan con `person_id null` y `client_markbox` no-null:
     `person_id = c.person_id` vía `clients c` (mismo tenant, `c.markbox = e.client_markbox`,
     `c.person_id is not null`).
   - **(c) academia-only (crear persona lazy):** para las que quedan con `student_ci` no-null y
     sin match, **crear UNA persona** por cédula normalizada distinta (deduplicar: si dos
     inscripciones comparten cédula normalizada → una sola persona) con
     `national_id = student_ci` (raw, el índice normaliza), `name = student_name`,
     `email = student_email`, `doc_kind = 'persona'`, y linkear. El índice único parcial de
     `persons` (0170) **debe** tolerar este insert sin colisión (por eso se deduplica primero).
   - **(d)** inscripciones sin `student_ci` → `person_id` queda `null` (no se inventa identidad).
4. **Defensa en DB (consolidado del lane robusto):** helper `person_in_tenant(p_person_id, p_tenant_id)`
   (SECURITY DEFINER, fail-closed, `revoke ... from public, anon` + `grant ... to authenticated`) +
   trigger `academy_enrollments_person_same_tenant` BEFORE INSERT/UPDATE que rechaza un `person_id`
   de otro tenant o soft-deleted (la FK sola no lo cubre). Se crea **después** del backfill. Mismo
   patrón que la validación polimórfica del repo (`*_in_tenant()` + trigger).
5. **Sin RLS nueva** (columna additiva; `academy_enrollments` ya tiene RLS por tenant de `0144`).
6. **Cast enum↔text:** no aplica (todo texto); igual se usa `::text` en los `regexp_replace`.

### 2.2 Capa app (Studio · Academia)
- `lib/studio/academy-enrollment-{types,queries}.ts` (o el par existente del módulo): el tipo de
  inscripción gana `person_id: string | null`; query que resuelve la persona por cédula
  (reusar `find_client_by_cedula` no aplica — es de clients; crear lookup de persona o reusar
  `normalizeCedula` + `persons` query de SDD-0106).
- **Validación de cédula en el alta** (`actions.ts` del módulo Academia): si el operador ingresa
  `student_ci`, validar formato con un validador **cédula-aware** que acepta la **cédula venezolana
  simple** (V/E + 5–10 dígitos, con o sin puntos/guiones) **y** el RIF completo (reusa `RIF_REGEX`/
  `formatRif`/`normalizeCedula` de `client-types.ts`). Decisión de la forja: el `RIF_REGEX` solo
  rechazaba la cédula simple (8 dígitos sin verificador), que es justo como se identifica al alumno.
  Formato inválido → `fieldErrors.student_ci` (patrón Server Action de AGENTS.md, **no Zod**).
- Al guardar (create/edit) con cédula válida: **ubicar o crear** la persona (lazy) y setear
  `person_id`. Reusar la lógica de dedupe-por-cédula-normalizada del backfill.
- **NO** tocar la UI de progreso/portal ni `lesson_progress`.

## 3. Verificación
- Migración en **branch efímero de Supabase** (no prod): aplicar `0177`, chequear backfill
  (counts por rama a/b/c/d, unicidad de personas creadas, `person_id` no-null donde había
  cédula válida), borrar branch. **El agente NO aplica a prod** (lo hace coordinación).
- Vitest: paridad `normalizeCedula` ↔ índice SQL (ya existe de 0106, extender si hace falta);
  validador de `student_ci` en el alta; dedupe por cédula. Ajustar tests de Academia que
  asuman ausencia de `person_id`.
- `node scripts/verify.mjs` **TODO VERDE**.

## 4. Seguridad / riesgos
- **Backfill (c) e índice único:** crear personas academia-only puede colisionar con el índice
  parcial de `persons` si no se deduplica por cédula normalizada **antes** de insertar. Dedup
  obligatorio. Personas con `student_ci` mal formado (no normalizable a algo único) → mejor
  dejar `person_id null` que crear basura.
- **Multi-tenant:** todos los joins del backfill llevan `tenant_id` explícito.
- **Additivo:** `person_id` nullable + columna nueva → cero ripple en lo existente; el portal y
  los diplomas siguen funcionando por `client_markbox`.

## 5. Archivos
```
supabase/migrations/0177_academia_person_link.sql      (nuevo)
lib/studio/academy-enrollment-types.ts                 (editar/crear: +person_id)
lib/studio/academy-enrollment-queries.ts               (editar/crear: lookup persona)
app/studio/(app)/academia/.../actions.ts               (editar: validar student_ci + link persona)
docs/specs/0107-academia-persona/spec.md               (este archivo)
```

## 6. Roadmap (fuera de esta fase)
- **Fase 3 (SDD-0108):** comboboxes cédula-first (cotizador/tracking/embarques); decisión ruta
  `[markbox]` vs `[id]`; migración gradual de `client_markbox` → FK en features nuevas.
