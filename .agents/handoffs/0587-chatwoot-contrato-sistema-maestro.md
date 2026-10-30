# Handoff — SDD-0587 · E6 del programa SDD-0582 (6.1 contrato y 6.2 modelo de datos)

- **Owner:** Claude Worker «E6 contrato», lanzado por la sesión del Director del programa 0582; claim `local_e6contrato`
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\nice-spence-b2660e`
- **Rama de 6.1:** `codex/0582-e6-contrato`, apilada sobre `codex/0582-e0-preparacion` (`a0fa04215`), PR #334
- **Rama de 6.2:** `codex/0582-e6-modelo`, desde `origin/codex/0582-e10-enrutamiento` (`231e471c1`, PR #335) con la rama de 6.1 fusionada encima (`5565c4888`)

## 6.2 — modelo de datos (2026-10-30)

- **Encargo:** el Director, 2026-10-30, al publicar E10 la PR #335: arrancar 6.2 con la migración **0506**, contrato en PGlite y mutantes, declarada y **sin aplicar**; sin corridas pesadas (E10 tiene el turno de verify).
- **SDD:** sigue la 0587 (§14), sin reservar otra; la allowlist de 6.2 está en §10.
- **Entregado:** `supabase/migrations/0506_crm_modelo.sql`, `supabase/tests/0506_crm_modelo.test.sql`, `lib/studio/__tests__/crm-modelo.migration.test.ts` y la entrada `0506_crm_modelo` en `supabase/migrations-baseline.json`. Fila 6.2 → `entregado` (real 0,75 d).
- **Qué crea:** el núcleo único de la regla de segmentos por ficha, del que ahora depende `chatwoot_segmento_contacto` de la 0505; las tablas `crm_etapas` (D1 y D2 sembradas), `crm_tarjetas`, `crm_historial_etapas`, `crm_tareas`, `crm_notas` y `crm_ids_externos`; la RLS para admin y commercial; y las RPC de movimiento manual, movimiento automático idempotente y anonimización de D6.
- **Deja a otros pasos:** eventos nuevos del webhook y alta de tarjeta (6.4), el cron de la retención y la acción «Anonimizar ahora» (6.6), esconder la tarjeta de una ficha borrada en suave (6.3). Detalle en la SDD, §14.1.

| Comprobación (6.2) | Resultado |
|---|---|
| `crm-modelo.migration.test.ts` (Vitest de la instalación principal, un solo archivo) | PASÓ 39/39: contrato verde con 78 aserciones, control rojo, 34 mutantes, reaplicación, preflight y declaración |
| `docs:check`, `sdd:check` (numeración), `git diff --check` | PASÓ |
| `check-pending-migration-symbols.mjs` | Antes heredaba rojos de E2 en la rama de E10 (no de la 0506); tras fusionar `a319d4cdc`, 0 ROJO (ver abajo) |
| ESLint del archivo de prueba | NO DISPONIBLE: ESLint no carga desde la instalación principal en este worktree |
| `pnpm verify` y la reconstrucción del esquema | **NO EJECUTADO**: se pide turno al Director |
| revisar-datos-ve del modelo | SDD §14.3: 6 CORRECTO, 2 ENCONTRADO, 3 NO VERIFICABLE y 1 no aplica. Destino de los ENCONTRADO (Director, 2026-10-30): «Anonimizar ahora» → 6.6; aviso en `/privacidad` → 2.6 (revisión de datos de E2) |
| Fusión de la punta de E10 (`c4311d6b5`, purga por plazo) | `004ca56fd`; sin conflictos de contenido (el driver resolvió `migrations-baseline.json`); contrato de la 0506 otra vez 39/39 |
| Fusión de la punta de E10 `a319d4cdc` (pedido del Director, 2026-10-30: trae `f90aede00` de E2, `632be86fd` de E10 y el 2.5 de E2) | Sin conflictos; `migrations-baseline.json` conserva la `0506_crm_modelo`. Gate `check-pending-migration-symbols.mjs`: **PASÓ, 0 ROJO** · 6 AMARILLO declarados · 3 homónimos descartados, exit 0. La 0506 no aparece porque ningún código de la app llama todavía sus símbolos (llega con 6.3). Contrato de la 0506: 39/39. `docs:check`, `sdd:check` y `git diff --check`: PASÓ |

**Verify:** no se corrió aquí (E10 tenía el turno). Lo cubre el de E6.3 (#337) sobre `4f277075a` (17:11–18:12Z, 2026-10-30), que integra `3c86f4053`. Copiado de la SDD-0587 §15.2 de `codex/0582-e6-tablero` (`376ef8167`):

| verify (6.3, cubre 6.2) | Resultado |
|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (0 ROJO · 7 AMARILLO), schema-rebuild, build | PASÓ (13 de 17) |
| test (Vitest 13 734 de 13 738) | FALLÓ, ninguno del 6.2: `rbac-actions-guard` (propio de 6.3, corregido en el commit siguiente); `infra-env-example` (5 variables de E10, corregido en su punta); `TransportistasPanel` inestable bajo carga |
| sql-tests | FALLÓ, ajeno: 0467 y 0497 (SDD-0573). El contrato de la 0506 corre en Vitest y pasó |
| e2e | FALLÓ, ajeno: Shipping Mark en `sin-scroll-horizontal.spec.ts:119`; `auth.spec.ts:81` inestable |
| migrations-applied | NO DISPONIBLE: worktree sin credenciales de Supabase |
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

- Ninguno para 6.1.
- 6.2: aceptación de 6.2 por Sam; OK nominal para aplicar la 0506, después de la 0505 y con el runbook.
- 6.3 (tablero): no empezado en esta tarea.

## FUERA DE ALCANCE DETECTADO

- `leadsSinAtender` (`lib/studio/kommo-atencion.ts:77`) no tiene consumidor fuera de pruebas.
- El drenaje del writeback de Kommo por pg_cron está comentado (`supabase/migrations/0136_*.sql:190`).
- El motor de flujos 0143 no reintenta pasos fallidos (`lib/studio/workflow/workflow-drain.ts:148-169`, citado por el inventario).
- `e0-guias.md` (3 pings escriben al cliente) y K-4 (2) no coinciden; 6.7 lo confirma.
- ~~`check-pending-migration-symbols.mjs` marca rojas, en la rama de E10, las declaraciones de E2 (`sdd-0585-chatwoot-eventos`)~~: resuelto por `f90aede00` (E2) y `632be86fd` (E10), fusionados aquí con `a319d4cdc`; el gate sale con 0 ROJO.
