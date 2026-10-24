# SDD-0573 - slice ADMIN static DTO ficticio

Autoridad: DIRECTOR-ADMIN-STATIC-SLICE1-LOCAL-AUTHORING-20261024 y aclaracion
DIRECTOR-ADMIN-SLICE1-EXISTING-OWNER-CHANNEL-CLARIFICATION-20261024, recibidas
integramente del Parent en el unico followup a este mismo Owner.
Perfil normativo: ADMIN_STATIC_DTO_PROFILE_1, literal completo fijado por Parent
antes de asignar, derivado por Parent de V1/R1/R2/apendice. No se adopta SQL/COLD.
Adopcion del Owner: 2026-10-24T07:55:09.858Z, antes de crear fuente/fixture/test.
Owner: worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
Sesion: 01a1601e-d9fd-7280-8977-6b5d4719a99b.
WT managed real: C:/Users/AKX generator/.codex/worktrees/sdd-0573-admin-static-dto-20261024/DTDCARGO.
Rama: codex/sdd-0573-admin-static-dto-20261024.
Base: f60db1d619ee8f594bbb02d2db7df7a8e76f8ff5, tree054c5d90797ac6379249ebc0007f4dd50068029a.
Nuevo claim adquirido CreateNew segun los tres campos del procedimiento harness,
sin ejecutar Node harness: Git metadata DTDCARGO/harness-session-claim.json,
201 bytes/SHA256 2ba83962518386b5c6533967fafbe6ff644c5e95aaa7e6ced5e44da621b4797a.
El claim B4 y WT anterior quedan congelados, sin transferencia o release.

## Perfil y formato fijados ANTES de construir los casos

El modulo implementa exclusivamente tres exports puros del perfil:
validateFixtureDtos, validateFixtureReferences, validateFixtureClosureOrder.
Entrada exacta: marker, caseRole, units. Cada unit contiene exactamente
id,dtoType,unitKind,role,versionId,order,pin,value. El marcador obligatorio es
FICTITIOUS_ADMIN_DTO_FIXTURE_1. Identificadores libres son FICT_; schema y enums
conservan sus constantes contractuales. Pin sintetico no mide archivos reales.
VersionRef identifica version/rol/tipo natural y metadata; forma igual no cambia
la clase del destino. Tipos/campos/enums cerrados estan completos en fuente.
Null nominal no busca una fuente ni acredita evidencia real.
Salida exacta: structuralState, evidenceState, scope, issues; cada issue es
code/role/field. INCOMPLETE_EVIDENCE puede coexistir con structuralState VALID:
estructura admitida y evidencia FICTICIA no acreditada son dimensiones distintas.

Formato cerrado del archivo de fixtures: schema,profile,baseline,cases.
schema=FICTITIOUS_ADMIN_DTO_CASES_1; profile=ADMIN_STATIC_DTO_PROFILE_1.
baseline es un envelope efectivo completo. Cada caso tiene caseRole,changes,expected,
o caseRole,input,expected para un envelope malformado explicito. Cada cambio es
{op:'set',path:[propiedades/indices JSON],value:valorCompleto} o
{op:'delete',path:[propiedades/indices JSON]}. No funciones, resolucion de recursos
o archivos adicionales. expected fija tres resultados y codes por etapa antes
de llamar al modulo. El runner materializa TODOS los effectiveCases completos
antes de la PRIMERA llamada y congela los inputs. No se descarta ningun caso.
El fixture de archivo es la definicion completa; los efectivos se conservan en
memoria durante la suite, sin archivo de outputs adicional.

Todos los datos, sesiones, observaciones, fechas y canales son FICTICIOS. Los
sentinelas LOCAL_DATA no representan contratos/canales/decisiones reales.
La suite cubrira los ocho grupos autorizados y malformed/missingmarker.
Node exacto existente, metadata de archivo24.19.0, sin --version adicional.
Una sola ejecucion --test autorizada; no correccion y rerun para verde.
Plan de presentacion: cuatro unidades naturales ENTERAS en sus cuatro rutas,
fuente por lectura integra o tramos contiguos identificados si fuera necesario;
fixture JSON completo con baseline/cambios/expected, test y handoff completos.
No minify, fuente truncada presentada como FULL o quinto archivo.

## Alcance y estado inicial

ALLOWLIST exacta: scripts/admin-contract/static-dto-validator.mjs;
scripts/admin-contract/static-dto-validator.test.mjs;
scripts/admin-contract/fixtures/fictitious-dto-cases.json;
.agents/handoffs/sdd-0573-admin-static-dto-slice.md.
Destinos cuatro AUSENTES antes de CreateNew. Branch/HEAD/clean/index y linked
worktree verificados antes del nuevo claim. No WIP copiado ni deps instaladas.
Estado inicial: en-progreso; suite NO EJECUTADA, commit pendiente.
Incidente administrativo previo dec778: serializacion PowerShell de un
ErrorRecord de referencia ausente incluyo WARNING de profundidad; rg incluyo
un segundo path supuesto inexistente. Se conservan input/retorno originales.
No se usa ese objeto truncado como fuente, ni se repite esa accion. El texto
real del guard/claim se leyo en el archivo existente con Native1dbfe7/0.
No se atribuye ese incidente al modulo ni a una prueba.

## Impacto documental y limites

Solo harness ficticio bajo SDD0573 existente; spec de producto intacta.
Conocimiento, gestores, bootstrap, Nodeknowledge, Graphify y Obsidian suspendidos
por autoridad concreta. No se ejecutan checks de inicio/cierre de conocimiento.
pnpm verify/build/product tests NO EJECUTADOS: no aplican a este harness aislado
y estan fuera de la autorizacion. No SQL, Docker, COLD, Generic ni recursos reales.
No autentica originales, UTC real, lectura humana, FIN financiero, 2.1 global,
Q PG17 o carrera B. 0495 irrepetible y fiscal pausado permanecen intactos.
No push/PR/merge/deploy. Handoff al Director: revisar commit fijo y originales
de la unica suite; toda integracion/publicacion sigue pendiente.

## Cierre y handoff al Director

- **OBJETIVO ORIGINAL:** implementar el subset puro ADMIN_STATIC_DTO_PROFILE_1
  y comprobarlo una vez con datos FICTICIOS, sin resolver originales operativos.
- **COMPLETADO:** tres exports puros; campos/enums cerrados; tipo natural,
  referencias por version/rol/pin, ciclos, capturas previas, poll propio,
  cierres finitos y evidencia incompleta separada de estructura. Catorce casos
  definidos antes de validar; todos los efectivos se materializan primero.
- **VALIDACION:** UNA ejecucion inicial Node built-in, Native b27a66/exit0.
  46 tests PASO; fail0/cancelled0/skipped0/todo0; duration_ms132.6267.
  Observaciones exteriores 2026-10-24T07:58:41.949Z -> 2026-10-24T07:58:43.090Z.
  Node PE metadata24.19.0; --version NO EJECUTADO por innecesario.
  No segundo runner, instalacion o validacion de producto.
  La API entrega output combinado; no se inventa un stderr separado.
- **COMMITS:** commit local selectivo que contiene este documento, las otras
  tres rutas exactas y ningun archivo adicional; SHA final en entrega externa.
- **PR / BRANCH:** codex/sdd-0573-admin-static-dto-20261024, base F60 exacta,
  WT managed indicado arriba. Sin publicacion, PR o merge en esta fase.
- **PENDIENTES DE ESTA TAREA:** revision semantica completa del candidato fijo
  por Parent y luego General. Los tests acreditan unicamente este harness
  FICTICIO, no admision de Generic/COLD/finanzas/SQL ni cierre2.1 global.
- **FUERA DE ALCANCE DETECTADO:** no se adopta un bug de producto. Los cierres
  operativos06 permanecen NO APTOS/NO EJECUTADOS y separados de este slice.
- **HANDOFF AL DIRECTOR:** revisar fuentes/test/fixture/handoff completos,
  definiciones/expectativas independientes y el original de suite siguiente.
  El nuevo claim se comprobara antes de commit; su liberacion propia al acabar
  escritura se reportara fuera de Git, sin tocar el claim B4 del WT congelado.

Presentacion: cuatro unidades naturales enteras; fixture70302bytes,
modulo24455bytes/test7298bytes, antes de este apendice solo handoff5309bytes.
No un contenido truncado presentado como FULL; las transferencias de autoria
fueron escrituras nuevas con offset y readback de cada byte, sin archivo helper.
Los inputs/resultados administrativos de escritura y guards estan conservados
en registros de esta sesion; no se declara que sean evidencia de runtime SQL.

### Original autentico ENTERO de la unica suite

El registro siguiente es el objeto real capturado ANTES del await y actualizado
con retorno completo ANTES de interpretarlo. No es un fixture o resumen de TAP.
Sus tiempos son observaciones exteriores, no un reloj financiero o Node birth.

```json
{
  "schema": "DTD_SLICE1_SINGLE_NODE_TEST_ORIGINAL_1",
  "input": {
    "cmd": "& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' --test scripts/admin-contract/static-dto-validator.test.mjs",
    "shell": "C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe",
    "login": false,
    "tty": false,
    "workdir": "C:/Users/AKX generator/.codex/worktrees/sdd-0573-admin-static-dto-20261024/DTDCARGO",
    "yield_time_ms": 10000,
    "max_output_tokens": 12000
  },
  "beforeUtc": "2026-10-24T07:58:41.949Z",
  "result": {
    "chunk_id": "b27a66",
    "wall_time_seconds": 0.3353515,
    "exit_code": 0,
    "original_token_count": 925,
    "output": "✔ FICTICIO: all effective cases exist before validation and cover the admitted groups (1.2626ms)\n✔ FICT_VALID: Dtos FICTITIOUS_STRUCTURE_ONLY (2.2786ms)\n✔ FICT_VALID: References FICTITIOUS_STRUCTURE_ONLY (2.718ms)\n✔ FICT_VALID: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (1.6261ms)\n✔ FICT_WRONG_KIND_SAME_SHAPE: Dtos FICTITIOUS_STRUCTURE_ONLY (1.5697ms)\n✔ FICT_WRONG_KIND_SAME_SHAPE: References FICTITIOUS_STRUCTURE_ONLY (1.4339ms)\n✔ FICT_WRONG_KIND_SAME_SHAPE: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.8626ms)\n✔ FICT_MISSING_VERSION_ROLE: Dtos FICTITIOUS_STRUCTURE_ONLY (0.5006ms)\n✔ FICT_MISSING_VERSION_ROLE: References FICTITIOUS_STRUCTURE_ONLY (1.1627ms)\n✔ FICT_MISSING_VERSION_ROLE: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.6573ms)\n✔ FICT_CYCLE_SELF_REFERENCE: Dtos FICTITIOUS_STRUCTURE_ONLY (0.5821ms)\n✔ FICT_CYCLE_SELF_REFERENCE: References FICTITIOUS_STRUCTURE_ONLY (0.4609ms)\n✔ FICT_CYCLE_SELF_REFERENCE: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.9412ms)\n✔ FICT_NONTERMINAL: Dtos FICTITIOUS_STRUCTURE_ONLY (0.4827ms)\n✔ FICT_NONTERMINAL: References FICTITIOUS_STRUCTURE_ONLY (0.8499ms)\n✔ FICT_NONTERMINAL: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.7698ms)\n✔ FICT_TERMINAL_OWN_POLL: Dtos FICTITIOUS_STRUCTURE_ONLY (0.669ms)\n✔ FICT_TERMINAL_OWN_POLL: References FICTITIOUS_STRUCTURE_ONLY (0.5385ms)\n✔ FICT_TERMINAL_OWN_POLL: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.803ms)\n✔ FICT_TERMINAL_TRANSFERRED_TO_INITIAL: Dtos FICTITIOUS_STRUCTURE_ONLY (0.8206ms)\n✔ FICT_TERMINAL_TRANSFERRED_TO_INITIAL: References FICTITIOUS_STRUCTURE_ONLY (1.896ms)\n✔ FICT_TERMINAL_TRANSFERRED_TO_INITIAL: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.9807ms)\n✔ FICT_PROOF_CONTAINER_EXTERNAL_REVIEW: Dtos FICTITIOUS_STRUCTURE_ONLY (0.3435ms)\n✔ FICT_PROOF_CONTAINER_EXTERNAL_REVIEW: References FICTITIOUS_STRUCTURE_ONLY (0.3924ms)\n✔ FICT_PROOF_CONTAINER_EXTERNAL_REVIEW: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.6058ms)\n✔ FICT_FORWARD_CONTAINER: Dtos FICTITIOUS_STRUCTURE_ONLY (0.4136ms)\n✔ FICT_FORWARD_CONTAINER: References FICTITIOUS_STRUCTURE_ONLY (0.6317ms)\n✔ FICT_FORWARD_CONTAINER: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.4817ms)\n✔ FICT_MUTUAL_CLOSURE_WRONG_KIND: Dtos FICTITIOUS_STRUCTURE_ONLY (0.3193ms)\n✔ FICT_MUTUAL_CLOSURE_WRONG_KIND: References FICTITIOUS_STRUCTURE_ONLY (0.5919ms)\n✔ FICT_MUTUAL_CLOSURE_WRONG_KIND: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.614ms)\n✔ FICT_ND_WITHOUT_SUCCESS: Dtos FICTITIOUS_STRUCTURE_ONLY (0.5402ms)\n✔ FICT_ND_WITHOUT_SUCCESS: References FICTITIOUS_STRUCTURE_ONLY (0.7309ms)\n✔ FICT_ND_WITHOUT_SUCCESS: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (1.0397ms)\n✔ FICT_MALFORMED_NULL: Dtos FICTITIOUS_STRUCTURE_ONLY (0.1349ms)\n✔ FICT_MALFORMED_NULL: References FICTITIOUS_STRUCTURE_ONLY (0.1132ms)\n✔ FICT_MALFORMED_NULL: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.0467ms)\n✔ FICT_MISSING_MARKER: Dtos FICTITIOUS_STRUCTURE_ONLY (0.1575ms)\n✔ FICT_MISSING_MARKER: References FICTITIOUS_STRUCTURE_ONLY (0.1313ms)\n✔ FICT_MISSING_MARKER: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.1207ms)\n✔ FICT_UNKNOWN_FIELD_ALIAS: Dtos FICTITIOUS_STRUCTURE_ONLY (0.6617ms)\n✔ FICT_UNKNOWN_FIELD_ALIAS: References FICTITIOUS_STRUCTURE_ONLY (0.6797ms)\n✔ FICT_UNKNOWN_FIELD_ALIAS: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.3566ms)\n✔ FICTICIO: terminal belongs to the own poll, never to the initial return (0.1483ms)\n✔ FICTICIO: finite proof then container then external review, with concrete proof review (0.0775ms)\n✔ FICTICIO: ND and running have no terminal reference or successful action (0.1344ms)\nℹ tests 46\nℹ suites 0\nℹ pass 46\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 132.6267\n"
  },
  "error": null,
  "afterUtc": "2026-10-24T07:58:43.090Z"
}
```

## Nueva autoridad humana S1-P1 - adopcion de continuacion

Adopcion del mismo Owner: 2026-10-24T11:07:02.450Z, antes de modificar modulo/test.
Autoridad integra recibida: DIRECTOR-ADMIN-SLICE1-S1P1-LOCAL-CORRECTION-20261024,
Parent exec-657ec011-b81d-4cea-a98a-5ec048e40c2a, orden humana posterior de Sam:
"Director, encarga al mismo CORE corregir S1-P1, anadir el negativo de operandos
cruzados y ejecutar una vez la suite local. Sin push, PR, merge ni produccion,
y sin recuperar la lectura truncada del fixture."
Mismo WT/rama, base f908944466efe32ea87ceb13907b1d2c5b874103/tree802d28b1e69ba4cf302eac8e7887476ca50afb8b,
clean/index vacio verificados. Claim nuevo de continuacion adquirido CreateNew
con mismoOwner a 2026-10-24T11:06:06.388Z, 201bytes/SHA2567dce85323f6dd60851dd683054135e71844b305295f630b09d2e268a28073d03.
ALLOWLIST de correccion EXACTA: modulo, test y este handoff. No cuarto archivo.
Fixture INMUTABLE: blob bfcb7249d0327a41510002dcce25f9d607b292fd,
70302bytes/SHA2562e350df58251fccfe17aadd15dc21d5f0f66faaa1672e77cc127cbefa2e2653d.
Se coteja identidad Git, sin abrirlo para revision. Lectura integral del fixture
en la revision heredada Parent dbf655: NO ACREDITADA, presentacion PARCIAL.
No se recupera/reemite/reconstruye esa lectura ni se transfieren lecturas Owner
previas a Parent. Solo el runner puede seguir leyendo el JSON como input.

S1-P1: antes de aceptar RelationReview PASO se coteja el array operandRefs del
proof contra operands de review, igualdad estructural completa y ordenada:
cantidad/role/occurrence/VersionRef con metadata. Incumplimiento se diagnostica
INVALID_FIELD, role del review, field value.operands, sin modificar ND u outputs.
El nuevo negativo sustituye solo el operando revisado por otra version previa
del MISMO unitKind SEMANTIC_DTO, y ajusta su UnitReview completa. Mantiene proof
PASO para el operando original, predicate igual, proof-review completa y todas
las expectativas previas. Input efectivo completo antes de cualquier llamada.
No se ejecuta la version vulnerable para un red adicional. Una nueva suite
permitida DESPUES del cambio; no --version, knowledge, productos o SQL.
Inversas enteras del modulo y del test a sus preimagenes comprobadas antes de
escribir. Este apendice conserva literalmente el handoff anterior completo.
Estado de esta continuacion: autoria; suite nueva aun NO EJECUTADA.

## Resultado fijo S1-P1 y handoff de la correccion

- **OBJETIVO ORIGINAL:** corregir unicamente S1-P1 y agregar el negativo
  significativo de operandos cruzados, conservando perfil y fixture inmutable.
- **COMPLETADO:** una guardia nueva compara con sameData el array completo y
  ordenado proof.value.operandRefs frente a review.operands, antes de aceptar
  review.result PASO. Mantiene cantidad/role/occurrence/VersionRef/metadata y
  usa codigo cerrado INVALID_FIELD, field value.operands. Sin nuevo export,
  I/O, lookup, esquema, formato de salida o cambio de semantica ND.
- **VALIDACION:** UNA nueva ejecucion autorizada, Native6c89d8/exit0.
  Resultado REAL nuevo: tests47/pass47/fail0/cancelled0/skipped0/todo0,
  duration_ms112.6443. Observaciones exteriores 2026-10-24T11:07:46.339Z -> 2026-10-24T11:07:47.315Z.
  El test nominal S1-P1 PASO: Dtos y References VALID/PRESENT_FICTITIOUS;
  ClosureOrder INVALID/NO_ACREDITADO_FICTITIOUS con SOLO el diagnostico
  INVALID_FIELD/FICT_ROLE_RELATION_REVIEW/value.operands. Control positivo
  coincidente y todas las expectativas anteriores conservados y PASO.
  No se ejecuto la version vulnerable ni se reparo/repitio esta suite.
- **COMMITS:** commit local selectivo de esta correccion que contiene este
  documento, modulo y test. SHA final en entrega externa; no recursion propia.
- **PR / BRANCH:** misma codex/sdd-0573-admin-static-dto-20261024/WT managed.
  Padre directo f908944466efe32ea87ceb13907b1d2c5b874103.
  Esperado diff padre..nuevo: exactamente tres modificaciones. F60..nuevo:
  mismas cuatro altas originales, fixture con mismo blob bfcb7249d0327a41510002dcce25f9d607b292fd.
- **PENDIENTES DE ESTA TAREA:** revision semantica Parent/General del candidato
  fijo. Lectura integral heredada del fixture: NO ACREDITADA; no se recupera
  dbf655 ni se reimprime el JSON. Conservacion se acredita por identidad Git,
  no por afirmar una nueva lectura integral o un nuevo hash humano del fixture.
- **FUERA DE ALCANCE DETECTADO:** no se adopta otro bug o contrato. CORE06 no
  apto, QPG17/B no ejecutados, auth4/origin/budgetNULL/reservaFalse intactos.
- **HANDOFF AL DIRECTOR:** revisar modulo/test/handoff nuevos completos y el
  original autentico siguiente; no revisar el fixture omitido para este arreglo.
  Sin push/PR/merge/produccion. Claim de continuacion se verifica antes del
  commit y solo ese claim propio se libera al terminar; B4 queda retenido.

El negativo esta completo en memoria antes de cualquier validador: conserva
predicate y proof PASO para el contenedor original, usa otra version anterior
del mismo unitKind SEMANTIC_DTO para review y ajusta una UnitReview completa
para esa version, manteniendo la UnitReview completa del proof. El assert
estricto de issues evita un falso rojo por referencia/tipo/alias/ciclo/orden
ajeno. No modificaciones al fixture o expectativas existentes. Todos los datos
son FICT_ y no acreditan evidencia operacional/2.1/SQL/carrera.

### Original autentico ENTERO de la unica suite nueva S1-P1

```json
{
  "schema": "DTD_SLICE1_S1P1_SINGLE_NODE_TEST_ORIGINAL_1",
  "input": {
    "cmd": "& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' --test scripts/admin-contract/static-dto-validator.test.mjs",
    "shell": "C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe",
    "login": false,
    "tty": false,
    "workdir": "C:/Users/AKX generator/.codex/worktrees/sdd-0573-admin-static-dto-20261024/DTDCARGO",
    "yield_time_ms": 10000,
    "max_output_tokens": 12000
  },
  "beforeUtc": "2026-10-24T11:07:46.339Z",
  "result": {
    "chunk_id": "6c89d8",
    "wall_time_seconds": 0.2606109,
    "exit_code": 0,
    "original_token_count": 947,
    "output": "✔ FICTICIO: all effective cases exist before validation and cover the admitted groups (0.8471ms)\n✔ FICT_VALID: Dtos FICTITIOUS_STRUCTURE_ONLY (1.9199ms)\n✔ FICT_VALID: References FICTITIOUS_STRUCTURE_ONLY (2.14ms)\n✔ FICT_VALID: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (1.3776ms)\n✔ FICT_WRONG_KIND_SAME_SHAPE: Dtos FICTITIOUS_STRUCTURE_ONLY (0.6738ms)\n✔ FICT_WRONG_KIND_SAME_SHAPE: References FICTITIOUS_STRUCTURE_ONLY (0.7038ms)\n✔ FICT_WRONG_KIND_SAME_SHAPE: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.7641ms)\n✔ FICT_MISSING_VERSION_ROLE: Dtos FICTITIOUS_STRUCTURE_ONLY (0.443ms)\n✔ FICT_MISSING_VERSION_ROLE: References FICTITIOUS_STRUCTURE_ONLY (0.7264ms)\n✔ FICT_MISSING_VERSION_ROLE: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.5786ms)\n✔ FICT_CYCLE_SELF_REFERENCE: Dtos FICTITIOUS_STRUCTURE_ONLY (0.6075ms)\n✔ FICT_CYCLE_SELF_REFERENCE: References FICTITIOUS_STRUCTURE_ONLY (0.4284ms)\n✔ FICT_CYCLE_SELF_REFERENCE: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.7963ms)\n✔ FICT_NONTERMINAL: Dtos FICTITIOUS_STRUCTURE_ONLY (0.4316ms)\n✔ FICT_NONTERMINAL: References FICTITIOUS_STRUCTURE_ONLY (0.6577ms)\n✔ FICT_NONTERMINAL: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (1.2503ms)\n✔ FICT_TERMINAL_OWN_POLL: Dtos FICTITIOUS_STRUCTURE_ONLY (0.7933ms)\n✔ FICT_TERMINAL_OWN_POLL: References FICTITIOUS_STRUCTURE_ONLY (0.5627ms)\n✔ FICT_TERMINAL_OWN_POLL: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.7233ms)\n✔ FICT_TERMINAL_TRANSFERRED_TO_INITIAL: Dtos FICTITIOUS_STRUCTURE_ONLY (0.7855ms)\n✔ FICT_TERMINAL_TRANSFERRED_TO_INITIAL: References FICTITIOUS_STRUCTURE_ONLY (1.0206ms)\n✔ FICT_TERMINAL_TRANSFERRED_TO_INITIAL: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.8929ms)\n✔ FICT_PROOF_CONTAINER_EXTERNAL_REVIEW: Dtos FICTITIOUS_STRUCTURE_ONLY (0.3872ms)\n✔ FICT_PROOF_CONTAINER_EXTERNAL_REVIEW: References FICTITIOUS_STRUCTURE_ONLY (0.3669ms)\n✔ FICT_PROOF_CONTAINER_EXTERNAL_REVIEW: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.4966ms)\n✔ FICT_FORWARD_CONTAINER: Dtos FICTITIOUS_STRUCTURE_ONLY (0.4046ms)\n✔ FICT_FORWARD_CONTAINER: References FICTITIOUS_STRUCTURE_ONLY (0.4669ms)\n✔ FICT_FORWARD_CONTAINER: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.6974ms)\n✔ FICT_MUTUAL_CLOSURE_WRONG_KIND: Dtos FICTITIOUS_STRUCTURE_ONLY (0.3631ms)\n✔ FICT_MUTUAL_CLOSURE_WRONG_KIND: References FICTITIOUS_STRUCTURE_ONLY (0.4506ms)\n✔ FICT_MUTUAL_CLOSURE_WRONG_KIND: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.476ms)\n✔ FICT_ND_WITHOUT_SUCCESS: Dtos FICTITIOUS_STRUCTURE_ONLY (0.4168ms)\n✔ FICT_ND_WITHOUT_SUCCESS: References FICTITIOUS_STRUCTURE_ONLY (0.4462ms)\n✔ FICT_ND_WITHOUT_SUCCESS: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.5333ms)\n✔ FICT_MALFORMED_NULL: Dtos FICTITIOUS_STRUCTURE_ONLY (0.0646ms)\n✔ FICT_MALFORMED_NULL: References FICTITIOUS_STRUCTURE_ONLY (0.0517ms)\n✔ FICT_MALFORMED_NULL: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.046ms)\n✔ FICT_MISSING_MARKER: Dtos FICTITIOUS_STRUCTURE_ONLY (0.1798ms)\n✔ FICT_MISSING_MARKER: References FICTITIOUS_STRUCTURE_ONLY (0.4641ms)\n✔ FICT_MISSING_MARKER: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.1689ms)\n✔ FICT_UNKNOWN_FIELD_ALIAS: Dtos FICTITIOUS_STRUCTURE_ONLY (1.0201ms)\n✔ FICT_UNKNOWN_FIELD_ALIAS: References FICTITIOUS_STRUCTURE_ONLY (0.6841ms)\n✔ FICT_UNKNOWN_FIELD_ALIAS: ClosureOrder FICTITIOUS_STRUCTURE_ONLY (0.36ms)\n✔ FICTICIO: terminal belongs to the own poll, never to the initial return (0.143ms)\n✔ FICTICIO: finite proof then container then external review, with concrete proof review (0.0781ms)\n✔ FICTICIO: ND and running have no terminal reference or successful action (0.1371ms)\n✔ FICTICIO S1-P1: successful review cannot cross concrete operands of its proof (1.6725ms)\nℹ tests 47\nℹ suites 0\nℹ pass 47\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 112.6443\n"
  },
  "error": null,
  "afterUtc": "2026-10-24T11:07:47.315Z"
}
```
