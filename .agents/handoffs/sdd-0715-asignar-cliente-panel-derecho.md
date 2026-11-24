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
Se prepara commit local de implementación con validación estática, explícitamente pendiente de pruebas, para preservar todos los archivos antes del merge autorizado de #809.

## PR / BRANCH
PR pendiente; publicación de rama propia y draft autorizada por encargo, sin integración ni despliegue.

Director liberó EmbarquesClient mediante `msg_313ddae0d85c`: #809 con head `5e79383bdd972d2863d194df658beffa9cd05281`, rama base `SoftAgentes/sdd-0710-candado-embarques-20261124`. Remoto y SHA cotejados; merge-base de este hijo y esa cabeza: `8580490f8d95872a407ab83ab9acb6b1b265a451`, igual al main de la asignación. Se incorporará mediante merge normal, sin rebase/force ni tocar el otro worktree. #808 sigue siendo dependencia de pestañas. PC exclusivamente para m³: sin instalación, build, verify ni pruebas pesadas.

## PENDIENTES DE ESTA TAREA
Director autorizó extracción y rutas exactas de slots, incluyendo page raíz nula en ambos. Esperar turno de PC después de Embarques y m³ para instalación congelada, suites focales, tipos y routing ficticio. Verificar navegación atrás/adelante/cierre/refresh/volver por enlace, error/404 local y estados en móvil/escritorio. EmbarquesClient sigue reservado a 0710: no se ha tocado ni copiado; rutas preparadas todavía no constituyen integración de ese listado. Cerrar con commits selectivos, PR draft, evidencias/head/base y liberar solo el claim propio al terminar escritura. Tarea y claim activos durante espera, sin worker_done.

La ampliación de boundaries fue solicitada mediante `msg_8bd45f20f5e8` y autorizada en la respuesta `msg_9601e31d5319`: implementados error.tsx/not-found.tsx de ambos @ficha, con panel y aviso genéricos, reset solo en error, cierre y origen conservados, sin representar detalle interno ni datos. Casos añadidos en ClientDetailPanel.test.tsx, todavía NO EJECUTADOS. Para los enlaces a Configuración, verificar navegación real con el cambio de FichaPestanas del hijo SDD-0669 cuando Director coordine el traspaso; no copiarlo de forma autónoma.

## FUERA DE ALCANCE DETECTADO
Registro derivado del plugin de gobernanza desactualizado frente al repo vigente. No se arregla ni se convierte en política dentro de este encargo. Sin otros arreglos ajenos incluidos.

## HANDOFF AL DIRECTOR
Impacto documental: spec propia con allowlist exacta y evidencia, índice generado, este handoff. Sin cambios de política, migraciones, acciones ni consultas compartidas; sin producción. La suite canónica se amplió como prueba focal de la extracción y el flujo autorizado. La comprobación de tenant/RLS se limita al contrato de consulta existente; no se ejecutó SQL ni base real. Director revisa e integra, sin merge/deploy de este Worker. Próximo paso dependiente del turno: instalar, ejecutar suites y tipos, corregir lo que demuestren y comprobar routing ficticio; no basta inspección estática para aceptar Next.
