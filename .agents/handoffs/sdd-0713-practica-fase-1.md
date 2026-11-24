# SDD-0713 · Fase 1 · Acceso a la práctica y recepción en China

## OBJETIVO ORIGINAL

Implementar la fase 1 y verificar si registrar carga en China crea inmediatamente una Pre-orden. El responsable es Codex Worker, sesión `01a20a27-0b07-79b1-8241-59b600cf2364`. [SDD-0713](../../docs/specs/0713-modo-prueba-personal/spec.md)

## COMPLETADO

- Entrada desde Mi perfil, intercambio de un solo uso, espacio por empresa y cuenta, comprobación de permisos al consultar y salida al panel real. La interfaz distingue las operaciones permitidas por el rol.
- Almacén de práctica para una instancia vacía, con funciones limitadas a reserva, canje, consulta y salida. El receptor cierra las demás operaciones dinámicas. El ingreso de red propuesto admite únicamente esas rutas y sus recursos estáticos.
- La acción real de alta de Studio se ejercitó con un cliente ficticio identificado, una compra con orden previa y una recepción huérfana. Registró las tres y vinculó la orden previa sin solicitar una factura nueva. En el esquema completo de PostgreSQL las seis altas de Studio y móvil dejaron cero facturas nuevas, incluidos borradores. El ERP puede emitir más adelante al consolidar.
- Impacto documental recogido en la SDD, su índice y el contrato de fase con rutas, activación, límites de los ensayos y reproducción. [Contrato de fase](../../docs/specs/0713-modo-prueba-personal/fase-1.md)

## VALIDACIÓN

| Estado | Comprobación y alcance |
|---|---|
| PASÓ | 29 pruebas dirigidas de alta en Studio, evento de autoemisión y acciones móviles. Las acciones usan dobles de persistencia. |
| PASÓ | 9 pruebas de acceso y almacén en PGlite. Dos personas del mismo rol, rol de almacén restringido y administración. Reanudación, dos entradas simultáneas, incompatibilidad entre pestañas, baja, cambio de rol, expiración, indisponibilidad y privilegios del rol SQL. |
| PASÓ | Chromium en dos orígenes HTTPS inventados a 390 y 1280 px. Activación con teclado, franja y botón visibles, recarga con el mismo espacio, cierre y regreso, error de destino en el perfil. El transporte HTTP de este ensayo visual está simulado. |
| PASÓ | Frontera RSC, índice de SDD, numeración, registro de componentes, gobernanza, constantes y diff sin errores de espacios. Revisión visual con los tokens de Studio, foco del botón y estados de carga, vacío y error. |
| PASÓ | CI de PostgreSQL con 555 entradas en el ledger, seis recepciones confirmadas, cero facturas nuevas al recibir y 20 controles aprobados en el ensayo. [Job en `21a4e61c2`](https://github.com/SoftAgentes/DTDCARGO/actions/runs/45283236362/job/138072813961) |
| PASÓ | Contratos locales en PostgreSQL 17 desechable de la numeración de recepción (15 aserciones) y de la autoemisión (11). En una red interna desechable pasaron el canje concurrente, la sesión y los grants con PostgREST 14.17. Traefik 3.7.14 aplicó las rutas y métodos permitidos de la plantilla. El servidor HTTP detrás de Traefik fue un doble de prueba. |
| CI de la revisión | Calidad continua y diagnóstico PostgreSQL se comprueban sobre el commit entregado. [Checks de la PR](https://github.com/SoftAgentes/DTDCARGO/pull/800/checks) |
| NO EJECUTADO en la PC | `pnpm verify` completo. La corrida pesada se delegó al CI para respetar el uso compartido del equipo. La validación de release del servidor y la aceptación de usuarios quedan pendientes de su hito. |

## COMMITS

La base de trabajo es `8420d9c60759c003d28168d03ac5413c667cd793`. La rama incorpora la revisión de diseño `0a3ddb9ff`. El acceso y sus ensayos se entregan en `4c760a490`. La caracterización de la preorden y su job se entregan en `0e4348941`. Este handoff y la ficha de fase completan la documentación.

## PR / BRANCH

Rama `codex/sdd-0713-practica-fase-1`, worktree `../DTD-worktrees/sdd-0713-practica-fase-1`. Base de integración `main`. Abierta para revisión independiente. [PR #800](https://github.com/SoftAgentes/DTDCARGO/pull/800) · [Diseño de la PR #798](https://github.com/SoftAgentes/DTDCARGO/pull/798)

## PENDIENTES DE ESTA TAREA

El Director comprueba CI y revisión en la cabeza exacta de la PR. La prueba con la instalación real de ensayo requiere un destino dedicado y aprobación nominal para instalar su esquema y habilitar la configuración. La SDD global sigue en progreso. La práctica del equipo se abrirá con los cinco módulos.

## FUERA DE ALCANCE DETECTADO

El comportamiento esperado por operaciones es crear un borrador en Facturación al recibir carga identificada en China. La acción existente vincula la orden previa y la autoemisión implementada pertenece a la consolidación. Corresponde acordar el cambio financiero del ERP y el momento de identificación de una huérfana antes de avanzar a ese ejercicio. El primer lote de Facturación y su ayuda ⓘ corresponden a la fase 2.

## HANDOFF AL DIRECTOR

Revisar la frontera de datos entre orígenes, la caducidad del pase, el alcance del rol SQL y los seis casos del diagnóstico. Para la instalación, confirmar host exclusivo, red saliente restringida, origen de datos nuevo y credenciales exclusivas de práctica. Fusión, publicación, activación e instalación se realizan en sus hitos respectivos.

## Revisión acotada de la PR #800 · 2026-11-23

- Owner de esta corrección: `codex-worker-correcciones-800-20261123` (subagente Worker asignado por el Director). Worktree y rama conservados: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0713-practica-fase-1`, `codex/sdd-0713-practica-fase-1`. Cabeza recibida: `48b8545a85f685e01d18a654eba4ec1187e177ac`.
- Objetivo y aceptación: resolver el rojo del aviso global y el único P2 de revisión; mantener ambos avisos y el regreso legibles y operables a 390/1280 px; actualizar la base mediante merge semántico y conservar los contratos de fase 1. El Director autorizó commits selectivos y push a esta misma rama tras confirmar que no había más observaciones bloqueantes.
- Completado: la página de práctica mide el borde inferior real del aviso global y reserva ese espacio tanto en el flujo como en la posición sticky. Un ResizeObserver de border-box actualiza la reserva al cambiar su alto; resize cubre cambios de viewport. La franja queda en z-index 100, por debajo del aviso global 2000. Sin aviso global conserva reserva cero. No se modificaron el componente global, su prueba ni globals.css.
- Completado: el ensayo de navegador monta el componente global real con sus reglas responsive y sus tokens leídos del CSS del repositorio. Comprueba límites del viewport, separación entre ambos textos y el botón, hit-testing del botón, cambio de alto del aviso, scroll y foco mediante Tab antes de activar el regreso con Enter. Conserva recarga, intercambio entre orígenes y destino indisponible con transporte simulado.
- Base: merge de `origin/main` en `30e37078de3264dedbb2e90cb3e955f16437c55b`, commit `e1d80199a`. Se usó el driver semántico vigente en main y se regeneró el índice de SDD. Los cambios heredados de Clientes/Chatwoot pertenecen a main; el diff de fase 1 contra esa base conserva su alcance.
- PASÓ: 12 pruebas de `components/AvisoEntornoPrueba.test.tsx` con un worker; ensayo `infra/ops/tests/practica-navegador.mjs` con Chrome instalado en ambas anchuras; ESLint de `PracticaPersonal.tsx`; docs:check (694 specs), sdd:check, governance:check, components:check y git diff --check.
- NO EJECUTADO: pnpm verify/build/tipos y suites completas locales, por asignación de las corridas pesadas a GitHub CI. El script .mjs está excluido del lint del repositorio: fue validado por ejecución en navegador. El Chromium de Playwright no estaba instalado; el ensayo pasó usando `PRACTICA_CHROMIUM` con Chrome local. No se instalaron navegadores.
- Impacto documental: este handoff conserva la evidencia de la corrección; no cambia el diseño, aceptación ni activación de fase 1. Cumplimiento de A11Y-01, BTN-01 y VIS-01 para esta corrección: textos separados, regreso accesible por teclado, jerarquía global preservada y tokens existentes.
- Commits de corrección: el commit que contiene este documento. PR y rama: se conserva #800; #798 continúa como PR de diseño.
- Pendientes de esta revisión: dictamen independiente y CI sobre la nueva cabeza, a cargo del Director. Se mantienen los pendientes de instalación y apertura del apartado anterior. Fuera de alcance detectado: ninguno nuevo.
- Handoff al Director: revisar el nuevo SHA, esperar el CI exacto y coordinar integración por separado. Sin merge de PR, despliegue, migraciones, activación ni datos reales. Ownership se libera al finalizar la escritura y el push; se conserva el worktree.
