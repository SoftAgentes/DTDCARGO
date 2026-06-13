# CHECKPOINTS — DTD Cargo (qué valida el reviewer)

> El `reviewer` recorre esta lista por cada feature y marca `[x]`/`[ ]` con razón concreta (archivo:línea).
> Nada se aprueba "a ojo": cada checkpoint es verificable. El gate ejecutable es **`node scripts/verify.mjs`**.
> C3/C5 aplican solo si la feature toca DB/UI. C1·C2·C6·C7·C8 aplican siempre.

## C1 · Gate ejecutable verde
- [ ] `node scripts/verify.mjs` termina **VERDE** (lint + typecheck + test + docs:check). Sin esto, NADA se aprueba.

## C2 · Frontera público↔ERP (riesgo #1)
- [ ] Ningún archivo de `app/{cotizar,track,contacto,calculadora,servicios,noticias,glosario}` ni `components/` (raíz) importa `@/lib/studio`, `@/lib/db` ni `@supabase/*`.
- [ ] El único puente público↔ERP usado es `lib/shared/`.
- (ESLint lo falla como **error** → C1 ya lo atrapa; este checkpoint es el recordatorio explícito.)

## C3 · Base de datos (solo si toca DB)
- [ ] La migración vive en `supabase/migrations/NNNN_*.sql` con el correlativo correcto.
- [ ] Toda tabla nueva tiene **RLS habilitado** y filtra por `tenant_id` (multi-tenant).
- [ ] Sin DDL destructivo (DROP / ALTER de columna) sin default o respaldo.
- [ ] La migración **NO** fue aplicada a producción por el harness (lo hace el founder).

## C4 · Convenciones del Studio
- [ ] Server Actions: `"use server"` + `useActionState` + parsing manual de FormData + `validate*Input()` (no Zod) + `revalidatePath()`.
- [ ] Queries puras en `lib/studio/<entidad>-queries.ts`; enums/validators/types en `<entidad>-types.ts`.
- [ ] Código nuevo en el hogar correcto (ver "dónde va el código nuevo" en `AGENTS.md`).

## C5 · Marca (solo si toca UI)
- [ ] Solo tokens CSS `var(--*)` — cero hex inventados.
- [ ] Solo fuentes Archivo / Archivo Black / JetBrains Mono / Noto Sans SC.
- [ ] Cero AI slop (gradientes coloridos, glassmorphism, emojis decorativos).
- [ ] Componentes del sistema primero; alineado al handoff vigente (`docs/design/studio/_norte/`).
- [ ] Pasó (o se agendó) la revisión con el agente `ui-ux-designer`.

## C6 · Tests
- [ ] Hay tests (Vitest) que cubren los criterios de `acceptance` de la spec.
- [ ] Pasan dentro de `node scripts/verify.mjs` (C1).
- [ ] El verde es **legítimo** (anti-trampa Reflexion): no se debilitaron/borraron tests ni se reemplazaron asserts reales por always-pass para forzar el gate; el fix está en el código de producción, no en parchar el test.

## C7 · Spec-anchored (trazabilidad)
- [ ] Al cerrar, el `spec.md` se actualizó con lo descubierto (`status`, `updated`, notas si cambió el alcance).
- [ ] Si la feature cierra el spec → `status: done`.

## C8 · Scope
- [ ] Se implementó **UNA** sola feature (la de la spec). No se tocaron otras sin pedirlo.
- [ ] No se cruzó ninguna línea de "Qué NO se automatiza": migraciones a prod · cambios de marca sin sign-off · `git push` / deploy.
