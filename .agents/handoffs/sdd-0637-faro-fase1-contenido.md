# Handoff · SDD-0637 Faro · fase 1 (contenido)

- **Fecha:** 2026-11-16
- **Sesión:** Lumi (Worker). Director: Director General.
- **Rama:** `claude/0637-faro-fase1-contenido`, desde `origin/main` 462f8ca54.
- **Spec:** `docs/specs/0637-faro-asistente-ayuda/spec.md`, en la PR #600 (todavía no está en `main`).
- **Autorización:** Sam, 2026-11-16: «Ok, apruebo la PR. Avancemos en la fase 1, pero dile al director;
  confirma con él.» El Director General confirmó el arranque el mismo día.

## Qué se hizo

Solo archivos nuevos, bajo `lib/studio/asistente/contenido/`. No se tocó ningún archivo existente.

| Archivo | Contenido |
|---|---|
| `tipos.ts` | Formas del minicerebro: catálogo, guía, tarea, paso, procedencia, visibilidad y requisitos por tarea (`ver`/`editar` por módulo, capability) |
| `catalogo.ts` | Una entrada por cada uno de los 57 módulos de `MODULES`, con la visibilidad de la D-3 |
| `guias/index.ts` | Registro de guías y `guiaDe(modulo)` |
| `guias/*.ts` | 10 guías: collections, invoices, treasury, expenses, accounting, reports, clients, quotes, shipments, mis-bugs |
| `__tests__/catalogo.test.ts` | Contrato AC-1 y coherencia del contenido (15 pruebas) |

Las guías se redactaron leyendo el código de cada pantalla (componentes, acciones y tipos), no supuestos. Cada
una lista sus fuentes en `procedencia.fuentes`. Los textos entre «» son los que se ven en pantalla.

**Todas las guías están en `estado: "borrador"`.** La spec (§5) exige que una persona las apruebe. La fase 3 no
debe entregar al modelo una guía en borrador.

## Decisión D-3 (aprobada por Sam el 2026-11-16)

Texto de Sam ante la pregunta «¿Apruebas la propuesta de módulos reservados y ocultos (D-3)?»: «Sí, apruébala».
Falta reflejarlo en la tabla de decisiones de la spec, que vive en la PR #600.

- **Ocultas (4):** `renditions`, `financiero-china`, `legal`, `no-olvidar`. Son los de superadministrador.
- **Reservadas (6):** `direccion`, `users`, `admin`, `mailing`, `nomina`, `costing`.
- **Normales (47):** el resto, incluidos Facturación, Cobranzas, Tesorería, Contabilidad, Fiscal y Reportes.

Motivo de dejar el dinero de uso diario como normal: una pregunta por un módulo reservado alerta de inmediato
(§6.3). Si Cobranzas fuera reservada, cada vendedor que pregunte «¿cómo se cobra?» generaría una alerta, y Sam
pidió «solo lo serio». Sin acceso, esas preguntas igual se bloquean y quedan en el registro.

## Revisión independiente de Codex (2026-11-16)

Pedida por Sam. Codex leyó las 10 guías y el contrato, solo lectura, contra la cabeza b6ac6f673. Veredicto:
«con cambios» en las diez, ninguna para descartar, nada bloqueante en esta fase. El Worker comprobó en el
código siete de sus hallazgos antes de corregir (tasa CNY, asientos no garantizados, «Aprobar cuenta», motivo
al confirmar un pago reportado, reportes guardados por navegador, «Vincular a cliente», dos rutas de fuentes);
los siete eran ciertos.

Qué se corrigió, por orden de Sam («Sí, corrígelas»):

- **Contrato:** cada tarea declara `requiere` (módulo + `ver`/`editar`), y `capacidad` cuando la acción la usa.
  Las tareas que pasan por otra pantalla declaran ese módulo (por ejemplo, cambiar el estado de un embarque
  pide editar Tracking). La ruta de «crear embarque» ahora es `/studio/tracking/nuevo`.
- **Exactitud:** tasa solo en bolívares en pagos sin identificar; los asientos automáticos se describen como
  intento, con «Por contabilizar» como salida y la advertencia de no repetir el cobro o el pago; dos variantes
  del comprobante de Gastos; «Aprobar cuenta» en Clientes; motivo obligatorio y cuadro final al resolver un pago
  reportado; «Vincular a cliente» como sección; privacidad real de los reportes guardados; el «solo» del reporte
  de errores; límite de 5 MB; rutas de fuentes corregidas.
- **Tareas nuevas:** Cobranzas (exportar), Facturación (corregir borrador), Tesorería (editar proveedor, anular
  pago de una CxP saldada, ver remesas), Gastos (adjuntar después, aviso de contenedor), Contabilidad («Por
  contabilizar», cambio en período cerrado, registrar activo; conciliación con el paso «Abrir»), Reportes
  (reportes guardados), Estimados (compartir, eliminar), Embarques (eliminar, solo administración).
- **Prueba:** fija los conjuntos exactos de la D-3; usa `moduleIdForPath` para que una subruta de otro módulo
  no pase; exige que todas las fuentes y la página de cada módulo existan; revisa también el catálogo con la
  heurística de privacidad.

Lo que no se hizo, con su motivo:

- **Notas y errores condicionados por permiso:** el contrato todavía no permite ocultar una nota según el rol.
  Codex lo marca como limitación, no como filtración. Queda para la fase 3, si hace falta.
- **Procedencia por entrada del catálogo:** se dejó una sola procedencia para las 57 entradas
  (`PROCEDENCIA_CATALOGO`) y la prueba exige que exista la página de cada módulo. Una ficha por entrada se puede
  agregar si Sam lo pide.

## Validaciones

| Comprobación | Resultado |
|---|---|
| `vitest run lib/studio/asistente/contenido/__tests__/catalogo.test.ts` | PASÓ, 15 de 15 |
| La prueba falla cuando debe | PASÓ: tres errores sembrados a mano (requisito equivocado, fuente inexistente, Nómina como normal) dieron 3 fallos; luego se restauraron |
| `tsc` sobre `lib/studio/asistente` | PASÓ, sin errores |
| `eslint lib/studio/asistente` | PASÓ, sin avisos |
| `pnpm verify` | NO EJECUTADO. Va al cierre, con turno del Director |
| `tsc` del proyecto completo | NO EJECUTADO. Lo cubre `pnpm verify` |
| Revisión independiente | Codex: «con cambios» en las diez guías; correcciones aplicadas. Una segunda pasada sobre la cabeza nueva NO EJECUTADA |
| Revisión humana de las guías | PENDIENTE (Sam o quien él designe) |
| Pantallas abiertas en un navegador | NO EJECUTADO. Los textos salen del código, no de la pantalla renderizada |

## Pendientes de esta tarea

1. Abrir la PR de esta rama **después** de que la #600 entre a `main`, trayendo `main` antes (orden del Director).
2. Sam revisa y aprueba las 10 guías. La D-3 ya está aprobada.
3. Estantes que faltan del minicerebro: `procesos/` y `glosario.ts`.
4. Ninguna de las 10 pantallas tiene anclas `data-guia` (salvo `cliente.conversaciones`). «Muéstrame dónde»
   necesita agregarlas; eso toca archivos existentes y va en la fase 4, no aquí.
5. Dudas de contenido que conviene que confirme quien conoce la operación:
   - Facturación: el aviso de accesos adicionales dice que la persona «no podrá anular facturas», pero la acción
     de anular solo exige edición del módulo. La guía dice lo que hace el código.
   - Gastos: hay dos flujos de comprobante (el clásico y un piloto tras una variable de entorno). La guía
     describe el clásico; no se leyó ningún `.env`.
   - Tesorería: la guía aclara que la conciliación bancaria está en Contabilidad.

## FUERA DE ALCANCE DETECTADO

No se corrigió nada de esto; se anota para que el Director decida.

- **Mis reportes:** el botón «Abrir» de cada tarjeta enlaza a `/studio/mis-bugs/<id>` y esa ruta no tiene
  `page.tsx`. Los correos enlazan a `?focus=<id>`, que la página no lee. No se probó en ejecución.
- **Mis reportes:** el texto de la página habla de un «botón flotante» visible; el botón arranca oculto y se
  muestra con Alt+B.
- **Estimados:** al cambiar de estado fuera de orden, el error muestra los nombres internos en inglés
  (`"sent"`, `"draft"`).
- **Estimados:** el subtítulo dice que un estimado aceptado se convierte «automáticamente» en embarque; la
  conversión es manual, con un botón.
- **Reportes:** los comentarios de cabecera dicen que Combinados y Constructor están como «Pronto»; en el código
  están activos.
- **Tesorería:** el texto de accesos adicionales habla de «saldos de bancos y cajas», que la pantalla no muestra.
- **Operarios y No-Olvidar:** con el flag apagado solo se ocultan del menú; la ruta sigue abierta por URL.

## Impacto documental

Ninguno en `docs/` en esta rama. La spec vive en la PR #600.
