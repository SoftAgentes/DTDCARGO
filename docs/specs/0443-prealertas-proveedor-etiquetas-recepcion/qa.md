# Evidencia y entrega · SDD-0443

## Qué cambia

El proveedor abre un enlace por compra y encuentra primero el packing list. Puede
completar el formulario o descargar el XLSX; no son dos pasos obligatorios. Guardar
se identifica como borrador de este navegador, enviar crea una versión del documento
y la impresión de etiquetas sigue disponible con el documento vacío.

La página del proveedor no consulta el nombre del cliente ni recibe la descripción
libre de su compra. El Shipping Mark y la referencia vienen del servidor; restaurar
un borrador antiguo no los cambia. La migración del almacenamiento local elimina
nombre, teléfono y email de cliente en borradores e historial de esta compra.

La etiqueta compartida entre portal y proveedor muestra Shipping Mark, compra,
número de caja y QR. No imprime nombres personales ni el encabezado "Shipping to".
La marca conserva su capitalización y la identidad de los aliados. Administración
permite idioma, tamaño de QR y visibilidad de marca, con versión esperada para evitar
sobrescribir cambios de otra sesión. No permite editar QR o identificación.

El QR abierto con la cámara del teléfono ofrece acceso a recepción. Esa acción
requiere la sesión del operario CN y vuelve a resolver la caja dentro de su tenant.
En el escáner de la aplicación, el lote pendiente queda seleccionado por defecto.
Para recepción parcial se seleccionan códigos concretos: una cantidad nunca decide
por sí sola cuáles cajas llegaron. Recepciones repetidas se rechazan sin duplicar.

Las solicitudes existentes de servicios son la fuente persistente de tareas: se
muestran antes de recibir y en `/m/cn/servicios`. Recibir no las marca atendidas.
El equipo sigue registrando los resultados con el flujo de servicios del ERP; esta
entrega no introduce una segunda fuente de estados ni una captura de evidencias
alternativa. El portal conserva la visualización existente de esos estados.

## Conciliación de etiquetas

Enviar el formulario con un total entero entre 1 y 1000 actualiza la cantidad
anunciada mientras no haya comenzado la recepción. Se reutiliza el sincronizador
existente: conserva códigos vivos, crea los faltantes y retira únicamente cajas
esperadas sobrantes. Nunca reutiliza códigos retirados. Guardar localmente no cambia
etiquetas. Tras enviar, la página refresca las etiquetas del servidor.

Después de comenzar la recepción, la conciliación de cantidad queda en operaciones:
se conserva el documento y se informa al proveedor si su total difiere. No se borra
ni renumera una caja recibida por una corrección del proveedor. El Excel adjunto se
mantiene como alternativa documental; no se interpreta automáticamente para cambiar
inventario. Esa revisión la realiza operaciones.

## Ciclo de vida

No se introduce una caducidad arbitraria. Se mantiene la revocación explícita del
enlace (`share_disabled_at`) y las comprobaciones existentes de compra eliminada.
Recibida y consolidada siguen siendo estados operativos; no se confunden con borrar
documentos o perder seguimiento. Un archivo administrativo y una eventual ventana
de reimpresión poscierre requieren definir el plazo con el negocio. No se crea un
cron que cierre links ni se destruye historial.

## Fundamento de UI/UX

- [Nielsen Norman Group: reconocer elementos clicables](https://www.nngroup.com/articles/clickable-elements/): señales visibles de interacción. Aplicación: controles con borde, verbos explícitos y campos editables distinguibles de totales.
- [Carbon: uso de botones](https://carbondesignsystem.com/components/button/usage/): jerarquía según la función. Aplicación: enviar documento es la acción principal; borrador, Excel e impresión son acciones distintas y secundarias dentro del editor.
- [Nielsen Norman Group: estados de botones](https://www.nngroup.com/articles/button-states-communicate-interaction/): el estado debe comunicar la interacción. Aplicación: foco visible, carga al enviar, feedback veraz cuando falla localStorage y aviso de impresión independiente del estado del documento.

## Comprobaciones ejecutadas

- 35 pruebas del prellenado XLSX, borradores y cálculos pasaron inicialmente.
- 19 pruebas de identidad white-label pasaron tras corregir la presentación de
  Shipping Marks de aliados en el formulario.
- 4 pruebas del recorrido proveedor: imprimir vacío sin enviar, separar impresión
  de documento/etiquetas, eliminar datos antiguos del cliente y error real de guardado.
- 2 pruebas de recepción: lote de 23 por defecto con servicios visibles y recepción
  individual de la caja escaneada, aunque no sea la primera por secuencia.
- Contrato SQL de `0449` ejecutado en PostgreSQL 17 desechable: selección exacta,
  repetición, caja inexistente, conservación de lote recibido, finalización de lote,
  versión de etiquetas, rechazo de configuración obsoleta y permisos.
- Dos llamadas SQL simultáneas produjeron **una recepción y tres cajas recibidas**.
  Reproducible con `node scripts/qa/prealertas-reception-concurrency.mjs dtd_sdd0443_test`
  y el contenedor local con `supabase/` montado en `/sb`.
- Gobernanza, registro de componentes y documentación validaron.
- Revisión visual con una ruta temporal de datos ficticios (retirada de la entrega):
  escritorio, aviso de impresión y móvil de 390 px. El contenedor del proveedor
  midió 375 px de ancho útil y 375 px de scrollWidth; el editor midió 356/356 px.
  La tabla conservó desplazamiento horizontal interno. La barra de desarrollo
  agregaba desbordamiento fuera del contenedor del producto.

## UI-CHECK y privacidad

Cumplimiento: separación de acciones y mensajes, foco y verbos, colores existentes,
privacidad en etiqueta y borradores, identidad de caja estable, controles de tenant.
No conformidades corregidas: nombre personal en etiquetas, CSV presentado como
Excel, guardado local presentado como versión enviada y selección parcial por orden
interno. No aplica: pagos o aceptación contractual en este cambio.

La revisión de privacidad es técnica y no afirma cumplimiento legal. No se agregan
datos personales del cliente. Las solicitudes de proveedor y registros de recepción
conservan sus permisos. Las versiones administrativas registran autor y fecha.

## Límites y orden de integración

La migración `0449_prealerta_exact_box_reception.sql` está preparada y probada
localmente, **no aplicada a producción**. El coordinador debe revisar su número
contra todas las ramas y gestionar su aplicación antes de activar el nuevo código.
La aplicación requiere autorización específica conforme al runbook del repositorio.

El flujo del teléfono está limitado a lotes de hasta 1000 cajas: cuando la consulta
detecta más, exige recepción asistida y nunca presenta una lista truncada como lote
completo. La prueba SQL cubre concurrencia del flujo nuevo; la serialización de la
asignación de recepción usa un bloqueo transaccional de la tabla de recepciones CN.
Operaciones debe vigilar su latencia si aumenta el volumen de recepciones simultáneas.

No se afirma validación desde una red china, dentro de WeChat ni revisión lingüística
por proveedor nativo. La impresión se prepara en A4; queda la prueba física con la
impresora y papel del almacén. No se hicieron pedidos, envíos de mensajes ni cambios
de mercancía real para verificar esta tarea.

## Verificación final y coordinación

`node scripts/verify.mjs` terminó sin fallos: 12 de 15 pasos ejecutados. Pasaron
lint (8 avisos previos), frontera RSC, tipos, 503 archivos / 6189 pruebas, documentos,
numeración, constantes, componentes, gobernanza, 140 contratos SQL, reconstrucción
del esquema y compilación de producción. Tras los últimos ajustes pasaron además
60 pruebas focalizadas, incluidos 19 casos white-label, y una nueva revisión de tipos.

Tres pasos se omitieron y no equivalen a validación: Edge Functions (Deno/npx no
disponibles), comprobación de migraciones aplicadas (sin credenciales de producción)
y E2E (sin navegadores Playwright). La revisión visual local manual sí se realizó.
La generación de Next restauró automáticamente tsconfig.json; no se entrega ese cambio.

La configuración administrativa cubre las etiquetas de compras del portal y proveedor.
También se retiró el nombre personal y el encabezado Shipping to de la etiqueta
heredada del ERP, conservando su disposición física y configuración propia.

Se compararon todos los archivos de esta tarea con los diez PR abiertos #21, #23,
#24 y #26–#32. No había archivos compartidos en esa consulta; `coordination.json`
conserva el resultado. Esto no sustituye las pruebas de integración del coordinador
cuando cambien las ramas o se integren sus comportamientos.
## Corrección QR local · 2026-09-06 · 6254e1f1

Tras incorporar origin/main 74bb52ab mediante merge local 37301e04, se corrigieron
los dos hallazgos de la review 5123317133. El login propaga exclusivamente un box
validado y la acción construye /m/cn/recibir?box=... después del PIN correcto.
Valores repetidos, File, URLs y returnTo arbitrario no determinan la navegación.

La entrada autenticada muestra found:false con mensaje persistente y opciones
Reintentar consulta / Volver a escanear. La primera fuerza una consulta nueva por
GET; ninguna acción registra recepción. Excepciones inesperadas no exponen su
mensaje interno. Un box ausente conserva el escáner normal; uno inválido muestra
un error sin consulta de mercancía. Se conserva el control de sesión y región.

Pruebas focalizadas: 27/27 PASÓ, en tres archivos, con datos sintéticos y auth/DB
simulados. La fase roja inicial tuvo siete fallos de producto más un fallo del
mock useActionState (objeto inestable): ese mock se corrigió sin reducir aserciones.
La prueba de UI verifica que pulsar los cuatro dígitos transmite la caja. Otras
pruebas ejercitan la acción real y el destino exacto; no se presentan como E2E con
un PIN real ni una sesión contra Supabase.

UI-CHECK sobre el diff: acciones son enlaces de navegación con estilos canonical
studio-btn, hover/foco existentes y altura mínima mediante token s-12; texto de
error separado, sin mensaje de éxito falso, sin color inventado ni nuevo componente.
H1 y role=alert exponen el resumen; para chino se ofrece título, ayuda y acciones.
Revisión de código PASÓ; nueva prueba visual en navegador y lector real NO EJECUTADO.
La revisión visual anterior del proveedor no se cuenta como evidencia de esta pantalla.

Privacidad técnica del delta: CORRECTO (login/page.tsx:submitPin y
login/actions.ts:signInOperarioAction), se transporta solo el identificador operativo
que ya está en el QR; no se agregan nombres, contacto ni persistencia. CORRECTO
(recibir/page.tsx:RecibirIndexPage), se exige sesión antes de consultar y no se
imprimen detalles de excepciones. NO VERIFICABLE: retención de logs de infraestructura,
impresión, China/WeChat y comportamiento real de red; no se cambian sus políticas
ni se afirma cumplimiento legal. Inventario/consentimiento/derechos/borrado/auditoría/
terceros/transferencias/decisiones/firma/titulares conservan el alcance de la revisión
original; este delta no incorpora una nueva captura o integración.

No se tocó 0449. El ledger de producción es un pendiente de release, no motivo para
aplicar migraciones antes de revisar la PR. Esta corrección solo autoriza commits
locales; el PR remoto conserva e2ec0adc hasta una publicación autorizada posterior.
## Resultado final de verify · 6254e1f1

PASÓ: harness (12), lint, frontera RSC, typecheck, Edge Functions (4 entradas con
Deno 2.9.6), Vitest (505 archivos / 6228 pruebas), docs, numeración, constantes,
componentes, gobernanza, SQL (140 contratos), schema-rebuild (381 aplicadas + 18
solo-ledger; aislamiento de 219 tablas) y build. Total: 14 de 16 pasos ejecutados.
NO DISPONIBLE: migrations-applied, sin credenciales; corresponde a release.
NO EJECUTADO: E2E, omitido explícitamente por Director, sin entorno asignado a #33.
No constituye cobertura completa. No se tocó el schema de producción ni la 0449.

Comando: node scripts/verify.mjs (entrypoint de pnpm verify), con
VITEST_MAX_WORKERS=4, VERIFY_DENO_BIN apuntando al Deno 2.9.6 local aprobado y
VERIFY_SKIP_E2E=1. Log: %TEMP%/pr33-qr-6254e1f1-verify.log.
El gate restauró tsconfig.json; no se entrega modificación automática de Next.
Las correcciones se conservan en 6254e1f1; después solo cambió documentación.

Evidencia del delta de privacidad: app/m/cn/login/page.tsx:88,
app/m/cn/login/actions.ts:30 y app/m/cn/recibir/page.tsx:27. No hay captura nueva de
identidad personal ni ampliación de permisos. La revisión independiente sigue
recomendada y pendiente del Director.
# QA combinada · corrección autorizada 2026-09-06

En HEAD1611edd3: matriz22/24, dos fallos de overflow móvil; ocho errores simulados
observados. Main74bb también reproduce overflow y cuerpos text-wine. Se corrigen
en combinación con0441, pendiente validar nuevoSHA; no reutilizar verdes previos.
Evidencia externa en DTD-backups/director-goal-20260905/portal-colors-reception-integration-20260906.
Recepciónlight usa wrapperreal y fondo navy deliberado del componente; dark es
stress adicional, no soporte ofrecido por MobileLayout. Auth/PIN, escritura real,
QR físico, China/WeChat, configuración tenant y UAT siguen pendientes.
FUERA DE ALCANCE DETECTADO: contraste ES/Copiar en stressdark y token warning-border
de recepción no definido. No se alteran para obtener verde ni se omiten del informe.
