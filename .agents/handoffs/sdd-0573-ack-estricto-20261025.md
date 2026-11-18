# SDD-0573 · ACK estricto de anulación de factura

Owner: worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
Sesión: 01a1601e-d9fd-7280-8977-6b5d4719a99b, /root/worker_0573_core.
Estado: candidato local para revisión; validación funcional pendiente.
Autoridad: DIRECTOR-ACK-EXPLICIT-HUMAN-ONE-NEW-METADATA-CHECK-20261026, continuidad expresa del MISMO ACK. Sam respondió «Sí, una sola comprobación nueva de metadata (Recomendado)». El cambio y pruebas conservan el scope P2-B y las precisiones posteriores de General.

WT REAL: C:/Users/AKX generator/.codex/worktrees/sdd-0573-ack-estricto-20261025/DTDCARGO.
Rama: codex/sdd-0573-ack-estricto-20261025.
Base: a1a8e966cb4f00de52b14ffe2d3e45a5c455e84d; tree a273c924c181fe3f798c3e16a6e35e2c581c12e0; padre bdb68a6187c682fa00066806453be48690e4bd36.
SDD existente: docs/specs/0573-reverso-al-anular/spec.md; sin nuevo ID.
Claim NUEVO propio:201bytes/SHA2568ddb8c41fc94509b02315bc1687cdc4ce97c83906fd8fe4ef9465047b0bf8d77, creado a2026-10-26T01:33:23.3495775Z en metadata Git DTDCARGO12/harness-session-claim.json. Cierre/liberación y SHA del commit se acreditan después en recibo externo, sin anticiparlos ni autorreferencia.

## OBJETIVO ORIGINAL

Confirmar anulación sólo con ACK booleano true y transporte error:null. Diferenciar false válido de un resultado no confirmado; conservar errores nativos, efectos previos de crédito y todos los guards existentes. Exactamente tres rutas: actions.ts (sólo voidInvoice), su test ACK y este handoff nuevo.

## COMPLETADO

En voidInvoice se conserva primero la rama de error nativo, incluso si data es true. Sólo error:null y changed:true llegan a las tres revalidaciones finales y ok:true. false mantiene su mensaje de rechazo válido. null,undefined,{},[],[false],"false",1 y transporte de error distinto de null no habilitan éxito.

El mensaje nuevo dice que no se pudo confirmar la anulación y pide revisar su estado antes de intentar de nuevo. No afirma rollback/ausencia de efecto; no añade retry, compensación, readback, fallback ni otra RPC.

La reversión previa del crédito permanece en su lugar. Si ya liberó crédito, se conserva la revalidación previa de Fidelización y yaLiberado; sólo se bloquean las tres finales Facturación/detalle/Contabilidad. La rama22023/audit:reason ahora también incorpora yaLiberado, con el mensaje saneado4–1000 intacto.

No cambian RBACinvoices, tenant, paid/anulada, conteo conocido de recibos con sus tres filtros, motivo normalizado, payloadp_id+p_reason, avisos de los éxitos ni manejo de rechazo de promesas SDK. No se cambió SQL ni ninguna transacción.

## ORÁCULOS FICTICIOS

Se mantienen todos los escenarios anteriores. El doble devuelve data y error exactamente, sin coerción. El tipo del error del doble admite además undefined/false para representar transporte inválido.

| Grupo nuevo | Exigencia definida antes de cada llamada |
|---|---|
| Siete valores no booleanos, con/sin crédito | NO CONFIRMADO, una RPCvoid exacta, no ok/warning de factura anulada ni tres revalidaciones finales; sólo Fidelización previa cuando corresponde. |
| data:true con error nativo, con/sin crédito | Error prevalece, detalle técnico no se filtra, una RPC y avisos previos conservados. |
| error undefined/false con data:true, con/sin crédito | Transporte no acredita éxito; misma frontera de revalidación y no repetición. |
| false con crédito liberado | ACK negativo válido, distinto de NO CONFIRMADO; aviso y Fidelización previa conservados. |
| reverted1 +22023/audit:reason | Motivo saneado y yaLiberado juntos; sin éxito final ni filtración del detalle ficticio. |

Los universos, strings y tablas de casos son FICTICIOS; no acreditan dinero, asientos o transacciones reales. El helper de expectativas exige payload exacto, orden de pasos y revalidaciones completas; ninguna expectativa se calcula con la respuesta productiva.

## EVIDENCIA NUEVA Y LECTURAS

ÚNICA comprobación nueva inicial c9ed82/exit0, terminal a2026-10-26T01:30:29.7963578Z: origen fijo conforme, rama nueva ausente, perfil de setup ausente, core.hooksPath no configurado/post-checkout ausente. Input NUEVO independiente y retorno ENTERO en 0573-ack-human-r1:one-new-metadata-check.
No se cargó/reemitió/reconstruyó el preflight ACK anterior, authority-adoption, inputs/salida/contexto/sesión. Conserva su lectura PARCIAL y Native/exit/sesión/predicados NO ACREDITADOS. El check nuevo no llena ese límite.
ManagedWT nuevo desdeA1a; setup normal dcd9d3/0 verificó sieteGit individuales, creó rama propia y claim CreateNew/readback antes de editar.
Lecturas críticas ENTERAS: testbase4b463f/0, voidInvoice5476bc/0, imports/declaraciones389b3a/0, patrónvoidEntry c4a176/0, reason5594a9/0 y referral-notice d56d22/0. Test nuevo ENTERO04ee86/0; voidInvoice nueva ENTERA09b139/0. No cuerpo ajeno completo de actions ni fuentes excluidas.

## PRESERVACIÓN

Actions base44616bytes/blob09676f8c84ac75d279af82a182a13a114402c1ed/SHA256132633f2955a88947a1104cc6432bde1d4cd3afc7a9867c38aa176d04cdcf991.
Actions nuevo45012bytes/SHA256c7f415367a7315afd4a6e6192499694f50b0b990ab0dced2c5afe763502a6aa5.
Test base17746bytes/blob406d7553a5722e5bc425796af2e3422f23e6e3b8/SHA256daa0f5d7f46d3222539951c80557a42e12fffe2976bc92b333b91134dc2809ff.
Test nuevo22839bytes/SHA256ea9ef94ea550fad20d14bb4a822b8f8e5b295eb84ae305e44e341f154460783b.

Nativef063d2/0 acredita inversas BYTEWHOLE: actions sólo dos spans de voidInvoice; todo lo externo idéntico. Test previo idéntico salvo ampliar el tipo del error del doble; nuevos casos sólo al final. Sin borrar oráculos, skip, any/ignore o cambios en otras unidades. diff --check PASÓ. La preservación final de otros blobs/árbol y claim se entrega en recibo externo final.

## VALIDACIÓN

Focal local NO DISPONIBLE / NO EJECUTADA: dcd9d3/0 observó node_modules y node_modules/vitest/vitest.mjs ausentes en ESTE WT. Cero Node/Vitest/SQL. No instalación/copia/junction/otroWT ni versión adicional. Versiones Node/Vitest NO MEDIDAS en esta tarea.
Input completo PREPARADO-NO INVOCADO, guardado en 0573-ack-human-r1:focal-NOEJ:

{
  "cmd": "& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' node_modules/vitest/vitest.mjs run 'app/studio/(app)/facturacion/__tests__/void-invoice-referral-warning.test.ts' --maxWorkers=1 --no-file-parallelism --reporter=verbose",
  "shell": "C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe",
  "login": false,
  "tty": false,
  "workdir": "C:/Users/AKX generator/.codex/worktrees/sdd-0573-ack-estricto-20261025/DTDCARGO",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}

Retorno/error/Nativeexit/sesión de la focal:null por NO INVOCADA, no por estado desconocido; no existen tiempos de ejecución que heredar. Todos los grupos nuevos siguen NO EJECUTADOS. No se ejecutó compilación, verify, suites47/29 ni CIa1a. El TypeScriptPASÓ/UnitariosFALLÓ deA1a conserva su atribución; no se transfiere un pase aACK.

Incidentes preservados:
- Construcción inicial del literal del patch: ReferenceError current is not defined, antes de store/validación/await/herramienta. No Native ni edición invocados en esa construcción. El input exterior no quedó guardado prospectivamente; su toolcall es el registro disponible, sin wrapper reconstruido. Se corrigió la delimitación de strings del nuevo input literal, no el comportamiento del producto.
- bb440f/1: ambas inversas pasaron y diffcheck detectó sólo una línea vacía nueva alEOF del test. Se retiró esa línea sin cambiar aserciones; f063d2/0 pasó después. No fue una suite funcional.

## GOBERNANZA

Skillworker y governance-check aplicadas. AGENTS/runbook/AGENT-BRIEF/registro/project-rules cotejados por pins idénticos a unidades completas ya leídas; SGE-00v1.0 cotejada; ERR-01v1.0 y AUD-01v1.0 leídas completas.
RiesgoR3 del dominio; este delta sólo trata su confirmación/copy. SGE00.05 cumplimiento estático por guards conservados; .07/.11 cumplimiento estático por ACK estricto y mensaje no afirmativo con efecto previo explícito. Verificación funcional pendiente. AUD-01: RPC y motivo conservados, sin nueva auditoría ni atomicidad certificada. ERR-01: copia saneada y recuperación explícita, sin detalle crudo en los negativos. No cambio de UI/estilo/foco/patrón ni clasificación MP-01; esos principios no aplican a este delta.

La referencia derivada policy-registry.json no existe en el path de la skill (93f20b/0); no se buscó otra ruta ni se recreó. Se usó el registro canónico ya leído. Validador Node del plugin NO EJECUTADO: la autorización es focal y las dependencias faltan, no permiso para Nodegestor. No se declara governance global PASÓ.
Graphify/Archify/Obsidian/gestores/inventarios y automatización continúan suspendidos. Guardado de tarea, integración y publicación compartida siguen separados.

## COMMITS / PR / BRANCH

El commit que contiene este documento fija sólo dos modificaciones y este alta, con padre directo A1a. Identidad final y liberación exacta del claim se entregan externamente después del commit.
No push/PR/head-base320/main/merge/deploy/DB por Worker. Parent revisa fijo y coordina backup normal de esta rama según autoridad; General decide composición posterior con Reportes y CI NUEVA.

## PENDIENTES DE ESTA TAREA

Revisión fija semántica y aceptación funcional mediante CI nueva por General. No se acreditan ejecución local, efectos reales, atomicidad conjunta ni estados financieros. El incidente de input exterior no preguardado conserva su límite propio para revisión.

## FUERA DE ALCANCE DETECTADO / HANDOFF AL DIRECTOR

Reportes15d sigue con lectura PARCIAL841; no se recuperó ni se incorporó a esta rama. #318sin autoría conservaWTdetached; freshI2 requiere ACKREAL revisado/publicado y una base que Root fije después. No placeholder ni trabajo por recurso libre.
Conservar todos los consumidores previos, B4, fuentes y STOP. AutomatizaciónPAUSED. 2.1/QPG17/B y conversión funcionalUSD siguen abiertas. Tras FIN/control y quietud no se adelanta otra tarea.
