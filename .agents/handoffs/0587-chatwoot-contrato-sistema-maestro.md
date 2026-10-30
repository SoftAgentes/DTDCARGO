# Handoff — SDD-0587 · E6 paso 6.1 del programa SDD-0582 (contrato de sistema maestro)

- **Owner:** Claude Worker «E6 contrato», lanzado por la sesión del Director del programa 0582; claim `local_e6contrato`
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\nice-spence-b2660e`
- **Rama:** `codex/0582-e6-contrato`, apilada sobre `codex/0582-e0-preparacion` (`a0fa04215`)
- **SDD:** 0587, reserva local `codex/sdd-reserve-0587-chatwoot-contrato-sistema-maestro` + `refs/dtd/reservations/0587` (stub `e891e83b1`, traído con cherry-pick). La reserva **no se publicó** a `origin`: la PR lleva la spec
- **Objetivo:** contrato de sistema maestro por objeto y fase, dos embudos, sincronización, reemplazos de Kommo con costo de Meta, plan de migración de leads, decisiones para Sam y reestimación de 6.2–6.7
- **Permisos de esta tarea:** solo diseño y documentación. Sin producto, sin migraciones, sin producción, Kommo, Meta, VPS ni Chatwoot. Publicar la rama propia y abrir PR en borrador sobre `codex/0582-e0-preparacion`: autorizado en el encargo

## Estado

| Paso | Estado | Qué hay | Qué falta |
|---|---|---|---|
| 6.1 | **aceptado** (2026-10-30) | [SDD-0587](../../docs/specs/0587-chatwoot-contrato-sistema-maestro/spec.md) `approved`: §3 maestro por objeto (11 objetos × 3 fases), §4 tableros Leads (7 etapas) y Clientes (4), §5 sincronización, §6 reemplazos (15 bots + integraciones), §7 migración, §8 D1–D10 resueltas y L1–L4 propuestas, §9 reestimación | Nada para 6.1. Las lecturas L1–L4 piden su OK en 6.4 y 6.5 |

Avance del programa en esta rama: **4,8 % → 6,5 %** (7,5 ÷ 115,5 d, salida de `avance-checklist`) al aceptar 6.1. Días restantes nuevos en el checklist: 6.2 → 2,5; 6.3 → 4,5; 6.4 → 2,5; 6.5 → 1,5; 6.6 → 2,5 (6.7 ya estaba en 1). Total E6 restante 14,5 d frente a 15,25 base. Los días base no cambian.

## Lo que importa a otras etapas

- **E10 (sesión `sdd-0582-e10-enrutamient`, rama `codex/0582-e10-enrutamiento`):** el contrato pide **una sola definición** de la regla de segmentos, con un núcleo por `client_id` que use la versión por teléfono (§4.2.1). La 0505 no está aplicada: es el mejor momento. Si E10 no lo hace, lo hace 6.2.
- **E2 (rama `codex/0582-e2-poc`, 0504 sin aplicar):** 6.4 necesita `conversation_created` y `conversation_updated` en el `check` de `chatwoot_webhook_events.event` (0504:56). Que Chatwoot 4.19.1 los emita es NV (§4.2.2).
- **E8:** el mapeo de IDs de Kommo de 6.5 se borra en 8.11 con las tablas `kommo_*` (regla «sin rastro»). `registration_channel = 'kommo'` lo decide 8.10.
- **10.5:** los tickets del portal crean o ligan la tarjeta; el tablero sale del segmento.

## Validación

| Comprobación | Resultado |
|---|---|
| `docs:check` (`node scripts/build-docs-index.mjs --check`) | PASÓ (566 specs; índice regenerado) |
| `sdd:check` (`node scripts/check-numbering.mjs`) | PASÓ (sin números repetidos; avisos históricos ya conocidos) |
| Prueba del avance (`scripts/__tests__/avance-checklist.test.mjs`, Vitest de la instalación principal) | PASÓ, 12 de 12 |
| `node scripts/avance-checklist.mjs …/checklist.md` | 4,8 %, «Entregados sin aceptar: 6.1» |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: el diff es solo de documentación (memoria «el cierre se elige por el diff») y hay otras sesiones programando |

## Impacto documental y conocimiento

- Documentos canónicos tocados: la SDD-0587 (nueva), el checklist de 0582 (fila 6.1 y días restantes) y el índice `docs/specs/README.md`.
- `docs/marketing/embudo-ventas.md` describe el embudo de Kommo de agosto; **no se tocó**. Cuando Sam acepte D1/D2, ese árbol tiene que apuntar a la SDD-0587 (regla de marketing de `project-rules.md`): pendiente de la tarea que integre o de 6.3.
- `knowledge:status` (2026-10-30): `ok=false` en el worktree; structural INVALID (grafo no construido aquí: 3.693 faltantes, 5.059 pendientes), semantic INVALID, Archify PENDING (`ARCHIFY_RUNTIME_MISSING`), Obsidian PENDING. **No se reconstruyó Graphify ni Archify** en este worktree: es una corrida pesada y hay otras sesiones programando. La SDD-0587 no está en `semanticPilot`. Pendiente del Director al integrar.

## Lecturas vivas propuestas y no hechas

L1 conteo de `kommo_leads` por etapa y antigüedad en el espejo de producción; L2 nombres y cantidad de etiquetas de Kommo; L3 si `KOMMO_PUSH_DRY_RUN` vale `"false"`; L4 si WhatsApp Lite, Google Business Messages y Twilio tienen tráfico. Cada una pide OK de Sam (§8 de la SDD).

## Autorizaciones registradas

- 6.1, 2026-10-30: el Director le preguntó a Sam «Si te sirven todas mis recomendaciones de D1–D10, basta con que me digas "D1–D10 como recomiendas"», y Sam respondió «si» (texto literal que pasó el Director, sesión «CRM Chatwoot»). Cubre aceptar 6.1 y resolver D1–D10 según la recomendación: D1 (a), D2 (a), D3 (a), D4 (a), D5 (b), D6 (a), D7 (a), D8 (a), D9 (a) y D10 (a). **No cubre** las lecturas L1–L4, ninguna migración ni empezar 6.2.

## PENDIENTES DE ESTA TAREA

- Ninguno para 6.1. Por orden del Director, **6.2 no empieza** hasta que E10 publique su PR (0505) y estén los eventos de la 0504; el Director avisa para apilarlo encima.

## FUERA DE ALCANCE DETECTADO

- `leadsSinAtender` (`lib/studio/kommo-atencion.ts:77`) no tiene consumidor fuera de pruebas.
- El drenaje del writeback de Kommo por pg_cron está comentado (`supabase/migrations/0136_*.sql:190`).
- El motor de flujos 0143 no reintenta pasos fallidos (`lib/studio/workflow/workflow-drain.ts:148-169`, citado por el inventario).
- `e0-guias.md` (3 pings escriben al cliente) y K-4 (2) no coinciden; 6.7 lo confirma.
