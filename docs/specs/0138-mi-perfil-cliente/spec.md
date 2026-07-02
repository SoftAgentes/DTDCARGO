---
sdd: "0138"
title: "Mi Perfil del cliente — identidad + direcciones de entrega múltiples (Portal → Norte)"
status: in-progress
author: "Ventana forja portal-norte-fase2 + founder"
created: 2026-07-01
updated: 2026-07-01
supersedes: null
superseded_by: null
related: ["0042", "0048", "0131", "0106", "0065", "0133"]
confidencialidad: interno
---

# SDD-0138 · Mi Perfil del cliente (Portal → Norte)

> Cierra el mayor hueco visible entre el Portal del Cliente actual y el Norte
> (`_norte/portal/app.jsx` · `PortalProfile`, líneas 2036-2276). Hoy el portal parte
> el perfil en dos: `/portal/perfil` (express: foto + 1 dirección, que carga el
> cliente) y `/portal/cuenta` (read-only, mediado por el asesor). El Norte muestra
> **una identidad rica**: tipo persona/empresa + documento, y **varias direcciones de
> entrega** con predeterminada y costo de last-mile por dirección.

## Contexto

- El registro persona/empresa ya existe (**SDD-0131**): `clients.doc_kind`
  (`persona`|`empresa`, migr 0092) + `clients.rif` (cédula o RIF, migr 0006). Esos
  datos **ya están en DB pero el portal no los mostraba**.
- La dirección de entrega hoy es **un único string** (`clients.address`, migr 0006),
  administrado por el asesor y mostrado read-only (**SDD-0048**).
- El Norte asume dirección **estructurada y múltiple** + last-mile por zona.

## Alcance por slices

### Slice A · Exponer identidad (persona/empresa + documento) — ✅ HECHO
Sin migración (misma fila que la RLS del portal ya deja leer).
- `PortalClient` gana `docKind: ClientDocKind | null` y `rif: string | null`
  (`lib/portal/portal-types.ts`).
- `getPortalClient` agrega `rif, doc_kind` al `select` y normaliza `doc_kind` a los
  dos valores canónicos (`lib/portal/portal-queries.ts`).
- `/portal/cuenta` muestra dos campos read-only: **Tipo de cliente**
  (`docKindLabel`) y **Cédula / RIF** (etiqueta según `docKind`).
- **Regla de audiencia:** read-only en el portal — la identidad la administra el
  asesor (mismo criterio que el resto de `/cuenta`). El cliente pide correcciones por
  el CTA de WhatsApp existente.

### Slice B · Direcciones de entrega múltiples — ✅ CÓDIGO HECHO · migración 0198 SIN APLICAR
Nueva capacidad: el cliente tiene N direcciones, una predeterminada. **También se
editan desde el perfil del cliente en el ERP (Studio) — mismo esquema** (recordatorio
founder 2026-07-01); el wiring del Studio queda como paso siguiente sobre la misma
capa `lib/studio/client-address-*`.

Construido en esta rama: migración-archivo + `lib/studio/client-address-{types,queries}.ts`
(capa compartida portal↔Studio) + server actions del portal
(`app/portal/(app)/cuenta/address-actions.ts`, client de SESIÓN — la RLS self
garantiza propiedad) + UI `PortalAddresses` en `/cuenta` (lista + agregar +
predeterminar + eliminar; fetch best-effort → si la migración no está aplicada,
degrada a lista vacía sin romper) + tests del validador.

- **Migración `0198_client_delivery_addresses.sql`** (archivo en esta rama, la aplica
  el Director tras dry-run):
  - Tabla `public.client_delivery_addresses` `{ id uuid pk, tenant_id, client_id fk
    clients, label, line, city, state, reference, is_default bool, created_at,
    updated_at, deleted_at }`.
  - **RLS por tenant** (patrón del repo: policy que scopea por `tenant_id` — regla
    ⭐ "RLS por TENANT no por rol", SDD-0085) + acceso del portal vía el mismo
    `get_portal_client_id()` (el cliente sólo ve/edita SUS direcciones).
  - Índice único parcial: **una sola predeterminada por cliente**
    (`unique (client_id) where is_default and deleted_at is null`).
  - `revoke execute` anon/public donde aplique (convención seguridad).
  - Migrar el `clients.address` actual a una primera fila `is_default = true`
    (backfill), sin romper la columna vieja (se mantiene como legacy hasta cortar).
- Queries `lib/portal/portal-address-queries.ts`: `listMyDeliveryAddresses`,
  `upsertDeliveryAddress`, `deleteDeliveryAddress`, `setDefaultDeliveryAddress`
  (funciones puras que reciben `SupabaseClient`).
- Server actions `app/portal/(app)/cuenta/address-actions.ts` (`"use server"` +
  `validate*Input()` propio, **no Zod** — convención del Studio) + `revalidatePath`.
- UI: sección "Direcciones de entrega" en `/portal/cuenta` (o pantalla unificada
  `/portal/perfil`): lista + marcar predeterminada + agregar/editar/eliminar. Espeja
  `PortalProfile` del Norte (2060-2087).

### Slice C · Last-mile por dirección — PENDIENTE (necesita PRICING del founder)
El Norte muestra costo de entrega por dirección (`_lastMileZone(city, state)`).
- Requiere fuente de tarifas: tabla `last_mile_zones` o RPC `get_last_mile_fee`.
- **Gate del founder:** las tarifas de última milla son decisión comercial — no se
  inventan. Bloqueado hasta que el founder defina la matriz (ciudad/estado → tarifa).

### Slice D · Avatar editable + registrar empresa — PENDIENTE (baja prioridad)
- Avatar editable desde Mi Perfil (hoy la foto sólo se carga en el registro express;
  separar **foto de cédula** —privada, verificación— del **avatar** —editable).
- Card "¿Importas para tu negocio? Registra tu empresa" (persona → alta de segunda
  identidad empresa vinculada por `person_id`, SDD-0106/0131).

## No-objetivos
- No se toca la frontera pública↔ERP (el portal es superficie del ERP).
- No se cambia el modelo mediado-por-asesor de la identidad (Slice A es read-only).
- No se inventan tarifas de last-mile (Slice C gateado).

## Verificación
- `node scripts/verify.mjs` verde · `pnpm build`.
- Slice A: `/portal/cuenta` muestra Tipo + Documento para un cliente con `doc_kind`
  y `rif` cargados; degrada honesto ("Sin especificar" / "Sin documento cargado")
  cuando faltan.
- Slice B (al construirse): la RLS impide que un cliente vea direcciones de otro;
  índice único garantiza una sola predeterminada; dry-run tx de la migración antes
  de aplicar (patrón del repo para branches efímeros).
