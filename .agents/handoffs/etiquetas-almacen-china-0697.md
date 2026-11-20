# Handoff — SDD-0697 Etiquetas de color en Almacén China (spec)

Fecha: 2026-11-20 · Rama: `claude/nifty-goldwasser-a7d348` · Base: `origin/main` `6a7787d08` + reserva `7894845e5`.

## Hecho

- Spec en borrador: `docs/specs/0697-etiquetas-color-almacen-china/spec.md`. Medida solo en código y
  migraciones; no se leyó ninguna fila de producción.
- Modelo: un color por fila (estado) y varios avisos por fila (catálogo por tenant, en tres grupos). Así se
  responde la «doble situación» que planteó Sam con la hoja del contenedor.
- Índice regenerado (`docs/specs/README.md`).

## Evidencia

- `node scripts/build-docs-index.mjs --check`: PASÓ (670 specs).
- `node scripts/check-numbering.mjs`: PASÓ (solo los choques históricos conocidos).
- `pnpm verify`: NO EJECUTADO. El cambio es solo de docs; las pruebas de producto no aplican.

## Pendiente de esta tarea

- Respuestas de Sam a las preguntas 0-9 del §7, una por una. La primera es la 0: qué significa cada color de
  la hoja hoy y qué es 封门.
- Pasar la spec por `revisar-datos-ve` (nota libre) antes de implementarla.
- Que un hablante nativo revise los textos zh-CN.
- Revisión independiente y aprobación de Sam. Después de eso, el número de migración lo da el DG.

## FUERA DE ALCANCE DETECTADO

- `listEventsForReceipt` (`lib/studio/warehouse-cn-queries.ts:252`) no se usa: Almacén China escribe el
  historial de la recepción, pero no lo muestra. La spec lo incluye en su fase 1.
- Choque de nombre con el módulo «Etiquetas CN» (`/studio/etiquetas`, impresión de QR).

## Segunda vuelta (revisión independiente sobre `fc390fd77`, CHANGES_REQUESTED)

Corregido en la spec:
- Allowlist provisional por fase (§6.2) y fases F0-F3 con su orden frente a la 0682 fase 2 (§6.1).
- Propuesta de migración en dos partes (§2.7): enum y tablas, índices, grants y RLS de miembro activo, sin política para el portal; escritura solo por RPC con candado de rol.
- `visible_ve` declarado como límite conocido, con la salida para cerrarlo en la base (§2.5).
- Venezuela: por `source_receipt_cn_id` (0067:83); recepción VE sin origen y embarque partido (§2.5).
- Clasificación de gobernanza, módulo y capabilities (§6.3).
- Pruebas SQL concretas (§8.1).
- Citas corregidas (0240:42; zh-CN, 386 líneas), escritores y lector del historial (§1.2).
- Sin códigos de la hoja de Sam; el ejemplo de recepción es inventado.

Checks: build-docs-index --check PASÓ; check-numbering PASÓ; verify NO EJECUTADO (solo docs).

## Tercera vuelta (revisión sobre `f7a8bc31c`, ajustes A-F)

- A: la prueba va en `supabase/tests/etiquetas_almacen.test.sql`.
- B: reglas de las RPC: actor `auth.uid()`, rol y región leídos en la base, todo calificado con `public.`/`pg_catalog.` y `search_path` vacío.
- C: auditoría por `append_audit_event` con el precheck de la 0563; revoke también a `service_role`.
- D: trigger para que `tag_added`/`tag_removed` salgan solo de las RPC; corregido lo de «sin rastro» y AUD-01.
- E: pruebas 12-17 (anon, service_role, quitar una ajena o ya quitada, historial solo por RPC, actor, auditoría).
- F: costo detallado de cerrar `visible_ve` en la base (§2.5).

## Respuestas de Sam (2026-11-20)

- Pregunta 0: los colores de la hoja son indicadores, no estados. La leyenda «Indicadores de carga» va en el §2.0 de la spec.
- Pregunta 1: el nombre es «Indicadores de carga», como lo llama el equipo técnico.
- Los indicadores generan cobros, costos o tareas (tax refund, montacargas, batería de litio). La spec agrega el campo «efecto»; el monto va en otra SDD.
- Mensaje de Sam al Director: el contenedor 65 entra primero por Almacén China. Lo deja pendiente para analizar y no es de esta tarea.
