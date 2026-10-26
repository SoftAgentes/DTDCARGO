# SDD-0573 · composición local MAIN + CORE + Reportes

## Autoridad, fuentes y aislamiento

DIRECTOR-0573-COMPOSICION-MAIN-REPORTES-20261026 y continuación limitada
DIRECTOR-0573-CIERRE-ACOTADO-DEL-COMPUESTO-SIN-RELEER-INDICE-20261026.
Mismo CORE; owner worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
WT real C:/Users/AKX generator/.codex/worktrees/sdd-0573-integracion-main-20261026/DTDCARGO.
Rama propia codex/sdd-0573-integracion-main-20261026.

Fuentes inmutables:
- MAIN421b1f677dfead822c5a4fac8ebd3991337f0a4b,
  tree a5b332315cdb7b247bbdc67858a2e56ba5bfb16c.
- CORE5b6c4609756ae3631e2de1bbdd43912799d9cdfe,
  tree cf33acf2ea421850a463c187dc39bee5d3161e64.
- REPORTES15d34c41d08a5dcbe67269328200bc73a2b1bdd3,
  tree dd4664df6552238876ddb8113316e21a0570c817.

Una creación managed2b805749-2d69-4e99-952f-1e9557e1b02e, terminal recibido
completed/revision81. Setup b705ab/0: raíz/base/estado exactos, rama y claim
nuevos antes de autoría. Claim original propio205bytes, SHA256
e254b3c6b3b49fc5dfc5a340a3a8c7a5bf26beca1a65836bcd07578a8912099c,
Git worktrees/DTDCARGO15/harness-session-claim.json.
No nueva creación/claim/renovación en la continuación.

Allowlist manual exacta:
- scripts/__tests__/invoice-read-boundary.test.mjs
- supabase/migrations-baseline.json
- supabase/pending-migration-symbol-declarations.json
- docs/specs/README.md, sólo unión canónica del driver existente
- .agents/handoffs/0573-integracion-main-20261026.md, este alta.

Todo lo demás llega exclusivamente de objetos Git fijos. No fetch, copiaWIP,
producto, SQL, flags, deps/config, otro SDD o edición de handoffs históricos.

## Primer merge y resolución completa

No se repitió merge-tree ni se adoptó el tree provisional del revisor.
El merge NUEVO --no-ff --no-commit CORE5b sobre MAIN421, fb0ee5/exit1, produjo
exactamente los tres conflictos admitidos: boundary, baseline y declaraciones.
Exit1 es conflicto Git esperado, no resultado de una prueba de producto.
El driver configurado permaneció node scripts/merge-generated-records.mjs
%O %A %B %P, recursive=binary; helper blob
4a5af4e54f74a80270ddd6c15d6fa8bb14d5b530 y atributos blob
82558b639e7b8634acf156e94c5f0cefbf0a2a65 intactos.
Rechazó los conflictos de0569 y0496; unió canónicamente README. No se
desactivaron validadores ni se cambió configuración persistente. Los hooks
pre-merge-commit/post-merge/pre-commit/commit-msg comprobados estaban ausentes.

1. Boundary: MAIN completo14228bytes/923b6c/0 y CORE completo13392/0f8e30/0.
   MAIN aporta la ruta/checks0574 de reporteSinFacturar; CORE aporta el bloque
   I2 y la tercera lectura literal de libro-control-queries. Se conservaron
   ambos:20 archivos y46 lecturas esperadas. No se eliminó ningún assert,
   prefiltro, inventario, control AST, prueba de escapes, widget/RBAC, exclusión
   o timeout. El plan directo/inverso conserva MAIN fuera del bloque I2 y el
   total compuesto. No se presenta el contador como AST ejecutado.
   Resultado14645bytes/SHA256
   d9447d19c1eb4dcf3486e55257b1485e4b4dbfc998bf3f64776a4c9a321344f7;
   lectura resuelta completa acee7a/0.

2. Baseline: MAIN completo0fb8f3/0 y CORE completo90e831/0.
   Se conservó literalmente MAIN, incluidos0496F3,0422,0423,0495,$doc y
   cutoff238; se añadió sólo la espera0497 legítima de CORE. No se marca DB
   aplicada ni se reinterpreta como autorización el texto histórico.
   Resultado22152bytes/SHA256
   f49508de2ad6833920032ee8c471e5c77bfe17fc2152133420ba84d1bd789b00;
   lectura resuelta completa7bc7c7/0. Plan inverso retira sólo esa entrada
   y recupera MAIN;19244c/0 confirmó los datos protegidos completos.

3. Declaraciones: header y grupo0571 de MAIN;0569 y0573 literales de CORE5b.
   Se conservaron contains/degradation/símbolos y evidencia protegida.
  19244c/0 comprobó que todas las fuentes nombradas por0569/0573 son las
   entradas exactas CORE, y las de0571 son MAIN: no hubo desplazamientos
   adicionales que sincronizar. El resultado es exactamente el blob CORE
   f8d5c31c299a70e6d38c530222bf153bebd57b9c,18308bytes/SHA256
   318bae3ecda90ea73c83a8c47e208e73ddc0cecea38123cc4539eee6bde46b99.
   No se recuperaron fuentes detenidas; se reutilizó la fuente CORE íntegra
   ya leída y se leyó MAIN completo aa75d5/0.

bdd2e3/0 acreditó cero blobs automáticos nuevos fuera de la allowlist.
19244c/0 acreditó6398 entradas exteriores a la autoría manual, cada una
exacta de MAIN o CORE. Las preimágenes de los tres conflictos se conservaron
completas antes de la escritura en las capturas propias de resolución.

Primer commit local ad3597/0:
dbe0f8a4188baa8a95df59597b0e89f77f479d82,
tree565ca37a0072542ab3b8d62c132e49ca1eb49a49,
padres MAIN421 y CORE5b completos arriba.

## Índice: revisión mecánica admitida; lectura textual PARCIAL

ec3d03/0 ANTERIOR al fallo acreditó la unión canónica del driver:
563filas MAIN +559 CORE →564, todas presentes, ninguna fila MAIN cambiada.
0571/0573 permanecen in-progress;0574 y0579–0581 conservan MAIN.
No se generó de nuevo el índice.

Pin Git protegido README5f4652d2a47f9a421bda7992dde397a635471c63;
51774bytes/SHA256
5fc94ea0999b2e584868e3cf9b3a048a20f4652ccbcedb4292e891793a5515fc,
medidas de la prueba mecánica anterior.

La presentación prospectiva generated-index-WHOLE quedó PARCIAL:
1001tokens truncados +un ítem omitido. Recepción Native/exit/chunk/sesión de
ESA lectura UNKNOWN/NO ACREDITADOS. El nombre WHOLE no prueba completitud.
No se cargó ni reconstruyó su input/output, contexto, sesión, ítem u omitidos.
No hubo reemisión, fragmentación, proxy, lectura alternativa o consulta de
aquella sesión desconocida. Este handoff NO reproduce fragmentos del índice.

La disposición nueva admite exclusivamente prueba canónica anterior +pinsGit
como modalidad de revisión del índice; NO lectura textualWHOLE. Las posteriores
comprobaciones del archivo son sólo hashes/blobs de metadata.

## Reportes y pins protegidos

Después del primer commit, un merge normal15d cdb915/0 entró sin conflictos,
detenido antes del commit. f2355e/0 acreditó únicamente:
- A .agents/handoffs/sdd-0573-reportes-i2-ficticios-20261026.md,
  blob02459cf18d32f8af1acc1540ed635c56f7473d1c.
- M lib/studio/reports/__tests__/queries.test.ts,
  blob47eabcc328b12d18749a05205a35e6f1f90fce01.
Las otras6401 entradas son idénticas a dbe. No se abrió el cuerpo global
detenido de Reportes ni su handoff previo; tampoco el test grande a28ea0,
ingreso-fixture, SQLhuge, Source03–06/RAW, logs o fixtures detenidos.

Pins MAIN exactos, comprobados bdd2e3/0:
- SQL0496:0f424008e0b8cea268d114a229a3f7e2819a7eff.
- RateSnapshotDrawer:91f198dba6d4de40e001b40ed3bca2aa9e70532f.
- Drawer.test:bbdc8d0bd68e5c8661d02b7ce3f31d5b96fbfa0b.
- quality.yml:b30449e749d07e94ce5d10386505f535c9d92a06.

Las diez rutas316 se preservan exactamente como MAIN:
.agents/handoffs/0574-embarques-sin-facturar.md;
app/studio/(app)/direccion/_components/SinFacturarCard.test.tsx;
app/studio/(app)/direccion/_components/SinFacturarCard.tsx;
app/studio/(app)/direccion/page.tsx;
app/studio/(app)/reportes/embarques-sin-facturar/page.test.tsx;
app/studio/(app)/reportes/embarques-sin-facturar/page.tsx;
app/studio/(app)/reportes/page.tsx;
docs/specs/0574-embarques-sin-facturar/spec.md;
lib/studio/rate-snapshots/__tests__/sin-facturar.test.ts;
lib/studio/rate-snapshots/sin-facturar.ts.

## Continuación limitada y validación

Guard NUEVO único21dd47/0,2026-10-26T05:22:12.7978938Z:
mismo WT/rama/HEADdbe/tree565/padres421+5b, MERGE_HEAD15d, índice
850d2e11268f6114d943c05195a2e88186d2fcbd, sólo las dos rutasReportes staged,
cero unstaged/ajenos; README mismo blob enHEAD/índice/workinghash,
claim205/pin/owner/ruta originales conformes y handoff nuevo ausente.
No cuerpo/parseo semántico del índice o Reportes, ni probe de deps repetido.

Frontera: NO DISPONIBLE / NO EJECUTADA. b705ab/0 había observado
node_modules/typescript/vitest ausentes en este WT. No probe nuevo,
instalación, copia, junction, otroWT, Nodefrontera o runner alternativo.
Input preparado, NO INVOCADO:
{
  "cmd": "& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' --test scripts/__tests__/invoice-read-boundary.test.mjs",
  "shell": "C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe",
  "login": false,
  "tty": false,
  "workdir": "C:/Users/AKX generator/.codex/worktrees/sdd-0573-integracion-main-20261026/DTDCARGO",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
Registro0573-integracion:boundary-conditional-record:
invoked=false; beforeUtc/afterUtc/result/error/exit/chunk/session=null.
No se certifica el inventario real ni compatibilidad del runner sin ejecutarlo.

Gate15 ORIGINAL del compuesto: UNA ejecución real, PASÓ exit0.
Input completo prospectivo:
{
  "cmd": "& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' scripts/check-pending-migration-symbols.mjs",
  "shell": "C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe",
  "login": false,
  "tty": false,
  "workdir": "C:/Users/AKX generator/.codex/worktrees/sdd-0573-integracion-main-20261026/DTDCARGO",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
beforeUtc exterior2026-10-26T05:22:55.734Z;
recepción terminal2026-10-26T05:24:38.006Z.
Inicial07d254, sesión propia76585; seguimiento único edcb36/0, salida completa
3260tokens. Resultado:0 ROJO ·3 AMARILLO declarado(s) ·3 homónimo(s)
descartado(s). Originales completos antes de parsear en
0573-integracion:gate15-single y0573-integracion:gate15-poll-1.
Sin rerun ni edición para verde; sin --version. Los amarillos mantienen
migraciones pendientes y MIGRATE-FIRST; no significan aplicaciónDB.

La invocación del driver durante la materialización Git es independiente de
esta única validación gate15. No otras suites, I2/Reportes, compilación,
build/verify, CI, DB/APIreal, demos o procesos humanos.
La CI nueva y publicaciónPR320 corresponden a General.

## Cierre y límites

Este handoff acompaña el commit del merge pendienteReportes. La identidad
final real, sus padres/árbol, ancestry421+5b+15d, estado Git y release del claim
se documentan en el recibo externo después de fijarlo; aquí no se afirma un
FINNative futuro. Sólo se añadirá este handoff al índice ya compuesto.
No nuevas ediciones del índice/baseline/declaraciones/código.

AGENT-BRIEF/registro: evidencia y lenguaje honestos SGE-00, errores y límites
ERR-01; sin efectos nuevos AUD-01. Se conservan contratos/SDD/estados; la
composición estática no certifica producto ni aplicación de migraciones.
Fuera de alcance:310/311 sin asignación, reservas/relojes financieros,
QPG17/B y2.1 abiertos; fechasCORE06 transcurridas sinEJE06, sin inferir consumo
de claves. No fuentes privadas/PII/cuentas/proveedores/contactos/gasto,
producción, push/PR/main/merge-main/deploy ni conocimiento/gestores.
Todos los WTs/claims anteriores permanecen intactos; sólo el claim propio
nuevo podrá liberarse tras verificación real. AutomatizaciónPAUSADA.
