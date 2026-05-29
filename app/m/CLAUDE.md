# CLAUDE.md — app/m (PWAs operario mobile)

Contexto focalizado para las PWAs operario que viven en `app/m/*`. El
CLAUDE.md de raíz tiene el contexto general del repo (sitio público vs
Studio vs mobile). El de `app/studio/` tiene los patrones del ERP web.

Este archivo extiende el del Studio con las particularidades del namespace
`/m/*`: auth por PIN, sesión via cookie, RPCs SECURITY DEFINER, safe-area-inset,
Realtime, push notifications.

## Estructura de las PWAs

| Ruta | Operario | Auth | Audiencia |
|---|---|---|---|
| `/m/cn/*` | Almacén CN (Wang Hua, Yiwu) | PIN 4 dígitos | Operario que recepciona mercancía en hub CN |
| `/m/ve/bodeguero/*` | Bodeguero VE | PIN 4 dígitos | Operario que arma camiones en hub VE |
| `/m/ve/camionero/*` | Camionero VE | PIN 4 dígitos | Operario que entrega ODs en ruta |
| `/m/erp/*` | Mobile ERP staff | Supabase email+password | Carlos / Martina / Yusneidy (admin/comercial/ops) |

## Auth · PIN custom (NO Supabase Auth)

El operario NO es `auth.users`. Usa PIN 4 dígitos contra `verify_operario_pin`
RPC (service_role) que setea cookie HTTP-only `dtd_op` con `operario_id`.

- **`lib/auth/operario-session.ts`** · `signInWithPin()` + `getCurrentOperario()`.
- **Cookie**: `dtd_op` (HTTP-only, 12h, path `/m`).
- **Re-validación**: cada server component llama `getCurrentOperario()` que
  hace SELECT contra DB para confirmar `active=true`. Si el operario se
  desactiva mid-session, la próxima request lo bota.
- **NO usar el proxy.ts**: el proxy raíz solo cubre `/studio/**` y `/back/**`.
  Las PWAs operario usan page-level guards (`if (!operario) redirect(...)`).

## Mutaciones operario · OBLIGATORIO

Como el operario no tiene `auth.uid()`, las mutaciones operario van por
RPCs `SECURITY DEFINER` con grant solo a `service_role`. **NO usar UPDATE
directo con RLS** — no funcionará.

### Patrón

```ts
"use server";

import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";

export async function someActionAsOperario(/* ... */) {
  const op = await getCurrentOperario();
  if (!op) return { error: "Sesión expirada." };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("some_rpc", {
    p_operario_id: op.operario_id,
    // ... otros params
  });

  if (error) return { error: humanizeRpcError(error.message) };
  return { ok: true, /* data */ };
}
```

### RPCs operario existentes (referencia)

- `verify_operario_pin(p_pin)` · valida PIN, retorna identidad. Service_role.
- `create_receipt_as_operario(...)` · CN registra recepción. Service_role.
- `link_receipt_photo(...)` · CN linkea foto subida al receipt.
- `bodeguero_advance_od(...)` · cambia status OD (creada→cargando→lista).
- `bodeguero_split_p2(...)` · fracciona paquete.
- `camionero_advance_od(...)` · cambia status OD (lista→en_ruta→entregada).
- `camionero_pod(...)` · sube POD con foto + firma.

## Patrones OBLIGATORIOS del Studio que las PWAs heredan

Ver `app/studio/CLAUDE.md` para detalle. Aplican igual acá:

### `<ActionButton>` para mutaciones

Toda mutación operario (registrar recepción, avanzar OD, confirmar POD,
reasignar driver, editar recepción) debe usar `<ActionButton>` del Studio:

```tsx
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";

<ActionButton
  variant="primary"
  size="sm"
  idleLabel="Registrar recepción"
  loadingLabel="Guardando…"
  successLabel="Recepción guardada"
  idleIcon={Icon.check(14)}
  successIcon={Icon.check(14)}
  onAction={async () => {
    const result = await createReceiptAction(payload);
    return result;  // { ok, error } — ActionButton lo maneja
  }}
  onError={setError}
/>
```

**Por qué obligatorio**:
- Anti-double-submit (el operario apurado bajo presión tap-tap-tap-tap).
- Flash verde 2.5s = feedback que sobrevive interrupciones (WhatsApp,
  cliente entrando, etc).
- `aria-busy` + `role="status"` auto.

### `<ToastProvider>` + `useToast()`

`app/m/layout.tsx` envuelve TODAS las PWAs operario en `<ToastProvider>`.
Cualquier client component puede llamar `useToast()`:

```tsx
import { useToast } from "@/app/studio/_components/ui/ToastProvider";

const toast = useToast();
toast.success("Recepción RCP-2026-0042 guardada", {
  link: { href: "/m/cn", label: "Ver mis recepciones" },
});
```

### `<NumericInput>` para cajas / CBM / peso

Toda input numérico operario (cajas, CBM, peso, monto) usa `<NumericInput>`:

```tsx
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";

<NumericInput
  type="count"
  unit="cajas"
  value={boxes}
  onChange={(v) => setBoxes(v)}
  placeholder="0"
  min={1}
/>

<NumericInput
  type="volume"
  value={cbm}
  onChange={(v) => setCbm(v)}
  placeholder="0.00"
/>
```

**Por qué importa para el operario**: Wang Hua suma cajas mentalmente
cuando vienen en pallets de varios tamaños. `12+8+7.5` en el input →
preview "= 27.5 cajas" → confirma sin sacar calculadora.

### `useRowHighlight()` en listados

Cuando un listado tiene mutaciones (registrar nueva recepción → home;
cambiar status OD → home bodeguero), usar `useRowHighlight()`:

```tsx
import { useRowHighlight } from "@/app/studio/_components/ui/useRowHighlight";

const flashClassFor = useRowHighlight();
{recents.map(r => (
  <div data-row-id={r.code} className={flashClassFor(r.code)}>
    {/* ... */}
  </div>
))}
```

Redirect post-acción a `/m/cn?highlight=<code>&hl-tone=warm` (crear) o
`hl-tone=success` (transition state).

### `<EmptyState>` para listas vacías

NO escribir empty states ad-hoc. Usar:

```tsx
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

<EmptyState
  eyebrow="Sin ODs"
  title="No tenés ODs por armar"
  description="Cuando el admin asigne ODs nuevas las vas a ver acá."
/>
```

## Mobile-specific (NO está en Studio)

### Safe area insets

Todos los headers/footers de PWA respetan notch + bottom safe area:

```tsx
style={{
  paddingTop: "env(safe-area-inset-top)",
  paddingBottom: "env(safe-area-inset-bottom)",
}}
```

### Realtime · cross-cliente sync

Migration `0043_realtime_dispatch.sql` habilita Realtime publication para
`dispatch_orders`, `dispatch_order_packages`, `warehouse_receipts_cn`. Las
PWAs operario usan `useRealtimeRefresh()` para sync sin polling:

```tsx
import { useRealtimeRefresh } from "@/lib/studio/hooks/use-realtime-refresh";

const realtime = useRealtimeRefresh({
  table: "dispatch_orders",
  filter: `tenant_id=eq.${tenantId}`,
});

<RealtimeIndicator status={realtime.status} />
```

### Service Worker · `public/m/sw.js`

Registrado por `app/m/_components/PwaRegister.tsx` con scope `/m/`. V1
es stub minimal. V2 (Sprint 4): sumar `push` handler para notifications
background cuando la PWA está cerrada.

### PWA install · manifest.json

`public/m/manifest.json` define la PWA (icon, theme color, display
standalone). El operario instala via "Agregar a pantalla de inicio" del
browser.

## Convenciones mobile-specific

- **Bilingüismo ES/中文**: solo CN tiene toggle ES/CN hoy. Sprint 4 lo
  extiende a VE.
- **Tap target mínimo**: 44×44 px (Apple HIG / WCAG 2.5.8).
- **Icon set**: `app/studio/_components/icons.tsx` — el mismo del Studio.
- **Tipografía**: igual al Studio (Archivo + JetBrains Mono + Noto Sans SC).
- **Tokens**: importa `app/studio/studio.css` que incluye `tokens.css`.

## Lo que NO se hace en mobile

- ❌ NO usar `<input type="number">` HTML crudo → usar `<NumericInput>`.
- ❌ NO usar `<button>` HTML crudo en mutaciones → usar `<ActionButton>`.
- ❌ NO usar `disabled={isPending}` manual → `<ActionButton>` lo hace.
- ❌ NO usar `rgba(255,...)` inline → usar tokens `--ink-inv-soft`/`--ink-inv-mute`.
- ❌ NO crear empty states ad-hoc → usar `<EmptyState>`.
- ❌ NO depender de RLS para multi-tenancy operario → service_role + filter explícito.
- ❌ NO escribir handlers `push` en un SW separado → mergear con `public/m/sw.js`.
