# 2026-07-22 · Portal del cliente — paridad Norte (cierre)

**Rol:** integrador directo en `main` (sin worktree dedicado — sesión Claude Code interactiva, cada paso confirmado/pusheado por el founder en vivo).

## Alcance

Serie de correcciones puntuales al Portal del Cliente para cerrar drift contra el diseño Norte, a pedido del founder en la misma sesión:

1. **`ef94d230`** — "Nueva compra": modal viejo (overlay claro) → pantalla completa (`/portal/compras/nueva`), como especifica el mockup Cloud Design ("pantalla completa, no ventana flotante"). Actualizados todos los puntos de entrada (sidebar "Crear", proveedores, hub de alertas, compras). Borrado `NewPurchaseModal.tsx`.
2. **`fa23aa31`** — `/ui-check` sobre lo anterior: token `#fff` crudo → `var(--color-on-accent)`; borrado `PortalShipmentsNorte.tsx` (huérfano, cero importadores desde hace semanas).
3. **`a08373a6`** — SDD-0075: `SHIPMENT_ACCEPTANCE_CTA_LIVE` false→true (gate del founder, formaliza el CTA de aceptación en el detalle del envío para todos los clientes; duplica lo que ya vive en el dashboard, no abre capacidad nueva).
4. **`ac63499f`** — Calculadora flotante del portal: quitado CBM (redundante, ya accesible en otro lado), agregado FCL (embebe `/fcl/embed`, que ya venía preparado con headers SAMEORIGIN + tema para justo este propósito), "Rápida" pasa a pestaña por defecto. Corregido el test golden-path (`__tests__/seo-remates.test.ts`) que fijaba el contrato viejo.

**Nota de proceso:** antes de tocar la calculadora, el founder pidió más contexto — se le mostró un esquema (Artifact) + se citó el texto exacto del diseño Norte antes de decidir el alcance real (agregar FCL, sacar CBM, default Rápida). Evita repetir la primera propuesta equivocada (agregar FCL manteniendo CBM).

## Rutas propias

- `app/portal/(app)/compras/nueva/page.tsx` (nuevo)
- `app/portal/(app)/compras/nueva/NewPurchaseForm.tsx` (nuevo)
- `app/portal/_components/PortalFormField.tsx` (nuevo)
- `app/portal/_components/NewPurchaseButton.tsx`
- `app/portal/_components/NewPurchaseModal.tsx` (borrado)
- `app/portal/(app)/envios/_components/PortalAlertasHub.tsx`
- `app/portal/(app)/envios/_components/PortalShipmentsNorte.tsx` (borrado)
- `app/portal/(app)/envios/page.tsx`
- `app/portal/(app)/proveedores/SuppliersClient.tsx`
- `app/portal/(app)/compras/page.tsx`
- `app/portal/(app)/_components/PortalDashboard.tsx` (1 línea, sigue siendo el kill-switch dormido de `NORTE_PORTAL_LIVE`, no se toca su rol)
- `app/portal/_components/PortalSidebar.tsx`
- `lib/portal/demo.ts`
- `app/portal/_components/PortalCalcFab.tsx`
- `__tests__/seo-remates.test.ts`

## Verificación

Por cada commit: `tsc --noEmit`, `eslint` sobre archivos tocados, `vitest run` completo (279 archivos / 3880 tests) y `next build` de producción — todos verdes antes de commitear. Detalle en el propio historial de commits (mensajes largos con contexto).

## Commit / Push

4 commits atómicos y selectivos en `main`, cada uno pusheado con OK explícito del founder en el momento (`ef94d230` → `fa23aa31` → `a08373a6` → `ac63499f`). `origin/main` al día (`git rev-list --left-right --count origin/main...HEAD` = `0 0`).

## Migraciones / deploy

Ninguna migración. Deploy = el mecanismo estándar del repo (push a `main` → Vercel), sin acción manual adicional.

## Pendientes que quedaron fuera de este cierre

- `compras/[code]/etiquetas/page.tsx:35` — TODO "Slice futuro": adjuntar packing list al generador de etiquetas.
- SDD-0075 Slice B (re-aceptación por medida real) sigue sin construir — toca dinero, requiere migración.
- El checklist completo de paridad Norte que originó esta sesión sigue disponible en el historial de chat si se quiere retomar otra pieza.

## Siguiente responsable

Ninguno pendiente — sesión cerrada, nada en cola. Próxima ventana que toque el portal puede partir de este handoff.
