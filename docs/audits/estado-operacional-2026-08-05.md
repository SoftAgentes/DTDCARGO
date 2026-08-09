# Estado operacional — comercial y contable · 2026-08-05

> Auditoría medida contra **producción** (`xpfuzqombmjmxvprjgmi`), no contra el repo.
> Todas las cifras son consultas agregadas read-only del 2026-08-05.
> Worktree: `DTD-worktrees/auditoria-estado-20260805` · rama `claude/auditoria-estado-20260805`.

---

## 0 · La respuesta corta

**No se está perdiendo data de clientes: se está perdiendo el CONTACTO con ellos.**

El registro guarda bien —432 clientes, 54 por auto-registro, el último hoy—. Lo que
falla es todo lo que pasa *después* del insert, y falla **en silencio**:

| Qué | Evidencia |
|---|---|
| 5 clientes nunca recibieron ni un correo | DTD-1008/1009/1010/1011 (altas del 5 y 7-jun) → 0 entregados, 1 atascado c/u. DTD-A110 → 1 rebotado, 0 entregados |
| 0 de 432 clientes vinculados a Kommo | `clients.kommo_lead_id` es NULL en el 100% de la tabla |
| 84% de los clientes sin acceso al portal | 364 de 432 sin fila en `client_users` |
| 8 correos atascados en `queued` | el más viejo del 2026-05-29, el más nuevo del 2026-07-11 |

Nadie se enteró de ninguna de las cuatro cosas. Ese es el problema real, y es el
mismo problema en los cuatro casos (ver §3).

---

## 1 · ¿En qué porcentaje estamos?

Hay que separar dos cosas que se confunden todo el tiempo:

- **Construido** = el módulo existe, tiene código, tests y pasa el gate.
- **Atado** = está produciendo datos reales en producción.

### Comercial

| Pieza | Construido | Atado | Evidencia en prod |
|---|---|---|---|
| Captación web (registro) | ✅ 100% | ✅ **operando** | 54 altas self-service · última hoy 15:51 UTC |
| Espejo Kommo → ERP | ✅ 100% | ✅ **operando** | 3.043 leads · 3.059 contactos · webhook con tráfico constante |
| Vínculo cliente ↔ lead Kommo | ✅ 100% | ❌ **0%** | 0 de 432 con `kommo_lead_id` |
| Write-back ERP → Kommo | ✅ 100% | ❌ **0%** | `kommo_writeback_outbox` = 0 filas históricas |
| Cotizaciones en el ERP | ✅ 100% | 🟡 **bajo** | 15 cotizaciones · última 2026-07-21 (15 días) |
| Invitaciones al portal | ✅ 100% | ❌ **16%** | 68 de 432 con acceso |
| WhatsApp saliente | ❌ no existe | ❌ | trámite de Meta pendiente |

**Comercial: ~85% construido · ~40% atado.**

### Contable

| Pieza | Construido | Atado | Evidencia en prod |
|---|---|---|---|
| Plan de cuentas | ✅ | ✅ | 91 cuentas cargadas |
| Configuración contable | ✅ | ❌ **0%** | `accounting_settings` = **0 filas** (ni un tenant configurado) |
| Asientos (libro diario) | ✅ | ❌ **0%** | `journal_entries` = 0 · `journal_lines` = 0 |
| Facturación | ✅ | 🟡 **parado** | 6 facturas · última 2026-06-03 (2 meses) |
| Cobranzas / reportes de pago | ✅ | ❌ **0%** | `payment_reports` = 0 · `payment_receipts` = 0 |
| Pagos a proveedores | ✅ | ❌ **0%** | `supplier_payments` = 0 |

**Contable: ~90% construido · ~5% atado.**

> El motor contable está entero y nunca ha registrado un solo asiento. No es que
> tenga bugs: es que no se ha encendido. `accounting_settings` vacío es el primer
> candado — sin esa fila no hay fecha de cierre ni configuración de tenant.

### Operación (contexto)

`shipments` = 19, el último del **2026-06-03**. Dos meses sin registrar un embarque
en el ERP. Esto explica por qué contabilidad está en cero: no hay operación cargada
de la cual derivar asientos.

---

## 2 · Bugs del checklist — verificados uno por uno

| # | Bug | Veredicto | Detalle |
|---|---|---|---|
| B1 | El push borra la suscripción del operario por un fallo de red | 🔴 **CONFIRMADO** | `lib/studio/notify/send-operario-push.ts:76-78` manda a `deadIds` tras 3 fallos transitorios; la línea 92 borra. **Impacto hoy: bajo** — `outbox_push_events` tiene 0 filas históricas, la cola nunca se ha usado en producción |
| B2 | Un aviso que rebotó se le muestra al cliente como "Enviado" | 🟡 **PARCIAL** | El webhook de Resend **sí** marca `bounced` (hay 4 filas). Lo que falta verificar es qué muestra la UI y, sobre todo, que **nadie recibe alerta** cuando pasa |
| B3 | El gate de migraciones mide el checkout, no `origin/main` | 🔴 **CONFIRMADO** | `scripts/check-migrations-applied.mjs` → `localMigrations()` usa `fs.readdirSync(MIGRATIONS_DIR)`. En un árbol atrasado los archivos nuevos no existen en disco → **verde por omisión** |

### Hallazgo nuevo, no estaba en el checklist

| # | Hallazgo | Veredicto |
|---|---|---|
| **B4** | **El push del registro a Kommo nunca ha escrito: está en dry-run** | 🔴 **CONFIRMADO — es un interruptor, no un bug** |

`kommo-push-client` está ACTIVE (v4) y **sí se invoca** (200 en las últimas 24 h),
pero `clients.kommo_lead_id` sigue NULL en los 432 registros. La causa no es un
fallo: la función **"nace apagado"** por diseño (SDD-0074, estilo SDD-0062). Corre
en **dry-run** —lee, arma el payload, loguea lo que haría y devuelve 200— salvo
que el secreto `KOMMO_PUSH_DRY_RUN` valga exactamente `"false"`.
En producción nunca se puso.

**Prueba en `sync_logs`:**

| entity | status | corridas | última |
|---|---|---|---|
| `push_client_dryrun` | ok | **18** | 2026-08-05 |
| `push_client` (real) | **error** | **1** | 2026-07-11 |

Consecuencia comercial directa: **un cliente se registra en la web y comercial no
se entera por el CRM.** Es el hueco #1 del embudo.

⚠️ **Y hay un 400 esperando detrás del interruptor.** El único intento real murió
con `Kommo 400 · código 205`. Encender el secreto sin resolver eso cambia "no
escribe" por "escribe un error por cada alta". Sospecha principal: el espejo
`kommo_custom_fields` está desactualizado — hoy solo resuelve `markbox`
("Shipping Mark - j102"); `rif` y `tier` no existen como campos y se omiten.

---

## 3 · ¿Por qué siempre hay bugs y daños?

No es mala suerte ni código descuidado. Son cuatro causas estructurales, con
evidencia medible:

### 3.1 · 151 rutas que fallan en silencio ⭐ la causa principal

`grep "best-effort"` → **151 ocurrencias en 80 archivos**. El patrón es siempre el
mismo: algo falla, se escribe un `console.error`, y la función devuelve OK.

`app/registro/actions.ts` solo tiene **7**: vínculo del estimado, referido,
`client_users`, correo de bienvenida, aviso al equipo, push a Kommo, throttle. Un
cliente puede registrarse "con éxito" habiendo fallado los siete, y la pantalla le
dice que todo salió bien.

**Eso no es un bug: es el diseño.** Y es exactamente por qué los cuatro hallazgos
del §0 pudieron durar dos meses sin que nadie los viera. Un `console.error` en
Vercel que nadie lee no es observabilidad.

> **La regla que falta:** todo lo que sea best-effort tiene que dejar rastro
> consultable (outbox con `status` + reintentos) o disparar alerta. Hoy hay 5 colas
> outbox construidas y ninguna cubre estos siete pasos.

### 3.2 · El gate mide el árbol local, no lo que está en `main`

Confirmado en B3. Un worktree atrasado da verde por omisión. Con 33 worktrees
activos, "atrasado" es el estado normal.

### 3.3 · Numeración — ⚠️ corregido: esto NO es una causa

En la primera pasada conté "10 números de migración duplicados" y lo di como
causa raíz. **Estaba equivocado, en las dos mitades:**

- **3 no eran duplicados.** `0020/0020b`, `0124/0124b`, `0261/0261b` son la
  convención `NNNNb` para un fix post-aplicación. Mi detección (`cut -c1-4`) no
  la distinguía.
- **Las 7 reales ya están gobernadas.** `scripts/check-numbering.mjs` las tiene
  en `CHOQUES_HISTORICOS` con nombre y motivo, incluida la del 2026-08-03 en que
  dos ventanas aplicaron su `0342` con 4 h de diferencia. Ambas están en el
  ledger, así que **ninguna se renumera** — que es la regla correcta.

El gate de numeración funciona. Lo dejo escrito porque el error es instructivo:
**un conteo sin mirar el contenido produce una causa raíz falsa**, y una causa
raíz falsa cuesta más que no tener ninguna.

Las causas reales son 3.1, 3.2 y 3.4.

### 3.4 · Se construye más rápido de lo que se adopta

El ERP tiene 57 módulos registrados. La contabilidad tiene 0 asientos, cobranzas 0
filas, pagos a proveedores 0 filas, la cola de push 0 eventos. **Un módulo que
nunca se usa no revela sus bugs hasta el día que alguien lo usa** — y ese día
parece "se rompió todo de golpe", cuando en realidad nunca funcionó.

---

## 4 · Checklist priorizado

### P0 · Sangrado activo — data y contacto de clientes

- [ ] ⭐ **Reenviar los 8 correos atascados y contactar a los 5 clientes incomunicados.**
      DTD-1008, DTD-1009, DTD-1010, DTD-1011 (nunca recibieron su Shipping Mark,
      altas del 5 y 7-jun) · DTD-A110 (rebotó). Acción manual + revisar por qué
      quedaron en `queued` desde mayo.
- [ ] ⭐ **Alerta de correo no entregado.** Hoy `bounced`/`queued` no le avisa a
      nadie. Sin esto, el punto anterior se repite el mes que viene.
- [ ] ⭐ **Encender el push a Kommo (B4).** No hay que arreglar código: hay que
      poner `KOMMO_PUSH_DRY_RUN="false"` en la Edge Function. ⚠️ Antes, resolver
      el `400 · código 205` del único intento real, o cada alta escribirá un
      error en vez de un lead.
- [ ] **Poner los 7 pasos best-effort del registro en outbox con `status`.** Es la
      cura de raíz del §3.1 aplicada al flujo que más duele.

### P1 · Bugs confirmados

- [ ] **B3** — que `check-migrations-applied.mjs` lea `git ls-tree origin/main` en
      vez de `fs.readdirSync`. Barato y desbloquea confiar en el gate.
- [ ] **B1** — `send-operario-push.ts:76`: solo 410/404 debe matar una suscripción.
- [ ] **B2** — verificar qué ve el cliente cuando un aviso rebota; el dato ya está
      en `mail_logs.metadata`.
- [ ] **Numeración** — resolver los 10 duplicados y revisar por qué el paso
      `numbering` del gate no los atrapó.

### P2 · Comercial atado

- [ ] **Invitaciones al portal** — 364 clientes sin acceso (84%). Necesita 3
      migraciones bajo runbook.
- [ ] **WhatsApp saliente** — habilitador del 60% del impacto. Trámite de Meta,
      semanas, y es tuyo. De él cuelgan las recomendaciones #2, #6 y #7.
- [ ] **Lead de calculadora en <5 min** — requiere persistir el lead primero.
- [ ] **Tracking del courier chino** — cuenta en 17TRACK/Kuaidi100 + migración.
- [ ] **Recuperación Kommo** — ⚠️ requiere decisión tuya por escrito: revierte el
      punto 3 de la spec 0157, que eligió no automatizar el envío.

### P3 · Contable atado

- [ ] ⭐ **Crear la fila de `accounting_settings`.** Es el primer candado; sin ella
      no hay configuración ni fecha de cierre.
- [ ] **Decidir si el ERP lleva la contabilidad o solo la refleja.** Con 0 asientos
      y QBO en el mapa, esto no está resuelto y bloquea todo lo demás.
- [ ] **Reactivar facturación** — última factura del 2026-06-03.
- [ ] **Cargar la operación** — 19 embarques, el último del 3-jun. Sin operación no
      hay nada que contabilizar.

### P4 · Torre de control y n8n (bloque A del checklist original)

- [ ] Bot de Telegram propio del vigía (@BotFather → `/newbot`) — ⚠️ **NO** el
      `TELEGRAM_BOT_TOKEN` de producción: ese habla con clientes y un Telegram
      Trigger le haría `setWebhook` y tumbaría `app/api/telegram/webhook`.
- [ ] Credencial Telegram en n8n con ese token.
- [ ] Chat ID en los dos workflows (reemplazar `PON_AQUI_TU_CHAT_ID`).
- [ ] Credencial Header Auth → `Bearer <DEBUG_HEALTH_SECRET>`, secreto dedicado y
      rotable, distinto del que usa el Studio.
- [ ] Credencial Header Auth → `Bearer <token GitHub>`, fine-grained solo lectura
      (`Contents: Read`) sobre `hailuwaycom-sketch/DTDCARGO`. ⛔ Nunca un token de
      Vercel.
- [ ] ⚠️ SDD-0247 desplegado **antes** de activar la torre — si no, el health
      responde sin `?cheap=1` y se come la cuota de SeaRates igual.
- [ ] `estado-colas` — bloqueado: `outbox_push_events` no tiene columna de status.
      Arreglar la representación primero (ver P0, es el mismo arreglo).
- [ ] `migrations-check` — va después de B3.

### P5 · Higiene con fecha

- [ ] 🔴 **`doortudoor.com` expira el 2026-10-31 — quedan 87 días.** La renovación
      es tuya. El 301 hacia dtdcargo.com no se puede perder (regla SEO dura).
- [ ] Rotar la API key de n8n (quedó visible en una captura).
- [ ] Borrar el MCP `n8n` viejo: `claude mcp remove --scope user n8n`.

---

## 5 · Lo que NO revisé

Para que quede explícito y no se lea como cobertura total:

- **B2 en la UI** — confirmé el dato en la DB, no la pantalla que ve el cliente.
- **El cuerpo de la respuesta de `kommo-push-client`** — sé que devuelve 200 y que
  el vínculo no queda; no abrí la función para saber cuál de las dos cosas falla.
- **Los 54 registros self-service uno por uno** — trabajé con agregados, sin PII.
- **Si las 342 migraciones del repo están todas en prod** — el gate que mide eso es
  justamente el que tiene el bug B3, así que su verde no vale.
