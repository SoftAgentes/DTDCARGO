# SDD-0573 · cierre local de consultas tipadas

## OBJETIVO ORIGINAL

Corregir las opciones incompatibles de las consultas por rol en app/studio/(app)/contabilidad/__tests__/libro-diario-reverso.test.tsx, conservando todos sus oráculos. No cambia producto, tipos globales ni el CSV fijo.

## Autoridad y aislamiento

Adopción expresa 2026-10-25T23:12:53.830Z de DIRECTOR-CORE-TYPES-CIERRE-20261025, recibida íntegra por Parent como tarea serial nueva. La autoridad humana vigente admite esta corrección local; no es un rerun de CI ni de suites consumidas.

- Owner: worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468; mismo CORE01a1601e-d9fd-7280-8977-6b5d4719a99b.
- Worktree managed nuevo: C:/Users/AKX generator/.codex/worktrees/sdd-0573-types-cierre-20261025/DTDCARGO.
- Rama: codex/sdd-0573-types-cierre-20261025.
- Base fija/padre del candidato: 54722c52a188744935a2fb87aa6db565fc8dfe5e; tree bcf0a63a34fc7358b168bb51656a175083c2c708.
- Setup propio2de582/0, siete Git individuales conformes; claim nuevo201bytes/SHA256 b4270c3dc5265bd3d52c91d9c2fe92c110d7c1a96ee8feaca78e647f2695c61e, creado2026-10-25T23:10:28.6694610Z en metadata Git del nuevo WT.
- Allowlist exacta: el test indicado y este handoff nuevo .agents/handoffs/sdd-0573-types-cierre-20261025.md; ausencia comprobada antes de CreateNew.

Los WTs/claims anteriores, incluidos0571/B4, permanecen protegidos; no se liberan, reparan o consultan para esta tarea. SDD0573 se reutiliza por su identidad existente; no se reescriben la spec ni sus apéndices históricos.

## Fallo conservado y diagnóstico acotado

Según la autoridad General recibida, CI40236914781/attempt1/job121300340916/workflow_dispatch sobre54722c52 FALLÓ en TypeScript. Diagnóstico visible en este test(50,57): TS2769, No overload matches this call / ByRoleMatcher/ByRoleOptions. Total de diagnósticos NO DISPONIBLE. ESLint y RSC PASÓ; gates9–20 SKIPPED, por lo que los seis casos CSV NO SE EJECUTARON. Son hechos referidos por General, no una recuperación propia del log omitido.

La lectura propia actual ENTERA por Git d2aad2/0 mide17113bytes/blob b2e627cbaa958374ec1ae5ca1d09e1ec41a0d03f. Preimagen física61d25b/0: SHA256 a8dbce76c56050081c61ce2aa741dbf509d52c063a318dd3d25526e5883a42c3,17057UTF16, ceroCRLF/217LF, idéntica a ese blob y conservada íntegra en0573-types:preimage.

Se localizaron25 opciones literales «, exact: true», todas en getByRole/getAllByRole/queryByRole de button; se conservan las funciones, scopes screen/within, role y los name string o variables de cadenas. La API pública [ByRole de Testing Library](https://testing-library.com/docs/queries/byrole/) enumera name:TextMatch y no ofrece exact como opción. La selección por nombre accesible string conserva su coincidencia completa; no se sustituye por regex parcial ni se elimina name. La consulta documental pública de esta tarea no acredita compilación del paquete instalado.

Las declaraciones locales node_modules/@testing-library/dom/types/queries.d.ts no están disponibles. package.json leído ENTERO3c9851/0 declara @testing-library/react^16.3.2, TypeScript^5 y Vitest^4.1.7; son rangos de fuente, no versiones ejecutadas. El cambio se limita a retirar la opción incompatible, sin any, ts-ignore, casts nuevos, exclusiones o cambios de dependencia/configuración.

## Oráculos y preservación

Se conservan bloqueo por DTO/roles, nombres accesibles, permisos, foco, pending, doble gesto sin doble envío, acuses sinok/error/throw, recuperación explícita y limpieza de la clave ficticia. No se modifica ningún expect, mock, evento o dato ficticio. El recibo literal e inversa WHOLE se completa abajo.

Fuera de las dos rutas se conservan los tres blobs CSV547: export-csv.ts cf1f1926e8da5b2437d0a73f9b6ac66309aae60b; export-csv.test.ts b704b36d28099881c8b1cf2534d71143fba82c5f; handoffCSV85194f4e2cbc476dc53045940b2315f82b7e0929. Sus seis casos siguen NO EJECUTADOS; esta tarea no los relanza.

## VALIDACIÓN

NO DISPONIBLE / NO EJECUTADA: en el nuevo WT faltan node_modules, node_modules/vitest/vitest.mjs, node_modules/typescript/lib/tsc.js y las declaraciones DOM. Cero invocaciones de Node, compilador o pruebas. No instalación/copia/junction, fallback a otro WT, suite47/29/financiera, typecheck global ni relanzamiento del workflow fallido.

Comando focal propuesto para una validación posterior sobre el SHA nuevo; NO INVOCADO:

```powershell
& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' node_modules/vitest/vitest.mjs run 'app/studio/(app)/contabilidad/__tests__/libro-diario-reverso.test.tsx' --maxWorkers=1 --no-file-parallelism --reporter=verbose
```

Compilación efectiva y focal quedan pendientes de una CI nueva coordinada por General después de la revisión fija. No se infiere que éste fuera el único diagnóstico del proyecto ni que el cambio haya pasado TypeScript.

## Gobernanza e impacto documental

91e088/0 coteja idénticos los pins actuales de AGENTS, Worker, runbook, project-rules, AGENT-BRIEF, registro aprobado e instrucciones Studio con sus lecturas completas ya conservadas en esta continuidad; se reutilizan sin recuperar una salida detenida. No hay overrides AGENTS adicionales en los ancestros comprobados de la prueba.

- Cumplimiento estático de alcance y preservación: sólo API de consulta en una prueba; no hay cambio de permiso, foco o recuperación del producto. Se mantienen los oráculos A11Y/errores existentes.
- No aplica al delta: políticas de acciones, auditoría, datos, componentes, visuales o interacción de producto; no se crean o modifican esas superficies.
- Verificación funcional pendiente; no conformidad global ni cierre2.1/aceptación financiera inferidos.
- Conocimiento/Graphify/Archify/Obsidian/gestores/bootstrap: NO EJECUTADOS por suspensión nominal; integración y actualización compartida pendientes del Director. Automatización PAUSADA.

## COMMITS / PR / BRANCH

El commit que contiene este documento es una hija local directa de54722c52, con una modificación de test y esta alta. Publicación pendiente de revisión Parent; Worker no publica ni cambia head/base320, no crea PR alternativa y no mergea main. No producción ni SQL/DB.

## COMPLETADO / PENDIENTES DE ESTA TAREA

Aislamiento y adopción propios antes de editar; corrección literal acotada y preimagen preservada. Pendientes: compilación/focal efectivos, revisión fija Parent/General y decisión de publicación/CI del SHA nuevo. Ningún resultado operativo se hereda.

## FUERA DE ALCANCE DETECTADO

Otros diagnósticos no visibles, tipado global, I2/ACK,0578/#318, producto y fuentes03–06, logB, custodias/lecturas detenidas y anteriores. CORE06 continúa NO APTO; QPG17/B NO EJECUTADOS, sin inferir consumo de claves por fechas transcurridas.

## HANDOFF AL DIRECTOR

Revisar las dos unidades nuevas completas, diff literal y oráculos, preservaciones y originales de Git/claim. El estado auténtico final del claim nuevo y FIN se aporta por canal formal después de terminar la escritura; no se incluye el retorno propio de cierre ni un hash autorreferente en el archivo.

## Recibo de autoría y preservación

- Adopción durable bbc6ca/exit0 a2026-10-25T23:12:54.8823089Z, CreateNew/readback WHOLE, anterior a la edición.
- Edición y readback físico íntegro92bfc3/exit0 a2026-10-25T23:13:19.9379678Z:16788bytes/SHA256 593b4a1964992359a92d3e4576148657d6670127c86af9bb421ab26ecae22186.
- Se retiraron exactamente25 tokens literales «, exact: true» de las25 consultas por rol identificadas antes de escribir. Diferencia325bytesASCII;217LF/ceroCRLF antes/después. Forward WHOLE conforme y restauración por los25 offsets originales ajustados recupera WHOLE la preimagen. No se altera ningún otro carácter.
- El primer ejemplo cambia screen.getByRole("button", { name, exact: true }) a screen.getByRole("button", { name }); se conserva el mismo patrón para getAllByRole y queryByRole, con todos sus nombres, scopes y oráculos. No se agrega regex, any, supresión de tipos o cambio de aserción.
- La prueba y compilación siguen NO DISPONIBLES/NO EJECUTADAS: cero invocaciones, sin versión local medida ni nuevo resultado CI. Preimagen, plan literal/offsets, input/retorno enteros y comparación inversa permanecen en las claves propias0573-types, separados de las fuentes detenidas.
