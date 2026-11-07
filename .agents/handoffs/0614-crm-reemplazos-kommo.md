# Handoff · SDD-0614 — diseño del paso 6.6 (reemplazos de Kommo en el ERP)

- **Owner:** Claude Worker «E6 reemplazos», encargado por el Director General (sesión `local_535053f4-40c2-4124-a280-63f4fc882820`), 2026-11-06.
- **Ruta:** `.claude/worktrees/wizardly-hopper-d89dac`
- **Rama:** `claude/wizardly-hopper-d89dac`, desde `main` `3d17292a4`.
- **SDD:** [0614](../../docs/specs/0614-crm-reemplazos-kommo/spec.md), `status: draft`. Programa SDD-0582, fila 6.6; contrato SDD-0587.
- **Reserva:** `refs/dtd/reservations/0614` y `codex/sdd-reserve-0614-crm-reemplazos-kommo` (`c7691a9c3`), locales. La rama de reserva no se publicó: la PR de esta rama lleva la spec. Antes de reservar se revisaron las ramas remotas, las locales y `refs/dtd/reservations/*` (la más alta tomada era la 0613).

## Objetivo

Diseño en borrador de 6.6, sin código de producto, para que lo revise el Director General antes de programar: qué reemplaza cada pieza, modelo de datos y migración (descrita, sin escribir ni aplicar), pantallas con allowlist exacta, permisos y RLS, revisión de datos personales, pruebas, criterios de aceptación y lo que queda fuera.

## Qué quedó

- La spec completa: nueve piezas (R1 a R9), dos migraciones descritas (A y B, §3), allowlist por tramo (S0, M y S1 a S5, §5), revisar-datos-ve con el mapa de borrado del teléfono (§6 y §6.1), gobernanza (§7), pruebas (§8), aceptación (§9), reestimación contra la línea base v3 (§10), **las 12 decisiones de Sam cerradas con su cita, P-1 a P-13 del Director General** (§11), fuera de alcance (§12) y textos públicos T1 a T3 (§14), aprobados por Sam el 2026-11-07.
- Índice `docs/specs/README.md` regenerado.
- **Sin código de producto, sin migración escrita, sin producción y sin preguntas a Sam.** Las respuestas de Sam llegaron por el Director General.

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

## Respuestas de Sam (2026-11-06, por el Director General)

Registro literal: `respuestas-18-preguntas-20261106.md`, en las notas compartidas del Director General. Se aplicaron las secciones 1 a 12, el extra «Recontacto» y el nombre de la etapa (las 13 a 18 son de la 10.5). Lo que cambió en el diseño:

- **D-6.6-1:** Kommo fuera del Studio desde ya: tramo **S0** (ocultar pestañas, la tabla de Reportes y el cruce del estimado), sin apagar ni borrar nada de Kommo.
- **D-6.6-3 = b:** el cotizador deja de encolar `patch_price` y `patch_stage`. No es un apagado en producción: hoy el ERP no le escribe nada a Kommo (`KOMMO_PUSH_DRY_RUN` vacío, medido por el Director General en `dtd-cargo-functions-1`); es retirar código sin efecto en la PR A. Tipo de lead «Interesado» / «Interesado con código», sin etapa.
- **D-6.6-4 = b:** el rechazo de un cliente vuelve de «Recompra en curso» a «Recompra pendiente».
- **D-6.6-8 = b:** **R9**, teléfono completo en la tarjeta sin ficha, con **migración B** propia, trigger que lo vacía al ligar y al anonimizar, Recuperación sobre las tarjetas, «No volver a escribir» y textos T1 a T3. Cambia D6 de la 0587 (nota fechada en su §8).
- **D-6.6-12 = b:** paso **M** (maqueta) antes de S3; propuesta aparte, la maqueta de Chatwoot dentro del Studio.
- **Extra:** **R8**, recontacto a los 30 días; la etapa se llama «Recontacto» con la misma clave. La etiqueta vive en `crm_etapas.nombre`: cambiarla pide migración (un `update` guardado y la siembra redefinida). Nota fechada en la 0587 §4.3.
- Lo demás, como estaba recomendado (2, 5, 6, 7, 9, 10 y 11).

## Pendientes de esta tarea

- La línea base nueva la arma el Subdirector (esta sesión no tocó el checklist). Números de esta SDD (§10): 6.6 de 2,5 a 5,5 d (+3); filas nuevas propuestas, R8 0,75, R9 2,75 y maqueta de Chatwoot en el Studio 1 (4,5); total +7,5, de 115,5 a 123, sin la 10.5 rediseñada. La reestimación anterior (+2,25) quedó vencida.
- P-8, P-9 y P-11 respondidas por el Subdirector: S0 en PR propia y primera; la tabla de Reportes se oculta con el aviso de spec §2.1, que aprobó tal cual; la migración B va aparte. P-12 se cerró con la 10.5 rediseñada (#400, `12a5f7c52`, §10.5.19): D-SA y D-AUD de spec §2.8 quedan alineadas, sin cambio de estimación.
- P-10 cerrada por Sam el 2026-11-07 a las 03:56Z, traída por el Director General: «Sí, se queda». La guía de la SDD-0589 queda fuera de S0 como invariante comprobable (spec §2.1, §5, §8, §9): ningún archivo de la guía en el diff de S0, y una prueba nueva (`crm/__tests__/guia-se-queda.test.ts`) que exige el montaje de `GuiaStudio`, con mutante, y que `/studio/crm` abra Embudos. Sin cambio de estimación.
- **Abierta, P-13** (2026-11-07, inferida del código de la #408 `836edcd18`): con Resumen por defecto en S3, el recorrido Embudo de la guía no encuentra sus anclas en `/studio/crm` y no abre. Se decide con la SDD-0589 antes de S3; 6.6 no toca la guía.
- La #401 está congelada en `8958ca951`: los commits de P-10 en adelante quedan locales hasta que el Subdirector diga que se publica.
- T1 a T3 aprobados por Sam el 2026-11-07 a las 03:59Z, traídos por el Director General: «Apruebo los tres», con el SMS de T3. El texto no cambió (huellas sha256 iguales a las de `8958ca951`). Si cambia una palabra, vuelve al Director General antes. Se publican antes de la migración B, por PR y tanda con el OK del Director General.
- Sam decide aparte (§11): encender crons; aplicar A y B; rellenar teléfonos; retención de Chatwoot; base de licitud de T3. Retirar Kommo (lectura diaria del espejo, webhook, tablas y código oculto) es de E8, fuera de esta SDD.
- El código va en PR en serie contra `main`: PR 0 (S0), PR A (S1 + S2), PR B (S3 + S4) y PR C (S5). Los números de la A (que lleva también el nombre «Recontacto») y de la B los reserva el Director General; cada una se aplica solo con el OK nominal de Sam.
- La fila 6.6 del checklist no se tocó: sigue «pendiente». Al integrar, conviene que su columna de evidencia apunte a la SDD-0614.

## FUERA DE ALCANCE DETECTADO

1. **`/privacidad` promete anonimizar a los 12 meses y nada lo corre.** `crm_anonimizar_leads_perdidos` no tiene llamadas fuera de las migraciones, y su predicado solo toma «Perdido» (`0506_crm_modelo.sql:768-774`). La primera tarjeta es del 2026-11-04, así que todavía no se incumple (inferencia). La spec lo resuelve en R7 b, con la decisión D-6.6-9.
2. **La SDD-0587 §16.6 está vencida en un punto:** pide ampliar `entity_audit_log_entity_type_check`, que no existe desde la 0261 (`0261_audit_entity_catalog_validate.sql:132`). Lo vigente es registrar el tipo en `audit_entity_types`.
3. **Reportes es de contabilidad y las tablas `crm_*` no la dejan leer** (`rbac.ts:129`, `0506_crm_modelo.sql:186`). Hoy contabilidad ve el desempeño por asesor porque sale del espejo de Kommo.
4. **Recuperación (SDD-0157) necesita el teléfono completo**, y la tarjeta del lead sin ficha guarda solo 10 dígitos (D6). Sam eligió guardarlo (D-6.6-8 = b): queda dentro de esta SDD como R9.
5. **Las pestañas del CRM** usan botones con `role="tab"`; no se probó si manejan flechas (A11Y-01).
6. **Otra sesión diseña la SDD-0610** (rama `claude/practical-swartz-5b50ae`, resumen semanal del CRM para marketing) y clasifica `motivo_perdida` como texto libre. El Director General resolvió (P-5) que use la clave de R7 y el texto solo en «Otro»: falta que esa spec lo diga.
7. **La SDD-0586 §10.5 (PR #400) dice en E10-D27 que el actor al abrir un ticket es el `auth.uid()` del cliente.** La regla D-AUD de esta spec lo cambia a `system`; la sesión de la #400 lo copia. **Resuelto el 2026-11-06:** con la 10.5 rediseñada no hay tabla de tickets y E10-D27 quedó sin objeto (E10-D45).
8. **Chatwoot conserva contacto y conversación sin plazo**, y `/privacidad` ya promete anonimizar los «identificadores del chat» (`app/privacidad/page.tsx:345-349`). R9 no lo arregla: decide Sam aparte (spec §6.1).
9. **`/privacidad` §3 dice que el marketing va con consentimiento** (`app/privacidad/page.tsx:227-243`); volver a escribirle a quien solo consultó (T3) puede leerse así. Lo mira Sam con su asesor antes de aprobar T3.
10. **Hoy el ERP no le escribe nada a Kommo:** `KOMMO_PUSH_DRY_RUN` está vacío y el código solo escribe con exactamente `"false"` (`supabase/functions/_shared/kommo-outbound.ts:241`); lo midió el Director General. Lo único vivo hacia Kommo es la lectura diaria del espejo, que se retira en E8.

## Impacto documental

- Nuevo: `docs/specs/0614-crm-reemplazos-kommo/spec.md` y este handoff.
- Regenerado: `docs/specs/README.md`.
- En la SDD-0587, en esta misma PR: el puntero de §10 (P-1) y dos notas fechadas que apuntan aquí, en §4.3 (etapa «Recontacto») y en §8 (D6, teléfono completo y retención).
- Pendiente al integrar: la evidencia de la fila 6.6 del checklist.
- Graphify, Archify y Obsidian: los revisa el Director General al cierre, según el runbook de conocimiento. Esta tarea no los tocó.
