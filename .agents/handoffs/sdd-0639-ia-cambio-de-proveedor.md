# Handoff · SDD-0639 · Cambiar de modelo o de proveedor de IA (fase de plan)

- **Owner:** Worker `pagos-de-ia-d02a4a`. Separada de la PR #603 a pedido del DG (2026-11-16).
- **Ruta y rama:** `DTD-worktrees/ia-cambio-de-proveedor` · `codex/ia-cambio-de-proveedor`, desde `origin/main` `6dc137029`.
- **Reserva:** `codex/sdd-reserve-0639`, commit `2ab348c84`.
- **Objetivo:** solo planear. Spec en estado `proposed`, PR draft. No incluye producto.
- **Origen:** Sam preguntó si se puede cambiar de proveedor desde el menú cuando Anthropic se cae. Codex, en una revisión de solo lectura, recomendó una spec aparte de la SDD-0638.

## COMPLETADO

- `docs/specs/0639-ia-cambio-de-proveedor/spec.md`. Cubre:
  - los niveles de cambio: modelo y proveedor;
  - las capacidades de riesgo: herramienta forzada, bucle de herramientas, PDF y `json_schema`;
  - el diseño mínimo: motor común, catálogo aprobado y elección por función; manual primero;
  - la privacidad con proveedores chinos;
  - las fases, las pruebas y las decisiones D-1 a D-6.

- v0.2 (2026-11-16): decisiones de Sam registradas en §9.1:
  - D-1: GLM como principal y DeepSeek como respaldo, cambiable;
  - D-2: a un proveedor chino solo va el Shipping Mark;
  - D-3: automático con opción manual;
  - D-6: el superadmin, más un permiso por persona en Usuarios › Acceso.

  Quedan abiertas D-4 (recomendación: noticias y después el brief), D-5 (recomendación: Agentes fuera de
  la spec y en Anthropic) y D-7 (llaves nuevas).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `pnpm docs:check` | PASÓ |
| `pnpm sdd:check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: solo documentación |

## PENDIENTES DE ESTA TAREA

- Que Sam decida D-4, D-5 y D-7 y apruebe la spec. El DG la fusiona por separado de la #603.
- Depende de la SDD-0638 (clasificador y registro), que va en la PR #603.

## FUERA DE ALCANCE DETECTADO

- La cadena de fallback de la Oficina (SDD-0626 §7) se coordina, no se toca.
- Hay un choque entre la regla D-2 y la SDD-0626, pendiente de que decida Sam. Lo lleva el DG (spec §7).

## Impacto documental

- Nueva: la spec 0639. Regenerado: `docs/specs/README.md`. Sin montos, llaves ni datos de cuentas.
