---
sdd: "0498"
title: "Cinco puertas del Studio que se saltaban el fail-closed por disabled_at"
status: in-progress
author: "Claude"
created: 2026-09-20
updated: 2026-09-20
supersedes: null
superseded_by: null
related: ["0080", "0085", "0104", "0139", "0156", "0236", "0251", "0252", "0286"]
confidencialidad: interno
---

# SDD-0498 — Cinco puertas del Studio que se saltaban `disabled_at`

> Suspender a alguien tiene que servir de algo. Cinco server actions resolvían
> el rol leyendo `user_tenants` por su cuenta, sin el filtro `disabled_at` del
> endurecimiento 0200, y seguían dejando actuar a un usuario desactivado. Se
> sustituyen por el guard central, que ahora también devuelve el tenant — el
> motivo por el que existían esas lecturas a mano. Sin migración.

## Contexto

`getStudioAccess` (`lib/studio/rbac-guard.ts`) resuelve el rol con dos filtros
que son el candado, no un detalle:

```ts
.eq("user_id", user.id)      // SDD-0251: deja de DEPENDER de la policy
.is("disabled_at", null)     // endurecimiento 0200: fail-closed al suspendido
```

De ahí cuelgan `requireModuleView`, `moduleViewDenial`, `moduleEditDenial` y
`capabilityDenial`. El comentario de `rbac-guard.ts:61-66` ya avisaba de la
variante peligrosa: sin `user_id`, el `limit(1)` puede entregar «el rol de un
compañero cualquiera, y acá ese rol es el que decide si pasás».

Cinco puertas no usaban el helper. Leían `user_tenants` a mano y reimplementaban
la decisión — **sin `disabled_at`**, y dos de ellas **sin `user_id`**:

| Archivo:línea (antes) | Cubre | Omitía |
|---|---|---|
| `app/studio/(app)/contabilidad/actions.ts:335-343` · `setClosingDateAction` | fijar/levantar el cierre contable | `disabled_at` |
| `app/studio/(app)/fiscal/actions.ts:202-210` · `resolveFiscalGate` | `postFiscalBookAction` (asentar libros) | `disabled_at` |
| `app/studio/(app)/admin/carrier-actions.ts:50-61` · `resolveTenantAdmin` | las 5 actions del archivo (transportistas + tarifario de flete) | `disabled_at` |
| `app/studio/(app)/admin/notificaciones/actions.ts:29-37` · `requireAdmin` | las 3 actions (config de avisos al cliente) | `user_id` **y** `disabled_at` |
| `app/studio/(app)/marketing/noticias-web/actions.ts:230-260` · `requireAdmin` / `requireAdminWithTenant` | las 11 actions (generación IA + borradores + publicar) | `user_id` **y** `disabled_at` |

Las cinco se verificaron leyendo el código, no confiando en el barrido de
origen. Dos precisiones que el barrido no traía y que cambian el alcance:

- en `fiscal/actions.ts`, las otras tres actions (`voidFiscalBook`,
  `createWithholding`, `voidWithholding`) llaman a `moduleEditDenial` **antes**
  de `resolveFiscalGate`, así que ya cortaban al suspendido. La única expuesta
  era `postFiscalBookAction:229`;
- `saveFiscalSettingsAction:128` tenía una **tercera** lectura a mano, también
  sin `disabled_at`, pero detrás de un `moduleEditDenial` que ya cerraba. No era
  explotable; sí era la segunda forma de resolver el rol.

### Por qué existían esas lecturas

Vale la pena separarlo, porque reemplazar un gate artesanal sin entender por qué
se escribió a mano puede estar borrando una excepción deliberada. Acá los
motivos salen de los comentarios y los imports de cada archivo, no de suponer.

**Cuatro de las cinco existían porque el helper no daba el `tenant_id`.**
`moduleEditDenial` devuelve sólo el mensaje, y una action que además necesita
saber dónde escribir no tenía de dónde sacarlo. La evidencia más fuerte es
`fiscal/actions.ts`: **ese mismo archivo importa y usa `moduleEditDenial` en
tres actions**. El autor conocía el helper; escribió `resolveFiscalGate` a mano
igual, porque necesitaba `tenantId` y `userId`. Y en `noticias-web` está dicho
con todas las letras: `requireAdminWithTenant` se documenta como «Variante que
también devuelve el tenant_id (**necesario para INSERTs**)». Lo mismo en
`carrier-actions.ts` y `setClosingDateAction`, que usan el tenant para el
`insert`/`upsert` y el `userId` para `locked_by` / `updated_by`.

Esto es un hueco del helper, no descuido de cinco autores: el helper empujaba a
copiar la consulta, y al copiarla se perdía el filtro. Por eso el arreglo no es
«llamen al helper» sino **taparle el hueco**: los gates nuevos devuelven el
contexto para que no quede motivo para releer la tabla.

**Dos eran decisiones deliberadas sobre el predicado, no sobre el tenant.**
`admin/notificaciones` tenía su excepción argumentada por escrito en la
ALLOWLIST del anti-drift («config admin-only»), y `carrier-actions.ts` declara
en su cabecera «Gate: `admin`». No querían la matriz de módulos: querían
admin-only duro. Esa intención se conserva —es justo lo que hace
`tenantAdminGate`—; lo que no se conserva es la consulta a mano.

**Una sí fue desconocimiento del helper.** El `requireAdmin` de `noticias-web`
no necesita tenant y se documenta como «patrón compartido con
`mailing/page.tsx`»: el autor copió el gate de una **page** a un archivo de
server actions. Ahí no había excepción que preservar, y es el que peor quedó
—sin `user_id` y sin `disabled_at`— por venir de un contexto donde la page ya
había gateado la vista.

### Qué tan grave era cada una: la DB no cubre a todas

Un gate de aplicación roto es grave por sí mismo, pero la consecuencia real
depende de si la RLS de la tabla destino repite el candado. Medido sobre los
archivos de migración del repo (**no** contra producción; esta tarea no tiene
autorización para leer allá):

| Puerta | Respaldo en DB | ¿Escribía un suspendido? |
|---|---|---|
| cierre contable | `accounting_settings` insert/update exigen `role='admin' and disabled_at is null` (`0133_period_close.sql:49-75`) | No — cortaba la RLS |
| asentar libro fiscal | la RPC `fiscal_post_book` exige `role in ('accounting','admin') and disabled_at is null` (`0165_fiscal_books.sql:307-315`) | No — cortaba la RPC |
| transportistas y tarifario | `freight_carriers` / `carrier_tariffs` exigen `role='admin' and disabled_at is null` (`0330_freight_carriers_tariffs.sql:157-236`) | No — cortaba la RLS |
| notificaciones al cliente | `audit_d1_admin_tenant()` exige `role='admin' and disabled_at is null` (`0289_audit_d1_access_configuration.sql:145-156`) | No — cortaba la RPC |
| **noticias del sitio público** | `news_posts` y `seo_drafts` exigen `role='admin'` y **no miran `disabled_at`** (`0055_news_posts.sql:82-110`, `0053_seo_drafts.sql:73-111`; ninguna migración posterior las redefine) | **Sí** |

O sea: cuatro puertas eran defensa en profundidad perdida — un candado que
aprueba a quien la DB rechaza, que es peor que no tener candado porque miente
en el review. La quinta era un agujero de verdad, y por partida doble:

1. un admin suspendido podía **publicar en el sitio público** y guardar
   borradores (`publishPost`, `saveDraft`);
2. las ocho actions de generación llaman a la **API de Anthropic sin tocar la
   DB** — ninguna RLS las cubre. Un suspendido quemaba la API key.

### Por qué el anti-drift no lo vio

`lib/studio/rbac-actions-guard.test.ts` escanea `app/studio/(app)/**/actions.ts`
y exige el guard. No lo vio por tres razones distintas:

- **`carrier-actions.ts` no se llama `actions.ts`.** El escáner abre sólo ese
  nombre exacto, así que toda la familia `<algo>-actions.ts` queda fuera.
- **El contrato es por archivo, no por action.** `contabilidad/actions.ts` y
  `fiscal/actions.ts` ya llamaban a `moduleEditDenial` en otras actions, así que
  pasaban en verde con una puerta abierta adentro.
- **Las otras dos estaban en la ALLOWLIST**, con su gate artesanal como
  justificación escrita.

## Decisión

**Una sola resolución del rol en todo el repo.** `getStudioAccess` devuelve
además `tenantId` y `userId`, de la MISMA fila que autorizó, y se agregan dos
gates que entregan permiso y contexto juntos:

- `moduleEditGate(supabase, moduleId, messages?)` — el predicado de
  `moduleEditDenial` (matriz, overrides, alcance de almacén y segundo candado de
  superadministrador) más `tenantId` / `userId` / `role`;
- `tenantAdminGate(supabase, messages?)` — admin-only con el mismo contexto.

El predicado de edición se extrajo a `editDenial(supabase, access, moduleId)`,
que comparten `moduleEditDenial` y `moduleEditGate`: si fueran dos copias
estaríamos repitiendo el error que la spec vino a borrar. Una prueba recorre la
matriz de roles × suspendido y exige que los dos decidan lo mismo.

### Por qué dos gates y no uno

Cuatro de las cinco puertas son **admin-only por regla de producto**, no por la
fila del módulo en la matriz:

- el cierre contable es admin-only por SDD-0080, aunque el módulo `accounting`
  admite al rol `accounting`;
- la configuración fiscal es admin-only, aunque `fiscal` admite `accounting`;
- transportistas, notificaciones y noticias viven bajo pantallas cuyo módulo
  (`admin`, `noticias-web`) tiene otra fila en la matriz.

Expresarlas con `moduleEditGate("accounting")` o `moduleEditGate("noticias-web")`
las habría **ampliado** —a `accounting`, a `commercial`, a `marketing`— de
refilón, dentro de una tarea de seguridad. `tenantAdminGate` dice lo que la
regla dice. Y usar `moduleEditGate("admin")` para las de `/studio/admin` habría
atado una regla de producto a una fila de la matriz que se edita por otros
motivos.

`messages` conserva la copia es-VE de cada call site (`"Solo admins pueden
configurar notificaciones."`, `"Acceso restringido a admins"`, …), así que la
pantalla no cambia: lo único que cambia es a quién deja pasar.

### Discriminante `ok`, no `denied`

El gate devuelve `{ ok: true, tenantId, userId, role } | { ok: false, denied }`.
Con un único campo `denied: string | null`, TypeScript **no** estrecha la unión
—`string` no es tipo unidad— y el call site termina con un `tenantId`
posiblemente indefinido dentro de un `insert`. Con `ok` el compilador obliga a
pasar por el gate antes de tocar el tenant.

## Alcance

**Arreglado**: las cinco puertas de la tabla, más la tercera lectura de
`saveFiscalSettingsAction`.

**Detectado y NO arreglado** (mismo defecto, fuera del encargo; hay otra tarea
viva sobre `actions.ts` de otros módulos y no conviene solaparse):

| Archivo:línea | Qué gatea | Omite |
|---|---|---|
| `app/studio/(app)/admin/calculator-actions.ts:63` y `:127` | `resolveTenantAdmin` → parámetros y ciudades del calculador público | `disabled_at` |
| `app/studio/(app)/tarifas/actions.ts:297` | `resolveTenantAdmin` (copia literal del anterior) → publicar/archivar tarifas | `disabled_at` |
| `lib/http/studio-session.ts:50` | `requireStudioSession`, usado por 4 route handlers (`bugs/[id]`, exports comercial y operativo, `shipments`) | `user_id` **y** `disabled_at` |
| `lib/studio/renditions/actions-helpers.ts:58` | `resolveAdminTenant` → emitir/anular rendiciones (dinero + `SUPERADMIN_ONLY`) | `user_id` **y** `disabled_at` |
| `app/studio/(app)/crm/actions.ts:123`, `:213`, `:272` | admin-only del mapa de etapas de Kommo | `user_id` **y** `disabled_at` |
| `app/api/studio/searates/probe/route.ts:41` | admin-only | `user_id` **y** `disabled_at` |
| `app/api/studio/legal/evidence/[code]/route.ts:56` | admin-only (`legal` es `SUPERADMIN_ONLY`) | `user_id` **y** `disabled_at` |

De ninguna de esas siete se verificó si la RLS de la tabla destino repite el
candado; el inventario dice dónde está el gate artesanal, no cuánto expone.

No son gate de permiso y quedan fuera a propósito: `bugs/actions.ts:267` (usa el
rol para etiquetar autor), `dashboard/actions.ts:44` (config propia del usuario,
y filtra con `canAccessModule` después) y las lecturas que sólo piden
`tenant_id`.

**Sin migración.** Todo es capa de aplicación. Las policies y RPCs citadas ya
existen y no se tocan.

## Pruebas

Cada puerta lleva su caso, **escrito antes del arreglo y comprobado en rojo
contra `main`**. El doble de PostgREST (`lib/studio/__tests__/user-tenants-double.ts`)
**aplica los filtros**: los dobles del repo que devuelven la fila pase lo que
pase (`is: () => query`) no distinguen un gate que filtra de uno que no, porque
los dos leen la misma fila. Devuelve copias, para que una escritura posterior no
cambie «lo ya leído».

Se prueba **por el lado negativo**: no importa el mensaje, importa que al
suspendido no se le escriba una fila ni se le llame a Anthropic.

| Prueba | Rojo contra `main` |
|---|---|
| `lib/studio/__tests__/rbac-guard-gates-con-tenant.test.ts` | 13 casos: la resolución única, el contexto, y que los dos gates decidan igual |
| `app/studio/(app)/contabilidad/__tests__/cierre-contable-usuario-suspendido.test.ts` | 2 de 5 |
| `app/studio/(app)/fiscal/__tests__/asentar-libro-usuario-suspendido.test.ts` | 2 de 4 |
| `app/studio/(app)/admin/__tests__/carrier-actions-usuario-suspendido.test.ts` | 5 de 8 |
| `app/studio/(app)/admin/notificaciones/__tests__/notificaciones-usuario-suspendido.test.ts` | 4 de 6 |
| `app/studio/(app)/marketing/noticias-web/__tests__/noticias-web-usuario-suspendido.test.ts` | 5 de 7 |

El rojo de `publishPost` contra `main` no era una aserción de mensaje: la action
llegaba hasta `revalidatePath("/noticias")` (línea 1205), o sea **después del
INSERT en `news_posts`**. Es el agujero, reproducido.

### Mutantes

| Mutante | Resultado |
|---|---|
| quitar `.is("disabled_at", null)` de `getStudioAccess` | mueren **19** casos en los 6 archivos nuevos; los **26 archivos** de test que tocan `rbac-guard` (349 casos) siguen verdes |
| quitar `.eq("user_id", user.id)` | mueren los 4 casos de «la membresía de OTRO usuario no habilita al de la sesión» y nada más |

### Anti-drift

`rbac-actions-guard.test.ts` acepta ahora cualquiera de los guards de
`rbac-guard` (`moduleEditDenial`, `moduleEditGate`, `tenantAdminGate`,
`capabilityDenial`) en vez de exigir el nombre de uno solo, y las entradas de
`admin/notificaciones/actions.ts` y `marketing/noticias-web/actions.ts` salen de
la ALLOWLIST porque ya no son excepciones.

**Ampliar el escáner a `<algo>-actions.ts` queda pendiente**: hoy pondría en
rojo a una docena de archivos de una sola vez. Se anotó el hueco en la cabecera
del contrato.

## Riesgos y lo que NO cambia

- **Ningún rol gana permisos.** Cada gate conserva su predicado y su copia. Lo
  único que cambia es que un suspendido deja de pasar, y que en notificaciones y
  noticias la consulta queda acotada al usuario de la sesión.
- **Cambia el orden en `saveFiscalSettingsAction`**: el candado de admin corre
  ahora ANTES de validar el formulario. Antes un no-admin con datos inválidos
  recibía `fieldErrors`; ahora recibe la denegación. Es el orden correcto para
  un gate, y no filtra validación a quien no puede editar.
- **Cambia el mensaje en un borde**: donde el gate artesanal decía «No se pudo
  resolver el tenant del usuario» por falta de membresía, ahora responde la
  denegación por permiso. No se le informa a un desconocido si existe o no una
  membresía.
- **Queda una doble resolución barata** en `voidFiscalBookAction`,
  `createWithholdingAction` y `voidWithholdingAction`: llaman a
  `moduleEditDenial` y después a `resolveFiscalGate`, que hoy también resuelve.
  Son dos viajes a la DB, no dos criterios — las dos preguntan por
  `getStudioAccess`. Se deja así para no cambiarles el mensaje a tres actions
  que no son el defecto.

## Evidencia pendiente

- La tabla de respaldo en DB sale de los **archivos de migración del repo**. No
  se verificó contra producción qué policy está viva hoy; una policy puede
  haberla reescrito un `do $$` posterior que no la nombra (es lo que pasó con la
  0230). Para `news_posts` / `seo_drafts` se revisaron las 14 migraciones que
  las mencionan y ninguna redefine sus policies.
- Las siete puertas del inventario «detectado y no arreglado» no tienen prueba
  ni verificación de su RLS de respaldo.
