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

## HANDOFF AL DIRECTOR

Implementación local funcional y auditada, PR borrador y gate final documentados. Mantener
4320/4321 y worktree: listeners loopback comprobados al cerrar; revisión 4 confirmada preservada.
No integrar ni activar producción desde Worker. Owner libera claim después del commit documental
y push final. Director revisa SHA final, inestabilidad/omisiones y conocimiento antes de release.
