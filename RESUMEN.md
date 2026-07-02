# RESUMEN · Portal → Norte · Fase 2 (Modo Forja)

**Rama:** `feat/portal-norte-fase2` (desde `main`) · **Worktree:** `DTD-worktrees/portal-norte-f2`
**Commits (3):** `104b7dea` spec 0138 · `24d19ded` Slice A · (+ este RESUMEN)
**Estado:** ✅ `verify.mjs` TODO VERDE (3021 tests) + `next build` OK · **fast-forward sobre main** · **sin push**
**Migraciones aplicadas:** ninguna (Slice A no toca DB).

## Qué entregué esta sesión
1. **Auditoría de "qué falta" para el Norte** (4 subagentes) + verificación contra código.
2. **SDD-0138** (`docs/specs/0138-mi-perfil-cliente/spec.md`) — Mi Perfil del cliente, sliced.
3. **Slice A (código, verde):** identidad en `/portal/cuenta` — tipo persona/empresa +
   documento (cédula/RIF), datos que YA estaban en DB pero no se traían. Sin migración.

## Mapa verificado: estado del Portal vs Norte

### 🟢 Ya en Norte (NO tocar — decisiones intencionales del founder, confirmadas en código)
- Login (hero 2 paneles), dashboard (héroe naviera real + KPIs + **actividad con hitos
  reales** vía `listMyRecentActivity`/shipment-events + próximo zarpe/cut-off), detalle de
  envío (read-only por diseño), tema oscuro, copy, referidos, mensajes, documentos, finanzas.
- **Card "Tu agente" NO va en el dashboard**: el founder la movió a Mensajes (2026-06-20).
- **QR de etiquetas gris = deliberado**: el QR real lo genera el almacén (SDD-0031).
- **Split finanzas/cotizaciones** = intencional. **Detalle read-only** (aceptación = SDD-0054).

### 🟡 Visual-cerrable menor (opcional, bajo valor)
- Toggle manual tarjetas/tabla en Facturas (hoy responsive-auto, funciona bien).
- `SailingDeadlineNote` (nota cut-off) en el flujo de Nueva Compra.

### 🔴 Lo que de verdad falta = BACKEND (SDD-0138 slices B/C/D + otros)
- **⭐ Slice B — Direcciones de entrega múltiples** (migración `0198_client_delivery_addresses`:
  tabla + RLS por tenant + índice único de una predeterminada + backfill de `clients.address`).
  Queries + server actions + UI en `/cuenta`. **Es el siguiente paso grande.** Detalle en la spec.
- **Slice C — last-mile por dirección**: GATEADO — las tarifas son decisión del founder.
- **Slice D — avatar editable + registrar empresa** (baja prioridad).
- Fuera de 0138: adjuntos por factura (conteo en la query), aceptación legal fundida en el
  detalle (SDD-0054 C), factura PDF, chat en vivo.

## Para el Director
- Integrar: `git merge feat/portal-norte-fase2` (FF) → `node scripts/verify.mjs` + build → push con OK.
- **`docs/specs/README.md`:** NO lo regeneré (tu tarea). Corré `pnpm docs:index` tras el merge
  para indexar SDD-0138. `docs:check --check` ya pasa (front-matter válido).
- **Slice B lleva migración** (`0198`): cuando se construya, dry-run tx en prod antes de aplicar.
