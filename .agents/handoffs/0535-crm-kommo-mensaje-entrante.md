# Handoff · SDD-0535 · Kommo: el cliente que vuelve a escribir llega a Recontacto

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15. Primera ronda: UTC 12:15 a 13:10 (caso B). Segunda ronda: UTC 18:10 a 18:40 aprox. (caso A) |
| Task ID / owner | `crm-kommo-mensaje-entrante` / sesión Worker «CRM_KOMMO» (`crm-kommo-aba15b6a`) |
| Claim del harness | `crm-kommo-aba15b6a` (se libera al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\epic-brattain-3aee82` |
| Rama | `claude/epic-brattain-3aee82` (PR #238). La segunda ronda va sobre la cabeza publicada `52037fce`, sin traer main (lo trae el Director) |
| Base | `origin/main` `262ba234` (merge de la #228) |
| SDD | [0535](../../docs/specs/0535-crm-kommo-mensaje-entrante/spec.md), `in-progress`. Reserva `codex/sdd-reserve-0535` (`a093b0e2`), publicada |
| Estado de la tarea | lista para revisión; falta desplegar y probar en producción (lo hace el Director) |
| Permisos | lectura de la cuenta de Kommo con la sesión de Sam; encendido de los 4 agentes con OK nominal de Sam; lectura del servidor propio con OK de Sam (configuración de la conexión, `kommo_writeback_outbox` sin payload de clientes, logs de las funciones). Commits selectivos y push de la rama propia. Sin desplegar ni escribir en Kommo desde local. `pnpm verify` completo no ejecutado: el CI de la PR cubre la suite (indicación del Director) |

## Objetivo

Pedido de Sam: cuando un cliente vuelve a escribir ya no sale el rojo en Kommo y
no vuelve a «activo». Aclaración de Sam: «activo» es **Recontacto**, y el caso es
el cliente que ya pasó y vuelve a escribir. Por la tarde, Sam: «ya tiene hasta
número de cliente asignado y nos está recontactando, por lo que debería aparecer
otra vez en recontacto».

## Diagnóstico

1. **Caso A · el cliente con Shipping Mark (verificado en Kommo y en el servidor).**
   Kommo le abre un trato **nuevo** en «Leads Entrantes» y lo avisa con
   `unsorted[add]`, no con `leads[add]`. Nuestro parser descartaba `unsorted[...]`:
   **1.864** `unsorted[add]` en 5 días en `docker logs --since 120h dtd-cargo-functions-1`.
   El enrutador de SDD-0244 no se disparó nunca: **0** `patch_stage` a Recontacto en
   `kommo_writeback_outbox`, que desde 2026-08-01 tiene solo 4 filas, todas de
   agosto. La configuración está bien (`stage_map.recontacto` = `{14036567, 108343835}`,
   `writeback_enabled` = t, `writeback_dry_run` = f, drenaje `*/15` activo y
   `succeeded`). En Kommo, los 6 tratos nuevos de clientes del 11 al 14 de octubre
   nacieron en la bandeja y una persona los aceptó en Contacto inicial horas
   después. Los 18 movimientos a Recontacto desde julio fueron todos 4 horas o más
   después de creado el trato: los hacía una persona.
2. **Caso B · el perdido que vuelve (verificado en Kommo).** En 57 casos en 30 días,
   Kommo colgó el mensaje del trato en `Ventas Perdidos` sin crear uno nuevo.
3. **El rojo.** Era la tarea vencida que creaban los 4 agentes de IA, apagados desde
   el 24-sep, con el paquete de créditos de US$99 caducado. Se encendieron con OK de
   Sam el 15-oct (13:19-13:30 UTC) y la prueba real pasó; por la tarde Sam informó
   que los volvieron a apagar por costo. Los agentes nunca movían tratos.
4. **No es WhatsApp** y **nuestro código no marca leídos ni apaga bots**.

**NO VERIFICADO:** qué decide Kommo entre el caso A y el caso B.

## Qué se hizo

- **`supabase/functions/_shared/kommo-reapertura.ts`** (puro):
  - Caso A: `parseEntradasBandeja`, `cuerpoAceptarEnRecontacto`, `tokenEntrada` y
    `procesarEntradasBandeja` (orquestador con dependencias inyectadas que nunca lanza).
  - Caso B: `leadsConMensajeEntrante`, `decidirReapertura`, `tokenVolvio`.
  - `buildTareaVolvioPayload`, gemelo de `buildTaskPayload`.
- **`supabase/functions/kommo-webhook/index.ts`**:
  - Caso A: `aceptarClientesEntrantes` acepta en Recontacto, directo y con el gate
    de la cola, las entradas que `decideRoute` reconoce como cliente; el Shipping
    Mark y la tarea van por la cola.
  - Caso B: `reabrirTratosCerrados`.
  - La resolución del cliente se extrajo a `crearCargadorPorClaves`,
    `resolverCliente` y `encolarMarcas`, compartidos con `routeNewLeads`.
  - La salida temprana ya no descarta un POST con solo `unsorted[add]`.
  - Una sola llamada a `despertarDrenaje`.
- **Pruebas:** `kommo-reapertura.test.ts` (45 casos) y el texto que busca una
  prueba de SDD-0288 en `punto-conversacion.test.ts`.
- **Docs:** spec 0535 corregida, bloque del 15-oct en
  `docs/marketing/kommo-estado-y-pendientes.md` y este handoff.

### Decisiones de criterio (a revisar)

1. **El accept del caso A va directo a Kommo, no por la cola.** Tiene que llegar
   antes de que una persona acepte la entrada; es idempotente por naturaleza (404
   la segunda vez); la cola no tiene la op y sumarla exige migración. Mismo gate y
   mismo interruptor. Excepción de AUD-01 anotada en la spec: el accept queda en el
   log del webhook (conteos) y en el historial de Kommo, no en la cola.
2. **Solo se acepta a quien `decideRoute` reconoce** (vínculo o teléfono único). Un
   desconocido se queda en la bandeja.
3. **Ganado no se reabre** en el caso B, solo lleva la tarea (SDD-0244 §5). El
   cliente ganado que vuelve suele caer en el caso A, que sí lo lleva a Recontacto.
4. **`patch_stage` del caso B sin snapshot** de `updated_at` (cada mensaje lo sube).
5. **Cualquier perdido que escriba vuelve**, también el que solo agradece.

## Validación

| Comprobación | Resultado |
|---|---|
| `vitest run` de `kommo-reapertura`, `kommo-router`, `webhook-parse`, `kommo-writeback-plan`, `punto-conversacion`, `kommo-writeback` (`--pool=forks`) | PASÓ · 6 archivos · 168 pruebas |
| Mutantes del caso B (6) | PASÓ · los 6 mueren (salida con la línea `Tests` y fallos) |
| Mutantes del caso A (10: acepta desconocidos, tarea tras accept fallido, ignora el gate, sin inerte, sin dedupe de `uid`, cualquier embudo, token por evento, salida temprana vieja, gate fijo en `true`, 404 contado como aceptado) | PASÓ · los 10 mueren; control verde 45/45 |
| `pnpm edge:check` (Deno 2 vía npx) | PASÓ · 4 funciones compilan |
| `pnpm docs:check` (índice regenerado) · `pnpm sdd:check` · `pnpm governance:check` · `git diff --check` | PASÓ · 512 specs · sin números repetidos · cápsula vigente · sin espacios sobrantes |
| ESLint | NO APLICA · `supabase/functions` está ignorado por configuración |
| `pnpm typecheck` | NO APLICA a `supabase/functions` (lo cubre `edge:check`) |
| `pnpm verify` completo | NO EJECUTADO · el CI de la PR cubre la suite (indicación del Director) |
| Prueba en producción | NO EJECUTADO · la despliega el Director |

## Producción

- OK de despliegue de Sam, transmitido por el Director, que es quien despliega:
  primero «Y TAMBIEN autorizo desplegar kommo-webhook en el servidor propio»; con el
  caso A sumado, «Confirmo desplegar kommo-webhook con el cambio: los tratos nuevos
  de clientes que ya pasaron se aceptan directo en Recontacto con tarea vencida».
- Despliegue: copiar `supabase/functions/kommo-webhook/index.ts` y
  `supabase/functions/_shared/kommo-reapertura.ts` a `functions/` de `/srv/dtd-cargo`
  y reiniciar `dtd-cargo-functions-1` (`docs/runbooks/servidor-contabo.md` § 2.1).

## Pendientes de esta tarea

1. Despliegue (Director).
2. **Prueba real del caso A:** un contacto con Shipping Mark escribe; en segundos su
   trato nuevo pasa de «Leads Entrantes» a Recontacto, y en la cola aparecen
   `patch_lead`, `patch_contact` y `add_task` con `dedupe_token = volvio:entrada:<uid>`.
   En el log: `[kommo-webhook][sdd-0535][entradas]` con `aceptadas: 1`.
3. **Prueba real del caso B:** un contacto con el trato perdido escribe; el trato
   pasa a Recontacto con la tarea (`volvio:<closed_at>`).

## FUERA DE ALCANCE DETECTADO

- **Rojo en todos los mensajes:** depende de los agentes de IA y de sus créditos;
  hoy apagados por decisión de Sam.
- **Salesbots «Ping 23 h» apagados:** el embudo conserva sus 4 disparadores con el
  aviso rojo de Kommo.
- **Widget NOVA «Tintado de leads»**: pinta por tareas; depende de que existan.
- **`docs/runbooks/kommo-consolidacion-embudo-unico.md`** § «Enrutado automático»
  describe el flujo «Kommo crea el trato → `leads[add]`», que no ocurre. No se tocó;
  la spec 0535 lo corrige.
- **SDD-0245 §1** afirma que `/api/v4/leads` no devuelve los tratos sin aceptar; hoy
  `GET /api/v4/leads?filter[id][]=` devolvió los tratos en `Leads Entrantes`.
- **El webhook sigue descartando** `unsorted[update]`, `unsorted[delete]`,
  `talk[...]` y `leads[responsible]`. Si el Studio necesita ver la bandeja en vivo,
  es otra spec (SDD-0245).

## Impacto documental y conocimiento

- Canónicos actualizados: spec 0535 y `docs/marketing/kommo-estado-y-pendientes.md`.
- Graphify / Archify / Obsidian: no ejecutados en esta tarea; el Director los corre al integrar.

## HANDOFF AL DIRECTOR

PR #238 sin fusionar, con el caso A sumado sobre `52037fce`. Antes del merge:
revisar las decisiones de criterio, sobre todo la 1. Después del merge: despliegue
y las dos pruebas reales.
