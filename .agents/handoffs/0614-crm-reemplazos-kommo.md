# Handoff · SDD-0614 — diseño del paso 6.6 (reemplazos de Kommo en el ERP)

- **Owner:** Claude Worker «E6 reemplazos», encargado por el Director General (sesión `local_535053f4-40c2-4124-a280-63f4fc882820`), 2026-11-06.
- **Ruta:** `.claude/worktrees/wizardly-hopper-d89dac`
- **Rama:** `claude/wizardly-hopper-d89dac`, desde `main` `3d17292a4`.
- **SDD:** [0614](../../docs/specs/0614-crm-reemplazos-kommo/spec.md), `status: draft`. Programa SDD-0582, fila 6.6; contrato SDD-0587.
- **Reserva:** `refs/dtd/reservations/0614` y `codex/sdd-reserve-0614-crm-reemplazos-kommo` (`c7691a9c3`), locales. La rama de reserva no se publicó: la PR de esta rama lleva la spec. Antes de reservar se revisaron las ramas remotas, las locales y `refs/dtd/reservations/*` (la más alta tomada era la 0613).

## Objetivo

Diseño en borrador de 6.6, sin código de producto, para que lo revise el Director General antes de programar: qué reemplaza cada pieza, modelo de datos y migración (descrita, sin escribir ni aplicar), pantallas con allowlist exacta, permisos y RLS, revisión de datos personales, pruebas, criterios de aceptación y lo que queda fuera.

## Qué quedó

- La spec completa: siete piezas (R1 a R7), una migración descrita (§3), allowlist por tramo (§5), revisar-datos-ve (§6), gobernanza (§7), pruebas (§8), aceptación (§9), reestimación (§10), **12 decisiones para Sam y 7 preguntas para el Director General** (§11) y fuera de alcance (§12).
- Índice `docs/specs/README.md` regenerado.
- **Sin código de producto, sin migración escrita, sin producción y sin preguntas a Sam.**

## Validación

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (`docs:check`) | PASÓ: 590 specs |
| `node scripts/check-numbering.mjs` (`sdd:check`) | PASÓ: sin números repetidos |
| `git diff --check` | PASÓ |
| Voseo en la spec | Revisado a mano y con grep: sin voseo |
| `pnpm verify` | NO APLICA: el cambio es solo documentación; el cierre se elige por el diff |
| Pruebas de producto | NO APLICA: no hay código |

## Revisión del Director General (2026-11-06, sobre `99e7d6300`)

Relayada por el Subdirector de Chatwoot: «bien encaminado», cambios menores de texto. Resolvió P-1 a P-7 (spec §11) y pidió cuatro cambios, ya aplicados en la misma rama:

- D-6.6-9 reescrita con el texto literal de `/privacidad` (`app/privacidad/page.tsx:345-349` y `:352-354`), diciendo qué opción lo cumple: la (a), que también cubre al registrado sin envíos y lo desliga de la ficha.
- Inventario: las tarjetas que nacen de estimados web (nombre visible y últimos 10 de `prospect_whatsapp`).
- Contradicción de Reportes: la RPC por asesor no devuelve ids de fichas; el facturado se suma dentro con `studio_client_annual_billing`.
- Los crons nacen apagados (`CRM_CAMBIOS_TABLERO`, `CRM_RETENCION`, `CRM_AVISO_VENTANA`): encenderlos es un OK aparte de Sam.

Además, coordinación con la PR #400 (10.5): 6.6 usa la pieza `crm_tarjeta_ubicar_o_crear` de la 10.5 (por ficha y por teléfono; antes se llamaba `crm_tarjeta_de_ficha`) y fija **una sola vez** las definiciones D-SA («sin atender») y D-AUD (qué lleva la auditoría del CRM y quién es el actor), en spec §2.8. La 10.5 las cita igual. Puntero en la SDD-0587 §10 (P-1).

## Pendientes de esta tarea

- Las decisiones D-6.6-1 a D-6.6-12 se las lleva el Director General a Sam, junto con las de la 10.5 y la línea base (+2,25 días entre las dos, de 115,5 a 117,75). Esta sesión no le preguntó nada.
- Con la salida, el código va en dos PR en serie contra `main` (A = S1 + S2, B = S3 + S4), después de la implementación de la 10.5. El número de migración se asigna al arrancar; no se reserva ninguno ahora.
- La fila 6.6 del checklist no se tocó: sigue «pendiente». Al integrar, conviene que su columna de evidencia apunte a la SDD-0614.

## FUERA DE ALCANCE DETECTADO

1. **`/privacidad` promete anonimizar a los 12 meses y nada lo corre.** `crm_anonimizar_leads_perdidos` no tiene llamadas fuera de las migraciones, y su predicado solo toma «Perdido» (`0506_crm_modelo.sql:768-774`). La primera tarjeta es del 2026-11-04, así que todavía no se incumple (inferencia). La spec lo resuelve en R7 b, con la decisión D-6.6-9.
2. **La SDD-0587 §16.6 está vencida en un punto:** pide ampliar `entity_audit_log_entity_type_check`, que no existe desde la 0261 (`0261_audit_entity_catalog_validate.sql:132`). Lo vigente es registrar el tipo en `audit_entity_types`.
3. **Reportes es de contabilidad y las tablas `crm_*` no la dejan leer** (`rbac.ts:129`, `0506_crm_modelo.sql:186`). Hoy contabilidad ve el desempeño por asesor porque sale del espejo de Kommo.
4. **Recuperación (SDD-0157) necesita el teléfono completo**, y la tarjeta del lead sin ficha guarda solo 10 dígitos (D6).
5. **Las pestañas del CRM** usan botones con `role="tab"`; no se probó si manejan flechas (A11Y-01).
6. **Otra sesión diseña la SDD-0610** (rama `claude/practical-swartz-5b50ae`, resumen semanal del CRM para marketing) y clasifica `motivo_perdida` como texto libre. El Director General resolvió (P-5) que use la clave de R7 y el texto solo en «Otro»: falta que esa spec lo diga.
7. **La SDD-0586 §10.5 (PR #400) dice en E10-D27 que el actor al abrir un ticket es el `auth.uid()` del cliente.** La regla D-AUD de esta spec lo cambia a `system`; la sesión de la #400 lo copia.

## Impacto documental

- Nuevo: `docs/specs/0614-crm-reemplazos-kommo/spec.md` y este handoff.
- Regenerado: `docs/specs/README.md`.
- Puntero en la SDD-0587 §10 (P-1), en esta misma PR.
- Pendiente al integrar: la evidencia de la fila 6.6 del checklist.
- Graphify, Archify y Obsidian: los revisa el Director General al cierre, según el runbook de conocimiento. Esta tarea no los tocó.
