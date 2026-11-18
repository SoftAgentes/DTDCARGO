# Handoff · SDD-0661 — Cajas y monto a cobrar en la vista por contenedor

Fecha: 2026-11-18 · Owner: Worker `worker-0661-vigorous-perlman` · Rama `feat/sdd-0661-embarques-cajas-y-monto`
· Worktree `.claude/worktrees/vigorous-perlman-a5e64a` · Base `origin/main` `26c54808c` · SDD asignada por el DG.

Encargo de Sam (2026-11-18, reunión con la oficina, por el DG). Spec:
`docs/specs/0661-embarques-cajas-y-monto-por-contenedor/spec.md`. Sin migración.

## Hecho

- **Cajas**: `leerContenedoresDeEmbarques` lee además `consolidation_items.pieces` de la asignación
  vigente y devuelve `cajasPorEmbarque`, lo que la carga de consolidados (SDD-0543) escribe como cajas
  del envío. `agruparPorContenedor` suma por cliente (`ClienteDeContenedor.cajas`) y por contenedor
  (`GrupoContenedor.cajas`); «Sin contenedor» queda en `null` (no se inventa un 0).
- **Monto**: `leerMontosDeContenedores` lee `invoices` (`deleted_at is null`, `status <> 'anulada'`,
  `shipment_id` en los embarques con contenedor) y `montosPorContenedor` suma `total_amount` USD; cuenta
  aparte las facturas en otra moneda. Los borradores cuentan.
- **Permiso en el servidor**: `embarques/page.tsx` llama a `leerMontosDeContenedores` solo si
  `moduleViewDenial(supabase, "invoices") === null`, la misma puerta de Facturación (accounting + admin +
  extra SDD-0622). Sin permiso no se consulta y la prop `montos` no existe en el payload.
- **Pantalla**: la cabecera del contenedor suma la pastilla «N cajas»; con `montos`, debajo de los m³:
  «A cobrar $X» (`fmtUsd`), «Sin facturar» o «Monto no disponible». Cada cliente: «N envíos · N cajas».

## Decisión registrada en la spec (§3.1)

«Solo contabilidad» = módulo de dinero `invoices`, no el rol `accounting` a secas: admin ya ve toda la
facturación y un extra de la 0622 abre Facturación con doble aviso. Es lo más restrictivo que se puede
aplicar sin inventar un criterio nuevo. Si Sam quiere que admin **no** lo vea, es un cambio de una línea en
`page.tsx`, pero contradice SDD-0085.

## Evidencia

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs` / `--check` | PASÓ (642 specs) |
| `node scripts/check-numbering.mjs` | PASÓ (choques históricos 0342/0394 conocidos) |
| `git diff --check` | PASÓ |
| vitest (5 archivos de Embarques + lib) | ver el bloque de abajo |
| `pnpm verify` | ver el bloque de abajo |

## Pruebas nuevas

- `app/studio/(app)/embarques/__tests__/page-monto-por-rol.test.ts`: con la matriz real; commercial,
  operations, support, warehouse y marketing no consultan `invoices` y no reciben `montos`; accounting y admin sí.
- `lib/studio/__tests__/embarques-cajas-y-monto.test.ts`: `pieces` vigente, sumas por cliente y por
  contenedor, filtro, FCL con 0, «Sin contenedor» `null`; montos USD, borradores, anuladas, otra moneda,
  lectura fallida.
- `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.cajas-monto.test.tsx`: render.

## Impacto documental

Spec nueva 0661 e índice regenerado. No hace falta tocar BRAND ni Norte (se reutilizan `Badge` y tokens).

## Pendientes de esta tarea

- Correr las pruebas y `pnpm verify` con turno del DG.
- Revisión independiente (la lanza el DG).

## FUERA DE ALCANCE DETECTADO

- `moduleViewDenial` vuelve a llamar a `getStudioAccess` en cada uso; en esta página ya son tres lecturas
  (`tracking`, `invoices` y el `getStudioAccess` del borrado). Si no está memoizado, son consultas
  repetidas a la sesión. No lo cambié.
