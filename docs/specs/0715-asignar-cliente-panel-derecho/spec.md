---
sdd: "0715"
title: "Asignar cliente y consultar ficha en panel derecho"
status: in-progress
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

Sam eligió panel a la derecha para consultar la ficha sin perder la posición del listado. El acceso «Asignar cliente» reutiliza Tracking con autorización, vista previa, motivo y confirmación. Implementación y validación local terminadas; aceptación final pendiente. PR #810 fue retargeteada a main por Dirección después de integrar #808 y #809. La cabeza de código 18df4afdf9dc063331111932e37b232cead48dd3 pasó 10 suites/163 pruebas, tipos, lint y runtime con fixtures. Main final baeb9000478f33ab8431a9b947e033cf25cdf3a7 se incorporó sin delta de archivos respecto de ese código validado. Quality pull_request se activa tras subir el cierre y marcar la PR lista; integración y publicación siguen separadas.

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
- `app/studio/(app)/clientes/_components/ClientsClient.adjuntos.test.tsx` (fixture focal adaptado a ClientListRow)
- `app/studio/(app)/clientes/_components/ClientsClient.contador.test.tsx` (fixture focal adaptado a ClientListRow)
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
- `embarques/@ficha/(.)ficha-cliente/[markbox]/page.tsx`: además del acceso de Embarques, exige Tracking para resolver una fila por id; sin selector exige Clients antes de componer el cuerpo de ficha.
- `embarques/@ficha/[...rest]/page.tsx`: null al salir.
- `embarques/ficha-cliente/[markbox]/page.tsx`: redirección canónica para acceso directo.

Ambas páginas interceptadas reutilizan el mismo ClientDetailContent server y el contenedor ClientDetailPanel client. Cerrar usa router.back para recuperar lista montada y restauración de foco del DrawerShell; se debe probar el desmontaje en navegación, el foco y la interacción con las pestañas internas de la ficha antes de dar aceptación. Director confirmó las rutas y añadió page.tsx raíz nula en ambos slots. Tras el traspaso 0710 se conectaron enlaces explícitos en EmbarquesClient y ShipmentDetailDrawer. El enlace de ficha del grupo es hermano del botón del acordeón, sin controles anidados.

El atajo se decide con el predicado canónico `esSinCliente`, que cubre DTD-0000 y marca vacía o espacios. DTD-0000 lleva `?embarque=<id>` al panel de cliente del embarque: esa rama exige Tracking, resuelve directamente mediante `getShipmentById` bajo la sesión, comprueba id exacto, tenant activo y deleted_at, y relee el Shipping Mark actual. No consulta ClientDetailContent ni depende del listado de 200 embarques o de una ficha comodín. Si ya tiene cliente, informa sin ofrecer transferirlo; si no es visible, está eliminado, es ajeno o el selector es ambiguo, no revela código ni habilita escritura. El formulario existente conserva canSpecial y privacidad CN; RPC y acciones repiten sus candados.

Sin `?embarque`, la ruta continúa abriendo la ficha completa en panel tras el gate Clients. Recargar un panel de asignación lleva al Tracking exacto (gate propio antes de redirigir), en vez de inventar una ficha DTD-0000. Sin Shipping Mark vinculado, la fila muestra «Sin ficha vinculada. Tracking abre en otra pestaña.» y «Asignar cliente» lleva directamente a `/studio/tracking/<id-exacto>` en otra pestaña para conservar filtros, selección y posición de la lista al regresar. No se inventa DTD-0000 como relación ni se fusiona el comodín. Los handlers de candado, asistente, selección y rastreo incorporados de #809 no se modificaron.

La ampliación para DDP 64 cubre dos filas reales del mismo grupo, cada una con su propio destino, para DTD-0000, marca vacía y espacios, y el contraste de id ajeno/selección exclusiva. Casos focales y recorrido con datos ficticios ejecutados; no se usaron filas reales de negocio.

Hallazgo del Director (`msg_8be4540dc6f1`): la lista de ficha está limitada a los 200 más recientes. La corrección de la rama por id exacto agrega pruebas independientes para seleccionado fuera de esos 200 con ficha comodín inexistente, tenant ajeno, ausencia de tenant, id no visible/eliminado/incongruente, Tracking denegado, capacidad/privacidad, estado ya asignado, dos ids exclusivos y recarga hacia Tracking. El límite general y las queries compartidas no se modifican. La corrección está en `18df4afdf`: pasó el lote inicial de 3 suites/97 pruebas y el definitivo de 10 suites/163 pruebas, tipos y lint. Runtime final verificó filas exclusivas, antiguo 201 sin ficha, modal real sin escritura, retorno con filtro/selección/foco, móvil y recarga a Tracking exacto. Los 153 verdes anteriores al hallazgo no se usaron para acreditar esta corrección.

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
- Base histórica del borrador: `SoftAgentes/sdd-0710-candado-embarques-20261124`. Dependencia #808 incorporada con autorización nominal del Director (`msg_cb8011bee2ef`) al SHA exacto `9e27b63d419450ca3ab93a4138df209de23b5e84`, mediante merge normal `8254197ede477aed9e7ae2016b0af94de6f1be94`, sin conflictos. Dirección integró ambas dependencias y retargeteó #810 a main; base final incorporada `baeb9000478f33ab8431a9b947e033cf25cdf3a7`.
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

## Validación y límites

- PASÓ: instalación congelada, guard/owner, diff, índice documental, cápsula de gobernanza de 29 políticas, componentes y numeración sin colisiones nuevas.
- PASÓ: 10 suites focales y 163 pruebas con maxWorkers=1 sobre el código de 18df4afdf; pnpm typecheck y ESLint del delta. Comandos y rutas reproducibles en el handoff.
- PASÓ con fixtures en Next 16.4.6: listado/panel, filtro/selección/scroll/foco, atrás/adelante, accesos de Configuración, recarga canónica, enlace canónico, limpieza de slot raíz, error/404 local, geometría de escritorio y 390 px móvil.
- PASÓ con fixtures en Next: dos filas exclusivas, seleccionado antiguo 201 con ficha comodín ausente, apertura de ClienteDelEmbarque/ReassignClientPanel reales sin escribir, Escape de modal superior, retorno con filtro/selección/foco y recarga al Tracking exacto. Marca vacía abre ambos Tracking exactos en pestañas aparte conservando lista.
- NO EJECUTADO localmente: build/pnpm verify global; Director delegó a Quality. La PR ahora tiene base main y ready dispara el evento pull_request sobre la cabeza final. Estado/ID/SHA vigentes se registran en PR y recibo de entrega.
- FALLÓ fuera del slice: validador derivado del plugin instalado, por policy-registry.json desactualizado; las políticas/cápsula canónicas del repo pasaron. No se editó el plugin.
- NO EJECUTADO: producción, filas reales, RLS contra DB real o aceptación humana. El arnés usa consultas/gates ficticios y escrituras bloqueadas; la ficha normal está doblada en el arnés y su composición real se cubre con Vitest.
- Gobernanza: cumplimiento estático/focal de CMP-01/BTN-01/A11Y-01 por shell existente, enlaces semánticos y mínimo táctil de 44 px. Medición Asignar cliente: aproximadamente 107.9 × 44 px. MP/AUD conservan acciones/RPC/motivo/auditoría existentes. Sin excepciones, políticas nuevas ni promociones de componentes.
- Artefactos locales en %TEMP%/sdd-0715-routing: scripts y capturas de escritorio/móvil. Se corrigieron fallos del arnés (estilos/providers/sincronización), no se presentan como defectos de producto. No confundir la prueba de routing con observación integral de datos de negocio.
- La integración final de main se cotejó contra el código validado sin archivos cambiados; el cierre posterior solo actualiza spec, índice y handoff.

### Recuperación local del slot autorizada

Director autorizó exactamente los cuatro boundaries y sus casos focales. `app/studio/(app)/clientes/@ficha/error.tsx`, `app/studio/(app)/clientes/@ficha/not-found.tsx`, `app/studio/(app)/embarques/@ficha/error.tsx` y `app/studio/(app)/embarques/@ficha/not-found.tsx` reutilizan ClientDetailPanel y Aviso con texto genérico, sin representar error.message, stack, digest ni datos. Error ofrece reset como «Reintentar»; ficha no disponible no ofrece una lectura repetida sin fundamento. Ambas salidas conservan cerrar/Escape/volver por historial y el enlace del módulo de origen. No se añaden consultas, cuerpos de ficha, permisos ni escrituras a estos componentes. Los gates de interceptores y layouts permanecen antes de la carga.

Casos agregados a `app/studio/(app)/clientes/_components/__tests__/ClientDetailPanel.test.tsx`: ambos módulos, mensaje mínimo sin detalle interno, callback de reintento, ausencia de reintento en no disponible, enlace de origen, Escape y foco/valor de un filtro que permanece montado al cerrar. Eso prueba el contrato del componente cuando se ejecute; la conservación del árbol y el historial por Next aún exige routing real.
