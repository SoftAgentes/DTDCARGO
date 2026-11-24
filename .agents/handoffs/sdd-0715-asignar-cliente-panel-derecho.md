# Handoff SDD-0715 — ficha lateral y asignación por embarque

## OBJETIVO ORIGINAL
Acceso Asignar cliente en filas pendientes y desde Clientes; ficha autorizada en panel derecho conservando contexto. Reutilizar Tracking (previa, motivo y confirmación) y DrawerShell. Resumen debe permitir encontrar identidad y asesor sin duplicar formularios.

## IDENTIDAD Y AISLAMIENTO
- Owner: codex-sdd-0715-panel-cliente-20261124.
- Worker: orca_session_id:4e58e02e-15cc-4709-b887-11de5ebd0b45.
- Director: orca_session_id:14b98827-b1e5-41f3-aee0-c72c837f96fc.
- Task task_75e843282aed; Dispatch ctx_59ec39c37538.
- Rama SoftAgentes/sdd-0715-asignar-cliente-panel-derecho; único hijo escritor.
- Base reservada dd842dfd87af930bd3a21e10e7a7f79721503bf5, sobre main inicial 8580490f8d95872a407ab83ab9acb6b1b265a451.
- Claim propio verificado durante edición; se libera después del último commit y antes de worker_done. No se elimina rama ni worktree.

## COMPLETADO
- Ficha server extraída a ClientDetailContent conservando consultas, condiciones, vistas y permisos; acceso canónico completo.
- Slots de panel acotados a URLs explícitas de Clientes/Embarques. Root/default/catch-all nulos, error y no disponible locales; no se interceptan globalmente enlaces canónicos.
- Listado Clientes envía hasNote en lugar de notes. Enlace nativo en identidad y foco del disparador. No se añaden datos personales al listado.
- Resumen enlaza a verificación de cédula/RIF bajo condición existente de documento/foto/portal y a asesor. Configuración prioriza esas tarjetas; una sola instancia de cada formulario y las demás tarjetas conservadas.
- Filas DTD-0000 enlazan id exacto. Esa rama exige Shipments/Tracking antes de getShipmentById de sesión, comprueba id/tenant activo/deleted_at y relee el cliente actual. No carga ficha comodín ni lista de 200; un embarque ya asignado informa sin transferirlo. No se alteró el límite general.
- Capacidad especial y privacidad CN conservadas mediante ClienteDelEmbarque/ReassignClientPanel, con RPC y acciones existentes. Sin cambios de acciones, tipos compartidos, queries compartidas, RLS, política o migraciones.
- Marca vacía/espacios según esSinCliente: acceso al Tracking exacto en otra pestaña con texto explícito, conservando lista. Sin relación inventada ni fusión del comodín.
- Candado, asistente, selección, código y rastreo de #809 preservados. Formularios de asignación no reciben notas ni nombres del resultado de detalle.
- Accesos nuevos con mínimo táctil 44 px; medido Asignar cliente en móvil: aproximadamente 107.9 × 44 px.

## VALIDACIÓN
Código validado: 18df4afdf9dc063331111932e37b232cead48dd3. Main final baeb9000478f33ab8431a9b947e033cf25cdf3a7 se incorporó por merge normal a5fa52a181ad2474c0a1e9c477d8ec55e3757911; git diff entre el código validado y ese HEAD no mostró archivos cambiados. El cierre posterior solo actualiza documentación e índice.

| Comprobación | Estado | Evidencia y límite |
|---|---|---|
| pnpm install --frozen-lockfile | PASÓ | 813 paquetes reutilizados; sin copiar env |
| Lote focal definitivo | PASÓ | 10 suites, 163 pruebas, maxWorkers=1, 84.06 s; incluye casos nuevos del tope |
| pnpm typecheck | PASÓ | Luego de corregir fixtures antiguos al contrato ClientListRow |
| ESLint del delta | PASÓ | Invocado con node node_modules/eslint/bin/eslint.js y rutas explícitas |
| docs:index / docs:check | PASÓ | Cierre sincronizado con 696 specs |
| governance:check | PASÓ | Cápsula de 29 políticas vigente |
| components:check | PASÓ | 8 fuentes, reproducible, sin rutas rotas |
| sdd:check | PASÓ | Sin colisiones nuevas; excepciones históricas intactas |
| diff staged / guard owner | PASÓ | Commits selectivos y delta exclusivo frente a main dentro de allowlist |
| Next real, rutas de ficha | PASÓ con fixtures | Listas, panel y pestañas reales; cuerpo de ficha y gates doblados |
| Next real, fila exacta | PASÓ con fixtures | Consulta de detalle doblada; ClienteDelEmbarque/ReassignClientPanel reales |
| build / pnpm verify local | NO EJECUTADO | Director delega el gate global a Quality; no se aplicó DB |
| Quality pull_request de #810 | PENDIENTE DE ACTIVAR | PR retarget main por Director; marcar ready después de subir cierre |
| Producción / RLS real / aceptación humana | NO EJECUTADO | No están autorizados en este encargo |

Suites ejecutadas con node node_modules/vitest/vitest.mjs run y --maxWorkers=1:
- clientes/__tests__/panel-routes.test.tsx
- clientes/__tests__/ficha-cliente-page.test.tsx
- clientes/__tests__/ficha-pestanas.test.tsx
- clientes/_components/__tests__/ClientDetailPanel.test.tsx
- clientes/_components/__tests__/ClientsClient.test.tsx
- clientes/_components/ClientsClient.adjuntos.test.tsx
- clientes/_components/ClientsClient.contador.test.tsx
- embarques/_components/__tests__/EmbarquesClient.abrir.test.tsx
- embarques/_components/__tests__/EmbarquesClient.borrado.test.tsx
- tracking/[id]/_components/__tests__/ReassignClientPanel.test.tsx
Todas las rutas anteriores están bajo app/studio/(app)/.

Regresiones nuevas: seleccionado fuera de 200 y ficha comodín ausente, Tracking denegado antes de lectura, id no visible/eliminado/incongruente, tenant ajeno/sin tenant, capacidad/privacidad, cliente ya asignado y dos filas exclusivas. Los 153 verdes anteriores al hallazgo no se usaron para acreditar la corrección.

### Runtime y UI-CHECK
Arnés fuera del repo: %TEMP%/sdd-0715-routing, Next 16.4.6, puerto 3175. Usa rutas copiadas del árbol, ClientsClient/EmbarquesClient/DrawerShell/FichaPestanas reales, fuente local de datos ficticios y escrituras bloqueadas. El cuerpo normal de ficha está doblado; sus condiciones y tarjetas reales se cubren en Vitest, no se presenta el arnés como lectura de negocio ni como RLS real.

Observado en el navegador Orca:
- Clientes conserva búsqueda, query, selección, scroll y foco al volver; adelante reabre la pestaña seleccionada.
- Accesos de Configuración funcionan con #808; recarga resuelve ficha canónica y conserva pestaña válida; enlace canónico abre página completa.
- Root limpia slot, error/404 se recuperan dentro del panel sin detalle interno.
- Geometría del panel en escritorio y 390 px móvil; capturas inspeccionadas.
- Dos filas pendientes abren su id exclusivo. Las dos sin marca abren sus Tracking exactos aparte y conservan la lista.
- Con ficha DTD-0000 deliberadamente ausente, el antiguo 201 abre la acción real por id, el primer paso Cliente nuevo y el modal superior. Escape cierra solo ese modal. Regreso conserva selección, filtro real de Embarques y foco. Recargar va al Tracking exacto.
- No se seleccionó un destinatario ni se confirmó escritura en navegador. Previa/motivo/confirmación se probaron en la suite reutilizada de Tracking.

Scripts y capturas locales: build.mjs, browser-check.ps1, exact-row-check.ps1, exact-row-tail.ps1; clientes-panel-desktop.png, clientes-panel-mobile.png, embarques-panel-desktop.png, embarques-panel-mobile.png y asignacion-exacta-mobile.png en ese directorio.
El arnés se corrigió por estilos mal ubicados, ToastProvider ausente y sincronización inicial tras HMR; esos fallos de arnés no se reportan como defectos del producto. La validación final se hizo con providers adecuados y consultas ficticias.
UI-CHECK propio: shell canónico, fuentes/tokens, enlaces sin controles anidados, foco/cierre y objetivos táctiles revisados. No equivale a revisión independiente ni a observación integral de la ficha empresarial. Zoom nativo #809: QA externo informó aprobación en %TEMP%/dtd-0710-qa-5e79383/zoom-nativo; no se cuenta como prueba propia de #810.

## COMMITS Y DEPENDENCIAS
- 50c9078fd: implementación inicial preservada antes de merge.
- 1a39a12eb: merge exacto #809 5e79383bdd972d2863d194df658beffa9cd05281, sin conflictos.
- 66291e030 / af120dbfa: enlaces por fila y marca vacía.
- 8254197ed: merge exacto #808 9e27b63d419450ca3ab93a4138df209de23b5e84, autorizado, sin conflictos.
- 4b7cddafd: fixtures sin notes.
- 908cf0b99: merge #809 actualizado f4b7279b00f81c8afe79c97c9ad1f39a652b8373.
- 0046eb10e: mínimo táctil.
- 18df4afdf: acceso directo por ID sin ficha ni tope de 200.
- a5fa52a181ad2474c0a1e9c477d8ec55e3757911: merge main final baeb9000478f33ab8431a9b947e033cf25cdf3a7 tras integración de #808 y #809. Sin delta de archivos frente al código validado.
- El siguiente commit cierra documentación. SHA final y corrida Quality se reportan en PR/recibo Orca, sin insertar un hash autorreferente en este archivo.

## PR / BRANCH
https://github.com/SoftAgentes/DTDCARGO/pull/810, rama propia; Director retargeteó a main después de integrar #809. Base final incorporada: baeb9000478f33ab8431a9b947e033cf25cdf3a7. Subir cierre y marcar lista para que dispare Quality pull_request sobre la cabeza exacta. No se usa CI de las dependencias como CI de #810.

## PENDIENTES DE ESTA TAREA
Quality final, revisión independiente y tren de integración a cargo del Director. SDD permanece in-progress hasta aceptación completa; no se declara CI verde, aprobación humana, merge ni publicación de #810 antes de observarlos. No hay migraciones ni interruptores de producción que activar.

### Seguimiento CI — Task task_fc8b42e00b43 / Dispatch ctx_e6385f81dd31

CI pull_request 45430029027, job 138572459236, falló en no-html-link-for-pages de GenerateBLModal.tsx:126 al reconocer /studio/embarques. Log completo local %TEMP%/dtd-ci-810-138572459236.log. Se retomó la misma rama sobre c2008905699a4da401950229244fb1d22af363fe, base main baeb9000478f33ab8431a9b947e033cf25cdf3a7, y se reclamó el mismo owner antes de editar.

Ampliación nominal: app/studio/_components/wiring/GenerateBLModal.tsx y app/studio/_components/wiring/__tests__/GenerateBLModal.test.tsx. El enlace usa next/link manteniendo href, texto y color. No se encontró contrato de recarga explícita; onNavigate={onClose} conserva el cierre al salir del modal compartido y no lo cierra al abrir con modificador. No se cambian queries, estados de BL, reglas ni configuración.

Suite focal del modal PASÓ: 8 pruebas, 8.52 s; usa Link real con RouterContext, incluida navegación normal y Ctrl+clic. Typecheck PASÓ. pnpm lint global PASÓ con 0 errores y 42 advertencias; no se aplicó --fix ni se tocaron advertencias ajenas. Registrar la nueva cabeza/CI al publicar el arreglo. No se atribuye CI verde a la corrida anterior fallida.

## FUERA DE ALCANCE DETECTADO
El registro derivado del plugin de gobernanza instalado está desactualizado; su validador falló, mientras cápsula y políticas del repo están vigentes. No se modificó caché/plugin ni se elevó a regla. Ninguna reparación ajena incluida.

## HANDOFF AL DIRECTOR
Impacto documental: spec propia, índice generado y este handoff. Código y pruebas listos para revisión del árbol final; distinguir pruebas focales, runtime ficticio y Quality alojado. El último escritor libera solo su claim después del cierre; conserva rama/worktree. Servidor temporal detenido y puerto 3175 comprobado sin listener; sin pruebas pesadas propias en ejecución. Dirección recibió la liberación definitiva como msg_d1198aa97c55. El aviso a dispatch:ctx_74f0cbdf1b68 fue rechazado sin efectos porque su despacho vigente ctx_d73b93c31621 solo acepta trabajo del coordinador; se pidió relay al Director mediante msg_4bc924c29e10. No se iniciaron helpers ni se rodeó la jerarquía de Orca.
