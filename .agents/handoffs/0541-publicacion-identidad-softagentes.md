# Handoff — SDD-0541 · identidad de publicación después del cambio de nombre

Fecha: 2026-10-20. Owner: worker-publicacion-identidad-01a15a4e.
Sesión: subagente revision_validaciones del Director 01a15a4e-ddf0-7d82-8656-d9dc56b58468.
Estado: **IMPLEMENTADO Y VALIDADO LOCALMENTE; integración e instalación pendientes**.
El turno pesado fue devuelto a las 22:43:12.526Z, con procesos propios y descendientes en cero.
La liberación del claim se comprueba al terminar la escritura; no implica aprobación de release.

## OBJETIVO ORIGINAL

Aceptar el origen canónico https://github.com/SoftAgentes/DTDCARGO y conservar
el alias histórico exacto https://github.com/hailuwaycom-sketch/DTDCARGO, sin
distinguir mayúsculas ni ampliar el conjunto de fuentes admitidas. Mantener
SHA/digest, migraciones, huellas, sharp, imagen anterior, salud, smoke, locks,
congelación y vuelta atrás. Reutiliza la
[SDD-0541](../../docs/specs/0541-publicacion-automatica-vps/spec.md); no reserva otro número.

## Identidad, alcance y permisos

- Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/publicacion-identidad-softagentes.
- Rama: codex/0541-publicacion-identidad-softagentes.
- Base de adopción: d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8.
- El Director creó y asignó el worktree. Árbol y staging limpios al adoptar;
  guard correcto y claim propio. Inventario acotado sin consumidores observados.
  El claim no demuestra exclusión de herramientas que omitan el harness.
- Origin conserva https://github.com/hailuwaycom-sketch/DTDCARGO.git, que resuelve
  al mismo repositorio. No se cambió por reflejo.
- Allowlist exclusiva: infra/ops/web/publicar-web.sh,
  infra/ops/tests/prueba-publicar-web.sh,
  docs/runbooks/publicacion-automatica-web.md,
  docs/specs/0541-publicacion-automatica-vps/spec.md y este handoff nuevo.
- Autorizados: preparación local; reparación después de ROJO real; pruebas en
  turno exclusivo, commits selectivos, push de la rama a sí misma y PR borrador.
- El Director concedió turno después de que 0572 lo devolviera a las 22:25:17.976Z.
  Se devolvió antes del cierre documental, sin más ejecuciones pesadas previstas.
- No autorizados: merge, instalación en VPS, deploy, cambio de orden de integración,
  cuentas/pagos/credenciales/variables, GHCR/tags/namespace, datos o migraciones.
  La prohibición de Sam durante el bloqueo de GitHub sigue vigente. El Director
  no puede revocarla unilateralmente; cualquier excepción exige autorización
  explícita de Sam. La instalación concreta requiere su autorización vigente.

## Evidencia de entrada

- Informe externo: C:/tmp/director-traspaso-20261020/github-identidad-softagentes-20261020.md.
  SHA256 7fb23f6697bab529b8cd1356a109821f805925cdc32ac30cbc81ba938ead9a2c.
- API del 2026-10-20, 22:06:28Z: repo 1246490707, SoftAgentes/DTDCARGO,
  owner User, login SoftAgentes, owner ID 285193249. Sam aclaró cambio de nombre
  del perfil; no se afirma traslado de propiedad ni a una organización.
- Lectura de solo lectura del Director a las 22:07:19Z: script instalado con
  FUENTE=https://github.com/hailuwaycom-sketch/DTDCARGO; imagen servida y publicable
  8e9e0f50…, congelado no, rechazadas 0. Evidencia fechada atribuida al Director,
  no nueva consulta de este Worker ni garantía permanente del servidor.
- La acción fijada de metadatos obtiene source de repo.html_url. La incompatibilidad
  del script original quedó reproducida localmente; no se ha observado un fallo
  real de publicación de una nueva imagen en el VPS.

## COMPLETADO

- Dos constantes de fuente exactas y readonly; comparación sin distinguir
  mayúsculas. El enlace a commits utiliza el nombre canónico. La opción B de
  etiquetar el build con la identidad antigua no fue adoptada.
- 46 casos funcionales de identidad: 12 aceptaciones, 27 rechazos de fuente,
  3 rechazos de override por entorno y 4 recuperaciones. Se conservan las
  144 comprobaciones previas del publicador.
- Pruebas sobre publicación automática, manual e interfaz del interino: comprueban
  SHA/digest, llamadas a compose, contenido completo del .env sintético y
  contenedor resultante. Los rechazos preceden a up/cambio de env/contenedor.
- Spec y runbook actualizados. El procedimiento de solo script exige condiciones
  previas autorizadas, congelación, respaldo, hashes, mismo lock, reemplazo
  atómico y reversión. **Procedimiento operativo NO EJECUTADO**.
- Revisión independiente de lectura del Director y memoria_traspaso sobre los
  blobs de producto y pruebas: sin hallazgos bloqueantes. El cotejo del cierre
  documental y del SHA final se registra por separado.

## VALIDACIÓN

Las pruebas se ejecutaron antes del commit de reparación, sobre el checkpoint
297d566a más el diff propio. El commit de producto
**b6af34a3c88c835d50a8dc40c95b608da0d1f3f8** contiene exactamente esos blobs:

- Publicador: 31a70c8d63765d1c9b8feaac037dd8096ca1bb00.
  SHA256 c96268c94d0fc05ea81ea54a226f9265e4676bc19a87da4ea4a51228f6b3cf95.
- Harness: e43dd0cebaf77bb50e7ce67284afb8a8ba1ff3ac.
  SHA256 d24baea346c4d2e9e3b96e82b651d0376e597d3ce402136e6f3c50d1b7ca8a88.

| Comprobación | Evidencia y alcance | Resultado |
|---|---|---|
| Identidad, guard y claim | Worktree/rama propios; solo cinco rutas | **PASÓ** |
| ROJO funcional | Checkpoint 297d566a; publicador original e91ecccde9a8bc3f5d9a239125928c3abf778e89; 177 pasan y 10 fallan; exit 1 | **FALLÓ como se esperaba**, antes de reparar |
| Verde Linux completo | Los dos blobs indicados; 190 pasan, 0 fallan, 0 no verificados; exit 0 | **PASÓ** |
| Control vacío y mutantes pertinentes | Control vacío: 165 fallos; seis mutantes muertos y cero vivos | **PASÓ** |
| Focal del promotor | infra/ops/tests/publicable.test.mjs sin modificar; 30/30, sin omitidos | **PASÓ** |
| Sintaxis shell | bash -n del publicador, harness y huellas-fuera-de-imagen.sh | **PASÓ** |
| Docs y numeración | Índice sincronizado con 556 specs; sin colisiones nuevas; excepciones históricas conservadas | **PASÓ** |
| Diff y alcance | git diff --check; cinco rutas exclusivas | **PASÓ** |
| Verify/build/typecheck/lint de app y UI | No se cambiaron aplicación, tipos ni pantallas | **NO EJECUTADO**, no aplica a este cambio de shell/infra |
| CI remoto del nuevo SHA | No sustituido por las comprobaciones locales | **NO VERIFICADO**, bloqueo de Actions y revisión pendiente |
| VPS/GHCR real, instalación, publicación, smoke 14/0 y Studio | Sin consultas operativas ni escritura | **NO EJECUTADO** |

El ROJO reprodujo seis rechazos indebidos del origen nuevo (dos variantes por
tres caminos) y cuatro recuperaciones que dependían de publicar ese origen.

Los seis mutantes retiran el gate, la fuente canónica, el alias histórico o la
igualdad sin mayúsculas, admiten prefijos y permiten override por entorno. Cada
uno ejecutó el harness completo. No se rerunearon los mutantes históricos de
secciones intactas. El resumen del mutante de prefijos recorta la primera
aserción a 90 caracteres: el fallo es el rechazo funcional de DTDCARGO-otro,
que exige RC 1, cero up, env intacto y contenedor anterior. No se conserva el
suite.log temporal completo ni se inventan sus valores recortados.

Runtime Linux local ya disponible: imagen Node 24 fijada por digest
sha256:6dac556d980b7f0e5498d08f08cee0ca67798b4ad6c23964a9214920e67758d0,
sin red ni pull y con repo de solo lectura. Docker/curl/smoke dentro del harness
son dobles; no hubo registro, servidor o DB real. Para los mutantes se copió un
archive de fixtures rastreados de 297d566a a temporal Linux y se superpusieron
los dos scripts actuales, comprobando bytes y hashes.

Dependencias del focal instaladas en este worktree: pnpm 11.25.0, lockfile
congelado, offline y sin scripts de ciclo de instalación. No se copiaron
node_modules ajenos ni secretos. Node Windows 24.20.0. Esa instalación no
certifica módulos nativos ni build de aplicación.

Evidencias externas:
C:/tmp/director-traspaso-20261020/0541-identidad-validation/.
Incluyen rojo/verde/mutantes/promotor .json y .log, checks.json, sintaxis.log,
docs.log, sdd.log, knowledge-interrupted.json y turno-devuelto.json.
Las sesiones terminaron; Docker Desktop había sido iniciado por esta tarea desde
detenido y sin contenedores, y su cierre terminó exit 0. La lectura posterior del
estado de Desktop no estuvo disponible; el inventario de procesos propios y
descendientes quedó vacío.

## COMMITS

- 297d566a1335de0f9fcf07363774495e2c71c723: checkpoint de preparación, respaldado
  antes del ROJO. Cuatro rutas; publicador original intacto.
- b6af34a3c88c835d50a8dc40c95b608da0d1f3f8: reparación mínima y controles de identidad.
- El commit documental que contiene este cierre conserva los dos blobs validados.
  Su SHA final y la igualdad con la rama remota se entregan al Director.

## PR / BRANCH

Rama propia: codex/0541-publicacion-identidad-softagentes. Base: main.
PR borrador en preparación de entrega; URL y SHA final se registrarán al crearla.
No se autoriza integración ni instalación por abrir una PR o pasar pruebas locales.

## PENDIENTES DE ESTA TAREA

1. Cotejo del cierre documental y del SHA final publicado; PR en borrador.
2. CI del SHA candidato cuando se recupere Actions; revisión e integración por
   el Director, con la restricción de Sam y el orden de integración preservados.
3. Revisión y eventual ejecución autorizada del procedimiento de solo script.
   Instalación, imagen publicada, digest, smoke 14/0 y revisión Studio son
   comprobaciones posteriores distintas.
4. Conocimiento derivado e integración/exportación, según el apartado siguiente.

## FUERA DE ALCANCE DETECTADO

- Acceso efectivo a GHCR tras el cambio de nombre: **NO VERIFICADO**. No se deduce
  pérdida de permisos, credenciales o imágenes, ni se cambia namespace.
- Tarjeta rechazada y espera de 48 horas para cambiarla, según Sam: corresponde
  al dueño de la cuenta; no se consultan pagos ni se promete fecha de recuperación.
- Recuperación completa de publicación y contabilidad visible corresponde al
  Director. No se repite la migración 0495 ni se altera su paquete.

## Conocimiento

Guardado en la tarea: spec reutilizada, runbook y handoff propio. No cambia ninguna
fuente de semanticPilot; las tres fuentes documentales quedan dentro del alcance
global pendiente, sin declarar cobertura semántica completa.

knowledge:status se inició, pero no emitió JSON. Al acotar el Director el cierre,
se canceló el wrapper antes de visual/preview y luego el árbol lector Node/Python
con comprobación de PID y CreationDate. Resultado: **NO DISPONIBLE, lectura
interrumpida**; no se presenta exit 0 ni status comprobado. El recibo externo
registra remaining=[] y ausencia de graphify-out/graph.json.

Graphify estructural/semántico: **PENDIENTE**, sin derivados propios. Archify
2.16.0 y preview local de Obsidian: **NO EJECUTADO**, por la instrucción acotada
del Director; sin regeneración. Revisión visible y exportación compartida:
**PENDIENTES**. El Director retoma esas capas desde main integrado comprobado.

## HANDOFF AL DIRECTOR

La reparación local y sus controles están terminados; los resultados no
equivalen a aprobación de merge, instalación o publicación. Turno pesado devuelto,
sin ejecuciones propias. Conservar la PR en borrador hasta revisión/habilitación.
La escritura final, el push explícito, el cotejo remoto y la liberación del claim
cierran esta entrega; el recibo externo identifica el SHA entregado.