# 0577 · Diagnóstico aislado del Portal observado en GO05B

## OBJETIVO ORIGINAL

Preparar un experimento acotado para discriminar O1–O4 conservados en la canónica
BCV GO05B, sin inventar una causa ni activar una reparación de PR #315. El corte
de producto y ambos tests es `ce7e628e46d8e4e59176c9a84171d44b46261d4d`.
GO0 solo autoriza aislamiento, dependencias propias, status local, documentos y
preparación revisable del mecanismo. Basal e instrumental esperan GO concreto.

Adopción explícita del 21 de octubre de 2026: AGENTS, skill Worker, runbook
codex-engineering y project-rules leídos completos desde este aislamiento.
La autorización específica prima sobre los pasos de cierre de producto de la
skill: no inicia pruebas ni ciclo de conocimiento durante esta preparación.

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
- Driver externo derivado del GO05A original, con diff completo y parseo PowerShell
  sin errores. Su manifiesto de preparación mantiene `executionAuthorized: false`
  y GO vacío; por lectura falla cerrado antes de operar el árbol. No se ejecutó.
- Esta spec y handoff delimitan GO0. El índice solo se regenera con su entrada Node.

Allowlist acumulada exacta: los dos tests `app/p/[token]/standard-format.test.tsx`
y `supplier-flow.test.tsx`, esta spec, `docs/specs/README.md` generado y este handoff.
**Ahora solo los tres documentos pueden cambiar.** El handoff histórico, prueba
de Embarques, producto, package/lock, config, runners y SQL permanecen fuera.

## VALIDACIÓN

| Comprobación | Resultado y alcance |
| --- | --- |
| Aislamiento/guard/claim | PASÓ sobre ce7; ruta/rama/owner propios. |
| Instalación | PASÓ, exit 0, 19:41:10.3066793Z–19:43:04.3622295Z. |
| Versiones | Node 24.20.0; Corepack 0.35.0; pnpm 12.14.0; Vitest 4.1.7. |
| Package/lock | Hashes anteriores y posteriores iguales; ningún auto-pin. |
| Status local | Consulta PASÓ con exit 0 en 28.65 s; `ok:false`, estructura/semántica INVALID; Archify/Obsidian PENDING. |
| Sintaxis de driver externo | PASÓ, parser PowerShell, 0 errores; no ejecución del driver. |
| Documentos | PASÓ: generador/índice con 559 specs, docs:check y numeración (493 migraciones; avisos históricos conservados), exit 0. El README generado no cambió. |
| Scope/integridad D0 | Diff-check PASÓ; solo spec y este handoff cambian. El recibo externo por checkpoint debe cotejarse antes del GO basal. |
| Basal 30, instrumental, fix | NO EJECUTADOS; falta autorización específica. |
| Tipos/lint/verify/SQL/UI | NO EJECUTADOS y fuera de GO0. |
| AST/semántica/mapa/preview/publicación | NO EJECUTADOS; status no actualiza esas capas. |

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

## COMMITS

Base ce7 inmutable. El checkpoint documental D0 será el commit que contenga este
handoff, fijado por SHA en el manifiesto externo y comunicado al Director. No hay
commit de producto, pruebas ni instrumentación. No se altera ni mueve PR #315.

## PR / BRANCH

Rama propia indicada arriba. Publicación autorizada como respaldo parcial; la PR
diagnóstica, si hace falta, será DRAFT contra `codex/sdd-0569-bcv-carga-diaria`.
No hay merge ni despliegue autorizado. No se transfiere un verde entre bases.

## PENDIENTES DE ESTA TAREA

1. Director coteja D0/manifiesto, driver/diff y namespace aún ausente; después
   puede conceder GO basal concreto. El manifiesto GO0 no contiene ese permiso.
2. Una sola basal con 30 identidades exactas, 2 workers/retry 0 y los límites
   existentes; conservar JSON/streams/EXIT/integridad/identidades de recursos.
3. Solo con reproducción calificada O1–O4 proponer el diff instrumental y recibir
   GO separado. Un resultado verde implica NO REPRODUCIDO, no causa resuelta.
4. Actividad máxima 10 minutos desde preflight, guarda pre-spawn, observación del
   deadline a cargo del Worker: no existe watchdog automático. Interrupción solo
   por identidad/creación/filiación propias vigentes; cleanup separado y aviso si
   persiste a 60 segundos. No actuar por nombre de proceso ni PPID aislado.
5. Conservar y restituir bytes exactos de ambos tests tras cualquier instrumental
   futura autorizada. Cerrar recursos, documentar límites y liberar claim al cierre
   que indique el Director. Nada de lo anterior está implícitamente ejecutado.

## FUERA DE ALCANCE DETECTADO

Reparación compartida temprana PR #315, cierre del paso unitario BCV, su ledger de
release, los demás pasos del plan financiero y conocimiento compartido. No se
asigna aquí un arreglo de producto ni se diagnostica una causa temporal.

## HANDOFF AL DIRECTOR

GO0 prepara el experimento; no certifica los 30 casos. Se conserva la variante ce7,
incluido standard-format procedente de C2, para no comparar fuentes diferentes.
Gobernanza: cumplimiento de aislamiento/allowlist y evidencia; no aplica cambio
de comportamiento Studio, UI o datos personales porque GO0 solo documenta y
prepara tooling externo. No hay excepción ni permiso productivo nuevo.
El turno de preparación y sus recursos se devuelven por recibo externo; el claim
permanece retenido para revisión y continuidad conforme a la asignación.
