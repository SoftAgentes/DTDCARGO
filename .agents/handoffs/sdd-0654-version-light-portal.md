# Handoff — SDD-0654 Versión light del portal del cliente

- **Owner / sesión:** Worker del DG (claim `local_0654`). Asignó: Director General.
- **Ruta:** `.claude/worktrees/0654-version-light-portal-dd81ec` · **Rama:** `claude/0654-version-light-portal-dd81ec`
- **SDD:** 0654 (número del DG). Migración reservada: 0557 (no creada en esta fase).

## OBJETIVO ORIGINAL

Fase 1 del encargo (fase 0 de la spec): investigación con varios agentes, maqueta visual que Sam ve antes de
aprobar, y spec en `proposed` con decisiones para Sam. Sin producto.

## COMPLETADO

- Investigación en cuatro frentes con fuentes (spec §3). No había material archivado de ManyChat ni «para Dummies».
- Medición del portal y de Faro con archivo:línea (spec §4).
- Maqueta en `docs/specs/0654-version-light-portal/maqueta/`, publicada como Artifact privado.
- Ajustes de Sam sobre la maqueta, dados en la sesión del Worker el 2026-11-16 (spec §1).
- Spec `docs/specs/0654-version-light-portal/spec.md`.

## VALIDACIÓN

- `pnpm docs:check` y `pnpm sdd:check`: resultado en el cuerpo de la PR.
- `pnpm verify`: NO EJECUTADO. No aplica: el diff es solo documentación.

## PENDIENTES DE ESTA TAREA

- Respuesta de Sam a las decisiones abiertas (spec §11).
- Revisión independiente, que lanza el DG.

## FUERA DE ALCANCE DETECTADO

- El encargo llama a Faro «SDD-0550»: Faro es la SDD-0637; 0550 es el número de su migración.
- La fila de Anthropic en `docs/legal/privacidad/inventario-terceros.md:38` no menciona Faro (ya anotado en la 0637).
- La SDD-0639 (regla D-2) seguía sin fusionar (PR #606) al escribir esto.
- El portal nace hoy en tema oscuro (`app/portal/(app)/layout.tsx:54`); Sam dijo que el predeterminado es el
  claro. Va como decisión en la spec; no se tocó código.

## Impacto documental

Spec nueva e índice de specs. Sin cambios en documentos canónicos.

## Revisión independiente del 2026-11-17 (sobre `d0c65914c`): CHANGES REQUESTED, atendida

Cada punto se verificó en el código antes de adoptarlo. Cambios en la spec:

- §5: la preferencia se escribe por RPC `SECURITY DEFINER`, sin `grant update` ni policy; se lee aparte del
  principal y degrada a `pro`.
- §7: ficha con filtro explícito por tenant y Shipping Mark; sin service_role (FC-13); estados ocultos (FC-14);
  sin memoria (FC-15); salida en texto plano; lista permitida por proveedor y modelo, sin agregadores.
- §7.5: clasificación de gobernanza (IA-01 nivel I0, A11Y-01, MOT-01, CMP-01, BTN-01) y dos excepciones de marca.
- §8: quién lee el registro, RLS de las tablas nuevas, purga al borrar o revocar, aviso de transferencia a EE. UU.
- §9: fase 1b para el tema claro; allowlists exactas.
- §10 y §11: AC renumerados AC-1 a AC-25 por fase; D-1 a D-20 en orden (nuevas D-17 a D-20).

Una corrección al revisor: «SDD-0454/0460» son números de migración (`0454_borrar_cliente_revoca_portal.sql`,
`0460_retencion_vinculo_portal_revocado.sql`); sus specs son la 0467 y la 0477. Así quedó citado.
