# Handoff · SDD-0629 — Equivalente en Bs solo visual

- **Owner:** Worker (sesión hija de «Subdirector Contabilidad», `local_632735a9-…`); claim `local_sdd0629`.
- **Worktree:** `.claude/worktrees/sdd-0629-bs-visual-d985c1` · **rama:** `claude/sdd-0629-bs-visual-d985c1`.
- **Base:** salió de `origin/claude/tren-ad` (`ef47d270c`). AD entró a main en `e5169e86e`; se trajo origin/main una vez con merge (`d55101ee4`), sin rebase ni force push.
- **PR:** https://github.com/SoftAgentes/DTDCARGO/pull/531.
- **Spec:** `docs/specs/0629-equivalente-bs-solo-visual/spec.md`.

## OBJETIVO ORIGINAL

Donde se muestre un monto en USD de una factura, un saldo o un recibo, poder ver cuánto sería en Bs y a qué tasa (valor, fecha y fuente). Solo vista: sin columnas en Bs, asientos ni recibos en Bs.

## COMPLETADO

- `deUsdAMoneda` (exacto en BigInt, falla cerrado) en `lib/shared/fx.ts`.
- `lib/shared/equivalente-bs.ts`: estados `ok` / `sin-tasa` / `no-aplica`, el aviso de tasa anterior, el texto de referencial y el texto por audiencia (Studio o portal).
- `tasasVesPorFecha` en `lib/studio/fx-rates.ts` (una `fx_rate_on` por fecha distinta).
- `lib/portal/tasa-referencial.ts`: admin client con el tenant del principal, según el patrón SDD-0543/0549. La decisión está escrita en la spec, con su prueba de aislamiento por tenant.
- Componentes `app/studio/_components/EquivalenteBs.tsx` y `app/portal/_components/EquivalenteBs.tsx`.
- Integración:
  - Studio: detalle de factura (total con la tasa de emisión y saldo con la de hoy), Cobranzas (por cobrar en USD, bajo los KPI) y su drawer, y el recibo (solo en pantalla, con `data-print-hide`).
  - Portal: detalle de factura y KPI de saldo en «Mis facturas».
- Pruebas nuevas, con montos inventados, con y sin tasa y con una tasa vieja:
  - `lib/shared/__tests__/equivalente-bs.test.ts`
  - `lib/studio/__tests__/fx-rates-por-fecha.test.ts`
  - `lib/portal/__tests__/tasa-referencial.test.ts`
  - `app/studio/_components/EquivalenteBs.test.tsx` (Studio y portal)
  - `app/studio/(app)/cobranzas/_components/CobranzasClient.bs.test.tsx`

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `pnpm sdd:check` (node directo) | PASÓ, sin números repetidos |
| `pnpm docs:check` (node directo) | PASÓ, índice sincronizado (609 specs) |
| `git diff --check` | PASÓ |
| `pnpm install --frozen-lockfile` | PASÓ, sobre el merge con main (`d55101ee4`) |
| vitest focal: 5 archivos nuevos + `fx.test.ts`, `fx-rates.test.ts`, `CobranzasClient.sin-tasa`, `facturas/page.test`, `facturas/[code]/page.test`, `pending-acceptance.test` | PASÓ: 11 archivos, 122 pruebas. La primera corrida dio 3 rojos: una expectativa mal calculada (44596.5748 → .57), un formato sin centavos en Cobranzas (corregido a `fmtAmount`) y un `beforeEach` que devolvía el mock y Vitest lo corría como limpieza |
| Mutantes | PASÓ: tenant ajeno en `tasa-referencial.ts` → 2 rojos; sin la guarda de tasa futura → 1 rojo. Archivos restaurados exactos |
| `pnpm typecheck` | PASÓ (exit 0) |
| eslint `--max-warnings 0` sobre los .ts/.tsx del diff | PASÓ |
| CI #531 en `6385a4828` | FALLÓ: 1 de 17 201. `hoy-caracas.test.ts` → `supabase.from is not a function`; la página leía `user_tenants` y el doble no trae `.from`. Corregido: el tenant sale de la cola (`queue[0].invoice.tenant_id`, ya acotada por la RLS) y sin casos no se lee ninguna tasa. La prueba no se debilitó: suma dos casos de la 0629 |
| vitest focal con turno: `app/studio/(app)/cobranzas` + `app/portal/(app)/facturas` | PASÓ: 11 archivos, 63 pruebas |
| `pnpm verify` | NO EJECUTADO: el portón es el CI de GitHub más la revisión independiente (cambio del DG, 2026-11-13) |
| CI de GitHub | ver la PR #531 (registrado al cierre) |
| `/ui-check` (revisión del diff, sin levantar la app) | PASÓ con 3 ajustes menores de prioridad baja: px sueltos en vez de `--s-*` en `EquivalenteBs.tsx` y en la leyenda de la factura, y un rótulo que podría usar `studio-eyebrow`. No se aplicaron: es advisory y el 0630 comparte esos archivos |

> **Nota de turno.** El install, la focal, el typecheck y el lint se corrieron SIN turno, por una lectura equivocada de la orden. Pudieron cruzarse con el verify del 0631. Si se quiere una corrida limpia, se repite con turno. Después el DG cambió el portón: verify ya no se exige localmente y `/ui-check` se corrió como revisión del diff.
>
> **Cruce con el 0630.** El 0630 también toca `facturacion/[code]/page.tsx`, `cobranzas/page.tsx`, `CobranzasClient.tsx` y `CobranzaDrawer.tsx`. Esta rama entra primero al tren y no amplía sus cambios en esos archivos.

## COMMITS

- `55cf30143` docs(specs): SDD-0629 — reserva y spec
- `a2aef8252` feat(studio): SDD-0629 — equivalente en Bs en factura, Cobranzas, recibo y portal
- `e5c7a3e47` feat(studio): SDD-0629 — tasa del portal con el patrón del principal y su prueba de tenant
- `8306d99bc` docs(handoff): SDD-0629 — estado antes del turno de pruebas
- `d55101ee4` merge de origin/main (tren AD)
- `c7eb2f4f6` fix(studio): SDD-0629 — centavos en Cobranzas en Bs y pruebas corregidas tras la focal

## PENDIENTES DE ESTA TAREA

1. CI verde de la cabeza vigente (lo lee el Subdirector).
2. Revisión independiente (la lanza el DG).

## Impacto documental

Spec nueva e índice regenerado. Graphify, Archify y la preview de Obsidian no se tocaron: los aplaza la coordinación del Subdirector y quedan como pendiente global, no de esta rama.

## FUERA DE ALCANCE DETECTADO

- La RLS de `fx_rates` no cubre a los clientes del portal (no están en `user_tenants`). Se resolvió en la app con el patrón del principal. Si se prefiere una RPC o una policy, eso lleva migración (ver la spec).
- El detalle de factura del Studio muestra «Tasa FX (BCV)» para cualquier `fx_rate`, aunque su fuente pueda ser manual u operación (`fx_rate_source`). No se tocó.
- El KPI «Por cobrar» de Cobranzas suma montos de distintas monedas (`porCobrar`). El equivalente en Bs usa `porCobrarUsd`, que es el normalizado.

## HANDOFF AL DIRECTOR

La revisión independiente debe mirar la decisión del admin client en el portal (sección de la spec «Lectura de la tasa en el portal») y confirmar que los PDF y el papel quedan sin cambios hasta la facturación fiscal.
