# SDD-0537 · espera del foco del aviso de error

## OBJETIVO ORIGINAL

Corregir únicamente la espera del foco en «editar una ciudad > ante un error conserva lo escrito, enfoca el aviso y permite reintentar». Se reutiliza docs/specs/0537-transportistas-tarifas-editables/spec.md; no se modifica su estado histórico.

## Autoridad y aislamiento

Adopción expresa: 2026-10-25T22:55:09.078Z. Autoridad DIRECTOR-0537-FOCO-TEST-20261025, con excepción humana nominal de Sam «Sí, reasigna al CORE sólo el test y su handoff (Recomendado)» y continuidad DIRECTOR-0571-AUTHENTIC-FINAL-RECEIVED-20261025, recibidas por Parent en esta asignación serial.

- Owner: worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468; misma sesión CORE 01a1601e-d9fd-7280-8977-6b5d4719a99b.
- Worktree managed nuevo: C:/Users/AKX generator/.codex/worktrees/sdd-0537-foco-pruebas-20261025/DTDCARGO.
- Rama: codex/sdd-0537-foco-pruebas-20261025.
- Base fija: cad12f3dad63f7b1d5f6f61bd7d0a8f003c56a72; tree 542c1093d56beb32dfcb951c10b68a71b8da4c99.
- Setup propio 079729/0: siete Git individuales conformes antes de rama y claim. Claim nuevo de 201 bytes, SHA256 ba98e49e3302966bed98b4f5a6f12022babaa5af5be7910e0eba5be3273c921e, creado 2026-10-25T22:52:10.3473203Z bajo metadata Git del nuevo WT.
- Allowlist exacta: app/studio/(app)/admin/_components/calculator/__tests__/TransportistasPanel.test.tsx y este handoff nuevo .agents/handoffs/sdd-0537-foco-pruebas-20261025.md.

El WT/claim0571 anterior se conserva como consumidor protegido ante su cierre administrativo no acreditado. No se consulta ni recupera 0571-correcciones:final-control. Los WTs anteriores, B4 y sus consumidores no participan en esta tarea.

## Fuente y cambio acotado

La revisión General refiere CI40236765967 FAILURE/check121299896084: el alert existía, mientras el aside conservaba el foco al comprobarlo. No se recupera su log omitido ni se atribuye causa a PGlite. La lectura propia actual ENTERA de TariffDrawer.tsx (17861 bytes/SHA256 778bfe45aa25d4154d2073a743a4c9a2c00c9a450af9b287bd1ba5f83a4bb05b) confirma que su useEffect enfoca errorRef cuando cambia state.error, después del render. Existencia y foco son observables distintos.

Preimagen actual del test: 20290 bytes/20175 UTF16, SHA256 7e1f54c3b46b9509d8d9622d21ddc3e86559bcaed076895d7540326a7d825c47; blob Git fcc51dd8d9fd7ee6374aa0175a3b4f9cdb467fa8, idéntico al de la base. Captura propia íntegra 0537:preimage, con content exacto, cero CRLF y 415 LF; input/retorno previos conservados. La preimagen permanece además en el objeto Git inmutable de la base.

Cambio previsto de una sola aserción: expect(alerta).toHaveFocus(); pasa a await waitFor(() => expect(alerta).toHaveFocus()); sólo en el caso de edición indicado. Se conserva el alert obtenido, texto, panel abierto, valor111, ausencia de toast de éxito y un reintento con el mismo precio. Guardar y el segundo envío permanecen fuera de waitFor. Sin pausas fijas, timeout nuevo, focus() desde el test, mock nuevo, skip ni aceptación del aside como foco correcto.

## VALIDACIÓN

NO DISPONIBLE / NO EJECUTADA: el nuevo worktree no contiene node_modules ni node_modules/vitest/vitest.mjs (observación propia079729/0). Cero invocaciones Node/Vitest, sin versión nueva o resultado heredado. No se instalan, copian o enlazan dependencias ni se usa otro WT.

Comando focal propuesto para el nuevo SHA cuando CI o un entorno autorizado disponga de dependencias; NO INVOCADO en esta tarea:

```powershell
& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' node_modules/vitest/vitest.mjs run 'app/studio/(app)/admin/_components/calculator/__tests__/TransportistasPanel.test.tsx' --maxWorkers=1 --no-file-parallelism --reporter=verbose
```

El archivo conserva sus veinte escenarios definidos; ese inventario por lectura no es discovery ni veinte resultados. Esta corrección no prueba que el foco llegue: si no llega, la aserción conserva su fallo. No se repite CI40236765967 ni se despacha CI por Owner.

## Gobernanza e impacto documental

Lecturas actuales ENTERAS: Worker, runbook de ingeniería, AGENT-BRIEF, registro aprobado, project-rules, instrucciones Studio, SDD0537, test, TariffDrawer y políticas A11Y-01/ERR-01. Las lecturas de esta tarea conservan identidad propia y no completan salidas detenidas.

- A11Y-01 §9 / ERR-01: cumplimiento del oráculo por revisión estática al esperar el foco real del error bloqueante; ejecución pendiente. No se declara conformidad global del producto.
- Excepción de alcance nominal: sólo test+handoff, sin cambios de producto o spec histórica. No se ejecutan verify, pruebas SQL, browser o gates globales.
- Resto de políticas: no aplica al delta de prueba, que no cambia acciones, permisos, datos, componentes, apariencia, mensajes o mutaciones del producto.
- Conocimiento/gestores/bootstrap y Graphify/Archify/Obsidian: NO EJECUTADOS por suspensión expresa; actualización compartida pendiente de integración coordinada por Director.

## COMMITS / PR / BRANCH

El commit que contiene este documento será hijo directo de cad12f3dad63f7b1d5f6f61bd7d0a8f003c56a72, con una modificación de test y esta alta. Publicación pendiente de revisión fija Parent; este encargo Worker no publica ni crea PR. General coordina una PR separada del nuevo SHA, su CI e integración. No main/merge/deploy.

## COMPLETADO

Adopción y aislamiento propios registrados antes de editar. El recibo final del cambio literal, comparación inversa, Git y estado del claim se completa abajo antes de fijar el commit.

## PENDIENTES DE ESTA TAREA

Ejecución focal efectiva sobre el SHA nuevo y revisión fija Parent/General; publicación/PR/CI a cargo de coordinación después de revisión. Sin resultado funcional local acreditado.

## FUERA DE ALCANCE DETECTADO

Producto TariffDrawer/DrawerShell/useDialogA11y, escenario de dos errores idénticos, otras pruebas, tipado/I2/#318, SQL/DB/producción y recuperación de lecturas omitidas. Ninguno se absorbe.

## HANDOFF AL DIRECTOR

Revisar las dos unidades fijas completas, el span único y su inversa, diff/preservación, Git y claim. Conservar las omisiones de ejecución. La escritura y el claim propios se cierran mediante el procedimiento acotado al terminar; el estado auténtico final se entrega por canal formal, sin autorreferencia de hash o retorno dentro de este archivo.

## Recibo de autoría y preservación

- Adopción durable antes del test: b71be9/exit0, 2026-10-25T22:55:09.9772610Z; este archivo se creó con CreateNew y readback WHOLE. Se conservó su preimagen inicial propia.
- Edición del test: una sola sustitución contextual, con old/new guardados antes de editar. Readback físico íntegro 2d31f1/exit0 a 2026-10-25T22:55:34.5201476Z: 20311 bytes, SHA256 f8f6256929bbc273c0cf49259fdc80b2ba532d5fd3f64926af1527318ba3f8fc.
- Span anterior y posterior: una ocurrencia cada uno; forward WHOLE e inversa WHOLE conformes contra el content físico preservado. La diferencia es 21 bytes ASCII; cero CRLF y 415 LF antes/después. Todos los otros caracteres/oráculos del archivo permanecen idénticos.

```diff
     expect(alerta).toHaveTextContent("Esa ruta ya no está activa");
-    expect(alerta).toHaveFocus();
+    await waitFor(() => expect(alerta).toHaveFocus());
```

No se agregó prueba de la implementación de este test ni se alteró otra aserción de foco. La revisión estática no sustituye el focal ausente: resultado funcional NO DISPONIBLE/NO EJECUTADO, cero invocaciones. Los inputs/retornos íntegros de setup, lecturas, adopción, preimagen, edición y comprobaciones Git quedan en custodia propia bajo claves de esta tarea; el FIN/claim auténticos posteriores se entregan externamente. No se recuperan lecturas de0571 ni se afirma su release/clean.
