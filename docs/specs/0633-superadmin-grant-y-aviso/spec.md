---
sdd: "0633"
title: "Superadmin: devolver el EXECUTE de is_platform_admin() y avisar la denegación"
status: in-progress
author: "Claude (Worker 10.5)"
created: 2026-11-15
updated: 2026-11-15
supersedes: null
superseded_by: null
related: ["0250", "0118", "0586", "0622"]
confidencialidad: interno
---

# SDD-0633 — Superadmin: devolver el EXECUTE de is_platform_admin() y avisar la denegación

> El superadministrador no puede encender `chatwoot_portal` (puerta 5 de la
> SDD-0586): `is_platform_admin()` da 403 para la sesión y el Studio lo trata como
> «no eres superadministrador». Además, el interruptor no decía nada. Esta SDD
> devuelve el permiso con una migración nueva y hace que la denegación se vea.

## 1. Contexto

- **Medido por el DG en producción el 2026-11-15**, solo en el catálogo y en el
  log del api-gw, sin filas:
  - `POST /rest/v1/rpc/is_platform_admin` da 403. Es la única RPC con 403 en 7 días.
  - `proacl` vale `{postgres=X/postgres, service_role=X/postgres}`.
  - `has_function_privilege('authenticated', …, 'EXECUTE')` da f.
- **Por qué no quedó el grant (leído en el repo):**
  - `0058:66` lo dio y `0209:49` lo repitió.
  - `0211:27` lo revocó, con la premisa de que solo lo llamaban DEFINER del
    servidor. `0248:25` lo dejó fuera de su sweep-back por esa misma premisa.
  - Los grants de `0273:90`, `0276:74`, `0282:119`, `0285:99`, `0287:3594` y
    `0288:3694` están **dentro de literales dollar-quoted** que esas migraciones
    escriben en `supabase_migrations.schema_migrations.statements` (SDD-0118). Son
    texto del ledger, no SQL que se ejecute. Por eso esas migraciones están en el
    ledger y el grant no está. El detalle de cada literal está en el handoff.
  - La prueba de la 0273 da verde porque repasa solo el texto de la 0058, sin el
    revoke de la 0211. Los fixtures de 0538 a 0540 también lo dan por concedido.
- **La premisa de la 0211 era cierta cuando se escribió** (2026-07-03): ningún
  caller con la sesión usaba la función. El defecto vino después:
  - la 0355 empezó a usarla con la sesión en la policy
    `feature_flags_platform_admin_update` (0355:137);
  - la 0356 la usa en seis policies de authenticated (:47, :62, :78, :97, :112 y
    :132), sobre `legal_docs` (insert, update y delete), `renditions` (insert y
    update) y `rendition_receipts` (insert);
  - `lib/studio/platform-admin.ts` (`isPlatformAdmin`) la llama con la sesión, y la
    usan `platformAdminDenial` y el segundo candado de `rbac-guard.ts` para los
    `SUPERADMIN_ONLY_MODULES`.

  Ninguna de las tres devolvió el grant. Como falla cerrada, el superadministrador
  queda tratado como uno más.
- **Lo que abre el grant, además de los flags:** con la 0542, el superadministrador
  que además sea admin del tenant puede escribir en `legal_docs`, `renditions` y
  `rendition_receipts` por esas seis policies de la 0356. Es lo que la 0356 quería y
  hoy no se cumple. Entra en el smoke posterior a la aplicación (§6).
- **El bloqueo efectivo de los feature flags es `platformAdminDenial`**, en la
  server action. La escritura va por `audit_d1_execute` (0289:632-650), que es
  DEFINER de postgres y escribe como dueño, así que la policy de la 0355 no la
  alcanza (ver §5).
- **La cabecera de la 0542 (:7-9) quedó inexacta** en lo que ve el superadmin sin la
  migración. Dice «no eres superadministrador», pero con esta PR el aviso es «No
  pudimos comprobar si eres superadministrador…», porque la RPC da 403 (R3). No se
  corrige en el archivo: su md5 (`e6f1c9b137ba7eda3e7ca79e0b144da7`) es el que se
  aplica.
- **Los DEFINER que la llaman por dentro corren como postgres** y no dependen del
  grant: `studio_set_user_disabled` y `studio_change_user_role` (0355) y
  `studio_grant_user_module` (0538).
- **El silencio del interruptor:**
  - `toggleFeatureFlagAction` devolvía `{ error }` sin `flagKey` en la denegación y
    en el catch.
  - `FeatureFlagsClient` solo pintaba el error si `state.flagKey === flagKey`.
  - Sam: «tiene que salir un aviso o algo, tampoco se debe dejar así. Debe salir un
    aviso cuando te diga que no eres admin».

## 2. Contrato

- **R1 · La migración 0542** (migrate-first) hace:
  - `revoke execute … from public, anon`;
  - `grant execute … to authenticated, service_role`.

  Sus controles:
  - **Preflight:** la función existe, es DEFINER de postgres, es SQL que devuelve
    boolean, tiene `search_path` fijo (`public` o vacío) y su cuerpo es el de la
    0058 sin contar espacios. Así no se le abre a authenticated un cuerpo distinto.
  - **Postflight:** `has_function_privilege` da t para authenticated y service_role
    y f para anon, y PUBLIC no tiene EXECUTE en el ACL.
  - Es idempotente.
- **R2 · El aviso de los feature flags:**
  - Todo error de `toggleFeatureFlagAction` posterior a validar la clave lleva `flagKey`.
  - La tarjeta pulsada pinta su error siempre, como `role="alert"`. Cada tarjeta
    tiene su propio `useActionState`.
- **R3 · No acusar sin respuesta:**
  - `platformAdminCheck` distingue «sí», «no» y «error».
  - «No eres superadministrador…» sale solo si la base contestó que no.
  - Si la RPC falló, como el 403 de hoy, el aviso dice que no se pudo comprobar.
    Las dos respuestas niegan.
- **R4 · Suspender o reactivar a otro admin:**
  - **El problema:** la base lo niega recién en la confirmación, después del ban en
    Auth, y lo compensa. El aviso era «Auth cambió, pero la confirmación falló…».
  - **La pista:** el formulario manda `target_role`.
  - **El aviso previo:** si el destino es admin, no es uno mismo y la base dice que
    no eres superadmin, la acción avisa antes y no toca Auth.
  - **La pista no es el freno:** si miente, el flujo es el de siempre y la base
    sigue frenando. Por eso, si no se pudo preguntar («error», como el 403 de antes
    de la 0542), la acción no corta y decide la base: `studio_set_user_disabled` es
    DEFINER (vía `audit_d1_auth_transition`, 0289:1144) y no depende del grant. Así
    el superadmin sigue pudiendo suspender y reactivar admins aunque la 0542 no esté.
- **R5 · Cambiar el rol** ya traducía el `permission_denied` a «… lo hace el
  superadministrador» (`usuarios/actions.ts`, `mensajeDeError`) y el drawer lo
  muestra. No cambia.
- **R6 · La deriva no se repite.** Una prueba falla si una migración posterior a la
  0542 revoca el EXECUTE de authenticated sobre la función, o el de todas las
  funciones de `public`.

## 3. Allowlist exacta

- `docs/specs/0633-superadmin-grant-y-aviso/spec.md`
- `docs/specs/README.md` (índice generado)
- `.agents/handoffs/0633-superadmin-grant-y-aviso.md`
- `supabase/migrations/0542_is_platform_admin_execute_authenticated.sql`
- `supabase/tests/0542_is_platform_admin_execute_authenticated.test.sql`
- `supabase/migrations-baseline.json` (espera de la 0542)
- `supabase/pending-migration-symbol-declarations.json` (líneas de la 0538 en `usuarios/actions.ts`, corridas por este cambio)
- `lib/studio/__tests__/is-platform-admin-grant.migration.test.ts`
- `lib/studio/platform-admin.ts`
- `app/studio/(app)/admin/feature-flags/actions.ts`
- `app/studio/(app)/admin/feature-flags/_components/FeatureFlagsClient.tsx`
- `app/studio/(app)/admin/feature-flags/__tests__/aviso-superadmin.test.tsx`
- `app/studio/(app)/usuarios/actions.ts`
- `app/studio/(app)/usuarios/_components/UserDetailDrawer.tsx`
- `app/studio/(app)/usuarios/__tests__/suspender-admin-superadmin.test.ts`

## 4. Criterios de aceptación

- **CA1** El contrato de la 0542 corre en PGlite y en `sql-tests` (Postgres 17) y
  prueba cinco cosas:
  - (0) antes de la 0542, authenticated no la ejecuta y el UPDATE del superadmin cae;
  - (a) authenticated la ejecuta y da false si no es superadmin;
  - (b) un superadmin sintético da true;
  - (c) el UPDATE de `feature_flags` pasa para el superadmin y no para un admin del
    tenant;
  - (d) anon no la ejecuta y PUBLIC no tiene EXECUTE.

  Además, (e) la segunda aplicación no cambia nada.
- **CA2** El control rojo y los mutantes caen con el mensaje que los nombra:
  - **El control:** sin la 0542.
  - **Los mutantes del grant:** sin el grant, con postflight y sin él; y con el
    grant también a anon.
  - **El mutante del revoke:** sin el revoke explícito, con PUBLIC por defecto.
  - **Los mutantes del preflight:** que no sea DEFINER, que cambie el cuerpo o que
    no tenga `search_path`.
- **CA3** Las pruebas de acción y de UI cubren la denegación, la RPC que falla, el
  catch y el éxito, y que el error sin `flagKey` se vea en la tarjeta pulsada y solo
  en ella.
- **CA4** Suspender o reactivar a otro admin sin ser superadmin avisa y no llama a
  Auth. El superadmin, otro rol, uno mismo o una comprobación que falla siguen el flujo.
- **CA5** Las comprobaciones registradas en el handoff. `pnpm verify` no se corre en
  la PC por orden del DG (memoria): el portón es el CI de GitHub más la revisión
  independiente.

## 5. Fuera de alcance

- **Aplicar la 0542 en producción.** La aplica el DG con OK nominal de Sam y el runbook.
- **El hueco de `audit_d1_execute` (0289).** Es DEFINER de postgres y está
  concedida a authenticated. Su rama `feature_flag.toggle` solo exige admin del
  tenant (`audit_d1_admin_tenant`) y escribe como dueño, así que la policy de la
  0355 no la alcanza. Detalle en el handoff, «FUERA DE ALCANCE DETECTADO».
- **La PR de docs del rolsuper y las observaciones de la #567.**
- **Un contrato que mida el ACL final de todas las RPC tras el replay completo.**

## 6. Aplicación en producción (registro del runbook §6.3)

Pendiente: la 0542 no está aplicada. El DG la registra aquí con el OK literal de
Sam, la lectura previa y el ledger.

**Smoke posterior a la aplicación** (lo nombra el DG al pedir el OK):
1. Superadmin en `/studio/admin/feature-flags`: el interruptor de `chatwoot_portal`
   cambia, y un admin del tenant que no es superadmin ve «No eres superadministrador…».
2. Superadmin en los `SUPERADMIN_ONLY_MODULES` (financiero-china, legal, no-olvidar
   y renditions): la pantalla abre y no redirige a `/studio/dashboard?denied=…`.
3. Superadmin que además es admin del tenant: puede crear o editar en `legal_docs`,
   `renditions` y `rendition_receipts` (policies de la 0356). Un admin que no es
   superadmin, no.
4. Catálogo: `has_function_privilege` de authenticated = t, de anon = f.
