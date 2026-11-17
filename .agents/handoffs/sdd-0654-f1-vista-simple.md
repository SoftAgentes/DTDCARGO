# Handoff — SDD-0654 fase 1: preferencia de vista y selector (interruptor apagado)

- **Owner / sesión:** Worker del DG (claim `local_0654`). Asignó: Director General.
- **Ruta:** `.claude/worktrees/0654-f1-vista-simple` · **Rama:** `claude/0654-f1-vista-simple` (desde `origin/main` d9439c42a)
- **Spec:** `docs/specs/0654-version-light-portal/spec.md` (`approved`), §5, §9 fase 1 y §10 AC-1 a AC-6.

## OBJETIVO ORIGINAL

Orden del DG (2026-11-17): fase 1 en worktree y rama nuevos, con la allowlist exacta de la spec. Interruptor
apagado por defecto (AC-1); la preferencia se escribe solo por las RPC SECURITY DEFINER de §5 y se lee aparte,
degradando a «pro» (AC-5); migración 0557 con preflight que aborta, timeouts, grants explícitos y su `.test.sql`,
EN ESPERA. Sin tema claro (fase 1b) y sin Faro. Pruebas unitarias, contrato SQL, `/ui-check` y handoff. PR no
draft, sin fusionar.

## COMPLETADO

- `supabase/migrations/0557_portal_vista_preferida.sql`:
  - columnas `client_users.portal_vista` (CHECK simple|pro) y `portal_guia_vista_at`. Las filas existentes quedan
    en `pro` sin UPDATE ni reescritura: se agrega con default `pro` y después el default pasa a `simple`. Así no
    corre ningún trigger y no se mueve `updated_at` (AC-2);
  - `portal_set_vista(text)` y `portal_marcar_guia_vista()`: SECURITY DEFINER, `search_path` vacío, EXECUTE solo
    `authenticated`, sin identificadores de entrada. Exigen vínculo activo de `auth.uid()` con cliente vivo del
    mismo tenant (42501 si no) y escriben solo su columna;
  - **grants explícitos de la tabla:** revoca INSERT, UPDATE, DELETE y TRUNCATE de `client_users` a public, anon y
    authenticated. Ver «Decisión para el DG»;
  - preflight que aborta si faltan roles o columnas, si las columnas o funciones ya existen, si hay policies de
    escritura o si hay triggers de UPDATE sin lista de columnas distintos de `client_users_touch`. Postflight con
    default, filas en `pro`, funciones, privilegios y policies. `lock_timeout` 5 s y `statement_timeout` 30 s.
- `supabase/tests/0557_portal_vista_preferida.test.sql`: AC-2, AC-3 y AC-4.
  - Antes de la 0557 da UPDATE y escritura por columna a anon y authenticated, para probar que la migración los
    REVOCA.
  - Detecta escrituras por cambio de `ctid`, no por `updated_at`, que es constante dentro de la transacción.
  - Casos: A, B en otro tenant, revocado, cliente borrado con vínculo activo, sin fila, sin `sub`, anon, valores
    inválidos, la segunda marca de la guía sin escritura y UPDATE directo rechazado.
- Espera registrada en `supabase/migrations-baseline.json › pendingBelowCutoff`. En
  `supabase/pending-migration-symbol-declarations.json` hay dos degradaciones declaradas: lectura y escritura.
  `migrations.lock.json` no cambia, porque una espera va sin sellar.
- `lib/portal/vista-preferida.ts`:
  - `isPortalVistaSimpleEnabled` (solo `"true"`);
  - `getMyPortalVista`: consulta propia por `auth_user_id` y `status = 'active'`; cualquier fallo devuelve
    `pro` y «guía ya vista»; loguea solo el código de error;
  - `setMyPortalVista` y `markMyPortalGuiaVista`.
- `app/portal/actions.ts`: `setPortalVistaAction` y `markPortalGuiaVistaAction`. Con el interruptor apagado no
  abren sesión ni llaman a la base.
- `PortalVistaSelector.tsx` (nuevo):
  - grupo «Vista del portal» con dos botones `aria-pressed` de 44 px, seleccionado en ink;
  - cambio optimista, `router.refresh()` y vuelta atrás con aviso visible si no pudo guardar.
- Cableado sin cambios con el interruptor apagado:
  - `layout.tsx` solo consulta con el interruptor encendido y pone `data-portal-vista` solo entonces;
  - `PortalShell` y `PortalTopbar` reciben `vista` opcional (null = sin selector).
- `.env.example`: `PORTAL_VISTA_SIMPLE=` vacío.
- Pruebas nuevas o ampliadas:
  - `lib/portal/__tests__/vista-preferida.test.ts`;
  - `app/portal/__tests__/vista-preferida-actions.test.ts`;
  - `app/portal/_components/PortalVistaSelector.test.tsx`;
  - `PortalShell.test.tsx`: AC-1, el selector y el contrato de fuente del layout y del principal.
- Comprobado que nada usa `client_users.updated_at` como señal de negocio (spec §5). El recordatorio a fríos usa
  `invited_at` y `last_email_invite_at`; las demás lecturas de `updated_at` son de envíos y cotizaciones.
- Comprobado que todos los escritores de `client_users` son SECURITY DEFINER o usan service_role:
  - las funciones de 0080, 0227, 0361, 0454, 0460 y 0552;
  - `app/api/cron/portal-cold-reminder/route.ts` y `app/registro/actions.ts`, con el cliente admin.

## Decisión para el DG

La spec dice que `client_users` «no tiene grant update». En el repo, 0080 solo hace `grant select` y nunca
revoca. En producción, el ACL predeterminado anterior a la 0263 pudo dar escritura a authenticated: no lo medí,
porque no leo producción. La RLS sin policies de escritura ya impide escribir filas. La 0557 revoca esas
escrituras para que AC-4 sea cierto en el catálogo y no solo en la RLS. Funcionalmente no cambia nada, porque
nadie escribe la tabla con la sesión. Si preferimos no tocar el ACL de la tabla, se borran el REVOKE y su bloque
del postflight, y el contrato pierde la parte de revocación.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO, 2 AMARILLO declarados |
| `node scripts/migrations-lock.mjs` | PASÓ: 538 selladas, 1 espera sin sellar (0557) |
| `node scripts/check-numbering.mjs` | PASÓ |
| `node scripts/check-feature-constants.mjs` | PASÓ |
| `/ui-check` | OK con ajustes menores (ver PR); el #1 es medir la barra a 375 px al encender |
| Vitest de los 4 archivos (turno del DG) | PASÓ: 4 archivos, 34 pruebas |
| `tsc --noEmit` (turno del DG) | PASÓ: exit 0 |
| Contrato `0557_portal_vista_preferida.test.sql` | NO EJECUTADO en local (Docker sin turno, decisión del DG): lo corre el job «Contratos SQL» del CI |
| `pnpm verify` | NO EJECUTADO: el portón es el CI de GitHub |

## COMMITS

Ver la PR.

## PR / BRANCH

`claude/0654-f1-vista-simple` → `main`. PR no draft. No fusionar. **La 0557 no se aplica en producción sin OK
nominal de Sam** para ese archivo y el runbook `docs/runbooks/aplicar-migraciones-prod.md`.

## PENDIENTES DE ESTA TAREA

- Leer el job «Contratos SQL» del CI: el contrato 0557 no corrió en local.
- Decisión del DG sobre el REVOKE de la tabla (arriba).
- Riesgo en producción: si las escrituras de authenticated las concedió otro rol (no `postgres`), el REVOKE de
  `postgres` no las quita. En ese caso el postflight aborta la migración entera, sin cambios. Se ve en el ensayo
  previo a aplicar.

## FUERA DE ALCANCE DETECTADO

- Fase 1b: tema claro por defecto y enmienda de BD-037 (PR aparte).
- Fase 2: inicio simple, guía (usa `markPortalGuiaVistaAction`), comparación y encendido del interruptor con OK de
  Sam. Antes de encender: medir la barra superior a 375 px con el selector (hallazgo #1 del `/ui-check`).
- No hay archivo de desarme en `supabase/desarmes/`: no está en la allowlist. La cabecera de la 0557 dice cómo
  deshacerla. Si el DG lo quiere, va en la PR que la aplique.

## HANDOFF AL DIRECTOR

Fase 1 lista para revisión independiente. Con el interruptor apagado el portal no cambia, y la 0557 queda en
espera. Hace falta tu turno para las pruebas locales, o leer el CI, y tu decisión sobre el REVOKE.
