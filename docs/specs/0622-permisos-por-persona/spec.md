---
sdd: "0622"
title: "Rol base + accesos adicionales por persona en Studio"
status: approved
author: "Claude (sesión Worker sdd-permisos-persona) + Sam"
created: 2026-11-09
updated: 2026-11-11
supersedes: null
superseded_by: null
related: ["0024", "0085", "0139", "0252", "0412", "0587"]
confidencialidad: interno
---

# SDD-0622 — Rol base + accesos adicionales por persona

> En una empresa de 3 a 15 personas una misma persona hace varios oficios. Hoy Studio le da **un solo rol**
> y no hay forma de sumarle, por ejemplo, el CRM a quien lleva contabilidad. Esta spec agrega
> «accesos adicionales» por persona, solo hacia arriba, con motivo, rastro y candados.

**Estado:** aprobada por Sam el 2026-11-09 y **actualizada el 2026-11-11** con su decisión sobre módulos
sensibles (§9.1): los extras **sí** pueden abrir dinero y módulos solo de administrador, con **doble aviso**
obligatorio (también exigido por la RPC) y concedidos por un admin o un superadmin. Siguen vigentes: acceso por
módulo, vencimiento opcional, «elegir módulos» para Alejandro y el usuario «Personalizado» (§5.5). Las acciones
destructivas o gobernadas (`CAPABILITIES`) quedan fuera. R1, R2 y R3 de §8 las resolvió el Director el 2026-11-11 con la autorización de Sam («hazlo como creas tú»). La implementación está en la PR #509 y esta spec se enmendó el 2026-11-11 para coincidir con ella (§11 y §13); lo que queda a decisión de Sam está en §9 y §13.3.

## 1. Pedido que la origina

Sam (2026-11-09): puede cambiar el rol de una persona (administración, comercial, operaciones,
contabilidad, almacenista) pero no personalizar a la persona. Caso concreto: **Alejandro** tiene rol
`accounting` y además atiende CRM. Quiere habilitarle Comercial completo o definir qué parte de Comercial
ve. Pidió además ver cómo lo resuelven QuickBooks y otras aplicaciones, y planificar antes de construir.

## 2. Qué existe hoy (verificado en el repo, 2026-11-09)

| Pieza | Dónde | Qué hace |
|---|---|---|
| Un rol por persona | `user_tenants.role` con CHECK de 7 valores (`0019_users_roles.sql:42-47`, ampliado en `0189_marketing_role.sql`) | La persona tiene exactamente un rol por tenant |
| Matriz módulo×rol en código | `lib/studio/rbac.ts` → `ROLE_MODULE_ACCESS` | Qué rol ve cada módulo. `kommo` (CRM) es solo `["commercial"]` |
| Candados de gobernanza | `lib/studio/rbac.ts` → `MONEY_MODULES`, `ADMIN_ONLY_MODULES`, `LOCKED_MODULES`, `SUPERADMIN_ONLY_MODULES` | Dinero = `accounting`; admin-only = `[]`. No se abren por override |
| Guards del servidor | `lib/studio/rbac-guard.ts` → `getStudioAccess`, `requireModuleView`, `moduleEditDenial`, `moduleEditGate`, `moduleViewDenial` | Único punto que resuelve rol, scope de almacén y overrides |
| Desvíos **por rol** | tabla `studio_role_module_overrides` (`0357_role_module_overrides.sql:44-66`), SDD-0252 | Cambia el acceso de **todos** los de un rol, no de una persona |
| Scope de almacén por persona | `user_tenants.warehouse_scope` (migr. 0202), SDD-0139 §C | Único atributo por persona que ya existe |
| Anti-drift de RBAC | `lib/studio/rbac-guard.test.ts`, `rbac-actions-guard.test.ts` | Cada server action debe tener guard antes del primer dato y de la primera escritura |

Resultado: Alejandro no ve CRM porque la matriz dice `kommo: ["commercial"]`. Cambiar la matriz **por rol**
(0357) le abriría el CRM a **todos** los de contabilidad, que no es lo que se pide.

## 3. Decisión previa que esta spec reabre

SDD-0139 (2026-07-02), tabla de decisiones, **punto D**: «Overrides por usuario: **NO.** Rol puro + scope.
"Nadie recuerda por qué María tiene algo distinto al rol". Si alguien necesita otro acceso → el rol está
mal asignado». La propia 0139 dice que lo descartado se reabre ante «gatillo de negocio real» o «el primer
pedido real del founder, como spec propia». Este es ese pedido.

**Esta spec reemplaza únicamente el punto D de la 0139.** El resto de la 0139 sigue vigente: matriz base en
código, V·E binario más capabilities, scope de almacén, candados como invariante ejecutable. No se marca la
0139 como `superseded` entera, porque solo se revisa un punto.

La objeción de la 0139 («nadie recuerda por qué») no se ignora: se atiende con motivo obligatorio, rastro
de auditoría, vencimiento opcional y una lista visible de excepciones (§5.4).

## 4. Cómo lo resuelven otros sistemas

> Escrito de memoria, **sin verificar en línea** en esta tarea. Sirve para orientar el diseño, no como
> cita. Si se va a invocar como argumento en una decisión, verificar primero.

- **QuickBooks Online:** acceso completo o limitado por áreas (clientes y ventas, proveedores y gastos),
  más roles restringidos; algunos planes permiten roles personalizados.
- **QuickBooks Desktop:** una persona puede tener **varios roles**; los roles personalizados dan permisos
  por área (ver, crear, editar, eliminar, imprimir).
- **Odoo / Zoho Books:** permisos que **se suman** (grupos o roles); la persona tiene un rol base y
  accesos extra.

Patrón común: el rol es una plantilla; los permisos finales de la persona son **aditivos**. Eso es lo que
se adopta, con granularidad de módulo (la de Studio) y no por celda V/C/E/D.

## 5. Diseño propuesto

### 5.1 Modelo de datos

Tabla nueva `public.studio_user_module_grants` (nombre provisional), escrita **solo por RPC**, a imagen de
`0357`:

| Columna | Tipo | Nota |
|---|---|---|
| `tenant_id` | uuid, FK `tenants` | parte de la PK |
| `user_id` | uuid, FK `auth.users` | parte de la PK |
| `module_id` | text | id del registro `modules.ts`; parte de la PK |
| `can_view` | boolean not null default true | |
| `can_edit` | boolean not null default false | CHECK: `not can_edit or can_view` (igual que 0357) |
| `reason` | text not null | motivo obligatorio, longitud mínima |
| `expires_at` | timestamptz null | vencimiento opcional (§9.3) |
| `granted_by` | uuid, FK `auth.users` | quién lo dio |
| `created_at` / `updated_at` | timestamptz | |

Reglas:

1. **Solo suma.** Una fila nunca quita un permiso que el rol ya da. No existe «quitar acceso» por persona
   en esta spec (si algo hay que quitar, se cambia el rol).
2. **Módulos sensibles: sí se conceden, con doble aviso (decidido por Sam el 2026-11-11, §9.1).** Un extra
   puede abrir también los módulos hoy «bloqueados»: dinero (`MONEY_MODULES`) y solo-administrador
   (`ADMIN_ONLY_MODULES`), o sea el conjunto `LOCKED_MODULES` de `lib/studio/rbac.ts`. Lo concede un **admin o un
   superadmin** (los límites que quedan por decidir están en R1 y R2 de §8). Condiciones:
   - **Doble aviso obligatorio.** Al conceder un módulo sensible, la pantalla muestra una alerta que lista en
     concreto lo que esa persona podrá hacer («Esta persona podrá hacer estas modificaciones, ¿estás seguro?») y
     pide confirmación explícita.
   - **El aviso no es solo de interfaz.** La RPC recibe `p_confirm_sensitive boolean` (por defecto `false`): si el
     módulo es sensible y no llega `true`, falla con error de confirmación. Al aceptar, escribe en
     `entity_audit_log` que se confirmó y con qué versión de la lista de efectos se le mostró. Esa lista vive en
     código (un mapa `SENSITIVE_MODULE_EFFECTS`) para que la pantalla y el registro usen el mismo texto.
   - **Doble candado en la tabla.** La tabla lleva `sensitive_confirmed_at`, y un CHECK exige que no sea nula
     cuando `module_id` está en la lista sensible: la base misma impide una fila sensible sin confirmación.
   - **El candado de la 0357 no se toca.** `studio_role_module_overrides_locked_check` queda como está: los
     desvíos **por rol** siguen sin abrir módulos bloqueados. La tabla nueva no lleva ese CHECK; lleva el de
     confirmación. `LOCKED_MODULES`, `MONEY_MODULES` y `ADMIN_ONLY_MODULES` no cambian de contenido; solo
     `canAccessModule`/`canEditModule` aceptan extras sobre ellos.
   - **Las capabilities quedan fuera.** Un extra por módulo no otorga `CAPABILITIES` (`delete_shipments`,
     `delete_warehouse_receipts`, `void_payroll_settlement`, `void_expense`, `fix_frozen_rate`,
     `approve_money`, `view_defense_file`, `moderate_comments`, `restore_comments`, `audit_view`,
     `audit_view_sensitive`, `escucha_activa`): siguen atadas a su rol o a admin, y sus funciones en la base
     (`void_expense_governed`, `congelar_tarifa_recepcion`, `soft_delete_admin_tenant_internal`…) no cambian.
     Incluirlas sería otra decisión de Sam, con su propia spec. Sam lo pidió así: «no puede borrar archivos ni
     bases de datos».
3. **`support` sigue read-only.** Un extra no le da edición a `support` (`canEditModule` ya lo corta antes).
4. **Concede un admin o un superadmin.** RPC `studio_grant_user_module(p_user_id, p_module_id, p_can_view,
   p_can_edit, p_reason, p_expires_at, p_confirm_sensitive)` y `studio_revoke_user_module_grant(...)`.
   `SECURITY DEFINER`, `search_path` fijo, `assert_studio_role(array['admin'])` al principio (helper de `0351`),
   tenant tomado de `get_user_tenant_id()`, destino validado como miembro **activo** (`disabled_at is null`).
   Quien tenga `users` o `admin` solo por extra **no** puede ejecutar estas RPC, porque la base sigue exigiendo
   rol `admin` (mitigación de R1, §8; resuelta; firma y nombres definitivos en §13.1).
5. **Sin escritura directa.** RLS activa; `authenticated` sin INSERT/UPDATE/DELETE; solo `service_role` y
   las RPC. SELECT solo para admin y para la propia persona (para que vea qué tiene y por qué).
6. **Auditoría.** Cada concesión, cambio y revocación escribe en `entity_audit_log` con actor, destino,
   módulo, permisos, motivo y, en módulos sensibles, la confirmación y la versión de la lista de efectos. Requiere registrar la entidad en el catálogo de auditoría (precedente:
   `0258`, `0291`, `0293`). Ver nota en §8 sobre borrado.
7. **Anti-lockout no aplica**, pues solo suma; no puede dejar al tenant sin admin.

### 5.2 Resolución del acceso efectivo (aplicación)

`getStudioAccess` (`lib/studio/rbac-guard.ts:78`) ya carga los desvíos por rol de `getRoleModuleOverrides`.
Se agrega la carga de los accesos de la persona (solo si no es admin y filtrando `expires_at is null or
expires_at > now()`), y se pasan a `canAccessModule` / `canEditModule` (`lib/studio/rbac.ts:338`, `:358`).

Orden de decisión para un no-admin:

1. `admin` → permitido (sin cambios).
2. Módulo **sensible** (`LOCKED_MODULES`): se resuelve igual que los demás, con dos precisiones. Los desvíos
   **por rol** siguen ignorándose en estos módulos (candado de la 0357), y un extra solo vale si la fila trae
   `sensitive_confirmed_at`. Para los 4 `SUPERADMIN_ONLY_MODULES` el segundo candado `is_platform_admin()` de
   `rbac-guard.ts` **sigue aplicándose** hasta que Sam decida R2 (§8).
3. Acceso por rol (default de código o desvío por rol, como hoy) → si lo da, permitido.
4. Si no, ¿hay acceso adicional vigente de la persona para ese módulo? → ver/editar según la fila.
5. El scope de almacén (`scopeAllowsModule`) **sigue aplicando encima**: un extra no salta el lado CN/VE.

Como sidebar, `requireModuleView`, `moduleEditDenial`, `moduleEditGate`, `moduleViewDenial` y la búsqueda
global ya pasan por estas dos funciones, no hay que tocar cada page ni cada action. Las firmas nuevas deben
ser **opcionales** y compatibles hacia atrás, como se hizo en 0252.

### 5.3 La base de datos también decide (esto es lo que más pesa)

No basta con el código: la base repite el rol en varios sitios. Hallazgos de la lectura de
`supabase/migrations` (solo lectura, sin tocar producción ni leer datos):

| Hallazgo | Dónde | Efecto en el caso Alejandro |
|---|---|---|
| `current_studio_role()` devuelve el rol de `user_tenants` | `0200_rbac_disabled_enforcement.sql:70` | Fuente de verdad del rol en SQL; hoy sin noción de extras |
| `assert_studio_role(text[])` | `0351_operario_rpc_exige_rol.sql:32` | Gate de RPC por lista de roles |
| `crm_puede_usar()` = `admin` o `commercial` | `0506_crm_modelo.sql:186-194` | **Cierra el CRM** para Alejandro aunque la UI se lo muestre |
| `document_entity_authorized(entity, tenant, access)` con mapa entidad→módulo→roles y **ya** consulta `studio_role_module_overrides` | `0444_unlinked_document_entity_rbac.sql:73-150` (cadena 0439–0444) | Punto central ideal para sumar los accesos por persona en documentos de clientes/proveedores/etc. |
| Escritura de `clients` pasa por `document_entity_authorized('client', …, 'edit')` | `0456_clients_write_rbac.sql:24` | Hay que cubrirla o Alejandro vería clientes pero no podría editarlos |
| RPC con lista fija de roles | `0358`/`0361` (fusión de clientes), `0367`, `0371` (`assert_studio_role(array['admin','commercial','operations'])`) | Acciones puntuales que requieren decisión módulo a módulo |
| Fachadas con roles fijos | `0411`, `0412`, `0413` (`v_role in (...)`), `0466:187` | Idem |
| `quotes`, `sales_orders`, `suppliers` con RLS **solo por tenant** | `0007_quotes.sql:83`, `0125_sales_orders.sql:186`, `0236_supplier_scorecard.sql:300-311` | Aquí el rol no se exige en la base: basta el cambio de aplicación |
| Nómina exige `admin`/`accounting` en SQL | `0160_nomina_employees.sql:71-85` | Es dinero + PII: queda **fuera** (candado) |
| Conteo grueso | ~61 migraciones con `ut.role in/=`, ~25 con `current_studio_role()`, ~14 con `assert_studio_role(` | Es una cota para dimensionar, no un inventario exacto (ver Fase 1) |

Conclusión: el cambio es **mixto**. En módulos con RLS solo por tenant alcanza con la capa de aplicación; en
CRM, clientes y documentos hay que enseñarle a la base. Propuesta: una función
`public.user_has_module(p_module_id text, p_edit boolean default false)` (`STABLE`, `SECURITY DEFINER`,
`search_path` fijo) que replica el orden de §5.2 y que las funciones de la base llamen en lugar de comparar
roles sueltos. Se migra **por fases y solo lo que Comercial necesite**, empezando por `crm_puede_usar()` y
`document_entity_authorized`. El resto de las 71 migraciones no se reescribe en bloque.

⚠️ Riesgo a controlar: que la UI muestre un módulo y la base lo rechace deja pantallas vacías o errores
confusos. Por eso un módulo **no se puede conceder** desde la UI hasta que su capa de base esté marcada como
«cubierta» en una lista de módulos concedibles (ver §5.4). Así nunca se ofrece algo que no funciona.

### 5.4 Pantalla (módulo Usuarios, solo admin)

- En la ficha de la persona: botón **«Agregar acceso»** → elegir módulo(s) de una lista **agrupada por
  área** (Comercial: CRM, Cotizaciones, Clientes, Conversaciones, Bandeja…), cada uno con «Solo ver» o «Ver
  y editar», **motivo obligatorio** y vencimiento opcional. Atajo: «Agregar todo Comercial».
- Se ofrecen los módulos **ya cubiertos en la base** (§5.3). Los sensibles llevan la etiqueta «Sensible» y al
  concederlos aparece el **doble aviso** con la lista concreta de efectos y una confirmación explícita (§5.1
  regla 2). `users`, `admin` y los 4 módulos del superadministrador solo se ofrecen cuando Sam resuelva R1 y R2.
- Panel **«Accesos efectivos»**: rol base + extras, indicando de dónde viene cada permiso («por rol» o
  «adicional · motivo · quién · cuándo · vence»).
- Lista **«Personas con excepciones»** en Usuarios, con filtro de por vencer y vencidos.
- Ante la objeción de la 0139, el criterio es: nadie debería preguntarse por qué Alejandro tiene CRM;
  la pantalla lo dice.

Los textos van en español de Venezuela, tuteo. Cambios visuales sustanciales pasan por `/ui-check` y lo
dicho en `BRAND.md` y `docs/design/README.md`.

### 5.5 Usuario «Personalizado» (Customize) — pedido de Sam 2026-11-09

Sam quiere poder **crear un usuario totalmente personalizado**, sin partir de un rol. Propuesta:

- Nuevo valor de rol base **`custom`** («Personalizado»), junto a los siete actuales. Su acceso por defecto es
  **solo lo transversal** (los módulos que hoy ven todos los roles: `dashboard`, `calendar`, `bitacora`,
  `mentions`, `bugs`, `mis-bugs`; `documents` por confirmar). Todo lo demás lo define el admin módulo por
  módulo con los mismos accesos adicionales de §5.1 (ver / ver y editar, motivo, vencimiento opcional).
- En la invitación y en «Cambiar rol» aparece la opción **Personalizado**; al elegirla se abre directamente el
  selector «Agregar acceso» (§5.4), con atajos por área («todo Comercial», «todo Operaciones», etc.).
- Aplican las mismas reglas: concede admin o superadmin, doble aviso en módulos sensibles, capabilities fuera,
  todo auditado. `custom` **nunca** da edición implícita: sin extra no hay acceso.
- Impacto técnico (a medir en la Fase 1, no a adivinar): el rol está duplicado en CHECK de `user_tenants` y
  `user_invitations`, en las RPC que validan listas de roles (`studio_invite_user`, `studio_change_user_role` y
  sus reemplazos: 0189, 0200, 0203, 0355…) y en funciones con `v_role not in (...)` (0411–0413). Un rol
  desconocido hoy **falla cerrado** en esas fachadas, que es lo seguro; cada una se revisa antes de
  concederse. Para `custom` valen la tabla de accesos y `user_has_module` (§5.3): comparar el rol suelto
  deja de bastar.
- Alternativa descartada: «rol Personalizado = `support` + extras». `support` es read-only inmutable y
  arrastra accesos por defecto que Sam no pidió.

## 6. Fases

| Fase | Contenido | Entrega |
|---|---|---|
| **1 · Auditoría** | Inventario exacto (solo lectura) de qué políticas RLS y funciones SQL exigen rol en tablas/RPC de Comercial y documentos. Resultado: lista «cubierta / requiere cambio / fuera» por módulo | Anexo de esta spec |
| **2 · Datos y RPC** | Migración de la tabla, RPC de conceder/revocar, `user_has_module`, auditoría, pruebas de contrato en PGlite | Migración con espera de OK de Sam y runbook de producción |
| **3 · Aplicación** | Cargar extras en `getStudioAccess`; extender `canAccessModule`/`canEditModule`; pruebas | PR |
| **4 · Base, Comercial** | `crm_puede_usar()`, `document_entity_authorized` y lo que arroje la Fase 1 | Migración aparte |
| **5 · Pantalla** | «Agregar acceso», «Accesos efectivos», «Personas con excepciones» | PR + `/ui-check` |
| **6 · Personalizado** | Rol base `custom` (§5.5): CHECK, invitación, cambio de rol, revisión de fachadas que comparan roles | Migración aparte + PR |
| **7 · Alejandro** | Concederle Comercial y los módulos sensibles que Sam indique (p. ej. tesorería), cada uno con motivo; comprobar por pantallas y roles | Smoke con Sam |
| **8 · Dinero para quien no es contabilidad** | Migrar las funciones y RLS de dinero que hoy exigen rol (§12.2) para que un extra de dinero funcione a un `custom` u otro rol. Fase **propia**, con su migración y su OK nominal de Sam, separada de Comercial. Decisión del Director 2026-11-11: se suma **redefiniendo `studio_can_read_money()`** (migración 0528, SDD-0624, PR #515) con `user_has_module`, en lugar de tocar cada función | Migración aparte + PR; OK de Sam |

Ninguna migración se aplica a producción sin OK nominal de Sam y el runbook
`docs/runbooks/aplicar-migraciones-prod.md`; el ledger de producción es validación de release, no motivo para
aplicar antes de aprobar la PR.

## 7. Pruebas de aceptación

1. **Caso Alejandro:** rol `accounting` + extra `kommo` (ver y editar) → ve y usa CRM; sigue sin ver módulos
   que su rol ni su extra incluyen (p. ej. `users`, `legal`).
2. **Solo suma:** un extra nunca reduce lo que el rol ya da.
3. **Doble aviso y candados:** (a) la RPC rechaza un módulo sensible sin `p_confirm_sensitive = true` y la tabla
   rechaza por CHECK una fila sensible sin `sensitive_confirmed_at`; (b) con confirmación se acepta `treasury`
   (caso Alejandro) y queda una fila en `entity_audit_log` con la confirmación y la versión de efectos; (c) el CHECK
   de la 0357 sigue rechazando desvíos **por rol** sobre módulos bloqueados (no se tocó); (d) con un extra de dinero
   **no** se obtiene ninguna capability (`delete_shipments`, `void_payroll_settlement`, `moderate_comments`,
   `audit_view_sensitive`, …); (e) un extra sobre `users` no permite llamar a las RPC de conceder ni cambiar roles.
4. **`support`:** un extra de edición no le da edición.
5. **Vencimiento:** pasada `expires_at`, el acceso desaparece sin tocar nada; antes de vencer funciona.
6. **Persona desactivada:** sin `disabled_at is null` no hay acceso ni extra (ya cubierto en `getStudioAccess`).
7. **Concede solo admin o superadmin:** un no-admin que llama la RPC directo recibe `42501`; la tabla no acepta escritura
   directa de `authenticated`.
8. **Base y aplicación coinciden:** para cada módulo concedible, el mismo (rol, extra) da el mismo resultado
   en `canAccessModule` y en `user_has_module`. Contrato en PGlite (patrón `.test.sql`) y un mutante que
   rompa el candado para comprobar que la prueba falla.
9. **Anti-drift:** `rbac.test.ts`, `rbac-guard.test.ts` y `rbac-actions-guard.test.ts` siguen verdes; las
   acciones nuevas nacen con guard `admin` antes de escribir.
10. **Auditoría:** cada concesión/revocación deja fila con actor, destino, módulo y motivo.
11. **Scope de almacén:** un extra no salta `warehouse_scope`.
12. **Usuario `custom`:** sin extras solo ve lo transversal; con un extra de `kommo` ve CRM y nada más; un
    `custom` no puede editar nada sin `can_edit`; las fachadas que comparan roles (0411–0413) devuelven
    denegado, no error.
13. **Privacidad:** sin PII ni datos de negocio en fixtures ni en el repo; revisión con
    `.claude/skills/revisar-datos-ve/SKILL.md` si se guarda algo personal más allá de IDs.

## 8. Riesgos y puntos a no olvidar

- **Interfaz que promete lo que la base niega** → mitigado con la lista «cubierta» de §5.3.
- **Ampliar permisos por error** (el error más caro de este carril, ver cabecera de
  `rbac-actions-guard.test.ts`): nada se mueve de «deuda» a «excepción». Abrir módulos sensibles por persona está
  permitido por decisión de Sam, así que cada concesión sensible exige doble aviso, queda con motivo y aparece
  resaltada en «Personas con excepciones»; las capabilities destructivas no son concedibles.
- **R1 · Escalada de privilegios (decidido por el Director el 2026-11-11, con autorización de Sam).** Un extra sobre `users` o `admin` podría servir para dar
  accesos a otros o a uno mismo. Mitigación propuesta: (a) conceder/revocar extras, cambiar roles y desactivar
  personas siguen exigiendo rol `admin` en la base; (b) un extra sobre `users`/`admin` queda de **solo lectura
  efectiva**; (c) la RPC rechaza que alguien se conceda extras sensibles a sí mismo; (d) el doble aviso dice
  expresamente «esta persona verá la gestión de usuarios». **Resolución adoptada:** un extra sobre `users`/`admin` da solo lectura (CHECK `studio_user_module_grants_keystone_read_only`) y nadie se concede extras a sí mismo; conceder sigue exigiendo el rol `admin` en la base.
- **R2 · Módulos del superadministrador (decidido por el Director el 2026-11-11, con autorización de Sam).** `financiero-china`, `legal`, `no-olvidar` y
  `renditions` exigen además `is_platform_admin()` (`rbac.ts`, `SUPERADMIN_ONLY_MODULES`; en la base `0355`/`0356`).
  Preguntas: ¿quién puede otorgarlos? Propuesta: solo quien cumpla `is_platform_admin()`, no cualquier admin. ¿Debe
  el receptor pasar el segundo candado? Hoy el guard lo exige en cada vista y acción, así que un extra a quien no es
  superadmin de plataforma **no abriría nada**. Opción A: mantenerlo (el extra casi no tiene efecto). Opción B:
  reemplazar el segundo candado por una confirmación reforzada, lo que cambia `0355`/`0356` y requiere spec
  aparte. **Resolución adoptada:** los 4 módulos del superadministrador solo los otorga quien cumpla `is_platform_admin()`, y el segundo candado del receptor se mantiene (opción A).
- **R3 · Dinero por persona exige cambiar la base (decidido por el Director el 2026-11-11, con autorización de Sam).** Abrir dinero a quien no es contabilidad
  obliga a cambiar funciones y RLS que hoy comparan el rol (inventario con archivo:línea en §12.2). Se propone una
  **fase propia** (§6, fase 8), con su migración y su OK de Sam, separada de Comercial. **Resolución adoptada:** fase propia; se suma redefiniendo `studio_can_read_money()` de la 0528 (SDD-0624, PR #515).
- **Acumulación de excepciones** (la objeción de la 0139) → motivo, vencimiento opcional, lista visible.
- **Borrado no limpia el rastro**: borrar un extra no borra `entity_audit_log`; contar antes de ensayar.
- **Preview comparte Supabase con producción**: no probar concesiones reales en Preview.
- **Doble fuente de verdad** (código y base) → un único contrato que compare ambas (§7.8).
- **Matriz por rol (0357) y extras por persona** conviven; la spec define el orden en §5.2 para que no haya
  ambigüedad.

## 9. Decisiones

| # | Decisión | Resultado | Estado |
|---|---|---|---|
| 9.1 | ¿Los extras abren módulos sensibles (dinero y solo-administrador)? | **Sí.** Los puede conceder un admin o un superadmin, con **doble aviso obligatorio** que liste en concreto lo que esa persona podrá hacer y confirmación explícita, exigida también por la RPC y registrada en auditoría (§5.1 regla 2). El CHECK de la 0357 no se toca. Las capabilities quedan fuera | Decidido por Sam 2026-11-11 (reemplaza la decisión del 2026-11-09). **Pendiente de Sam:** nómina |
| 9.2 | Granularidad | **Por módulo** (ver / ver y editar). Acciones finas quedan para fase 2 | Decidido por Sam 2026-11-09 |
| 9.3 | Vencimiento | **Opcional** | Decidido por Sam 2026-11-09 |
| 9.4 | Alcance de «parte de Comercial» | **Elegir módulos** (p. ej. CRM sí, Cotizaciones no). Filtrar etapas o embudos dentro del CRM sería otra spec | Decidido por Sam 2026-11-09 |
| 9.5 | Usuario **Personalizado** | Rol base `custom` + accesos módulo a módulo (§5.5) | Pedido de Sam 2026-11-09; **pendiente de confirmar por Sam** que el diseño de §5.5 es lo que quiere |
| 9.6 | R1 · Escalada con `users`/`admin` | Solo lectura y sin auto-concesión (§8) | Decidido por el Director 2026-11-11, con autorización de Sam |
| 9.7 | R2 · Módulos del superadministrador | Solo los otorga `is_platform_admin()`; el receptor sigue pasando el segundo candado (opción A) | Decidido por el Director 2026-11-11, con autorización de Sam |
| 9.8 | R3 · Fase propia para dinero | Fase 8, redefiniendo `studio_can_read_money()` (0528, SDD-0624, PR #515) | Decidido por el Director 2026-11-11, con autorización de Sam |

Pregunta abierta, **sin valor asumido**:

- Si se concede `clients` con edición: ¿incluye la fusión de fichas (`0358`/`0361`), que hoy exige rol?
- ¿`documents` es transversal también para `custom`?

## 10. Fuera de alcance

- Crear **roles nombrados** reutilizables (plantillas propias) o editar la matriz base desde la UI. El
  «Personalizado» de §5.5 es por persona, no una plantilla compartida.
- Conceder `CAPABILITIES` (acciones destructivas o gobernadas) por persona: siguen por rol o admin.
- Quitar permisos por persona (solo se suma).
- Acciones finas dentro de un módulo (fase 2).
- Reescribir en bloque las ~71 migraciones con chequeos de rol.
- Permisos de Chatwoot dentro de la bandeja: los decide su propio rol (nota en `rbac.ts`, `bandeja`).
- Acceso al portal de clientes, PWA de operarios y PINs (`operarios`).

## 11. Allowlist exacta de archivos (enmendada el 2026-11-11 para coincidir con la implementación)

La allowlist original (2026-11-09) se quedó corta: la implementación (PR #509, rama
`claude/impl-permisos-por-persona-10d044`, cabeza `a44b77066`) toca archivos que la spec no nombraba, porque los
extras tienen que verse y funcionar en **todos** los sitios donde se evalúa a la persona de la sesión (sidebar,
⌘K, exportaciones, PDF, dashboard, CRM, gates de acciones). La lista de abajo sale de
`git diff --name-only origin/main...origin/claude/impl-permisos-por-persona-10d044` y es la **exacta**; cualquier otro
archivo requiere enmendar esta spec primero.

**Migraciones definitivas** (las tres sin aplicar en ningún entorno remoto; las numeraciones previas 0526 y 0527 de esta tarea ya no valen (0526 es de la #507 y 0528 de la SDD-0624) y la
numeración original de esta spec tampoco):
- `supabase/migrations/0529_studio_user_module_grants.sql`
- `supabase/migrations/0530_comercial_acepta_accesos_por_persona.sql`
- `supabase/migrations/0531_comercial_rls_por_modulo.sql`

**Contratos SQL**
- `supabase/tests/0529_studio_user_module_grants.test.sql`
- `supabase/tests/0530_comercial_acepta_accesos_por_persona.test.sql`
- `supabase/tests/0531_comercial_rls_por_modulo.test.sql`

**Biblioteca (`lib/`)**
- `lib/studio/__tests__/user-module-grants.migration.test.ts`
- `lib/studio/client-account.ts`
- `lib/studio/crm-tablero.ts`
- `lib/studio/discord/consulta/consulta.ts`
- `lib/studio/global-search/facets.ts`
- `lib/studio/global-search/search-action.test.ts`
- `lib/studio/global-search/search-action.ts`
- `lib/studio/rbac-actions-guard.test.ts`
- `lib/studio/rbac-guard.ts`
- `lib/studio/rbac.test.ts`
- `lib/studio/rbac.ts`
- `lib/studio/user-module-grants-queries.ts`
- `lib/studio/user-module-grants.ts`

**Aplicación (`app/`)**
- `app/api/studio/comercial/export/route.ts`
- `app/api/studio/operativo/export/route.ts`
- `app/studio/(app)/_components/StudioSidebar.tsx`
- `app/studio/(app)/_components/StudioTopbar.tsx`
- `app/studio/(app)/bandeja/actions.ts`
- `app/studio/(app)/clientes/[markbox]/estado-de-cuenta/pdf/route.ts`
- `app/studio/(app)/clientes/[markbox]/page.tsx`
- `app/studio/(app)/cobranzas/__tests__/receivable-history-gate.test.ts`
- `app/studio/(app)/conversaciones/__tests__/send-reply-gate.test.ts`
- `app/studio/(app)/cotizador/[code]/pdf/route.ts`
- `app/studio/(app)/cotizador/actions.ts`
- `app/studio/(app)/crm/__tests__/lecturas-y-conversion-gate.test.ts`
- `app/studio/(app)/crm/__tests__/tarjeta-actions-gate.test.ts`
- `app/studio/(app)/crm/_components/CrmEmbudosSlot.tsx`
- `app/studio/(app)/crm/tarjeta-actions.ts`
- `app/studio/(app)/dashboard/__tests__/kpi-respaldo.test.ts`
- `app/studio/(app)/dashboard/page.tsx`
- `app/studio/(app)/facturacion/[code]/pdf/route.ts`
- `app/studio/(app)/financiero-china/__tests__/lecturas-socio-gate.test.ts`
- `app/studio/(app)/layout.tsx`
- `app/studio/(app)/operarios/__tests__/reset-pin-actions.test.ts`
- `app/studio/(app)/operarios/__tests__/update-operario-actions.test.ts`
- `app/studio/(app)/tarifas/actions.ts`
- `app/studio/(app)/tracking/[id]/__tests__/tarifa-sugerida-gate.test.ts`
- `app/studio/(app)/tracking/[id]/actions.ts`
- `app/studio/(app)/usuarios/_components/MembersTable.tsx`
- `app/studio/(app)/usuarios/_components/UserDetailDrawer.tsx`
- `app/studio/(app)/usuarios/_components/UsersClient.tsx`
- `app/studio/(app)/usuarios/_components/acceso/AccesoPanel.test.tsx`
- `app/studio/(app)/usuarios/_components/acceso/AccesoPanel.tsx`
- `app/studio/(app)/usuarios/_components/acceso/ActividadAcceso.tsx`
- `app/studio/(app)/usuarios/_components/acceso/DobleAvisoDialog.tsx`
- `app/studio/(app)/usuarios/_components/acceso/permisos.css`
- `app/studio/(app)/usuarios/_components/ficha/RolYAlcanceCard.test.tsx`
- `app/studio/(app)/usuarios/_components/ficha/RolYAlcanceCard.tsx`
- `app/studio/(app)/usuarios/actions.ts`
- `app/studio/(app)/usuarios/page.tsx`

**Documentación**
- `.agents/handoffs/sdd-0622-impl-permisos-por-persona.md`
- Esta spec y su índice.
- La cabecera de `lib/studio/rbac.ts` (ya actualizada por la implementación: «la SDD-0622 reemplaza el punto D de la 0139»).

**Fuera de la allowlist, por decisión:** `supabase/migrations/` ya aplicadas, `.env*`, datos de producción, portal
público, PWA de operarios, Chatwoot (incluido `lib/studio/chatwoot/agentes-*` y `bandeja/page.tsx`), las funciones y RLS
de dinero (fase 8) y el rol `custom` (fase 6).

## 12. Anexo · Fase 1 — inventario de la base (solo lectura, 2026-11-09)

Método: se recorrió `supabase/migrations` (0001–0524), se tomó la **última definición** de cada función y de cada
policy vigente (descartando las que una migración posterior borra) y se buscó dónde compara el rol:
`user_tenants.role`, `current_studio_role()`, `assert_studio_role()`, `is_tenant_admin()`, `v_role in (...)`,
`role in ('…')` y `document_entity_authorized()`. No se leyó ningún dato de producción.

**Límites del método (no es un veredicto):** es una lectura de texto, no del catálogo real de Postgres. Las
policies creadas dentro de bloques `DO`/`EXECUTE` (p. ej. parte de la 0456) se ven de forma parcial; una función
puede ser redefinida fuera de `supabase/migrations`; y «compara el rol» no dice si la comparación es correcta.
Antes de la Fase 4 hay que repetirlo contra el catálogo de una base efímera (`pg_proc`/`pg_policy`).

**Cifras:** 589 funciones y 685 policies vigentes; **235 objetos** con algún chequeo de rol. Un objeto puede
sumar varios patrones: `user_tenants.role` 99 · `current_studio_role()` 63 · `is_tenant_admin()` 39 ·
`role in ('…')` 33 · `document_entity_authorized()` 27 · `v_role in (...)` 12 · `assert_studio_role()` 9.

| Grupo | Qué hay (archivo) | Efecto para extras / `custom` | Veredicto |
|---|---|---|---|
| **A · Control del sistema** (solo admin) | Mailing `0408`; bugs `0028`/`0029`; SEO y noticias `0053`–`0055`, `0518`; Telegram `0386`; Chatwoot admin `0503`–`0507`, `0509`, `0522`; etapas CRM `0506` (escritura); códigos de marca `0334`/`0339`; legal y rendiciones `0356`; ajustes fiscales/contables `0126`/`0133`; auditoría `0201`, `0270`, `0289`–`0301`, `0398` | Concedibles con doble aviso (§5.1 regla 2), sujetos a R1 y R2. En la base, los gates de rol `admin` siguen mandando | **Depende de R1/R2** |
| **B · Dinero por rol `accounting`** | Facturas `0407`/`0414`; conciliación `0409`; cobros y pagos a proveedores `0467`/`0468`/`0470`; cuentas y asientos `0510`/`0511`; libros fiscales y retenciones `0165`/`0166`; gastos `0074`; reportes de pago `0422`; nómina `0160` (`nomina_can_access`); cierre y edición contable `0493` | **Alejandro ya los tiene** por ser `accounting`. Un extra de dinero a quien no sea `accounting` (incluido `custom`) **no funcionaría** hasta migrar estas ~45 piezas | **Requiere cambio** solo para `custom` o roles distintos de contabilidad; **no** para Alejandro |
| **C · Comercial con rol fijo** | `crm_puede_usar()` = `admin`/`commercial` (`0506:186-194`); `document_entity_authorized` y el mapa entidad→módulo (`0444`, escrituras de clientes `0456`); `update_shipment_plan` (`0305`); `rename_client_markbox` (`0371`); identidad de facturación (`0466`) | Sin cambio en la base, Alejandro **ve** el CRM en pantalla y la base se lo cierra | **Requiere cambio** (primera tanda) |
| **C2 · Comercial ya compatible con contabilidad** | Fachadas `0411`/`0412`/`0413` y `merge_clients` (`0358`/`0361`) ya incluyen `accounting`; `client_outstanding` (`0492`) | Funcionan para Alejandro; **fallan cerrado** ante `custom` hasta incluirlo | Cubierta para Alejandro; **requiere cambio** para `custom` |
| **D · Comercial sin rol en la base** | `quotes` (`0007`), `sales_orders` (`0125`), parte de proveedores (`0236`): RLS solo por tenant | Basta el cambio de aplicación | **Cubierta** |
| **E · Operación y almacén** | Operarios `0475`; naviera `0477`/`0482`; SENIAT `0484`; TMS `0486`; entrega VE `0487`; despacho `0489`; tarifa congelada `0496`; funciones de operarios `bodeguero_*`/`camionero_*` (`0288`/`0336`) con `v_role` | No se necesitan para el caso de Alejandro | **Fuera de esta spec** (se revisan si se pide) |
| **F · Acciones destructivas o gobernadas** | Anulaciones y borrados: `0316`, `0340`, `0470`, `0476`, `0497`, `0262` | Los extras no las otorgan (§5.1 regla 2) | **Fuera** por decisión |

### Conclusión para el plan

1. **Caso Alejandro (contabilidad + CRM + módulos sensibles):** la base ya lo deja trabajar en dinero y en lo
   comercial que incluye `accounting`. El cambio mínimo en la base es el de **C**: `crm_puede_usar()` y, si se le
   suman clientes con edición completa, `document_entity_authorized`/`0456`. Eso es una tanda pequeña.
2. **Usuario `custom`:** es donde se concentra el trabajo grande. Sin migrar el grupo B y C2, un `custom` con
   extras de dinero o de clientes vería módulos que la base le niega. Por eso en la Fase 5 un módulo solo se
   ofrece a un `custom` cuando su grupo esté marcado «cubierto» (§5.3).
3. **Orden sugerido de tandas:** (i) tabla, RPC (con doble aviso) y aplicación para roles existentes (Alejandro);
   (ii) base para Comercial (grupo C); (iii) rol `custom` + C2; (iv) **fase propia de dinero** (grupo B y §12.2), con
   su migración y su OK de Sam, pues es lo más extenso.
4. **Pendiente de la Fase 1:** repetir el inventario contra el catálogo de una base efímera y fijar la lista
   final «módulo → cubierto / requiere cambio» que alimenta la UI.

### 12.2 Inventario de funciones que gatean dinero y control por rol (2026-11-11)

Pedido de Sam por mensaje de la sesión coordinadora: cada pieza con archivo:línea. Líneas leídas del repo al
2026-11-11 (se vencen si se edita arriba; ver el método de §12). «Capability» = acto destructivo o gobernado que
**no** se abre con extras (§5.1 regla 2).

| Pieza | Archivo:línea | Quién pasa hoy | Si se abre el módulo por extra |
|---|---|---|---|
| `nomina_can_access()` | `0160_nomina_employees.sql:71` | admin, accounting | Requiere cambio (módulo `nomina`: dinero + datos personales de empleados) |
| `contabilidad_edicion_autorizada()` | `0493_cierre_contable_superclave.sql:253` | accounting, admin, support | Requiere cambio |
| `cierre_es_admin()` | `0493_cierre_contable_superclave.sql:291` | admin | Se queda admin (cierre contable) |
| `registrar_tasa_de_cambio` | `0495_fx_rates_conversor_usd.sql:233` | admin, accounting | Requiere cambio |
| `void_expense_governed` | `0340_expense_void_governance.sql:100` | accounting, admin | **Capability** (`void_expense`): no cambia |
| `congelar_tarifa_recepcion` | `0496_tarifa_congelada_por_embarque.sql:80` | admin, operations, warehouse, support, accounting | **Capability** (`fix_frozen_rate`): no cambia |
| `void_invoice_with_audit_reason` | `0497_reverso_al_anular_factura.sql:740` | admin, accounting | **Capability** (anular): no cambia |
| `void_payroll_settlement_governed` | `0316_nomina_settlement_void_governance.sql:128` | admin | **Capability**: no cambia |
| `soft_delete_admin_tenant_internal` | `0476_borrado_embarques_recepciones.sql:379` | admin | **Capability** (`delete_shipments`, `delete_warehouse_receipts`): no cambia |
| `crm_puede_usar()` | `0506_crm_modelo.sql:186` | admin, commercial | Requiere cambio (Comercial, primera tanda) |

Políticas de dinero por rol `accounting` (por migración, sin línea individual porque son familias de políticas):
`0407`/`0414` facturas, `0409` conciliación, `0470` cobros y pagos a proveedores, `0510` cuentas, `0511` asientos,
`0165`/`0166` libros fiscales y retenciones, `0074` gastos, `0422` reportes de pago. Lo de solo-administrador usa
`is_tenant_admin()` (39 objetos, ver cifras de §12) y `0356` para los 4 módulos del superadministrador.

Conclusión: para **Alejandro** (ya contabilidad) el dinero funciona sin tocar nada. Para cualquier otro receptor de un
extra de dinero hay que migrar las piezas marcadas «Requiere cambio» y las familias de políticas anteriores, y por eso
es una fase propia (§6, fase 8; R3).

## 13. Estado de la implementación (PR #509, 2026-11-11)

Esta sección enmienda la spec para que describa lo que se construyó. La PR #509 depende de esta (#488), sigue sin
fusionar y sus migraciones no se han aplicado en ningún entorno remoto.

### 13.1 Migraciones y nombres definitivos

| Pieza | Nombre definitivo (lo que dice el código) | Difiere de §5 |
|---|---|---|
| Tabla y RPC (0529) | `studio_user_module_grants`, `studio_grant_user_module`, `studio_revoke_user_module_grant`, `user_has_module(p_module, p_edit)`; ayudantes `studio_module_default_roles`, `studio_module_is_sensitive`, `studio_module_is_superadmin_only` | La RPC de conceder se llama `studio_grant_user_module`, no `studio_set_user_module_grant`; hay ayudantes SQL que §5 no nombraba |
| CRM (0530) | `crm_puede_usar()` pasa a `user_has_module('kommo')`; `crm_puede_editar()` nueva (la usan las 5 políticas de escritura del CRM y `crm_mover_etapa`); `document_entity_authorized` suma el extra vigente, y las entidades de dinero siguen por rol | `crm_puede_editar()` es nueva |
| RLS por módulo (0531) | En rates, quotes, conversations, conversation_messages, purchase_orders, purchase_order_items y sales_orders la política `for all` por tenant pasa a cuatro: escribir exige editar el módulo dueño, leer exige ver alguno de los que la consumen; `chatwoot_conversations` la lee quien ve Bandeja o CRM; ayudante `user_has_any_module(text[], boolean)` | **No estaba en la spec** (§12 las daba por «solo tenant»; la implementación las endureció por módulo) |

Detalles de diseño que se fijaron al construir:

- **Revocar = borrar la fila**, con motivo obligatorio; el rastro append-only queda en `entity_audit_log`. Un extra
  vencido no se borra: deja de contar solo y aparece en el filtro «vencidos».
- La tabla garantiza por CHECK que `can_view` siempre es verdadero, que editar implica ver, motivo de 5 a 500
  caracteres, confirmación de sensibles (`sensitive_confirmed_at` + `effects_version`) sobre la lista literal de
  `LOCKED_MODULES`, y solo lectura para `users` y `admin` (R1).
- La RPC de conceder: solo el rol admin de la base; nunca a uno mismo, a un admin, a una persona desactivada ni de
  otro tenant; módulo conocido; vencimiento futuro; confirma sensibles con `p_confirm_sensitive` y versión de
  efectos; los 4 del superadministrador solo si `is_platform_admin()` (R2). Ambas RPC escriben en
  `entity_audit_log` (entidad nueva `studio_user_module_grant`, dominio `governance`).
- Orden de decisión en SQL y en TypeScript, probado con paridad: admin → support sin edición → alcance de almacén →
  desvío por rol (nunca sobre sensibles) → default de código → extra vigente.
- Una copia SQL de la matriz de módulos (`studio_module_default_roles`) replica `ROLE_MODULE_ACCESS` con una prueba
  anti-drift.

### 13.2 Cobertura y límites de esta entrega

- **Dinero (R3):** no se tocó ninguna función ni política de dinero. En la pantalla los módulos de dinero salen como
  «Requiere fase de dinero» y no se ofrecen. La suma de extras se hará redefiniendo `studio_can_read_money()`
  (0528, SDD-0624, PR #515).
- **Doble aviso:** el diálogo está hecho y probado, pero hoy ningún módulo sensible está «cubierto», así que la
  pantalla no lo abre; la RPC sí lo acepta con confirmación. Abrir uno es mover su entrada en `GRANT_COVERAGE`
  cuando su base acepte el extra.
- **Bandeja:** no se ofrece; el ciclo de agentes de Chatwoot decide solo por rol y es del carril de Chatwoot.
- **Rol `custom` (fase 6):** no está en la #509.
- **Acciones sacadas de DEUDA** del anti-drift: `lookupSuggestedRate`, `lookupRateForNewDestination` y
  `previewRatesImportAction`.

### 13.3 Pendientes que decide Sam (sin código)

1. **Revocar sin superadmin:** hoy revocar no exige superadmin, ni siquiera sobre los 4 módulos del superadministrador.
   Quitar solo resta; ¿alcanza un admin?
2. **Reactivar a una persona:** los extras viven aunque se suspenda a la persona y vuelven vigentes al reactivarla.
   ¿Deben vencer o quitarse al suspender?
3. **La RPC concede módulos que la base aún no cubre:** la pantalla solo ofrece los cubiertos, pero un admin que
   llame la RPC directo puede dar, por ejemplo, Tesorería a comercial y la base le negaría los datos. ¿Se limita la
   RPC a la lista cubierta?

Pendiente técnico menor (no requiere decisión de Sam): `getMyModuleGrants` filtra solo por `user_id`; con varios
tenants por persona habría que filtrar por el tenant activo.

### 13.4 Fuera de alcance detectado por la implementación

- El borrado lógico con la sesión ya fallaba antes en rates, quotes, conversations, purchase_orders y sales_orders
  (`cotizador/actions.ts:499`, `tarifas/actions.ts:260`); la 0531 no lo arregla ni lo empeora.
- La propuesta de tarifa de la CN (`cn/rate-snapshot-actions.ts`) lee con la sesión de almacén; es del carril CN.
- `bandeja/page.tsx:100` y `lib/studio/chatwoot/agentes-ciclo.ts:87` evalúan la Bandeja de terceros solo por rol y
  desvío; habrá que tocarlos si se abre.
- `listUnreadConversationsForBadge` sigue consultando aunque no se pinte el indicador (costo menor).
