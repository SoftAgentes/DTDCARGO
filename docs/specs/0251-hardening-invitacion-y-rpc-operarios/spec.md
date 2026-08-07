---
sdd: "0251"
title: "Hardening: invitación nominal, RPC de operario con rol, y dos candados de borde"
status: in-progress
author: "Sam (founder) + Claude"
created: 2026-08-06
updated: 2026-08-06
supersedes: null
superseded_by: null
related: ["0024", "0028", "0042", "0085", "0139", "0250"]
confidencialidad: interno
---

> **Renumerada 0250 → 0251 el 2026-08-06.** Nació como 0250 porque `pnpm sdd:next`
> lo daba libre, pero otra ventana ya tenía tomado ese número sin pushear
> (SDD-0250 · "Acceso y recuperación del Studio") y llegó a `main` primero. Se
> movió la que NO estaba en `main`, que es la regla. Igual pasó con la migración:
> `0350` → `0352`, porque la 0350 de `main` ya está aplicada en producción y una
> migración aplicada nunca se renumera. **Los mensajes de los 5 commits previos
> dicen SDD-0250** — son historia inmutable; el rastro sano para `git log` es
> buscar por `0251-hardening-invitacion-y-rpc-operarios`.

# SDD-0251 — Hardening de acceso: invitación nominal + RPC de operario con rol

## 1. De dónde sale

El 2026-08-06 se reportó como urgente que "los usuarios con rol de cliente entran
al /studio". **Era falsa alarma**: quien lo reportó confundió el portal con el
Studio por el rediseño visual. La frontera está bien y se verificó capa por capa
(§5). Pero la revisión que disparó el susto sí encontró cosas, y esta spec las
cierra.

## 2. Qué se arregla

### a) La invitación al Studio era al portador, no nominal · migr `0352`

`studio_accept_invitation` validaba token, expiración, revocación y que no
aceptaras tu propia invitación — pero **nunca comparaba el correo de la
invitación con el del `auth.uid()` que la aceptaba**. Quien tuviera el token se
llevaba el rol, incluido `admin`.

Pesa más de lo que parece: este RPC es la **única vía de obtener una fila en
`user_tenants`** en todo el sistema (cero `INSERT` en TypeScript, verificado).
Es la puerta de entrada al ERP, y su llave viaja por correo.

**Fix:** el correo del actor debe coincidir con el de la invitación
(case-insensitive, con `trim`). El alta normal no cambia: `app/invitar/[token]/actions.ts`
crea la cuenta con `invitation.email` y con ese mismo correo inicia sesión antes
de llamar al RPC.

### b) Las RPC de operario validaban tenant, no rol · migr `0351`

`admin_create_operario`, `admin_reset_operario_pin`, `admin_set_operario_active`
y `admin_update_operario` sólo llamaban `assert_tenant_match()` — que valida QUE
seas del tenant, no QUIÉN eres dentro de él.

La matriz dice `operarios: ["operations"]` (`lib/studio/rbac.ts:132`) y la server
action sí tiene su `moduleEditDenial`. Pero **una RPC es alcanzable directo por
PostgREST** con el JWT de cualquier usuario del tenant, sin pasar por la action.
Resultado: marketing, support, accounting o commercial podían resetear el PIN de
un operario y entrar a `/m/cn` o `/m/ve` como él.

Es el patrón que ya cazó el auditor adversarial en SDD-0085, un nivel más abajo:
allá el hueco era gatear la **vista** y no la **action**; acá es gatear la
**action** y no la **RPC**.

**Fix:** helper `assert_studio_role(text[])` —hermano de `assert_tenant_match()`—
llamado **de primero** en las cuatro. De primero a propósito: así una sesión sin
permiso tampoco puede usar el `'Operario no encontrado'` como oráculo para
sondear ids ajenos.

### c) `getStudioAccess` dependía de la RLS para saber de quién es el rol

`lib/studio/rbac-guard.ts` leía `user_tenants` con `limit(1)` **sin filtrar por
`user_id`**. Hoy es inocuo —la policy en producción se auto-scopea
(`user_id = auth.uid()`, migr 0200, verificado contra la DB)— pero la migr 0040
llegó a abrir "ver miembros de tu tenant" y la 0041 la revirtió. Si algo así
vuelve, esa línea entrega el rol de un compañero cualquiera, y ese rol es el que
decide si pasás.

**Fix:** `.eq("user_id", user.id)` explícito y fail-closed sin sesión. Es el
follow-up que SDD-0085 ya dejó escrito.

### d) El login del Studio aceptaba credenciales de cliente

`signInWithPassword` sin chequear membresía: el cliente entraba, y recién el
layout lo rebotaba. Cosmético, pero **es exactamente lo que originó el reporte
de hoy**.

**Fix:** tras el sign-in se exige membresía activa. Cliente del portal → `/portal`
(su sesión es legítima, su casa es otra). Sin membresía ni portal → `signOut` +
mensaje.

## 3. Decisiones

- **Dos migraciones, no una.** Los hallazgos son independientes y con radios de
  daño distintos; el runbook manda aplicar **de a una**. `0352` invitación,
  `0351` operarios.
- **El candado de rol vive en la base, no en la action.** La action ya tenía su
  gate y no alcanzó — el control tiene que estar donde termina el salto.
- **`admin` pasa siempre**, como en toda la matriz. Los roles permitidos en
  operarios son `admin` y `operations`.
- **No se toca `moduleEditDenial` en las actions**: siguen siendo la primera
  línea (mensaje lindo en la UI); la RPC es ahora el backstop real.
- **No se ampliaron los grants.** `assert_studio_role` va a `authenticated` y
  `service_role`; nada nuevo para `anon`.

## 4. Qué NO entra

- Las ~70 RPC restantes que validan sólo tenant. Se detectaron pero no se
  auditaron una por una — ⚠️ el clasificador por regex da **falsos positivos**
  (marcó `studio_change_user_role` como sin validar rol, y sí valida: lee
  `user_tenants` directo en lugar de llamar `current_studio_role()`). Requiere
  pasada manual, es trabajo aparte.
- Superficie `/back`, login por PIN de `/m/cn` y `/m/ve`, y `npm audit`.

## 5. Verificado limpio en la revisión (no re-derivar)

- Frontera sesión Studio↔portal: 4 capas fail-closed y desplegadas — `proxy.ts:65`,
  `app/studio/(app)/layout.tsx:95`, `app/m/erp/page.tsx:94`, `rbac-guard.ts:113`.
- RLS de `user_tenants` en prod = `user_id = auth.uid() AND disabled_at IS NULL`.
- Advisors de Supabase: **0 ERROR**. Las 19 tablas `rls_enabled_no_policy` son
  todas de auditoría/throttle/log → deny-all es la postura correcta.
- Los 15 buckets de Storage son privados. Sin secretos versionados. Headers
  completos (CSP, X-Frame-Options DENY, nosniff, Referrer-Policy,
  Permissions-Policy, HSTS).
- Portal del cliente: las 11 server actions con `service_role` scopean por
  `get_portal_client_id()` / `get_portal_client_markbox()` con ownership real.
- `studio_invite_user` y `studio_change_user_role` sí exigen admin.

## 6. Verificación

- `supabase/tests/0352_invitacion_nominal.test.sql` — el legítimo entra con su
  rol y su region; una sesión ajena con el mismo token rebota **y no escribe**
  (ni membresía, ni invitación quemada); mayúsculas/espacios no dejan afuera al
  dueño; siguen vivos los candados viejos.
- `supabase/tests/0351_operario_rpc_exige_rol.test.sql` — admin/operations
  siguen trabajando; marketing y support rebotan y el hash no se mueve; sin
  oráculo de ids; un desactivado no pasa; el candado de tenant sigue vivo.
- `app/studio/(auth)/login/__tests__/actions.test.ts` — las 4 ramas del gate.
- `node scripts/verify.mjs` en verde + `pnpm build`.

## 7. Aplicación a producción

| Migración | Estado |
|---|---|
| `0351_operario_rpc_exige_rol` | ✅ **aplicada el 2026-08-06** — verificada contra el objeto: las 4 RPC tienen el candado, `authenticated` ejecuta, `anon` no |
| `0352_invitacion_nominal` | ⛔ **pendiente** — requiere OK del founder nombrándola |

Por el runbook `docs/runbooks/aplicar-migraciones-prod.md`: OK del founder
**nombrando la migración**, de a **UNA**, con `name` = basename exacto.

Sobre la `0352`: se midió antes de proponerla y hay **0 invitaciones en vuelo**
(5 en total, 2 aceptadas, ninguna pendiente), así que aplicarla hoy no puede
romper ningún alta a mitad de camino. El riesgo que quedaba —una invitación
emitida a un correo y aceptada desde otro— no tiene con qué materializarse.

⚠️ **Deriva conocida:** la `0351` ya corrió con el comentario `Fix 0351
(SDD-0250)` dentro del `comment on function`. El archivo del repo ahora dice
`SDD-0251` (por la renumeración de arriba); la base sigue diciendo `SDD-0250`.
Es texto de comentario, no comportamiento, y **no se re-aplica** para no
reescribir una migración ya corrida.
