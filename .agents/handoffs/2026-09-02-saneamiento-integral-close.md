# Cierre técnico · saneamiento integral para transición Cloud → Codex

Fecha: 2026-09-02 · Última actualización: 2026-09-03

Rol: worker
Estado: SANEAMIENTO LOCAL · PUSH NUEVO BLOQUEADO · PR EN BORRADOR

## Continuación actual · Portal, verificación y dependencias · 2026-09-03

Esta sección posterior prevalece sobre las siguientes. No se modifica el
objetivo guardado ni se automatiza su reanudación. Trabajo en el mismo carril.

- SDD0377/0427: contrato SQL+concurrencia en6ae46e81, sólo local.
 63aserciones SQL,8carreras reales; ninguna fila ni migración Cloud tocada.
 Action/UI27casos, browser sintético móvil/escritorio, histórico conservado.
- SDD0378 cerrado localmente: clasificación fail-closed y JSON conservado;
 guard ESM de canales WebKit tras exit0, Safari Windows1worker y unitarios4.
 Sin aumentar plazos ni retirar casos. Guard48+wrapper3+configSafari12 correctos.
 E2E real3proyectos150/18,0flaky/0errores globales,211s. Gate16/17 medidos,
 Cloud SKIP,169SQL/rebuild424 y build158. Primer intento unitario con timeout
 conservado; se corrigió concurrencia y se midió otra vez sin reintento.
- SDD0379 fflate0.4.9: commit ef6101c4, sólo dependencia transitiva rrweb.
 Diez controles reales de codecs/ZIP64+dos de flags/máscaras; instalación
 congelada y firma/integridad verificadas. pnpm audit no disponible por timeout.
- SDD0380/0428: cotizaciones por principal activo, cliente vivo y tenant.
 Cruce real sintético reproducido;63 SQL+31 aplicación correctos.
 Medición conjunta posterior:7149/7149 en553archivos,421,24s sin reintento;
170 contratos SQL y rebuild425 correctos. E2E anterior no cubre autenticación
 Portal de esta corrección.
- SDD0381/0429 cerrado localmente: lectura y reasignación cross-tenant PSR
  reproducidas de forma independiente; 20 RED de aplicación → 35 GREEN con
  add-ons. Corrige sólo tres policies Portal y el ámbito de su consulta; equipo
  preservado. Soft delete propio 42501 es deuda previa separada. Pasaron 100
  aserciones focales, 171 contratos SQL, rebuild 426 y 7.173/7.173 unitarios.
- SDD0382/0430 cerrado localmente: perfil y solicitudes de cambio exigen principal vivo
  y tenant coherente; la rama Portal excluye trazas `source='admin'` sin cambiar
  los derechos de equipo. RED SQL y aplicación causales; 40 aserciones SQL,
  70 focales, 172 contratos, rebuild 427 y 7.181/7.181 unitarios aprobados.
- SDD0383 cerrado localmente: el guard service_role anterior omitía 81 componentes y
  daba 0/0 falso pese a dos construcciones en el layout. El guard AST nuevo
  cubre los 105 `.tsx/.jsx` de producción; el layout usa una fachada
  `server-only` que eleva sólo después del principal. Focales 10/10, tipos,
  lint y suite 7.187/7.187 aprobados.
- SDD0384 cerrado localmente: las cuatro acciones de Perfil aceptaban un client_id
  de vínculo tenant/cliente incoherente. RED causal 9/12; ahora resuelven el
  principal antes de elevar y fijan tenant, cliente vivo y source=client.
  GREEN 13/13, conjunto Perfil 53/53 y suite 7.200/7.200 en 558 archivos;
  tipos, lint focal, docs, numeración, gobernanza y componentes aprobados. Sin SQL.
  Revisión de datos focal: minimización local correcta; retención/Storage real,
  base y transferencia siguen no verificables sin autorización alojada.
- SDD0385/0431 cerrado localmente: el RPC de mensajes aceptaba un vínculo activo
  tenant A → cliente B y escribía el hilo/mensaje de B. RED causal confirmado;
  ahora exige principal activo, cliente vivo y tenant coherente antes del DML.
  Pasaron 22 aserciones focales, 173 contratos SQL y rebuild de 428 archivos
  (410 desde cero + 18 sólo-ledger), con aislamiento de 219 tablas. 0431 no fue
  aplicada ni consultó datos reales.
- SDD0386 cerrado localmente: alta/baja Web Push aceptaban relación Portal
  incoherente o retirada; error Auth se ignoraba y transporte/admin escapaban.
  Ahora ambas rutas derivan user/tenant del principal canónico antes de elevar,
  conservan rebind y baja propia. RED 7/9; GREEN 186/186, Portal 867/867,
  TypeScript y lint correctos. Sin suscripción, envío real, SQL o Cloud.
- Conteo original 56/106, 52,8 %. Ahora hay 31 migraciones preparadas 0401–0431,
  según el último ledger verificado 0400 (sin consulta Cloud nueva).
- El inventario residual de Portal requiere una reproducción nueva por dominio;
  el barrido SQL paralelo de esta ronda no entregó evidencia utilizable y no se
  convierte en hallazgo. Siguiente: inventario local read-only de acciones/RPCs,
  después RBAC/Portal restantes y specs/logger/CSP/web.
 Sin nuevas elecciones de tarea.
- Sin push nuevo, main, deploy, datos reales ni limpieza final.

## Continuación vigente · reserva atómica · 2026-09-03

SDD-0375/0426 está conservada localmente en 47b1dd0b, mismo worktree. La carrera
39→41 se reprodujo con dos conexiones PostgreSQL reales. El correctivo local
pasó 25 unitarios focales, 63 aserciones SQL y concurrencia COMMIT/ROLLBACK,
clave independiente, reloj tras lock, timeout e aislamiento. Gate conjunto
con fallo de arnés: 2 timeouts y luego 4 en harness-worktree-safety, no fallo
del contrato atómico. 168 SQL y rebuild423 aprobados. Gate exit 1 por test,
15/16 ejecutados (Cloud SKIP), build158 correcto. E2E150/18 con dos timeouts
globales480s aceptados con aviso, causa no demostrada.
Correctivo local SDD-0376: 72→52 procesos Git sin relajar gates; 18 pruebas
nuevas y 52 anteriores aprobadas. A/B tres pares: mejora16,9–32,1 %.
Suite completa posterior 6.936/6.936, 545 archivos, 214,59 s, configuración
original. Docs, numeración, lint focal, gobernanza y componentes aprobados.
No se repitió verify completo: se informa evidencia proporcional agregada.
Ver docs/audits/2026-09-03-worktree-git-probe-local.md y
docs/audits/2026-09-03-public-verify-atomic-local.md.

No cambia el estado blocked del objetivo ni se automatiza la ventana prohibida.
La cola local continúa sin elegir de nuevo; siguiente: soft delete Portal.
Checklist original 56/106, sin sumar subpasos como tareas originales.
Hay 24 migraciones anteriores más 0425/0426 locales sin aplicar. Sin nuevo
push, main, deploy, datos reales o limpieza final.

## Punto vigente · cola local desde Analytics · 2026-09-03

Esta sección prevalece sobre los snapshots históricos inferiores. Se continúa
en la misma tarea y worktree; no se crean objetivos ni tareas duplicados.
El objetivo guardado sigue `blocked`: no hay API de reanudación disponible.
La skill computer-use impide automatizar la ventana identificada como ChatGPT;
se detuvo la inspección sin pulsar controles ni alterar el estado persistido.
La reanudación automática requiere el control de la app; no otra elección
de la siguiente corrección local.

- Base de esta tanda: f61a18dc; remoto autorizado y publicado: 70812835.
  Los recibos de 0399/0400 ya eran dos commits locales adicionales.
- 37bc0848: auditoría base, especificaciones 0371–0374 y evidencia.
- 260384b2: Analytics, 90 focales/100 con consentimiento y navegador local
  interceptado; sin eventos a Google, sin datos reales.
- 3d3ab047: direcciones Portal, cruce entre tenants reproducido y 0425
  preparada; 54 aserciones. No aplicada en Cloud. Soft delete propio sigue
  rechazado con 42501 tanto antes como después; correctivo separado.
- c1e44555: Push, 321 pruebas; entradas y emisores restringidos, sin envío real.
- Verificador fail-closed, conservado junto con este punto terminal:
  33 pruebas; errores bloquean lookup. La carrera
  39→41 sigue reproducible: cupo atómico es el siguiente slice, no está resuelto.
- Gate conjunto final: exit 0 con reservas, 14/15 pasos medidos. 6.926
  unitarios/543 archivos, 167 contratos SQL, rebuild de 422 migraciones y
  build de 158 páginas correctos.
  E2E: 150 aprobados/18 omitidos, dos timeouts globales de 480 s (suite y
  teardown), aceptados con aviso por el arnés. No afirmar causa WebKit sólo
  por su mensaje genérico. Cloud migrations-applied SKIP por credenciales;
  no cierre verde completo. Detalle en el checklist de arranque.
- Checklist original: 56/106 (52,8 %), 50 pendientes. Estos cuatro paquetes
  posteriores se muestran por separado, sin cambiar el denominador.
- No nuevo push, main, deploy, aplicación Cloud, datos reales o limpieza final.
  Hay 24 migraciones anteriores pendientes, más 0425 preparada en esta tanda.
- core.hooksPath apunta a una ruta antigua inexistente. No se reparó la
  configuración Git común; los gates se ejecutaron explícitamente.

Cola definida sin opciones nuevas: reserva atómica de verificador;
comando de soft delete Portal; diagnóstico del cierre E2E y fflate/replay;
después los slices restantes de RBAC/Portal, specs, logs, CSP y medición web.
Un gate externo estaciona sólo su casilla; no autoriza operaciones alojadas.

## Identidad Git

- Repositorio: `https://github.com/hailuwaycom-sketch/DTDCARGO.git`
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`
- Rama: `codex/saneamiento-integral`
- Base auditada: `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`
- Lote funcional publicado: `a9895487d010f39edcc1c7b20915547f6a93d773`, árbol
  limpio, 0 detrás / 53 delante de `origin/main`; local/remoto verificados 0/0.
- Upstream: `origin/codex/saneamiento-integral`.
- [PR #21](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/21), en borrador,
  activó la primera corrida de calidad alojada; no integra `main`.
- El rechazo anterior de push quedó resuelto tras comprobar el remoto PRIVATE,
  permiso ADMIN y alcance sin credenciales detectadas; el push exacto fue
  autorizado y completado. No se hizo force-push, merge ni promoción.
- Evidencia nueva: `docs/audits/2026-09-02-codex-publicacion-y-preflight.md`.
- Actualización posterior: el remoto llega a `eabb230b` (59 commits sobre main).
  `f1cd9743` (SDD-0362) está sólo local. Auto-review rechazó su push y exige OK
  explícito del commit y destino; no se reintentó ni se usó una vía alternativa.
  La verificación PRIVATE/ADMIN anterior no se interpreta como autorización
  para superar este rechazo. El CI verde de `eabb230b` no cubre Academia.
  SDD-0363 está en `9b243069`, segundo commit local. SDD-0364 en `e9d49980`
  añade el tercero; SDD-0365 etapa 1 añade el cuarto, expansión SQL0421 el quinto
  y transporte/comprobantes el sexto. La adopción de consumidores añade el
  séptimo incremento local; la restricción0422 añade el octavo (`f649bdbc`) y
  el correctivo histórico0423 añade el noveno. Ninguno está
  publicado ni tiene CI alojado propio;
  el rechazo de push sigue vigente.
  Después de `5797920a`, el rescate Cloud quedó en `cfe7a9c9`, décimo incremento
  exclusivamente documental. La corrección local de qs añade el undécimo.
  La autorización solicitada hasta cfe7a9c9 no incluye automáticamente ese
  mantenimiento posterior del tooling.
  El preflight posterior añade un duodécimo incremento sobre `2d7671ab`:
  reconoce sólo la variante exacta de0195 leída en Cloud sin relajar otros
  guards0423;165 contratos SQL y rebuild420 aprobados, revisión independiente
  sin bloqueantes. Catálogo alojado:406 entradas,25 migraciones pendientes,
  13 RPC nuevas ausentes,15 buckets privados y versiones Edge inventariadas.
  No se aplicó SQL alojado ni se reintentó push. Acta y pendientes específicos:
  `docs/audits/2026-09-02-codex-release-preflight.md`. Checklist48/103 sin inflar.
  Ese correctivo quedó en `f12ed8ae`. El cierre siguiente, sólo documental,
  completa 94 columnas/tipos en 16 relaciones, ACL y comparación/auth de las
  cuatro Edge alojadas. Resultado entonces: 49/103 (47,6 %), 54 pendientes.
  Dependencias de release 0399→0410 y 0407→0411 explícitas; ninguna aplicada.
  Se conservan los helpers Edge anteriores sin redesplegar: el delta detectado
  está fuera de los helpers llamados por esas entradas. No equivale a smoke.
  Esta documentación añade un decimotercer incremento local sin publicar.
  Quedó en d497a4c9. La comprobación ejecutada del ignoreCommand devuelve
  1/0: el handoff anidado no está excluido y un push puede generar Preview.
  La corrección de esa advertencia añade un decimocuarto incremento documental,
  sin repetir auditorías ni cambiar el porcentaje. No se reintentó el push.
  Ese punto quedó en f761c278. SDD-0367 añade el decimoquinto incremento local:
  guard del webhook antes de Vault para disabled/estados desconocidos,
  recuperación error→active conservada y update final por id/tenant/estado
  actual para no revertir una desactivación concurrente. RED9fallos/16controles,
  GREEN25/25; suite6.441/538, Deno4/4, tipos del test, docs/numeración/gobernanza/
  componentes y revisión independiente aprobados. Sin SQL nuevo ni cambios en
  otras Edge. Privacidad revisada sólo en este delta, sin datos reales.
  Mantuvo49/103(47,6%);359 specs,92 abiertas. La spec0367 sigue in-progress por
  publicación/Edge/smoke. No publicado; el webhook v14 alojado NO tiene este
  guard. No hubo push, integración, deploy ni invocación alojada.

## Último punto de control · helper de worktrees corregido localmente

Sobre `3c1e834ac69a78c63e5405a2af3a70c85a86070a`, vigesimosegundo incremento
local, SDD-0370. Allowlist exacta en su spec: helper, tres archivos de tests/fixture,
spec/índice, dos runbooks, llamador feature, checklist y este handoff. No AGENTS,
dependencias, app, SQL, configuración alojada ni permisos externos.

- Start: codex/origin-main actual, sin upstream ni copia de secretos, instalación
  congelada y error explícito aunque exista marcador Vitest. Conservar worktree
  recién creado si pnpm falla; no afirmar que está listo.
- Finish: ruta principal y candidato exactos, árbol/índice/ignorados, historia real,
  SHA remoto vivo de main y rama, upstream exacto, contención y handoff preservado.
  Exige confirmación externa de inactividad/ownership por SHA: no detecta procesos
  ni concede GO. Revalida antes de retirar, sin prometer atomicidad entre procesos.
  Sólo remove normal y -d opcional; ningún fallback recursivo, force o prune.
- RED: 20 fallos de parser, 5 CLI causales (incluida retirada sin publicación),
  y 1 canario de GIT_GRAFT_FILE. GREEN final: 79 específicos, 27 puros y 52 integración;
  51 usan CLI y 1 importa el comando con sólo remove inyectado para simular fallo.
- Suite global previa: 6.546 aprobadas/1 fallo de contrato de entorno, 540 archivos.
  Se corrigieron sólo dos nombres privados del fixture al prefijo VERIFY_, sin
  tocar .env.example ni su escáner; focal 4/4. Suite final: **6.547/6.547 en 540
  archivos**, 244,76 s, exit 0, `pnpm test --maxWorkers=4`, sin omisiones.
- Node --check, ESLint, docs, numeración 362/421, gobernanza 28, componentes 5,
  nueve enlaces y revisión independiente aprobados. No nuevo build Next,
  SQL, Deno o navegador: alcance Node/documentación, sin efecto en runtime app.
- Los fixtures Git propios se retiraron con contención y marcador de ownership
  comprobados. No instalación pnpm real, red alojada en tests ni mutantes sobre
  los worktrees reales. Principal limpio en 22cec0c2, remoto main 2a2e81bf y
  rama eabb230b comprobados vivos e intactos. Sólo esta tarea Codex está activa.
- Checklist **52/106 (49,1 %), 54 pendientes**: se cierra la casilla del helper,
  no la publicación ni la limpieza real. 362 specs: 267 done, 1 superseded, 94 abiertas.
  SDD-0370 sigue in-progress por publicación/CI. 421 migraciones, 26 gates Cloud
  pendientes; no se aplicó ninguna. El GO de push debe cubrir el SHA final y
  puede generar Preview. No hubo push, integración, deploy ni borrado real.

## Punto anterior · runbooks de worktrees saneados

Sobre `900b25bbcaf25fe4098ecc0fc6e248a3ef640d2f`, vigesimoprimer incremento
documental. Allowlist: los tres runbooks de worktrees/apertura/roles, README,
checklist y este handoff. No cambia AGENTS, runtime, scripts, skills ni permisos.

- Se retiran rutas viejas, copia automática de secretos, instrucciones universales
  de coordinación y atajos de borrado. La guía distingue el modo autónomo/Forja
  de AGENTS y el cierre más restrictivo de Codex, sin ampliar el GO actual.
- Limpieza exige ruta resuelta/registrada, ausencia de sesiones activas, ownership,
  árbol e índice limpios, publicación, contención local/remota y preservación de
  archivos ignorados necesarios. Un fallo no habilita fallback destructivo.
- El helper heredado existe y se leyó completo: start copia env y no congela
  instalación; finish retira antes de comprobar contención, tiene fallback
  recursivo y usa branch -D. No se ejecutó ni corrigió. Su corrección es la nueva
  casilla obligatoria: 51/106 (48,1 %), 55 pendientes, sin inventar un cierre.
- Las plantillas reducen duplicación y no crean tareas Codex por dividir una lista.
  No se borraron archivos de proyecto: se reemplazaron guías conservando historia.
  Sólo esta tarea aparece activa en DTDCargo; ambos worktrees se mantienen.
- Verificación aprobada antes de commit: 22 enlaces internos, dos snippets
  PowerShell parseados sin ejecución, recuento 51/106, docs, numeración,
  gobernanza, componentes, diff y revisión independiente sin Required restantes.
  No se atribuyen tests de aplicación nuevos a un delta documental.
- Publicación sigue bloqueada sin GO exacto. No hubo push, integración, deploy,
  migraciones ni borrado. Siguiente trabajo local: hardening del helper con SDD
  y pruebas sobre fixtures desechables; los permisos remotos siguen separados.

## Punto anterior · bootstrap E2E delimitado

Sobre `1d4b1452c675b9cc4c4571eff31ae2875f587de0`, vigésimo incremento local,
sólo documental. Allowlist: `e2e/README.md`,
`docs/runbooks/e2e-supabase-efimero.md`, checklist de arranque y este handoff.

- Inventario fuente: 14 specs E2E existentes; el selector autenticado comprende
  seis casos en tres proyectos. No prueba Portal/Back/PIN, anulaciones consumadas
  ni la matriz de dos roles del buscador. Se separan seis specs de backlog y
  helpers/workflow inexistentes; `quality.yml` ya existe.
- Antes de 2026-09-03 01:17 UTC, get_project/list_branches con ID explícito
  confirmaron DTD Cargo saludable y sólo la rama main predeterminada. Cero
  branches efímeros disponibles. Siete variables requeridas ausentes del proceso,
  sin inspeccionar secretos de archivos/proveedores. No hubo seed ni E2E.
- El MCP local dio placeholder/fetch failed: no es evidencia de ausencia.
  El inventario afirmado proviene del conector explícito, sólo metadatos.
- La secuencia exige GO del entorno, ownership, SHA/manifiesto frente al ledger,
  preparación coherente, seed único, 18 casos sin omisiones y teardown terminal.
  El control de variables/columnas no certifica ledger, RPCs o backend remoto.
  Se mantiene la decisión de branches alojados; no se introduce un stack local.
- Required de revisión atendido: el bypass de Preview sólo está conectado a
  comentarios, no a los otros cinco casos. Se exige app local o Preview
  accesible para los cuatro specs, sin desactivar protecciones ni ampliar código.
- Corrección de documentación y definición de gates, no implementación ni
  cierre del bootstrap. Checklist 51/105, 54 pendientes; specs 361/93 abiertas.
  No se repiten como nuevas las suites anteriores ni se atribuye una corrida
  autenticada. Sin push, merge, aplicación, deploy, credenciales ni datos alojados.
- Revisión independiente aprobada; docs, numeración, gobernanza, componentes,
  diff e inventario de rutas/casos/enlaces aprobados antes del commit selectivo.
  El siguiente gate sigue siendo el GO de publicación del SHA exacto; el ciclo
  efímero necesita autorización separada. Principal y worker se conservan.

## Punto anterior · cobertura de Referidos cerrada

Sobre `2f1242b7ffec9f835d8875025aaeedaf94935197`, este decimonoveno incremento
local sólo cierra documentalmente SDD-0309. Su contrato está en main desde
`de94ba47`; los SQL0197/0238/0250 y el test son idénticos a origin/main2a2e81bf.
No se añade ni modifica código, test, migración, dependencia o dato alojado.

- Contrato real en PostgreSQL17 aislado sin red: GREEN, siete criterios.
  Mutaciones en memoria: sin estado pendiente → CONTRATO2, sin guarda de
  borrado → CONTRATO4, sin tenant en lookup+UPDATE juntos → CONTRATO5.
  Los tres RED fueron causales, no errores de compilación.
- Cuatro rollbacks verificados desde conexiones nuevas. Contenedor propio
  `dtd_referral_close_3dd66432a2` retirado y ausencia comprobada, sin volúmenes
  ni puertos. No se tocó ningún contenedor ajeno ni se creó un backend permanente.
- Revisor independiente aprobó el cierre de cobertura. Se fecharon como
  históricas las afirmaciones de producción/120 contratos originales.
  No se certifican RLS, roles, concurrencia, cada filtro tenant por separado,
  acreditación real ni aplicación financiera del crédito (SDD-0137).
- Acta: `docs/audits/2026-09-02-codex-cierre-referidos.md`.
  Allowlist de cinco rutas: acta, spec0309, índice generado de specs, checklist
  de arranque y este handoff. No se vuelven a atribuir como nuevas las suites
  globales del incremento anterior; la matriz SQL focal sí se ejecutó ahora.
- Inventario:361 specs,267 done,1 superseded y93 abiertas (78 in-progress,
  8 proposed,4 approved,3 draft). Checklist51/105 (48,6%),54 pendientes:
  una spec menos abierta dentro de la misma casilla, sin inflar el porcentaje.
  Continúan421 migraciones y26 gates alojados pendientes; ninguna aplicada.
- Sólo `Audita y limpia worktrees` (01a05f15-80ff-77b1-9f3a-6b07d21df02d)
  aparece activa en DTDCargo en la lista de30 tareas. Se conserva el carril
  worker y el checkout principal. Sin push, integración, deploy ni Cloud.
- El rechazo de publicación sigue exigiendo autorización del SHA final hacia
  `origin/codex/saneamiento-integral`, con posible Preview. No se hereda un
  GO hasta2f1242b7. Dos worktrees preservados por falta de publicación/contención;
  siguiente responsable Sam para GO y después integrador exclusivo.

## Punto anterior · destino E2E coherente

Sobre `00d972e2d69922d996d770b6abb2e682589b627a`, SDD-0369 añade el
decimoctavo incremento local sin publicar. Conserva **51/105 (48,6 %), 54
pendientes**: progreso parcial del bootstrap, no cierre ni nueva casilla.
361 specs, 94 abiertas; 0369 permanece in-progress por publicación/CI y
validación efímera real autorizada. Continúan 421 migraciones/26 gates de
aplicación pendientes (0399–0424); esta pieza no añade SQL.

- Causa: el guard aceptaba el primer label correcto con dominio ajeno; Next
  conservaba variables de otro destino y los aliases se mutaban parcialmente.
- Correctivo: ref DNS válido, href HTTPS exacto sin credenciales/rutas/query,
  URL canónica, coherencia URL/anon/service-role y rechazo de deny-only efímero.
  La preparación sólo modifica el entorno después de validar el conjunto.
  Next local recibe la clave elevada únicamente en la variable de servidor;
  Preview valida lo declarado, sin inyectar configuración al backend remoto.
- RED independiente y comprobado por el principal: 23 fallos/13 controles.
  GREEN focal: 62 pruebas/3 archivos. Suite global: 6.477/539, exit0;
  TypeScript global, ESLint focal, numeración/gobernanza/componentes aprobados.
  Índice generado; docs:check y diff:check forman parte del cierre selectivo.
- CLI Playwright real con --list, proceso de entorno sintético: 18 tests en
  4 archivos/3 proyectos. Configuración con clave incoherente falla en el
  guard sin revelar valores. No se inició Next, navegador, seed ni cliente
  de red. No se presume un smoke autenticado ni identidad del Preview.
- Revisión independiente: APROBADO sin Required. No se repiten build/browser,
  SQL/rebuild/advisors o Deno: cambia sólo tooling TS y documentación, no la
  aplicación, base ni Edge. Se preserva la política de branches efímeros.
- Allowlist exacta: `scripts/e2e/sdd-0168-fixture.ts`, `playwright.config.ts`,
  `scripts/__tests__/e2e-target-boundary.test.ts`, `e2e/README.md`,
  `docs/specs/0369-e2e-project-boundary/spec.md`, `docs/specs/README.md`,
  `docs/audits/2026-09-02-codex-arranque-checklist.md` y este handoff.
- La lista de 30 tareas muestra sólo `Audita y limpia worktrees`
  (`01a05f15-80ff-77b1-9f3a-6b07d21df02d`) activa en DTDCargo. Sin cambios
  ajenos absorbidos; checkout principal y dos ramas archive conservados.
- El snapshot congelado de204 avisos conserva SHA-256
  `8402922847e5de057e7e0b10e2ef7fd8ed38e43fc3ec46020165be62e965452a`.
  No se consultó metadata/PII alojada ni se regeneró el inventario.
- Push no reintentado; auto-review exige aprobación explícita del SHA final
  y destino `origin/codex/saneamiento-integral`, con posible Preview.
  El GO solicitado hasta00d972e2 no cubre automáticamente este incremento.
  No main, merge, deploy, migración ni modificación de secretos.
- Limpieza final bloqueada: los dos worktrees se conservan mientras haya
  trabajo no publicado/integrado. Siguiente responsable: Sam para GO de push
  y operaciones alojadas; después integrador exclusivo para cierre Git.

## Punto anterior · principal Club coherente

Sobre `c6accbcd75e05395b6bb0a55fef82f6493b9b516`, SDD-0368/0424 añade el
decimoséptimo incremento local sin publicar: `00d972e2`. Checklist
**51/105 (48,6 %), 54 pendientes**: una corrección local
completada y un nuevo gate nominal pendiente, no casillas por cada prueba.
360 specs, 93 abiertas; 0368 permanece in-progress por release/smoke.

- RED causal: vínculo→cliente y cliente→persona de distinto tenant permiten
  doce lecturas cruzadas en las seis tablas con 0187. 0424 sustituye sólo el
  helper existente para exigir identidad/tenant coherentes, vínculo active y
  cliente vivo; preserva firma/OID/ACL, policies, triggers y datos.
- GREEN: 374 aserciones y 27 derivas; acceso A/B, historia pausada/cancelada,
  equipo/dual, revocaciones, no DML Portal, paridad e idempotencia aprobados.
  El canario restrictivo conserva diez aserciones en conexión/PID nuevo,
  separado de las 364 principales; ambos rollbacks tienen guardas de limpieza.
  La interferencia observada en el arnés no motivó un workaround de runtime.
- Root: 166 contratos SQL aprobados con rollback total; rebuild de 421 migraciones
  (403 desde cero + 18 sólo-ledger), 219 tablas/dos tenants; 37 unitarios Club
  sin cambios. Docs/numeración/gobernanza/componentes y diff aprobados.
  Revisor independiente: APROBADO sin bloqueantes, sólo para este delta.
  No se repitieron build/E2E/Deno/global TypeScript por un delta SQL/documental.
- Advisors locales: dos WARN heredados, `touch_updated_at` y
  `academy_enrollments_validate_person`; ninguno en el helper modificado.
  CLI contra 127.0.0.1 efímero con fixture vacío, nunca linked/Cloud.
  Contenedores propios de test y advisor retirados; runner SQL con --rm.
- Metadatos alojados del helper/policies contrastados, sin invocar funciones
  ni leer miembros/PII. Cloud conserva 0187; no se aplicó 0424. El paquete ahora
  tiene 421 archivos y 26 gates nominales pendientes (0399–0424). No se regeneró
  el snapshot congelado de 204 avisos ni se atribuyó remediación alojada.
- Allowlist exacta: `supabase/migrations/0424_portal_club_principal_tenant.sql`,
  `supabase/tests/0424_portal_club_principal_tenant.test.sql`,
  `docs/specs/0368-portal-club-principal-tenant/spec.md`, `docs/specs/README.md`,
  `docs/audits/2026-09-02-codex-arranque-checklist.md` y este handoff.
  Ningún archivo runtime TS/TSX, secreto o cambio ajeno incluido.
- Tareas inspeccionadas: sólo `Audita y limpia worktrees`
  (`01a05f15-80ff-77b1-9f3a-6b07d21df02d`) activa en DTDCargo. Rol worker;
  checkout principal limpio en 22cec0c2 y ramas archive conservados.
- Push no reintentado: requiere nueva aprobación del SHA final hacia
  `origin/codex/saneamiento-integral`, considerando posible Preview.
  La solicitud anterior limitada a c6accbcd no autoriza este incremento.
  CI alojado de eabb230b no cubre los 17 commits locales. Sin merge ni deploy.
- Limpieza final bloqueada por publicación/integración pendientes: se
  mantienen exactamente dos worktrees. Siguiente responsable: Sam para los
  GO específicos y después integrador exclusivo para release/contención.

## Punto anterior · clasificación de avisos alojados

El correctivo Kommo quedó en `a2456aa24ded1ac9974181ce2d9babd340bd216d`.
Este decimosexto incremento local sólo documenta el triaje y actualiza el
checklist: **50/103 (48,5 %), 53 pendientes**. El denominador no cambió.
Cloud/operación pasa de3/31 a4/31 por clasificación, no por remediación.

- Advisor observado en `xpfuzqombmjmxvprjgmi` el2026-09-03 a00:09:55 UTC
  (2026-09-02,20:09:55 Caracas): 204 claves únicas,20 INFO y184 WARN.
- Inventario:162 funciones distintas,20 tablas y1 extensión,19 dominios.
  Las21 funciones con aviso anon también tienen aviso authenticated.
  Nueve son triggers; no se cuentan como RPC ordinarias.
- Las20 tablas tienen RLS sin policies y no tienen SELECT a nivel tabla para
  anon/authenticated; no se midieron grants de columna. Cuatro conservan
  TRUNCATE, vinculado al gate0399; no se demostró un vector API de TRUNCATE.
  Verificación pública conserva el gate0400 y pagos respeta0421/0422/0423.
  pg_net no es relocatable; no se ejecuta el traslado genérico del advisor.
- Verificación: JSON válido, firmas/roles/categorías/objetos emparejados,
  341 referencias locales válidas (179 menciones RPC,162 CREATE), anexo y
  agregados íntegros. Revisión independiente aprobada; se precisaron la
  diferencia entre funciones/endpoints y el alcance de SELECT a nivel tabla.
- Snapshot:213.771 bytes, SHA-256
  `8402922847e5de057e7e0b10e2ef7fd8ed38e43fc3ec46020165be62e965452a`.
  Informe:`docs/audits/2026-09-02-codex-triaje-advisors.md`;
  datos:`docs/audits/assets/2026-09-02-advisors-security.json`.
- Allowlist: esos dos archivos, el checklist de arranque y este handoff.
  Sin runtime, SQL nuevo, lecturas de negocio/PII, invocaciones de RPC,
  escrituras alojadas, supresiones, push, merge, migraciones o deploy.
  El CI remoto anterior no cubre los16 incrementos locales. Se requiere
  aprobación del SHA final/destino; el push puede generar Preview por el
  handoff anidado. No se reintentó la publicación rechazada.

## Trabajo rescatado y cerrado

1. `5dde643f` — `fix(db): revocar TRUNCATE a roles públicos`.
2. `152055a2` — `docs: actualizar recepción para Codex`.
3. `89cc962f` — `feat(studio): SDD-0315 — neutralizar fórmulas CSV`.
4. `a8fff64c` — `fix(studio): SDD-0316 — minimizar logs inbound`.
5. `7cc03fef` — `fix(admin): SDD-0317 — retirar secreto CBM de URL`.
6. `c8e07855` — `perf(portal): SDD-0318 — consultar documentos en lote`.
7. `35270881` — `fix(crm): SDD-0319 — compartir reloj fuera del render`.
8. `1c07d1f2` — `docs: actualizar arranque de Codex`.
9. `2511f280` — `fix(deps): actualizar Vite y cerrar advisories nuevos`.
10. `8725a341` — `test(e2e): SDD-0320 — ejecutar Tier 1 sin secretos`.
11. `b14f1d25` — `test(e2e): SDD-0321 — acotar concurrencia y teardown`.
12. `d5c72bfd` — `chore(test): cargar Vitest como ESM explícito`.
13. `1faff60b` — `perf(studio): SDD-0322 — consultar relaciones de órdenes en lote`.
14. `09273cc8` — `fix(a11y): SDD-0323 — cerrar barreras Web Quality`.
15. `fix(a11y): SDD-0324 — unificar tabs del Studio` — el hash es el commit
    `b0c8bb83`.
16. `04f8ef94` — `fix(admin): SDD-0325 — limitar intentos CBM`.
17. `6d6c41d4` — `fix(telegram): SDD-0326 — preparar secreto fuera de URL`.
18. `899f516a` — `fix(mobile): SDD-0327 — autenticar cookie de operario`.
19. `53d91357` — `fix(db): SDD-0328 — cerrar bypass de verificación`.
20. `e937bf3b` — `test(e2e): SDD-0329 — aislar caché de Next`.
21. `05075516` — `chore(deps): retirar configuración pnpm obsoleta`.
22. `0fdd2c70` — `fix(studio): SDD-0330 — retirar Nominatim`.
23. `9bd4eb41` — `chore(tooling): fijar Node 24 y pnpm 11`.
24. `fix(studio): SDD-0331 — retirar consultas de identidad inseguras` — el
    commit `927878a6`.
25. `fix(infra): SDD-0332 — retener llave KMS del backup` — el commit que
    precede este cierre.
26. `fix(studio): SDD-0333 — validar configuración de integraciones` — el
    commit `18f5074e`.
27. `chore(config): SDD-0334 — retirar Payload legado` — el commit que contiene
    el hash `4cf0c60a`.
28. `test(portal): SDD-0335 — contener service_role` — el commit que contiene
    este handoff y el checklist de arranque Codex.
29. `fix(portal): SDD-0336 — resolver marca por principal` — el commit que
    contiene este handoff y la migración 0401 todavía no aplicada.
30. `fix(portal): SDD-0337 — resolver hitos por principal` — el commit que
    contiene este handoff y la migración 0402 todavía no aplicada.
31. `fix(portal): SDD-0338 — resolver asesor por principal` — el commit que
    contiene este handoff y la migración 0403 todavía no aplicada.
32. `fix(portal): SDD-0339 — resolver referidos por principal` — el commit que
    contiene este handoff y la migración 0404 todavía no aplicada.
33. `fix(portal): SDD-0340 — acotar firma de adjuntos de compra` — el commit que
    contiene este handoff; no crea migración.
34. `fix(portal): SDD-0341 — resolver perfil privado por principal` — el commit
    que contiene este handoff y la migración 0405 todavía no aplicada.
35. `fix(portal): SDD-0342 — resolver documentos por principal` — el commit que
    contiene este handoff y la migración 0406 todavía no aplicada.
36. `fix(portal): SDD-0343 — acotar detalle operativo de compra` — el commit que
    contiene este handoff; no crea migración.
37. `fix(portal): SDD-0344 — acotar contexto privado de soporte` — el commit que
    contiene este handoff; no crea migración.
38. `fix(portal): SDD-0345 — acotar detalle privado de envío` — el commit que
    contiene este handoff; no crea migración.
39. `fix(portal): SDD-0346 — acotar listado privado de envíos` — el commit que
    contiene este handoff; no crea migración.
40. `fix(portal): SDD-0347 — acotar contexto privado del home` — el commit que
    contiene este handoff; no crea migración.
41. `fix(portal): SDD-0348 — acotar lectura legal de aceptación` — el commit que
    contiene este handoff; no crea migración.
42. `ci: SDD-0349 — automatizar calidad sin secretos` — el commit que contiene
    este handoff y prepara el primer workflow de GitHub Actions del repo.
43. `fix(db): SDD-0350 — aplicar RBAC de escritura a facturas` — el commit que
    contiene este handoff y la migración 0407 todavía no aplicada.
44. `fix(db): SDD-0351 — aplicar RBAC admin-only a Mailing` — el commit que
    contiene este handoff y la migración 0408 todavía no aplicada.
45. `fix(db): SDD-0352 — aplicar RBAC a conciliación bancaria` — el commit que
    contiene este handoff y la migración 0409 todavía no aplicada.
46. `fix(collections): SDD-0353 — minimizar contexto de correo` — el commit que
    contiene este handoff y la migración 0410 todavía no aplicada.
47. `fix(crm): SDD-0354 — minimizar facturación anual` — el commit que contiene
    este handoff y la migración 0411 todavía no aplicada.
48. `fix(rbac): SDD-0354 — respetar permisos efectivos en agregado` — corrige
    0411 antes de publicarla para respetar los overrides vigentes de SDD-0252.
49. `fix(conversaciones): SDD-0355 — minimizar saldo por hilo` — agrega la
    migración 0412 todavía no aplicada y elimina la lectura directa de facturas.
50. `fix(ventas): SDD-0356 — minimizar referencias de facturas` — agrega la
    migración 0413 todavía no aplicada y elimina la lectura directa de Órdenes
    de venta.
51. `fix(db): SDD-0357 — cerrar lectura de facturas por principal` — agrega la
    migración 0414 todavía no aplicada y prueba la frontera financiera/Portal.
52. `fix(release): SDD-0358 — separar expansión y restricción de Mailing` —
    conserva 0410 compatible y difiere el cierre admin-only a 0415, después del
    deploy y smoke de Cobranzas; ninguna fue aplicada.
53. `fix(portal): SDD-0359 — aislar envíos y sus hijos por tenant` — reemplaza
    tres policies de lectura Portal en 0416; equipo, ACL y datos conservados.
54. `fix(ci): SDD-0349 — dimensionar memoria del primer CI` — corrige el heap
    de TypeScript/build y registra publicación, PR y preflight Cloud de lectura.
55. `fix(public): SDD-0360 — evitar carrera de foco en destino` — elimina la
    selección tardía de texto que el segundo CI reprodujo; conserva teclado,
    Escape y edición manual. No cambia SQL ni configuración del workflow.
56. `docs: cerrar tres specs integradas con evidencia` — reconcilia SDD-0280,
    SDD-0303 y SDD-0304 con main; quedan 90 specs sin cierre documental.
    Alcance de ocho rutas en el acta de reconciliación, sin cambios runtime.
57. `fix(portal): SDD-0361 — aislar compras y proveedores por tenant` — modifica
    siete policies Portal en 0417; conserva operación interna, ACL y Storage.
58. `test(auth): verificar contratos de acceso ya integrados` — agrega 52
    regresiones del proxy y actions de empresa; conserva 0299/0302 abiertas
    por navegador/sesión real. Alcance exacto en el acta de acceso; sin runtime
    ni migraciones nuevas. 61 focales y 6.013 unitarios completos aprobados,
    junto con TypeScript, ESLint y gates documentales.
59. `test(studio): SDD-0289 — verificar y cerrar exportaciones operativas` —
    añade 19 regresiones HTTP/paginación sin cambiar runtime y reconcilia la
    spec con su implementación en main; quedan 89 sin cierre documental.
    Pasan 42 focales, 29 contratos adicionales y 6.032 unitarios / 530 archivos,
    TypeScript, ESLint y gates documentales.
60. `fix(portal): SDD-0362 — aislar aprendizaje de Academia por tenant` —
    sustituye ocho policies Portal en 0418; conserva catálogo permitido,
    historia propia, equipo y contratos existentes. RED real y GREEN con
    159 contratos SQL, 68 unitarios focales y rebuild de 415 migraciones.
61. `fix(portal): SDD-0363 — aislar reclamos y evidencias por tenant` —
    sustituye dos policies SELECT en 0419; preserva historial propio, equipo,
    Storage y contratos. RED real y GREEN, 160 contratos SQL, 47 unitarios
    focales y rebuild de 416 migraciones. Publicación bloqueada, sólo local.
62. `fix(portal): SDD-0364 — aislar reportes de pago por tenant` — sustituye
    tres policies Portal en 0420; conserva operaciones propias, historial y
    contratos. RED real, GREEN con diez drifts, 161 contratos SQL, 19 unitarios
    y rebuild de 417 migraciones. Publicación bloqueada; los comandos de pagos
    tienen hallazgos separados, documentados como siguiente prioridad.
63. `fix(portal): SDD-0365 — contener errores y proteger comprobantes` —
    primera etapa: conteo fail-closed, cancelación veraz, firma con contexto
    y conservación de evidencia ante INSERT incierto. Sin SQL ni cambios
    financieros. La spec sigue en progreso por sus etapas de comandos y RBAC.
    Recibo: `.agents/handoffs/2026-09-02-payment-report-command-safety-close.md`.
64. `feat(portal): SDD-0365 — agregar comandos de pago auditados` — expansión
    SQL0421 con cancelación conservada, identidad/permisos y recibo idempotente.
    RED/GREEN de400 aserciones, cinco carreras, 162 contratos SQL, rebuild418 y
    6.096 unitarios verdes. Sin consumidores nuevos, restricción ni Cloud.
    La spec sigue abierta: la app todavía necesita adoptar estas RPC.
65. `fix(portal): SDD-0365 — estabilizar comprobantes y validar recibos` —
    transporte de tres RPC de sesión con recibo estricto y errores seguros;
    comprobantes estables por contenido, recuperación por igualdad de bytes.
    222 tests independientes del transporte y 24 del uploader; suite completa
    6.342/534 archivos verde. Sin consumidores UI nuevos ni Cloud.

66. `feat(portal): SDD-0365 — adoptar comandos de pago auditados` —
    tres acciones RPC de sesión, recibos y reintentos estables, confirmación
    con motivo y presentación veraz de errores/cancelación. 106 focales,
    19 UI independientes y suite completa6.401/536; foco/contraste/reflow
    probados en navegador local. Restricción de base y release pendientes.

67. `fix(portal): SDD-0365 — restringir escritores y lectura de pagos` —
    restricción0422 posterior a consumidores: API sólo SELECT, lectura financiera
    por membresía activa, Portal histórico conservado y RPC legacy sin EXECUTE.
    Pasan 301 aserciones, 35 derivas, 163 contratos SQL, rebuild419 y cinco
    carreras reales. Revisión independiente cerrada. Sin aplicación alojada.

68. `fix(studio): SDD-0366 — conservar pagos históricos al renombrar Shipping Mark`
    — corrige23514 sobre facturas archivadas sin permitir nuevos pagos ni
    editar campos financieros. Conserva comprobantes/recibos/eventos y anexa
    auditoría atómica;323 aserciones incluidas18 derivas,164 contratos SQL y
    rebuild420. Revisión independiente aprobada, sin aplicación alojada.
    Recibo: `2026-09-02-payment-report-historical-identity-close.md`.

69. `docs(handoff): preservar la historia Cloud en un bundle verificable` —
    conserva tres commits documentales y su merge, HEADd05b6355, en un bundle
    incremental de135.144 bytes. Verificación y recuperación con hashes
    idénticos; referencia temporal retirada. No restaura AGENTS antiguo,
    cambia código, publica ni elimina ramas. Acta y recibo específicos;
    este incremento no aumentó el47/103 porque no completó integración.

70. `fix(tooling): corregir avisos moderados de qs` — override6.16.0, sin
    cambiar otras resoluciones del lockfile. RED6/GREEN9 → GREEN15 y15/15
    adicionales en instalación limpia congelada sin scripts. Audit nativo
    2 moderados → 0 avisos. Firma e integridad verificadas; fixture retirado.
    Casilla P2 resuelta localmente, publicación pendiente. Acta y recibo
    específicos: `2026-09-02-codex-qs-tooling.md` / `2026-09-02-qs-tooling-close.md`.

Los allowlists exactos de cada cambio de comportamiento viven en SDD-0315 a
SDD-0366. Los últimos lotes retiran la consulta externa CNE/SENIAT, alinean el
ciclo de vida del bucket WORM histórico con su llave KMS, eliminan falsos verdes
de configuración, retiran el contrato de entorno del Payload descontinuado y
congelan la expansión de `service_role` en Portal. SDD-0336 ejecuta el primer
slice del retiro: dos lecturas de marca dejan de depender de `service_role`.

## Verificación vigente

Correctivo0423 sobre `f649bdbc`: RED causal23514 → GREEN323 aserciones
(incluidas18 derivas), rollback integral. Suite SQL completa164/164, exit0.
Rebuild de esta misma migración:420 archivos (402 schema+18 sólo-ledger),
219 tablas y2 tenants sintéticos. Advisors locales:5 WARN heredados del fixture
(4 de rendimiento y1 de search_path del helper), ninguno en la función
modificada. Revisión independiente aprobada. Spec con matriz SGE-00/BTN/MP/AUD
y recibo advisory de datos; sin certificación de SDD-0258 ni de producción.
Índice:358 specs,91 sin cierre documental. Checklist vigente tras preflight:49/103
(47,6 %),54 pendientes; no es avance del producto ni estimación de horas.
Catorce incrementos locales requieren publicación autorizada. Las pruebas de qs
son adicionales y están en su acta; no se presentan TS/build/SQL anteriores
como ejecuciones nuevas de ese mantenimiento de desarrollo.

El cierre documental sobre f12ed8ae sólo modifica esta entrega, el checklist
y el acta de release. Sin cambios SQL/TS, secretos, configuración, main o
proveedores. Verificación proporcional: docs:check, diff --check y recuento
de las 103 casillas; los 165 contratos SQL/rebuild420 corresponden al correctivo
anterior, no se vuelven a atribuir a este incremento documental. Inventario de
tareas: 50 recientes, sólo `Audita y limpia worktrees` de DTDCargo; ningún otro
cwd observado apunta al worker. El checkout principal no se movió.

Evidencia anterior, no ejecución nueva en0423:

Restricción0422 sobre `bcf111a8`: 301 aserciones y 35 derivas con rollback de
catálogo/filas; SQL0421 conserva sus 400 aserciones y hash. Suite SQL completa:
163 contratos. Rebuild final: 419 archivos (401 schema +18 sólo-ledger),
219 tablas públicas y dos tenants sintéticos. Cinco carreras reales con ACL/RLS
final verdes. Advisors locales: un WARN del helper legacy/stub touch_updated_at;
ningún objeto nuevo señalado. Revisión independiente sin hallazgos pendientes
tras corregir dependencia de rol y MAINTAIN heredado. No Cloud ni datos reales.
Los contenedores propios fueron retirados. Sin nueva ejecución TS/Vitest/build
porque sólo cambia SQL, harness y documentación. Gates documentales y lint del
harness se repiten antes del commit. Checklist contado: 46/101 (45,5 %),
55 pendientes; no es porcentaje del producto ni estimación de tiempo restante.

Evidencia previa de consumidores sobre85912909: 6.401/6.401 pruebas en536 archivos (141,56s),
106 focales de acción/modelo/comprobante y19 UI independientes. Después de
ajustes visuales, UI+canonical32/32 (11,25s). TypeScript sin caché aprobado;
RSC1.591 sin cruces, lint/gobernanza28/CMP5 aprobados. Build final aprobado:
158 páginas, postbuild, tsconfig restaurado y .next-verify retirado.
Navegador local: Portal320/390 y Studio320, teclado/recibos/reintentos y
contraste. Upload de navegador denegado por raíces, sin eludirlo: no es E2E
Auth/Storage. Fixture y servidor propios retirados. No SQL/Cloud nuevo.

Evidencia histórica de transporte/comprobantes: 6.342/6.342 pruebas en 534
archivos, 113,50 s; TypeScript sin caché, ESLint de cuatro archivos y frontera
RSC de 1.590 módulos sin cruces aprobados. Docs, gobernanza y CMP pasan.
Sin nueva ejecución de build/E2E/rebuild SQL; la aplicación aún debe adoptar
los comandos. No hay contenedores propios pendientes ni efectos alojados.

Incremento previo SQL0421: 400 aserciones independientes, cinco carreras entre
sesiones, 162 contratos SQL y rebuild418 (400 schema +18 sólo-ledger) verdes.
Unitarios: 6.096/532 archivos, 155,02s; lint/sintaxis del harness y gates de
docs/numeración/CMP/gobernanza aprobados. Advisors sólo del fixture: un WARN
legacy de touch_updated_at, sin hallazgos de objetos nuevos. No se volvió a
ejecutar build/TS/E2E ni a consultar Cloud. Fixtures propios retirados.

Seguimiento CI: el segundo run (`33660502119`, commit `726a7118`) pasó
TypeScript/Edge y confirmó la corrección de memoria. Detectó 1 fallo / 5.957
pases por selección de texto tardía en `DestinoCombobox`; SDD-0360 lo reproduce
y corrige sin relajar expectativas. Ahora pasan 13 unitarios focales y 5.961
pruebas / 527 archivos completos; TypeScript sin caché, ESLint, numeración,
componentes y gobernanza pasan. Navegador local: escritura, Escape, cursor
manual y Enter correctos; sin datos/credenciales reales. Build aislado: 158
páginas, postbuild y restauración de tsconfig correctos. El tercer run fue
cancelado por concurrencia. El run completo `33664422658` del SHA `a4f1ba5f`
terminó aprobado. SDD-0361 también pasó su CI completo: `d4a63115`, run
`33667880574`, terminado success a las 18:47:15 UTC del 2026-09-02.
El lote posterior de acceso agrega 52 pruebas: 61 focales / cuatro archivos y
6.013 pruebas / 529 archivos completos, TypeScript, ESLint, docs, numeración,
gobernanza y componentes aprobados localmente. Conserva 0299/0302 abiertas por
sus validaciones reales; no cambia runtime, SQL ni configuración. Su CI completo
`33669760589`, SHA `726d2f85`, terminó success a las 19:05:39 UTC del 2026-09-02
(14 min 22 s), antes de publicar el cierre de exportaciones. Los baselines
siguientes conservan su alcance.

El cierre posterior de SDD-0289 añade 19 regresiones del endpoint operativo:
queries/paginador/builders reales con tablas sintéticas. Pasan 42 focales y 29
contratos CSV/RBAC adicionales; suite completa 530 archivos / 6.032 pruebas,
TypeScript, ESLint, docs, numeración, gobernanza, componentes y diff. No se
repite SQL/rebuild/E2E porque no cambia runtime ni sus entradas; tampoco se
atribuye una descarga en navegador/Excel o una prueba alojada a este lote.
Su CI completo quedó aprobado: `eabb230b`, run `33671435585`, terminado a las
19:22:45 UTC del 2026-09-02 (14 min 54 s), incluido build y árbol reproducible.

SDD-0362 reproduce seis lecturas cruzadas, acceso a borrador, DELETE ajeno e
INSERT sin inscripción en las policies históricas. El contrato nuevo pasa con
ocho sustituciones, ocho preflights de drift y conservación bidireccional de
ACL/policies/RPC/triggers. Pasan 68 unitarios focales y los 159 contratos SQL;
rebuild de 415 migraciones: 397 desde cero + 18 sólo-ledger, 219 tablas y dos
tenants sintéticos. No cambia TS/TSX ni repite build/E2E locales por rutina.
La aplicación conserva el baseline de 530 archivos / 6.032 unitarios; el CI
del nuevo commit debe confirmarse aparte. `pnpm audit --audit-level high` sale
0, con dos avisos moderados de desarrollo en qs; quedan en el checklist para
un lote propio, sin declarar dependencias libres de avisos.

SDD-0363 reproduce la lectura de reclamo y evidencia B por principal A con
Shipping Mark repetido. RED sin 0419 sale 1 por visibilidad; GREEN sale 0 con
ocho preflights de drift, roles inválidos, equipo/dual e historia propia.
Pasan 160 contratos SQL y rebuild de 416 migraciones: 398 desde cero + 18
sólo-ledger, 219 tablas / dos tenants sintéticos. También pasan 47 unitarios
en cuatro archivos. No cambia la aplicación ni se repite build/E2E local.
Fixture propio retirado tras rollback; runners SQL/rebuild terminan sin fallos.
La evidencia SQL local no certifica firma real, explotación ni estado alojado.

SDD-0364 reproduce SELECT/INSERT/UPDATE y reasignación cruzados de reportes
de pago. GREEN con diez preflights de drift, ocho principales inválidos,
historia y operaciones propias, equipo/dual/service. Pasan 161 contratos SQL,
19 unitarios focales y rebuild de 417 migraciones: 399 desde cero + 18
sólo-ledger, 219 tablas/dos tenants sintéticos. Fixture propio retirado tras
rollback; no se modifica TS/TSX. Quedan reproducidos y SIN resolver en 0420:
cancelación propia rechazada, metadata/moneda/path manipulables y confirmación
directa no financiera sin acumulador. El siguiente slice deberá gobernar los
comandos con auditoría atómica, sin cambiar la decisión financiera de SDD-0134.

El último `node scripts/verify.mjs` canónico terminó sin fallos de gate después
de SDD-0357:

- 14 de 15 gates medidos, ninguno falló.
- ESLint, frontera RSC, TypeScript y cuatro Edge Functions: OK.
- Vitest posterior a SDD-0357: 527 archivos / 5.957 pruebas pasaron.
- Documentación, numeración (349 specs / 411 migraciones), componentes y
  gobernanza: OK.
- SQL: 155 contratos pasaron con rollback total.
- Rebuild: 411 migraciones; 393 aplicadas desde cero y 18 sólo-ledger;
  aislamiento multi-tenant verificado en 219 tablas y 2 tenants.
- E2E: 150 pasaron, 18 se omitieron por requerir entorno alojado y cero
  fallaron. En esta corrida no hubo bloqueo de teardown de WebKit.
- Build de producción: OK, 158 páginas estáticas generadas.
- `migrations-applied`: NO MEDIDO porque este worktree no tiene credenciales.

Además, SDD-0331 pasó sus contratos focales (2 archivos / 5 pruebas), ESLint,
TypeScript, `docs:check`, `governance:check`, `components:check` y
`git diff --check`.

SDD-0333 valida configuración compuesta sin contactar proveedores; su evidencia
focal se registra en el handoff específico del cambio.

SDD-0334 retira únicamente configuración local sin consumidores; no toca el
piloto vigente de adjuntos ni variables alojadas.

SDD-0335 agrega un gate de inventario para Portal y deja el backlog ejecutable
en `docs/audits/2026-09-02-codex-arranque-checklist.md`.

SDD-0336 baja ese inventario de 11 rutas / 23 construcciones a 10 / 21 y pasa
Vitest focal, suite completa, 142 contratos SQL, rebuild, TypeScript, ESLint,
documentación, gobernanza y componentes.

SDD-0337 centraliza la visibilidad de hitos en una RPC sin parámetros, elimina
la implementación TypeScript duplicada y baja el inventario a 10 rutas / 19
construcciones. Pasó Vitest focal/completo, 143 contratos SQL, rebuild,
TypeScript, ESLint, documentación, gobernanza, componentes y diff.

SDD-0338 resuelve el asesor asignado mediante una RPC sin parámetros, exige una
vinculación Portal y membresía del asesor activas en el mismo tenant, y baja el
inventario a 10 rutas / 18 construcciones. Pasó 6 pruebas focales, la suite
completa de 5.904 pruebas, 144 contratos SQL, rebuild, TypeScript y ESLint.

SDD-0339 mueve el snapshot de Referidos a una RPC sin parámetros y minimiza su
respuesta a facturación agregada, montos del programa y filas visibles sin datos
de contacto. Baja el inventario a 9 rutas / 17 construcciones y pasó 7 pruebas
focales, la suite completa de 5.901 pruebas, 145 contratos SQL, rebuild,
TypeScript y ESLint.

SDD-0340 encapsula la firma de adjuntos de prealerta en un módulo `server-only`
que relee primero los documentos permitidos por RLS y no acepta storage paths del
caller. Baja el inventario a 8 rutas / 16 construcciones y pasó 6 pruebas focales,
la suite completa de 5.905 pruebas, TypeScript y ESLint.

SDD-0341 centraliza códigos históricos y paths de fotos en una RPC sin parámetros,
firma sólo dentro de un módulo `server-only` y no entrega paths a la página. Baja
el inventario a 7 rutas / 14 construcciones y pasó 7 pruebas focales, la suite
completa de 5.910 pruebas, 146 contratos SQL, rebuild, TypeScript y ESLint.

SDD-0342 resuelve los packing lists mediante una RPC sin parámetros ligada a
`auth.uid()` y firma únicamente los documentos que una lectura RLS devuelve al
módulo `server-only`. Baja el inventario a 6 rutas / 12 construcciones y pasó 7
pruebas focales, la suite completa de 5.915 pruebas, 147 contratos SQL, rebuild,
TypeScript y ESLint.

SDD-0343 mueve recepciones, fotos y packing list del detalle de compra a un
facade `server-only` que recibe sólo el código, vuelve a probar principal +
propiedad con la sesión y reutiliza un único admin. Baja el inventario a 5 rutas
/ 10 construcciones y pasó 7 pruebas focales, la suite completa de 5.920 pruebas,
TypeScript y ESLint. No crea migración.

SDD-0344 mueve evidencia y conversación de Soporte a un contexto `server-only`
sin parámetros que resuelve cliente, reclamos y envíos desde la sesión antes de
elevar. Baja el inventario a 4 rutas / 9 construcciones y pasó 6 pruebas focales,
la suite completa de 5.924 pruebas, TypeScript y ESLint. No crea migración.

SDD-0345 encapsula documentos, avisos, naviera, tracking y aceptación del
detalle de envío en un contexto `server-only` que sólo acepta el código y prueba
primero el envío mediante sesión/RLS. Baja el inventario a 3 rutas / 7
construcciones y pasó 6 pruebas focales, la suite completa de 5.928 pruebas,
TypeScript y ESLint. No crea migración.

SDD-0346 mueve packing online, consolidaciones y próximo zarpe del listado de
envíos a un contexto `server-only` sin parámetros. Los ids y el tenant se
derivan desde sesión/RLS antes de usar un único admin; un fallo conserva los
datos RLS y vacía sólo los derivados privados. Baja el inventario a 2 rutas / 4
construcciones y pasó 10 pruebas focales, la suite completa de 5.932 pruebas,
TypeScript y ESLint. No crea migración.

SDD-0347 encapsula facturas DDP pendientes, snapshot naviero y próximo zarpe del
home en un contexto `server-only`. El contexto corta antes de elevar para cuentas
pendientes, deriva identidad e ids desde sesión/RLS y reutiliza un solo admin.
Baja el inventario a 1 ruta / 1 construcción y pasó 6 pruebas focales, la suite
completa de 5.936 pruebas, TypeScript y ESLint. No crea migración.

SDD-0348 mueve la lectura de orden DDP pendiente, documentos vigentes y última
evidencia previa a un facade `server-only` que sólo acepta el código y vuelve a
resolver identidad por sesión. La acción, el hash, el sello y la idempotencia no
cambian. El inventario final llega a 0 rutas / 0 construcciones y pasó 38 pruebas
focales/legales, la suite completa de 5.942 pruebas, TypeScript y ESLint. No crea
migración.

SDD-0349 agrega el primer CI independiente del repo con permisos de solo lectura,
actions fijadas por SHA, Node 24, pnpm 11.19.0, Deno 2 y lockfile congelado. Cubre
todos los gates locales sin secretos y deja fuera Docker, E2E y estado alojado.
Pasó su contrato focal de 5 pruebas, la suite completa de 524 archivos / 5.947
pruebas, ESLint, TypeScript, 4 Edge Functions, docs, numeración, componentes,
gobernanza, build de 158 páginas y diff. El workflow todavía no está activo en
GitHub porque esta rama no se ha publicado ni integrado.

SDD-0350 sustituye la policy histórica `FOR ALL` de `invoices` por SELECT,
INSERT y UPDATE separados; sólo `accounting` y `admin` activos del tenant pueden
escribir y `authenticated` pierde DELETE físico. Mantiene temporalmente el
SELECT tenant-wide para no romper consumidores agregados y deja su minimización
como slice independiente. Pasó los 148 contratos SQL con rollback total y el
rebuild de 404 migraciones: 386 aplicadas desde cero, 18 sólo-ledger y aislamiento
verificado en 219 tablas / 2 tenants.

SDD-0351 lleva el contrato admin-only de Mailing a RLS para plantillas, firmas,
reglas, configuración, blacklist y programados; además reserva dos RPC internas
`SECURITY DEFINER` a `service_role`. Mantiene `mail_logs` tenant-wide porque
Cobranzas lo consume y necesita un facade separado. Pasó 149 contratos SQL con
rollback total y el rebuild de 405 migraciones: 387 desde cero, 18 sólo-ledger
y aislamiento verificado en 219 tablas / 2 tenants.

SDD-0352 reemplaza las policies `FOR ALL` de extractos y movimientos bancarios
por una matriz completa que exige `accounting|admin` y tenant activo. Conserva
el CRUD requerido por el rollback compensatorio y elimina TRUNCATE. Pasó 150
contratos SQL con rollback total y el rebuild de 406 migraciones: 388 desde
cero, 18 sólo-ledger y aislamiento verificado en 219 tablas / 2 tenants.

SDD-0353 reemplaza las lecturas crudas de `clients.email` y `mail_logs` en
Cobranzas por una RPC que recibe ids de factura y devuelve sólo Shipping Mark,
flags y fecha UTC. La función exige `accounting|admin`, no acepta tenant y deja
el SELECT directo de logs en admin-only como estado final. SDD-0358 corrige el
orden de release antes de publicar: expansión 0410, app y restricción 0415.
El cierre original pasó 3 pruebas focales, TypeScript,
ESLint, 151 contratos SQL y el rebuild de 407 migraciones: 389 desde cero, 18
sólo-ledger y aislamiento verificado en 219 tablas / 2 tenants.

SDD-0354 reemplaza la lectura fila por fila de facturas en Fidelización, CRM y
Reportes por una RPC que entrega sólo Shipping Mark + USD trailing-12m. Deriva
tenant y permisos efectivos (incluidos overrides), limita la fecha al presente y conserva temporalmente el SELECT
general hasta migrar Conversaciones y Órdenes de venta. Pasó 40 pruebas focales,
TypeScript, ESLint, 152 contratos SQL y el rebuild de 408 migraciones: 390 desde
cero, 18 sólo-ledger y aislamiento verificado en 219 tablas / 2 tenants. La
corrección de overrides volvió a pasar la matriz SQL completa y el rebuild.

SDD-0355 deriva cliente y saldo desde el id de un hilo autorizado, aplica los
permisos efectivos de Conversaciones y elimina su lectura directa de facturas.
Excluye anuladas y no presenta fallos de lectura como saldo cero. Pasó 41
pruebas focales, TypeScript, ESLint, 153 contratos SQL y el rebuild de 409
migraciones: 391 desde cero, 18 sólo-ledger y 219 tablas / 2 tenants aislados.

SDD-0356 entrega referencias mínimas de facturas por lotes de órdenes vivas,
respeta el permiso efectivo del módulo y no esconde errores como listas vacías.
Pasó 5 pruebas focales, la suite completa de 526 archivos / 5.954 pruebas,
TypeScript, ESLint, 154 contratos SQL y el rebuild de 410 migraciones: 392 desde
cero, 18 sólo-ledger y 219 tablas / 2 tenants aislados.

SDD-0357 cierra SELECT crudo de facturas a accounting/admin del tenant y exige
principal Portal activo con cliente vivo y tenant coherente. La regresión SQL
reproduce el cruce previo con Shipping Mark repetido y verifica el cierre,
además de probar las tres RPCs mínimas reales bajo la policy nueva. Congela un
inventario de 18 archivos / 45 llamadas directas; pasó 16 pruebas focales y el
gate canónico completo descrito arriba, salvo Cloud deliberadamente no medido.

SDD-0358 separa el release de Mailing antes de su publicación: 0410 conserva la
lectura antigua durante la expansión, la aplicación consume la RPC y 0415
restringe logs después del smoke. Las dos fases ejecutan el mismo fixture real
y mantienen las señales mínimas de Cobranzas. Pasó 3 unitarios focales, 156
contratos SQL y rebuild de 412 migraciones (394 desde cero + 18 sólo-ledger),
con comprobación estructural de aislamiento de 219 tablas y dos tenants
sintéticos. El baseline canónico de aplicación sigue siendo SDD-0357.

SDD-0359 reproduce y cierra el cruce histórico de envíos, documentos e hitos
entre tenants con Shipping Mark repetido. Exige vínculo activo, cliente vivo y
coherencia padre/hijo; conserva políticas internas y ACL. Pasó 37 unitarios
focales en 6 archivos, los 157 contratos SQL y rebuild de 413 migraciones (395
desde cero + 18 sólo-ledger). No cambia TS/TSX ni sustituye los gates alojados.

## Gates alojados: publicación parcial, push nuevo y release pendientes

La consulta de metadatos al proyecto real el 2026-09-02 encontró 406 entradas
de ledger. Contra los 413 archivos de `origin/main` unión checkout y corte 238:
18 pendientes (las siguientes) y cero huérfanas posteriores al corte. Las 10
RPC nuevas no existen en `pg_proc`. Esto resuelve la incertidumbre de lectura
Cloud, pero no aplica migraciones ni transforma el SKIP local en un pase.
SDD-0361–0364 agregan 0417–0420 localmente: ahora son 417 archivos y 22 gates de aplicación
pendientes del paquete. No se repitió esa consulta ni se escribió en Cloud.

- La migración `0399_revoke_truncate_anon_authenticated.sql` existe en Git y
  pasó contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0400_revoke_public_verify_rpc_execute.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0401_portal_brand_por_principal.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0402_portal_hidden_statuses_por_principal.sql` existe en Git y
  pasó contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0403_portal_advisor_por_principal.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0404_portal_referidos_por_principal.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0405_portal_perfil_privado_por_principal.sql` existe en Git y
  pasó contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0406_portal_packing_lists_por_principal.sql` existe en Git y
  pasó contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0407_invoices_write_rbac.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0408_mailing_admin_rbac.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0409_bank_reconciliation_rbac.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0410_collections_mail_context.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0411_client_annual_billing_facade.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0412_conversation_outstanding_facade.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0413_sales_order_invoice_facade.sql` existe en Git y pasó
  contratos/rebuild locales; NO fue aplicada a Cloud o Producción.
- La migración `0414_invoices_read_rbac.sql` pasó SQL/rebuild locales y NO fue aplicada a Cloud o Producción.
  Requiere 0411–0413 y la aplicación consumidora desplegadas antes de su OK.
- La migración `0415_mail_logs_read_rbac.sql` completa la restricción de logs
  después de 0410 y del deploy/smoke del consumidor. SDD-0358 resolvió localmente
  el acoplamiento del release; las dos fases requieren autorización individual.
  No se ejecutó ninguna escritura en la base alojada.
- La migración `0416_portal_shipments_tenant_boundary.sql` pasó SQL/rebuild
  locales; NO fue aplicada. Requiere gate individual y smoke de su dominio,
  sin dependencia de una nueva RPC o versión de aplicación.
- La migración `0417_portal_prealertas_tenant_boundary.sql` pasó 158 contratos
  SQL y rebuild de 414 migraciones (396 desde cero + 18 sólo-ledger), junto con
  156 unitarios focales. Cierra lectura ajena y cambio de tenant en el dominio
  de compras/proveedores. No fue aplicada; requiere su propio OK y smoke.
- La migración `0418_portal_academia_tenant_boundary.sql` pasó 159 contratos
  SQL, rebuild de 415 migraciones y 68 unitarios de Academia. No fue aplicada;
  requiere su propio OK y smoke de aprendizaje, sin RPC o deploy previo.
- La migración `0419_portal_reclamos_tenant_boundary.sql` pasó 160 contratos
  SQL, rebuild de 416 migraciones y 47 unitarios. No fue aplicada; requiere
  su propio OK y smoke de reclamos/evidencias, sin RPC o deploy previo.
- La migración `0420_portal_payment_reports_tenant_boundary.sql` pasó 161
  contratos SQL, rebuild de 417 migraciones y 19 unitarios. No fue aplicada;
  requiere su propio OK y smoke de reportes, sin RPC o deploy previo. No
  resuelve los fallos separados de sus comandos, que permanecen en el checklist.
- La expansión `0421_payment_report_commands.sql` pasó 400 aserciones, cinco
  carreras y el gate local descrito arriba. No fue aplicada: exige GO nominal,
  adopción de consumidores y posterior restricción en una migración separada.
- La restricción `0422_payment_report_command_boundary.sql` está verificada
  localmente con los comandos y el rename0371 real. Requiere otro GO nominal
  después de aplicar0421 y desplegar/probar consumidores. No aplicar a una app
  antigua ni reabrir grants automáticamente ante un rollback de aplicación.
  El correctivo siguiente0423 no altera esos grants ni el cuerpo0421/0422.
- La migración `0423_payment_report_historical_identity.sql` está verificada
  localmente. Requiere GO nominal después de0421/consumidores/0422 y smoke de
  rename/historial/rechazo financiero. Son420 archivos y25 gates de aplicación
  0399–0423 pendientes en el paquete; no se ejecuta el conjunto en bloque.
- La migración `0424_portal_club_principal_tenant.sql` está verificada
  localmente con 374 aserciones/27 derivas, 166 contratos y rebuild de 421 migraciones.
  Requiere GO nominal propio, preflight fresco, transacción y smoke autorizado
  de identidad/lecturas/historia Club. No requiere nueva RPC ni deploy previo.
  El total posterior es 421 archivos y 26 gates (0399–0424); ninguna aplicada.
- El cambio Telegram requiere configurar/verificar el header secreto en el
  consumidor alojado antes de considerarlo operativo.
- Vercel creó automáticamente un Preview del SHA publicado: deployment GitHub
  `6228639456`, `success`, `production_environment=false`. El conector Vercel
  devolvió 404; la clasificación se comprobó en los metadatos de GitHub.
  No se promovió producción ni se modificaron datos, secretos o configuración.
- El PR está en borrador y no se ha fusionado. Los fallos de memoria y foco
  quedaron resueltos: run `33664422658` aprobado en `a4f1ba5f`. Esto no autoriza
  release ni sustituye el CI de nuevos commits. El build del preview no prueba
  disponibilidad de las RPC.

## Worktrees, ramas y tareas preservadas

- Quedan dos worktrees de DTDCargo: el checkout principal y este worktree.
- El checkout principal estaba limpio, pero atrasado respecto a `origin/main`;
  no se movió ni se sobrescribió.
- `codex/archive-primary-pnpm-20260902` no está contenido por ancestry, pero sus
  dos archivos quedaron semánticamente supersedidos: el workspace actual conserva
  los mismos overrides y agrega versiones/correcciones más nuevas. Será candidato
  a borrado sólo después de publicar e integrar esta rama.
- `codex/archive-cloud-handoff-20260828` no está contenido y conserva tres commits
  documentales únicos sobre `AGENTS.md`, `README.md` y `docs/CODEX_HANDOFF.md`;
  también contiene su merge histórico. Su bundle incremental fue recuperado
  y verificado localmente, sin restaurar instrucciones antiguas. Mantener la
  rama hasta publicar/integrar esa evidencia y resolver su disposición; no
  confundir equivalencia documental con ancestry ni forzar su borrado.
- Este worktree NO se puede retirar: contiene commits locales sin publicar,
  no está integrado/contenido en `origin/main` y conserva el carril activo.
- No se detectaron otras tareas Codex activas de DTDCargo que deban archivarse.

## Próximo cierre seguro

1. Obtener aprobación explícita para el push pendiente y confirmar el CI del
   SHA que se publique; el PR #21 y su CI verde sólo llegan a `eabb230b`.
2. Mantener la rama en borrador mientras existan dependencias de base ausentes.
3. Preparar compatibilidad de app/migraciones antes
   del merge que puede disparar deploy; 0410 es sólo expansión desde SDD-0358.
4. Aplicar individualmente las dependencias con OK específico y el runbook;
   verificar las RPCs antes de desplegar sus consumidores. Integración y deploy
   necesitan su propio gate. Aplicar 0414 y 0415 sólo después del smoke de sus
   consumidores nuevos, de una en una y con autorizaciones separadas.
   Para pagos: expansión0421 → consumidores/smoke → restricción0422/smoke →
   correctivo histórico0423/smoke. No saltar autorizaciones nominales.
   Cada operación alojada conserva su autorización específica.
5. Retirar este worktree únicamente después de probar que sus commits están
   contenidos; mantener las ramas archive hasta auditar su contención.
