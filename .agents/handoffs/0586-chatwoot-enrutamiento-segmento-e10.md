# Handoff — SDD-0586, E10 del programa SDD-0582 (pasos 10.1 a 10.3)

- **Fecha:** 2026-10-30
- **Worker:** Claude, owner `local_e10-quirky-greider`
- **Rama:** `codex/0582-e10-enrutamiento`, en el worktree `.claude/worktrees/quirky-greider-f8b27d`
- **Base:** apilada sobre `codex/0582-e2-poc` (SDD-0585, PR #332), punta `1cbb29b73`
- **Reserva:** SDD-0586, local: `refs/heads/codex/sdd-reserve-0586-chatwoot-enrutamiento-segmento-e10` en `64cf9c514`, sin publicar (igual que 0583 a 0585).
- **Migración:** **0505**, confirmada por el Director el 2026-10-30 (comprobada en todas las ramas, remotas y worktrees). **NO APLICADA**, declarada en `migrations-baseline.json`.

## Objetivo

Arrancar E10: 10.1 (función SQL del segmento), 10.2 (clasificar en el webhook de 2.3, etiqueta, equipo y redirección sin IA en 1 mensaje) y 10.3 (usuarios sin teléfono: respuesta neutra y BSUID). Decisiones, evidencia y la revisión de datos: [spec](../../docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md).

## Completado

- **10.1:** `chatwoot_segmento_contacto` en la 0505, con la regla de Sam en 0.8. Decidido con evidencia: el recibo en `incidencia` **cuenta** y el huérfano **no** (E10-D3 y D4).
- **10.2:** manejador `clasificarContacto` en `MANEJADORES`. Responde primero, en 1 mensaje, una vez cada 24 h por conversación y nunca dos, con una reserva con estados (`reservada` → `enviada` | `incierta`). Después pone la etiqueta (la relee antes de escribir) y el equipo. El reproceso de 2.3 lee de Chatwoot lo que el evento no guardó.
- **10.3:** respuesta neutra idéntica para todos y BSUID guardado en `chatwoot_contactos_bsuid`, con RLS por tenant: lee el admin y escribe solo `service_role` (condición del Director).
- **Revisión de Codex:** 5 hallazgos (3 altos, 1 medio, 1 bajo), todos corregidos en `d4d5e18a2` con prueba y mutante. La tabla está en la spec.
- **revisar-datos-ve** acotado al diff: 5 CORRECTO, 3 ENCONTRADO (los tres corregidos), 3 NO VERIFICABLE.

## Validación

| Comprobación | Estado |
|---|---|
| Contrato 0505 en PGlite: 67 aserciones, control rojo, 34 mutantes, reaplicación y preflight | PASÓ (39/39) |
| `lib/studio/chatwoot`, webhook, cron y contratos 0503, 0504 y 0505 en PGlite (16 archivos, con la 2.4 de E2 fusionada) | PASÓ (220/220) |
| Mutantes a mano del manejador (13), script en el scratchpad de la sesión | PASÓ: todos mueren |
| `tsc --noEmit` del proyecto | PASÓ |
| eslint de los archivos tocados | PASÓ |
| `docs:check` y `sdd:check` | PASÓ |
| `pnpm verify` completo con Docker sobre `a319d4cdc` | FALLÓ sin rojos propios: el único propio (infra-env-example) se corrigió (3/3); 2 timeouts por carga aislados 10/10; sql-tests y e2e con rojos heredados (SDD-0573 y Shipping Mark). Detalle en la spec, «Verify» |
| sql-tests con Docker (contrato 0505 en PostgreSQL 17) | PASÓ (0503, 0504 y 0505) |
| pending-migration-symbols | PASÓ: 0 ROJO · 6 AMARILLO, con la 0505 declarada |
| Punta a punta con Chatwoot y el número de prueba | NO EJECUTADO: es 10.6 |

## Aceptación

- **10.1, 10.2 y 10.3 aceptados** por Sam el 2026-10-30 («Acepto todo», a la pregunta del Director sobre 2.4–2.6, 3.1–3.3, 6.2, 6.3 y 10.1–10.3). Filas del checklist en «aceptado»; avance de esta rama 18,6 % → 22,1 % (`avance-checklist`).
- Aplicar la 0505 **no** entra en esa aceptación: requiere OK nominal de Sam al integrar.

## Pendientes de esta tarea

- ~~Decisión de Sam~~: H-2 «1 año» y H-3 «30 días (Recomendado)» (2026-10-30); implementadas en la 0505 §4 y en el cron `chatwoot-reintentos`.
- 10.4, 10.5 y 10.6.

## FUERA DE ALCANCE DETECTADO

- **Cruce por `phone_last10` sin código de país (0383/0504):** un +1 412… coincide con un +58 412…. E10 lo mitigó en el texto; arreglarlo exige normalizar `clients.phone` a E.164.
- **Push repetido en el reproceso (2.3):** si un manejador falla, el reintento vuelve a correr TODOS los manejadores, también `avisarPorPush`, que encola el aviso otra vez (la etiqueta `chatwoot-conversacion-N` agrupa en el navegador, pero el envío se repite).

## Impacto documental

- Spec nueva SDD-0586 e índice de specs regenerado. Las filas 10.1 a 10.3 del checklist de 0582 se actualizan en esta rama.
- Graphify, Archify y Obsidian: no se regeneraron en el worktree (los publica el Director desde main integrado). `knowledge:status` corrió en modo `integrated` y solo informa enlaces rotos antiguos, ajenos a este diff.
