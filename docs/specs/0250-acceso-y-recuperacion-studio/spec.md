---
sdd: 0250
title: Acceso y recuperación de contraseña del Studio
status: in-progress
author: Claude (ventana roles y permisos 2026-08-06)
created: 2026-08-06
updated: 2026-08-06
supersedes: null
superseded_by: null
related: [0024, 0026, 0038, 0085, 0139]
confidencialidad: interna
---

# SDD-0250 · Acceso y recuperación de contraseña del Studio

## Problema

El Studio no tiene manera de devolverle el acceso a un usuario que no puede
entrar. Medido contra producción el 2026-08-06:

- **5 de 7 usuarios nunca han entrado.** Se crearon el 3 de julio con una
  contraseña puesta directamente (`invited_at` vacío en los 7, `encrypted_password`
  presente en todos). Nadie sabe cuál es esa clave.
- **No existe recuperación.** `app/studio/(auth)/` sólo tiene `login/`. El login
  abre un `mailto:` que dice *"Escríbele a Sam"*. Si alguien dispara un correo de
  recuperación desde Supabase, el enlace **llega pero no aterriza en ninguna
  pantalla** — no hay ruta que canjee el token.
- **Un admin no puede reponerle el acceso a nadie.** En Studio › Usuarios hay
  cambiar rol, cambiar almacén, desactivar y reactivar. No hay "restablecer
  contraseña" ni "reenviar acceso". La tabla de invitaciones tiene *Copiar enlace*
  y *Revocar*, pero **no** *Reenviar* — y para alguien que ya es miembro no hay
  invitación que reenviar: `inviteUserAction` lo rechaza a propósito
  (*"Ese email ya es miembro del equipo"*), porque una invitación sobre un auth
  user existente es un callejón sin salida.
- **La única vía viva es que el founder corra un `UPDATE` sobre `auth.users`.**
  Eso lo convierte en cuello de botella para todo el equipo y reparte claves por
  WhatsApp.

Consecuencia medida: el director (José Mendez, `sistemaqb@gmail.com`) tiene
usuario desde el 3-jul y no puede entrar.

### Lo que SÍ existe y no hay que rehacer

Cambiar la contraseña **propia estando adentro** ya funciona: menú de usuario del
topbar → "Cambiar contraseña" → `ProfileModal` tab `password` →
`supabase.auth.updateUser({ password })`, mínimo 12 caracteres
(`app/studio/_components/wiring/ProfileModal.tsx`, cableado en
`StudioTopbar.tsx`). Está desplegado desde el 31-jul.

Documentos previos (`docs/operaciones/prompt-roles-y-permisos.md` e
`instrucciones-gerente-2026-08-06.md`) afirman que esa pantalla no existe. La
afirmación salió de grepear un solo archivo (`usuarios/actions.ts`) y es falsa.
Esta spec la corrige.

## Alcance

**Entra:**

1. Ruta de reset que canjea el token de recuperación y permite fijar la clave.
2. Acción de admin **"Enviar acceso"** por fila en Studio › Usuarios, con
   fallback **"Copiar enlace"**.
3. Auditoría de esa acción por el carril D5 de efectos externos.
4. Plantilla de correo `studio_access_link`.
5. Que la columna Acciones de la tabla de miembros deje de perderse al hacer
   scroll horizontal.

**No entra (decisión pendiente del founder):** el `/studio/recuperar`
autoservicio y su enlace desde el login. Mientras no exista, el login sigue
apuntando a `mailto:` — pero el admin ya puede reponer el acceso sin SQL.

**No entra:** el nivel superadmin (trabajo aparte, mismo hilo).

## Diseño

### Por qué el carril D5 y no el D1

Las cuatro mutaciones de membership de `usuarios/actions.ts` van por
`executeD1Operation` → `audit_d1_*`, que despacha con un `case p_operation_type`
**en SQL** y ejecuta la escritura dentro de la propia función. Enviar un enlace
de acceso **no escribe nada en `public`**: genera un link contra Supabase Auth y
manda un correo. Es un efecto externo, no una mutación.

Para eso ya existe el carril **D5** (`lib/studio/audit/external-effect-adapter.ts`,
migración 0293): intento → claim → efecto → succeed/fail, con reconciliación si
la confirmación falla. Sus cuatro tipos actuales son `portal.*`. Agregamos
`studio.access_link`.

Ventaja concreta: la migración toca un `check` y una validación de función, en vez
del `case` de ~400 líneas del D1.

### Flujo

```
Admin en Studio › Usuarios
  └─ "Enviar acceso" (fila de un miembro)
       ├─ moduleEditDenial(supabase, "users")        ← gate de rol (admin only)
       ├─ beginD5ExternalEffect("studio.access_link") ← intento auditado
       ├─ admin.auth.admin.generateLink({ type: "recovery", email })
       │     redirectTo → {SITE_URL}/studio/reset/confirmar
       ├─ sendEmail(admin, tenant, { templateSlug: "studio_access_link", … })
       ├─ finishD5ExternalEffect(succeed | fail)
       └─ devuelve el link a la UI para "Copiar enlace"

Usuario abre el correo
  └─ GET /studio/reset/confirmar?token_hash=…&type=recovery
       ├─ supabase.auth.verifyOtp(...)               ← abre sesión de recuperación
       └─ redirect → /studio/reset
            └─ form: nueva clave (mín. 12) → supabase.auth.updateUser({ password })
                 └─ redirect → /studio
```

`generateLink` **no envía** el correo: devuelve el enlace. Lo mandamos nosotros
con `sendEmail` para que pase por las plantillas del tenant, `mail_logs` y
Resend — el mismo camino de la invitación. El correo nativo de Supabase queda
fuera (plantillas aparte y límites de envío bajos).

`/studio/reset/confirmar` es una ruta hermana de `/studio/reset` porque una
carpeta de App Router no admite `route.ts` y `page.tsx` a la vez.

### Seguridad

- **El gate real es `moduleEditDenial(supabase, "users")`**, que resuelve el rol
  server-side. `users` está en `ADMIN_ONLY_MODULES` con matriz `[]` → sólo admin.
  Se aplica al principio de la action, antes de tocar el admin client: una server
  action es invocable como endpoint desde cualquier ruta (SDD-0085 §Seguridad).
- **El link nunca vuelve al cliente si el gate falla** — el `return` de denegación
  ocurre antes de generarlo.
- **No se revelan claves.** `generateLink` produce un token de un solo uso con la
  expiración que Supabase Auth ya impone; el admin nunca ve ni fija la contraseña
  de otro. Quien la elige es el dueño de la cuenta.
- **Prueba por el lado negativo:** los tests verifican que un rol no-admin
  (`accounting`, que sí toca dinero) recibe denegación y que la action **no**
  llama a `generateLink` en ese caso.

### Contrato SQL

`audit_d5_external_operations.operation_type` tiene el valor permitido
duplicado en dos lugares (CHECK de tabla + validación dentro de
`audit_d5_external_intent`). La migración actualiza **los dos**; el test
contractual verifica ambos por separado, porque arreglar uno solo deja el bug
vivo por el otro lado.

## Migración

`0350_audit_d5_studio_access_link.sql` — **no se aplica desde esta rama.**
Declarada en `pendingBelowCutoff` de `supabase/migrations-baseline.json`. La
aplica el founder nombrándola (runbook `aplicar-migraciones-prod.md`).

Contenido:
1. `check` de `audit_d5_external_operations.operation_type` + `studio.access_link`.
2. `audit_d5_external_intent` recreada con el valor nuevo en su validación.
3. UPSERT idempotente de la plantilla `studio_access_link` por tenant.

El punto 3 va en la migración a propósito: la plantilla es una **fila de
producción**, no sólo código. Sembrarla sólo en `scripts/seed-mail-templates.ts`
dejaría el botón mandando un error (`template no encontrado`) hasta que alguien
corriera el seed contra prod. Va en los dos lados: la migración la pone en prod,
el seed mantiene la paridad local.

## Verificación

- `node scripts/verify.mjs` en verde (salida a archivo, no a `| tail` — el exit
  code del pipe no es el de verify).
- Contrato SQL con **mutación**: revertir el `check` y comprobar que el test se
  pone rojo; ídem revirtiendo sólo la función.
- Unit: la action deniega a no-admin y no genera link.
- Manual, tras aplicar la migración: enviar acceso a un usuario de prueba, abrir
  el correo, fijar clave, entrar.

## Pendiente tras esta spec

- Decisión del founder sobre el autoservicio desde el login (`/studio/recuperar`).
- Registrar `{SITE_URL}/studio/reset/confirmar` en Supabase → Authentication →
  URL Configuration → Redirect URLs. **Sin eso el enlace no redirige.** Lo hace
  el founder.
- Limpieza aparte: `position_label` vacío en los 7 miembros; el usuario de prueba
  `prueba4@dtdcargo.com` desactivado desde el 20-jul.
