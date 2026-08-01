# CLAUDE.md — app/studio (DTD Studio ERP)

Contexto focalizado del ERP interno. Cargá esto cuando trabajes dentro de
`app/studio/`. El CLAUDE.md de raíz tiene el contexto general del repo
(dualidad sitio público vs Studio, comandos, brand).

Antes de cambiar comportamiento o componentes, sigue la cápsula operativa en
[`docs/governance/AGENT-BRIEF.md`](../../docs/governance/AGENT-BRIEF.md).
El Norte define apariencia; el registro de gobernanza define comportamiento y
madurez CMP. Ambos se validan en el mismo SDD, sin copiar reglas localmente.

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

## Estándar de botones del Studio · 8 reglas

Decisión arquitectónica del founder: TODOS los botones del Studio se
comportan según estas reglas. Aplican cross-módulo y se validan en el
UI/UX review pre-merge. Si una pantalla nueva tiene botones, debe
cumplirlas todas.

### Regla 1 · Variantes visuales (cuándo usar qué tono)

| Variante | Cuándo | Ejemplo |
|---|---|---|
| `primary` (wine) | Acción principal de la pantalla. **Una sola** por contexto. | "Enviar cotización", "Crear cliente", "Convertir a embarque" |
| `dark` (navy) | Acción secundaria importante pero no destructive. | "Marcar despachado", "Asignar ruta" |
| `ghost` (outline) | Acciones secundarias, cancelar, navegación. | "Editar", "Cancelar", "Cerrar" |
| `danger` (red) | Acciones destructivas o de rechazo. | "Eliminar", "Rechazar", "Cancelar embarque" |
| `warning` (gold) | Requiere atención · no destructiva pero significativa. | "Marcar excepción", "On hold" |
| `success` (green) | **NUNCA como idle** · solo flash transitorio post-éxito. | (estado interno de ActionButton) |

### Regla 2 · Tamaños y proporciones

- `default` · botones primarios del header de página.
- `sm` · botones en drawers, modals, tablas, listados.
- `xs` · chips, badges interactivas, micro-acciones en cells.
- `min-width: max-content` para evitar reflow entre estados.
- `gap: 6px` entre icono y label.

### Regla 3 · Estados (anti-doble-submit + feedback)

Todo botón crítico (mutación de datos) usa `<ActionButton>` que garantiza:

```
idle → loading (disabled, spinner inline)
     → success (verde, flash 2.5s) → desmonte por revalidate
     → error (vuelve a idle, error en banner separado)
```

Disabled durante loading **y** success → segundo click es no-op.

### Regla 4 · Trazabilidad visual (rastro de la acción)

Toda acción crítica debe dejar rastro visible al operador para el caso
"alguien me interrumpió mientras la disparé". Ver sección "Trazabilidad
visual" arriba. Mínimo:

1. Botón cambia a verde 2.5s ("Enviado al cliente") · vía ActionButton.
2. Toast en bottom-right con resumen + link al destino · vía useToast.
3. Highlight de row en el listado destino · vía useRowHighlight.

### Regla 5 · Patrones avanzados disponibles

| Patrón | Cuándo |
|---|---|
| `<ActionButton>` | Default · acción única con anti-doble-submit |
| `<SplitActionButton>` | Cuando hay 2-4 variantes de la misma acción (ej: "Crear y cerrar" vs "Crear y dejar abierta") · con **memoria** de última opción usada |
| Confirm inline | "Convertir a embarque → ¿Sí/No?" · para acciones que dispararían algo grande sin doble-check |
| Modal de confirmación | Para destructivos irreversibles · "¿Eliminar definitivamente?" |

### Regla 6 · Accesibilidad

- `aria-busy={isPending}` durante loading.
- `role="status"` + `aria-live="polite"` para anuncios de cambio de estado.
- `outline` visible al focus (auto vía `.studio-btn:focus-visible`).
- Tamaño mínimo touch target: 32×32px.
- Teclado: `Enter`/`Space` activa · `Esc` cancela menús abiertos.
- En menús desplegables: click afuera cierra · `Tab` navega entre items.

### Regla 7 · Copy

- **Sentence case**, no UPPERCASE: "Enviar cotización" ✓ · "ENVIAR" ✗.
- Verbos directos: "Enviar", "Crear", "Aceptar", "Marcar despachado".
- **Cero emojis decorativos** en CTAs. (✓ check icon vía Icon.check sí.)
- Castellano venezolano neutro — TUTEO, cero voseo: "Envía", "Marca",
  "Acepta" (nunca "Enviá/Marcá/Aceptá"; el voseo es argentino, no se habla
  en Venezuela).
- Estado loading: gerundio + ellipsis: "Enviando…", "Procesando…",
  "Marcando…".
- Estado success: participio pasado: "Enviado al cliente",
  "Marcado despachado", "Aceptada".

### Regla 8 · Posicionamiento en el footer/header

- **Primary a la derecha** del bloque de botones.
- **Cancelar/secundarios a la izquierda**.
- **Destructive separado** del bloque principal (no al lado de positive)
  · evita clicks accidentales.
- Si hay split button con memoria, el botón principal va a la derecha
  (siguiendo la regla anterior) y el chevron va al lado derecho del
  principal.

### Componentes que implementan estas 8 reglas

- `app/studio/_components/ui/ActionButton.tsx` · Reglas 1-3, 4 (parcial), 6, 7.
- `app/studio/_components/ui/SplitActionButton.tsx` · Reglas 1-7 + memoria.
- `app/studio/_components/ui/ToastProvider.tsx` · Regla 4.
- `app/studio/_components/ui/useRowHighlight.ts` · Regla 4.
- `app/studio/_components/ui/NumericInput.tsx` · Inputs numéricos con
  expresiones + adornment + preview (sección "Inputs numéricos" abajo).

Si vas a usar `<button>` HTML crudo en lugar de estos componentes, debés
justificar por qué en el PR description y validar las 8 reglas a mano
en el UI/UX review.

## Columnas configurables · usá `useColumnConfig` + `<ColumnManager>`

**Regla del founder (2026-07-03):** toda tabla de listado de módulo debe ofrecer
**columnas configurables por usuario** (mostrar/ocultar + reordenar) — cada
operador la ve a su manera y su configuración **queda grabada**. La metodología
viene del handoff del Norte "Almacén CN → columnas configurables"
(`docs/design/studio/_norte/erp/modules/cn.jsx` · `CNColumnManager`).

Primitiva transversal: `app/studio/_components/ui/columns/ColumnConfig.tsx`.
Primer módulo consumidor: PreAlertas de servicios (`proveedores/`).

### Contrato

- El **array maestro** de columnas (`{ key, label, width, align?, sort?, render }`)
  vive en el módulo y NO se persiste. El `key` es el contrato estable.
- Lo persistido es `{ key, visible }[]` (orden + visibilidad) en localStorage
  bajo clave propia del módulo (`dtd-<modulo>-cols-v1`), vía
  `useColumnConfig(key, DEFAULTS)`. La carga **reconcilia**: descarta keys
  muertos, agrega al final los keys nuevos del default (una columna nueva llega
  sola a usuarios con config vieja) y cae al default ante parse inválido.
- `visibleColumns` se deriva SIEMPRE con `.filter(Boolean)` (red de seguridad).
- `<ColumnManager cfg setCfg defaults labels />` = botón "Columnas N" + popover:
  ▲▼ reordena (swap con el adyacente, NO drag), checkbox muestra/oculta,
  Restablecer.
- **Orden clickeable**: si la columna define `sort: [primerClick, siguiente]`,
  el header es un botón que alterna con flecha ▲/▼; el sort elegido también se
  persiste (`dtd-<modulo>-sort-v1`).
- **Agregar una columna nueva** = tocar DOS lugares: el array maestro + el
  default de visibilidad. Nada más.
- El export CSV (si el módulo tiene) es **independiente** de las columnas
  visibles: header fijo, salvo decisión explícita.
- Pendiente evolutivo: persistir además en preferencias de usuario vía API
  (hoy es por navegador).

### Cuándo NO aplica

- Tablas cortas de detalle (líneas de un asiento, items de un drawer).
- Kanbans, calendarios, timelines — no son tablas de columnas.
- Tablas de configuración chicas (< 4 columnas) donde no hay nada que ocultar.

## Inputs numéricos · usá `<NumericInput>`

Todos los inputs numéricos del Studio (kg, CBM, USD, cajas, montos) deben
usar `app/studio/_components/ui/NumericInput.tsx` en vez de `<input
type="number">` HTML crudo. Razones:

1. **Expresiones aritméticas inline**: el operador puede escribir
   `233+2` o `0.45 + 0.32 + 0.18` y ver el resultado en vivo · ahorra
   sacar la calculadora cuando suma peso/CBM de varias cajas.
2. **Adornment lateral fijo**: el símbolo de moneda (`$` izquierda) o
   unidad (`kg` derecha) queda siempre visible · el operador SABE en qué
   campo está sin leer el label cada vez.
3. **Preview formateado debajo**: muestra el número parseado con
   separador de miles (`= USD 12,323.00`, `= 235 kg`, `= 15 cajas`) ·
   confirma visualmente el valor sin reformatear el input en vivo (que
   rompería la posición del cursor).
4. **Form submission limpia**: el hidden input con el value canónico
   (number) va al form, no la expresión raw. La server action recibe
   `cbm=0.95` aunque el operador escribió `0.45+0.32+0.18`.
5. **Parser seguro**: whitelist regex de operadores permitidos
   (`+ − × ÷ ( )`) · NO usa `eval()` crudo.
6. **Acepta coma o punto decimal**: tanto `12.5` como `12,5` son
   válidos · convención mixta de copy-paste de operadores.

### Tipos disponibles

| `type` | Adornment | Preview |
|---|---|---|
| `currency` | `$` (o `€`/`Bs.`) prefijo | `= USD 12,323.00` |
| `weight` | `kg` sufijo | `= 235 kg` |
| `volume` | `m³` sufijo | `= 0.95 m³` |
| `count` | (sin sufijo o custom, ej `cajas`) | `= 15` o `= 15 cajas` |
| `decimal` | (ninguno) | `= 12,323.50` |

### Patrón del caller

```tsx
<NumericInput
  id="qd-cbm"
  name="cbm"
  type="volume"
  required
  min={0}
  placeholder="3.40"
  value={cbm === "" ? null : Number(cbm)}
  onChange={(v) => setCbm(v != null ? String(v) : "")}
/>
```

### Convención de formato (V1)

- Decimal: `.` (punto)
- Thousand separator: `,` (coma)
- Símbolo moneda: `$` prefijo + `USD` en preview
- Unidad peso: `kg` (no g/t en V1)

Esto se hace configurable en SDD-0037 Sistema de Preferencias (futuro)
donde el user podrá elegir formato VE (`12.323,50`) vs US
(`12,323.50`).

### Cuándo NO usar `<NumericInput>`

- Inputs de date/time (usar `<input type="date">` nativo).
- Inputs de tracking codes / MARKBOX / RIF (alfanuméricos · no son
  numéricos puros).
- Counters de UI internos (paginación, etc.) · ahí está bien
  `<input type="number">` simple.

## Convenciones operativas

- **MARKBOX** = ID estable de cliente, formato `DTD-NNNN`. Autogenerado por
  `supabase.rpc("next_markbox", { p_tenant_id })` — nunca lo asignas manual.
  De cara al usuario el nombre visible es **"Shipping Mark"** (SDD-0065);
  `markbox` queda SOLO como identificador interno (columnas, RPCs, props).
- **Multi-tenant**: todas las tablas tienen `tenant_id` con RLS. Resolver
  siempre desde `user_tenants` en cada server action.
- **Soft delete**: nunca `DELETE`. Setear `deleted_at = now()` (acción
  `softDelete*Action`).
- **Códigos correlativos** (shipment `S-2026-NNNN`, route `R-2026-NNNN`, etc.):
  generados por RPCs en Supabase, no en código.
- **Sentence case** en CTAs: `+ Nueva cotización`, no `+ NUEVA COTIZACIÓN`
  (regla BRAND §Tono). El único uppercase válido es eyebrows con
  `text-transform: uppercase` vía CSS.
- **Idioma**: castellano venezolano neutro (tuteo, cero voseo; "embarque").
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

- ~~`window.prompt()`/`window.confirm()` nativos~~ — **RESUELTO**: existe
  `app/studio/_components/ui/ConfirmDialog.tsx` (confirm + variante con motivo).
  Migrados VeRowActions (`PromptModal`), Fiscal (asentar/anular libro),
  Withholdings (anular comprobante), Noticias-web (descartar artículo). **Para
  cualquier confirmación/destructivo nuevo usar `<ConfirmDialog>`, nunca
  `window.confirm/prompt/alert`** (usar `useToast` para avisos).
- Field helpers (`FieldText`, `FieldSelect`, `FieldError`, `FormError`) viven
  en `tms/_components/TruckDrawer.tsx` con prefijo `tms-` hardcoded en IDs.
  Si vas a usarlos en otro módulo, parametrizá el prefijo primero.
