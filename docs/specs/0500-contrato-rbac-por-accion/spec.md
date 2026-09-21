---
sdd: "0500"
title: "El anti-drift de RBAC mide por acción, no por archivo"
status: in-progress
author: "Claude"
created: 2026-09-21
updated: 2026-09-21
supersedes: null
superseded_by: null
related: ["0085", "0139", "0252", "0271", "0355", "0394", "0407", "0494", "0497", "0498"]
confidencialidad: interno
---

# SDD-0500 — El anti-drift de RBAC mide por acción, no por archivo

> El contrato que debía cazar los nueve huecos de autorización de SDD-0497 y
> SDD-0498 comprobaba que el nombre del guard apareciera **en el archivo**. Pasa
> a parsear el AST y exigir, **por acción exportada**, que un candado **domine**
> el primer acceso a datos, sobre los **73** archivos de actions del Studio y no
> sobre 54. Primero se cierra el hueco que el defecto escondía: el borrado de
> documentos de un envío, que saca el objeto del bucket. **Sin migración.**

## Contexto

`lib/studio/rbac-actions-guard.test.ts` es el caso 1 de la sección «Contratos
que miden el comportamiento, no el texto» de
[project-rules](../../engineering/project-rules.md). Su aserción era:

```ts
const hasGuard = GUARDS.some((guard) => src.includes(guard));
```

Tres defectos **independientes**, cada uno suficiente por sí solo:

1. **Alcance de archivo, no de acción.** Un archivo con siete acciones gateadas
   y una abierta contiene la cadena. Así `contabilidad/actions.ts` estuvo en
   verde con `setClosingDateAction` abierta adentro (SDD-0498).
2. **Sólo abría `actions.ts` exacto.** `findActions` recogía ese nombre y nada
   más: **54** archivos escaneados, **19** `*-actions.ts` sin mirar. Medido con
   el alcance del escáner (`app/studio/(app)/**`, sin `__tests__` ni
   `_components`); un `find` sobre todo `app/studio` da otro número porque
   responde otra pregunta.
3. **Guard EN el archivo, no ANTES de la escritura.** Un `moduleEditDenial` en
   la acción de al lado ya daba verde.

SDD-0498 **mejoró** el (1) sin cerrarlo —pasó de exigir un nombre a aceptar
cuatro, lo que eliminó el falso negativo de `carrier-actions.ts`—, pero el
alcance de la aserción siguió siendo el archivo. Una mejora no es un arreglo si
no cambia lo que la aserción alcanza.

## Parte 1 · El hueco que el defecto 2 escondía

`app/studio/(app)/tracking/[id]/document-actions.ts` no lo miraba nadie, por no
llamarse `actions.ts`. Adentro, **dos mutaciones sin ningún gate**:

| Acción | Qué hacía |
|---|---|
| `uploadShipmentDocumentAction:29` | resolvía el tenant releyendo `user_tenants` **sin `user_id` y sin `disabled_at`** — la variante exacta que SDD-0498 vino a borrar del repo |
| `deleteShipmentDocumentAction:95` | **no resolvía ni la sesión**; marcaba `deleted_at` y después `storage.remove()` del objeto |

**Precisión sobre la relectura de `user_tenants`**, para no inflarla: esa consulta
**no** prestaba el tenant de otro usuario ni dejaba actuar a un suspendido. La
policy de `user_tenants` para `authenticated` en producción repite los dos
filtros —`using ((user_id = (SELECT auth.uid())) AND (disabled_at IS NULL))`,
catálogo **leído por el Director el 2026-09-21**, no por esta tarea— así que un
suspendido recibía cero filas y el `maybeSingle()` sólo podía devolver su propia
membresía. Era **redundancia perdida**. Se saca igual porque era la segunda forma
de resolver el rol, que es la que se olvida de actualizar; pero lo que de verdad
faltaba en esta acción era el **gate de módulo**, que no existía en ninguna forma.

**Precisión sobre el borrado**, porque el inventario de origen la tenía al
revés: la fila **sí** tiene borrado lógico (`deleted_at`). Lo irreversible es el
`remove()` del bucket en `:115` — el archivo se va y no vuelve. Es el único
borrado irreversible de toda la lista.

### Cuánto exponía: la RLS ya lo cubría

El encargo decía «hoy un `support` borra el conocimiento de embarque». **Medido
contra los archivos de migración del repo, no es así.** La migr
`0439_shipment_document_entity_rbac.sql` (SDD-0407) protege `shipment_documents`
**y** el bucket `shipment-docs` con `document_entity_authorized('shipment', …,
'edit')`, que:

- resuelve la membresía con `ut.disabled_at is null` (fail-closed al suspendido);
- para `access = 'edit'` exige explícitamente **`d.role <> 'support'`** más la
  fila de `tracking` en la matriz;
- cubre las cuatro policies de la tabla (`read`/`insert`/`update`/`delete`) y las
  tres del bucket (`insert`/`read`/`delete`), y su propio bloque `do $post$`
  aborta si alguna falta.

O sea: era **defensa en profundidad perdida**, no un agujero abierto — un
candado que aprueba a quien la base rechaza, que es peor que no tener candado
porque miente en el review, pero **no** el incidente que el parte describía.

Hay un efecto que sí era visible y empeoraba la cosa: un `update` que la RLS
rechaza devuelve **0 filas sin error**, así que un `support` recibía
`{ ok: true }` mientras no se borraba nada. Ahora recibe la denegación.

### El arreglo

Las dos pasan a `moduleEditGate(supabase, "tracking")`, que es el **espejo
exacto** de la RLS de la 0439: misma fila de la matriz, `support` excluido por
`canEditModule`, `disabled_at` filtrado por `getStudioAccess`. El borrado además
acota por `tenant_id` del gate, en vez de confiar sólo en la RLS.

`tracking` no está en `WAREHOUSE_SCOPED_MODULES` ni en `SUPERADMIN_ONLY_MODULES`,
así que el gate no agrega ni quita candados laterales.

**Falso positivo vecino, verificado y NO tocado:** `admin/carrier-actions.ts`
está protegido con `resolveTenantAdmin` → `tenantAdminGate` al tope de sus cinco
mutaciones. Lo único que cambió es que el contrato ahora lo reconoce, resolviendo
helpers locales del propio archivo.

### Pruebas

`app/studio/(app)/tracking/[id]/__tests__/document-actions-rbac.test.ts`, escrita
**antes** del arreglo: **10 de 14 casos en rojo**. El perfil del rojo es la
evidencia:

- el **borrado** falla los 5 casos de denegación, incluido «sin sesión» y «sin
  membresía» — porque no miraba ninguna de las dos;
- la **subida** pasa esos dos (sí resolvía sesión) y falla `support`, `marketing`
  y `admin suspendido`, más el caso de que el tenant salga de la membresía de
  **otro** usuario.

El doble de PostgREST (`lib/studio/__tests__/user-tenants-double.ts`) se extendió
con `storage`, registrando las operaciones de bucket **aparte** de `writes`: una
prueba que sólo mirara las escrituras de tabla no distingue «denegó» de «denegó
la fila pero igual borró el archivo», que es justo este caso.

## Parte 2 · El contrato

`lib/studio/__tests__/rbac-action-scan.ts` parsea el AST de cada archivo y exige,
**por acción exportada**, dos reglas que fallan por caminos distintos:

- **A.** un guard **incondicional** domina el **primer acceso a datos**;
- **B.** si la acción escribe, un guard de **edición** domina la **primera
  escritura**.

### Por qué dos reglas y no una

Con sólo la A, una acción que lee con `moduleViewDenial` y después muta quedaría
en verde: el gate de vista domina la lectura y la escritura no la mira nadie. Y
exigiendo siempre `edit` quedarían en rojo los lectores que **SDD-0494 y
SDD-0497 gatearon a propósito** con vista — siete de ellos (`getBillHistory`,
`getPayableForBill`, `getReceivableHistory`, `getSupplierFinance`,
`getStatementDetail`, `searchKommoContactsAction`, `exportRecoverySmsCsvAction`).
Un contrato que pone en rojo un candado correcto entrena a saltearlo.

### Qué significa «domina»

La dominancia es **conservadora y asimétrica**, y la asimetría es el punto:

- **los guards se cuentan sólo donde se ejecutan sí o sí.** No cuentan dentro de
  un `if`/`else`, de un bucle, de un `switch`, del `catch` o el `finally`, de una
  rama de `?:`, del lado derecho de un `&&`/`||`/`??`, ni dentro de un callback.
  **Sí** cuentan en la *condición* de un `if` (`if (await moduleEditDenial(…))
  return`) y al tope de un `try` — este último es patrón real del repo
  (`facturacion/payment-report-actions.ts`), y rechazarlo forzaría a reescribir
  código que sí gatea, que es el otro modo de mentir de un contrato;
- **los accesos se cuentan en todas partes**, condicionales y callbacks incluidos.

Se compara por **offset**, no por línea: un guard y un acceso pueden compartir
línea, y ahí «después» sólo lo dice el offset.

Un **helper local del propio archivo** aporta su guard y su acceso, reportados en
la línea del **call site** — si se reportara la del helper, que suele estar
arriba, el guard parecería anterior a cualquier acceso de cualquier acción.

### Qué es un acceso

`from(tabla)` clasificado por el método encadenado (`select` lee;
`insert`/`update`/`upsert`/`delete` escriben; sin método reconocible se asume
escritura), `rpc()` como escritura, los métodos del Storage por familia, y bajo
`auth` **todo cuenta como escritura salvo la lista de sesión propia**
(`getUser`, `getSession`, `getClaims`, `refreshSession`, `signOut`). El default
es escritura a propósito: la lista de exentas es la que hay que defender, no al
revés. `Array.from` y `Buffer.from` quedan fuera por lista explícita.

**Límite declarado:** el analizador ve las llamadas **directas** al cliente de
Supabase y los helpers **del propio archivo**. Un helper importado de otro módulo
(`resolveRateForClient`, `listDocumentVersions`) no se sigue. El contrato no se
cae por eso: una acción **sin acceso detectado igual necesita guard**, así que la
exigencia se conserva; lo que se pierde es la precisión del mensaje.

### Las dos listas

Poner el contrato estricto deja en rojo **39** acciones de **427**, sobre **73**
archivos. Dejarlo laxo «hasta que se arregle todo» sería volver al contrato que
no medía. Entran con lista explícita, y en **dos** porque significan cosas
distintas y se vacían distinto:

| Lista | Qué es | Entradas |
|---|---|---|
| `EXCEPCIONES` | el candado **existe y se verificó**, sólo que no con un nombre que el analizador reconozca: la RPC lo hace, es la sesión del propio usuario, delega en otra acción gateada, `platformAdminDenial`… | 15 |
| `DEUDA` | falta el gate, o hay uno **artesanal más débil** que el central. Cada entrada dice **qué se observó**, no una justificación inventada | 24 |

**Lo que ninguna de las dos permite es una acción NUEVA sin candado**: nace roja
y hay que defenderla por escrito en una PR. Ése es el 80 % del valor y está
disponible desde ya.

Los **totales van aparte** del veredicto por acción, a propósito: si alguien
«arregla» un rojo moviendo una acción de un archivo a otro, el veredicto vuelve a
cuadrar y el total no. Hay además una aserción de entradas huérfanas (apuntan a
una acción que ya no existe) y otra de motivos-placeholder.

### Las tres familias de la DEUDA

No conviene confundirlas al priorizar:

- **gate artesanal fail-closed** — `getStudioRole` + `canAccessModule(role,
  MODULE)` **sin pasarle los overrides**. Resuelve por `getStudioAccess`, o sea
  **con** `disabled_at`, así que no es un agujero; es más débil que
  `moduleViewDenial` en tres cosas: ignora los desvíos por rol de SDD-0252 (una
  **revocación** por override no se respeta), el alcance de almacén y el segundo
  candado de superadministrador. Cae acá `academia` (2), `club` (1) y, con su
  propia regla de producto, `reclamos/updateClaimFinancialsAction`;
- **sólo sesión** — comprueba `auth.getUser()` y nada más: cualquier miembro del
  tenant pasa. Cae acá `gastos/exportExpensesCsvAction`, que saca un **archivo**
  con los gastos del mes;
- **sin candado de aplicación** — sólo queda la RLS. El más expuesto es
  `documentos/signDocumentUrl`, que **firma cualquier `storagePath`** del bucket
  `documents` que le pasen, sin validar el path ni el rol.

## Correcciones al inventario de origen

Tres entradas del inventario de SDD-0498 que el encargo repetía **no son puertas
abiertas**. Verificadas leyendo el código, no confiando en el parte:

| Entrada del inventario | Qué se encontró |
|---|---|
| `admin/calculator-actions.ts:63` | `resolveTenantAdmin` lee `user_tenants` sin `disabled_at`, pero corre **después** de `moduleEditDenial(supabase, "admin")` en las cuatro actions. `admin` es `ADMIN_ONLY` y está en `LOCKED_MODULES`, así que al llegar ahí el rol ya es `admin` activo y el `isAdmin` de `:201/:241/:273` es redundante. Segunda resolución desactualizada, no gate. |
| `tarifas/actions.ts:297` | Copia literal del anterior, detrás de `moduleEditDenial(supabase, "rates")`; su `isAdmin` ni se usa. Resolución de tenant, no gate. |
| `crm/actions.ts:123/:213/:272` | Cerradas por **SDD-0497 (PR #180)**: las tres actions del mapa de etapas tienen `moduleEditDenial(supabase, "kommo")` al tope (`:182`, `:272`, `:333`) y la lectura posterior pide sólo el tenant. Los números de línea del inventario son de **antes** de esa PR. La propia spec de SDD-0498 ya lo decía. |

Es el mismo patrón que SDD-0498 describió para `saveFiscalSettingsAction`: «no
era explotable; sí era la segunda forma de resolver el rol».

**Queda una decisión de producto, no de gate**, y no la tomé: SDD-0497 gateó el
mapa de etapas de Kommo con `moduleEditDenial("kommo")`, que admite `commercial`
además de `admin`. El encargo lo describe como **admin-only** y sugiere
`tenantAdminGate`. Cambiarlo **restringe** (dirección segura), pero le saca la
pantalla a `commercial`: es decisión de Sam, no de una tarea de contratos.

## Pruebas y mutantes

El analizador tiene su propia batería de **disposiciones infelices**
(`rbac-action-scan.test.ts`, 51 casos): guard después del acceso, guard en la
acción de al lado, guard en `if`/`catch`/`finally`/bucle/`switch`/callback/`&&`/
`??`/`?:`, guard y acceso en la misma línea, helper local con y sin guard,
recursión mutua, `Array.from`, `auth.getUser` contra `auth.updateUser`, barrels,
flechas exportadas. Un detector sin sus propios casos es otra cosa que nadie está
midiendo.

**Mutantes del diff** (ninguno toca código ajeno):

| Sobre | Resultado |
|---|---|
| **analizador**, 15 mutantes: guards en callback/`try`/`if`/bucle/`&&`/`?:` pasan a contar; comparar por línea en vez de offset; `Array.from` como tabla; `auth.getUser` como acceso; helpers locales que no aportan guard; buscar el guard sin exigir dominancia; no ver accesos escondidos; `storage.remove` y `rpc` que dejan de contar; `moduleViewDenial` como guard de edición | **15 de 15 mueren** |
| **contrato**, 4 mutantes: abrir el borrado de documentos; mover un guard después de la escritura; abrir **una** acción entre otras gateadas; abrir una acción de un `*-actions.ts` | **4 de 4 mueren**, y la aserción **vieja** sobre el mismo archivo **seguía en verde en los cuatro** |

El mutante que sobrevivió en la primera vuelta (`auth.getUser` como acceso) no
era prueba faltante sino **código que sobraba**: sin ese chequeo, `accessOfCall`
caía igual en su `return null` final. Al hacerlo portante apareció un hueco real
— `auth.updateUser` no contaba como escritura — y ahora el default bajo `auth` es
escritura.

## Alcance

**Hecho:** las dos mutaciones de `document-actions.ts`; el contrato nuevo con sus
dos listas; el analizador con sus pruebas; el doble de PostgREST con `storage`.

**Fuera de la frontera de esta sesión** (el Director asignó `app/api/**` a la
sesión «Endpoints HTTP»): `app/api/studio/searates/probe/route.ts:41`,
`app/api/studio/legal/evidence/[code]/route.ts:56` y
`lib/http/studio-session.ts:50` (lo usan 4 route handlers). **No se tocaron.**

Sobre el último, el Director midió y dictaminó el 2026-09-21:
`requireStudioSession()` lee `user_tenants` sin `user_id` y sin `disabled_at`,
pero **la policy viva en producción corta las dos cosas**, así que es redundancia
perdida y no un hueco. Su dueño natural es la spec que extienda este contrato a
`app/api/**`, no esta tarea ni la de endpoints de hoy.

**Detectado y NO arreglado:** `lib/studio/renditions/actions-helpers.ts:58`
(`resolveAdminTenant`, dinero + módulo `SUPERADMIN_ONLY`) quedó sin revisar por
el cierre del día; las 24 entradas de `DEUDA`; y el panel
`tracking/[id]/_components/ShipmentDocsPanel.tsx`, que **no tiene `canEdit`** y
le muestra el botón de borrar a quien no puede borrar — es cambio de UI y pasa
por su propio review.

**Sin migración.** Todo es capa de aplicación; las policies citadas ya existen y
no se tocan.

## Riesgos y lo que NO cambia

- **Ningún rol gana permisos.** El único cambio de comportamiento son las dos
  actions de documentos, y es en dirección restrictiva: quien antes recibía un
  `{ ok: true }` vacío ahora recibe la denegación.
- **Tampoco restringe de más, y no hace falta correr nada para saberlo.** Un
  candado agregado rompe un flujo legítimo si niega a alguien que llegó por la
  puerta correcta; acá no puede pasar, porque el predicado que se agrega **ya es
  el que rige toda la pantalla**:
  - `app/studio/(app)/tracking/layout.tsx:16` gatea el subárbol entero con
    `requireModuleView("tracking")`, así que quien ve el panel ya pasó el gate de
    vista de ese módulo;
  - las otras **ocho** mutaciones del mismo subárbol ya usaban
    `moduleEditDenial(supabase, "tracking")` — `[id]/actions.ts:52`, `:113`,
    `:182`, `:215`, `:267`, `:365`, `:436` y `nuevo/actions.ts:88`.

  Las dos de documentos eran las **únicas** sin candado de la pantalla. O sea:
  quien pueda editar cualquier otra cosa del envío puede seguir subiendo y
  borrando sus documentos. Los únicos que quedan fuera —`support` y
  `marketing`— tampoco podían editar nada más ahí, y en el caso de `support` la
  RLS ya lo rechazaba en silencio mientras la pantalla le decía que sí.
- **Cambia un mensaje en un borde**: donde la subida decía «No se pudo resolver
  el tenant» por falta de membresía, ahora responde la denegación por permiso.
  No se le informa a un desconocido si existe o no una membresía.
- **El contrato puede dar rojo por tiempo.** Lee y parsea 73 módulos con el
  compilador de TypeScript; aislado corre en ~1 s, pero con otra suite al lado la
  contención lo puede llevar al tope. Ese rojo **no es el mismo** que el de
  contenido: se vuelve a correr con la máquina quieta y, si persiste estando
  libre, se perfila — no se salta la prueba ni se relaja su tope (SDD-0486).

## Evidencia pendiente

- La cobertura de la RLS se midió sobre los **archivos de migración del repo**,
  incluido el bloque `do $post$` de la 0439, que es una aserción ejecutada en el
  momento de aplicarla. **No se verificó contra producción** qué policy está viva
  hoy; esta tarea no tiene esa autorización, y una policy la puede haber
  reescrito un `do $$` posterior que no la nombra.
- Las 24 entradas de `DEUDA` **no tienen prueba** ni verificación de su RLS de
  respaldo. Lo que dice cada entrada es lo observado en el código, nada más.
- `pnpm verify` completo **se corrió** con turno del Director: **exit 1, 16 de 17
  pasos, un solo fallo — `build`**. Los 15 restantes pasaron (incluidos `test`,
  `e2e`, `sql-tests` y `schema-rebuild`) y `migrations-applied` dio **SKIP** por
  falta de `.env.local`, así que **nada se afirma sobre qué hay aplicado en
  producción**.

  El rojo de `build` son 18 errores de `next/font/google` y **no se reprodujo**:
  el paso `scripts/check-build.mjs` del CI sobre este SHA, el deploy de Vercel
  sobre este SHA y una corrida local del mismo script en frío salieron los tres
  verdes, y los seis archivos que el error nombra son idénticos a `origin/main`.
  Queda registrado como **fallo local no reproducido**, no como verde.

  Se retiró en el camino una explicación propia —que Turbopack elegía la raíz
  equivocada por los «multiple lockfiles» del worktree anidado—: ese aviso sale
  también en las corridas verdes, así que encajaba con el síntoma sin ser la
  causa. El detalle está en el handoff.
