---
sdd: "0577"
title: "Reintento de borrado disponible y consultas de archivos del Portal"
status: in-progress
author: "Codex Worker 0577 para Sam"
created: 2026-10-21
updated: 2026-10-21
supersedes: null
superseded_by: null
related: ["0486", "0522", "0560", "0571", "0574", "0576"]
confidencialidad: interno
---

# SDD-0577 · Reintento de borrado y consultas de archivos del Portal

## Objetivo y reserva

Reparar exclusivamente dos contratos de prueba observados en la validación local C3:
esperar disponibilidad real del reintento de borrado y acotar consultas positivas
del caso de archivos/Excel del Portal a regiones existentes equivalentes.
No se modifica producto ni se considera demostrada la causa del timeout del Portal.

Reserva asignada por el Director después de inventario remoto/local de 497 refs y
worktrees. Base independiente: eafbd910d1c082c9b416b558f8c3db5847b994a6.
Reserva inicial publicada en 8e1d2765; GO pesado recibido tras devolución de 0574 a 09:15:44Z.
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

La adopción, claim/guard, stub/handoff, índice y reserva precedieron al GO pesado
expreso del Director. Instalación y pruebas se ejecutaron después de la devolución
del turno de 0574; conocimiento conserva su propio GO pendiente.

Con GO: dependencias propias con lockfile congelado y scripts de instalación
deshabilitados; original completo de 40 casos con 2 workers/retry 0 y JSON/log
nativos; candidato mínimo con el mismo comando; comprobación de nombres, firmas
y oráculos, diff-check, lint de ambos tests, docs:check y numeración.
Como máximo dos pares adicionales alternados solo si hacen falta para evaluar una
mejora temporal que se pretenda afirmar. Conservar resultados individuales.

La receta canónica normal corepack pnpm verify se ejecutó con GO3 sobre el receptor
C3 22bd5192825199aeafd0cf5e3625606ff77657b0, que incorpora c4b2e72d.
Su resultado y límites se registran abajo por ese SHA receptor. No se ejecutó otra
canónica sobre esta base histórica. El PR de tests continúa DRAFT; el exit 0
receptor no elimina sus omisiones ni acredita una canónica ejecutada en c4.

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

## Resultado local del candidato

- PASÓ: aislamiento/ownership/reserva; instalación congelada sin scripts; original 40/40 y candidato 40/40, ambos con 2 workers/retry 0; lint focal y numeración.
- PASÓ: mismos 40 nombres/firmas; 171 oráculos previos y 29 negativas conservados; 2 comprobaciones nuevas de disponibilidad, 38 cuerpos de casos intactos.
- PASÓ: Director aceptó c4b2e72dabbdde80ec7fe5c8a7f128966b6494be para PR DRAFT/composición revisada; revisión independiente sin hallazgo obligatorio. PR 315 OPEN/DRAFT, base main.
- LÍMITE: el par observado dio Files/Excel 2506.32 ms original y 2259.59 ms candidato; no demuestra mejora estable ni causa del timeout C3.
- PENDIENTE: ciclo nativo de conocimiento, integración y publicación compartida. La spec conserva in-progress; claim retenido hasta GO expreso de liberación.

## Evidencia de composición C3 · GO3

Receptor ejecutado: 22bd5192825199aeafd0cf5e3625606ff77657b0.
Comando normal corepack pnpm verify, 2026-10-21 09:58:37.0499811Z–10:36:15.3461774Z,
exit 0. Antes de documentos, el bytecheck de 10:36:15.5742581Z conserva 43/43 rutas,
hashes y bytes. Director aceptó los 16 pasos medidos y el resultado literal
CIERRE INCOMPLETO 16/17: migrations-applied OMITIDO por URL/SERVICE_ROLE ausentes.
No se consultó ni aplicó DB real para completar el ledger. No es verde completo
ni autorización de release.

El primer intento unitario se conserva FALLÓ/parcial: 12823 PASÓ, 1 SKIP y
2 errores de pool tras ZoneOOM; 886 archivos PASÓ/1 SKIP de 889, 519.63 s.
El reintento nativo único dio 12935 PASÓ/1 SKIP de 12936; 888 archivos PASÓ/1 SKIP
de 889, 647.26 s. No se suman intentos. El nombre del SKIP es NO DISPONIBLE en el
reporte nativo: el corpus real de proformas de corpus.test.ts:31 es correspondencia
estática/inferencia, no identidad nominal medida. No se leyó ese corpus.

Build normal PASÓ, con tsconfig restaurado por el runner. Harness 237/237, lint
0 errores/15 avisos, RSC/tipos/cuatro Edge, checks documentales y gobernanza PASÓ.
SQL efímero: 249 contratos con rollback; reconstrucción de 492 migraciones
(474 DDL + 18 solo-ledger) y aislamiento sintético de 219 tablas/2 tenants.
Estos resultados pertenecen al receptor; no son prueba de datos o aislamiento productivos.

E2E original: 198 casos únicos, 177 expected/20 skipped/1 flaky/0 unexpected.
El flaky Chromium de company-photo-carousel.spec.ts:93 fue expected 2 vídeos/received 1
en la línea 103; failed 20335 ms y retry 1 passed 20753 ms. Se conserva el error global
worker-17 force-killed tras 300000 ms. La atribución WebKit/Windows del runner es
su interpretación, sin causalidad independiente. Las omisiones y avisos se detallan
en el handoff; no prueban sesiones, RLS, filas reales ni dispositivo físico.

Se conservan las dos recetas C3 históricas FALLÓ sobre a732bcb0 y d1a7cca2,
incluidos sus reintentos, omisiones y avisos. GO3 no demuestra causa del timeout
Portal ni estabilidad temporal del parche. Fuentes finales y hashes nativos:
C:/tmp/director-traspaso-20261020/caracas-c3-revision-director-go3-terminada.md,
SHA-256 e46a0136ac34387f18ad5ddcb09238f167d305717658dac96dbe74901b697334;
seis artefactos sellados de 0576-c3-next/canonical-3, cotejados por bytes/hash en
el cierre documental ligero. Los 13 originales propios y recibo 2824 permanecen intactos.
