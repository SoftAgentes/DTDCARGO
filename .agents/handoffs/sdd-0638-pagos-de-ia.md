# Handoff · SDD-0638 · Pagos de IA (fase de plan)

- **Owner:** Worker `pagos-de-ia-d02a4a`, iniciado por el DG (`local_25e2dded-…`).
- **Ruta / rama:** `.claude/worktrees/pagos-de-ia-d02a4a` · `claude/pagos-de-ia-d02a4a`.
- **Reserva:** `codex/sdd-reserve-0638` (publicada) y local `codex/sdd-reserve-0638-pagos-de-ia`, commit `ec888a151`.
- **Objetivo:** solo planear. Inventario de IA, spec en `proposed`, PR draft. Sin producto.
- **SDD:** `docs/specs/0638-pagos-de-ia/spec.md` (proposed, v0.2).
- **SDD-0639** (cambio de proveedor): separada a pedido del DG en la rama `codex/ia-cambio-de-proveedor`, PR draft #606.

## COMPLETADO

- **2026-11-17:** Sam aprobó la spec como plan («Sí, las dos», por el chat del DG). Status `approved`, sin implementar. PR fuera de borrador; la fusiona el DG.
- Inventario verificado en el repo (spec §2): diez puntos en el ERP (A1 a A10), tres que pasan por la Oficina
  (H1 a H3) y dos planeados (P1 Faro, P2 `dtd-bot`). Solo nombres de variables.
- Mapa de dependencias por proveedor (§3), pantalla (§4), clasificador de errores de cobro (§5), recordatorio
  (§6), fases (§7), pruebas (§8), decisiones D-1 a D-7 (§9).
- v0.2 (2026-11-16): correcciones de la revisión de Codex (solo lectura), verificadas en el código una por una;
  tabla en §12 de la 0638.
- La SDD-0639 (cambio de modelo o proveedor) va en su propia PR, la #606.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `pnpm docs:check` | PASÓ (índice regenerado con `docs:index`) |
| `pnpm sdd:check` | PASÓ (`numbering: sin números repetidos`; avisos históricos conocidos) |
| `pnpm verify` | NO EJECUTADO: cambio solo de documentación, sin producto |

## PENDIENTES DE ESTA TAREA

- Que Sam decida D-1 a D-7 y apruebe la spec. El DG la fusiona después (la 0639 va aparte, en la #606).
- Confirmar con Sam lo marcado **NV**: proveedores de Hermes en el VPS, tipo de cuenta de Anthropic,
  plan de Cloudflare, suscripciones fuera del ERP.

## FUERA DE ALCANCE DETECTADO

- El «aviso de créditos» de la SDD-0603 (#589) es de créditos de clientes en facturación, no de IA (aclarado por el DG; la D-8 se retiró).
- `integration-health.ts` muestra un 402 como «HTTP 402» y un 401 siempre como «API key inválida». Se
  corrige en la fase 1 de esta spec, no aparte.
- No hay una sección «IA y configuraciones» en el Studio. La spec propone Administración › PRO.

## Impacto documental

- Nueva: `docs/specs/0638-pagos-de-ia/spec.md`. Regenerado: `docs/specs/README.md`.
- Sin cambios en documentos canónicos. Sin montos, llaves, correos ni datos de cuentas.
