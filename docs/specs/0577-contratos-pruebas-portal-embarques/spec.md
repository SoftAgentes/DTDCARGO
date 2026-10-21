---
sdd: "0577"
title: "Contratos de prueba del Portal y reintento de borrado de embarques"
status: in-progress
author: "Codex Worker 0577 para Sam"
created: 2026-10-21
updated: 2026-10-21
supersedes: null
superseded_by: null
related: ["0486", "0522", "0560", "0571", "0574", "0576"]
confidencialidad: interno
---

# SDD-0577 · Contratos de prueba heredados

Los apartados desde «Objetivo y reserva» hasta «Resultado local del candidato»
conservan el alcance y la evidencia de la entrega original de 40 casos / PR #315.
La subfase diagnóstica GO05B al final de este documento tiene otro aislamiento,
base y aceptación. Sus resultados no se transfieren entre ambas variantes.

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

## Resultado local del candidato

- PASÓ: aislamiento/ownership/reserva; instalación congelada sin scripts; original 40/40 y candidato 40/40, ambos con 2 workers/retry 0; lint focal y numeración.
- PASÓ: mismos 40 nombres/firmas; 171 oráculos previos y 29 negativas conservados; 2 comprobaciones nuevas de disponibilidad, 38 cuerpos de casos intactos.
- PENDIENTE: revisión del checkpoint/PR DRAFT y ciclo de conocimiento con turno. El par observado dio Files/Excel 2506.32 ms original y 2259.59 ms candidato; no demuestra mejora estable ni causa del timeout C3.
- PENDIENTE DE COMPOSICIÓN: canónica C3 con nuevo GO y evidencia por SHA.

## Subfase diagnóstica GO05B · preparación GO0

Asignación del Director del 21 de octubre de 2026:
`0577-diagnostico-go05b-asignacion-director.md`, SHA-256
`0db52256874df8bd31ef9ed0bc1bf2d0567f0b3a620ccb780a9ce91b8600035a`.
El original se conserva fuera de Git en `C:/tmp/director-traspaso-20261020/`.
Esta subfase investiga los fallos O1–O4 de la receta BCV GO05B; **la causa sigue
NO DETERMINADA**. No activa una reparación temprana de PR #315 ni cambia producto.

- Base fija: `ce7e628e46d8e4e59176c9a84171d44b46261d4d`.
- Rama propia: `codex/sdd-0577-diagnostico-portal-go05b`.
- Worktree propio: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0577-diagnostico-portal-go05b`.
- Owner: `worker-0577diag-01a15a4e-ddf0-7d82-8656-d9dc56b58468`.
- Handoff: [.agents/handoffs/0577-diagnostico-portal-go05b.md](../../../.agents/handoffs/0577-diagnostico-portal-go05b.md).
- Si se publica una PR diagnóstica, será DRAFT contra
  `codex/sdd-0569-bcv-carga-diaria`; no contra main. No merge ni producción.

Allowlist acumulada de la subfase, independiente de la lista histórica:

1. `app/p/[token]/standard-format.test.tsx`.
2. `app/p/[token]/supplier-flow.test.tsx`.
3. `docs/specs/0577-contratos-pruebas-portal-embarques/spec.md`.
4. `docs/specs/README.md`, solo mediante su generador.
5. `.agents/handoffs/0577-diagnostico-portal-go05b.md`.

**GO0 permite modificar únicamente los tres documentos.** Los dos tests y todo
producto/configuración/runner/package/lock conservan los bytes de la base ce7.
La prueba de Embarques y el handoff histórico no pertenecen a esta subfase.

### Contrato de las futuras pasadas, todavía NO EJECUTADAS

Una basal nativa, con autorización posterior y namespace nuevo: los dos archivos
en orden standard-format / supplier-flow, 2 workers, retry 0, JSON y ambos streams
originales. Son **30 casos: 7 + 23**, sin filtros ni omisiones. Los límites de test
y hook siguen en 20000 ms y cada espera conserva su límite existente. No se
ejecuta una receta canónica ni se cambia ningún runner para este diagnóstico.

Firmas SHA-256 de títulos, UTF-8/LF final:

- standard-format: `02fb4ee0f794923d612e47811d645ac3b7bffcbdecf243af43bf5b97068841c1`.
- supplier-flow: `a302d42af39bbc139f826442502812806fec36f65023f305c2930de01ff84eb5`.
- Vector `ruta TAB título LF` en el orden anterior:
  `01be1fd9dc6555cc0f6e83eb9be6fda8c23d44209dbccec5ace0c887ce0de016`.

Las firmas no sustituyen los oráculos: restauración de Empresa real, validación
400 con foco y datos conservados, dos POST append-only, File/FormData reales,
importe sintético 132, negativas globales y cardinalidad permanecen intactos.

Límite de actividad por pasada: 10 minutos desde antes del preflight, sin renovar
el reloj; guarda inmediata antes de spawn. El mecanismo no implementa watchdog
automático. El Worker observa el plazo y solo puede interrumpir identidades
propias vigentes con creación y filiación verificadas. El cierre de recursos se
registra aparte; si continúa pendiente 60 segundos después, informa y retiene
el turno. No declara cero procesos por el solo EXIT del lanzador.

Si la basal pasa, el resultado será «NO REPRODUCIDO en el focal / CAUSA NO
DETERMINADA», sin segunda pasada, fix ni repetición. Si falla preparación,
captura, otro caso o queda parcial, conserva el intento y devuelve decisión.
Solo una basal completa que reproduzca O1–O4 habilita proponer instrumentación;
el diff y su única pasada instrumental requieren aprobación nueva del Director.
La instrumentación futura solo puede observar mediante call-through en los dos
tests, sin nuevos await/sleep/then/finally/timers/consultas DOM. No altera promesas,
errores, datos, topes ni aserciones, y se restituye byte por byte al terminar.

### Evidencia propia de GO0 y límites

PASÓ: creación aislada desde ce7, guard/claim, instalación propia con lockfile
congelado y scripts de instalación deshabilitados; package y lock intactos.
Versiones medidas: Node 24.20.0, Corepack 0.35.0, pnpm 12.14.0 y Vitest 4.1.7.
Los dos flags de Corepack se fijaron solo en el entorno del hijo; el padre no
se modificó. El store propio queda dentro de `node_modules/.pnpm-store-0577diag`.

La consulta local de conocimiento terminó con exit 0; su JSON dice `ok: false`,
estructura `INVALID`, semántica `INVALID`, Archify `PENDING` y Obsidian `PENDING`.
No hubo extracción, AST, cluster, mapa, preview ni publicación. El exit de la
consulta no significa que esas capas estén vigentes. El impacto documental se
guarda en esta spec y el handoff propio; integración y conocimiento quedan separados.

Basal, instrumental, reparación, validación de producto y canónica: **NO
EJECUTADAS**. El estado de esta SDD se mantiene `in-progress`. La evidencia propia
GO0 y el manifiesto del checkpoint documental D0 se conservan bajo
`C:/tmp/director-traspaso-20261020/0577-go05b-diagnostico-validation/`.
