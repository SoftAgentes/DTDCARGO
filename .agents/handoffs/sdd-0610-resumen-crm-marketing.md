# Handoff — SDD-0610 · Resumen semanal agregado del CRM para marketing

- **Owner:** Worker `local_practical-swartz` (sesión hija de «SEO, GEO y AEO», `local_61442abe`).
- **Ruta:** `.claude/worktrees/practical-swartz-5b50ae` · **rama:** `claude/practical-swartz-5b50ae`.
- **Base:** `main` `5373e6c81` (2026-11-06).
- **Objetivo:** spec (solo documentos, sin código ni migraciones) del resumen semanal que el
  Studio genera desde Chatwoot y el CRM propio y entrega a la oficina de agentes sin datos
  personales.
- **SDD:** 0610, reservada con `sdd:next --reserve resumen-crm-marketing --number 0610`
  (`refs/dtd/reservations/0610` y `codex/sdd-reserve-0610-resumen-crm-marketing`, commit
  `4209034cd`, solo locales). El stub entró por cherry-pick. Siguiente libre: **0611**.
  Migración: ninguna con número; la spec propone `crm_resumen_semanal` sin número.
- **Permisos del encargo:** publicar la rama y abrir PR en borrador; fusionar no. Chequeos: solo
  `docs:check` y `sdd:check`.

## OBJETIVO ORIGINAL

SDD nueva «Resumen semanal agregado del CRM para marketing, sin datos personales»: preguntas,
objeciones y motivos con conteos; volumen por canal y etapa; sin nombres, teléfonos, correos,
textos literales ni montos; umbral mínimo justificado; `privacidad.md` con `revisar-datos-ve`;
prueba automática propuesta; formato, frecuencia, quién lo genera, dónde vive la llave (nunca en
Hermes) y qué falla si Chatwoot no responde.

## COMPLETADO

- `docs/specs/0610-resumen-crm-marketing/spec.md`: contexto medido en `main`, alcance, bloques,
  catálogo cerrado, clasificador determinista en el Studio, k = 5 con sus reglas complementarias,
  formato JSON `crm-resumen/1`, tabla propuesta, puerta de salida (el Studio empuja; la oficina
  sin credenciales), fallos de Chatwoot y de la entrega, prueba con canarios y mutantes,
  aceptación y decisiones D1–D9.
- `docs/specs/0610-resumen-crm-marketing/privacidad.md`: inventario, 3 hallazgos, doce puntos,
  umbral y lo no verificable.
- `docs/specs/README.md` regenerado con `docs:index`.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `pnpm docs:check` | PASÓ (590 specs) |
| `pnpm sdd:check` | PASÓ («sin números repetidos»; avisos históricos de migraciones ya aplicadas) |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: solo documentos, el encargo pide solo los dos chequeos |

## Impacto documental

- Canónicos actualizados: ninguno fuera de la spec y el índice. `04-marketing.md`,
  `07-quien-hace-que.md`, `registro-tratamiento.md` e `inventario-terceros.md` se actualizan en
  la implementación (aceptación §9), no ahora: describirían algo que no existe.
- Graphify, Archify y Obsidian: no ejecutados (solo spec; el encargo limita los chequeos).
  Pendiente global visible: la spec nueva no tiene recibo semántico.

## PENDIENTES DE ESTA TAREA

- Decisiones de Sam D1–D9 (spec §10).
- Alinear el transporte de la puerta con la SDD de noticias automáticas (sesión
  `local_c733181e`, avisada el 2026-11-06).

## FUERA DE ALCANCE DETECTADO

- `registro-tratamiento.md` no tiene filas de Chatwoot, `crm_tarjetas`, `crm_historial_etapas`
  ni BSUID (de SDD-0587).
- `inventario-terceros.md:44` sigue diciendo que Contabo está «todavía sin datos».
- `chatwoot_webhook_events` no distingue entrante de saliente: cualquier conteo de actividad
  basado solo en eventos cuenta los ecos del equipo.

## HANDOFF AL DIRECTOR

Solo documentos. Depende de SDD-0606 (PR #380) para la cola de Discord. La primera corrida real
necesita: política actualizada (D7), número de migración, OK nominal de la migración y OK de
Sam para la primera entrega.
