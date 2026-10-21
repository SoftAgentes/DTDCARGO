# 0577 · Diagnóstico aislado del Portal observado en GO05B

## OBJETIVO ORIGINAL

Preparar un experimento acotado para discriminar O1–O4 conservados en la canónica
BCV GO05B, sin inventar una causa ni activar una reparación de PR #315. El corte
de producto y ambos tests es `ce7e628e46d8e4e59176c9a84171d44b46261d4d`.
GO0 autorizó aislamiento, dependencias propias, status local, documentos y
preparación revisable del mecanismo. GO04 ejecutó una única basal completa:
**30 PASÓ / NO REPRODUCIDO / CAUSA PORTAL NO DETERMINADA**. Vitest terminó EXIT0;
driver y launcher conservaron EXIT2 por supervisión UNKNOWN. GO05 cierra únicamente
la documentación; no hay reparación, nueva pasada o aceptación global de BCV.

Adopción explícita del 21 de octubre de 2026: AGENTS, skill Worker, runbook
codex-engineering y project-rules leídos completos desde este aislamiento.
La autorización específica prima sobre los pasos de cierre de producto de la
skill. GO05 sólo permite los dos documentos indicados abajo y su entrega Git/PR;
no inicia pruebas, ciclo de conocimiento o liberación del claim.

- Task: `0577-diagnostico-portal-go05b`.
- Sesión escritora: subagente `/root/memoria_traspaso`, Director `/root`.
- Owner: `worker-0577diag-01a15a4e-ddf0-7d82-8656-d9dc56b58468`.
- Raíz: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0577-diagnostico-portal-go05b`.
- Rama: `codex/sdd-0577-diagnostico-portal-go05b`.
- SDD: [0577](../../docs/specs/0577-contratos-pruebas-portal-embarques/spec.md), subfase diagnóstica GO05B.
- Claim adquirido `2026-10-21T19:36:46.049Z`, retenido por instrucción del Director.

Autoridad externa: `C:/tmp/director-traspaso-20261020/0577-diagnostico-go05b-asignacion-director.md`,
8969 bytes, SHA-256 `0db52256874df8bd31ef9ed0bc1bf2d0567f0b3a620ccb780a9ce91b8600035a`.
Fuentes de diagnóstico/preparación leídas completas:

- `0577-diagnostico-go05b-portal-peer.md`: SHA-256 `1c5669e6fd5f3cb9a7c6675909abe9dc854e17b9009f079dbe1e76fdb503f301`.
- `0577-go05b-diagnostico-operativo-preparacion.md`: SHA-256 `48862332ea4e51e7e4f28ed7420d2b92e88ceed2decc49eafbd70222a96939b9`.

Autoridad del cierre, leída completa:
`C:/tmp/director-traspaso-20261020/0577-go05-cierre-documental-director.md`, SHA-256
`210e7db0dd056fbd2021212a57281b5f7e4f85b2a36ea23ce800335a291ae9b0`.

Los intentos BCV 13144 pass/1 fail/1 skip y 13142 pass/3 fail/1 skip son evidencia
previa separada. La identidad de siete blobs de producto y configuración no
demuestra ausencia de defecto ni una causa de carga. **CAUSA NO DETERMINADA.**

## COMPLETADO

- Creación de rama/worktree nuevos con harness desde ce7; guard y ownership propios.
  El primer preflight se detuvo por un consumidor transitorio de lectura y se
  conservó; no se mató ni adjudicó un proceso ajeno. La revalidación dejó ruta/ref
  libres y ningún consumidor distinto observado antes de crear.
- Inventario inicial de 6357 archivos rastreados y sus bytes/hashes. Solo cinco
  plantillas `.env.example` presentes; no se copiaron ni leyeron valores secretos.
- Instalación propia congelada, sin lifecycle scripts, store bajo node_modules.
  No se usaron dependencias de otro árbol ni se modificó configuración global.
- Status local de conocimiento, separado de generación/publicación.
- En GO0, driver externo derivado del GO05A original, con diff completo y parseo PowerShell
  sin errores. Su manifiesto de preparación mantiene `executionAuthorized: false`
  y GO vacío; quedó preservado. La ejecución posterior utilizó otro paquete y GO.
- D0 documental `0b8e70faeb92f2f42a031faf3306e2ac7e9aa202`, sin producto o tests nuevos.
- Basal GO04 única sobre D0: mismos 30 casos completos, 2 workers/retry0, JSON y
  streams nativos. Cotejo individual de archivo/título/fullName: 30 únicos y 0 diferencias.
- Git capturado raw UTF-8 estricto/NUL: 6358 nombres exactos, 0 faltantes/extra/errores.
  Freeze antes/después: 6478 registros, 0 diferencias; incluyen 6466 entradas
  aprobadas y ocho controles. Hay posibles alias de separador: no son 6478 archivos
  físicos únicos. Producto, tests, configuración, runners, package y lock intactos.
- Aceptación limitada del Director del resultado funcional y custodia; turno pesado
  devuelto después de su revisión. Supervisión UNKNOWN histórica sin resolver.

Allowlist acumulada exacta: los dos tests `app/p/[token]/standard-format.test.tsx`
y `supplier-flow.test.tsx`, esta spec, `docs/specs/README.md` generado y este handoff.
**GO05 sólo autoriza la spec0577 y este handoff.** El índice no se edita. El handoff
histórico, prueba de Embarques, producto, tests, package/lock, config, runners y SQL
permanecen intactos. Preimágenes de los dos documentos conservadas externamente.

## VALIDACIÓN

| Comprobación | Resultado y alcance |
| --- | --- |
| Aislamiento/guard/claim | PASÓ sobre ce7; ruta/rama/owner propios. |
| Instalación | PASÓ, exit 0, 19:41:10.3066793Z–19:43:04.3622295Z. |
| Versiones | Node 24.20.0; Corepack 0.35.0; pnpm 12.14.0; Vitest 4.1.7. |
| Package/lock | Hashes anteriores y posteriores iguales; ningún auto-pin. |
| Status local | Consulta PASÓ con exit 0 en 28.65 s; `ok:false`, estructura/semántica INVALID; Archify/Obsidian PENDING. |
| Sintaxis del driver GO0 | PASÓ en aquella preparación, 0 errores; no se transfiere esa comprobación a los paquetes posteriores. GO04 no añadió una pasada parser/prefijo previa. |
| Documentos GO0 | PASÓ: generador/índice con 559 specs, docs:check y numeración (493 migraciones; avisos históricos conservados), exit0. El README generado no cambió. |
| Scope/integridad GO04 | PASÓ: D0 limpio; 6478 registros antes/después y 6466+8 aprobados sin diferencias. |
| Basal funcional GO04 | PASÓ: 30/30, 7+23; 0 fallos/omitidos/reintentos, dos workers; Vitest EXIT0. NO REPRODUCIDO, causa indeterminada. |
| Supervisión GO04 | INCOMPLETA: driver/launcher EXIT2, `DESCENDANT_IDENTITY_UNKNOWN`; no PID/birth/instante del candidato registrado. |
| Recursos GO04 | Ocho identidades conocidas AUSENTES a +15,959s del EXIT; no resuelve UNKNOWN histórico ni acredita censo universal. |
| Documentos GO05 | PASÓ: guard propio, diff-check, docs:check (559 specs), dos enlaces locales y 18 controles de tests/producto/config/vecino histórico intactos. Recibo y readback finales separados; no se ejecutaron pruebas nuevas. |
| Instrumental, fix, tipos/lint/verify/SQL/UI | NO EJECUTADOS por este diagnóstico y sin nuevo GO. |
| AST/semántica/mapa/preview/publicación finales | NO EJECUTADOS; status GO0 no actualiza esas capas. |

Comando de instalación medido: Node absoluto + Corepack `pnpm@12.14.0 install
--frozen-lockfile --ignore-scripts --store-dir node_modules/.pnpm-store-0577diag`.
`COREPACK_ENABLE_AUTO_PIN=0` y `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` se aplicaron
únicamente al hijo, sin mutar el padre. Los avisos nativos de descarga se conservan.

Package SHA-256 `2815e4c20ddf1fc694d6e73f2265dce914f35b50947a7af4658f465efbd272c9`;
lock SHA-256 `eabebef11f69785553da9c195e12f8e14f832a8d264749682e3bfa779f82f3ab`.

Los logs/recibos iniciales de versiones se conservan aunque su colector produjo
arrays con mensajes de progreso; el recibo normalizado separado toma las versiones
de los stdout nativos y no reemplaza esos originales.

Evidencia exclusiva en `C:/tmp/director-traspaso-20261020/0577-go05b-diagnostico-validation/`:
`go0-preparation-01/`, `go0-install-01/`, `go0-status-01/` y cierre documental D0.
El recibo final de preparación fija D0 y todos los hashes sin autorreferencia en Git.

### Secuencia preservada y alcance de la atribución

1. BASAL01 falló en preparación, antes de Vitest: cero casos. La captura heredada
   incompleta no se reconstruyó. El primer lanzamiento preflight-only posterior
   falló en la conversión exterior de fecha, antes del launcher: cero casos.
2. GO02 preflight-only capturó el error real de ruta: prefijo EXIT1, launcher EXIT2,
   identidad UNKNOWN con diferencia de 5 ticks. La observación independiente llegó
   a 63,056s, 3,056s sobre el cierre permitido. El archivo existía y no se declaró
   perdido, restauró, excluyó o cambió. Ese fallo y exceso quedan históricos.
3. GO03 observó una sola ruta, sin leer contenido HTML: literal/UTF-8 crudo/nombre
   físico coincidían en 67 unidades; el pipeline produjo 70 en el contexto IBM850.
   Colección EXIT0 y launcher EXIT2 por identidad no confirmada (8 ticks). No es
   diagnóstico retrospectivo de GO02 ni explicación de los fallos JavaScript.
4. GO04 utilizó una derivación revisada, sin cambiar el bloque Node/Vitest de 849
   bytes, archivos/aserciones/datos/topes. Inventario raw UTF-8 estricto/NUL, sin
   normalizar rutas o tocar Console/env. Nacimiento registrado/revalidado con la
   misma API .NET UTC exacta; CIM sólo para filiación separada, sin tolerancia.
5. GO04 arrancó 21:14:11.6450303Z; Node 21:14:20.5728540Z; EXIT nativo
   21:15:23.0533387Z. Actividad71,408s dentro600s, Node62,480s y Vitest58,80s internos.
   Driver observó recursos antes del hashing; cleanup5,430s. Sin terminaciones,
   pérdida de captura, otra basal o instrumentación.

El driver mantuvo `knownAlive:null` por `DESCENDANT_IDENTITY_UNKNOWN`; sus cuatro
identidades conocidas estaban ausentes. No registró PID, nacimiento o instante
del candidato no validado; no se reconstruyen ni adjudican a uno de los conocidos.
El launcher tuvo seis identidades conocidas ausentes y cero errores propios;
propagó EXIT2 del driver. La observación independiente de ocho identidades, todas
ausentes a +15,959s, preserva ese hueco histórico. No existe un resultado de
supervisión globalmente verde. El Director devolvió el turno tras revisión limitada.

El UNBOUND original tiene dos propiedades `limits` idénticas. La autoría del bound
abortó primero por reemplazo no único, sin escribir. Luego cambió sólo los cinco
campos efectivos autorizados; `limits[0]` final referencia GO04. El bloque anterior
permanece histórico; `files` y `preparationControls` son únicos y se preservaron
literalmente. Es un límite de formato, no una alteración del permiso o inventario.
Las incidencias de preparación y autoría externas conservan sus archivos originales.

### Evidencia sellada

Rutas relativas al directorio externo de diagnóstico citado arriba:

| Evidencia | SHA-256 |
| --- | --- |
| `basal01-preparation-failure-final.json` | `8287b6ba061a2ca7879d5657139093ef0fba14eb6184c060adc070efb96f4302` |
| `preflight-only-invocation-failure-final-01.json` | `654575cb8ef5ab3fcf201465e74f432987308c4432c1528e147c95c0f72aff8c` |
| `preflight-only-go02-final.json` | `22bfc12cf2ad431ca579efc35ee45d8e6a49a79c7be086df2866dc6f2b7589a4` |
| `path-probe-go03-final.json` | `9ef470adabaa602bb4dad8479899e53879b94e52c6b3afcbf553c6c7a2506ef8` |
| `basal-go04-binding-01/manifest-BASAL-GO04.json` | `b255bef28c170e3a697c475d34a311b33dae586a148c93f9e78f2b0d63a5f155` |
| `basal-go04-binding-01/invocation-GO04.ps1.txt` | `848ce55e457d30b8f968242bfb1a0345cff2237b7796b580162ed3d8afd5c142` |
| `basal-go04-closure-01/case-identity-comparison.json` | `5348ba9f0bdbfe16f57a20c56e1a3b71ff082fab5ffe3963c87883868e19d7c9` |
| `basal-go04-closure-01/integrity-comparison.json` | `46f85a1b3dbcc4bbd852e925fe87d1c5a7b92b66a0d47ed364103e2d4a36af96` |
| `basal-go04-final.json` | `b5442d7d0eefb6fef8afb8b7bd71266abef020e49d73e91097503f58a78fa76e` |
| `basal-go04-closure-01/RESUMEN.md` | `628c55785521c2b947052ab6383324a22d2afaafe62981fb592fd3aa8ffaf74c` |

`basal-native-02/` conserva JSON Vitest, streams originales, inventario y freeze;
`basal-launch-02/` conserva streams PowerShell, identidades y EXIT separados.
Firma ordinal de archivo + NUL + fullName, unión LF sin LF final:
`2627f7b421ac2ed25d70f15c029041201a4890a57a5efb10082c05b350ecb93a`.
La firma previa de oráculos ruta TAB título LF permanece
`01be1fd9dc6555cc0f6e83eb9be6fda8c23d44209dbccec5ace0c887ce0de016`;
son proyecciones distintas y no se comparan como el mismo hash.

Cotejos del Director en `C:/tmp/director-traspaso-20261020/`:
`0577-basal-go04-nativo-cotejo-director.json`, SHA-256
`c356255ccfecfa5db239004eda2ce920b9b0af7e5618e4d65c03021c1a62ab30`;
`0577-go04-cierre-cotejo-director.json`, SHA-256
`159dad7797739f9e8d8fd59a145698267021754f5f8c8995f40b959c93b49c55`.
Aceptan el resultado funcional y custodia con los límites, sin eliminar UNKNOWN.

## COMMITS

Base ce7 inmutable. D0: `0b8e70faeb92f2f42a031faf3306e2ac7e9aa202`.
El cierre GO05 sólo cambia spec y este handoff; su SHA final, padres y diff completo
se fijan en el recibo externo `go05-documental-01/`, evitando autorreferencia en Git.
No hay commit de producto, pruebas o instrumentación. PR #315 queda intacta.

## PR / BRANCH

Rama propia indicada arriba; una única PR diagnóstica DRAFT autorizada contra
`codex/sdd-0569-bcv-carga-diaria`. Base remota revalidada:
`b179363d320aff9ada7b79d1f607b07d9b084a63`; merge-base real ce7. El destino incluye
tres documentos de cierre posteriores, con producto ce7 idéntico. No se afirma
haber ejecutado las pruebas sobre b179 ni se compone/rebasea la rama propia.
La PR debe mostrar exactamente spec y este handoff desde ce7; cualquier otro delta
detiene publicación. Readback remoto/draft/cuerpo/archivos/checks queda en el recibo
externo; checks vacíos no significan PASÓ. No hay merge ni despliegue autorizado.

## PENDIENTES DE ESTA TAREA

1. Cotejo del Director de la entrega documental/PR DRAFT y decisión de integración
   separada. Claim retenido hasta instrucción expresa; no limpiar rama/worktree.
2. Conservar el límite histórico de supervisión UNKNOWN sin candidato identificado.
   Este diagnóstico no autoriza repararlo o reinterpretarlo como cero procesos.
3. La investigación acotada termina aquí: no más basal/prefijo/parser/instrumental,
   fix/retry/canónica/UI/HTTP/DB. Una corrida futura requiere un objetivo o causa
   nuevo y decisión específica; no repetir la misma fuente para buscar verde.
4. Conocimiento guardado en spec/handoff y respaldo Git/PR son capas separadas de
   integración. Estructura Graphify, semántica, Archify, preview local, publicación
   Obsidian y revisión visible finales: NO EJECUTADAS en GO05. Se propone al Director
   un turno futuro acotado; no se generan ni copian derivados aquí. GO0 conserva
   su medición INVALID/INVALID/PENDING/PENDING, sin promesa de vigencia posterior.
5. SDD sigue in-progress por las aceptaciones históricas de composición/conocimiento
   de su entrega original; el cierre del diagnóstico no las satisface por reflejo.

## FUERA DE ALCANCE DETECTADO

Reparación compartida temprana PR #315, cierre global BCV, su ledger de release,
los demás pasos del plan financiero y conocimiento compartido. La canónica BCV
sigue FALLÓ/INCOMPLETA, 16/17; sus intentos fallidos no se sustituyen por esta basal.
Las pruebas posteriores deberán corresponder a la futura composición CORE
propagada y su SHA. No se asigna aquí un arreglo de producto, causa temporal o
repetición de la canónica de la misma fuente.

## HANDOFF AL DIRECTOR

GO04 ejecutó la variante ce7, incluido standard-format procedente de C2, con los
30 casos originales aprobados. No se reprodujo el fallo ni se determinó su causa;
supervisión EXIT2/UNKNOWN conservada. El Director aceptó sólo ese alcance y devolvió
el turno pesado tras su cotejo. GO05 guarda el resultado en dos documentos y una PR
DRAFT dependiente de BCV; el claim permanece retenido, árbol quieto al entregar.

Gobernanza: cumplimiento de aislamiento, allowlist, evidencia y separación de
aceptaciones. No aplica cambio de comportamiento Studio, UI o datos personales:
no se cambia producto ni se usan datos reales. Supervisión incompleta se declara,
sin excepción nueva, tolerancia de identidad o permiso productivo. La entrega
documental no convierte los intentos BCV en verde ni autoriza otra investigación.
