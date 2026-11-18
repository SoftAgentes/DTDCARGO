---
sdd: "0537"
title: "Tarifario de transportistas editable por ciudad, con rutas y auditoría"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-10-15
updated: 2026-11-02
supersedes: null
superseded_by: null
related: ["0236", "0237", "0498", "0174"]
confidencialidad: interno
---

# SDD-0537 · Tarifario de transportistas editable por ciudad

## Pedido

Sam, 2026-10-15, literal: «En la parte de la calculadora hay una sección que se
llama transportistas. Tienen un precio o cotización, pero parece que los precios
cambiaron, entonces quiero poder editar las ciudades de ese transportista en
específico. Necesito que reestructures cómo está hecho y me permita editar los
precios. Por ejemplo, el costo de ese transporte es 80 y nosotros lo vendemos en
123, pero cambiaron algunas rutas y también algunos precios, así que necesito la
opción de poder editarlo.»

Ubicación: Studio › Administración › PRO › Calculadora pública › Transportistas.

Prioridad (Sam, 2026-10-15, vía coordinador): «Autorizo para que avancemos con
esta edición de la calculadora y darle preferencia, ya que acaban de cambiar los
precios y hay clientes cotizando en ella». Entrega por fases: la fase 1 primero.

## Estado medido antes del cambio

- `TransportistasPanel.tsx` pinta el tarifario **de solo lectura**: sólo usa
  `setDefaultCarrierAction`.
- `carrier-actions.ts` ya tiene `saveTariffAction` y `deleteTariffAction` con el
  gate `tenantAdminGate` (SDD-0498), pero ninguna pantalla las llama.
- `saveTariffAction` en modo edición hace `update(...).eq("id", id)` sin
  `.select()`: si la RLS o un borrado previo deja cero filas, devuelve `ok` sin
  haber guardado nada. Lo mismo `deleteTariffAction`.
- `carrier_tariffs` (0330) **no tiene auditoría**. Sus vecinas de la misma
  sección, `calculator_settings` y `calculator_cities`, sí la tienen desde 0293
  (`audit_d5_residual_change`, dominio `configuration`).

## Decisión

### Fase 1 — editar, agregar y quitar (prioridad)

1. **Editar por ciudad.** Cada fila del tarifario del transportista
   seleccionado se abre en un panel lateral (mismo patrón que la pestaña
   Ciudades) con: costo /m³, venta /m³ y el **margen en vivo** (resta), cada
   cuántos días sale, días/frecuencia literal, tránsito, mínimo por despacho,
   venta en ft³ de referencia, condiciones y vigencia. Guardar refresca la
   tabla y `/tarifas` sin deploy (`revalidarTodo`).
2. **Agregar una ciudad** que el transportista no tiene: se escoge de
   `calculator_cities` (sólo las que todavía no tienen tarifa viva con él),
   nunca se escribe un slug. El servidor vuelve a comprobar que la ciudad existe
   y está viva.
3. **Quitar una ruta** con `ConfirmDialog`: borrado en blando (`deleted_at`),
   igual que la acción existente. La web deja de cotizar esa ciudad con este
   transportista y deriva al asesor.
4. **Escrituras honestas.** Editar y quitar exigen que la fila exista, sea del
   transportista indicado y esté viva; si el `update` toca cero filas, la acción
   lo dice en vez de devolver `ok`.

### Fase 2 — cambio en lote (entregada en la misma PR)

Seleccionar varias ciudades (casilla por fila y casilla de encabezado para las
visibles por la búsqueda) y poner **un valor absoluto nuevo** de costo y/o de
venta. El panel muestra el antes y el después de cada ciudad con su margen y
avisa cuántas quedarían con la venta por debajo del costo. **No hay
multiplicador automático de la venta sobre el costo** (SDD-0236): el campo
vacío es «no cambia».

Todo o nada: la acción primero cuenta que **todas** las elegidas sigan vivas
con ese transportista; si falta una, no cambia ninguna. Después un solo
`UPDATE` con `in(id)` y los mismos filtros. Si otra pestaña quita una ruta
entre la cuenta y el `UPDATE`, esa no se toca y la pantalla avisa «Precios
actualizados en N de M ciudades». Un solo toast resumen, sin uno por ciudad.

### Detalles de pantalla que cambian

- La columna **En ft³** muestra el equivalente de la venta vigente
  (`cbmAFt3(price_usd_cbm)`). Antes mostraba la referencia guardada, que al
  editar la venta quedaría mintiendo. La referencia se edita en el panel, con
  aviso si ya no coincide con la venta por m³ (tolerancia de medio centavo).
- El margen positivo se pinta en `--ink` y el negativo en `--danger`. Antes el
  positivo iba en `--success`, que como texto da 4,33:1 sobre blanco y no pasa
  AA (BRAND regla 6).
- Tokens inexistentes del panel original (`--accent`, `--radius-md`,
  `--font-mono`) pasan a los del Studio (`--wine`, `--r-md`, `--f-mono`).
- Buscador por ciudad sin acentos ni mayúsculas, rastro visual de la fila tras
  guardar (`useRowHighlight`) y `?tab=transportistas` en la URL de
  Administración.

### Lo que NO cambia

- La venta no se deriva del costo; el margen es una resta (SDD-0236).
- La RLS de 0330 (lectura por tenant, escritura sólo admin vivo) y el gate de
  aplicación `tenantAdminGate` (SDD-0498) se reutilizan tal cual.
- La RPC anon `public_carrier_tariffs` no cambia: sigue sin exponer costo ni
  identidad del transportista.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| AUD-01 | **no conformidad** en el estado actual → se corrige con 0490 | §2 (`aud-01.md:27`): «cambios de permisos, roles, acceso, **configuración sensible** y credenciales» son eventos obligatorios. §1 (`aud-01.md:15`): mutación y evento son una sola operación. §7 (`aud-01.md:115-116`): cada flujo nuevo o modificado vuelve a pasar el contrato. El precedente de la misma sección (`0293:48-49`, `0293:511`) clasifica `calculator_settings`/`calculator_city` como `configuration` y las audita. `carrier_tariffs` fija el precio que cotiza la web pública y no tiene trigger de auditoría. |
| AUD-02 | no aplica | No cambia quién consulta, retiene ni exporta la bitácora. |
| MP-01 | cumplimiento | Quitar ruta = borrado en blando reversible (se puede volver a agregar la ciudad); confirmación explícita; evento `carrier_tariff_deleted` con motivo fijo, igual que `calculator_city_deleted` en 0293. |
| BTN-01 | cumplimiento | Una acción primaria por superficie (Guardar en el panel), destructiva separada y con confirmación. |
| SGE-00 | cumplimiento | Permiso en servidor y en la base; el cliente nunca ve el costo. |
| FRM-01 / ERR-01 | cumplimiento | Errores por campo del validador; error general en `role="alert"` con foco; un error conserva lo escrito y permite reintentar (envío manual, patrón de CityDrawer). |
| NUM-01 | cumplimiento con observación | Montos con `NumericInput` (canonical): coma o punto, expresiones, valor canónico al servidor. El margen es presentación (resta redondeada a centavos), no se guarda. Observación: un monto con más de 2 decimales lo redondea la base a centavos (`numeric(10,2)` de 0330); el validador no lo rechaza, igual que antes. |
| TBL-01 | cumplimiento | Tabla semántica; columnas esenciales, sin opcionales que configurar; «sin datos» distinto de «sin coincidencias»; la selección muestra cantidad, activa la acción masiva y se limpia de forma explícita (botón, cambio de transportista o tras aplicar). Filtro en cliente: 169 filas, no es un volumen que pida servidor. |
| A11Y-01 | cumplimiento | Paneles con `DrawerShell`/`ConfirmDialog` (foco, Esc, nombre); botones de ícono y casillas con nombre por ciudad; casillas con área de toque de 32 px; el «antes → después» se lee como «pasa a». |
| BUS-01 | no aplica | El buscador filtra la tabla visible; no es búsqueda predictiva. |
| AVS-01 | cumplimiento | Toast al guardar, agregar, quitar y aplicar el lote (uno resumen); la fila editada o agregada se resalta. |
| CMP-01 | cumplimiento | `DrawerShell`, `ConfirmDialog`, `NumericInput`, `Badge`, `EmptyState` existentes; ningún `deprecated`. `components:check` verde. |
| HTD-01 | no aplica | Quitar una ruta es reversible (se vuelve a agregar): no es R3. |
| Resto (CRT, DND, CAL, DAT, PRG, WIZ, UPL, IA, LNK, VIS-02, MOT, LOD, ICO, PLG) | no aplica | Sin creación contextual, arrastre, fechas operativas, progreso, pasos, archivos, IA, enlaces ni movimiento nuevos. Las fechas de vigencia usan `<input type="date">` como antes. |

### Migración 0490 — NO APLICADA

`supabase/migrations/0490_carrier_tariffs_auditoria.sql` agrega el tipo de
entidad `carrier_tariff` y un trigger `AFTER INSERT OR UPDATE` sobre
`carrier_tariffs` que llama al writer AUD-01 real (`append_audit_event`, 0294)
en la misma transacción, con actor `auth.uid()`, antes/después de costo, venta,
ft³, mínimo, frecuencia, tránsito, condiciones y vigencia. No toca filas, no
cambia la RLS, no modifica `audit_d5_residual_change` (función propia).

- **Orden:** migrate-first compatible. El trigger audita igual las escrituras
  del código desplegado hoy, así que se puede aplicar antes del merge.
- **Aplicar exige OK nominal de Sam** nombrando `0490_carrier_tariffs_auditoria`
  y el runbook `docs/runbooks/aplicar-migraciones-prod.md`. Fusionar la PR no
  autoriza aplicarla.

## Allowlist

- `app/studio/(app)/admin/_components/calculator/TransportistasPanel.tsx`
- `app/studio/(app)/admin/_components/calculator/TariffDrawer.tsx` (nuevo)
- `app/studio/(app)/admin/_components/calculator/BulkPriceDrawer.tsx` (nuevo, fase 2)
- `lib/studio/rbac-actions-guard.test.ts` (inventario de acciones 432 → 433, con
  la justificación de `bulkUpdateTariffPricesAction`)
- `app/studio/(app)/admin/_components/calculator/CalculatorSection.tsx`
- `app/studio/(app)/admin/_components/calculator/__tests__/TransportistasPanel.test.tsx` (nuevo)
- `app/studio/(app)/admin/page.tsx` (sólo `?tab=transportistas`)
- `app/studio/(app)/admin/carrier-actions.ts`
- `app/studio/(app)/admin/__tests__/carrier-tariff-actions.test.ts` (nuevo)
- `app/studio/(app)/admin/__tests__/carrier-actions-usuario-suspendido.test.ts` (sólo
  siembra la ciudad del catálogo que el alta ahora exige; la aserción no cambia)
- `lib/studio/freight-carriers/types.ts`
- `lib/studio/__tests__/freight-carriers-types.test.ts`
- `supabase/migrations/0490_carrier_tariffs_auditoria.sql` (nuevo, NO APLICADA)
- `supabase/tests/0490_carrier_tariffs_auditoria.test.sql` (nuevo)
- `lib/studio/__tests__/carrier-tariffs-auditoria.migration.test.ts` (nuevo)
- `supabase/migrations-baseline.json` (espera declarada de 0490)
- `docs/specs/0537-transportistas-tarifas-editables/spec.md`, `docs/specs/README.md`
- `.agents/handoffs/0537-transportistas-tarifas-editables.md`
- `app/studio/(app)/admin/_components/calculator/__tests__/CityDrawer.test.tsx` (corrección del 2026-11-02)
- `.agents/handoffs/sdd-0537-foco-error-repetido-20261102.md` (corrección del 2026-11-02)

`CityDrawer.tsx` entra en la allowlist sólo por su efecto de foco del aviso. Es de
la misma sección y la fila FRM-01 / ERR-01 de esta spec lo toma como patrón.

## Aceptación

1. Un admin edita costo y venta de una ciudad y ve el margen recalculado antes
   de guardar; al guardar, la tabla y `/tarifas` muestran el valor nuevo.
2. Un admin agrega una ciudad eligiéndola de una lista; no aparecen las que ya
   tienen tarifa viva con ese transportista.
3. Un admin quita una ruta sólo después de confirmar; la fila desaparece.
4. Editar o quitar una tarifa inexistente, borrada o de otro transportista
   devuelve error y no `ok`.
5. Con 0490 aplicada, cada alta, edición y retiro deja un evento AUD-01 con
   antes, después y actor; si el writer falla, la escritura se revierte.
6. Un admin cambia en lote el costo o la venta de varias ciudades viendo el
   antes y el después; si alguna elegida ya no está viva, no cambia ninguna.

## Verificación (2026-10-15, en el worktree; sin producción)

- Acciones: `app/studio/(app)/admin/__tests__/carrier-tariff-actions.test.ts`,
  31 casos, con un doble de PostgREST que aplica `.eq()`/`.is()`/`.in()`
  también en las escrituras, devuelve copias, simula el índice único de 0330 y
  una carrera entre la cuenta y el `UPDATE` del lote.
- Pantalla: `_components/calculator/__tests__/TransportistasPanel.test.tsx`,
  20 casos: editar (margen en vivo y FormData exacto), errores por campo y
  generales con reintento, agregar (sólo ciudades libres), quitar con
  confirmación y reintento con el mismo error, buscador, rol sin permiso y lote.
- Helpers: `lib/studio/__tests__/freight-carriers-types.test.ts` (31).
- Migración: `supabase/tests/0490_carrier_tariffs_auditoria.test.sql`, 29
  aserciones en PGlite con el writer real (0267 + 0294) y la 0330 real,
  envuelto por `lib/studio/__tests__/carrier-tariffs-auditoria.migration.test.ts`
  (control rojo, 9 mutantes, 2 drifts del preflight y la espera declarada).
- **Control rojo y mutantes del diff de aplicación:** las pruebas nuevas contra
  el `carrier-actions.ts` y el `TransportistasPanel.tsx` de `main` fallan
  (22 y 19 casos), y los 36 mutantes de las líneas del diff mueren. La primera
  ronda dejó 4 vivos; se cerraron con pruebas (3) y quitando una guarda
  inalcanzable (1).
- `rbac-actions-guard`: la acción nueva pasa su veredicto por acción; el
  inventario sube a 433 con su justificación.

## Estado

- **Fase 1 y fase 2:** implementadas en la PR de esta spec, sin fusionar.
- **0490:** NO APLICADA. Hasta que se aplique, las escrituras del tarifario no
  dejan evento AUD-01 (igual que hoy): el criterio 5 depende de su aplicación.

## Decisiones de criterio para Sam

1. **Auditoría con migración (0490).** Recomendación: aplicarla antes de
   fusionar (migrate-first compatible). Alternativa: fusionar sin ella y
   aceptar por escrito una excepción temporal a AUD-01 para el tarifario.
2. **Margen positivo en negro en vez de verde**, por contraste AA. Si Sam
   quiere el verde, hace falta un token de texto verde que pase AA (hoy no
   existe) y eso es una decisión de marca, no de esta spec.
3. **Columna «En ft³» = equivalente de la venta actual**, no la oferta
   original guardada. La oferta original se sigue viendo y editando en el panel.
4. **Lote sólo con valores absolutos.** No hay «subir un X %». Si Sam lo quiere,
   necesita su propia decisión, porque toca la regla de SDD-0236.

## Registro de integración (2026-10-15)

- **Prioridad de Sam**, literal: «Autorizo para que avancemos con esta edición de la calculadora y darle preferencia, ya que acaban de cambiar los precios y hay clientes cotizando en ella».
- **PR:** #241 (`worktree-agent-ad23b4a6a6176276d`). Cabeza `e6020702` fusionada con `--match-head-commit`; merge `3e0368e0` a las 22:59:42Z.
- **CI:** «Calidad continua» PASÓ sobre esa cabeza (run 38810419899), con la suite y el build. `pnpm verify` local: NO EJECUTADO (una corrida pesada a la vez; el CI corre la suite completa).
- **Deploy:** el status de Vercel del merge dice «Deployment has completed» (23:01:38Z). El ID del deployment y el alias quedan NO VERIFICADOS: el conector de Vercel responde 403.
- **Migración `0490_carrier_tariffs_auditoria`: APLICADA** en el servidor propio (`dtd-cargo-db-1`) con el OK nominal de Sam.
  - Sam pegó «autorizo aplicar 0490_carrier_tariffs_auditoria en el servidor propio» junto con la otra opción. Ante la pregunta del Director eligió «Aplicar la 0490 (Recomendado)», cuya descripción repite esa autorización.
  - Lecturas previas READ ONLY a las 19:15Z, 22:03Z y justo antes de aplicar: «PREFLIGHT 0490 OK».
  - `psql` con la migración y la fila del ledger en una transacción. Ledger `20261015225935 · 0490_carrier_tariffs_auditoria`, una sentencia, md5 `0e604805…` y 11173 bytes, igual al blob de la cabeza fusionada. Ledger en 494 filas.
  - La PR se fusionó 7 s después de la fila del ledger, con la espera todavía declarada, como la 0475 (#212 → #218). La espera sale en el cierre del Director; la cabecera «NO APLICADA» no se corrige.
  - Evidencia: `/srv/ops/evidencias/apply-0490-dtd-cargo-20261015T225936Z/` con `SHA256SUMS`.
- **Comprobado por el Director en producción** después del deploy: `/tarifas` responde 200 y `/studio/admin` redirige al login (307).
- **Revisión del Director:**
  - El `correlation_id` del trigger mide unos 62 caracteres y cabe en los 128 del writer.
  - El lote es una sola sentencia `update … in(id)` con los mismos filtros que la cuenta previa.
  - Riesgo anotado: `MAX_LOTE = 300` y el filtro `in.(…)` va en la URL; con las 169 ciudades de hoy mide unos 6,6 KB, por debajo de los 8 KB habituales del proxy. Con muchas más ciudades conviene filtrar por `city_slug` o partir el lote.
- **Smoke de Sam: PENDIENTE.** Guion en `.agents/handoffs/0537-transportistas-tarifas-editables.md` (rol admin, `/studio/admin?section=calculadora&tab=transportistas` y `/tarifas`). En el lote, probar con una o dos ciudades y devolverlas a su precio.
  - **Corrección del Director (2026-10-16):** la versión anterior de este registro decía «probar también con las 169 ciudades seleccionadas». Es un error: el lote pone el mismo valor en todas las elegidas, así que esa prueba en producción cambiaría el precio de las 169. Se le avisó a Sam. La prueba de tamaño con muchas ciudades se hace en el entorno de prueba (SDD-0540), con datos sintéticos.
- **Estado:** integrada. La spec sigue en `in-progress` hasta el smoke.

## Corrección del 2026-11-02: foco con un error repetido

**Pedido:** Sam, 2026-11-02, literal: «Haz esta tarea aquí: "Devolver el foco al aviso con un error repetido"».

**Defecto, medido en un navegador real** (Chrome 152 del panel de Claude Desktop, con ratón y teclado reales, los componentes reales y acciones simuladas; sin producción ni base). En `BulkPriceDrawer`, `TariffDrawer` y `CityDrawer`, tras un segundo error con el mismo texto:

- El foco queda en `body`, fuera del panel: el botón se deshabilita durante el envío y lo suelta, y el efecto dependía de `[state.error]`, que no cambia.
- El aviso no recibe ninguna mutación, así que un `role="alert"` no tiene nada nuevo que anunciar. Que un lector de pantalla calle es inferencia: no se probó con uno.
- Tab lleva a controles que están detrás del modal.

| Política | Clasificación | Evidencia |
|---|---|---|
| ERR-01 | **no conformidad → corregida** | «El primer error bloqueante recibe foco» (`err-01.md:28`): cada intento fallido bloquea. La fila FRM-01 / ERR-01 de arriba decía cumplimiento porque sólo se probó el primer error. |
| A11Y-01 | **no conformidad → corregida en este caso** | Punto 9, «Errores se identifican, describen y reciben foco/resumen cuando bloquean» (`a11y-01.md:24`). |

**Decisión:** el efecto pasa a `if (!isPending && state.error) errorRef.current?.focus()` con dependencias `[state, isPending]`, el mismo patrón de `PortalAddresses.tsx:282-284` y `PaymentReportForm.tsx:76-82`. No cambia el texto, la apariencia ni la acción.

**Después del arreglo**, en el mismo navegador: el foco vuelve al aviso en el segundo y el tercer intento, Tab sigue dentro del panel y escribir después del error no le quita el foco al campo.

**No cubierto aquí:** una respuesta sólo con errores por campo también deja el foco en `body` y Tab sale del modal, ya desde el primer intento (medido en `TariffDrawer` y `CityDrawer`). Queda como hallazgo aparte: el origen está en el botón deshabilitado y en la trampa de foco de `useDialogA11y`, que no cubre un foco fuera del panel.
