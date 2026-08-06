# Pendientes · corte 2026-08-06 (rev. 2)

> **Mi worktree:** `auditoria-estado-20260805` · rama
> `claude/auditoria-estado-20260805` · **limpio, 0 commits sin pushear**.
> Aislado de las otras 18 ventanas con trabajo vivo.
>
> Cada pendiente lleva marcado si el terreno está **libre** u **ocupado**, medido
> archivo por archivo contra los otros worktrees.

---

## Mapa de terreno · medido ahora

| Zona | ¿Quién la toca? | Para mí |
|---|---|---|
| `app/registro/` | **nadie** | ✅ **libre** |
| `lib/studio/notify/` | **nadie** | ✅ **libre** |
| `app/calculadora/` | **nadie** | ✅ libre |
| `app/api/cron/` | `audit-hardening` (sólo `purge-throttle`) | ✅ libre en la práctica |
| `scripts/` | 3 ventanas, archivos distintos a los míos | ✅ libre en la práctica |
| `supabase/migrations/` | 8 ventanas, cada una con su número | ⚠️ ojo el **baseline** |
| `supabase/migrations-baseline.json` | **`review-no-olvidar`** y yo | 🔴 **conflicto probable** |
| `AGENTS.md` | `cronologia` · `radiografia-erp` | 🔴 ya pusheé; les toca mergear |
| `lib/calculadora.ts` | **`DTDCargo`** (árbol principal) | 🔴 **ocupado** |
| Dominio Kommo | `crm-mcp-connection` · `IA3` | 🔴 **ocupado** |

---

## A · Puedo trabajarlo YA, sin chocar con nadie

- [ ] ⭐ **Outbox para los pasos best-effort del registro.** ✅ `app/registro/`
      está libre. Es la cura de raíz: 7 pasos que fallan escribiendo un
      `console.error` que nadie lee, y **dos ya se rompieron en producción**
      (el correo de bienvenida y el `client_users` de DTD-9017).
      Diseño **aditivo**: los pasos siguen corriendo en línea y además se encola
      un pendiente que un drain reintenta. Si el código sale antes que la
      migración, se comporta igual que hoy en vez de romper el alta.
      ⚠️ Migración → la escribo, **no la aplico**.
- [ ] **`estado-colas` de la torre de control.** ✅ `lib/studio/notify/` libre.
      Bloqueado por diseño de datos: `outbox_push_events` **no tiene columna de
      status**, así que un push que agota sus 5 intentos queda con `sent_at` en
      null para siempre y la regla alertaría cada 30 min, para siempre.
      Mismo arreglo que el outbox de arriba. Migración.
- [ ] **`migrations-check` de la torre.** ✅ Mi archivo del gate está libre. Ya se
      puede: B3 y el chequeo inverso quedaron cerrados, que era lo que faltaba.

## B · Escrito y verificado · espera que lo nombres

- [ ] 🔴 **`0349_duplicados_dentro_del_legado`** — hace visibles los **6 pares
      duplicados del legado**. 76 contratos SQL en verde, validada con **dos**
      mutaciones. Declarada en `pendingBelowCutoff`.
      **Aplicarla no fusiona a nadie.**

## C · Bloqueado por otra ventana · NO lo toco

- [ ] ⛔ **Lead de calculadora en <5 min** — el árbol principal `DTDCargo` está
      trabajando `lib/calculadora.ts` y `__tests__/calculadora.test.ts`.
- [ ] ⛔ **B4b · el `400 · código 205` de Kommo** — `crm-mcp-connection` e `IA3`
      están en ese dominio. Además la prueba real **escribe en Kommo**, así que
      necesita tu OK igual.

---

## D · Tuyo · nadie más lo puede hacer

### Con reloj

- [ ] 🔴 **`doortudoor.com` vence el 2026-10-31 — 86 días.** El 301 a
      dtdcargo.com no se puede perder.
- [ ] **WhatsApp saliente con Meta** — habilita el 60% del impacto; cuelgan 3
      pendientes más.

### Se puede hacer YA

- [ ] ⭐ **Cambiarle el rol a José** (`sistemaqb@gmail.com`) de Comercial a
      **Admin** en Studio › Usuarios. **No lo invites** — ya tiene usuario desde
      el 3-jul y el sistema rechaza la invitación por diseño.
- [ ] 🔴 **Ponerle la contraseña a José** — sólo tú. El Studio **no tiene
      recuperación de clave ni pantalla para cambiarla**.
- [ ] ⭐ **Invitar 228 clientes al portal** — Studio › Administración. Ahí mismo
      se arregla **DTD-9017 · Alain de Cardenas**.
- [ ] **Reenviar 3 correos atascados** — Johana Matheus, ABDAL AKIL, Jose Diaz.
      Studio › Mailing › Logs, botón *Reenviar*.
- [ ] **Llamar a Adrián Figueroa** (424 3745436) — su correo **rebotó**; hay que
      pedirle uno nuevo. Reenviar al mismo no sirve y daña la reputación.
- [ ] **Capturarle el correo a 27 clientes** que sólo tienen WhatsApp.

### Decisiones que bloquean

- [ ] 🔴 **¿El ERP lleva la contabilidad o sólo la refleja?** Tiene parado el
      bloque entero: **0 asientos en toda la historia**, `accounting_settings`
      vacío.
- [ ] 🔴 **Qué hacer con 109 fichas incontactables** — sin correo ni WhatsApp.
- [ ] **Encender Kommo** (`KOMMO_PUSH_DRY_RUN="false"`) — después de B4b.
- [ ] **Recuperación Kommo** — revierte el punto 3 de la spec 0157.
- [ ] **Confirmar cuáles de los 29 se retiran** · **mensaje al gerente comercial**.

### Credenciales (no las toco por diseño)

- [ ] Bot de Telegram del vigía — ⚠️ **NO** el token de producción.
- [ ] Credencial Telegram + **Chat ID** en los dos workflows de n8n.
- [ ] Header Auth `<DEBUG_HEALTH_SECRET>` · Header Auth `<token GitHub>` solo
      lectura. ⛔ Nunca un token de Vercel.
- [ ] **Rotar la API key de n8n** — quedó visible en una captura.
- [ ] **Activar los dos workflows** · borrar el MCP `n8n` viejo.

---

## E · De otras ventanas · no lo toco

- [ ] ⚠️ **Código y specs de SDD-0239 / 0240 / 0241 fuera de `main`**
      (`radiografia-erp-20260802`, 32 commits). Sus migraciones ya las rescaté.
- [ ] ⚠️ **`review-no-olvidar` también edita `migrations-baseline.json`** — yo
      agregué la 0349 ahí. Conflicto probable cuando esa rama se mergee; se
      resuelve conservando **las dos** entradas.
- [ ] **`0345_merge_clients_conserva_kommo_contact`** — sin aplicar, en
      `crm-mcp-connection`.
- [ ] **~123 commits sin pushear en 16 ramas.** No es mío, pero cuanto más viven
      fuera de `main`, más caro el merge.

---

## F · Proyecto aparte · ya tiene su prompt

- [ ] **Superadmin / Admin / Contabilidad** — [prompt listo](../operaciones/prompt-roles-y-permisos.md).
      Hallazgo que ahorra trabajo allá: `platform_admins` **ya existe** con 1 fila
      y **cero lecturas** desde el código, y los 22 feature flags los toca hoy
      cualquier admin.

---

## Lo que NO está pendiente aunque lo parezca

- **Numeración de migraciones** — el gate funciona; mis "10 duplicados" eran 3
  falsos y 7 ya gobernados.
- **Invitaciones al portal** — no hacían falta migraciones; el bloqueo era el
  correo.
- **e2e inestable** — arreglado con `retries: 1` en local.
- **Los dos puntos ciegos del gate de migraciones** — cerrados.
