# Handoff — SDD-0541 · identidad de publicación después del cambio de nombre

Fecha: 2026-10-20. Owner: `worker-publicacion-identidad-01a15a4e`.
Sesión: subagente `revision_validaciones` de Director `01a15a4e-ddf0-7d82-8656-d9dc56b58468`.
Estado de tarea: **PREPARACIÓN; checkpoint de respaldo antes del ROJO funcional**.
Pruebas: **NO EJECUTADAS**. Se conserva tarea y claim mientras espera turno.

## OBJETIVO ORIGINAL

Aceptar como origen canónico `https://github.com/SoftAgentes/DTDCARGO` y conservar
el alias histórico exacto `https://github.com/hailuwaycom-sketch/DTDCARGO`, sin
distinguir mayúsculas y sin ampliar el conjunto de fuentes admitidas. Conservar
SHA/digest, migraciones, huellas, sharp, imagen anterior, salud, smoke, locks,
congelación y vuelta atrás. Reutiliza la
[SDD-0541](../../docs/specs/0541-publicacion-automatica-vps/spec.md); no reserva otro número.

## Identidad, alcance y permisos

- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/publicacion-identidad-softagentes`.
- Rama: `codex/0541-publicacion-identidad-softagentes`.
- Base y HEAD de adopción: `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`.
- Worktree nuevo creado y asignado por el Director. Árbol y staging limpios al
  adoptar; guard correcto, claim propio adquirido; inventario acotado de procesos
  por ruta sin consumidores observados. El claim no prueba exclusión de herramientas
  que omitan el harness.
- `origin` conserva `https://github.com/hailuwaycom-sketch/DTDCARGO.git`, que resuelve
  al mismo repo. No se modifica por el cambio de nombre.
- Allowlist exacta: `infra/ops/web/publicar-web.sh`,
  `infra/ops/tests/prueba-publicar-web.sh`,
  `docs/runbooks/publicacion-automatica-web.md`,
  `docs/specs/0541-publicacion-automatica-vps/spec.md` y este handoff nuevo.
- Autorizados: preparación local; corrección solo después de ROJO funcional real;
  pruebas cuando el Director dé turno; commits selectivos, push de esta rama a sí
  misma y PR borrador después de la validación local.
- Checkpoint de respaldo autorizado por el Director el 2026-10-20: commit
  selectivo y push de **solo las cuatro rutas preparadas**, antes de las pruebas.
  No abre PR ni certifica el comportamiento; el script de producto sigue intacto.
- No autorizados: merge, instalación en VPS, deploy, cambio de orden de integración,
  cuentas/pagos/credenciales/variables, GHCR/tags/namespace, datos o migraciones.
  La prohibición de publicar/fusionar mientras GitHub está bloqueado sigue vigente.
- SDD-0572 conserva el turno exclusivo de pruebas. No ejecutar harness, Docker,
  build, typecheck, verify ni instalaciones hasta concesión expresa.

## Evidencia de entrada

- Informe externo del mismo revisor:
  `C:/tmp/director-traspaso-20261020/github-identidad-softagentes-20261020.md`,
  SHA256 `7fb23f6697bab529b8cd1356a109821f805925cdc32ac30cbc81ba938ead9a2c`.
- API del 2026-10-20, 22:06:28Z: repo `1246490707`, nombre
  `SoftAgentes/DTDCARGO`, owner `User`, login `SoftAgentes`, owner ID `285193249`.
  Sam aclaró cambio de nombre del perfil; no se afirma traslado de propiedad.
- El Director comprobó por SSH de solo lectura a las **22:07:19Z** que el script
  instalado conserva `FUENTE=https://github.com/hailuwaycom-sketch/DTDCARGO`;
  imagen servida y publicable `8e9e0f50…`, congelado no, rechazadas 0. Esta es
  evidencia atribuida al Director, no una nueva consulta de este Worker.
- La acción de metadatos fijada toma `source` de `repo.html_url`; el publicador
  actual compara con la URL antigua. Incompatibilidad establecida por lectura;
  todavía no se ha observado una publicación fallida de una imagen nueva.

## COMPLETADO

- Adopción del worktree, lectura de instrucciones y claim propio.
- Contrato de dos fuentes exactas aceptado por el Director (opción A). La opción B
  de fijar una etiqueta antigua en el build no fue adoptada.
- Preparadas 43 combinaciones funcionales en el harness existente: 12 publicaciones
  de fuentes admitidas, 27 rechazos (incluye etiqueta ausente) y 4 recuperaciones.
  Comprueban el resultado y efectos sobre compose, `.env` y contenedor sintéticos;
  conservan las regresiones anteriores. **Todavía no se ejecutaron**.
- Spec reutilizada con aceptación/allowlist exclusiva y runbook con procedimiento
  revisable de respaldo, hash, lock, sustitución atómica y reversión de solo script.
  Su ejecución operativa no está autorizada ni comprobada.
- Publicador de producto intacto: blob de HEAD y hash-object del archivo coinciden
  en `e91ecccde9a8bc3f5d9a239125928c3abf778e89`. El caso rojo usará ese script.

## VALIDACIÓN

| Comprobación | SHA / alcance | Resultado |
|---|---|---|
| Raíz/rama/HEAD/estado inicial | `d410ab2e…`, worktree asignado | **PASÓ** |
| Guard y claim | `worker-publicacion-identidad-01a15a4e` | **PASÓ** |
| ROJO funcional contra publicador original | Regresiones de origen nuevo | **NO EJECUTADO**, esperando turno |
| Verde Linux con dobles y mutantes | Script corregido futuro | **NO EJECUTADO** |
| Focal del promotor, sintaxis shell, docs/SDD/diff | Pendientes tras la preparación | **NO EJECUTADO** |
| Verify/build/typecheck de la aplicación y revisión UI | No se cambian app, tipos ni pantallas | **NO EJECUTADO**, no aplica al alcance de script/infra |
| Instalación/publicación y smoke 14/0 | Producción | **NO EJECUTADO**, sin autorización |

## COMMITS

El commit que contiene este documento es el **checkpoint de preparación**: pruebas,
spec, runbook y handoff. No contiene la reparación ni un resultado verde. Su SHA
local/remoto se comunica al Director después del push explícito y de comparar las
refs. El control rojo conserva el script original de `d410ab2e…`.

## PR / BRANCH

PR aún no creada. Base prevista `main`; rama propia indicada arriba. El checkpoint
se respalda en esa misma rama remota sin abrir PR. La PR será borrador después de
validación local; no autoriza integración ni publicación.

## PENDIENTES DE ESTA TAREA

1. Recibir turno; ejecutar y conservar ROJO funcional antes de corregir.
2. Corregir únicamente la identidad; ajustar mutantes al cambio real y ejecutar
   verde, controles y checks pertinentes.
3. Revisión del procedimiento preparado de respaldo/hash/instalación/reversión;
   su ejecución queda fuera de este Worker.
4. Revisión de diff, cierre documental y de conocimiento, commit/push finales selectivos,
   PR borrador y liberación del claim al terminar la escritura.

## FUERA DE ALCANCE DETECTADO

- Acceso efectivo a GHCR tras el cambio de nombre: **NO VERIFICADO**. No se deduce
  pérdida de permisos, credenciales ni imágenes; no se cambia namespace.
- Tarjeta rechazada y espera de 48 horas para cambiarla, según Sam: recuperación
  de cuenta a cargo del dueño. No se consultan pagos ni se promete fecha de salida.
- Recuperación completa de publicación, instalación en VPS, CI/release y smoke
  visible de contabilidad pertenecen al Director; no se repite 0495.

## Conocimiento

Impacto documental: spec reutilizada, runbook operativo y handoff propio. Esta
continuación debe quedar fechada sin reemplazar el handoff histórico 0541 ni
convertir el estado del servidor observado en una comprobación permanente.
Graphify estructural/semántico, Archify y preview local de Obsidian: pendientes de
revisar al cierre, sujetos a recursos y permisos; ninguna capa se declara vigente.
Integración/exportación compartida queda al Director desde main comprobado.

## HANDOFF AL DIRECTOR

Checkpoint: regresiones listas para ROJO, con diff revisable y publicador original
intacto. Cambiadas únicamente cuatro rutas autorizadas (prueba, runbook, spec y
handoff nuevo); la quinta, el publicador, no tiene diff. El Director autorizó su
respaldo remoto antes del ROJO; esto no equivale a validación ni cierre. El turno
pesado sigue en 0572. Claim **retenido por esta sesión**
durante la preparación y espera; se liberará al terminar la escritura.
