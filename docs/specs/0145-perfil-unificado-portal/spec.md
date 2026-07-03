---
sdd: "0145"
title: "Mi perfil unificado del portal — una sola pantalla espejando el Norte"
status: in-progress
author: "Claude Code (ventana secundaria · worktree perfil-norte) + founder"
created: 2026-07-03
updated: 2026-07-03
supersedes: null
superseded_by: null
related: ["0042", "0131", "0138"]
confidencialidad: interno
---

# SDD-0145 · Mi perfil unificado del portal

> Unifica `/portal/cuenta` (Mi cuenta, SDD-0042) y `/portal/perfil` (Completa tu
> perfil, registro express) en **UNA** pantalla `/portal/perfil` ("Mi perfil"),
> espejando el mockup `PortalProfile` del Norte
> (`docs/design/studio/_norte/portal/app.jsx:2036`). Pedido founder 2026-07-03.

## Contexto

El portal tenía la identidad del cliente repartida en dos pantallas:

- `/portal/cuenta` — datos read-only + Shipping Mark + direcciones (SDD-0138) +
  avatar (Slice D) + card proveedores.
- `/portal/perfil` — "Completa tu perfil": foto de cédula + dirección VE en
  cascada (flujo del registro express), con su propia dirección legacy
  (`clients.address`).

El Norte define UN "Mi perfil" (menú del nombre → una sola entrada): columna
izquierda de identidad (avatar + badge tipo de cuenta + card navy "TU CÓDIGO" +
copiar) y columna derecha con Datos de cuenta, Identidad y documentos, y
Direcciones de entrega.

## Alcance

1. **`/portal/perfil` = página unificada** (server component):
   - **Columna izquierda**: `AvatarEditor` (REUSO, SDD-0138 Slice D) + badge
     "Cuenta de empresa / Cuenta personal" (por `doc_kind`) + card "TU CÓDIGO"
     con el Shipping Mark en JetBrains Mono sobre gradiente `--hero-*` (tokens
     temáticos, memoria portal-hero) + botón "Copiar código" (client,
     `navigator.clipboard` + feedback "Copiado").
   - **Datos de cuenta** (read-only): nombre, email, teléfono, ciudad (de la
     dirección predeterminada). CTA WhatsApp "Actualizar mis datos" — modelo
     mediado por asesor (SIN edición self-service, igual que hoy).
   - **Identidad y documentos**: datos personales (nombre completo, cédula/RIF
     según `doc_kind`) + datos de empresa (razón social, RIF) si es empresa +
     fila de documento "Cédula de identidad / RIF": si hay
     `cedula_photo_path` → check + "Ver" (signed URL server-side 1h, patrón
     avatar); si falta → fila PENDIENTE con subida inline
     (`uploadCedulaPhotoAction`, foto-only).
   - **Direcciones de entrega**: `PortalAddresses` (REUSO completo, SDD-0138
     B+C: múltiples + predeterminada + estimado last-mile).
   - **Card proveedores** ("Que tu proveedor lo escriba en cada caja", pasos
     01-03): se CONSERVA al final de la columna derecha (delta prod que supera
     al Norte — onboarding de Shipping Mark).
   - Card "¿Importas para tu negocio?" (solo `doc_kind ≠ empresa`): se conserva.
2. **`/portal/cuenta` → `permanentRedirect("/portal/perfil")`** (301 interno).
   Componentes y actions se MUEVEN a `perfil/` (`AvatarEditor`,
   `PortalAddresses`, `avatar-actions`, `address-actions`; `revalidatePath` →
   `/portal/perfil`).
3. **`PortalAccountMenu`**: una sola entrada "Mi perfil" (se elimina "Mi
   cuenta" del dropdown).
4. **`ProfileIncompleteCard`**: ambos CTAs apuntan a `/portal/perfil` (la
   dirección se carga ahí con PortalAddresses).
5. **`ProfileForm` (cascada VE + foto) se ELIMINA**: la dirección canónica es
   SDD-0138 (`client_delivery_addresses`; `getProfileCompleteness` ya hace OR
   con la legacy) y la foto pasa a la fila de documento. `completeProfileAction`
   se reemplaza por `uploadCedulaPhotoAction` (misma defensa en profundidad:
   `get_portal_client_id` + admin scopeado + rollback de foto huérfana +
   borrado best-effort de la reemplazada).

## Deltas donde prod SUPERA al Norte (NO regresionar)

- **Sin "Cambiar contraseña"** (el Norte lo muestra; eliminado 2026-07-03 —
  portal = magic link puro).
- Direcciones múltiples con predeterminada + estimado last-mile por dirección
  (el Norte usa mock de 2 direcciones).
- Avatar persistido en Storage con signed URL (el Norte usa localStorage).
- Card "¿Importas para tu negocio?" mediada por asesor vía WhatsApp (el Norte
  tiene un botón sin backend).

## Fuera de alcance

- Fila "Fachada del local" del Norte para empresas: NO hay columna/bucket para
  esa foto hoy → no se inventa dato; queda para una spec de identidad de
  empresa.
- Edición self-service de datos de cuenta (sigue mediada por asesor).
- Registro de empresa self-service (sigue por WhatsApp).

## Verificación

- `tsc --noEmit` + ESLint + tests tocados en verde (gate final verify/build =
  Director).
- Check `ui-ux-designer` antes del commit final (regla founder).
- Manual: perfil completo (foto ✓ + direcciones) · perfil incompleto (fila
  pendiente + subida inline) · empresa vs persona · dark mode (tokens
  `--hero-*`).
