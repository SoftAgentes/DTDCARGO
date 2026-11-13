# Handoff · SDD-0629 — Equivalente en Bs solo visual

- **Owner:** Worker (sesión hija de «Subdirector Contabilidad», `local_632735a9-…`); claim `local_sdd0629`.
- **Worktree:** `.claude/worktrees/sdd-0629-bs-visual-d985c1` · **rama:** `claude/sdd-0629-bs-visual-d985c1`.
- **Base:** `origin/claude/tren-ad` en `ef47d270c` (tren AD #529, todavía no en main). La PR va contra main; cuando AD entre, se trae main una vez con merge, en el turno asignado.
- **PR:** https://github.com/SoftAgentes/DTDCARGO/pull/531 (borrador hasta cerrar la validación).
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
| `pnpm install --frozen-lockfile` | NO EJECUTADO: espera el turno (orden: verify 0631 → Rebrand T3 → 0629) |
| vitest focal (5 archivos nuevos + `fx.test.ts`, `fx-rates.test.ts`, `CobranzasClient.sin-tasa`, `facturas/page.test`, `facturas/[code]/page.test`) | NO EJECUTADO: espera el turno |
| `pnpm typecheck` | NO EJECUTADO: espera el turno |
| lint | NO EJECUTADO: espera el turno |
| `pnpm verify` | NO EJECUTADO: espera el turno |
| CI de GitHub | NO EJECUTADO: la PR está en borrador (SDD-0621) |
| `/ui-check` | NO EJECUTADO: pendiente después de las pruebas |

## COMMITS

- `55cf30143` docs(specs): SDD-0629 — reserva y spec
- `a2aef8252` feat(studio): SDD-0629 — equivalente en Bs en factura, Cobranzas, recibo y portal
- `e5c7a3e47` feat(studio): SDD-0629 — tasa del portal con el patrón del principal y su prueba de tenant

## PENDIENTES DE ESTA TAREA

1. Con turno: install, vitest focal, typecheck, lint; luego `pnpm verify`.
2. `/ui-check` del diff.
3. Pasar la PR a lista (`gh pr ready 531`) y registrar el CI.
4. Cuando el tren AD entre en main: un merge de origin/main en esta rama, en el turno asignado.

## Impacto documental

Spec nueva e índice regenerado. Graphify, Archify y la preview de Obsidian no se tocaron: los aplaza la coordinación del Subdirector y quedan como pendiente global, no de esta rama.

## FUERA DE ALCANCE DETECTADO

- La RLS de `fx_rates` no cubre a los clientes del portal (no están en `user_tenants`). Se resolvió en la app con el patrón del principal. Si se prefiere una RPC o una policy, eso lleva migración (ver la spec).
- El detalle de factura del Studio muestra «Tasa FX (BCV)» para cualquier `fx_rate`, aunque su fuente pueda ser manual u operación (`fx_rate_source`). No se tocó.
- El KPI «Por cobrar» de Cobranzas suma montos de distintas monedas (`porCobrar`). El equivalente en Bs usa `porCobrarUsd`, que es el normalizado.

## HANDOFF AL DIRECTOR

La revisión independiente debe mirar la decisión del admin client en el portal (sección de la spec «Lectura de la tasa en el portal») y confirmar que los PDF y el papel quedan sin cambios hasta la facturación fiscal.
