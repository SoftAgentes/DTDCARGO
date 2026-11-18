# SDD0572 · suma USD exacta · corrección local #310

Fecha: 2026-10-26. Estado de tarea: candidata local para revisión; validación funcional pendiente.
Owner: worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
Sesión: /root/worker_0573_core · 01a1601e-d9fd-7280-8977-6b5d4719a99b.
WT: C:/Users/AKX generator/.codex/worktrees/fx-suma-exacta-20261026/DTDCARGO.
Rama: codex/sdd-0572-suma-usd-exacta-20261026.
Base: a30d85859c788070ffc3459a29e389cab015c7eb.
Tree base: 7b9401844c02d65fabba748ed1b70c3a5712a888.
Padre de la base: 1f1b9e8e8e3399afe96bd14330f747e9a85bf7ce.
SDD: docs/specs/0572-conversor-usd-reemplazos/spec.md, in-progress.

## OBJETIVO ORIGINAL

Conservar { usd: number, sinConvertir: number }, acumular centavos exactos antes
de cualquier Number intermedio y rechazar explícitamente un total final que
no conserve centavos. Mantener monedas, tasas, tope y redondeo individual mitad
lejos de cero; evaluar cancelaciones sobre el total final.

Autoridad humana nominal de #310 y continuación expresa
DIRECTOR-0572-PR310-CONTINUACION-CON-CHECKOUT-FISICO-ACREDITADO-20261026.
Root materializó el checkout físico en la MISMA reserva. El intento original
CreateProcess/os267 sigue fallido antes del proceso: no se recuperó su captura,
operación, sesión o cuerpo. Esta continuación sólo ejerce su guard nuevo.
#311 y #313 permanecen tareas distintas; CI320 es carril del Director.

## COMPLETADO

- El redondeo decimal interno entrega centavos BigInt. convertirACentavos
  conserva validación, prioridad de causas, monedas y tasa de la conversión.
- toUsd mantiene firma, resultado numérico individual y sus fallos, incluso -0
  por un importe negativo que redondea a cero. usdOrNull mantiene su contrato.
- sumarEnUsd acumula esos enteros sin pasar cada documento por Number. Sólo al
  final construye el número decimal y coteja exactamente sus centavos mediante
  String(number) y toFixed(2). Se revisan ambas representaciones: un texto corto
  puede ocultar pérdida al presentar dos decimales.
- Si no son finitas o no reconstruyen el mismo total, lanza RangeError:
  sumarEnUsd: total fuera de rango para conservar centavos
- No confunde overflow con falta de tasa, no aumenta sinConvertir por rango,
  no devuelve cero/null/subtotal redondeado y no rechaza prefijos grandes que
  después se cancelan. Tampoco impone MAX_SAFE_INTEGER al acumulador exacto.
- Focal existente conservada BYTEWHOLE como prefijo, más 17 casos nuevos
  definidos mediante tablas finitas. El test compartido de toUsd no se editó.
- La SDD recibe una sola sección fechada de contrato y evidencia; sus narrativas
  anteriores de producción/migraciones y estado in-progress quedan intactas.

Allowlist exacta, sin quinto archivo:

1. lib/shared/fx.ts
2. lib/studio/__tests__/gastos-y-pagos-en-usd-0572.test.ts
3. docs/specs/0572-conversor-usd-reemplazos/spec.md
4. .agents/handoffs/0572-suma-usd-exacta-20261026.md

## Compatibilidad y oráculos independientes

| Grupo ficticio | Oráculo fijado | Estado funcional actual |
|---|---|---|
| A · 25.35USD + 700CNY/7 + cero | usd125.35, sinConvertir0 | NO EJECUTADO |
| B · 90×999999999999.00 + 70000000000 + 1992547499.93 | 9007199254740993ct, 2^53+1; RangeError específico | NO EJECUTADO |
| C · cada documento, prefijo, última entrada | convertibles; prefijo90069999999910, última1992547499.93; una falta real de tasa cuenta1 | NO EJECUTADO |
| D · cancelación original/inversa/signos | ±0.01 final aunque haya prefijos grandes | NO EJECUTADO |
| Conversión individual grande con tasa0.000000000000000003 | diferencia exacta de ±1ct antes de Number, ambos órdenes | NO EJECUTADO |
| Borde ±70368744177664 y centavo anterior | conserva centavos; centavo posterior no representable rechaza | NO EJECUTADO |
| Texto corto frente a dos decimales | 1000000000000000.10 rechaza pérdida al presentarse como .13 | NO EJECUTADO |
| Total exacto100000000000000 | admite salida exacta aunque centavos excedan MAX_SAFE_INTEGER | NO EJECUTADO |
| Iterable de una pasada e inmutabilidad | resultado0.01; mismos documentos tras éxito y rechazo | NO EJECUTADO |

Datos nuevos exclusivamente FICTICIOS. Los esperados son literales y aritmética
BigInt del fixture, nunca resultado del helper ni Number para el total B.
No se ejecutó versión vulnerable para producir un rojo adicional.

## VALIDACIÓN

Setup nuevo 9f9a32/0 (2026-10-26T08:06:20.183Z..08:06:21.854Z):
raíz, HEAD/tree/padre e índice exactos, detached limpio inicialmente; rama
propia creada y verificada. Claim propio nuevo por CreateNew, 193bytes:
C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.git/worktrees/DTDCARGO1/harness-session-claim.json
SHA2562686f8929086757178c655e29750762f65ed6604086f3d861b54ca4fe7714060.
Owner y WT exactos arriba. Claim anterior ajeno no tocado.
Preautoría2f9b4c/0 volvió a acreditar rama/base/clean/claim y pins efectivos.
Handoff ausente verificado antes de CreateNew ffb3b0/0.

Fuentes leídas ENTERAS: helper base23cb65/0, focalc90432/0,
test compartido4efde4/0 y SDD942793/0. La presentación completa de esta última
se planificó por35241bytes antes de invocar; no fragmentación de una salida fallida.
Revisión propia del helper nuevo9732bf/0 y focal nueva415ce5/0.

Prueba directa/inversa BYTEWHOLE, únicamente transformaciones de texto:
- 232652/0: cinco spans del helper; todo byte no listado idéntico.
- d6e293/0: test anterior4977bytes como prefijo íntegro; sólo añadido nuevo.
- 7444b1/0: retirar la sección nueva de la SDD restaura exactamente35241bytes.
Estos son controles de alcance/preservación, NO ejecución de TypeScript ni
prueba del comportamiento matemático. diff --check00e436/0 conforme.

Focal combinada: NO DISPONIBLE / NO EJECUTADA. Setup propio observó
node_modules=false, node_modules/vitest/vitest.mjs=false; pinnedNode=true.
Cero invocaciones de tests/Node, sin instalación, copia, junction u otro WT.
Versión de Node/Vitest en esta tarea NO CONSULTADA. No se hereda PASS.

Input previsto íntegro, expresamente NO INVOCADO:
{
  "cmd": "& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' node_modules/vitest/vitest.mjs run lib/studio/__tests__/gastos-y-pagos-en-usd-0572.test.ts lib/shared/__tests__/fx.test.ts",
  "shell": "C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe",
  "login": false,
  "tty": false,
  "workdir": "C:/Users/AKX generator/.codex/worktrees/fx-suma-exacta-20261026/DTDCARGO",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
Registro0572-suma:combined-suite-NOEJ: invoked=false; beforeUtc,afterUtc,
result,error,exitCode,chunkId,sessionId,testsPassed,testsFailed,testsSkipped=null.
No hay retorno ni reloj de ejecución que atribuir a una llamada inexistente.
Verify/build/typecheck/lint/otras suites/DB/UI real NO EJECUTADOS por el alcance
acotado; los oráculos heredados siguen pendientes de validación en este SHA.

## Gobernanza e impacto documental

Riesgo R2 de cálculo/presentación; sin mutaciones financieras o persistencia.
Worker/governance-check, AGENT-BRIEF, registro y project-rules vigentes leídos;
SGE-00 v1.0 y NUM-01 v1.1 aplicables. Clasificación del delta, sin aprobación global:

| Principio | Clasificación y evidencia |
|---|---|
| SGE00.01 | no aplica: no acción ni verbo de negocio nuevo |
| SGE00.02 | cumplimiento estático: no mutación de entradas; negativo de inmutabilidad definido, NOEJ |
| SGE00.03 | no aplica: no mutación crítica ni fricción nueva |
| SGE00.04 | no aplica: helper puro, ningún evento persistente |
| SGE00.05 | no aplica: sin cambio de permisos/tenant/lecturas |
| SGE00.06 | cumplimiento estático: validación y RangeError explícito, funcional pendiente |
| SGE00.07 | cumplimiento estático: no total numérico silenciosamente redondeado; no UI/asíncrono nuevo |
| SGE00.08 | no aplica: sin flujo/pasos nuevos |
| SGE00.09 | cumplimiento: mismo conversor compartido, sin dependencia o API paralela |
| SGE00.10 | no aplica: sin UI, teclado o foco modificados |
| SGE00.11 | cumplimiento estático: mensaje de rango identifica agregación y centavos |
| SGE00.12 | no aplica: sin acción externa de IA |
| NUM01 v1.1 | cumplimiento estático: estrategia decimal, redondeo declarado y rango explícito; focal NOEJ |
| ERR01 UI/CMP/VIS/A11Y | no aplica al helper puro; ningún control visual nuevo |

No se ejecutó validador Node de gobernanza/knowledge por autorización de runner
limitada. No se declara una excepción normativa o conformidad funcional por
conteos estáticos. SDD y handoff guardan el impacto; Graphify/Archify/Obsidian,
integración y publicación de conocimiento quedan pendientes con el Director.

## COMMITS / PR / BRANCH

El commit que contiene este documento fija las tres modificaciones y esta alta,
con padre directo a30d85859c788070ffc3459a29e389cab015c7eb.
SHA/tree finales y verificación Git/claim/FIN se informan mediante recibo exterior
DESPUÉS del commit. Este documento no anticipa clean final, release o FIN.
Sin push/PR/main/merge/deploy/DB por Owner o Parent en esta tarea.

## PENDIENTES DE ESTA TAREA

Revisión fija Parent de cuatro unidades completas y preservación; validación
funcional de la focal sobre el candidato real con dependencias disponibles.
No vender ausencia de ejecución como aprobación ni cerrar2.1/finanzas.

## FUERA DE ALCANCE DETECTADO / HANDOFF AL DIRECTOR

No se acreditó fallo de posting/productivo ni caller literal productivo dentro
de las búsquedas acotadas del encargo. No se amplió su búsqueda ni los consumidores.
#311 carteraND, #313 harness, CI320 y la composición futura tienen tareas propias.
No se editaron SQL/fixtures/consumidores ni se recuperó fuente detenida.
Todos los WTs/claims/consumidores anteriores se conservan. Cierre del claim
propio sólo por identidad/pin/owner/ruta tras fijar candidato y acreditar Git.
Automatización sin reanudar; producción, DB real, proveedores, PII, secretos,
cuentas, contactos y gasto permanecen fuera.