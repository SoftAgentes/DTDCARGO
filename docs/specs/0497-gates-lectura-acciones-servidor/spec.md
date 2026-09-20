---
sdd: "0497"
title: "Gates de RBAC en ocho server actions del Studio que no los tenían"
status: done
author: "Claude"
created: 2026-09-20
updated: 2026-09-20
supersedes: null
superseded_by: null
related: ["0024", "0042", "0056", "0058", "0059", "0085", "0139", "0157", "0200", "0209", "0252", "0256", "0356", "0407", "0492", "0494"]
confidencialidad: interno
---

# SDD-0497 — Gates de RBAC en ocho server actions que no los tenían

> Ocho acciones del Studio corrían sin candado de rol. Se les pone
> `moduleViewDenial` a las que exponen y `moduleEditDenial` a las que mutan,
> **antes** de tocar datos y devolviendo el motivo. **Sin migración.**
>
> Gatear la acción **no cierra la exposición**: la lectura de esas tablas sigue
> siendo tenant-wide en la base y se alcanza por PostgREST. Es deuda deliberada
> y documentada, y queda **fuera de alcance** — ver «El candado no es el límite».

## Contexto

`getBillHistory` de Tesorería se cerró en SDD-0494 al descubrirse **por
casualidad**, mientras se gateaba una lectura nueva a su lado. Eso disparó un
barrido de las **448 acciones exportadas en los 77 archivos `"use server"`** bajo
`app/studio/(app)`, y apareció que no era un caso aislado.

El patrón es siempre el mismo y tiene tres piezas:

1. **Una server action de Next.js es un endpoint invocable directamente.** El
   `requireModuleView` del `layout.tsx` (o de la `page.tsx`) protege la
   **página**, no la acción. Es justo lo que dice el docstring de
   `moduleEditDenial` (`lib/studio/rbac-guard.ts`, SDD-0085 §Seguridad).
2. **Cuando la policy de la tabla sólo pide `tenant_id`, no hay segunda línea.**
   Sin predicado de rol, cualquier miembro autenticado del tenant llega.
3. **El reflejo de gatear la mutación está bien instalado; el de gatear la
   lectura, no.** Y la lectura es igual de invocable.

### Por qué el anti-drift no lo vio

Existe un contrato que escanea las actions del Studio,
`lib/studio/rbac-actions-guard.test.ts`. Estaba **verde** con los ocho huecos
abiertos, y vale la pena escribir por qué, porque el mismo hueco se va a repetir:

**El contrato mira el ARCHIVO, no la acción.** Su aserción es literalmente
`src.includes("moduleEditDenial")` sobre cada `actions.ts` completo. Un archivo
con siete acciones gateadas y una abierta lo pasa sin despeinarse. Los **seis**
archivos de esta tarea ya nombraban `moduleEditDenial` en alguna de sus otras
acciones, así que ninguno levantó la mano.

Tiene además un segundo punto ciego: `findActions` sólo recoge archivos llamados
**exactamente** `actions.ts`, así que los 19 `*-actions.ts` del Studio
(`calendar-actions.ts`, `document-actions.ts`, `merge-actions.ts`…) **nunca se
escanean**. De ahí sale el hallazgo suelto del final.

Esta spec **no arregla el contrato** — ver «Fuera de alcance».

## Los ocho, verificados uno por uno

El encargo traía tres verificados a mano por el Director y cinco salidos del
barrido, con instrucción explícita de confirmarlos antes de tocarlos. **Se
confirmaron los ocho**, leyendo en cada caso (a) el archivo de la acción, (b) las
demás acciones del mismo archivo, y (c) la policy **viva** de la tabla — no sólo
el `create policy` original, sino las migraciones posteriores que la tocan,
**incluidas las que la tocan sin nombrarla**, como el `do $$` de la 0230.

| # | Acción | Archivo | Qué le faltaba | Gate puesto |
|---|---|---|---|---|
| 1 | `deleteShipment` | `tracking/[id]/actions.ts:168` | nada, siendo la más destructiva | `moduleEditDenial("tracking")` |
| 2 | `getSupplierFinance` | `financiero-china/actions.ts:612` | sólo `resolveTenant` | `moduleViewDenial("financiero-china")` |
| 3 | `getStatementDetail` | `financiero-china/actions.ts:643` | sólo `resolveTenant` | `moduleViewDenial("financiero-china")` |
| 4 | `getReceivableHistory` | `cobranzas/actions.ts:208` | nada | `moduleViewDenial("collections")` |
| 5 | `sendReplyAction` | `conversaciones/actions.ts:78` | nada | `moduleEditDenial("conversaciones")` |
| 6 | `exportRecoverySmsCsvAction` | `crm/actions.ts:89` | nada, con comentario que lo justificaba | `moduleViewDenial("kommo")` |
| 7 | `searchKommoContactsAction` | `crm/actions.ts:76` | nada, con comentario que lo justificaba | `moduleViewDenial("kommo")` |
| 8 | `seedTenantCitiesFromVeCatalogAction` | `admin/rutas/actions.ts:342` | nada | `moduleEditDenial("admin-rutas")` |

Más **`convertLeadToClientAction`**, que no venía en el encargo y se cierra acá
— ver «La novena».

### La evidencia de policy viva, por tabla

Ninguna de las tablas alcanzadas tiene predicado de rol en la lectura. Esto es
lo que hace que el gate de app sea la **única** línea, y por eso se deja escrito:

| Tabla | Policy viva | Predicado |
|---|---|---|
| `shipments` | `"shipments by tenant"` (0002, tocada por 0012/0080/0416) | tenant |
| `supplier_charges`, `partner_ledger_entries` | `"<tabla> by tenant"` (0114:470-499) | tenant (FOR ALL) |
| `partner_statements`, `partner_statement_lines` | `"<tabla> by tenant"` (0115:304-316) | tenant (FOR ALL) |
| `payment_receipts` | `payment_receipts_team_select` (0470:186-191) | tenant |
| `collection_activities` | `"collection_activities by tenant"` (0079:151-155) | tenant (FOR ALL) |
| `conversation_messages` | `"conversation_messages by tenant"` (0106:141-145) | tenant (FOR ALL, `with check` incluido) |
| `kommo_contacts` | `"kommo_contacts tenant read"` (0082:174) | tenant (FOR SELECT) |
| `clients` | `"clients by tenant"` (0456:203-204) | tenant (FOR SELECT) |

Dos notas sobre el método, porque el atajo falla:

- Las cuatro tablas del socio chino tienen la forma **exacta** que barrió la
  0230 (FOR ALL, `deleted_at` en el `using`, ausente del `with check`), así que
  hoy su `using` es sólo `tenant_id`. Da igual para esta spec —lo que importa es
  que **nunca** tuvieron rol—, pero se anota para que nadie lea el archivo 0114
  y crea que el `deleted_at` sigue ahí.
- Para `conversation_messages` hay una evidencia más fuerte que leer el `create
  policy`: el **preflight** de `0433_portal_conversation_realtime_principal_tenant.sql:25-34`
  enumera las policies que espera encontrar sobre la tabla y **aborta si hay
  drift**. Que esa migración haya corrido es una aserción ejecutada contra
  producción de que `"conversation_messages by tenant"` sigue siendo la policy
  del equipo, ALL, para `authenticated`.

### 1 · `deleteShipment` — y el fallo mudo

Mutación destructiva sin ningún gate, cuando **las otras seis acciones del
archivo** llaman `moduleEditDenial(supabase, "tracking")`.

Tiene un segundo defecto, independiente y peor de leer: si el UPDATE fallaba, un
`console.error` se tragaba el error y la action **redirigía igual**. El operador
escribía el código exacto del envío (doble confirmación estilo GitHub),
aterrizaba en el listado y se iba creyendo que había borrado. Los dos se
arreglan: la action devuelve `ActionState` y sólo redirige cuando el borrado
ocurrió; `FooterActions.tsx` muestra el motivo.

Que ahora devuelva en vez de redirigir **es** el arreglo, y por eso el test
distingue las dos salidas: un `redirect()` de Next lanza, así que «devolvió algo»
y «redirigió» no se pueden confundir.

### 2 y 3 · Las dos lecturas de Financiero China

`financiero-china` está en `ADMIN_ONLY_MODULES` **y** en
`SUPERADMIN_ONLY_MODULES` (`lib/studio/rbac.ts:179-182`, `:196-201`): matriz
`[]`, admin solamente, y además `is_platform_admin()`. Las dos acciones sólo
llamaban `resolveTenant`.

Exponen **saldo neto del socio, libro mayor, cargos y estados de cuenta con sus
líneas**. La cabecera de `supabase/migrations/0356_superadmin_legal_renditions_gate.sql:16-22`
da por hecho un gate de app que en estas dos funciones no existía.

Llevan `moduleViewDenial`, que arrastra **los dos candados**: el de rol y el de
superadministrador, con mensajes distintos. Un admin del tenant que no opera la
plataforma tampoco pasa — y eso tiene su propio caso de prueba.

### 4 · `getReceivableHistory` — el gemelo exacto

`createClient()` y directo a `listReceipts` + `listActivities`, sin gate,
mientras **las otras siete** del archivo llaman `moduleEditDenial(supabase,
"collections")`. Expone monto, fecha, método y banco de los cobros de un módulo
de DINERO reservado a `accounting`.

Es el mismo defecto que `getBillHistory`, línea por línea. Se cierra igual: gate
de VISTA, y la firma pasa a devolver `error?: string` para que el drawer muestre
el motivo en vez de un historial vacío — que es indistinguible de «esta factura
no tiene cobros».

### 5 · `sendReplyAction` — un rol read-only escribiendo hacia afuera

Inserta un mensaje **saliente** al cliente, firmado con el nombre del agente (o
«Agente DTD»), y le dispara un push al portal. Las otras cuatro del archivo sí
gatean.

Lo que lo hace grave no es el alcance del módulo sino **quién quedaba adentro**:
`support` está en la matriz de `conversaciones` pero es **read-only V1**
(`canEditModule` lo rechaza siempre, y ni un override lo cambia porque esa regla
es inmutable). O sea que el único rol diseñado para no escribir nada le estaba
escribiendo al cliente. `accounting`, `warehouse` y `marketing`, que ni ven el
módulo, tampoco pasan ya.

### 6 · `exportRecoverySmsCsvAction` — extracción masiva de datos personales

El comentario de `crm/actions.ts:85-88` justificaba la ausencia de candado así:

> «Lectura pura del espejo + clients (RLS por tenant), sin mutación → sin gate de
> edición.»

Es **exactamente el razonamiento que falló en Tesorería**. Las dos mitades son
ciertas por separado y la conclusión no se sigue: que no mute quiere decir que el
gate que falta no es el de edición, no que no falte ninguno.

Y acá el razonamiento pesa más que en el resto de la spec, porque lo que sale no
es una pantalla: es un **archivo**. `buildRecoverySmsCsv`
(`lib/studio/kommo-recovery.ts:239-253`) emite **nombre, teléfono en formato
internacional, segmento, días sin actividad y Shipping Mark** del universo
COMPLETO filtrado —`RECOVERY_UNIVERSE_CAP = 5000`, no la página visible— y
`downloadTextFile` lo baja al disco.

**Pasado por `.claude/skills/revisar-datos-ve/SKILL.md`**, como pidió el encargo.
Tres puntos aplican:

- **Punto 2 · minimización y proporcionalidad.** El universo completo sólo se
  justifica para quien corre la campaña de recuperación. La matriz ya dice quién
  es: `kommo: ["commercial"]` + admin. O sea que **el gate del módulo ES el
  criterio de minimización**, no uno nuevo inventado acá. Norma: SC 332/2001,
  principios de finalidad y calidad.
- **Punto 8 · terceros.** El CSV está hecho para entregarse a un **proveedor de
  SMS**. Que la agenda telefónica del tenant salga sin control de rol es el
  supuesto del **art. 20 de la Ley Especial contra los Delitos Informáticos**
  (obtención indebida de data personal), agravado por el **art. 22** si hay
  revelación, con prisión de dos a seis años. Es responsabilidad **penal de
  personas**, no una multa a la empresa: por eso el candado no es cosmético.
- **Punto 12 · titulares que no son tus usuarios.** El segmento `interesado` son
  contactos del espejo de Kommo que **nunca se registraron en el ERP ni
  aceptaron política alguna**. Sus teléfonos viajan en el mismo archivo.

El arreglo es `moduleViewDenial("kommo")`, **antes** de leer el universo. Que el
gate vaya antes y no después con un descarte es parte de la minimización, y tiene
su propia aserción: ni un teléfono sale de la base para un rol sin permiso.

> **Lo que la skill deja abierto y esta spec NO decide:** si exportar en masa
> merece una **capability propia** (SDD-0139: «una capability nombra el ACTO, no
> el módulo») en vez de heredar el permiso de ver la pantalla. Hoy quien ve la
> pantalla ya ve los teléfonos —la lista los muestra y arma enlaces de WhatsApp—,
> así que el delta real del archivo es **volumen** (5000 contra 300 por carga) y
> **portabilidad** (un archivo que sale del ERP). Es una decisión de Sam, no una
> que se toma de paso en una tarea de gates. Queda en FUERA DE ALCANCE.

### 7 · `searchKommoContactsAction`

Su comentario decía: «la RLS filtra por tenant → no hace falta resolverlo acá».
**Es cierto** —`"kommo_contacts tenant read"` compara `tenant_id`— y no viene al
caso: **el tenant no era el permiso a verificar**. Esa policy es FOR SELECT `to
authenticated` sin predicado de rol.

La firma pasa de `KommoContactPick[]` a `{ contacts, error? }`, porque devolver
`[]` a secas haría que la pantalla dijera «sin resultados», indistinguible de una
búsqueda que no encontró nada. Hay un caso de prueba dedicado a eso.

### 8 · `seedTenantCitiesFromVeCatalogAction`

Mutación sin gate; **las otras siete** del archivo lo tienen. La RPC no compensa
por rol: la definición **viva** es la de `0200_rbac_disabled_enforcement.sql:304-334`
(que redefine la de `0024:601`), es `security definer` —o sea que la RLS de
`dispatch_city_catalog` ni se evalúa— y valida **membresía ACTIVA en el tenant y
nada más**.

Una corrección al encargo: el sweep que la tocó no fue la 0211 sino la **0209**,
y no la revocó — le quitó `EXECUTE` a `public` y `anon` pero se lo **conservó a
`authenticated`** (`0209:112-113`), que es precisamente el rol de cualquiera con
sesión. La 0211 es el sweep de `authenticated` y esta función no figura en él.

Gravedad baja —catálogo público de ciudades, idempotente, sin PII— pero el
candado faltaba. Su denegación tampoco se veía: `RoutesClient` sólo pintaba
`seedState.ok`, así que un fallo dejaba el botón mudo; se agrega el banner.

### La novena: `convertLeadToClientAction`

No venía en el encargo. Apareció al leer las dos vecinas del CRM y es **el mismo
defecto, MUTANTE, en el mismo archivo**: crea una fila en `clients` con Shipping
Mark asignado y encola el write-back a Kommo, con `createClient()` y
`user_tenants` y nada más.

Se cierra junto, con el mismo criterio que SDD-0494 aplicó a `getBillHistory`:
dejar una acción gateada al lado de su gemela abierta, en el mismo archivo, es la
incoherencia que invita a copiar la mala.

## Decisión

**`moduleViewDenial` para lo que expone sin mutar, `moduleEditDenial` para lo que
muta, siempre antes de tocar datos, devolviendo el motivo.** Es el criterio que
se aplicó en SDD-0494 y el molde está en `app/studio/(app)/tesoreria/actions.ts:255-292`.

**Sin migración.** Se evaluó y se descarta: todo lo que hace falta ya existe en
la capa de aplicación (la matriz, los guards, el segundo candado de
superadministrador). No se toca `supabase/migrations-baseline.json` y **no se
declara ninguna espera en `pendingBelowCutoff`**.

**Devolver el motivo, no un genérico.** Cuatro de las nueve acciones no tenían
canal de error y se les abrió: `getReceivableHistory` suma `error?`,
`searchKommoContactsAction` pasa a `{ contacts, error? }`, `deleteShipment` pasa
de `Promise<void>` a `Promise<ActionState>`, y el banner del seed de ciudades se
agrega. Un candado que deja la pantalla diciendo «sin resultados» enseña a
desconfiar de la pantalla, no del permiso.

### El candado NO es el límite, y hay que decirlo

**Gatear las acciones reduce la superficie cómoda; no cierra la exposición.**

El límite de lectura de estos módulos es **de capa de aplicación, no de base**:
cualquier miembro autenticado del tenant, con el rol que sea, puede leer esas
tablas **directamente por PostgREST**, sin pasar por ninguna action. La tabla de
policies de arriba es la prueba: ni una tiene predicado de rol en el SELECT.

Esto **no lo introdujo esta tarea**. Es deuda deliberada y documentada: la
cabecera de `0407_invoices_write_rbac.sql:16-19` lo dice para `invoices` y
SDD-0492 lo repite —«el SELECT sigue tenant-wide»— porque su alcance era la
escritura. Cerrarlo **exige RPC minimizadas antes**, y es una decisión de Sam.

Se escribe acá para que nadie lea esta spec y concluya que el límite de lectura
quedó cerrado: **no quedó**.

### «Tenant-wide» acá no quiere decir «entre tenants»

Sam confirmó el 2026-09-20 que **hay un solo tenant en producción**, y el
Director pidió anotar como deuda con fecha de vencimiento —no como urgencia— todo
hueco que dependa de un segundo tenant para ser explotable.

**Ninguno de los nueve depende de eso.** Los nueve son **dentro del mismo
tenant, entre roles**: lo que quedaba abierto no era que el tenant B leyera al
tenant A, sino que un `warehouse` leyera el libro mayor del socio chino, o un
`support` le escribiera al cliente. El único tenant que existe es precisamente
donde vive todo el personal, así que el candado que falta es el que separa a
Yolimar de un operario de bodega.

La frase «tenant-wide» de la sección anterior significa que la policy **no mira
el rol**, no que cruce tenants. Con un solo tenant, esa exposición por PostgREST
sigue siendo tan real como con veinte.

## Alcance

Allowlist exacta:

| Archivo | Cambio |
|---|---|
| `app/studio/(app)/tracking/[id]/actions.ts` | `deleteShipment`: `moduleEditDenial("tracking")`; devuelve `ActionState`; el fallo del UPDATE deja de ser mudo y sólo redirige si borró |
| `app/studio/(app)/tracking/[id]/_components/FooterActions.tsx` | `handleDelete` muestra el motivo en el banner del modal |
| `app/studio/(app)/financiero-china/actions.ts` | `getSupplierFinance` y `getStatementDetail`: `moduleViewDenial("financiero-china")`; cabecera del módulo corregida |
| `app/studio/(app)/cobranzas/actions.ts` | `getReceivableHistory`: `moduleViewDenial("collections")` y `error?` en la firma |
| `app/studio/(app)/cobranzas/_components/CobranzaDrawer.tsx` | la carga del historial muestra la denegación en el banner de error |
| `app/studio/(app)/conversaciones/actions.ts` | `sendReplyAction`: `moduleEditDenial("conversaciones")` |
| `app/studio/(app)/crm/actions.ts` | `searchKommoContactsAction` y `exportRecoverySmsCsvAction`: `moduleViewDenial("kommo")`; `convertLeadToClientAction`: `moduleEditDenial("kommo")`; se corrigen los dos comentarios que justificaban la ausencia |
| `app/studio/(app)/crm/_components/ConvertLeadDrawer.tsx` | la búsqueda muestra la denegación en vez de una lista vacía |
| `app/studio/(app)/admin/rutas/actions.ts` | `seedTenantCitiesFromVeCatalogAction`: `moduleEditDenial("admin-rutas")` |
| `app/studio/(app)/admin/rutas/_components/RoutesClient.tsx` | banner de error del seed (`--danger-text`, no `--danger`: en oscuro el crudo no pasa AA) |
| Seis archivos `__tests__/*-gate.test.ts` | un archivo por módulo, 84 casos — ver «Evidencia» |
| `app/studio/(app)/__tests__/pantallas-muestran-la-denegacion.test.tsx` | criterio 7: las cuatro pantallas renderizan el motivo, 9 casos |
| Esta spec, `docs/specs/README.md` y `.agents/handoffs/gates-lectura-acciones-servidor-0497.md` | documentación |

**Fuera de alcance**, con motivo:

- **RLS y migraciones.** Sin SQL nuevo, sin cambios en
  `supabase/migrations-baseline.json`, sin esperas declaradas. Ninguno de los
  ocho lo exigía.
- **La exposición por PostgREST.** Ver «El candado NO es el límite». Cerrarla
  pide RPC minimizadas o policies de SELECT con rol; decisión de Sam.
- **La capability de exportación masiva.** Ver el punto 6.
- **Arreglar `rbac-actions-guard.test.ts` para que mire por ACCIÓN y no por
  archivo, y para que cubra los `*-actions.ts`.** Es el arreglo de fondo y es el
  que evita la próxima tanda, pero ampliarlo lo pondría rojo sobre decenas de
  acciones ajenas a esta tarea, cada una con su propia decisión de a qué módulo
  pertenece. Es una tarea propia y queda nombrada en el handoff.
- **`tracking/[id]/document-actions.ts`.** Dos mutaciones sin ningún gate, una de
  las cuales **borra el objeto del bucket**. Es el mismo defecto pero en otro
  archivo, que el barrido del encargo no cubría. Nombrado en el handoff como
  FUERA DE ALCANCE DETECTADO, sin tocar.

### Una nota sobre el diff de `FooterActions.tsx`

Ese archivo era el **único blob con CRLF** bajo `app/studio/(app)/tracking`, y
contradecía la regla `* text=auto eol=lf` del `.gitattributes`. Cualquier cambio
en él producía un diff de 730 líneas que sepultaba las 6 reales.

La normalización va en **un commit aparte** (`chore(tracking): normaliza a LF…`),
verificada byte a byte: idéntico salvo los 364 CRLF→LF y un CR suelto al final de
la línea 19 que la normalización de git conservaba. Así el commit de esta spec se
puede leer.

## Aceptación

> **`status: done`.** Los nueve gates están implementados, los ocho criterios
> tienen cobertura automática y catorce mutantes comprobados, y `pnpm verify`
> corrió con el turno del Director: **exit 0, sin fallos en lo medido, 16 de 17**
> — el único sin medir es `migrations-applied`, que da SKIP en todo worktree por
> falta de `.env.local` y no aplica a un cambio sin migración. Detalle paso por
> paso en «Evidencia».

1. Un rol sin el módulo que invoque cualquiera de las nueve acciones **directo,
   sin pasar por la pantalla**, recibe la denegación y **no** los datos: ni un
   recibo, ni un saldo, ni un teléfono, ni un mensaje enviado, ni una fila
   escrita. **Esto vale para las acciones, no para las tablas** — la lectura por
   PostgREST sigue tenant-wide y esta spec no la cierra.
2. El gate corre **antes** de tocar datos: en cada caso la única tabla leída con
   la sesión es `user_tenants`, la del propio guard.
3. `support` no responde conversaciones, ni siquiera con un override por rol.
4. Un admin del tenant que **no** opera la plataforma no lee el saldo del socio
   chino, y su mensaje es distinto del de falta de rol.
5. Un override por rol no abre Cobranzas ni Financiero China: los dos son
   `LOCKED_MODULES`.
6. `deleteShipment` redirige **sólo** si el borrado ocurrió. Si el UPDATE falla o
   el permiso falta, devuelve el motivo, no revalida y no redirige; el modal lo
   muestra.
7. Las cuatro pantallas tocadas muestran el motivo: el drawer de cobranza, el
   drawer de conversión del CRM, el modal de borrado de Tracking y el seed de
   ciudades. Ninguna deja al operador con una lista vacía sin explicación. Y a la
   inversa: una factura **sin cobros** y una búsqueda **sin resultados** no
   pintan alerta, porque el vacío legítimo tiene que seguir distinguiéndose de
   la denegación.
8. Los mensajes de denegación de VISTA y de EDICIÓN no son el mismo texto, y el
   de un fallo técnico tampoco.

## Evidencia

**84 casos en seis archivos**, uno por módulo:

| Archivo | Casos |
|---|---|
| `app/studio/(app)/tracking/__tests__/delete-shipment-gate.test.ts` | 9 |
| `app/studio/(app)/financiero-china/__tests__/lecturas-socio-gate.test.ts` | 20 |
| `app/studio/(app)/cobranzas/__tests__/receivable-history-gate.test.ts` | 11 |
| `app/studio/(app)/conversaciones/__tests__/send-reply-gate.test.ts` | 10 |
| `app/studio/(app)/crm/__tests__/lecturas-y-conversion-gate.test.ts` | 25 |
| `app/studio/(app)/admin/rutas/__tests__/seed-cities-gate.test.ts` | 9 |

Los seis siguen el molde de `mailing/__tests__/send-test-template-admin-guard.test.ts`:
**se usan el guard y la matriz REALES** (`rbac-guard.ts` + `rbac.ts`), y sólo se
reemplazan los bordes —sesión, overrides, lectores y escritores—. Eso importa:
mockear `moduleEditDenial` probaría que la acción respeta la respuesta del guard,
no que **el rol** queda afuera. Acá el rol se fija con una variable y la matriz
de verdad decide. `isPlatformAdmin` tampoco se mockea: va por RPC, así que el
doble de sesión la modela y corre el helper real.

Cada bloque prueba **por el lado negativo**: no que devuelva un mensaje, sino que
**no se leyó ni escribió nada**. Y hay un assert de orden (`sessionReads` ==
`["user_tenants"]`) que se pone rojo si el candado se mueve después de la
lectura — los dos juntos fijan el orden, que uno solo no fija.

### Mutantes

**Diez mutantes comprobados, uno por gate más el del fallo mudo. Los diez mueren,
y en los diez las suites ajenas quedan verdes.** Script en el handoff.

```
1-deleteShipment-gate          propio 4F/4P  · ajenas 0F/323P
2-deleteShipment-fallo-mudo    propio 1F/7P  · ajenas 0F/323P
3-getSupplierFinance-gate      propio 9F/11P · ajenas 0F/311P
4-getStatementDetail-gate      propio 7F/13P · ajenas 0F/311P
5-getReceivableHistory-gate    propio 9F/2P  · ajenas 0F/320P
6-sendReplyAction-gate         propio 7F/3P  · ajenas 0F/321P
7-searchKommoContacts-gate     propio 8F/17P · ajenas 0F/306P
8-exportRecoverySmsCsv-gate    propio 7F/18P · ajenas 0F/306P
9-convertLeadToClient-gate     propio 7F/18P · ajenas 0F/306P
10-seedTenantCities-gate       propio 6F/4P  · ajenas 0F/321P
```

El conjunto «ajenas» son las **ocho** suites que podrían salpicarse —las tres
preexistentes del CRM y las cinco de RBAC— **más las otras cinco nuevas**: un
mutante que tumbara la prueba de otro gate sería un gate mal aislado.

Dos detalles del método que vale la pena conservar:

- **Se cuentan los del diff, no los del archivo.** Dos anclas de mutación
  colisionaban con código **preexistente**: `moduleEditDenial(supabase, "kommo")`
  aparece **cinco** veces en `crm/actions.ts` y `moduleEditDenial(supabase,
  "admin-rutas")` **ocho** veces en `admin/rutas/actions.ts`. El script se negó a
  mutar («ANCLA NO ÚNICA») en vez de tocar lo ajeno, y las anclas se alargaron
  hasta ser únicas. Un `sed` ciego habría mutado código de otra tarea y el
  resultado no habría querido decir nada.
- **`crm/__tests__/stage-control.test.ts` lee `crm/actions.ts` como TEXTO** y
  afirma que contiene `moduleEditDenial(supabase, "kommo")` (`:74`). Queda verde
  bajo el mutante 9 porque sobreviven las otras cuatro apariciones — o sea que
  ese contrato **no** habría detectado el hueco, por la misma razón por la que no
  lo detectó el anti-drift: mira el archivo, no la acción.

### El criterio 7 tiene su propia suite, y hacía falta

`app/studio/(app)/__tests__/pantallas-muestran-la-denegacion.test.tsx`, **9
casos**, renderiza los cuatro componentes de verdad con la action devolviendo la
denegación, y mira si el texto llega al DOM.

Las otras seis suites prueban que las acciones **devuelven** el motivo. Eso no
basta, y la distinción es **la misma forma de fallo que esta spec vino a
cerrar**: un motivo que la acción devuelve y la pantalla tira a la basura deja al
usuario con el genérico —o con una lista vacía— que era el síntoma original.

Cada pantalla lleva además su caso **inverso**, que es el que le da valor al
positivo: una factura sin cobros y una búsqueda sin resultados **no** pintan
alerta. Sin ese par, «siempre muestro el banner» pasaría igual.

**Cuatro mutantes más, los cuatro mueren**, y cada uno mata exactamente su caso:

```
A-tracking-no-pinta-el-motivo   2F/7P → los dos casos del modal de borrado
B-cobranzas-no-pinta-el-motivo  1F/8P → el del drawer de la factura
C-crm-no-pinta-el-motivo        1F/8P → el del drawer de conversión
D-rutas-boton-mudo              1F/8P → el del seed de ciudades
```

> **Una lección del propio fixture, que casi se cuela.** El caso «cuando borra de
> verdad no inventa ningún error» modelaba el camino feliz con
> `new Promise(() => {})` —una que no resuelve jamás, porque `redirect()` lanza y
> la action no devuelve—. El precio lo pagaba **otro bloque**: la transición de
> React quedaba abierta y los dos casos de «Admin · Rutas», 150 líneas más abajo,
> fallaban porque su `useActionState` no llegaba a pintar. En aislamiento los
> tres pasaban; juntos, dos rojos lejos de su causa. Ahora la promesa se cierra
> en un `finally`. Un fixture que deja trabajo colgando no es un fixture, es una
> fuga — y el rojo aparece donde no está el problema.

La suite corrió **tres veces seguidas en verde** después del arreglo, porque un
rojo intermitente y uno real no se distinguen por el color.

### Lo que ya estaba verde y sigue verde

`pnpm exec tsc --noEmit`: **exit 0, sin salida** (capturado a archivo; `tsc | head`
devolvería el exit de `head`, no el de tsc).

226 casos en 11 archivos: los seis de gates, los tres preexistentes del CRM,
`lib/studio/rbac.test.ts` y `lib/studio/rbac-actions-guard.test.ts` — este último
es el anti-drift, que sigue pasando porque esta spec sólo **agrega** gates y no
toca su allowlist.

### `pnpm verify`

Corrida del 2026-09-20, 22:58:26 → 23:16:22 UTC (17 min 56 s) sobre `b821c479`,
con el turno de máquina concedido por el Director. **Exit 0 — y eso NO equivale a
cierre verde completo.** La última línea del propio script, literal:

> `[AVISO] verify: CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied. No hubo fallos en lo medido (16/17); exit 0 NO equivale a cierre verde completo.`

| Paso | Veredicto |
|---|---|
| harness · rsc-boundary · typecheck · edge-functions | PASÓ |
| lint | PASÓ — 15 problemas, **0 errores** |
| test | PASÓ — 8266 pasaron, 1 omitida; 633 archivos |
| docs:check · numbering · feature-constants · components:check · governance:check | PASÓ |
| **migrations-applied** | **NO EJECUTADO** — `[SKIP] sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY` |
| pending-migration-symbols | PASÓ — **0 ROJO · 0 AMARILLO** |
| sql-tests · schema-rebuild · build | PASÓ |
| e2e | PASÓ con aviso — 168 pasaron, 18 omitidos, **ninguno falló** |

Tres lecturas que no se dan por supuestas:

- **El SKIP de `migrations-applied` es estructural**, no de esta tarea: da SKIP
  en todo worktree porque no se copian secretos a los worktrees. Y este cambio
  **no lleva migración**. El paso que sí mide algo relevante acá es
  `pending-migration-symbols`, con 0 ROJO · 0 AMARILLO.
- **Los 15 warnings de lint son ajenos.** Están en `NewPurchaseWizard.test.tsx`,
  `PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx:124`, `KommoClient.tsx:553`,
  `DocumentCalculator.tsx` (×4) y `scripts/lib/knowledge-vault.mjs`. Se corrió
  `eslint` sobre los archivos del diff **por separado** —exit 0, sin salida— para
  poder afirmarlo en vez de suponerlo.
- **El `[OK] e2e (con aviso)` es un exit ≠0 que el script reconoce**:
  `worker-16 process did not exit within 300000ms after stop, force-killed it`, el
  worker de WebKit que no cierra en Windows. No es regresión y no se re-corrió.

Al terminar, el árbol quedó limpio y `tsconfig.json` **sin** residuo de
`.next-verify` — las dos cosas se miraron, porque es justo lo que deja un verify
cortado.

## Riesgos y límites

- **El anti-drift seguirá sin ver el próximo hueco.** Mientras el contrato mire
  el archivo y no la acción, y mientras ignore los `*-actions.ts`, una acción
  nueva sin gate dentro de un archivo que ya tiene otros gateados entra a `main`
  en verde. Esta spec cierra ocho casos; **no cierra la clase**. Es el
  seguimiento de más valor y está nombrado en el handoff.
- **Los mensajes son genéricos a propósito.** `moduleViewDenial` devuelve «No
  tienes permiso para ver esto.» sin decir qué módulo ni qué rol haría falta.
  Es el texto que ya usa el resto del Studio y no se cambia acá; decir de más
  sería enumerarle la matriz a quien está probando puertas.
- **`deleteShipment` cambia de firma.** Pasa de `Promise<void>` a
  `Promise<ActionState>`. El único llamador es `FooterActions.tsx`, que se
  actualiza; `tsc` lo confirma. En el camino feliz el `redirect()` sigue lanzando,
  así que el valor de retorno sólo existe cuando algo falló.
- **Un rol al que se le deniega la lectura ve la pantalla vacía, no un 403.** Las
  cuatro pantallas muestran el motivo, pero siguen renderizando: el redirect de
  página lo hace `requireModuleView`, y ese ya estaba. Nadie con permiso de ver
  el módulo pierde nada.
- **Lo verificado es el estado vivo de las policies según los archivos y los
  preflights del repo, no una lectura del catálogo de producción de esta sesión.**
  Esta tarea no tiene esa autorización. Donde hay lectura de catálogo —las
  policies de cobros y proveedores— es la que el Director hizo el 2026-09-20 y
  quedó registrada en SDD-0494, a su nombre.
