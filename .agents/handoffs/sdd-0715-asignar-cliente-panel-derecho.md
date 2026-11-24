# Handoff SDD-0715

## OBJETIVO ORIGINAL
Asignar cliente y abrir ficha en panel derecho conservando el listado, conforme a la spec propia.

## COMPLETADO
Diagnóstico local y spec con casos, allowlist, evidencia, privacidad y aceptación. Guard y claim adquiridos con owner `codex-sdd-0715-panel-cliente-20261124`. Rama `SoftAgentes/sdd-0715-asignar-cliente-panel-derecho`; base y HEAD inicial `dd842dfd87af930bd3a21e10e7a7f79721503bf5`. Sesión `orca_session_id:4e58e02e-15cc-4709-b887-11de5ebd0b45`, Director `orca_session_id:14b98827-b1e5-41f3-aee0-c72c837f96fc`, Task `task_75e843282aed`, Dispatch `ctx_59ec39c37538`.

Implementación local sin ejecutar: ficha server extraída, canónica completa intacta, rutas explícitas de panel para Clientes/Embarques, slots raíz/catch-all/default que limpian estado, gate server antes del cuerpo, shell compartido y Suspense con carga anunciada. Clientes usa enlace semántico en la identidad, conserva query y solicita navegación sin scroll. Ya no envía notes en las props: solo hasNote. El acceso de asignación exige Tracking, capacidad especial y privacidad CN; el panel reutiliza ClienteDelEmbarque/ReassignClientPanel para ids de embarques reales, conservando previa, motivo y confirmación. No se crea relación desde notas ni conteos.

Pruebas escritas: panel-routes (orden de autorización, slots nulos, fallback directo, layouts, minimización de notes y permiso del listado); ClientDetailPanel (Escape, foco, volver, cerrar y fondo); ClientsClient (enlace con filtros, indicador, permiso y sin nota); ficha-cliente-page ampliada (regresión canónica y asignación solo con relación real y gates). No se declaran verdes hasta ejecutarlas.

Ampliación de identidad/asesor recibida del Director: Resumen ahora ofrece accesos a «Verificar cédula/RIF en Configuración» bajo la condición existente de documento/foto/portal y «Asignar asesor en Configuración». El texto señala dónde se ejecuta la acción. Configuración prioriza IdentityVerificationCard y AdvisorAssignCard, conservando todas las demás, sin duplicar formularios ni alterar props o Server Actions. Se añadieron casos en ficha-cliente-page para ficha completa y panel y se preserva Configuración en el fallback directo del panel, con casos en panel-routes. Composición sigue siendo propiedad de este Worker; FichaPestanas.tsx y sus pruebas no se tocaron, son del hijo SDD-0669.

## VALIDACIÓN
| Comprobación | Estado | Límite |
|---|---|---|
| Guard/owner y diff --check | PASÓ | Solo revisión local |
| docs:index / docs:check | PASÓ | Índice regenerado; repetir tras cierre documental |
| governance:check | PASÓ | Cápsula de 29 políticas vigente |
| sdd:check | PASÓ | Conserva choques históricos de migraciones; sin colisión nueva |
| Validador de plugin governance-check | FALLÓ | policy-registry.json derivado desactualizado; no editar caché ni política |
| components:check | NO DISPONIBLE | Falta ajv, node_modules todavía ausente |
| Suites focales / tipos | NO EJECUTADO | Turno de instalación pendiente |
| Runtime Next, back/forward, refresh, escritorio/móvil | NO EJECUTADO | La inspección de rutas no demuestra navegación real |
| Build / verify local | NO EJECUTADO | Director ordenó esperar turno; Quality de PR cubrirá gate global cuando corresponda |

No se instalaron dependencias, no se copiaron env ni se usaron servicios/datos reales. Un primer comando de componentes usó un nombre de script incorrecto; se corrigió a validate-component-registry.mjs, que confirmó la dependencia faltante.

UI-CHECK read-only aplicado según .claude/commands/ui-check.md: hallazgo alto de recuperación local atendido estáticamente con los cuatro boundaries autorizados; falta ejecución del routing. Prioridad media, medir target/texto de «Asignar cliente» y verificar reflow de la ficha densa en móvil/escritorio, foco/scroll real, zoom y temas en runtime. Correcto estáticamente: tokens existentes, DrawerShell compartido, enlace de identidad sin controles anidados, notas minimizadas, carga anunciada y sin estilos ni fuentes nuevas. Veredicto parcial: ejecutar pruebas antes de aceptación; no se reporta GUI observada.

## COMMITS
- `50c9078fd`: preservó implementación local con validación estática y pruebas pendientes antes del merge.
- `1a39a12eb`: merge normal de #809, segundo padre exacto `5e79383bdd972d2863d194df658beffa9cd05281`; sin conflictos.
- `66291e030`: enlaces de Embarques y selección de shipment dentro del panel, con casos focales y documentación de dependencia.
- `af120dbfa`: atajo canónico también para marca vacía/espacios, Tracking exacto en otra pestaña y casos de dos filas por grupo. Head de producto al abrir PR: `af120dbfa0fede792bc85a52e8ae9c83b8e7a178`.
- `8254197ed`: merge normal autorizado de #808 al SHA exacto `9e27b63d419450ca3ab93a4138df209de23b5e84`, sin conflictos. Las dos dependencias están incorporadas; Director revisará base final y delta exclusivo después de integrarlas.
- El gate staged detectó líneas vacías al final de archivos nuevos; se corrigieron antes del primer commit.

## PR / BRANCH
PR preliminar https://github.com/SoftAgentes/DTDCARGO/pull/810, en borrador, base `SoftAgentes/sdd-0710-candado-embarques-20261124`, publicada sin integración ni despliegue. El borrador documenta pruebas NO EJECUTADAS y dependencia #808; no se marca entrega completa ni se activa ready hasta la validación correspondiente. La entrega final exige checks activos.

Director liberó EmbarquesClient mediante `msg_313ddae0d85c`: #809 con head `5e79383bdd972d2863d194df658beffa9cd05281`, rama base `SoftAgentes/sdd-0710-candado-embarques-20261124`. Remoto y SHA cotejados; merge-base de este hijo y esa cabeza: `8580490f8d95872a407ab83ab9acb6b1b265a451`, igual al main de la asignación. Merge normal completado sin conflictos, sin rebase/force ni tocar otro worktree. Tras reinicio de Orca, se verificó que ambos commits y seis archivos de edición posterior persistieron, sin instalación ni PR previa. #808 sigue siendo dependencia de pestañas, head observado `9e27b63d419450ca3ab93a4138df209de23b5e84`; permanece sin incorporar. PC exclusivamente para m³ según último mensaje: sin instalación, build, verify ni pruebas pesadas hasta nuevo turno.

## PENDIENTES DE ESTA TAREA
Director autorizó extracción y rutas exactas de slots, incluyendo page raíz nula en ambos. Esperar turno de PC después de m³ para instalación congelada, suites focales, tipos y routing ficticio. Verificar navegación atrás/adelante/cierre/refresh/volver por enlace, error/404 local y estados en móvil/escritorio. EmbarquesClient ya liberado y conectado al panel solo mediante enlaces/indicador: no se cambiaron los handlers de candado/asistente/selección de #809. La fila DTD-0000 envía el id real, que se contrasta con los embarques autorizados de la ficha; sin marca se informa y se mantiene el acceso a Tracking. Tests escritos en las rutas focales ya aprobadas, sin ejecutar. Publicar PR draft contra rama #809 y registrar head/base. Cierre definitivo pendiente: pruebas, revisión, handoff final y liberación del claim propio. Tarea y claim activos durante espera, sin worker_done.

La ampliación de boundaries fue solicitada mediante `msg_8bd45f20f5e8` y autorizada en la respuesta `msg_9601e31d5319`: implementados error.tsx/not-found.tsx de ambos @ficha, con panel y aviso genéricos, reset solo en error, cierre y origen conservados, sin representar detalle interno ni datos. Casos añadidos en ClientDetailPanel.test.tsx, todavía NO EJECUTADOS. Para los enlaces a Configuración, verificar navegación real con el cambio de FichaPestanas del hijo SDD-0669 cuando Director coordine el traspaso; no copiarlo de forma autónoma.

Ampliación DDP 64 (`msg_024f29816795`): EmbarquesClient usa esSinCliente canónico también para marca vacía/espacios. Cada fila sin ficha tiene atajo al Tracking del id exacto en otra pestaña, declarado en texto accesible/visible para conservar lista/filtros/selección al regresar. DTD-0000 conserva panel con selector exacto contrastado contra las lecturas autorizadas. Dos filas del mismo grupo tienen casos de destino exclusivo en panel-routes; pendientes de ejecución.

Traspaso de turnos (`msg_19c4be2dd2e2`): tomar turno fuerte automáticamente al recibir liberación directa de 0716, sin volver a preguntar. Al liberarlo, avisar al Director y enviar a `dispatch:ctx_74f0cbdf1b68` que puede correr QA visual de #809. La entrega exige PR con checks activos; el borrador preliminar se marcará ready al completar la validación correspondiente. No confundir borrador publicado con entrega terminada.

Liberación directa recibida de 0716 mediante `msg_8c58f6bfbab3`: turno tomado. Instalación `pnpm install --frozen-lockfile` PASÓ (813 paquetes reutilizados, sin copiar env). Suites focales iniciadas con maxWorkers=1; resultados pendientes de registrar. No se ejecuta instalación en otros hijos ni se toca producción.

Primer corte de validación: 8 suites y 145 pruebas PASARON con maxWorkers=1 (incluye #808, #809 y ReassignClientPanel). Typecheck detectó 4 asignaciones de fixtures antiguos que aún enviaban Client con notes a ClientsClient; se adaptaron ClientsClient.adjuntos.test.tsx y ClientsClient.contador.test.tsx al contrato ClientListRow sin debilitarlo. Typecheck repetido PASÓ, ESLint del delta PASÓ y esas 2 suites adicionales PASARON (8 pruebas). La pasada definitiva seguirá al merge actualizado de #809 f4b7279b00f81c8afe79c97c9ad1f39a652b8373, solicitado por Director.

Arnés Next temporal fuera del repo: `%TEMP%/sdd-0715-routing`, sin env ni DB real, puerto 3175; copia layouts/slots y páginas de routing y reutiliza ClientsClient/EmbarquesClient/DrawerShell/FichaPestanas reales, con cuerpo de ficha y autorización ficticios. No acredita RLS ni toda la ficha visual real. Ya observados: conservar filtros/selección/scroll/foco, atrás/adelante, recarga canónica con pestaña, error/404 local, geometría móvil. Evidencia final pendiente de completar y registrar; servidor temporal aún propio y se detendrá antes de liberar el turno.

## FUERA DE ALCANCE DETECTADO
Registro derivado del plugin de gobernanza desactualizado frente al repo vigente. No se arregla ni se convierte en política dentro de este encargo. Sin otros arreglos ajenos incluidos.

## HANDOFF AL DIRECTOR
Impacto documental: spec propia con allowlist exacta y evidencia, índice generado, este handoff. Sin cambios de política, migraciones, acciones ni consultas compartidas; sin producción. La suite canónica se amplió como prueba focal de la extracción y el flujo autorizado. La comprobación de tenant/RLS se limita al contrato de consulta existente; no se ejecutó SQL ni base real. Director revisa e integra, sin merge/deploy de este Worker. Próximo paso dependiente del turno: instalar, ejecutar suites y tipos, corregir lo que demuestren y comprobar routing ficticio; no basta inspección estática para aceptar Next.
