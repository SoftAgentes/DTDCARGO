# Control formal — respaldo DRAFT web 0579–0581

Fecha: 2026-10-23, America/Caracas. Actor: Director /root como publisher, sin nueva autoría de producto.
Estado: COMPLETADO exclusivamente para respaldo y creación DRAFT; aptitud productiva NO APROBADA.
Rama propia de registro: codex/plan-mejoras-web-20261023. Owner de coordinación reutilizado: director-ads-traza-real-20261023.
Contrato: DIRECTOR-WEB-DRAFT-CLOSE-0579-0581-20261023-01.
Paquete exacto revisado: aa0bd4d14fc02ff5b5d81daf38b429964affbd38.
Base revisada y leída remotamente: d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8, main.

## Autoridad y fases

Se recibió contrato nominal y después EJECUTA separado para tres push normales de SHA a las ramas originales y tres PR DRAFT independientes con base main. Antes de publicar se leyó directamente el pedido humano en DIRECTOR ORQUESTADOR, thread 01a160e3-92b0-76f0-bc3c-20000e81ff16, turno 01a16a50-782c-7203-9e23-1dfd2d8bcf8c, mensaje 01a16a52-2ac7-7010-9f32-1bfd3100491a: dejar las otras ventanas listas con sus PR y checklist antes de continuar tareas. La continuación humana consta en 01a16a57-1be6-7770-a276-986dfbb832aa.

Esta fase específica sustituye solo la prohibición de push/PR de la fase local anterior. Los handoffs Worker y el paquete aa0bd4d conservan aquella foto histórica sin reescribirse. No habilita merge, auto-merge, ready-for-review, despliegue, producción/DB, cuentas Ads/Analytics, expansión CSP, nuevos Writers/modelos o pruebas/build/UI/knowledge manuales. La CI automática de PR queda dentro del respaldo autorizado.

## CONTROL FORMAL antes de custodia

Control emitido 2026-10-23T20:25:42.301Z, equivalente a 16:25:42.301 del 23-oct en Caracas, ANTES del índice de custodia. Se confirmó salida nativa 0 de las seis operaciones: tres git push normales y tres gh pr create --draft. Ninguna llamada mutante se repitió. No hubo STOP por divergencia, PR existente o cambio de cabeza.

| SDD | PR | SHA remoto exacto | Archivos | Estado confirmado |
|---|---|---|---:|---|
| 0579 | [#322](https://github.com/SoftAgentes/DTDCARGO/pull/322) | d069b5b26df962b25f6476bfd7c3c626c4764be2 | 16 | OPEN / DRAFT |
| 0580 | [#323](https://github.com/SoftAgentes/DTDCARGO/pull/323) | c2a933aac5ad8bc6ce3b8d78688e2dcaae9dc780 | 17 | OPEN / DRAFT |
| 0581 | [#324](https://github.com/SoftAgentes/DTDCARGO/pull/324) | 6e3bbfbe560e97ec216d43788062b490c3cd6bd1 | 15 | OPEN / DRAFT |

Las tres PR se adjuntaron con attach_artifact. Una lectura independiente list_artifacts confirmó sus tres URLs e identidades en esta tarea, sin inferirlo del éxito de creación.

### Entradas y resultados nativos

Git nativo: C:/Program Files/Git/cmd/git.exe. GitHub CLI nativa: C:/Program Files/GitHub CLI/gh.exe. No había core.hooksPath configurado ni pre-push activo en el repositorio; no se omitieron hooks mediante no-verify.

Push normal por entrada: git push origin SHA:refs/heads/RAMA_ORIGINAL, sin force, sin rebase y sin actualizar main. No se cambió upstream ni configuración del remoto. El remoto antiguo de hailuwaycom-sketch respondió con aviso de traslado a SoftAgentes; el push normal funcionó y las PR usan la URL canónica comprobada. No se modificó origin para resolver ese aviso.

Create por entrada: gh pr create --repo SoftAgentes/DTDCARGO --base main --head RAMA_ORIGINAL --draft --title TITULO_EXACTO --body-file ARCHIVO_UTF8_PROPIO. Títulos y cuerpos se extrajeron del blob aa0bd4d del checklist aprobado; no se usó fill ni se reescribieron. Los archivos body son temporales pequeños, sin BOM ni salto final añadido.

Los JSON input contienen exe/argv/cwd/cabeza esperada/paquete y fecha reales. Los JSON result conservan preflight inmediato, PID nativo, inicio/fin, status/signal, stdout y stderr originales. Los .stdout.txt/.stderr.txt correspondientes se preservan sin normalizarlos.

| SDD | Push PID / native exit | Inicio → fin UTC | Create PID / native exit | Inicio → fin UTC |
|---|---|---|---|---|
| 0579 | 8124 / 0 | 2026-10-23T20:20:39.516Z → 2026-10-23T20:20:42.551Z | 36500 / 0 | 2026-10-23T20:20:51.581Z → 2026-10-23T20:20:54.489Z |
| 0580 | 42752 / 0 | 2026-10-23T20:22:17.432Z → 2026-10-23T20:22:20.302Z | 37420 / 0 | 2026-10-23T20:22:48.862Z → 2026-10-23T20:22:51.073Z |
| 0581 | 35532 / 0 | 2026-10-23T20:24:06.337Z → 2026-10-23T20:24:08.389Z | 41172 / 0 | 2026-10-23T20:24:41.765Z → 2026-10-23T20:24:44.729Z |

### Preflight y readbacks independientes

Antes de cada publicación: cabeza, rama y árbol limpio exactos; claim Worker ausente; 16/17/15 rutas comparadas contra la allowlist literal del paquete; remoto de main exacto y rama destino ausente o idéntica; consulta GitHub por head y todos los estados sin PR existente. La misma cabeza/limpieza/remoto/ausencia de PR se revalidó inmediatamente antes de cada push y create. Las tres ramas remotas estaban ausentes en su preflight inicial.

Cada PR pasó dieciocho comprobaciones después de crearla: OPEN, DRAFT, head/headRef, base/baseOid, título y cuerpo exactos, paths por GraphQL y por REST, número de rutas, head remoto por Git, main remoto, head/rama/limpieza locales, mergedAt null y autoMergeRequest null. Son controles de publicación, no pruebas de producto ni checks CI.

Los readbacks usaron gh pr view, API REST de archivos y git ls-remote por vías independientes del resultado de create. Los hashes UTF-8 de los cuerpos leídos de GitHub coinciden con los archivos extraídos del paquete:
- 0579: c6b9ad764e744b2447f6ed409663b8c4e6aedea6c4c713ba25637f409007e759.
- 0580: a108a9a849c03b44e3d814342328e6596252134c0a1ad5171f6f5335718b7f18.
- 0581: c9d1181975e9814dbd954caf445f9428a84a1590ff6a14567ddf55dd3555707f.

## Observación final y CI

La observación final terminó 2026-10-23T20:26:39.623Z, equivalente a 16:26:39.623 Caracas. Confirmó otra vez tres PR OPEN/DRAFT, sus tres heads originales, base d410ab2e2, sin merge ni auto-merge, y tres worktrees limpios/claims ausentes. Main y origin remoto siguen d410ab2e2; los dos untracked previos de main (.pnpm-store y PDF DPA) se preservan sin leer el PDF.

| SDD | Estado CI observado | Enlace |
|---|---|---|
| 0579 | IN_PROGRESS | [Calidad continua](https://github.com/SoftAgentes/DTDCARGO/actions/runs/40018526305/job/120636745111) |
| 0580 | IN_PROGRESS | [Calidad continua](https://github.com/SoftAgentes/DTDCARGO/actions/runs/40018778021/job/120637603788) |
| 0581 | IN_PROGRESS | [Calidad continua](https://github.com/SoftAgentes/DTDCARGO/actions/runs/40019024040/job/120638438639) |

Las tres conclusiones estaban vacías porque sus CheckRun seguían IN_PROGRESS. No se presenta ese estado como CI verde ni como aprobación de release. No se disparó manualmente workflow alguno ni se esperó/repitió una prueba desde esta sesión.

## Preservación de tarea y límites

- 0579: owner original worker-0579-promesas-seguimiento; rama codex/0579-promesas-seguimiento-web-kommo; WT C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0579-promesas-seguimiento-web-kommo.
- 0580: owner original worker-0580-cta-movil; rama codex/0580-shipping-mark-cta-movil; WT C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0580-shipping-mark-cta-movil.
- 0581: owner original worker-0581-ads; rama codex/0581-medicion-ads-csp-offline; WT C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0581-medicion-ads-csp-offline.

No se reclamó ni editó ningún worktree Worker. No hubo nuevos commits de producto, mezcla de ramas, cambio de autores ni publicación de la rama de coordinación. El único cambio rastreado de esta fase es este artefacto propio; se registra en commit local selectivo y luego se libera su claim. No se archivan ni borran ramas/worktrees.

Los canónicos históricos siguen tal como están en aa0bd4d y en los cuerpos exactos de las PR: 0579 FALLÓ/INCOMPLETO, 0580 FALLÓ/INCOMPLETO y 0581 doce pasos medidos PASÓ/cierre INCOMPLETO más wrapper exit 1 y recheck focal 36/36. Las cinco omisiones no se absuelven con el respaldo ni con checks en progreso.

Las rutas de producto continúan separadas. Marketing README e índice de specs son los dos archivos compartidos; no se probó una combinación ni se resolvieron conflictos por adelantado. Los recibos de conocimiento siguen sus revisiones y pendientes históricos, sin nueva ejecución.

La traza real de pagead2 permanece INCONCLUSA / NO DISPONIBLE por conectividad del entorno, separada del arreglo de cookie de 0581. No se repitió ni se amplió CSP. Recepción/atribución/contabilización en Google, Kommo, datos privados y producción siguen fuera de esta publicación.

## Evidencia y custodia pequeña

Directorio propio: C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw.
El control formal se escribió antes del índice. Custodia de 37 archivos originales, 117915 bytes en total; máximo por archivo 17162 bytes. El índice se excluye a sí mismo para evitar recursión. No se copiaron payloads bloqueados, operadores ajenos, secretos, documentos privados ni fuentes de otros frentes.

- [Control formal](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/control-formal.json>).
- [Observación final](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/final-observation.json>).
- [Manifest de inputs y cuerpos](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/manifest.json>).
- [Readback de adjuntos](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/attachments-readback.json>).
- [Índice de custodia](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/custody-index.json>), SHA-256 9cd0f61a9a855c1ba07a3e4e33c1e510d57d0d64909195269688e00d8f34e6ec.
- 0579: [push input](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0579.push.input.json>), [push result](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0579.push.result.json>), [create input](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0579.create.input.json>), [create result](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0579.create.result.json>), [readback](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0579.readback.json>).
- 0580: [push input](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0580.push.input.json>), [push result](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0580.push.result.json>), [create input](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0580.create.input.json>), [create result](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0580.create.result.json>), [readback](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0580.readback.json>).
- 0581: [push input](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0581.push.input.json>), [push result](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0581.push.result.json>), [create input](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0581.create.input.json>), [create result](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0581.create.result.json>), [readback](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-draft-close-0579-0581-Q0MZfw/0581.readback.json>).

Los recibos completos se conservan localmente, fuera del repositorio; el núcleo del control queda durable en este documento Git local y las PR son el respaldo remoto de los tres SHA. La custodia local no se declara publicada o respaldada remotamente.

## Siguiente acción mínima

Revisión técnica de las tres PR y resultados de su CI automática; mantener DRAFT mientras se evalúan alcance, canónico y combinación. Este cierre no autoriza reparar fallos de CI, activar otro Worker, cambiar CSP, integrar o desplegar. Si una cabeza/base cambia, caduca esta revisión de publicación para ese nuevo estado y debe registrarse la diferencia.

Cierre del publisher: diff-check del único artefacto propio, commit local selectivo, árbol limpio y release del mismo claim de coordinación. SHA del commit que contiene este documento se informa al entregar; sin recursión documental.
