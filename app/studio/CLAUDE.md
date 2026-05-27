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
- `ActionButton` · anti-double-submit + feedback visual (ver sección debajo)

Icons en `app/studio/_components/icons.tsx` (objeto `Icon` con métodos por nombre).

## Anti-double-submit · usá `<ActionButton>`

`app/studio/_components/ui/ActionButton.tsx` es la convención del Studio para
**cualquier acción que no debe ejecutarse dos veces**. Resuelve 3 problemas en
uno: doble click humano (button disabled apenas se dispara), falta de feedback
visual (spinner durante loading + flash verde 2.5s post-éxito), y consistencia
visual (un solo componente para todo el Studio).

### Cuándo SÍ usarlo

- Mandar emails (welcome, factura, cotización, invitación, recovery)
- Convertir estados con side-effects (`draft→sent` dispara mail-rule-engine,
  `sent→accepted`, `accepted→shipment`, etc.)
- Crear asientos contables, facturas SENIAT, DIM
- Transferencias, payments, link de pago
- Marcar despachos / entregas (cambian timeline + cobros)
- Generar PDF / exportar (no idempotente si side-effect)

### Cuándo NO

- Filtros, búsquedas, navegación, ordenamientos
- Toggle UI (collapse, dark mode, expand row)
- Editar dentro de un drawer (form submit estándar)
- Links (`<a href>`)

### Patrón

```tsx
<ActionButton
  variant="primary"            // primary | dark | danger | ghost | warning
  size="sm"                    // sm | xs | default
  idleLabel="Enviar cotización"
  loadingLabel="Enviando…"
  successLabel="Enviado al cliente"  // null = no flash verde, vuelve directo
  idleIcon={Icon.mail(14)}
  successIcon={Icon.check(14)}
  successMs={2500}             // default 2500
  disabled={otherActionPending} // disabled externo (form inválido, etc.)
  onAction={async () => {
    setError(null);
    return markQuoteSent(quote.id);  // acepta `void` o `{ error }`
  }}
  onSuccess={() => {            // opcional · útil para liftear flag al padre
    setJustSent(true);
    setTimeout(() => setJustSent(false), 2500);
  }}
  onError={setError}
/>
```

### Convención `onAction`

Acepta los 2 patrones idiomáticos del Studio:

- **Server action que retorna `{ error }`** (lo más común) → el componente
  detecta el error automático y llama `onError(message)`.
- **Throw nativo** (`throw new Error("...")`) → también captura.

NO retornar `void` sin error es el caso happy → entra en flash verde.

### Extender visibilidad durante success flash

Si el padre desmonta el botón cuando cambia el estado del recurso (típico:
`{quote.status === "draft" && <ActionButton/>}`), el flash verde se corta antes
de que el usuario lo vea. Solución: liftear un flag `justSent` y extender
visibilidad:

```tsx
const [justSent, setJustSent] = useState(false);

{(quote.status === "draft" || justSent) && (
  <ActionButton
    ...
    onSuccess={() => {
      setJustSent(true);
      setTimeout(() => setJustSent(false), 2500);
    }}
  />
)}
```

### Accesibilidad

El componente ya incluye `aria-busy={isPending}` + `<span role="status"
aria-live="polite">` oculto para anunciar transiciones de estado a screen
readers. No necesitás agregar nada en el caller.

### Estilos

Variants oficiales (`studio-btn-primary | dark | ghost | danger | warning`)
+ el override automático `studio-btn-success` cuando entra en flash. Spinner
inline via `.studio-spin` (keyframe `studio-spin` definido en `studio.css`).

## Clases CSS reusables (`studio.css`)

- `.studio-btn` + variantes: `studio-btn-primary` / `-ghost` / `-danger` /
  `-sm` / `-xs`
- `.studio-input` + `.studio-input-mono` (JetBrains Mono para códigos)
- `.studio-label` · label estándar de form
- `.studio-display` · Archivo Black para títulos
- `.studio-eyebrow` · uppercase tracking-wide
- `.studio-row-flash` · highlight transitorio de row tras mutación (ver
  sección "Trazabilidad visual" debajo)

## Trazabilidad visual · principio de UX del Studio

> El operador típico de DTD trabaja en el Studio mientras lo interrumpen
> por WhatsApp, teléfono o cliente presencial. Cuando vuelve a la pantalla,
> tiene que poder retomar el contexto en 1-2 segundos. **Cualquier acción
> que muta datos debe dejar un rastro visual persistente** que sobreviva
> a la interrupción.

Esto no es opcional ni decorativo. Es **estándar del Studio aplicado a
todos los módulos** (Cotizador, Tracking, Clientes, CN, Expenses, Bugs,
Usuarios, TMS, Mailing, etc.). En la industria se llama "affordance
trails" / "motion-aware feedback".

### Las 3 reglas

1. **Crear → navegar al listado + highlight warm 4s + toast**.
   Toda acción que crea una nueva row en un listado (`+ Nueva cotización`,
   `+ Nuevo cliente`, `+ Nuevo embarque`, etc.) debe:
   - Navegar al listado con `?highlight=<id>&hl-tone=warm`.
   - Disparar `toast.success(...)` con link opcional al detalle.
   - La row aparece con fondo cálido (amarillo) durante 4s con fade-out.
   - Es el ÚNICO caso donde se navega automático.
   - Implementación: `useRowHighlight()` hook + clase
     `.studio-row-flash-warm`.

2. **Transición de state (sin moverse) → highlight success + toast**.
   Toda acción que cambia el state de una entidad pero el operador queda
   en la misma vista (`enviar`, `aceptar`, `tomar bug`, etc.) debe disparar:
   - Highlight verde de la row durante 4s (si el listado está visible),
     vía clase `.studio-row-flash-success`.
   - `<ActionToast>` con resumen + link al filtro nuevo
     (`?status=sent&highlight=...&hl-tone=success`).
   - NO navegamos al operador · él decide si clickea el link.

3. **Acción saca la row de la vista actual → toast con link es la traza**.
   Si la acción mueve la entidad a un filtro/vista donde el operador NO
   está mirando (ej: filtro actual = "Borrador" y la cotización pasó a
   "Enviada" — ya no aparece en la lista visible), el toast es la
   **ÚNICA** forma de trazabilidad disponible. **No navegamos automático**.
   El toast debe:
   - Decir qué pasó y dónde quedó (`"Cotización Q-... enviada · Ver en
     Enviadas"`).
   - El link al nuevo destino debe incluir `?highlight=<id>&hl-tone=success`
     para que al llegar el operador vea la row resaltada.

### Componentes que implementan esto

- `app/studio/_components/ui/useRowHighlight.ts` · hook que lee
  `?highlight=<id>` y `?hl-tone=warm|success` del URL. Devuelve
  `(id) => string` con la clase CSS que corresponde:
  ```tsx
  const flashClassFor = useRowHighlight();
  <tr data-row-id={q.code} className={`base ${flashClassFor(q.code)}`} />
  ```
  Hace scroll-into-view condicional (solo si la row no está visible) +
  respeta `prefers-reduced-motion`. Tras N ms hace `router.replace` para
  limpiar los params.

- `app/studio/_components/ui/ToastProvider.tsx` · context provider que
  va en el layout. Expone hook `useToast()` con `success/info/error/warning`.
  Renderiza portal en bottom-right (con offset a la izquierda del BugFAB).
  Cola max 3 visibles. Pausa al hover · cleanup automático en unmount.

- `.studio-row-flash-warm` · creación (amarillo suave, regla 1).
- `.studio-row-flash-success` · cambio de state (verde, reglas 2 y 3).

### Patrón del lado del caller

```tsx
// CREAR (regla 1) · navegamos + highlight warm + toast.
const result = await createQuoteAction(formData);
if (result.ok) {
  toast.success(`Cotización ${result.quoteCode} creada`, {
    link: { href: `/studio/cotizador/${result.quoteCode}`, label: "Abrir detalle" },
  });
  router.push(`/studio/cotizador?highlight=${result.quoteCode}&hl-tone=warm`);
}

// TRANSICIÓN DE STATE (reglas 2 y 3) · no navegamos · toast con link.
onSuccess={() => {
  toast.success(`Cotización ${quote.code} enviada al cliente`, {
    link: {
      href: `/studio/cotizador?status=sent&highlight=${quote.code}&hl-tone=success`,
      label: "Ver en Enviadas",
    },
  });
}}

// En el LISTADO:
const flashClassFor = useRowHighlight();
{quotes.map(q => (
  <tr
    key={q.id}
    data-row-id={q.code}
    className={`base-row ${flashClassFor(q.code)}`.trim()}
  >...</tr>
))}
```

### Cuándo NO aplicar

- Filtros y búsquedas (no mutan datos).
- Navegación pura (links sin acción).
- Operaciones puramente de lectura.
- Toggle de UI (collapse, dark mode, expand row).
- Acciones puramente client-side optimistic (likes, toggles que rebotan
  al server — el highlight ya pasó cuando el server responde).
- **Bulk operations**: un toast por item es spam. Usar **un solo toast
  resumen** ("12 cotizaciones marcadas como vencidas · Ver en
  Vencidas →").
- **Auto-saves de formularios** mientras el operador tipea — sería ruido
  visual constante.

### Para nuevos módulos

Al crear un módulo nuevo en el Studio, considerar de entrada cómo cumplir
las 3 reglas. Si el módulo tiene listado + acciones, debe usar
`useRowHighlight` y `useToast`. Esto se valida en el UI/UX review pre-merge.

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
