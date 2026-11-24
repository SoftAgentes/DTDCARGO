---
sdd: "0715"
title: "Asignar cliente y consultar ficha en panel derecho"
status: draft
author: "Codex"
created: 2026-11-24
updated: 2026-11-24
supersedes: null
superseded_by: null
related: ["0710", "0669"]
confidencialidad: interno
---

# SDD-0715 — Asignar cliente y consultar ficha en panel derecho

## Objetivo y estado

Sam eligió panel a la derecha para consultar la ficha sin perder la posición del listado. El acceso «Asignar cliente» debe reutilizar Tracking con autorización, vista previa, motivo y confirmación. Estado draft: implementación y revisión estática en progreso; aceptación pendiente. PR preliminar #810 publicada en borrador contra la rama de #809. Instalación y pruebas esperan liberación directa de SDD-0716 según el nuevo traspaso del Director; no hay pruebas de ejecución todavía.

## Casos y flujo

1. Embarque real sin cliente: solo un shipment resoluble y autorizado permite montar `ReassignClientPanel` con `sinCliente`. Elegir cliente, consultar vista previa, escribir motivo de 4 a 1000 caracteres y confirmar conserva el contrato de la acción actual. El servidor repite permisos y restricciones; nunca se deducen del texto DTD-0000.
2. Ficha con nota de pendiente: el listado ofrece el indicador «Nota disponible en la ficha», sin contenido crudo ni prop `notes`: recibe solo `hasNote`. El panel presenta la nota únicamente conforme a la ficha vigente y sus gates. Una nota no demuestra que exista un shipment ni permite reasignar una ficha.
3. Cliente sin embarques o facturas: cero no prueba relación ni permiso. Mostrar información de que se necesita un embarque identificable; no crear relaciones ni habilitar la asignación. Director confirmó el camino informativo para nota sin shipment trazable.

Clientes conserva la tabla montada, filtros, paginación, selección y scroll al abrir/cerrar el panel. La acción de identidad abre la ficha autorizada en `DrawerShell`; cerrar por botón o Escape devuelve foco al disparador con `preventScroll`. Volver desde la ficha vuelve al listado en la misma posición. La navegación alternativa mediante enlace conserva URL válida, incluido abrir en otra pestaña. No se anidan controles interactivos dentro del enlace de fila.

Embarques mantiene el mismo contrato. Director liberó EmbarquesClient tras la entrega de #809, cabeza exacta `5e79383bdd972d2863d194df658beffa9cd05281`, rama `SoftAgentes/sdd-0710-candado-embarques-20261124`. Se incorpora mediante merge normal, preservando candado, asistente y selección. La PR 0715 se prepara contra esa rama si sigue sin integrar. Depende además del arreglo de pestañas #808; no se copia ni integra sin coordinación.

### Accesos de identidad y asesor en la ficha compartida

Ampliación del Director del 2026-11-24: Sam necesita volver a encontrar «Verificar cédula» y «Asignar asesor» con facilidad. Resumen presenta accesos visibles «Verificación de identidad» y «Asesor asignado», con enlaces a Configuración y texto que indica que allí se realiza la acción. Para empresa, el enlace dice «Verificar RIF en Configuración». El acceso de identidad existe exactamente cuando la tarjeta existente aplica: documento, foto o registro por portal. Asesor mantiene su condición y datos existentes.

Configuración ordena primero IdentityVerificationCard (cuando corresponde) y AdvisorAssignCard; después conserva PortalAccessCard, AliadoCard, DeliveryAddressesCard, ClientBillingCard e historial, con los mismos props y permisos. Los formularios se montan una sola vez en Configuración, nunca en Resumen. No se cambian Server Actions ni políticas. La ficha completa y el panel reutilizan esta composición. Los enlaces usan EnlacePestana existente; el hijo SDD-0669 conserva la escritura exclusiva de FichaPestanas.tsx y sus pruebas.

Rutas exactas de esta ampliación, ya dentro de la allowlist:

- `app/studio/(app)/clientes/_components/ClientDetailContent.tsx`
- `app/studio/(app)/clientes/__tests__/ficha-cliente-page.test.tsx`

Se añaden casos de prueba para ambas entradas (completa/panel): visibilidad en Resumen, condición documento/foto/portal, ausencia sin condición, copy de RIF y cédula, enlaces a Configuración, prioridad de tarjetas y una sola instancia de cada formulario. El fallback directo de las rutas de panel conserva una pestaña válida (incluida Configuración) para refresh/otra pestaña; no propaga valores ajenos.

## Allowlist exacta inicial

- `docs/specs/0715-asignar-cliente-panel-derecho/spec.md`
- `docs/specs/README.md` (solo regeneración del índice)
- `app/studio/(app)/clientes/page.tsx`
- `app/studio/(app)/clientes/[markbox]/page.tsx` (ampliación autorizada por Director)
- `app/studio/(app)/clientes/_components/ClientDetailContent.tsx` (ampliación autorizada por Director)
- `app/studio/(app)/clientes/_components/ClientsClient.tsx`
- `app/studio/(app)/clientes/_components/__tests__/ClientsClient.test.tsx`
- `app/studio/(app)/clientes/_components/ClientDetailPanel.tsx` (contenedor local que reutiliza el shell canónico)
- `app/studio/(app)/clientes/_components/__tests__/ClientDetailPanel.test.tsx`
- `app/studio/(app)/embarques/_components/ShipmentDetailDrawer.tsx`
- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx` (traspaso autorizado tras #809; solo enlaces/indicador 0715)
- `app/studio/(app)/embarques/_components/__tests__/ShipmentDetailDrawer.test.tsx`
- `.agents/handoffs/sdd-0715-asignar-cliente-panel-derecho.md`

Solo están autorizadas las rutas enumeradas en esta sección y en la lista anterior. El Director autorizó extraer la composición server a `ClientDetailContent.tsx`: se conservaron íntegros consultas, condiciones y componentes; la página directa delega el markbox resuelto. El layout de Clientes conserva su gate de módulo. No se implementará una copia de la ficha usando indiscriminadamente el objeto `Client` del listado.

### Rutas del panel autorizadas por Director

Prefijo común `app/studio/(app)/`. El enlace normal `/studio/clientes/[markbox]` continúa abriendo página completa desde cualquier otra superficie. Solo los enlaces explícitos de los dos listados usarán la URL de panel correspondiente, con `scroll={false}`:

- `clientes/layout.tsx`: renderizar children y slot ficha, conservando requireModuleView.
- `clientes/@ficha/default.tsx`: null al acceso directo.
- `clientes/@ficha/(.)ficha/[markbox]/page.tsx`: composición server autorizada dentro de ClientDetailPanel.
- `clientes/@ficha/[...rest]/page.tsx`: null al salir del panel.
- `clientes/ficha/[markbox]/page.tsx`: redirección a ficha canónica al recargar/abrir URL directa.
- `embarques/layout.tsx`: children y slot ficha (sin cambiar gates de children).
- `embarques/@ficha/default.tsx`: null.
- `embarques/@ficha/(.)ficha-cliente/[markbox]/page.tsx`: exige explícitamente requireModuleView("clients") antes de componer la ficha, además del acceso de Embarques.
- `embarques/@ficha/[...rest]/page.tsx`: null al salir.
- `embarques/ficha-cliente/[markbox]/page.tsx`: redirección canónica para acceso directo.

Ambas páginas interceptadas reutilizan el mismo ClientDetailContent server y el contenedor ClientDetailPanel client. Cerrar usa router.back para recuperar lista montada y restauración de foco del DrawerShell; se debe probar el desmontaje en navegación, el foco y la interacción con las pestañas internas de la ficha antes de dar aceptación. Director confirmó las rutas y añadió page.tsx raíz nula en ambos slots. Tras el traspaso 0710 se conectaron enlaces explícitos en EmbarquesClient y ShipmentDetailDrawer. El enlace de ficha del grupo es hermano del botón del acordeón, sin controles anidados.

El atajo se decide con el predicado canónico `esSinCliente`, que cubre DTD-0000 y marca vacía o espacios. DTD-0000 lleva `?embarque=<id>` al panel: ese valor solo selecciona dentro de los embarques ya leídos bajo sesión/tenant de la ficha, nunca crea una relación. Un id ajeno, vacío o ambiguo no habilita la asignación. Sin Shipping Mark vinculado se muestra «Sin ficha vinculada. Tracking abre en otra pestaña.» y «Asignar cliente» lleva a `/studio/tracking/<id-exacto>` en otra pestaña para conservar filtros, selección y posición de la lista al regresar. No se inventa DTD-0000 como relación ni se fusiona el comodín. Tracking conserva gates, motivo y confirmación existentes. Los handlers de candado, asistente, selección y rastreo incorporados de #809 no se modificaron.

La ampliación para DDP 64 añade casos de dos filas reales del mismo grupo, cada una con su propio destino, para DTD-0000, marca vacía y espacios, y el contraste de id ajeno/selección exclusiva en la ficha. Pruebas de ejecución pendientes.

## Evidencia del diagnóstico (base reservada)

- `clientes/page.tsx`: exige `requireModuleView("clients")`; listado bajo sesión y RLS, sin shipment identificable por fila.
- `clientes/_components/ClientsClient.tsx`: cada fila es un Link a la ficha; actualmente imprime `c.notes` crudas. Cambiar ese texto por indicador forma parte del alcance.
- `clientes/[markbox]/page.tsx`: composición server con `getStudioAccess`, `canEditModule`, permisos de saldo/estado de cuenta, privacidad CN y módulos habilitados. No se puede sustituir por una copia client del listado sin revisar esos gates.
- `tracking/[id]/_components/ReassignClientPanel.tsx`: reutilizable por shipmentId, código y mark actual; tiene vista previa, motivo y confirmación. Su consumidor en Tracking condiciona por `canSpecial(role, "reassign_shipment_owner")`.
- `embarques/_components/ShipmentDetailDrawer.tsx`: presentación de solo lectura; enlaza a ficha, no resuelve autorización de reasignación.
- `studio/_components/ui/drawer/DrawerShell.tsx`: panel derecho canónico con foco, Escape y restauración; no inventar otro shell.

## Aceptación y verificación pendiente

- Fixtures ficticios: shipment sin cliente autorizado/no autorizado, nota sin shipment, cliente sin actividad, error de resolución y distinto tenant.
- No se monta cuerpo de ficha ni acción fuera de los gates vigentes; indicador no revela notas.
- Motivo, previa, bloqueos y confirmación usan las acciones existentes sin modificar política, RLS ni migraciones.
- Navegación con teclado, foco al cerrar, Escape, botón cerrar y volver; filtros, selección y posición conservados.
- Panel comprobado en móvil y escritorio, incluidos carga/error/vacío; `/ui-check` antes del commit visual.
- En ficha completa y panel, Resumen permite encontrar identidad y asesor, abre Configuración y allí las dos tarjetas aparecen primero, sin duplicados ni cambios de autorización. Validar con la corrección de FichaPestanas del hijo SDD-0669 una vez coordinada.
- Tests focales, `git diff --check`, gates documentales/gobernanza y cierre `pnpm verify`; instalación pesada, verify y build solo después de solicitar turno al Director.

## Riesgo, privacidad y documentación

Riesgo R3 por acceso a ficha y reasignación existente. Cumplimiento previsto: DrawerShell canónico, minimización de notas y autorización server; pendiente demostrarlo con implementación y pruebas. No aplica: datos reales, producción, migraciones y cambios de política. Sin excepciones aprobadas. Inventario del slice: `clients.notes` (texto libre potencialmente personal, consulta interna conforme a ficha); `shipments.client_markbox` (relación existente, solo acción autorizada); motivo (bitácora existente, no incluir datos personales). Retención no modificada ni verificada contra producción. Esta revisión de código no es dictamen legal.

Impacto documental: esta spec, índice generado y handoff propio. No se convierte ninguna propuesta en política.

## Trazabilidad

- Owner: `codex-sdd-0715-panel-cliente-20261124`.
- Rama: `SoftAgentes/sdd-0715-asignar-cliente-panel-derecho`.
- Base reservada: `dd842dfd87af930bd3a21e10e7a7f79721503bf5`; main de la asignación: `8580490f8d95872a407ab83ab9acb6b1b265a451`.
- Sesión Worker: `orca_session_id:4e58e02e-15cc-4709-b887-11de5ebd0b45`.
- Director: `orca_session_id:14b98827-b1e5-41f3-aee0-c72c837f96fc`.
- Task: `task_75e843282aed`; Dispatch: `ctx_59ec39c37538`.
- HEAD inicial verificado igual a base reservada; PR preliminar: https://github.com/SoftAgentes/DTDCARGO/pull/810, en borrador.
- Implementación preservada en `50c9078fd`; merge normal de #809 en `1a39a12eb`, sin conflictos y con el segundo padre exacto `5e79383bdd972d2863d194df658beffa9cd05281`.
- Base de PR prevista: `SoftAgentes/sdd-0710-candado-embarques-20261124` (#809 abierta al recuperar Orca). Dependencia #808 verificada en `9e27b63d419450ca3ab93a4138df209de23b5e84`; no incorporada sin coordinación.
- Head de producto publicado al abrir #810: `af120dbfa0fede792bc85a52e8ae9c83b8e7a178`, incluye conexión de Embarques en `66291e030` y atajo canónico de marcas vacías en `af120dbfa`. Los checks se activarán al pasar a ready tras la validación; el borrador no constituye entrega terminada.

### Ampliación exacta aprobada para slots y pruebas

- `app/studio/(app)/clientes/layout.tsx`
- `app/studio/(app)/clientes/@ficha/default.tsx`
- `app/studio/(app)/clientes/@ficha/page.tsx`
- `app/studio/(app)/clientes/@ficha/error.tsx`
- `app/studio/(app)/clientes/@ficha/not-found.tsx`
- `app/studio/(app)/clientes/@ficha/[...rest]/page.tsx`
- `app/studio/(app)/clientes/@ficha/(.)ficha/[markbox]/page.tsx`
- `app/studio/(app)/clientes/ficha/[markbox]/page.tsx`
- `app/studio/(app)/embarques/layout.tsx`
- `app/studio/(app)/embarques/@ficha/default.tsx`
- `app/studio/(app)/embarques/@ficha/page.tsx`
- `app/studio/(app)/embarques/@ficha/error.tsx`
- `app/studio/(app)/embarques/@ficha/not-found.tsx`
- `app/studio/(app)/embarques/@ficha/[...rest]/page.tsx`
- `app/studio/(app)/embarques/@ficha/(.)ficha-cliente/[markbox]/page.tsx`
- `app/studio/(app)/embarques/ficha-cliente/[markbox]/page.tsx`
- `app/studio/(app)/clientes/__tests__/panel-routes.test.tsx`
- `app/studio/(app)/clientes/__tests__/ficha-cliente-page.test.tsx` (suite focal de la página: regresión del cuerpo extraído y elegibilidad del panel)

El panel de asignación se reutiliza a través de ClienteDelEmbarque dentro de ClientDetailContent solo para shipments reales sin cliente. Repite gate de Tracking, privacidad CN y canSpecial; las acciones conservan sus verificaciones server, previa, motivo y confirmación. El listado ofrece acceso informativo y no decide elegibilidad por cero ni por notas.

## Revisión estática y validaciones parciales

- PASÓ: guard/owner, `git diff --check`, índice documental, cápsula de gobernanza (29 políticas), numeración SDD sin nuevas colisiones. Las colisiones históricas de migraciones reportadas por el gate quedan intactas.
- FALLÓ: validador derivado del plugin (`policy-registry.json está desactualizado`); no modifica ni invalida las políticas fuente del repo. Fuera del slice.
- NO DISPONIBLE: `components:check` necesita `ajv`; este hijo sigue sin instalación.
- NO EJECUTADO: suites focales, tipos, navegación Next real, viewport, build/verify. Las pruebas escritas no equivalen a resultados.
- Revisión read-only de navegación: interceptores limitados a URLs explícitas del módulo, canónica sin interceptor, slot raíz/catch-all/default nulos, retorno por historial y enlace al listado del origen, pestañas con replaceState sin añadir entrada al historial. Back/forward, refresh y restauración efectiva de foco/scroll requieren runtime.
- Datos: la página del listado elimina `notes` antes de cruzar la frontera server/client; `ClientListRow` usa Omit y booleano. El id para reasignar proviene de listShipmentsDeLaFicha bajo sesión, tenant, códigos y no eliminados; no se parsean notas ni se consulta producción.
- Gobernanza del slice: CMP-01/BTN-01, cumplimiento estático por reuso del shell y acción existentes y enlace semántico en la identidad. MP-01/AUD-01/AUD-02, sin modificación del contrato de mutación y auditoría; runtime pendiente. A11Y-01/ERR-01/LOD-01, cumplimiento parcial: shell, carga anunciada por Suspense y recuperación local presentes; pruebas de ejecución pendientes. Sin excepciones ni promociones de componentes.

### Recuperación local del slot autorizada

Director autorizó exactamente los cuatro boundaries y sus casos focales. `app/studio/(app)/clientes/@ficha/error.tsx`, `app/studio/(app)/clientes/@ficha/not-found.tsx`, `app/studio/(app)/embarques/@ficha/error.tsx` y `app/studio/(app)/embarques/@ficha/not-found.tsx` reutilizan ClientDetailPanel y Aviso con texto genérico, sin representar error.message, stack, digest ni datos. Error ofrece reset como «Reintentar»; ficha no disponible no ofrece una lectura repetida sin fundamento. Ambas salidas conservan cerrar/Escape/volver por historial y el enlace del módulo de origen. No se añaden consultas, cuerpos de ficha, permisos ni escrituras a estos componentes. Los gates de interceptores y layouts permanecen antes de la carga.

Casos agregados a `app/studio/(app)/clientes/_components/__tests__/ClientDetailPanel.test.tsx`: ambos módulos, mensaje mínimo sin detalle interno, callback de reintento, ausencia de reintento en no disponible, enlace de origen, Escape y foco/valor de un filtro que permanece montado al cerrar. Eso prueba el contrato del componente cuando se ejecute; la conservación del árbol y el historial por Next aún exige routing real.
