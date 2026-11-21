# Handoff · SDD-0699 — Cascada al cambiar el dueño (embarque reasignado o clientes fusionados)

- **Owner:** Worker (sesión `peaceful-turing-f99fd0`), encargado por Dir_DTD; número 0699 confirmado por Dir_DTD el 2026-11-21.
- **Ruta:** `.claude/worktrees/peaceful-turing-f99fd0` · **Rama:** `claude/peaceful-turing-f99fd0` · base `main` (`2e174c818`).
- **SDD:** `docs/specs/0699-cascada-cambio-de-dueno/spec.md` (`draft`). Sin migraciones.
- **Permisos del encargo:** PR a `main` con el handoff. No fusionar. Sin producción ni Supabase Cloud.

## OBJETIVO ORIGINAL

Pedido de Sam (2026-11-21): al cambiar el cliente de un embarque, o al fusionar clientes, la factura, la pre-orden,
los pagos y todo lo que está atado se arrastran en cascada, con un aviso previo de qué cambia. Por ahora solo la spec.

## COMPLETADO

- Medición en `main` con archivo:línea (§2): 0551, 0361, 0466, 0467, 0497, 0552, 0492, 0122, RBAC, Portal y auditoría.
- Principios (§3), matriz del caso 1 (§4), fusión (§5), vista previa con huella, auditoría, permisos (§6) y fases F-0 a F-4 (§8).
- Nueve preguntas para Sam con opciones y recomendada (§9). Aceptación verificable para cuando se implemente (§10).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ (678 specs) |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ (solo choques históricos ya conocidos) |
| `pnpm verify` | NO APLICA: la PR solo trae docs (spec, índice, handoff) |
| Ledger de producción: qué cuerpos están vivos | NO VERIFICADO: la F-0 lo pide a Dir_DTD |

Los scripts se corrieron con `node` directo, sin `pnpm install`, porque el worktree no tiene `node_modules`.

## IMPACTO DOCUMENTAL

- Spec nueva y el índice `docs/specs/README.md` regenerado. Ningún documento canónico cambia.
- Cuando Sam conteste la §9, se enmienda la spec y la 0645 apunta a esta como su continuación.

## PENDIENTES DE ESTA TAREA

- Respuestas de Sam a P1-P9 (§9). Después, la spec pasa a `approved` y cada fase trae su allowlist.

## FUERA DE ALCANCE DETECTADO

- Muchas cabeceras de migración dicen «NO APLICADA A PRODUCCIÓN», mientras que `migrations-baseline.json` tiene
  `pendingBelowCutoff` vacío. Las dos fuentes no coinciden, y conviene que Dir_DTD las concilie.
- `lib/studio/reasignar-embarque.ts:92-93` le dice a la oficina «Sepárala primero», pero el sistema no ofrece cómo
  separar una pre-orden. La F-1 lo resuelve; mientras tanto, el texto promete algo que no existe.
