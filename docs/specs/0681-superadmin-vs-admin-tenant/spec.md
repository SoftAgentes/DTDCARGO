---
sdd: "0681"
title: "Superadministrador frente a admin del tenant: qué puede cada uno"
status: proposed
author: "Claude (Worker)"
created: 2026-11-19
updated: 2026-11-19
supersedes: null
superseded_by: null
related: ["0037", "0139", "0250", "0252", "0622", "0624", "0633", "0634", "0636"]
confidencialidad: interno
---

# SDD-0681 — Superadministrador frente a admin del tenant: qué puede cada uno

> Este estudio es de solo lectura. Levanta qué puede hacer hoy el superadministrador y qué puede el admin del tenant, y propone dónde poner la frontera antes de venderle el sistema a otras empresas. No cambia comportamiento ni migraciones.

## 0. Contexto y la regla de Sam

Sam definió las dos figuras así:

- **El superadmin es el desarrollador.** Programa, borra y hace todo.
- **El admin del tenant administra su empresa.** Puede hacer muchas cosas, pero **no activa ni desactiva módulos**. Las empresas que compren el sistema no tendrán superadmin: pedirán un admin para su empresa.

En el sistema, cada figura tiene su lugar:

- **Superadmin** = una fila en `public.platform_admins` (`supabase/migrations/0058_platform_admins.sql:20-25`). La pregunta se hace con `public.is_platform_admin()` (`0058:54-64`). Esa función es DEFINER y desde la 0542 la ejecutan `authenticated` y `service_role`, nunca `anon` (`0542_is_platform_admin_execute_authenticated.sql:106-107`). Es una dimensión que cruza tenants y es ortogonal al rol (`0058:4-8`).
- **Admin del tenant** = `user_tenants.role = 'admin'`, uno de los 7 roles (`0189_marketing_role.sql:24-27`). En SQL se pregunta con `is_tenant_admin()`, con `audit_d1_admin_tenant()` (`0289_audit_d1_access_configuration.sql:131-160`) o con un `role = 'admin'` dentro de cada RPC. En la app, con `tenantAdminGate` (`lib/studio/rbac-guard.ts:339`) o con `canAccessModule`/`canEditModule`, donde el admin siempre pasa (`lib/studio/rbac.ts:469,487`).

Estas migraciones ya están aplicadas: ninguna figura en `pendingBelowCutoff` y las de 0528 a 0545 están selladas en `supabase/migrations.lock.json`. Sus cabeceras todavía dicen «NO APLICADA»; es texto viejo, no el estado real.

## 1. Tabla de capacidades actual

En la tabla, **SA** es superadmin, **AT** es admin del tenant y **Otros** son los seis roles restantes. «Base» quiere decir que el freno vive en SQL (RLS, RPC o disparador). «App» quiere decir que vive solo en la server action o en la página.

| Capacidad | SA | AT | Otros | Dónde se decide (archivo:línea) |
|---|---|---|---|---|
| **Encender o apagar un módulo** (`feature_flags`) | Sí. Además tiene que ser admin activo del tenant (ver H2). | **No** | No | App: `app/studio/(app)/admin/feature-flags/actions.ts:55` (`platformAdminDenial`). Base: la policy `feature_flags_platform_admin_update` (`0355:132-137`) y el disparador ALWAYS `feature_flags_exige_superadmin` (`0543:144-176`), que también frena la rama `feature_flag.toggle` de `audit_d1_execute` (`0289:632-650`). |
| Editar la matriz rol × módulo (desvíos por rol) | Sí | **Sí** | No | App: `admin/actions.ts:23,52` (`moduleEditDenial("admin")`). Base: `studio_set_role_module_access`; los módulos de `LOCKED_MODULES` no se tocan (`0357`, CHECK `studio_role_module_overrides_locked_check`). |
| Dar a una persona un módulo extra (grants) | Sí. Es el único que da los 4 módulos SA. | **Sí**, menos los 4 SA. No a sí mismo ni a otro admin. | No | Base: `studio_grant_user_module` (`0538:395-545`). Exige rol admin (`:431`), no deja dárselo a uno mismo (`:435`) y reserva los módulos SA a `is_platform_admin()` (`:465`). App: `usuarios/actions.ts:1305,1347` (`tenantAdminGate`). |
| Abrir los 4 módulos SA (Financiero China, Legal, No-Olvidar, Rendiciones) | Sí | No | No | App: `SUPERADMIN_ONLY_MODULES` (`rbac.ts:205-210`) y `rbac-guard.ts:169-174,197-202,242-247`. |
| Dirección y Mailing | Sí | Sí | No | Decisión del founder del 2026-08-07: quedan en admin por rol (`0356:6-8`, `rbac.ts:197-204`). |
| **Crear o reactivar un admin** (invitar como admin, subir a admin, reactivar a un admin suspendido) | Sí | **No** | No | Base: los disparadores ALWAYS `user_invitations_exige_superadmin` y `user_tenants_exige_superadmin` (`0545:162-252`), decisión de Sam del 2026-11-15. App: aviso previo en `usuarios/actions.ts:160` y `app/invitar/[token]/actions.ts:88-97`. |
| Suspender a otro admin o cambiarle el rol | Sí | **No**. Sobre sí mismo sí, salvo que sea el último admin. | No | Base: `studio_set_user_disabled` (`0355:184-187`) y `studio_change_user_role` (`0355:252-255`), más el anti-lockout del último admin (`0355:189-199,257-264`). |
| Invitar a los demás roles, cambiar roles que no son admin, suspender a quien no es admin, editar perfil o correo, alcance de almacén, revocar invitaciones | Sí | Sí | No | App: `moduleEditDenial("users")` en `usuarios/actions.ts:154,293,324,393,441,508,675,794,926`. Base: `audit_d1_execute` → `membership.*` (`0289:240-306`); invitar solo pasa por ahí desde la `0545:302`. |
| Borrar embarques y recepciones CN | Sí, como admin | Sí | No | Capability `delete_shipments`/`delete_warehouse_receipts` (`rbac.ts:307-315`). Base: `soft_delete_shipments_with_audit_reason` (`0476`) pide `role = 'admin'`. |
| Anular facturas, recibos, asientos, libros fiscales, pagos, gastos y finiquitos | Sí, como admin | Sí | accounting en los de dinero | App: `moduleEditDenial` del módulo de dinero (`facturacion/actions.ts:783`, `cobranzas/actions.ts:193`, `tesoreria/actions.ts:219,266`, `contabilidad/actions.ts:362,407,704`, `fiscal/actions.ts:253,380`). Capability `void_expense` es accounting (`gastos/actions.ts:375`) y `void_payroll_settlement` es solo admin (`nomina/actions.ts:1710`). Base: escritura del dinero solo accounting y admin (0470, 0511). |
| Anular una rendición | Sí | No | No | `rendiciones/actions.ts:62`. |
| Leer montos (asientos, cobros, CxP) | Sí, como admin | Sí | accounting | Base: `studio_can_read_money()` (`0528`). App: `MONEY_MODULES` (`rbac.ts:167-176`). |
| Tarifas y costeo | Sí, como admin | Sí | accounting y los roles de la matriz | `moduleEditDenial("rates"/"costing")`. Tarifas de transportistas: `admin/carrier-actions.ts:62-65` (`tenantAdminGate`). |
| Tasa BCV manual | Sí, como admin | Sí | accounting | `admin/exchange-rates-actions.ts:29`. El cron `app/api/cron/bcv-rates/route.ts:12` usa `CRON_SECRET` y un tenant fijado por `BCV_RATE_TENANT_ID`. |
| **Ver otros tenants o cambiar de tenant** | **No existe** (ver H2) | No | No | `get_user_tenant_id()` devuelve NULL con más de una membresía activa (`0453_portal_helpers_principal_determinista.sql:235-247`). `getStudioAccess` toma `limit(1)` (`rbac-guard.ts:102-107`). No hay acción de cambiar de tenant ni de impersonar. |
| Chatwoot: secretos y cuenta | Nadie desde la UI | — | — | Variables de entorno (`lib/studio/chatwoot/config.ts:16-31,54,78`), con un tenant fijado por `CHATWOOT_TENANT_ID`. |
| Chatwoot: agentes, portal y actualizaciones | Sí, como admin | Sí | No | `bandeja/actions.ts:157,234,253,478` y `admin/actualizaciones/actions.ts:42,53,85` (`tenantAdminGate`). |
| Kommo: mapa de etapas y campos | Sí, como admin | Sí | No | `crm/actions.ts:178-196`: `moduleEditDenial("kommo")` y relectura de `role`. |
| Meta, WhatsApp e Instagram: configuración | Nadie desde la UI | — | — | No hay acción de configuración; son tokens en el entorno. Las invitaciones del portal por WhatsApp son `moduleEditDenial("clients")` (`admin/portal-backfill-actions.ts:119,232`). |
| API keys y webhooks del tenant | Sí, como admin | Sí | No | `admin/api-integration-actions.ts:34,67,95,131`. Base: `audit_d1_execute` `api_key.*`/`webhook.*` (`0289:355-468`). |
| Identidad del tenant, oficinas, cuentas bancarias, numeración legal, reglas de aviso, agentes de IA | Sí, como admin | Sí | No | `audit_d1_execute` (`0289:469-865`); la única guarda es `audit_d1_admin_tenant()`. |
| Telegram y correo saliente | Sí, como admin | Sí | No | `admin/alertas-telegram/actions.ts:37` y `mailing/actions.ts:446`. |
| Auditoría: pestaña y actividad de usuarios | Sí, como admin | Sí | No | `admin/page.tsx:376,427` (`canSpecial("audit_view")`) y `usuarios/actions.ts:1418-1425`. |
| Auditoría: exportar | Según la base | Según la base | — | `app/api/studio/audit/export/route.ts:7,52`. Lo deciden `audit_request_export`, `audit_approve_export` y `audit_authorize_export_download`. |
| Oficina (cable, pausa, revisiones, mini-vista) | Sí | No | No | Base: `office_cambiar_pausa` (`0541:352`) y las funciones de la `0549`, la `0558` y la `0567`, que exigen `is_platform_admin()`. App: `admin/oficina/layout.tsx:13` y `admin/oficina/actions.ts:48-49,77-78`. |
| Debug y errores | Sí, como admin | **Sí** | No | `(app)/debug/layout.tsx:21` (`requireModuleView("admin")`). La 0058 lo pensaba como cosa de plataforma (`0058:10-13`); ver H4. |
| Purgas y reintentos programados | Nadie con sesión | — | — | `app/api/cron/*` con `CRON_SECRET`. |
| Llaves de IA y ruteo de modelos | Pensado para SA (`0058:12`) | — | — | No encontré una pantalla viva que las edite. |

## 2. Hallazgos

Sigo la regla de la tarea: un hueco abierto que se pueda explotar no se describe en este repo público.

- **H-S.** Hallazgo de seguridad reportado aparte al DG; cierre en fase 1.
- **H1. «Activar módulos» tiene tres perillas, y solo una es de superadmin.**
  - `feature_flags` enciende o apaga el módulo para todo el tenant, y es solo del superadmin, tanto en la app como en la base.
  - La matriz rol × módulo y los grants por persona deciden *quién* ve un módulo ya encendido. Esas dos las maneja el admin del tenant.
  - Según cómo se lea la regla de Sam, esto ya cumple o no cumple (P1).
- **H2. No hay consola de plataforma, así que el superadmin no puede atender a otro tenant.** Tres razones:
  - Para encender un módulo, el superadmin además tiene que ser admin activo **de ese** tenant. `audit_d1_execute` resuelve el tenant con `audit_d1_admin_tenant()`, que busca `role = 'admin'` (`0289:141-150`), y `toggleFeatureFlagAction` usa el tenant de la sesión.
  - Con dos membresías activas, `get_user_tenant_id()` falla cerrado: devuelve NULL (`0453:242-246`). La RLS de casi todo el sistema deja de responder.
  - `audit_d1_admin_tenant()` toma la primera membresía admin por fecha (`order by created_at limit 1`, `0289:151-152`). Es una regla distinta de la anterior.

  Resultado: hoy el superadmin solo opera dentro del tenant donde es admin. Para vender a terceros hace falta una vía de soporte explícita (fase 3).
- **H3. El superadmin hereda los poderes del admin, pero no los tiene por sí solo.** Todo lo de la tabla que dice «Sí, como admin» depende de que Sam tenga `role = 'admin'` en ese tenant. `is_platform_admin()` no sube el rol: `getStudioAccess` no lo mira (`rbac-guard.ts:86-130`). En DTD funciona porque Sam es las dos cosas. Para un tenant nuevo hay que decidir si el superadmin entra como miembro o por la consola (P3).
- **H4. Hay cosas de plataforma que hoy abre cualquier admin.**
  - Debug y errores: `(app)/debug/layout.tsx:21`, contra lo que pensaba la `0058:10-13`.
  - Actualizaciones de Chatwoot, una pieza de infraestructura compartida (`admin/actualizaciones/actions.ts:42,53,85`).
  - Agentes de IA con presupuesto en USD (`0289:812-865`).

  Con un solo tenant no hace daño. Con varios, el admin de una empresa vería o tocaría cosas de la plataforma.
- **H5. Las integraciones están fijadas a un tenant por variables de entorno:** `CHATWOOT_TENANT_ID`, `DISCORD_TENANT_ID` y `BCV_RATE_TENANT_ID` (`lib/studio/chatwoot/config.ts:54,78`, `lib/studio/alerts/*`, cron BCV). No hay configuración de integraciones por tenant ni pantalla para ella. Para otro tenant, Chatwoot, Meta, Kommo y BCV son hoy trabajo de despliegue, y eso es tarea del superadmin.
- **H6. Algunos avisos de la app dependen de datos del cliente o fallan abiertos.** No es un hueco, porque la base frena igual, pero conviene saberlo:
  - Suspender o reactivar a otro admin solo avisa antes si el formulario trae `target_role=admin` (`usuarios/actions.ts:372-380`).
  - `changeUserRoleAction` no avisa nada antes (`:293`).
  - Invitar y aceptar siguen adelante cuando la consulta de superadmin da error (`usuarios/actions.ts:160`, `app/invitar/[token]/actions.ts:94`).

  En todos estos casos la base niega con 42501 (`0355`, `0545`). El costo es un mensaje peor, no un permiso de más.
- **H7. El sidebar le muestra a cualquier admin los 4 módulos del superadmin** (`(app)/_components/StudioSidebar.tsx:528-535` usa `canAccessModule` sin `is_platform_admin`). El servidor los bloquea (`requireModuleView`). Es lo contrario de un candado de UI: el admin ve el enlace y luego le sale el rechazo.
- **H8. Hay lecturas de `user_tenants` que no filtran `disabled_at`.**
  - `lib/http/studio-session.ts:49-52` tampoco filtra `user_id` y se apoya en RLS y en `maybeSingle`, que falla cerrado con más de una fila.
  - Otras: `crm/actions.ts:190`, `admin/feature-flags/page.tsx:34` y `legal/expediente/[code]/page.tsx:260`.

  La RLS de datos usa `get_user_tenant_id()`, que sí excluye a los suspendidos. Por eso es robustez y no un agujero.
- **H9. `capabilityDenial`/`canSpecial` dejan pasar al admin en todo** (`rbac-guard.ts:357`, `rbac.ts:344`), incluso `audit_view_sensitive` y `delete_*`. Es coherente con «el admin administra su empresa», pero ninguna capability está reservada al superadmin.

Al revés no encontré nada: no hay una capacidad del admin que la base le niegue sin motivo, salvo lo que el superadmin decidió reservarse.

## 3. Propuesta de frontera

> **Enmienda 1 (2026-11-19).** Sam respondió las preguntas. Lo que decide está en §7 y el plan corregido en §8. Esta sección queda como estaba, como registro del estudio.

Regla general: **el superadmin opera la plataforma** (lo que cruza tenants, lo que es infraestructura y lo que cambia lo que la empresa compró). **El admin del tenant opera su empresa** dentro de los módulos que tiene encendidos.

| Capacidad | Superadmin | Admin del tenant | Por qué |
|---|---|---|---|
| Encender o apagar módulos (`feature_flags`) | Sí, en cualquier tenant | **No** | Es lo que la empresa compró. Lo pidió Sam y ya está en la base (0543). Falta que no dependa de ser miembro (H2). |
| Matriz rol × módulo y grants por persona | Sí | **Sí**, dentro de los módulos encendidos | Es repartir el trabajo dentro de la empresa, no comprar módulos. Si el admin no pudiera, cada cambio de puesto sería un ticket a la plataforma. Hay que confirmarlo (P1). |
| Los 4 módulos SA (Financiero China, Legal, No-Olvidar, Rendiciones) | Sí | Revisar caso por caso (P2) | Hoy son de SA porque en DTD los opera el dueño. Un tenant vendido sin superadmin no podría usarlos nunca. Para otra empresa, Legal y Rendiciones son *su* negocio. Propuesta: separar «módulo de plataforma» de «módulo sensible del tenant». |
| Crear o reactivar admins; tocar a otro admin | Sí | **No** | Decisión de Sam del 2026-11-15 (0545), ya en la base. Sin superadmin en su empresa, el tenant le pide al proveedor un admin nuevo. Es soporte, no autoservicio. Ver P4 para el «admin principal». |
| Invitar y gestionar los demás roles | Sí | Sí | Es administrar el equipo propio. |
| Borrar o anular datos de negocio (embarques, facturas, asientos) | Sí | Sí, con motivo y auditoría | Son datos de la empresa. Ya hay motivo, borrado lógico y `entity_audit_log`. |
| Borrado permanente, purgas y anonimización | Sí, por runbook | No | Es irreversible y toca el cumplimiento (`revisar-datos-ve`). En DTD ya lo corre Sam. |
| Ver o operar otros tenants | Sí, por una vía de soporte explícita y auditada | No | Hoy no existe (H2). Tiene que dejar rastro de quién entró, a qué tenant y por qué. |
| Secretos e infraestructura de integraciones (tokens de Chatwoot, Meta, Kommo, fuente BCV, actualizaciones de Chatwoot) | Sí | No | Son infraestructura compartida y secretos (H4, H5). |
| Parámetros de integración del tenant (mapa de etapas Kommo, agentes de Chatwoot, plantillas) | Sí | Sí | Es cómo la empresa usa la integración. |
| Tasa BCV manual, tarifas, costeo, cobros y montos | Sí | Sí | Es la operación y el dinero de la empresa. La lectura del dinero sigue la 0528. |
| API keys y webhooks del tenant | Sí | Sí | Conectan sistemas de la propia empresa. |
| Agentes de IA y su presupuesto | Sí | Decidir (P5) | Gastan dinero de la plataforma o del tenant, según cómo se cobre. |
| Auditoría del propio tenant | Sí | Sí | Es la cuenta de su gente. |
| Auditoría entre tenants, debug, errores, llaves de IA y oficina (cable) | Sí | No | Son de la plataforma (H4). |
| Feature flags experimentales (no comerciales) | Sí | No | Igual que encender módulos. |

## 4. Preguntas abiertas para Sam

> **Enmienda 1 (2026-11-19).** Sam respondió las preguntas. Lo que decide está en §7 y el plan corregido en §8. Esta sección queda como estaba, como registro del estudio.

1. **P1.** Cuando dices «no activa ni desactiva módulos», ¿hablas solo del interruptor que enciende el módulo para toda la empresa? ¿O también de decidir qué rol o qué persona lo ve (la matriz y los accesos adicionales)? La propuesta es lo primero: el admin reparte acceso dentro de lo encendido.
2. **P2.** Financiero China, Legal, No-Olvidar y Rendiciones hoy son solo del superadmin. En un tenant vendido, ¿su admin puede usarlos? ¿O son módulos que solo existen para DTD?
3. **P3.** Para atender a otra empresa, ¿el superadmin entra como un miembro más de ese tenant? ¿O se construye una consola de plataforma que opere desde afuera, con auditoría?
4. **P4.** Cuando una empresa pierde a su único admin o quiere uno nuevo, ¿lo hace siempre la plataforma? ¿O la empresa tiene un «admin principal» que puede nombrar a otros admins?
5. **P5.** Los agentes de IA y su presupuesto en USD, ¿los configura el admin del tenant o la plataforma?
6. **P6.** Las actualizaciones de Chatwoot y la pantalla de debug, ¿se pasan ya al superadmin (DTD tiene un solo tenant y no rompe nada) o cuando llegue el segundo tenant?
7. **P7.** ¿Cuántos superadmins debe haber y quién puede nombrar uno? Hoy solo se agregan con `service_role` (`0058:15-17`) y no queda en la auditoría.

## 5. Plan por fases (no se implementa aquí)

> **Enmienda 1 (2026-11-19).** Sam respondió las preguntas. Lo que decide está en §7 y el plan corregido en §8. Esta sección queda como estaba, como registro del estudio.

| Fase | Qué | Tipo | Depende de |
|---|---|---|---|
| 1 | Cerrar H-S (detalle fuera del repo). | Migración con preflight, OK nominal de Sam | Nada; es lo primero |
| 2 | Pasar a superadmin lo que es plataforma (H4): debug, errores, actualizaciones de Chatwoot y, según P5, agentes de IA. El sidebar respeta los 4 módulos SA (H7). Los avisos dejan de depender de datos del cliente (H6). | App, y base donde haya RPC | P5, P6 |
| 3 | Vía de soporte multi-tenant: elegir el tenant como superadmin sin depender de `get_user_tenant_id()`, encender módulos de cualquier tenant y dejar rastro en la auditoría (H2, H3). | SDD propia, migración y app | P3 |
| 4 | Integraciones por tenant: pasar `*_TENANT_ID` y los secretos del entorno a configuración por tenant, con secretos solo del superadmin (H5). | SDD propia por integración | Fase 3 |
| 5 | Reclasificar los 4 módulos SA y las capabilities según P2 y P4. Si aplica, crear «módulo de plataforma» frente a «módulo sensible del tenant». | Migración y app | P2, P4 |
| 6 | Alta y baja de superadmins con auditoría (P7). | Migración | P7 |

## 6. Aceptación de esta spec

- [x] La tabla de capacidades tiene archivo:línea en cada fila.
- [x] Los hallazgos están separados: el de seguridad, fuera de Git; los demás, aquí.
- [x] La propuesta tiene justificación por fila.
- [x] Las preguntas para Sam están separadas de las decisiones.
- [x] No cambia código, migraciones ni datos. No se leyó producción.

## 7. Enmienda 1 — decisiones de Sam (2026-11-19)

Sam respondió por medio del DG, en el chat del DG, el 2026-11-19. Abajo copio cada respuesta como la recibí. Lo que está marcado como *interpretación* hay que confirmarlo antes de pasar a diseño.

### 7.1 Lo que queda decidido

| # | Respuesta de Sam | Qué cambia en la frontera |
|---|---|---|
| P1 | Aclarada el 2026-11-19: solo el superadmin activa o desactiva módulos, porque el plan es venderlos por separado. Si un módulo se desactiva, se desactivan sus permisos y nadie de la empresa lo ve, como si no existiera. Al activarlo entran los permisos predeterminados, y desde ahí el admin configura quién accede. Literal: «el admin ahí sí puede configurar quién quiere que acceda a esos usuarios. Solo superadmin hace eso». | El admin del tenant **no** enciende ni apaga módulos (`feature_flags`); eso ya es solo del superadmin (0543). Sí reparte el acceso dentro de lo encendido: la matriz rol × módulo y los accesos por persona. Lo nuevo: desactivar apaga también los permisos, y activar parte de los predeterminados (`ROLE_MODULE_ACCESS`). Ver la fase 7 de §8. |
| P2 | Aclarada el 2026-11-19. Literal: «no debería verlo nadie, solo de dtd». | Financiero China, Legal, No-Olvidar y Rendiciones existen **solo para DTD y el superadmin**. Ninguna otra empresa los ve: no se ofrecen ni se encienden. «Revisar caso por caso» de §3 deja de aplicar: los 4 siguen siendo de superadmin. La fase 5 de §5 (= fase 7 de §8) se convierte en un catálogo de módulos por tenant. |
| P4 | Cada empresa tiene un **admin principal** (el dueño), que puede nombrar otros admins. Los demás admins no pueden borrarlo. | Aparece un tercer nivel dentro del tenant: **admin principal** > admin > los demás roles. Ver 7.2. |
| P4 | Solo el admin principal ve el «log fuerte»: qué se borró y las eliminaciones por usuario, con más detalle. Los otros admins ven los logs, pero no pueden borrarlos. El superadmin ve todo, «hasta lo que no hacen». | Hay dos niveles de auditoría en el tenant y uno de plataforma. Ver 7.3. |
| P6 | Solo superadmin. | Debug, errores y actualizaciones de Chatwoot pasan a ser solo del superadmin (H4). Ya se puede hacer con DTD como único tenant. |
| P7 | Un solo superadmin. Se crea una función para que el superadmin le dé superadmin a otro, **temporal** (con fecha límite, por ejemplo «te doy dos horas») o **permanente**, siempre con log. El secundario no puede borrar al primero. | Hay un rango de superadmin **primario** y delegaciones con vencimiento. En DTD se quedan las dos cuentas de Sam como superadmin. *Interpretación* (a confirmar en 7.4): las dos con rango primario. Ver 7.4. |
| P5 | «si» al modelo mixto que recomendó el DG. | La plataforma fija para cada empresa el tope mensual en USD y los modelos o proveedores; el admin de la empresa configura sus agentes dentro de eso; al llegar al 80 % del tope se avisa a los dos. Ver 7.5 y la fase 9 de §8. |

### 7.2 Admin principal

- **Qué es:** una sola persona por tenant, la dueña de la empresa. Es admin y además tiene la marca de principal.
- **Qué puede hacer y qué no:**
  - Nombra admins nuevos, lo que hoy solo hace el superadmin (0545).
  - Ningún otro admin del tenant puede suspenderlo, degradarlo ni borrarlo. Hoy la `0355:184-187,252-255` ya protege a cualquier admin de otro admin que no sea superadmin; la marca de principal hace que esa protección sea explícita y permanente.
  - Propuesta: el superadmin sí puede tocarlo, como vía de soporte cuando el dueño pierde el acceso o cambia. Pendiente de confirmar.
- **Qué cambia en la base:**
  - Los disparadores `user_invitations_exige_superadmin` y `user_tenants_exige_superadmin` (`0545:162-252`) también tienen que aceptar al admin principal del mismo tenant.
  - La excepción de «aceptar una invitación de admin» (`0545:229-246`) hoy exige que la haya emitido un superadmin; tiene que aceptar también al admin principal.
- **Preguntas para confirmar:**
  - Si un admin nombrado por el principal puede a su vez nombrar admins. Propuesta: no; solo el principal y el superadmin.
  - Si el principal puede pasar la marca a otra persona (traspaso de la empresa) o eso lo hace solo el superadmin. Propuesta: solo el superadmin, con log.
  - En DTD, quién es el admin principal. Propuesta: Sam, que además es el superadmin primario.

### 7.3 Niveles de auditoría

| Nivel | Quién | Qué ve |
|---|---|---|
| Logs del tenant | Todos los admins del tenant | La auditoría de hoy (`audit_view`, `entity_audit_log`, actividad de usuarios). **Ningún usuario la borra.** La 0267 la deja de solo agregar: `authenticated` solo tiene SELECT, y su postflight exige que `service_role` no tenga UPDATE, DELETE ni TRUNCATE (`0267:710-714,838-847`). La excepción es que la 0267 conserva el `ON DELETE CASCADE` por tenant (`0267:12,70`): si se borra un tenant, se borra su auditoría. Conviene confirmar que ninguna pantalla ofrece borrar. |
| «Log fuerte» | Solo el admin principal (y el superadmin) | Qué se borró, quién lo borró y las eliminaciones agrupadas por usuario, con el detalle del antes. Es un **nivel nuevo**: hoy no existe. `audit_view_sensitive` (`rbac.ts:301`) es otra cosa: revela la allowlist sensible de un evento con motivo y AAL2 (SDD-0166), y cualquier admin la pasa (H9). |
| Plataforma | Solo el superadmin | Todo, en todos los tenants. *Interpretación* de «hasta lo que no hacen»: los intentos negados (42501 de las RPC y de los disparadores), los accesos y lo que el sistema hace solo (crons, purgas, bots). Hoy casi nada de eso se registra; hay que confirmarlo con Sam antes de diseñarlo. |

### 7.4 Superadmin primario y delegación

- **Las dos cuentas de DTD.** Sam, el 2026-11-19: «Lo hice por precaución, por si acaso perdí un correo o algo. Déjalos a los dos como superadmin.»
  - En DTD **se quedan las dos** filas de `platform_admins` como superadmin. Son dos cuentas de Sam. El dato de las 2 filas viene de una fuente del 2026-08-07 y no lo medí en producción.
  - *Interpretación*, a confirmar con Sam: las dos tienen rango primario. «Un solo superadmin» se leería como un rango primario, no como una sola cuenta. Sam no eligió entre dos primarios y un primario con una delegación permanente.
  - En la lista de usuarios del Studio, las dos cuentas tienen que **verse marcadas como superadmin**. Hoy esa lista no marca a nadie.
  - Principio de Sam para los demás tenants: cualquiera de las dos cuentas tiene acceso a esas empresas. Cómo entra es P3.
  - Propuesta, si se confirman dos primarios: ninguno quita al otro desde la app; pendiente de confirmar.
- **Lo que Sam confirma en 7.4:** si las dos cuentas son dos primarios o un primario y una delegación permanente; la propuesta entre primarios; y la propuesta del delegado.
- **Delegación (sin cambios):**
  - Un primario le da superadmin a otra persona con un vencimiento (horas o fecha) o de forma permanente.
  - El delegado tiene los poderes de superadmin hasta que vence.
  - Propuesta: el delegado no puede delegar ni quitarle nada al primario; pendiente de confirmar.
  - Toda alta, vencimiento y baja deja log.
- **Qué cambia en la base:**
  - `platform_admins` suma tipo (primario o delegado), quién la dio, vence y motivo. Las dos filas actuales pasan a primario (*interpretación*, a confirmar).
  - `is_platform_admin()` deja de contar las filas vencidas.
  - La función de delegar exige ser primario.
  - Hoy las altas solo se hacen con `service_role` y sin auditoría (`0058:15-17`); eso deja de ser el único camino.
- Es la fase 6 de §5, ahora con contenido.

### 7.5 Lo que sigue abierto

- **P3: cómo entra el superadmin a otra empresa.** Sam no está seguro. Prefiere que entre como admin o miembro de esa empresa, pero que **se note** que no es un usuario de ellos: otro logo, otra tipografía o algo distinto.
  - **Hecho técnico:** hoy, con dos membresías activas, `get_user_tenant_id()` devuelve NULL (`0453:242-246`) y la RLS deja de responder (H2). Entrar «como miembro» de varias empresas exige elegir un tenant activo.
  - **Hecho técnico:** la franja «MODO PLATAFORMA» que planteaba la `0058:13` no existe en el Studio; no encontré ningún componente que la pinte.
  - **Propuesta para decidir:** una membresía de soporte por tenant, marcada como superadmin. Mientras el superadmin está dentro de una empresa, el Studio la muestra con una franja y una marca distintas. La membresía no cuenta como usuario de la empresa ni aparece en su lista de equipo.
- **P5: agentes de IA y su presupuesto. Ya está decidido (ver 7.1).** Sam se inclinaba por el admin de la empresa. Dejo como registro los pros y contras con que se decidió:

  | Opción | A favor | En contra |
  |---|---|---|
  | Lo configura el admin del tenant | Autonomía de la empresa, sin tickets. Su gasto y sus reglas son suyos. | Si el costo de los modelos lo paga la plataforma, el admin gasta dinero ajeno. El tope por agente (`budget_usd_monthly`, `0289:812-865`) no tiene techo por tenant. |
  | Lo configura el superadmin | Control del costo y de los modelos permitidos. Nada se enciende sin revisión. | Cada cambio es un pedido a la plataforma. No escala con muchas empresas. |
  | Mixto: el superadmin fija el techo y los modelos, el admin configura dentro | Autonomía con límite. Coincide con la regla de módulos de P1. | Una pieza más que construir: el techo por tenant. |

  **Decisión de Sam (2026-11-19): «si» al modelo mixto que recomendó el DG.**

  - La plataforma (superadmin) fija, por empresa, el tope mensual en USD y los modelos o proveedores permitidos.
  - El admin de la empresa configura sus agentes dentro de ese tope y con esos modelos.
  - Al llegar al 80 % del tope, se avisa a los dos: al admin de la empresa y a la plataforma.
  - Hoy el tope existe solo por agente (`budget_usd_monthly`); falta el tope por empresa y el aviso. Es la fase 9 de §8.

## 8. Plan por fases corregido (Enmienda 1)

| Fase | Qué | Tipo | Depende de |
|---|---|---|---|
| 1 | Cerrar H-S (detalle fuera del repo). | Migración con preflight, OK nominal de Sam | Nada; es lo primero |
| 2 | P6: debug, errores y actualizaciones de Chatwoot solo para el superadmin. Junto con eso: el sidebar respeta los 4 módulos SA (H7) y los avisos dejan de depender de datos del cliente (H6). | App, y base donde haya RPC | Nada |
| 3 | P4 · admin principal: la marca, la protección y que pueda nombrar admins (ajuste de los disparadores de la 0545). | SDD propia, migración y app | Confirmar 7.2 |
| 4 | P4 · auditoría: el «log fuerte» solo para el admin principal y el superadmin, y verificar que nadie borra logs. Lo de plataforma va aparte. | SDD propia, app y base | Fase 3; confirmar 7.3 |
| 5 | P7 · rango primario (las dos cuentas de Sam en DTD, según lo que confirme en 7.4), su marca en la lista de usuarios y la delegación con vencimiento y log. | SDD propia, migración y app | Confirmar las propuestas de 7.4 |
| 6 | P3 · vía de soporte en otra empresa: tenant activo, membresía de soporte y marca visual. | SDD propia, migración y app | Decidir P3 |
| 7 | P1 y P2 · catálogo de módulos por tenant, vendibles por separado. Solo el superadmin activa o desactiva. Los 4 de DTD no se ofrecen fuera de DTD. **Al desactivar** un módulo se desactivan sus permisos (matriz y accesos por persona) y nadie de la empresa lo ve, como si no existiera. **Al activarlo** entran los permisos predeterminados y desde ahí el admin configura quién accede. Hechos que hay que resolver: <ul><li>hoy el apagado vive solo en la app;</li><li>`requireFeatureEnabled` falla abierto a propósito si la lectura falla (`lib/studio/feature-flag-guard.ts:30-47`);</li><li>los módulos sin entrada en `MODULE_FLAG_MAP` son «core» y no se pueden apagar;</li><li>los accesos por persona (0538) quedan guardados al apagar.</li></ul> | SDD propia, app y base | Llega con el segundo tenant; P1 ya está decidido |
| 8 | Integraciones por tenant (H5). | SDD propia por integración | Fase 6 |
| 9 | P5 · agentes de IA con el modelo mixto: tope mensual en USD y modelos por empresa, fijados por la plataforma; el admin configura dentro; aviso a los dos al 80 %. | App y base | Nada: decidido |
