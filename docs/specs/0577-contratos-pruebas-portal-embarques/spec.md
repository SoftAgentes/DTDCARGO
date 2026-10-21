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

## Subfase diagnóstica GO05B · GO0 histórico y cierre GO05

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

**GO0 permitió modificar únicamente los tres documentos.** Los dos tests y todo
producto/configuración/runner/package/lock conservan los bytes de la base ce7.
La prueba de Embarques y el handoff histórico no pertenecen a esta subfase.

### Contrato aprobado en GO0, conservado como antecedente

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

Al cerrar GO0, basal, instrumental, reparación, validación de producto y canónica
estaban **NO EJECUTADAS**. El checkpoint documental D0 quedó fijado en
`0b8e70faeb92f2f42a031faf3306e2ac7e9aa202`. La evidencia propia GO0 y su manifiesto
se conservan bajo
`C:/tmp/director-traspaso-20261020/0577-go05b-diagnostico-validation/`.

### Cierre del diagnóstico: GO04 funcional y GO05 documental

El Director autorizó una única basal completa mediante
`0577-basal-go04-director.md`, SHA-256
`ca1233d02c797463659947ee947f91fc6eff30357e97a6a3ea67c4c959f1b307`.
La ejecución sobre D0 terminó con **30 PASÓ, 0 fallos, 0 omitidos y 0 reintentos**:
standard-format 7 y supplier-flow 23, dos workers y los límites originales.
El cotejo ordinal de archivo, título y nombre completo confirmó las 30 identidades
únicas previstas. Resultado: **NO REPRODUCIDO / CAUSA PORTAL NO DETERMINADA**.
No se implementó un arreglo ni se acreditó estabilidad o una causa de carga.

La secuencia previa queda conservada y no se cuenta como ejecución de esos casos:

| Etapa | Resultado y límite |
| --- | --- |
| BASAL01 | FALLÓ preparación antes de Vitest; cero casos. No hubo captura heredada completa del error y no se reconstruyó. |
| Primer lanzamiento preflight-only | FALLÓ la invocación exterior antes del launcher por conversión de fecha; cero casos. |
| GO02 preflight-only | EXIT1 del prefijo por error de ruta y EXIT2 del launcher; UNKNOWN histórico de identidad, diferencia de 5 ticks y observación independiente a 63,056 s, 3,056 s sobre el plazo de cierre. El archivo no se trató como perdido ni se restauró o excluyó. |
| GO03 sonda de una ruta | Colección con EXIT0; launcher EXIT2 por identidad no confirmada, diferencia de 8 ticks. La ruta literal, UTF-8 crudo y nombre físico coincidieron en 67 unidades; el pipeline produjo 70 bajo el contexto observado IBM850. Sin lectura del contenido HTML ni conclusión retrospectiva sobre los fallos JavaScript. |
| GO04 basal completa | Git raw UTF-8 estricto/NUL y preflight PASÓ; Vitest EXIT0 y 30/30. Driver y launcher EXIT2 por supervisión incompleta, descrita abajo. |

La lectura UTF-8/NUL permitió superar la preparación y arrancar la basal; **no
explica los fallos funcionales de GO05B**. El nuevo mecanismo conservó literalmente
el bloque Node/Vitest, los dos archivos, sus aserciones, datos, topes y ausencia de
reintentos. Registró y revalidó nacimientos con la misma API .NET UTC exacta; CIM
se conservó como evidencia de filiación separada, sin tolerancia o redondeo.

El driver registró `DESCENDANT_IDENTITY_UNKNOWN` y mantuvo `knownAlive: null`.
No guardó PID, nacimiento o instante del candidato no validado; no se reconstruyen
ni se atribuyen a un proceso conocido. El launcher tuvo una observación propia sin
errores y propagó EXIT2 del driver. Las ocho identidades conocidas se comprobaron
ausentes a 15,959 s del EXIT nativo; eso no resuelve el hueco histórico ni es un
censo universal. La supervisión sigue **INCOMPLETA / UNKNOWN**, separada de las
treinta pruebas aprobadas.

Actividad total: 71,408 s desde el primer preflight, dentro de 600 s; Node duró
62,480 s y Vitest informó 58,80 s internos. El driver observó recursos antes de
hashing y cerró en 5,430 s. No hubo terminaciones ni pérdida de captura. El Director
aceptó limitadamente la evidencia y devolvió el turno pesado, conservando UNKNOWN.

Integridad: 6.358 nombres Git exactos, cero faltantes/extra/errores de decodificación;
6.478 registros antes/después con cero diferencias, incluidos los 6.466 aprobados
y ocho controles de preparación. Son registros con posibles alias de separador,
no 6.478 archivos físicos únicos. Ambos tests, producto, configuración, runners,
package y lock mantuvieron los bytes de D0/ce7. Los originales de todos los intentos
quedan conservados. El UNBOUND contiene dos propiedades `limits` históricas
idénticas; el bound cambió sólo cinco campos efectivos autorizados y su `limits[0]`
final vincula GO04. El array de 6.466 registros y los ocho controles no cambiaron.

Evidencia externa, bajo el directorio de diagnóstico indicado arriba:

- `basal-native-02/native-vitest.json` y streams nativos; `basal-launch-02/`
  conserva los streams PowerShell, identidades y EXIT propios.
- `basal-go04-closure-01/case-identity-comparison.json`, SHA-256
  `5348ba9f0bdbfe16f57a20c56e1a3b71ff082fab5ffe3963c87883868e19d7c9`.
  Firma de archivo + NUL + nombre completo, unidos por LF sin LF final:
  `2627f7b421ac2ed25d70f15c029041201a4890a57a5efb10082c05b350ecb93a`.
- `basal-go04-final.json`, SHA-256
  `b5442d7d0eefb6fef8afb8b7bd71266abef020e49d73e91097503f58a78fa76e`;
  `basal-go04-closure-01/RESUMEN.md`, SHA-256
  `628c55785521c2b947052ab6383324a22d2afaafe62981fb592fd3aa8ffaf74c`.
- Cotejo del Director `0577-go04-cierre-cotejo-director.json`, en el directorio
  padre, SHA-256 `159dad7797739f9e8d8fd59a145698267021754f5f8c8995f40b959c93b49c55`.

GO05 autoriza únicamente esta spec y el handoff diagnóstico; el índice generado y
las demás rutas de la allowlist acumulada no reciben cambios. Autoridad externa
`0577-go05-cierre-documental-director.md`, SHA-256
`210e7db0dd056fbd2021212a57281b5f7e4f85b2a36ea23ce800335a291ae9b0`.
La PR diagnóstica será DRAFT contra `codex/sdd-0569-bcv-carga-diaria`, cuya cabeza
revalidada es `b179363d320aff9ada7b79d1f607b07d9b084a63`: tres documentos posteriores
a ce7, sin nuevo producto. El diff propio de la PR desde el merge-base ce7 debe
contener sólo los dos documentos. No se afirma haber probado esa cabeza posterior
de la base, no se mueve PR #315 y no se integra nada en BCV o main.

Esta fase termina la investigación acotada disponible: **no hay nueva basal,
prefijo, parser, instrumentación, fix, retry, canónica, UI, HTTP o DB**. Otra corrida
necesitaría un objetivo o causa nuevo y decisión específica. La canónica BCV
permanece FALLÓ/INCOMPLETA, 16/17; los resultados de esta basal no la convierten en
verde. La validación futura debe corresponder a la composición CORE propagada, no
a una repetición de la misma fuente para buscar un resultado distinto.

El conocimiento verificado se guarda en spec/handoff y se respalda mediante la
rama/PR propia; integración sigue pendiente. Estructura Graphify, semántica,
Archify, preview local, publicación Obsidian y revisión visible finales son **NO
EJECUTADAS en GO05**, sin transferir vigencia desde la consulta GO0. Se propone un
turno futuro acotado al Director, sin generar ni publicar derivados aquí. La SDD
continúa `in-progress`: este cierre no completa las aceptaciones históricas de
composición o conocimiento de la entrega original.
