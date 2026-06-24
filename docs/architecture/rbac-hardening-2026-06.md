# Endurecimiento RBAC del Studio (2026-06-24)

> Remediación del hallazgo principal de la revisión de seguridad: **adopción
> parcial del RBAC por módulo (SDD-0085)**. El sistema estaba bien diseñado
> (`requireModuleView` por page + `moduleEditDenial` por server action, matriz
> `canAccessModule` fail-closed) pero la adopción era parcial y silenciosa: no
> hay gate central, así que cada módulo debía gatear solo y la mayoría no lo
> hacía. Mitigaban: auth requerida (layout `getUser`) + RLS por tenant. El
> hueco: **rol-dentro-del-tenant** (un `warehouse`/`support` podía ver/mutar
> módulos fuera de su matriz por URL o invocando la server action directo).

## Qué se arregló

### 1. Backstop de edición (`moduleEditDenial`) en mutaciones
Se agregó el guard como primer paso de cada server action de mutación en los
módulos sensibles que no lo tenían:

- **clientes** (9 actions: crear/editar/borrar, invitar/revocar/aprobar portal,
  verificar/marcar identidad, asignar asesor) + gate de vista.
- Vía codemod (19 módulos): `gastos, tarifas, seniat, fiscal, naviera, cn,
  cotizador, conversaciones, documentos, despacho, tms, kommo, fidelizacion,
  cola-qr, mailing, tracking/[id], tracking/nuevo, admin/rutas`.
- Manuales: `despacho/reglas`, `rendiciones`, `admin/agentes` (sus mutaciones
  delegan en helpers de lib, por eso el codemod no las cazó).

Ya estaban protegidos (no se tocaron): `ordenes-compra`/`ordenes-venta` (las
actions con guard viven en `lib/studio/{purchase,sales}-orders/actions.ts`; el
`(app)/actions.ts` es un barrel), `noticias-web` (`requireAdminWithTenant`),
`usuarios, operarios, costing, cobranzas, nomina, contabilidad, financiero-china,
facturacion, tesoreria, reclamos, academia`.

### 2. Gate de vista (`requireModuleView`) en pages sensibles
17 pages que no gateaban (ni page ni layout): `cn, cola-qr, conversaciones,
cotizador, despacho, despacho/dashboard, despacho/reglas, documentos, embarques,
fidelizacion, kommo, leads, proveedores, seniat, tarifas, tms, tracking`.

### 3. Test anti-drift
`lib/studio/rbac-actions-guard.test.ts` escanea `app/studio/(app)/**/actions.ts`
y **falla** si un archivo muta sin `moduleEditDenial` y no está en una ALLOWLIST
justificada. Esto cierra el barrido (cobertura completa hoy) y previene la
regresión: un módulo nuevo con mutaciones sin guard rompe el gate `verify.mjs`.

#### ALLOWLIST (excepciones documentadas)
| Archivo | Razón |
|---|---|
| `actions.ts` (raíz) | `signOut`: cierra la sesión del propio usuario. |
| `bugs/actions.ts` | Bug Reporter: cualquier staff reporta bugs (abierto). |
| `mis-bugs/actions.ts` | Bugs propios del usuario (abierto). |
| `ve/actions.ts` | App de operario VE: auth por PIN, no por rol de Studio. |
| `debug/actions.ts` | `recheckAll`: re-corre health checks, no muta negocio. |
| `admin/feature-flags/actions.ts` | Valida `role==='admin'` inline. |
| `ordenes-compra` · `ordenes-venta` | Barrels; guards en `lib/studio/*-orders/actions.ts`. |
| `marketing/noticias-web/actions.ts` | `requireAdminWithTenant` (gate admin propio). |

## Otros hallazgos de la revisión

- **`/api/debug/health`** — se eliminó el fallback de secreto por query param
  (`?key=`): quedaba en logs/historial/Referer. Solo `Authorization: Bearer`.

- **`/verificar` (PENDIENTE · requiere diseño, NO auto-parcheado)** — página
  pública que usa `service_role` para verificar Shipping Marks (`DTD-NNNN`,
  secuenciales) y diplomas (`DTD-AC-YYYY-NNNN`). Enumerable. La rama de
  **diploma expone `student_name` (PII)** → un atacante puede cosechar nombres
  probando folios. **No se parchó** acá porque la mitigación correcta
  (rate-limit por IP en el render hot-path del QR, o tokens opacos en vez de
  folios secuenciales) necesita diseño y arriesga romper el flujo legítimo de
  escaneo. **Recomendación:** reusar el patrón `portal_registro_throttle` (ver
  `app/registro/actions.ts`) por IP, o mover el lookup a una RPC pública
  `SECURITY DEFINER` con throttle. Tratar como spec propia.

- **Material de marca (`/marca/*`, `/interno/marca/d/*`)** con gate `getUser()`
  (no `getUserTenantId()`): un cliente del portal puede ver el brand-book. **No
  es bug** — es decisión del founder (2026-06-14, ver comentario en
  `app/marca/brand-book/page.tsx`) y material de baja sensibilidad. Si se
  quisiera cerrar a solo-equipo: `getUser` → `getUserTenantId` en los 3 archivos.

## Límite conocido
Esto cierra el rol-dentro-del-tenant a nivel **app** (page + action). La RLS de
la DB ya aislaba por tenant; el endurecimiento por rol a nivel DB (RLS que mire
el rol) sigue siendo defensa-en-profundidad futura para los módulos más
sensibles (clientes/dinero), como ya lo hace nómina vía `nomina_can_access()`.
