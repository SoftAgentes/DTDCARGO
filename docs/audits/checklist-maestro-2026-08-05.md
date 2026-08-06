# Checklist maestro · 2026-08-05

> Fuente: auditoría contra producción ([estado-operacional-2026-08-05.md](estado-operacional-2026-08-05.md))
> \+ el checklist de la torre de control + el traspaso de SDD-0246 de la otra ventana.
>
> **Ordenado por criterio de daño, no por facilidad.** La Parte 1 es lo que puedo
> hacer solo, de corrido. La Parte 2 es lo que necesita tus manos y no bloquea la
> Parte 1.

---

## Parte 1 · Lo que puedo hacer solo

### P0 · Sangrado activo — data y contacto de clientes

- [x] **SDD-0248 · Alerta de correo no entregado** — cron `/api/cron/mail-health`
      cada 30 min, Telegram + correo, guard anti-bucle validado con mutación.
      Tapa la fuente: `sendEmail` devolvía éxito para correos que nunca salieron.
      *Hecho en esta ventana.*
- [x] ~~**B4 · Kommo: el 200 que miente.**~~ **Diagnosticado — NO es un bug de
      código.** `kommo-push-client` "nace apagado" por diseño (SDD-0074): corre
      en **dry-run** salvo que el secreto `KOMMO_PUSH_DRY_RUN` valga `"false"`.
      En producción nunca se puso.
      **Prueba:** `sync_logs` tiene **18 corridas `push_client_dryrun`, todas ok,
      la última hoy** — y **una sola** `push_client` real, del 2026-07-11, **en
      error**. Por eso 0 de 432 clientes tienen `kommo_lead_id`.
      → El arreglo es de configuración, pasa a la Parte 2 (#21).
- [ ] ⚠️ **B4b · El 400 que espera detrás del interruptor.** El único intento
      real murió con `Kommo 400 · código 205`. Flipar el secreto sin resolver
      esto solo cambia "no escribe" por "escribe error". Hay que reproducirlo con
      `{dry_run:false}` sobre UN cliente y ver el payload que Kommo rechaza.
      Sospecha principal: el espejo `kommo_custom_fields` está desactualizado
      respecto de Kommo — hoy solo resuelve `markbox` ("Shipping Mark - j102");
      `rif` y `tier` no existen como campos y se omiten.
- [x] **SDD-0249 · Cliente con Shipping Mark y sin acceso.** ✅ Cron diario
      `/api/cron/alta-health` + warning en el registro. Nació de encontrar a
      **DTD-9017** roto en producción: recibió el correo invitándolo al portal y
      la cuenta de acceso nunca se creó. Tres semanas invisible.
- [ ] **Outbox para los 7 pasos best-effort del registro.** `app/registro/actions.ts`
      tiene 7 pasos que fallan en silencio (estimado, referido, `client_users`,
      welcome, aviso al equipo, Kommo, throttle). Un cliente puede registrarse
      con los 7 rotos y ver "todo bien". Migración + drenado con reintentos.
      ⚠️ La migración queda como archivo — aplicarla es tuya.
- [ ] **Herramienta de reenvío de correo atascado** en Studio › Mailing, para que
      el rescate no dependa de SQL a mano.

### P1 · Bugs confirmados

- [x] **B3 · El gate de migraciones medía el checkout.** ✅ Ahora mide
      **`origin/main` ∪ el checkout**, con `git ls-tree` + fetch best-effort. Si
      no puede consultar git lo dice con `[AVISO]` en vez de callarse. 4 tests
      nuevos, validados con mutación. `AGENTS.md` actualizado — documentaba el
      punto ciego como vigente.
- [x] **B1 · El push borraba la suscripción del operario por un fallo de red.**
      ✅ Ahora **solo 410/404** borra; los transitorios cuentan y siguen. El
      archivo no tenía test propio: le puse 6, validados con mutación.
      *Impacto hoy bajo* — `outbox_push_events` tiene 0 filas históricas, pero
      era una bomba para cuando el push se encienda de verdad.
- [x] **B2 · Un aviso que rebotó se mostraba como "Enviado".** ✅ Eran **dos**
      agujeros, no uno:
      1. El webhook de Resend marcaba `bounced` en `mail_logs` y nadie tocaba
         `client_notification_schedule` → la fila quedaba en `sent` para
         siempre. El hilo ya existía (el drain guarda `schedule_id` en la
         metadata del log): ahora el webhook lo usa y degrada el aviso a
         `failed`. Sin migración. `failed` es terminal para el drain, así que no
         genera bucle de reenvío contra una dirección muerta.
      2. `dispatchEmail` daba por `sent` cualquier `res.ok`, y `sendEmail`
         devuelve `ok:true` aunque el correo no haya salido (mismo bug raíz que
         SDD-0248). Ahora un `queued` cuenta como transitorio y se reintenta.
      6 tests nuevos, validados con mutación.
- [x] ~~**Numeración: 10 duplicados.**~~ ⚠️ **Descartado — el hallazgo era mío y
      estaba mal.** 3 no eran duplicados (`0020/0020b` es la convención `NNNNb`
      de fix post-aplicación) y las 7 reales ya están en `CHOQUES_HISTORICOS` de
      `scripts/check-numbering.mjs`, con motivo y ambas aplicadas. **El gate de
      numeración funciona.** No hay nada que hacer acá.
- [ ] **`estado-colas` de la torre** — bloqueado porque `outbox_push_events` no
      tiene columna de status: un push que agota sus 5 intentos queda con
      `sent_at` null para siempre y la regla alertaría cada 30 min, para siempre.
      Arreglar la representación primero (mismo arreglo que el outbox de P0).
- [ ] **`migrations-check` de la torre** — va después de B3.
- [ ] 🔴 **El paso e2e del gate es inestable bajo carga.** En 3 corridas
      seguidas del mismo árbol falló un conjunto **distinto** cada vez —
      `cbm-ayuda`, `/tarifas`, `global-search`, redirects 301 — repartido entre
      chromium / mobile-chrome / mobile-safari. Los mismos tests pasan **3 de 3
      en aislamiento**. Es contención de recursos, no regresión.
      **Por qué importa más de lo que parece:** un gate que falla al azar enseña
      a ignorar el rojo, y así fue exactamente como se perdió la 0228. Mientras
      esto siga, "gate verde" es en parte suerte.
      Candidatos: bajar `workers` en `playwright.config`, `retries: 1` para el
      e2e local, o aislar los specs de calculadora que concentran los timeouts.

### P2 · SDD-0246 · Fusión de duplicados *(traspaso de la otra ventana)*

Nada roto: está desplegado y sus migraciones 0341/0342 verificadas en prod.

- [ ] ⭐ **Ampliar `client_duplicate_candidates()` para detectar duplicados
      dentro del legado.** Hoy solo compara legado ↔ registro nuevo, y por eso
      hay **6 pares invisibles**: DTD-A119·DTD-Y040, DTD-J066·DTD-Y017,
      DTD-A079·DTD-A135, DTD-A032·DTD-J004, DTD-J044·DTD-Y041, DTD-A080·DTD-D032.
      Al quitar `v.es_legado and not n.es_legado` hay que resolver dos cosas que
      hoy no existen: **evitar el par espejo** (A↔B y B↔A saldrían dos veces) y
      **decidir quién sobrevive cuando los dos son legado** (hoy sobrevive el
      legado por definición, y ahí ya no aplica).
      - Leer primero la memoria `project_sdd0246_fusion_cliente_duplicado.md` y
        `docs/specs/0246-fusion-cliente-duplicado/spec.md`. ⚠️ En `git log`
        búscala como **0244** — se renumeró por colisión.
      - Tests contractuales SQL **validados con mutación**.
      - ⚠️ La migración queda como archivo. Aplicarla es tuya.

**Reglas duras de este bloque, que no se rompen:**
- El markbox **nunca** se renumera — es un valor copiado dentro de facturas y
  expedientes sellados.
- La fusión **nunca** es automática. De los 3 duplicados reales, uno coincide
  solo por nombre, y el nombre es "Jose Mendez".
- Si se prueba en producción: markbox muy por debajo del máximo (el máximo está
  en **9046**) y borrado con `DELETE` real. Un `DTD-####` por encima del máximo
  quema el correlativo para siempre, y al llegar a 9999 el siguiente sale con 5
  dígitos y rompe el formato.

### P3 · Comercial atado

- [ ] **Invitaciones al portal** — 364 de 432 clientes (84%) sin acceso.
      Necesita 3 migraciones bajo runbook.
- [ ] **Lead de calculadora en <5 min** — requiere persistir el lead primero.
- [ ] **Tracking del courier chino** — cuenta en 17TRACK/Kuaidi100 + migración.

### P4 · Contable atado

- [ ] **Crear la fila de `accounting_settings`** — hoy hay **0**. Es el primer
      candado: sin ella no hay configuración ni fecha de cierre.
      ⚠️ Escribir datos en prod necesita tu OK.
- [ ] **Dejar el motor listo para el primer asiento** — `journal_entries` = 0 en
      toda la historia. Depende de que decidas si el ERP **lleva** la
      contabilidad o solo la **refleja** (ver Parte 2).

### P5 · Higiene

- [ ] **Borrar el MCP `n8n` viejo** (el del Server Trigger, sigue en 401):
      `claude mcp remove --scope user n8n`.

---

## Parte 2 · Requiere tus manos

No bloquean nada de la Parte 1. Los pongo en orden de urgencia real.

### Con reloj corriendo

| # | Qué | Cuándo |
|---|---|---|
| 1 | 🔴 **Renovar `doortudoor.com`** — expira el 2026-10-31, quedan **87 días**. El 301 a dtdcargo.com no se puede perder | antes del 31-oct |
| 2 | **Trámite de WhatsApp saliente con Meta** — habilitador del 60% del impacto; de él cuelgan 3 pendientes más | semanas, empezar ya |

### Rescate de clientes (la lista concreta)

| # | Cliente | Qué pasó | Cómo contactarlo |
|---|---|---|---|
| 3 | **DTD-1009 · Johana Matheus** | bienvenida atascada 07-jun, 0 correos entregados | +58 412 2155899 |
| 4 | **DTD-1010 · ABDAL AKIL** | bienvenida atascada 07-jun, 0 correos entregados | 424 6097153 |
| 5 | **DTD-1011 · Jose Diaz** | bienvenida atascada 07-jun, 0 correos entregados | +58 412 9819792 |
| 6 | **DTD-A110 · Adrián Figueroa** | bienvenida **rebotó** 15-jul — el correo no sirve | 424 3745436 · pedirle correo nuevo |
| 6b | 🔴 **DTD-9017 · Alain de Cardenas** | Recibió su correo, **y entró**: hay login el 15-jul 21:04. Lo que falta es el **vínculo** `client_users` — el insert del alta falló y quedó en un `console.error`. Tiene cuenta de auth válida y el portal no puede resolver de qué cliente es | +58 424 4731021 · **Studio › Administración → invitación al portal** (`/studio/admin`). La RPC `portal_invite_client` crea justo esa fila y le manda el enlace; es idempotente y no toca su cuenta de auth. Desde la ficha del cliente no se puede. Se resuelve junto con el punto 8 |

> Verificado uno por uno. **No** están en la lista: DTD-1008 (cuenta de prueba
> "QA Bodysize"), DTD-1007 (alta interna del equipo), DTD-Y003 (tiene 3 correos
> entregados, está comunicado), los dos rebotes de hoy (QA de DTD-9047, no existe
> el cliente) y el rebote del 4-jul (`example.com`, spam del formulario).

### Operación en el Studio

| # | Qué |
|---|---|
| 7 | Fusionar los 3 duplicados en **Studio › Clientes › Posibles duplicados** |
| 8 | Invitar los 179 al portal — **Studio › Administración** |
| 9 | Mandar el mensaje al gerente comercial |
| 10 | Confirmar cuáles de los 29 se retiran |

### Decisiones que solo tú puedes tomar

| # | Qué | Por qué te toca |
|---|---|---|
| 11 | **¿El ERP lleva la contabilidad o solo la refleja?** | Con 0 asientos y QBO en el mapa, esto no está resuelto y bloquea todo el bloque contable |
| 12 | **Recuperación Kommo** | Revierte el punto 3 de la spec 0157, que eligió no automatizar el envío. Necesita decisión por escrito |
| 13 | **OK para aplicar cada migración a producción** | Regla del repo: de a UNA, nombrándola. Ver [runbook](../runbooks/aplicar-migraciones-prod.md) |

### Credenciales y accesos (no los toco por diseño)

| # | Qué |
|---|---|
| 14 | **Bot de Telegram propio del vigía** — @BotFather → `/newbot`. ⚠️ **NO** el `TELEGRAM_BOT_TOKEN` de producción: ese habla con clientes y un Telegram Trigger le haría `setWebhook` y tumbaría `app/api/telegram/webhook` |
| 15 | Credencial **Telegram** en n8n con ese token |
| 16 | **Chat ID** en los dos workflows (reemplazar `PON_AQUI_TU_CHAT_ID`) |
| 17 | Credencial **Header Auth** → `Bearer <DEBUG_HEALTH_SECRET>`, secreto dedicado y rotable, distinto del que usa el Studio |
| 18 | Credencial **Header Auth** → `Bearer <token GitHub>`, fine-grained solo lectura (`Contents: Read`) sobre `hailuwaycom-sketch/DTDCARGO`. ⛔ Nunca un token de Vercel |
| 19 | **Rotar la API key de n8n** — quedó visible en una captura |
| 20 | **Activar los dos workflows** por API (dijiste que los activas tú) — ⚠️ con SDD-0247 desplegado ANTES, si no el health responde sin `?cheap=1` y se come la cuota de SeaRates igual |
| 21 | ⭐ **Encender el push a Kommo**: secreto `KOMMO_PUSH_DRY_RUN="false"` en la Edge Function. Es lo que desbloquea que los registros web lleguen al CRM. ⚠️ **Primero B4b** (el 400/205) y luego una prueba supervisada sobre UN cliente — si no, cada alta escribirá un error en vez de un lead. No lo toco yo: es config de producción que escribe en un sistema externo |

---

## Nota de método

Todo lo de la Parte 1 sale con commits atómicos y selectivos, cada uno con su
gate en verde antes de pushear. **Ninguna migración se aplica a producción sin
que la nombres.** Las escribo como archivo, las valido local y quedan esperando.
