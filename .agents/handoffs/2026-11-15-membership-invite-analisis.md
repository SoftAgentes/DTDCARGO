# Análisis · `membership.invite`: invitar como admin sin ser superadministrador

- **Quién:** Worker 10.5 (E10), por encargo del Subdirector Chatwoot y a pedido del DG, el 2026-11-15.
- **Alcance:** **solo análisis.** Leí el código y el SQL del repo en `origin/main` `57f58f62b`. No ejecuté nada, no leí filas de producción y no abrí rama ni migración. Las afirmaciones salen de leer el código; ninguna se midió en producción.
- **Para qué:** el DG se lo lleva a Sam al despertar.

## El hueco

La 0355 subió dos llaves al superadministrador: tocar a otro admin (suspenderlo o cambiarle el rol) y los feature flags. Para el cambio de rol cerró los dos sentidos, «degradar a un admin existente Y ascender a alguien a admin», porque «sin la segunda mitad, cualquier admin podría fabricarse aliados» (0355:247-252). **La invitación quedó fuera**, y por ahí se fabrica el mismo aliado.

- **`studio_invite_user`**, en su última definición (`0203_fix_studio_invite_user_region.sql:38-130`):
  - acepta `p_role = 'admin'` (:65);
  - solo exige que quien invita sea admin activo del tenant (:76-81);
  - no llama nunca a `is_platform_admin()`.
- **`studio_accept_invitation`** (última definición en `0352_invitacion_nominal.sql:23-97`) inserta o actualiza `user_tenants` con el rol de la invitación (:85-90).
  - Comprueba que el correo de la sesión sea el de la invitación (:67-72) y que quien acepta no sea quien invitó (:61).
  - **No comprueba el rol.**

## Impacto

- **Quién escala:** cualquier admin activo del tenant que no es superadmin.
- **A quién:** a cualquier persona cuyo correo controle, incluida una cuenta suya, que pasa a admin del tenant.
- **Qué gana:**
  - suma admins sin pasar por el superadmin, que es lo que la 0355 quiso impedir para el cambio de rol;
  - esos admins nuevos tienen todo lo de admin del tenant: usuarios, accesos, integraciones, banca y demás ramas de `audit_d1_execute` que la 0355 dejó para cualquier admin.
- **Lo que NO gana:** tocar a otro admin ni los flags, que siguen siendo del superadmin (0355, y la 0543 cuando se aplique). Los admins nuevos tampoco pueden.
- **Los caminos**, todos con la sesión normal del admin (claims `role = authenticated` y su `sub`):
  1. **La pantalla:** `inviteUserAction` (`app/studio/(app)/usuarios/actions.ts:105`).
     - Solo exige `moduleEditDenial(supabase, "users")` (:127) y un rol válido de `STUDIO_USER_ROLES`, que incluye `admin` (`lib/studio/user-types.ts:194`).
     - Llama a `audit_d1_execute` con `membership.invite` (:167-174).
  2. **PostgREST, con `audit_d1_execute`:** `rpc('audit_d1_execute', {p_operation_type: 'membership.invite', p_input: {email, role: 'admin'}})`. Es la rama `0289:240-258`: es DEFINER y llama a `studio_invite_user`.
  3. **PostgREST, con `studio_invite_user`:** `rpc('studio_invite_user', {p_email, p_role: 'admin'})`. Está concedida a authenticated (`0203:200`), así que ni siquiera deja rastro D1.
- **La reactivación por invitación, un caso condicionado:**
  - `studio_invite_user` solo rechaza a los miembros **activos** (:88-94).
  - `studio_accept_invitation` hace `disabled_at = null` y pone el rol de la invitación sobre la fila existente (`0352:85-90`).
  - Así, invitar el correo de un admin **suspendido** lo reactivaría como admin sin el superadmin, que exige la llave 2a (`studio_set_user_disabled`, 0355).
  - **Lo mitiga** que la suspensión banea en Auth (`executeAuthLifecycle`), así que el suspendido no puede iniciar sesión para aceptar. Solo funciona si el ban no quedó: `auth_retryable`, `reconciliation_required` o una suspensión hecha sin Auth.
  - **La guarda de la pantalla** contra miembros desactivados (`usuarios/actions.ts:129-164`) es *best-effort*. Mira solo los primeros 200 usuarios de Auth y, si falla, sigue (`console.error … skipped`). Los caminos 2 y 3 no la tienen.

## Opciones de arreglo

| Opción | Qué hace | Qué cubre | Costo y riesgo |
|---|---|---|---|
| **A. Disparador en `user_invitations`**, como la 0543 | BEFORE INSERT OR UPDATE. Con sesión, si `new.role = 'admin'`, exige `is_platform_admin()`, por claims igual que la 0543. Opcional: rechazar si el correo es de un miembro desactivado del tenant | Los 3 caminos, porque todos escriben `user_invitations` como dueño | **Bajo.** No reemplaza funciones, el patrón ya está probado en la 0543, y su ACL y su postflight se copian. **No cubre las invitaciones de admin ya pendientes**, creadas antes del arreglo |
| **B. Guarda en `studio_accept_invitation`** | Al aceptar con `v_inv.role = 'admin'`, exige que `v_inv.invited_by` esté en `platform_admins`. Rechaza reactivar una fila desactivada por esta vía y manda a «Reactivar» | El momento del efecto, también las invitaciones pendientes viejas | **Medio.** `create or replace` de una función de unas 75 líneas: preflight con md5 del cuerpo vivo y reafirmar su ACL, la lección de la 0542 |
| **C. Guarda en `studio_invite_user`** | Lo mismo que A, dentro de la función | Los 3 caminos | **Medio.** `create or replace` de unas 90 líneas con preflight de md5 del cuerpo vivo y ACL. No tiene ventaja sobre A |
| **D. Disparador en `user_tenants`** | Con sesión, bloquea toda transición a `role = 'admin'` o la reactivación de un admin sin superadmin | Todo camino, también futuros | **Alto.** Toca la tabla más sensible. Al aceptar, la sesión es la del invitado, que no es superadmin, así que habría que permitir «invitado por un superadmin» (`invited_by` en `platform_admins`). Interactúa con 0200, 0355 y el anti-lockout |
| **E. Policy RLS** | — | **Nada.** Los RPC son DEFINER y escriben como dueño, igual que el hueco de la 0543 | No sirve |
| **F. Solo la server action** | Que la pantalla no ofrezca «admin» si no eres superadmin, y un aviso claro | Solo el camino 1 | **Bajo**, pero insuficiente solo: los caminos 2 y 3 siguen abiertos. Como complemento de A sí suma, porque evita un 42501 sorpresa |

## Recomendación

1. **Primero lo decide Sam**, porque es política: ¿un admin del tenant puede invitar admins? La 0355 dejó la invitación fuera por omisión, pero su razón para el cambio de rol («fabricarse aliados») aplica igual. **Mi lectura:** sí debería ser llave del superadmin.
2. **Si Sam dice que sí:**
   - **A más F en una PR,** con el mismo patrón y pruebas que la 0543: claims del JWT, ENABLE ALWAYS, preflight y postflight de ACL, y mutantes.
   - **B en la misma migración o en la siguiente,** para cerrar las invitaciones pendientes viejas y la reactivación por invitación.
3. **Antes de aplicar:** un **conteo** en solo lectura de invitaciones pendientes con `role = 'admin'`, sin correos ni filas: `select count(*) … where role = 'admin' and accepted_at is null and revoked_at is null`. Necesita el OK de Sam, porque toca una tabla con datos de personas. Si hay alguna, Sam decide si se revoca.
4. **Aparte, de menor prioridad:** que la guarda de la pantalla contra miembros desactivados no dependa de `listUsers({ perPage: 200 })` y no falle abierta.

> Esto lo saqué leyendo el código: nada se ejecutó ni se midió en producción.
