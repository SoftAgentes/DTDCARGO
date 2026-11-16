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
| `tipos.ts` | Formas del minicerebro: catálogo, guía, tarea, paso, procedencia, visibilidad |
| `catalogo.ts` | Una entrada por cada uno de los 57 módulos de `MODULES`, con la propuesta de la D-3 |
| `guias/index.ts` | Registro de guías y `guiaDe(modulo)` |
| `guias/*.ts` | 10 guías: collections, invoices, treasury, expenses, accounting, reports, clients, quotes, shipments, mis-bugs |
| `__tests__/catalogo.test.ts` | Contrato AC-1 y coherencia del contenido (12 pruebas) |

Las guías se redactaron leyendo el código de cada pantalla (componentes, acciones y tipos), no supuestos. Cada
una lista sus fuentes en `procedencia.fuentes`. Los textos entre «» son los que se ven en pantalla.

**Todas las guías están en `estado: "borrador"`.** La spec (§5) exige que una persona las apruebe. La fase 3 no
debe entregar al modelo una guía en borrador.

## Propuesta de la decisión D-3 (la aprueba Sam)

- **Ocultas (4):** `renditions`, `financiero-china`, `legal`, `no-olvidar`. Son los de superadministrador.
- **Reservadas (6):** `direccion`, `users`, `admin`, `mailing`, `nomina`, `costing`.
- **Normales (47):** el resto, incluidos Facturación, Cobranzas, Tesorería, Contabilidad, Fiscal y Reportes.

Motivo de dejar el dinero de uso diario como normal: una pregunta por un módulo reservado alerta de inmediato
(§6.3). Si Cobranzas fuera reservada, cada vendedor que pregunte «¿cómo se cobra?» generaría una alerta, y Sam
pidió «solo lo serio». Sin acceso, esas preguntas igual se bloquean y quedan en el registro.

## Validaciones

| Comprobación | Resultado |
|---|---|
| `vitest run lib/studio/asistente/contenido/__tests__/catalogo.test.ts` | PASÓ, 12 de 12 |
| `eslint lib/studio/asistente` | PASÓ, sin avisos |
| `pnpm verify` | NO EJECUTADO. Va al cierre, con turno del Director |
| `tsc` del proyecto completo | NO EJECUTADO. Lo cubre `pnpm verify` |
| Revisión humana de las guías | PENDIENTE (Sam o quien él designe) |
| Pantallas abiertas en un navegador | NO EJECUTADO. Los textos salen del código, no de la pantalla renderizada |

## Pendientes de esta tarea

1. Abrir la PR de esta rama **después** de que la #600 entre a `main`, trayendo `main` antes (orden del Director).
2. Sam revisa y aprueba las 10 guías y la propuesta D-3.
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
