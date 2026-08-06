# Pendientes · corte 2026-08-06

> Foto del estado real, no del deseado. Reemplaza como "qué falta" al
> [checklist maestro](checklist-maestro-2026-08-05.md), que queda como bitácora
> de lo ya cerrado.
>
> Worktree de esta ventana: `auditoria-estado-20260805` — limpio y todo en `main`.

---

## Mapa de colisiones · quién está tocando qué

Medido ahora. **Nada de lo que sigue en la sección A toca estos archivos.**

| Ventana | Archivos | Riesgo para mí |
|---|---|---|
| `IA3` (`feat/crm-agentes-por-etapa`) · 8 comm. | `docs/marketing/**`, `docs/runbooks/kommo-*` | ninguno — no los toco |
| `crm-mcp-connection-5a29d2` · 3 comm. + 2 sin commit | docs CRM + **`0345_merge_clients_conserva_kommo_contact.sql`** + **`0341_client_merge_duplicados.test.sql`** | ⚠️ **mismo dominio** que mi 0349. Archivos distintos (yo toco `client_duplicate_candidates`, ellos `merge_clients`), pero hay que mergear con cuidado |
| `affectionate-nobel-9d9ab7` · 4 sin commit | `app/portal/layout.tsx`, `public/portal/`, `scripts/generate-portal-icons.mjs` | ninguno — no toco el portal |
| `radiografia-erp-20260802` · **32 comm.** | SDD-0239/0240/0241 | ninguno — sus migraciones ya las rescaté |
| `governance-final-100` (20) · `governance-roadmap-batch` (19) · `review-no-olvidar` (23) | gobernanza / no-olvidar | ninguno |

**~123 commits sin pushear repartidos en 16 ramas.** No es mío para resolver, pero
es el riesgo de fondo: cuanto más viven fuera de `main`, más caro el merge.

---

## A · Lo que puedo hacer yo, sin chocar con nadie

Ordenado por daño que evita, no por facilidad.

- [ ] ⭐ **Outbox para los pasos best-effort del registro.** Es la cura de raíz:
      `app/registro/actions.ts` tiene **7** pasos que fallan escribiendo un
      `console.error` que nadie lee. Ya se rompieron dos en producción —el correo
      de bienvenida y el `client_users` de DTD-9017— y los dos estuvieron
      semanas invisibles.
      Diseño **aditivo**: los pasos siguen corriendo en línea y además se encola
      un pendiente que un drain reintenta. Así, si el código sale antes que la
      migración, se comporta igual que hoy en vez de romper el alta.
      ⚠️ Necesita migración → la escribo y **espera que la nombres**.
- [ ] **`estado-colas` de la torre de control.** Bloqueado porque
      `outbox_push_events` **no tiene columna de status**: un push que agota sus
      5 intentos queda con `sent_at` en null para siempre, y la regla alertaría
      cada 30 min, para siempre. Hay que arreglar la representación primero —
      mismo arreglo que el punto anterior. Necesita migración.
- [ ] **`migrations-check` de la torre.** Ya se puede: B3 y el chequeo inverso
      están cerrados, que era lo que faltaba.
- [ ] **Lead de calculadora en <5 min.** Requiere persistir el lead primero.
      Necesita migración.
- [ ] **B4b · el `400 · código 205` de Kommo.** Reproducirlo con `{dry_run:false}`
      sobre UN cliente para ver qué payload rechaza. Sospecha: el espejo
      `kommo_custom_fields` está desactualizado — hoy sólo resuelve `markbox`
      ("Shipping Mark - j102"); `rif` y `tier` no existen y se omiten.
      ⚠️ Escribe en Kommo, así que la prueba real necesita tu OK.

---

## B · Escrito y verificado · espera que lo nombres

- [ ] 🔴 **Migración `0349_duplicados_dentro_del_legado`.** Hace visibles los **6
      pares duplicados del legado** que hoy nadie ve. 76 contratos SQL en verde,
      validada con **dos** mutaciones. Declarada en `pendingBelowCutoff` para no
      dejar el gate rojo a las demás ventanas.
      **Aplicarla no fusiona a nadie** — sólo reemplaza el cuerpo de una función
      de lectura.

---

## C · Tuyo · nadie más lo puede hacer

### Con reloj corriendo

- [ ] 🔴 **`doortudoor.com` expira el 2026-10-31 — 86 días.** El 301 hacia
      dtdcargo.com no se puede perder.
- [ ] **WhatsApp saliente con Meta.** Habilitador del 60% del impacto; de él
      cuelgan otros 3 pendientes. Semanas de trámite.

### Se puede hacer YA, sin esperar nada

- [ ] ⭐ **Invitar 228 clientes al portal.** Studio › Administración. La
      maquinaria ya está viva; el bloqueo nunca fue software. Ahí mismo se
      resuelve **DTD-9017 · Alain de Cardenas**, que entró al portal y el sistema
      no supo quién era.
- [ ] **Contactar a los 4 del rescate de correo** — Johana Matheus
      (+58 412 2155899), ABDAL AKIL (424 6097153), Jose Diaz (+58 412 9819792)
      nunca recibieron nada; **Adrián Figueroa** (424 3745436) rebotó y hay que
      pedirle correo nuevo.
      Los 3 primeros ya se pueden reenviar solos desde **Studio › Mailing ›
      Logs** con el botón *Reenviar*.
- [ ] **Capturarle el correo a 27 clientes** que sólo tienen WhatsApp — el enlace
      de acceso se ata al correo, así que sin él no hay invitación posible.

### Decisiones que sólo tú puedes tomar

- [ ] 🔴 **¿El ERP lleva la contabilidad o sólo la refleja?** Bloquea todo el
      bloque contable: `journal_entries` = **0 asientos en toda la historia** y
      `accounting_settings` = **0 filas**. No tiene bugs; nunca se encendió.
- [ ] 🔴 **Qué hacer con 109 fichas incontactables** — del legado, sin correo ni
      WhatsApp. El sistema no las alcanza por ningún canal. O se completan a
      mano, o se retiran.
- [ ] **Encender el push a Kommo** — `KOMMO_PUSH_DRY_RUN="false"`. ⚠️ Después de
      B4b, o cada alta escribirá un error en vez de un lead.
- [ ] **Recuperación Kommo** — revierte el punto 3 de la spec 0157. Necesita
      decisión por escrito.
- [ ] **Confirmar cuáles de los 29 se retiran.**
- [ ] **Mandar el mensaje al gerente comercial.**

### Credenciales y accesos (no los toco por diseño)

- [ ] Bot de Telegram propio del vigía — @BotFather → `/newbot`. ⚠️ **NO** el
      `TELEGRAM_BOT_TOKEN` de producción: ese habla con clientes y un Telegram
      Trigger le haría `setWebhook` y tumbaría `app/api/telegram/webhook`.
- [ ] Credencial Telegram en n8n + **Chat ID** en los dos workflows.
- [ ] Header Auth → `Bearer <DEBUG_HEALTH_SECRET>`, dedicado y rotable.
- [ ] Header Auth → `Bearer <token GitHub>` fine-grained solo lectura
      (`Contents: Read`). ⛔ Nunca un token de Vercel.
- [ ] **Rotar la API key de n8n** — quedó visible en una captura.
- [ ] **Activar los dos workflows** por API. SDD-0247 ya está en `main`.
- [ ] Borrar el MCP `n8n` viejo: `claude mcp remove --scope user n8n`.

---

## D · De otras ventanas · no lo toco

- [ ] ⚠️ **El código y las specs de SDD-0239 / 0240 / 0241 siguen fuera de
      `main`** (`radiografia-erp-20260802`, 32 commits). Sus migraciones ya las
      rescaté, así que la DB y el repo concuerdan — pero la aplicación
      desplegada no usa esos cambios.
- [ ] **`0345_merge_clients_conserva_kommo_contact`** — sin aplicar, número
      libre, en `crm-mcp-connection-5a29d2`.
- [ ] **`0315_freight_carriers_tariffs`** (`sdd-0225-registro`) — ya vive en prod
      como `0330`; esa rama sólo está atrasada.
- [ ] **`0251-0253` no-olvidar** — dormidas a propósito.

---

## Lo que NO está pendiente aunque lo parezca

Para que nadie lo vuelva a levantar:

- **Numeración de migraciones** — el gate funciona. Los "10 duplicados" que
  reporté eran 3 falsos (convención `NNNNb`) y 7 ya gobernados en
  `CHOQUES_HISTORICOS`.
- **Invitaciones al portal** — no hacían falta 3 migraciones; la maquinaria ya
  existía. El bloqueo era el correo.
- **e2e inestable** — arreglado con `retries: 1` en local.
- **Los dos puntos ciegos del gate de migraciones** — cerrados.
