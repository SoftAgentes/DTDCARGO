# Handoff · SDD-0587 paso 6.4 — entrada de leads desde Chatwoot y la web, con atribución

- **Owner:** Claude Worker «E6 entrada de leads» (claim `local_0582-e6-entrada-leads`), encargado por el Subdirector (`local_535053f4-40c2-4124-a280-63f4fc882820`).
- **Ruta:** `.claude/worktrees/0582-e6-entrada-leads-ef62df`
- **Rama:** `claude/0582-e6-entrada-leads-ef62df`, desde `codex/0582-e6-tablero` (`f06dec60a`, PR #337).
- **SDD:** 0587 (aprobada). Sección §16 y allowlist en §10.
- **Programa:** SDD-0582, fila 6.4 del checklist → entregado, sin aceptar.
- **Permisos del encargo:** publicar la rama propia y abrir PR en borrador. Sin merge, sin producción, sin el servidor de Chatwoot ni prueba.

## Objetivo

Crear la tarjeta del CRM propio cuando alguien entra por Chatwoot o se registra en `/registro`, con su fuente y atribución, y dar asesor con la asignación de Chatwoot. Que todo pueda correr dos veces sin efecto doble y que un fallo no rompa ni demore el registro.

## Qué quedó

Detalle en la SDD-0587 §16. Resumen:

- **Migración `0513_crm_entrada_leads` (sin aplicar):** amplía el `check` de eventos de la 0504 y crea `crm_entrada_chatwoot`, `crm_asesor_desde_chatwoot` y `crm_alta_tarjeta_web`, más piezas internas sin grant. Se decidió no editar la 0504 (§16.3).
- **`entrarLead`** (`lib/studio/chatwoot/entrada-leads.ts`) en la lista de manejadores de `procesarEventoChatwoot`.
- **`interpretarEvento`** admite los dos eventos; `conversation_updated` solo si cambió el asignado. El nombre viaja aparte, en `ContactoEntrada`.
- **`/registro`:** paso 6c con `after()`; UTM en campos ocultos, validados en la page y otra vez en la action (`lib/public/registro-atribucion.ts`).
- **D7:** `CRM_ALTA_WEB_SIN_KOMMO`, apagado. Solo `"1"` lo enciende. No se hizo la lectura L3.

## Validación

| Comprobación | Resultado |
|---|---|
| Contrato PGlite, control rojo, reaplicación y preflight | PASÓ |
| Pruebas puntuales, ya con E10 fusionada (42 archivos, 490 pruebas) | PASÓ |
| `tsc` acotado, ya fusionado; ESLint de los archivos tocados, antes del merge | PASÓ |
| Gate de símbolos de migraciones pendientes | PASÓ: 0 ROJO, 9 AMARILLO declarados |
| Mutantes: 43 del contrato y 7 de `/registro` y del manejador | PENDIENTE: turno concedido por el Director General, con vigía |
| `pnpm verify` | NO EJECUTADO: el Director General lo corre en la punta de la tanda A al integrar, y lo pide el Subdirector después de publicar |
| Punta a punta con Chatwoot real | NO EJECUTADO: fuera del encargo |
| revisar-datos-ve | §16.8: 7 CORRECTO, 1 ENCONTRADO, 3 NO VERIFICABLE, 1 no aplica |

Las pruebas corren con `node node_modules/vitest/vitest.mjs` y un `node_modules` enlazado (junction, ignorado por Git) al del checkout principal, con el mismo `pnpm-lock.yaml`. **Con la junction no se usa `pnpm`:** vaciaría la instalación original.

## Impacto documental

- SDD-0587: §4.2 (resuelto), §10 (allowlist 6.4), §13 y §16 (nuevo).
- Checklist 0582: fila 6.4 → entregado, 0,5 d reales, 0 restantes. Sin aceptar: el avance no se mueve.
- `docs/runbooks/chatwoot-bandeja.md`: eventos y orden de encendido.
- `knowledge:status`, Graphify y Archify: NO EJECUTADO en este worktree (corrida pesada; los publica el Director desde main).

## PENDIENTES DE ESTA TAREA

- Registrar el resultado de la tanda de mutantes.
- `codex/0582-e10-enrutamiento` ya se trajo con merge (`ca3907529`). Si la otra sesión avisa de otro cambio, se trae otra vez, sin rebase.
- **Al resolver ese merge se perdieron dos cosas de 6.3 en las declaraciones de símbolos:** el grupo `sdd-0587-crm-tablero` y dos sitios de `tarjeta-actions.ts`. El gate lo detectó y ya están repuestos. Quien vuelva a fusionar E2 o E10 debe correr el gate después: el driver de merge semántico rechaza el conflicto, y tomar una sola versión del archivo borra lo de la otra.

## Puertas que quedan para Sam

- Aplicar la 0513, con el runbook, después de la 0503, 0504 y 0506 y antes de suscribir el webhook a los eventos nuevos.
- Lectura L3 y, con ella, D7.
- La frase de `/privacidad` sobre la campaña (§16.8, punto 7), antes de llevar 6.4 a producción.
- Aceptar la fila 6.4.

## FUERA DE ALCANCE DETECTADO

- **AUD-01:** crear una tarjeta, ligarla o darle asesor no deja evento en `entity_audit_log`. Propuesta en §16.6, para 6.6.
- **Dos tarjetas de una persona no se fusionan** (§16.5): falta una regla en el contrato.
- **El reproceso repite el aviso push:** cuando cualquier manejador falla, el cron vuelve a correrlos todos (`reprocesarEventosChatwoot`), y `avisarPorPush` encola otro push. La notificación lleva `tag` por conversación, así que el teléfono la reemplaza, pero es trabajo de más. Es de E2. Por eso `entrarLead` no lanza cuando falta la migración.
- **`RegisterForm.tsx` no enlaza `/privacidad` dentro del formulario;** el enlace está en el pie de la página.
