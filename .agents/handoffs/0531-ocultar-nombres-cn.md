# Handoff · 0531-ocultar-nombres-cn

- **Fecha:** 2026-10-15
- **Owner:** subagente Worker del Director; claim local `w-ocultar-nombres-cn`, liberado al cerrar.
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a390bfaea08532fcf`
- **Rama:** `codex/ocultar-nombres-cn` (sin upstream a main; push explícito rama→rama).
- **Base:** `origin/main` `a8d99acf` (Merge PR #223). La reserva local `codex/sdd-reserve-0531-ocultar-nombres-cn` (`3dac0d83`) entró por fast-forward: es el primer commit de esta rama.
- **SDD:** 0531 — `docs/specs/0531-ocultar-nombres-cn/spec.md`, estado `in-progress`.
- **Migración:** ninguna. La **0481** asignada queda **libre** (spec §Por qué no hay migración).
- **Estado de tarea:** lista-para-revision.

## OBJETIVO ORIGINAL

Que un usuario del Studio de China deje de ver nombres de clientes y sus datos
personales en Tracking y Naviera: sólo Shipping Mark y códigos, como en Almacén
CN, con la misma regla y un helper compartido, ocultando en el servidor.

Lo que pidió Sam (transmitido por el Director): eligió «Ocultar nombres a
usuarios de China», descrito como «Hoy los usuarios de China ven nombres de
clientes en Tracking y Naviera; solo están ocultos en el módulo CN. Es un tema de
privacidad china (PIPL).»

## COMPLETADO

Criterios 1 a 10 de la spec cumplidos con evidencia en pruebas. El smoke de Sam
queda para después de integrar.

- **Regla en un solo lugar** (`lib/studio/privacidad-cn.ts`):
  - `canSeeClientNames`: la regla de SDD-0039 B.9, sin cambios.
  - `readCanSeeClientNames`: lee la membresía activa del usuario de la sesión;
    ante la duda, oculta.
  - `ocultarDatosDelCliente` y `segunVisibilidad`: hacen una copia profunda con
    nombre, contacto, dirección o ubicación y documento en `null`.
  - `ocultarDatosDelPlanDeCarga`: oculta también el nombre que el plan escribe
    dentro del texto de sus avisos.
  - `etiquetaDelCliente`: elige qué mostrar en lugar del nombre.

  Almacén CN llama la regla compartida y le sigue pidiendo lo mismo a
  `listReceipts`.
- **Tracking:**
  - **Lista:** las filas salen sin nombre y muestran el Shipping Mark en vez de
    «Sin cliente». La búsqueda por nombre no encuentra nada.
  - **Envío seleccionado:** se oculta antes de pasarlo al mapa, la línea de tiempo
    y las acciones.
  - **Detalle:** el encabezado muestra el Shipping Mark y el panel no muestra
    nombre ni ubicación. El plan de fechas y el cambio de destino reciben el envío
    oculto.
  - **Guardar:** el panel usa `updateShipmentSinUbicacion`. Esa acción vuelve a
    leer la ubicación en el servidor y delega en `updateShipment`. Hace falta
    porque `updateShipment` guarda `null` en todo campo ausente y, sin ella, la
    ubicación se borraría.
  - **Alta:** sin la lista de 500 nombres ni el buscador de clientes. El nombre lo
    pone el servidor a partir del Shipping Mark del tenant.
- **CSV y API:**
  - El CSV de embarques sale con la columna `cliente` vacía; la cabecera no cambia.
  - `GET /api/studio/shipments` y `GET|PATCH /api/studio/shipments/[id]` llegan
    sin nombre ni ubicación.
- **Naviera:**
  - Contenedores, carga suelta, estiba y plan llegan sin nombres, incluido el
    texto de los avisos.
  - El cajón de asignar ya no tiene el campo «Cliente».
  - `assignLooseCargo` resuelve el nombre en el servidor: lo toma del embarque de
    la pieza o, si no, del Shipping Mark del tenant.
- **Venezuela y admin:** sin cambios, probado en cada suite.
- **Sin tocar:**
  - `embarques/**`, `tracking/[id]/actions.ts` y `_components/FooterActions.tsx`;
  - `lib/studio/rbac.ts`, que no hizo falta;
  - Portal, app móvil y notificaciones.

### Pantallas y campos cubiertos

| Pantalla o ruta | Campos ocultos |
|---|---|
| `/studio/tracking` (lista, búsqueda y envío seleccionado) | `client_name`, `destination_gps` |
| `/studio/tracking/[id]` (encabezado, panel de datos, plan de fechas, cambio de destino) | `client_name`, `destination_gps` |
| `/studio/tracking/nuevo` | lista de nombres y buscador de clientes (nombre y RIF) |
| `GET /api/studio/operativo/export?tipo=embarques` | columna `cliente` |
| `GET /api/studio/shipments` y `GET\|PATCH /api/studio/shipments/[id]` | `client_name`, `destination_gps` |
| `/studio/naviera`: contenedores y carga suelta | `client_name` |
| `/studio/naviera`: estiba | `clientName` |
| `/studio/naviera`: plan de carga | `input[].clientName`, `pasos/sinUbicar[].clientName` y el nombre dentro de `avisos[].mensaje` |
| `/studio/naviera`: asignar carga | campo «Cliente» |

El resto del conjunto de claves (teléfono, correo, dirección, documento,
firmante del POD) se oculta también si alguna consulta lo agrega.

### `/ui-check` (inline, sobre el diff)

```
🎨 UI-CHECK · Tracking (lista, detalle, alta) y Naviera (cajón de asignar)
Hallazgos (3):
1 ⭐ [baja] ShipmentDataPanel.tsx — la nota de ubicación reservada usa padding
   12px 14px, fuera de la escala de 4 px por el 14. Copia el bloque de GPS que
   reemplaza (mismo inset); se deja igual para no desalinear.
2  [baja] ShipmentDataPanel.tsx — con los nombres ocultos el Shipping Mark queda
   solo en una grilla de dos columnas (media fila). Se lee bien y no salta.
3  [baja] ShipmentDataPanel.tsx — el 🔒 de las etiquetas es preexistente.
✅ Lo que está bien: sólo tokens (--bg-elevated, --border, --ink-soft); textos con
tuteo y sin voseo («no se muestra en tu región», «Lo completa el sistema»); sin
botones ni componentes nuevos; Shipping Mark en vez de «Sin cliente», que habría
dicho algo falso.
Veredicto: OK para commit.
```

### Revisión de datos personales

Está en la spec (§Revisión de datos personales), con `archivo:línea`. Hay tres
hallazgos `ENCONTRADO` fuera de alcance:

- la base sin frontera de región;
- Almacén CN mandando la tabla `clients` completa;
- la búsqueda global sin la regla.

## VALIDACIÓN

SHA observado: `d45df1c7` (cabeza antes del commit de este handoff), en este
worktree.

| Comprobación | Estado | Detalle |
|---|---|---|
| Pruebas focalizadas (7 suites nuevas) | PASÓ | 83 de 83 en el control de mutantes |
| Suites existentes de los módulos tocados | PASÓ | `app/studio/(app)/{tracking,naviera,cn,__tests__}`, `app/api/studio`, `lib/studio/naviera`, `lib/studio/export`: 37 archivos, 489 de 489 |
| Contrato anti-drift `rbac-actions-guard.test.ts` + `rbac-action-scan.test.ts` | PASÓ | 487 de 487 (75 archivos, 431 acciones) |
| Mutantes manuales | PASÓ | 34 de 34 muertos (cada uno con exit 1 y «N failed»); control verde antes y después (83 de 83). M5 sobrevivió en la primera corrida: las pruebas medían con el mismo conjunto de claves que se mutaba; se agregó la comprobación por valor y un inventario escrito en la prueba |
| typecheck (`tsc --noEmit`) | PASÓ | exit 0 |
| lint (ESLint sobre los 27 archivos tocados) | PASÓ | exit 0 |
| rsc-boundary | PASÓ | 1667 módulos, sin cruces |
| docs:check | PASÓ | 508 specs, índice sincronizado |
| sdd:check (numbering) | PASÓ | sin números repetidos (choques históricos ya conocidos) |
| governance:check | PASÓ | 28 políticas aprobadas, cápsula vigente |
| components:check | PASÓ | CMP-01 válido |
| check-pending-migration-symbols | NO EJECUTADO | no aplica: no hay migración |
| `git merge-tree` contra la PR #232 | conflicto previsto | sólo `lib/studio/rbac-actions-guard.test.ts` (los dos suman una acción); ver HANDOFF AL DIRECTOR |
| `git merge-tree` contra la PR #233 | PASÓ | mezcla limpia |
| `pnpm verify` completo | PASÓ con un crítico sin medir | ver la tabla de abajo |

### `pnpm verify` (una corrida)

- **Cómo:** `node scripts/verify.mjs`, en segundo plano, con el turno de corrida
  pesada que dio el Director y sin otra suite corriendo en la máquina.
- **SHA:** `d45df1c7`.
- **Hora:** de 08:32:31Z a 08:56:13Z.
- **Resultado:** exit 0, con «16 de 17 pasos corrieron de verdad» y «CIERRE
  INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied».

| Paso | Estado | Detalle |
|---|---|---|
| harness | PASÓ | |
| lint | PASÓ | 0 errores. Las 15 advertencias son de archivos que no toca esta rama (`crm/_components/Kommo*`, `DocumentCalculator.tsx`, pruebas del portal, `knowledge-vault.mjs`) |
| rsc-boundary | PASÓ | 1667 módulos |
| typecheck | PASÓ | |
| edge-functions | PASÓ | 4 funciones |
| test | PASÓ en el reintento | **Primer intento:** 1 falla de 9771, en `app/studio/(app)/operarios/_components/PinViewDialog.test.tsx`, «si la contraseña no es la suya…». El foco quedó en «Ver PIN» y no en el campo. Es la carrera de foco que corrige la PR #220 (SDD-0515), en un archivo ajeno a esta rama. **Reintento:** 9770 pasaron y 1 omitida, de 9771 |
| docs:check | PASÓ | |
| numbering | PASÓ | |
| feature-constants | PASÓ | |
| components:check | PASÓ | |
| governance:check | PASÓ | |
| migrations-applied | NO EJECUTADO | SKIP porque el worktree no tiene `.env.local` (no se copian secretos). No aplica: no hay migración en esta rama |
| pending-migration-symbols | PASÓ | 0 ROJO · 0 AMARILLO |
| sql-tests | PASÓ | 228 contratos, postgres:17 efímero |
| schema-rebuild | PASÓ | 453 migraciones desde cero y aislamiento multi-tenant verificado |
| e2e | PASÓ con aviso | 177 pasaron, 1 inestable, 20 omitidas, 0 fallaron. La inestable es `e2e/auth.spec.ts:81`, «Acceso: un token inválido…». El proceso salió ≠ 0 por el worker de WebKit que no cierra en Windows; el gate lo marca como aviso |
| build | PASÓ | build de producción OK; `tsconfig.json` restaurado |

## COMMITS

- `3dac0d83` — reserva SDD-0531 (stub).
- `c1f213fa` — regla de nombres para China en un solo lugar (helper, doble, pruebas y Almacén CN).
- `3d7dfc1b` — Tracking sin nombres de clientes para China.
- `e023b849` — CSV y API de envíos sin nombres para China.
- `12135063` — Naviera sin nombres de clientes para China.
- `d45df1c7` — spec e índice.
- Commit que contiene este documento.

## PR / BRANCH

- **Rama:** `codex/ocultar-nombres-cn` → **base:** `main`.
- **Worktree:** la ruta de arriba.
- **PR:** el URL queda en el cuerpo del reporte al Director.
- **Fusión:** no se fusiona; los merges están congelados hasta después del corte.

## PENDIENTES DE ESTA TAREA

1. Revisión del Director.
2. El smoke de Sam (abajo), después de integrar.
3. Cerrar la spec a `done`: agregar la fila de SDD-0531 en
   `docs/architecture/module-sdd-map.md` (Tracking/Embarques y Naviera) al cerrar,
   como las demás specs.

### Smoke para Sam

Necesitas dos usuarios del Studio:

- **A**: admin, o un usuario de Venezuela.
- **B**: un usuario con oficina **China** y rol **operations** o **warehouse**.

> ⚠️ Los pasos marcados con ✍️ escriben en la base real (Preview comparte
> Supabase con producción). Hazlos sobre un envío o contenedor de prueba, o
> sáltalos.

1. **Con A, Tracking.** Entra a `/studio/tracking` y anota un envío con nombre y
   su Shipping Mark. Abre el detalle: se ven el nombre y, si es terrestre, el GPS.
2. **Con B, la lista de Tracking.** Abre `/studio/tracking`:
   - Las filas muestran el **Shipping Mark**, no el nombre ni «Sin cliente».
   - Busca el nombre del paso 1: dice «Ningún envío coincide con la búsqueda.»
   - Busca el Shipping Mark: el envío aparece.
3. **Con B, el detalle.** Abre el mismo envío:
   - El encabezado muestra el Shipping Mark.
   - No aparece el campo «Cliente».
   - En un terrestre aparece «La ubicación de entrega no se muestra en tu región.»
4. ✍️ **Con B, guardar.** Cambia las notas y guarda. Con A, revisa que el GPS
   siga igual.
5. **Con B, exportar.** Toca «Exportar» en `/studio/tracking`: la columna
   `cliente` del CSV sale vacía. Con A, la misma columna trae los nombres.
6. **Con B, Naviera.** Abre `/studio/naviera`:
   - En un contenedor, la columna Cliente de las piezas dice «—».
   - En «Carga suelta» pasa lo mismo.
   - En el plan de carga no hay nombres; un lote sin Shipping Mark aparece como
     «Lote sin Shipping Mark».
   - Con A ves los nombres en esos mismos lugares.
7. ✍️ **Con B, asignar carga.** En un contenedor de prueba, «Asignar carga» no
   tiene el campo «Cliente». Asigna una pieza suelta. Con A, la pieza muestra el
   nombre del cliente.
8. ✍️ **Con B, crear un envío.** En `/studio/tracking/nuevo` no hay buscador de
   clientes, sólo el Shipping Mark. Crea un envío de prueba con el Shipping Mark
   de un cliente existente. Con A, el envío muestra el nombre del cliente.

**Falla si:**

- con B aparece cualquier nombre de cliente o un GPS en esas pantallas o en el
  CSV;
- con A falta un nombre que antes estaba;
- el GPS de un envío cambia después del paso 4.

## Impacto documental y conocimiento

- **Documentos canónicos:** la spec nueva y el índice regenerado. No se tocó
  ninguna fuente de `semanticPilot` ni el mapa Archify
  (`docs/architecture/knowledge-lifecycle.archify.json`), así que no hace falta
  recibo semántico.
- **`knowledge:status`:** exit 0, `ok: false`. En este worktree no hay
  `graphify-out`:
  - estructural `INVALID`, con 3375 faltantes y 4584 pendientes;
  - semántica `INVALID`;
  - Archify `PENDING` (`ARCHIFY_RUNTIME_MISSING`);
  - Obsidian `PENDING`.

  No se generaron derivados acá. Graphify, Archify y la bóveda los publica el
  Director desde main integrado.
- **Pendiente de integración:** la fila de `module-sdd-map.md` al cerrar la spec.

## FUERA DE ALCANCE DETECTADO

1. **`/studio/embarques`.** No se tocó, por la SDD-0522 (PR #232).
   - **El problema:** `app/studio/(app)/embarques/page.tsx:22` usa
     `listShipments(supabase, {})`, que trae `client_name` y lo busca con `ilike`.
     Pasa a `EmbarquesClient`, que agrupa por cliente con el nombre cuando no hay
     Shipping Mark (`lib/studio/shipment-queries.ts:430-437`).
   - **Propuesta,** en una spec propia después de integrar la #232:
     - aplicar `segunVisibilidad(filas, await readCanSeeClientNames(supabase))` en
       `embarques/page.tsx`;
     - pasar `nombresOcultos` a `EmbarquesClient` para usar `etiquetaDelCliente`
       en filas y grupos;
     - agrupar por Shipping Mark;
     - revisar que las acciones de Embarques no devuelvan nombres.

     Las pruebas se arman con el mismo doble (`lib/studio/__tests__/privacidad-cn-double.ts`)
     y las mismas aserciones por clave y por valor.
2. **Almacén CN manda la tabla `clients` completa al navegador del equipo de
   China.**
   - **El problema:** `app/studio/(app)/cn/page.tsx:75` (`listClients`) entrega
     nombre, correo, teléfono, dirección, RIF, `lat`/`lng` y `cedula_photo_path`
     (`lib/studio/client-queries.ts:39-40`). Contradice el criterio de SDD-0039 y
     `/privacidad` §4.
   - **Propuesta:** para quien no puede ver nombres, pasar sólo `{ id, markbox }`,
     o lo que use el selector de `AlmacenCnClient`.
   - **Por qué no se hizo:** el encargo pedía no cambiar el comportamiento de CN.
3. **Búsqueda global y buscador de clientes.** `lib/studio/global-search/search-action.ts:109`
   y `:136`, y `lib/studio/client-search-action.ts:94` devuelven nombres y RIF a
   cualquier rol con acceso, sin la regla. Para China deberían buscar sólo por
   Shipping Mark y código, y devolver resultados sin nombre.
4. **La base no tiene frontera de región.**
   - **El problema:** la RLS de `shipments` y `clients` compara sólo el tenant
     (`0012_rls_perf_and_rpc_guards.sql:228-231`, `0456_clients_write_rbac.sql:203-204`),
     y el navegador del Studio tiene un cliente de Supabase con la sesión
     (`lib/db/client.ts`).
   - **Propuesta:** una spec con migración que quite el SELECT de las columnas de
     cliente a `authenticated` y lleve todos sus lectores a vistas o RPC con la
     regla. Necesita el OK de Sam.
5. **Otros módulos** que un rol de China puede abrir siguen mostrando nombres:
   Clientes, Dashboard, Cobranzas, Facturación, CRM y otros. El rol decide el
   módulo y la región no cuenta. Propuesta: una matriz rol × región por módulo.
6. **Admin de la región China ve nombres.** Es la regla vigente, pero
   `/privacidad` §4 no hace esa excepción. Lo decide Sam.
7. **`docs/legal/privacidad/registro-tratamiento.md:23` y `:26`** dicen que nombre
   y teléfono los ve el «Equipo VE y CN», lo que contradice `/privacidad` §4. Lo
   deciden Sam y la abogada.
8. **PR #233 (SDD-0530).** El resultado de su RPC trae `clientName` en cada envío
   avanzado (`lib/studio/naviera/avance-por-contenedor.ts`, `EnvioAvanzado`, en su
   rama). El resumen visible sólo pinta el Shipping Mark, pero no verifiqué si la
   respuesta de la acción al navegador lleva el nombre. Conviene revisarlo antes de
   integrarla.
9. **`app/m/erp/page.tsx:81`** (app móvil) usa `listShipments` con nombres. Quedó
   fuera por encargo.
10. **La causa raíz de `updateShipmentSinUbicacion`.** `updateShipment`
    (`tracking/[id]/actions.ts`) guarda `null` en todo campo ausente del
    formulario. Si después de la 0522 pasa a escribir sólo los campos presentes
    (`formData.has`), esa acción puente sobra y se puede retirar.
11. **Textos libres y documentos** pueden llevar nombres o teléfonos: notas,
    motivos, eventos, comentarios, nombres de archivo y el contenido de BL y POD.
    No se reescriben: son editables y reescribirlos borraría el dato.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR. No hay migración ni nada que aplicar.
- **Orden con la PR #232:** cualquiera puede ir primero. La segunda que se
  integre resuelve el conflicto de `lib/studio/rbac-actions-guard.test.ts` así:
  - superficie: `total: 76, exactos: 55, conPrefijo: 21`;
  - inventario: `432`;
  - se conservan los dos comentarios.

  `cn/page.tsx`, `tracking/[id]/page.tsx` y `api/studio/shipments/[id]/route.ts`
  se mezclan solos. El índice `docs/specs/README.md` se regenera con el driver.
- **PR #233:** se mezcla limpia. Ver el punto 8 de FUERA DE ALCANCE.
- **Contratos compartidos:**
  - `lib/studio/privacidad-cn.ts` es el lugar de la regla. Cualquier pantalla
    nueva con datos de cliente debería pasar por `segunVisibilidad`.
  - El inventario anti-drift suma `updateShipmentSinUbicacion`.
- **Deploy:** al fusionar a main se despliega (Vercel). El smoke va después.
- **Ownership:** el claim se libera al cerrar esta sesión. No hay otras sesiones
  consumidoras de este worktree.
