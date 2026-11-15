# Handoff · SDD-0626 · Paso 2 del cable · webhook de Chatwoot, filtro nivel 1 y vaciado diario

| | |
|---|---|
| Owner | `local_paso2-webhook-claude`: Claude Code, en una sesión lanzada desde la sesión del cable (`local_f13ed801`) |
| Fecha | 2026-11-15 UTC |
| Worktree | `Developer/DTD-worktrees/0626-paso2-webhook` |
| Rama | `sdd/0626-paso2-webhook`, desde `origin/main` `57f58f62b` (el merge de la #575) |
| Base | `main` |
| PR | SoftAgentes/DTDCARGO (número en el cuerpo del PR) |

**No hay merge ni auto-merge: la fusión la hace la sesión que lanzó este paso, cuando Sam lo diga.** Nada se aplicó en ningún entorno: ni producción ni prueba. No se desplegó ni se reinició el ERP.

## OBJETIVO ORIGINAL
«PEDIDO · CABLE · PASO 2 v2» de Hermes (chat DIRECTOR), autorizado por Sam el 15/11/2026 («¿Le aviso a Hermes y lanzo el Paso 2 v2?» → «Sí, las dos»). SDD-0626 v0.3, §3.2 y §3.3. Solo eso: sin repartidor, sin modelo, sin herramientas y sin responder nada en Chatwoot. Todo nace apagado.

## QUÉ SE HIZO
1. **SDD v0.3.1** (`docs/specs/0626-oficina-runtime/spec.md`):
   - encabezado «aprobada para construir §3.2 y §3.3» con el OK de Sam;
   - mapa de pasos (Paso 0 = §3.0 · 1 = §3.1 · 2 = §3.2 y §3.3 · 3 = §3.4 y §3.5 · 4 = §3.6) y menciones sueltas corregidas;
   - AC-1, condición 6: «AC-5 completo: gasto visible por corrida y simulacro de auto-pausa al 80 % superado, con un tope de prueba» (y su fila de §9);
   - AC-1, condición 2: la revisión de Sam de las 10 conversaciones se anota en `agent_approvals` y el conteo usa la consulta de AC-7. Solo texto;
   - cómo se construyen §3.2 y §3.3, y la allowlist del Paso 2;
   - `privacidad.md`: hallazgos 1 y 3 al día.
2. **Webhook** `POST /api/oficina/webhook-chatwoot` (`app/api/oficina/webhook-chatwoot/route.ts`, lógica en `lib/studio/oficina/webhook-chatwoot.ts`).
3. **Filtro nivel 1**: prioridad al recibir (`lib/studio/oficina/filtro-nivel1.ts`), cuota y pausa en la base (`office_filtrar_bandeja()`, migración **0544**), cron `/api/cron/oficina-filtro` cada minuto.
4. **Vaciado diario**: cron `/api/cron/oficina-vaciado` a las 04:15 UTC, llama a `office_vaciar_resumenes_viejos()` (0541). Se agregaron los dos crons a `scripts/build-crontab.mjs` (solo servidor, como `searates-refresh`) y se regeneró `infra/dtd-cargo/cron/crontab`.
5. **Pruebas** con eventos simulados contra el esquema real en PGlite (ver abajo).
6. `.env.example` (raíz e `infra/dtd-cargo/`) con las variables nuevas, sin valores, y el runbook `docs/runbooks/oficina-cable.md` §8 (encender, apagar y revisar).

## DECISIONES
- **Un webhook nuevo, no el de la Bandeja.** `/api/chatwoot/webhook` (SDD-0585) sigue igual. El del cable tiene su propio secreto y su propio interruptor. Se reutilizan `verificarFirmaChatwoot` (HMAC con anti-replay, tiempo constante), `leerCuerpoAcotado` (256 KiB) e `interpretarEvento`, que ya no lleva el texto del mensaje.
- **Autenticación:** la firma HMAC de Chatwoot 4.19.1, que es la versión que pinea `infra/chatwoot` (`v4.19.1-ce`). Cabeceras `X-Chatwoot-Timestamp` y `X-Chatwoot-Signature`.
- **Hizo falta una migración, la 0544**, porque la cuota de 20 por hora necesita saber cuándo pasó cada evento a «triaje» y `event_inbox` solo guarda cuándo llegó (`ts`); un evento que esperó 2 h en «nuevo» no contaría contra la cuota. Agrega `event_inbox.triaje_en` y `office_filtrar_bandeja(integer default 20)`. La cuenta y el cambio van en una sola función con candado de aviso, así que dos corridas del cron no pueden pasarse de la cuota. Número: la 0543 es del #578 (`codex/audit-d1-flags-superadmin`); la 0544 estaba libre contra `main`, las ramas remotas y los PR abiertos. Comprobar de nuevo antes de fusionar.
- **Dedupe:** lo hace la clave única de la 0541. Es más fuerte que la ventana de 30 min de §3.3: la misma clave no entra nunca más.
- **Prioridad al recibir**, porque ahí están las etiquetas y el payload no se guarda. Dinero (3) por etiqueta (`OFICINA_ETIQUETAS_DINERO`, por defecto dinero, pago, cobro, cobranza, factura, reembolso), interno (1) por etiqueta (`OFICINA_ETIQUETAS_INTERNO`, por defecto interno, prueba). Si no está claro, cliente (2). **Dinero le gana a interno.**
- **El filtro y el webhook comparten interruptor** (`OFICINA_WEBHOOK_ACTIVO`). **El vaciado tiene el suyo** (`OFICINA_VACIADO_ACTIVO`): corre aunque la oficina esté pausada.
- **`exigirTextosDelCable` sobre la bandeja:** la fila solo lleva ids y referencias; se revisa como `meta_datos` (`clave_dedupe` y `payload_ref`). Es una red: con ids numéricos el webhook real no la dispara; la prueba del rechazo sustituye la regla (`vi.mock`).
- **Sin la 0541** (tabla o función ausentes: PGRST205/PGRST202/42P01/42883): 200 «omitido» y una sola línea de log por proceso. Declarado en `supabase/pending-migration-symbol-declarations.json` (los símbolos de la 0541 y la 0544 que el código alcanza).
- **Con la oficina pausada** el webhook guarda igual; el filtro (`office_filtrar_bandeja`) devuelve 0.
- **Códigos de respuesta:** apagado 200 `ignorado: apagado`; sin secreto o sin bandeja 503; cuerpo grande 413; firma inválida 401; JSON malo 400; ajeno/saliente/nota 200 `ignorado`; texto rechazado 422; error de la base 500 (solo el código en el log).

## PRUEBAS
- `lib/studio/__tests__/oficina-filtro-bandeja.migration.test.ts`: el contrato SQL de la 0544 (`supabase/tests/0544_oficina_filtro_bandeja.test.sql`) en PGlite, con control rojo, 8 mutantes y el desarme. El mismo contrato corre en Postgres 17 en el workflow «Contratos SQL».
- `lib/studio/__tests__/oficina-webhook.test.ts`: 33 pruebas contra la 0541 y la 0544 reales: ráfaga de 50 eventos con 20 repetidos, 11 casos de «no se guarda nada», pausa, privacidad (ninguna fila con el texto), vaciado (más de 90 días, recientes intactas, otras columnas iguales, repetirlo da lo mismo), sin la 0541, el almacén de Supabase y la configuración.
- `lib/studio/__tests__/oficina-webhook-rechazo.test.ts`: el rechazo de `exigirTextosDelCable` a través del webhook.
- Las tres rutas, y `scripts/__tests__/build-crontab.test.ts` (26 crons).
- Se probaron mutantes sobre el código de producción (sin interruptor, sin firma, bandeja ajena, nota interna, saliente, sin `exigirTextosDelCable`, referencia con el texto, prioridad fija, sin degradar sin la 0541, filtro y vaciado sin interruptor): todos hacen caer alguna prueba.

## tarea 1e · `agent_approvals` en producción (solo lectura, `dtd-cargo-db-1`)
Se leyeron esquemas y conteos con `default_transaction_read_only=on`. No se imprimió ninguna fila.
- **Existe.** 0 filas. RLS activa; una policy de SELECT para `authenticated` por tenant; `service_role` con todos los privilegios.
- **Columnas:** `id`, `agent_run_id` (NOT NULL, FK a `agent_runs` con ON DELETE CASCADE), `tenant_id` (NOT NULL, FK a `tenants`), `requested_action` (text, NOT NULL), `payload` (jsonb, NOT NULL), `status` (enum `pending|approved|rejected|expired`), `approver_id`, `reviewed_at`, `expires_at`, `created_at`.
- **¿Puede guardar el veredicto «correcta o no» y las 5 casillas de eval.md?**
  - **Sí por `payload` (jsonb sin forma), pero no limpio.** No hay columna ni constraint para el veredicto ni para las casillas; quedarían como convención dentro del jsonb.
  - **`status` no es «correcta/incorrecta».** Es aprobar o rechazar una acción; usarlo para el veredicto mezclaría dos cosas distintas.
  - **Cada fila exige un `agent_run_id` y un `tenant_id`.** Hoy `agent_runs` tiene 1 fila. El cable no usa `agent_runs` (SDD-0020, la Fase B planea sus nombres) y la oficina **no tiene tenant** (0541). Para anotar la revisión de las 10 conversaciones habría que crear una corrida y un tenant por conversación, o cambiar la tabla.
  - **El ON DELETE CASCADE** desde `agent_runs` borraría las revisiones si alguien limpia corridas.
- Lo que se decide en el Paso 3 (cuando se construya): reutilizar `agent_approvals` con una convención en `payload` (más rápido, con los tres inconvenientes de arriba) o una tabla propia del cable para el veredicto. Este paso no cambió nada.

## ESTADO AL CIERRE
Ver el cuerpo del PR y el REPORTE FINAL: SHA, corrida del CI y resultado.

## QUÉ QUEDA (no es de este paso)
- **Paso 2b:** la prueba con un mensaje real del inbox de prueba, cuando Sam entregue las 5 piezas de Chatwoot (secret del webhook, id de la bandeja de prueba, URL pública, etiquetas y la cuenta).
- **Aplicar la 0541 y la 0544**, con OK nominal de Sam. La publicación de la web se frena por las esperas (0528, 0538 a 0542 y 0544) hasta que se acepten con `publicar-web.sh aceptar-pendiente <migración>` o se apliquen.
- **Recrear el contenedor `cron`** para que tome las dos líneas nuevas del crontab (devuelven «apagado» mientras los interruptores estén vacíos).
- **Paso 3:** despachador y ejecución (§3.4 y §3.5), y lo de `agent_approvals`.
