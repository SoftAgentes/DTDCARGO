---
sdd: "0622"
title: "Rol base + accesos adicionales por persona en Studio"
status: draft
author: "Claude (sesión Worker sdd-permisos-persona) + Sam"
created: 2026-11-09
updated: 2026-11-09
supersedes: null
superseded_by: null
related: ["0024", "0085", "0139", "0252", "0412", "0587"]
confidencialidad: interno
---

# SDD-0622 — Rol base + accesos adicionales por persona

> En una empresa de 3 a 15 personas una misma persona hace varios oficios. Hoy Studio le da **un solo rol**
> y no hay forma de sumarle, por ejemplo, el CRM a quien lleva contabilidad. Esta spec agrega
> «accesos adicionales» por persona, solo hacia arriba, con motivo, rastro y candados.

**Estado:** borrador. Sam respondió el 2026-11-09 (ver §9): extras **por módulo**, **vencimiento opcional**,
«elegir módulos» para Alejandro, **sí** pueden abrir módulos sensibles como tesorería (nunca los de control
del sistema ni acciones destructivas), y pidió una opción **«Personalizado»** (§5.5) para crear un usuario
totalmente a la carta. Lo que sigue sin confirmar está marcado **pendiente de confirmar por Sam**.

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
2. **Candado de gobernanza (decidido por Sam 2026-11-09, ver §9.1).** Los extras **sí pueden abrir módulos
   de dinero** (tesorería, contabilidad, facturación, cobranzas, costing, reportes, fiscal; nómina por
   confirmar, §9.1), porque Alejandro necesita un acceso amplio al arrancar. **No** pueden abrir los
   módulos de control del sistema (`users`, `admin`, `mailing`, `direccion`) ni los reservados al
   superadministrador (`renditions`, `financiero-china`, `legal`, `no-olvidar`): abrir `users` le
   permitiría a alguien darse a sí mismo el rol admin. Un CHECK de la tabla y el helper de TypeScript
   (doble capa, como la 0357) rechazan/ignoran esos módulos aunque una fila se colara. Los **módulos de
   dinero dejan de ser «inmutables»**: pasan de `LOCKED_MODULES` a un conjunto nuevo
   `SYSTEM_CONTROL_MODULES` para efectos de los extras; la lista de dinero (`MONEY_MODULES`) se conserva
   porque otros candados la usan.
   **Acciones destructivas no se conceden nunca** (Sam: «no puede borrar archivos ni bases de datos»): las
   `CAPABILITIES` de borrar/anular/restaurar/revelar auditoría (`delete_shipments`,
   `delete_warehouse_receipts`, `void_payroll_settlement`, `moderate_comments`, `restore_comments`,
   `audit_view`, `audit_view_sensitive`, `escucha_activa`) siguen exactamente como están y los extras por
   módulo **no las otorgan**. Un extra de «Ver y editar» sobre un módulo de dinero da lo que hoy da el rol
   `accounting` en ese módulo, no más. `void_expense` y `fix_frozen_rate` siguen atados al rol `accounting`
   (+ admin): un extra no las concede (decisión de diseño; confirmar en §9.1).
3. **`support` sigue read-only.** Un extra no le da edición a `support` (`canEditModule` ya lo corta antes).
4. **Solo admin concede.** RPC `studio_set_user_module_grant(p_user_id, p_module_id, p_can_view, p_can_edit,
   p_reason, p_expires_at)` y `studio_revoke_user_module_grant(...)`. `SECURITY DEFINER`, `search_path`
   fijo, `assert_studio_role(array['admin'])` al principio (helper de `0351`), tenant tomado de
   `get_user_tenant_id()`, destino validado como miembro **activo** (`disabled_at is null`).
5. **Sin escritura directa.** RLS activa; `authenticated` sin INSERT/UPDATE/DELETE; solo `service_role` y
   las RPC. SELECT solo para admin y para la propia persona (para que vea qué tiene y por qué).
6. **Auditoría.** Cada concesión, cambio y revocación escribe en `entity_audit_log` con actor, destino,
   módulo, permisos y motivo. Requiere registrar la entidad en el catálogo de auditoría (precedente:
   `0258`, `0291`, `0293`). Ver nota en §8 sobre borrado.
7. **Anti-lockout no aplica**, pues solo suma; no puede dejar al tenant sin admin.

### 5.2 Resolución del acceso efectivo (aplicación)

`getStudioAccess` (`lib/studio/rbac-guard.ts:78`) ya carga los desvíos por rol de `getRoleModuleOverrides`.
Se agrega la carga de los accesos de la persona (solo si no es admin y filtrando `expires_at is null or
expires_at > now()`), y se pasan a `canAccessModule` / `canEditModule` (`lib/studio/rbac.ts:338`, `:358`).

Orden de decisión para un no-admin:

1. `admin` → permitido (sin cambios).
2. Módulo de **control del sistema** (`SYSTEM_CONTROL_MODULES`: `users`, `admin`, `mailing`, `direccion`,
   `renditions`, `financiero-china`, `legal`, `no-olvidar`) → solo lo que dé el rol por default; **extras
   e overrides se ignoran**. Los módulos de dinero ya no se cortan aquí: aceptan extras (§5.1 regla 2).
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
- Solo se ofrecen módulos que **no sean de control del sistema** (§5.1 regla 2) y **ya cubiertos en la base**
  (§5.3). Los de dinero se marcan con una etiqueta «Sensible» y piden confirmar al concederlos.
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
- Aplican las mismas reglas: solo admin concede, módulos de control del sistema fuera, nada destructivo, todo
  auditado. `custom` **nunca** da edición implícita: sin extra no hay acceso.
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

Ninguna migración se aplica a producción sin OK nominal de Sam y el runbook
`docs/runbooks/aplicar-migraciones-prod.md`; el ledger de producción es validación de release, no motivo para
aplicar antes de aprobar la PR.

## 7. Pruebas de aceptación

1. **Caso Alejandro:** rol `accounting` + extra `kommo` (ver y editar) → ve y usa CRM; sigue sin ver módulos
   que su rol ni su extra incluyen (p. ej. `users`, `legal`).
2. **Solo suma:** un extra nunca reduce lo que el rol ya da.
3. **Candados:** insertar un extra sobre un módulo de **control del sistema** (`users`, `admin`, `mailing`,
   `direccion`, `renditions`, `financiero-china`, `legal`, `no-olvidar`) falla en la base (CHECK) y, si se
   colara una fila, `canAccessModule` la ignora. Misma prueba para la RPC. **Sí** se acepta un extra sobre
   `treasury` (caso Alejandro) y se verifica que con él **no** obtiene ninguna capability destructiva
   (`delete_shipments`, `void_payroll_settlement`, `moderate_comments`, `audit_view_sensitive`, …).
4. **`support`:** un extra de edición no le da edición.
5. **Vencimiento:** pasada `expires_at`, el acceso desaparece sin tocar nada; antes de vencer funciona.
6. **Persona desactivada:** sin `disabled_at is null` no hay acceso ni extra (ya cubierto en `getStudioAccess`).
7. **Solo admin concede:** un no-admin que llama la RPC directo recibe `42501`; la tabla no acepta escritura
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
  `rbac-actions-guard.test.ts`): nada se mueve de «deuda» a «excepción»; los módulos de control del sistema y las capabilities destructivas no
  son concedibles. **Sensibilidad nueva:** abrir dinero por persona sí está permitido (decisión de Sam), así que
  cada concesión sobre esos módulos queda con motivo y aparece resaltada en «Personas con excepciones».
- **Acumulación de excepciones** (la objeción de la 0139) → motivo, vencimiento opcional, lista visible.
- **Borrado no limpia el rastro**: borrar un extra no borra `entity_audit_log`; contar antes de ensayar.
- **Preview comparte Supabase con producción**: no probar concesiones reales en Preview.
- **Doble fuente de verdad** (código y base) → un único contrato que compare ambas (§7.8).
- **Matriz por rol (0357) y extras por persona** conviven; la spec define el orden en §5.2 para que no haya
  ambigüedad.

## 9. Decisiones

| # | Decisión | Resultado | Estado |
|---|---|---|---|
| 9.1 | ¿Los extras abren módulos sensibles? | **Sí, los de dinero** (p. ej. tesorería), porque Alejandro necesita un acceso amplio al arrancar y Sam irá recortando con el tiempo. **No** los de control del sistema ni acciones destructivas: «no puede borrar archivos ni bases de datos». Detalle en §5.1 regla 2 | Decidido por Sam 2026-11-09 en lo general. **Pendiente de confirmar por Sam:** nómina (dinero + datos personales de empleados) y `void_expense`/`fix_frozen_rate`, que esta spec deja fuera de los extras |
| 9.2 | Granularidad | **Por módulo** (ver / ver y editar). Acciones finas quedan para fase 2 | Decidido por Sam 2026-11-09 |
| 9.3 | Vencimiento | **Opcional** | Decidido por Sam 2026-11-09 |
| 9.4 | Alcance de «parte de Comercial» | **Elegir módulos** (p. ej. CRM sí, Cotizaciones no). Filtrar etapas o embudos dentro del CRM sería otra spec | Decidido por Sam 2026-11-09 |
| 9.5 | Usuario **Personalizado** | Rol base `custom` + accesos módulo a módulo (§5.5) | Pedido de Sam 2026-11-09; **pendiente de confirmar por Sam** que el diseño de §5.5 es lo que quiere |

Pregunta abierta, **sin valor asumido**:

- Si se concede `clients` con edición: ¿incluye la fusión de fichas (`0358`/`0361`), que hoy exige rol?
- ¿`documents` es transversal también para `custom`?

## 10. Fuera de alcance

- Crear **roles nombrados** reutilizables (plantillas propias) o editar la matriz base desde la UI. El
  «Personalizado» de §5.5 es por persona, no una plantilla compartida.
- Abrir módulos de control del sistema o conceder acciones destructivas por persona.
- Quitar permisos por persona (solo se suma).
- Acciones finas dentro de un módulo (fase 2).
- Reescribir en bloque las ~71 migraciones con chequeos de rol.
- Permisos de Chatwoot dentro de la bandeja: los decide su propio rol (nota en `rbac.ts`, `bandeja`).
- Acceso al portal de clientes, PWA de operarios y PINs (`operarios`).

## 11. Archivos que se tocarían (informativo, sin implementar aquí)

`lib/studio/rbac.ts`, `lib/studio/rbac-guard.ts`, un `*-queries.ts` nuevo junto a
`role-module-overrides-queries.ts`, módulo Usuarios (`app/studio/(app)/usuarios`), migraciones nuevas, pruebas
`lib/studio/__tests__/` y `supabase/tests/`. La lista exacta (allowlist) se fija al aprobar la spec, como
exige la gobernanza de cambios de comportamiento de Studio.
