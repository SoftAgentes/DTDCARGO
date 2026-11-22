---
sdd: "0675"
title: "Bandeja como acceso adicional por persona, con las bandejas de Chatwoot que le tocan"
status: in-progress
author: "Claude (Worker) + Sam"
created: 2026-11-18
updated: 2026-11-19
supersedes: null
superseded_by: null
related: ["0585", "0622", "0655", "0671"]
confidencialidad: interno
---

# SDD-0675 — Bandeja como acceso adicional por persona

> Hoy la Bandeja (el chat de Chatwoot dentro del Studio) solo se da por rol: `admin`, `commercial` y
> `support`. Esta SDD permite darla a **una persona** como acceso adicional (SDD-0622), sin cambiarle el
> rol, y hace que Chatwoot le dé las bandejas que le tocan: Leads, Clientes o las dos.

**Estado:** `in-progress`. Decisión 1 de §5 contestada por Sam el 2026-11-18: «Sí, siempre las dos». La
decisión 2 sigue con la recomendación («ver y editar» como cualquier módulo cubierto) hasta que Sam diga otra
cosa. Etapa 2: código en la #686, fusionada.

> **Estado al 2026-11-19.** El código y la migración están en `main` (#686). La migración
> `0565_bandeja_concedible_por_persona` está **aplicada en producción** el 2026-11-19: commit del apply
> a las 17:55:31Z (inicio 17:55:30Z), proyecto `dtd-cargo`, con el OK literal de Sam «OK, aplica 0566,
> 0565 y 0562». Md5 `479cefea6117e822a7bcd896902f6bdf`, 5486 bytes, una fila en el ledger y el cuerpo
> vivo de `studio_module_is_grantable` igual al archivo. Evidencia en el servidor:
> `/srv/ops/evidencias/apply-0565-dtd-cargo-20261119T175530Z` (previa:
> `/srv/ops/evidencias/previa-0565-dtd-cargo-20261119T175507Z`). La espera quedó retirada y la
> migración sellada en el cierre; la cabecera «NO APLICADA» del `.sql` se conserva (runbook §6). Datos
> del Director General: el md5 y los bytes los comprobé contra el archivo de `main` (también lo hace
> `retirar-espera.mjs`); la hora, el OK, la fila del ledger, el cuerpo vivo y la evidencia no los
> verifiqué yo. Falta el smoke en producción: conceder la Bandeja a una persona sin rol de Bandeja,
> comprobar que la ve y que Chatwoot la deja en Leads y Clientes, y revocarla.

## 0. Decisión de Sam, literal

En la sesión de la SDD-0671 (2026-11-18), a la pregunta «¿Qué debe ver esa persona en la Bandeja?», Sam
contestó: **«Leads y Clientes»**. Es la opción D de la SDD-0671 §3.2: dar la Bandeja como acceso adicional
por persona. El caso es una persona de la oficina que abre el CRM por un acceso adicional de `kommo`, no es
admin y no ve la Bandeja, los chats ni las notas de Chatwoot (diagnóstico en SDD-0671 §2). No se leyeron
datos de producción y la persona no se nombra en el repo.

Cambiarle el rol a `commercial` como puente lo decide Sam en Usuarios (cuenta de producción); esta SDD no
lo hace.

## 1. Lo que ya funciona y lo que falta

**Ya funciona (no se toca):**
- La tabla `studio_user_module_grants` (0538) guarda cualquier módulo: no cambia su forma.
- La base decide con `user_has_module` (0538), que suma los accesos por persona. La RLS que habla de la
  Bandeja ya la usa: `chatwoot_conversations` (`0540_comercial_rls_por_modulo.sql:291`) y los vínculos de
  ficha (`0554_chatwoot_contact_links.sql:136`, y edición en la 260).
- La guarda de la página suma los accesos por persona (`lib/studio/rbac-guard.ts:156-157`), y también la
  pestaña y «Abrir chat» del CRM (`lib/studio/crm-acceso.ts:43`).

**Falta:**

| # | Hoy | Dónde |
|---|---|---|
| F0 | La base solo deja conceder los módulos de `studio_module_is_grantable` (8, sin `bandeja`), y la RPC rechaza el resto | `supabase/migrations/0538_studio_user_module_grants.sql:196-212` (y la 479); «ampliar la lista es una decisión de Sam (spec 0622 §13.3.3) y va con su migración» |
| F1 | `bandeja` no se ofrece como acceso adicional («Aún no disponible») | `lib/studio/user-module-grants.ts:51-55` (`COVERED`) y la guarda de la acción `app/studio/(app)/usuarios/actions.ts` (rechaza lo que no es `covered`) |
| F2 | El ciclo de agentes calcula `puedeBandeja` solo con rol y desvío de rol, y da de baja en Chatwoot a quien no la tiene (`sin_bandeja`) | `lib/studio/chatwoot/agentes-ciclo.ts:73-91`, `agentes-salud.ts:64` |
| F3 | La matriz le da bandejas solo a `admin`, `commercial` (Leads) y `support` (Clientes); a cualquier otro rol, ninguna | `lib/studio/chatwoot/matriz.ts:64-73` |
| F4 | «Agentes vinculados» marca `puedeBandeja` solo por rol | `lib/studio/chatwoot/agentes-bandeja-admin.ts:82` |
| F5 | Conceder o revocar un acceso no sincroniza Chatwoot (sí lo hacen el cambio de rol y la desactivación) | `usuarios/actions.ts` (`grantUserModuleAction`, `revokeUserModuleGrantAction`); compárese `sincronizarAgenteDeUsuario` en las líneas 310 y 436 |

## 2. Diseño

0. **F0. Migración 0565:** `create or replace function public.studio_module_is_grantable` con la misma
   firma, el mismo cuerpo y los mismos privilegios, sumando `'bandeja'` a la lista. Es una función
   `immutable` sin datos: no escribe filas ni toma locks de tablas. Preflight: exige la 0538 y que la función
   tenga hoy exactamente las 8 de la 0538 (cada una concedible y ningún literal de más en su cuerpo).
   Postflight: las 8 más `bandeja`, una por una y sin módulos de más; `admin`/`users` fuera; EXECUTE solo de
   `authenticated` y `service_role`. Desarme: devolver la lista de 8, entre `begin` y `commit`, y antes
   **revocar** los accesos de `bandeja` que existan (si no, quedan filas que la RPC ya no aceptaría; el
   desarme aborta). La autoriza la decisión de Sam de §0.
1. **F1. `bandeja` pasa a `COVERED`.** Se ofrece en Usuarios › «Lo que puede ver» como cualquier módulo
   cubierto: ver, o ver y editar (editar = unir una conversación a una ficha, 0554), con motivo y
   vencimiento opcional. No es módulo sensible.
2. **F2. El ciclo lee los accesos.** `estadoEnStudio` lee además las filas vigentes de
   `studio_user_module_grants` con `module_id = 'bandeja'` del tenant (con la llave de servicio, como hoy los
   desvíos) y calcula `puedeBandeja = canAccessModule(rol, "bandeja", overrides, grants)`. Un acceso vencido
   deja de contar y la siguiente pasada del cron diario lo da de baja. **Si esa lectura falla** (revisión
   de la #686): las bajas por `desactivado` y `fuera_del_tenant` se aplican igual; las de `sin_bandeja`
   esperan (`sinBandejaEnEspera`), la matriz no corre (sacaría de sus bandejas a quien entra por un extra) y
   la salud levanta la alerta `accesos_no_leidos`, que el cron le avisa a los admins. **Si falla la de los
   miembros (`user_tenants`) o la de los desvíos por rol** (re-revisión de la #686; absorbe la SDD-0677): no
   se aplica ninguna baja ni la matriz (`sinEstado`), porque un mapa vacío daría a todos por
   `fuera_del_tenant`, y la salud levanta `miembros_no_leidos`.
3. **F3. Bandejas por acceso adicional.** `AgenteMatriz` suma `porAcceso: boolean`: verdadero cuando la
   Bandeja le llega por acceso adicional y no por rol. `destinosDe` queda así:
   - `admin` → Clientes y Leads (igual que hoy);
   - `commercial` → Leads; `support` → Clientes (igual que hoy);
   - **cualquier otro rol con acceso adicional → las bandejas de la decisión 1 de §5** (recomendado:
     Clientes y Leads, con sus equipos);
   - el resto → ninguna (igual que hoy).
   El rol de la cuenta de Chatwoot sigue siendo `agent` para todo el que no es admin (`rolChatwootDe`, sin
   cambio): un acceso adicional nunca hace administrador de Chatwoot.
4. **F4.** «Agentes vinculados» calcula `puedeBandeja` con los accesos del tenant (`getTenantGrantsByUser`,
   que Usuarios ya usa), y el alta del agente (`altaAgente`, `app/studio/(app)/bandeja/actions.ts`) deja de
   rechazar con `sin_bandeja` a quien tiene el acceso vigente (lee su fila de `bandeja` con la llave de servicio).
   Este sitio no estaba en la primera versión de la tabla de §1; se encontró al implementar.
5. **F5.** `grantUserModuleAction` y `revokeUserModuleGrantAction` llaman a
   `sincronizarAgenteDeUsuario(persona)` después de guardar, **solo si el módulo es `bandeja`**, igual que el
   cambio de rol: lo guardado no cambia y, si Chatwoot falla, lo reintenta el cron. Desde la revisión de la
   #686, si Chatwoot quedó pendiente la acción devuelve el aviso «Guardado; Chatwoot quedó pendiente hasta el
   próximo ciclo.» y la pestaña Acceso lo muestra.
6. **Atajo «Todo Comercial».** No suma la Bandeja: abre chats y una cuenta en Chatwoot, así que se da a
   propósito, módulo por módulo.

**Alta en Chatwoot.** Dar el acceso no crea el usuario de Chatwoot. Después de concederlo, un admin vincula a
la persona en Usuarios › Bandeja › Agentes vinculados, como hoy con un comercial. Con el vínculo, el ciclo la
da de alta en la cuenta con rol `agent` y la pone en las bandejas y equipos de F3.

**Migración.** La 0565 hace falta siempre por F0. Con la recomendación de §5 (decisión 1, «siempre las dos»)
es **solo** ese cambio de función. Si Sam elige «se eligen por persona», la 0565 suma además la tabla de
elección.

**migrate-first.** El código nuevo funciona con o sin la 0565: sin ella, la RPC rechaza conceder `bandeja` y
Usuarios muestra el error que ya existe; no se rompe nada. Se declara como espera (`pendingBelowCutoff`) con
su degradación.

## 3. Casos borde

| Caso | Resultado |
|---|---|
| Rol `accounting` u `operations` + acceso de `bandeja` | Ve la pestaña Bandeja y «Abrir chat»; en Chatwoot, `agent` en Leads y Clientes |
| Acceso vencido o revocado | Deja de ver la pestaña al instante; en Chatwoot, la baja llega al revocar (F5) o con el cron diario si venció |
| Rol `commercial` que además necesita Clientes | **No lo cubre esta SDD**: el rol ya da la Bandeja (Leads), así que el acceso adicional no se ofrece (`grantableStatus` = `role_full`). Haría falta la opción «se elige por persona» de §5 |
| Rol `support` + acceso adicional de `bandeja` | No se ofrece: el rol ya la da (Clientes) y es de solo lectura |
| Persona desactivada | Igual que hoy: baja inmediata en Chatwoot |
| Último admin humano de Chatwoot | Igual que hoy: nunca se degrada (`bloqueoDeBaja`) |
| Desvío por rol que da `bandeja` a un rol sin bandejas (`accounting`, etc.) | Hoy queda en Chatwoot sin bandejas. Esta SDD no lo cambia: el desvío por rol no es acceso adicional. Se anota en §7 |

## 4. Pruebas (etapa de código)

- `lib/studio/__tests__/user-module-grants.migration.test.ts`: la comparación «concedibles de la base =
  `COVERED`» pasa a leer la **última** definición de `studio_module_is_grantable` (la de la 0565). Prueba en
  PGlite de la 0565 (contrato `.test.sql`): conceder `bandeja` funciona, `admin`/`users` siguen rechazados,
  preflight, reaplicar y control rojo.
- Prueba nueva de `grantableStatus`: `bandeja` es `covered`; para `accounting` = `grantable`; para
  `commercial` y `support` = `role_full`.
- `lib/studio/chatwoot/__tests__/matriz.test.ts`: `destinosDe` con `porAcceso` → Clientes y Leads para un rol
  sin bandejas; sin `porAcceso`, igual que hoy; `admin`, `commercial` y `support` sin cambio; el rol de cuenta
  sigue `agent`.
- `lib/studio/chatwoot/__tests__/agentes-ciclo.test.ts`, con un doble que **aplica los filtros** (tenant,
  `module_id`, vencimiento): acceso vigente → se queda; vencido → `sin_bandeja`; acceso de otro tenant o de otro
  módulo no cuenta.
- `usuarios` (acción): conceder o revocar `bandeja` llama a `sincronizarAgenteDeUsuario` una vez; otro módulo
  no la llama; si la sincronización falla, la acción igual responde bien.
- Mutantes: quitar `bandeja` de `COVERED` o de la 0565; ignorar los accesos en el ciclo; `porAcceso` sin
  bandejas; no sincronizar al revocar.

## 5. Decisiones de Sam (preguntas cerradas)

1. **¿Qué bandejas da el acceso adicional de Bandeja?** — **Contestada (2026-11-18), literal: «Sí, siempre
   las dos».** Se implementa la primera opción; la 0565 es solo el cambio de función.
   - **Siempre Leads y Clientes (recomendado).** Es el caso de hoy; la 0565 es solo el cambio de una función.
   - **Se eligen por persona** (Leads, Clientes o las dos). La 0565 suma una tabla con lo que eligió el admin
     para cada persona, y además cubre al comercial que necesita Clientes (§3). Es más trabajo y deja más
     para revisar.
2. **¿Se permite «ver y editar»?** Editar en la Bandeja del Studio es unir una conversación a una ficha
   (0554). Recomendado: **sí, como cualquier módulo cubierto**; el admin elige ver o ver y editar al conceder.

## 6. Allowlist exacta (etapa de código, con la recomendación de §5)

- `docs/specs/0675-bandeja-por-persona/spec.md` y `docs/specs/README.md` (índice generado).
- `lib/studio/user-module-grants.ts` y su prueba.
- `lib/studio/chatwoot/agentes-ciclo.ts`, `lib/studio/chatwoot/matriz.ts`,
  `lib/studio/chatwoot/agentes-matriz.ts` (si `AgenteMatriz` cambia de forma),
  `lib/studio/chatwoot/agentes-bandeja-admin.ts` y sus pruebas.
- `app/studio/(app)/usuarios/actions.ts` y su prueba nueva
  `app/studio/(app)/usuarios/__tests__/acceso-bandeja-chatwoot.test.ts`.
- `app/studio/(app)/bandeja/actions.ts` (`altaAgente`) y `app/studio/(app)/bandeja/__tests__/alta-agente.test.ts`.
- `lib/studio/chatwoot/agentes-salud.ts` (campo `porAcceso` del estado).
- `lib/studio/__tests__/user-module-grants-bandeja.test.ts` (nueva).
- `docs/specs/0622-permisos-por-persona/spec.md`: nota de que `bandeja` pasa a cubierto por esta SDD.
- `supabase/migrations/0565_bandeja_concedible_por_persona.sql` (nuevo),
  `supabase/tests/0565_bandeja_concedible_por_persona.test.sql` (nuevo), su prueba en Vitest (nueva),
  `lib/studio/__tests__/bandeja-concedible.migration.test.ts` (nueva),
  `supabase/desarmes/0565_desarme` (nuevo; extensión `.sql`, sin el punto pegado para que no se lea como
  migración citada), `supabase/migrations-baseline.json` (la espera) y
  `supabase/pending-migration-symbol-declarations.json` si el gate lo pide.
- `lib/studio/__tests__/user-module-grants.migration.test.ts` (lee la última definición).
- `.agents/handoffs/sdd-0675-bandeja-por-persona.md`.

Sin RLS nueva ni cambios de tablas. Si Sam elige «se eligen por persona», se suman a la 0565 la tabla de
elección y la pantalla de Usuarios para elegirlas, y se reescribe esta lista.

## 7. Fuera de alcance

- El desvío por rol que da `bandeja` a un rol sin bandejas en la matriz (§3, última fila).
- Crear el usuario de Chatwoot automáticamente al conceder el acceso.
- Cambiar el rol de la persona del caso: lo decide Sam en Usuarios.
