# Handoff · SDD-0535 · Kommo: el cliente que vuelve a escribir regresa a Recontacto

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15, Caracas 08:15 a 09:10 aprox. (UTC 12:15 a 13:10) |
| Task ID / owner | `crm-kommo-mensaje-entrante` / sesión Worker «CRM_KOMMO» (`crm-kommo-aba15b6a`) |
| Claim del harness | `crm-kommo-aba15b6a` (se libera al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\epic-brattain-3aee82` |
| Rama | `claude/epic-brattain-3aee82` |
| Base | `origin/main` `262ba234` (merge de la #228) |
| SDD | [0535](../../docs/specs/0535-crm-kommo-mensaje-entrante/spec.md), `in-progress`. Reserva `codex/sdd-reserve-0535` (`a093b0e2`), publicada |
| Estado de la tarea | lista para revisión; falta desplegar y probar en producción |
| Permisos | lectura de la cuenta de Kommo con la sesión de Sam (sin cambios); commits selectivos, push de la rama propia y PR contra `main` sin fusionar. Sin producción ni base: no se leyeron filas de Supabase. `pnpm verify` completo no ejecutado: requiere turno del Director |

## Objetivo

Pedido de Sam: cuando un cliente vuelve a escribir ya no sale el rojo en Kommo y
no vuelve a «activo». Aclaración de Sam: «activo» es **Recontacto**, y el caso es
el cliente que ya pasó (trato cerrado) y vuelve a escribir.

## Diagnóstico (verificado en la cuenta, solo lectura)

1. **El rojo.** Los 4 agentes de IA están **apagados**; la última tarea del robot y
   el último bloque de mensajes de bots son del **2026-09-24**. El paquete de
   créditos de US$99 figura **Caducado**, con la renovación automática apagada
   (última renovación 29-08). Los 15 Salesbots están **apagados**, incluidos los 4
   «Ping 23 h». El rojo de las tarjetas era la tarea vencida que creaban los
   agentes en cada mensaje: sin agentes no hay tarea y no hay rojo. Quién los apagó:
   **NO VERIFICADO**.
2. **Recontacto.** Kommo **no crea un trato nuevo** cuando alguien con el trato
   perdido vuelve a escribir: cuelga el mensaje del trato cerrado. 57 casos en 30
   días, ninguno con un trato posterior. El enrutador de SDD-0244 se dispara con
   `leads[add]`, que nunca llega en este caso.
3. **No es WhatsApp.** Los mensajes siguen entrando todos los días; el canal
   `whatsapp_cloud_api` está activo. La baja de la API vieja de WhatsApp en Kommo
   es de 2024 y no aplica.
4. **Nuestro código no marca leídos ni apaga bots.** Inventario completo de
   escrituras en la spec. El único webhook configurado en Kommo es el nuestro
   (`supabase.dtdcargo.com`, activo, actualizado el 2026-10-14 en el corte); el
   de `qp1-nova.ru` ya no está.

Cifras y fuentes en la spec, sección «Contexto».

## Qué se hizo

- **`supabase/functions/_shared/kommo-reapertura.ts`** (nuevo, puro): decide por
  trato con mensaje entrante. Perdido → `patch_stage` a `stage_map.recontacto` y
  `add_task` vencida; ganado → solo la tarea; abierto → nada.
- **`supabase/functions/kommo-webhook/index.ts`**: `reabrirTratosCerrados` (pide
  el trato con `GET /api/v4/leads/{id}` y encola) y `despertarDrenaje` (invoca
  `kommo-writeback` con `EdgeRuntime.waitUntil`). Corre después de estampar el
  mensaje.
- **Pruebas:** `supabase/functions/_shared/__tests__/kommo-reapertura.test.ts`.
- **Docs:** spec 0535, índice regenerado y bloque fechado en
  `docs/marketing/kommo-estado-y-pendientes.md`.

### Decisiones de criterio (a revisar)

1. **Ganado no se reabre**, solo lleva la tarea. Respeta SDD-0244 §5. Si Sam
   quiere que también aparezca en Recontacto, hay dos caminos: reabrir la venta
   (la borra de los reportes) o crear un trato nuevo (op `create_lead` y
   migración). Hoy es 1 caso en 30 días.
2. **`patch_stage` sin snapshot de `updated_at`**: cada mensaje le sube el
   `updated_at` al trato (medido) y con snapshot el drenaje saltearía el cambio en
   cualquier ráfaga. Costo: un cambio manual en la misma ventana de segundos se
   pisa.
3. **Cualquier perdido que escriba vuelve**, también el que solo agradece. Es la
   regla de Sam. Se puede afinar con una ventana de gracia o excluyendo un motivo
   de pérdida.

## Validación

| Comprobación | Resultado |
|---|---|
| `vitest run` de `kommo-reapertura`, `kommo-router`, `webhook-parse`, `kommo-writeback-plan`, `punto-conversacion`, `kommo-writeback` (`--pool=forks`) | PASÓ · 6 archivos · 144 pruebas |
| Mutantes (6: ganado reabierto, `complete_till` en ms, salientes, sin `dedupe_token`, token por mensaje, sin interruptor) | PASÓ · los 6 mueren (salida con la línea `Tests` y fallos) |
| `pnpm edge:check` (Deno 2 vía npx) | PASÓ · 4 funciones compilan |
| `pnpm docs:check` | PASÓ · 511 specs |
| `pnpm sdd:check` | PASÓ · sin números repetidos |
| `pnpm governance:check` | PASÓ · cápsula vigente |
| `git diff --check` | PASÓ |
| ESLint | NO APLICA · `supabase/functions` está ignorado por configuración |
| `pnpm typecheck` | NO APLICA a estos archivos · `tsconfig` excluye `supabase/functions`; lo cubre `edge:check` |
| `pnpm verify` completo | NO EJECUTADO · requiere turno del Director |
| Prueba en producción | NO EJECUTADO · falta desplegar la función (ver pendientes) |

## Pendientes de esta tarea

1. **Desplegar `kommo-webhook` en el servidor propio** después del merge: copiar
   `supabase/functions/kommo-webhook/index.ts` y `supabase/functions/_shared/kommo-reapertura.ts`
   a `functions/` de `/srv/dtd-cargo` y reiniciar `dtd-cargo-functions-1`
   (`docs/runbooks/servidor-contabo.md` § 2.1). Es producción: con el OK de Sam.
2. **Prueba real:** un contacto de prueba con el trato en `Ventas Perdidos`
   escribe; en segundos el trato pasa a Recontacto con la tarea «El cliente volvió
   a escribir. Responder.» vencida. Confirmar en `kommo_writeback_outbox` una fila
   `patch_stage` y una `add_task` con `dedupe_token = volvio:<closed_at>`, las dos
   `sent` (lectura de la cola: con el OK de Sam).
3. Comprobar que `stage_map.recontacto` sigue configurado en producción
   (`kommo_connections`); sin él la función queda inerte. Según los docs, apunta a
   `{14036567, 108343835}`: **NO VERIFICADO** hoy.

## FUERA DE ALCANCE DETECTADO

- **Rojo en todos los mensajes:** ~~depende de encender los 4 agentes~~ **hecho el
  2026-10-15, 13:19-13:30 UTC**, con OK nominal de Sam: canal WhatsApp y las etapas
  de agosto en los 4 (detalle en `docs/marketing/kommo-estado-y-pendientes.md`).
  Prueba real a las 13:33:54 UTC: el robot respondió y creó la tarea. Queda la
  plata: 2.250 créditos del plan alcanzan para unos 4 días (inferido); el paquete
  de US$99 sigue caducado.
- **Salesbots «Ping 23 h» apagados:** el embudo conserva sus 4 disparadores con el
  aviso rojo de Kommo. Si no se van a usar, conviene quitar los disparadores; si
  sí, encender los bots.
- **Widget NOVA «Tintado de leads»** activo con «Tareas de Retoque» y «Retoque de
  imbox» encendidos: pinta por tareas, así que también depende de que existan.
- **`docs/runbooks/kommo-consolidacion-embudo-unico.md`** § «Enrutado automático»
  describe el flujo «Kommo crea el trato → `leads[add]`», que no es lo que pasa con
  los perdidos. No se tocó; la spec 0535 lo corrige.
- **SDD-0245 §1** afirma que `/api/v4/leads` no devuelve los tratos sin aceptar; hoy
  `GET /api/v4/leads?filter[id][]=` devolvió los 24 tratos en `Leads Entrantes`.

## Impacto documental y conocimiento

- Canónicos actualizados: spec 0535 y `docs/marketing/kommo-estado-y-pendientes.md`.
- Graphify / Archify / Obsidian: no ejecutados en esta tarea; el Director los corre al integrar.

## HANDOFF AL DIRECTOR

PR contra `main` sin fusionar. Antes del merge: revisar las tres decisiones de
criterio. Después del merge (fuera de la congelación de esta noche): despliegue de
la función en el servidor y prueba real, con el OK de Sam.
