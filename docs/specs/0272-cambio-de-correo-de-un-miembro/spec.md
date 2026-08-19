---
sdd: 0272
title: Un admin corrige el correo de un miembro, y el anterior deja de servir
status: in-progress
author: Claude (ventana 2026-08-19)
created: 2026-08-19
updated: 2026-08-19
supersedes: null
superseded_by: null
related: [0250, 0024, 0252]
confidencialidad: interna
---

# SDD-0272 · Un admin corrige el correo de un miembro, y el anterior deja de servir

## Problema

**El correo de un miembro del equipo no se puede cambiar desde el Studio. No es un
permiso mal puesto: es una función que no existe.**

Medido el 2026-08-19 sobre `app/studio/(app)/usuarios/`:

- `updateMemberProfileAction` escribe cuatro campos de `user_profiles`
  (`first_name`, `last_name`, `phone`, `position_label`). El correo no está.
- El correo vive en `auth.users`, y **no hay una sola llamada a
  `auth.admin.updateUserById({ email })` en todo el módulo**.
- La ficha (`UserDetailDrawer`) muestra el correo con el componente `Dato`, que
  es de sólo lectura.

Consecuencia real: `pasantedtd@gmail.com` quedó cargado por error para Alejandro
Parra, cuyo correo de trabajo es `pasantecontabilidaddtd@gmail.com`. El botón
"Enviar acceso" le manda el enlace al buzón equivocado, así que la persona no
puede entrar — `last_sign_in_at` sigue en `null` desde el 2026-07-03.

## Alcance

Lo que ESTA spec hace: **corregir la dirección de correo de una persona que
sigue siendo la misma persona.**

Lo que ESTA spec NO hace, a propósito: **la sucesión de un puesto** (se va
Alejandro, entra Pedro). Ver §Sucesión.

## Sucesión: por qué NO se resuelve reescribiendo el correo

El pedido original ("al cambiar el correo, que se vincule todo el historial y
los permisos de la posición al nuevo usuario") junta dos operaciones que el
sistema distingue, y tratarlas igual rompe la trazabilidad.

Todo el rastro del ERP se guarda contra el `user_id` (uuid), no contra el
correo: `append_audit_event(..., actor_user_id, ...)`, `created_by` de facturas,
embarques y tokens de acceso. El correo es un atributo de login, no la
identidad.

Si a la fila de Alejandro se le reescribe el correo por el de Pedro, **cada
factura, cada embarque y cada evento de auditoría que registró Alejandro pasa a
mostrarse como hecho por Pedro**, en silencio y hacia atrás. Eso contradice
AUD-01/AUD-02 y la trazabilidad que exige ISO 9001 §7.5, que es justo lo que el
carril de auditoría existe para sostener.

La sucesión correcta es: desactivar a quien se va (su historial queda a su
nombre) e invitar a quien llega (empieza su propio historial). Lo que se hereda
es **el rol y el alcance**, que ya son transferibles hoy — y con SDD-0252 la
matriz de permisos vive por rol, no por persona, así que la configuración del
puesto sobrevive al cambio de ocupante sin tocar identidades.

Si más adelante hace falta un gesto de "reemplazar a la persona en este puesto"
en un solo clic, es una spec propia: desactiva + invita + copia rol/alcance, con
dos `user_id` distintos y el historial de cada quien en su lugar.

## Decisión

Una acción nueva, `changeMemberEmailAction`, que hace **cuatro** cosas
atómicamente desde el punto de vista del usuario:

1. Cambia `auth.users.email` con `email_confirm: true` (queda usable de
   inmediato, sin que la persona tenga que confirmar desde un buzón al que
   quizá no llega).
2. **Revoca todos los enlaces de acceso vigentes** de esa persona
   (`studio_access_tokens.revoked_at`). Este es el "desactivar el anterior" que
   de verdad hace falta: un enlace ya enviado al buzón viejo sigue siendo válido
   hasta vencer, y quien tenga ese buzón podría fijar la contraseña y entrar.
3. **Revoca las invitaciones pendientes** dirigidas al correo anterior
   (`user_invitations.revoked_at`), por el mismo motivo.
4. Deja el rastro en el carril D5 (`studio.email_change`).

### Por qué D5 y no D1

Igual que `studio.access_link` (SDD-0250, migr 0350): la escritura ocurre en
Supabase Auth, no en `public`. El carril D1 ejecuta la mutación dentro de su
propia función SQL; acá no hay nada que escribir en `public` salvo el rastro.

### Lo que NO revoca, y por qué se dice en vez de prometerse

**Las sesiones ya abiertas siguen vivas.** Medido el 2026-08-19 contra
`@supabase/auth-js@2.106.1`: la única firma disponible es
`admin.signOut(jwt, scope)` — pide el **JWT de la persona**, que un admin no
tiene ni puede obtener. No existe un `signOut(userId)` en el cliente.

No se implementa un rodeo (banear y desbanear para tumbar la sesión) porque
dejaría a la persona baneada durante la ventana entre las dos llamadas, y si la
segunda falla queda afuera sin que nadie se entere.

El hueco es acotado y consciente: esta spec corrige el correo de **la misma
persona**, cuya sesión es legítimamente suya. El riesgo real que sí se cierra es
el del buzón anterior — enlaces de acceso e invitaciones que siguen sirviendo
para *fabricar* una sesión nueva. Si hiciera falta cortar sesiones de verdad, el
gesto que ya existe hoy y funciona es **Suspender acceso** (que sí banea, con su
saga de compensación en `executeAuthLifecycle`).

### Orden de las operaciones

El cambio de correo va **primero**. Si falla, no se revocó nada y la persona
sigue entrando con lo que tenía. Las dos revocaciones van después y son
best-effort con log: si fallan, el correo ya cambió (que es lo que el admin
pidió) y el rastro registra el fallo parcial. Al revés —revocar primero— dejaría
a la persona sin acceso y con el correo viejo si Auth rechaza el cambio.

## Reglas

- **Gate**: `moduleEditDenial(supabase, "users")` → `users` es admin-only
  (matriz `[]`). Va antes de tocar el admin client, porque una server action es
  invocable como endpoint desde cualquier ruta.
- **Tenant**: la persona objetivo tiene que ser miembro de MI tenant. El admin
  client no filtra por RLS — mismo criterio que `sendAccessLinkAction` y
  `updateMemberProfileAction`.
- **Colisión**: si el correo nuevo ya pertenece a otra cuenta de Auth, se
  rechaza con mensaje propio en vez de dejar salir el error crudo de Postgres.
- **Sin cambio**: si el correo nuevo (normalizado) es igual al actual, no se
  hace nada y no se revoca nada. Revocarle los enlaces a alguien por guardar el
  formulario sin cambios sería un corte de acceso gratis.
- **Normalización**: `trim().toLowerCase()`, igual que la invitación.
- **Auto-edición**: un admin puede corregir su propio correo, pero entonces se
  le cierra su propia sesión (paso 3). La UI lo advierte antes de guardar.

## Superficie tocada (allowlist exacta)

| Archivo | Qué |
|---|---|
| `supabase/migrations/0387_audit_d5_studio_email_change.sql` | `studio.email_change` en el CHECK y en `audit_d5_external_intent` |
| `supabase/tests/0387_audit_d5_studio_email_change.test.sql` | contrato SQL de los dos lugares |
| `lib/studio/audit/external-effect-adapter.ts` | el tipo nuevo en `D5ExternalOperationType` |
| `lib/studio/user-types.ts` | exportar `isValidEmail` |
| `app/studio/(app)/usuarios/actions.ts` | `changeMemberEmailAction` |
| `app/studio/(app)/usuarios/_components/UserDetailDrawer.tsx` | el correo pasa de dato fijo a campo con su propia confirmación |
| `app/studio/(app)/usuarios/__tests__/change-member-email.test.ts` | lado negativo + happy path |

## Verificación

- `node scripts/verify.mjs` en verde.
- Contrato SQL: `node scripts/run-sql-tests.mjs`.
- Prueba de fondo del test: que falle si se quita la revocación de tokens (no
  sólo que la acción devuelva `ok`).
