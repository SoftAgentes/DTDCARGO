# SDD-0473 · Portal y confirmación del proveedor · 2026-10-21

Owner `worker-packing-portal-20261021`. Estado: implementación y recorrido local completados;
PR borrador publicada. Gate ejecutado con cierre incompleto por ledger productivo sin medir.
Sin integración ni producción.
Worktree `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/packing-list-portal-confirmacion-20261021`.
Rama `codex/packing-list-portal-confirmacion-20261021`; base `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`.
Director comprobó con fetch final que origin/main conserva esa base.

## OBJETIVO ORIGINAL

Cliente importa/revisa/guarda → proveedor ve el mismo documento, corrige peso bruto y CBM,
confirma → imprime documento y etiquetas físicas vigentes. Mejorar legibilidad/presentación del
portal en ese recorrido. Mostrar demo local con datos ficticios antes de activar producción.

## ALCANCE Y PERMISOS

Continuación de SDD-0473 relacionada con 0468; allowlist exacta en etapa 2026-10-21 de la spec.
Guard y owner comprobados. Subagente interno `portal_cliente_ui` con archivos disjuntos asignados;
sin claims separados ni escritores solapados. Entregas históricas conservadas.
Commits selectivos, publicar la rama y PR borrador autorizados. Sin merge, deploy, cambios de
banderas/migraciones productivas, copia de secretos, filas privadas productivas o documentos reales
enviados a IA. No se modificaron `/tarifas` ni el cotizador comercial. No hay nueva migración.

## COMPLETADO

- Portal: entrada documental única con subir → revisar → compartir; preserva fotos y alternativas
  legacy. Cajas de metadatos identificadas como estimadas, separadas de los totales del documento.
- Preview de datos detectados antes de aplicar, incluso en reintentos que devuelven trabajos ya
  listos. Archivo recibido, datos aplicados, borrador compartido y despacho confirmado son distintos.
- Borrador normalizado compartido, conservando IDs, unidades, moneda y auditoría. SSR autoriza al
  dueño vigente antes de proyectar; proveedor nunca recibe originales/fuentes privadas del cliente.
  Se elimina la precarga parcial al formulario local para compras gestionadas.
- Proveedor: cuatro fases, chino por defecto/ES/EN, historial, correcciones, Excel, archivos opcionales,
  documento y etiquetas. Confirmado reabierto entra directamente a revisión/recibo final.
- Cuerpo/inputs de 16 px, títulos 24–32, resumen lateral, móvil apilado. Producto antes de código;
  producto aceptado como línea compacta. Formato estándar sustituye la guía; Editar abre el producto.
  Decimales progresivos/coma, fecha y moneda controladas; incidencias con nombres humanos.
  Cambiar fase/formato exige aceptar o quitar el producto en edición para conservar lo escrito.
- CAS con expectedRevision y comandos idempotentes existentes. Conflicto conserva edición,
  compara servidor y reemplaza sólo explícitamente. Keys por compra/workspace/token/revisión
  impiden transporte o grillas viejas al navegar/refrescar.
- Etiquetas: GET exige revisión confirmada vigente, submission actual, compra/tenant, conteo exacto
  de cajas físicas/códigos únicos y última relectura de revisión. Sin códigos inventados. Legacy
  sin mapping puede reutilizar cajas físicas coincidentes de su compra, incluidas recibidas;
  diferencias requieren revisión DTD. No se reasignan cajas recibidas.
- Ver etiquetas sin abrir impresión; proveedor y cliente revalidan antes de imprimir. Corrección
  invalida confirmación. Conflicto retira grilla e impide imprimir una revisión obsoleta.
- Excel adjunto en flujo gestionado es respaldo: no importa datos ni confirma. Se preserva la
  alternativa Excel legacy y los estados honestos de carga parcial. Reutiliza SQL/persistencia 0457.

## VALIDACIÓN

Fuentes de producto congeladas al iniciar el verify final. Después sólo documentación autorizada.
No se debilitaron tests ni se alteraron límites/concurrencia. Primer verify cancelado deliberadamente
durante harness para incorporar correcciones autorizadas; `worker-verify.log` no es el gate final.

| Comprobación | Estado y alcance |
|---|---|
| Instalación con lockfile congelado | PASÓ, manifiesto/lock sin cambios |
| Focal proveedor/etiquetas/adjuntos | PASÓ, 36 pruebas en 3 archivos en la última corrida |
| Autorización SSR y adjuntos | PASÓ, 27 pruebas / 2 archivos, dueño vigente y privacidad |
| Otras focales portal/editor/importación/HTTP/SQL | PASÓ; incluidas también en suite completa |
| Tipos independiente final | PASÓ |
| Harness canónico | PASÓ, 237/237 |
| Lint canónico | PASÓ, 0 errores / 15 advertencias de código ya existente |
| RSC y tipos canónicos | PASÓ |
| Edge Functions | PASÓ, 4 entradas con Deno |
| Vitest completo | PASÓ, 863 archivos / 12.316 pruebas; 1 archivo/prueba omitidos |
| Corpus real de proformas | NO EJECUTADO: falta DOCUMENT_IMPORT_CORPUS; omisión unitaria declarada |
| docs/numbering/feature-constants/componentes/gobernanza | PASÓ |
| Símbolos de migraciones pendientes | PASÓ, amarillo declarado de 0495 ajeno al slice |
| Ledger productivo | NO DISPONIBLE: sin URL/credencial de servicio; no se copian secretos para verde |
| Contratos SQL PostgreSQL 17 efímero | PASÓ, 246 contratos, rollback total |
| Reconstrucción de esquema | PASÓ: 471 migraciones + 18 sólo ledger; 219 tablas / dos tenants de prueba |
| E2E canónico | PASÓ en reintento global, cobertura parcial: 177 aprobados / 1 flaky recuperado / 20 omitidos / 0 inesperados; Supabase local deny-only |
| Build canónico | PASÓ, compilación optimizada y generación de 162 páginas; tsconfig restaurado automáticamente |
| pnpm verify final | CIERRE INCOMPLETO, exit 0: 16/17 pasos medidos, crítico sin medir migrations-applied; no hubo fallos en lo medido tras reintento |
| /ui-check y revisión React | OK con límites: marca, estados, foco, keys e identidad comprobados |
| Diff / allowlist | PASÓ, 38 archivos modificados/nuevos, ninguno fuera de esta etapa |

Fixture bajo docs excluida del ESLint por configuración del repo; TypeScript sí la comprobó.
Log final: `C:/Users/AKX generator/.codex/visualizations/2026/10/21/packing-list-portal/worker-verify-final.log`.
Primer intento E2E: 171 aprobados, 6 flaky recuperados, 20 omitidos y 1 fallo del carrusel;
además worker 24 agotó 300000 ms al cerrar y Playwright lo terminó. El runner hizo su único
reintento global configurado, sin alterar código, límites ni pruebas. Segundo: 177/1/20/0,
sin errores globales; carrusel aprobado. Flaky del segundo: navegación ERR_ABORTED de token
inválido, recuperada al reintentar. JSON original segundo guardado como `e2e-attempt2-report.json`.
El JSON temporal primero fue eliminado por el propio runner antes de poder copiarlo; se conserva
log completo, contextos y trace del carrusel. No se presenta un resumen derivado como ese original.
Los 20 omitidos son 18 casos con seed/auth aislados no disponibles y 2 capturas duplicadas que
se ejecutan sólo en Chromium. El veredicto automático nombra ledger como omisión crítica;
la cobertura operativa/auth de E2E sigue parcial y se declara expresamente.

### Recorrido observado directamente por Director

1. CSV sintético realmente extraído: 100 pcs / 10 cajas / USD 350 / 0,6 m³ / peso ausente.
   Preview antes de aplicar y borrador incompleto revisión 1.
2. Enlace `/p/55555555-5555-4555-8555-555555555555` en otra pestaña abre lo mismo, zh por defecto.
   Peso `120.5`, CBM `0.6` escritos con teclas reales; ES→EN→ES conserva datos.
3. Confirmación SQL: revisión 2, versión 1, folio DTD-PL-2026-0001 y 10 códigos físicos distintos.
4. Cliente guarda 120,6 kg / revisión 3; proveedor obsoleto recibe 409, retira grilla/bloquea print.
   Comparar/adoptar explícito, corregir a 120,5 y reconfirmar.
5. Final: revisión 4, versión 2, folio DTD-PL-2026-0002; mismos DTD-B-000001 a 000010. Cliente
   abre LabelsClient real con esos QR. Copiar enlace muestra confirmación.
6. Excel descargado UI y comprobado con ExcelJS: 10 cajas, 100 pcs, 120,5 kg, 0,6 m³, USD 350;
   totales sin duplicación. Archivo sintético fuera de Git.
7. Escritorio 1440; cliente 390 claro; proveedor 390/375 oscuro sin overflow. Enter enfoca H2,
   Tab muestra outline 3 px. Producto sin aceptar conserva edición ante intento de navegar.
   Copy gestionado de adjuntos comprobado tras reiniciar sólo frontend.

Impresión nativa invocada parcialmente; papel, PDF final, escaneo físico y WeChat NO EJECUTADOS.
Chino operativo, lectores de pantalla y medición exhaustiva de contraste no acreditados.
No es una cuenta real autenticada: componentes reales con identidad/sesión/storage adaptados,
más extracción/servicio/SQL reales. Precisión de documentos comerciales/PDF real no acreditada.

### Demo y evidencia

Frontend final: `http://127.0.0.1:4321/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/index.html`.
API/PostgreSQL efímero en 4320; 4321 proxy loopback al mismo estado. Ambos procesos se conservan.
Reiniciar 4320 borra sólo los datos ficticios; no hacerlo para refrescar interfaz.
[README reproducible](../../docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/README.md).
PGlite ejecuta SQL original 0147/0148/0244/0449 y 0457 con DDL previo mínimo sintético. Sin Supabase,
Storage firmado, cron, cuotas o IA remotos. La demo no lee env ni envía bytes a Anthropic; PDF sin
servicio IA falla visiblemente, sin datos inventados.

Evidencia: `C:/Users/AKX generator/.codex/visualizations/2026/10/21/packing-list-portal`.
Auditoría Director `director-ui-audit.md`. Capturas aceptadas 02/03 antes, 06/07 estándar,
12 primera confirmación, 13 conflicto, 16 proveedor 375, 18 etiquetas cliente, 19 cliente 390,
20 cliente escritorio. Antes/después tienen datos ficticios distintos: comparan jerarquía/densidad.
00 vacía rechazada; 05 renombrada como 388 inicial.

### Gobernanza y conocimiento

Portal/proveedor, documentos de compra, riesgo R3. Validador plugin válido: 28 políticas / 5 componentes.

| Política | Clasificación / evidencia |
|---|---|
| FRM-01 / ERR-01 / LOD-01 / PRG-01 | Cumplimiento: validación recuperable, estados separados, CAS conserva edición, carga parcial |
| A11Y-01 / BTN-01 | Cumplimiento del alcance probado: labels, controles táctiles y foco/teclado; no auditoría exhaustiva |
| VIS-01 / VIS-02 / BRAND | Cumplimiento: tokens, Sora/Nunito portal-sys, CJK sistema y vino; capturas |
| IA-01 I2 | Cumplimiento UI: aviso previo, preview/aplicación humana, sin confirmar automáticamente. PDF/privacidad productivos pendientes |
| AUD-01 | Cumplimiento: revisión/commandId/historial existentes conservados; HTTP/SQL/CAS |
| CMP-01 | No se promueven componentes canónicos; composición del sistema existente |
| Comercial / bajas / producción | No aplica a esta etapa; sin excepciones nuevas |

Documentación canónica guardada: spec 0473, README reproducible y este handoff; integración pendiente.
No cambiaron las 16 fuentes semanticPilot. Graphify estructural/global requiere refresco posterior:
`pnpm knowledge:status` no devolvió resultado y se detuvo sólo su proceso propio. Archify 2.16.0
`knowledge:visual` terminó `ARCHIFY_RUNTIME_MISSING`; no se amplió la tarea instalando runtime.
Check de mapa y preview Obsidian NO EJECUTADOS tras ese bloqueo por indicación Director. No se
publicó bóveda ni se declara CURRENT una capa no comprobada.

## COMMITS

- `b25a4660adcfb3286eeb480eb5d3146dd1700a95` — implementación, pruebas, fixture y SDD.
- Cierre documental posterior, exclusivamente este handoff. SHA final registrado en Git/PR y
  entrega al Director; no modifica el producto validado en b25a4660a.

## PR / BRANCH

[PR #319](https://github.com/SoftAgentes/DTDCARGO/pull/319), OPEN / DRAFT, base main d410ab2e.
Rama publicada explícitamente a sí misma y PR adjuntada al chat. GitHub redirige el remoto histórico
a SoftAgentes/DTDCARGO; no se cambió la configuración origin. Director revisó b25a4660a:
38 archivos, 0 fuera de allowlist, diff y árbol limpios. Última consulta sin checks CI reportados;
no equivale a CI aprobado. Merge/deploy/flags sin autorización.

## PENDIENTES DE ESTA TAREA

- Revisión Director del cierre documental/SHA final y revisión de Sam del recorrido antes de
  planificar producción. Producto b25a4660a ya revisado por Director.
- Prueba autenticada en infraestructura aprobada, chino humano, WeChat, impresión completa y
  corpus/PDF reales NO EJECUTADOS. Ledger y conocimiento requieren contexto de cierre/release.

## FUERA DE ALCANCE DETECTADO

- `company-photo-carousel.spec.ts:93`: intento inicial timeout en page.goto('/'); reintento
  esperaba dos `#operacion video` y recibió uno. Contextos/trace.zip preservados fuera de Git como
  `e2e-carousel-attempt1-*`. No se modificó el módulo; no se afirma preexistencia sin probar base.
  Pasó en el segundo intento global. Timeouts de rutas públicas recuperados y cierre de worker
  agotado conservan su carácter inestable; no se presentan como un fallo permanente del producto.
- 15 avisos lint y amarillo declarado 0495 no se absorben en esta tarea.
- Activación comercial, calculadora, decisiones legales/privacidad productivas y recepción del
  warehouse conservan revisiones/autorizaciones específicas.

## Coordinación 2026-10-21 / Director general

Fuente: decisión del Director general / DIRECTOR ORQUESTADOR
(`01a160e3-92b0-76f0-bc3c-20000e81ff16`), transmitida por el Director de esta tarea después
de verificar la autorización humana de Sam para esa coordinación. Es un registro de fronteras
entre frentes; no constituye aceptación del producto ni autorización de integración o producción.

Según la revisión comunicada por el Director general, #319 conserva sus 38 rutas y no comparte
archivos con #318/SDD-0578 en este corte. El Director general informa que el delta de #318 es de
72 rutas respecto de #316; su diff contra main incluye ancestros. Estas cifras y la comparación
de ese otro frente se registran con esa atribución, sin una inspección nueva por este Worker.

Aunque la autoría esté separada, ambos frentes comparten `prealertas`, `warehouse_boxes` y la
cadena `save_document_workspace` → `submit_packing_list` / `receive_prealerta_boxes_as_operario`.
Packing conserva documento, revisión, confirmación y etiquetas; envíos conserva recepción,
embarque y consolidación. La frontera acordada exige:

- No inventar ni sustituir `boxCode`.
- No sumar `contents.scope=group_total` una vez por cada caja.
- Editar exige una reconfirmación vigente; las cajas recibidas bloquean reasignar grupos.
- Antes de modificar contratos, avisar al Director general con firma o columna concreta y el
  consumidor afectado. No copiar commits entre #319 y #318.

Autoría con allowlists actuales: PARALELIZABLE. Prueba combinada confirmar → etiquetar → recibir
y cualquier activación: DEPENDIENTES de una composición revisada fuera de las ramas de autoría.
Esta coordinación no acredita esa prueba combinada ni altera los resultados de validación de arriba.

El Director general informa además que SDD-0578 cambia lectores generales del Portal que requieren
RPC 0502: cohorte OFF no demuestra compatibilidad sin la migración. Ese frente debe revisar
MIGRATE-FIRST, caché, callers y la cadena #307 → #316 → #318. Es una dependencia reportada de otro
frente, sin auditoría ni implementación nuevas de 0502/0578 en esta tarea.

Próximo turno pesado reservado a contabilidad. Packing espera revisión de Sam y conserva la demo.
Se mantienen los pendientes operativos y las fronteras de merge/deploy ya documentados; no hay
autorización de merge, despliegue ni aceptación de producto derivadas de esta coordinación.

## HANDOFF AL DIRECTOR

Implementación local funcional y auditada, PR borrador y gate final documentados. Mantener
4320/4321 y worktree: listeners loopback comprobados al cerrar; revisión 4 confirmada preservada.
No integrar ni activar producción desde Worker. Owner libera claim después del commit documental
y push final. Director revisa SHA final, inestabilidad/omisiones y conocimiento antes de release.

## Adenda 2026-10-21 / Coordinación y nuevo recorrido con Sam

### Protocolo de coordinación

Fuente: el Director de esta tarea verificó mediante `read_thread` el mensaje humano
`01a160f0-8ca6-7340-b7b8-c8c4e61a234e` del chat del Director general
`01a160e3-92b0-76f0-bc3c-20000e81ff16`. Sam indica que también trabaja directamente en las
sesiones y pide mantener actualizado al Director general.

Al tomar un pedido directo, o en el siguiente punto seguro, informar el pedido/referencia y su
efecto en objetivo, alcance, permisos, rama/PR, contratos y turnos. Al cerrar, informar resultado,
evidencia y pendientes. Un bloqueo, cruce de contrato o necesidad de recurso pesado se informa
sin esperar al cierre. Agrupar novedades significativas, sin acuses vacíos ni mensajes por comando.
Los pedidos directos de Sam conservan validez dentro de su alcance; este protocolo no amplía
permisos. No habilita editar documentos de otros frentes ni crear automatizaciones o chats.
El turno pesado M1 contable permanece reservado; se mantiene la demo ligera propia.
En esta actualización el root hará el cierre único al Director general; este Worker no envía
mensajes a otros chats.

### Nuevo recorrido solicitado directamente por Sam

Pedido: «Ábreme la demo y muéstrame cómo quedó el portal, desde que el cliente carga el packing
list hasta que el proveedor corrige peso y CBM, confirma e imprime las etiquetas. Quiero revisarlo
antes de producción.» El Director lo observó desde la UI, sólo con CSV ficticio y la demo existente
4320/4321, e inició el reporte al Director general en un punto seguro.

Para mostrar la carga desde cero se reinició únicamente el estado sintético mediante el botón de
la demo. Las evidencias y resultados históricos anteriores permanecen intactos. Recorrido observado:

1. Preview antes de aplicar: 10 cajas, 100 pcs, USD 350, CBM 0,60 m³ y peso ausente. Aplicar guarda
   revisión 1; copiar enlace muestra confirmación visible.
2. Otra pestaña del proveedor abre esa misma revisión, chino por defecto; se cambia a español.
   Se completa peso bruto TOTAL de 120,5 kg y se corrige CBM TOTAL de 0,60 a 0,64 m³. Se revisa
   expresamente la diferencia de nombre del proveedor entre datos ficticios iniciales y CSV,
   y se guarda revisión 2.
3. Adjuntos opcionales sin exigir otro archivo; revisión final y confirmación explícita generan
   revisión 3, versión 1 y folio DTD-PL-2026-0001. Ver etiquetas muestra diez códigos distintos
   DTD-B-000001 a DTD-B-000010 con QR.
4. Cliente recargado muestra esos mismos datos confirmados: 10 cajas, 100 pcs, USD 350,
   120,5 kg y 0,64 m³. Se pulsa Imprimir etiquetas sin error visible; página y etiquetas siguen
   utilizables. Esta captura no acredita diálogo nativo, papel, PDF final ni escaneo físico:
   no se afirma impresión completada. Se dejan dos pestañas abiertas para revisión de Sam.

Evidencia exacta fuera de Git:
`C:/Users/AKX generator/.codex/visualizations/2026/10/21/packing-list-portal/recorrido-con-cliente/recorrido.md`,
con capturas 01 a 09 en esa misma carpeta. Estado sintético actual: revisión 3 confirmada / 0,64 m³;
es un caso distinto de la revisión histórica 4 / 0,60 m³, que no se reescribe.

Se conservan 4320/PID 26356 y 4321/PID 22292. Sin cambios de producto o contratos, pruebas nuevas,
repetición de gates ni operaciones de producción. Este recorrido no sustituye la prueba conjunta
con recepción ni cierra los pendientes operativos o permisos de integración ya documentados.

## Seguimiento local P2 · 2026-10-21 · Autoría sin ejecución

Encargo del Director general vía Director de esta tarea. Misma rama/worktree/PR #319 y owner
`worker-packing-portal-20261021`. Inicio comprobado limpio en
`b325e203dc7af1f1f93f0c28e2e811f1bc5ba4fa`; guard y claim adquiridos sin desplazar otro owner.
Este SHA será el padre EXACTO del checkpoint local. Se conserva la entrega histórica de 38 rutas.

Allowlist ÚNICA de esta ventana:

- `components/document-import/DocumentImportPanel.tsx`
- `components/document-import/DocumentImportPanel.test.tsx`
- `app/p/[token]/SharedSupplierDocument.tsx`
- `app/p/[token]/SharedSupplierDocument.test.tsx`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `.agents/handoffs/0473-portal-confirmacion-20261021.md`

Lectura estática confirma P2_1: el timeout de polling se consumía una sola vez; el catch del GET
no cambiaba entries ni programaba otro tick. ready/partial sin draft quedaba bloqueado. Además,
entries no tenía identidad de workspace: cancelar sólo el efecto antiguo permitía volver a pedir
el job viejo con la compra nueva. Se acota el arreglo a sesiones del panel por workspace,
preservando null → workspace abierto por el propio panel, ronda de sondeo secuencial reprogramada y guardas
de vida para no continuar operaciones/respuestas de una sesión desmontada.

Lectura estática confirma P2_2: adoptar cambiaba draft/step sin reiniciar editingProduct ni
editing/view internos del editor. Se reiniciaron la guarda del padre y la identidad del editor
editable desde SharedSupplierDocument. DocumentEditor se consulta como dependencia, sin editarlo.
Los oráculos escritos cubren adopción borrador/confirmada con el editor real, sin formulario viejo y con
navegación/Continuar y datos adoptados disponibles.

Pruebas del seguimiento: escritas SIN EJECUTAR, incluidos rechazo inicial GET → recuperación
de preview/aplicación manual, desmontaje, respuesta GET tardía al cambiar A→B, y padre con prop
null→workspace realmente actualizada. El razonamiento anterior es estático, no prueba ejecutada.
Las validaciones históricas sólo acreditan b25a4660a; ninguna acredita este seguimiento todavía.

Permisos: autoría estática y un commit checkpoint LOCAL; NO PUSH ni actualización remota/PR hasta
revisión específica del checkpoint por Director general. Sin nuevos subagentes/sesiones, tests,
tipos, lint, verify, build, E2E, navegador, SQL, instalación, censo de procesos o runtime nuevo.
M1 retiene el turno global con supervisión UNKNOWN. No se modifica diseño, contratos/RPC/SQL,
envíos, otras ramas/handoffs, main ni producción; no se reinicia ni altera la demo 4320/4321.
Entrega del checkpoint: SHA/padre, diff selectivo, SHA256 de las seis rutas y estado/claim.

### Checkpoint de autoría local preparado

**OBJETIVO ORIGINAL:** reparar únicamente P2_1/P2_2 dentro de las seis rutas anteriores,
con pruebas escritas y checkpoint local para revisión del Director general antes de validar o publicar.

**COMPLETADO por lectura/autoría estática:**

- DocumentImportPanel separa la sesión interna del panel de su identidad de workspace. Un cambio
  externo A→B desmonta entries, transporte y estado anteriores. La marca de apertura propia conserva
  la sesión null→workspace cuando onWorkspace actualiza realmente la prop del padre; no pierde
  la carga que acaba de iniciarse.
- La ronda del efecto sondea los GET job secuencialmente y programa otro tick también al fallar, sin resubir ni
  aplicar la propuesta por su cuenta. La limpieza cancela el timer y descarta respuestas pendientes.
  Guardas de vida evitan que open/upload/apply de una sesión desmontada continúen llamadas o publiquen
  un workspace antiguo. No se cambia el contrato DocumentClient ni se incorpora AbortSignal:
  las solicitudes HTTP ya emitidas no se abortan físicamente; se ignoran sus respuestas y se
  impiden pasos posteriores de esa sesión.
- SharedSupplierDocument reinicia editingProduct y una generación key del editor editable al
  adoptar explícitamente cualquier revisión. Esto descarta editing/view/formulario internos,
  además de liberar la guarda de navegación/guardado. DocumentEditor no se modificó.
- Se añadieron siete casos al panel: ready/partial con GET inicial rechazado y posterior propuesta,
  aplicación sólo por clic sin resubida; cancelación del próximo tick; GET que llega tras desmontaje;
  A→B con respuesta vieja resuelta después de mostrar B y sin consultar job A con workspace B;
  padre con useState que adopta realmente null→abierto; apertura tardía tras cambio de compra.
  Se añadieron dos casos del proveedor con DocumentEditor real: tras 409 y producto abierto,
  adoptar borrador o confirmado, regresar a cargo sin formulario viejo, Continuar y guardar
  datos adoptados con expectedRevision 4 e IDs originales. Son nueve casos nuevos escritos.

**VALIDACIÓN del seguimiento:** guard/identidad/ownership y revisión estática de alcance realizados;
`git diff --check` PASÓ. Las nueve regresiones están **NO EJECUTADAS**. También **NO EJECUTADOS**
tipos, lint, verify, build, E2E, `/ui-check`, navegador, SQL y validadores de gobernanza/conocimiento.
Esta omisión es la secuencia expresa del Director general mientras M1 retiene el turno global
con supervisión UNKNOWN; no se infiere que las regresiones pasen. Las validaciones históricas
de b25a4660a permanecen intactas y no acreditan este seguimiento.

Revisión normativa estática: superficie Studio/proveedor, módulo documento compartido, riesgo R3
heredado de identidad/revisión. FRM-01 v1.1: cumplimiento del descarte explícito a nivel de código,
con comprobación ejecutable pendiente. ERR-01 v1.0 / LOD-01 v1.0: recuperación reprogramada y
cancelación de la sesión observadas en el diff; la conformidad de runtime no está certificada. CMP-01 v1.1:
no aplica promoción o nuevo componente reusable; DocumentImportSession es detalle interno de este
panel y no incorpora consumidores de deprecated. Revisión React estática: claves cambian por
adopción/compra; inicialización de transporte sigue local a la sesión; cleanup del sondeo y guardas
tras cada await protegen el estado descartado. No se ejecutó el script del plugin por el límite
expreso de esta ventana; no se convierte esta lectura en aprobación de integración.

**COMMITS / PR / BRANCH:** checkpoint únicamente LOCAL con padre exacto
`b325e203dc7af1f1f93f0c28e2e811f1bc5ba4fa`, misma rama y PR #319. El SHA inmutable y hashes de las
seis rutas se entregan al Director al crear el commit. NO PUSH, sin actualización de PR/remote.

**PENDIENTES DE ESTA TAREA:** revisión específica del checkpoint por Director general; después,
ventana de validación y publicación explícitamente coordinadas. Integración/producción y pendientes
operativos históricos conservan sus permisos y no se cierran aquí. Impacto documental guardado en
esta spec/handoff; Graphify, Archify y Obsidian no consultados ni regenerados en este seguimiento.

**FUERA DE ALCANCE DETECTADO:** residual preexistente de GET superpuestos entre rondas del efecto
con varios archivos, según el dictamen del Director general detallado abajo. No se corrige producto
ni se exige un décimo caso en esta ventana. No se modifica diseño, SQL/RPC, contratos, envíos ni
datos de demo. Se preservan los procesos 4320/4321 sin inspeccionarlos, reiniciarlos ni cambiar
su estado sintético.

**HANDOFF AL DIRECTOR:** revisar el checkpoint inmutable, no los resultados históricos como prueba
del arreglo. El Worker libera su claim al finalizar la escritura y conserva rama/worktree/demo.

### Hijo documental del checkpoint · Dictamen limitado · 2026-10-21

Fuente: dictamen del Director general y dos peers, transmitido por el Director de esta tarea.
Ambos P2 originales se consideran atendidos POR FUENTE en
`fd0eeada16157f77f83bf84115ac1d6788bf1aab`, con hashes y alcance aprobados estáticamente.
Los nueve casos corresponden a los hallazgos y siguen **NO EJECUTADOS**. No hay aceptación
funcional ni permiso de publicación. Las validaciones históricas de b25a4660a no cubren fd0eeada
ni este hijo; M1 mantiene la espera de validación.

Precisión del término «sondeo secuencial»: se refiere a la ronda de cada efecto y no a exclusión
global de peticiones HTTP en vuelo. Con varios archivos, el patch del primer GET modifica entries
y reinicia el efecto mientras otro GET de la ronda anterior puede continuar pendiente. Si tarda
más de pollMs, el nuevo efecto puede emitir otro GET del mismo trabajo. La respuesta vieja se
ignora correctamente y las solicitudes HTTP ya emitidas no se abortan físicamente. El dictamen
identifica esta interacción como YA EXISTENTE antes de fd0eeada; queda en FUERA DE ALCANCE
DETECTADO, sin nueva corrección de producto ni décimo test.

Alcance documental ÚNICO: `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
y `.agents/handoffs/0473-portal-confirmacion-20261021.md`. Se crea un hijo de padre exacto
`fd0eeada16157f77f83bf84115ac1d6788bf1aab`, sin amend, preservando los cuatro blobs de código/tests
del checkpoint. Inicio limpio verificado, guard y claim propios adquiridos sin desplazar owner.
Sin pruebas, tipos, lint, verify, build, E2E, UI, navegador, SQL, instalaciones, hook runtime,
censo/procesos, runtime nuevo, push ni actualización remota/PR. Sin tocar demo 4320/4321, main,
merge o producción. El SHA hijo, SHA256 de ambos documentos y blob IDs idénticos se entregan al
Director para cotejo previo a cualquier respaldo autorizado en la misma PR #319 DRAFT.

## Etapa B · PDF real confirmado · Autoría sin ejecución · 2026-10-21

Sam autorizó aceptación con Excel/PDF de muestra y PDF final/etiquetas. Director de Packing asignó
B de fuente y notificó al Director general. Worker owner `worker-packing-portal-20261021`, misma
rama/worktree/PR #319, inicio limpio comprobado en `53965778c7acf4671d241d1fe3c88d24549f0b20`.
Guard y claim propios adquiridos sin desplazar owner. Autoría iniciada 2026-10-22T03:37:46Z;
presupuesto máximo 45 minutos. No runtime autorizado en esta etapa.

Allowlist exacta: las 17 rutas de «Etapa B» en SDD-0473: .env.example; pdf.tsx/pdf.test.tsx,
http.ts/http.test.ts de lib/studio/document-import; document-client.ts/document-client.test.ts;
SharedSupplierDocument.tsx/test; LabelsClient.tsx/test; qa/portal-confirmacion/vite.config.ts,
pdf-proxy.ts/pdf-proxy.test.ts/README.md; spec0473 y este handoff. No autoriza otras rutas.

Contrato previsto: GET action=pdf, surface=packing-list|labels, expectedRevision. Autorización
actual, getDocumentLabels antes de render y comprobación posterior;409 sin bytes si cambió.
download(options?) conserva XLSX sin opciones. Botones gestionados, legacy/impresión intactos.
Producto/código primero; cantidad/importe asignados al grupo, logística una vez por grupo y totales
una vez. Revisión/folio/versión y códigos físicos vigentes; sin identidad cliente o fuentes privadas.
CJK explícito DOCUMENT_IMPORT_PDF_CJK_FONT_PATH,503 recuperable si falta/inválida o no cubre texto;
no fallback Windows/copia de fuente ni omisión silenciosa. Deng sólo en futura prueba local admitida;
portabilidad/servidor pendiente. Renderer/qrcode existentes; sin dependencias nuevas.

Fixture: interceptor SSR en4321 lee4320 existente. No4322, no reiniciar4320/4321 ni reset ahora.
PDF entrada sin IA mantiene fallo recuperable real. Muestra mixta prevista:10cajas/220pcs/USD340;
A52kg/.28 +B78kg/.42 =130kg/.70; revisar también el declarado .66 antes de confirmar.
Payload/destino/código QR separados de escaneo físico/decodificación de imagen pendientes.

Sólo se escriben fuente/pruebas/docs. Prohibidos tests/render/tipos/lint/verify/instalaciones,
redes/servidores/suites hasta GO runtime específico del Director general. PACKING9 está cerrada,
no reutilizable; sus nueve aprobadas no acreditan B. Checkpoint local selectivo permitido;
publicación espera revisión del Director. No SQL/RPC/CORE/warehouse/calculadora, secretos/PII,
otras sesiones, agentes, merge, producción o migraciones.

### Cierre de fuente B para revisión del checkpoint

**OBJETIVO ORIGINAL:** descargar un PDF real del Packing List + Factura confirmado y otro de sus
etiquetas vigentes, conservando impresión, XLSX, contratos/códigos/QR y el estado de la demo.

**COMPLETADO POR FUENTE:** renderer server-only con modelo cerrado; endpoint aditivo autorizado
con doble gate/relectura y no-store; transporte download(options?) sin romper XLSX; dos acciones
compactas junto a las actuales, apiladas en móvil, zh/es/en en proveedor; error503 recuperable
que conserva datos/impresión y409 que evita el blob antiguo y exige comparar/cargar la revisión.
Se comprueba montaje antes de entregar una descarga que terminó tarde. La impresión legacy no
se reemplaza. La fixture prepara interceptor SSR en4321 sobre HTTP4320, sin nueva base/códigos.

El PDF usa cantidades por asignación y sumas de las mismas líneas, con redondeo del exportador
XLSX; cajas/peso/CBM se cuentan una vez por grupo. Revisión/folio/versión y códigos vienen de la
autoridad. Se revalida también el cambio de códigos físicos durante render aunque siga la misma
revisión. Las fuentes latinas y ArchivoBlack locales, con DTD vino/Cargo tinta, usan la marca
vigente. CJK sólo por ruta explícita: archivo/glyphs y flags de embedding verificados en código;
no ruta Windows, descarga, copia ni sustitución silenciosa. El audit de la fuente omite su ruta
y marca explícitamente que licencia/portabilidad no están certificadas.

**PROYECCIÓN Y PRIVACIDAD ACOTADAS:** supplier.company/contact/email/wechat/phone/address/city,
productos/grupos, Shipping Mark, referencia de compra, revisión/folio/versión y códigos físicos.
Finalidad: documento de la compra confirmada. Acceso por autorización actual del workspace,
incluido token limitado de proveedor; se reautoriza tras render. Se excluyen sources, identidad
del cliente, originales privados, tokens y rutas de fuente. CORRECTO por lectura en
lib/studio/document-import/pdf.tsx:28 (buildConfirmedPdfModel) y http.ts:55 (action=pdf); regresiones
de proyección/tenant/compra escritas, NO EJECUTADAS. Retención real de las descargas, configuración
del servidor, licencia de fuentes y permisos de producción NO VERIFICABLES en esta demo. No se
consultaron filas reales ni se alteraron políticas. Esta revisión técnica no es asesoría legal.

**VALIDACIÓN B:**49 instancias nuevas escritas, todas **NO EJECUTADAS**. Distribución por fuente:
modelo/renderer12, HTTP9, transporte5, proveedor10, portal5, proxy8; filtro `SDD-0473 B` en esos
seis archivos. Tres instancias necesitan fuente explícita y producen PDF real: corto, etiquetas
y60 productos únicos. Sólo si DOCUMENT_IMPORT_PDF_TEST_OUTPUT_DIR está configurado se guardan
PDF/manifest/audit fueraGit. Manifest largo contiene60 códigos y checkpoints inicial/medio/final;
su existencia no acredita inspección de páginas/líneas. Datos de tests (precios2/.75/2) no sustituyen
la aceptación del portal con la muestra de precios1.5/.5/3, aunque ambas sumenUSD340.

Los casos cubren mezclas, asignaciones, declarado.66/.70, privacidad y diez códigos; puertaHTTP
privada/tenant/compra, cambios de revisión/códigos durante render, fuente ausente/inválida y CJK
sin glyphs; transporte que rechaza HTML falso; UI pendiente/no confirmado/dirty/producto abierto,
desmontaje,503 y409 sin descarga; proxy sólo loopback y doble lectura. No se ejecutaron render,
tests, discovery, tipos, lint, verify, build, E2E, UI, navegador, SQL, redes, instalación ni nuevos
servidores. Guard/claim y revisión estática de Git sí autorizados; diff-check y SHA se entregan
al Director tras crear el checkpoint local. b25 y nueve PACKING9 siguen como evidencia histórica
limitada a sus SHAs/casos y no validan B. No se modifica ese historial.

**READY PROPUESTO, NO ADMITIDO:** una corrida de49 con CLI instalada directa, maxWorkers1,
sin file parallelism, filtro y seis archivos del README;480s ejecución +60s cierre y sin retry.
Fuente CJK explícita y directorio externo asignados por Director; stdout/stderr originales,
JSON, exit nativo y recibo antes de concluir. Tipos/lint/verify y aceptaciónUI requieren ventana
específica. PACKING9 está cerrada; no se reutiliza ni se inicia reloj por esta propuesta.

**COMMITS / PR / BRANCH:** checkpoint local selectivo con padre53965778c7acf4671d241d1fe3c88d24549f0b20,
misma rama/PR319. Sin push ni actualización remota antes de revisión del Director. Las17 rutas
de la allowlistB son el único delta autorizado; las38 históricas se conservan sin reclasificarlas.

**PENDIENTES DE ESTA TAREA:** revisión fija del checkpoint; ventana de ejecución, inspección de
PDF corto/largo y diez QR desde los PDF descargados por UI; aceptación con muestrasA4; error de
entradaPDF sin Anthropic como fallo recuperable; chino/WeChat y escaneo/papel físico pendientes.
Portabilidad/servidor/licencia CJK y despliegue no verificados. Para cargarB se necesita reiniciar
sólo4321 con fuente explícita al inicio y backend4320, conservando estadoSQL. No se reinició ni
inspeccionó ningún proceso ni se alteró la demo. GUI y PDF comparten labelVerifyUrl; Vite define
origen QR loopback segúnQA_PORT (4321 esperado http://127.0.0.1:4321) con c/n/b. Esa autoridad
no acredita trazabilidad web pública de producción. No abrir producción para validarla.

**FUERA DE ALCANCE DETECTADO:** se conserva el residual preexistente de GET superpuestos entre
rondas y todos los pendientes operativos anteriores. Sin SQL/RPC/warehouse/envíos nuevos.

**HANDOFF AL DIRECTOR:** cotejar diff/SHA fijo, asignar ventana antes de runtime y mantener la
distinción entre PDFs sintéticos de test y descargas de aceptación. Impacto documental guardado
en spec/README/handoff propios. Graphify/Archify/Obsidian y pnpm knowledge:status NO EJECUTADOS
por el límite expreso de esta autoría; no se publican derivados. Worker libera claim al cerrar
la escritura y conserva worktree/rama y los procesos4320/4321. Sin merge, producción o migración.

**REVISIÓN NORMATIVA ESTÁTICA B:** superficie portal/proveedor, documento compartido, riesgo R3
de identidad/revisión heredado; descarga R2 de datos autorizados. BTN-01 v1.1 / LOD-01 v1.0:
cumplimiento POR FUENTE del verbo Descargar, variantes ghost, type=button, Preparando…/aria-busy,
bloqueo de repetición y contrato de acciones de la spec. ERR-01 v1.0: recuperación503/409 sin
borrar los datos ni filtrar rutas/tokens, evidencia en SharedSupplierDocument.tsx/LabelsClient.tsx
y puerta HTTP. CMP-01 v1.1: no aplica promoción/reemplazo de componente; no nuevo consumidor
deprecated. VIS-01/BRAND: paleta/fuentes locales oficiales por lectura; VIS-02 v1.0: CJK local
configurable es adaptación técnica autorizada para esta prueba, no certificación Noto/servidor
de producción. IA-01: no aplica generación/lectura IA nueva enB; el fallo de entradaPDF sigue
pendiente de aceptación. React: renderer pesado sólo servidor/dynamicimport HTTP, fontloads
independientes en Promise.all, rutas de descarga con cleanup de montaje y blobs revocados.
No se ejecutó validate-governance, UI-check ni ningún validator por el límite expreso de fuente;
las clasificaciones no equivalen a conformidad visual/funcional o aprobación de integración.
Guard y git diff --check PASARON; el SHA fijo se entrega por el canal del Director sin recursión.

## Corrección B1 · Fuentes PDF estáticas · 2026-10-22 · Fuente sin ejecución

**OBJETIVO ORIGINAL:** resolver el fallo de render PDF evidenciado por B1, conservando familias,
documento confirmado/códigos/QR, CJK/config y los49casos anteriores incluidos sus3renders reales.

**ASIGNACIÓN / OWNERSHIP:** Director general aprobó adopción de ocho archivos primarios
(cuatroTTF+cuatroOFL),611757bytes, con ochoSHA256 y Gitblob cotejados por él y el Director.
Mismo Worker owner worker-packing-portal-20261021, worktree/rama/PR319; inicio limpio en
93e738ec4d94c2ba590728ed82459a641d0034e3, guard/claim propios sin desplazar owner a04:50:52Z.
Presupuesto30min. Hijo directo local de93; sin push ni pruebas hasta otra asignación.
Allowlist22exacta registrada en la nueva etapa de SDD0473 antes de modificar producto/assets:
las17rutasB más cuatroTTF y únicoREADME en lib/font-files/pdf/. No otras fuentes/config/SQL.

**CAUSA CON EVIDENCIA:** B1, ventana DIRECTOR-PACKING-B1-49-20261022-01, native1:46/49aprobadas,
3renders fallidos/0SKIPseleccionado/38fuera. Custodia externa B1-93e738e/worker-custody-B1.json
SHA9a8e643b5ca5bb8d5288e0ad49eeeed4bc209c50d88e8cb412d24ffaca91bb58 conserva originales,
títulos, plazos y trazas. PROBE5, ventana DIRECTOR-PACKING-FONT-PROBE5-20261022-01, nativo1
con5reportes completos/2encoded/3errores: Nunito/Sora/JetBrains WOFF2variables reproducen DataView
RangeError en fontkit subset.encode; DengTTF y ArchivoBlackWOFF2estática codifican las cadenas
acotadas. No missingglyphs. Custodia worker-custody-PROBE5.json SHA
87e51e0d583e3c4b61baa3c121e628a7e7f8716fd76a84cb1000cb5239e906c5. Ambos turnos cerrados,
originales preservados; ninguna conclusión de aceptación de producto sale del diagnóstico.

**ARREGLO AUTORIZADO:** copiar únicamente TTFs primarias aprobadas Nunito400/Sora600/Mono400/
ArchivoBlack400 a subdirectorioPDF, byteporbyte; conservar cuatroOFLverbatim en README único,
proveniencia URL/commit/Gitblob/SHA/tamaño. Loader rechaza formato/ejes incompatibles con503
seguro; mantiene glyphs/embedding y salida sin paths. Fuentes web, CJK/Deng/config quedan intactas.
Adquisición DIRECTOR-PACKING-FONTS-ADQ-20261022-01, receiptacquisition-receipt.json aprobada
porGeneral; no conversión, instalación ni nuevas descargas en esta autoría. Peso/rutas reales
se verifican por metadatos del paquete; render de las nuevas caras aún NO EJECUTADO.

**VALIDACIÓN / PENDIENTES:** escribir negativas aditivas formato/ejes y auditar las cinco caras
en los3renders futuros, sin debilitar los49anteriores. Conteo exacto al cerrar fuente. Todos los
checks/runtime nuevos NO EJECUTADOS, incluido render/49rerun/tipos/lint/verify/UI/SQL. No demo,
servidor, adquisición extra, fuenteweb, migra/merge/prod. Checkpoint/sourceguard/diff-check sí
permitidos. La próxima corrida480+60s sólo queda propuesta, no admitida por esta autoría.

**COMPLETADO POR FUENTE:** los cuatroTTF dePDFse copiaron byteporbyte del paqueteaprobado;
cuatroSHA256 y cuatroGitblob coinciden, todos exitsdehash-object0. Receipt primario SHA256
6daa9ab897c8b35b2c17b982a045d599bd41c2825949d4a9ae5206e2329e0a34. Copia/preimages externa
B1-static-fonts-fix-93e/asset-copy-preimages.json SHA256
1b798fff599227f77b245d533b180d322d9b16de155f3d3e2d0fae379a672074. El únicoREADMEextra
incluye las cuatroOFLcompletas/verbatim, URL/commit/Gitblob/SHA/tamaño/peso. No se convirtió,
instaló o cargó ninguna fuente en esta autoría, ni se cambió una fuenteweb/config/CJK.

loadLocalFont admite TTF/WOFFestáticos sinCFF/ejes variables; WOFF2/OTF/colección/CFF/ejes
reciben503pdf_font_unavailable seguro. Se conservan el contacto/revisión/gates y checksde
glyphs/embedding. LosPDFusan ahora exclusivamente las cuatroTTFprimarias. Fontaudit añadesólo
postscriptName/formato/ejes/peso/embedding paraCJKy las cuatrocaraslatinas; nunca susrutas.

**PRUEBAS ESCRITAS:** se conservan49originales y los3renders. La negativa Nunito-como-CJKapunta
a laTTFestática, porque mantenerWOFF2sólo habría probado formato y ocultado el oráculo de
glyphs. Doscasos aditivos cubren WOFF2/OTF/CFF y ejes variables enTTF/WOFF, con503seguro.
Los3rendersfuturos auditarán5caras TTFsinvariables y pesoslatinos400/600/400/400. Conteoexacto
**51**, mismos6archivos/filtroSDD-0473 B: pdf14/http9/transporte5/proveedor10/portal5/proxy8.
Todos **NO EJECUTADOS sobre este hijo**. El nuevoREADYes sólo propuesta480+60/0retry, fuente
CJKexplícita/Node24.20idénticos y directorioexternonuevo; no admisión de tests/render/UI.

**LÍMITES Y HANDOFF:** revisión estática/diff/guard y commitlocal selectivo hijo de93; no push,
pruebas/tipos/lint/verify/build/servidor/demo/QR/producción. El diagnóstico fundamenta la
corrección, no demuestra que el PDFfuncione. No debilitar las3fallidas ni inferir compatibilidad
CJKlicencia/servidor/WeChat. Se entregan checkpoint/preimages/READY pararevisión y posterior
ventana específica. La actualización de conocimiento/derivados queda NO EJECUTADA en fuente-only;
se conservan todoslos históricos de B1/PROBE5/adquisición y los pendientes operativos anteriores.

**REVISIÓN ESTÁTICA DE CIERRE:** guard propio PASÓ y el staged contiene diez rutas, todas
incluidas en allowlist22. `git diff --cached --check` devolvió2 únicamente por los espacios
finales originales de las cuatro OFL en `lib/font-files/pdf/README.md`, líneas55/162/269/376.
Se conservan verbatim por mandato de procedencia; excepción documental limitada a esas cuatro
líneas. No se cambió configuración Git ni se ocultaron advertencias. La revisión default de
las otras nueve rutas devolvió0. Git avisa que normalizará CRLF a LF en el README; se preserva
el contenido completo de las licencias y sus espacios, con originales/binarios sellados fueraGit.
No se ejecutó ninguna prueba ni renderer para cerrar este checkpoint. El nuevo READY propone
51/6, tres renders sin SKIP seleccionado y cero reintentos; sólo una ventana posterior válida
podrá ejecutarlo. La rama remota/PR sigue en su SHA publicado anterior; este hijo queda local.
## Seguimiento local P2 · Presentación y continuación del PDF · 2026-10-22

**OBJETIVO ORIGINAL:** impedir que el nombre de un grupo quede separado de su logística y
primer producto; compactar proveedor y repetir contexto/columnas, manteniendo paginación larga.
**ALCANCE:** las cinco rutas exactas de la nueva etapa SDD0473; padre4ee35b9266d2fe999f0ea16d2382d58cefa0f7a9.
Guard/claim propios a06:37:10Z. Cinco preimages sellados fueraGit en pdf-layout-fix-4ee/
five-source-preimages.json antes de editar. No cambios en fuente de etiquetas/QR, fuentes y
CJK, cálculos/monedas/unidades, modelos/contratos/endpoints/DB o workspace confirmado rev3/V1.

**EVIDENCIA PREVIA, NO REESCRITA:** B1nuevo aprobó51/51, tres renders y cinco caras estáticas,
pero cierre administrativo Worker tardío. DIAG01falló bootstrap(fileURL), DIAG02ZIPválido /
ExcelJSundefined.sheets: original3479con x:workbook continúa como incompatibilidad pendiente,
no OOXMLinválido. Muestra DTDv2canónica se generó/releyó/extrajo con10cajas/220pcs/USD340/.66 y
pesoAausente; originales3479/51dc intactos. B2final confirmó rev3/V1/folioDTD-PL-2026-0001,
130kg/.70 y descargó PDFreales. FuncionalPASÓ, diario02seguíaappend: copia/suplemento recuperados
fuera de cap, administración INCOMPLETA/TARDÍA. No resellar diario02como oportuno.

B3: siete nativos exit0, sin retry, QRdigital10/10y10códigos únicos/autoridadlocal4321; largo60
íntegro. Root/General exteriores oportunos; devolución WorkerB3tardía y sin readback dentrocap.
Rootrevisó TODASlas11PNG a06:35:33Z: documento2páginas FALLÓ(P2grupoB huérfano, proveedor extenso,
continuación sin cabeceras); etiquetas2páginas PASARON; largo7páginas/60filas íntegro y legible
con continuación a mejorar. Visual-review.json externo SHA256
 de46d38d80cfec756778f3f9b19990c2410dbe7df8abc37484b4345aa5d39a63 conserva dictamen completo.
No globalverde: corrección de presentación aún pendiente de nuevas pruebas y revisión visual.

**PLAN Y CHECKPOINTS:** primero SDD/allowlist/contrato; después estilos exclusivos documento y
encabezado fijo/tabla, proveedor compacto, bloque de inicio de grupo con sólo primera fila
indivisible. Resto de productos paginable y grupo visible en cada línea. Mantener51casos y
3renders; dos regresiones nuevas del renderer real para caso compacto y60filas/contexto por
página, no mocks de layout. Finalmente diff/guard/commit selectivo local y READY; NO ejecutar
pruebas/render/tipos/lint/verify ni UI/restarts/descargas/push hasta GOespecífico posterior.

**PENDIENTES:** validación de esta nueva fuente, PDF real actualizado sin guardar/reconfirmar,
revisión visual de todas las páginas, verify canónico. Papel/cámara, chino humano/WeChat,
portabilidad/licencia CJK y producción siguen NO EJECUTADOS/no certificados. Fuera de alcance:
compatibilidad del XMLprefijado original, corrección del catch genérico de la fixture y diarios
administrativos de otros frentes; no se absorben en este seguimiento.
**AUTORÍA CERRADA, NO ACEPTACIÓN FUNCIONAL:** se implementaron documentStyle aislado,
cabecera fija con compra/Shipping Mark/folio/revisión/columnas, proveedor en dos columnas,
primera fila unida a cabecera/logística y resto paginable con contexto de grupo por línea.
Se conservó literalmente el StyleSheet anterior y la rama de etiquetas, incluidos QR y footer.
No hubo cambios en fuentes/CJK, datos, precios, asignaciones, modelos, endpoints, SQL o revisión.

Se escribieron dos regresiones reales aditivas: muestra compacta con siete campos del proveedor
más fecha, tres productos y dos grupos (una página sólo para esta muestra); sesenta productos
repartidos en dos grupos de cinco cajas, con comprobación de códigos íntegros, contexto y
cabecera/logística/primera fila en la misma página. La observación onRender envuelve y llama
renderToBuffer real; usa el layout calculado expuesto por la versión instalada. Si esa API interna
cambia, la prueba falla por falta de páginas, no sustituye el renderer ni fabrica resultados.
Los 51 casos y tres renders anteriores conservaron sus oráculos y nombres de salida; dos nuevos
PDF/manifiestos son sintéticos, separados de las descargas del portal.

Propuesta cerrada: **53 / 6 archivos / 5 renders**, filtro SDD-0473 B, reparto16/9/5/10/5/8,
480 s + 60 s de cierre, una corrida y cero reintentos/SKIP seleccionado con CJK explícita.
**NO EJECUTADO:** pruebas, render, tipos, lint, verify, build, UI, descargas y restarts sobre este
hijo. Sólo lectura/revisión estática, guard y Git selectivo local. No push, merge o producción.
El estado confirmado rev3/V1 sigue intacto; futura descarga sólo requiere actualizar frontend
propio y leer la revisión existente, sin importar, guardar, confirmar ni reiniciar backend.
Conocimiento/derivados NO EJECUTADOS; esta evidencia se conserva en el handoff de la tarea.
## Seguimiento local: hidratación del recibo confirmado · 2026-10-22

**OBJETIVO Y AUTORIZACIÓN:** opción B autorizada por el Director general, hijo directo de
004a52246771d474deec3ddefb7f7d4fb1d44517. Mismo Worker/worktree/rama/PR319. Claim canónico
primero, guard propio después. Antes de editar se copiaron y sellaron las cuatro rutas en
receipt-hydration-004a/four-source-preimages.json. La allowlist exacta se adoptó primero en SDD:
SharedSupplierDocument.tsx, su test, spec0473 y este handoff. Ningún README ni otra ruta.

**DIAGNÓSTICO POR FUENTE:** defecto preexistente en b25, sin cambios de esas rutas entre4ee y
004a: workspace no incluye folio/versión y adopt borra estados locales; sólo confirmar o consultar
etiquetas vuelve a llenar metadata. No hay pérdida DB demostrada ni causa del renderer. GET
labels ya devuelve metadata confirmada y códigos existentes, con CAS/compra/tenant/submission;
sólo SELECT y proyección de b.code, sin crear etiquetas físicas o escribir. No modificar contratos.

**EVIDENCIA Y LÍMITES:** B1 sobre004a pasó53/53, cinco renders, cierre oportuno; sigue pendiente
aceptación visual del PDF real actualizado. Se preserva layout FALLÓ4ee y etiquetas/QR PASÓ.
Nuevo B2 se detuvo ANTES de descargar: AX vio fallback confirmado Revisión3; PNG02 no encuadra
el target y no se usa como prueba visual de ese texto. Root post07:20:22 oportuno; aviso y
custodia TARDÍOS07:23:54.2261040Z; General exterior NO EJECUTADO. No rehabilitar su cierre.
Documento rev3/V1/folioDTD-PL-2026-0001, diez códigos y backend/frontend actuales se conservan.

**CONTRATO DE AUTORÍA:** recuperar sólo metadata estrecha de GET labels en revisión confirmada,
ligada a identidad/workspace/revisión vigentes. No fabricar recibos de confirmación ni abrir
etiquetas/print automáticamente. Cancelar respuestas obsoletas al editar, adoptar, cambiar compra
o desmontar;409 exige comparar y error temporal conserva datos con recuperación existente.
Mantener save/confirm/preview/descargas, los53oráculos y los cinco renders previos. Nuevas pruebas
observables son aditivas; no ejecutar en esta fase. Commit local selectivo y READY tras cierre.

**PROHIBICIONES:** sin producto runtime, parser/discovery/tests/tipos/lint/build/UI/API/restart,
nueva descarga, push/merge/producción o cambios de DB/códigos/confirmación. No otras sesiones.
**AUTORÍA CERRADA / SIN VALIDACIÓN FUNCIONAL:** metadata separada ReceiptMetadata, estrecha
revision/folio/versionNo, con scope del transporte y workspace/revisión. GET labels existente
hidrata sólo esa metadata, nunca DocumentReceipt inventado ni grilla/print. Guardas de identidad,
loaded/confirmado/dirty/conflict/edición y cancelación por generación/mounted/cleanup.409 pide
comparar y rechaza versión equivocada;503 conserva datos y ofrece Ver etiquetas para reintentar.
La cancelación evita aplicar respuestas; no aborta físicamente HTTP ya emitido.

**PRUEBAS ESCRITAS:** ocho instancias nuevas observables: reapertura confirmada, recarga real del
componente, respuesta de otra compra desmontada, respuesta fallida después de edición local,
adopción de revisión nueva con respuesta vieja pendiente,409, revisión incorrecta y503 con
recuperación manual existente. No hay aserciones/títulos previos debilitados. El doble GET labels
ahora responde la revisión pedida, manteniendo negativas explícitas en los oráculos; el helper
ready vacía efectos inmediatos para no asignar a una lectura automática un error reservado a la
siguiente acción. Nuevos61/6/5renders propuestos (16/9/5/18/5/8), todos NO EJECUTADOS sobre este
hijo. Los53PASÓ y cinco renders anteriores acreditan004a, no esta autoría nueva.

**FRONTERA Y PENDIENTES:** sólo cuatro rutas; renderer/PDF, DTO, servicio, HTTP, proxy, fuentes,
QR y códigos se conservan idénticos a004a. Documento confirmado rev3/V1 y procesos actuales no
se tocaron. Falta GO nuevo de pruebas, reapertura en UI y descarga/revisión de PDF real. Histórico
B2stop y sus cierres tardíos permanecen; ninguna corrección administrativa crea aceptación.
Commit selectivo local hijo004a, sin push. Actualización de conocimiento/derivados NO EJECUTADA.