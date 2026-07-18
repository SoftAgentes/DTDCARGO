# Handoff · Barrido "DDP" en el Portal del Cliente

- **Fecha:** 2026-07-17
- **Rama:** `claude/inspiring-torvalds-a70910` (worktree `inspiring-torvalds-a70910`)
- **Destino:** `origin/main` (deploy directo a prod vía Vercel)
- **Contexto:** regla del founder 2026-07-17 — "DDP" deja de ser nombre de servicio
  de cara al cliente; el servicio se llama **"Puerta a Puerta"** (aclaración "(DDP)"
  entre paréntesis permitida). El barrido del **sitio público** ya estaba hecho
  (commit `954eaadc`, rama `claude/jolly-proskuriakova-3da0aa`); el **Portal** quedó
  fuera de ese alcance y es esta tarea.

## Commits (3 propios + merge de integración)

1. `448c8987` — feat(portal): barrido "DDP" — el servicio se llama "Puerta a Puerta"
2. `d6b37eee` — fix(studio): Badge acepta size "xs" — typecheck del repo verde
3. `5e3b5af5` — fix(portal): barrido "DDP" — línea de factura del seed demo
4. merge `origin/main` (referidos SDD-0159, renumerado 0157→0160, cierre DDP en DB, etc.)

## Qué cambió

- **Fuente única `SERVICE_SHORT_LABELS`** en `lib/portal/portal-types.ts`: reemplaza
  los 4 mapas `SHORT_SERVICE` duplicados (`lib/portal/alertas.ts`, `PortalDashboardNorte`,
  `PortalShipmentsNorte`, `PortalShipmentDetailNorte`). El chip pasa de "DDP" a "Puerta a Puerta".
- **`SERVICE_LABELS.primary`** en `lib/shared/shipment-public.ts` → "Puerta a Puerta"
  (hunks IDÉNTICOS a `954eaadc` para merge limpio con la rama pública). Arregla además
  todos los consumidores de `SERVICE_LABELS` en el portal (ShipmentRow, EstimateRow,
  CotizacionRow, CotizacionRequestForm, detalle de envío).
- **Copy visible:** login ("cargas puerta a puerta"), `PendingAcceptanceCard` y página
  de aceptación ("factura/orden de puerta a puerta (prepago)" — "prepago" SE MANTIENE
  por decisión founder en contexto legal), seed de mail templates y seed de facturas demo.
- **Se conserva:** enum interno `puerta_a_puerta_DDP`, comentarios, lógica de
  `portal-legal-queries` y fixtures de tests.

## Convergencia con otra ventana (Badge / RecoveryTab)

Los 2 errores de tsc pre-existentes de `RecoveryTab.tsx` (kommo, `size="xs"`) los
arreglé agregando el escalón `xs` al componente `Badge` (`d6b37eee`), alineándolo con
lo que el `CLAUDE.md` del Studio ya documentaba (`xs/sm/md`). En paralelo, otra ventana
los arregló al revés (commit `dcbdfb6b` en main: degradó el caller a `sm`). Sin conflicto
textual (archivos distintos). Resultado combinado tras el merge: el size `xs` existe en
el sistema como promete la doc, y RecoveryTab usa `sm`. Coherente y compila.

## Verificación

- tsc `--noEmit`: **0 errores** (antes del arreglo había 2 en main).
- ESLint: 0 errores en archivos tocados.
- Suite completa pre-merge: **3769 tests / 271 archivos** verde. Post-merge (portal +
  reports + fidelización + shared): **440 tests / 32 archivos** verde.
- `next build` producción: OK. Bundles compilados confirman el copy nuevo y cero
  rastros del viejo (`"cargas DDP"`, chips `"DDP"`). Render en vivo del `/portal/login`
  confirmado.
- **DB prod (read-only) SIN pendientes:** `mail_templates` sin filas con "DDP"
  (`lead_dormant_reengagement` nunca sembrada); facturas demo `F-2026-D%` no existen en
  prod; `service_configs` conforme (título ya corregido por otra ventana; queda "(DDP)"
  entre paréntesis = permitido). ⚠️ El seed de mail templates SÍ pisa filas (upsert por
  `tenant_id+slug`): re-correrlo completo aplastaría ediciones hechas en el Studio.

## Siguiente responsable

Ninguno pendiente por esta tarea. El barrido "DDP" queda cerrado en las 3 superficies
que ve el cliente (público + portal + DB). Worktree listo para poda por humano.
