# CLAUDE.md — app/studio (DTD Studio ERP)

Contexto focalizado del ERP interno. Cargá esto cuando trabajes dentro de
`app/studio/`. El CLAUDE.md de raíz tiene el contexto general del repo
(dualidad sitio público vs Studio, comandos, brand).

## Estructura de un módulo

Cada módulo del Studio vive en `app/studio/(app)/<modulo>/` y sigue este shape:

```
<modulo>/
├── page.tsx                # Server component · fetcha data, render <ModuloClient>
├── actions.ts              # Server actions ("use server") · mutaciones
├── _components/
│   ├── <Modulo>Client.tsx  # Orquestador client ("use client") con filtros + drawer
│   ├── <Entidad>Drawer.tsx # Crear/editar (usa DrawerShell compartido)
│   └── ...                 # Tabla, KPIs, badges específicos
└── [id]/                   # Detalle opcional
    └── page.tsx
```

Tipos + queries + validators del módulo viven en `lib/studio/<entidad>-*.ts`:

- `<entidad>-types.ts` — enums, types, `validate<Entidad>Input()` + helpers
  (`tierLabel`, `tierBadgeTone`, etc.)
- `<entidad>-queries.ts` — funciones puras `(supabase: SupabaseClient) => Promise<T>`
  consumidas desde `page.tsx`.

## Server Actions — patrón obligatorio

**Sin Zod.** Validación con función propia que devuelve `{ input, fieldErrors }`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { validateXInput, type XActionState } from "@/lib/studio/x-types";

export async function createXAction(
  _prev: XActionState,
  formData: FormData,
): Promise<XActionState> {
  const supabase = await createClient();

  const partial = inputFromFormData(formData);          // parse FormData → Partial<Input>
  const { input, fieldErrors } = validateXInput(partial);
  if (fieldErrors) return { fieldErrors };

  // Resolver tenant del usuario logueado (RLS)
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const { error } = await supabase.from("xs").insert({
    tenant_id: link.tenant_id,
    ...input,
  });
  if (error) return { error: `No se pudo crear: ${error.message}` };

  revalidatePath("/studio/x");
  return { ok: true };
}
```

Desde el client component se llama con `useActionState(createXAction, initialState)`.

## Drawers — usar DrawerShell compartido

Todos los drawers usan el shell en
`app/studio/_components/ui/drawer/DrawerShell.tsx`:

```tsx
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";

<DrawerShell title="Nuevo X" subtitle="…" onClose={onClose} pending={isPending} width={620}>
  <form id="x-drawer-form" action={formAction} style={{ flex: 1, overflow: "auto", ... }}>
    {/* fields */}
  </form>
  <DrawerFooter
    formId="x-drawer-form"
    onClose={onClose}
    isPending={isPending}
    canSubmit={canSubmit}
    submitLabel="Crear X"
  />
</DrawerShell>
```

**Regla del submit:** SIEMPRE `<form id="X">` + `<button type="submit" form="X">`
HTML5 estándar. **Nunca** `closest("aside").querySelector("form")?.requestSubmit()`
— ese patrón está deprecado en este codebase (ver memoria
`studio-tech-debt-post-sprint3` item 2).

Los drawers viejos que usaban `requestSubmit()` ya fueron migrados
(ClientDrawer, QuoteDrawer en sesión DTD-ERPv1-DIA3).

## Tokens visuales — cero rgba inline

- Tokens en `app/studio/tokens.css` (light + dark + density modifiers
  `[data-density="compact|spacious"]`).
- Acceso siempre con `var(--*)`, nunca hex inventado.
- Para texto sobre fondo navy (`background: var(--ink)`):
  - `var(--ink-inv)` — texto principal (paper white)
  - `var(--ink-inv-soft)` — texto secundario (75%)
  - `var(--ink-inv-mute)` — caption / labels uppercase (50%)
- Para texto sobre sidebar:
  - `var(--ink-side)` (88%) + `var(--ink-side-soft)` (55%)
- **Nunca** `color: "rgba(255,255,255,X)"` inline en JSX para texto.

## UI primitivas compartidas

Viven en `app/studio/_components/ui/`:

- `Avatar` · iniciales + color (wine | success | info | neutral)
- `Badge` · tonos `success` / `warning` / `danger` / `info` / `wine` / `neutral`,
  sizes `xs` / `sm` / `md`
- `EmptyState` · eyebrow + título + descripción + action opcional
- `KpiCard` · número grande + label + sub
- `drawer/DrawerShell` · shell + footer compartidos

Icons en `app/studio/_components/icons.tsx` (objeto `Icon` con métodos por nombre).

## Clases CSS reusables (`studio.css`)

- `.studio-btn` + variantes: `studio-btn-primary` / `-ghost` / `-danger` /
  `-sm` / `-xs`
- `.studio-input` + `.studio-input-mono` (JetBrains Mono para códigos)
- `.studio-label` · label estándar de form
- `.studio-display` · Archivo Black para títulos
- `.studio-eyebrow` · uppercase tracking-wide

## Convenciones operativas

- **MARKBOX** = ID estable de cliente, formato `DTD-NNNN`. Autogenerado por
  `supabase.rpc("next_markbox", { p_tenant_id })` — nunca lo asignás manual.
- **Multi-tenant**: todas las tablas tienen `tenant_id` con RLS. Resolver
  siempre desde `user_tenants` en cada server action.
- **Soft delete**: nunca `DELETE`. Setear `deleted_at = now()` (acción
  `softDelete*Action`).
- **Códigos correlativos** (shipment `S-2026-NNNN`, route `R-2026-NNNN`, etc.):
  generados por RPCs en Supabase, no en código.
- **Sentence case** en CTAs: `+ Nueva cotización`, no `+ NUEVA COTIZACIÓN`
  (regla BRAND §Tono). El único uppercase válido es eyebrows con
  `text-transform: uppercase` vía CSS.
- **Idioma**: castellano rioplatense/venezolano (vos, "che", "embarque").
  Términos comerciales en mayúscula solo si son acrónimos (DDP, LCL, FCL,
  CBM, RIF, IGTF, IVA, SENIAT, MARKBOX, DUA, HS, ETA).

## SDD checklist al crear módulo nuevo

1. `docs/specs/NNNN-slug/spec.md` con frontmatter (`sdd`, `title`, `status`,
   `author`, `created`, `related`) — ver SDDs existentes como template.
2. Migración Supabase numerada en `supabase/migrations/` (enums + tablas con
   RLS por `tenant_id`).
3. RPC para correlativo si aplica.
4. `lib/studio/<entidad>-types.ts` + `-queries.ts`.
5. `app/studio/(app)/<modulo>/` con `page.tsx` + `actions.ts` + `_components/`.
6. Entry en sidebar (`app/studio/(app)/_components/StudioSidebar.tsx`).
7. UI/UX review por agente `ui-ux-designer` antes del commit (regla del
   founder).
8. Commit: `feat(studio): SDD-NNNN — título`.

## Deuda técnica conocida

Ver memoria `studio-tech-debt-post-sprint3`. Highlights:

- `window.prompt()` en `VeRowActions` (assign_delivery / mark_delivered /
  report_incident) — popovers reutilizables pendientes.
- Field helpers (`FieldText`, `FieldSelect`, `FieldError`, `FormError`) viven
  en `tms/_components/TruckDrawer.tsx` con prefijo `tms-` hardcoded en IDs.
  Si vas a usarlos en otro módulo, parametrizá el prefijo primero.
