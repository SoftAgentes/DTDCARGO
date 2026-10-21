---
sdd: "0577"
title: "Contratos de prueba del Portal y reintento de borrado de embarques"
status: draft
author: "Codex Worker 0577 para Sam"
created: 2026-10-21
updated: 2026-10-21
supersedes: null
superseded_by: null
related: ["0486", "0522", "0560", "0571", "0574", "0576"]
confidencialidad: interno
---

# SDD-0577 · Contratos de prueba heredados

## Objetivo y reserva

Reparar exclusivamente dos contratos de prueba observados en la validación local C3:
esperar disponibilidad real del reintento de borrado y acotar consultas positivas
del caso de archivos/Excel del Portal a regiones existentes equivalentes.
No se modifica producto ni se considera demostrada la causa del timeout del Portal.

Reserva asignada por el Director después de inventario remoto/local de 497 refs y
worktrees. Base independiente: eafbd910d1c082c9b416b558f8c3db5847b994a6.
Estado inicial: stub documental; tests sin editar y ejecución pendiente de GO.
No hay SQL para esta tarea.

## Identidad y alcance autorizado

- Rama: codex/sdd-0577-contratos-pruebas-portal-embarques.
- Owner: worker-0577-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
- Handoff: .agents/handoffs/0577-contratos-pruebas-portal-embarques.md.
- Entrega autorizada: commits/push de rama propia y PR DRAFT con base main.
- Main, merge de PR, deploy, VPS, DB real, PII, secretos y cuentas quedan fuera.

Allowlist exacta:

1. app/p/[token]/supplier-flow.test.tsx
2. app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.borrado.test.tsx
3. docs/specs/0577-contratos-pruebas-portal-embarques/spec.md
4. docs/specs/README.md, solo índice generado por el script existente.
5. .agents/handoffs/0577-contratos-pruebas-portal-embarques.md

Sin cambios de producto, helpers externos, package/lock, configuración, runners,
gates, topes, skips ni nuevas dependencias. No se debilita ninguna aserción de negocio.

## Evidencia y límite de atribución

Los tests conservan el mismo blob en la base, main conocido d410ab2, C2 0e630ed,
C3 d1a7cca, 0571 ba43747 y checkpoint 0574 639c895:

- Portal: ed3ff02b3aee71934f99d447f2bddca85d29ec49.
- Embarques: 72f9509e18ec0fbaeb3a639d41a2e53507d38f7b.

ProviderShareClient, EmbarquesClient, ConfirmDialog, useDialogA11y y
descendientes/tooling inspeccionados coinciden entre base/main/C2. La reparación
puede entregarse independientemente de producto de C2.

C3 registra el caso de archivos/Excel agotando 20000 ms (20839 y 20377 ms).
Eso no localiza la consulta lenta ni demuestra causa o mejora.
El reintento de Embarques falla al buscar «Eliminar embarques» tras aparecer el
error; el DOM impreso todavía contiene submit disabled «Procesando…».
EmbarquesClient usa useTransition y transmite error y pending por separado.

La preparación externa y sus hashes se conservan en el handoff. SDD-0486 es
evidencia histórica; su diagnóstico CSS/nombres accesibles no se traslada
automáticamente al caso actual.

## Contratos conservados y aceptación

1. Mismos 40 casos ejecutables, nombres, orden y datos: Portal 23 + Embarques 17.
   Firmas SHA-256 de títulos de it en orden, UTF-8, LF y LF final:
   Portal a302d42af39bbc139f826442502812806fec36f65023f305c2930de01ff84eb5;
   Embarques 66a9d5dded14c60a21d4570ebe0a073c322e41381702bdc12b99dd3aa4375f39.
   Comprobar también descubrimiento real de Vitest.
2. Embarques conserva alert, identidad del diálogo, motivo/IDs exactos, ausencia de
   falso éxito y segunda llamada real. Antes del segundo click espera el botón del
   mismo diálogo visible y habilitado con límites existentes. Sin acciones dentro
   de waitFor, sleeps, temporizadores artificiales ni modificación del mock de negocio.
3. Portal cambia solamente el caso compacto de archivos/Excel y consultas positivas
   con región real equivalente. Conserva cardinalidad global del título único y
   todas las negativas globales, incluido archivo no visible y chooser ausente.
4. Conserva File real, identidad del chooser al volver de pasos/Excel, ningún
   request previo a subir, FormData.getAll("files") igual a [file], recepción
   independiente y resumen final localizado zh/en/es. Sin hidden:true,
   defaultHidden, nuevos test IDs ni modificación del helper global de otros casos.
5. Conserva todos los demás oráculos de ambas pruebas y sus topes.
   testTimeout/hookTimeout siguen 20000 ms; no cambia límite local de espera.
6. Original sin instrumentar antes del candidato; mismo comando, runtime/config y
   condiciones. Si pasa, registrar PASÓ sin fabricar ROJO. Perfil instrumental
   separado; no certificar causalidad o estabilidad que los datos no sostienen.

## Secuencia y validación

El turno pesado pertenece a 0574 hasta GO expreso del Director. Inicialmente solo
adopción, claim/guard, stub/handoff, índice y reserva de rama.
Instalación, tests y knowledge esperan turno.

Con GO: dependencias propias con lockfile congelado y scripts de instalación
deshabilitados; original completo de 40 casos con 2 workers/retry 0 y JSON/log
nativos; candidato mínimo con el mismo comando; comprobación de nombres, firmas
y oráculos, diff-check, lint de ambos tests, docs:check y numeración.
Como máximo dos pares adicionales alternados solo si hacen falta para evaluar una
mejora temporal que se pretenda afirmar. Conservar resultados individuales.

La receta canónica normal corepack pnpm verify se ejecutará sobre la composición
C3 receptora con un GO nuevo, incluyendo build y todos sus gates/omisiones
declarados. No se ejecuta otra canónica sobre esta base histórica para repetir
producto sin cambios. El PR de tests queda DRAFT con aceptación de composición
pendiente; no se declara verde ni cerrado ese gate antes de ocurrir.

## Gobernanza e impacto documental

Clasificación: no aplica a cambios de comportamiento/experiencia de producto,
UI nueva, migraciones o captura/movimiento/borrado de datos reales: la unidad solo
repara tests existentes y documentación, preservando sus contratos.
No se inventa revisión visual de una pantalla sin cambios.

Cumplimiento de proceso: aislamiento, ownership, allowlist, SDD, commits selectivos
y PR. Conocimiento inicial pendiente por turno; Graphify/Archify/preview solo en
ciclo final acotado, sin publicación compartida desde esta rama.
La spec no pasa a done hasta satisfacer sus criterios; integración/producción se
registran por separado.

## Resultado inicial

- PASÓ: raíz/rama/base limpias, guard y claim, preimágenes de los tests, índice generado y docs:check.
- NO EJECUTADO: instalación, original/candidato, lint, numeración y ciclo de conocimiento.
- PENDIENTE: GO pesado del Director; implementación y validación proporcional.
- PENDIENTE DE COMPOSICIÓN: canónica C3 con nuevo GO y evidencia por SHA.